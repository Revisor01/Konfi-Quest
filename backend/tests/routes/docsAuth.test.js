// Anmeldung für die API-Dokumentation (/docs/api).
//
// Der Reverse-Proxy fragt vor jeder Doku-Seite bei /pruefen nach. Wichtig ist
// beides: Ohne gültiges Cookie darf niemand durch, und mit gültigem Cookie
// muss es klappen — ein Fehler in die eine Richtung stellt die
// Berechtigungsmatrix öffentlich ins Netz, einer in die andere sperrt aus.
//
// Dazu die Proxy-Unterscheidung: Caddy will eine 401 und leitet selbst um,
// Traefik reicht die Antwort durch und braucht deshalb die 302.

const request = require('supertest');
const jwt = require('jsonwebtoken');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, closePool } = require('../helpers/db');

const SECRET = process.env.JWT_SECRET || 'test-secret-key-for-vitest';
const PASSWORT = process.env.DOCS_PASSWORD || 'test-docs-passwort';

/** Holt den Wert des Doku-Cookies aus den Set-Cookie-Headern. */
function cookieAus(res) {
  const gesetzt = res.headers['set-cookie'] || [];
  const treffer = gesetzt.find((c) => c.startsWith('kq_docs='));
  return treffer ? treffer.split(';')[0] : null;
}

