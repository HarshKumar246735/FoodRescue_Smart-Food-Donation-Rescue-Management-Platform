import { AuditLog } from '../models/index.js';
export async function audit(req, action, targetType, targetId, meta = {}) {
  try { await AuditLog.create({ actor: req.user?._id, action, targetType, targetId: targetId ? String(targetId) : undefined, meta, ip: req.ip }); }
  catch (e) { console.error('[audit] failed to record', action, e.message); }
}
