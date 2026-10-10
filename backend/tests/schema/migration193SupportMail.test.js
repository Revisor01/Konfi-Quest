// MIGRATION 193: Support-Mail (Simon, 03.10.2026; docs/planung/support-mail.md).
//
// Seit 10.10.2026 steht 193 im Schema-Dump (tests/schema/prod-schema.sql),
// die Datei ist aus backend/migrations/ entfernt; der Test der Migration auf
// dem Stand davor (Ausgangslage, zweiter Lauf, Startliste nur in eine leere
// Tabelle) liegt in der Git-Historie (zuletzt Commit 3b935178). Die
// Startliste der Textbausteine und die beiden Einstellungen sind
// DATENZEILEN: Sie kommen jetzt aus dem Datenteil des Dumps
// (schema-erneuern.sh) -- das ist hier der wichtigste Pruefpunkt. Geprueft
// auf einer Wegwerf-Datenbank aus dem Dump; die gemeinsame Test-Datenbank
// leert mail_bausteine und mail_einstellungen (helpers/db.js).
//
// Geprueft werden: die vier Tabellen mit
// ihren CHECKs (Postfach, Richtung, nie Anfrage UND Gemeinde, Text
// hoechstens 50.000 Zeichen), die eindeutige Message-ID, die Fremdschluessel
// (Anfrage/Gemeinde weg -> Mails weg; Konto weg -> Verweis NULL), die
// Indizes fuer Verlauf, Posteingang und ungelesene Mails, die Startliste
// der Textbausteine (nur in eine leere Tabelle) und die neutralen
// Einstellungen -- dieselben wie im Code (utils/mailEinstellungen.js).
const { dbAnlegen, dbWegraeumen, produktionAufbauen } = require('../helpers/schemaAufbau');
const { STANDARD_EINSTELLUNGEN } = require('../../utils/mailEinstellungen');

const DB = 'konfi_test_mig193';

const STARTLISTE = [
  ['Eingang bestätigt / Rückfrage', 'moin', 10],
  ['Zugangsdaten unterwegs', 'moin', 20],
  ['Testphase endet bald', 'support', 30],
  ['Lizenzangebot', null, 40],
  ['Absage', 'moin', 50],
];

