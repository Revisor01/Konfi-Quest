// server.js
console.log('🚀 Starting Konfi Points API...');
console.log('Node version:', process.version);
console.log('Platform:', process.platform);

const express = require('express');
console.log('✅ Express loaded');

const cors = require('cors');
console.log('✅ CORS loaded');

const bcrypt = require('bcrypt');
console.log('✅ bcrypt loaded');

const jwt = require('jsonwebtoken');
console.log('✅ JWT loaded');

console.log('📊 Loading SQLite3...');
const sqlite3 = require('sqlite3').verbose();
console.log('✅ SQLite3 loaded');

const path = require('path');
const fs = require('fs');
console.log('✅ Core modules loaded');

console.log('📁 Loading Multer...');
const multer = require('multer');
console.log('✅ Multer loaded');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'konfi-secret-2025';

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

// Bible books for password generation
const BIBLE_BOOKS = [
  'Genesis', 'Exodus', 'Levitikus', 'Numeri', 'Deuteronomium',
  'Josua', 'Richter', 'Ruth', 'Samuel', 'Koenige', 'Chronik',
  'Esra', 'Nehemia', 'Ester', 'Hiob', 'Psalmen', 'Sprueche',
  'Prediger', 'Hohelied', 'Jesaja', 'Jeremia', 'Klagelieder',
  'Hesekiel', 'Daniel', 'Hosea', 'Joel', 'Amos', 'Obadja',
  'Jona', 'Micha', 'Nahum', 'Habakuk', 'Zephanja', 'Haggai',
  'Sacharja', 'Maleachi', 'Matthaeus', 'Markus', 'Lukas',
  'Johannes', 'Apostelgeschichte', 'Roemer', 'Korinther',
  'Galater', 'Epheser', 'Philipper', 'Kolosser', 'Thessalonicher',
  'Timotheus', 'Titus', 'Philemon', 'Hebraeer', 'Jakobus',
  'Petrus', 'Johannes', 'Judas', 'Offenbarung'
];

// Badge criteria types
const CRITERIA_TYPES = {
  // === PUNKTE-BASIERTE KRITERIEN (Einfach & häufig verwendet) ===
  total_points: { 
    label: "🎯 Gesamtpunkte", 
    description: "Mindestanzahl aller Punkte",
    help: "Badge wird vergeben, wenn die Summe aus Gottesdienst- und Gemeindepunkten erreicht wird. Beispiel: Wert 20 = mindestens 20 Punkte insgesamt."
  },
  gottesdienst_points: { 
    label: "📖 Gottesdienst-Punkte", 
    description: "Mindestanzahl gottesdienstlicher Punkte",
    help: "Badge wird vergeben, wenn die angegebene Anzahl gottesdienstlicher Punkte erreicht wird. Beispiel: Wert 10 = mindestens 10 Gottesdienst-Punkte."
  },
  gemeinde_points: { 
    label: "🤝 Gemeinde-Punkte", 
    description: "Mindestanzahl gemeindlicher Punkte",
    help: "Badge wird vergeben, wenn die angegebene Anzahl gemeindlicher Punkte erreicht wird. Beispiel: Wert 15 = mindestens 15 Gemeinde-Punkte."
  },
  both_categories: { 
    label: "⚖️ Beide Kategorien", 
    description: "Mindestpunkte in beiden Bereichen",
    help: "Badge wird vergeben, wenn sowohl bei Gottesdienst- als auch bei Gemeindepunkten der Mindestwert erreicht wird. Beispiel: Wert 5 = mindestens 5 Gottesdienst-Punkte UND 5 Gemeinde-Punkte."
  },
  
  // === AKTIVITÄTS-BASIERTE KRITERIEN (Mittlere Komplexität) ===
  activity_count: { 
    label: "📊 Aktivitäten-Anzahl", 
    description: "Gesamtanzahl aller Aktivitäten",
    help: "Badge wird vergeben, wenn die angegebene Anzahl von Aktivitäten absolviert wurde (egal welche). Beispiel: Wert 5 = mindestens 5 Aktivitäten."
  },
  unique_activities: { 
    label: "🌟 Verschiedene Aktivitäten", 
    description: "Anzahl unterschiedlicher Aktivitäten",
    help: "Badge wird vergeben, wenn die angegebene Anzahl verschiedener Aktivitäten absolviert wurde. Mehrfache Teilnahme an derselben Aktivität zählt nur einmal. Beispiel: Wert 3 = 3 verschiedene Aktivitäten."
  },
  
  // === SPEZIFISCHE AKTIVITÄTS-KRITERIEN (Spezifischer) ===
  specific_activity: { 
    label: "🎯 Spezifische Aktivität", 
    description: "Bestimmte Aktivität X-mal absolviert",
    help: "Badge wird vergeben, wenn eine bestimmte Aktivität die angegebene Anzahl mal absolviert wurde. Beispiel: Wert 5 + 'Sonntagsgottesdienst' = 5x am Sonntagsgottesdienst teilgenommen."
  },
  category_activities: { 
    label: "🏷️ Kategorie-Aktivitäten", 
    description: "Aktivitäten aus bestimmter Kategorie",
    help: "Badge wird vergeben, wenn die angegebene Anzahl von Aktivitäten aus einer bestimmten Kategorie absolviert wurde. Beispiel: Wert 3 + Kategorie 'sonntagsgottesdienst' = 3 Sonntagsgottesdienste."
  },
  activity_combination: { 
    label: "🎭 Aktivitäts-Kombination", 
    description: "Spezifische Kombination von Aktivitäten",
    help: "Badge wird vergeben, wenn alle ausgewählten Aktivitäten mindestens einmal absolviert wurden. Der Wert gibt die Mindestanzahl an benötigten Aktivitäten aus der Liste an."
  },
  
  // === ZEIT-BASIERTE KRITERIEN (Komplex) ===
  time_based: { 
    label: "⏰ Zeitbasiert", 
    description: "Aktivitäten in einem Zeitraum",
    help: "Badge wird vergeben, wenn die angegebene Anzahl von Aktivitäten innerhalb der festgelegten Tage absolviert wurde. Beispiel: Wert 3 + 7 Tage = 3 Aktivitäten in einer Woche."
  },
  streak: { 
    label: "🔥 Serie", 
    description: "Aufeinanderfolgende Aktivitäten",
    help: "Badge wird vergeben, wenn in der angegebenen Anzahl aufeinanderfolgender Wochen mindestens eine Aktivität absolviert wurde. Beispiel: Wert 4 = 4 Wochen in Folge aktiv."
  },
  
  // === SPEZIAL-KRITERIEN (Selten verwendet) ===
  bonus_points: { 
    label: "💰 Bonuspunkte", 
    description: "Anzahl erhaltener Bonuspunkte",
    help: "Badge wird vergeben, wenn die angegebene Anzahl von Bonuspunkt-Einträgen erhalten wurde (unabhängig von der Höhe der Bonuspunkte). Beispiel: Wert 2 = mindestens 2 Bonuspunkt-Vergaben."
  }
};

