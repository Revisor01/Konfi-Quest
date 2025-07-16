// server.js (FINAL KORRIGIERT)

// Imports
console.log('🚀 Starting Konfi Points API...');
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
console.log('✅ All modules loaded');

// App-Initialisierung
const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'konfi-secret-2025';

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

// Uploads-Verzeichnis einrichten und bereitstellen
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use('/uploads', express.static(uploadsDir));

// Zentrales Multer-Setup
const upload = multer({
  dest: uploadsDir,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Nur Bilddateien sind erlaubt!'), false);
    }
  }
});

// JWT-Verifizierung Middleware
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ error: 'Invalid token' });
    req.user = decoded;
    next();
  });
};

// Hilfsfunktionen (diese werden an die Routen übergeben)
const BIBLE_BOOKS = [
  'Genesis', 'Exodus', 'Levitikus', 'Numeri', 'Deuteronomium', 'Josua', 'Richter', 'Ruth',
  'Samuel', 'Koenige', 'Chronik', 'Esra', 'Nehemia', 'Ester', 'Hiob', 'Psalmen', 'Sprueche',
  'Prediger', 'Hohelied', 'Jesaja', 'Jeremia', 'Klagelieder', 'Hesekiel', 'Daniel', 'Hosea',
  'Joel', 'Amos', 'Obadja', 'Jona', 'Micha', 'Nahum', 'Habakuk', 'Zephanja', 'Haggai',
  'Sacharja', 'Maleachi', 'Matthaeus', 'Markus', 'Lukas', 'Johannes', 'Apostelgeschichte',
  'Roemer', 'Korinther', 'Galater', 'Epheser', 'Philipper', 'Kolosser', 'Thessalonicher',
  'Timotheus', 'Titus', 'Philemon', 'Hebraeer', 'Jakobus', 'Petrus', 'Johannes', 'Judas', 'Offenbarung'
];
const generateBiblicalPassword = () => {
  const book = BIBLE_BOOKS[Math.floor(Math.random() * BIBLE_BOOKS.length)];
  const chapter = Math.floor(Math.random() * 50) + 1;
  const verse = Math.floor(Math.random() * 30) + 1;
  return `${book}${chapter},${verse}`;
};
function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const months = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
  const day = date.getDate().toString().padStart(2, '0');
  const month = months[date.getMonth()];
  const year = date.getFullYear();
  return `${day}. ${month} ${year}`;
}

// Platzhalter für Funktionen, die von der DB abhängen
let checkAndAwardBadges = async () => {};
let CRITERIA_TYPES = {};

// Datenbank-Setup
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
const dbPath = path.join(__dirname, 'data', 'konfi.db');
const dbExists = fs.existsSync(dbPath);

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('DB Connection Error:', err.message);
  } else {
    console.log('📊 Connected to the SQLite database.');
    initializeDatabase();
  }
});

