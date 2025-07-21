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

// Add image viewing endpoint
app.get('/api/activity-requests/:id/photo', (req, res) => {
  const requestId = req.params.id;
  
  db.get("SELECT photo_filename FROM activity_requests WHERE id = ?", [requestId], (err, request) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (!request || !request.photo_filename) return res.status(404).json({ error: 'Photo not found' });
    
    const photoPath = path.join(uploadsDir, request.photo_filename);
    if (fs.existsSync(photoPath)) {
      res.sendFile(photoPath);
    } else {
      res.status(404).json({ error: 'Photo file not found' });
    }
  });
});

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

// === ACTIVITY REQUESTS ===

// Get activity requests
app.get('/api/activity-requests', verifyToken, (req, res) => {
  let query, params;
  
  if (req.user.type === 'admin') {
    query = `
      SELECT ar.*, k.name as konfi_name, a.name as activity_name, a.points as activity_points,
             admin.display_name as approved_by_name
      FROM activity_requests ar
      JOIN konfis k ON ar.konfi_id = k.id
      JOIN activities a ON ar.activity_id = a.id
      LEFT JOIN admins admin ON ar.approved_by = admin.id
      ORDER BY ar.created_at DESC
    `;
    params = [];
  } else {
    query = `
      SELECT ar.*, a.name as activity_name, a.points as activity_points,
             admin.display_name as approved_by_name
      FROM activity_requests ar
      JOIN activities a ON ar.activity_id = a.id
      LEFT JOIN admins admin ON ar.approved_by = admin.id
      WHERE ar.konfi_id = ?
      ORDER BY ar.created_at DESC
    `;
    params = [req.user.id];
  }

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(rows);
  });
});

// Create activity request
app.post('/api/activity-requests', upload.single('photo'), (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ error: 'Invalid token' });
    if (decoded.type !== 'konfi') return res.status(403).json({ error: 'Konfi access required' });

    const { activity_id, requested_date, comment } = req.body;
    const photo_filename = req.file ? req.file.filename : null;
    
    if (!activity_id || !requested_date) {
      return res.status(400).json({ error: 'Activity and date are required' });
    }

    db.run("INSERT INTO activity_requests (konfi_id, activity_id, requested_date, comment, photo_filename) VALUES (?, ?, ?, ?, ?)",
           [decoded.id, activity_id, requested_date, comment, photo_filename],
           function(err) {
             if (err) return res.status(500).json({ error: 'Database error' });
             res.json({ id: this.lastID, message: 'Antrag erfolgreich gestellt', photo_filename });
           });
  });
});

// Update activity request status (admin only)
app.put('/api/activity-requests/:id', verifyToken, async (req, res) => {
  if (req.user.type !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  const requestId = req.params.id;
  const { status, admin_comment } = req.body;
  
  if (!['pending', 'approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  
  try {
    // Get request details first
    const request = await new Promise((resolve, reject) => {
      db.get("SELECT ar.*, a.points, a.type FROM activity_requests ar JOIN activities a ON ar.activity_id = a.id WHERE ar.id = ?", 
        [requestId], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
    });
    
    if (!request) {
      return res.status(404).json({ error: 'Request not found' });
    }
    
    // Update request status
    await new Promise((resolve, reject) => {
      db.run("UPDATE activity_requests SET status = ?, admin_comment = ?, approved_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [status, admin_comment, req.user.id, requestId], function(err) {
          if (err) reject(err);
          else resolve();
        });
    });
    
    let newBadges = 0;
    
    // If approved, add activity
    if (status === 'approved') {
      // Add to konfi_activities
      await new Promise((resolve, reject) => {
        db.run("INSERT INTO konfi_activities (konfi_id, activity_id, admin_id, completed_date) VALUES (?, ?, ?, ?)",
          [request.konfi_id, request.activity_id, req.user.id, request.requested_date], function(err) {
            if (err) reject(err);
            else resolve();
          });
      });
      
      // Update konfi points
      const pointField = request.type === 'gottesdienst' ? 'gottesdienst_points' : 'gemeinde_points';
      await new Promise((resolve, reject) => {
        db.run(`UPDATE konfis SET ${pointField} = ${pointField} + ? WHERE id = ?`,
          [request.points, request.konfi_id], (err) => {
            if (err) reject(err);
            else resolve();
          });
      });
      
      // Check and award badges - HIER PASSIERT DIE BADGE-ÜBERPRÜFUNG!
      newBadges = await checkAndAwardBadges(request.konfi_id);
    }
    
    res.json({ 
      message: 'Request status updated', 
      newBadges: newBadges 
    });
    
  } catch (err) {
    console.error('Error updating request status:', err);
    res.status(500).json({ error: 'Database error: ' + err.message });
  }
});

// Delete activity request
app.delete('/api/activity-requests/:id', verifyToken, (req, res) => {
  const requestId = req.params.id;
  let query, params;

  if (req.user.type === 'admin') {
    query = "DELETE FROM activity_requests WHERE id = ?";
    params = [requestId];
  } else {
    query = "DELETE FROM activity_requests WHERE id = ? AND konfi_id = ?";
    params = [requestId, req.user.id];
  }

  db.run(query, params, function(err) {
    if (err) return res.status(500).json({ error: 'Database error' });
    if (this.changes === 0) return res.status(404).json({ error: 'Request not found' });
    res.json({ message: 'Request deleted successfully' });
  });
});

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

// === ADMIN MANAGEMENT ===

// Get all admins
app.get('/api/admins', verifyToken, (req, res) => {
  if (req.user.type !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  db.all("SELECT id, username, display_name, created_at FROM admins ORDER BY created_at", [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(rows);
  });
});

// Add new admin
app.post('/api/admins', verifyToken, (req, res) => {
  if (req.user.type !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { username, display_name, password } = req.body;
  
  if (!username || !display_name || !password) {
    return res.status(400).json({ error: 'Username, display name and password are required' });
  }

  const hashedPassword = bcrypt.hashSync(password, 10);
  
  db.run("INSERT INTO admins (username, display_name, password_hash) VALUES (?, ?, ?)",
         [username, display_name, hashedPassword],
         function(err) {
           if (err) {
             if (err.message.includes('UNIQUE constraint failed')) {
               return res.status(400).json({ error: 'Username already exists' });
             }
             return res.status(500).json({ error: 'Database error' });
           }
           
           res.json({ 
             id: this.lastID, 
             username, 
             display_name,
             created_at: new Date().toISOString()
           });
         });
});

// Update admin
app.put('/api/admins/:id', verifyToken, (req, res) => {
  if (req.user.type !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const adminId = req.params.id;
  const { username, display_name, password } = req.body;
  
  if (!username || !display_name) {
    return res.status(400).json({ error: 'Username and display name are required' });
  }

  let query = "UPDATE admins SET username = ?, display_name = ?";
  let params = [username, display_name];
  
  if (password) {
    const hashedPassword = bcrypt.hashSync(password, 10);
    query += ", password_hash = ?";
    params.push(hashedPassword);
  }
  
  query += " WHERE id = ?";
  params.push(adminId);

  db.run(query, params, function(err) {
    if (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        return res.status(400).json({ error: 'Username already exists' });
      }
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Admin not found' });
    }
    
    res.json({ message: 'Admin updated successfully' });
  });
});

// Delete admin
app.delete('/api/admins/:id', verifyToken, (req, res) => {
  if (req.user.type !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const adminId = req.params.id;
  
  // Prevent deleting yourself
  if (parseInt(adminId) === req.user.id) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }

  // Check if this is the last admin
  db.get("SELECT COUNT(*) as count FROM admins", [], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (row.count <= 1) {
      return res.status(400).json({ error: 'Cannot delete the last admin account' });
    }

    db.run("DELETE FROM admins WHERE id = ?", [adminId], function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Admin not found' });
      }
      
      res.json({ message: 'Admin deleted successfully' });
    });
  });
});

// === JAHRGÄNGE MANAGEMENT ===

// Get all jahrgänge
app.get('/api/jahrgaenge', verifyToken, (req, res) => {
  if (req.user.type !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  db.all("SELECT * FROM jahrgaenge ORDER BY name DESC", [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(rows);
  });
});

// Add new jahrgang
app.post('/api/jahrgaenge', verifyToken, (req, res) => {
  if (req.user.type !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { name, confirmation_date } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  db.run("INSERT INTO jahrgaenge (name, confirmation_date) VALUES (?, ?)", [name, confirmation_date], function(err) {
    if (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        return res.status(400).json({ error: 'Jahrgang already exists' });
      }
      return res.status(500).json({ error: 'Database error' });
    }
    
    res.json({ id: this.lastID, name, confirmation_date });
  });
});

// Update jahrgang
app.put('/api/jahrgaenge/:id', verifyToken, (req, res) => {
  if (req.user.type !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const jahrgangId = req.params.id;
  const { name, confirmation_date } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Name is required' });
  }

  db.run("UPDATE jahrgaenge SET name = ?, confirmation_date = ? WHERE id = ?", [name, confirmation_date, jahrgangId], function(err) {
    if (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        return res.status(400).json({ error: 'Jahrgang already exists' });
      }
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Jahrgang not found' });
    }
    
    res.json({ message: 'Jahrgang updated successfully' });
  });
});

// Delete jahrgang
app.delete('/api/jahrgaenge/:id', verifyToken, (req, res) => {
  if (req.user.type !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const jahrgangId = req.params.id;

  // Check if jahrgang has konfis
  db.get("SELECT COUNT(*) as count FROM konfis WHERE jahrgang_id = ?", [jahrgangId], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (row.count > 0) {
      return res.status(400).json({ error: 'Cannot delete jahrgang with existing konfis' });
    }

    db.run("DELETE FROM jahrgaenge WHERE id = ?", [jahrgangId], function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Jahrgang not found' });
      }
      
      // Also delete associated chat room
      db.run("DELETE FROM chat_rooms WHERE type = 'jahrgang' AND jahrgang_id = ?", [jahrgangId], (err) => {
        if (err) {
          console.error('Error deleting jahrgang chat room:', err);
        }
      });
      
      res.json({ message: 'Jahrgang deleted successfully' });
    });
  });
});

