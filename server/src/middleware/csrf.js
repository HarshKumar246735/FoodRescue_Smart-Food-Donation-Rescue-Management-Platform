import { isProd } from '../config/env.js';
import { ApiError } from '../utils/http.js';
import { randomToken, safeEqual } from '../utils/security.js';

// Double-submit token. The token lives in an HTTP-only cookie AND is returned in the
// body of GET /auth/csrf; the SPA echoes it in the X-CSRF-Token header. Cross-site
// forms cannot read the body, so they cannot forge the header. SameSite + CORS allowlist add depth.
export const CSRF_COOKIE = 'foodrescue_csrf';
const opts = () => ({ httpOnly: true, secure: isProd, sameSite: isProd ? 'none' : 'lax', path: '/', maxAge: 7 * 24 * 3600 * 1000 });

export function issueCsrf(req, res) {
  const token = randomToken(24);
  res.cookie(CSRF_COOKIE, token, opts());
  return token;
}
export function csrfProtection(req, _res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const cookie = req.cookies?.[CSRF_COOKIE];
  const header = req.get('x-csrf-token');
  if (!cookie || !header || !safeEqual(cookie, header)) return next(new ApiError(403, 'Security check failed. Refresh the page and try again'));
  next();
}