// Haupt-Initialisierungsfunktion
const initializeDatabase = () => {
    // 1. Definiere die Badge-Logik
    CRITERIA_TYPES = {
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
      bonus_points: { 
        label: "💰 Bonuspunkte", 
        description: "Anzahl erhaltener Bonuspunkte",
        help: "Badge wird vergeben, wenn die angegebene Anzahl von Bonuspunkt-Einträgen erhalten wurde (unabhängig von der Höhe der Bonuspunkte). Beispiel: Wert 2 = mindestens 2 Bonuspunkt-Vergaben."
      }
    };

    checkAndAwardBadges = async (konfiId) => {
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


    // 2. Erstelle DB-Schema, führe Migrationen aus und lade Routen
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
      
      // Events system tables
      db.run(`CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    event_date DATETIME NOT NULL,
    location TEXT,
    location_maps_url TEXT,
    points INTEGER DEFAULT 0,
    category TEXT,
    type TEXT DEFAULT 'event',
    max_participants INTEGER NOT NULL,
    registration_opens_at DATETIME,
    registration_closes_at DATETIME,
    has_timeslots BOOLEAN DEFAULT 0,
    is_series BOOLEAN DEFAULT 0,
    series_id TEXT,
    created_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES admins (id)
  )`);
      
      db.run(`CREATE TABLE IF NOT EXISTS event_timeslots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    max_participants INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events (id)
  )`);
      
      db.run(`CREATE TABLE IF NOT EXISTS event_bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    konfi_id INTEGER NOT NULL,
    timeslot_id INTEGER,
    status TEXT DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'waiting')),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events (id),
    FOREIGN KEY (konfi_id) REFERENCES konfis (id),
    FOREIGN KEY (timeslot_id) REFERENCES event_timeslots (id),
    UNIQUE (event_id, konfi_id)
  )`);
      
      // Chat system tables
      db.run(`CREATE TABLE IF NOT EXISTS chat_rooms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('jahrgang', 'admin', 'direct', 'group')),
  jahrgang_id INTEGER,
  event_id INTEGER,
  created_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (jahrgang_id) REFERENCES jahrgaenge (id),
  FOREIGN KEY (event_id) REFERENCES events (id),
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
      
      db.run(`CREATE TABLE IF NOT EXISTS chat_read_status (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  user_type TEXT NOT NULL CHECK (user_type IN ('admin', 'konfi')),
  last_read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (room_id) REFERENCES chat_rooms (id),
  UNIQUE(room_id, user_id, user_type)
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
      
      // Migration 3: Update chat_rooms table to allow 'group' type
      // Check if migration is needed by testing if 'group' type is allowed
      db.run(`INSERT INTO chat_rooms (name, type, created_by) VALUES ('test_group', 'group', 1)`, (err) => {
        if (err && err.code === 'SQLITE_CONSTRAINT') {
          console.log('⚡ Migration 3: Updating chat_rooms table to allow group type...');
          
          // SQLite doesn't support modifying CHECK constraints, so we need to recreate the table
          db.run(`CREATE TABLE chat_rooms_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('jahrgang', 'admin', 'direct', 'group')),
        jahrgang_id INTEGER,
        created_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (jahrgang_id) REFERENCES jahrgaenge (id),
        FOREIGN KEY (created_by) REFERENCES admins (id)
      )`, (err) => {
              if (err) {
                console.error('Migration 3 error creating new table:', err);
              } else {
                // Copy data from old table to new table
                db.run(`INSERT INTO chat_rooms_new (id, name, type, jahrgang_id, created_by, created_at)
            SELECT id, name, type, jahrgang_id, created_by, created_at FROM chat_rooms`, (err) => {
                    if (err) {
                      console.error('Migration 3 error copying data:', err);
                    } else {
                      // Drop old table and rename new table
                      db.run(`DROP TABLE chat_rooms`, (err) => {
                        if (err) {
                          console.error('Migration 3 error dropping old table:', err);
                        } else {
                          db.run(`ALTER TABLE chat_rooms_new RENAME TO chat_rooms`, (err) => {
                            if (err) {
                              console.error('Migration 3 error renaming table:', err);
                            } else {
                              console.log('✅ Migration 3: chat_rooms table updated to allow group type');
                            }
                          });
                        }
                      });
                    }
                  });
              }
            });
        } else if (err) {
          console.error('Migration 3 test error:', err);
        } else {
          // Test successful - delete the test record and skip migration
          db.run(`DELETE FROM chat_rooms WHERE name = 'test_group' AND type = 'group'`);
          console.log('✅ Migration 3: group type already allowed in chat_rooms table');
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
      
      // Migration 5: Check chat_read_status table exists
      db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='chat_read_status'", (err, row) => {
        if (err) {
          console.error('Migration 5 check error:', err);
        } else if (!row) {
          console.log('⚡ Migration 5: Creating chat_read_status table...');
          db.run(`CREATE TABLE IF NOT EXISTS chat_read_status (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        user_type TEXT NOT NULL CHECK (user_type IN ('admin', 'konfi')),
        last_read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (room_id) REFERENCES chat_rooms (id),
        UNIQUE(room_id, user_id, user_type)
      )`, (err) => {
              if (err) {
                console.error('Migration 5 error:', err);
              } else {
                console.log('✅ Migration 5: chat_read_status table created');
              }
            });
        } else {
          console.log('✅ Migration 5: chat_read_status table already exists');
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
                      
                      const konfiId = this.lastID;
                      // Add konfi to jahrgang chat room
                      db.get("SELECT id FROM chat_rooms WHERE type = 'jahrgang' AND jahrgang_id = ?", [jahrgangRow.id], (err, chatRoom) => {
                        if (chatRoom) {
                          db.run("INSERT INTO chat_participants (room_id, user_id, user_type) VALUES (?, ?, 'konfi')",
                            [chatRoom.id, konfiId], (err) => {
                              if (err) console.error('Error adding konfi to jahrgang chat:', err);
                            });
                        }
                      });
                    }
                  });
              }
            });
          });
        }, 1000);
      } else {
        console.log('✅ Existing database loaded');
      }
      
      console.log('✅ Database schema and data are ready.');
      
        // 3. Lade die Routen, NACHDEM die DB bereit ist
        initializeRoutes();
    });
};

