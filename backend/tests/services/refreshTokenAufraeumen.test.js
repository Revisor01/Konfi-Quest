// backend/tests/services/refreshTokenAufraeumen.test.js
//
// Abgelaufene Refresh-Tokens aufraeumen -- beim Start und auf dem
// Cron-Leader (Nebenbefund 29.09.2026).
//
// Bis zum 29.09.2026 lief das Aufraeumen per setInterval(24 h) am Ende von
// routes/auth.js: in jedem Backend-Prozess, auch im Test-Backend, und ohne
// ersten Lauf beim Start. Jeder Deploy startet die Replicas neu -- im
// September an fast jedem Tag, an manchen bis zu 47-mal (Commits auf main).
// Der erste Lauf nach 24 h Laufzeit kam deshalb praktisch nie.
//
// Jetzt: BackgroundService.cleanupRefreshTokens, gestartet mit dem
// Push-Token-Aufraeumen (startTokenCleanupService) -- sofort beim Start und
// alle sechs Stunden, nur auf dem Cron-Leader (startAllServices).
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS } = require('../helpers/seed');
const BackgroundService = require('../../services/backgroundService');

describe('Refresh-Tokens aufraeumen', () => {
  let db;

  beforeAll(() => { db = getTestPool(); });
  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    await db.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, revoked_at) VALUES
         ($1, 'abgelaufen',          NOW() - INTERVAL '1 day',  NULL),
         ($1, 'gueltig',             NOW() + INTERVAL '90 days', NULL),
         ($1, 'widerrufen-alt',      NOW() + INTERVAL '90 days', NOW() - INTERVAL '8 days'),
         ($1, 'widerrufen-frisch',   NOW() + INTERVAL '90 days', NOW() - INTERVAL '1 day')`,
      [USERS.konfi1.id]
    );
  });
  afterEach(() => { BackgroundService.stopTokenCleanupService(); });
  afterAll(async () => { await closePool(); });

  const uebrig = async () => (await db.query(
    'SELECT token_hash FROM refresh_tokens ORDER BY token_hash'
  )).rows.map((r) => r.token_hash);

  it('loescht Abgelaufene und seit mehr als 7 Tagen Widerrufene (verbotener Fall)', async () => {
    const n = await BackgroundService.cleanupRefreshTokens(db);
    expect(n).toBe(2);
    expect(await uebrig()).toEqual(['gueltig', 'widerrufen-frisch']);
  });

  it('laesst gueltige und frisch widerrufene stehen (erlaubter Fall: Wiederverwendung bleibt erkennbar)', async () => {
    await BackgroundService.cleanupRefreshTokens(db);
    await BackgroundService.cleanupRefreshTokens(db);
    expect(await uebrig()).toEqual(['gueltig', 'widerrufen-frisch']);
  });

  it('Tokens, die die Obergrenze beendet hat, verschwinden beim naechsten Lauf; die zehn juengsten bleiben', async () => {
    const { refreshTokensBegrenzen } = require('../../utils/refreshTokenGrenze');
    await db.query('DELETE FROM refresh_tokens');
    for (let i = 1; i <= 12; i += 1) {
      await db.query(
        `INSERT INTO refresh_tokens (user_id, token_hash, expires_at, created_at)
         VALUES ($1, $2, NOW() + INTERVAL '90 days', NOW() - make_interval(days => $3))`,
        [USERS.konfi1.id, `t${String(i).padStart(2, '0')}`, i]
      );
    }
    const beendet = await refreshTokensBegrenzen(db, USERS.konfi1.id);
    expect(beendet).toEqual({ geraet: 0, ueberGrenze: 2 });
    expect(await BackgroundService.cleanupRefreshTokens(db)).toBe(2);
    expect(await uebrig()).toEqual(
      Array.from({ length: 10 }, (_, i) => `t${String(i + 1).padStart(2, '0')}`)
    );
  });

  it('laeuft beim Start des Dienstes sofort, nicht erst nach Stunden', async () => {
    BackgroundService.startTokenCleanupService(db);
    const bis = Date.now() + 5000;
    let stand = await uebrig();
    while (stand.length !== 2 && Date.now() < bis) {
      await new Promise((r) => setTimeout(r, 50));
      stand = await uebrig();
    }
    expect(stand).toEqual(['gueltig', 'widerrufen-frisch']);
  });

  it('das Laden der Anmelde-Routen startet keinen eigenen Takt mehr', () => {
    const spy = vi.spyOn(global, 'setInterval');
    try {
      delete require.cache[require.resolve('../../routes/auth')];
      const authRouter = require('../../routes/auth');
      authRouter(db, (req, res, next) => next(), { sendMail: async () => ({}) }, {}, {}, (req, res, next) => next());
      const tagesTakte = spy.mock.calls.filter(([, ms]) => ms === 24 * 60 * 60 * 1000);
      expect(tagesTakte).toHaveLength(0);
    } finally {
      spy.mockRestore();
    }
  });
});
