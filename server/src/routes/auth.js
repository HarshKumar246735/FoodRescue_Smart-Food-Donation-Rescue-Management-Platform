import { Router } from 'express';
import * as c from '../controllers/auth.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { authLimiter, emailLimiter } from '../middleware/rateLimit.js';
import { registerSchema, loginSchema, emailSchema, tokenSchema, resetSchema } from '../validators/index.js';

const r = Router();
r.get('/csrf', c.csrf);
r.post('/register', authLimiter, validate(registerSchema), c.register);
r.post('/login', authLimiter, validate(loginSchema), c.login);
r.post('/logout', c.logout);
r.get('/me', authenticate, c.me);
r.post('/verify-email', authLimiter, validate(tokenSchema), c.verifyEmail);
r.post('/resend-verification', authenticate, emailLimiter, c.resendVerification);
r.post('/forgot-password', emailLimiter, validate(emailSchema), c.forgotPassword);
r.post('/reset-password', authLimiter, validate(resetSchema), c.resetPassword);
export default r;
