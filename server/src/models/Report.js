import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  donation: { type: mongoose.Schema.Types.ObjectId, ref: 'Donation', required: true, index: true },
  reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reason: { type: String, enum: ['incorrect_information', 'unsafe_handling', 'expired_food', 'suspicious_listing', 'inappropriate_content', 'other'], required: true },
  details: { type: String, maxlength: 800 },
  status: { type: String, enum: ['open', 'resolved', 'dismissed'], default: 'open', index: true },
  resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  resolutionNote: { type: String, maxlength: 500 },
}, { timestamps: true });
schema.index({ donation: 1, reporter: 1 }, { unique: true });
export default mongoose.model('Report', schema);
