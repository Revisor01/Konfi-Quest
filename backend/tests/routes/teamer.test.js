const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, JAHRGAENGE } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

describe('Teamer Routes', () => {
  let app;
  let db;
  let orgAdminToken;
  let adminToken;
  let teamerToken;
  let konfiToken;
  let teamer2Token;
  let admin2Token;
  let orgAdmin2Token;

  beforeAll(async () => {
    db = getTestPool();
    app = getTestApp(db);
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    orgAdminToken = generateToken('orgAdmin1');
    adminToken = generateToken('admin1');
    teamerToken = generateToken('teamer1');
    konfiToken = generateToken('konfi1');
    teamer2Token = generateToken('teamer2');
    admin2Token = generateToken('admin2');
    orgAdmin2Token = generateToken('orgAdmin2');
  });

  afterAll(async () => {
    await closePool();
  });

  // ================================================================
  // TEAMER PROFIL
  // ================================================================
  describe('GET /api/teamer/profile', () => {
    it('Teamer bekommt 200 + Profil-Daten', async () => {
      const res = await request(app)
        .get('/api/teamer/profile')
        .set('Authorization', `Bearer ${teamerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.display_name).toBeDefined();
      expect(res.body.konfi_data).toBeDefined();
    });

    it('Konfi bekommt 403', async () => {
      const res = await request(app)
        .get('/api/teamer/profile')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(403);
    });

    it('Admin bekommt 403 (nur Teamer)', async () => {
      const res = await request(app)
        .get('/api/teamer/profile')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(403);
    });
  });

  // ================================================================
  // TEAMER KONFIS
  // ================================================================
  describe('GET /api/teamer/konfis', () => {
    it('Teamer bekommt 200 + Konfi-Liste', async () => {
      const res = await request(app)
        .get('/api/teamer/konfis')
        .set('Authorization', `Bearer ${teamerToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('Admin bekommt 200 + alle Konfis der Org', async () => {
      const res = await request(app)
        .get('/api/teamer/konfis')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      // Org 1 hat 2 Konfis (konfi1, konfi2)
      expect(res.body.length).toBe(2);
    });

    it('Konfi bekommt 403', async () => {
      const res = await request(app)
        .get('/api/teamer/konfis')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(403);
    });
  });

  // ================================================================
  // TEAMER KONFI-HISTORY
  // ================================================================
  describe('GET /api/teamer/konfi-history', () => {
    it('Teamer bekommt 200 + History-Daten', async () => {
      const res = await request(app)
        .get('/api/teamer/konfi-history')
        .set('Authorization', `Bearer ${teamerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.history).toBeDefined();
      expect(res.body.totals).toBeDefined();
    });

    it('Konfi bekommt 403', async () => {
      const res = await request(app)
        .get('/api/teamer/konfi-history')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(403);
    });

    it('Admin bekommt 403 (requireTeamer erlaubt, aber role_name check)', async () => {
      const res = await request(app)
        .get('/api/teamer/konfi-history')
        .set('Authorization', `Bearer ${adminToken}`);

      // requireTeamer erlaubt Admin, aber der route-interne check prueft role_name === 'teamer'
      expect(res.status).toBe(403);
    });
  });

  // ================================================================
  // TEAMER BADGES
  // ================================================================
  describe('GET /api/teamer/badges', () => {
    it('Teamer bekommt 200 + Badge-Liste', async () => {
      const res = await request(app)
        .get('/api/teamer/badges')
        .set('Authorization', `Bearer ${teamerToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('Konfi bekommt 403', async () => {
      const res = await request(app)
        .get('/api/teamer/badges')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('GET /api/teamer/badges/unseen', () => {
    it('Teamer bekommt 200 + unseen Count', async () => {
      const res = await request(app)
        .get('/api/teamer/badges/unseen')
        .set('Authorization', `Bearer ${teamerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.unseen).toBeDefined();
      expect(typeof res.body.unseen).toBe('number');
    });

    it('Konfi bekommt 403', async () => {
      const res = await request(app)
        .get('/api/teamer/badges/unseen')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('PUT /api/teamer/badges/mark-seen', () => {
    it('Teamer markiert Badges als gesehen -> 200', async () => {
      const res = await request(app)
        .put('/api/teamer/badges/mark-seen')
        .set('Authorization', `Bearer ${teamerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('gesehen');
    });

    it('Konfi bekommt 403', async () => {
      const res = await request(app)
        .put('/api/teamer/badges/mark-seen')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(403);
    });
  });

  // ================================================================
  // ZERTIFIKAT-TYPEN CRUD
  // ================================================================
  describe('GET /api/teamer/certificate-types', () => {
    it('Admin bekommt 200 + leere Liste', async () => {
      const res = await request(app)
        .get('/api/teamer/certificate-types')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('Teamer bekommt 403 (requireAdmin)', async () => {
      const res = await request(app)
        .get('/api/teamer/certificate-types')
        .set('Authorization', `Bearer ${teamerToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/teamer/certificate-types', () => {
    it('OrgAdmin erstellt Zertifikat-Typ -> 201', async () => {
      const res = await request(app)
        .post('/api/teamer/certificate-types')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ name: 'Erste-Hilfe-Kurs', icon: 'medkit' });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.name).toBe('Erste-Hilfe-Kurs');
    });

    it('Admin (nicht OrgAdmin) bekommt 403', async () => {
      const res = await request(app)
        .post('/api/teamer/certificate-types')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Test-Zertifikat' });

      expect(res.status).toBe(403);
    });

    it('Leerer Name gibt 400', async () => {
      const res = await request(app)
        .post('/api/teamer/certificate-types')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ name: '' });

      expect(res.status).toBe(400);
    });
  });

  describe('PUT /api/teamer/certificate-types/:id', () => {
    let certTypeId;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/teamer/certificate-types')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ name: 'Original-Zertifikat' });
      certTypeId = res.body.id;
    });

    it('OrgAdmin aktualisiert Typ -> 200', async () => {
      const res = await request(app)
        .put(`/api/teamer/certificate-types/${certTypeId}`)
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ name: 'Aktualisiertes Zertifikat' });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('aktualisiert');
    });

    it('Nicht-existierende ID gibt 404', async () => {
      const res = await request(app)
        .put('/api/teamer/certificate-types/99999')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ name: 'Gibts nicht' });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/teamer/certificate-types/:id', () => {
    let certTypeId;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/teamer/certificate-types')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ name: 'Loesch-Zertifikat' });
      certTypeId = res.body.id;
    });

    it('OrgAdmin loescht Typ -> 200', async () => {
      const res = await request(app)
        .delete(`/api/teamer/certificate-types/${certTypeId}`)
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('gelöscht');
    });

    it('Nicht-existierende ID gibt 404', async () => {
      const res = await request(app)
        .delete('/api/teamer/certificate-types/99999')
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(res.status).toBe(404);
    });
  });

  // ================================================================
  // ZERTIFIKAT-ZUWEISUNG
  // ================================================================
  describe('GET /api/teamer/:userId/certificates', () => {
    it('Admin bekommt 200 + Zertifikate eines Users', async () => {
      const res = await request(app)
        .get(`/api/teamer/${USERS.teamer1.id}/certificates`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('Teamer bekommt 403 (requireAdmin)', async () => {
      const res = await request(app)
        .get(`/api/teamer/${USERS.teamer1.id}/certificates`)
        .set('Authorization', `Bearer ${teamerToken}`);

      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/teamer/:userId/certificates', () => {
    let certTypeId;

    beforeEach(async () => {
      const res = await request(app)
        .post('/api/teamer/certificate-types')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ name: 'Zuweisungs-Zertifikat' });
      certTypeId = res.body.id;
    });

    it('OrgAdmin vergibt Zertifikat -> 201', async () => {
      const res = await request(app)
        .post(`/api/teamer/${USERS.teamer1.id}/certificates`)
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({
          certificate_type_id: certTypeId,
          issued_date: '2026-01-15',
        });

      expect(res.status).toBe(201);
      expect(res.body.message).toContain('zugewiesen');
    });

    it('Fehlende Pflichtfelder geben Validierungsfehler', async () => {
      const res = await request(app)
        .post(`/api/teamer/${USERS.teamer1.id}/certificates`)
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({});

      expect(res.status).toBe(400);
    });

    it('Nicht-Teamer User gibt 404', async () => {
      const res = await request(app)
        .post(`/api/teamer/${USERS.konfi1.id}/certificates`)
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({
          certificate_type_id: certTypeId,
          issued_date: '2026-01-15',
        });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/teamer/:userId/certificates/:certId', () => {
    let certId;
    let certTypeId;

    beforeEach(async () => {
      // Zertifikat-Typ erstellen
      const typeRes = await request(app)
        .post('/api/teamer/certificate-types')
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({ name: 'Loesch-Zertifikat-Typ' });
      certTypeId = typeRes.body.id;

      // Zertifikat zuweisen
      const certRes = await request(app)
        .post(`/api/teamer/${USERS.teamer1.id}/certificates`)
        .set('Authorization', `Bearer ${orgAdminToken}`)
        .send({
          certificate_type_id: certTypeId,
          issued_date: '2026-01-15',
        });
      certId = certRes.body.id;
    });

    it('OrgAdmin loescht Zertifikat -> 200', async () => {
      const res = await request(app)
        .delete(`/api/teamer/${USERS.teamer1.id}/certificates/${certId}`)
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('entfernt');
    });

    it('Nicht-existierende ID gibt 404', async () => {
      const res = await request(app)
        .delete(`/api/teamer/${USERS.teamer1.id}/certificates/99999`)
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(res.status).toBe(404);
    });
  });

  // ================================================================
  // TEAMER DASHBOARD
  // ================================================================
  describe('GET /api/teamer/dashboard', () => {
    it('Teamer bekommt 200 + Dashboard-Daten', async () => {
      const res = await request(app)
        .get('/api/teamer/dashboard')
        .set('Authorization', `Bearer ${teamerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.greeting).toBeDefined();
      expect(res.body.greeting.display_name).toBeDefined();
      expect(res.body.certificates).toBeDefined();
      expect(res.body.events).toBeDefined();
      expect(res.body.badges).toBeDefined();
      expect(res.body.config).toBeDefined();
    });

    it('Konfi bekommt 403', async () => {
      const res = await request(app)
        .get('/api/teamer/dashboard')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(403);
    });

    it('Admin bekommt 403 (nur Teamer)', async () => {
      const res = await request(app)
        .get('/api/teamer/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(403);
    });
  });

  // ================================================================
  // TAGESLOSUNG
  // ================================================================
  describe('GET /api/teamer/tageslosung', () => {
    it('Teamer bekommt 200 oder graceful error', async () => {
      const res = await request(app)
        .get('/api/teamer/tageslosung')
        .set('Authorization', `Bearer ${teamerToken}`);

      // losungService kann offline sein — 200 oder 500, aber kein crash
      expect([200, 500]).toContain(res.status);
    });

    it('Konfi bekommt 403', async () => {
      const res = await request(app)
        .get('/api/teamer/tageslosung')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(403);
    });
  });

  // ================================================================
  // ORG-ISOLATION
  // ================================================================
  describe('Org-Isolation', () => {
    it('Teamer2 sieht keine Konfis aus Org1', async () => {
      const res = await request(app)
        .get('/api/teamer/konfis')
        .set('Authorization', `Bearer ${teamer2Token}`);

      expect(res.status).toBe(200);
      const ids = res.body.map(k => k.id);
      expect(ids).not.toContain(USERS.konfi1.id);
      expect(ids).not.toContain(USERS.konfi2.id);
    });

    it('Admin2 sieht keine Zertifikate von Teamer1 aus Org1', async () => {
      const res = await request(app)
        .get(`/api/teamer/${USERS.teamer1.id}/certificates`)
        .set('Authorization', `Bearer ${admin2Token}`);

      expect(res.status).toBe(200);
      // Gibt leere Liste zurueck (gefiltert nach org_id)
      expect(res.body.length).toBe(0);
    });
  });
});
