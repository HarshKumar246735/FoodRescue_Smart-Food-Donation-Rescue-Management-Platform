import mongoose from 'mongoose';
const { Schema } = mongoose;

export const PICKUP_STATUSES = ['open', 'assigned', 'accepted', 'en_route', 'picked_up', 'delivered', 'completed', 'cancelled'];

const schema = new Schema({
  request: { type: Schema.Types.ObjectId, ref: 'DonationRequest', required: true, unique: true },
  donation: { type: Schema.Types.ObjectId, ref: 'Donation', required: true },
  donor: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  ngo: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  volunteer: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
  status: { type: String, enum: PICKUP_STATUSES, default: 'open', index: true },
  // Short-lived, single-use handover token (only the hash is stored).
  handover: { stage: { type: String, enum: ['pickup', 'delivery'] }, hash: String, expiresAt: Date },
  times: {
    assignedAt: Date, acceptedAt: Date, enRouteAt: Date, pickedUpAt: Date, deliveredAt: Date, completedAt: Date, cancelledAt: Date,
  },
  sharingLocation: { type: Boolean, default: false },
}, { timestamps: true });

schema.index({ status: 1, createdAt: -1 });
export default mongoose.model('PickupAssignment', schema);
