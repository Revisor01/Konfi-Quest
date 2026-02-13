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

// Einmaliger Test beim Starten der Anwendung, um sicherzustellen, dass die DB erreichbar ist.
pool.query('SELECT NOW()')
 .then(res => console.log('Database connected successfully at:', res.rows[0].now))
  .catch(err => {
 console.error('Database connection test failed:', err);
    // Beende den Prozess, wenn die DB-Verbindung beim Start fehlschlägt.
    process.exit(1);
  });

module.exports = {
  // Die primäre Methode zum Ausführen von Abfragen
  query: (text, params) => pool.query(text, params),
  
  // Wir exportieren auch die 'end'-Methode des Pools,
  // damit wir die Verbindungen beim Herunterfahren des Servers sauber beenden können.
  end: () => pool.end(),
};