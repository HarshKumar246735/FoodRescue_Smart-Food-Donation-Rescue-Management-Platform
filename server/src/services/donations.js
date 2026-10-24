import { Donation, DonationRequest, PickupAssignment } from '../models/index.js';
import { ACTIVE_ALLOCATED } from '../models/DonationRequest.js';
import { canDonationTransition, deriveDonationStatus } from '../utils/statusMachine.js';
import { ApiError } from '../utils/http.js';
import { emitToUser } from '../sockets/io.js';

const FROZEN = new Set(['draft', 'completed', 'cancelled', 'expired', 'rejected']);

/** Move a donation to a new status through the state machine, atomically and with history. */
export async function transitionDonation(donationId, to, { by, note } = {}) {
  const d = await Donation.findById(donationId).select('status');
  if (!d) throw new ApiError(404, 'Donation not found');
  if (d.status === to) return d;
  if (!canDonationTransition(d.status, to)) throw new ApiError(409, `A donation cannot move from ${d.status.replace(/_/g, ' ')} to ${to.replace(/_/g, ' ')}`);
  const updated = await Donation.findOneAndUpdate({ _id: donationId, status: d.status },
    { $set: { status: to }, $push: { statusHistory: { from: d.status, to, by, note, at: new Date() } } }, { new: true });
  if (!updated) throw new ApiError(409, 'This donation was just updated. Refresh and try again');
  return updated;
}

/** Recompute the donation's status from quantities + request states and apply it if legal. */
export async function syncDonationStatus(donationId, by) {
  const d = await Donation.findById(donationId);
  if (!d || FROZEN.has(d.status) || d.suspended) return d;
  const requests = await DonationRequest.find({ donation: donationId }).select('status').lean();
  const next = deriveDonationStatus(d, requests);
  if (next === d.status) return d;
  if (!canDonationTransition(d.status, next)) {
    // Allow completion bookkeeping to skip intermediate states only along the legal pickup chain.
    return d;
  }
  return Donation.findOneAndUpdate({ _id: donationId, status: d.status },
    { $set: { status: next }, $push: { statusHistory: { from: d.status, to: next, by, at: new Date() } } }, { new: true });
}

/** Atomically claim quantity. Fails (returns false) rather than over-allocating, even under concurrency. */
export async function claimQuantity(donationId, qty) {
  const r = await Donation.updateOne(
    { _id: donationId, status: { $in: ['available', 'request_pending', 'reserved', 'ready_for_pickup'] }, suspended: false, pickupDeadline: { $gt: new Date() },
      $expr: { $lte: [{ $add: ['$quantityReserved', qty] }, '$quantity'] } },
    { $inc: { quantityReserved: qty } });
  return r.modifiedCount === 1;
}
export const releaseQuantity = (donationId, qty) =>
  Donation.updateOne({ _id: donationId }, [{ $set: { quantityReserved: { $max: [0, { $subtract: ['$quantityReserved', qty] }] } } }]);

export async function cancelRequestsForDonation(donationId, reason = 'The donor cancelled this listing') {
  const reqs = await DonationRequest.find({ donation: donationId, status: { $in: ['pending', 'accepted', 'ready_for_pickup'] } });
  for (const r of reqs) {
    r.history.push({ from: r.status, to: 'cancelled', at: new Date() }); r.status = 'cancelled'; r.rejectionReason = reason; await r.save();
    await PickupAssignment.updateOne({ request: r._id, status: { $in: ['open', 'assigned', 'accepted', 'en_route'] } }, { $set: { status: 'cancelled', 'times.cancelledAt': new Date() } });
    emitToUser(r.ngo, 'request:updated', { id: r._id, status: 'cancelled' });
  }
  return reqs;
}

/** Who may see the precise address / contact details of a donation? */
export async function hasPreciseAccess(donation, user) {
  if (!user) return false;
  if (user.role === 'admin') return true;
  if (String(donation.donor?._id || donation.donor) === String(user._id)) return true;
  if (user.role === 'ngo') return !!(await DonationRequest.exists({ donation: donation._id, ngo: user._id, status: { $in: ACTIVE_ALLOCATED } }));
  if (user.role === 'volunteer') return !!(await PickupAssignment.exists({ donation: donation._id, volunteer: user._id, status: { $in: ['assigned', 'accepted', 'en_route', 'picked_up', 'delivered', 'completed'] } }));
  return false;
}

const round2 = (n) => Math.round(n * 100) / 100;
/** Serialise a donation for a viewer. Without precise access the address and coordinates are generalised. */
export function serializeDonation(d, { precise = false } = {}) {
  const o = d.toObject ? d.toObject({ virtuals: true }) : { ...d };
  delete o.imagePublicId; delete o.__v; delete o.id;
  o.quantityAvailable = Math.max(0, +(o.quantity - o.quantityReserved).toFixed(3));
  if (o.donor && typeof o.donor === 'object' && o.donor.name) {
    o.donor = { _id: o.donor._id, name: o.donor.business?.name || o.donor.name, type: o.donor.business?.type };
  }
  if (!precise) {
    o.address = o.city || 'Exact address shared after your request is accepted';
    o.pickupInstructions = undefined;
    if (o.location?.coordinates) o.location = { type: 'Point', coordinates: o.location.coordinates.map(round2) };
    o.approximateLocation = true;
  }
  delete o.statusHistory;
  return o;
}
