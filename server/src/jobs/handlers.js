import { Donation, DonationRequest, PickupAssignment, RecurringDonation } from '../models/index.js';
import { ACTIVE_ALLOCATED } from '../models/DonationRequest.js';
import { releaseQuantity, syncDonationStatus } from '../services/donations.js';
import { notify } from '../services/notifications.js';
import { addDays, zonedParts, zonedToUtc } from '../utils/time.js';
import { emitToUser } from '../sockets/io.js';

/** Every handler is idempotent: it only acts through conditional updates keyed on current status. */
export async function expireReservations(now = new Date()) {
  const rows = await DonationRequest.find({ status: { $in: ['pending', 'accepted', 'ready_for_pickup'] }, expiresAt: { $lte: now } }).limit(200);
  let n = 0;
  for (const r of rows) {
    const was = r.status;
    const u = await DonationRequest.findOneAndUpdate({ _id: r._id, status: was }, { $set: { status: 'expired' }, $push: { history: { from: was, to: 'expired', at: now } } });
    if (!u) continue; n++;
    if (ACTIVE_ALLOCATED.includes(was)) await releaseQuantity(r.donation, r.quantity);
    await PickupAssignment.updateOne({ request: r._id, status: { $in: ['open', 'assigned', 'accepted', 'en_route'] } }, { $set: { status: 'cancelled', 'times.cancelledAt': now } });
    await syncDonationStatus(r.donation);
    await notify(r.ngo, { type: 'reservation_expired', title: 'Request expired', message: was === 'pending' ? 'A request timed out before the donor responded.' : 'A reservation expired because pickup did not happen in time.', link: '/ngo/requests' }).catch(() => {});
  }
  return n;
}

export async function expireDonations(now = new Date()) {
  const rows = await Donation.find({ status: { $in: ['available', 'request_pending', 'reserved', 'ready_for_pickup'] }, pickupDeadline: { $lte: now } }).select('_id donor title status').limit(200);
  let n = 0;
  for (const d of rows) {
    const u = await Donation.findOneAndUpdate({ _id: d._id, status: d.status }, { $set: { status: 'expired' }, $push: { statusHistory: { from: d.status, to: 'expired', at: now, note: 'Pickup deadline passed' } } });
    if (!u) continue; n++;
    await notify(d.donor, { type: 'donation_expired', title: 'Listing expired', message: `"${d.title}" passed its pickup deadline and was closed.`, link: '/donor/donations' }).catch(() => {});
  }
  return n;
}

export async function pickupReminders(now = new Date()) {
  const soon = new Date(+now + 60 * 60 * 1000);
  const reqs = await DonationRequest.find({ status: { $in: ['accepted', 'ready_for_pickup'] }, reminded: { $ne: true } }).populate('donation', 'title pickupDeadline').limit(200);
  let n = 0;
  for (const r of reqs) {
    if (!r.donation || r.donation.pickupDeadline > soon || r.donation.pickupDeadline <= now) continue;
    const claimed = await DonationRequest.updateOne({ _id: r._id, reminded: { $ne: true } }, { $set: { reminded: true } }); // reminder sent once
    if (!claimed.modifiedCount) continue; n++;
    await notify(r.ngo, { type: 'deadline_soon', title: 'Pickup deadline approaching', message: `Collect "${r.donation.title}" within the hour.`, link: `/ngo/requests/${r._id}` }).catch(() => {});
    await notify(r.donor, { type: 'deadline_soon', title: 'Pickup deadline approaching', message: `"${r.donation.title}" pickup closes within the hour.`, link: '/donor/requests' }).catch(() => {});
  }
  return n;
}

/** Creates DRAFT listings (donor must confirm real surplus). Unique index on (schedule, date) blocks duplicates. */
export async function generateRecurring(now = new Date()) {
  const schedules = await RecurringDonation.find({ status: 'active' }); let n = 0;
  for (const s of schedules) {
    const today = zonedParts(now, s.timezone).ymd;
    for (const ymd of [today, addDays(today, 1)]) {
      if (ymd < s.startDate || (s.endDate && ymd > s.endDate)) continue;
      const dow = new Date(`${ymd}T12:00:00Z`).getUTCDay();
      if (s.frequency === 'weekly' && !s.daysOfWeek.includes(dow)) continue;
      const from = zonedToUtc(ymd, s.windowStart, s.timezone); const to = zonedToUtc(ymd, s.windowEnd, s.timezone);
      if (to <= now) continue;
      try {
        await Donation.create({ donor: s.donor, title: s.title, category: s.category, description: s.description, quantity: s.quantity, unit: s.unit, servings: s.servings, dietary: s.dietary, storage: s.storage, allergens: s.allergens, address: s.address, city: s.city, location: s.location, pickupInstructions: s.pickupInstructions, availableFrom: from, pickupDeadline: to, status: 'draft', recurringSource: s._id, generatedForDate: ymd, statusHistory: [{ from: null, to: 'draft', at: now, note: 'Generated from recurring schedule' }] });
        n++; await notify(s.donor, { type: 'recurring_draft', title: 'Confirm today’s surplus', message: `A draft for "${s.title}" (${ymd}) is ready. Publish it only if you have surplus.`, link: '/donor/recurring' }).catch(() => {});
      } catch (e) { if (e.code !== 11000) console.error('[recurring]', e.message); }
    }
  }
  return n;
}

// A draft nobody confirmed shouldn't linger past its window.
export async function cleanupDrafts(now = new Date()) {
  const r = await Donation.updateMany({ status: 'draft', recurringSource: { $exists: true }, pickupDeadline: { $lte: now } }, { $set: { status: 'cancelled' }, $push: { statusHistory: { from: 'draft', to: 'cancelled', at: now, note: 'Unconfirmed recurring draft expired' } } });
  return r.modifiedCount;
}
export const runAll = async () => ({ reservations: await expireReservations(), donations: await expireDonations(), reminders: await pickupReminders(), recurring: await generateRecurring(), drafts: await cleanupDrafts() });
