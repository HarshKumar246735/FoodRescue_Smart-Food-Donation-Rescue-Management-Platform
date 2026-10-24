import { ApiError } from '../utils/http.js';
export const validate = (schema, part = 'body') => (req, _res, next) => {
  const r = schema.safeParse(req[part]);
  if (!r.success) {
    const errors = r.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
    return next(new ApiError(422, 'Please correct the highlighted fields', errors));
  }
  Object.defineProperty(req, part, { value: r.data, writable: true, configurable: true });
  next();
};
