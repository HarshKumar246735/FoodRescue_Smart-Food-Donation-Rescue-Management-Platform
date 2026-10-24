// Development seed. Refuses to run in production. Passwords come from SEED_PASSWORD or are generated and printed once.
import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { env, isProd } from './config/env.js';
import { connectDB } from './config/db.js';
import { Donation, Organization, User } from './models/index.js';
import { ensureDefaults } from './bootstrap.js';

if (isProd) { console.error('Refusing to seed in production.'); process.exit(1); }
const password = process.env.SEED_PASSWORD || `Fr${crypto.randomBytes(6).toString('hex')}9A`;
await connectDB(); await ensureDefaults();
const hash = await bcrypt.hash(password, 12);
const mk = (o) =>
  User.findOneAndUpdate(
    { email: o.email },
    {
      $set: {
        passwordHash: hash,
        emailVerified: true,
      },
      $setOnInsert: o,
    },
    {
      upsert: true,
      new: true,
    }
  );
const admin = await mk({ name: 'Demo Admin', email: 'admin@foodrescue.test', role: 'admin' });
const donor = await mk({ name: 'Green Bites', email: 'donor@foodrescue.test', role: 'donor', phone: '+10000000001', business: { name: 'Green Bites Restaurant', type: 'restaurant' } });
const ngo = await mk({ name: 'Hope Foundation', email: 'ngo@foodrescue.test', role: 'ngo', phone: '+10000000002' });
await mk({ name: 'Vik Volunteer', email: 'volunteer@foodrescue.test', role: 'volunteer', phone: '+10000000003', volunteer: { available: true, vehicle: 'bicycle', shareLocationConsent: true } });
await Organization.findOneAndUpdate(
  { owner: ngo._id },
  {
    $set: {
      location: {
        type: 'Point',
        coordinates: [77.209, 28.6139],
      },
    },
    $setOnInsert: {
      owner: ngo._id,
      name: 'Hope Foundation',
      type: 'ngo',
      address: '12 Community Road',
      verificationStatus: 'verified',
      verifiedBy: admin._id,
      verifiedAt: new Date(),
    },
  },
  {
    upsert: true,
    new: true,
  }
);
if (!(await Donation.exists({ donor: donor._id, title: '[Sample] Mixed vegetables' }))) {
  const now = Date.now();
  await Donation.create({ donor: donor._id, title: '[Sample] Mixed vegetables', category: 'fresh_produce', description: 'Sample listing for local testing.', quantity: 12, unit: 'kg', servings: 40, address: '1 Market Street, Sampletown', city: 'Sampletown', location: { type: 'Point', coordinates: [77.209, 28.6139] }, availableFrom: new Date(now - 3600e3), pickupDeadline: new Date(now + 20 * 3600e3), status: 'available', safetyDeclaration: true, statusHistory: [{ to: 'available', at: new Date() }] });
}
console.log('\nSeeded development users (all share one password):');
['admin', 'donor', 'ngo', 'volunteer'].forEach((r) => console.log(`  ${r}@foodrescue.test`));
console.log(`Password: ${password}\n(Sample data is labelled "[Sample]". Seed users exist for local development only.)`);
process.exit(0);
