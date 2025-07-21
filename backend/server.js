const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const nodemailer = require('nodemailer');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'konfi-secret-2025';

const { initializeDatabase } = require('./database');
const db = initializeDatabase();

// SMTP Configuration
const SMTP_CONFIG = {
  host: process.env.SMTP_HOST || 'server.godsapp.de',
  port: process.env.SMTP_PORT || 587,
  secure: false, // true for 465, false for other ports
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

console.log('🔧 Setting up middleware...');

// Middleware
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:8624',
    'https://konfipoints.godsapp.de',
    'http://127.0.0.1:8624'
  ],
  credentials: true
}));
app.use(express.json());

// Uploads directory
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Serve uploaded files
app.use('/uploads', express.static(uploadsDir));

// Simple multer setup
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

// Middleware to verify JWT - MOVED HERE BEFORE USAGE
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

// Function to format date for German locale
function formatDate(dateString) {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  const months = [
    'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
  ];
  
  const day = date.getDate().toString().padStart(2, '0');
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  
  return `${day}. ${month} ${year}`;
}

// Create data directory if it doesn't exist
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}


// === STATISTICS ===

// Get konfi statistics
app.get('/api/statistics', verifyToken, (req, res) => {
  const queries = {
    totalPoints: "SELECT SUM(gottesdienst_points + gemeinde_points) as total FROM konfis",
    mostActiveKonfi: "SELECT name, (gottesdienst_points + gemeinde_points) as total_points FROM konfis ORDER BY total_points DESC LIMIT 1",
    mostPopularActivity: `
      SELECT a.name, COUNT(*) as count 
      FROM konfi_activities ka 
      JOIN activities a ON ka.activity_id = a.id 
      GROUP BY a.name 
      ORDER BY count DESC 
      LIMIT 1
    `,
    totalActivities: "SELECT COUNT(*) as count FROM konfi_activities",
    totalKonfis: "SELECT COUNT(*) as count FROM konfis"
  };

  const results = {};
  let completed = 0;
  const totalQueries = Object.keys(queries).length;

  Object.entries(queries).forEach(([key, query]) => {
    db.get(query, [], (err, row) => {
      if (!err && row) {
        results[key] = row;
      }
      completed++;
      
      if (completed === totalQueries) {
        res.json(results);
      }
    });
  });
});

// Get konfi ranking (anonymized for konfis)
app.get('/api/ranking', verifyToken, (req, res) => {
  const query = `
    SELECT id, name, (gottesdienst_points + gemeinde_points) as total_points
    FROM konfis 
    ORDER BY total_points DESC
  `;
  
  db.all(query, [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    
    if (req.user.type === 'admin') {
      // Admins get full ranking
      res.json(rows.map((row, index) => ({
        position: index + 1,
        name: row.name,
        points: row.total_points
      })));
    } else {
      // Konfis get anonymized ranking with their position
      const myPosition = rows.findIndex(row => row.id === req.user.id) + 1;
      const myPoints = rows.find(row => row.id === req.user.id)?.total_points || 0;
      
      res.json({
        myPosition,
        myPoints,
        totalKonfis: rows.length,
        topScores: rows.slice(0, 3).map(row => row.total_points),
        topNames: rows.slice(0, 3).map(row => row.name) // NEU: Namen für Initialen
      });
    }
  });
});




// Get settings
app.get('/api/settings', verifyToken, (req, res) => {
  db.all("SELECT * FROM settings", [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    const settings = {};
    rows.forEach(row => {
      settings[row.key] = row.value;
    });
    
    res.json(settings);
  });
});

