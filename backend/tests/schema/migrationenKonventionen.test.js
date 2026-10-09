// backend/tests/schema/migrationenKonventionen.test.js
//
// Zwei Regeln fuer jede Migration in backend/migrations/ (seit 29.09.2026,
// ab Migration 174) -- damit die Altlasten nicht weiterwachsen:
//
// 1. Zeitspalten mit Zeitzone (timestamptz), nie `TIMESTAMP` ohne
//    (Audit Datenbank BF-11). Seit Migration 206 (09.10.2026) ist keine
//    Spalte mehr ohne Zone; vorher stimmten 24 Spalten nur, solange
//    Datenbank-Sitzungen und Node-Prozess beide in UTC liefen -- vom 21. bis
//    23.08.2026 taten sie es nicht. Die Lehre aus Migration 138/139 stand im
//    Repo -- trotzdem legten
//    124 (daily_verses.created_at) und 142 (material_links.created_at) danach
//    wieder `TIMESTAMP` an.
// 2. Fremdschluessel als BIGINT, nie INTEGER (Audit Datenbank BF-12): Alle
//    Primaerschluessel ab Migration 068 sind bigint; 55 Fremdschluessel
//    zeigen als integer darauf, zuletzt 159 (`INTEGER REFERENCES users(id)`).
//    Funktional folgenlos, aber jede neue Tabelle setzte die Mischung fort.
//
// Die aelteren Migrationen (064 bis 173) stehen seit dem 02.10.2026 nur noch
// im Schema-Dump; im Verzeichnis liegt nichts mehr, das vor diesen Regeln
// entstand. Die Grenze zum Dump haelt dumpAktualitaet.test.js.
const fs = require('fs');
const path = require('path');

const MIGRATIONS_DIR = path.join(__dirname, '..', '..', 'migrations');

// SQL ohne Kommentare und ohne Zeichenketten -- ein Wort in einem Kommentar
// oder Text ist keine Spaltendefinition.
function nurCode(sql) {
  return sql
    .replace(/--[^\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/'(?:[^']|'')*'/g, "''");
}

const neue = fs.readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith('.sql'))
  .sort()
  .map((f) => ({ datei: f, code: nurCode(fs.readFileSync(path.join(MIGRATIONS_DIR, f), 'utf8')) }));

// TIMESTAMP als Typ ohne Zone. CURRENT_TIMESTAMP und TIMESTAMPTZ trifft
// \bTIMESTAMP\b nicht (Wortzeichen davor bzw. danach).
const OHNE_ZONE = /\bTIMESTAMP\b(?!\s+WITH\s+TIME\s+ZONE)|\bTIMESTAMP\s+WITHOUT\s+TIME\s+ZONE\b/gi;
const INTEGER_FK = /\b(INTEGER|INT|INT4|SERIAL)\b(\s+NOT\s+NULL)?\s+REFERENCES\b/gi;

describe('Die Migrationen folgen den Schema-Regeln', () => {
  it('es gibt neue Migrationen zu pruefen', () => {
    expect(neue.length).toBeGreaterThan(0);
  });

  it('keine Zeitspalte ohne Zeitzone', () => {
    const treffer = neue.flatMap(({ datei, code }) => (code.match(OHNE_ZONE) || []).map((t) => `${datei}: ${t}`));
    expect(treffer).toEqual([]);
  });

  it('kein Fremdschluessel als INTEGER', () => {
    const treffer = neue.flatMap(({ datei, code }) => (code.match(INTEGER_FK) || []).map((t) => `${datei}: ${t}`));
    expect(treffer).toEqual([]);
  });
});

describe('Die Erkennung selbst', () => {
  // Gegenprobe: Genau die Schreibweisen, die frueher durchgingen, werden
  // erkannt; die erlaubten nicht.
  it.each([
    ['created_at TIMESTAMP DEFAULT NOW()', 1],
    ['ALTER TABLE x ADD COLUMN y timestamp;', 1],
    ['z TIMESTAMP WITHOUT TIME ZONE', 1],
    ['created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP', 0],
    ['created_at timestamp with time zone', 0],
    ["-- TIMESTAMP im Kommentar\nSELECT 'TIMESTAMP im Text'", 0],
  ])('Zeit: %s -> %i Treffer', (sql, anzahl) => {
    expect((nurCode(sql).match(OHNE_ZONE) || []).length).toBe(anzahl);
  });

  it.each([
    ['user_id INTEGER REFERENCES users(id)', 1],
    ['user_id INTEGER NOT NULL REFERENCES users(id)', 1],
    ['user_id BIGINT REFERENCES users(id)', 0],
    ['anzahl INTEGER NOT NULL DEFAULT 0', 0],
  ])('Fremdschluessel: %s -> %i Treffer', (sql, anzahl) => {
    expect((nurCode(sql).match(INTEGER_FK) || []).length).toBe(anzahl);
  });
});
