import { isProd } from '../config/env.js';
export const notFound = (req, res) => res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl.split('?')[0]}` });

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  let status = err.status || 500; let message = err.message; let errors = err.errors;
  if (err.name === 'CastError') { status = 400; message = 'Invalid identifier'; }
  else if (err.name === 'ValidationError' && err.errors) { status = 422; message = 'Please correct the highlighted fields'; errors = Object.values(err.errors).map((e) => ({ field: e.path, message: e.message })); }
  else if (err.code === 11000) { status = 409; message = 'That record already exists'; }
  else if (err.name === 'MulterError') { status = 400; message = err.code === 'LIMIT_FILE_SIZE' ? 'Image must be 5 MB or smaller' : 'Upload failed'; }
  else if (err.type === 'entity.too.large') { status = 413; message = 'Request is too large'; }
  if (status >= 500) {
    console.error(`[error] ${req.method} ${req.originalUrl.split('?')[0]} -> ${err.name}: ${err.message}`);
    if (isProd) message = 'Something went wrong on our side. Please try again';
  }
  res.status(status).json({ success: false, message, ...(errors ? { errors } : {}), ...(!isProd && status >= 500 ? { stack: err.stack } : {}) });
}
