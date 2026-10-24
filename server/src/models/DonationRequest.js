import mongoose from 'mongoose';
const { Schema } = mongoose;

export const REQUEST_STATUSES = ['pending', 'accepted', 'rejected', 'cancelled', 'expired', 'ready_for_pickup', 'picked_up', 'delivered', 'completed'];
export const ACTIVE_ALLOCATED = ['accepted', 'ready_for_pickup', 'picked_up', 'delivered', 'completed'];

const reqSchema = new Schema({
  donation: { type: Schema.Types.ObjectId, ref: 'Donation', required: true, index: true },
  donor: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  ngo: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  organization: { type: Schema.Types.ObjectId, ref: 'Organization' },
  quantity: { type: Number, required: true, min: 0.01 },
  message: { type: String, maxlength: 500 },
  needsVolunteer: { type: Boolean, default: false },
  status: { type: String, enum: REQUEST_STATUSES, default: 'pending', index: true },
  rejectionReason: { type: String, maxlength: 300 },
  expiresAt: { type: Date, index: true },
  reminded: { type: Boolean, default: false },
  weightKg: Number,
  servings: Number,
  history: [{ from: String, to: String, at: { type: Date, default: Date.now }, by: { type: Schema.Types.ObjectId, ref: 'User' }, _id: false }],
  handover: { stage: String, hash: String, expiresAt: Date },
  acceptedAt: Date, pickedUpAt: Date, deliveredAt: Date, completedAt: Date,
}, { timestamps: true });

// One pending request per organisation per donation (blocks duplicate submissions).
reqSchema.index({ donation: 1, ngo: 1 }, { unique: true, partialFilterExpression: { status: 'pending' } });
reqSchema.index({ ngo: 1, createdAt: -1 });
export default mongoose.model('DonationRequest', reqSchema);
