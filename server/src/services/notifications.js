import { Notification, User } from '../models/index.js';
import { emitToUser } from '../sockets/io.js';
import { queueEmail } from '../queues/index.js';
import { env } from '../config/env.js';
import { layout } from './email.js';

const EMAIL_TYPES = new Set(['request_accepted', 'request_rejected', 'org_verification', 'account_status', 'donation_completed']);

/** Persist first (MongoDB is the source of truth), then push over Socket.IO. */
export async function notify(userId, { type, title, message = '', link }) {
  const n = await Notification.create({ user: userId, type, title, message, link });
  emitToUser(userId, 'notification', n.toObject());
  if (EMAIL_TYPES.has(type)) {
    User.findById(userId).select('email').lean().then((u) => u && queueEmail({ to: u.email, subject: title, text: message, html: layout(title, message, link ? { url: `${env.APP_BASE_URL}${link}`, label: 'Open FoodRescue' } : null) })).catch(() => {});
  }
  return n;
}
export const notifyMany = (ids, payload) => Promise.all(ids.map((id) => notify(id, payload).catch(() => null)));
