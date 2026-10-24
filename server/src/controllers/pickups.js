import { Donation, DonationRequest, Organization, PickupAssignment, User } from '../models/index.js';
import { getSettings } from '../models/Setting.js';
import { ApiError, asyncHandler, ok, pageMeta, paginate } from '../utils/http.js';
import { randomToken, sha256 } from '../utils/security.js';
import { canPickupTransition } from '../utils/statusMachine.js';
import { setRequestStatus } from '../services/requests.js';
import { syncDonationStatus } from '../services/donations.js';
import { notify } from '../services/notifications.js';
import { emitToUser } from '../sockets/io.js';

const LIVE = ['assigned', 'accepted', 'en_route', 'picked_up', 'delivered'];
const PRECISE = ['accepted', 'en_route', 'picked_up', 'delivered', 'completed'];
const r2 = (n) => Math.round(n * 100) / 100;

async function assertEligible(user) {
  if (!user.emailVerified) throw new ApiError(403, 'Verify your email address before accepting pickups');
  if (!user.phone) throw new ApiError(403, 'Add a phone number to your profile before accepting pickups');
  const s = await getSettings();
  const active = await PickupAssignment.countDocuments({ volunteer: user._id, status: { $in: ['accepted', 'en_route', 'picked_up'] } });
  if (active >= s.maxActiveAssignmentsPerVolunteer) throw new ApiError(409, `You can have at most ${s.maxActiveAssignmentsPerVolunteer} active pickups`);
}

/** Shape an assignment for a viewer; precise addresses/phones only for the right party at the right time. */
async function present(a, user) {
  const [d, req, org] = await Promise.all([
    Donation.findById(a.donation).select('title category unit quantity city address location pickupInstructions handlingNotes pickupDeadline allergens storage imageUrl').lean(),
    DonationRequest.findById(a.request).select('quantity status needsVolunteer').lean(),
    Organization.findOne({ owner: a.ngo }).select('name address location contactPhone').lean(),
  ]);
  const isVol = a.volunteer && String(a.volunteer._id || a.volunteer) === String(user._id);
  const precise = user.role === 'admin' || (isVol && PRECISE.includes(a.status)) || String(a.donor) === String(user._id) || String(a.ngo) === String(user._id);
  const out = { _id: a._id, status: a.status, volunteer: a.volunteer, times: a.times, sharingLocation: a.sharingLocation, createdAt: a.createdAt, quantity: req?.quantity, request: a.request };
  out.donation = { _id: d?._id, title: d?.title, category: d?.category, unit: d?.unit, city: d?.city, pickupDeadline: d?.pickupDeadline, imageUrl: d?.imageUrl };
  out.pickup = precise ? { address: d?.address, location: d?.location, instructions: d?.pickupInstructions, handlingNotes: d?.handlingNotes, allergens: d?.allergens, storage: d?.storage }
    : { address: d?.city || 'Shared after you accept', location: d?.location && { type: 'Point', coordinates: d.location.coordinates.map(r2) }, approximate: true };
  out.delivery = precise ? { name: org?.name, address: org?.address, location: org?.location, phone: org?.contactPhone }
    : { name: org?.name, address: 'Shared after you accept', approximate: true };
  if (isVol && PRECISE.includes(a.status)) {
    const [donor, ngo] = await Promise.all([User.findById(a.donor).select('name phone business.name').lean(), User.findById(a.ngo).select('name phone').lean()]);
    out.contacts = { donor: { name: donor?.business?.name || donor?.name, phone: donor?.phone }, recipient: { name: org?.name || ngo?.name, phone: org?.contactPhone || ngo?.phone } };
  }
  return out;
}

export const available = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query);
  const rows = await PickupAssignment.find({ status: 'open' }).sort({ createdAt: -1 }).lean();
  const live = await Promise.all(rows.map(async (a) => ({ a, d: await Donation.findById(a.donation).select('pickupDeadline').lean() })));
  const open = live.filter((x) => x.d && x.d.pickupDeadline > new Date()).map((x) => x.a);
  const slice = open.slice(skip, skip + limit);
  ok(res, { assignments: await Promise.all(slice.map((a) => present(a, req.user))) }, 'OK', 200, pageMeta(page, limit, open.length));
});

export const mine = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query);
  const done = req.query.view === 'completed';
  const filter = { volunteer: req.user._id, status: { $in: done ? ['completed', 'delivered'] : ['assigned', 'accepted', 'en_route', 'picked_up'] } };
  const [rows, total] = await Promise.all([PickupAssignment.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean(), PickupAssignment.countDocuments(filter)]);
  ok(res, { assignments: await Promise.all(rows.map((a) => present(a, req.user))) }, 'OK', 200, pageMeta(page, limit, total));
});

