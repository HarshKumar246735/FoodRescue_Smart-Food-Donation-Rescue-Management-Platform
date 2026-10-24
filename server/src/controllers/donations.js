import { Donation, DonationRequest, FoodCategory, PickupAssignment } from '../models/index.js';
import { getSettings } from '../models/Setting.js';
import { ApiError, asyncHandler, escapeRegex, ok, pageMeta, paginate } from '../utils/http.js';
import { cancelRequestsForDonation, hasPreciseAccess, serializeDonation, transitionDonation } from '../services/donations.js';
import { deleteImage, uploadImage } from '../services/cloudinary.js';
import { notify } from '../services/notifications.js';
import { audit } from '../services/audit.js';
import { emitToRole } from '../sockets/io.js';

const PUBLIC_STATUSES = ['available', 'request_pending'];
const VISIBLE_STATUSES = ['available', 'request_pending', 'reserved', 'ready_for_pickup'];

async function checkRules(data, { publishing }) {
  const s = await getSettings(); const now = new Date(); const errs = [];
  const add = (field, message) => errs.push({ field, message });
  const cat = await FoodCategory.findOne({ slug: data.category, active: true }).lean();
  if (!cat) add('category', 'Choose an available category');
  if (data.pickupDeadline <= data.availableFrom) add('pickupDeadline', 'Pickup deadline must be after the available-from time');
  if (publishing) {
    const start = Math.max(+data.availableFrom, +now);
    if (+data.pickupDeadline - start < s.minPickupWindowMinutes * 60000) add('pickupDeadline', `Leave at least ${s.minPickupWindowMinutes} minutes for pickup`);
    if (!data.safetyDeclaration) add('safetyDeclaration', 'You must confirm the food safety declaration');
  }
  if (+data.pickupDeadline - +data.availableFrom > s.maxPickupWindowHours * 3600000) add('pickupDeadline', `Pickup window cannot exceed ${s.maxPickupWindowHours} hours`);
  if (cat?.requiresPrepTime) {
    if (!data.preparedAt) add('preparedAt', 'Preparation time is required for this category');
    else {
      if (data.preparedAt > now) add('preparedAt', 'Preparation time cannot be in the future');
      if (+data.pickupDeadline - +data.preparedAt > s.cookedMealMaxHoursSincePrep * 3600000) add('pickupDeadline', `Prepared food must be collected within ${s.cookedMealMaxHoursSincePrep} hours of preparation`);
    }
  }
  if (errs.length) throw new ApiError(422, 'Please correct the highlighted fields', errs);
  return s;
}

const toDoc = (d) => {
  const { lat, lng, saveAsDraft, ...rest } = d;
  return { ...rest, ...(lat !== undefined ? { location: { type: 'Point', coordinates: [lng, lat] } } : {}) };
};

export const create = asyncHandler(async (req, res) => {
  const data = req.body; const publishing = !data.saveAsDraft;
  if (publishing && !req.user.emailVerified) throw new ApiError(403, 'Verify your email address before publishing a donation');
  const s = await checkRules(data, { publishing });
  const status = publishing ? 'available' : 'draft';
  const donation = await Donation.create({ ...toDoc(data), donor: req.user._id, status, requireVerifiedOrg: data.requireVerifiedOrg ?? s.requireVerifiedOrgDefault, statusHistory: [{ from: null, to: status, by: req.user._id, at: new Date() }] });
  if (publishing) emitToRole('ngo', 'donation:new', { id: donation._id, title: donation.title });
  ok(res, { donation: serializeDonation(donation, { precise: true }) }, publishing ? 'Donation published' : 'Draft saved', 201);
});

function ownerOr404(d, user) {
  if (!d || (user.role !== 'admin' && String(d.donor) !== String(user._id))) throw new ApiError(404, 'Donation not found');
}

