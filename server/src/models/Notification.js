import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: { type: String, required: true },
  title: { type: String, required: true },
  message: { type: String, default: '' },
  link: String,
  readAt: Date,
}, { timestamps: true });
schema.index({ user: 1, createdAt: -1 });
schema.index({ user: 1, readAt: 1 });
export default mongoose.model('Notification', schema);
