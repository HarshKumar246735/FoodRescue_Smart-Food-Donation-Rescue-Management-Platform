import bcrypt from 'bcryptjs';
import { User, Organization } from '../models/index.js';
import { ApiError, asyncHandler, ok } from '../utils/http.js';
import { randomToken, sha256 } from '../utils/security.js';
import { setAuthCookie, clearAuthCookie } from '../middleware/auth.js';
import { issueCsrf } from '../middleware/csrf.js';
import { queueEmail } from '../queues/index.js';
import { layout } from '../services/email.js';
import { env, isProd, smtpEnabled } from '../config/env.js';

const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12);

async function sendVerification(user) {
  const token = randomToken(32);
  user.verifyTokenHash = sha256(token); user.verifyExpires = new Date(Date.now() + 24 * 3600 * 1000);
  await user.save();
  const url = `${env.APP_BASE_URL}/verify-email?token=${token}`;
  await queueEmail({ to: user.email, subject: 'Verify your FoodRescue email', text: `Verify your email: ${url}`, html: layout('Verify your email', 'Confirm your address to start using FoodRescue. This link expires in 24 hours.', { url, label: 'Verify email' }) });
}

export const csrf = (req, res) => ok(res, { csrfToken: issueCsrf(req, res) });

export const register = asyncHandler(async (req, res) => {
  const { name, email, password, role, phone, organizationName, businessName } = req.body;
  if (await User.exists({ email })) throw new ApiError(409, 'An account with this email already exists');
  if (role === 'ngo' && !organizationName) throw new ApiError(422, 'Please correct the highlighted fields', [{ field: 'organizationName', message: 'Organization name is required' }]);
  // Development without SMTP: auto-verify so the app is usable. Production always requires email verification.
  const autoVerify = !isProd && !smtpEnabled;
  const user = await User.create({ name, email, phone, role, passwordHash: await bcrypt.hash(password, 12), emailVerified: autoVerify, ...(role === 'donor' && businessName ? { business: { name: businessName } } : {}) });
  if (role === 'ngo') await Organization.create({ owner: user._id, name: organizationName });
  if (!autoVerify) await sendVerification(user);
  setAuthCookie(res, user);
  ok(res, { user: user.toSafe() }, autoVerify ? 'Account created' : 'Account created. Check your email to verify your address', 201);
});

export const login = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email }).select('+passwordHash');
  const valid = await bcrypt.compare(req.body.password, user?.passwordHash || DUMMY_HASH); // constant-ish time, no user enumeration
  if (!user || !valid) throw new ApiError(401, 'Incorrect email or password');
  if (user.status === 'suspended') throw new ApiError(403, 'This account has been suspended. Contact support for help');
  user.lastLoginAt = new Date(); await user.save();
  setAuthCookie(res, user);
  ok(res, { user: user.toSafe() }, 'Signed in');
});

export const logout = (req, res) => { clearAuthCookie(res); ok(res, {}, 'Signed out'); };

export const me = asyncHandler(async (req, res) => {
  const org = req.user.role === 'ngo' ? await Organization.findOne({ owner: req.user._id }).lean() : null;
  ok(res, { user: req.user.toSafe(), organization: org });
});

export const verifyEmail = asyncHandler(async (req, res) => {
  const user = await User.findOne({ verifyTokenHash: sha256(req.body.token), verifyExpires: { $gt: new Date() } }).select('+verifyTokenHash +verifyExpires');
  if (!user) throw new ApiError(400, 'This verification link is invalid or has expired');
  user.emailVerified = true; user.verifyTokenHash = undefined; user.verifyExpires = undefined; await user.save();
  ok(res, { user: user.toSafe() }, 'Email verified');
});

export const resendVerification = asyncHandler(async (req, res) => {
  if (req.user.emailVerified) return ok(res, {}, 'Your email is already verified');
  await sendVerification(req.user);
  ok(res, {}, 'Verification email sent');
});

export const forgotPassword = asyncHandler(async (req, res) => {
  const user = await User.findOne({ email: req.body.email });
  if (user && user.status === 'active') {
    const token = randomToken(32);
    user.resetTokenHash = sha256(token); user.resetExpires = new Date(Date.now() + 30 * 60 * 1000); await user.save();
    const url = `${env.APP_BASE_URL}/reset-password?token=${token}`;
    await queueEmail({ to: user.email, subject: 'Reset your FoodRescue password', text: `Reset your password: ${url}`, html: layout('Reset your password', 'Use the button below to choose a new password. The link works once and expires in 30 minutes.', { url, label: 'Reset password' }) });
  }
  ok(res, {}, 'If that email has an account, a reset link is on its way'); // same response either way
});

export const resetPassword = asyncHandler(async (req, res) => {
  const user = await User.findOne({ resetTokenHash: sha256(req.body.token), resetExpires: { $gt: new Date() } }).select('+resetTokenHash +resetExpires');
  if (!user) throw new ApiError(400, 'This reset link is invalid or has expired');
  user.passwordHash = await bcrypt.hash(req.body.password, 12); user.resetTokenHash = undefined; user.resetExpires = undefined; await user.save(); // single use
  ok(res, {}, 'Password updated. You can sign in now');
});
