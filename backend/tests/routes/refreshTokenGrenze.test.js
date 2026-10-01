// Refresh-Tokens: hoechstens zehn offene je Konto, je Geraet eines
// (Entscheidung Simon, 01.10.2026).
//
// GEMESSEN (Produktion, 01.10.2026): 1.281 offene Refresh-Tokens auf 133
// Konten, das groesste mit 208. Jede Anmeldung legte ein neues Token an, ohne
// ein altes zu beenden; weg kamen sie erst nach 90 Tagen. Am meisten sammelten
// die Konten der Bildschirmfoto-Laeufe (jeder Lauf meldet sich neu an), aber
// auch echte Konten trugen bis zu 19 -- ueberwiegend Nachfolger, die ein
// Geraet nach der Rotation nie gespeichert hat.
//
// JETZT: Nach jeder Ausgabe (Anmeldung, Registrierung, Refresh, Passwortwechsel)
// bleiben nur die zehn juengsten offenen Tokens des Kontos; aeltere werden
// widerrufen und sofort ablaufen gelassen (wie beim Abmelden: keine Gnadenfrist
// und kein Diebstahl-Signal). Traegt das neue Token eine Geraete-Kennung,
// endet jedes andere offene Token DESSELBEN Geraets.
//
// Die Gnadenfrist (Migration 166) darf das nicht brechen: Ein gerade
// rotiertes Token muss sich in den fuenf Minuten noch einmal einloesen lassen,
// auch wenn das Konto an der Grenze steht.
const crypto = require('crypto');
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, PASSWORD } = require('../helpers/seed');
const { REFRESH_TOKENS_JE_KONTO } = require('../../utils/refreshTokenGrenze');

const hash = (token) => crypto.createHash('sha256').update(token).digest('hex');