const checkAndAwardBadges = async (konfiId) => {
  return new Promise((resolve, reject) => {
    // Get all active badges
    db.all("SELECT * FROM custom_badges WHERE is_active = 1", [], (err, badges) => {
      if (err) return reject(err);
      
      // Get konfi data
      db.get("SELECT * FROM konfis WHERE id = ?", [konfiId], (err, konfi) => {
        if (err) return reject(err);
        if (!konfi) return resolve(0);
        
        let newBadges = 0;
        const earnedBadgeIds = [];
        
        // Get already earned badges
        db.all("SELECT badge_id FROM konfi_badges WHERE konfi_id = ?", [konfiId], (err, earned) => {
          if (err) return reject(err);
          
          const alreadyEarned = earned.map(e => e.badge_id);
          let badgesProcessed = 0;
          
          if (badges.length === 0) {
            return resolve(0);
          }
          
          badges.forEach(badge => {
            if (alreadyEarned.includes(badge.id)) {
              badgesProcessed++;
              if (badgesProcessed === badges.length) {
                finalizeBadges();
              }
              return;
            }
            
            let earned = false;
            const criteria = JSON.parse(badge.criteria_extra || '{}');
            
            switch (badge.criteria_type) {
              case 'total_points':
                earned = (konfi.gottesdienst_points + konfi.gemeinde_points) >= badge.criteria_value;
                processBadgeResult();
                break;
              
              case 'gottesdienst_points':
                earned = konfi.gottesdienst_points >= badge.criteria_value;
                processBadgeResult();
                break;
              
              case 'gemeinde_points':
                earned = konfi.gemeinde_points >= badge.criteria_value;
                processBadgeResult();
                break;
              
              case 'specific_activity':
                if (criteria.required_activity_name) {
                  // Separate query to count specific activity occurrences
                  const countQuery = `
                    SELECT COUNT(*) as count 
                    FROM konfi_activities ka 
                    JOIN activities a ON ka.activity_id = a.id 
                    WHERE ka.konfi_id = ? AND a.name = ?
                  `;
                  db.get(countQuery, [konfiId, criteria.required_activity_name], (err, result) => {
                    if (err) {
                      console.error('Specific activity badge check error:', err);
                      earned = false;
                    } else {
                      earned = result && result.count >= badge.criteria_value;
                    }
                    processBadgeResult();
                  });
                } else {
                  processBadgeResult();
                }
                break;
              
              case 'both_categories':
                earned = konfi.gottesdienst_points >= badge.criteria_value && 
                konfi.gemeinde_points >= badge.criteria_value;
                processBadgeResult();
                break;
              
              case 'activity_combination':
                if (criteria.required_activities) {
                  // Check if all required activities have been completed at least once
                  const combinationQuery = `
                    SELECT DISTINCT a.name 
                    FROM konfi_activities ka 
                    JOIN activities a ON ka.activity_id = a.id 
                    WHERE ka.konfi_id = ?
                  `;
                  db.all(combinationQuery, [konfiId], (err, results) => {
                    if (err) {
                      console.error('Activity combination badge check error:', err);
                      earned = false;
                    } else {
                      const completedActivities = results.map(r => r.name);
                      earned = criteria.required_activities.every(req => 
                        completedActivities.includes(req)
                      );
                    }
                    processBadgeResult();
                  });
                } else {
                  processBadgeResult();
                }
                break;
              
              case 'category_activities':
                if (criteria.required_category) {
                  const categoryCountQuery = `
                    SELECT COUNT(*) as count FROM konfi_activities ka 
                    JOIN activities a ON ka.activity_id = a.id 
                    WHERE ka.konfi_id = ? AND (
                      a.category = ? OR 
                      a.category LIKE ? OR 
                      a.category LIKE ? OR 
                      a.category LIKE ?
                    )
                  `;
                  
                  const category = criteria.required_category;
                  const params = [
                    konfiId, 
                    category,                    // genau diese Kategorie
                    `${category},%`,            // am Anfang
                    `%,${category}`,            // am Ende  
                    `%,${category},%`           // in der Mitte
                  ];
                  
                  db.get(categoryCountQuery, params, (err, result) => {
                    if (err) {
                      console.error('Category badge check error:', err);
                      earned = false;
                    } else {
                      earned = result && result.count >= badge.criteria_value;
                    }
                    processBadgeResult();
                  });
                } else {
                  processBadgeResult();
                }
                break;
              
              case 'time_based':
                if (criteria.days) {
                  const timeQuery = `
                    SELECT completed_date FROM konfi_activities 
                    WHERE konfi_id = ? 
                    ORDER BY completed_date DESC
                  `;
                  db.all(timeQuery, [konfiId], (err, results) => {
                    if (err) {
                      console.error('Time based badge check error:', err);
                      earned = false;
                    } else {
                      const now = new Date();
                      const cutoff = new Date(now.getTime() - (criteria.days * 24 * 60 * 60 * 1000));
                      
                      const recentCount = results.filter(r => {
                        const date = new Date(r.completed_date);
                        return date >= cutoff;
                      }).length;
                      
                      earned = recentCount >= badge.criteria_value;
                    }
                    processBadgeResult();
                  });
                } else {
                  processBadgeResult();
                }
                break;
              
              case 'activity_count':
                db.get("SELECT COUNT(*) as count FROM konfi_activities WHERE konfi_id = ?", 
                  [konfiId], (err, result) => {
                    if (err) {
                      console.error('Activity count badge check error:', err);
                      earned = false;
                    } else {
                      earned = result && result.count >= badge.criteria_value;
                    }
                    processBadgeResult();
                  });
                break;
              
              case 'bonus_points':
                db.get("SELECT COUNT(*) as count FROM bonus_points WHERE konfi_id = ?", 
                  [konfiId], (err, result) => {
                    if (err) {
                      console.error('Bonus points badge check error:', err);
                      earned = false;
                    } else {
                      earned = result && result.count >= badge.criteria_value;
                    }
                    processBadgeResult();
                  });
                break;
              
              case 'streak':
                const streakQuery = `
                  SELECT completed_date FROM konfi_activities 
                  WHERE konfi_id = ? 
                  ORDER BY completed_date DESC
                `;
                db.all(streakQuery, [konfiId], (err, results) => {
                  if (err) {
                    console.error('Streak badge check error:', err);
                    earned = false;
                  } else {
                    // Hilfsfunktion: Kalenderwoche berechnen
                    function getYearWeek(date) {
                      const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
                      const dayNum = d.getUTCDay() || 7;
                      d.setUTCDate(d.getUTCDate() + 4 - dayNum);
                      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
                      const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
                      return `${d.getUTCFullYear()}-W${weekNo.toString().padStart(2, '0')}`;
                    }
                    
                    // Aktivitätsdaten in Set einzigartiger Wochen umwandeln
                    const activityWeeks = new Set(
                      results
                      .map(r => getYearWeek(new Date(r.completed_date)))
                      .filter(week => week && !week.includes('NaN'))
                    );
                    
                    // Sortiere Wochen chronologisch (neueste zuerst)
                    const sortedWeeks = Array.from(activityWeeks).sort().reverse();
                    
                    let currentStreak = 0;
                    
                    // Finde den längsten Streak vom neuesten Datum aus
                    if (sortedWeeks.length > 0) {
                      currentStreak = 1; // Erste Woche zählt immer
                      
                      // Prüfe aufeinanderfolgende Wochen rückwärts
                      for (let i = 0; i < sortedWeeks.length - 1; i++) {
                        const thisWeek = sortedWeeks[i];
                        const nextWeek = sortedWeeks[i + 1];
                        
                        // Berechne die erwartete vorherige Woche
                        const [year, week] = thisWeek.split('-W').map(Number);
                        let expectedYear = year;
                        let expectedWeek = week - 1;
                        
                        if (expectedWeek === 0) {
                          expectedYear -= 1;
                          expectedWeek = 52; // Vereinfacht, könnte 53 sein
                        }
                        
                        const expectedWeekStr = `${expectedYear}-W${expectedWeek.toString().padStart(2, '0')}`;
                        
                        if (nextWeek === expectedWeekStr) {
                          currentStreak++;
                        } else {
                          break; // Streak unterbrochen
                        }
                      }
                    }
                    
                    earned = currentStreak >= badge.criteria_value;
                  }
                  processBadgeResult();
                });
                break;
              
              case 'unique_activities':
                db.all("SELECT DISTINCT activity_id FROM konfi_activities WHERE konfi_id = ?", 
                  [konfiId], (err, results) => {
                    if (err) {
                      console.error('Unique activities badge check error:', err);
                      earned = false;
                    } else {
                      earned = results.length >= badge.criteria_value;
                    }
                    processBadgeResult();
                  });
                break;
              
              default:
                processBadgeResult();
                break;
            }
            
            function processBadgeResult() {
              if (earned) {
                earnedBadgeIds.push(badge.id);
                newBadges++;
              }
              badgesProcessed++;
              if (badgesProcessed === badges.length) {
                finalizeBadges();
              }
            }
          });
          
          function finalizeBadges() {
            // Award new badges
            if (earnedBadgeIds.length > 0) {
              const insertPromises = earnedBadgeIds.map(badgeId => {
                return new Promise((resolve, reject) => {
                  db.run("INSERT INTO konfi_badges (konfi_id, badge_id) VALUES (?, ?)", 
                    [konfiId, badgeId], function(err) {
                      if (err) reject(err);
                      else resolve();
                    });
                });
              });
              
              Promise.all(insertPromises)
              .then(() => resolve(newBadges))
              .catch(reject);
            } else {
              resolve(newBadges);
            }
          }
        });
      });
    });
  });
};

