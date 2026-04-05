// --- START OF FILE createApp.js ---
// Express-App Factory ohne Seiteneffekte (kein listen, Socket.IO, SMTP, Cron, Firebase)
// Tests rufen createApp(testDb) auf und bekommen saubere Express-App fuer supertest.

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

/**
 * Erstellt eine Express-App mit allen Routes und Middleware.
 * @param {object} db - Datenbank-Objekt mit query() und getClient()
 * @param {object} options - Optionale Konfiguration
 * @param {object} options.transporter - SMTP-Transporter (Default: Dummy)
 * @param {object} options.smtpConfig - SMTP-Konfiguration (Default: {})
 * @param {object} options.io - Socket.IO-Instanz (Default: Dummy)
 * @param {object} options.rateLimiters - Rate-Limiter-Objekte (Default: {})
 * @param {string} options.uploadsDir - Upload-Verzeichnis (Default: ./uploads)
 * @returns {express.Application} Express-App
 */
function createApp(db, options = {}) {
  const {
    transporter = null,
    smtpConfig = {},
    io = null,
    rateLimiters = {},
    uploadsDir = path.join(__dirname, 'uploads'),
  } = options;

  const app = express();
  app.set('trust proxy', 1); // Traefik Reverse Proxy

  // ====================================================================
  // SECURITY HEADERS
  // ====================================================================

  // CSP bleibt deaktiviert, da Ionic/React inline Styles und Scripts benoetigt.
  // HSTS wird von Apache/KeyHelp gesetzt, daher hier nicht doppelt konfigurieren.
  app.use(helmet({
    contentSecurityPolicy: false,
    strictTransportSecurity: false,
    crossOriginEmbedderPolicy: false,
    xContentTypeOptions: true,
    xFrameOptions: { action: 'deny' },
    xXssProtection: true,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
  }));

  // ====================================================================
  // CORS (Capacitor iOS/Android + Web)
  // ====================================================================

  const CORS_ORIGINS = (process.env.CORS_ORIGINS || 'https://konfi-quest.de,https://www.konfi-quest.de,capacitor://localhost,http://localhost').split(',');
  app.use(cors({
    origin: CORS_ORIGINS,
    credentials: true
  }));

  // ====================================================================
  // RATE LIMITING (nur wenn uebergeben)
  // ====================================================================

  if (rateLimiters.general) {
    app.use(rateLimiters.general);
  }

  app.use(express.json());

  // ====================================================================
  // FILE UPLOADS SETUP
  // ====================================================================

  const requestsDir = path.join(uploadsDir, 'requests');
  const chatDir = path.join(uploadsDir, 'chat');
  const materialDir = path.join(uploadsDir, 'material');

  // Upload-Verzeichnisse erstellen
  [uploadsDir, requestsDir, chatDir, materialDir].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });

  // Chat Upload Config (verschluesselte Dateinamen)
  const chatUpload = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, chatDir);
      },
      filename: (req, file, cb) => {
        const hash = crypto.createHash('sha256').update(Date.now() + file.originalname + Math.random().toString()).digest('hex');
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
        console.warn(`Datei abgelehnt: ${file.originalname} (${file.mimetype})`);
        cb(null, false);
      }
    }
  });

  // Material Upload Config (20MB Limit)
  const materialUpload = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, materialDir);
      },
      filename: (req, file, cb) => {
        const hash = crypto.createHash('sha256').update(Date.now() + file.originalname + Math.random().toString()).digest('hex');
        cb(null, hash);
      }
    }),
    limits: { fileSize: 20 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      const allowedMimes = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif',
        'application/pdf',
        'video/mp4', 'video/quicktime', 'video/webm',
        'audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/wav',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'application/vnd.oasis.opendocument.text',
        'application/vnd.oasis.opendocument.spreadsheet',
        'application/vnd.oasis.opendocument.presentation',
        'text/plain', 'text/csv'
      ];

      const isAllowed = allowedMimes.includes(file.mimetype);
      if (isAllowed) {
        cb(null, true);
      } else {
        console.warn(`Material-Datei abgelehnt: ${file.originalname} (${file.mimetype})`);
        cb(null, false);
      }
    }
  });

  // Request Upload Config (nur Bilder, 5MB)
  const requestUpload = multer({
    storage: multer.diskStorage({
      destination: (req, file, cb) => {
        cb(null, requestsDir);
      },
      filename: (req, file, cb) => {
        const hash = crypto.createHash('sha256').update(Date.now() + file.originalname + Math.random().toString()).digest('hex');
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

  const JWT_SECRET = process.env.JWT_SECRET;

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
  const roleHelpers = { requireSuperAdmin, requireOrgAdmin, requireAdmin, requireTeamer };

  // ====================================================================
  // DUMMY-OBJEKTE FUER TESTS
  // ====================================================================

  const ioOrDummy = io || {
    to: () => ({ emit: () => {} }),
    emit: () => {},
    in: () => ({ emit: () => {} }),
  };

  const transporterOrDummy = transporter || { sendMail: async () => ({}) };

  // ====================================================================
  // ROUTE IMPORTS + SETUP
  // ====================================================================

  const badgesRouter = require('./routes/badges')(db, rbacVerifier, roleHelpers);
  const activitiesRouter = require('./routes/activities')(db, rbacVerifier, roleHelpers, badgesRouter.checkAndAwardBadges);

  // ====================================================================
  // ROUTE MOUNTING
  // ====================================================================

  // Health-Endpoint
  app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'Konfi Points API is running' });
  });

  // Auth Routes
  app.use('/api/auth', require('./routes/auth')(db, verifyToken, transporterOrDummy, smtpConfig, {
    authLimiter: rateLimiters.authLimiter,
    registerLimiter: rateLimiters.registerLimiter,
  }, rbacVerifier));

  // Konfi Routes
  app.use('/api/konfi', require('./routes/konfi')(db, { verifyTokenRBAC: rbacVerifier }, requestUpload));

  // Chat Routes (mit optionalem Rate-Limiter)
  if (rateLimiters.chatMessageLimiter) {
    app.post('/api/chat/rooms/:roomId/messages', rateLimiters.chatMessageLimiter, rateLimiters.uploadLimiter);
  }
  app.use('/api/chat', require('./routes/chat')(db, { verifyTokenRBAC: rbacVerifier }, uploadsDir, chatUpload, ioOrDummy));

  // Notifications
  app.use('/api/notifications', require('./routes/notifications')(db, rbacVerifier));

  // Events (mit optionalem Rate-Limiter)
  if (rateLimiters.eventBookingLimiter) {
    app.post('/api/events/:id/book', rateLimiters.eventBookingLimiter);
  }
  app.use('/api/events', require('./routes/events')(db, rbacVerifier, roleHelpers, badgesRouter.checkAndAwardBadges));

  // Konfi Foto-Upload (mit optionalem Rate-Limiter)
  if (rateLimiters.uploadLimiter) {
    app.post('/api/konfi/upload-photo', rateLimiters.uploadLimiter);
  }

  // Settings
  app.use('/api/settings', require('./routes/settings')(db, rbacVerifier, roleHelpers));

  // Admin Routes
  app.use('/api/admin/activities', activitiesRouter);
  app.use('/api/admin/badges', badgesRouter);
  app.use('/api/admin/konfis', require('./routes/konfi-management')(db, rbacVerifier, roleHelpers, filterByJahrgangAccess, badgesRouter.checkAndAwardBadges));
  app.use('/api/admin/jahrgaenge', require('./routes/jahrgaenge')(db, rbacVerifier, roleHelpers));
  app.use('/api/admin/categories', require('./routes/categories')(db, rbacVerifier, roleHelpers));
  app.use('/api/admin/users', require('./routes/users')(db, rbacVerifier, roleHelpers, ioOrDummy));

  // Allgemeine Routes
  app.use('/api/users', require('./routes/users')(db, rbacVerifier, roleHelpers, ioOrDummy));
  app.use('/api/roles', require('./routes/roles')(db, rbacVerifier, roleHelpers));

  // Organizations (mit optionalem Rate-Limiter)
  if (rateLimiters.orgLimiter) {
    app.use('/api/organizations', rateLimiters.orgLimiter, require('./routes/organizations')(db, rbacVerifier, roleHelpers));
  } else {
    app.use('/api/organizations', require('./routes/organizations')(db, rbacVerifier, roleHelpers));
  }

  app.use('/api/levels', require('./routes/levels')(db, rbacVerifier, roleHelpers));
  app.use('/api/teamer', require('./routes/teamer')(db, rbacVerifier, roleHelpers));

  const wrappedRouter = require('./routes/wrapped')(db, rbacVerifier, roleHelpers);
  app.use('/api/wrapped', wrappedRouter);
  app.use('/api/material', require('./routes/material')(db, rbacVerifier, roleHelpers, materialUpload));

  // ====================================================================
  // ERROR HANDLING
  // ====================================================================

  app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
  });

  // wrappedRouter fuer BackgroundService in server.js verfuegbar machen
  app.wrappedRouter = wrappedRouter;

  return app;
}

module.exports = { createApp };