describe('Refresh-Tokens: Obergrenze je Konto und je Geraet', () => {
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

  const login = async (userKey, geraet) => {
    const koerper = { username: USERS[userKey].username, password: PASSWORD };
    if (geraet !== undefined) koerper.device_id = geraet;
    const res = await request(app).post('/api/auth/login').send(koerper);
    expect(res.status).toBe(200);
    return res.body.refresh_token;
  };
  const refresh = (refreshToken, geraet) => {
    const koerper = { refresh_token: refreshToken };
    if (geraet !== undefined) koerper.device_id = geraet;
    return request(app).post('/api/auth/refresh').send(koerper);
  };
  const offen = async (userId) => {
    const { rows: [{ n }] } = await db.query(
      `SELECT COUNT(*)::int AS n FROM refresh_tokens
        WHERE user_id = $1 AND revoked_at IS NULL AND expires_at > NOW()`,
      [userId]
    );
    return n;
  };
  const istOffen = async (token) => {
    const { rows: [z] } = await db.query(
      `SELECT (revoked_at IS NULL AND expires_at > NOW()) AS offen
         FROM refresh_tokens WHERE token_hash = $1`,
      [hash(token)]
    );
    return z.offen;
  };
  // Aufeinanderfolgende Anmeldungen landen sonst womoeglich in derselben
  // Millisekunde; die Reihenfolge soll an created_at haengen, nicht am Zufall.
  const nacheinander = async (anzahl, userKey, geraet) => {
    const tokens = [];
    for (let i = 0; i < anzahl; i += 1) {
      tokens.push(await login(userKey, typeof geraet === 'function' ? geraet(i) : geraet));
      await new Promise((r) => setTimeout(r, 5));
    }
    return tokens;
  };

  it('die Grenze ist zehn', () => {
    expect(REFRESH_TOKENS_JE_KONTO).toBe(10);
  });

  describe('erlaubt', () => {
    it('zehn Anmeldungen: alle zehn Tokens bleiben offen', async () => {
      const tokens = await nacheinander(10, 'konfi1');
      expect(await offen(USERS.konfi1.id)).toBe(10);
      for (const t of tokens) expect(await istOffen(t)).toBe(true);
    });

    it('Refresh an der Grenze: die Rotation beendet kein fremdes Token', async () => {
      const tokens = await nacheinander(10, 'konfi1');
      let aktuell = tokens[9];
      for (let i = 0; i < 5; i += 1) {
        const res = await refresh(aktuell);
        expect(res.status).toBe(200);
        aktuell = res.body.refresh_token;
      }
      expect(await offen(USERS.konfi1.id)).toBe(10);
      for (const t of tokens.slice(0, 9)) expect(await istOffen(t)).toBe(true);
    });

    it('Gnadenfrist an der Grenze: das gerade rotierte Token gilt noch genau einmal', async () => {
      const tokens = await nacheinander(10, 'konfi1');
      const aeltestes = tokens[0];

      const erste = await refresh(aeltestes);
      expect(erste.status).toBe(200);
      const zweite = await refresh(aeltestes); // Gnadenfrist
      expect(zweite.status).toBe(200);
      expect(zweite.body.refresh_token).not.toBe(erste.body.refresh_token);

      // Das Token aus der Gnadenfrist gilt, der Nachfolger aus der ersten
      // Rotation ist widerrufen (Migration 166) -- es bleiben zehn.
      expect(await istOffen(zweite.body.refresh_token)).toBe(true);
      expect(await istOffen(erste.body.refresh_token)).toBe(false);
      expect(await offen(USERS.konfi1.id)).toBe(10);
      expect((await refresh(zweite.body.refresh_token)).status).toBe(200);
    });

    it('andere Geraete desselben Kontos bleiben bei einer Anmeldung mit Kennung offen', async () => {
      const a = await login('konfi1', 'geraet-a');
      const b = await login('konfi1', 'geraet-b');
      const ohne = await login('konfi1');
      expect(await istOffen(a)).toBe(true);
      expect(await istOffen(b)).toBe(true);
      expect(await istOffen(ohne)).toBe(true);
    });

    it('die Grenze gilt je Konto: ein anderes Konto verliert nichts', async () => {
      const fremd = await login('konfi2');
      await nacheinander(12, 'konfi1');
      expect(await istOffen(fremd)).toBe(true);
      expect(await offen(USERS.konfi2.id)).toBe(1);
    });
  });

  describe('verboten', () => {
    it('elf Anmeldungen: genau zehn offen, das aelteste ist widerrufen', async () => {
      const tokens = await nacheinander(11, 'konfi1');
      expect(await offen(USERS.konfi1.id)).toBe(10);
      expect(await istOffen(tokens[0])).toBe(false);
      for (const t of tokens.slice(1)) expect(await istOffen(t)).toBe(true);
    });

    it('das verdraengte Token: 401, ohne Gnadenfrist und ohne die uebrigen mitzureissen', async () => {
      const tokens = await nacheinander(11, 'konfi1');
      expect((await refresh(tokens[0])).status).toBe(401);
      // Kein Diebstahl-Signal: die zehn juengsten bleiben offen.
      expect(await offen(USERS.konfi1.id)).toBe(10);
      expect((await refresh(tokens[0])).status).toBe(401);
      expect(await offen(USERS.konfi1.id)).toBe(10);
    });

    it('fuenfzehn Anmeldungen: genau zehn offen, die fuenf aeltesten widerrufen', async () => {
      const tokens = await nacheinander(15, 'konfi1');
      expect(await offen(USERS.konfi1.id)).toBe(10);
      for (const t of tokens.slice(0, 5)) expect(await istOffen(t)).toBe(false);
      for (const t of tokens.slice(5)) expect(await istOffen(t)).toBe(true);
    });

    it('zweite Anmeldung auf DEMSELBEN Geraet beendet dessen erstes Token', async () => {
      const erstes = await login('konfi1', 'geraet-a');
      const zweites = await login('konfi1', 'geraet-a');
      expect(await istOffen(erstes)).toBe(false);
      expect(await istOffen(zweites)).toBe(true);
      expect(await offen(USERS.konfi1.id)).toBe(1);
      expect((await refresh(erstes, 'geraet-a')).status).toBe(401);
    });

    it('die Rotation eines ungebundenen Tokens bindet und beendet ein aelteres Token desselben Geraets', async () => {
      const gebunden = await login('konfi1', 'geraet-a');
      const ungebunden = await login('konfi1');
      const res = await refresh(ungebunden, 'geraet-a');
      expect(res.status).toBe(200);
      expect(await istOffen(gebunden)).toBe(false);
      expect(await istOffen(res.body.refresh_token)).toBe(true);
      expect(await offen(USERS.konfi1.id)).toBe(1);
    });
  });
});
