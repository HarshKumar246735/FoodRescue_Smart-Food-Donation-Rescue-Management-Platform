import { DonationRequest } from '../models/index.js';
import { canRequestTransition } from '../utils/statusMachine.js';
import { ApiError } from '../utils/http.js';
import { emitToUser } from '../sockets/io.js';

/** Conditional (compare-and-set) request transition, validated against the state machine. */
export async function setRequestStatus(requestId, to, { by, extra = {} } = {}) {
  const r = await DonationRequest.findById(requestId).select('status ngo donor');
  if (!r) throw new ApiError(404, 'Request not found');
  if (!canRequestTransition(r.status, to)) throw new ApiError(409, `A request cannot move from ${r.status.replace(/_/g, ' ')} to ${to.replace(/_/g, ' ')}`);
  const updated = await DonationRequest.findOneAndUpdate({ _id: requestId, status: r.status },
    { $set: { status: to, ...extra }, $push: { history: { from: r.status, to, by, at: new Date() } } }, { new: true });
  if (!updated) throw new ApiError(409, 'This request was just updated. Refresh and try again');
  emitToUser(updated.ngo, 'request:updated', { id: updated._id, status: to });
  emitToUser(updated.donor, 'request:updated', { id: updated._id, status: to });
  return updated;
}
