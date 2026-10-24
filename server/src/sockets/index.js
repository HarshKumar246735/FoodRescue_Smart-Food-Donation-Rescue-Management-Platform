import { Server } from 'socket.io';
import { parse } from 'cookie';
import { allowedOrigins, env } from '../config/env.js';
import { userFromToken } from '../middleware/auth.js';
import { PickupAssignment } from '../models/index.js';
import { setIO } from './io.js';

export function initSockets(httpServer) {
  const io = new Server(httpServer, { cors: { origin: allowedOrigins, credentials: true }, pingInterval: 25000, pingTimeout: 20000 });
  setIO(io);

  // Authenticate from the HTTP-only cookie sent with the handshake.
  io.use(async (socket, next) => {
    try {
      const cookies = parse(socket.handshake.headers.cookie || '');
      const user = await userFromToken(cookies[env.COOKIE_NAME]);
      if (!user) return next(new Error('unauthorized'));
      socket.data.user = { id: String(user._id), role: user.role };
      next();
    } catch { next(new Error('unauthorized')); }
  });

  io.on('connection', (socket) => {
    const { id, role } = socket.data.user;
    socket.join(`user:${id}`); // private notifications: only this user's room
    socket.join(`role:${role}`);
    let lastLoc = 0;

    // Watch a live assignment (donor, NGO or volunteer on that assignment only).
    socket.on('assignment:join', async (assignmentId, ack) => {
      try {
        const a = await PickupAssignment.findById(assignmentId).lean();
        const allowed = a && [a.donor, a.ngo, a.volunteer].some((u) => u && String(u) === id) && a.sharingLocation;
        if (!allowed) return ack?.({ ok: false });
        socket.join(`assignment:${assignmentId}`); ack?.({ ok: true });
      } catch { ack?.({ ok: false }); }
    });
    socket.on('assignment:leave', (assignmentId) => socket.leave(`assignment:${assignmentId}`));

    // Volunteer location: only while the assignment is live, consent is given and sharing is switched on.
    socket.on('location:update', async ({ assignmentId, lat, lng } = {}) => {
      if (role !== 'volunteer' || Date.now() - lastLoc < 2000) return;
      if (!(Math.abs(lat) <= 90 && Math.abs(lng) <= 180)) return;
      lastLoc = Date.now();
      const a = await PickupAssignment.findOne({ _id: assignmentId, volunteer: id, sharingLocation: true, status: { $in: ['en_route', 'picked_up'] } }).select('_id').lean();
      if (a) socket.to(`assignment:${assignmentId}`).emit('location:update', { assignmentId, lat, lng, at: Date.now() });
    });
  });
  return io;
}
