// Refresh-Token-Gnadenfrist: genau eine Wiederverwendung, danach Widerruf
// (Audit 26.09.2026, Sicherheit BF-08, MITTEL).
//
// POST /auth/refresh rotiert: Das alte Token wird widerrufen, ein neues Paar
// ausgestellt. Fuenf Minuten lang darf das alte Token trotzdem noch einmal
// kommen -- fuer den Client, der nach der Rotation das neue Token nicht mehr
// speichern konnte (Android-Prozess-Kill; die Ursache des Session-Totalausfalls
// ab 1.5.0). Bisher war diese Frist unbegrenzt oft nutzbar: dreimal derselbe
// rotierte Token -> 200, 200, 200 und drei offene 90-Tage-Tokens fuer ein
// Konto. Wer ein Refresh-Token abgriff, hatte 90 Tage Zugriff, ohne dass es
// auffiel.
//
// Jetzt: Die Gnadenfrist gilt genau einmal. Dabei wird der Nachfolger aus der
// ersten Rotation widerrufen, so dass je Geraet genau EIN Token offen bleibt.
// Eine weitere Wiederverwendung ist ein Diebstahl-Signal: 401, und alle
// Refresh-Tokens des Kontos werden widerrufen. Wiederverwendung nach Ablauf
// der Frist bleibt ein schlichtes 401 -- ein Geraet, das lange offline war,
// darf die uebrigen Geraete nicht aussperren. Antwortform unveraendert.
const crypto = require('crypto');
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, PASSWORD } = require('../helpers/seed');

const hash = (token) => crypto.createHash('sha256').update(token).digest('hex');

