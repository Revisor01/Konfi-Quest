// backend/tests/routes/supportMailBetrieb.test.js
//
// Laeuft die Support-Mail? (10.10.2026) -- GET /api/status meldet den
// Gesamtzustand als ein Wort, GET /api/metrics die Einzelheiten je Postfach
// (utils/supportMailZustand.js).
//
// Anlass: Am 08.10.2026 fehlten nach einem Deploy die Stack-Variablen der
// Support-Mail; das Abholen stand 46 Stunden, ohne dass es jemand merkte.
//
// Beide Felder sind ADDITIV; alle bisherigen Felder bleiben, wie sie sind.
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

const MAIL_ENV = Object.freeze({
  MAIL_IMAP_HOST: 'imap.example.test',
  MAIL_MOIN_USER: 'moin-benutzer',
  MAIL_MOIN_PASS: 'geheim-moin',
  MAIL_SUPPORT_USER: 'support-benutzer',
  MAIL_SUPPORT_PASS: 'geheim-support',
});

describe('Support-Mail im Betrieb', () => {
  let db;

  beforeAll(() => {
    db = getTestPool();
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    await db.query('DELETE FROM mail_abholstand');
    for (const k of Object.keys(MAIL_ENV)) delete process.env[k];
    delete process.env.METRICS_PEERS;
  });

  afterEach(() => {
    for (const k of Object.keys(MAIL_ENV)) delete process.env[k];
  });

  afterAll(async () => {
    await closePool();
  });

  // Jede App hat ihren eigenen Zwischenstand von 30 s -- je Fall eine neue.
  const status = () => request(getTestApp(db)).get('/api/status');
  const metrik = (rolle = 'superAdmin') => request(getTestApp(db))
    .get('/api/metrics')
    .set('Authorization', `Bearer ${generateToken(rolle)}`);
  const abgeholtVor = async (postfach, minuten) => db.query(
    `INSERT INTO mail_abholstand (postfach, uidvalidity, letzte_uid, abgeholt_am)
     VALUES ($1, '1', 10, NOW() - make_interval(mins => $2::int))`, [postfach, minuten]);
  const eingerichtet = () => Object.assign(process.env, MAIL_ENV);

  describe('GET /api/status: support_mail', () => {
    it('ohne Stack-Variablen (der Vorfall): nicht_eingerichtet, Status bleibt 200', async () => {
      await abgeholtVor('moin', 1);
      await abgeholtVor('support', 1);
      const res = await status();
      expect(res.status).toBe(200);
      expect(res.body.support_mail).toBe('nicht_eingerichtet');
      // Nicht in checks: Deploy-Verify und Ueberwachung der checks bleiben unberuehrt.
      expect(res.body.checks.support_mail).toBeUndefined();
    });

    it('eingerichtet und vor 5 Minuten abgeholt: ok', async () => {
      eingerichtet();
      await abgeholtVor('moin', 5);
      await abgeholtVor('support', 5);
      const res = await status();
      expect(res.body.support_mail).toBe('ok');
    });

    it('eingerichtet, aber ein Postfach seit 31 Minuten nicht abgeholt: veraltet', async () => {
      eingerichtet();
      await abgeholtVor('moin', 5);
      await abgeholtVor('support', 31);
      const res = await status();
      expect(res.body.support_mail).toBe('veraltet');
    });

    it('verraet keine Adressen und keine Zugangsdaten', async () => {
      eingerichtet();
      await abgeholtVor('moin', 5);
      const text = JSON.stringify((await status()).body);
      for (const wert of Object.values(MAIL_ENV)) expect(text).not.toContain(wert);
      expect(text).not.toContain('@');
    });
  });

  describe('GET /api/metrics: supportMail', () => {
    it('je Postfach Zustand, Alter in Minuten und Grenze', async () => {
      eingerichtet();
      await abgeholtVor('moin', 3);
      await db.query(
        `INSERT INTO mail_abholstand (postfach, fehler, fehler_am)
         VALUES ('support', 'Anmeldung gescheitert (Benutzer oder Passwort falsch)', NOW())`);
      const res = await metrik();
      expect(res.status).toBe(200);
      expect(res.body.supportMail).toEqual({
        zustand: 'veraltet',
        grenzeMinuten: 30,
        postfaecher: [
          { postfach: 'moin', eingerichtet: true, abgeholt_am: expect.any(String), alter_minuten: 3, fehler: null, zustand: 'ok' },
          {
            postfach: 'support', eingerichtet: true, abgeholt_am: null, alter_minuten: null,
            fehler: 'Anmeldung gescheitert (Benutzer oder Passwort falsch)', zustand: 'veraltet',
          },
        ],
      });
      // Die bisherigen Felder bleiben (additiv).
      expect(typeof res.body.totalRequests).toBe('number');
      expect(Array.isArray(res.body.routesSlowest)).toBe(true);
    });

    it('genau an der Grenze (30 Minuten) noch ok, eine Minute danach veraltet', async () => {
      eingerichtet();
      await abgeholtVor('moin', 30);
      await abgeholtVor('support', 30);
      expect((await metrik()).body.supportMail.zustand).toBe('ok');
      await db.query("UPDATE mail_abholstand SET abgeholt_am = NOW() - interval '31 minutes' WHERE postfach = 'moin'");
      const res = await metrik();
      expect(res.body.supportMail.zustand).toBe('veraltet');
      expect(res.body.supportMail.postfaecher.map((p) => p.zustand)).toEqual(['veraltet', 'ok']);
    });

    it('ohne Stack-Variablen: beide Postfaecher nicht_eingerichtet', async () => {
      const res = await metrik();
      expect(res.body.supportMail.zustand).toBe('nicht_eingerichtet');
      expect(res.body.supportMail.postfaecher.map((p) => [p.postfach, p.eingerichtet, p.zustand])).toEqual([
        ['moin', false, 'nicht_eingerichtet'],
        ['support', false, 'nicht_eingerichtet'],
      ]);
    });

    it('eine leere Variable zaehlt als nicht gesetzt', async () => {
      eingerichtet();
      process.env.MAIL_SUPPORT_PASS = '';
      await abgeholtVor('moin', 1);
      await abgeholtVor('support', 1);
      const res = await metrik();
      expect(res.body.supportMail.zustand).toBe('nicht_eingerichtet');
      expect(res.body.supportMail.postfaecher.map((p) => p.zustand)).toEqual(['ok', 'nicht_eingerichtet']);
    });

    it('verraet keine Zugangsdaten', async () => {
      eingerichtet();
      await abgeholtVor('moin', 1);
      const text = JSON.stringify((await metrik()).body.supportMail);
      for (const wert of Object.values(MAIL_ENV)) expect(text).not.toContain(wert);
    });

    it('bleibt super_admin vorbehalten: Leitung 403, ohne Feld', async () => {
      const res = await metrik('orgAdmin1');
      expect(res.status).toBe(403);
      expect(res.body).toEqual({ error: 'Zugriff verweigert' });
    });
  });
});
