const path = require('path');
const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();

// Die Hauptfunktion, die die Datenbank initialisiert
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

  // Enable foreign key constraints
  db.run("PRAGMA foreign_keys = ON");
  
  console.log('✅ Database initialized successfully');
  
  return db; // Gib die Datenbankinstanz zurück, damit server.js sie verwenden kann
}

module.exports = { initializeDatabase };