import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { boot, client, signUp, donationPayload, PASSWORD } from './helpers.js';

let ctx;
before(async () => { ctx = await boot(); });
after(async () => { await ctx.stop(); });

async function verifiedNgo(n) {
  const s = await signUp(ctx.app, 'ngo', n);
  await ctx.models.Organization.updateOne({ owner: s.user._id }, { verificationStatus: 'verified' });
  return s;
}

test('health endpoint reports database state without secrets', async () => {
  const r = await request(ctx.app).get('/api/v1/health');
  assert.equal(r.status, 200); assert.equal(r.body.services.database, 'connected'); assert.ok(!JSON.stringify(r.body).includes('mongodb://'));
});

test('writes without a CSRF token are rejected', async () => {
  const r = await request(ctx.app).post('/api/v1/auth/login').send({ email: 'a@b.co', password: 'x' });
  assert.equal(r.status, 403);
});

test('registration hashes passwords, blocks admin self-assignment, and login sets an HTTP-only cookie', async () => {
  const c = await client(ctx.app);
  const bad = await c.post('/auth/register', { name: 'Eve', email: 'eve@test.dev', password: PASSWORD, role: 'admin' });
  assert.equal(bad.status, 422);
  const weak = await c.post('/auth/register', { name: 'Eve', email: 'eve@test.dev', password: 'short', role: 'donor' });
  assert.equal(weak.status, 422);
  const { user } = await signUp(ctx.app, 'donor', 1);
  const raw = await ctx.models.User.findById(user._id).select('+passwordHash');
  assert.notEqual(raw.passwordHash, PASSWORD); assert.match(raw.passwordHash, /^\$2[aby]\$/);
  const c2 = await client(ctx.app);
  const login = await c2.post('/auth/login', { email: 'donor1@test.dev', password: PASSWORD });
  assert.equal(login.status, 200); assert.match(login.headers['set-cookie'].join(';'), /HttpOnly/i);
  assert.equal((await c2.post('/auth/login', { email: 'donor1@test.dev', password: 'WrongPass123' })).status, 401);
  assert.equal(login.body.data.user.passwordHash, undefined);
});

test('protected routes and role-based authorization', async () => {
  const anon = await client(ctx.app);
  assert.equal((await anon.get('/auth/me')).status, 401);
  const ngo = await signUp(ctx.app, 'ngo', 90);
  assert.equal((await ngo.c.post('/donations', donationPayload())).status, 403);
  assert.equal((await ngo.c.get('/admin/users')).status, 403);
  const vol = await signUp(ctx.app, 'volunteer', 90);
  assert.equal((await vol.c.get('/donations/mine')).status, 403);
});

test('profile updates cannot change role or status', async () => {
  const { c, user } = await signUp(ctx.app, 'donor', 2);
  assert.equal((await c.patch('/users/me', { role: 'admin' })).status, 422);
  assert.equal((await c.patch('/users/me', { status: 'active' })).status, 422);
  const ok = await c.patch('/users/me', { name: 'Renamed' }); assert.equal(ok.status, 200);
  assert.equal((await ctx.models.User.findById(user._id)).role, 'donor');
});

test('donation creation, validation, owner-only editing, filtering and privacy', async () => {
  const a = await signUp(ctx.app, 'donor', 3); const b = await signUp(ctx.app, 'donor', 4);
  const bad = await a.c.post('/donations', donationPayload({ pickupDeadline: new Date(Date.now() - 1000).toISOString() }));
  assert.equal(bad.status, 422);
  const cooked = await a.c.post('/donations', donationPayload({ category: 'cooked_meals' }));
  assert.equal(cooked.status, 422); // preparation time required
  const created = await a.c.post('/donations', donationPayload({ title: 'Searchable bread', category: 'bakery', lat: 28.6139, lng: 77.209 }));
  assert.equal(created.status, 201);
  const id = created.body.data.donation._id;
  assert.equal((await b.c.patch(`/donations/${id}`, { title: 'Hijacked' })).status, 404);
  assert.equal((await a.c.patch(`/donations/${id}`, { title: 'Searchable rye bread' })).status, 200);
  const anon = await client(ctx.app);
  const list = await anon.get('/donations?q=rye&category=bakery');
  assert.equal(list.body.data.donations.length, 1);
  assert.equal(list.body.data.donations[0].address, 'Testville'); // precise address hidden from the public
  assert.equal(list.body.data.donations[0].pickupInstructions, undefined);
  const near = await anon.get('/donations?lat=28.6139&lng=77.209&radiusKm=5&sort=nearest');
  assert.ok(near.body.data.donations.some((d) => d._id === id) && near.body.data.donations[0].distanceKm !== undefined);
  const far = await anon.get('/donations?lat=0&lng=0&radiusKm=5'); assert.equal(far.body.data.donations.length, 0);
  assert.equal((await anon.get('/donations?minQuantity=1000')).body.data.donations.length, 0);
});