// Categories CRUD APIs
// Get all categories
app.get('/api/categories', verifyToken, (req, res) => {
  if (!req.user || req.user.type !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  db.all("SELECT * FROM categories ORDER BY name", [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(rows);
  });
});

// Create category
app.post('/api/categories', verifyToken, (req, res) => {
  if (!req.user || req.user.type !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  const { name, description, type } = req.body;
  
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Name is required' });
  }
  
  const validTypes = ['activity', 'event', 'both'];
  if (type && !validTypes.includes(type)) {
    return res.status(400).json({ error: 'Invalid type' });
  }
  
  db.run("INSERT INTO categories (name, description, type) VALUES (?, ?, ?)", [name.trim(), description || null, type || 'both'], function(err) {
    if (err) {
      if (err.code === 'SQLITE_CONSTRAINT') {
        return res.status(400).json({ error: 'Category name already exists' });
      }
      return res.status(500).json({ error: 'Database error' });
    }
    
    res.json({ 
      id: this.lastID,
      name: name.trim(),
      description: description || null,
      type: type || 'both',
      message: 'Category created successfully' 
    });
  });
});

// Update category
app.put('/api/categories/:id', verifyToken, (req, res) => {
  if (!req.user || req.user.type !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  const categoryId = parseInt(req.params.id);
  const { name, description, type } = req.body;
  
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Name is required' });
  }
  
  const validTypes = ['activity', 'event', 'both'];
  if (type && !validTypes.includes(type)) {
    return res.status(400).json({ error: 'Invalid type' });
  }
  
  db.run("UPDATE categories SET name = ?, description = ?, type = ? WHERE id = ?", [name.trim(), description || null, type || 'both', categoryId], function(err) {
    if (err) {
      if (err.code === 'SQLITE_CONSTRAINT') {
        return res.status(400).json({ error: 'Category name already exists' });
      }
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Category not found' });
    }
    
    res.json({ message: 'Category updated successfully' });
  });
});

// Delete category
app.delete('/api/categories/:id', verifyToken, (req, res) => {
  if (!req.user || req.user.type !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  const categoryId = parseInt(req.params.id);
  
  // Check if category is used in activities
  db.get("SELECT COUNT(*) as count FROM activities WHERE category = (SELECT name FROM categories WHERE id = ?)", [categoryId], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (row.count > 0) {
      return res.status(400).json({ error: 'Category cannot be deleted - it is used by activities' });
    }
    
    db.run("DELETE FROM categories WHERE id = ?", [categoryId], function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Category not found' });
      }
      
      res.json({ message: 'Category deleted successfully' });
    });
  });
});

// === KONFIS MANAGEMENT ===

// Get all konfis (admin only) - FIXED BRACKETS
app.get('/api/konfis', verifyToken, (req, res) => {
  if (req.user.type !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  // Get basic konfi info with jahrgang
  const konfisQuery = `
    SELECT k.*, j.name as jahrgang_name, j.confirmation_date
    FROM konfis k
    JOIN jahrgaenge j ON k.jahrgang_id = j.id
    ORDER BY j.name DESC, k.name
  `;
  
  db.all(konfisQuery, [], (err, konfisRows) => {
    if (err) {
      console.error('Database error in /api/konfis:', err);
      return res.status(500).json({ error: 'Database error: ' + err.message });
    }
    
    // Get badge counts for each konfi
    const badgeCountQuery = `
      SELECT konfi_id, COUNT(*) as badge_count 
      FROM konfi_badges 
      GROUP BY konfi_id
    `;
    
    db.all(badgeCountQuery, [], (err, badgeCounts) => {
      if (err) {
        console.error('Database error loading badge counts:', err);
        return res.status(500).json({ error: 'Database error: ' + err.message });
      }
      
      // Create badge count map
      const badgeCountMap = {};
      badgeCounts.forEach(bc => {
        badgeCountMap[bc.konfi_id] = bc.badge_count;
      });
      
      // Get all activities for all konfis
      const activitiesQuery = `
        SELECT ka.konfi_id, a.name, a.points, a.type, ka.completed_date as date, 
                COALESCE(adm.display_name, 'Unbekannt') as admin, ka.id
        FROM konfi_activities ka
        JOIN activities a ON ka.activity_id = a.id
        LEFT JOIN admins adm ON ka.admin_id = adm.id
        ORDER BY ka.completed_date DESC
      `;
      
      // Get all bonus points for all konfis
      const bonusQuery = `
        SELECT bp.konfi_id, bp.description, bp.points, bp.type, bp.completed_date as date,
                COALESCE(adm.display_name, 'Unbekannt') as admin, bp.id
        FROM bonus_points bp
        LEFT JOIN admins adm ON bp.admin_id = adm.id
        ORDER BY bp.completed_date DESC
      `;
      
      db.all(activitiesQuery, [], (err, allActivities) => {
        if (err) {
          console.error('Database error loading activities:', err);
          return res.status(500).json({ error: 'Database error: ' + err.message });
        }
        
        db.all(bonusQuery, [], (err, allBonusPoints) => {
          if (err) {
            console.error('Database error loading bonus points:', err);
            return res.status(500).json({ error: 'Database error: ' + err.message });
          }
          
          // Group activities and bonus points by konfi_id
          const activitiesByKonfi = {};
          const bonusPointsByKonfi = {};
          
          allActivities.forEach(activity => {
            if (!activitiesByKonfi[activity.konfi_id]) {
              activitiesByKonfi[activity.konfi_id] = [];
            }
            activitiesByKonfi[activity.konfi_id].push({
              name: activity.name,
              points: activity.points,
              type: activity.type,
              date: activity.date,
              admin: activity.admin,
              id: activity.id
            });
          });
          
          allBonusPoints.forEach(bonus => {
            if (!bonusPointsByKonfi[bonus.konfi_id]) {
              bonusPointsByKonfi[bonus.konfi_id] = [];
            }
            bonusPointsByKonfi[bonus.konfi_id].push({
              description: bonus.description,
              points: bonus.points,
              type: bonus.type,
              date: bonus.date,
              admin: bonus.admin,
              id: bonus.id
            });
          });
          
          // Build final result WITH badge counts
          const konfis = konfisRows.map(row => ({
            id: row.id,
            name: row.name,
            username: row.username,
            password: row.password_plain,
            jahrgang: row.jahrgang_name,
            jahrgang_id: row.jahrgang_id,
            confirmation_date: row.confirmation_date,
            points: {
              gottesdienst: row.gottesdienst_points,
              gemeinde: row.gemeinde_points
            },
            activities: activitiesByKonfi[row.id] || [],
            bonusPoints: bonusPointsByKonfi[row.id] || [],
            badges: [], // Will be populated if needed
            badgeCount: badgeCountMap[row.id] || 0 // NEW: Badge count
          }));
          
          res.json(konfis);
        });
      });
    });
  });
});

// Get single konfi (admin or konfi themselves) - WITH ADMIN TRACKING AND BADGES
app.get('/api/konfis/:id', verifyToken, (req, res) => {
  const konfiId = parseInt(req.params.id, 10);
  
  // Validate konfiId
  if (isNaN(konfiId)) {
    return res.status(400).json({ error: 'Invalid konfi ID' });
  }
  
  if (req.user.type === 'konfi' && req.user.id !== konfiId) {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  // Get basic konfi info
  const konfiQuery = `
    SELECT k.*, j.name as jahrgang_name, j.confirmation_date
    FROM konfis k
    JOIN jahrgaenge j ON k.jahrgang_id = j.id
    WHERE k.id = ?
  `;
  
  db.get(konfiQuery, [konfiId], (err, konfiRow) => {
    if (err) {
      console.error('Database error in /api/konfis/:id:', err);
      return res.status(500).json({ error: 'Database error: ' + err.message });
    }
    
    if (!konfiRow) {
      return res.status(404).json({ error: 'Konfi not found' });
    }
    
    // Get activities separately
    const activitiesQuery = `
  SELECT a.name, a.points, a.type, ka.completed_date as date, 
          COALESCE(adm.display_name, 'Unbekannt') as admin, ka.id
  FROM konfi_activities ka
  JOIN activities a ON ka.activity_id = a.id
  LEFT JOIN admins adm ON ka.admin_id = adm.id
  WHERE ka.konfi_id = ?
  ORDER BY ka.completed_date DESC
`;
    
    // Get bonus points separately
    const bonusQuery = `
      SELECT bp.description, bp.points, bp.type, bp.completed_date as date,
              COALESCE(adm.display_name, 'Unbekannt') as admin, bp.id
      FROM bonus_points bp
      LEFT JOIN admins adm ON bp.admin_id = adm.id
      WHERE bp.konfi_id = ?
      ORDER BY bp.completed_date DESC
    `;
    
    // Get badges for this konfi
    const badgesQuery = `
      SELECT cb.*, kb.earned_at FROM custom_badges cb
      JOIN konfi_badges kb ON cb.id = kb.badge_id
      WHERE kb.konfi_id = ?
      ORDER BY kb.earned_at DESC
    `;
    
    db.all(activitiesQuery, [konfiId], (err, activities) => {
      if (err) {
        console.error('Database error loading activities for konfi', konfiId, ':', err);
        return res.status(500).json({ error: 'Database error loading activities: ' + err.message });
      }
      
      db.all(bonusQuery, [konfiId], (err, bonusPoints) => {
        if (err) {
          console.error('Database error loading bonus points for konfi', konfiId, ':', err);
          return res.status(500).json({ error: 'Database error loading bonus points: ' + err.message });
        }
        
        db.all(badgesQuery, [konfiId], (err, badges) => {
          if (err) {
            console.error('Database error loading badges for konfi', konfiId, ':', err);
            return res.status(500).json({ error: 'Database error loading badges: ' + err.message });
          }
          
          const konfi = {
            id: konfiRow.id,
            name: konfiRow.name,
            username: konfiRow.username,
            password: konfiRow.password_plain,
            jahrgang: konfiRow.jahrgang_name,
            jahrgang_id: konfiRow.jahrgang_id,
            confirmation_date: konfiRow.confirmation_date,
            points: {
              gottesdienst: konfiRow.gottesdienst_points || 0,
              gemeinde: konfiRow.gemeinde_points || 0
            },
            activities: activities || [],
            bonusPoints: bonusPoints || [],
            badges: badges || []
          };
          
          res.json(konfi);
        });
      });
    });
  });
});

// Add new konfi (admin only)
app.post('/api/konfis', verifyToken, (req, res) => {
  if (req.user.type !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { name, jahrgang_id } = req.body;
  
  if (!name || !jahrgang_id) {
    return res.status(400).json({ error: 'Name and Jahrgang are required' });
  }

  // Generate password and username
  const password = generateBiblicalPassword();
  const hashedPassword = bcrypt.hashSync(password, 10);
  const username = name.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z.]/g, '');
  
  db.run("INSERT INTO konfis (name, jahrgang_id, username, password_hash, password_plain) VALUES (?, ?, ?, ?, ?)",
         [name, jahrgang_id, username, hashedPassword, password],
         function(err) {
           if (err) {
             if (err.message.includes('UNIQUE constraint failed')) {
               return res.status(400).json({ error: 'Username already exists' });
             }
             return res.status(500).json({ error: 'Database error' });
           }
           
           const konfiId = this.lastID;
           
           // Add konfi to jahrgang chat room
           db.get("SELECT id FROM chat_rooms WHERE type = 'jahrgang' AND jahrgang_id = ?", [jahrgang_id], (err, chatRoom) => {
             if (chatRoom) {
               db.run("INSERT INTO chat_participants (room_id, user_id, user_type) VALUES (?, ?, 'konfi')",
                 [chatRoom.id, konfiId], (err) => {
                   if (err) console.error('Error adding konfi to jahrgang chat:', err);
                 });
             }
           });
           
           // Get jahrgang name
           db.get("SELECT name, confirmation_date FROM jahrgaenge WHERE id = ?", [jahrgang_id], (err, jahrgangRow) => {
             res.json({ 
               id: konfiId, 
               name, 
               username,
               password,
               jahrgang: jahrgangRow ? jahrgangRow.name : '',
               jahrgang_id,
               confirmation_date: jahrgangRow ? jahrgangRow.confirmation_date : null,
               points: { gottesdienst: 0, gemeinde: 0 },
               activities: [],
               bonusPoints: []
             });
           });
         });
});

// Update konfi
app.put('/api/konfis/:id', verifyToken, (req, res) => {
  if (req.user.type !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const konfiId = req.params.id;
  const { name, jahrgang_id } = req.body;
  
  if (!name || !jahrgang_id) {
    return res.status(400).json({ error: 'Name and Jahrgang are required' });
  }

  // Generate new username based on name
  const username = name.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z.]/g, '');

  db.run("UPDATE konfis SET name = ?, jahrgang_id = ?, username = ? WHERE id = ?", 
         [name, jahrgang_id, username, konfiId], function(err) {
    if (err) {
      if (err.message.includes('UNIQUE constraint failed')) {
        return res.status(400).json({ error: 'Username already exists' });
      }
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (this.changes === 0) {
      return res.status(404).json({ error: 'Konfi not found' });
    }
    
    res.json({ message: 'Konfi updated successfully' });
  });
});

// Delete konfi
app.delete('/api/konfis/:id', verifyToken, (req, res) => {
  if (req.user.type !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const konfiId = req.params.id;

  // Delete related records first
  db.serialize(() => {
    db.run("DELETE FROM konfi_activities WHERE konfi_id = ?", [konfiId]);
    db.run("DELETE FROM bonus_points WHERE konfi_id = ?", [konfiId]);
    db.run("DELETE FROM konfi_badges WHERE konfi_id = ?", [konfiId]);
    db.run("DELETE FROM activity_requests WHERE konfi_id = ?", [konfiId]);
    db.run("DELETE FROM konfis WHERE id = ?", [konfiId], function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Konfi not found' });
      }
      
      res.json({ message: 'Konfi deleted successfully' });
    });
  });
});

