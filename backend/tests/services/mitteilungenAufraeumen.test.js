// backend/tests/services/mitteilungenAufraeumen.test.js
// cleanupAlteMitteilungen (25.09.2026): Postfach-Mitteilungen aelter als ein
// Jahr werden im 02:00-Cron geloescht. Gemessen in Produktion am 25.09.2026:
// 1.324 Zeilen, 570 in 30 Tagen; die Tabelle wuchs bisher ohne Grenze.
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS } = require('../helpers/seed');
const BackgroundService = require('../../services/backgroundService');

describe('cleanupAlteMitteilungen (Postfach-Aufraeumen)', () => {
  let db;

  beforeAll(() => {
    db = getTestPool();
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
  });

  afterAll(async () => {
    await closePool();
  });

  async function mitteilungVorTagen(tage, userId = USERS.konfi1.id) {
    const { rows } = await db.query(
      `INSERT INTO notifications (user_id, title, message, type, data, organization_id, created_at)
       VALUES ($1, 'Titel', 'Text', 'info', '{}', $2, NOW() - ($3 || ' days')::interval)
       RETURNING id`,
      [userId, ORGS.testGemeinde.id, String(tage)]
    );
    return rows[0].id;
  }

  it('loescht eine Mitteilung von vor 366 Tagen, behaelt eine von vor 364 Tagen; Rueckgabe 1', async () => {
    const alt = await mitteilungVorTagen(366);
    const jung = await mitteilungVorTagen(364);

    const geloescht = await BackgroundService.cleanupAlteMitteilungen(db);

    expect(geloescht).toBe(1);
    const { rows } = await db.query('SELECT id FROM notifications ORDER BY id');
    expect(rows.map((r) => r.id)).toEqual([jung]);
    expect(rows.map((r) => r.id)).not.toContain(alt);
  });

  it('loescht ueber alle Konten und Organisationen, nicht nur eines', async () => {
    await mitteilungVorTagen(400, USERS.konfi1.id);
    await mitteilungVorTagen(400, USERS.konfi2.id);
    await mitteilungVorTagen(400, USERS.konfi3.id);
    await mitteilungVorTagen(10, USERS.konfi1.id);

    const geloescht = await BackgroundService.cleanupAlteMitteilungen(db);

    expect(geloescht).toBe(3);
    const { rows } = await db.query('SELECT COUNT(*)::int AS c FROM notifications');
    expect(rows[0].c).toBe(1);
  });

  it('gibt 0 zurueck, wenn nichts alt genug ist', async () => {
    await mitteilungVorTagen(1);
    await mitteilungVorTagen(200);

    const geloescht = await BackgroundService.cleanupAlteMitteilungen(db);

    expect(geloescht).toBe(0);
    const { rows } = await db.query('SELECT COUNT(*)::int AS c FROM notifications');
    expect(rows[0].c).toBe(2);
  });
});
