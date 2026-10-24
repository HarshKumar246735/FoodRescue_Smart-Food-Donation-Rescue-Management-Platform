import mongoose from 'mongoose';
const { Schema } = mongoose;

const orgSchema = new Schema({
  owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
  name: { type: String, required: true, trim: true, maxlength: 140 },
  type: { type: String, enum: ['ngo', 'charity', 'shelter', 'community_kitchen', 'other'], default: 'ngo' },
  registrationNumber: { type: String, trim: true, maxlength: 60 },
  description: { type: String, maxlength: 800 },
  address: { type: String, maxlength: 250 },
  location: { type: { type: String, enum: ['Point'], default: 'Point' }, coordinates: { type: [Number], default: undefined } },
  contactPhone: String,
  verificationStatus: { type: String, enum: ['pending', 'verified', 'rejected'], default: 'pending', index: true },
  verifiedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  verifiedAt: Date,
  verificationNotes: { type: String, maxlength: 500 },
}, { timestamps: true });

orgSchema.index({ location: '2dsphere' }, { sparse: true });
export default mongoose.model('Organization', orgSchema);