async function load(req) {
  const a = await PickupAssignment.findById(req.params.id);
  if (!a) throw new ApiError(404, 'Pickup not found');
  const me = String(req.user._id);
  const party = [a.donor, a.ngo, a.volunteer].some((u) => u && String(u) === me) || req.user.role === 'admin';
  const claimable = req.user.role === 'volunteer' && a.status === 'open';
  if (!party && !claimable) throw new ApiError(404, 'Pickup not found');
  return a;
}
const mustBeVolunteer = (a, user) => { if (!a.volunteer || String(a.volunteer) !== String(user._id)) throw new ApiError(403, 'This pickup is not assigned to you'); };

export const getOne = asyncHandler(async (req, res) => {
  const a = await load(req); const o = a.toObject(); delete o.handover;
  if (a.volunteer) o.volunteer = await User.findById(a.volunteer).select('name phone').lean();
  ok(res, { assignment: await present(o, req.user) });
});

async function move(a, to, extra = {}) {
  if (!canPickupTransition(a.status, to)) throw new ApiError(409, `A pickup cannot move from ${a.status.replace(/_/g, ' ')} to ${to.replace(/_/g, ' ')}`);
  const r = await PickupAssignment.findOneAndUpdate({ _id: a._id, status: a.status }, { $set: { status: to, ...extra } }, { new: true });
  if (!r) throw new ApiError(409, 'This pickup was just updated. Refresh and try again');
  return r;
}

export const accept = asyncHandler(async (req, res) => {
  await assertEligible(req.user);
  const a = await load(req);
  let updated;
  if (a.status === 'open') { // atomic claim: only one volunteer can win
    updated = await PickupAssignment.findOneAndUpdate({ _id: a._id, status: 'open', volunteer: null }, { $set: { status: 'accepted', volunteer: req.user._id, 'times.acceptedAt': new Date() } }, { new: true });
    if (!updated) throw new ApiError(409, 'Another volunteer just accepted this pickup');
  } else if (a.status === 'assigned') { mustBeVolunteer(a, req.user); updated = await move(a, 'accepted', { 'times.acceptedAt': new Date() }); }
  else throw new ApiError(409, 'This pickup cannot be accepted');
  await Promise.all([a.donor, a.ngo].map((u) => notify(u, { type: 'pickup_accepted', title: 'Volunteer assigned', message: `${req.user.name} accepted the pickup.`, link: '/pickups' })));
  ok(res, { assignment: await present(updated.toObject(), req.user) }, 'Pickup accepted');
});

export const decline = asyncHandler(async (req, res) => {
  const a = await load(req); mustBeVolunteer(a, req.user);
  if (a.status !== 'assigned') throw new ApiError(409, 'Only pickups assigned to you can be declined');
  await PickupAssignment.updateOne({ _id: a._id, status: 'assigned' }, { $set: { status: 'open', volunteer: null } });
  ok(res, {}, 'Pickup returned to the pool');
});

export const assign = asyncHandler(async (req, res) => {
  const a = await load(req);
  if (req.user.role !== 'admin' && String(a.donor) !== String(req.user._id)) throw new ApiError(403, 'Only the donor or an admin can assign a volunteer');
  const v = await User.findOne({ _id: req.body.volunteer, role: 'volunteer', status: 'active' });
  if (!v) throw new ApiError(404, 'Volunteer not found');
  const updated = await PickupAssignment.findOneAndUpdate({ _id: a._id, status: 'open', volunteer: null }, { $set: { status: 'assigned', volunteer: v._id, 'times.assignedAt': new Date() } }, { new: true });
  if (!updated) throw new ApiError(409, 'This pickup is no longer open');
  await notify(v._id, { type: 'assignment_new', title: 'New pickup assigned', message: 'You have been assigned a pickup. Accept or decline it.', link: `/volunteer/pickups/${a._id}` });
  ok(res, { assignment: updated }, 'Volunteer assigned');
});

export const start = asyncHandler(async (req, res) => {
  const a = await load(req); mustBeVolunteer(a, req.user);
  const u = await move(a, 'en_route', { 'times.enRouteAt': new Date() });
  emitToUser(a.donor, 'pickup:updated', { id: a._id, status: 'en_route' });
  ok(res, { assignment: await present(u.toObject(), req.user) }, 'On your way');
});

export const cancel = asyncHandler(async (req, res) => {
  const a = await load(req); mustBeVolunteer(a, req.user);
  if (!['accepted', 'en_route'].includes(a.status)) throw new ApiError(409, 'You can only cancel before the food has been picked up');
  await PickupAssignment.updateOne({ _id: a._id, status: a.status }, { $set: { status: 'open', volunteer: null, sharingLocation: false }, $unset: { handover: 1 } });
  await Promise.all([a.donor, a.ngo].map((u) => notify(u, { type: 'assignment_cancelled', title: 'Volunteer withdrew', message: 'The pickup is open for another volunteer.', link: '/pickups' })));
  ok(res, {}, 'Pickup released');
});

