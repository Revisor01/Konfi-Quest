const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');

// Configure pg to parse bigint as integer
const types = require('pg').types;
types.setTypeParser(20, (val) => parseInt(val, 10)); // bigint

// Pool-Konfiguration: PG_POOL_MAX (Standard 20), PG_IDLE_TIMEOUT (Standard 30s), PG_CONN_TIMEOUT (Standard 5s)
// Bei EKD-Skalierung PG_POOL_MAX im Docker-Compose setzen (z.B. 50).
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: parseInt(process.env.PG_POOL_MAX || '20', 10),
  idleTimeoutMillis: parseInt(process.env.PG_IDLE_TIMEOUT || '30000', 10),
  connectionTimeoutMillis: parseInt(process.env.PG_CONN_TIMEOUT || '5000', 10),
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