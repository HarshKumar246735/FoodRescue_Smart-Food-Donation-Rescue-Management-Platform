import mongoose from 'mongoose';
import { UNITS } from '../utils/units.js';
const { Schema } = mongoose;

export const DONATION_STATUSES = ['draft', 'available', 'request_pending', 'reserved', 'ready_for_pickup', 'picked_up', 'delivered', 'completed', 'cancelled', 'expired', 'rejected'];

const historySchema = new Schema({
  from: String, to: String, at: { type: Date, default: Date.now },
  by: { type: Schema.Types.ObjectId, ref: 'User' }, note: String,
}, { _id: false });

const donationSchema = new Schema({
  donor: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  category: { type: String, required: true, index: true },
  description: { type: String, maxlength: 1000 },
  imageUrl: String,
  imagePublicId: { type: String, select: false },
  quantity: { type: Number, required: true, min: 0.01 },
  quantityReserved: { type: Number, default: 0, min: 0 },
  unit: { type: String, enum: UNITS, required: true },
  servings: { type: Number, min: 0 },
  dietary: { type: String, enum: ['vegetarian', 'non_vegetarian', 'vegan', 'not_applicable'], default: 'not_applicable' },
  allergens: [{ type: String, trim: true, maxlength: 40 }],
  preparedAt: Date,
  storage: { type: String, enum: ['ambient', 'refrigerated', 'frozen', 'hot_held'], default: 'ambient' },
  address: { type: String, required: true, maxlength: 250 },
  city: { type: String, maxlength: 80 },
  location: { type: { type: String, enum: ['Point'], default: 'Point' }, coordinates: { type: [Number], required: true } },
  pickupInstructions: { type: String, maxlength: 500 },
  handlingNotes: { type: String, maxlength: 500 },
  availableFrom: { type: Date, required: true },
  pickupDeadline: { type: Date, required: true, index: true },
  requireVerifiedOrg: { type: Boolean, default: true },
  safetyDeclaration: { type: Boolean, default: false },
  status: { type: String, enum: DONATION_STATUSES, default: 'draft', index: true },
  suspended: { type: Boolean, default: false, index: true },
  suspendedReason: String,
  statusHistory: [historySchema],
  recurringSource: { type: Schema.Types.ObjectId, ref: 'RecurringDonation', index: true },
  generatedForDate: String,
}, { timestamps: true });

donationSchema.index({ location: '2dsphere' });
donationSchema.index({ status: 1, pickupDeadline: 1 });
donationSchema.index({ recurringSource: 1, generatedForDate: 1 }, { unique: true, partialFilterExpression: { recurringSource: { $exists: true } } });
donationSchema.virtual('quantityAvailable').get(function () { return Math.max(0, +(this.quantity - this.quantityReserved).toFixed(3)); });
donationSchema.set('toJSON', { virtuals: true });
donationSchema.set('toObject', { virtuals: true });

export default mongoose.model('Donation', donationSchema);