const initializeRoutes = () => {
    console.log('🔗 Binding routes...');

    // Route-Module importieren und Abhängigkeiten übergeben
    const authRoutes = require('./routes/auth.js')(db, bcrypt, jwt, JWT_SECRET);
    const adminRoutes = require('./routes/admins.js')(db, verifyToken, bcrypt);
    const jahrgangRoutes = require('./routes/jahrgaenge.js')(db, verifyToken);
    const konfiRoutes = require('./routes/konfis.js')(db, verifyToken, bcrypt, generateBiblicalPassword, checkAndAwardBadges);
    const badgeRoutes = require('./routes/badges.js')(db, verifyToken, CRITERIA_TYPES);
    const activityRequestRoutes = require('./routes/activity-requests.js')(db, verifyToken, upload, checkAndAwardBadges);
    const chatRoutes = require('./routes/chat.js')(db, verifyToken, multer, path, fs, uploadsDir);
    const statisticsRoutes = require('./routes/statistics.js')(db, verifyToken);
    const settingsRoutes = require('./routes/settings.js')(db, verifyToken);
    const activitiesRoutes = require('./routes/activities.js')(db, verifyToken, checkAndAwardBadges, formatDate);
    const eventsRoutes = require('./routes/events.js')(db, verifyToken);

    // Routen einbinden
    app.use('/api', authRoutes);
    app.use('/api/admins', adminRoutes);
    app.use('/api/jahrgaenge', jahrgangRoutes);
    app.use('/api/konfis', konfiRoutes);
    app.use('/api/badges', badgeRoutes);
    app.use('/api/activity-requests', activityRequestRoutes);
    app.use('/api/chat', chatRoutes);
    app.use('/api/statistics', statisticsRoutes);
    app.use('/api/settings', settingsRoutes);
    app.use('/api/activities', activitiesRoutes);
    app.use('/api/events', eventsRoutes);
    
    // Einfache Routen, die hier bleiben können
    app.get('/api/health', (req, res) => res.json({ status: 'OK' }));
    
    // Fehlerbehandlung
    app.use((err, req, res, next) => {
        console.error(err.stack);
        res.status(500).json({ error: 'Something went wrong!', details: err.message });
    });

    // Server starten
    app.listen(PORT, () => {
        console.log(`✅ Konfi Points API running on port ${PORT}`);
        if (!dbExists) {
          console.log(`🔐 Default Admin: username=admin, password=pastor2025`);
        }
    });
};

// Graceful Shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down gracefully...');
  db.close((err) => {
    if (err) console.error('Error closing database:', err.message);
    else console.log('📝 Database connection closed.');
    process.exit(0);
  });
});