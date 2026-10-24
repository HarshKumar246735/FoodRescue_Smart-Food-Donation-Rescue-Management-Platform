import jwt from 'jsonwebtoken';
import { env, isProd } from '../config/env.js';
import { User } from '../models/index.js';
import { ApiError, asyncHandler } from '../utils/http.js';

export const cookieOptions = () => ({
  httpOnly: true,
  secure: isProd,
  sameSite: isProd ? 'none' : 'lax',
  maxAge: 7 * 24 * 3600 * 1000,
  path: '/',
});
export const signToken = (user) => jwt.sign({ sub: String(user._id), role: user.role }, env.JWT_SECRET, { expiresIn: '7d' });
export const setAuthCookie = (res, user) => res.cookie(env.COOKIE_NAME, signToken(user), cookieOptions());
export const clearAuthCookie = (res) => res.clearCookie(env.COOKIE_NAME, { ...cookieOptions(), maxAge: undefined });

export async function userFromToken(token) {
  if (!token) return null;
  let payload;
  try { payload = jwt.verify(token, env.JWT_SECRET); } catch { return null; }
  const user = await User.findById(payload.sub);
  return user && user.status === 'active' ? user : null;
}

export const authenticate = asyncHandler(async (req, _res, next) => {
  const token = req.cookies?.[env.COOKIE_NAME];
  if (!token) throw new ApiError(401, 'Please sign in to continue');
  let payload;
  try { payload = jwt.verify(token, env.JWT_SECRET); } catch { throw new ApiError(401, 'Your session has expired. Please sign in again'); }
  const user = await User.findById(payload.sub);
  if (!user) throw new ApiError(401, 'Account not found');
  if (user.status === 'suspended') throw new ApiError(403, 'This account has been suspended. Contact support for help');
  req.user = user;
  next();
});

export const optionalAuth = asyncHandler(async (req, _res, next) => {
  req.user = await userFromToken(req.cookies?.[env.COOKIE_NAME]);
  next();
});

export const authorize = (...roles) => (req, _res, next) =>
  roles.includes(req.user?.role) ? next() : next(new ApiError(403, 'You do not have permission to do that'));

export const requireVerifiedEmail = (req, _res, next) =>
  req.user.emailVerified ? next() : next(new ApiError(403, 'Verify your email address to use this feature'));
