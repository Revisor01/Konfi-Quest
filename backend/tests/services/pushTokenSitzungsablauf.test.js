// backend/tests/services/pushTokenSitzungsablauf.test.js
// Stiller Sitzungsablauf: Laeuft die letzte Sitzung eines Users ab (oder wird
// sie revoked, ohne dass die App den Push-Token abmelden konnte — der DELETE
// verlangt Auth und scheitert nach dem Ablauf mit 401), blieb der Push-Token
// stehen. Der Versand haengt nur an user_id, und jede erfolgreiche Zustellung
// frischt updated_at auf — die 30-Tage-Bereinigung griff deshalb nie. Folge:
// ein Geraet ohne gueltige Sitzung bekam unbegrenzt weiter Pushes fuer das
// Konto. cleanupStaleTokens raeumt solche Tokens jetzt mit ab.
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS } = require('../helpers/seed');
const BackgroundService = require('../../services/backgroundService');

describe('cleanupStaleTokens: Push-Tokens ohne gueltige Sitzung', () => {
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

  const legePushTokenAn = (userId, deviceId) =>
    db.query(
      `INSERT INTO push_tokens (user_id, user_type, token, platform, device_id, updated_at)
       VALUES ($1, 'konfi', $2, 'ios', $2, NOW())`,
      [userId, deviceId]
    );

  it('entfernt Tokens von Usern, deren Sitzungen abgelaufen oder revoked sind', async () => {
    // konfi1: einzige Sitzung abgelaufen.
    await db.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
       VALUES ($1, 'hash-abgelaufen', NOW() - INTERVAL '1 day')`,
      [USERS.konfi1.id]
    );
    await legePushTokenAn(USERS.konfi1.id, 'geraet-abgelaufen');

    // konfi2: einzige Sitzung revoked (z.B. Logout einer alten App-Version,
    // die kein device_id mitschickt — der Push-Token blieb dabei stehen).
    await db.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, revoked_at)
       VALUES ($1, 'hash-revoked', NOW() + INTERVAL '90 days', NOW())`,
      [USERS.konfi2.id]
    );
    await legePushTokenAn(USERS.konfi2.id, 'geraet-revoked');

    // teamer1: gar keine Sitzung mehr in der Tabelle (aelter als der
    // Refresh-Token-Cleanup, der abgelaufene Zeilen loescht).
    await legePushTokenAn(USERS.teamer1.id, 'geraet-ohne-sitzung');

    const ergebnis = await BackgroundService.cleanupStaleTokens(db);
    expect(ergebnis.sitzungsloseTokens).toBe(3);

    const { rows } = await db.query('SELECT user_id FROM push_tokens');
    expect(rows).toEqual([]);
  });

  it('behaelt Tokens von Usern mit mindestens einer gueltigen Sitzung', async () => {
    // admin1: eine gueltige Sitzung neben einer revoked (normale Rotation).
    await db.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, revoked_at)
       VALUES ($1, 'hash-rotiert-alt', NOW() + INTERVAL '90 days', NOW()),
              ($1, 'hash-gueltig', NOW() + INTERVAL '90 days', NULL)`,
      [USERS.admin1.id]
    );
    await legePushTokenAn(USERS.admin1.id, 'geraet-aktiv');

    const ergebnis = await BackgroundService.cleanupStaleTokens(db);
    expect(ergebnis.sitzungsloseTokens).toBe(0);

    const { rows } = await db.query(
      'SELECT device_id FROM push_tokens WHERE user_id = $1',
      [USERS.admin1.id]
    );
    expect(rows.map((r) => r.device_id)).toEqual(['geraet-aktiv']);
  });
});
