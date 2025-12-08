import { io, Socket } from 'socket.io-client';

// Hardcoded URL wie in api.ts - VITE_API_URL funktioniert nicht in nativen Apps
const WS_URL = 'https://konfi-quest.de';

let socket: Socket | null = null;

export const initializeWebSocket = (token: string): Socket => {
  // Pruefen ob Socket bereits existiert (auch wenn noch nicht connected)
  if (socket) {
    if (socket.connected) {
      console.log('🔌 WebSocket already connected');
    } else {
      console.log('🔌 WebSocket exists, waiting for connection...');
    }
    return socket;
  }

  console.log('🔌 Creating NEW WebSocket connection to', WS_URL);
  socket = io(WS_URL, {
    auth: { token },
    transports: ['websocket', 'polling'], // WebSocket zuerst, dann Polling als Fallback
    upgrade: true,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    timeout: 20000,
  });

  console.log('🔌 Initializing WebSocket connection to', WS_URL);

  socket.on('connect', () => {
    console.log('🔌 WebSocket connected! Socket ID:', socket?.id);
  });

  socket.on('disconnect', (reason) => {
    console.log('🔌 WebSocket disconnected:', reason);
  });

  socket.on('connect_error', (error) => {
    console.error('🔌 WebSocket connection error:', error.message);
  });

  socket.on('reconnect_attempt', (attempt) => {
    console.log('🔌 WebSocket reconnect attempt:', attempt);
  });

  return socket;
};

export const getSocket = (): Socket | null => socket;

export const disconnectWebSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
    console.log('🔌 WebSocket disconnected manually');
  }
};

export const joinRoom = (roomId: number) => {
  if (socket?.connected) {
    socket.emit('joinRoom', roomId);
    console.log(`📥 Joining room ${roomId}`);
  }
};

export const leaveRoom = (roomId: number) => {
  if (socket?.connected) {
    socket.emit('leaveRoom', roomId);
    console.log(`📤 Leaving room ${roomId}`);
  }
};

export const emitTyping = (roomId: number) => {
  if (socket?.connected) {
    socket.emit('typing', roomId);
  }
};

export const emitStopTyping = (roomId: number) => {
  if (socket?.connected) {
    socket.emit('stopTyping', roomId);
  }
};
