// MIGRATION 207: Konfisprueche personenunabhaengig (docs/messung/umami.md, S1).
//
// Geprueft auf dem Stand, auf den die Migration beim Deploy trifft: Der
// Bestand aus konfi_profiles kommt einmal herueber -- Vorschlag mit Stelle
// und Uebersetzung, eigener Spruch im Wortlaut, ohne Monat (unbekannt), ohne
// jeden Verweis auf die Person. Ein zweiter Lauf aendert nichts.
const {
  dbAnlegen, dbWegraeumen, produktionAufbauen, migrationLesen,
} = require('../helpers/schemaAufbau');

const MIGRATION = '207_konfspruch_wahlen.sql';
const DB = 'konfi_test_mig207';

describe('Migration 207 auf dem Stand, auf den sie beim Deploy trifft', () => {
  let pool;
  let orgId;
  let spruchId;

  beforeAll(async () => {
    pool = await dbAnlegen(DB);
    await produktionAufbauen(pool, { vor: MIGRATION });
    const { rows: [org] } = await pool.query(
      `INSERT INTO organizations (name, slug, display_name) VALUES ('G207', 'g207', 'G207') RETURNING id`);
    orgId = Number(org.id);
    const { rows: [rolle] } = await pool.query(
      `INSERT INTO roles (name, display_name, organization_id) VALUES ('konfi', 'Konfi', $1) RETURNING id`, [orgId]);
    const { rows: personen } = await pool.query(
      `INSERT INTO users (username, display_name, password_hash, role_id, organization_id)
       VALUES ('a207', 'Anna', 'x', $1, $2), ('b207', 'Ben', 'x', $1, $2), ('c207', 'Cem', 'x', $1, $2), ('d207', 'Dana', 'x', $1, $2)
       RETURNING id`, [rolle.id, orgId]);
    const { rows: [spruch] } = await pool.query(
      `INSERT INTO konfsprueche (reference, book, chapter, verse) VALUES ('Josua 1,9', 'Josua', 1, 9) RETURNING id`);
    spruchId = Number(spruch.id);
    const [p1, p2, p3, p4] = personen.map((x) => x.id);
    await pool.query(
      `INSERT INTO konfi_profiles (user_id, organization_id, konfspruch_id, konfspruch_translation, konfspruch_freitext, konfspruch_freitext_referenz)
       VALUES ($1, $5, $6, 'bigs', NULL, NULL),
              ($2, $5, NULL, NULL, 'Mein Vers', 'Röm 8,38'),
              ($3, $5, NULL, NULL, NULL, NULL),
              ($4, $5, NULL, NULL, '   ', 'leer')`,
      [p1, p2, p3, p4, orgId, spruchId]);
  }, 180000);

  afterAll(async () => {
    await dbWegraeumen(pool, DB);
  }, 120000);

  const zeilen = async () => (await pool.query(
    `SELECT organization_id::int AS organization_id, quelle, konfspruch_id::int AS konfspruch_id, stelle, translation,
            freitext, freitext_referenz, monat
       FROM konfspruch_wahlen ORDER BY quelle DESC, id`)).rows;

  it('uebernimmt den Bestand ohne Person und ohne Monat', async () => {
    await pool.query(migrationLesen(MIGRATION));
    expect(await zeilen()).toEqual([
      { organization_id: orgId, quelle: 'vorschlag', konfspruch_id: spruchId, stelle: 'Josua 1,9', translation: 'bigs', freitext: null, freitext_referenz: null, monat: null },
      { organization_id: orgId, quelle: 'eigen', konfspruch_id: null, stelle: null, translation: null, freitext: 'Mein Vers', freitext_referenz: 'Röm 8,38', monat: null },
    ]);
  });

  it('Quelle und Freitext muessen zusammenpassen', async () => {
    await expect(pool.query("INSERT INTO konfspruch_wahlen (quelle, freitext) VALUES ('vorschlag', 'x')"))
      .rejects.toMatchObject({ code: '23514' });
    await expect(pool.query("INSERT INTO konfspruch_wahlen (quelle) VALUES ('eigen')"))
      .rejects.toMatchObject({ code: '23514' });
    await expect(pool.query("INSERT INTO konfspruch_wahlen (quelle) VALUES ('irgendwas')"))
      .rejects.toMatchObject({ code: '23514' });
  });

  it('die Wahl bleibt, wenn Spruch oder Gemeinde gehen', async () => {
    await pool.query('UPDATE konfi_profiles SET konfspruch_id = NULL WHERE konfspruch_id = $1', [spruchId]);
    await pool.query('DELETE FROM konfsprueche WHERE id = $1', [spruchId]);
    const [vorschlag] = await zeilen();
    expect(vorschlag).toMatchObject({ konfspruch_id: null, stelle: 'Josua 1,9' });
  });

  it('ein zweiter Lauf aendert nichts', async () => {
    const vorher = await zeilen();
    await pool.query(migrationLesen(MIGRATION));
    expect(await zeilen()).toEqual(vorher);
    expect(vorher.length).toBe(2);
  });
});