// A short-lived, single-use token proves a real face-to-face handover. Only a hash is stored.
export const handoverToken = asyncHandler(async (req, res) => {
  const a = await load(req); const me = String(req.user._id);
  const stage = a.status === 'en_route' || a.status === 'accepted' ? 'pickup' : a.status === 'picked_up' ? 'delivery' : null;
  if (!stage) throw new ApiError(409, 'A handover code is not needed at this stage');
  if (stage === 'pickup' && String(a.donor) !== me) throw new ApiError(403, 'Only the donor can create the pickup code');
  if (stage === 'delivery' && String(a.ngo) !== me) throw new ApiError(403, 'Only the receiving organization can create the delivery code');
  if (!a.volunteer) throw new ApiError(409, 'No volunteer has accepted this pickup yet');
  const token = randomToken(18); const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
  await PickupAssignment.updateOne({ _id: a._id }, { $set: { handover: { stage, hash: sha256(token), expiresAt } } });
  ok(res, { token, stage, expiresAt, qrPayload: JSON.stringify({ t: 'fr-handover', p: String(a._id), k: token }) }, 'Handover code created');
});

export const verifyHandover = asyncHandler(async (req, res) => {
  const a = await load(req); mustBeVolunteer(a, req.user);
  const stage = a.status === 'en_route' ? 'pickup' : a.status === 'picked_up' ? 'delivery' : null;
  if (!stage) throw new ApiError(409, a.status === 'accepted' ? 'Tap "Start pickup" first' : 'There is nothing to verify at this stage');
  const to = stage === 'pickup' ? 'picked_up' : 'delivered'; const at = new Date();
  // Single atomic step: validates volunteer, stage, token hash and expiry, and consumes the token.
  const updated = await PickupAssignment.findOneAndUpdate(
    { _id: a._id, volunteer: req.user._id, status: a.status, 'handover.stage': stage, 'handover.hash': sha256(req.body.token), 'handover.expiresAt': { $gt: at } },
    { $set: { status: to, [stage === 'pickup' ? 'times.pickedUpAt' : 'times.deliveredAt']: at }, $unset: { handover: 1 } }, { new: true });
  if (!updated) throw new ApiError(400, 'That code is invalid, expired or already used. Ask for a new one');
  await setRequestStatus(a.request, to, { by: req.user._id, extra: { [stage === 'pickup' ? 'pickedUpAt' : 'deliveredAt']: at } });
  await syncDonationStatus(a.donation, req.user._id);
  const msg = stage === 'pickup' ? { type: 'picked_up', title: 'Food picked up', text: 'The volunteer collected the food.' } : { type: 'delivered', title: 'Food delivered', text: 'Confirm receipt to complete the donation.' };
  await Promise.all([a.donor, a.ngo].map((u) => notify(u, { type: msg.type, title: msg.title, message: msg.text, link: '/pickups' })));
  ok(res, { assignment: await present(updated.toObject(), req.user) }, stage === 'pickup' ? 'Pickup verified' : 'Delivery verified');
});

export const setSharing = asyncHandler(async (req, res) => {
  const a = await load(req); mustBeVolunteer(a, req.user);
  const on = !!req.body.on;
  if (on) {
    if (!req.user.volunteer?.shareLocationConsent) throw new ApiError(403, 'Turn on location sharing consent in your profile first');
    if (!['en_route', 'picked_up'].includes(a.status)) throw new ApiError(409, 'Location can only be shared during an active pickup');
  }
  await PickupAssignment.updateOne({ _id: a._id }, { $set: { sharingLocation: on } });
  ok(res, { sharingLocation: on }, on ? 'Location sharing on' : 'Location sharing off');
});

export const forParty = asyncHandler(async (req, res) => {
  const { page, limit, skip } = paginate(req.query);
  const key = req.user.role === 'donor' ? 'donor' : 'ngo';
  const filter = { [key]: req.user._id, status: { $ne: 'cancelled' } };
  const [rows, total] = await Promise.all([PickupAssignment.find(filter).sort({ updatedAt: -1 }).skip(skip).limit(limit).lean(), PickupAssignment.countDocuments(filter)]);
  const vols = await User.find({ _id: { $in: rows.map((r) => r.volunteer).filter(Boolean) } }).select('name').lean();
  const vm = Object.fromEntries(vols.map((v) => [String(v._id), v]));
  ok(res, { assignments: await Promise.all(rows.map(async (a) => ({ ...(await present({ ...a, volunteer: vm[String(a.volunteer)] || null }, req.user)) }))) }, 'OK', 200, pageMeta(page, limit, total));
});