test('expiry job closes listings past their deadline exactly once', async () => {
  const a = await signUp(ctx.app, 'donor', 5);
  const d = await ctx.models.Donation.create({ donor: a.user._id, title: 'Old', category: 'other', quantity: 1, unit: 'kg', address: 'x street', location: { type: 'Point', coordinates: [1, 1] }, availableFrom: new Date(Date.now() - 7200e3), pickupDeadline: new Date(Date.now() - 1000), status: 'available' });
  const { expireDonations } = await import('../src/jobs/handlers.js');
  assert.ok((await expireDonations()) >= 1); assert.equal((await ctx.models.Donation.findById(d._id)).status, 'expired');
  assert.equal(await expireDonations(), 0); // idempotent
  assert.equal(((await ctx.models.Donation.findById(d._id)).statusHistory.filter((h) => h.to === 'expired')).length, 1);
});

test('requests: unverified orgs blocked, approval/rejection, no over-allocation, concurrency', async () => {
  const donor = await signUp(ctx.app, 'donor', 6);
  const dn = await donor.c.post('/donations', donationPayload({ quantity: 10 })); const donationId = dn.body.data.donation._id;
  const unverified = await signUp(ctx.app, 'ngo', 6);
  assert.equal((await unverified.c.post('/donation-requests', { donation: donationId, quantity: 2 })).status, 403);

  const n1 = await verifiedNgo(7), n2 = await verifiedNgo(8), n3 = await verifiedNgo(9);
  assert.equal((await n1.c.post('/donation-requests', { donation: donationId, quantity: 11 })).status, 422);
  const r1 = await n1.c.post('/donation-requests', { donation: donationId, quantity: 6 }); assert.equal(r1.status, 201);
  assert.equal((await n1.c.post('/donation-requests', { donation: donationId, quantity: 1 })).status, 409); // duplicate pending
  const r2 = await n2.c.post('/donation-requests', { donation: donationId, quantity: 6 });
  const r3 = await n3.c.post('/donation-requests', { donation: donationId, quantity: 3 });
  assert.equal((await ctx.models.Donation.findById(donationId)).status, 'request_pending');
  // Only the owning donor may decide.
  assert.equal((await n2.c.patch(`/donation-requests/${r1.body.data.request._id}/accept`)).status, 403);
  // Race: r1 (6) and r2 (6) can't both fit in 10.
  const [a1, a2] = await Promise.all([donor.c.patch(`/donation-requests/${r1.body.data.request._id}/accept`), donor.c.patch(`/donation-requests/${r2.body.data.request._id}/accept`)]);
  assert.deepEqual([a1.status, a2.status].sort(), [200, 409]);
  assert.equal((await ctx.models.Donation.findById(donationId)).quantityReserved, 6);
  assert.equal((await donor.c.patch(`/donation-requests/${r3.body.data.request._id}/accept`)).status, 200); // 6 + 3 <= 10
  assert.equal((await ctx.models.Donation.findById(donationId)).quantityReserved, 9);
  const loser = [r1, r2].find((_, i) => [a1, a2][i].status === 409);
  const rej = await donor.c.patch(`/donation-requests/${loser.body.data.request._id}/reject`, { reason: 'Not enough left' }); assert.equal(rej.status, 200);
  assert.equal((await donor.c.patch(`/donation-requests/${loser.body.data.request._id}/accept`)).status, 409); // cannot revive
});

test('many simultaneous accepts never over-allocate', async () => {
  const donor = await signUp(ctx.app, 'donor', 10);
  const dn = await donor.c.post('/donations', donationPayload({ quantity: 5 })); const donationId = dn.body.data.donation._id;
  const ngos = await Promise.all([20, 21, 22, 23, 24, 25].map((n) => verifiedNgo(n)));
  const reqs = await Promise.all(ngos.map((n) => n.c.post('/donation-requests', { donation: donationId, quantity: 2 })));
  const res = await Promise.all(reqs.map((r) => donor.c.patch(`/donation-requests/${r.body.data.request._id}/accept`)));
  assert.equal(res.filter((r) => r.status === 200).length, 2);
  const d = await ctx.models.Donation.findById(donationId); assert.ok(d.quantityReserved <= d.quantity); assert.equal(d.quantityReserved, 4);
});

