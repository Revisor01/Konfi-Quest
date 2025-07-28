// --- START OF FILE server.js ---

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

const db = require('./database'); 

// ====================================================================
// SMTP CONFIGURATION
// ====================================================================

const SMTP_CONFIG = {
  host: process.env.SMTP_HOST || 'server.godsapp.de',
  port: process.env.SMTP_PORT || 465,
  secure: true, // true for 465, false for other ports
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
    'http://localhost:8624',
    'https://konfi-quest.de',
    'https://konfipoints.godsapp.de',
    'http://127.0.0.1:8624'
  ],
  credentials: true
}));

app.use(express.json());

// ====================================================================
// FILE UPLOADS SETUP
// ====================================================================

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use('/uploads', express.static(uploadsDir));

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

// ====================================================================
// RBAC MIDDLEWARE SETUP
// ====================================================================

const { verifyTokenRBAC, checkPermission, filterByJahrgangAccess } = require('./middleware/rbac');
const rbacVerifier = verifyTokenRBAC(db);

const badgesRouter = adminBadgesRoutes(db, rbacVerifier, checkPermission);
const activitiesRouter = adminActivitiesRoutes(db, rbacVerifier, checkPermission, badgesRouter.checkAndAwardBadges, upload);

// ====================================================================
// ROUTE MOUNTING
// ====================================================================

app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Konfi Points API is running' });
});

app.use('/api/auth', authRoutes(db, verifyToken, transporter, SMTP_CONFIG));
app.use('/api/konfi', konfiRoutes(db, { verifyTokenRBAC: rbacVerifier }));
app.use('/api/chat', chatRoutes(db, { verifyTokenRBAC: rbacVerifier }, uploadsDir));
app.use('/api/statistics', statisticsRoutes(db, { verifyTokenRBAC: rbacVerifier }));
app.use('/api/notifications', notificationsRoutes(db, verifyToken));

app.use('/api/events', eventsRoutes(db, rbacVerifier, checkPermission));
app.use('/api/settings', settingsRoutes(db, rbacVerifier, checkPermission));

app.use('/api/admin/activities', activitiesRouter);
app.use('/api/admin/badges', badgesRouter);
app.use('/api/admin/konfis', adminKonfisRoutes(db, rbacVerifier, checkPermission, filterByJahrgangAccess));
app.use('/api/admin/jahrgaenge', adminJahrgaengeRoutes(db, rbacVerifier, checkPermission));
app.use('/api/admin/categories', adminCategoriesRoutes(db, rbacVerifier, checkPermission));
app.use('/api/admin/users', usersRoutes(db, rbacVerifier, checkPermission));

app.use('/api/users', usersRoutes(db, rbacVerifier, checkPermission));
app.use('/api/roles', rolesRoutes(db, rbacVerifier, checkPermission));
app.use('/api/organizations', organizationsRoutes(db, rbacVerifier, checkPermission));
app.use('/api/permissions', permissionsRoutes(db, rbacVerifier, checkPermission));

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

app.listen(PORT, () => {
  console.log(`🚀 Konfi Points API running on port ${PORT}`);
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