// Update the badge criteria types endpoint
app.get('/api/badge-criteria-types', verifyToken, (req, res) => {
  res.json(CRITERIA_TYPES); 
});

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

// Function to generate biblical password
function generateBiblicalPassword() {
  const book = BIBLE_BOOKS[Math.floor(Math.random() * BIBLE_BOOKS.length)];
  const chapter = Math.floor(Math.random() * 50) + 1; // 1-50
  const verse = Math.floor(Math.random() * 30) + 1; // 1-30
  return `${book}${chapter},${verse}`;
}

// Create data directory if it doesn't exist
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// SQLite Database Setup
const dbPath = path.join(__dirname, 'data', 'konfi.db');
const dbExists = fs.existsSync(dbPath);

if (!dbExists) {
  console.log('📊 Creating new database...');
} else {
  console.log('📊 Using existing database...');
}

const db = new sqlite3.Database(dbPath);

// Initialize Database with correct schema
db.serialize(() => {
  // Admins table
  db.run(`CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Jahrgänge table
  db.run(`CREATE TABLE IF NOT EXISTS jahrgaenge (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    confirmation_date DATE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Konfis table
  db.run(`CREATE TABLE IF NOT EXISTS konfis (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    jahrgang_id INTEGER,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    password_plain TEXT NOT NULL,
    gottesdienst_points INTEGER DEFAULT 0,
    gemeinde_points INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (jahrgang_id) REFERENCES jahrgaenge (id)
  )`);

  // Activities table
  db.run(`CREATE TABLE IF NOT EXISTS activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    points INTEGER NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('gottesdienst', 'gemeinde')),
    category TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Konfi Activities
  db.run(`CREATE TABLE IF NOT EXISTS konfi_activities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    konfi_id INTEGER,
    activity_id INTEGER,
    admin_id INTEGER,
    completed_date DATE DEFAULT CURRENT_DATE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (konfi_id) REFERENCES konfis (id),
    FOREIGN KEY (activity_id) REFERENCES activities (id),
    FOREIGN KEY (admin_id) REFERENCES admins (id)
  )`);

  // Bonus Points
  db.run(`CREATE TABLE IF NOT EXISTS bonus_points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    konfi_id INTEGER,
    points INTEGER NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('gottesdienst', 'gemeinde')),
    description TEXT NOT NULL,
    admin_id INTEGER,
    completed_date DATE DEFAULT CURRENT_DATE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (konfi_id) REFERENCES konfis (id),
    FOREIGN KEY (admin_id) REFERENCES admins (id)
  )`);

  // Settings table
  db.run(`CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  )`);

  // Badge system tables
  db.run(`CREATE TABLE IF NOT EXISTS custom_badges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    icon TEXT NOT NULL,
    description TEXT,
    criteria_type TEXT NOT NULL,
    criteria_value INTEGER,
    criteria_extra TEXT,
    is_active BOOLEAN DEFAULT 1,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES admins (id)
  )`);
  
  db.run(`CREATE TABLE IF NOT EXISTS konfi_badges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    konfi_id INTEGER,
    badge_id INTEGER,
    earned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (konfi_id) REFERENCES konfis (id),
    FOREIGN KEY (badge_id) REFERENCES custom_badges (id)
  )`);
  
  db.run(`CREATE TABLE IF NOT EXISTS activity_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    konfi_id INTEGER,
    activity_id INTEGER,
    requested_date DATE,
    comment TEXT,
    photo_filename TEXT,
    status TEXT DEFAULT 'pending',
    admin_comment TEXT,
    approved_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (konfi_id) REFERENCES konfis (id),
    FOREIGN KEY (activity_id) REFERENCES activities (id),
    FOREIGN KEY (approved_by) REFERENCES admins (id)
  )`);

  // Chat system tables
  db.run(`CREATE TABLE IF NOT EXISTS chat_rooms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('jahrgang', 'admin', 'direct')),
  jahrgang_id INTEGER,
  created_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (jahrgang_id) REFERENCES jahrgaenge (id),
  FOREIGN KEY (created_by) REFERENCES admins (id)
)`);
  
  db.run(`CREATE TABLE IF NOT EXISTS chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  user_type TEXT NOT NULL CHECK (user_type IN ('admin', 'konfi')),
  message_type TEXT NOT NULL CHECK (message_type IN ('text', 'image', 'file', 'video', 'poll', 'system')),
  content TEXT,
  file_path TEXT,
  file_name TEXT,
  file_size INTEGER,
  reply_to INTEGER,
  edited_at DATETIME,
  deleted_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (room_id) REFERENCES chat_rooms (id),
  FOREIGN KEY (reply_to) REFERENCES chat_messages (id)
)`);
  
  db.run(`CREATE TABLE IF NOT EXISTS chat_participants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  user_type TEXT NOT NULL CHECK (user_type IN ('admin', 'konfi')),
  last_read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (room_id) REFERENCES chat_rooms (id)
)`);
  
  db.run(`CREATE TABLE IF NOT EXISTS chat_polls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id INTEGER NOT NULL,
  question TEXT NOT NULL,
  options TEXT NOT NULL, -- JSON array
  multiple_choice BOOLEAN DEFAULT 0,
  expires_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (message_id) REFERENCES chat_messages (id)
)`);
  
  db.run(`CREATE TABLE IF NOT EXISTS chat_poll_votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  poll_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  user_type TEXT NOT NULL CHECK (user_type IN ('admin', 'konfi')),
  option_index INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (poll_id) REFERENCES chat_polls (id),
  UNIQUE(poll_id, user_id, user_type, option_index)
)`);
  
  console.log('✅ Database schema ensured');
  
  // === DATABASE MIGRATIONS ===
  console.log('🔄 Running database migrations...');
  
  // Migration 1: Add confirmation_date to jahrgaenge table
  db.all("PRAGMA table_info(jahrgaenge)", (err, columns) => {
    if (err) {
      console.error('Migration check error:', err);
    } else {
      const hasConfirmationDate = columns.some(col => col.name === 'confirmation_date');
      
      if (!hasConfirmationDate) {
        console.log('⚡ Migration 1: Adding confirmation_date column to jahrgaenge table...');
        db.run("ALTER TABLE jahrgaenge ADD COLUMN confirmation_date DATE", (err) => {
          if (err) {
            console.error('Migration 1 error:', err);
          } else {
            console.log('✅ Migration 1: confirmation_date column added');
            
            // Set default dates for existing jahrgänge
            db.run(`UPDATE jahrgaenge SET confirmation_date = 
                  CASE 
                    WHEN name LIKE '%2024%' THEN '2025-05-11'
                    WHEN name LIKE '%2025%' THEN '2026-05-10'  
                    WHEN name LIKE '%2026%' THEN '2027-05-09'
                    WHEN name LIKE '%2027%' THEN '2028-05-14'
                    ELSE NULL 
                  END 
                  WHERE confirmation_date IS NULL`, (err) => {
                if (err) {
                  console.error('Default dates error:', err);
                } else {
                  console.log('✅ Migration 1: Default confirmation dates set');
                }
              });
          }
        });
      } else {
        console.log('✅ Migration 1: confirmation_date column already exists');
      }
    }
  });
  
  // Migration 2: Add is_special to activities table (if not exists)
  db.all("PRAGMA table_info(activities)", (err, columns) => {
    if (err) {
      console.error('Migration 2 check error:', err);
    } else {
      const hasIsSpecial = columns.some(col => col.name === 'is_special');
      
      if (!hasIsSpecial) {
        console.log('⚡ Migration 2: Adding is_special column to activities table...');
        db.run("ALTER TABLE activities ADD COLUMN is_special BOOLEAN DEFAULT 0", (err) => {
          if (err) {
            console.error('Migration 2 error:', err);
          } else {
            console.log('✅ Migration 2: is_special column added');
          }
        });
      } else {
        console.log('✅ Migration 2: is_special column already exists');
      }
    }
  });
  
  console.log('✅ Database migrations completed');
  
  // Migration 3: Add is_hidden to custom_badges table
  db.all("PRAGMA table_info(custom_badges)", (err, columns) => {
    if (err) {
      console.error('Migration 3 check error:', err);
    } else {
      const hasIsHidden = columns.some(col => col.name === 'is_hidden');
      
      if (!hasIsHidden) {
        console.log('⚡ Migration 3: Adding is_hidden column to custom_badges table...');
        db.run("ALTER TABLE custom_badges ADD COLUMN is_hidden BOOLEAN DEFAULT 0", (err) => {
          if (err) {
            console.error('Migration 3 error:', err);
          } else {
            console.log('✅ Migration 3: is_hidden column added');
          }
        });
      } else {
        console.log('✅ Migration 3: is_hidden column already exists');
      }
    }
  });
  
  // Migration 4: Add category column to activities table
  db.all("PRAGMA table_info(activities)", (err, columns) => {
    if (err) {
      console.error('Migration 4 check error:', err);
    } else {
      const hasCategory = columns.some(col => col.name === 'category');
      
      if (!hasCategory) {
        console.log('⚡ Migration 4: Adding category column to activities table...');
        db.run("ALTER TABLE activities ADD COLUMN category TEXT", (err) => {
          if (err) {
            console.error('Migration 4 error:', err);
          } else {
            console.log('✅ Migration 4: category column added');
          }
        });
      } else {
        console.log('✅ Migration 4: category column already exists');
      }
    }
  });
  
  // Only insert default data for new database
  if (!dbExists) {
    console.log('📝 Inserting default data...');
    
    // Insert default admin
    const adminPassword = bcrypt.hashSync('pastor2025', 10);
    db.run("INSERT INTO admins (username, display_name, password_hash) VALUES (?, ?, ?)", 
      ['admin', 'Pastor Administrator', adminPassword]);
    console.log('✅ Default admin created: username=admin, password=pastor2025');
    
    // Insert default settings
    db.run("INSERT INTO settings (key, value) VALUES (?, ?)", ['target_gottesdienst', '10']);
    db.run("INSERT INTO settings (key, value) VALUES (?, ?)", ['target_gemeinde', '10']);
    console.log('✅ Default settings created');
    
    // Insert default jahrgänge WITH confirmation dates
    const defaultJahrgaenge = [
      ['2024/25', '2025-05-11'],
      ['2025/26', '2026-05-10'], 
      ['2026/27', '2027-05-09']
    ];
    defaultJahrgaenge.forEach(([name, confirmationDate]) => {
      db.run("INSERT INTO jahrgaenge (name, confirmation_date) VALUES (?, ?)", [name, confirmationDate]);
    });
    console.log('✅ Default Jahrgänge created with confirmation dates');
    
    // Insert default activities
    const defaultActivities = [
      ['Sonntagsgottesdienst', 2, 'gottesdienst', 'sonntagsgottesdienst'],
      ['Kindergottesdienst helfen', 3, 'gemeinde', 'kindergottesdienst'],
      ['Jugendgottesdienst', 3, 'gottesdienst', 'jugendgottesdienst'],
      ['Gemeindefest helfen', 4, 'gemeinde', 'gemeindefest'],
      ['Konfistunde', 1, 'gottesdienst', 'konfistunde'],
      ['Besuchsdienst', 5, 'gemeinde', 'besuchsdienst'],
      ['Friedhofspflege', 3, 'gemeinde', 'friedhofspflege'],
      ['Taizé-Gottesdienst', 2, 'gottesdienst', 'taize'],
      ['Weihnachtsfeier helfen', 4, 'gemeinde', 'weihnachtsfeier'],
      ['Ostergottesdienst', 2, 'gottesdienst', 'ostergottesdienst']
    ];
    
    defaultActivities.forEach(([name, points, type, category]) => {
      db.run("INSERT INTO activities (name, points, type, category) VALUES (?, ?, ?, ?)", [name, points, type, category]);
    });
    console.log('✅ Default activities created');
    
    // Insert default badges
    const defaultBadges = [
      ['Starter', '🥉', 'Erste 5 Punkte gesammelt', 'total_points', 5, null, 1, 0],
      ['Sammler', '🥈', 'Erste 10 Punkte gesammelt', 'total_points', 10, null, 1, 0],
      ['Zielerreichung', '🥇', 'Erste 20 Punkte erreicht', 'total_points', 20, null, 1, 0],
      ['Gottesdienstgänger', '📖', '10 gottesdienstliche Punkte', 'gottesdienst_points', 10, null, 1, 0],
      ['Gemeindeheld', '🤝', '10 gemeindliche Punkte', 'gemeinde_points', 10, null, 1, 0],
      ['Ausgewogen', '⚖️', 'Beide Kategorien >= 10 Punkte', 'both_categories', 10, null, 1, 0],
      ['All-Rounder', '🏆', 'Sonntagsgottesdienst + Gemeindefest + Kindergottesdienst', 'activity_combination', 3, JSON.stringify({required_activities: ['Sonntagsgottesdienst', 'Gemeindefest helfen', 'Kindergottesdienst helfen']}), 1, 1],
      ['Profi-Kirchgänger', '⭐', 'Sonntagsgottesdienst + Taizé + Jugendgottesdienst', 'activity_combination', 3, JSON.stringify({required_activities: ['Sonntagsgottesdienst', 'Taizé-Gottesdienst', 'Jugendgottesdienst']}), 1, 1],
      ['Wochenend-Warrior', '🔥', '3 Aktivitäten in 7 Tagen', 'time_based', 3, JSON.stringify({days: 7}), 1, 1],
      ['Aktivist', '⚡', '5 verschiedene Aktivitäten', 'unique_activities', 5, null, 1, 0],
      ['Geheime Leistung', '🎭', 'Erreiche 25 Punkte in beiden Kategorien', 'both_categories', 25, null, 1, 1]
    ];
    
    defaultBadges.forEach(([name, icon, description, criteria_type, criteria_value, criteria_extra, is_active, is_hidden]) => {
      db.run("INSERT INTO custom_badges (name, icon, description, criteria_type, criteria_value, criteria_extra, is_active, is_hidden, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", 
        [name, icon, description, criteria_type, criteria_value, criteria_extra, is_active, is_hidden, 1]);
    });
    console.log('✅ Default badges created');
    
    // Create some default konfis after jahrgänge are created
    setTimeout(() => {
      const defaultKonfis = [
        ['Anna Mueller', '2025/26'],
        ['Max Schmidt', '2025/26'],
        ['Lisa Weber', '2024/25'],
        ['Tom Hansen', '2025/26'],
        ['Sarah Klein', '2024/25']
      ];
      
      defaultKonfis.forEach(([name, jahrgang]) => {
        // Get jahrgang ID
        db.get("SELECT id FROM jahrgaenge WHERE name = ?", [jahrgang], (err, jahrgangRow) => {
          if (jahrgangRow) {
            const password = generateBiblicalPassword();
            const hashedPassword = bcrypt.hashSync(password, 10);
            const username = name.toLowerCase().replace(' ', '.');
            
            db.run("INSERT INTO konfis (name, jahrgang_id, username, password_hash, password_plain) VALUES (?, ?, ?, ?, ?)", 
              [name, jahrgangRow.id, username, hashedPassword, password], function(err) {
                if (!err) {
                  console.log(`✅ Konfi created: ${name} - Username: ${username} - Password: ${password}`);
                }
              });
          }
        });
      });
    }, 1000);
  } else {
    console.log('✅ Existing database loaded');
  }
});

// Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Konfi Points API is running' });
});

// Admin login
app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  
  db.get("SELECT * FROM admins WHERE username = ?", [username], (err, admin) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign({ id: admin.id, type: 'admin', display_name: admin.display_name }, JWT_SECRET, { expiresIn: '14d' });
    res.json({ token, user: { id: admin.id, username: admin.username, display_name: admin.display_name, type: 'admin' } });
  });
});

// Konfi login
app.post('/api/konfi/login', (req, res) => {
  const { username, password } = req.body;
  
  db.get("SELECT k.*, j.name as jahrgang_name FROM konfis k JOIN jahrgaenge j ON k.jahrgang_id = j.id WHERE k.username = ?", [username], (err, konfi) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (!konfi || !bcrypt.compareSync(password, konfi.password_hash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const token = jwt.sign({ id: konfi.id, type: 'konfi' }, JWT_SECRET, { expiresIn: '24h' });
    res.json({ 
      token, 
      user: { 
        id: konfi.id, 
        name: konfi.name, 
        username: konfi.username,
        jahrgang: konfi.jahrgang_name,
        type: 'konfi' 
      } 
    });
  });
});

// === BADGE MANAGEMENT ===

// KORRIGIERTE VERSION - Badge-Zählung in server.js
app.get('/api/badges', verifyToken, (req, res) => {
  if (req.user.type !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  const badgeQuery = `
    SELECT cb.*, 
            a.display_name as created_by_name,
            COALESCE(badge_counts.earned_count, 0) as earned_count
    FROM custom_badges cb 
    LEFT JOIN admins a ON cb.created_by = a.id
    LEFT JOIN (
      SELECT badge_id, COUNT(*) as earned_count 
      FROM konfi_badges 
      GROUP BY badge_id
    ) badge_counts ON cb.id = badge_counts.badge_id
    ORDER BY cb.created_at DESC
  `;
  
  db.all(badgeQuery, [], (err, rows) => {
    if (err) {
      console.error('Error fetching badges:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    console.log('Badge results:', rows); // Debug-Log
    res.json(rows);
  });
});

// Get badge criteria types
app.get('/api/badge-criteria-types', verifyToken, (req, res) => {
  res.json(CRITERIA_TYPES);
});

// Get activity categories for badges
app.get('/api/activity-categories', verifyToken, (req, res) => {
  db.all("SELECT DISTINCT category FROM activities WHERE category IS NOT NULL AND category != '' ORDER BY category", [], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    const categories = rows.map(row => row.category);
    res.json(categories);
  });
});

// Create badge (admin only)
app.post('/api/badges', verifyToken, (req, res) => {
  if (req.user.type !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  const { name, icon, description, criteria_type, criteria_value, criteria_extra, is_hidden } = req.body;
  
  if (!name || !icon || !criteria_type || !criteria_value) {
    return res.status(400).json({ error: 'Name, icon, criteria type and value are required' });
  }
  
  const extraJson = criteria_extra ? JSON.stringify(criteria_extra) : null;
  const hiddenFlag = is_hidden ? 1 : 0; // BOOLEAN ZU INTEGER
  
  db.run("INSERT INTO custom_badges (name, icon, description, criteria_type, criteria_value, criteria_extra, is_hidden, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
    [name, icon, description, criteria_type, criteria_value, extraJson, hiddenFlag, req.user.id],
    function(err) {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json({ id: this.lastID, name, icon, description, criteria_type, criteria_value, criteria_extra: extraJson, is_hidden: hiddenFlag });
    });
});

// Update badge (admin only) - BOOLEAN FIX
app.put('/api/badges/:id', verifyToken, (req, res) => {
  if (req.user.type !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  const { name, icon, description, criteria_type, criteria_value, criteria_extra, is_active, is_hidden } = req.body;
  
  const extraJson = criteria_extra ? JSON.stringify(criteria_extra) : null;
  const activeFlag = is_active ? 1 : 0; // BOOLEAN ZU INTEGER
  const hiddenFlag = is_hidden ? 1 : 0; // BOOLEAN ZU INTEGER
  
  db.run("UPDATE custom_badges SET name = ?, icon = ?, description = ?, criteria_type = ?, criteria_value = ?, criteria_extra = ?, is_active = ?, is_hidden = ? WHERE id = ?",
    [name, icon, description, criteria_type, criteria_value, extraJson, activeFlag, hiddenFlag, req.params.id],
    function(err) {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json({ message: 'Badge updated successfully' });
    });
});

// Delete badge (admin only)
app.delete('/api/badges/:id', verifyToken, (req, res) => {
  if (req.user.type !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  db.run("DELETE FROM konfi_badges WHERE badge_id = ?", [req.params.id], (err) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    db.run("DELETE FROM custom_badges WHERE id = ?", [req.params.id], function(err) {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json({ message: 'Badge deleted successfully' });
    });
  });
});

// Get konfi badges
app.get('/api/konfis/:id/badges', verifyToken, (req, res) => {
  const konfiId = req.params.id;
  if (req.user.type === 'konfi' && req.user.id !== parseInt(konfiId)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const earnedQuery = `
    SELECT cb.*, kb.earned_at FROM custom_badges cb
    JOIN konfi_badges kb ON cb.id = kb.badge_id
    WHERE kb.konfi_id = ? AND cb.is_active = 1
    ORDER BY kb.earned_at DESC
  `;
  
  db.all(earnedQuery, [konfiId], (err, earnedBadges) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    
    db.all("SELECT * FROM custom_badges WHERE is_active = 1 ORDER BY criteria_value", [], (err, allBadges) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json({ 
        earned: earnedBadges, 
        available: allBadges,
        progress: `${earnedBadges.length}/${allBadges.length}`
      });
    });
  });
});

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
        SELECT ka.konfi_id, a.name, a.points, a.type, a.category, ka.completed_date as date, 
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
  SELECT a.name, a.points, a.type, a.category, ka.completed_date as date, 
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
           
           // Get jahrgang name
           db.get("SELECT name, confirmation_date FROM jahrgaenge WHERE id = ?", [jahrgang_id], (err, jahrgangRow) => {
             res.json({ 
               id: this.lastID, 
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
  db.all("SELECT * FROM activities ORDER BY type, name", [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(rows);
  });
});

// Add new activity (admin only)
app.post('/api/activities', verifyToken, (req, res) => {
  if (req.user.type !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { name, points, type, category } = req.body;
  
  if (!name || !points || !type) {
    return res.status(400).json({ error: 'Name, points and type are required' });
  }

  if (!['gottesdienst', 'gemeinde'].includes(type)) {
    return res.status(400).json({ error: 'Type must be gottesdienst or gemeinde' });
  }

  db.run("INSERT INTO activities (name, points, type, category) VALUES (?, ?, ?, ?)",
         [name, points, type, category],
         function(err) {
           if (err) {
             return res.status(500).json({ error: 'Database error' });
           }
           
           res.json({ 
             id: this.lastID, 
             name, 
             points,
             type,
             category
           });
         });
});

// Update activity
// Update activity
app.put('/api/activities/:id', verifyToken, (req, res) => {
  if (req.user.type !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  const activityId = req.params.id;
  const { name, points, type, category } = req.body;
  
  if (!name || !points || !type) {
    return res.status(400).json({ error: 'Name, points and type are required' });
  }
  
  if (!['gottesdienst', 'gemeinde'].includes(type)) {
    return res.status(400).json({ error: 'Type must be gottesdienst or gemeinde' });
  }
  
  // Handle category - can be empty string or null
  const categoryValue = category && category.trim() ? category.trim() : null;
  
  db.run("UPDATE activities SET name = ?, points = ?, type = ?, category = ? WHERE id = ?", 
    [name, points, type, categoryValue, activityId], function(err) {
      if (err) {
        console.error('Database error updating activity:', err);
        return res.status(500).json({ error: 'Database error: ' + err.message });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Activity not found' });
      }
      
      res.json({ message: 'Activity updated successfully' });
    });
});

// Delete activity
app.delete('/api/activities/:id', verifyToken, (req, res) => {
  if (req.user.type !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const activityId = req.params.id;

  // Check if activity is used
  db.get("SELECT COUNT(*) as count FROM konfi_activities WHERE activity_id = ?", [activityId], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (row.count > 0) {
      return res.status(400).json({ error: 'Cannot delete activity that has been assigned to konfis' });
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

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Konfi Points API running on port ${PORT}`);
  console.log(`📊 Database: ${dbPath}`);
  console.log(`🔐 Admin login: username=admin, password=pastor2025`);
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
    const allowedTypes = /jpeg|jpg|png|gif|pdf|mp4|mov|avi|docx|txt/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
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
  
  // Create admin support room
  db.get("SELECT id FROM chat_rooms WHERE type = 'admin' AND name = 'Admin Support'", [], (err, room) => {
    if (!room) {
      db.run("INSERT INTO chat_rooms (name, type, created_by) VALUES ('Admin Support', 'admin', 1)", function(err) {
        if (!err) {
          // Add all admins to the admin room
          db.all("SELECT id FROM admins", [], (err, admins) => {
            if (!err) {
              admins.forEach(admin => {
                db.run("INSERT INTO chat_participants (room_id, user_id, user_type) VALUES (?, ?, 'admin')",
                  [this.lastID, admin.id]);
              });
            }
          });
        }
      });
    }
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
      
      const currentUserName = req.user.display_name || req.user.name;
      const roomName = `${currentUserName} ↔ ${targetUser.name}`;
      
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
    // Create the room
    db.run("INSERT INTO chat_rooms (name, type, jahrgang_id, created_by) VALUES (?, ?, ?, ?)",
      [name, type, jahrgang_id || null, createdBy], function(err) {
        if (err) return res.status(500).json({ error: 'Database error' });
        
        const roomId = this.lastID;
        
        // Add creator as participant
        db.run("INSERT INTO chat_participants (room_id, user_id, user_type) VALUES (?, ?, ?)",
          [roomId, createdBy, req.user.type], (err) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            
            // Add other participants
            if (participants && participants.length > 0) {
              let participantCount = 0;
              const totalParticipants = participants.length;
              
              participants.forEach(participantId => {
                db.run("INSERT INTO chat_participants (room_id, user_id, user_type) VALUES (?, ?, 'konfi')",
                  [roomId, participantId], (err) => {
                    if (err) console.error('Error adding participant:', err);
                    
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
    // Admins see all rooms
    query = `
      SELECT r.*, j.name as jahrgang_name,
              COUNT(CASE WHEN m.created_at > COALESCE(p.last_read_at, '1970-01-01') THEN 1 END) as unread_count,
              (SELECT content FROM chat_messages WHERE room_id = r.id AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1) as last_message,
              (SELECT created_at FROM chat_messages WHERE room_id = r.id AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1) as last_message_time
      FROM chat_rooms r
      LEFT JOIN jahrgaenge j ON r.jahrgang_id = j.id
      LEFT JOIN chat_participants p ON r.id = p.room_id AND p.user_id = ? AND p.user_type = ?
      LEFT JOIN chat_messages m ON r.id = m.room_id AND m.deleted_at IS NULL
      GROUP BY r.id
      ORDER BY last_message_time DESC NULLS LAST
    `;
    params = [userId, userType];
  } else {
    // Konfis see only their rooms
    query = `
      SELECT r.*, j.name as jahrgang_name,
              COUNT(CASE WHEN m.created_at > p.last_read_at THEN 1 END) as unread_count,
              (SELECT content FROM chat_messages WHERE room_id = r.id AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1) as last_message,
              (SELECT created_at FROM chat_messages WHERE room_id = r.id AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1) as last_message_time
      FROM chat_rooms r
      LEFT JOIN jahrgaenge j ON r.jahrgang_id = j.id
      INNER JOIN chat_participants p ON r.id = p.room_id AND p.user_id = ? AND p.user_type = ?
      LEFT JOIN chat_messages m ON r.id = m.room_id AND m.created_at > p.last_read_at AND m.deleted_at IS NULL
      GROUP BY r.id
      ORDER BY last_message_time DESC NULLS LAST
    `;
    params = [userId, userType];
  }
  
  db.all(query, params, (err, rooms) => {
    if (err) {
      console.error('Error fetching chat rooms:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    res.json(rooms);
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

// === ENDE CHAT SYSTEM ===