import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';

export async function boot() {
  const mongod = await MongoMemoryServer.create();
  Object.assign(process.env, { NODE_ENV: 'test', MONGODB_URI: mongod.getUri(), JWT_SECRET: 'x'.repeat(40), REDIS_URL: '', CLIENT_URL: 'http://localhost:5173', CLIENT_ORIGINS: 'http://localhost:5173' });
  const { connectDB } = await import('../src/config/db.js');
  const { createApp } = await import('../src/app.js');
  const { ensureDefaults } = await import('../src/bootstrap.js');
  const models = await import('../src/models/index.js');
  await connectDB(process.env.MONGODB_URI); await ensureDefaults();
  await Promise.all(Object.values(models).map((m) => m.init?.()));
  const app = createApp();
  const mongoose = (await import('mongoose')).default;
  return { app, models, mongoose, stop: async () => { await mongoose.disconnect(); await mongod.stop(); } };
}

/** supertest agent that keeps cookies and sends the CSRF header on writes. */
export async function client(app) {
  const agent = request.agent(app);
  const { body } = await agent.get('/api/v1/auth/csrf');
  const token = body.data.csrfToken;
  const wrap = (m) => (url, data) => { const r = agent[m](`/api/v1${url}`).set('X-CSRF-Token', token); return data === undefined ? r : r.send(data); };
  return { get: (u) => agent.get(`/api/v1${u}`), post: wrap('post'), patch: wrap('patch'), put: wrap('put'), del: wrap('delete'), raw: agent };
}
export const PASSWORD = 'Str0ngPassw0rd!';
export async function signUp(app, role, n, extra = {}) {
  const c = await client(app);
  const r = await c.post('/auth/register', { name: `${role} ${n}`, email: `${role}${n}@test.dev`, password: PASSWORD, role, ...(role === 'ngo' ? { organizationName: `Org ${n}` } : {}), ...extra });
  if (r.status !== 201) throw new Error(`signup failed ${r.status} ${JSON.stringify(r.body)}`);
  return { c, user: r.body.data.user };
}
export const donationPayload = (over = {}) => ({
  title: 'Fresh vegetables', category: 'fresh_produce', quantity: 10, unit: 'kg', servings: 30, address: '1 Test Street, Testville', city: 'Testville', lat: 28.61, lng: 77.2,
  availableFrom: new Date(Date.now() - 600000).toISOString(), pickupDeadline: new Date(Date.now() + 6 * 3600000).toISOString(), safetyDeclaration: true, ...over,
});
