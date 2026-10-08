// MIGRATION 197: Teilnehmer-Typ im Event-Chat nach der Rolle in der Gemeinde
// des Termins (Simon, 08.10.2026; docs/planung/mehrfach-konten.md, Punkt 1).
//
// Geprueft auf dem Stand, auf den die Migration beim Deploy trifft: VORHER
// sitzt eine Person, die zuhause Gemeindeleitung und in B Teamer:in ist, in
// B's Event-Chat als 'admin'; NACHHER als 'teamer'. Stamm-Gemeinde, andere
// Raumarten, Konfis und Ehemalige bleiben, wie sie sind; ein zweiter Lauf
// aendert nichts.
const {
  dbAnlegen, dbWegraeumen, produktionAufbauen, migrationLesen,
} = require('../helpers/schemaAufbau');

const MIGRATION = '197_event_chat_teilnehmer_typ.sql';
const DB = 'konfi_test_mig197';

describe('Migration 197 auf einem Bestand aus Event-Chats', () => {
  let pool;
  const ids = {};

  const typen = async () => Object.fromEntries((await pool.query(
    'SELECT room_id, user_id, user_type FROM chat_participants ORDER BY id'
  )).rows.map((r) => [`${r.room_id}:${r.user_id}`, r.user_type]));

  beforeAll(async () => {
    pool = await dbAnlegen(DB);
    await produktionAufbauen(pool, { vor: MIGRATION });
    const q = async (sql, p) => (await pool.query(sql, p)).rows[0];
    ids.orgA = Number((await q("INSERT INTO organizations (name, slug, display_name) VALUES ('a197', 'a197', 'A') RETURNING id")).id);
    ids.orgB = Number((await q("INSERT INTO organizations (name, slug, display_name) VALUES ('b197', 'b197', 'B') RETURNING id")).id);
    const rolle = async (org, name) => Number((await q(
      'INSERT INTO roles (organization_id, name, display_name) VALUES ($1, $2, $2) RETURNING id', [org, name])).id);
    ids.orgAdminA = await rolle(ids.orgA, 'org_admin');
    ids.teamerA = await rolle(ids.orgA, 'teamer');
    ids.teamerB = await rolle(ids.orgB, 'teamer');
    ids.konfiB = await rolle(ids.orgB, 'konfi');
    ids.adminB = await rolle(ids.orgB, 'admin');
    const konto = async (name, org, role) => Number((await q(
      'INSERT INTO users (organization_id, role_id, username, display_name) VALUES ($1, $2, $3, $3) RETURNING id',
      [org, role, name])).id);
    ids.gast = await konto('gast', ids.orgA, ids.orgAdminA);      // zuhause Leitung, in B Teamer:in
    ids.konfi = await konto('konfi', ids.orgB, ids.konfiB);
    ids.adminB = await konto('admin-b', ids.orgB, ids.adminB);
    ids.ehemalig = await konto('ehemalig', ids.orgA, ids.orgAdminA); // nicht (mehr) in B
    await pool.query('INSERT INTO user_organizations (user_id, organization_id, role_id) VALUES ($1, $2, $3)',
      [ids.gast, ids.orgB, ids.teamerB]);
    // Altbestand aus Migration 101: Stamm-Zeile mit abweichender Rolle.
    await pool.query('INSERT INTO user_organizations (user_id, organization_id, role_id) VALUES ($1, $2, $3)',
      [ids.gast, ids.orgA, ids.teamerA]);
    const event = async (org) => Number((await q(
      "INSERT INTO events (name, organization_id, event_date) VALUES ('T', $1, NOW()) RETURNING id", [org])).id);
    const raum = async (org, eventId, typ = 'group') => Number((await q(
      'INSERT INTO chat_rooms (name, type, organization_id, event_id) VALUES ($1, $1, $2, $3) RETURNING id',
      [typ, org, eventId])).id);
    ids.raumB = await raum(ids.orgB, await event(ids.orgB));
    ids.raumA = await raum(ids.orgA, await event(ids.orgA));
    ids.gruppeB = await raum(ids.orgB, null);
    const sitzt = (room, user, typ) => pool.query(
      'INSERT INTO chat_participants (room_id, user_id, user_type) VALUES ($1, $2, $3)', [room, user, typ]);
    await sitzt(ids.raumB, ids.gast, 'admin');      // falsch: soll teamer
    await sitzt(ids.raumB, ids.konfi, 'konfi');
    await sitzt(ids.raumB, ids.adminB, 'admin');
    await sitzt(ids.raumB, ids.ehemalig, 'admin');  // keine Rolle in B -> bleibt
    await sitzt(ids.raumA, ids.gast, 'admin');      // Stamm: richtig
    await sitzt(ids.gruppeB, ids.gast, 'admin');    // kein Event-Chat -> unberuehrt
  }, 180000);

  afterAll(async () => { await dbWegraeumen(pool, DB); }, 120000);

  it('vorher: der Gast sitzt in B\'s Event-Chat als admin', async () => {
    expect((await typen())[`${ids.raumB}:${ids.gast}`]).toBe('admin');
  });

  it('nachher: genau die eine Zeile ist angeglichen', async () => {
    const vorher = await typen();
    const { rowCount } = await pool.query(migrationLesen(MIGRATION));
    expect(rowCount).toBe(1);
    expect(await typen()).toEqual({
      ...vorher,
      [`${ids.raumB}:${ids.gast}`]: 'teamer',
    });
    expect(vorher[`${ids.raumA}:${ids.gast}`]).toBe('admin');
    expect(vorher[`${ids.gruppeB}:${ids.gast}`]).toBe('admin');
    expect(vorher[`${ids.raumB}:${ids.ehemalig}`]).toBe('admin');
  });

  it('ein zweiter Lauf aendert nichts', async () => {
    const vorher = await typen();
    const { rowCount } = await pool.query(migrationLesen(MIGRATION));
    expect(rowCount).toBe(0);
    expect(await typen()).toEqual(vorher);
  });
});
