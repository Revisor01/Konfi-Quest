const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, JAHRGAENGE, ORGS } = require('../helpers/seed');
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

    it('Ein soft-geloeschter Konfi erscheint NICHT in der Teamer-Konfi-Uebersicht', async () => {
      // Vorher: beide Konfis der Org sind sichtbar
      const before = await request(app)
        .get('/api/teamer/konfis')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(before.status).toBe(200);
      expect(before.body.length).toBe(2);

      // Konfi1 soft-loeschen
      await db.query('UPDATE users SET deleted_at = NOW() WHERE id = $1', [USERS.konfi1.id]);

      // Nachher: nur der aktive Konfi (konfi2) ist sichtbar
      const after = await request(app)
        .get('/api/teamer/konfis')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(after.status).toBe(200);
      const afterIds = after.body.map(k => k.id);
      expect(afterIds).not.toContain(USERS.konfi1.id);
      expect(afterIds).toContain(USERS.konfi2.id);
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

  // ================================================================
  // GET /api/teamer/badges - teamer_year-Progress mit Startjahr (Phase 116-02)
  // ================================================================
  describe('GET /api/teamer/badges teamer_year-Progress', () => {
    // Teamer-Aktivitaet in einem bestimmten Jahr fuer teamer1 anlegen
    async function createTeamerActivityInYear(year) {
      const { rows: [act] } = await db.query(
        `INSERT INTO activities (name, points, type, organization_id, target_role)
         VALUES ($1, 1, 'gottesdienst', $2, 'teamer')
         RETURNING id`,
        [`Teamer-Aktion ${year}-${Math.random()}`, ORGS.testGemeinde.id]
      );
      await db.query(
        `INSERT INTO user_activities (user_id, activity_id, completed_date, admin_id, organization_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [USERS.teamer1.id, act.id, `${year}-06-15`, USERS.admin1.id, ORGS.testGemeinde.id]
      );
    }

    async function createTeamerYearBadge(criteriaValue) {
      const { rows: [badge] } = await db.query(
        `INSERT INTO custom_badges (name, criteria_type, criteria_value, icon, color, organization_id, target_role, is_active)
         VALUES ($1, 'teamer_year', $2, 'ribbon', '#7c3aed', $3, 'teamer', true)
         RETURNING id`,
        [`Teamer-Jahre-${Math.random()}`, criteriaValue, ORGS.testGemeinde.id]
      );
      return badge.id;
    }

    it('teamer_since=2026 + Aktivitaet 2024+2026 -> current=1 (nur 2026 zaehlt)', async () => {
      await db.query('UPDATE users SET teamer_since = $1 WHERE id = $2', ['2026-01-01', USERS.teamer1.id]);
      await createTeamerActivityInYear(2024);
      await createTeamerActivityInYear(2026);
      const badgeId = await createTeamerYearBadge(5);

      const res = await request(app)
        .get('/api/teamer/badges')
        .set('Authorization', `Bearer ${teamerToken}`);

      expect(res.status).toBe(200);
      const badge = res.body.find(b => b.id === badgeId);
      expect(badge).toBeDefined();
      expect(badge.progress_points).toBe(1);
    });

    it('teamer_since=2024 + Aktivitaet 2024+2026 -> current=2', async () => {
      await db.query('UPDATE users SET teamer_since = $1 WHERE id = $2', ['2024-01-01', USERS.teamer1.id]);
      await createTeamerActivityInYear(2024);
      await createTeamerActivityInYear(2026);
      const badgeId = await createTeamerYearBadge(5);

      const res = await request(app)
        .get('/api/teamer/badges')
        .set('Authorization', `Bearer ${teamerToken}`);

      expect(res.status).toBe(200);
      const badge = res.body.find(b => b.id === badgeId);
      expect(badge).toBeDefined();
      expect(badge.progress_points).toBe(2);
    });

    it('teamer_since=NULL -> Fallback aelteste Aktivitaet, alle Jahre ab dann', async () => {
      await db.query('UPDATE users SET teamer_since = NULL WHERE id = $1', [USERS.teamer1.id]);
      await createTeamerActivityInYear(2023);
      await createTeamerActivityInYear(2024);
      const badgeId = await createTeamerYearBadge(5);

      const res = await request(app)
        .get('/api/teamer/badges')
        .set('Authorization', `Bearer ${teamerToken}`);

      expect(res.status).toBe(200);
      const badge = res.body.find(b => b.id === badgeId);
      expect(badge).toBeDefined();
      expect(badge.progress_points).toBe(2);
    });

    it('Keine Regression: event_count-Progress zaehlt weiterhin besuchte Events', async () => {
      // 2 besuchte Events fuer teamer1
      for (let i = 0; i < 2; i++) {
        const { rows: [ev] } = await db.query(
          `INSERT INTO events (name, event_date, organization_id, mandatory, max_participants, point_type, points)
           VALUES ($1, NOW() - interval '1 day', $2, false, 0, 'gemeinde', 0)
           RETURNING id`,
          [`Teamer-Event ${i}-${Math.random()}`, ORGS.testGemeinde.id]
        );
        await db.query(
          `INSERT INTO event_bookings (user_id, event_id, organization_id, status, attendance_status)
           VALUES ($1, $2, $3, 'confirmed', 'present')`,
          [USERS.teamer1.id, ev.id, ORGS.testGemeinde.id]
        );
      }
      const { rows: [badge] } = await db.query(
        `INSERT INTO custom_badges (name, criteria_type, criteria_value, icon, color, organization_id, target_role, is_active)
         VALUES ($1, 'event_count', 10, 'calendar', '#10b981', $2, 'teamer', true)
         RETURNING id`,
        [`Event-Count-${Math.random()}`, ORGS.testGemeinde.id]
      );

      const res = await request(app)
        .get('/api/teamer/badges')
        .set('Authorization', `Bearer ${teamerToken}`);

      expect(res.status).toBe(200);
      const found = res.body.find(b => b.id === badge.id);
      expect(found).toBeDefined();
      expect(found.progress_points).toBe(2);
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
