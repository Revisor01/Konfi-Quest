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

// ====================================================================
// SERVER CONFIGURATION
// ====================================================================

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'konfi-secret-2025';

// ====================================================================
// SOCKET.IO SETUP
// ====================================================================

const io = new Server(server, {
  cors: {
    origin: [
      'http://localhost:3000',
      'http://localhost:5173',
      'http://localhost:8624',
      'https://konfi-quest.de',
      'https://konfi-points.de',
      'https://konfipoints.godsapp.de',
      'http://127.0.0.1:8624',
      'capacitor://localhost',
      'ionic://localhost'
    ],
    credentials: true
  }
});

// Socket.io JWT Authentication Middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication required'));
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    socket.user = decoded;
    next();
  } catch (err) {
    return next(new Error('Invalid token'));
  }
});

// Socket.io Connection Handler
io.on('connection', (socket) => {
  console.log(`🔌 User connected: ${socket.user.display_name} (${socket.user.id})`);

  // User tritt seinen Chat-Rooms bei
  socket.on('joinRoom', (roomId) => {
    socket.join(`room_${roomId}`);
    console.log(`📥 ${socket.user.display_name} joined room ${roomId}`);
  });

  socket.on('leaveRoom', (roomId) => {
    socket.leave(`room_${roomId}`);
    console.log(`📤 ${socket.user.display_name} left room ${roomId}`);
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
    console.log(`🔌 User disconnected: ${socket.user.display_name}`);
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
  port: process.env.SMTP_PORT || 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER || 'team@konfi-quest.de',
    pass: process.env.SMTP_PASS || 'NkqFQuTx$877Si!6Pp'
  }
};

const transporter = nodemailer.createTransport(SMTP_CONFIG);

transporter.verify(function(error, success) {
  if (error) {
    console.error('❌ SMTP connection failed:', error);
  } else {
    console.log('✅ SMTP server ready for messages');
  }
});

// ====================================================================
// MIDDLEWARE SETUP
// ====================================================================

console.log('🔧 Setting up middleware...');

app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:5173',  // Vite dev server
    'http://localhost:8624',
    'https://konfi-quest.de',
    'https://konfi-points.de',
    'https://konfipoints.godsapp.de',
    'http://127.0.0.1:8624',
    'capacitor://localhost',  // Native iOS/Android Apps
    'ionic://localhost'       // Ionic Apps
  ],
  credentials: true
}));

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
      'image/', // Alle Bilder
      'application/pdf', // PDFs
      'video/', // Videos
      'audio/', // Audio
      'application/msword', // DOC
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // DOCX
      'application/vnd.ms-powerpoint', // PPT
      'application/vnd.openxmlformats-officedocument.presentationml.presentation', // PPTX
      'text/' // Text-Dateien
    ];
    
    const isAllowed = allowedMimes.some(mime => file.mimetype.startsWith(mime));
    if (isAllowed) {
      cb(null, true);
    } else {
      console.log(`❌ File rejected: ${file.originalname} (${file.mimetype})`);
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

console.log('🔗 Mounting API routes...');

const authRoutes = require('./routes/auth');
const konfiRoutes = require('./routes/konfi');
const eventsRoutes = require('./routes/events');
const chatRoutes = require('./routes/chat');
const statisticsRoutes = require('./routes/statistics');
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
const permissionsRoutes = require('./routes/permissions');
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

app.use('/api/auth', authRoutes(db, verifyToken, transporter, SMTP_CONFIG));
app.use('/api/konfi', konfiRoutes(db, { verifyTokenRBAC: rbacVerifier }, upload, requestUpload));
app.use('/api/chat', chatRoutes(db, { verifyTokenRBAC: rbacVerifier }, uploadsDir, chatUpload));
app.use('/api/statistics', statisticsRoutes(db, { verifyTokenRBAC: rbacVerifier }));
app.use('/api/notifications', notificationsRoutes(db, verifyToken));

app.use('/api/events', eventsRoutes(db, rbacVerifier, roleHelpers, badgesRouter.checkAndAwardBadges));
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
app.use('/api/permissions', permissionsRoutes(db, rbacVerifier, roleHelpers));
app.use('/api/levels', levelsRoutes(db, rbacVerifier, roleHelpers));

// ====================================================================
// CHAT SYSTEM INITIALIZATION
// ====================================================================

const { initializeChatRooms } = require('./utils/chatUtils');
// Wir gehen davon aus, dass chatUtils.js bereits auf async/await umgestellt wurde
setImmediate(initializeChatRooms(db));

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
  console.log(`🚀 Konfi Points API running on port ${PORT}`);
  console.log(`🔌 WebSocket server ready`);
  console.log(`📁 Uploads directory: ${uploadsDir}`);
});

// ====================================================================
// GRACEFUL SHUTDOWN
// ====================================================================

// GEÄNDERT: Der Shutdown-Prozess verwendet jetzt db.end() und async/await.
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down gracefully...');
  try {
    await db.end();
    console.log('🐘 Database connection pool closed.');
  } catch (err) {
    console.error('Error closing the database pool:', err.message);
  } finally {
    process.exit(0);
  }
});