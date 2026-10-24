import mongoose from 'mongoose';
import { UNITS } from '../utils/units.js';
const { Schema } = mongoose;

const schema = new Schema({
  donor: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  title: { type: String, required: true, maxlength: 120 },
  category: { type: String, required: true },
  description: String,
  quantity: { type: Number, required: true, min: 0.01 },
  unit: { type: String, enum: UNITS, required: true },
  servings: Number,
  dietary: { type: String, default: 'not_applicable' },
  storage: { type: String, default: 'ambient' },
  allergens: [String],
  address: { type: String, required: true },
  city: String,
  location: { type: { type: String, enum: ['Point'], default: 'Point' }, coordinates: { type: [Number], required: true } },
  pickupInstructions: String,
  frequency: { type: String, enum: ['daily', 'weekly'], required: true },
  daysOfWeek: [{ type: Number, min: 0, max: 6 }],
  startDate: { type: String, required: true }, // YYYY-MM-DD in `timezone`
  endDate: String,
  windowStart: { type: String, required: true }, // HH:mm
  windowEnd: { type: String, required: true },
  timezone: { type: String, required: true },
  status: { type: String, enum: ['active', 'paused', 'cancelled'], default: 'active', index: true },
}, { timestamps: true });
export default mongoose.model('RecurringDonation', schema);
