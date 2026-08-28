const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ACTIVITIES, CATEGORIES } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

describe('Activities Routes', () => {
  let app;
  let db;
  let adminToken;
  let teamerToken;
  let konfiToken;
  let admin2Token;

  beforeAll(async () => {
    db = getTestPool();
    app = getTestApp(db);
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    adminToken = generateToken('admin1');
    teamerToken = generateToken('teamer1');
    konfiToken = generateToken('konfi1');
    admin2Token = generateToken('admin2');
  });

  afterAll(async () => {
    await closePool();
  });

  // ================================================================
  // GET /api/admin/activities
  // ================================================================
  describe('GET /api/admin/activities', () => {
    it('Admin bekommt 200 + Array mit Activities der eigenen Org', async () => {
      const res = await request(app)
        .get('/api/admin/activities')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      // Org 1 hat 4 Activities (sonntagsgottesdienst, jugendgottesdienst, gemeindefest, kirchenchor)
      expect(res.body.length).toBe(4);
      // Jede Activity hat die erwartete Struktur
      const act = res.body[0];
      expect(act.id).toBeDefined();
      expect(act.name).toBeDefined();
      expect(act.categories).toBeDefined();
    });

    it('Response enthaelt category_data (STRING_AGG)', async () => {
      const res = await request(app)
        .get('/api/admin/activities')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      // Sonntagsgottesdienst (id=1) hat Category Gottesdienst (id=1)
      const sonntagsgottesdienst = res.body.find(a => a.id === ACTIVITIES.sonntagsgottesdienst.id);
      expect(sonntagsgottesdienst).toBeDefined();
      expect(sonntagsgottesdienst.categories.length).toBeGreaterThan(0);
      expect(sonntagsgottesdienst.categories[0].name).toBe('Gottesdienst');
    });

    it('Teamer bekommt 200 (requireTeamer erlaubt Teamer)', async () => {
      const res = await request(app)
        .get('/api/admin/activities')
        .set('Authorization', `Bearer ${teamerToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('Konfi bekommt 403', async () => {
      const res = await request(app)
        .get('/api/admin/activities')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(403);
    });

    it('Admin aus Org 2 sieht nur eigene Activities', async () => {
      const res = await request(app)
        .get('/api/admin/activities')
        .set('Authorization', `Bearer ${admin2Token}`);

      expect(res.status).toBe(200);
      // Org 2 hat 2 Activities (gottesdienst2, gemeinde2)
      expect(res.body.length).toBe(2);
      // Keine Activity aus Org 1
      const orgIds = res.body.map(a => a.id);
      expect(orgIds).not.toContain(ACTIVITIES.sonntagsgottesdienst.id);
    });
  });

  // ================================================================
  // POST /api/admin/activities
  // ================================================================
  describe('POST /api/admin/activities', () => {
    it('Admin erstellt Activity mit korrekten Daten -> 201', async () => {
      const res = await request(app)
        .post('/api/admin/activities')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Neue Aktivitaet',
          points: 2,
          type: 'gottesdienst',
        });

      expect(res.status).toBe(201);
      expect(res.body.id).toBeDefined();
      expect(res.body.message).toContain('erstellt');
    });

    it('Leerer name gibt 400 (Validation)', async () => {
      const res = await request(app)
        .post('/api/admin/activities')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: '',
          points: 2,
          type: 'gottesdienst',
        });

      expect(res.status).toBe(400);
    });

    it('Teamer bekommt 403', async () => {
      const res = await request(app)
        .post('/api/admin/activities')
        .set('Authorization', `Bearer ${teamerToken}`)
        .send({
          name: 'Test',
          points: 1,
          type: 'gottesdienst',
        });

      expect(res.status).toBe(403);
    });

    it('Activity mit Kategorien erstellen', async () => {
      const res = await request(app)
        .post('/api/admin/activities')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Kategorie-Aktivitaet',
          points: 3,
          type: 'gemeinde',
          category_ids: [CATEGORIES.gemeinde1.id],
        });

      expect(res.status).toBe(201);

      // Verify: Activity mit Kategorie abrufen
      const listRes = await request(app)
        .get('/api/admin/activities')
        .set('Authorization', `Bearer ${adminToken}`);

      const created = listRes.body.find(a => a.name === 'Kategorie-Aktivitaet');
      expect(created).toBeDefined();
      expect(created.categories.length).toBe(1);
      expect(created.categories[0].id).toBe(CATEGORIES.gemeinde1.id);
    });
  });

  // ================================================================
  // PUT /api/admin/activities/:id
  // ================================================================
  describe('PUT /api/admin/activities/:id', () => {
    it('Admin aktualisiert bestehende Activity -> 200', async () => {
      const res = await request(app)
        .put(`/api/admin/activities/${ACTIVITIES.sonntagsgottesdienst.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Aktualisierter Gottesdienst',
          points: 5,
          type: 'gottesdienst',
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('aktualisiert');
    });

    it('Nicht-existierende ID gibt 404', async () => {
      const res = await request(app)
        .put('/api/admin/activities/99999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Gibts nicht',
          points: 1,
          type: 'gottesdienst',
        });

      expect(res.status).toBe(404);
    });

    it('Admin aus Org 2 kann Activity aus Org 1 NICHT aendern -> 404', async () => {
      const res = await request(app)
        .put(`/api/admin/activities/${ACTIVITIES.sonntagsgottesdienst.id}`)
        .set('Authorization', `Bearer ${admin2Token}`)
        .send({
          name: 'Versuch',
          points: 1,
          type: 'gottesdienst',
        });

      expect(res.status).toBe(404);
    });
  });

  // ================================================================
  // DELETE /api/admin/activities/:id
  // ================================================================
  describe('DELETE /api/admin/activities/:id', () => {
    it('Admin loescht Activity -> 200', async () => {
      // Kirchenchor (id=4) hat keine user_activities-Zuordnungen
      const res = await request(app)
        .delete(`/api/admin/activities/${ACTIVITIES.kirchenchor.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('gelöscht');
    });

    it('Admin aus Org 2 kann Activity aus Org 1 NICHT loeschen -> 404', async () => {
      const res = await request(app)
        .delete(`/api/admin/activities/${ACTIVITIES.kirchenchor.id}`)
        .set('Authorization', `Bearer ${admin2Token}`);

      expect(res.status).toBe(404);
    });
  });

  // ================================================================
  // POST /api/admin/activities/assign-activity (Punkte-Vergabe)
  // ================================================================
  describe('POST /api/admin/activities/assign-activity', () => {
    // Mandantentrennung: Geprueft wurde bisher nur die Aktivität gegen die
    // eigene Org, NICHT der Ziel-Konfi. Ein Admin konnte damit über eine
    // fremde konfiId Punkte bei Konfis anderer Gemeinden setzen und dort
    // Badge-/Level-Berechnung auslösen (Audit 22.08.2026).
    it('Admin kann KEINE Punkte an Konfi einer fremden Organisation vergeben', async () => {
      const vorher = await db.query(
        'SELECT gottesdienst_points, gemeinde_points FROM konfi_profiles WHERE user_id = $1',
        [USERS.konfi3.id]
      );

      const res = await request(app)
        .post('/api/admin/activities/assign-activity')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          konfiId: USERS.konfi3.id, // gehoert zu Organisation 2
          activityId: ACTIVITIES.sonntagsgottesdienst.id,
          completed_date: '2026-03-28',
        });

      expect(res.status).toBe(404);

      // Punkte des fremden Konfis unverändert
      const nachher = await db.query(
        'SELECT gottesdienst_points, gemeinde_points FROM konfi_profiles WHERE user_id = $1',
        [USERS.konfi3.id]
      );
      expect(nachher.rows[0].gottesdienst_points).toBe(vorher.rows[0].gottesdienst_points);
      expect(nachher.rows[0].gemeinde_points).toBe(vorher.rows[0].gemeinde_points);

      // Und keine Aktivität eingetragen
      const { rows } = await db.query(
        'SELECT COUNT(*)::int AS c FROM user_activities WHERE user_id = $1',
        [USERS.konfi3.id]
      );
      expect(rows[0].c).toBe(0);
    });

    it('Teamer weist Activity an Konfi zu und Punkte steigen', async () => {
      // Vorher: gottesdienst_points abfragen
      const before = await db.query(
        'SELECT gottesdienst_points FROM konfi_profiles WHERE user_id = $1',
        [USERS.konfi1.id]
      );
      const pointsBefore = before.rows[0].gottesdienst_points;

      const res = await request(app)
        .post('/api/admin/activities/assign-activity')
        .set('Authorization', `Bearer ${teamerToken}`)
        .send({
          konfiId: USERS.konfi1.id,
          activityId: ACTIVITIES.sonntagsgottesdienst.id,
          completed_date: '2026-03-28',
        });

      expect(res.status).toBe(200);
      expect(res.body.message).toContain('zugewiesen');

      // Nachher: gottesdienst_points prüfen
      const after = await db.query(
        'SELECT gottesdienst_points FROM konfi_profiles WHERE user_id = $1',
        [USERS.konfi1.id]
      );
      expect(after.rows[0].gottesdienst_points).toBe(
        pointsBefore + ACTIVITIES.sonntagsgottesdienst.gp
      );
    });

    it('Gemeinde-Punkte werden korrekt vergeben', async () => {
      const before = await db.query(
        'SELECT gemeinde_points FROM konfi_profiles WHERE user_id = $1',
        [USERS.konfi1.id]
      );
      const pointsBefore = before.rows[0].gemeinde_points;

      const res = await request(app)
        .post('/api/admin/activities/assign-activity')
        .set('Authorization', `Bearer ${teamerToken}`)
        .send({
          konfiId: USERS.konfi1.id,
          activityId: ACTIVITIES.gemeindefest.id,
          completed_date: '2026-03-28',
        });

      expect(res.status).toBe(200);

      const after = await db.query(
        'SELECT gemeinde_points FROM konfi_profiles WHERE user_id = $1',
        [USERS.konfi1.id]
      );
      expect(after.rows[0].gemeinde_points).toBe(
        pointsBefore + ACTIVITIES.gemeindefest.gep
      );
    });

    it('Konfi bekommt 403 auf assign-activity', async () => {
      const res = await request(app)
        .post('/api/admin/activities/assign-activity')
        .set('Authorization', `Bearer ${konfiToken}`)
        .send({
          konfiId: USERS.konfi1.id,
          activityId: ACTIVITIES.sonntagsgottesdienst.id,
          completed_date: '2026-03-28',
        });

      expect(res.status).toBe(403);
    });

    it('Activity aus anderer Org gibt 404', async () => {
      const res = await request(app)
        .post('/api/admin/activities/assign-activity')
        .set('Authorization', `Bearer ${teamerToken}`)
        .send({
          konfiId: USERS.konfi1.id,
          activityId: ACTIVITIES.gottesdienst2.id,
          completed_date: '2026-03-28',
        });

      expect(res.status).toBe(404);
    });
  });

  // ================================================================
  // Kategorie-Filter
  // ================================================================
  describe('Kategorie-Filter', () => {
    it('GET mit target_role=konfi filtert Activities', async () => {
      // Zuerst eine Teamer-Activity erstellen
      await request(app)
        .post('/api/admin/activities')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Teamer-Aktivitaet',
          target_role: 'teamer',
        });

      const resAll = await request(app)
        .get('/api/admin/activities')
        .set('Authorization', `Bearer ${adminToken}`);

      const resKonfi = await request(app)
        .get('/api/admin/activities?target_role=konfi')
        .set('Authorization', `Bearer ${adminToken}`);

      // Konfi-Filter sollte weniger oder gleich viele Ergebnisse liefern
      expect(resAll.status).toBe(200);
      expect(resKonfi.status).toBe(200);
      expect(resKonfi.body.length).toBeLessThanOrEqual(resAll.body.length);
    });
  });

  // ================================================================
  // Löschen: abgelehnte Anträge blockieren nicht mehr
  //
  // Nutzerhinweis 23.08.2026: Eine Teamer-Aktivität mit ausschliesslich
  // abgelehnten Anträgen liess sich nicht löschen. Abgelehnte Anträge haben
  // nie zu Punkten geführt — sie duerfen kein Dauerhindernis sein.
  // ================================================================
  describe('DELETE /admin/activities/:id — Antragshistorie', () => {
    const antragAnlegen = async (status) => {
      const { rows: [r] } = await db.query(
        `INSERT INTO activity_requests (user_id, activity_id, status, organization_id, requested_date)
         VALUES ($1, $2, $3, $4, CURRENT_DATE) RETURNING id`,
        [USERS.konfi1.id, ACTIVITIES.kirchenchor.id, status, 1]
      );
      return r.id;
    };

    it('Aktivitaet mit NUR abgelehnten Antraegen laesst sich loeschen -> 200', async () => {
      await antragAnlegen('rejected');

      const res = await request(app)
        .delete(`/api/admin/activities/${ACTIVITIES.kirchenchor.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);

      // Der abgelehnte Antrag ist mitgeloescht, nicht verwaist zurueckgeblieben.
      const { rows } = await db.query(
        'SELECT 1 FROM activity_requests WHERE activity_id = $1',
        [ACTIVITIES.kirchenchor.id]
      );
      expect(rows.length).toBe(0);
    });

    it('Aktivitaet mit OFFENEM Antrag bleibt gesperrt -> 409', async () => {
      await antragAnlegen('pending');

      const res = await request(app)
        .delete(`/api/admin/activities/${ACTIVITIES.kirchenchor.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('offene');
    });

    it('Aktivitaet mit GENEHMIGTEM Antrag bleibt gesperrt -> 409', async () => {
      await antragAnlegen('approved');

      const res = await request(app)
        .delete(`/api/admin/activities/${ACTIVITIES.kirchenchor.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(409);
      expect(res.body.error).toContain('genehmigte');
    });
  });

  // ================================================================
  // Abgelehnte Anträge einzeln löschen
  // ================================================================
  // ================================================================
  // GET /admin/activities/requests — Status-Filter (28.08.2026)
  //
  // Der Parameter ?status= wurde stillschweigend verworfen: Die Route lieferte
  // immer alle Antraege. Wer sich darauf verliess, sah falsche Zahlen.
  // ================================================================
  describe('GET /admin/activities/requests', () => {
    const antragAnlegen = async (status) => {
      const { rows: [r] } = await db.query(
        `INSERT INTO activity_requests (user_id, activity_id, status, organization_id, requested_date)
         VALUES ($1, $2, $3, $4, CURRENT_DATE) RETURNING id`,
        [USERS.konfi1.id, ACTIVITIES.kirchenchor.id, status, 1]
      );
      return r.id;
    };

    beforeEach(async () => {
      await antragAnlegen('pending');
      await antragAnlegen('pending');
      await antragAnlegen('approved');
      await antragAnlegen('rejected');
    });

    it('Ohne Filter kommen alle Antraege -> 4', async () => {
      const res = await request(app)
        .get('/api/admin/activities/requests')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBe(4);
    });

    it('?status=pending liefert nur die offenen -> 2', async () => {
      const res = await request(app)
        .get('/api/admin/activities/requests?status=pending')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBe(2);
      expect(res.body.every(r => r.status === 'pending')).toBe(true);
    });

    it('?status=approved liefert nur die verbuchten -> 1', async () => {
      const res = await request(app)
        .get('/api/admin/activities/requests?status=approved')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBe(1);
      expect(res.body[0].status).toBe('approved');
    });

    it('?status=rejected liefert nur die abgelehnten -> 1', async () => {
      const res = await request(app)
        .get('/api/admin/activities/requests?status=rejected')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBe(1);
      expect(res.body[0].status).toBe('rejected');
    });

    it('Unbekannter Status -> 400 statt stiller Vollausgabe', async () => {
      const res = await request(app)
        .get('/api/admin/activities/requests?status=quatsch')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(400);
    });

    it('Der Filter hebelt die Org-Trennung nicht aus', async () => {
      const res = await request(app)
        .get('/api/admin/activities/requests?status=pending')
        .set('Authorization', `Bearer ${admin2Token}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBe(0);
    });
  });

  describe('DELETE /admin/activities/requests/:id', () => {
    const antragAnlegen = async (status) => {
      const { rows: [r] } = await db.query(
        `INSERT INTO activity_requests (user_id, activity_id, status, organization_id, requested_date)
         VALUES ($1, $2, $3, $4, CURRENT_DATE) RETURNING id`,
        [USERS.konfi1.id, ACTIVITIES.kirchenchor.id, status, 1]
      );
      return r.id;
    };

    it('Admin loescht einen abgelehnten Antrag -> 200', async () => {
      const id = await antragAnlegen('rejected');

      const res = await request(app)
        .delete(`/api/admin/activities/requests/${id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);

      const { rows } = await db.query('SELECT 1 FROM activity_requests WHERE id = $1', [id]);
      expect(rows.length).toBe(0);
    });

    it('Offener Antrag laesst sich nicht loeschen -> 409', async () => {
      const id = await antragAnlegen('pending');

      const res = await request(app)
        .delete(`/api/admin/activities/requests/${id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(409);
    });

    it('Genehmigter Antrag laesst sich nicht loeschen -> 409', async () => {
      const id = await antragAnlegen('approved');

      const res = await request(app)
        .delete(`/api/admin/activities/requests/${id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(409);
    });

    it('Teamer:in darf keine Antraege loeschen -> 403', async () => {
      const id = await antragAnlegen('rejected');

      const res = await request(app)
        .delete(`/api/admin/activities/requests/${id}`)
        .set('Authorization', `Bearer ${teamerToken}`);

      expect(res.status).toBe(403);
    });

    it('Antrag einer FREMDEN Organisation -> 404', async () => {
      const id = await antragAnlegen('rejected');

      const res = await request(app)
        .delete(`/api/admin/activities/requests/${id}`)
        .set('Authorization', `Bearer ${admin2Token}`);

      expect(res.status).toBe(404);
    });
  });


  // ================================================================
  // Ablehnen verlangt eine Begruendung (Befund 23.08.2026)
  // ================================================================
  describe('PUT /admin/activities/requests/:id — Begruendung beim Ablehnen', () => {
    const offenenAntragAnlegen = async () => {
      const { rows: [r] } = await db.query(
        `INSERT INTO activity_requests (user_id, activity_id, status, organization_id, requested_date)
         VALUES ($1, $2, 'pending', $3, CURRENT_DATE) RETURNING id`,
        [USERS.konfi1.id, ACTIVITIES.kirchenchor.id, 1]
      );
      return r.id;
    };

    it('Ablehnen OHNE Begruendung -> 400', async () => {
      const id = await offenenAntragAnlegen();

      const res = await request(app)
        .put(`/api/admin/activities/requests/${id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'rejected' });

      expect(res.status).toBe(400);
    });

    it('Ablehnen mit zu kurzer Begruendung -> 400', async () => {
      const id = await offenenAntragAnlegen();

      const res = await request(app)
        .put(`/api/admin/activities/requests/${id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'rejected', admin_comment: 'x' });

      expect(res.status).toBe(400);
    });

    it('Ablehnen MIT Begruendung -> 200', async () => {
      const id = await offenenAntragAnlegen();

      const res = await request(app)
        .put(`/api/admin/activities/requests/${id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'rejected', admin_comment: 'Foto fehlt' });

      expect(res.status).toBe(200);

      const { rows: [a] } = await db.query(
        'SELECT status, admin_comment FROM activity_requests WHERE id = $1', [id]);
      expect(a.status).toBe('rejected');
      expect(a.admin_comment).toBe('Foto fehlt');
    });

    it('Genehmigen braucht KEINE Begruendung -> 200', async () => {
      const id = await offenenAntragAnlegen();

      const res = await request(app)
        .put(`/api/admin/activities/requests/${id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'approved' });

      expect(res.status).toBe(200);
    });
  });

});