describe('Migration 193 im Schema-Dump', () => {
  let pool;
  let anfrageId;
  let orgId;
  let userId;

  const mail = (felder = {}) => {
    const f = { postfach: 'moin', richtung: 'ein', anfrage_id: null, organization_id: null, message_id: `<${Math.random()}@x>`, text: 'Hallo', ...felder };
    return pool.query(
      `INSERT INTO mail_nachrichten (postfach, richtung, anfrage_id, organization_id, message_id, text, verfasst_von)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [f.postfach, f.richtung, f.anfrage_id, f.organization_id, f.message_id, f.text, f.verfasst_von || null]);
  };

  beforeAll(async () => {
    pool = await dbAnlegen(DB);
    await produktionAufbauen(pool);
    ({ rows: [{ id: orgId }] } = await pool.query(
      "INSERT INTO organizations (name, slug, display_name) VALUES ('g193', 'g193', 'Gemeinde 193') RETURNING id"));
    ({ rows: [{ id: anfrageId }] } = await pool.query(
      `INSERT INTO gemeinde_anfragen (gemeinde, kontakt_name, email, einwilligung_am)
       VALUES ('vorher', 'K', 'k@example.test', NOW()) RETURNING id`));
    const { rows: [{ id: rolle }] } = await pool.query(
      "INSERT INTO roles (name, display_name, organization_id) VALUES ('org_admin', 'Org', $1) RETURNING id", [orgId]);
    ({ rows: [{ id: userId }] } = await pool.query(
      "INSERT INTO users (username, display_name, role_id, organization_id) VALUES ('leitung193', 'L', $1, $2) RETURNING id",
      [rolle, orgId]));
  }, 180000);

  afterAll(async () => {
    await dbWegraeumen(pool, DB);
  }, 120000);

  it('die vier Tabellen; Startliste der Bausteine und neutrale Einstellungen aus dem Datenteil des Dumps', async () => {
    const { rows: tabellen } = await pool.query(
      "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'mail\\_%' ORDER BY 1");
    expect(tabellen.map((t) => t.tablename)).toEqual(['mail_abholstand', 'mail_bausteine', 'mail_einstellungen', 'mail_nachrichten']);

    const { rows: bausteine } = await pool.query('SELECT titel, postfach, sortierung, betreff, text FROM mail_bausteine ORDER BY sortierung');
    expect(bausteine.map((b) => [b.titel, b.postfach, b.sortierung])).toEqual(STARTLISTE);
    expect(bausteine.every((b) => b.betreff === null && b.text.startsWith('Hallo {{name}},') && b.text.endsWith('Viele Grüße\n{{absender}}'))).toBe(true);
    // Das Passwort geht nie per Mail: kein Platzhalter dafuer, und der
    // Baustein "Zugangsdaten" sagt es.
    expect(bausteine.some((b) => /\{\{\s*passwort/i.test(b.text))).toBe(false);
    expect(bausteine[1].text).toContain('Das Passwort schicken wir euch nicht per Mail');
    expect(bausteine[1].text).toContain('{{benutzername}}');
    // Nur bekannte Platzhalter.
    const platzhalter = new Set(bausteine.flatMap((b) => [...b.text.matchAll(/\{\{([a-z_]+)\}\}/g)].map((m) => m[1])));
    expect([...platzhalter].sort()).toEqual(['absender', 'benutzername', 'gemeinde', 'lizenz', 'name', 'testphase_bis']);

    const { rows: einstellungen } = await pool.query('SELECT schluessel, wert FROM mail_einstellungen ORDER BY schluessel');
    expect(Object.fromEntries(einstellungen.map((e) => [e.schluessel, e.wert]))).toEqual({ ...STANDARD_EINSTELLUNGEN });
  });

  // Die letzten beiden Spalten und drei der Indizes kamen mit 195
  // (Support-Vorgaenge) dazu; der Dump traegt beide Stufen.
  it('Spalten von mail_nachrichten wie im Vertrag', async () => {
    const { rows } = await pool.query(
      `SELECT column_name, data_type, is_nullable FROM information_schema.columns
        WHERE table_name = 'mail_nachrichten' ORDER BY ordinal_position`);
    expect(rows.map((r) => [r.column_name, r.data_type, r.is_nullable])).toEqual([
      ['id', 'bigint', 'NO'],
      ['postfach', 'text', 'NO'],
      ['richtung', 'text', 'NO'],
      ['anfrage_id', 'bigint', 'YES'],
      ['organization_id', 'bigint', 'YES'],
      ['message_id', 'text', 'NO'],
      ['in_reply_to', 'text', 'YES'],
      ['referenzen', 'ARRAY', 'NO'],
      ['von_adresse', 'text', 'YES'],
      ['von_name', 'text', 'YES'],
      ['an_adressen', 'ARRAY', 'NO'],
      ['betreff', 'text', 'NO'],
      ['text', 'text', 'NO'],
      ['anhaenge', 'jsonb', 'NO'],
      ['gesendet_am', 'timestamp with time zone', 'NO'],
      ['gelesen_am', 'timestamp with time zone', 'YES'],
      ['verfasst_von', 'bigint', 'YES'],
      ['imap_uid', 'bigint', 'YES'],
      ['created_at', 'timestamp with time zone', 'NO'],
      ['vorgang_id', 'bigint', 'YES'],
      ['archiviert_am', 'timestamp with time zone', 'YES'],
    ]);
  });

  it('erlaubt: Posteingang, zu einer Anfrage, zu einer Gemeinde; beide Postfächer, beide Richtungen', async () => {
    await mail({});
    await mail({ anfrage_id: anfrageId, richtung: 'aus' });
    await mail({ organization_id: orgId, postfach: 'support' });
    await mail({ text: 'x'.repeat(50000) });
    const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM mail_nachrichten');
    expect(rows[0].n).toBe(4);
  });

  it.each([
    ['Anfrage UND Gemeinde', () => ({ anfrage_id: anfrageId, organization_id: orgId })],
    ['fremdes Postfach', () => ({ postfach: 'team' })],
    ['fremde Richtung', () => ({ richtung: 'rein' })],
    ['Text über 50.000 Zeichen', () => ({ text: 'x'.repeat(50001) })],
  ])('verboten (CHECK): %s', async (_fall, felder) => {
    await expect(mail(felder())).rejects.toMatchObject({ code: '23514' });
  });

  it('verboten (UNIQUE): dieselbe Message-ID zweimal; ON CONFLICT DO NOTHING lässt die erste stehen', async () => {
    await mail({ message_id: '<einmal@x>' });
    await expect(mail({ message_id: '<einmal@x>' })).rejects.toMatchObject({ code: '23505' });
    const { rowCount } = await pool.query(
      "INSERT INTO mail_nachrichten (postfach, richtung, message_id) VALUES ('support', 'ein', '<einmal@x>') ON CONFLICT (message_id) DO NOTHING");
    expect(rowCount).toBe(0);
  });

  it('die Sequenz der Bausteine steht hinter der Startliste', async () => {
    const { rows: [{ id }] } = await pool.query(
      "INSERT INTO mail_bausteine (titel, text) VALUES ('Neu', 'T') RETURNING id");
    const { rows: [{ hoechste }] } = await pool.query(
      "SELECT MAX(id)::int AS hoechste FROM mail_bausteine WHERE titel <> 'Neu'");
    expect(hoechste).toBe(5);
    expect(Number(id)).toBe(6);
    await pool.query('DELETE FROM mail_bausteine WHERE id = $1', [id]);
  });

  it('Konto weg -> Verweis NULL, Mail und Baustein bleiben; Anfrage bzw. Gemeinde weg -> ihre Mails weg', async () => {
    const { rows: [{ id: antwort }] } = await mail({ anfrage_id: anfrageId, richtung: 'aus', verfasst_von: userId });
    const { rows: [{ id: baustein }] } = await pool.query(
      "INSERT INTO mail_bausteine (titel, text, bearbeitet_von) VALUES ('B', 'T', $1) RETURNING id", [userId]);
    await pool.query('UPDATE mail_einstellungen SET bearbeitet_von = $1', [userId]);
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    expect((await pool.query('SELECT verfasst_von FROM mail_nachrichten WHERE id = $1', [antwort])).rows).toEqual([{ verfasst_von: null }]);
    expect((await pool.query('SELECT bearbeitet_von FROM mail_bausteine WHERE id = $1', [baustein])).rows).toEqual([{ bearbeitet_von: null }]);
    expect((await pool.query('SELECT COUNT(*)::int AS n FROM mail_einstellungen WHERE bearbeitet_von IS NOT NULL')).rows[0].n).toBe(0);

    await pool.query('DELETE FROM gemeinde_anfragen WHERE id = $1', [anfrageId]);
    await pool.query('DELETE FROM roles WHERE organization_id = $1', [orgId]);
    await pool.query('DELETE FROM organizations WHERE id = $1', [orgId]);
    const { rows } = await pool.query('SELECT COUNT(*)::int AS n FROM mail_nachrichten WHERE anfrage_id IS NOT NULL OR organization_id IS NOT NULL');
    expect(rows[0].n).toBe(0);
  });

  it('CHECKs an Abholstand, Bausteinen und Einstellungen', async () => {
    await expect(pool.query("INSERT INTO mail_abholstand (postfach) VALUES ('team')")).rejects.toMatchObject({ code: '23514' });
    await expect(pool.query("INSERT INTO mail_bausteine (titel, text, postfach) VALUES ('x', 'y', 'team')")).rejects.toMatchObject({ code: '23514' });
    await expect(pool.query("INSERT INTO mail_einstellungen (schluessel, wert) VALUES ('signatur', 'x')")).rejects.toMatchObject({ code: '23514' });
    // erlaubt
    await pool.query("INSERT INTO mail_abholstand (postfach) VALUES ('moin'), ('support')");
    await pool.query("INSERT INTO mail_bausteine (titel, text, postfach) VALUES ('x', 'y', NULL), ('x', 'y', 'support')");
  });

  it('Indizes für Verlauf, Posteingang, Aufräumen, ungelesene Mails und Fäden', async () => {
    const { rows } = await pool.query(
      "SELECT indexname FROM pg_indexes WHERE tablename = 'mail_nachrichten' ORDER BY 1");
    expect(rows.map((r) => r.indexname)).toEqual([
      'idx_mail_nachrichten_anfrage',
      'idx_mail_nachrichten_archiviert',
      'idx_mail_nachrichten_eingang',
      'idx_mail_nachrichten_eingang_alter',
      'idx_mail_nachrichten_in_reply_to',
      'idx_mail_nachrichten_organization',
      'idx_mail_nachrichten_referenzen',
      'idx_mail_nachrichten_ungelesen',
      'idx_mail_nachrichten_verfasst_von',
      'idx_mail_nachrichten_vorgang',
      'idx_mail_nachrichten_vorgang_ungelesen',
      'mail_nachrichten_message_id_key',
      'mail_nachrichten_pkey',
    ]);
  });
});