export const update = asyncHandler(async (req, res) => {
  const d = await Donation.findById(req.params.id); ownerOr404(d, req.user);
  if (!['draft', 'available', 'request_pending'].includes(d.status)) throw new ApiError(409, 'This donation can no longer be edited');
  const merged = { ...d.toObject(), ...req.body, lat: req.body.lat ?? d.location.coordinates[1], lng: req.body.lng ?? d.location.coordinates[0] };
  if (req.body.quantity !== undefined && req.body.quantity < d.quantityReserved) throw new ApiError(422, 'Please correct the highlighted fields', [{ field: 'quantity', message: `At least ${d.quantityReserved} is already reserved` }]);
  if (d.quantityReserved > 0 && (req.body.lat !== undefined || req.body.address !== undefined)) throw new ApiError(409, 'The pickup location cannot change after a request has been accepted');
  await checkRules(merged, { publishing: d.status !== 'draft' });
  Object.assign(d, toDoc(req.body)); await d.save();
  ok(res, { donation: serializeDonation(d, { precise: true }) }, 'Donation updated');
});

export const publish = asyncHandler(async (req, res) => {
  const d = await Donation.findById(req.params.id); ownerOr404(d, req.user);
  if (!req.user.emailVerified) throw new ApiError(403, 'Verify your email address before publishing a donation');
  if (d.status !== 'draft') throw new ApiError(409, 'Only drafts can be published');
  await checkRules({ ...d.toObject(), safetyDeclaration: req.body?.safetyDeclaration ?? d.safetyDeclaration }, { publishing: true });
  d.safetyDeclaration = true; await d.save();
  const updated = await transitionDonation(d._id, 'available', { by: req.user._id, note: 'Confirmed surplus and published' });
  emitToRole('ngo', 'donation:new', { id: d._id, title: d.title });
  ok(res, { donation: serializeDonation(updated, { precise: true }) }, 'Donation published');
});

export const cancel = asyncHandler(async (req, res) => {
  const d = await Donation.findById(req.params.id); ownerOr404(d, req.user);
  if (!['draft', 'available', 'request_pending', 'reserved', 'ready_for_pickup'].includes(d.status)) throw new ApiError(409, 'This donation can no longer be cancelled');
  const affected = await cancelRequestsForDonation(d._id);
  const updated = await transitionDonation(d._id, 'cancelled', { by: req.user._id, note: req.body?.reason });
  await Promise.all(affected.map((r) => notify(r.ngo, { type: 'donation_cancelled', title: 'Donation cancelled', message: `"${d.title}" is no longer available.`, link: '/ngo/requests' })));
  if (req.user.role === 'admin') await audit(req, 'donation.cancel', 'Donation', d._id);
  ok(res, { donation: serializeDonation(updated, { precise: true }) }, 'Donation cancelled');
});

export const uploadPhoto = asyncHandler(async (req, res) => {
  const d = await Donation.findById(req.params.id).select('+imagePublicId'); ownerOr404(d, req.user);
  const { url, publicId } = await uploadImage(req.file.buffer);
  await deleteImage(d.imagePublicId);
  d.imageUrl = url; d.imagePublicId = publicId; await d.save();
  ok(res, { imageUrl: url }, 'Photo uploaded');
});
export const removePhoto = asyncHandler(async (req, res) => {
  const d = await Donation.findById(req.params.id).select('+imagePublicId'); ownerOr404(d, req.user);
  await deleteImage(d.imagePublicId); d.imageUrl = undefined; d.imagePublicId = undefined; await d.save();
  ok(res, {}, 'Photo removed');
});

