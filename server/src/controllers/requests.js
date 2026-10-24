import { Donation, DonationRequest, Organization, PickupAssignment, User } from '../models/index.js';
import { ACTIVE_ALLOCATED } from '../models/DonationRequest.js';
import { getSettings } from '../models/Setting.js';
import { ApiError, asyncHandler, ok, pageMeta, paginate } from '../utils/http.js';
import { claimQuantity, releaseQuantity, syncDonationStatus } from '../services/donations.js';
import { setRequestStatus } from '../services/requests.js';
import { notify } from '../services/notifications.js';
import { emitToRole, emitToUser } from '../sockets/io.js';
import { toKg } from '../utils/units.js';

const POPULATE_DONATION = 'title category imageUrl unit quantity city pickupDeadline status';

export const create = asyncHandler(async (req, res) => {
  const { donation: donationId, quantity, message, needsVolunteer } = req.body; const now = new Date();
  const d = await Donation.findById(donationId);
  if (!d || d.suspended || !['available', 'request_pending'].includes(d.status)) throw new ApiError(409, 'This donation is no longer accepting requests');
  if (d.pickupDeadline <= now) throw new ApiError(409, 'The pickup deadline for this donation has passed');
  const org = await Organization.findOne({ owner: req.user._id });
  if (d.requireVerifiedOrg && org?.verificationStatus !== 'verified') throw new ApiError(403, 'This donor only accepts requests from verified organizations. Complete verification first');
  const available = +(d.quantity - d.quantityReserved).toFixed(3);
  if (quantity > available) throw new ApiError(422, 'Please correct the highlighted fields', [{ field: 'quantity', message: `Only ${available} ${d.unit} left` }]);
  const s = await getSettings();
  const expiresAt = new Date(Math.min(+now + s.requestExpiryHours * 3600000, +d.pickupDeadline));
  let request;
  try { request = await DonationRequest.create({ donation: d._id, donor: d.donor, ngo: req.user._id, organization: org?._id, quantity, message, needsVolunteer, expiresAt, history: [{ from: null, to: 'pending', by: req.user._id }] }); }
  catch (e) { if (e.code === 11000) throw new ApiError(409, 'You already have a pending request for this donation'); throw e; }
  await syncDonationStatus(d._id, req.user._id);
  await notify(d.donor, { type: 'request_new', title: 'New donation request', message: `${org?.name || req.user.name} requested ${quantity} ${d.unit} of "${d.title}".`, link: '/donor/requests' });
  ok(res, { request }, 'Request sent', 201);
});

const roleFilter = (user) => (user.role === 'donor' ? { donor: user._id } : user.role === 'ngo' ? { ngo: user._id } : {});

export const list = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query); const filter = roleFilter(req.user);
  if (req.query.status) filter.status = { $in: String(req.query.status).split(',') };
  if (req.query.donation) filter.donation = String(req.query.donation);
  const [items, total] = await Promise.all([
    DonationRequest.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('donation', POPULATE_DONATION).populate('organization', 'name verificationStatus').populate('ngo', 'name').lean(),
    DonationRequest.countDocuments(filter)]);
  ok(res, { requests: items }, 'OK', 200, pageMeta(page, limit, total));
});

async function loadFor(req) {
  const r = await DonationRequest.findById(req.params.id);
  const mine = r && [String(r.donor), String(r.ngo)].includes(String(req.user._id));
  if (!r || (!mine && req.user.role !== 'admin')) throw new ApiError(404, 'Request not found');
  return r;
}
const ownDonor = async (req) => { const r = await loadFor(req); if (String(r.donor) !== String(req.user._id)) throw new ApiError(403, 'Only the donor can do this'); return r; };
const ownNgo = async (req) => { const r = await loadFor(req); if (String(r.ngo) !== String(req.user._id)) throw new ApiError(403, 'Only the requesting organization can do this'); return r; };

export const getOne = asyncHandler(async (req, res) => {
  const r = await loadFor(req);
  await r.populate([{ path: 'donation', select: `${POPULATE_DONATION} address location pickupInstructions handlingNotes allergens storage dietary` }, { path: 'organization', select: 'name type address contactPhone verificationStatus' }, { path: 'donor', select: 'name phone business.name' }, { path: 'ngo', select: 'name phone' }]);
  const out = r.toObject(); delete out.handover;
  const allocated = ACTIVE_ALLOCATED.includes(r.status);
  if (!allocated && req.user.role !== 'admin') {
    // Precise address and the other party's phone are only shared once the request is accepted.
    if (String(r.ngo._id) === String(req.user._id)) { out.donation.address = out.donation.city || 'Shared after acceptance'; delete out.donation.location; delete out.donation.pickupInstructions; delete out.donor.phone; }
    else delete out.ngo.phone;
  }
  out.assignment = await PickupAssignment.findOne({ request: r._id }).select('status volunteer sharingLocation').populate('volunteer', 'name phone').lean();
  if (out.assignment && !allocated) delete out.assignment.volunteer;
  ok(res, { request: out });
});

