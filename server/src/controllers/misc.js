import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { Donation, FoodCategory, Notification, Organization, Report, User } from '../models/index.js';
import { ApiError, asyncHandler, ok, pageMeta, paginate } from '../utils/http.js';
import { env, geocoderEnabled } from '../config/env.js';
import { dbState } from '../config/db.js';
import { queueStatus } from '../queues/index.js';
import { notify } from '../services/notifications.js';

// ---- users ----
export const updateProfile = asyncHandler(async (req, res) => {
  const { business, volunteer, ...rest } = req.body; const u = req.user;
  Object.assign(u, rest);
  if (business && u.role === 'donor') u.business = { ...(u.business?.toObject?.() || {}), ...business };
  if (volunteer && u.role === 'volunteer') u.volunteer = { ...(u.volunteer?.toObject?.() || {}), ...volunteer };
  await u.save(); ok(res, { user: u.toSafe() }, 'Profile updated');
});
export const changePassword = asyncHandler(async (req, res) => {
  const u = await User.findById(req.user._id).select('+passwordHash');
  if (!(await bcrypt.compare(req.body.currentPassword, u.passwordHash))) throw new ApiError(422, 'Please correct the highlighted fields', [{ field: 'currentPassword', message: 'Current password is incorrect' }]);
  u.passwordHash = await bcrypt.hash(req.body.newPassword, 12); await u.save(); ok(res, {}, 'Password changed');
});
export const volunteers = asyncHandler(async (req, res) => {
  const list = await User.find({ role: 'volunteer', status: 'active', 'volunteer.available': true }).select('name volunteer.vehicle volunteer.bio').limit(50).lean();
  ok(res, { volunteers: list });
});

// ---- organizations ----
export const myOrg = asyncHandler(async (req, res) => ok(res, { organization: await Organization.findOne({ owner: req.user._id }).lean() }));
export const saveOrg = asyncHandler(async (req, res) => {
  const { lat, lng, ...rest } = req.body;
  const org = await Organization.findOne({ owner: req.user._id }) || new Organization({ owner: req.user._id });
  Object.assign(org, rest); if (lat !== undefined && lng !== undefined) org.location = { type: 'Point', coordinates: [lng, lat] };
  await org.save(); ok(res, { organization: org }, 'Organization saved');
});

// ---- notifications ----
export const listNotifications = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query); const f = { user: req.user._id }; if (req.query.unread === 'true') f.readAt = null;
  const [items, total, unread] = await Promise.all([Notification.find(f).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), Notification.countDocuments(f), Notification.countDocuments({ user: req.user._id, readAt: null })]);
  ok(res, { notifications: items, unread }, 'OK', 200, pageMeta(page, limit, total));
});
export const unreadCount = asyncHandler(async (req, res) => ok(res, { unread: await Notification.countDocuments({ user: req.user._id, readAt: null }) }));
export const markRead = asyncHandler(async (req, res) => {
  const n = await Notification.findOneAndUpdate({ _id: req.params.id, user: req.user._id }, { $set: { readAt: new Date() } }, { new: true });
  if (!n) throw new ApiError(404, 'Notification not found'); ok(res, { notification: n });
});
export const markAllRead = asyncHandler(async (req, res) => { await Notification.updateMany({ user: req.user._id, readAt: null }, { $set: { readAt: new Date() } }); ok(res, {}, 'All caught up'); });

// ---- categories (public) ----
export const categories = asyncHandler(async (_req, res) => ok(res, { categories: await FoodCategory.find({ active: true }).sort({ name: 1 }).lean() }));

// ---- reports ----
export const createReport = asyncHandler(async (req, res) => {
  const d = await Donation.findById(req.body.donation).select('donor title');
  if (!d) throw new ApiError(404, 'Donation not found');
  if (String(d.donor) === String(req.user._id)) throw new ApiError(409, 'You cannot report your own donation');
  try { await Report.create({ ...req.body, reporter: req.user._id }); } catch (e) { if (e.code === 11000) throw new ApiError(409, 'You already reported this donation'); throw e; }
  const admins = await User.find({ role: 'admin', status: 'active' }).select('_id').lean();
  await Promise.all(admins.map((a) => notify(a._id, { type: 'report_new', title: 'New report', message: `A donation was reported: ${d.title}`, link: '/admin/reports' })));
  ok(res, {}, 'Report sent. Our team will review it', 201);
});

// ---- geocoding (server-side proxy: keeps the API key private and rate-limited) ----
export const geocode = asyncHandler(async (req, res) => {
  if (!geocoderEnabled) throw new ApiError(503, 'Address search is not configured. Click the map to set a location instead');
  const q = String(req.query.q || '').trim().slice(0, 150); if (q.length < 3) throw new ApiError(400, 'Type at least 3 characters');
  const url = new URL(env.GEOCODER_URL); url.searchParams.set('text', q); url.searchParams.set('limit', '5'); url.searchParams.set('format', 'json'); url.searchParams.set('apiKey', env.GEOCODER_API_KEY);
  const r = await fetch(url, { signal: AbortSignal.timeout(6000) });
  if (!r.ok) throw new ApiError(502, 'Address search is temporarily unavailable');
  const j = await r.json();
  ok(res, { results: (j.results || []).map((x) => ({ label: x.formatted, lat: x.lat, lng: x.lon, city: x.city || x.town || x.village || x.county })) });
});

// ---- health ----
export const health = (_req, res) => {
  const db = dbState(); const healthy = db === 'connected';
  res.status(healthy ? 200 : 503).json({ success: healthy, status: healthy ? 'ok' : 'degraded', uptime: Math.round(process.uptime()), services: { database: db, queue: queueStatus(), cloudinary: !!env.CLOUDINARY_CLOUD_NAME, email: !!env.SMTP_HOST, geocoder: geocoderEnabled }, time: new Date().toISOString() });
};
export const objectIdValid = (id) => mongoose.isValidObjectId(id);
