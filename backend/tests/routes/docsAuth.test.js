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

    it('ohne Cookie mit X-Forwarded-Uri: 302 auf die Anmeldeseite (Traefik)', async () => {
      const res = await request(app)
        .get('/api/docs-auth/pruefen')
        .set('X-Forwarded-Uri', '/docs/api/berechtigungen.html');

      expect(res.status).toBe(302);
      expect(res.headers.location).toBe(
        '/docs/api/login.html?weiter=%2Fdocs%2Fapi%2Fberechtigungen.html'
      );
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

  describe('POST /api/docs-auth/abmelden', () => {
    it('löscht das Cookie, danach greift die Sperre wieder', async () => {
      const res = await request(app).post('/api/docs-auth/abmelden');
      expect(res.status).toBe(200);
      const gesetzt = (res.headers['set-cookie'] || []).find((c) => c.startsWith('kq_docs='));
      expect(gesetzt).toContain('Max-Age=0');
    });
  });
});
