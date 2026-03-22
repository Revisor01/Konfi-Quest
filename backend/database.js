const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');

// Configure pg to parse bigint as integer
const types = require('pg').types;
types.setTypeParser(20, (val) => parseInt(val, 10)); // bigint

// Der Pool verwendet automatisch die Standard-Umgebungsvariablen für PostgreSQL
// (PGHOST, PGUSER, PGDATABASE, PGPASSWORD, PGPORT) oder die DATABASE_URL.
// Wenn Ihr Node.js-Server und Ihre PostgreSQL-DB im selben Docker-Compose-Netzwerk laufen,
// ist die DATABASE_URL der empfohlene Weg.
// Beispiel: DATABASE_URL="postgresql://user:password@postgres:5432/konfi-db"
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function runMigrations(pool) {
  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort(); // alphabetisch = numerisch durch Dateinamen-Praefix
  for (const file of files) {
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    try {
      await pool.query(sql);
    } catch (err) {
      console.error(`Migration failed: ${file}`, err.message);
      throw err;
    }
  }
  console.log(`Migrations applied: ${files.length} files`);
}

// Einmaliger Test beim Starten der Anwendung, um sicherzustellen, dass die DB erreichbar ist.
pool.query('SELECT NOW()')
  .then(() => runMigrations(pool))
  .catch(err => {
    console.error('Database startup failed:', err);
    process.exit(1);
  });

module.exports = {
  // Die primäre Methode zum Ausführen von Abfragen
  query: (text, params) => pool.query(text, params),

  // Dedizierter Client für Transaktionen (BEGIN/COMMIT/ROLLBACK)
  // pool.query() kann verschiedene Connections nutzen - bei Transaktionen
  // MUSS alles auf derselben Connection laufen!
  getClient: () => pool.connect(),

  // Wir exportieren auch die 'end'-Methode des Pools,
  // damit wir die Verbindungen beim Herunterfahren des Servers sauber beenden können.
  end: () => pool.end(),
};