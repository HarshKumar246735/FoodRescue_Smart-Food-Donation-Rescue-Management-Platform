import rateLimit from 'express-rate-limit';
const base = { standardHeaders: true, legacyHeaders: false };
const msg = (m) => ({ success: false, message: m });
export const apiLimiter = rateLimit({ ...base, windowMs: 60_000, limit: 300, message: msg('Too many requests. Please slow down') });
export const authLimiter = rateLimit({ ...base, windowMs: 15 * 60_000, limit: 20, message: msg('Too many attempts. Try again in a few minutes') });
export const emailLimiter = rateLimit({ ...base, windowMs: 60 * 60_000, limit: 6, message: msg('Too many email requests. Try again later') });
