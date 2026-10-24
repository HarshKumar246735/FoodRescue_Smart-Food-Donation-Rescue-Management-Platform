import http from 'node:http';
import { env } from './config/env.js';
import { connectDB } from './config/db.js';
import { createApp } from './app.js';
import { initSockets } from './sockets/index.js';
import { initQueue } from './queues/index.js';
import { startBackground } from './jobs/worker.js';
import { ensureDefaults } from './bootstrap.js';

async function main() {
  await connectDB();
  await ensureDefaults();
  initQueue();
  const server = http.createServer(createApp());
  initSockets(server);
  server.listen(env.PORT, () => console.log(`[server] FoodRescue API listening on :${env.PORT} (${env.NODE_ENV})`));
  await startBackground();
  const stop = (sig) => { console.log(`[server] ${sig} received, shutting down`); server.close(() => process.exit(0)); setTimeout(() => process.exit(1), 10000).unref(); };
  ['SIGINT', 'SIGTERM'].forEach((s) => process.on(s, () => stop(s)));
}
main().catch((e) => { console.error('[server] failed to start:', e.message); process.exit(1); });
