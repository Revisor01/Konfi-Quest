// MIGRATION 209: Zustands-Mitteilungen zu geloeschten Antraegen verlassen
// das Postfach (09.10.2026).
//
// Seit dem 25.09.2026 nimmt jedes Loeschen eines Antrags "Neuer Antrag" und
// "Antrag eingereicht" mit (utils/postfachAufraeumen.js,
// loescheMitteilungenZuAntraegen). Was vorher geloescht wurde, liess diese
// Mitteilungen stehen: gezaehlt am 09.10.2026 in Produktion 51, davon 33
// ungelesen in der roten Zahl. Die Migration raeumt sie nach derselben Regel
// weg.
//
// Geprueft wird die WIRKUNG der echten Datei aus backend/migrations/ auf
// einem nachgebauten Bestand: was geht, was bleibt, dass ein zweiter Lauf
// nichts mehr findet -- und dass sie dasselbe trifft wie das Loeschen heute.
const fs = require('fs');
const path = require('path');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ACTIVITIES } = require('../helpers/seed');
const { ZUSTANDS_ARTEN_ANTRAG, loescheMitteilungenZuAntraegen } = require('../../utils/postfachAufraeumen');

const MIGRATION = fs.readFileSync(
  path.join(__dirname, '..', '..', 'migrations', '209_postfach_tote_antragsmitteilungen.sql'),
  'utf8'
);
const ORG = 1;

