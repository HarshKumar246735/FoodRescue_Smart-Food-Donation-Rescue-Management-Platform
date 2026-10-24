import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  name: { type: String, required: true, trim: true, maxlength: 60 },
  description: { type: String, maxlength: 200 },
  requiresPrepTime: { type: Boolean, default: false },
  active: { type: Boolean, default: true },
}, { timestamps: true });
export default mongoose.model('FoodCategory', schema);

export const DEFAULT_CATEGORIES = [
  { slug: 'fresh_produce', name: 'Fresh fruits and vegetables' },
  { slug: 'packaged', name: 'Packaged food' },
  { slug: 'cooked_meals', name: 'Cooked meals', requiresPrepTime: true },
  { slug: 'bakery', name: 'Bakery items' },
  { slug: 'dairy', name: 'Dairy products' },
  { slug: 'other', name: 'Other eligible food' },
];
