const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const { generateBiblicalPassword } = require('./utils/passwordUtils');

// Die Hauptfunktion, die die Datenbank initialisiert und migriert
function initializeDatabase() {
  // Erstelle das 'data' Verzeichnis, falls es nicht existiert
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const dbPath = path.join(dataDir, 'konfi.db');
  const dbExists = fs.existsSync(dbPath);
  const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      console.error('❌ Database connection error:', err.message);
      // Beende den Prozess, wenn die DB-Verbindung fehlschlägt
      process.exit(1); 
    }
  });

  if (!dbExists) {
    console.log('📊 Creating new database...');
  } else {
    console.log('📊 Using existing database...');
  }

  // Hier kommt der gesamte Code aus deinem db.serialize() Block rein
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
    
    // Categories table
    db.run(`CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    type TEXT NOT NULL CHECK (type IN ('activity', 'event', 'both')) DEFAULT 'both',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
  type TEXT NOT NULL CHECK (type IN ('jahrgang', 'admin', 'direct', 'group')),
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
    
    // Migration 2: Populate categories table from existing activity categories
    setTimeout(() => {
      db.all("PRAGMA table_info(categories)", (err, columns) => {
        if (!err && columns.length > 0) {
          // Check if categories table is empty
          db.get("SELECT COUNT(*) as count FROM categories", (err, row) => {
            if (!err && row.count === 0) {
              console.log('⚡ Migration: Populating categories table...');
              
              // Get unique categories from activities
              db.all("SELECT DISTINCT category FROM activities WHERE category IS NOT NULL AND category != ''", (err, categories) => {
                if (!err && categories.length > 0) {
                  const insertStmt = db.prepare("INSERT OR IGNORE INTO categories (name, type) VALUES (?, 'activity')");
                  
                  categories.forEach(cat => {
                    insertStmt.run(cat.category);
                  });
                  
                  insertStmt.finalize();
                  console.log(`✅ Migration: ${categories.length} categories populated from activities`);
                }
              });
            } else {
              console.log(`✅ Categories table already has ${row.count} entries`);
            }
          });
        } else {
          console.log('⚠️ Categories table not found - will be created on next restart');
        }
      });
    }, 1000);
    
    // Migration 3: Add is_special to activities table (if not exists)
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
    
    // Migration 6: Create activity_categories table for Multi-Select Categories
    db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='activity_categories'", (err, row) => {
      if (err) {
        console.error('Migration 6 check error:', err);
      } else if (!row) {
        console.log('⚡ Migration 6: Creating activity_categories table for Multi-Select Categories...');
        db.run(`CREATE TABLE IF NOT EXISTS activity_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        activity_id INTEGER NOT NULL,
        category_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (activity_id) REFERENCES activities (id) ON DELETE CASCADE,
        FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE CASCADE,
        UNIQUE(activity_id, category_id)
      )`, (err) => {
            if (err) {
              console.error('Migration 6 error:', err);
            } else {
              console.log('✅ Migration 6: activity_categories table created');
              
              // Migrate existing category data from activities table to activity_categories table
              console.log('⚡ Migration 6: Migrating existing activity categories...');
              db.all("SELECT id, category FROM activities WHERE category IS NOT NULL AND category != ''", (err, activities) => {
                if (err) {
                  console.error('Migration 6 data migration error:', err);
                } else {
                  let migratedCount = 0;
                  let processedCount = 0;
                  
                  if (activities.length === 0) {
                    console.log('✅ Migration 6: No existing categories to migrate');
                    return;
                  }
                  
                  activities.forEach(activity => {
                    // Look for category in categories table
                    db.get("SELECT id FROM categories WHERE name = ?", [activity.category], (err, category) => {
                      if (err) {
                        console.error('Migration 6 category lookup error:', err);
                      } else if (category) {
                        // Insert relationship
                        db.run("INSERT OR IGNORE INTO activity_categories (activity_id, category_id) VALUES (?, ?)", 
                          [activity.id, category.id], (err) => {
                            if (err) {
                              console.error('Migration 6 insert error:', err);
                            } else {
                              migratedCount++;
                            }
                            processedCount++;
                            
                            if (processedCount === activities.length) {
                              console.log(`✅ Migration 6: ${migratedCount} activity categories migrated`);
                            }
                          });
                      } else {
                        console.log(`⚠️  Migration 6: Category '${activity.category}' not found in categories table`);
                        processedCount++;
                        
                        if (processedCount === activities.length) {
                          console.log(`✅ Migration 6: ${migratedCount} activity categories migrated`);
                        }
                      }
                    });
                  });
                }
              });
            }
          });
      } else {
        console.log('✅ Migration 6: activity_categories table already exists');
      }
    });
    
    // Migration 7: Create event_categories table for Multi-Select Categories
    db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='event_categories'", (err, row) => {
      if (err) {
        console.error('Migration 7 check error:', err);
      } else if (!row) {
        console.log('⚡ Migration 7: Creating event_categories table for Multi-Select Categories...');
        db.run(`CREATE TABLE IF NOT EXISTS event_categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id INTEGER NOT NULL,
        category_id INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (event_id) REFERENCES events (id) ON DELETE CASCADE,
        FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE CASCADE,
        UNIQUE(event_id, category_id)
      )`, (err) => {
            if (err) {
              console.error('Migration 7 error:', err);
            } else {
              console.log('✅ Migration 7: event_categories table created');
              
              // Migrate existing category data from events table to event_categories table
              console.log('⚡ Migration 7: Migrating existing event categories...');
              db.all("SELECT id, category FROM events WHERE category IS NOT NULL AND category != ''", (err, events) => {
                if (err) {
                  console.error('Migration 7 data migration error:', err);
                } else {
                  let migratedCount = 0;
                  let processedCount = 0;
                  
                  if (events.length === 0) {
                    console.log('✅ Migration 7: No existing event categories to migrate');
                    return;
                  }
                  
                  events.forEach(event => {
                    // Look for category in categories table
                    db.get("SELECT id FROM categories WHERE name = ?", [event.category], (err, category) => {
                      if (err) {
                        console.error('Migration 7 category lookup error:', err);
                      } else if (category) {
                        // Insert relationship
                        db.run("INSERT OR IGNORE INTO event_categories (event_id, category_id) VALUES (?, ?)", 
                          [event.id, category.id], (err) => {
                            if (err) {
                              console.error('Migration 7 insert error:', err);
                            } else {
                              migratedCount++;
                            }
                            processedCount++;
                            
                            if (processedCount === events.length) {
                              console.log(`✅ Migration 7: ${migratedCount} event categories migrated`);
                            }
                          });
                      } else {
                        console.log(`⚠️  Migration 7: Category '${event.category}' not found in categories table`);
                        processedCount++;
                        
                        if (processedCount === events.length) {
                          console.log(`✅ Migration 7: ${migratedCount} event categories migrated`);
                        }
                      }
                    });
                  });
                }
              });
            }
          });
      } else {
        console.log('✅ Migration 7: event_categories table already exists');
      }
    });
    
    // Migration 8: Remove old category columns from activities and events
    console.log('⚡ Migration 8: Removing old category columns...');
    
    // Check if activities table needs migration
    db.all(`PRAGMA table_info(activities)`, (err, columns) => {
      if (err) {
        console.error('Migration 8 activities check error:', err);
        return;
      }
      
      const hasCategory = columns.some(col => col.name === 'category');
      
      if (hasCategory) {
        console.log('🔄 Migration 8: Migrating activities table...');
        
        // Clean up any existing temp table first
        db.run(`DROP TABLE IF EXISTS activities_new`, (err) => {
          if (err) {
            console.error('Migration 8 activities cleanup error:', err);
          } else {
            // Remove category from activities table
            db.run(`CREATE TABLE activities_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            points INTEGER NOT NULL,
            type TEXT NOT NULL CHECK (type IN ('gottesdienst', 'gemeinde')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )`, (err) => {
                if (err) {
                  console.error('Migration 8 activities new table error:', err);
                } else {
                  db.run(`INSERT INTO activities_new SELECT id, name, points, type, created_at FROM activities`, (err) => {
                    if (err) {
                      console.error('Migration 8 activities copy error:', err);
                    } else {
                      db.run(`DROP TABLE activities`, (err) => {
                        if (err) {
                          console.error('Migration 8 activities drop error:', err);
                        } else {
                          db.run(`ALTER TABLE activities_new RENAME TO activities`, (err) => {
                            if (err) {
                              console.error('Migration 8 activities rename error:', err);
                            } else {
                              console.log('✅ Migration 8: activities.category column removed');
                            }
                          });
                        }
                      });
                    }
                  });
                }
              });
          }
        });
      } else {
        console.log('✅ Migration 8: activities table already migrated');
      }
    });
    
    // Check if events table needs migration
    db.all(`PRAGMA table_info(events)`, (err, columns) => {
      if (err) {
        console.error('Migration 8 events check error:', err);
        return;
      }
      
      const hasCategory = columns.some(col => col.name === 'category');
      
      if (hasCategory) {
        console.log('🔄 Migration 8: Migrating events table...');
        
        // Clean up any existing temp table first
        db.run(`DROP TABLE IF EXISTS events_new`, (err) => {
          if (err) {
            console.error('Migration 8 events cleanup error:', err);
          } else {
            // Remove category from events table
            db.run(`CREATE TABLE events_new (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            event_date TEXT NOT NULL,
            location TEXT,
            location_maps_url TEXT,
            points INTEGER DEFAULT 0,
            type TEXT DEFAULT 'event',
            max_participants INTEGER NOT NULL,
            registration_opens_at TEXT,
            registration_closes_at TEXT,
            has_timeslots INTEGER DEFAULT 0,
            is_series INTEGER DEFAULT 0,
            series_id INTEGER,
            created_by INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (created_by) REFERENCES admins (id),
            FOREIGN KEY (series_id) REFERENCES events (id)
          )`, (err) => {
                if (err) {
                  console.error('Migration 8 events new table error:', err);
                } else {
                  db.run(`INSERT INTO events_new SELECT id, name, description, event_date, location, location_maps_url, points, type, max_participants, registration_opens_at, registration_closes_at, has_timeslots, is_series, series_id, created_by, created_at FROM events`, (err) => {
                    if (err) {
                      console.error('Migration 8 events copy error:', err);
                    } else {
                      db.run(`DROP TABLE events`, (err) => {
                        if (err) {
                          console.error('Migration 8 events drop error:', err);
                        } else {
                          db.run(`ALTER TABLE events_new RENAME TO events`, (err) => {
                            if (err) {
                              console.error('Migration 8 events rename error:', err);
                            } else {
                              console.log('✅ Migration 8: events.category column removed');
                            }
                          });
                        }
                      });
                    }
                  });
                }
              });
          }
        });
      } else {
        console.log('✅ Migration 8: events table already migrated');
      }
    });
    
    // Migration 9: Add email columns to konfis and admins tables for password reset
    console.log('🔄 Migration 9: Adding email columns...');
    
    // Add email to konfis table
    db.all("PRAGMA table_info(konfis)", (err, columns) => {
      if (err) {
        console.error('Migration 9 konfis check error:', err);
      } else {
        const hasEmail = columns.some(col => col.name === 'email');
        
        if (!hasEmail) {
          console.log('⚡ Migration 9: Adding email column to konfis table...');
          db.run("ALTER TABLE konfis ADD COLUMN email TEXT", (err) => {
            if (err) {
              console.error('Migration 9 konfis error:', err);
            } else {
              console.log('✅ Migration 9: email column added to konfis table');
            }
          });
        } else {
          console.log('✅ Migration 9: email column already exists in konfis table');
        }
      }
    });
    
    // Add email to admins table  
    db.all("PRAGMA table_info(admins)", (err, columns) => {
      if (err) {
        console.error('Migration 9 admins check error:', err);
      } else {
        const hasEmail = columns.some(col => col.name === 'email');
        
        if (!hasEmail) {
          console.log('⚡ Migration 9: Adding email column to admins table...');
          db.run("ALTER TABLE admins ADD COLUMN email TEXT", (err) => {
            if (err) {
              console.error('Migration 9 admins error:', err);
            } else {
              console.log('✅ Migration 9: email column added to admins table');
            }
          });
        } else {
          console.log('✅ Migration 9: email column already exists in admins table');
        }
      }
    });
    
    // Create password_resets table for reset tokens
    db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='password_resets'", (err, row) => {
      if (err) {
        console.error('Migration 9 password_resets check error:', err);
      } else if (!row) {
        console.log('⚡ Migration 9: Creating password_resets table...');
        db.run(`CREATE TABLE IF NOT EXISTS password_resets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        user_type TEXT NOT NULL CHECK (user_type IN ('admin', 'konfi')),
        token TEXT NOT NULL UNIQUE,
        expires_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        used_at DATETIME NULL
      )`, (err) => {
            if (err) {
              console.error('Migration 9 password_resets table error:', err);
            } else {
              console.log('✅ Migration 9: password_resets table created');
            }
          });
      } else {
        console.log('✅ Migration 9: password_resets table already exists');
      }
    });
    
    // RBAC Migration: Transform existing system to multi-organization
    console.log('🚀 Checking RBAC Migration...');
    db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name='organizations'`, (err, row) => {
      if (err) {
        console.error('RBAC check error:', err);
      } else if (!row) {
        console.log('🔄 Running RBAC Migration...');
        const { runRBACMigration } = require('./migrations/rbac-migration');
        runRBACMigration(db).then(() => {
          console.log('✅ RBAC Migration completed successfully');
          // Run Konfi Profiles Migration after RBAC Migration
          runKonfiProfilesMigration(db);
        }).catch(err => {
          console.error('❌ RBAC Migration failed:', err);
        });
      } else {
        console.log('✅ RBAC Migration: organizations table already exists');
        // Check if Konfi Profiles Migration is needed
        runKonfiProfilesMigration(db);
      }
    });
    
    function runKonfiProfilesMigration(db) {
      db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name='konfi_profiles'`, (err, row) => {
        if (err) {
          console.error('Konfi Profiles check error:', err);
        } else if (!row) {
          console.log('🔄 Running Konfi Profiles Migration...');
          const { runKonfiProfilesMigration } = require('./migrations/konfi-profiles-migration');
          runKonfiProfilesMigration(db).then(() => {
            console.log('✅ Konfi Profiles Migration completed successfully');
          }).catch(err => {
            console.error('❌ Konfi Profiles Migration failed:', err);
          });
        } else {
          console.log('✅ Konfi Profiles Migration: konfi_profiles table already exists');
        }
      });
    }
    
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
  });

  
  return db; // Gib die Datenbankinstanz zurück, damit server.js sie verwenden kann
}

module.exports = { initializeDatabase };