// backend/tests/routes/oeffentlicheGrenzen.test.js
//
// GRENZEN FUER DREI OEFFENTLICHE ROUTEN (Audit Sicherheit N3, Nebenbefund der
// Pakete vom 29.09.2026): GET /auth/validate-invite/:code, POST
// /auth/reset-password und POST /auth/refresh hatten keinen eigenen Limiter;
// es bremste nur der allgemeine Flutschutz (2000 je Viertelstunde und
// Adresse, je Replica). Ein Einladungscode hat 32 Bit -- ohne Grenze liess er
// sich mit 16.000 Versuchen je Stunde und Adresse suchen, und ein Treffer
// nennt Gemeinde und Jahrgang und oeffnet die Registrierung als Konfi.
//
// Gezaehlt wird je Adresse und NUR der Ratefall (Begruendung und Zahlen im
// Kopf der Grenzen in routes/auth.js): 404 beim Code, ungueltiges Token beim
// Reset, 401 beim Refresh. Was echte Nutzung staendig tut, zaehlt nicht --
// jeder Test hier prueft beides: den verbotenen Fall (429 ab Grenze + 1) und
// den erlaubten (gueltige Anfragen und andere Fehler bleiben frei, andere
// Adressen auch).
//
// supertest verbindet ueber Loopback, der Peer gilt als Proxy -- X-Real-IP
// waehlt die Adresse (utils/clientIp.js).
const crypto = require('crypto');
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, PASSWORD } = require('../helpers/seed');

const EINLADUNG_MAX = 60;
const RESET_MAX = 20;
const REFRESH_MAX = 300;