// === ACTIVITIES MANAGEMENT ===

// Get all activities
app.get('/api/activities', verifyToken, (req, res) => {
  // Get activities with their categories
  db.all(`
    SELECT a.*, 
           GROUP_CONCAT(c.id) as category_ids,
           GROUP_CONCAT(c.name) as category_names
    FROM activities a
    LEFT JOIN activity_categories ac ON a.id = ac.activity_id
    LEFT JOIN categories c ON ac.category_id = c.id
    GROUP BY a.id
    ORDER BY a.type, a.name
  `, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    // Transform the data to include categories array
    const activitiesWithCategories = rows.map(row => {
      const categories = [];
      if (row.category_ids) {
        const ids = row.category_ids.split(',');
        const names = row.category_names.split(',');
        for (let i = 0; i < ids.length; i++) {
          categories.push({
            id: parseInt(ids[i]),
            name: names[i]
          });
        }
      }
      
      return {
        id: row.id,
        name: row.name,
        points: row.points,
        type: row.type,
        categories: categories,
        created_at: row.created_at
      };
    });
    
    res.json(activitiesWithCategories);
  });
});

// Add new activity (admin only)
app.post('/api/activities', verifyToken, (req, res) => {
  if (req.user.type !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { name, points, type, category_ids } = req.body;
  
  if (!name || !points || !type) {
    return res.status(400).json({ error: 'Name, points and type are required' });
  }

  if (!['gottesdienst', 'gemeinde'].includes(type)) {
    return res.status(400).json({ error: 'Type must be gottesdienst or gemeinde' });
  }

  // Create activity first
  db.run("INSERT INTO activities (name, points, type) VALUES (?, ?, ?)",
         [name, points, type],
         function(err) {
           if (err) {
             return res.status(500).json({ error: 'Database error' });
           }
           
           const activityId = this.lastID;
           
           // Add categories if provided
           if (category_ids && Array.isArray(category_ids) && category_ids.length > 0) {
             const categoryPromises = category_ids.map(categoryId => {
               return new Promise((resolve, reject) => {
                 db.run("INSERT OR IGNORE INTO activity_categories (activity_id, category_id) VALUES (?, ?)",
                   [activityId, categoryId], (err) => {
                     if (err) reject(err);
                     else resolve();
                   });
               });
             });
             
             Promise.all(categoryPromises)
               .then(() => {
                 res.json({ 
                   id: activityId, 
                   name, 
                   points,
                   type,
                   category_ids
                 });
               })
               .catch(err => {
                 console.error('Error adding categories:', err);
                 res.status(500).json({ error: 'Database error adding categories' });
               });
           } else {
             res.json({ 
               id: activityId, 
               name, 
               points,
               type
             });
           }
         });
});

// Update activity
// Update activity
app.put('/api/activities/:id', verifyToken, (req, res) => {
  if (req.user.type !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  const activityId = req.params.id;
  const { name, points, type, category_ids } = req.body;
  
  if (!name || !points || !type) {
    return res.status(400).json({ error: 'Name, points and type are required' });
  }
  
  if (!['gottesdienst', 'gemeinde'].includes(type)) {
    return res.status(400).json({ error: 'Type must be gottesdienst or gemeinde' });
  }
  
  // Update the activity
  db.run("UPDATE activities SET name = ?, points = ?, type = ? WHERE id = ?", 
    [name, points, type, activityId], function(err) {
      if (err) {
        console.error('Database error updating activity:', err);
        return res.status(500).json({ error: 'Database error: ' + err.message });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Activity not found' });
      }
      
      // Update categories if provided
      if (category_ids && Array.isArray(category_ids)) {
        // First remove all existing categories
        db.run("DELETE FROM activity_categories WHERE activity_id = ?", [activityId], (err) => {
          if (err) {
            console.error('Error removing old categories:', err);
            return res.status(500).json({ error: 'Database error removing categories' });
          }
          
          // Then add new categories
          if (category_ids.length > 0) {
            const categoryPromises = category_ids.map(categoryId => {
              return new Promise((resolve, reject) => {
                db.run("INSERT OR IGNORE INTO activity_categories (activity_id, category_id) VALUES (?, ?)",
                  [activityId, categoryId], (err) => {
                    if (err) reject(err);
                    else resolve();
                  });
              });
            });
            
            Promise.all(categoryPromises)
              .then(() => {
                res.json({ message: 'Activity updated successfully' });
              })
              .catch(err => {
                console.error('Error adding categories:', err);
                res.status(500).json({ error: 'Database error adding categories' });
              });
          } else {
            res.json({ message: 'Activity updated successfully' });
          }
        });
      } else {
        res.json({ message: 'Activity updated successfully' });
      }
    });
});

// Delete activity
app.delete('/api/activities/:id', verifyToken, (req, res) => {
  if (req.user.type !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const activityId = req.params.id;

  // Check if activity is used
  db.get(`SELECT COUNT(*) as count, 
          GROUP_CONCAT(DISTINCT k.name) as konfi_names
          FROM konfi_activities ka 
          JOIN konfis k ON ka.konfi_id = k.id 
          WHERE ka.activity_id = ?`, [activityId], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (row.count > 0) {
      const konfiNames = row.konfi_names ? row.konfi_names.split(',').slice(0, 3) : [];
      const moreKonfis = row.count > 3 ? ` und ${row.count - 3} weitere` : '';
      return res.status(400).json({ 
        error: `Aktivität kann nicht gelöscht werden. Sie ist bereits ${row.count} Mal vergeben an: ${konfiNames.join(', ')}${moreKonfis}` 
      });
    }

    db.run("DELETE FROM activities WHERE id = ?", [activityId], function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Activity not found' });
      }
      
      res.json({ message: 'Activity deleted successfully' });
    });
  });
});

