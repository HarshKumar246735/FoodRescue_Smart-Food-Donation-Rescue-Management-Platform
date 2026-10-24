let io = null;
export const setIO = (instance) => { io = instance; };
export const getIO = () => io;
export const emitToUser = (userId, event, payload) => { if (io) io.to(`user:${userId}`).emit(event, payload); };
export const emitToRole = (role, event, payload) => { if (io) io.to(`role:${role}`).emit(event, payload); };
