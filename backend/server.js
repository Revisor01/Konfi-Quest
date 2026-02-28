// --- START OF FILE server.js ---

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const nodemailer = require('nodemailer');
const http = require('http');
const { Server } = require('socket.io');
const rateLimit = require('express-rate-limit');
const helmet = require('helmet');

// ====================================================================
// SERVER CONFIGURATION
// ====================================================================

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
 console.error('FATAL: JWT_SECRET environment variable is required!');
  process.exit(1);
}

// ====================================================================
// SOCKET.IO SETUP
// ====================================================================

const ALLOWED_ORIGINS = (process.env.CORS_ORIGINS || 'https://konfi-quest.de,https://www.konfi-quest.de').split(',');

const io = new Server(server, {
  cors: {
    origin: ALLOWED_ORIGINS,
    methods: ['GET', 'POST'],
    credentials: true
  },
  // Debug: Mehr Logging
  pingTimeout: 60000,
  pingInterval: 25000
});

// Debug: Log alle Engine-Level Events
io.engine.on('connection_error', (err) => {
 console.log('Socket.io Engine connection_error:', err.req?.url, err.code, err.message, err.context);
});

io.engine.on('initial_headers', (headers, req) => {
 console.log('Socket.io initial_headers for:', req.url?.substring(0, 50));
});

// Socket.io JWT Authentication Middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
 console.log('Socket.io Auth attempt - Token present:', !!token, token ? `(${token.substring(0, 20)}...)` : '');

  if (!token) {
 console.log('Socket.io Auth failed: No token provided');
    return next(new Error('Authentication required'));
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.user = decoded;
 console.log('Socket.io Auth success for user:', decoded.display_name, '(ID:', decoded.id, ')');
    next();
  } catch (err) {
 console.log('Socket.io Auth failed: Invalid token -', err.message);
    return next(new Error('Invalid token'));
  }
});

// Socket.io Connection Handler
io.on('connection', (socket) => {
 console.log(`User connected: ${socket.user.display_name} (${socket.user.id})`);

  // User tritt automatisch seinem persönlichen Room bei (für globale Benachrichtigungen)
  const userRoom = `user_${socket.user.type}_${socket.user.id}`;
  socket.join(userRoom);
 console.log(`${socket.user.display_name} auto-joined personal room: ${userRoom}`);

  // User tritt seinen Chat-Rooms bei
  socket.on('joinRoom', (roomId) => {
    socket.join(`room_${roomId}`);
 console.log(`${socket.user.display_name} joined room ${roomId}`);
  });

  socket.on('leaveRoom', (roomId) => {
    socket.leave(`room_${roomId}`);
 console.log(`${socket.user.display_name} left room ${roomId}`);
  });

  // Typing Indicator
  socket.on('typing', (roomId) => {
    socket.to(`room_${roomId}`).emit('userTyping', {
      roomId,
      userId: socket.user.id,
      userName: socket.user.display_name
    });
  });

  socket.on('stopTyping', (roomId) => {
    socket.to(`room_${roomId}`).emit('userStoppedTyping', {
      roomId,
      userId: socket.user.id
    });
  });

  socket.on('disconnect', () => {
 console.log(`User disconnected: ${socket.user.display_name}`);
  });
});

// Export io for use in routes
global.io = io;

// ====================================================================
// DATABASE INITIALIZATION
// ====================================================================

const db = require('./database'); 

// ====================================================================
// SMTP CONFIGURATION
// ====================================================================

const SMTP_CONFIG = {
  host: process.env.SMTP_HOST || 'server.godsapp.de',
  port: parseInt(process.env.SMTP_PORT || '465'),
  secure: process.env.SMTP_SECURE === 'true' || true, // true for 465
  auth: {
    user: process.env.SMTP_USER || 'profil@konfi-quest.de',
    pass: process.env.SMTP_PASS
  },
  // TLS-Optionen: Hostname-Validierung lockern für Docker-Umgebung
  // (Zertifikat ist auf server.godsapp.de ausgestellt, aber Docker nutzt IP)
  tls: {
    rejectUnauthorized: false
  }
};

const transporter = nodemailer.createTransport(SMTP_CONFIG);

transporter.verify(function(error, success) {
  if (error) {
 console.error('SMTP connection failed:', error);
  } else {
 console.log('SMTP server ready for messages');
  }
});

// ====================================================================
// RATE LIMITING
// ====================================================================