// Update settings (admin only)
app.put('/api/settings', verifyToken, (req, res) => {
  if (req.user.type !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { target_gottesdienst, target_gemeinde } = req.body;
  
  if (target_gottesdienst) {
    db.run("UPDATE settings SET value = ? WHERE key = 'target_gottesdienst'", [target_gottesdienst]);
  }
  
  if (target_gemeinde) {
    db.run("UPDATE settings SET value = ? WHERE key = 'target_gemeinde'", [target_gemeinde]);
  }
  
  res.json({ message: 'Settings updated successfully' });
});

// Generate new password for konfi (admin only)
app.post('/api/konfis/:id/regenerate-password', verifyToken, (req, res) => {
  if (req.user.type !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const konfiId = req.params.id;
  const newPassword = generateBiblicalPassword();
  const hashedPassword = bcrypt.hashSync(newPassword, 10);

  db.run("UPDATE konfis SET password_hash = ?, password_plain = ? WHERE id = ?",
         [hashedPassword, newPassword, konfiId],
         function(err) {
           if (err) {
             return res.status(500).json({ error: 'Database error' });
           }
           
           if (this.changes === 0) {
             return res.status(404).json({ error: 'Konfi not found' });
           }
           
           res.json({ 
             message: 'Password regenerated successfully',
             password: newPassword
           });
         });
});

// === EVENTS SYSTEM ===

// Events table creation
db.run(`CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  event_date TEXT NOT NULL,
  location TEXT,
  location_maps_url TEXT,
  points INTEGER DEFAULT 0,
  category TEXT DEFAULT '',
  type TEXT DEFAULT 'event',
  max_participants INTEGER NOT NULL,
  registration_opens_at TEXT,
  registration_closes_at TEXT,
  has_timeslots INTEGER DEFAULT 0,
  is_series INTEGER DEFAULT 0,
  series_id TEXT,
  created_by INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES admins(id)
)`);

db.run(`CREATE TABLE IF NOT EXISTS event_timeslots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  max_participants INTEGER NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
)`);

db.run(`CREATE TABLE IF NOT EXISTS event_bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL,
  konfi_id INTEGER NOT NULL,
  timeslot_id INTEGER,
  status TEXT DEFAULT 'confirmed',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
  FOREIGN KEY (konfi_id) REFERENCES konfis(id) ON DELETE CASCADE,
  FOREIGN KEY (timeslot_id) REFERENCES event_timeslots(id) ON DELETE SET NULL
)`);

// Migration: Add event_id to chat_rooms if not exists
db.all("PRAGMA table_info(chat_rooms)", (err, columns) => {
  if (err) {
    console.error('Error checking chat_rooms table:', err);
    return;
  }
  
  const hasEventId = columns.some(col => col.name === 'event_id');
  if (!hasEventId) {
    db.run("ALTER TABLE chat_rooms ADD COLUMN event_id INTEGER", (err) => {
      if (err) {
        console.error('Error adding event_id to chat_rooms:', err);
      } else {
        console.log('✅ Migration: event_id column added to chat_rooms');
      }
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Konfi Points API running on port ${PORT}`);
  console.log(`📁 Uploads directory: ${uploadsDir}`);
});

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


// === RBAC SYSTEM ROUTES ===

// ====================================================================
// ROUTES
// ====================================================================

console.log('🔗 Mounting API routes...');

// --- Import all route modules FIRST ---
const authRoutes = require('./routes/auth');
const konfiRoutes = require('./routes/konfi');
const eventsRoutes = require('./routes/events');
const chatRoutes = require('./routes/chat');

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

// --- Import Middleware ---
const { verifyTokenRBAC, checkPermission } = require('./middleware/rbac');
const rbacVerifier = verifyTokenRBAC(db);

// --- Create router instances by passing dependencies ---
const badgesRouter = adminBadgesRoutes(db, rbacVerifier, checkPermission);
const activitiesRouter = adminActivitiesRoutes(db, rbacVerifier, checkPermission, badgesRouter.checkAndAwardBadges, upload);

// --- Health Check ---
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Konfi Points API is running' });
});

// Public-facing & Konfi-specific routes (nutzen einfaches verifyToken)
app.use('/api/auth', authRoutes(db, verifyToken, transporter, SMTP_CONFIG));
app.use('/api/konfi', konfiRoutes(db, verifyToken));
app.use('/api/events', eventsRoutes(db, verifyToken));
app.use('/api/chat', chatRoutes(db, verifyToken, uploadsDir));

// Admin-facing & RBAC-protected routes
app.use('/api/admin/activities', activitiesRouter);
app.use('/api/admin/badges', badgesRouter);
app.use('/api/admin/konfis', adminKonfisRoutes(db, rbacVerifier, checkPermission));
app.use('/api/admin/jahrgaenge', adminJahrgaengeRoutes(db, rbacVerifier, checkPermission));
app.use('/api/admin/categories', adminCategoriesRoutes(db, rbacVerifier, checkPermission));

app.use('/api/users', usersRoutes(db, rbacVerifier, checkPermission));
app.use('/api/roles', rolesRoutes(db, rbacVerifier, checkPermission));
app.use('/api/organizations', organizationsRoutes(db, rbacVerifier, checkPermission));
app.use('/api/permissions', permissionsRoutes(db, rbacVerifier, checkPermission));

// ====================================================================
// END OF ROUTES
// ====================================================================

// Initialize default chat rooms
const initializeChatRooms = () => {
  // Create jahrgang chat rooms
  db.all("SELECT * FROM jahrgaenge", [], (err, jahrgaenge) => {
    if (err) return;
    
    jahrgaenge.forEach(jahrgang => {
      db.get("SELECT id FROM chat_rooms WHERE type = 'jahrgang' AND jahrgang_id = ?", [jahrgang.id], (err, room) => {
        if (!room) {
          db.run("INSERT INTO chat_rooms (name, type, jahrgang_id, created_by) VALUES (?, 'jahrgang', ?, 1)",
            [`Jahrgang ${jahrgang.name}`, jahrgang.id], function(err) {
              if (!err) {
                // Add all konfis of this jahrgang to the room
                db.all("SELECT id FROM konfis WHERE jahrgang_id = ?", [jahrgang.id], (err, konfis) => {
                  if (!err) {
                    konfis.forEach(konfi => {
                      db.run("INSERT INTO chat_participants (room_id, user_id, user_type) VALUES (?, ?, 'konfi')",
                        [this.lastID, konfi.id]);
                    });
                  }
                });
              }
            });
        }
      });
    });
  });
};

// Call initialization after database setup
setImmediate(initializeChatRooms);