// Assign activity to konfi (admin only) - WITH ADMIN TRACKING AND DATE
app.post('/api/konfis/:id/activities', verifyToken, async (req, res) => {
  if (req.user.type !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  const konfiId = req.params.id;
  const { activityId, completed_date } = req.body;
  
  if (!activityId) {
    return res.status(400).json({ error: 'Activity ID is required' });
  }
  
  const date = completed_date || new Date().toISOString().split('T')[0];
  
  try {
    // Get activity details
    const activity = await new Promise((resolve, reject) => {
      db.get("SELECT * FROM activities WHERE id = ?", [activityId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    if (!activity) {
      return res.status(404).json({ error: 'Activity not found' });
    }
    
    // Add activity to konfi WITH ADMIN TRACKING AND DATE
    await new Promise((resolve, reject) => {
      db.run("INSERT INTO konfi_activities (konfi_id, activity_id, admin_id, completed_date) VALUES (?, ?, ?, ?)",
        [konfiId, activityId, req.user.id, date], function(err) {
          if (err) reject(err);
          else resolve();
        });
    });
    
    // Update konfi points
    const pointField = activity.type === 'gottesdienst' ? 'gottesdienst_points' : 'gemeinde_points';
    await new Promise((resolve, reject) => {
      db.run(`UPDATE konfis SET ${pointField} = ${pointField} + ? WHERE id = ?`,
        [activity.points, konfiId], (err) => {
          if (err) reject(err);
          else resolve();
        });
    });
    
    // Check and award badges - HIER PASSIERT DIE BADGE-ÜBERPRÜFUNG!
    const newBadges = await checkAndAwardBadges(konfiId);
    
    res.json({ 
      message: 'Activity assigned successfully',
      newBadges: newBadges,
      activity: {
        name: activity.name,
        points: activity.points,
        type: activity.type,
        date: formatDate(date),
        admin: req.user.display_name
      }
    });
    
  } catch (err) {
    console.error('Error assigning activity:', err);
    res.status(500).json({ error: 'Database error: ' + err.message });
  }
});

// Add bonus points - WITH ADMIN TRACKING AND DATE
app.post('/api/konfis/:id/bonus-points', verifyToken, async (req, res) => {
  if (req.user.type !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  const konfiId = req.params.id;
  const { points, type, description, completed_date } = req.body;
  
  if (!points || !type || !description) {
    return res.status(400).json({ error: 'Points, type and description are required' });
  }
  
  if (!['gottesdienst', 'gemeinde'].includes(type)) {
    return res.status(400).json({ error: 'Type must be gottesdienst or gemeinde' });
  }
  
  const date = completed_date || new Date().toISOString().split('T')[0];
  
  try {
    // Add bonus points WITH ADMIN TRACKING AND DATE
    await new Promise((resolve, reject) => {
      db.run("INSERT INTO bonus_points (konfi_id, points, type, description, admin_id, completed_date) VALUES (?, ?, ?, ?, ?, ?)",
        [konfiId, points, type, description, req.user.id, date], function(err) {
          if (err) reject(err);
          else resolve();
        });
    });
    
    // Update konfi points
    const pointField = type === 'gottesdienst' ? 'gottesdienst_points' : 'gemeinde_points';
    await new Promise((resolve, reject) => {
      db.run(`UPDATE konfis SET ${pointField} = ${pointField} + ? WHERE id = ?`,
        [points, konfiId], (err) => {
          if (err) reject(err);
          else resolve();
        });
    });
    
    // Check and award badges - HIER PASSIERT DIE BADGE-ÜBERPRÜFUNG!
    const newBadges = await checkAndAwardBadges(konfiId);
    
    res.json({ 
      message: 'Bonus points assigned successfully',
      newBadges: newBadges,
      bonusPoint: {
        description,
        points,
        type,
        date: formatDate(date),
        admin: req.user.display_name
      }
    });
    
  } catch (err) {
    console.error('Error adding bonus points:', err);
    res.status(500).json({ error: 'Database error: ' + err.message });
  }
});

// Remove activity from konfi (admin only)
app.delete('/api/konfis/:id/activities/:recordId', verifyToken, (req, res) => {
  if (req.user.type !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  const konfiId = req.params.id;
  const recordId = req.params.recordId;
  
  // Get activity details first to subtract points
  db.get("SELECT ka.id, ka.activity_id, a.points, a.type FROM konfi_activities ka JOIN activities a ON ka.activity_id = a.id WHERE ka.id = ? AND ka.konfi_id = ?", 
    [recordId, konfiId], (err, activityAssignment) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!activityAssignment) {
        return res.status(404).json({ error: 'Activity assignment not found' });
      }
      
      // Remove the assignment
      db.run("DELETE FROM konfi_activities WHERE id = ?", [recordId], function(err) {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }
        
        // Update konfi points (subtract)
        const pointField = activityAssignment.type === 'gottesdienst' ? 'gottesdienst_points' : 'gemeinde_points';
        db.run(`UPDATE konfis SET ${pointField} = ${pointField} - ? WHERE id = ?`,
          [activityAssignment.points, konfiId],
          (err) => {
            if (err) {
              return res.status(500).json({ error: 'Database error updating points' });
            }
            
            res.json({ 
              message: 'Activity removed successfully',
              pointsSubtracted: activityAssignment.points,
              type: activityAssignment.type
            });
          });
      });
    });
});

// Remove bonus points from konfi (admin only)
app.delete('/api/konfis/:id/bonus-points/:bonusId', verifyToken, (req, res) => {
  if (req.user.type !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const konfiId = req.params.id;
  const bonusId = req.params.bonusId;

  // Get bonus points details first to subtract points
  db.get("SELECT * FROM bonus_points WHERE id = ? AND konfi_id = ?", [bonusId, konfiId], (err, bonusPoint) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (!bonusPoint) {
      return res.status(404).json({ error: 'Bonus points not found' });
    }

    // Remove the bonus points
    db.run("DELETE FROM bonus_points WHERE id = ?", [bonusId], function(err) {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }

      // Update konfi points (subtract)
      const pointField = bonusPoint.type === 'gottesdienst' ? 'gottesdienst_points' : 'gemeinde_points';
      db.run(`UPDATE konfis SET ${pointField} = ${pointField} - ? WHERE id = ?`,
             [bonusPoint.points, konfiId],
             (err) => {
               if (err) {
                 return res.status(500).json({ error: 'Database error updating points' });
               }
               
               res.json({ 
                 message: 'Bonus points removed successfully',
                 pointsSubtracted: bonusPoint.points,
                 type: bonusPoint.type
               });
             });
    });
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

// === CHAT SYSTEM - KORRIGIERT ===

// Chat file upload setup
const chatUpload = multer({ 
  dest: path.join(uploadsDir, 'chat'),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedExtensions = /\.(jpeg|jpg|png|gif|heic|webp|pdf|mp3|wav|m4a|mp4|mov|avi|docx|txt|pptx|xlsx|rtf|zip)$/i;
    const extname = allowedExtensions.test(file.originalname);
    
    // Check MIME types more specifically
    const allowedMimeTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/heic', 'image/webp',
      'application/pdf',
      'audio/mpeg', 'audio/wav', 'audio/x-m4a', 'audio/mp4',
      'video/mp4', 'video/quicktime', 'video/x-msvideo',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
      'application/vnd.openxmlformats-officedocument.presentationml.presentation', // pptx  
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
      'text/plain', 'text/rtf', 'application/rtf',
      'application/zip', 'application/x-zip-compressed'
    ];
    const mimetype = allowedMimeTypes.includes(file.mimetype);
    
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      console.log('Rejected file:', file.originalname, 'MIME:', file.mimetype);
      cb(new Error('Dateityp nicht erlaubt'));
    }
  }
});

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

// === CHAT API ENDPOINTS ===

// Get admins for direct contact (konfis only)
app.get('/api/chat/admins', verifyToken, (req, res) => {
  if (req.user.type !== 'konfi') {
    return res.status(403).json({ error: 'Konfi access required' });
  }
  
  db.all("SELECT id, display_name, username FROM admins ORDER BY display_name", [], (err, admins) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(admins);
  });
});

// Create or get direct chat room
app.post('/api/chat/direct', verifyToken, (req, res) => {
  const { target_user_id, target_user_type } = req.body;
  
  if (!target_user_id || !target_user_type) {
    return res.status(400).json({ error: 'Target user required' });
  }
  
  // Validate target user type
  if (!['admin', 'konfi'].includes(target_user_type)) {
    return res.status(400).json({ error: 'Invalid target user type' });
  }
  
  const user1_type = req.user.type;
  const user1_id = req.user.id;
  const user2_type = target_user_type;
  const user2_id = target_user_id;
  
  // Check if room already exists
  const existingRoomQuery = `
    SELECT r.id FROM chat_rooms r
    WHERE r.type = 'direct'
    AND EXISTS (SELECT 1 FROM chat_participants p1 WHERE p1.room_id = r.id AND p1.user_id = ? AND p1.user_type = ?)
    AND EXISTS (SELECT 1 FROM chat_participants p2 WHERE p2.room_id = r.id AND p2.user_id = ? AND p2.user_type = ?)
  `;
  
  db.get(existingRoomQuery, [user1_id, user1_type, user2_id, user2_type], (err, existingRoom) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    
    if (existingRoom) {
      return res.json({ room_id: existingRoom.id, created: false });
    }
    
    // Get target user name for room title
    const targetQuery = target_user_type === 'admin' ? 
    "SELECT display_name as name FROM admins WHERE id = ?" :
    "SELECT name FROM konfis WHERE id = ?";
    
    db.get(targetQuery, [target_user_id], (err, targetUser) => {
      if (err || !targetUser) return res.status(404).json({ error: 'Target user not found' });
      
      // Room name is just the target user's name (simplified)
      const roomName = targetUser.name;
      
      // Create new direct room
      db.run("INSERT INTO chat_rooms (name, type, created_by) VALUES (?, 'direct', ?)",
        [roomName, req.user.id], function(err) {
          if (err) return res.status(500).json({ error: 'Database error' });
          
          const roomId = this.lastID;
          
          // Add both participants
          db.run("INSERT INTO chat_participants (room_id, user_id, user_type) VALUES (?, ?, ?)",
            [roomId, user1_id, user1_type], (err) => {
              if (err) return res.status(500).json({ error: 'Database error' });
              
              db.run("INSERT INTO chat_participants (room_id, user_id, user_type) VALUES (?, ?, ?)",
                [roomId, user2_id, user2_type], (err) => {
                  if (err) return res.status(500).json({ error: 'Database error' });
                  
                  res.json({ room_id: roomId, created: true });
                });
            });
        });
    });
  });
});

// Create new chat room
app.post('/api/chat/rooms', verifyToken, (req, res) => {
  const { type, name, participants, jahrgang_id } = req.body;
  const createdBy = req.user.id;
  
  if (!type || !name) {
    return res.status(400).json({ error: 'Type and name are required' });
  }
  
  // Validate type
  if (!['direct', 'group', 'jahrgang', 'admin_team'].includes(type)) {
    return res.status(400).json({ error: 'Invalid chat type' });
  }
  
  // For jahrgang chats, check if one already exists
  if (type === 'jahrgang') {
    if (!jahrgang_id) {
      return res.status(400).json({ error: 'Jahrgang ID required for jahrgang chats' });
    }
    
    db.get("SELECT id FROM chat_rooms WHERE type = 'jahrgang' AND jahrgang_id = ?", [jahrgang_id], (err, existing) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (existing) {
        return res.status(400).json({ error: 'Jahrgang chat already exists' });
      }
      
      createRoom();
    });
  } else {
    createRoom();
  }
  
  function createRoom() {
    console.log('Creating room with:', { name, type, jahrgang_id, createdBy });
    
    // Create the room
    db.run("INSERT INTO chat_rooms (name, type, jahrgang_id, created_by) VALUES (?, ?, ?, ?)",
      [name, type, jahrgang_id || null, createdBy], function(err) {
        if (err) {
          console.error('Room creation error:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        
        const roomId = this.lastID;
        
        // Add creator as participant
        console.log('Adding creator as participant:', { roomId, createdBy, userType: req.user.type });
        db.run("INSERT INTO chat_participants (room_id, user_id, user_type) VALUES (?, ?, ?)",
          [roomId, createdBy, req.user.type], (err) => {
            if (err) {
              console.error('Creator participant error:', err);
              return res.status(500).json({ error: 'Database error' });
            }
            
            // Add other participants
            if (participants && participants.length > 0) {
              let participantCount = 0;
              const totalParticipants = participants.length;
              
              participants.forEach(participant => {
                // Support both old format (just ID) and new format (object with user_id and user_type)
                const userId = typeof participant === 'object' ? participant.user_id : participant;
                const userType = typeof participant === 'object' ? participant.user_type : 'konfi';
                
                console.log('Adding participant:', { roomId, userId, userType, participant });
                
                // Skip if it's the creator (already added)
                if (userId === createdBy && userType === req.user.type) {
                  console.log('Skipping creator duplicate');
                  participantCount++;
                  if (participantCount === totalParticipants) {
                    res.json({ room_id: roomId, created: true });
                  }
                  return;
                }
                
                db.run("INSERT INTO chat_participants (room_id, user_id, user_type) VALUES (?, ?, ?)",
                  [roomId, userId, userType], (err) => {
                    if (err) {
                      console.error('Error adding participant:', err);
                      console.error('Participant data:', { roomId, userId, userType });
                    }
                    
                    participantCount++;
                    if (participantCount === totalParticipants) {
                      res.json({ room_id: roomId, created: true });
                    }
                  });
              });
            } else if (type === 'jahrgang') {
              // Add all konfis from the jahrgang
              db.all("SELECT id FROM konfis WHERE jahrgang_id = ?", [jahrgang_id], (err, konfis) => {
                if (err) return res.status(500).json({ error: 'Database error' });
                
                if (konfis.length === 0) {
                  return res.json({ room_id: roomId, created: true });
                }
                
                let konfiCount = 0;
                konfis.forEach(konfi => {
                  db.run("INSERT INTO chat_participants (room_id, user_id, user_type) VALUES (?, ?, 'konfi')",
                    [roomId, konfi.id], (err) => {
                      if (err) console.error('Error adding konfi to jahrgang chat:', err);
                      
                      konfiCount++;
                      if (konfiCount === konfis.length) {
                        res.json({ room_id: roomId, created: true });
                      }
                    });
                });
              });
            } else {
              res.json({ room_id: roomId, created: true });
            }
          });
      });
  }
});

// Get chat rooms for user
app.get('/api/chat/rooms', verifyToken, (req, res) => {
  const userId = req.user.id;
  const userType = req.user.type;
  
  let query;
  let params;
  
  if (userType === 'admin') {
    // Admins see all rooms using chat_read_status table
    query = `
      SELECT r.*, j.name as jahrgang_name,
              COUNT(CASE WHEN m.created_at > COALESCE(crs.last_read_at, '1970-01-01') AND m.deleted_at IS NULL THEN 1 END) as unread_count,
              (SELECT content FROM chat_messages WHERE room_id = r.id AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1) as last_message,
              (SELECT created_at FROM chat_messages WHERE room_id = r.id AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1) as last_message_time,
              NULL as last_message_sender
      FROM chat_rooms r
      LEFT JOIN jahrgaenge j ON r.jahrgang_id = j.id
      LEFT JOIN chat_read_status crs ON r.id = crs.room_id AND crs.user_id = ? AND crs.user_type = ?
      LEFT JOIN chat_messages m ON r.id = m.room_id
      GROUP BY r.id
      ORDER BY last_message_time DESC NULLS LAST
    `;
    params = [userId, userType];
  } else {
    // Konfis see only their rooms using chat_read_status table
    query = `
      SELECT r.*, j.name as jahrgang_name,
              COUNT(CASE WHEN m.created_at > COALESCE(crs.last_read_at, '1970-01-01') AND m.deleted_at IS NULL THEN 1 END) as unread_count,
              (SELECT content FROM chat_messages WHERE room_id = r.id AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1) as last_message,
              (SELECT created_at FROM chat_messages WHERE room_id = r.id AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1) as last_message_time,
              NULL as last_message_sender
      FROM chat_rooms r
      LEFT JOIN jahrgaenge j ON r.jahrgang_id = j.id
      INNER JOIN chat_participants p ON r.id = p.room_id AND p.user_id = ? AND p.user_type = ?
      LEFT JOIN chat_read_status crs ON r.id = crs.room_id AND crs.user_id = ? AND crs.user_type = ?
      LEFT JOIN chat_messages m ON r.id = m.room_id
      GROUP BY r.id
      ORDER BY last_message_time DESC NULLS LAST
    `;
    params = [userId, userType, userId, userType];
  }
  
  db.all(query, params, (err, rooms) => {
    if (err) {
      console.error('Error fetching chat rooms:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    // Process rooms to format last_message properly
    const processedRooms = rooms.map(room => {
      let processedRoom = { ...room };
      
      if (room.last_message && room.last_message_sender && room.last_message_time) {
        processedRoom.last_message = {
          content: room.last_message,
          sender_name: room.last_message_sender,
          created_at: room.last_message_time
        };
      } else {
        processedRoom.last_message = null;
      }
      
      // Remove the individual fields since we now have the structured last_message
      delete processedRoom.last_message_sender;
      delete processedRoom.last_message_time;
      
      return processedRoom;
    });
    
    res.json(processedRooms);
  });
});

// Get messages for a room
app.get('/api/chat/rooms/:roomId/messages', verifyToken, (req, res) => {
  const roomId = req.params.roomId;
  const limit = parseInt(req.query.limit) || 50;
  const offset = parseInt(req.query.offset) || 0;
  const userId = req.user.id;
  const userType = req.user.type;
  
  // Check if user has access to this room
  const accessQuery = userType === 'admin' ? 
  "SELECT 1 FROM chat_rooms WHERE id = ?" :
  "SELECT 1 FROM chat_participants WHERE room_id = ? AND user_id = ? AND user_type = ?";
  const accessParams = userType === 'admin' ? [roomId] : [roomId, userId, userType];
  
  db.get(accessQuery, accessParams, (err, access) => {
    if (err || !access) {
      console.error('Access denied for room', roomId, 'user', userId, 'type', userType);
      return res.status(403).json({ error: 'Access denied' });
    }
    
    const messagesQuery = `
      SELECT m.*, 
              m.user_id as sender_id,
              m.user_type as sender_type,
              CASE 
                WHEN m.user_type = 'admin' THEN a.display_name
                ELSE k.name
              END as sender_name,
              CASE
                WHEN m.user_type = 'admin' THEN a.username
                ELSE k.username  
              END as sender_username,
              p.question, p.options, p.expires_at, p.multiple_choice,
              p.id as poll_id
      FROM chat_messages m
      LEFT JOIN admins a ON m.user_id = a.id AND m.user_type = 'admin'
      LEFT JOIN konfis k ON m.user_id = k.id AND m.user_type = 'konfi'
      LEFT JOIN chat_polls p ON m.id = p.message_id
      WHERE m.room_id = ? AND m.deleted_at IS NULL
      ORDER BY m.created_at DESC
      LIMIT ? OFFSET ?
    `;
    
    db.all(messagesQuery, [roomId, limit, offset], async (err, messages) => {
      if (err) {
        console.error('Error fetching messages:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      // Load votes for poll messages
      const processedMessages = await Promise.all(messages.map(async (msg) => {
        if (msg.message_type === 'poll' && msg.options) {
          try {
            // Check if options is already an array or needs parsing
            if (typeof msg.options === 'string') {
              msg.options = JSON.parse(msg.options);
            }
            
            // Load votes for this poll
            const votes = await new Promise((resolve, reject) => {
              db.all(`
                SELECT v.*, 
                       CASE 
                         WHEN v.user_type = 'admin' THEN a.display_name
                         ELSE k.name
                       END as voter_name
                FROM chat_poll_votes v
                LEFT JOIN admins a ON v.user_id = a.id AND v.user_type = 'admin'
                LEFT JOIN konfis k ON v.user_id = k.id AND v.user_type = 'konfi'
                WHERE v.poll_id = ?
              `, [msg.poll_id], (err, votes) => {
                if (err) reject(err);
                else resolve(votes || []);
              });
            });
            
            msg.votes = votes;
            
            // Convert multiple_choice to boolean
            msg.multiple_choice = Boolean(msg.multiple_choice);
          } catch (e) {
            console.error('Error parsing poll options:', e, 'Raw options:', msg.options);
            msg.options = [];
            msg.votes = [];
          }
        }
        return msg;
      }));
      
      res.json(processedMessages.reverse());
    });
  });
});

// Send message - KORRIGIERT mit verifyToken ZUERST
app.post('/api/chat/rooms/:roomId/messages', verifyToken, chatUpload.single('file'), (req, res) => {
  const roomId = req.params.roomId;
  const { content, message_type = 'text', reply_to } = req.body;
  const userId = req.user.id;
  const userType = req.user.type;
  
  if (!content && !req.file) {
    return res.status(400).json({ error: 'Content or file required' });
  }
  
  // Check access
  const accessQuery = userType === 'admin' ? 
  "SELECT 1 FROM chat_rooms WHERE id = ?" :
  "SELECT 1 FROM chat_participants WHERE room_id = ? AND user_id = ? AND user_type = ?";
  const accessParams = userType === 'admin' ? [roomId] : [roomId, userId, userType];
  
  db.get(accessQuery, accessParams, (err, access) => {
    if (err || !access) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    let filePath = null;
    let fileName = null;
    let fileSize = null;
    let actualMessageType = message_type;
    
    if (req.file) {
      filePath = req.file.filename;
      fileName = req.file.originalname;
      fileSize = req.file.size;
      
      // Determine message type from file
      const ext = path.extname(fileName).toLowerCase();
      if (['.jpg', '.jpeg', '.png', '.gif'].includes(ext)) {
        actualMessageType = 'image';
      } else if (['.mp4', '.mov', '.avi'].includes(ext)) {
        actualMessageType = 'video';
      } else {
        actualMessageType = 'file';
      }
    }
    
    const insertQuery = `
      INSERT INTO chat_messages (room_id, user_id, user_type, message_type, content, file_path, file_name, file_size, reply_to, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '+2 hours'))
    `;
    
    db.run(insertQuery, [roomId, userId, userType, actualMessageType, content, filePath, fileName, fileSize, reply_to], function(err) {
      if (err) {
        console.error('Error inserting message:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      // Get the sent message with sender info
      const messageQuery = `
        SELECT m.*, 
                m.user_id as sender_id,
                m.user_type as sender_type,
                CASE 
                  WHEN m.user_type = 'admin' THEN a.display_name
                  ELSE k.name
                END as sender_name,
                CASE
                  WHEN m.user_type = 'admin' THEN a.username
                  ELSE k.username  
                END as sender_username
        FROM chat_messages m
        LEFT JOIN admins a ON m.user_id = a.id AND m.user_type = 'admin'
        LEFT JOIN konfis k ON m.user_id = k.id AND m.user_type = 'konfi'
        WHERE m.id = ?
      `;
      
      db.get(messageQuery, [this.lastID], (err, message) => {
        if (err) {
          console.error('Error fetching sent message:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        res.json(message);
      });
    });
  });
});

// Delete message (only for admins)
app.delete('/api/chat/messages/:messageId', verifyToken, (req, res) => {
  const messageId = req.params.messageId;
  const userId = req.user.id;
  const userType = req.user.type;

  // Only admins can delete messages
  if (userType !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  // Check if message exists and get its info
  db.get("SELECT * FROM chat_messages WHERE id = ? AND deleted_at IS NULL", [messageId], (err, message) => {
    if (err) {
      console.error('Error fetching message:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Soft delete the message
    db.run("UPDATE chat_messages SET deleted_at = datetime('now', '+2 hours') WHERE id = ?", [messageId], function(err) {
      if (err) {
        console.error('Error deleting message:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Message not found' });
      }

      res.json({ message: 'Message deleted successfully' });
    });
  });
});

// Mark room as read
app.put('/api/chat/rooms/:roomId/read', verifyToken, (req, res) => {
  const roomId = req.params.roomId;
  const userId = req.user.id;
  const userType = req.user.type;
  
  // First try to update existing participant record
  db.run("UPDATE chat_participants SET last_read_at = CURRENT_TIMESTAMP WHERE room_id = ? AND user_id = ? AND user_type = ?",
    [roomId, userId, userType], function(err) {
      if (err) {
        console.error('Error marking room as read:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      // If no rows were affected, insert a new participant record
      if (this.changes === 0) {
        db.run("INSERT INTO chat_participants (room_id, user_id, user_type, last_read_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)",
          [roomId, userId, userType], function(insertErr) {
            if (insertErr) {
              console.error('Error inserting participant record:', insertErr);
              return res.status(500).json({ error: 'Database error' });
            }
            res.json({ message: 'Marked as read' });
          });
      } else {
        res.json({ message: 'Marked as read' });
      }
    });
});

// Get unread counts for all rooms
app.get('/api/chat/unread-counts', verifyToken, (req, res) => {
  const userId = req.user.id;
  const userType = req.user.type;
  
  let query;
  if (userType === 'admin') {
    query = `
      SELECT r.id as room_id, COUNT(m.id) as unread_count
      FROM chat_rooms r
      LEFT JOIN chat_participants p ON r.id = p.room_id AND p.user_id = ? AND p.user_type = ?
      LEFT JOIN chat_messages m ON r.id = m.room_id 
        AND (p.last_read_at IS NULL OR m.created_at > p.last_read_at)
        AND m.deleted_at IS NULL
      GROUP BY r.id
    `;
  } else {
    query = `
      SELECT r.id as room_id, COUNT(m.id) as unread_count
      FROM chat_rooms r
      INNER JOIN chat_participants p ON r.id = p.room_id AND p.user_id = ? AND p.user_type = ?
      LEFT JOIN chat_messages m ON r.id = m.room_id 
        AND m.created_at > p.last_read_at
        AND m.deleted_at IS NULL
      GROUP BY r.id
    `;
  }
  
  db.all(query, [userId, userType], (err, counts) => {
    if (err) {
      console.error('Error fetching unread counts:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    const result = {};
    counts.forEach(c => {
      result[c.room_id] = c.unread_count;
    });
    
    res.json(result);
  });
});

// Get chat file
app.get('/api/chat/files/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(uploadsDir, 'chat', filename);
  
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: 'File not found' });
  }
});

// Create poll for a room
app.post('/api/chat/rooms/:roomId/polls', verifyToken, (req, res) => {
  const roomId = req.params.roomId;
  const { question, options, multiple_choice = false, expires_in_hours } = req.body;
  const userId = req.user.id;
  const userType = req.user.type;
  
  // Debug log to check what we're receiving
  console.log('Poll creation request:', { question, options, multiple_choice, expires_in_hours });
  
  // Only admins can create polls
  if (userType !== 'admin') {
    return res.status(403).json({ error: 'Only admins can create polls' });
  }
  
  // Validate input
  if (!question || !question.trim()) {
    return res.status(400).json({ error: 'Question is required' });
  }
  
  if (!options || !Array.isArray(options) || options.length < 2) {
    return res.status(400).json({ error: 'At least 2 options are required' });
  }
  
  const validOptions = options.filter(opt => opt && opt.trim());
  if (validOptions.length < 2) {
    return res.status(400).json({ error: 'At least 2 valid options are required' });
  }
  
  // Check if user has access to this room
  db.get("SELECT 1 FROM chat_rooms WHERE id = ?", [roomId], (err, room) => {
    if (err || !room) {
      return res.status(403).json({ error: 'Room not found or access denied' });
    }
    
    // Calculate expiration date
    let expiresAt = null;
    if (expires_in_hours && expires_in_hours > 0) {
      const expirationDate = new Date();
      expirationDate.setHours(expirationDate.getHours() + expires_in_hours);
      expiresAt = expirationDate.toISOString();
    }
    
    // Create the poll message first
    const insertMessageQuery = `
      INSERT INTO chat_messages (room_id, user_id, user_type, message_type, content, created_at)
      VALUES (?, ?, ?, 'poll', ?, datetime('now', '+2 hours'))
    `;
    
    db.run(insertMessageQuery, [roomId, userId, userType, question.trim()], function(err) {
      if (err) {
        console.error('Error creating poll message:', err);
        return res.status(500).json({ error: 'Database error creating poll message' });
      }
      
      const messageId = this.lastID;
      
      // Create the poll entry
      const insertPollQuery = `
        INSERT INTO chat_polls (message_id, question, options, multiple_choice, expires_at)
        VALUES (?, ?, ?, ?, ?)
      `;
      
      // Ensure multiple_choice is converted to proper boolean for SQLite
      const multipleChoiceValue = multiple_choice ? 1 : 0;
      console.log('Saving poll with multiple_choice:', multipleChoiceValue);
      
      db.run(insertPollQuery, [messageId, question.trim(), JSON.stringify(validOptions), multipleChoiceValue, expiresAt], function(err) {
        if (err) {
          console.error('Error creating poll:', err);
          return res.status(500).json({ error: 'Database error creating poll' });
        }
        
        // Get the complete poll data with sender info
        const pollQuery = `
          SELECT m.*, 
                  m.user_id as sender_id,
                  m.user_type as sender_type,
                  CASE 
                    WHEN m.user_type = 'admin' THEN a.display_name
                    ELSE k.name
                  END as sender_name,
                  CASE
                    WHEN m.user_type = 'admin' THEN a.username
                    ELSE k.username  
                  END as sender_username,
                  p.question, p.options, p.expires_at, p.multiple_choice
          FROM chat_messages m
          LEFT JOIN admins a ON m.user_id = a.id AND m.user_type = 'admin'
          LEFT JOIN konfis k ON m.user_id = k.id AND m.user_type = 'konfi'
          LEFT JOIN chat_polls p ON m.id = p.message_id
          WHERE m.id = ?
        `;
        
        db.get(pollQuery, [messageId], (err, pollData) => {
          if (err) {
            console.error('Error fetching created poll:', err);
            return res.status(500).json({ error: 'Database error fetching poll' });
          }
          
          // Parse options back to array safely
          if (pollData.options) {
            try {
              if (typeof pollData.options === 'string') {
                pollData.options = JSON.parse(pollData.options);
              }
            } catch (e) {
              console.error('Error parsing poll options on creation:', e);
              pollData.options = [];
            }
          }
          
          // Convert multiple_choice to boolean
          pollData.multiple_choice = Boolean(pollData.multiple_choice);
          
          // Add empty votes array for new polls
          pollData.votes = [];
          
          res.json(pollData);
        });
      });
    });
  });
});

// Vote on a poll
app.post('/api/chat/polls/:pollId/vote', verifyToken, (req, res) => {
  const pollId = req.params.pollId;
  const { option_index } = req.body;
  const userId = req.user.id;
  const userType = req.user.type;
  
  if (option_index === undefined || option_index === null) {
    return res.status(400).json({ error: 'Option index is required' });
  }
  
  // First, get the poll to check if it exists and get poll details
  const getPollQuery = `
    SELECT p.*, m.room_id FROM chat_polls p
    JOIN chat_messages m ON p.message_id = m.id
    WHERE p.message_id = ?
  `;
  
  db.get(getPollQuery, [pollId], (err, poll) => {
    if (err) {
      console.error('Error fetching poll:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (!poll) {
      return res.status(404).json({ error: 'Poll not found' });
    }
    
    // Check if poll has expired
    if (poll.expires_at && new Date(poll.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Poll has expired' });
    }
    
    // Check if user has access to this room
    const accessQuery = userType === 'admin' ? 
      "SELECT 1 FROM chat_rooms WHERE id = ?" :
      "SELECT 1 FROM chat_participants WHERE room_id = ? AND user_id = ? AND user_type = ?";
    const accessParams = userType === 'admin' ? [poll.room_id] : [poll.room_id, userId, userType];
    
    db.get(accessQuery, accessParams, (err, access) => {
      if (err || !access) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      // Parse options to validate option_index
      const options = JSON.parse(poll.options);
      if (option_index < 0 || option_index >= options.length) {
        return res.status(400).json({ error: 'Invalid option index' });
      }
      
      // Check if this is a single choice poll and user already voted
      if (!poll.multiple_choice) {
        // Remove existing vote for single choice polls
        db.run("DELETE FROM chat_poll_votes WHERE poll_id = ? AND user_id = ? AND user_type = ?",
          [poll.id, userId, userType], (err) => {
            if (err) {
              console.error('Error removing existing vote:', err);
              return res.status(500).json({ error: 'Database error' });
            }
            
            // Add new vote
            insertVote();
          });
      } else {
        // For multiple choice, check if user already voted for this option
        db.get("SELECT 1 FROM chat_poll_votes WHERE poll_id = ? AND user_id = ? AND user_type = ? AND option_index = ?",
          [poll.id, userId, userType, option_index], (err, existingVote) => {
            if (err) {
              console.error('Error checking existing vote:', err);
              return res.status(500).json({ error: 'Database error' });
            }
            
            if (existingVote) {
              // Remove vote (toggle)
              db.run("DELETE FROM chat_poll_votes WHERE poll_id = ? AND user_id = ? AND user_type = ? AND option_index = ?",
                [poll.id, userId, userType, option_index], (err) => {
                  if (err) {
                    console.error('Error removing vote:', err);
                    return res.status(500).json({ error: 'Database error' });
                  }
                  res.json({ message: 'Vote removed successfully' });
                });
            } else {
              // Add new vote
              insertVote();
            }
          });
      }
      
      function insertVote() {
        db.run("INSERT INTO chat_poll_votes (poll_id, user_id, user_type, option_index) VALUES (?, ?, ?, ?)",
          [poll.id, userId, userType, option_index], function(err) {
            if (err) {
              console.error('Error inserting vote:', err);
              return res.status(500).json({ error: 'Database error' });
            }
            res.json({ message: 'Vote recorded successfully' });
          });
      }
    });
  });
});

// Delete chat room
app.delete('/api/chat/rooms/:roomId', verifyToken, (req, res) => {
  const roomId = req.params.roomId;
  const userId = req.user.id;
  const userType = req.user.type;
  
  // First check if room exists and user has permission
  const roomQuery = `
    SELECT cr.*, cp.user_id as participant_user_id, cp.user_type as participant_user_type
    FROM chat_rooms cr
    LEFT JOIN chat_participants cp ON cr.id = cp.room_id 
    WHERE cr.id = ?
  `;
  
  db.all(roomQuery, [roomId], (err, roomData) => {
    if (err) {
      console.error('Error fetching room:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (roomData.length === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }
    
    const room = roomData[0];
    
    // Only allow deletion of direct and group chats, not jahrgang or admin chats
    if (room.type === 'jahrgang' || room.type === 'admin') {
      return res.status(403).json({ error: 'Cannot delete system chats' });
    }
    
    // Check permission: admin can delete anything, user must be participant
    let hasPermission = false;
    if (userType === 'admin') {
      hasPermission = true;
    } else {
      // Check if user is participant
      hasPermission = roomData.some(row => 
        row.participant_user_id === userId && row.participant_user_type === userType
      );
    }
    
    if (!hasPermission) {
      return res.status(403).json({ error: 'Permission denied' });
    }
    
    // Delete room and all associated data
    db.serialize(() => {
      db.run("BEGIN TRANSACTION");
      
      // Delete poll votes
      db.run(`DELETE FROM chat_poll_votes WHERE poll_id IN (
        SELECT p.id FROM chat_polls p 
        JOIN chat_messages m ON p.message_id = m.id 
        WHERE m.room_id = ?
      )`, [roomId]);
      
      // Delete polls
      db.run(`DELETE FROM chat_polls WHERE message_id IN (
        SELECT id FROM chat_messages WHERE room_id = ?
      )`, [roomId]);
      
      // Delete messages
      db.run("DELETE FROM chat_messages WHERE room_id = ?", [roomId]);
      
      // Delete participants
      db.run("DELETE FROM chat_participants WHERE room_id = ?", [roomId]);
      
      // Delete room
      db.run("DELETE FROM chat_rooms WHERE id = ?", [roomId], function(err) {
        if (err) {
          console.error('Error deleting room:', err);
          db.run("ROLLBACK");
          return res.status(500).json({ error: 'Database error' });
        }
        
        db.run("COMMIT", (err) => {
          if (err) {
            console.error('Error committing transaction:', err);
            return res.status(500).json({ error: 'Database error' });
          }
          
          res.json({ message: 'Room deleted successfully' });
        });
      });
    });
  });
});

// Mark room as read
app.post('/api/chat/rooms/:roomId/mark-read', verifyToken, (req, res) => {
  const roomId = req.params.roomId;
  const userId = req.user.id;
  const userType = req.user.type;
  
  // Ensure chat_read_status table exists first
  db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='chat_read_status'", (err, row) => {
    if (err) {
      console.error('Error checking chat_read_status table:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (!row) {
      // Create table if it doesn't exist
      db.run(`CREATE TABLE chat_read_status (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        user_type TEXT NOT NULL CHECK (user_type IN ('admin', 'konfi')),
        last_read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (room_id) REFERENCES chat_rooms (id),
        UNIQUE(room_id, user_id, user_type)
      )`, (createErr) => {
        if (createErr) {
          console.error('Error creating chat_read_status table:', createErr);
          return res.status(500).json({ error: 'Database error' });
        }
        console.log('✅ chat_read_status table created on demand');
        insertReadStatus();
      });
    } else {
      insertReadStatus();
    }
  });
  
  function insertReadStatus() {
    // Update or insert read status
    const query = `
      INSERT OR REPLACE INTO chat_read_status (room_id, user_id, user_type, last_read_at)
      VALUES (?, ?, ?, datetime('now', '+2 hours'))
    `;
    
    db.run(query, [roomId, userId, userType], function(err) {
      if (err) {
        console.error('Error marking room as read:', err);
        console.error('Failed query:', query);
        console.error('Parameters:', [roomId, userId, userType]);
        return res.status(500).json({ error: 'Database error: ' + err.message });
      }
      
      console.log(`✅ Room ${roomId} marked as read for user ${userId} (${userType})`);
      res.json({ message: 'Room marked as read', affected: this.changes });
    });
  }
});

// Get room participants
app.get('/api/chat/rooms/:roomId/participants', verifyToken, (req, res) => {
  const roomId = req.params.roomId;
  const userId = req.user.id;
  const userType = req.user.type;
  
  // Check if user has access to this room
  const accessQuery = userType === 'admin' ? 
    "SELECT 1 FROM chat_rooms WHERE id = ?" :
    "SELECT 1 FROM chat_participants WHERE room_id = ? AND user_id = ? AND user_type = ?";
  const accessParams = userType === 'admin' ? [roomId] : [roomId, userId, userType];
  
  db.get(accessQuery, accessParams, (err, access) => {
    if (err || !access) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Get participants with their details
    const query = `
      SELECT 
        cp.user_id,
        cp.user_type,
        cp.joined_at,
        CASE 
          WHEN cp.user_type = 'admin' THEN a.display_name
          ELSE k.name
        END as name,
        CASE 
          WHEN cp.user_type = 'admin' THEN NULL
          ELSE k.jahrgang_id
        END as jahrgang_id,
        CASE 
          WHEN cp.user_type = 'admin' THEN NULL
          ELSE j.name
        END as jahrgang_name
      FROM chat_participants cp
      LEFT JOIN admins a ON cp.user_type = 'admin' AND cp.user_id = a.id
      LEFT JOIN konfis k ON cp.user_type = 'konfi' AND cp.user_id = k.id
      LEFT JOIN jahrgaenge j ON k.jahrgang_id = j.id
      WHERE cp.room_id = ?
      ORDER BY cp.joined_at ASC
    `;
    
    db.all(query, [roomId], (err, participants) => {
      if (err) {
        console.error('Error fetching participants:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      res.json(participants);
    });
  });
});

// Add participant to room
app.post('/api/chat/rooms/:roomId/participants', verifyToken, (req, res) => {
  const roomId = req.params.roomId;
  const { user_id, user_type } = req.body;
  const requesterId = req.user.id;
  const requesterType = req.user.type;
  
  // Only admins can add participants
  if (requesterType !== 'admin') {
    return res.status(403).json({ error: 'Only admins can add participants' });
  }
  
  // Validate input
  if (!user_id || !user_type) {
    return res.status(400).json({ error: 'user_id and user_type are required' });
  }
  
  if (!['admin', 'konfi'].includes(user_type)) {
    return res.status(400).json({ error: 'Invalid user_type' });
  }
  
  // Check if room exists and is a group chat
  db.get("SELECT type FROM chat_rooms WHERE id = ?", [roomId], (err, room) => {
    if (err || !room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    
    if (room.type !== 'group') {
      return res.status(400).json({ error: 'Can only add participants to group chats' });
    }
    
    // Check if user is already a participant
    db.get("SELECT 1 FROM chat_participants WHERE room_id = ? AND user_id = ? AND user_type = ?", 
      [roomId, user_id, user_type], (err, existing) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }
        
        if (existing) {
          return res.status(409).json({ error: 'User is already a participant' });
        }
        
        // Add participant
        db.run("INSERT INTO chat_participants (room_id, user_id, user_type) VALUES (?, ?, ?)",
          [roomId, user_id, user_type], function(err) {
            if (err) {
              console.error('Error adding participant:', err);
              return res.status(500).json({ error: 'Database error' });
            }
            
            res.json({ message: 'Participant added successfully' });
          });
      });
  });
});

// Remove participant from room
app.delete('/api/chat/rooms/:roomId/participants/:userId/:userType', verifyToken, (req, res) => {
  const roomId = req.params.roomId;
  const userId = parseInt(req.params.userId);
  const userType = req.params.userType;
  const requesterId = req.user.id;
  const requesterType = req.user.type;
  
  // Only admins can remove participants
  if (requesterType !== 'admin') {
    return res.status(403).json({ error: 'Only admins can remove participants' });
  }
  
  // Check if room exists and is a group chat
  db.get("SELECT type FROM chat_rooms WHERE id = ?", [roomId], (err, room) => {
    if (err || !room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    
    if (room.type !== 'group') {
      return res.status(400).json({ error: 'Can only remove participants from group chats' });
    }
    
    // Remove participant
    db.run("DELETE FROM chat_participants WHERE room_id = ? AND user_id = ? AND user_type = ?",
      [roomId, userId, userType], function(err) {
        if (err) {
          console.error('Error removing participant:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        
        if (this.changes === 0) {
          return res.status(404).json({ error: 'Participant not found' });
        }
        
        res.json({ message: 'Participant removed successfully' });
      });
  });
});

// === ENDE CHAT SYSTEM ===

// === RBAC SYSTEM ROUTES ===

// ====================================================================
// ROUTES
// ====================================================================

console.log('🔗 Mounting API routes...');

// --- Import all route modules FIRST ---
const authRoutes = require('./routes/auth');
const konfiRoutes = require('./routes/konfi');
const eventsRoutes = require('./routes/events');
const badgesRoutes = require('./routes/badges'); // Die haben wir gerade erstellt
// const activitiesRoutes = require('./routes/activities'); // Die erstellen wir als nächstes

// RBAC-Protected Routes
const usersRoutes = require('./routes/users');
const rolesRoutes = require('./routes/roles');
const organizationsRoutes = require('./routes/organizations');
const permissionsRoutes = require('./routes/permissions');

// --- Import Middleware ---
const { verifyTokenRBAC, checkPermission } = require('./middleware/rbac');
const rbacVerifier = verifyTokenRBAC(db); // Erstelle die Middleware-Instanz

// --- Health Check (kann hier bleiben) ---
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Konfi Points API is running' });
});

// --- Mount all routers ---

// Public-facing & Konfi-specific routes (nutzen meist das einfache verifyToken)
app.use('/api/auth', authRoutes(db, verifyToken, transporter, SMTP_CONFIG));
app.use('/api/konfi', konfiRoutes(db, verifyToken));
app.use('/api/events', eventsRoutes(db, verifyToken));

// Admin-facing & RBAC-protected routes (nutzen rbacVerifier & checkPermission)
app.use('/api/badges', badgesRoutes(db, rbacVerifier, checkPermission));
// app.use('/api/activities', activitiesRoutes(db, rbacVerifier, checkPermission, badgesRoutes.checkAndAwardBadges)); // Beispiel für später

app.use('/api/users', usersRoutes(db, rbacVerifier, checkPermission));
app.use('/api/roles', rolesRoutes(db, rbacVerifier, checkPermission));
app.use('/api/organizations', organizationsRoutes(db, rbacVerifier, checkPermission));
app.use('/api/permissions', permissionsRoutes(db, rbacVerifier, checkPermission));

// ====================================================================
// END OF ROUTES
// ====================================================================