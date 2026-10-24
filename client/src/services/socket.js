import { io } from 'socket.io-client';
import { SOCKET_URL } from './api.js';

let socket = null;
export function connectSocket() {
  if (socket) return socket;
  socket = io(SOCKET_URL, { withCredentials: true, transports: ['websocket', 'polling'], reconnection: true, reconnectionDelayMax: 10000 });
  return socket;
}
export function disconnectSocket() { socket?.disconnect(); socket = null; }
export const getSocket = () => socket;
