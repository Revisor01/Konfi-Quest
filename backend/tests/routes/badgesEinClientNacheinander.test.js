// Abzeichen-Wertung auf einem Transaktions-Client: eine Abfrage nach der
// anderen (29.09.2026, Paket I2).
//
// Im Testlauf stand die Warnung von pg: "Calling client.query() when the
// client is already executing a query is deprecated and will be removed in
// pg@9.0". Die Stelle (per --trace-deprecation): checkAndAwardBadges
// (routes/badges.js) buendelt ihre Vorab-Abfragen mit Promise.all -- und wird
// aus der Anwesenheits-Verbuchung und dem QR-Check-in mit dem CLIENT der
// laufenden Transaktion gerufen. pg 8 reiht die gleichzeitigen Abfragen intern
// ein und warnt; in pg 9 faellt diese Warteschlange weg.
//
// Gemessen wird, wie viele Abfragen auf dem Client gleichzeitig offen sind.
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS } = require('../helpers/seed');
const { checkAndAwardBadges } = require('../../routes/badges');
const { abfragenBuendeln } = require('../../utils/abfragenBuendeln');

describe('checkAndAwardBadges auf einem Client: nie zwei Abfragen gleichzeitig', () => {
  let db;

  beforeAll(() => { db = getTestPool(); });
  afterAll(async () => { await closePool(); });
  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
  });

  // Client mit Zaehler fuer gleichzeitig offene Abfragen.
  async function gezaehlterClient() {
    const client = await db.getClient();
    const stand = { offen: 0, hoechstens: 0, abfragen: 0 };
    const echt = client.query.bind(client);
    client.query = (...args) => {
      stand.offen += 1;
      stand.abfragen += 1;
      stand.hoechstens = Math.max(stand.hoechstens, stand.offen);
      const p = echt(...args);
      const fertig = () => { stand.offen -= 1; };
      p.then(fertig, fertig);
      return p;
    };
    const echtesRelease = client.release.bind(client);
    client.release = (...args) => {
      delete client.query;
      delete client.release;
      return echtesRelease(...args);
    };
    return { client, stand };
  }

  it('Konfi-Zweig (wie aus der Anwesenheit und dem Check-in)', async () => {
    const { client, stand } = await gezaehlterClient();
    try {
      await client.query('BEGIN');
      await checkAndAwardBadges(client, USERS.konfi1.id, { organizationId: ORGS.testGemeinde.id });
      await client.query('COMMIT');
    } finally {
      client.release();
    }
    expect(stand.abfragen).toBeGreaterThan(6);
    expect(stand.hoechstens).toBe(1);
  });

  it('Teamer-Zweig', async () => {
    // Ohne aktives Teamer-Abzeichen kehrt der Zweig vor den Vorab-Abfragen um.
    await db.query(
      `INSERT INTO custom_badges (name, criteria_type, criteria_value, organization_id, target_role, is_active, icon, color)
       VALUES ('Team-Ziel', 'event_count', 99, $1, 'teamer', true, 'star', '#000000')`,
      [ORGS.testGemeinde.id]
    );
    const { client, stand } = await gezaehlterClient();
    try {
      await client.query('BEGIN');
      await checkAndAwardBadges(client, USERS.teamer1.id, { organizationId: ORGS.testGemeinde.id });
      await client.query('COMMIT');
    } finally {
      client.release();
    }
    expect(stand.abfragen).toBeGreaterThan(5);
    expect(stand.hoechstens).toBe(1);
  });

  it('mehrere Abzeichen auf einmal: auch das Eintragen läuft nacheinander', async () => {
    // Zwei Abzeichen, die sofort greifen: 0 Aktivitaeten reichen fuer
    // activity_count 0 nicht -- deshalb eine Aktivitaet und zwei Ziele "1".
    await db.query(
      `INSERT INTO user_activities (user_id, activity_id, completed_date, admin_id, organization_id)
       VALUES ($1, 1, CURRENT_DATE, $2, $3)`,
      [USERS.konfi1.id, USERS.admin1.id, ORGS.testGemeinde.id]
    );
    await db.query(
      `INSERT INTO custom_badges (name, criteria_type, criteria_value, organization_id, target_role, is_active, icon, color)
       VALUES ('Eins', 'activity_count', 1, $1, 'konfi', true, 'star', '#000000'),
              ('Auch eins', 'unique_activities', 1, $1, 'konfi', true, 'star', '#000000')`,
      [ORGS.testGemeinde.id]
    );
    const { client, stand } = await gezaehlterClient();
    let ergebnis;
    try {
      await client.query('BEGIN');
      ergebnis = await checkAndAwardBadges(client, USERS.konfi1.id, { organizationId: ORGS.testGemeinde.id, still: true });
      await client.query('COMMIT');
    } finally {
      client.release();
    }
    expect(ergebnis.count).toBeGreaterThanOrEqual(2);
    expect(stand.hoechstens).toBe(1);
  });

  describe('abfragenBuendeln', () => {
    const verzoegert = (stand, wert) => async () => {
      stand.offen += 1;
      stand.hoechstens = Math.max(stand.hoechstens, stand.offen);
      await new Promise((r) => setTimeout(r, 5));
      stand.offen -= 1;
      return wert;
    };

    it('auf einem Client (hat release) nacheinander, Ergebnisse in Reihenfolge', async () => {
      const stand = { offen: 0, hoechstens: 0 };
      const client = { query: () => {}, release: () => {} };
      const ergebnis = await abfragenBuendeln(client, [verzoegert(stand, 'a'), verzoegert(stand, 'b'), verzoegert(stand, 'c')]);
      expect(ergebnis).toEqual(['a', 'b', 'c']);
      expect(stand.hoechstens).toBe(1);
    });

    it('über den Pool (kein release) weiter parallel', async () => {
      const stand = { offen: 0, hoechstens: 0 };
      const pool = { query: () => {} };
      const ergebnis = await abfragenBuendeln(pool, [verzoegert(stand, 'a'), verzoegert(stand, 'b'), verzoegert(stand, 'c')]);
      expect(ergebnis).toEqual(['a', 'b', 'c']);
      expect(stand.hoechstens).toBe(3);
    });
  });
});