describe('Grenzen für validate-invite, reset-password und refresh', () => {
  let app;
  let db;

  beforeAll(() => { db = getTestPool(); app = getTestApp(db); });
  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
  });
  afterAll(async () => { await closePool(); });

  const serie = async (anzahl, anfrage) => {
    const status = [];
    let letzte;
    for (let i = 0; i < anzahl; i++) {
      letzte = await anfrage(i);
      status.push(letzte.status);
    }
    return { status, letzte };
  };
  const zaehle = (status) => status.reduce((acc, s) => ({ ...acc, [s]: (acc[s] || 0) + 1 }), {});

  // ================================================================
  describe('GET /auth/validate-invite/:code', () => {
    const pruefe = (ip, code) => request(app).get(`/api/auth/validate-invite/${code}`).set('X-Real-IP', ip);
    const unbekannt = (i) => `ZZ${String(i).padStart(6, '0')}`;
    let gueltig;
    let abgelaufen;

    beforeEach(async () => {
      gueltig = crypto.randomBytes(4).toString('hex').toUpperCase();
      abgelaufen = crypto.randomBytes(4).toString('hex').toUpperCase();
      await db.query(
        `INSERT INTO invite_codes (code, organization_id, jahrgang_id, created_by, expires_at)
         VALUES ($1, 1, 1, $3, NOW() + interval '7 days'), ($2, 1, 1, $3, NOW() - interval '1 day')`,
        [gueltig, abgelaufen, USERS.orgAdmin1.id]);
    });

    it(`nach ${EINLADUNG_MAX} unbekannten Codes von einer Adresse: 429 (verboten)`, async () => {
      const { status, letzte } = await serie(EINLADUNG_MAX + 1, (i) => pruefe('198.51.100.10', unbekannt(i)));
      expect(zaehle(status)).toEqual({ 404: EINLADUNG_MAX, 429: 1 });
      expect(status[EINLADUNG_MAX]).toBe(429);
      expect(letzte.body).toEqual({
        error: 'Zu viele unbekannte Einladungscodes. Bitte prüfe den Code und versuche es in 15 Minuten erneut.',
      });
    });

    it('gültige und abgelaufene Codes zählen nicht (erlaubt)', async () => {
      const { status } = await serie(EINLADUNG_MAX + 10, (i) =>
        pruefe('198.51.100.11', i % 2 === 0 ? gueltig : abgelaufen));
      expect(zaehle(status)).toEqual({ 200: 35, 410: 35 });
      // Die volle Zahl unbekannter Codes ist danach noch frei.
      const { status: danach } = await serie(EINLADUNG_MAX, (i) => pruefe('198.51.100.11', unbekannt(i)));
      expect(zaehle(danach)).toEqual({ 404: EINLADUNG_MAX });
    });

    it('eine andere Adresse bleibt frei, auch wenn eine gesperrt ist (erlaubt)', async () => {
      await serie(EINLADUNG_MAX + 1, (i) => pruefe('198.51.100.12', unbekannt(i)));
      const res = await pruefe('198.51.100.13', gueltig);
      expect(res.status).toBe(200);
      expect(res.body.valid).toBe(true);
    });
  });

  // ================================================================
  describe('POST /auth/reset-password', () => {
    const setze = (ip, token, newPassword = 'Neues-Passwort1!') =>
      request(app).post('/api/auth/reset-password').set('X-Real-IP', ip).send({ token, newPassword });
    let gueltigesToken;

    beforeEach(async () => {
      gueltigesToken = crypto.randomBytes(32).toString('hex');
      await db.query(
        `INSERT INTO password_resets (user_id, user_type, token, expires_at)
         VALUES ($1, 'konfi', encode(sha256(convert_to($2, 'UTF8')), 'hex'), NOW() + interval '1 hour')`,
        [USERS.konfi1.id, gueltigesToken]);
    });

    it('das Test-Token ist gültig (Voraussetzung der übrigen Fälle)', async () => {
      const res = await setze('198.51.100.20', gueltigesToken);
      expect(res.status).toBe(200);
    });

    it(`nach ${RESET_MAX} ungültigen Tokens von einer Adresse: 429 (verboten)`, async () => {
      const { status, letzte } = await serie(RESET_MAX + 1, () =>
        setze('198.51.100.21', crypto.randomBytes(32).toString('hex')));
      expect(zaehle(status)).toEqual({ 400: RESET_MAX, 429: 1 });
      expect(status[RESET_MAX]).toBe(429);
      expect(letzte.body.error).toBe(
        'Zu viele ungültige Links zum Zurücksetzen. Bitte fordere einen neuen Link an und versuche es in 15 Minuten erneut.');
    });

    it('ein zu schwaches Passwort zählt nicht; danach klappt der Reset (erlaubt)', async () => {
      const { status } = await serie(RESET_MAX + 10, () => setze('198.51.100.22', gueltigesToken, 'kurz'));
      expect(zaehle(status)).toEqual({ 400: RESET_MAX + 10 });
      const res = await setze('198.51.100.22', gueltigesToken);
      expect(res.status).toBe(200);
    });

    it('eine andere Adresse bleibt frei, auch wenn eine gesperrt ist (erlaubt)', async () => {
      await serie(RESET_MAX + 1, () => setze('198.51.100.23', crypto.randomBytes(32).toString('hex')));
      const res = await setze('198.51.100.24', gueltigesToken);
      expect(res.status).toBe(200);
    });
  });

  // ================================================================
  describe('POST /auth/refresh', () => {
    const erneuere = (ip, refreshToken) =>
      request(app).post('/api/auth/refresh').set('X-Real-IP', ip).send({ refresh_token: refreshToken });
    const anmelden = async (ip) => {
      const res = await request(app).post('/api/auth/login').set('X-Real-IP', ip)
        .send({ username: USERS.konfi1.username, password: PASSWORD });
      expect(res.status).toBe(200);
      return res.body.refresh_token;
    };

    it(`nach ${REFRESH_MAX} abgelehnten Tokens (401) von einer Adresse: 429 (verboten)`, async () => {
      const { status, letzte } = await serie(REFRESH_MAX + 1, () =>
        erneuere('198.51.100.30', crypto.randomBytes(64).toString('hex')));
      expect(zaehle(status)).toEqual({ 401: REFRESH_MAX, 429: 1 });
      expect(status[REFRESH_MAX]).toBe(429);
      expect(letzte.body.error).toBe(
        'Zu viele abgelaufene Anmeldungen von dieser Verbindung. Bitte melde dich in 15 Minuten neu an.');
    }, 60000);

    it(`erfolgreiche Erneuerungen zählen nicht: ${REFRESH_MAX + 20} hintereinander (erlaubt)`, async () => {
      let token = await anmelden('198.51.100.31');
      const status = [];
      for (let i = 0; i < REFRESH_MAX + 20; i++) {
        const res = await erneuere('198.51.100.31', token);
        status.push(res.status);
        token = res.body.refresh_token;
      }
      expect(zaehle(status)).toEqual({ 200: REFRESH_MAX + 20 });
    }, 60000);

    it('eine Sperre (403) zählt nicht (erlaubt)', async () => {
      // Je Geraet ein eigenes Token: Die App meldet nach dem ersten 403 ab.
      // (Dasselbe Token ein drittes Mal waere die Gnadenfrist-Regel und
      // gaebe 401 -- ein anderer Fall.)
      const tokens = Array.from({ length: REFRESH_MAX + 5 }, () => crypto.randomBytes(64).toString('hex'));
      await db.query(
        `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
         SELECT $1, encode(sha256(convert_to(t, 'UTF8')), 'hex'), NOW() + interval '1 day'
           FROM unnest($2::text[]) AS t`,
        [USERS.konfi1.id, tokens]);
      await db.query('UPDATE users SET is_active = false WHERE id = $1', [USERS.konfi1.id]);
      const { status } = await serie(tokens.length, (i) => erneuere('198.51.100.32', tokens[i]));
      expect(zaehle(status)).toEqual({ 403: REFRESH_MAX + 5 });
    }, 60000);

    it('eine andere Adresse bleibt frei, auch wenn eine gesperrt ist (erlaubt)', async () => {
      await serie(REFRESH_MAX + 1, () => erneuere('198.51.100.33', crypto.randomBytes(64).toString('hex')));
      const token = await anmelden('198.51.100.34');
      const res = await erneuere('198.51.100.34', token);
      expect(res.status).toBe(200);
    }, 60000);
  });
});
