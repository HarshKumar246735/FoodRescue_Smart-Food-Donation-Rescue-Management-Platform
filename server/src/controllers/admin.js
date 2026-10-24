import { AuditLog, Donation, DonationRequest, FoodCategory, Organization, PickupAssignment, Report, Setting, User } from '../models/index.js';
import { getSettings } from '../models/Setting.js';
import { ApiError, asyncHandler, escapeRegex, ok, pageMeta, paginate } from '../utils/http.js';
import { audit } from '../services/audit.js';
import { notify } from '../services/notifications.js';
import { cancelRequestsForDonation, serializeDonation, transitionDonation } from '../services/donations.js';

const page = (req) => paginate(req.query);

export const users = asyncHandler(async (req, res) => {
  const { page: p, limit, skip } = page(req); const f = {};
  if (req.query.role) f.role = String(req.query.role); if (req.query.status) f.status = String(req.query.status);
  if (req.query.q) { const rx = new RegExp(escapeRegex(String(req.query.q).slice(0, 60)), 'i'); f.$or = [{ name: rx }, { email: rx }]; }
  const [items, total] = await Promise.all([User.find(f).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), User.countDocuments(f)]);
  ok(res, { users: items.map(({ passwordHash, verifyTokenHash, resetTokenHash, ...u }) => u) }, 'OK', 200, pageMeta(p, limit, total));
});
export const setUserStatus = (status) => asyncHandler(async (req, res) => {
  const u = await User.findById(req.params.id); if (!u) throw new ApiError(404, 'User not found');
  if (String(u._id) === String(req.user._id)) throw new ApiError(409, 'You cannot change your own account status');
  if (u.role === 'admin') throw new ApiError(403, 'Administrator accounts cannot be suspended here');
  u.status = status; u.suspendedReason = status === 'suspended' ? req.body?.reason : undefined; await u.save();
  await audit(req, `user.${status === 'suspended' ? 'suspend' : 'reactivate'}`, 'User', u._id, { reason: req.body?.reason });
  await notify(u._id, { type: 'account_status', title: status === 'suspended' ? 'Account suspended' : 'Account reactivated', message: status === 'suspended' ? 'Your account was suspended by an administrator.' : 'Your account is active again.' });
  ok(res, { user: u.toSafe() }, status === 'suspended' ? 'Account suspended' : 'Account reactivated');
});

export const organizations = asyncHandler(async (req, res) => {
  const { page: p, limit, skip } = page(req); const f = {}; if (req.query.status) f.verificationStatus = String(req.query.status);
  const [items, total] = await Promise.all([Organization.find(f).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('owner', 'name email phone emailVerified').lean(), Organization.countDocuments(f)]);
  ok(res, { organizations: items }, 'OK', 200, pageMeta(p, limit, total));
});
export const verifyOrg = asyncHandler(async (req, res) => {
  const decision = req.body.decision; if (!['verified', 'rejected'].includes(decision)) throw new ApiError(422, 'Choose verified or rejected');
  const org = await Organization.findById(req.params.id); if (!org) throw new ApiError(404, 'Organization not found');
  org.verificationStatus = decision; org.verifiedBy = req.user._id; org.verifiedAt = new Date(); org.verificationNotes = String(req.body.notes || '').slice(0, 500); await org.save();
  await audit(req, `organization.${decision}`, 'Organization', org._id, { notes: org.verificationNotes });
  await notify(org.owner, { type: 'org_verification', title: decision === 'verified' ? 'Organization verified' : 'Verification not approved', message: decision === 'verified' ? 'You can now request donations.' : `Your verification was not approved.${org.verificationNotes ? ` Note: ${org.verificationNotes}` : ''}`, link: '/ngo/organization' });
  ok(res, { organization: org }, `Organization ${decision}`);
});

