import { io, Socket } from 'socket.io-client';

// Hardcoded URL wie in api.ts - VITE_API_URL funktioniert nicht in nativen Apps
const WS_URL = 'https://konfi-quest.de';

let socket: Socket | null = null;

export const initializeWebSocket = (token: string): Socket => {
  // Pruefen ob Socket bereits existiert (auch wenn noch nicht connected)
  if (socket) {
    return socket;
  }

  socket = io(WS_URL, {
    auth: { token },
    transports: ['websocket', 'polling'], // WebSocket zuerst, dann Polling als Fallback
    upgrade: true,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    timeout: 20000,
  });

  socket.on('connect', () => {
    // Verbindung hergestellt
  });

  socket.on('disconnect', (reason) => {
    console.warn('WebSocket getrennt:', reason);
  });

  socket.on('connect_error', (error) => {
    console.error('WebSocket connection error:', error.message);
  });

  socket.on('reconnect_attempt', (attempt) => {
    console.warn('WebSocket reconnect attempt:', attempt);
  });

  return socket;
};

export const getSocket = (): Socket | null => socket;

export const disconnectWebSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

export const joinRoom = (roomId: number) => {
  if (socket?.connected) {
    socket.emit('joinRoom', roomId);
  }
};

export const leaveRoom = (roomId: number) => {
  if (socket?.connected) {
    socket.emit('leaveRoom', roomId);
  }
};
