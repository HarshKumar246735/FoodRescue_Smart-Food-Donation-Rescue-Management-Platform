import nodemailer from 'nodemailer';
import { env, smtpEnabled } from '../config/env.js';

let transport;
const getTransport = () => (transport ||= nodemailer.createTransport({ host: env.SMTP_HOST, port: env.SMTP_PORT, secure: env.SMTP_PORT === 465, auth: { user: env.SMTP_USER, pass: env.SMTP_PASS } }));

/** Sends immediately. The queue worker calls this; callers should use queueEmail(). */
export async function sendEmailNow({ to, subject, text, html }) {
  if (!smtpEnabled) { console.warn(`[email] SMTP not configured; skipped "${subject}"`); return { skipped: true }; }
  await getTransport().sendMail({ from: env.EMAIL_FROM, to, subject, text, html });
  return { sent: true };
}
export const layout = (title, body, cta) => `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;color:#0f2a1d"><h2 style="color:#14532d">${title}</h2><p>${body}</p>${cta ? `<p><a href="${cta.url}" style="background:#14532d;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none">${cta.label}</a></p>` : ''}<p style="color:#6b7f74;font-size:12px">FoodRescue - less food waste, more smiles.</p></div>`;
