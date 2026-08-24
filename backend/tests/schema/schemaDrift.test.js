// backend/tests/schema/schemaDrift.test.js
//
// Waechter gegen Schema-Drift zwischen Test-DB und Produktion.
//
// Vorgeschichte (Audit 22.08.2026): Das Test-Schema war ein handgepflegtes
// Patchwork, das der Produktion nur ungefaehr entsprach. `daily_verses` fehlte
// komplett, `activities.category` ebenso — beide Codepfade liefen bei jedem
// Testlauf in einen Fehler, den die Routen abfingen. Die Suite blieb gruen,
// obwohl Tageslosungs-Cache und Wrapped-Generierung ungeprueft waren.
//
// Seitdem wird das Test-Schema aus einem Produktions-Dump geladen
// (tests/schema/prod-schema.sql). Diese Tests stellen sicher, dass das auch
// so bleibt: Sie prüfen die Objekte, an denen der Drift damals aufgefallen
// ist, und bilden damit die Klasse "Spalte/Tabelle existiert nur in
// Produktion" ab.
const { getTestPool, closePool } = require('../helpers/db');

describe('Schema-Drift: Test-DB gegen Produktion', () => {
  let db;

  beforeAll(() => {
    db = getTestPool();
  });

  afterAll(async () => {
    await closePool();
  });

  const spalteExistiert = async (tabelle, spalte) => {
    const { rows } = await db.query(
      `SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2`,
      [tabelle, spalte]
    );
    return rows.length > 0;
  };

  it('daily_verses existiert (Tageslosungs-Cache)', async () => {
    const { rows } = await db.query(
      `SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'daily_verses'`
    );
    expect(rows).toHaveLength(1);
  });

  it('daily_verses hat das UNIQUE auf (date, translation)', async () => {
    // losungService schreibt per ON CONFLICT (date, translation) — ohne diese
    // Constraint wirft der Cache-Schreibvorgang zur Laufzeit.
    const { rows } = await db.query(
      `SELECT 1
       FROM pg_constraint c
       JOIN pg_class t ON t.oid = c.conrelid
       WHERE t.relname = 'daily_verses' AND c.contype = 'u'`
    );
    expect(rows.length).toBeGreaterThan(0);
  });

  it('daily_verses laesst sich per ON CONFLICT befuellen', async () => {
    // Prueft die Constraint praktisch statt nur ihre Existenz.
    const schreibe = () => db.query(
      `INSERT INTO daily_verses (date, translation, verse_data)
       VALUES (CURRENT_DATE, 'DRIFT', $1)
       ON CONFLICT (date, translation) DO UPDATE SET verse_data = $1`,
      [JSON.stringify({ losung: { text: 'x' } })]
    );

    await expect(schreibe()).resolves.toBeDefined();
    await expect(schreibe()).resolves.toBeDefined(); // zweimal: Konflikt greift

    await db.query(`DELETE FROM daily_verses WHERE translation = 'DRIFT'`);
  });

  it('activities.category existiert (Wrapped-Kategorien)', async () => {
    expect(await spalteExistiert('activities', 'category')).toBe(true);
  });

  it('konfi_profiles.password_plain existiert', async () => {
    // Wurde früher von einem Test per ALTER TABLE zur Laufzeit selbst
    // angelegt — ein Workaround, der das Schema von der Testreihenfolge
    // abhaengig machte.
    expect(await spalteExistiert('konfi_profiles', 'password_plain')).toBe(true);
  });

  it('users.token_invalidated_at existiert (Soft-Revoke)', async () => {
    expect(await spalteExistiert('users', 'token_invalidated_at')).toBe(true);
  });

  it('chat_polls.options ist text wie in Produktion, nicht jsonb', async () => {
    // Verhaltensrelevant: chat.js macht JSON.parse(poll.options). Bei jsonb
    // liefert der Treiber bereits ein Objekt, JSON.parse wirft, und der
    // catch-Zweig setzt options auf []. Die Optionen verhielten sich im Test
    // damit anders als in Produktion.
    const { rows } = await db.query(
      `SELECT data_type FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'chat_polls' AND column_name = 'options'`
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].data_type).toBe('text');
  });

  it('die TRUNCATE-Liste deckt alle Tabellen ab', async () => {
    // Fehlt eine Tabelle, bleiben ihre Daten zwischen den Suites stehen und
    // erzeugen Abhaengigkeiten von der Testreihenfolge — schwer zu finden.
    // Steht eine drin, die es nicht gibt, schlägt jedes truncateAll fehl.
    // Beides ist beim Umstieg auf das Produktions-Schema aufgetreten:
    // konfi_activities/konfi_badges existierten nur im alten Test-Schema,
    // während settings, daily_verses und drei weitere nie geleert wurden.
    const fs = require('fs');
    const path = require('path');
    const dbHelper = fs.readFileSync(
      path.join(__dirname, '..', 'helpers', 'db.js'), 'utf8'
    );
    const block = dbHelper.match(/TRUNCATE_SQL = `TRUNCATE([\s\S]*?)RESTART IDENTITY/);
    expect(block).not.toBeNull();

    const gelistet = new Set(
      block[1].replace(/\n/g, ' ').split(',').map(t => t.trim()).filter(Boolean)
    );

    const { rows } = await db.query(
      `SELECT tablename FROM pg_tables
       WHERE schemaname = 'public' AND tablename <> 'schema_migrations'`
    );
    const vorhanden = new Set(rows.map(r => r.tablename));

    const fehlen = [...vorhanden].filter(t => !gelistet.has(t)).sort();
    const ueberzaehlig = [...gelistet].filter(t => !vorhanden.has(t)).sort();

    expect({ fehlen, ueberzaehlig }).toEqual({ fehlen: [], ueberzaehlig: [] });
  });

  it('keine der Migrationen wurde uebersprungen', async () => {
    // Frueher markierte globalSetup fehlgeschlagene Migrationen trotzdem als
    // "applied". Jetzt bricht der Setup ab — dieser Test haelt fest, dass der
    // Stand vollstaendig ist.
    const fs = require('fs');
    const path = require('path');
    const dateien = fs.readdirSync(path.join(__dirname, '..', '..', 'migrations'))
      .filter(f => f.endsWith('.sql'))
      .sort();

    const { rows } = await db.query('SELECT name FROM schema_migrations');
    const angewandt = new Set(rows.map(r => r.name));

    const fehlend = dateien.filter(f => !angewandt.has(f));
    expect(fehlend).toEqual([]);
  });
});