export const list = asyncHandler(async (req, res) => {
  const q = req.query; const { page, limit, skip } = paginate(q); const now = new Date();
  const filter = { status: { $in: PUBLIC_STATUSES }, suspended: false, pickupDeadline: { $gt: now } };
  if (q.q) { const rx = new RegExp(escapeRegex(String(q.q).slice(0, 60)), 'i'); filter.$or = [{ title: rx }, { description: rx }, { city: rx }]; }
  if (q.category) filter.category = String(q.category);
  if (q.dietary) filter.dietary = String(q.dietary);
  if (q.availability === 'now') filter.availableFrom = { $lte: now };
  if (q.deadlineWithinHours) filter.pickupDeadline = { $gt: now, $lte: new Date(+now + Number(q.deadlineWithinHours) * 3600000) };
  const minQ = Number(q.minQuantity) || 0;
  const post = minQ ? { $expr: { $gte: [{ $subtract: ['$quantity', '$quantityReserved'] }, minQ] } } : null;
  const lat = Number(q.lat), lng = Number(q.lng); const geo = Number.isFinite(lat) && Number.isFinite(lng) && q.lat !== '' && q.lng !== '';
  const sortKey = q.sort || (geo ? 'nearest' : 'newest');
  let items; let total;
  if (geo) {
    const sort = sortKey === 'deadline' ? { pickupDeadline: 1 } : sortKey === 'newest' ? { createdAt: -1 } : { distanceMeters: 1 };
    const maxDistance = Math.min(Number(q.radiusKm) || 25, 200) * 1000;
    const agg = await Donation.aggregate([
      { $geoNear: { near: { type: 'Point', coordinates: [lng, lat] }, distanceField: 'distanceMeters', maxDistance, query: filter, spherical: true } },
      ...(post ? [{ $match: post }] : []), { $sort: sort },
      { $facet: { items: [{ $skip: skip }, { $limit: limit }, { $lookup: { from: 'users', localField: 'donor', foreignField: '_id', as: 'donor', pipeline: [{ $project: { name: 1, 'business.name': 1, 'business.type': 1 } }] } }, { $unwind: '$donor' }], total: [{ $count: 'n' }] } },
    ]);
    items = agg[0].items; total = agg[0].total[0]?.n || 0;
  } else {
    const sort = sortKey === 'deadline' ? { pickupDeadline: 1 } : { createdAt: -1 };
    const f = post ? { ...filter, ...post } : filter;
    [items, total] = await Promise.all([Donation.find(f).sort(sort).skip(skip).limit(limit).populate('donor', 'name business.name business.type'), Donation.countDocuments(f)]);
  }
  ok(res, { donations: items.map((d) => ({ ...serializeDonation(d), ...(d.distanceMeters !== undefined ? { distanceKm: +(d.distanceMeters / 1000).toFixed(1) } : {}) })) }, 'OK', 200, pageMeta(page, limit, total));
});

export const mine = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query); const filter = { donor: req.user._id };
  if (req.query.status) filter.status = String(req.query.status);
  if (req.query.q) filter.title = new RegExp(escapeRegex(String(req.query.q).slice(0, 60)), 'i');
  const [items, total] = await Promise.all([Donation.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit), Donation.countDocuments(filter)]);
  const counts = await DonationRequest.aggregate([{ $match: { donation: { $in: items.map((d) => d._id) }, status: 'pending' } }, { $group: { _id: '$donation', n: { $sum: 1 } } }]);
  const byId = Object.fromEntries(counts.map((c) => [String(c._id), c.n]));
  ok(res, { donations: items.map((d) => ({ ...serializeDonation(d, { precise: true }), pendingRequests: byId[String(d._id)] || 0 })) }, 'OK', 200, pageMeta(page, limit, total));
});

export const getOne = asyncHandler(async (req, res) => {
  const d = await Donation.findById(req.params.id).populate('donor', 'name business.name business.type');
  if (!d) throw new ApiError(404, 'Donation not found');
  const precise = await hasPreciseAccess(d, req.user);
  const isOwnerOrAdmin = req.user && (req.user.role === 'admin' || String(d.donor._id) === String(req.user._id));
  if (!precise && (d.suspended || !VISIBLE_STATUSES.includes(d.status))) throw new ApiError(404, 'Donation not found');
  const out = serializeDonation(d, { precise });
  if (isOwnerOrAdmin) out.statusHistory = d.statusHistory;
  if (req.user?.role === 'ngo') out.myRequest = await DonationRequest.findOne({ donation: d._id, ngo: req.user._id }).sort({ createdAt: -1 }).lean();
  ok(res, { donation: out });
});
