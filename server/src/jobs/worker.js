import { Worker } from 'bullmq';
import cron from 'node-cron';
import { getConnection, QUEUE_NAME, getQueue, registerSchedules, waitForRedis } from '../queues/index.js';
import { sendEmailNow } from '../services/email.js';
import { cleanupDrafts, expireDonations, expireReservations, generateRecurring, pickupReminders, runAll } from './handlers.js';

const handlers = {
  'send-email': (job) => sendEmailNow(job.data),
  'expire-reservations': () => expireReservations(),
  'expire-donations': async () => { await expireDonations(); await cleanupDrafts(); },
  'pickup-reminders': () => pickupReminders(),
  'recurring-generate': () => generateRecurring(),
};

export async function startBackground() {
  const conn = getConnection();
  if (conn && getQueue() && (await waitForRedis(5000))) {
    try {
      await registerSchedules();
      const w = new Worker(QUEUE_NAME, (job) => { const h = handlers[job.name]; if (!h) throw new Error(`Unknown job ${job.name}`); return h(job); }, { connection: conn, concurrency: 4 });
      w.on('failed', (job, err) => console.error(`[jobs] ${job?.name} failed (attempt ${job?.attemptsMade}): ${err.message}`)); // never log payloads
      w.on('error', (e) => console.error('[jobs] worker error:', e.message));
      console.log('[jobs] BullMQ worker running');
      return 'bullmq';
    } catch (e) { console.error('[jobs] BullMQ unavailable, falling back to node-cron:', e.message); }
  }
  // Fallback: same idempotent handlers on an in-process schedule (single instance only).
  cron.schedule('* * * * *', () => runAll().catch((e) => console.error('[cron]', e.message)));
  console.log('[jobs] running in-process node-cron fallback (set REDIS_URL for durable queues)');
  return 'cron';
}