test('full volunteer flow with QR verification, single-use and permissions', async () => {
  const donor = await signUp(ctx.app, 'donor', 11); const ngo = await verifiedNgo(30);
  const vol = await signUp(ctx.app, 'volunteer', 11, { phone: '+10000000011' }); await ctx.models.User.updateOne({ _id: vol.user._id }, { phone: '+10000000011' });
  const other = await signUp(ctx.app, 'volunteer', 12); await ctx.models.User.updateOne({ _id: other.user._id }, { phone: '+10000000012' });
  const donationId = (await donor.c.post('/donations', donationPayload({ quantity: 4 }))).body.data.donation._id;
  const reqId = (await ngo.c.post('/donation-requests', { donation: donationId, quantity: 4, needsVolunteer: true })).body.data.request._id;
  assert.equal((await donor.c.patch(`/donation-requests/${reqId}/accept`)).status, 200);
  assert.equal((await ctx.models.Donation.findById(donationId)).status, 'reserved');
  const open = await vol.c.get('/pickups/available'); const pid = open.body.data.assignments[0]._id;
  assert.equal(open.body.data.assignments[0].pickup.approximate, true); // no precise address before accepting
  const [w1, w2] = await Promise.all([vol.c.post(`/pickups/${pid}/accept`), other.c.post(`/pickups/${pid}/accept`)]);
  assert.deepEqual([w1.status, w2.status].sort(), [200, 409]); // atomic claim
  const winner = w1.status === 200 ? vol : other; const loserV = winner === vol ? other : vol;
  assert.equal((await loserV.c.post(`/pickups/${pid}/start`)).status, 404); // non-parties cannot even see the pickup
  assert.equal((await winner.c.post(`/pickups/${pid}/verify`, { token: 'x'.repeat(24) })).status, 409); // must start first
  assert.equal((await winner.c.post(`/pickups/${pid}/start`)).status, 200);
  assert.equal((await ngo.c.post(`/pickups/${pid}/handover-token`)).status, 403); // wrong party for the pickup stage
  const tok = await donor.c.post(`/pickups/${pid}/handover-token`); assert.equal(tok.status, 200);
  assert.equal((await winner.c.post(`/pickups/${pid}/verify`, { token: 'wrong-token-wrong-token-1' })).status, 400);
  assert.equal((await loserV.c.post(`/pickups/${pid}/verify`, { token: tok.body.data.token })).status, 404);
  assert.equal((await winner.c.post(`/pickups/${pid}/verify`, { token: tok.body.data.token })).status, 200);
  assert.equal((await winner.c.post(`/pickups/${pid}/verify`, { token: tok.body.data.token })).status, 400); // single use: the token was consumed
  assert.equal((await ctx.models.Donation.findById(donationId)).status, 'picked_up');
  const tok2 = await ngo.c.post(`/pickups/${pid}/handover-token`); assert.equal(tok2.body.data.stage, 'delivery');
  assert.equal((await winner.c.post(`/pickups/${pid}/verify`, { token: tok2.body.data.token })).status, 200);
  assert.equal((await donor.c.patch(`/donation-requests/${reqId}/receipt`)).status, 403);
  assert.equal((await ngo.c.patch(`/donation-requests/${reqId}/receipt`)).status, 200);
  assert.equal((await ctx.models.Donation.findById(donationId)).status, 'completed');
  // Tokens expire.
  const stats = await request(ctx.app).get('/api/v1/analytics/public'); assert.ok(stats.body.data.completed >= 1);
});

