import multer from 'multer';
import { ApiError } from '../utils/http.js';
import { sniffImage } from '../utils/image.js';

export const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024, files: 1 } }).single('image');

export function requireImage(req, _res, next) {
  if (!req.file) return next(new ApiError(400, 'Choose an image to upload'));
  if (!sniffImage(req.file.buffer)) return next(new ApiError(415, 'Only JPEG, PNG or WebP images are allowed'));
  next();
}
