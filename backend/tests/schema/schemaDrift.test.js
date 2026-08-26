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

  // ================================================================
  // Fremdschluessel ohne Loeschregel
  //
  // Vorgeschichte: Dieselbe Fehlerklasse wurde mehrfach EINZELN entdeckt --
  // der invite_code_id-Fall (PR #72), chat_message_reactions und die im
  // August reparierten user_certificates-Faelle. Am 26.08.2026 kamen zwei
  // weitere dazu (event_timeslots.organization_id,
  // notifications.organization_id); beide brachen das Loeschen einer
  // Organisation komplett ab.
  //
  // Beide hatten dieselbe Ursache: Die Loeschroutine raeumte ueber eine
  // BEZIEHUNG ab (event_id, user_id) statt ueber die Spalte, die den
  // Fremdschluessel traegt. Zeilen, die die Beziehung nicht erfuellen,
  // bleiben stehen und blockieren.
  //
  // WARUM DIESER TEST NICHT DEN QUELLTEXT LIEST: Der erste Entwurf suchte
  // per Regex nach "DELETE FROM <tabelle> ... <spalte>". Das schlug fehl --
  // in `DELETE FROM notifications WHERE user_id IN (SELECT id FROM users
  // WHERE organization_id = $1)` kommt "organization_id" vor, gehoert aber
  // zum Subquery ueber users, nicht zur Zieltabelle. Der Test blieb gruen,
  // obwohl beide bekannten Luecken offen waren. Ob ein DELETE die richtige
  // Spalte trifft, entscheidet die SQL-Semantik -- das gehoert in einen
  // Test, der die Routine wirklich aufruft (siehe unten).
  // ================================================================
  describe('Fremdschluessel auf users/organizations haben eine Loeschregel', () => {
    /**
     * Alle Fremdschluessel-Spalten auf users/organizations OHNE ON-DELETE-Regel.
     * confdeltype: 'a' = NO ACTION (keine Regel), 'c' = CASCADE, 'n' = SET NULL,
     * 'd' = SET DEFAULT, 'r' = RESTRICT. Eine Spalte kann mehrere Constraints
     * tragen (SQLite-Altlast) -- eine einzige mit Regel genuegt, daher bool_or.
     */
    const ohneRegel = async () => {
      const { rows } = await db.query(`
        SELECT t.relname AS tabelle, a.attname AS spalte
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        JOIN pg_class ref ON ref.oid = c.confrelid
        JOIN unnest(c.conkey) WITH ORDINALITY AS k(attnum, ord) ON true
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = k.attnum
        WHERE c.contype = 'f' AND ref.relname IN ('users', 'organizations')
        GROUP BY t.relname, a.attname
        HAVING bool_or(c.confdeltype <> 'a') = false
        ORDER BY t.relname, a.attname
      `);
      return rows.map((r) => `${r.tabelle}.${r.spalte}`);
    };

    /**
     * Die Spalten, die heute ohne ON-DELETE-Regel dastehen und stattdessen von
     * einer Loeschroutine abgeraeumt werden (users.js/konfiDeletion.js bzw. der
     * Org-Purge in organizations.js).
     *
     * Zweck: Kommt eine NEUE Spalte ohne Regel dazu, faellt dieser Test auf und
     * zwingt zu einer Entscheidung -- ON-DELETE-Regel setzen ODER die
     * Loeschroutine erweitern, dort einen Test dafuer schreiben und hier
     * eintragen. Genau dieser Zwang fehlte bei den historischen Faellen.
     */
    const OHNE_REGEL_ERWARTET = [
      'activities.organization_id',
      'activity_requests.approved_by',
      'bonus_points.admin_id',
      'bonus_points.organization_id',
      'categories.organization_id',
      'certificate_types.organization_id',
      'chat_rooms.created_by',
      'chat_rooms.organization_id',
      'custom_badges.created_by',
      'custom_badges.organization_id',
      'event_points.admin_id',
      'event_timeslots.organization_id',
      'events.created_by',
      'events.organization_id',
      'invite_codes.created_by',
      'jahrgaenge.organization_id',
      'konfi_profiles.organization_id',
      'levels.created_by',
      'material_tags.organization_id',
      'materials.created_by',
      'materials.organization_id',
      'notifications.organization_id',
      'roles.organization_id',
      'settings.organization_id',
      'user_activities.admin_id',
      'user_certificates.admin_id',
      'user_certificates.organization_id',
      'user_certificates.user_id',
      'user_jahrgang_assignments.assigned_by',
      'users.organization_id',
    ];

    it('keine NEUE Spalte ohne ON-DELETE-Regel (sonst Loeschregel oder Eintrag noetig)', async () => {
      const ist = await ohneRegel();

      const neu = ist.filter((sp) => !OHNE_REGEL_ERWARTET.includes(sp));
      const verschwunden = OHNE_REGEL_ERWARTET.filter((sp) => !ist.includes(sp));

      // Beide Richtungen: Neue Spalten brauchen eine Entscheidung, verschwundene
      // gehoeren aus der Liste -- sonst wird sie zur Fiktion.
      expect({ neu, verschwunden }).toEqual({ neu: [], verschwunden: [] });
    });

    /**
     * Die zweite Haelfte der Regel -- "wird von der Loeschroutine ueber GENAU
     * DIESE Spalte abgeraeumt" -- laesst sich auf Schema-Ebene nicht pruefen.
     * Sie steht dort, wo die Routine wirklich laeuft: organizations.test.js
     * legt Zeilen an, die nur ueber organization_id haengen, ruft
     * DELETE /api/organizations/:id auf und erwartet 200 statt 500.
     *
     * Dieser Verweis wird abgesichert: Verschwinden jene Tests, faellt es hier
     * auf, statt dass die Schema-Haelfte allein Sicherheit vortaeuscht.
     */
    it('die Loeschroutine wird in tests/routes/organizations.test.js geprueft', () => {
      const fs = require('fs');
      const path = require('path');
      const routenTest = fs.readFileSync(
        path.join(__dirname, '..', 'routes', 'organizations.test.js'), 'utf8'
      );

      expect(routenTest).toContain('Timeslot ohne Termin-Zuordnung blockiert das Loeschen');
      expect(routenTest).toContain('Benachrichtigung an einen Gast aus einer anderen Organisation');
    });
  });
});
