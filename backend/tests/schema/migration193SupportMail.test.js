// MIGRATION 193: Support-Mail (Simon, 03.10.2026; docs/planung/support-mail.md).
//
// Geprueft auf dem Stand, auf den die Migration beim Deploy trifft (nach
// 192, mit einer vorhandenen Anfrage und Gemeinde): die vier Tabellen mit
// ihren CHECKs (Postfach, Richtung, nie Anfrage UND Gemeinde, Text
// hoechstens 50.000 Zeichen), die eindeutige Message-ID, die Fremdschluessel
// (Anfrage/Gemeinde weg -> Mails weg; Konto weg -> Verweis NULL), die
// Indizes fuer Verlauf, Posteingang und ungelesene Mails, die Startliste
// der Textbausteine (nur in eine leere Tabelle) und die neutralen
// Einstellungen -- dieselben wie im Code (utils/mailEinstellungen.js). Ein
// zweiter Lauf aendert nichts.
const {
  dbAnlegen, dbWegraeumen, produktionAufbauen, migrationLesen,
} = require('../helpers/schemaAufbau');
const { STANDARD_EINSTELLUNGEN } = require('../../utils/mailEinstellungen');

const MIGRATION = '193_support_mail.sql';
const DB = 'konfi_test_mig193';

const STARTLISTE = [
  ['Eingang bestätigt / Rückfrage', 'moin', 10],
  ['Zugangsdaten unterwegs', 'moin', 20],
  ['Testphase endet bald', 'support', 30],
  ['Lizenzangebot', null, 40],
  ['Absage', 'moin', 50],
];

describe('Migration 193 auf dem Stand, auf den sie beim Deploy trifft', () => {
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
    await produktionAufbauen(pool, { vor: MIGRATION });
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

  it('Ausgangslage: keine der vier Tabellen', async () => {
    const { rows } = await pool.query(
      "SELECT COUNT(*)::int AS n FROM pg_tables WHERE schemaname = 'public' AND tablename LIKE 'mail\\_%'");
    expect(rows[0].n).toBe(0);
  });

  it('legt die vier Tabellen an; Startliste der Bausteine und neutrale Einstellungen', async () => {
    await pool.query(migrationLesen(MIGRATION));
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
      'idx_mail_nachrichten_eingang',
      'idx_mail_nachrichten_eingang_alter',
      'idx_mail_nachrichten_in_reply_to',
      'idx_mail_nachrichten_organization',
      'idx_mail_nachrichten_referenzen',
      'idx_mail_nachrichten_ungelesen',
      'idx_mail_nachrichten_verfasst_von',
      'mail_nachrichten_message_id_key',
      'mail_nachrichten_pkey',
    ]);
  });

  it('ein zweiter Lauf ändert nichts -- auch nicht an Bausteinen und Einstellungen, die jemand geändert hat', async () => {
    await pool.query("DELETE FROM mail_bausteine WHERE titel = 'Absage'");
    await pool.query("UPDATE mail_einstellungen SET wert = 'Eigener Name' WHERE schluessel = 'absendername'");
    const vorher = (await pool.query('SELECT titel FROM mail_bausteine ORDER BY id')).rows;
    await pool.query(migrationLesen(MIGRATION));
    expect((await pool.query('SELECT titel FROM mail_bausteine ORDER BY id')).rows).toEqual(vorher);
    expect((await pool.query("SELECT wert FROM mail_einstellungen WHERE schluessel = 'absendername'")).rows).toEqual([{ wert: 'Eigener Name' }]);
  });

  it('Startliste nur in eine leere Tabelle: Ist sie leer, kommt sie beim zweiten Lauf wieder', async () => {
    await pool.query('DELETE FROM mail_bausteine');
    await pool.query(migrationLesen(MIGRATION));
    expect((await pool.query('SELECT titel FROM mail_bausteine ORDER BY sortierung')).rows.map((r) => r.titel))
      .toEqual(STARTLISTE.map((s) => s[0]));
  });
});
