import { Donation, RecurringDonation } from '../models/index.js';
import { ApiError, asyncHandler, ok } from '../utils/http.js';
import { audit } from '../services/audit.js';

const toDoc = ({ lat, lng, ...r }) => ({ ...r, location: { type: 'Point', coordinates: [lng, lat] } });
const own = async (req) => { const r = await RecurringDonation.findOne({ _id: req.params.id, donor: req.user._id }); if (!r) throw new ApiError(404, 'Schedule not found'); return r; };

export const list = asyncHandler(async (req, res) => ok(res, { schedules: await RecurringDonation.find({ donor: req.user._id, status: { $ne: 'cancelled' } }).sort({ createdAt: -1 }).lean() }));
export const create = asyncHandler(async (req, res) => ok(res, { schedule: await RecurringDonation.create({ ...toDoc(req.body), donor: req.user._id }) }, 'Schedule created', 201));
export const update = asyncHandler(async (req, res) => { const r = await own(req); Object.assign(r, toDoc(req.body)); await r.save(); ok(res, { schedule: r }, 'Schedule updated'); });
export const setStatus = (status, message) => asyncHandler(async (req, res) => {
  const r = await own(req); if (r.status === 'cancelled') throw new ApiError(409, 'This schedule was cancelled');
  r.status = status; await r.save(); ok(res, { schedule: r }, message);
});
/** Generated listings are drafts: the donor must confirm there is real surplus before they go live. */
export const generated = asyncHandler(async (req, res) => ok(res, { donations: await Donation.find({ donor: req.user._id, recurringSource: req.params.id, status: 'draft' }).sort({ availableFrom: 1 }).limit(30).lean() }));
