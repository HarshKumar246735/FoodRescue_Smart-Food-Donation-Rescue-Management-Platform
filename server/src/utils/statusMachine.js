// Pure, testable state machines. The server is the only place state changes happen.
export const DONATION_TRANSITIONS = {
  draft: ['available', 'cancelled'],
  available: ['request_pending', 'reserved', 'cancelled', 'expired', 'rejected'],
  request_pending: ['available', 'reserved', 'cancelled', 'expired', 'rejected'],
  reserved: ['available', 'request_pending', 'ready_for_pickup', 'picked_up', 'cancelled', 'expired', 'rejected'],
  ready_for_pickup: ['reserved', 'available', 'picked_up', 'cancelled', 'expired', 'rejected'],
  picked_up: ['delivered', 'completed'],
  delivered: ['completed'],
  completed: [], cancelled: [], expired: [], rejected: [],
};
export const REQUEST_TRANSITIONS = {
  pending: ['accepted', 'rejected', 'cancelled', 'expired'],
  accepted: ['ready_for_pickup', 'picked_up', 'cancelled', 'expired'],
  ready_for_pickup: ['picked_up', 'cancelled', 'expired'],
  picked_up: ['delivered', 'completed'],
  delivered: ['completed'],
  completed: [], rejected: [], cancelled: [], expired: [],
};
export const PICKUP_TRANSITIONS = {
  open: ['assigned', 'accepted', 'cancelled'],
  assigned: ['accepted', 'open', 'cancelled'],
  accepted: ['en_route', 'open', 'cancelled'],
  en_route: ['picked_up', 'open', 'cancelled'],
  picked_up: ['delivered'],
  delivered: ['completed'],
  completed: [], cancelled: [],
};
const make = (table) => (from, to) => !!table[from]?.includes(to);
export const canDonationTransition = make(DONATION_TRANSITIONS);
export const canRequestTransition = make(REQUEST_TRANSITIONS);
export const canPickupTransition = make(PICKUP_TRANSITIONS);

const RANK = { accepted: 0, ready_for_pickup: 1, picked_up: 2, delivered: 3, completed: 4 };
const FROM_RANK = ['reserved', 'ready_for_pickup', 'picked_up', 'delivered', 'completed'];

/**
 * Derive the donation-level status from quantities and request states.
 * `requests` = [{status}] for every request of the donation.
 */
export function deriveDonationStatus({ quantity, quantityReserved }, requests) {
  const pending = requests.filter((r) => r.status === 'pending').length;
  const allocated = requests.filter((r) => r.status in RANK);
  const remaining = +(quantity - quantityReserved).toFixed(3);
  if (remaining > 0 || allocated.length === 0) return pending > 0 ? 'request_pending' : 'available';
  const min = Math.min(...allocated.map((r) => RANK[r.status]));
  return FROM_RANK[min];
}
