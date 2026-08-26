const request = require('supertest');
const fs = require('fs');
const path = require('path');
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

    it('Befoerderter Konfi sieht seine Werte AUCH ohne Jahrgang (jahrgang_id NULL)', async () => {
      // teamer1 (id 3) bekommt ein konfi_profiles mit Werten, aber OHNE Jahrgang
      // (simuliert: alter Jahrgang wurde gelöscht -> jahrgang_id = NULL).
      await db.query(
        `INSERT INTO konfi_profiles (user_id, jahrgang_id, gottesdienst_points, gemeinde_points, organization_id)
         VALUES (3, NULL, 7, 4, 1)`
      );
      const res = await request(app)
        .get('/api/teamer/profile')
        .set('Authorization', `Bearer ${teamerToken}`);
      expect(res.status).toBe(200);
      // Werte MUESSEN sichtbar bleiben, obwohl kein Jahrgang mehr da ist.
      expect(res.body.konfi_data).not.toBeNull();
      expect(Number(res.body.konfi_data.gottesdienst_points)).toBe(7);
      expect(Number(res.body.konfi_data.gemeinde_points)).toBe(4);
      expect(res.body.konfi_data.jahrgang_name).toBe('');
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

      // Konfi1 soft-löschen
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

      // requireTeamer erlaubt Admin, aber der route-interne check prüft role_name === 'teamer'
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

    // Befund 24.08.2026: Die Route lieferte geheime Abzeichen ungefiltert aus.
    // Die Ansicht verlässt sich darauf, dass sie gar nicht erst kommen — beim
    // Konfi tut das Backend das, hier fehlte es. Name, Beschreibung und
    // Fortschritt standen damit offen da.
    it('Ein unverdientes geheimes Abzeichen wird nicht ausgeliefert', async () => {
      const { rows: [geheim] } = await db.query(
        `INSERT INTO custom_badges (name, description, criteria_type, criteria_value, icon, color, organization_id, target_role, is_active, is_hidden)
         VALUES ('Streng geheim', 'Verraet die Ueberraschung', 'teamer_year', 99, 'ribbon', '#5b21b6', $1, 'teamer', true, true)
         RETURNING id`,
        [ORGS.testGemeinde.id]
      );

      const res = await request(app)
        .get('/api/teamer/badges')
        .set('Authorization', `Bearer ${teamerToken}`);
      expect(res.status).toBe(200);

      const ids = res.body.map(b => b.id);
      expect(ids).not.toContain(geheim.id);
      // Der Name darf auch sonst nirgends in der Antwort auftauchen.
      expect(JSON.stringify(res.body)).not.toContain('Streng geheim');
    });

    it('Ein VERDIENTES geheimes Abzeichen wird sehr wohl ausgeliefert', async () => {
      const { rows: [geheim] } = await db.query(
        `INSERT INTO custom_badges (name, criteria_type, criteria_value, icon, color, organization_id, target_role, is_active, is_hidden)
         VALUES ('Schon entdeckt', 'teamer_year', 1, 'ribbon', '#5b21b6', $1, 'teamer', true, true)
         RETURNING id`,
        [ORGS.testGemeinde.id]
      );
      await db.query(
        `INSERT INTO user_badges (user_id, badge_id, awarded_date, organization_id)
         VALUES ($1, $2, CURRENT_DATE, $3)`,
        [USERS.teamer1.id, geheim.id, ORGS.testGemeinde.id]
      );

      const res = await request(app)
        .get('/api/teamer/badges')
        .set('Authorization', `Bearer ${teamerToken}`);
      expect(res.status).toBe(200);
      expect(res.body.map(b => b.id)).toContain(geheim.id);
    });

    it('Die Gesamtzahl der Geheimnisse steht in der Kopfzeile', async () => {
      await db.query(
        `INSERT INTO custom_badges (name, criteria_type, criteria_value, icon, color, organization_id, target_role, is_active, is_hidden)
         VALUES ('Geheim eins', 'teamer_year', 98, 'ribbon', '#5b21b6', $1, 'teamer', true, true),
                ('Geheim zwei', 'teamer_year', 97, 'ribbon', '#5b21b6', $1, 'teamer', true, true)`,
        [ORGS.testGemeinde.id]
      );

      const res = await request(app)
        .get('/api/teamer/badges')
        .set('Authorization', `Bearer ${teamerToken}`);
      expect(res.status).toBe(200);
      // Beide sind unverdient, stehen also nicht in der Liste...
      expect(res.body.filter(b => b.is_hidden).length).toBe(0);
      // ...werden aber gezählt, damit "x Geheimnisse" stimmt.
      expect(res.headers['x-badges-secret-total']).toBe('2');
    });
  });

  // ================================================================
  // GET /api/teamer/badges - teamer_year-Progress mit Startjahr (Phase 116-02)
  // ================================================================
  describe('GET /api/teamer/badges teamer_year-Progress', () => {
    // Teamer-Aktivität in einem bestimmten Jahr für teamer1 anlegen
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
      // 2 besuchte Events für teamer1
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

    // Bis 26.08.2026 stand hier 403. Entscheidung: Zertifikate anlegen und
    // vergeben gehoert zur Leitung, nicht nur zum Org-Admin -- die Oberflaeche
    // bot es der Rolle 'admin' laengst an und lief in einen 403.
    it('Admin erstellt Zertifikat-Typ -> 201', async () => {
      const res = await request(app)
        .post('/api/teamer/certificate-types')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Test-Zertifikat' });

      expect(res.status).toBe(201);
      expect(res.body.name).toBe('Test-Zertifikat');
    });

    it('Teamer:in darf weiterhin keinen Zertifikat-Typ anlegen -> 403', async () => {
      // Gegenprobe: Die Oeffnung gilt nur bis zur Rolle 'admin'.
      const res = await request(app)
        .post('/api/teamer/certificate-types')
        .set('Authorization', `Bearer ${teamerToken}`)
        .send({ name: 'Vom Teamer' });

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

    // Entscheidung 26.08.2026: Auch die Rolle 'admin' vergibt Zertifikate.
    // KonfiDetailSections bot die Zuweisung ungegatet an -- die Aktion lief
    // fuer Admins in einen 403.
    it('Admin vergibt Zertifikat -> 201', async () => {
      const res = await request(app)
        .post(`/api/teamer/${USERS.teamer1.id}/certificates`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          certificate_type_id: certTypeId,
          issued_date: '2026-01-15',
        });

      expect(res.status).toBe(201);

      const { rows: [vergeben] } = await db.query(
        'SELECT count(*)::int c FROM user_certificates WHERE user_id = $1 AND certificate_type_id = $2',
        [USERS.teamer1.id, certTypeId]
      );
      expect(vergeben.c).toBe(1);
    });

    it('Teamer:in darf weiterhin kein Zertifikat vergeben -> 403', async () => {
      const res = await request(app)
        .post(`/api/teamer/${USERS.teamer1.id}/certificates`)
        .set('Authorization', `Bearer ${teamerToken}`)
        .send({
          certificate_type_id: certTypeId,
          issued_date: '2026-01-15',
        });

      expect(res.status).toBe(403);
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
  // TEAMER ANTRAEGE (POST/DELETE /requests)
  // ================================================================
  describe('POST /api/teamer/requests', () => {
    let teamerActivityId;

    beforeEach(async () => {
      // Teamer-Aktivität (target_role='teamer') in Org 1 anlegen — nur solche
      // duerfen Teamer:innen beantragen.
      const { rows: [act] } = await db.query(
        `INSERT INTO activities (name, points, type, target_role, organization_id)
         VALUES ('Teamer-Schulung', 0, 'gemeinde', 'teamer', 1) RETURNING id`
      );
      teamerActivityId = act.id;
    });

    it('Teamer stellt Antrag -> 201 (Push/Live-Update kippen den Request nicht)', async () => {
      const res = await request(app)
        .post('/api/teamer/requests')
        .set('Authorization', `Bearer ${teamerToken}`)
        .send({
          activity_id: teamerActivityId,
          requested_date: '2026-02-01',
          description: 'Teilnahme an Schulung'
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();

      // Antrag ist wirklich in der DB
      const { rows } = await db.query(
        "SELECT status FROM activity_requests WHERE id = $1", [res.body.id]
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe('pending');
    });

    it('Konfi-Aktivitaet (target_role!=teamer) gibt 404', async () => {
      const res = await request(app)
        .post('/api/teamer/requests')
        .set('Authorization', `Bearer ${teamerToken}`)
        .send({ activity_id: 1, requested_date: '2026-02-01' });

      expect(res.status).toBe(404);
    });
  });

  describe('DELETE /api/teamer/requests/:id', () => {
    let teamerActivityId;
    let requestId;

    beforeEach(async () => {
      const { rows: [act] } = await db.query(
        `INSERT INTO activities (name, points, type, target_role, organization_id)
         VALUES ('Teamer-Schulung', 0, 'gemeinde', 'teamer', 1) RETURNING id`
      );
      teamerActivityId = act.id;

      const createRes = await request(app)
        .post('/api/teamer/requests')
        .set('Authorization', `Bearer ${teamerToken}`)
        .send({ activity_id: teamerActivityId, requested_date: '2026-02-01' });
      requestId = createRes.body.id;
    });

    it('Teamer loescht eigenen pending Antrag -> 200 (Live-Update kippt nicht)', async () => {
      const res = await request(app)
        .delete(`/api/teamer/requests/${requestId}`)
        .set('Authorization', `Bearer ${teamerToken}`);

      expect(res.status).toBe(200);

      const { rows } = await db.query(
        "SELECT id FROM activity_requests WHERE id = $1", [requestId]
      );
      expect(rows).toHaveLength(0);
    });

    // Befund M5 (26.08.2026): Der Teamer-Pfad rief deletePhotoFile nicht auf —
    // die Datei blieb ohne DB-Referenz auf der Platte liegen. Konfi- und
    // Admin-Pfad machten es laengst richtig.
    it('Nachweisfoto wird beim Löschen des Antrags von der Platte entfernt', async () => {
      const REQUESTS_DIR = path.join(__dirname, '..', '..', 'uploads', 'requests');
      fs.mkdirSync(REQUESTS_DIR, { recursive: true });
      const fotoName = 'teamer-antrag-foto-test.enc';
      fs.writeFileSync(path.join(REQUESTS_DIR, fotoName), 'testinhalt');
      await db.query('UPDATE activity_requests SET photo_filename = $1 WHERE id = $2', [fotoName, requestId]);

      expect(fs.existsSync(path.join(REQUESTS_DIR, fotoName))).toBe(true);

      const res = await request(app)
        .delete(`/api/teamer/requests/${requestId}`)
        .set('Authorization', `Bearer ${teamerToken}`);
      expect(res.status).toBe(200);

      const { rows } = await db.query('SELECT id FROM activity_requests WHERE id = $1', [requestId]);
      expect(rows).toHaveLength(0);
      expect(fs.existsSync(path.join(REQUESTS_DIR, fotoName))).toBe(false);
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

    it('Config kennt Challenges: Default an, Reihenfolge enthaelt den Key', async () => {
      const res = await request(app)
        .get('/api/teamer/dashboard')
        .set('Authorization', `Bearer ${teamerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.config.show_challenges).toBe(true);
      expect(res.body.config.section_order).toContain('challenges');
    });

    it('Abgeschalteter Challenges-Schalter kommt als false an', async () => {
      await db.query(
        `INSERT INTO settings (organization_id, key, value) VALUES (1, 'teamer_dashboard_show_challenges', 'false')
         ON CONFLICT (organization_id, key) DO UPDATE SET value = EXCLUDED.value`
      );

      const res = await request(app)
        .get('/api/teamer/dashboard')
        .set('Authorization', `Bearer ${teamerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.config.show_challenges).toBe(false);
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
  // KONFISPRUCH (Teamer)
  // ================================================================
  describe('Konfispruch (Teamer)', () => {
    // truncateAll leert konfsprueche — pro Test frisch anlegen (wie in konfi.test.js).
    async function seedSpruch() {
      const { rows: [spruch] } = await db.query(
        `INSERT INTO konfsprueche (reference, book, chapter, verse, organization_id, sort_order)
         VALUES ('Josua 1,9', 'Josua', 1, 9, NULL, 1)
         RETURNING id`
      );
      const texte = {
        luther2017: 'Sei getrost und unverzagt.',
        bigs: 'Sei mutig und entschlossen.',
        gute_nachricht: 'Sei stark und entschlossen.',
        elberfelder: 'Sei stark und mutig.'
      };
      for (const [translation, text] of Object.entries(texte)) {
        await db.query(
          `INSERT INTO konfspruch_uebersetzungen (spruch_id, translation, text)
           VALUES ($1, $2, $3)`,
          [spruch.id, translation, text]
        );
      }
      return spruch.id;
    }

    describe('GET /api/teamer/konfsprueche', () => {
      it('Teamer bekommt 200 + Liste mit Referenz und 4 Uebersetzungs-Keys', async () => {
        await seedSpruch();
        const res = await request(app)
          .get('/api/teamer/konfsprueche')
          .set('Authorization', `Bearer ${teamerToken}`);

        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        const eintrag = res.body.find((s) => s.reference === 'Josua 1,9');
        expect(eintrag).toBeDefined();
        expect(eintrag.uebersetzungen.luther2017).toBe('Sei getrost und unverzagt.');
        expect(Object.keys(eintrag.uebersetzungen).sort()).toEqual(
          ['bigs', 'elberfelder', 'gute_nachricht', 'luther2017']
        );
      });

      it('Konfi bekommt 403', async () => {
        const res = await request(app)
          .get('/api/teamer/konfsprueche')
          .set('Authorization', `Bearer ${konfiToken}`);
        expect(res.status).toBe(403);
      });
    });

    describe('PATCH /api/teamer/profile', () => {
      it('Freitext legt fehlendes konfi_profiles an und erscheint im Dashboard', async () => {
        // teamer1 hat im Seed KEIN konfi_profiles (direkt als Teamer angelegt)
        const { rows: vorher } = await db.query(
          'SELECT id FROM konfi_profiles WHERE user_id = $1', [3]
        );
        expect(vorher.length).toBe(0);

        const res = await request(app)
          .patch('/api/teamer/profile')
          .set('Authorization', `Bearer ${teamerToken}`)
          .send({ konfspruch_freitext: 'Der Herr ist mein Hirte.', konfspruch_freitext_referenz: 'Psalm 23,1' });

        expect(res.status).toBe(200);
        expect(res.body.konfspruch.source).toBe('freitext');

        const { rows: [profil] } = await db.query(
          'SELECT organization_id, konfspruch_freitext FROM konfi_profiles WHERE user_id = $1', [3]
        );
        expect(profil.konfspruch_freitext).toBe('Der Herr ist mein Hirte.');
        expect(Number(profil.organization_id)).toBe(1);

        const dashRes = await request(app)
          .get('/api/teamer/dashboard')
          .set('Authorization', `Bearer ${teamerToken}`);
        expect(dashRes.status).toBe(200);
        expect(dashRes.body.konfspruch).toEqual({
          source: 'freitext',
          text: 'Der Herr ist mein Hirte.',
          reference: 'Psalm 23,1'
        });
      });

      it('Listen-Wahl wird im Dashboard mit Text der gewaehlten Uebersetzung aufgeloest', async () => {
        const spruchId = await seedSpruch();

        const res = await request(app)
          .patch('/api/teamer/profile')
          .set('Authorization', `Bearer ${teamerToken}`)
          .send({ konfspruch_id: spruchId, translation: 'luther2017' });

        expect(res.status).toBe(200);

        const dashRes = await request(app)
          .get('/api/teamer/dashboard')
          .set('Authorization', `Bearer ${teamerToken}`);
        expect(dashRes.status).toBe(200);
        expect(dashRes.body.konfspruch).toEqual({
          source: 'liste',
          id: spruchId,
          reference: 'Josua 1,9',
          text: 'Sei getrost und unverzagt.',
          translation: 'luther2017'
        });
      });

      it('Befoerderte Teamer:in behaelt beim Eintragen ihre eingefrorenen Punkte', async () => {
        await db.query(
          `INSERT INTO konfi_profiles (user_id, jahrgang_id, gottesdienst_points, gemeinde_points, organization_id)
           VALUES (3, NULL, 7, 4, 1)`
        );

        const res = await request(app)
          .patch('/api/teamer/profile')
          .set('Authorization', `Bearer ${teamerToken}`)
          .send({ konfspruch_freitext: 'Fürchte dich nicht.', konfspruch_freitext_referenz: 'Jesaja 41,10' });

        expect(res.status).toBe(200);

        const { rows: profile } = await db.query(
          'SELECT gottesdienst_points, gemeinde_points, konfspruch_freitext FROM konfi_profiles WHERE user_id = $1', [3]
        );
        expect(profile.length).toBe(1);
        expect(Number(profile[0].gottesdienst_points)).toBe(7);
        expect(Number(profile[0].gemeinde_points)).toBe(4);
        expect(profile[0].konfspruch_freitext).toBe('Fürchte dich nicht.');
      });

      it('Freitext ohne Stellenangabe gibt 400', async () => {
        const res = await request(app)
          .patch('/api/teamer/profile')
          .set('Authorization', `Bearer ${teamerToken}`)
          .send({ konfspruch_freitext: 'Ohne Referenz' });
        expect(res.status).toBe(400);
      });

      it('Leerer Body gibt 400', async () => {
        const res = await request(app)
          .patch('/api/teamer/profile')
          .set('Authorization', `Bearer ${teamerToken}`)
          .send({});
        expect(res.status).toBe(400);
      });

      it('Konfi bekommt 403', async () => {
        const res = await request(app)
          .patch('/api/teamer/profile')
          .set('Authorization', `Bearer ${konfiToken}`)
          .send({ konfspruch_freitext: 'Test', konfspruch_freitext_referenz: 'Test 1,1' });
        expect(res.status).toBe(403);
      });
    });

    describe('Dashboard-Schalter show_konfispruch', () => {
      it('Default: show_konfispruch true, konfspruch null ohne Eintrag', async () => {
        const res = await request(app)
          .get('/api/teamer/dashboard')
          .set('Authorization', `Bearer ${teamerToken}`);

        expect(res.status).toBe(200);
        expect(res.body.config.show_konfispruch).toBe(true);
        expect(res.body.config.section_order).toContain('konfispruch');
        expect(res.body.konfspruch).toBeNull();
      });

      it('Abgeschaltet: show_konfispruch false und konfspruch null trotz Eintrag', async () => {
        await request(app)
          .patch('/api/teamer/profile')
          .set('Authorization', `Bearer ${teamerToken}`)
          .send({ konfspruch_freitext: 'Der Herr ist mein Hirte.', konfspruch_freitext_referenz: 'Psalm 23,1' });

        await db.query(
          `INSERT INTO settings (organization_id, key, value) VALUES (1, 'teamer_dashboard_show_konfispruch', 'false')
           ON CONFLICT (organization_id, key) DO UPDATE SET value = EXCLUDED.value`
        );

        const res = await request(app)
          .get('/api/teamer/dashboard')
          .set('Authorization', `Bearer ${teamerToken}`);

        expect(res.status).toBe(200);
        expect(res.body.config.show_konfispruch).toBe(false);
        expect(res.body.konfspruch).toBeNull();
      });
    });
  });

  // ================================================================
  // TAGESLOSUNG
  // ================================================================
  describe('GET /api/teamer/tageslosung', () => {
    // Frueher "200 oder 500" — damit war der Test blind dafuer, dass
    // daily_verses im Test-Schema gar nicht existierte und schon der
    // Cache-Zugriff warf. Die externe API ist im Test nicht erreichbar, der
    // DB-Fallback muss also greifen: entweder eine gecachte Losung (200) oder
    // ein sauberer Fehler — aber KEIN Schema-Fehler.
    it('Teamer bekommt eine Antwort ohne Schema-Fehler', async () => {
      // Gecachte Losung hinterlegen: Die externe API ist im Test nicht
      // erreichbar, der DB-Fallback ist der einzige Weg zu einer Antwort.
      await db.query(
        `INSERT INTO daily_verses (date, translation, verse_data)
         VALUES (CURRENT_DATE, 'LUT', $1)
         ON CONFLICT (date, translation) DO UPDATE SET verse_data = $1`,
        [JSON.stringify({
          losung: { text: 'Testlosung', reference: 'Psalm 1,1' },
          lehrtext: { text: 'Testlehrtext', reference: 'Johannes 1,1' }
        })]
      );

      const res = await request(app)
        .get('/api/teamer/tageslosung')
        .set('Authorization', `Bearer ${teamerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
    });

    // Ist die Losung abgeschaltet, darf sie GAR NICHT abgerufen werden — nicht
    // nur ausgeblendet (Nutzerwunsch 23.08.2026). Vorher hing das allein am
    // Frontend, und nicht jeder Aufrufer prüfte den Schalter: Bei nicht
    // erreichbarer API wartete die App trotz "aus" mehrere Sekunden.
    it('abgeschaltete Losung wird nicht abgerufen -> 204', async () => {
      await db.query(
        `INSERT INTO settings (organization_id, key, value) VALUES (1, 'teamer_dashboard_show_losung', 'false')
         ON CONFLICT (organization_id, key) DO UPDATE SET value = 'false'`
      );
      try {
        const res = await request(app)
          .get('/api/teamer/tageslosung')
          .set('Authorization', `Bearer ${teamerToken}`);

        expect(res.status).toBe(204);
      } finally {
        await db.query("DELETE FROM settings WHERE organization_id = 1 AND key = 'teamer_dashboard_show_losung'");
      }
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
      // Gibt leere Liste zurück (gefiltert nach org_id)
      expect(res.body.length).toBe(0);
    });
  });
});