describe('Docs-Auth Routes', () => {
  let app;
  let db;

  beforeAll(async () => {
    db = getTestPool();
    app = getTestApp(db);
  });

  afterAll(async () => {
    await closePool();
  });

  describe('POST /api/docs-auth/anmelden', () => {
    it('falsches Passwort wird abgelehnt (401, kein Cookie)', async () => {
      const res = await request(app)
        .post('/api/docs-auth/anmelden')
        .send({ passwort: 'definitiv-falsch' });

      expect(res.status).toBe(401);
      expect(cookieAus(res)).toBeNull();
    });

    it('fehlendes Passwort wird abgelehnt (401)', async () => {
      const res = await request(app).post('/api/docs-auth/anmelden').send({});
      expect(res.status).toBe(401);
      expect(cookieAus(res)).toBeNull();
    });

    it('richtiges Passwort setzt ein HttpOnly-Cookie (200)', async () => {
      const res = await request(app)
        .post('/api/docs-auth/anmelden')
        .send({ passwort: PASSWORT });

      expect(res.status).toBe(200);
      const gesetzt = (res.headers['set-cookie'] || []).find((c) => c.startsWith('kq_docs='));
      expect(gesetzt).toBeDefined();
      expect(gesetzt).toContain('HttpOnly');
      expect(gesetzt).toContain('SameSite=Lax');
    });
  });

  describe('GET /api/docs-auth/pruefen', () => {
    it('ohne Cookie: 401 (Caddy leitet selbst um)', async () => {
      const res = await request(app).get('/api/docs-auth/pruefen');
      expect(res.status).toBe(401);
    });

    it('ohne Cookie mit den Proxy-Headern: 302 auf die Anmeldeseite (Traefik)', async () => {
      const res = await request(app)
        .get('/api/docs-auth/pruefen')
        .set('X-Forwarded-Proto', 'https')
        .set('X-Forwarded-Host', 'konfi-quest.de')
        .set('X-Forwarded-Uri', '/docs/api/berechtigungen.html');

      expect(res.status).toBe(302);
      expect(res.headers.location).toBe(
        'https://konfi-quest.de/docs/api/login.html?weiter=%2Fdocs%2Fapi%2Fberechtigungen.html'
      );
    });

    it('die Weiterleitung zeigt nie auf den Container-Host', async () => {
      // Bei Forward-Auth kommt die Anfrage vom Proxy, der Host-Header lautet
      // also "backend:5000". Sowohl res.redirect() als auch ein relativer
      // Location-Header endeten dadurch im Container-Netz — beides in
      // Produktion beobachtet. Massgeblich ist X-Forwarded-Host.
      const res = await request(app)
        .get('/api/docs-auth/pruefen')
        .set('Host', 'backend:5000')
        .set('X-Forwarded-Proto', 'https')
        .set('X-Forwarded-Host', 'konfi-quest.de')
        .set('X-Forwarded-Uri', '/docs/api/');

      expect(res.status).toBe(302);
      expect(res.headers.location).toBe(
        'https://konfi-quest.de/docs/api/login.html?weiter=%2Fdocs%2Fapi%2F'
      );
      expect(res.headers.location).not.toContain('backend:5000');
      expect(res.headers.location).not.toContain('http://backend');
    });

    it('ohne X-Forwarded-Host wird der Host-Header genommen', async () => {
      // Fallback fuer Proxys, die nur die URI mitschicken.
      const res = await request(app)
        .get('/api/docs-auth/pruefen')
        .set('Host', 'konfi-quest.de')
        .set('X-Forwarded-Uri', '/docs/api/');

      expect(res.status).toBe(302);
      expect(res.headers.location).toBe(
        'https://konfi-quest.de/docs/api/login.html?weiter=%2Fdocs%2Fapi%2F'
      );
    });

    it('bleibt bei https, auch wenn der Proxy http meldet', async () => {
      // Auf godsapp steht Apache (TLS) vor Traefik und setzt
      // X-Forwarded-Proto nicht; Traefik meldet daraufhin "http". Ein
      // http-Redirect schickt den Browser ueber einen ueberfluessigen Umweg.
      const res = await request(app)
        .get('/api/docs-auth/pruefen')
        .set('X-Forwarded-Proto', 'http')
        .set('X-Forwarded-Host', 'konfi-quest.de')
        .set('X-Forwarded-Uri', '/docs/api/');

      expect(res.status).toBe(302);
      expect(res.headers.location).toBe(
        'https://konfi-quest.de/docs/api/login.html?weiter=%2Fdocs%2Fapi%2F'
      );
      expect(res.headers.location.startsWith('https://')).toBe(true);
    });

    it('mit gültigem Cookie: 200', async () => {
      const anmeldung = await request(app)
        .post('/api/docs-auth/anmelden')
        .send({ passwort: PASSWORT });
      const cookie = cookieAus(anmeldung);
      expect(cookie).not.toBeNull();

      const res = await request(app).get('/api/docs-auth/pruefen').set('Cookie', cookie);
      expect(res.status).toBe(200);
    });

    it('ein Token mit fremdem Zweck wird abgelehnt (401)', async () => {
      // Ein normales Anmeldetoken der App darf die Doku nicht aufschließen.
      const fremd = jwt.sign({ id: 1, type: 'admin' }, SECRET, { expiresIn: '1h' });
      const res = await request(app)
        .get('/api/docs-auth/pruefen')
        .set('Cookie', `kq_docs=${encodeURIComponent(fremd)}`);

      expect(res.status).toBe(401);
    });

    it('ein abgelaufenes Token wird abgelehnt (401)', async () => {
      const abgelaufen = jwt.sign({ zweck: 'docs' }, SECRET, { expiresIn: '-1s' });
      const res = await request(app)
        .get('/api/docs-auth/pruefen')
        .set('Cookie', `kq_docs=${encodeURIComponent(abgelaufen)}`);

      expect(res.status).toBe(401);
    });

    it('ein mit fremdem Schlüssel signiertes Token wird abgelehnt (401)', async () => {
      const gefaelscht = jwt.sign({ zweck: 'docs' }, 'falscher-schluessel', { expiresIn: '1h' });
      const res = await request(app)
        .get('/api/docs-auth/pruefen')
        .set('Cookie', `kq_docs=${encodeURIComponent(gefaelscht)}`);

      expect(res.status).toBe(401);
    });
  });

  describe('Rate-Limit auf POST /api/docs-auth/anmelden', () => {
    // Ein gemeinsames Passwort ohne Benutzernamen: Ohne strenges Limit liesse
    // es sich schlicht durchprobieren. Der Limiter wird in server.js gebaut und
    // in createApp auf genau diese Route gelegt — hier wird die Verdrahtung
    // geprüft, mit einem echten express-rate-limit und kleinem Limit.
    const rateLimit = require('express-rate-limit');
    const { createApp } = require('../../createApp');
    const os = require('os');
    const path = require('path');

    function appMitLimit(max) {
      return createApp(db, {
        uploadsDir: path.join(os.tmpdir(), 'konfi-test-uploads'),
        rateLimiters: {
          docsLoginLimiter: rateLimit({
            windowMs: 60 * 1000,
            max,
            message: { error: 'Zu viele Anmeldeversuche. Bitte warte 15 Minuten.' },
            standardHeaders: true,
            legacyHeaders: false,
            skipSuccessfulRequests: true
          })
        }
      });
    }

    it('nach zu vielen Fehlversuchen blockt die Route (429), auch mit richtigem Passwort', async () => {
      const begrenzt = appMitLimit(3);

      for (let i = 0; i < 3; i++) {
        const res = await request(begrenzt)
          .post('/api/docs-auth/anmelden')
          .send({ passwort: 'definitiv-falsch' });
        expect(res.status).toBe(401);
      }

      // Vierter Versuch: Das Limit greift VOR der Passwortprüfung —
      // selbst das richtige Passwort kommt nicht mehr durch.
      const res = await request(begrenzt)
        .post('/api/docs-auth/anmelden')
        .send({ passwort: PASSWORT });
      expect(res.status).toBe(429);
      expect(cookieAus(res)).toBeNull();
    });

    it('erfolgreiche Anmeldungen zählen nicht gegen das Limit', async () => {
      const begrenzt = appMitLimit(2);

      // Mehr erfolgreiche Anmeldungen als das Limit an Fehlversuchen erlaubt —
      // alle muessen durchgehen (skipSuccessfulRequests wie in Produktion).
      for (let i = 0; i < 3; i++) {
        const res = await request(begrenzt)
          .post('/api/docs-auth/anmelden')
          .send({ passwort: PASSWORT });
        expect(res.status).toBe(200);
      }

      // Und ein einzelner Fehlversuch danach ist ein normales 401, kein 429.
      const res = await request(begrenzt)
        .post('/api/docs-auth/anmelden')
        .send({ passwort: 'definitiv-falsch' });
      expect(res.status).toBe(401);
    });

    it('das Limit trifft nur die Anmeldung, nicht die Cookie-Prüfung', async () => {
      const begrenzt = appMitLimit(1);

      const erster = await request(begrenzt)
        .post('/api/docs-auth/anmelden')
        .send({ passwort: 'definitiv-falsch' });
      expect(erster.status).toBe(401);

      const zweiter = await request(begrenzt)
        .post('/api/docs-auth/anmelden')
        .send({ passwort: 'definitiv-falsch' });
      expect(zweiter.status).toBe(429);

      // /pruefen bleibt erreichbar (der Proxy fragt hier bei JEDEM Doku-Aufruf).
      const pruefen = await request(begrenzt).get('/api/docs-auth/pruefen');
      expect(pruefen.status).toBe(401);
    });
  });

  describe('POST /api/docs-auth/abmelden', () => {
    it('löscht das Cookie, danach greift die Sperre wieder', async () => {
      const res = await request(app).post('/api/docs-auth/abmelden');
      expect(res.status).toBe(200);
      const gesetzt = (res.headers['set-cookie'] || []).find((c) => c.startsWith('kq_docs='));
      expect(gesetzt).toContain('Max-Age=0');
    });
  });
});
