import mongoose from 'mongoose';
import { Donation, DonationRequest, PickupAssignment, User, Organization } from '../models/index.js';
import { asyncHandler, ok } from '../utils/http.js';

const oid = (id) => new mongoose.Types.ObjectId(String(id));
const monthsBack = (n) => { const d = new Date(); d.setUTCDate(1); d.setUTCHours(0, 0, 0, 0); d.setUTCMonth(d.getUTCMonth() - (n - 1)); return d; };

/** Only COMPLETED requests count as rescued food. Cancelled/expired never do. */
async function summary(match) {
  const m = { status: 'completed', ...match };
  const [tot] = await DonationRequest.aggregate([{ $match: m }, { $group: { _id: null, completed: { $sum: 1 }, weightKg: { $sum: { $ifNull: ['$weightKg', 0] } }, servings: { $sum: { $ifNull: ['$servings', 0] } } } }]);
  const monthly = await DonationRequest.aggregate([{ $match: { ...m, completedAt: { $gte: monthsBack(6) } } }, { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$completedAt' } }, completed: { $sum: 1 }, weightKg: { $sum: { $ifNull: ['$weightKg', 0] } }, servings: { $sum: { $ifNull: ['$servings', 0] } } } }, { $sort: { _id: 1 } }]);
  const byCategory = await DonationRequest.aggregate([{ $match: m }, { $lookup: { from: 'donations', localField: 'donation', foreignField: '_id', as: 'd' } }, { $unwind: '$d' }, { $group: { _id: '$d.category', count: { $sum: 1 }, weightKg: { $sum: { $ifNull: ['$weightKg', 0] } } } }, { $sort: { count: -1 } }]);
  return { totals: { completed: tot?.completed || 0, weightKg: +(tot?.weightKg || 0).toFixed(1), servings: tot?.servings || 0 }, monthly: monthly.map((x) => ({ month: x._id, completed: x.completed, weightKg: +x.weightKg.toFixed(1), servings: x.servings })), byCategory: byCategory.map((x) => ({ category: x._id, count: x.count, weightKg: +x.weightKg.toFixed(1) })) };
}
const rate = async (match) => {
  const [a] = await DonationRequest.aggregate([{ $match: { ...match, status: { $in: ['accepted', 'ready_for_pickup', 'picked_up', 'delivered', 'completed', 'expired', 'cancelled'] } } }, { $group: { _id: null, all: { $sum: 1 }, done: { $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] } } } }]);
  return a?.all ? Math.round((a.done / a.all) * 100) : null;
};

export const publicStats = asyncHandler(async (_req, res) => {
  const s = await summary({});
  const [donors, orgs] = await Promise.all([Donation.distinct('donor', { status: 'completed' }), Organization.countDocuments({ verificationStatus: 'verified' })]);
  ok(res, { ...s.totals, activeDonors: donors.length, verifiedOrganizations: orgs, note: 'Figures count completed, confirmed handovers only.' });
});

export const mine = asyncHandler(async (req, res) => {
  const u = req.user; const out = { role: u.role };
  if (u.role === 'donor') {
    Object.assign(out, await summary({ donor: u._id }));
    out.completionRate = await rate({ donor: u._id });
    out.active = await Donation.countDocuments({ donor: u._id, status: { $in: ['available', 'request_pending', 'reserved', 'ready_for_pickup'] } });
  } else if (u.role === 'ngo') {
    Object.assign(out, await summary({ ngo: u._id }));
    out.completionRate = await rate({ ngo: u._id });
    out.openRequests = await DonationRequest.countDocuments({ ngo: u._id, status: { $in: ['pending', 'accepted', 'ready_for_pickup', 'picked_up', 'delivered'] } });
  } else if (u.role === 'volunteer') {
    const v = { volunteer: u._id };
    const [c] = await PickupAssignment.aggregate([{ $match: { ...v, status: 'completed' } }, { $group: { _id: null, n: { $sum: 1 }, avgMs: { $avg: { $subtract: ['$times.deliveredAt', '$times.acceptedAt'] } } } }]);
    out.totals = { completed: c?.n || 0, avgCompletionMinutes: c?.avgMs ? Math.round(c.avgMs / 60000) : null };
    out.active = await PickupAssignment.countDocuments({ ...v, status: { $in: ['accepted', 'en_route', 'picked_up'] } });
    out.monthly = (await PickupAssignment.aggregate([{ $match: { ...v, status: 'completed', 'times.completedAt': { $gte: monthsBack(6) } } }, { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$times.completedAt' } }, completed: { $sum: 1 } } }, { $sort: { _id: 1 } }])).map((x) => ({ month: x._id, completed: x.completed }));
  }
  ok(res, out);
});

export const admin = asyncHandler(async (_req, res) => {
  const s = await summary({});
  const [users, donors, orgsVerified, orgsPending, active, completed, expired, assignments, reports] = await Promise.all([
    User.countDocuments(), User.countDocuments({ role: 'donor' }), Organization.countDocuments({ verificationStatus: 'verified' }), Organization.countDocuments({ verificationStatus: 'pending' }),
    Donation.countDocuments({ status: { $in: ['available', 'request_pending', 'reserved', 'ready_for_pickup'] } }), Donation.countDocuments({ status: 'completed' }), Donation.countDocuments({ status: 'expired' }),
    PickupAssignment.countDocuments({ status: { $in: ['assigned', 'accepted', 'en_route', 'picked_up'] } }), mongoose.model('Report').countDocuments({ status: 'open' })]);
  const [avg] = await PickupAssignment.aggregate([{ $match: { status: 'completed' } }, { $group: { _id: null, ms: { $avg: { $subtract: ['$times.deliveredAt', '$times.acceptedAt'] } } } }]);
  ok(res, { ...s, counts: { users, donors, verifiedOrganizations: orgsVerified, pendingVerifications: orgsPending, activeDonations: active, completedDonations: completed, expiredListings: expired, activeAssignments: assignments, openReports: reports }, completionRate: await rate({}), avgPickupMinutes: avg?.ms ? Math.round(avg.ms / 60000) : null });
});