// Allgemeiner Rate Limiter für alle Requests
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 Minuten
  max: 1000, // Max 1000 Requests pro 15 Minuten
  message: { error: 'Zu viele Anfragen. Bitte versuche es später erneut.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Strenger Rate Limiter für Auth-Endpoints (Brute-Force Schutz)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 Minuten
  max: 10, // Max 10 Login-Versuche pro 15 Minuten
  message: { error: 'Zu viele Login-Versuche. Bitte warte 15 Minuten.' },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true // Erfolgreiche Logins nicht zählen
});

// Rate Limiter für Registrierung (Spam-Schutz)
const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 Stunde
  max: 5, // Max 5 Registrierungen pro Stunde pro IP
  message: { error: 'Zu viele Registrierungen. Bitte warte eine Stunde.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate Limiter fuer Chat-Nachrichten (Spam-Schutz)
const chatMessageLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 Minute
  max: 30, // Max 30 Nachrichten pro Minute
  message: { error: 'Zu viele Nachrichten. Bitte warte einen Moment.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate Limiter fuer Event-Buchungen
const eventBookingLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 Minuten
  max: 20, // Max 20 Buchungen pro 15 Minuten
  message: { error: 'Zu viele Buchungsanfragen. Bitte versuche es spaeter erneut.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate Limiter fuer File-Uploads
const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 Minuten
  max: 30, // Max 30 Uploads pro 15 Minuten
  message: { error: 'Zu viele Uploads. Bitte versuche es spaeter erneut.' },
  standardHeaders: true,
  legacyHeaders: false
});

// ====================================================================
// MIDDLEWARE SETUP
// ====================================================================

console.log('Setting up middleware...');

// CORS wird komplett von Apache gehandelt
// app.use(cors()); // DEAKTIVIERT - Apache macht das

// Security Headers
app.use(helmet({
  contentSecurityPolicy: false,
  strictTransportSecurity: false
}));

// Allgemeiner Rate Limiter
app.use(generalLimiter);

app.use(express.json());

// ====================================================================
// FILE UPLOADS SETUP
// ====================================================================

const uploadsDir = path.join(__dirname, 'uploads');
const requestsDir = path.join(uploadsDir, 'requests');
const chatDir = path.join(uploadsDir, 'chat');

// Create upload directories
[uploadsDir, requestsDir, chatDir].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// SECURITY: Removed static uploads route - all files served through protected endpoints

// Separate multer config for chat (encrypted storage)
const chatUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, chatDir);
    },
    filename: (req, file, cb) => {
      // Generate encrypted filename
      const hash = crypto.createHash('md5').update(Date.now() + file.originalname + Math.random().toString()).digest('hex');
      cb(null, hash);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif',
      'application/pdf',
      'video/mp4', 'video/quicktime', 'video/webm',
      'audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/wav',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain', 'text/csv'
    ];
    
    const isAllowed = allowedMimes.includes(file.mimetype);
    if (isAllowed) {
      cb(null, true);
    } else {
 console.log(`File rejected: ${file.originalname} (${file.mimetype})`);
      cb(null, false);
    }
  }
});

// Legacy upload for other parts (deprecated - migrate to specific uploads)
const upload = multer({ 
  dest: uploadsDir,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  }
});

// Separate multer config for activity requests (encrypted storage)
const crypto = require('crypto');
const requestUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, requestsDir);
    },
    filename: (req, file, cb) => {
      // Generate encrypted filename
      const hash = crypto.createHash('md5').update(Date.now() + file.originalname + Math.random().toString()).digest('hex');
      cb(null, hash);
    }
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  }
});

// ====================================================================
// AUTHENTICATION MIDDLEWARE
// ====================================================================

// GEÄNDERT: Umstellung auf async/await für konsistenten Code-Stil
const verifyToken = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// ====================================================================
// DATA DIRECTORIES SETUP
// ====================================================================

// GEÄNDERT: Das 'data'-Verzeichnis für die SQLite-DB wird nicht mehr benötigt.
// Wir behalten es aber für den Fall, dass andere Daten dort landen.
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// ====================================================================
// ROUTE IMPORTS
// ====================================================================

console.log('Mounting API routes...');

const authRoutes = require('./routes/auth');
const konfiRoutes = require('./routes/konfi');
const eventsRoutes = require('./routes/events');
const chatRoutes = require('./routes/chat');
const settingsRoutes = require('./routes/settings');
const notificationsRoutes = require('./routes/notifications');
const BackgroundService = require('./services/backgroundService');

const adminBadgesRoutes = require('./routes/badges');
const adminActivitiesRoutes = require('./routes/activities');
const adminKonfisRoutes = require('./routes/konfi-managment');
const adminJahrgaengeRoutes = require('./routes/jahrgaenge');
const adminCategoriesRoutes = require('./routes/categories');

