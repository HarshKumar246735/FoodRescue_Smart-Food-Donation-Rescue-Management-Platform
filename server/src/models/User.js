import mongoose from 'mongoose';
const { Schema } = mongoose;

export const ROLES = ['donor', 'ngo', 'volunteer', 'admin'];

const availabilitySchema = new Schema({ day: { type: Number, min: 0, max: 6 }, from: String, to: String }, { _id: false });

const userSchema = new Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ROLES, required: true, index: true },
  status: { type: String, enum: ['active', 'suspended'], default: 'active', index: true },
  suspendedReason: String,
  emailVerified: { type: Boolean, default: false },
  verifyTokenHash: { type: String, select: false },
  verifyExpires: { type: Date, select: false },
  resetTokenHash: { type: String, select: false },
  resetExpires: { type: Date, select: false },
  phone: { type: String, trim: true, maxlength: 30 },
  avatarUrl: String,
  // Donor business profile
  business: {
    name: { type: String, trim: true, maxlength: 120 },
    type: { type: String, enum: ['restaurant', 'grocery', 'bakery', 'hotel', 'event', 'other'] },
    address: { type: String, maxlength: 250 },
    description: { type: String, maxlength: 600 },
  },
  // Volunteer profile
  volunteer: {
    bio: { type: String, maxlength: 500 },
    vehicle: { type: String, enum: ['none', 'bicycle', 'motorbike', 'car', 'van'], default: 'none' },
    available: { type: Boolean, default: false },
    availability: [availabilitySchema],
    shareLocationConsent: { type: Boolean, default: false },
  },
  lastLoginAt: Date,
}, { timestamps: true });

userSchema.methods.toSafe = function toSafe() {
  const o = this.toObject();
  delete o.passwordHash; delete o.verifyTokenHash; delete o.verifyExpires; delete o.resetTokenHash; delete o.resetExpires; delete o.__v;
  return o;
};

export default mongoose.model('User', userSchema);