describe('POST /api/auth/refresh: Gnadenfrist genau einmal', () => {
  let app;
  let db;

  beforeAll(async () => {
    db = getTestPool();
    app = getTestApp(db);
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
  });

  afterAll(async () => {
    await closePool();
  });

  const login = async (userKey) => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: USERS[userKey].username, password: PASSWORD });
    expect(res.status).toBe(200);
    return res.body;
  };
  const refresh = (refreshToken) =>
    request(app).post('/api/auth/refresh').send({ refresh_token: refreshToken });
  const offeneTokens = async (userId) => {
    const { rows: [{ offen }] } = await db.query(
      `SELECT COUNT(*)::int AS offen FROM refresh_tokens
        WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > NOW()`,
      [userId]
    );
    return offen;
  };

  describe('verboten -- mehrfache Wiederverwendung', () => {
    it('zweifacher Refresh mit demselben rotierten Token im Fenster: beide 200, danach genau EIN offenes Token', async () => {
      const a = (await login('konfi1')).refresh_token;

      const erste = await refresh(a);
      expect(erste.status).toBe(200);
      const b = erste.body.refresh_token;

      const zweite = await refresh(a); // Gnadenfrist
      expect(zweite.status).toBe(200);
      const c = zweite.body.refresh_token;
      expect(c).not.toBe(b);

      expect(await offeneTokens(USERS.konfi1.id)).toBe(1);

      // Der Nachfolger aus der ersten Rotation ist widerrufen, der aus der
      // Gnadenfrist gilt -- das Geraet, das b verloren hat, arbeitet mit c.
      expect((await refresh(b)).status).toBe(401);
      expect((await refresh(c)).status).toBe(200);
    });

    it('dritter Refresh mit demselben Token: 401, und ALLE Refresh-Tokens des Kontos sind widerrufen -- auch auf anderen Geraeten', async () => {
      const zweitesGeraet = (await login('konfi1')).refresh_token;
      const a = (await login('konfi1')).refresh_token;

      expect((await refresh(a)).status).toBe(200);
      const c = (await refresh(a)).body.refresh_token; // Gnadenfrist
      expect(typeof c).toBe('string');
      expect(await offeneTokens(USERS.konfi1.id)).toBe(2); // c + zweites Geraet

      const dritte = await refresh(a);
      expect(dritte.status).toBe(401);
      expect(dritte.body).toEqual({ error: 'Ungültiger oder abgelaufener Refresh-Token' });

      expect(await offeneTokens(USERS.konfi1.id)).toBe(0);
      expect((await refresh(c)).status).toBe(401);
      expect((await refresh(zweitesGeraet)).status).toBe(401);
    });

    it('die Sperre trifft nur das betroffene Konto', async () => {
      const anderes = (await login('konfi2')).refresh_token;
      const a = (await login('konfi1')).refresh_token;
      await refresh(a);
      await refresh(a);
      expect((await refresh(a)).status).toBe(401);

      expect(await offeneTokens(USERS.konfi2.id)).toBe(1);
      expect((await refresh(anderes)).status).toBe(200);
    });

    it('Wiederverwendung nach Ablauf des Fensters: 401, die uebrigen Tokens des Kontos bleiben', async () => {
      const zweitesGeraet = (await login('konfi1')).refresh_token;
      const a = (await login('konfi1')).refresh_token;
      const b = (await refresh(a)).body.refresh_token;

      await db.query(
        `UPDATE refresh_tokens SET revoked_at = NOW() - INTERVAL '6 minutes' WHERE token_hash = $1`,
        [hash(a)]
      );

      expect((await refresh(a)).status).toBe(401);
      // Kein Diebstahl-Signal: Ein Geraet, das lange offline war, sperrt
      // niemanden aus.
      expect(await offeneTokens(USERS.konfi1.id)).toBe(2);
      expect((await refresh(b)).status).toBe(200);
      expect((await refresh(zweitesGeraet)).status).toBe(200);
    });

    it('ein per Logout widerrufenes Token bekommt keine Gnadenfrist und loest keine Kontosperre aus', async () => {
      const zweitesGeraet = (await login('konfi1')).refresh_token;
      const { token, refresh_token: a } = await login('konfi1');

      const logout = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${token}`)
        .send({ refresh_token: a });
      expect(logout.status).toBe(200);

      expect((await refresh(a)).status).toBe(401);
      expect((await refresh(a)).status).toBe(401);
      expect((await refresh(zweitesGeraet)).status).toBe(200);
    });
  });

  describe('erlaubt -- Rotation und einmalige Gnadenfrist', () => {
    it('Antwortform unveraendert: genau token und refresh_token, beides Strings -- auch im Gnadenpfad', async () => {
      const a = (await login('konfi1')).refresh_token;

      const rotation = await refresh(a);
      expect(rotation.status).toBe(200);
      expect(Object.keys(rotation.body).sort()).toEqual(['refresh_token', 'token']);
      expect(typeof rotation.body.token).toBe('string');
      expect(typeof rotation.body.refresh_token).toBe('string');

      const gnade = await refresh(a);
      expect(gnade.status).toBe(200);
      expect(Object.keys(gnade.body).sort()).toEqual(['refresh_token', 'token']);
      expect(typeof gnade.body.token).toBe('string');
      expect(typeof gnade.body.refresh_token).toBe('string');
    });

    it('der Nachfolger einer Rotation vermerkt seinen Vorgaenger (ersetzt_durch)', async () => {
      const a = (await login('konfi1')).refresh_token;
      const b = (await refresh(a)).body.refresh_token;

      const { rows: [alt] } = await db.query(
        'SELECT ersetzt_durch FROM refresh_tokens WHERE token_hash = $1', [hash(a)]
      );
      const { rows: [neu] } = await db.query(
        'SELECT id FROM refresh_tokens WHERE token_hash = $1', [hash(b)]
      );
      expect(alt.ersetzt_durch).toBe(neu.id);
    });

    it('eine Kette normaler Rotationen laesst immer genau EIN Token offen', async () => {
      let token = (await login('konfi1')).refresh_token;
      for (let i = 0; i < 4; i++) {
        const res = await refresh(token);
        expect(res.status).toBe(200);
        token = res.body.refresh_token;
      }
      expect(await offeneTokens(USERS.konfi1.id)).toBe(1);
    });
  });
});