const usersRoutes = require('./routes/users');
const rolesRoutes = require('./routes/roles');
const organizationsRoutes = require('./routes/organizations');
const levelsRoutes = require('./routes/levels');

// ====================================================================
// RBAC MIDDLEWARE SETUP
// ====================================================================

const {
  verifyTokenRBAC,
  filterByJahrgangAccess,
  requireSuperAdmin,
  requireOrgAdmin,
  requireAdmin,
  requireTeamer
} = require('./middleware/rbac');

const rbacVerifier = verifyTokenRBAC(db);

// Rollen-Helper Objekt für Routes
const roleHelpers = { requireSuperAdmin, requireOrgAdmin, requireAdmin, requireTeamer };

const badgesRouter = adminBadgesRoutes(db, rbacVerifier, roleHelpers);
const activitiesRouter = adminActivitiesRoutes(db, rbacVerifier, roleHelpers, badgesRouter.checkAndAwardBadges, upload);

// ====================================================================
// ROUTE MOUNTING
// ====================================================================

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Konfi Points API is running' });
});

app.use('/api/auth', authRoutes(db, verifyToken, transporter, SMTP_CONFIG, { authLimiter, registerLimiter }));
app.use('/api/konfi', konfiRoutes(db, { verifyTokenRBAC: rbacVerifier }, upload, requestUpload));

// Chat: Nachrichten-Endpunkt mit eigenem Rate-Limiter, Upload-Endpunkt ebenfalls
app.post('/api/chat/rooms/:roomId/messages', chatMessageLimiter, uploadLimiter);
app.use('/api/chat', chatRoutes(db, { verifyTokenRBAC: rbacVerifier }, uploadsDir, chatUpload));

app.use('/api/notifications', notificationsRoutes(db, verifyToken));

// Events: Buchungs-Endpunkt mit eigenem Rate-Limiter
app.post('/api/events/:id/book', eventBookingLimiter);
app.use('/api/events', eventsRoutes(db, rbacVerifier, roleHelpers, badgesRouter.checkAndAwardBadges));

// Konfi: Foto-Upload mit Rate-Limiter
app.post('/api/konfi/upload-photo', uploadLimiter);
app.use('/api/settings', settingsRoutes(db, rbacVerifier, roleHelpers));

app.use('/api/admin/activities', activitiesRouter);
app.use('/api/admin/badges', badgesRouter);
app.use('/api/admin/konfis', adminKonfisRoutes(db, rbacVerifier, roleHelpers, filterByJahrgangAccess, badgesRouter.checkAndAwardBadges));
app.use('/api/admin/jahrgaenge', adminJahrgaengeRoutes(db, rbacVerifier, roleHelpers));
app.use('/api/admin/categories', adminCategoriesRoutes(db, rbacVerifier, roleHelpers));
app.use('/api/admin/users', usersRoutes(db, rbacVerifier, roleHelpers));

app.use('/api/users', usersRoutes(db, rbacVerifier, roleHelpers));
app.use('/api/roles', rolesRoutes(db, rbacVerifier, roleHelpers));
app.use('/api/organizations', organizationsRoutes(db, rbacVerifier, roleHelpers));

app.use('/api/levels', levelsRoutes(db, rbacVerifier, roleHelpers));

// ====================================================================
// CHAT SYSTEM INITIALIZATION
// ====================================================================

const { initializeChatRooms } = require('./utils/chatUtils');
// Wir gehen davon aus, dass chatUtils.js bereits auf async/await umgestellt wurde
setImmediate(initializeChatRooms(db));

// ====================================================================
// BACKGROUND SERVICES INITIALIZATION
// ====================================================================

BackgroundService.startAllServices(db);

// ====================================================================
// ERROR HANDLING
// ====================================================================

app.use((err, req, res, next) => {
 console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// ====================================================================
// SERVER STARTUP
// ====================================================================

server.listen(PORT, () => {
 console.log(`Konfi Points API running on port ${PORT}`);
 console.log(`WebSocket server ready`);
 console.log(`Uploads directory: ${uploadsDir}`);
});

// ====================================================================
// GRACEFUL SHUTDOWN
// ====================================================================

// GEÄNDERT: Der Shutdown-Prozess verwendet jetzt db.end() und async/await.
process.on('SIGINT', async () => {
 console.log('\n Shutting down gracefully...');
  try {
    await db.end();
 console.log('Database connection pool closed.');
  } catch (err) {
 console.error('Error closing the database pool:', err.message);
  } finally {
    process.exit(0);
  }
});