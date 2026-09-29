// "Kein Zugriff auf diese Organisation" traegt eine feste Kennung
// (Begriffe "Gemeinde statt Organisation", 29.09.2026).
//
// Alle Nutzertexte sagen seit dem 29.09.2026 "Gemeinde" -- bis auf diesen
// 403: Die Store-Apps 2.2.0 und 2.3.0 vergleichen ihn woertlich
// (services/api.ts) und fallen nur damit in die Stamm-Gemeinde zurueck, wenn
// jemandem die Mitgliedschaft in der aktiven Zweit-Gemeinde entzogen wurde.
// Der Text bleibt deshalb; dazu kommt error_code 'org_kein_zugriff', an dem
// die aktuelle App die Ablehnung erkennt. Sobald keine App ohne diese
// Pruefung mehr ruft, kann der Text "Gemeinde" sagen.
//
// Die Ablehnung steht an drei Stellen: rbac.js (alle Routen mit
// verifyTokenRBAC) und die beiden Datei-Routen mit eigener Anmeldung. Alle
// drei liefern dieselbe Antwort -- Text UND Kennung.
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, ORGS } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const { invalidateUserCache } = require('../../middleware/rbac');

const ABLEHNUNG = { error: 'Kein Zugriff auf diese Organisation', error_code: 'org_kein_zugriff' };

describe('403 bei fremder aktiver Gemeinde: Text fuer alte Apps, Kennung fuer neue', () => {
  let app;
  let db;

  beforeAll(async () => {
    db = getTestPool();
    app = getTestApp(db);
  });

  afterAll(async () => {
    await closePool();
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    // admin1 (id 4, Stamm-Gemeinde 1) ist NICHT Mitglied von Gemeinde 2.
    invalidateUserCache(4);
  });

  const alsAdmin1InGemeinde2 = (req) => req
    .set('Authorization', `Bearer ${generateToken('admin1')}`)
    .set('X-Active-Organization', String(ORGS.andereGemeinde.id));

  describe('verboten: ohne Mitgliedschaft in der aktiven Gemeinde', () => {
    it('Routen mit verifyTokenRBAC (rbac.js)', async () => {
      const res = await alsAdmin1InGemeinde2(request(app).get('/api/events'));
      expect(res.status).toBe(403);
      expect(res.body).toEqual(ABLEHNUNG);
    });

    it('GET /api/challenges/files/:filename', async () => {
      const res = await alsAdmin1InGemeinde2(request(app).get(`/api/challenges/files/${'a'.repeat(64)}`));
      expect(res.status).toBe(403);
      expect(res.body).toEqual(ABLEHNUNG);
    });

    it('GET /api/chat/files/:filename', async () => {
      const res = await alsAdmin1InGemeinde2(request(app).get(`/api/chat/files/${'a'.repeat(64)}`));
      expect(res.status).toBe(403);
      expect(res.body).toEqual(ABLEHNUNG);
    });
  });

  describe('erlaubt: mit Mitgliedschaft greift die Ablehnung nicht', () => {
    beforeEach(async () => {
      await db.query(`INSERT INTO user_organizations (user_id, organization_id, role_id)
        VALUES (4, 2, 7) ON CONFLICT DO NOTHING`);
      invalidateUserCache(4);
    });

    it('Routen mit verifyTokenRBAC liefern die Liste der aktiven Gemeinde', async () => {
      const res = await alsAdmin1InGemeinde2(request(app).get('/api/events'));
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('die Datei-Routen kommen an der Gemeinde-Pruefung vorbei (unbekannte Datei: 404)', async () => {
      const challenge = await alsAdmin1InGemeinde2(request(app).get(`/api/challenges/files/${'a'.repeat(64)}`));
      const chat = await alsAdmin1InGemeinde2(request(app).get(`/api/chat/files/${'a'.repeat(64)}`));
      expect(challenge.status).toBe(404);
      expect(chat.status).toBe(404);
    });
  });
});
