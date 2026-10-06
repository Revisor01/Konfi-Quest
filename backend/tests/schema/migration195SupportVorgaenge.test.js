// MIGRATION 195: Support-Vorgaenge (Simon, 03.10.2026;
// docs/planung/support-vorgaenge.md).
//
// Geprueft auf dem Stand, auf den die Migration beim Deploy trifft (nach 194,
// mit einem Bestand aus Anfragen und Mails): VORHER/NACHHER mit konkreten
// Werten -- jede Anfrage bekommt ihren Vorgang (Statusabbildung, Archiv bei
// angelegt/abgelehnt), ihre Mails die vorgang_id, die Mails einer Gemeinde
// ohne Anfrage kommen je Gemeinde in einen Vorgang "Schriftwechsel", der
// Posteingang bleibt Posteingang. Dazu die CHECKs, die Fremdschluessel
// (Gemeinde, Anfrage, Vorgang weg -> Zeilen weg; Konto weg -> erstellt_von
// NULL) und: ein zweiter Lauf aendert nichts.
const {
  dbAnlegen, dbWegraeumen, produktionAufbauen, migrationLesen,
} = require('../helpers/schemaAufbau');

const MIGRATION = '195_support_vorgaenge.sql';
const DB = 'konfi_test_mig195';

describe('Migration 195 auf einem Bestand aus Anfragen und Mails', () => {
  let pool;
  const ids = {};

  const tag = (t) => new Date(Date.UTC(2026, 8, t, 10, 0, 0)); // September 2026

  const anfrage = async (name, f) => {
    const { rows: [{ id }] } = await pool.query(
      `INSERT INTO gemeinde_anfragen (gemeinde, kontakt_name, email, einwilligung_am, status, status_seit,
                                      nachricht, notiz, organization_id, created_at, updated_at)
       VALUES ($1, 'K', $2, $3, $4, $5, $6, $7, $8, $3, $9) RETURNING id`,
      [`Gemeinde ${name}`, `${name}@example.test`, f.eingang, f.status, f.seit, f.nachricht || null,
        f.notiz || null, f.organization_id || null, f.geaendert || f.seit]);
    ids[name] = Number(id);
  };

  const mail = async (name, f) => {
    const { rows: [{ id }] } = await pool.query(
      `INSERT INTO mail_nachrichten (postfach, richtung, anfrage_id, organization_id, message_id, text, gesendet_am, gelesen_am)
       VALUES ('moin', $1, $2, $3, $4, 'Hallo', $5, $6) RETURNING id`,
      [f.richtung || 'ein', f.anfrage_id || null, f.organization_id || null, `<${name}@x.example>`, f.am, f.gelesen || null]);
    ids[name] = Number(id);
  };

  const vorgaenge = async () => (await pool.query(
    `SELECT id, art, bereich, dringlichkeit, status, status_seit, betreff, beschreibung, quelle,
            organization_id, anfrage_id, erstellt_von, notiz, archiviert_am, created_at, updated_at
       FROM support_vorgaenge ORDER BY id`)).rows;
  const mailVorgang = async () => Object.fromEntries((await pool.query(
    'SELECT message_id, vorgang_id, anfrage_id, organization_id FROM mail_nachrichten ORDER BY id'))
    .rows.map((r) => [r.message_id, [r.vorgang_id === null ? null : Number(r.vorgang_id), r.anfrage_id === null ? null : Number(r.anfrage_id), r.organization_id === null ? null : Number(r.organization_id)]]));

  beforeAll(async () => {
    pool = await dbAnlegen(DB);
    await produktionAufbauen(pool, { vor: MIGRATION });
    for (const [n, name] of [[1, 'A'], [2, 'B'], [3, 'C'], [4, 'D']]) {
      const { rows: [{ id }] } = await pool.query(
        'INSERT INTO organizations (name, slug, display_name) VALUES ($1, $1, $2) RETURNING id', [`g195-${n}`, `Gemeinde ${name}`]);
      ids[`org${name}`] = Number(id);
    }
    // Eingang in dieser Reihenfolge: neu, in Arbeit, angelegt, abgelehnt -- die
    // Nummern der Vorgaenge folgen dem Eingang, nicht der Kennung.
    await anfrage('a4', { eingang: tag(4), status: 'abgelehnt', seit: tag(25), nachricht: 'Abgelehnt-Text' });
    await anfrage('a1', { eingang: tag(1), status: 'neu', seit: tag(1), nachricht: 'Text eins', notiz: 'Notiz eins', geaendert: tag(2) });
    await anfrage('a3', { eingang: tag(3), status: 'angelegt', seit: tag(20), organization_id: ids.orgA, nachricht: null });
    await anfrage('a2', { eingang: tag(2), status: 'in_arbeit', seit: tag(5) });

    await mail('m1', { anfrage_id: ids.a1, am: tag(6) });
    await mail('m2', { anfrage_id: ids.a1, richtung: 'aus', am: tag(7), gelesen: tag(7) });
    await mail('m3', { anfrage_id: ids.a3, am: tag(8), gelesen: tag(9) });
    await mail('m4', { organization_id: ids.orgA, am: tag(10), gelesen: tag(11) });
    await mail('m5', { organization_id: ids.orgA, richtung: 'aus', am: tag(12), gelesen: tag(12) });
    await mail('m6', { organization_id: ids.orgB, am: tag(13) });
    await mail('m7', { am: tag(14) }); // Posteingang
    await mail('m8', { organization_id: ids.orgB, am: tag(15), gelesen: tag(16) });
  }, 180000);

  afterAll(async () => {
    await dbWegraeumen(pool, DB);
  }, 120000);

  it('Ausgangslage: keine Tabelle, keine Spalten an den Mails', async () => {
    const { rows } = await pool.query(
      `SELECT (SELECT COUNT(*)::int FROM pg_tables WHERE tablename = 'support_vorgaenge') AS tabelle,
              (SELECT COUNT(*)::int FROM information_schema.columns
                WHERE table_name = 'mail_nachrichten' AND column_name IN ('vorgang_id', 'archiviert_am')) AS spalten`);
    expect(rows[0]).toEqual({ tabelle: 0, spalten: 0 });
  });

  it('übernimmt jede Anfrage als Vorgang: Status, Archiv, Betreff, Text, Notiz, Gemeinde; Nummern nach Eingang', async () => {
    await pool.query(migrationLesen(MIGRATION));
    const v = await vorgaenge();
    // Eingang: a1 (1.9.), a2 (2.9.), a3 (3.9.), a4 (4.9.) -> Nummern 1 bis 4,
    // danach die zwei Schriftwechsel.
    expect(v.slice(0, 4).map((x) => [Number(x.id), x.anfrage_id === null ? null : Number(x.anfrage_id)]))
      .toEqual([[1, ids.a1], [2, ids.a2], [3, ids.a3], [4, ids.a4]]);

    const [v1, v2, v3, v4] = v;
    expect([v1.art, v1.status, v1.betreff, v1.beschreibung, v1.notiz, v1.quelle, v1.dringlichkeit, v1.bereich, v1.organization_id, v1.archiviert_am])
      .toEqual(['neue_gemeinde', 'neu', 'Anfrage: Gemeinde a1', 'Text eins', 'Notiz eins', 'anfrage', 'normal', null, null, null]);
    expect(v1.created_at).toEqual(tag(1));
    expect(v1.updated_at).toEqual(tag(2));
    expect(v1.status_seit).toEqual(tag(1));

    expect([v2.status, v2.archiviert_am, v2.status_seit]).toEqual(['in_arbeit', null, tag(5)]);

    // angelegt -> erledigt und archiviert seit der Entscheidung; die Gemeinde bleibt am Vorgang
    expect([v3.status, v3.archiviert_am, v3.status_seit, Number(v3.organization_id)]).toEqual(['erledigt', tag(20), tag(20), ids.orgA]);
    // abgelehnt -> erledigt und archiviert
    expect([v4.status, v4.archiviert_am, v4.beschreibung]).toEqual(['erledigt', tag(25), 'Abgelehnt-Text']);
    expect(v.every((x) => x.erstellt_von === null)).toBe(true);
  });

  it('Mails der Anfragen bekommen vorgang_id, ihre Zuordnung bleibt; Gemeinde-Mails ohne Anfrage kommen je Gemeinde in einen „Schriftwechsel“', async () => {
    const v = await vorgaenge();
    expect(v.length).toBe(6);
    const [sa, sb] = v.slice(4);
    // Gemeinde A: eine Mail eingehend gelesen, eine ausgehend -> in Arbeit
    expect([Number(sa.id), sa.art, sa.status, sa.betreff, sa.quelle, Number(sa.organization_id), sa.anfrage_id, sa.archiviert_am])
      .toEqual([5, 'sonstiges', 'in_arbeit', 'Schriftwechsel', 'mail', ids.orgA, null, null]);
    expect([sa.created_at, sa.updated_at]).toEqual([tag(10), tag(12)]);
    // Gemeinde B: eine eingehende Mail ungelesen -> neu
    expect([Number(sb.id), sb.status, Number(sb.organization_id)]).toEqual([6, 'neu', ids.orgB]);
    expect([sb.created_at, sb.updated_at]).toEqual([tag(13), tag(15)]);

    expect(await mailVorgang()).toEqual({
      '<m1@x.example>': [1, ids.a1, null],
      '<m2@x.example>': [1, ids.a1, null],
      '<m3@x.example>': [3, ids.a3, null],
      '<m4@x.example>': [5, null, ids.orgA],
      '<m5@x.example>': [5, null, ids.orgA],
      '<m6@x.example>': [6, null, ids.orgB],
      '<m7@x.example>': [null, null, null],
      '<m8@x.example>': [6, null, ids.orgB],
    });
    // keine Mail ist archiviert
    expect((await pool.query('SELECT COUNT(*)::int AS n FROM mail_nachrichten WHERE archiviert_am IS NOT NULL')).rows[0].n).toBe(0);
  });

  it('ein zweiter Lauf ändert nichts -- weder Vorgänge noch Mails', async () => {
    const vorherV = await vorgaenge();
    const vorherM = await mailVorgang();
    await pool.query(migrationLesen(MIGRATION));
    expect(await vorgaenge()).toEqual(vorherV);
    expect(await mailVorgang()).toEqual(vorherM);
  });

  it('ein dritter Lauf holt nach, was inzwischen ohne Vorgang dazukam (Anfrage und Gemeinde-Mail), und rührt Vorhandenes nicht an', async () => {
    await anfrage('a5', { eingang: tag(17), status: 'neu', seit: tag(17), nachricht: 'Spät' });
    await mail('m9', { anfrage_id: ids.a5, am: tag(18) });
    await mail('m10', { organization_id: ids.orgC, am: tag(19), gelesen: tag(19), richtung: 'aus' });
    const vorher = await vorgaenge();
    await pool.query(migrationLesen(MIGRATION));
    const nachher = await vorgaenge();
    expect(nachher.slice(0, 6)).toEqual(vorher);
    expect(nachher.map((x) => [Number(x.id), x.betreff, x.status])).toEqual([
      ...vorher.map((x) => [Number(x.id), x.betreff, x.status]),
      [7, 'Anfrage: Gemeinde a5', 'neu'],
      [8, 'Schriftwechsel', 'in_arbeit'],
    ]);
    const m = await mailVorgang();
    expect([m['<m9@x.example>'], m['<m10@x.example>']]).toEqual([[7, ids.a5, null], [8, null, ids.orgC]]);
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

  const neu = (f = {}) => {
    const w = { art: 'frage', bereich: null, dringlichkeit: 'normal', status: 'neu', archiviert_am: null, quelle: 'support', betreff: 'B', ...f };
    return pool.query(
      `INSERT INTO support_vorgaenge (art, bereich, dringlichkeit, status, archiviert_am, quelle, betreff, organization_id, anfrage_id, erstellt_von)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      [w.art, w.bereich, w.dringlichkeit, w.status, w.archiviert_am, w.quelle, w.betreff, w.organization_id || null, w.anfrage_id || null, w.erstellt_von || null]);
  };

  it('erlaubt: jede Art, jeder Bereich, jede Dringlichkeit, jeder Status, jede Quelle', async () => {
    for (const art of ['neue_gemeinde', 'frage', 'fehler', 'wunsch', 'zugang', 'lizenz', 'datenschutz', 'sonstiges']) await neu({ art });
    for (const bereich of ['konfis', 'termine', 'punkte', 'challenges', 'chat', 'badges', 'material', 'konten', 'einstellungen', 'sonstiges']) await neu({ bereich });
    await neu({ dringlichkeit: 'dringend' });
    for (const status of ['neu', 'in_arbeit', 'wartet']) await neu({ status });
    await neu({ status: 'erledigt', archiviert_am: new Date() });
    for (const quelle of ['anfrage', 'formular', 'mail', 'support']) await neu({ quelle });
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

    // Anfrage a1 weg: Vorgang 1 und seine Mails m1, m2 gehen mit
    await pool.query('DELETE FROM gemeinde_anfragen WHERE id = $1', [ids.a1]);
    expect((await pool.query('SELECT COUNT(*)::int AS n FROM support_vorgaenge WHERE id = 1')).rows[0].n).toBe(0);
    expect((await pool.query("SELECT COUNT(*)::int AS n FROM mail_nachrichten WHERE message_id IN ('<m1@x.example>', '<m2@x.example>')")).rows[0].n).toBe(0);

    // Gemeinde B weg: Schriftwechsel 6 und Mails m6, m8 gehen mit, Posteingang bleibt
    await pool.query('DELETE FROM organizations WHERE id = $1', [ids.orgB]);
    expect((await pool.query('SELECT COUNT(*)::int AS n FROM support_vorgaenge WHERE id = 6')).rows[0].n).toBe(0);
    expect((await pool.query("SELECT message_id FROM mail_nachrichten WHERE message_id IN ('<m6@x.example>', '<m7@x.example>', '<m8@x.example>')")).rows)
      .toEqual([{ message_id: '<m7@x.example>' }]);
  });

  it('Vorgang weg -> seine Mails weg, Mails anderer Vorgänge und des Posteingangs bleiben', async () => {
    const { rows: [{ id }] } = await neu({});
    await pool.query(
      `INSERT INTO mail_nachrichten (postfach, richtung, message_id, vorgang_id) VALUES ('support', 'ein', '<v195@x.example>', $1)`, [id]);
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

describe('Migration 195: Texte über der Grenze der neuen Tabelle', () => {
  // Die Routen lassen höchstens 5.000 Zeichen zu, die Tabelle der Anfragen
  // kennt keine Grenze. Ein von Hand eingetragener längerer Text darf die
  // Migration nicht scheitern lassen (CHECK support_vorgaenge_text_laenge).
  const DB_LANG = 'konfi_test_mig195_lang';
  let pool;

  beforeAll(async () => {
    pool = await dbAnlegen(DB_LANG);
    await produktionAufbauen(pool, { vor: MIGRATION });
  }, 180000);
  afterAll(async () => {
    await dbWegraeumen(pool, DB_LANG);
  }, 120000);

  it('kürzt Nachricht und Notiz einer Anfrage auf 5.000 Zeichen; der Betreff bleibt innerhalb von 300', async () => {
    await pool.query(
      `INSERT INTO gemeinde_anfragen (gemeinde, kontakt_name, email, einwilligung_am, nachricht, notiz)
       VALUES ($1, 'K', 'k@example.test', NOW(), $2, $3)`,
      ['G'.repeat(500), 'n'.repeat(6000), 'o'.repeat(7000)]);
    await pool.query(migrationLesen(MIGRATION));
    const { rows: [v] } = await pool.query(
      'SELECT char_length(betreff) AS betreff, char_length(beschreibung) AS beschreibung, char_length(notiz) AS notiz FROM support_vorgaenge');
    expect(v).toEqual({ betreff: 300, beschreibung: 5000, notiz: 5000 });
    // Die Anfrage selbst bleibt, wie sie war.
    const { rows: [a] } = await pool.query('SELECT char_length(nachricht) AS nachricht, char_length(notiz) AS notiz FROM gemeinde_anfragen');
    expect(a).toEqual({ nachricht: 6000, notiz: 7000 });
  });
});
