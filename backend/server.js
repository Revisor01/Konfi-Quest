const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const nodemailer = require('nodemailer');

// ====================================================================
// SERVER CONFIGURATION
// ====================================================================

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'konfi-secret-2025';

// ====================================================================
// DATABASE INITIALIZATION
// ====================================================================

const { initializeDatabase } = require('./database');
const db = initializeDatabase();

// ====================================================================
// SMTP CONFIGURATION
// ====================================================================

const SMTP_CONFIG = {
  host: process.env.SMTP_HOST || 'host.docker.internal',
  port: process.env.SMTP_PORT || 465,
  secure: true, // true for 465, false for other ports
  auth: {
    user: process.env.SMTP_USER || 'team@konfi-quest.de',
    pass: process.env.SMTP_PASS || 'NkqFQuTx$877Si!6Pp'
  }
};

// Create reusable transporter object using SMTP transport
const transporter = nodemailer.createTransport(SMTP_CONFIG);

// Verify SMTP connection configuration
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

// CORS Configuration
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:8624',
    'https://konfi-quest.de',
    'https://konfipoints.godsapp.de',
    'http://127.0.0.1:8624'
  ],
  credentials: true
}));

// Body parsing middleware
app.use(express.json());

// ====================================================================
// FILE UPLOADS SETUP
// ====================================================================

// Uploads directory
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve uploaded files
app.use('/uploads', express.static(uploadsDir));

// Multer configuration for file uploads
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

// ====================================================================
// AUTHENTICATION MIDDLEWARE
// ====================================================================

// Simple JWT verification middleware
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    req.user = decoded;
    next();
  });
};

// ====================================================================
// DATA DIRECTORIES SETUP
// ====================================================================

// Create data directory if it doesn't exist
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// ====================================================================
// ROUTE IMPORTS
// ====================================================================

console.log('🔗 Mounting API routes...');

// Import all route modules
const authRoutes = require('./routes/auth');
const konfiRoutes = require('./routes/konfi');
const eventsRoutes = require('./routes/events');
const chatRoutes = require('./routes/chat');
const statisticsRoutes = require('./routes/statistics');
const settingsRoutes = require('./routes/settings');
const notificationsRoutes = require('./routes/notifications');
const BackgroundService = require('./services/backgroundService');

// Admin-specific routes
const adminBadgesRoutes = require('./routes/badges');
const adminActivitiesRoutes = require('./routes/activities');
const adminKonfisRoutes = require('./routes/konfi-managment');
const adminJahrgaengeRoutes = require('./routes/jahrgaenge');
const adminCategoriesRoutes = require('./routes/categories');
// RBAC-Protected Routes  
const usersRoutes = require('./routes/users');
const rolesRoutes = require('./routes/roles');
const organizationsRoutes = require('./routes/organizations');
const permissionsRoutes = require('./routes/permissions');

// ====================================================================
// RBAC MIDDLEWARE SETUP
// ====================================================================

// Import RBAC middleware
const { verifyTokenRBAC, checkPermission, filterByJahrgangAccess } = require('./middleware/rbac');
const rbacVerifier = verifyTokenRBAC(db);

// Create router instances by passing dependencies
const badgesRouter = adminBadgesRoutes(db, rbacVerifier, checkPermission);
const activitiesRouter = adminActivitiesRoutes(db, rbacVerifier, checkPermission, badgesRouter.checkAndAwardBadges, upload);

// ====================================================================
// ROUTE MOUNTING
// ====================================================================

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Konfi Points API is running' });
});

// Public-facing & Konfi-specific routes (use simple verifyToken for read-only)
app.use('/api/auth', authRoutes(db, verifyToken, transporter, SMTP_CONFIG));
app.use('/api/konfi', konfiRoutes(db, { verifyTokenRBAC: rbacVerifier }));
app.use('/api/chat', chatRoutes(db, { verifyTokenRBAC: rbacVerifier }, uploadsDir));
app.use('/api/statistics', statisticsRoutes(db, { verifyTokenRBAC: rbacVerifier }));
app.use('/api/notifications', notificationsRoutes(db, verifyToken));

// Admin routes requiring RBAC
app.use('/api/events', eventsRoutes(db, rbacVerifier, checkPermission));
app.use('/api/settings', settingsRoutes(db, rbacVerifier, checkPermission));

// Admin-facing & RBAC-protected routes
app.use('/api/admin/activities', activitiesRouter);
app.use('/api/admin/badges', badgesRouter);
app.use('/api/admin/konfis', adminKonfisRoutes(db, rbacVerifier, checkPermission, filterByJahrgangAccess));
app.use('/api/admin/jahrgaenge', adminJahrgaengeRoutes(db, rbacVerifier, checkPermission));
app.use('/api/admin/categories', adminCategoriesRoutes(db, rbacVerifier, checkPermission));
app.use('/api/admin/users', usersRoutes(db, rbacVerifier, checkPermission));

// RBAC system routes
app.use('/api/users', usersRoutes(db, rbacVerifier, checkPermission));
app.use('/api/roles', rolesRoutes(db, rbacVerifier, checkPermission));
app.use('/api/organizations', organizationsRoutes(db, rbacVerifier, checkPermission));
app.use('/api/permissions', permissionsRoutes(db, rbacVerifier, checkPermission));

// ====================================================================
// CHAT SYSTEM INITIALIZATION
// ====================================================================

// Initialize default chat rooms
const { initializeChatRooms } = require('./utils/chatUtils');
setImmediate(initializeChatRooms(db));

// ====================================================================
// ERROR HANDLING
// ====================================================================

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// ====================================================================
// SERVER STARTUP
// ====================================================================

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Konfi Points API running on port ${PORT}`);
  
  // Background Services starten
  BackgroundService.startBadgeUpdateService(db);
  console.log(`📁 Uploads directory: ${uploadsDir}`);
});

// ====================================================================
// GRACEFUL SHUTDOWN
// ====================================================================

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down gracefully...');
  db.close((err) => {
    if (err) {
      console.error('Error closing database:', err.message);
    } else {
      console.log('📝 Database connection closed.');
    }
    process.exit(0);
  });
});