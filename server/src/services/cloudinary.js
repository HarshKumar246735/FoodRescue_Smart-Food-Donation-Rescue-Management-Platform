import { v2 as cloudinary } from 'cloudinary';
import { env, cloudinaryEnabled } from '../config/env.js';
import { ApiError } from '../utils/http.js';

if (cloudinaryEnabled) cloudinary.config({ cloud_name: env.CLOUDINARY_CLOUD_NAME, api_key: env.CLOUDINARY_API_KEY, api_secret: env.CLOUDINARY_API_SECRET, secure: true });

export function uploadImage(buffer, folder = 'foodrescue/donations') {
  if (!cloudinaryEnabled) throw new ApiError(503, 'Photo uploads are not configured on this server');
  return new Promise((resolve, reject) => {
    const s = cloudinary.uploader.upload_stream({ folder, resource_type: 'image', transformation: [{ width: 1200, height: 900, crop: 'limit', quality: 'auto' }] },
      (err, r) => (err ? reject(new ApiError(502, 'Image upload failed')) : resolve({ url: r.secure_url, publicId: r.public_id })));
    s.end(buffer);
  });
}
export async function deleteImage(publicId) {
  if (!cloudinaryEnabled || !publicId) return;
  try { await cloudinary.uploader.destroy(publicId); } catch (e) { console.error('[cloudinary] delete failed', e.message); }
}
