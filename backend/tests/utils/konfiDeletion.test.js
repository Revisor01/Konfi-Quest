// backend/tests/utils/konfiDeletion.test.js
// Tests fuer die gemeinsame kaskadierende Loesch-Funktion deleteKonfiCascade.
// Per D-04: einzige Quelle der kaskadierenden Loeschung (Admin/Self/Auto).
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ACTIVITIES, JAHRGAENGE } = require('../helpers/seed');
const { deleteKonfiCascade } = require('../../utils/konfiDeletion');

const ORG_ID = 1;

describe('deleteKonfiCascade', () => {
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

  // Hilfsfunktion: seedet zusaetzliche abhaengige Daten fuer einen Konfi,
  // damit moeglichst viele der 16 Tabellen Zeilen enthalten.
  async function seedKonfiDependencies(konfiId) {
    // bonus_points wird bereits in seed.js fuer konfi1 angelegt; fuer andere ergaenzen
    await db.query(
      `INSERT INTO bonus_points (konfi_id, points, type, description, admin_id, organization_id)
       VALUES ($1, 2, 'gemeinde', 'Testpunkte', $2, $3)`,
      [konfiId, USERS.admin1.id, ORG_ID]
    );
    // user_activities
    await db.query(
      `INSERT INTO user_activities (user_id, activity_id, admin_id, organization_id)
       VALUES ($1, $2, $3, $4)`,
      [konfiId, ACTIVITIES.sonntagsgottesdienst.id, USERS.admin1.id, ORG_ID]
    );
    // user_badges
    await db.query(
      `INSERT INTO user_badges (user_id, badge_id, organization_id)
       VALUES ($1, 1, $2)`,
      [konfiId, ORG_ID]
    );
    // push_tokens
    await db.query(
      `INSERT INTO push_tokens (user_id, token, platform, device_id)
       VALUES ($1, $2, 'ios', $3)`,
      [konfiId, `tok-${konfiId}`, `dev-${konfiId}`]
    );
    // notifications
    await db.query(
      `INSERT INTO notifications (user_id, title, message, organization_id)
       VALUES ($1, 'Test', 'Hallo', $2)`,
      [konfiId, ORG_ID]
    ).catch(() => {});
    // event_bookings
    await db.query(
      `INSERT INTO event_bookings (user_id, event_id, status, organization_id)
       VALUES ($1, $2, 'confirmed', $3)`,
      [konfiId, 1, ORG_ID]
    ).catch(() => {});
  }

  it('Test 1: User ist nach Loeschung aus users entfernt', async () => {
    const konfiId = USERS.konfi1.id;
    await seedKonfiDependencies(konfiId);

    const client = await db.getClient();
    try {
      await deleteKonfiCascade(client, konfiId, ORG_ID);
    } finally {
      client.release();
    }

    const { rows } = await db.query('SELECT id FROM users WHERE id = $1', [konfiId]);
    expect(rows.length).toBe(0);
  });

  it('Test 2: Alle abhaengigen Tabellen enthalten keine Zeilen mehr (Stichprobe)', async () => {
    const konfiId = USERS.konfi1.id;
    await seedKonfiDependencies(konfiId);

    const client = await db.getClient();
    try {
      await deleteKonfiCascade(client, konfiId, ORG_ID);
    } finally {
      client.release();
    }

    const tables = [
      { name: 'konfi_profiles', col: 'user_id' },
      { name: 'user_badges', col: 'user_id' },
      { name: 'bonus_points', col: 'konfi_id' },
      { name: 'user_activities', col: 'user_id' },
      { name: 'push_tokens', col: 'user_id' },
    ];
    for (const t of tables) {
      const { rows } = await db.query(
        `SELECT 1 FROM ${t.name} WHERE ${t.col} = $1`,
        [konfiId]
      );
      expect(rows.length, `Tabelle ${t.name} sollte leer sein`).toBe(0);
    }
  });

  it('Test 3: Funktion fuehrt kein eigenes BEGIN/COMMIT aus (Aufruf ohne Transaktion loescht trotzdem)', async () => {
    const konfiId = USERS.konfi2.id;
    await seedKonfiDependencies(konfiId);

    // Aufruf OHNE umschliessende Transaktion (Autocommit pro Statement).
    const client = await db.getClient();
    try {
      await deleteKonfiCascade(client, konfiId, ORG_ID);
    } finally {
      client.release();
    }

    const { rows } = await db.query('SELECT id FROM users WHERE id = $1', [konfiId]);
    expect(rows.length).toBe(0);
  });

  it('Test 4: Loeschung beeinflusst anderen Konfi derselben Org nicht', async () => {
    const ziel = USERS.konfi1.id;
    const andererKonfi = USERS.konfi2.id;
    await seedKonfiDependencies(ziel);
    await seedKonfiDependencies(andererKonfi);

    const client = await db.getClient();
    try {
      await deleteKonfiCascade(client, ziel, ORG_ID);
    } finally {
      client.release();
    }

    // Ziel-Konfi weg
    const zielRows = await db.query('SELECT id FROM users WHERE id = $1', [ziel]);
    expect(zielRows.rows.length).toBe(0);

    // Anderer Konfi + seine Daten bleiben
    const andererRows = await db.query('SELECT id FROM users WHERE id = $1', [andererKonfi]);
    expect(andererRows.rows.length).toBe(1);
    const andererBonus = await db.query('SELECT 1 FROM bonus_points WHERE konfi_id = $1', [andererKonfi]);
    expect(andererBonus.rows.length).toBeGreaterThan(0);
    const andererProfile = await db.query('SELECT 1 FROM konfi_profiles WHERE user_id = $1', [andererKonfi]);
    expect(andererProfile.rows.length).toBe(1);
  });
});
