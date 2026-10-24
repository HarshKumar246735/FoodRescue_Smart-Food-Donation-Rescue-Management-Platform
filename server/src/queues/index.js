import IORedis from 'ioredis';
import { Queue } from 'bullmq';
import { env } from '../config/env.js';
import { sendEmailNow } from '../services/email.js';

export const QUEUE_NAME = 'foodrescue';
let connection = null; let queue = null; let redisOk = false;

export function initQueue() {
  if (!env.REDIS_URL) return null;
  connection = new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
  connection.on('ready', () => { redisOk = true; });
  connection.on('end', () => { redisOk = false; });
  connection.on('error', (e) => { redisOk = false; console.error('[redis]', e.code || e.message); });
  queue = new Queue(QUEUE_NAME, { connection, defaultJobOptions: { attempts: 5, backoff: { type: 'exponential', delay: 5000 }, removeOnComplete: 500, removeOnFail: 1000 } });
  queue.on('error', () => {});
  return queue;
}
export const getConnection = () => connection;
/** Resolves true once Redis is ready, false if it is not reachable within `ms` (caller then falls back to cron). */
export const waitForRedis = (ms = 5000) => new Promise((resolve) => {
  if (!connection) return resolve(false);
  if (redisOk) return resolve(true);
  const t = setTimeout(() => resolve(false), ms);
  connection.once('ready', () => { clearTimeout(t); resolve(true); });
});
export const getQueue = () => queue;
export const queueStatus = () => (!env.REDIS_URL ? 'not_configured' : redisOk ? 'connected' : 'unavailable');

/** Email delivery: queued with retries when Redis is up, otherwise sent inline (best effort). */
export async function queueEmail(payload) {
  if (queue && redisOk) {
    try { await queue.add('send-email', payload); return; } catch (e) { console.error('[queue] enqueue failed, sending inline:', e.message); }
  }
  try { await sendEmailNow(payload); } catch (e) { console.error('[email] inline send failed:', e.message); }
}

/** Register repeatable jobs once. upsertJobScheduler is idempotent, so restarts never duplicate schedules. */
export async function registerSchedules() {
  if (!queue) return;
  const every = (ms) => ({ every: ms });
  await queue.upsertJobScheduler('expire-reservations', every(60_000), { name: 'expire-reservations' });
  await queue.upsertJobScheduler('expire-donations', every(5 * 60_000), { name: 'expire-donations' });
  await queue.upsertJobScheduler('pickup-reminders', every(10 * 60_000), { name: 'pickup-reminders' });
  await queue.upsertJobScheduler('recurring-generate', every(60 * 60_000), { name: 'recurring-generate' });
}