describe('Migration 209: tote Antrags-Mitteilungen', () => {
  let db;

  beforeAll(() => { db = getTestPool(); });
  afterAll(async () => { await closePool(); });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
  });

  const antrag = async () => (await db.query(
    `INSERT INTO activity_requests (user_id, activity_id, requested_date, status, organization_id)
     VALUES ($1, $2, '2026-09-20', 'pending', $3) RETURNING id`,
    [USERS.konfi1.id, ACTIVITIES.sonntagsgottesdienst.id, ORG]
  )).rows[0].id;

  // Wie die Schreibstellen: request_id mal als Zahl, mal als Text.
  const eintrag = async (titel, type, data, { userId = USERS.admin1.id, gelesen = false } = {}) => {
    await db.query(
      `INSERT INTO notifications (user_id, title, message, type, data, organization_id, created_at, read_at)
       VALUES ($1, $2, 'x', $3, $4, $5, '2026-09-20 10:00', $6)`,
      [userId, titel, type, data === undefined ? null : JSON.stringify(data), ORG, gelesen ? '2026-09-21 10:00' : null]
    );
  };
  const titel = async () => (await db.query(
    'SELECT title FROM notifications ORDER BY title'
  )).rows.map((r) => r.title);

  // Ein Antrag, den es nicht (mehr) gibt: angelegt und ohne Aufraeumen
  // geloescht -- genau so, wie es vor dem 25.09.2026 geschah.
  const geloeschterAntrag = async () => {
    const id = await antrag();
    await db.query('DELETE FROM activity_requests WHERE id = $1', [id]);
    return id;
  };

  it('die Arten in der Migration sind genau ZUSTANDS_ARTEN_ANTRAG', () => {
    const inDerMigration = [...MIGRATION.matchAll(/^\s+'([a-z_]+)',?\s*$/gm)].map((m) => m[1]);
    expect(inDerMigration.sort()).toEqual([...ZUSTANDS_ARTEN_ANTRAG].sort());
  });

  it('zum geloeschten Antrag gehen sie -- zum bestehenden, Entscheidungen und Zeilen ohne Kennung bleiben', async () => {
    const weg = await geloeschterAntrag();
    const da = await antrag();

    // Tot: Zustand eines Antrags, den es nicht mehr gibt (Zahl und Text).
    await eintrag('a-neu-tot', 'new_activity_request', { request_id: weg, konfi_id: USERS.konfi1.id });
    await eintrag('a-eingereicht-tot', 'activity_request_submitted', { request_id: String(weg) }, { userId: USERS.konfi1.id });
    await eintrag('a-neu-tot-gelesen', 'new_activity_request', { request_id: weg }, { gelesen: true });
    // Gegenprobe: Der Antrag besteht -- die Mitteilung ist gueltig und bleibt.
    await eintrag('b-neu-gueltig', 'new_activity_request', { request_id: da, konfi_id: USERS.konfi1.id });
    await eintrag('b-eingereicht-gueltig', 'activity_request_submitted', { request_id: String(da) }, { userId: USERS.konfi1.id });
    // Entscheidung zum geloeschten Antrag: Verlauf, bleibt.
    await eintrag('c-genehmigt', 'activity_request_decision', { request_id: weg, status: 'approved' }, { userId: USERS.konfi1.id });
    await eintrag('c-abgelehnt', 'activity_request_decision', { request_id: weg, status: 'rejected' }, { userId: USERS.konfi1.id });
    // Ohne Kennung: nicht geraten, bleibt.
    await eintrag('d-ohne-data', 'new_activity_request', null);
    await eintrag('d-leer', 'activity_request_submitted', { request_id: '' });

    const lauf = await db.query(MIGRATION);

    expect(lauf.rowCount).toBe(3);
    expect(await titel()).toEqual([
      'b-eingereicht-gueltig', 'b-neu-gueltig', 'c-abgelehnt', 'c-genehmigt', 'd-leer', 'd-ohne-data',
    ]);
  });

  it('die ungelesenen toten verlassen die rote Zahl, die gueltige zaehlt weiter', async () => {
    const weg = await geloeschterAntrag();
    const da = await antrag();
    await eintrag('tot', 'new_activity_request', { request_id: weg });
    await eintrag('gueltig', 'new_activity_request', { request_id: da });
    const ungelesen = async () => Number((await db.query(
      'SELECT COUNT(*)::int AS n FROM notifications WHERE user_id = $1 AND read_at IS NULL',
      [USERS.admin1.id]
    )).rows[0].n);

    expect(await ungelesen()).toBe(2);
    await db.query(MIGRATION);
    expect(await ungelesen()).toBe(1);
  });

  it('trifft dasselbe wie das Loeschen heute (loescheMitteilungenZuAntraegen)', async () => {
    // Zwei gleiche Bestaende: Der eine Antrag wird heute geloescht (mit
    // Aufraeumen), der andere frueher (ohne) und dann von der Migration
    // nachgezogen. Danach muss dasselbe uebrig sein.
    const heute = await antrag();
    const frueher = await antrag();
    for (const [id, vorsilbe] of [[heute, 'h'], [frueher, 'f']]) {
      await eintrag(`${vorsilbe}-neu`, 'new_activity_request', { request_id: id });
      await eintrag(`${vorsilbe}-eingereicht`, 'activity_request_submitted', { request_id: String(id) });
      await eintrag(`${vorsilbe}-genehmigt`, 'activity_request_decision', { request_id: id, status: 'approved' });
    }

    await db.query('DELETE FROM activity_requests WHERE id = $1', [heute]);
    const vomLoeschen = await loescheMitteilungenZuAntraegen(db, [heute]);
    await db.query('DELETE FROM activity_requests WHERE id = $1', [frueher]);
    const vonDerMigration = (await db.query(MIGRATION)).rowCount;

    expect(vomLoeschen).toBe(2);
    expect(vonDerMigration).toBe(2);
    expect(await titel()).toEqual(['f-genehmigt', 'h-genehmigt']);
  });

  it('ein zweiter Lauf findet nichts mehr', async () => {
    const weg = await geloeschterAntrag();
    await eintrag('tot', 'new_activity_request', { request_id: weg });

    const erster = await db.query(MIGRATION);
    const zweiter = await db.query(MIGRATION);

    expect(erster.rowCount).toBe(1);
    expect(zweiter.rowCount).toBe(0);
    expect(await titel()).toEqual([]);
  });
});