export const accept = asyncHandler(async (req, res) => {
  const r = await ownDonor(req);
  if (r.status !== 'pending') throw new ApiError(409, `This request is already ${r.status}`);
  const d = await Donation.findById(r.donation);
  if (!d || d.suspended) throw new ApiError(409, 'This donation is not available');
  if (!(await claimQuantity(d._id, r.quantity))) throw new ApiError(409, 'There is not enough quantity left to accept this request. Reject it or reduce your other reservations');
  let updated;
  try {
    updated = await setRequestStatus(r._id, 'accepted', { by: req.user._id, extra: { acceptedAt: new Date(), expiresAt: d.pickupDeadline, weightKg: toKg(d.unit, r.quantity), servings: d.servings ? Math.round((d.servings * r.quantity) / d.quantity) : undefined } });
  } catch (e) { await releaseQuantity(d._id, r.quantity); throw e; }
  if (updated.needsVolunteer) {
    const a = await PickupAssignment.create({ request: r._id, donation: d._id, donor: r.donor, ngo: r.ngo, status: 'open' });
    emitToRole('volunteer', 'assignment:new', { id: a._id, title: d.title });
  }
  await syncDonationStatus(d._id, req.user._id);
  await notify(r.ngo, { type: 'request_accepted', title: 'Request accepted', message: `Your request for "${d.title}" was accepted. Pickup details are now available.`, link: `/ngo/requests/${r._id}` });
  ok(res, { request: updated }, 'Request accepted');
});

export const reject = asyncHandler(async (req, res) => {
  const r = await ownDonor(req);
  const updated = await setRequestStatus(r._id, 'rejected', { by: req.user._id, extra: { rejectionReason: req.body.reason } });
  await syncDonationStatus(r.donation, req.user._id);
  const d = await Donation.findById(r.donation).select('title');
  await notify(r.ngo, { type: 'request_rejected', title: 'Request declined', message: `Your request for "${d?.title}" was declined.${req.body.reason ? ` Reason: ${req.body.reason}` : ''}`, link: `/ngo/requests/${r._id}` });
  ok(res, { request: updated }, 'Request rejected');
});

export const cancel = asyncHandler(async (req, res) => {
  const r = await ownNgo(req); const wasAllocated = ACTIVE_ALLOCATED.includes(r.status);
  const updated = await setRequestStatus(r._id, 'cancelled', { by: req.user._id });
  if (wasAllocated) await releaseQuantity(r.donation, r.quantity);
  const a = await PickupAssignment.findOneAndUpdate({ request: r._id, status: { $in: ['open', 'assigned', 'accepted', 'en_route'] } }, { $set: { status: 'cancelled', 'times.cancelledAt': new Date() } });
  await syncDonationStatus(r.donation, req.user._id);
  await notify(r.donor, { type: 'request_cancelled', title: 'Request cancelled', message: 'An organization cancelled its request.', link: '/donor/requests' });
  if (a?.volunteer) await notify(a.volunteer, { type: 'assignment_cancelled', title: 'Pickup cancelled', message: 'The organization cancelled this request.', link: '/volunteer/pickups' });
  ok(res, { request: updated }, 'Request cancelled');
});

export const markReady = asyncHandler(async (req, res) => {
  const r = await ownDonor(req);
  const updated = await setRequestStatus(r._id, 'ready_for_pickup', { by: req.user._id });
  await syncDonationStatus(r.donation, req.user._id);
  await notify(r.ngo, { type: 'ready_for_pickup', title: 'Food is ready for pickup', message: 'The donor marked your donation ready.', link: `/ngo/requests/${r._id}` });
  const a = await PickupAssignment.findOne({ request: r._id, volunteer: { $ne: null } }).select('volunteer');
  if (a) await notify(a.volunteer, { type: 'ready_for_pickup', title: 'Pickup is ready', message: 'The donor marked the food ready.', link: `/volunteer/pickups/${a._id}` });
  ok(res, { request: updated }, 'Marked ready for pickup');
});

// Direct pickup (no volunteer): donor confirms the food has been handed to the organization.
export const confirmHandover = asyncHandler(async (req, res) => {
  const r = await ownDonor(req);
  if (r.needsVolunteer) throw new ApiError(409, 'A volunteer handles the pickup for this request. Verify the handover with their code');
  const updated = await setRequestStatus(r._id, 'picked_up', { by: req.user._id, extra: { pickedUpAt: new Date() } });
  await syncDonationStatus(r.donation, req.user._id);
  await notify(r.ngo, { type: 'picked_up', title: 'Food handed over', message: 'Confirm receipt once you have the food.', link: `/ngo/requests/${r._id}` });
  ok(res, { request: updated }, 'Handover confirmed');
});

export const confirmReceipt = asyncHandler(async (req, res) => {
  const r = await ownNgo(req);
  const needed = r.needsVolunteer ? 'delivered' : 'picked_up';
  if (r.status !== needed) throw new ApiError(409, r.needsVolunteer ? 'Confirm receipt after the volunteer delivers the food' : 'Confirm receipt after the donor hands over the food');
  const updated = await setRequestStatus(r._id, 'completed', { by: req.user._id, extra: { completedAt: new Date() } });
  const a = await PickupAssignment.findOneAndUpdate({ request: r._id, status: 'delivered' }, { $set: { status: 'completed', 'times.completedAt': new Date() } });
  await syncDonationStatus(r.donation, req.user._id);
  const d = await Donation.findById(r.donation).select('title');
  await notify(r.donor, { type: 'donation_completed', title: 'Donation completed', message: `"${d?.title}" reached its recipient. Thank you!`, link: '/donor/history' });
  if (a?.volunteer) await notify(a.volunteer, { type: 'donation_completed', title: 'Delivery completed', message: 'The organization confirmed receipt.', link: '/volunteer/completed' });
  ok(res, { request: updated }, 'Receipt confirmed');
});
