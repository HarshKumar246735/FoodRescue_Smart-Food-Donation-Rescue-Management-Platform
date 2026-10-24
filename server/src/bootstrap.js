import { FoodCategory } from './models/index.js';
import { DEFAULT_CATEGORIES } from './models/FoodCategory.js';

/** Idempotent: inserts default categories only when they don't exist; never overwrites admin edits. */
export async function ensureDefaults() {
  await Promise.all(DEFAULT_CATEGORIES.map((c) => FoodCategory.updateOne({ slug: c.slug }, { $setOnInsert: c }, { upsert: true })));
}
