// MIGRATION 195: Support-Vorgaenge (Simon, 03.10.2026;
// docs/planung/support-vorgaenge.md).
//
// Seit 10.10.2026 steht 195 im Schema-Dump (tests/schema/prod-schema.sql),
// die Datei ist aus backend/migrations/ entfernt; der Test der Migration auf
// dem Stand davor (Uebernahme der Anfragen und Mails als Vorgaenge,
// Schriftwechsel je Gemeinde, Kuerzen ueberlanger Texte, zweiter und
// dritter Lauf) liegt in der Git-Historie (zuletzt Commit 3b935178). Auf
// einer neuen Instanz gab es nichts zu uebernehmen; der Datenteil des Dumps
// hat keine Vorgaenge.
//
// Geprueft wird hier auf einer Wegwerf-Datenbank aus dem Dump: die Spalten,
// die CHECKs, die Eindeutigkeit je Anfrage, die Fremdschluessel (Gemeinde,
// Anfrage, Vorgang weg -> Zeilen weg; Konto weg -> erstellt_von NULL) und
// die Indizes.
const { dbAnlegen, dbWegraeumen, produktionAufbauen } = require('../helpers/schemaAufbau');

const DB = 'konfi_test_mig195';

describe('Migration 195 im Schema-Dump', () => {
  let pool;
  const ids = {};

  const neu = (f = {}) => {
    const w = { art: 'frage', bereich: null, dringlichkeit: 'normal', status: 'neu', archiviert_am: null, quelle: 'support', betreff: 'B', ...f };
    return pool.query(
      `INSERT INTO support_vorgaenge (art, bereich, dringlichkeit, status, archiviert_am, quelle, betreff, organization_id, anfrage_id, erstellt_von)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      [w.art, w.bereich, w.dringlichkeit, w.status, w.archiviert_am, w.quelle, w.betreff, w.organization_id || null, w.anfrage_id || null, w.erstellt_von || null]);
  };
  const mail = (name, vorgangId) => pool.query(
    `INSERT INTO mail_nachrichten (postfach, richtung, message_id, vorgang_id) VALUES ('moin', 'ein', $1, $2)`,
    [`<${name}@x.example>`, vorgangId]);

  beforeAll(async () => {
    pool = await dbAnlegen(DB);
    await produktionAufbauen(pool);
    for (const name of ['B', 'D']) {
      const { rows: [{ id }] } = await pool.query(
        'INSERT INTO organizations (name, slug, display_name) VALUES ($1, $1, $2) RETURNING id', [`g195-${name}`, `Gemeinde ${name}`]);
      ids[`org${name}`] = Number(id);
    }
    const { rows: [{ id: a1 }] } = await pool.query(
      `INSERT INTO gemeinde_anfragen (gemeinde, kontakt_name, email, einwilligung_am)
       VALUES ('Gemeinde a1', 'K', 'a1@example.test', NOW()) RETURNING id`);
    ids.a1 = Number(a1);
  }, 180000);

  afterAll(async () => {
    await dbWegraeumen(pool, DB);
  }, 120000);

  it('eine neue Instanz hat keine Vorgänge', async () => {
    expect((await pool.query('SELECT COUNT(*)::int AS n FROM support_vorgaenge')).rows[0].n).toBe(0);
  });

  it('Spalten von support_vorgaenge und der neuen Mail-Spalten', async () => {
    const { rows } = await pool.query(
      `SELECT column_name, data_type, is_nullable FROM information_schema.columns
        WHERE table_name = 'support_vorgaenge' ORDER BY ordinal_position`);
    expect(rows.map((r) => [r.column_name, r.data_type, r.is_nullable])).toEqual([
      ['id', 'bigint', 'NO'],
      ['art', 'text', 'NO'],
      ['bereich', 'text', 'YES'],
      ['dringlichkeit', 'text', 'NO'],
      ['status', 'text', 'NO'],
      ['status_seit', 'timestamp with time zone', 'NO'],
      ['betreff', 'text', 'NO'],
      ['beschreibung', 'text', 'YES'],
      ['quelle', 'text', 'NO'],
      ['organization_id', 'bigint', 'YES'],
      ['anfrage_id', 'bigint', 'YES'],
      ['erstellt_von', 'bigint', 'YES'],
      ['kontakt_name', 'text', 'YES'],
      ['kontakt_email', 'text', 'YES'],
      ['kontakt_funktion', 'text', 'YES'],
      ['gemeinde_angabe', 'text', 'YES'],
      ['einwilligung_am', 'timestamp with time zone', 'YES'],
      ['notiz', 'text', 'YES'],
      ['archiviert_am', 'timestamp with time zone', 'YES'],
      ['created_at', 'timestamp with time zone', 'NO'],
      ['updated_at', 'timestamp with time zone', 'NO'],
    ]);
    const { rows: mails } = await pool.query(
      `SELECT column_name, data_type, is_nullable FROM information_schema.columns
        WHERE table_name = 'mail_nachrichten' AND column_name IN ('vorgang_id', 'archiviert_am') ORDER BY 1`);
    expect(mails.map((r) => [r.column_name, r.data_type, r.is_nullable])).toEqual([
      ['archiviert_am', 'timestamp with time zone', 'YES'],
      ['vorgang_id', 'bigint', 'YES'],
    ]);
  });

  it('erlaubt: jede Art, jeder Bereich, jede Dringlichkeit, jeder Status, jede Quelle', async () => {
    let n = 0;
    for (const art of ['neue_gemeinde', 'frage', 'fehler', 'wunsch', 'zugang', 'lizenz', 'datenschutz', 'sonstiges']) { await neu({ art }); n += 1; }
    for (const bereich of ['konfis', 'termine', 'punkte', 'challenges', 'chat', 'badges', 'material', 'konten', 'einstellungen', 'sonstiges']) { await neu({ bereich }); n += 1; }
    await neu({ dringlichkeit: 'dringend' }); n += 1;
    for (const status of ['neu', 'in_arbeit', 'wartet']) { await neu({ status }); n += 1; }
    await neu({ status: 'erledigt', archiviert_am: new Date() }); n += 1;
    for (const quelle of ['anfrage', 'formular', 'mail', 'support']) { await neu({ quelle }); n += 1; }
    expect((await pool.query('SELECT COUNT(*)::int AS n FROM support_vorgaenge')).rows[0].n).toBe(n);
  });

  it.each([
    ['unbekannte Art', { art: 'beschwerde' }],
    ['unbekannter Bereich', { bereich: 'kaffee' }],
    ['unbekannte Dringlichkeit', { dringlichkeit: 'egal' }],
    ['unbekannter Status', { status: 'offen' }],
    ['unbekannte Quelle', { quelle: 'telefon' }],
    ['erledigt ohne Archiv', { status: 'erledigt', archiviert_am: null }],
    ['leerer Betreff', { betreff: '   ' }],
    ['Betreff über 300 Zeichen', { betreff: 'x'.repeat(301) }],
  ])('verboten (CHECK): %s', async (_fall, felder) => {
    await expect(neu(felder)).rejects.toMatchObject({ code: '23514' });
  });

  it('verboten (UNIQUE): zwei Vorgänge zu derselben Anfrage', async () => {
    await neu({ anfrage_id: ids.a1, quelle: 'anfrage' });
    await expect(neu({ anfrage_id: ids.a1, quelle: 'anfrage' })).rejects.toMatchObject({ code: '23505' });
  });

  it('Konto weg -> erstellt_von NULL; Anfrage weg -> Vorgang und Mails weg; Gemeinde weg -> Vorgänge und Mails weg', async () => {
    const { rows: [{ id: rolle }] } = await pool.query(
      "INSERT INTO roles (name, display_name, organization_id) VALUES ('org_admin', 'Org', $1) RETURNING id", [ids.orgD]);
    const { rows: [{ id: userId }] } = await pool.query(
      "INSERT INTO users (username, display_name, role_id, organization_id) VALUES ('support195', 'S', $1, $2) RETURNING id", [rolle, ids.orgD]);
    const { rows: [{ id: vorgang }] } = await neu({ erstellt_von: userId, organization_id: ids.orgD });
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    expect((await pool.query('SELECT erstellt_von FROM support_vorgaenge WHERE id = $1', [vorgang])).rows).toEqual([{ erstellt_von: null }]);

    // Anfrage a1 weg: ihr Vorgang und dessen Mail gehen mit
    const { rows: [{ id: zurAnfrage }] } = await pool.query('SELECT id FROM support_vorgaenge WHERE anfrage_id = $1', [ids.a1]);
    await mail('m1', zurAnfrage);
    await pool.query('DELETE FROM gemeinde_anfragen WHERE id = $1', [ids.a1]);
    expect((await pool.query('SELECT COUNT(*)::int AS n FROM support_vorgaenge WHERE id = $1', [zurAnfrage])).rows[0].n).toBe(0);
    expect((await pool.query("SELECT COUNT(*)::int AS n FROM mail_nachrichten WHERE message_id = '<m1@x.example>'")).rows[0].n).toBe(0);

    // Gemeinde B weg: ihr Vorgang und dessen Mail gehen mit, der Posteingang bleibt
    const { rows: [{ id: zurGemeinde }] } = await neu({ organization_id: ids.orgB, quelle: 'mail', art: 'sonstiges', betreff: 'Schriftwechsel' });
    await mail('m6', zurGemeinde);
    await mail('m7', null);
    await pool.query('DELETE FROM organizations WHERE id = $1', [ids.orgB]);
    expect((await pool.query('SELECT COUNT(*)::int AS n FROM support_vorgaenge WHERE id = $1', [zurGemeinde])).rows[0].n).toBe(0);
    expect((await pool.query("SELECT message_id FROM mail_nachrichten WHERE message_id IN ('<m6@x.example>', '<m7@x.example>')")).rows)
      .toEqual([{ message_id: '<m7@x.example>' }]);
  });

  it('Vorgang weg -> seine Mails weg, Mails des Posteingangs bleiben', async () => {
    const { rows: [{ id }] } = await neu({});
    await mail('v195', id);
    await pool.query('DELETE FROM support_vorgaenge WHERE id = $1', [id]);
    expect((await pool.query("SELECT COUNT(*)::int AS n FROM mail_nachrichten WHERE message_id = '<v195@x.example>'")).rows[0].n).toBe(0);
    expect((await pool.query("SELECT COUNT(*)::int AS n FROM mail_nachrichten WHERE message_id = '<m7@x.example>'")).rows[0].n).toBe(1);
  });

  it('Indizes für Listen, Archiv, Gemeinde, Verlauf und ungelesene Mails', async () => {
    const { rows } = await pool.query(
      `SELECT indexname FROM pg_indexes
        WHERE (tablename = 'support_vorgaenge')
           OR (tablename = 'mail_nachrichten' AND indexname IN
               ('idx_mail_nachrichten_archiviert', 'idx_mail_nachrichten_vorgang', 'idx_mail_nachrichten_vorgang_ungelesen'))
        ORDER BY 1`);
    expect(rows.map((r) => r.indexname)).toEqual([
      'idx_mail_nachrichten_archiviert',
      'idx_mail_nachrichten_vorgang',
      'idx_mail_nachrichten_vorgang_ungelesen',
      'idx_support_vorgaenge_archiv',
      'idx_support_vorgaenge_art',
      'idx_support_vorgaenge_erstellt_von',
      'idx_support_vorgaenge_offen',
      'idx_support_vorgaenge_organization',
      'support_vorgaenge_anfrage_key',
      'support_vorgaenge_pkey',
    ]);
  });
});