test('expired handover tokens are rejected', async () => {
  const donor = await signUp(ctx.app, 'donor', 13); const ngo = await verifiedNgo(31); const vol = await signUp(ctx.app, 'volunteer', 13);
  await ctx.models.User.updateOne({ _id: vol.user._id }, { phone: '+10000000013' });
  const donationId = (await donor.c.post('/donations', donationPayload({ quantity: 2 }))).body.data.donation._id;
  const reqId = (await ngo.c.post('/donation-requests', { donation: donationId, quantity: 2, needsVolunteer: true })).body.data.request._id;
  await donor.c.patch(`/donation-requests/${reqId}/accept`);
  const pid = (await vol.c.get('/pickups/available')).body.data.assignments[0]._id;
  await vol.c.post(`/pickups/${pid}/accept`); await vol.c.post(`/pickups/${pid}/start`);
  const tok = await donor.c.post(`/pickups/${pid}/handover-token`);
  await ctx.models.PickupAssignment.updateOne({ _id: pid }, { 'handover.expiresAt': new Date(Date.now() - 1000) });
  assert.equal((await vol.c.post(`/pickups/${pid}/verify`, { token: tok.body.data.token })).status, 400);
});

test('notifications are private to their owner and can be marked read', async () => {
  const donor = await signUp(ctx.app, 'donor', 14); const ngo = await verifiedNgo(32); const snoop = await signUp(ctx.app, 'donor', 15);
  const donationId = (await donor.c.post('/donations', donationPayload())).body.data.donation._id;
  await ngo.c.post('/donation-requests', { donation: donationId, quantity: 1 });
  const mine = await donor.c.get('/notifications'); assert.ok(mine.body.data.notifications.length >= 1); assert.ok(mine.body.data.unread >= 1);
  const nid = mine.body.data.notifications[0]._id;
  assert.equal((await snoop.c.patch(`/notifications/${nid}/read`)).status, 404);
  assert.equal((await donor.c.patch(`/notifications/${nid}/read`)).status, 200);
  assert.equal((await snoop.c.get('/notifications')).body.data.notifications.length, 0);
});

test('admin permissions: verification, suspension, audit log', async () => {
  const adminUser = await ctx.models.User.create({ name: 'Admin', email: 'admin@test.dev', role: 'admin', emailVerified: true, passwordHash: await (await import('bcryptjs')).default.hash(PASSWORD, 4) });
  const admin = await client(ctx.app); assert.equal((await admin.post('/auth/login', { email: 'admin@test.dev', password: PASSWORD })).status, 200);
  const ngo = await signUp(ctx.app, 'ngo', 40); const org = await ctx.models.Organization.findOne({ owner: ngo.user._id });
  assert.equal((await ngo.c.post(`/admin/organizations/${org._id}/decision`, { decision: 'verified' })).status, 403);
  assert.equal((await admin.post(`/admin/organizations/${org._id}/decision`, { decision: 'verified' })).status, 200);
  assert.equal((await ctx.models.Organization.findById(org._id)).verificationStatus, 'verified');
  assert.equal((await admin.post(`/admin/users/${ngo.user._id}/suspend`, { reason: 'test' })).status, 200);
  assert.equal((await ngo.c.get('/auth/me')).status, 403); // suspended accounts are locked out immediately
  assert.equal((await admin.post(`/admin/users/${adminUser._id}/suspend`)).status, 409);
  const logs = await admin.get('/admin/audit-logs'); assert.ok(logs.body.data.logs.length >= 2);
});

test('validation errors are structured and unknown fields are rejected', async () => {
  const d = await signUp(ctx.app, 'donor', 50);
  const r = await d.c.post('/donations', { title: 'x' }); assert.equal(r.status, 422); assert.ok(Array.isArray(r.body.errors) && r.body.errors.length > 0);
  const extra = await d.c.post('/donations', { ...donationPayload(), status: 'completed' }); assert.equal(extra.status, 422); // clients cannot set status
});

test('recurring donations create unconfirmed drafts without duplicates', async () => {
  const d = await signUp(ctx.app, 'donor', 51);
  const today = new Date().toISOString().slice(0, 10);
  const s = await d.c.post('/recurring-donations', { title: 'Daily bread', category: 'bakery', quantity: 5, unit: 'kg', address: '2 Test Street, Testville', lat: 28.6, lng: 77.2, frequency: 'daily', startDate: today, windowStart: '00:00', windowEnd: '23:59', timezone: 'UTC' });
  assert.equal(s.status, 201);
  const { generateRecurring } = await import('../src/jobs/handlers.js');
  await generateRecurring(); await generateRecurring();
  const drafts = await ctx.models.Donation.find({ recurringSource: s.body.data.schedule._id });
  assert.ok(drafts.length >= 1 && drafts.every((x) => x.status === 'draft'));
  assert.equal(new Set(drafts.map((x) => x.generatedForDate)).size, drafts.length);
});