export const donations = asyncHandler(async (req, res) => {
  const { page: p, limit, skip } = page(req); const f = {};
  if (req.query.status) f.status = String(req.query.status); if (req.query.suspended === 'true') f.suspended = true;
  if (req.query.q) f.title = new RegExp(escapeRegex(String(req.query.q).slice(0, 60)), 'i');
  const [items, total] = await Promise.all([Donation.find(f).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('donor', 'name business.name'), Donation.countDocuments(f)]);
  ok(res, { donations: items.map((d) => serializeDonation(d, { precise: true })) }, 'OK', 200, pageMeta(p, limit, total));
});
export const suspendDonation = (suspend) => asyncHandler(async (req, res) => {
  const d = await Donation.findById(req.params.id); if (!d) throw new ApiError(404, 'Donation not found');
  d.suspended = suspend; d.suspendedReason = suspend ? String(req.body?.reason || 'Pending review').slice(0, 300) : undefined; await d.save();
  await audit(req, suspend ? 'donation.suspend' : 'donation.unsuspend', 'Donation', d._id, { reason: d.suspendedReason });
  await notify(d.donor, { type: 'donation_review', title: suspend ? 'Listing suspended for review' : 'Listing restored', message: suspend ? `"${d.title}" was suspended pending review.` : `"${d.title}" is live again.`, link: '/donor/donations' });
  ok(res, { donation: serializeDonation(d, { precise: true }) }, suspend ? 'Listing suspended' : 'Listing restored');
});
export const rejectDonation = asyncHandler(async (req, res) => {
  const d = await Donation.findById(req.params.id); if (!d) throw new ApiError(404, 'Donation not found');
  await cancelRequestsForDonation(d._id, 'This listing was removed by an administrator');
  const u = await transitionDonation(d._id, 'rejected', { by: req.user._id, note: req.body?.reason });
  await audit(req, 'donation.reject', 'Donation', d._id, { reason: req.body?.reason });
  await notify(d.donor, { type: 'donation_review', title: 'Listing removed', message: `"${d.title}" was removed by an administrator.` });
  ok(res, { donation: serializeDonation(u, { precise: true }) }, 'Listing rejected');
});

export const requests = asyncHandler(async (req, res) => {
  const { page: p, limit, skip } = page(req); const f = req.query.status ? { status: String(req.query.status) } : {};
  const [items, total] = await Promise.all([DonationRequest.find(f).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('donation', 'title unit').populate('ngo', 'name').populate('donor', 'name').lean(), DonationRequest.countDocuments(f)]);
  ok(res, { requests: items }, 'OK', 200, pageMeta(p, limit, total));
});
export const pickups = asyncHandler(async (req, res) => {
  const { page: p, limit, skip } = page(req); const f = req.query.status ? { status: String(req.query.status) } : {};
  const [items, total] = await Promise.all([PickupAssignment.find(f).select('-handover').sort({ createdAt: -1 }).skip(skip).limit(limit).populate('donation', 'title').populate('volunteer', 'name').lean(), PickupAssignment.countDocuments(f)]);
  ok(res, { pickups: items }, 'OK', 200, pageMeta(p, limit, total));
});

export const reports = asyncHandler(async (req, res) => {
  const { page: p, limit, skip } = page(req); const f = req.query.status ? { status: String(req.query.status) } : {};
  const [items, total] = await Promise.all([Report.find(f).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('donation', 'title suspended status').populate('reporter', 'name').lean(), Report.countDocuments(f)]);
  ok(res, { reports: items }, 'OK', 200, pageMeta(p, limit, total));
});
export const resolveReport = asyncHandler(async (req, res) => {
  const r = await Report.findById(req.params.id); if (!r) throw new ApiError(404, 'Report not found');
  const { outcome, note } = req.body; if (!['resolved', 'dismissed'].includes(outcome)) throw new ApiError(422, 'Choose resolved or dismissed');
  r.status = outcome; r.resolutionNote = String(note || '').slice(0, 500); r.resolvedBy = req.user._id; await r.save();
  if (req.body.suspendListing) await Donation.updateOne({ _id: r.donation }, { $set: { suspended: true, suspendedReason: 'Suspended after a report' } });
  await audit(req, `report.${outcome}`, 'Report', r._id, { suspendListing: !!req.body.suspendListing });
  ok(res, { report: r }, 'Report updated');
});

export const auditLogs = asyncHandler(async (req, res) => {
  const { page: p, limit, skip } = page(req); const f = req.query.action ? { action: new RegExp(`^${escapeRegex(String(req.query.action))}`) } : {};
  const [items, total] = await Promise.all([AuditLog.find(f).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('actor', 'name email').lean(), AuditLog.countDocuments(f)]);
  ok(res, { logs: items }, 'OK', 200, pageMeta(p, limit, total));
});

export const adminCategories = asyncHandler(async (_req, res) => ok(res, { categories: await FoodCategory.find().sort({ name: 1 }).lean() }));
export const saveCategory = asyncHandler(async (req, res) => {
  const c = req.params.id ? await FoodCategory.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }) : await FoodCategory.create(req.body);
  if (!c) throw new ApiError(404, 'Category not found');
  await audit(req, req.params.id ? 'category.update' : 'category.create', 'FoodCategory', c._id); ok(res, { category: c }, 'Category saved', req.params.id ? 200 : 201);
});
export const getSettingsHandler = asyncHandler(async (_req, res) => ok(res, { settings: await getSettings() }));
export const saveSettings = asyncHandler(async (req, res) => {
  await Promise.all(Object.entries(req.body).map(([key, value]) => Setting.updateOne({ key }, { $set: { value } }, { upsert: true })));
  await audit(req, 'settings.update', 'Setting', null, req.body); ok(res, { settings: await getSettings() }, 'Settings saved');
});
