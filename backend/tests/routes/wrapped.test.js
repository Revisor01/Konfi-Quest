const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, JAHRGAENGE } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

describe('Wrapped Routes', () => {
  let app;
  let db;
  let orgAdminToken;
  let adminToken;
  let teamerToken;
  let konfiToken;
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
    orgAdmin2Token = generateToken('orgAdmin2');
  });

  afterAll(async () => {
    await closePool();
  });

  // ================================================================
  // GET /me
  // ================================================================
  describe('GET /api/wrapped/me', () => {
    it('Authentifizierter User bekommt 404 wenn kein Wrapped vorhanden', async () => {
      const res = await request(app)
        .get('/api/wrapped/me')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(404);
      expect(res.body.error).toContain('Kein Wrapped');
    });

    it('Ohne Token bekommt 401', async () => {
      const res = await request(app)
        .get('/api/wrapped/me');

      expect(res.status).toBe(401);
    });

    // Frueher stand hier "200 oder 404" mit dem Hinweis "wenn Snapshot
    // fehlschlägt". Genau das trat immer ein: activities.category fehlte im
    // Test-Schema, jeder Snapshot scheiterte still, und die gesamte
    // Wrapped-Inhaltslogik war ungetestet. Seit das Schema aus Produktion
    // kommt, muss die Generierung wirklich durchlaufen (Audit 22.08.2026).
    it('Nach Generierung bekommt Konfi seine Wrapped-Daten', async () => {
      const genRes = await request(app)
        .post(`/api/wrapped/generate/${JAHRGAENGE.jahrgang1.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(genRes.status).toBe(200);
      expect(genRes.body.generated).toBeGreaterThan(0);

      const res = await request(app)
        .get('/api/wrapped/me')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toBeDefined();
      expect(res.body.wrapped_type).toBe('konfi');
    });

    // Drei-Ansichten-Befund M7 (26.08.2026): Das Freigabe-Gate
    // (wrapped_released_at auf jahrgaenge) prüfte nur das Konfi-Dashboard —
    // der Datenendpunkt lieferte den Snapshot auch ohne Freigabe aus.
    it('Ohne Freigabe (wrapped_released_at NULL) bekommt Konfi 403 statt Daten', async () => {
      // Snapshots erzeugen (setzt wrapped_released_at auf NOW()) ...
      const genRes = await request(app)
        .post(`/api/wrapped/generate/${JAHRGAENGE.jahrgang1.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(genRes.status).toBe(200);

      // ... und die Freigabe zurueckziehen, der Snapshot bleibt liegen
      // (entspricht z.B. einem Jahrgangswechsel des Konfis).
      await db.query(
        'UPDATE jahrgaenge SET wrapped_released_at = NULL WHERE id = $1',
        [JAHRGAENGE.jahrgang1.id]
      );

      const res = await request(app)
        .get('/api/wrapped/me')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Wrapped ist noch nicht freigegeben');
      expect(res.body.data).toBe(undefined);
    });

    it('Freigabe in der Zukunft zaehlt nicht: 403', async () => {
      const genRes = await request(app)
        .post(`/api/wrapped/generate/${JAHRGAENGE.jahrgang1.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(genRes.status).toBe(200);

      await db.query(
        "UPDATE jahrgaenge SET wrapped_released_at = NOW() + INTERVAL '1 day' WHERE id = $1",
        [JAHRGAENGE.jahrgang1.id]
      );

      const res = await request(app)
        .get('/api/wrapped/me')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(403);
    });

    it('Teamer-Wrapped kennt keine Freigabe: 200 auch ohne freigegebenen Jahrgang', async () => {
      const genRes = await request(app)
        .post('/api/wrapped/generate-teamer')
        .set('Authorization', `Bearer ${orgAdminToken}`);
      expect(genRes.status).toBe(200);

      const res = await request(app)
        .get('/api/wrapped/me')
        .set('Authorization', `Bearer ${teamerToken}`);

      expect(res.status).toBe(200);
      expect(res.body.wrapped_type).toBe('teamer');
    });
  });

  // ================================================================
  // POST /generate/:jahrgangId
  // ================================================================
  describe('POST /api/wrapped/generate/:jahrgangId', () => {
    it('Admin generiert Konfi-Wrapped -> 200', async () => {
      const res = await request(app)
        .post(`/api/wrapped/generate/${JAHRGAENGE.jahrgang1.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      // Nicht nur "definiert": Bei fehlender Spalte lieferte die Route
      // generated=0 mit errors>0 und der Test blieb trotzdem gruen.
      expect(res.body.generated).toBeGreaterThan(0);
      expect(res.body.jahrgang).toBeDefined();
      expect(res.body.year).toBeDefined();
    });

    it('Konfi bekommt 403', async () => {
      const res = await request(app)
        .post(`/api/wrapped/generate/${JAHRGAENGE.jahrgang1.id}`)
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(403);
    });

    it('Nicht-existierender Jahrgang gibt 404', async () => {
      const res = await request(app)
        .post('/api/wrapped/generate/99999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });

    it('Jahrgang aus anderer Org gibt 404', async () => {
      const res = await request(app)
        .post(`/api/wrapped/generate/${JAHRGAENGE.jahrgang2.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(404);
    });
  });

  // ================================================================
  // POST /generate-teamer
  // ================================================================
  describe('POST /api/wrapped/generate-teamer', () => {
    it('OrgAdmin generiert Teamer-Wrapped -> 200', async () => {
      const res = await request(app)
        .post('/api/wrapped/generate-teamer')
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.generated).toBeDefined();
      expect(res.body.year).toBeDefined();
    });

    it('Admin (nicht OrgAdmin) bekommt 403', async () => {
      const res = await request(app)
        .post('/api/wrapped/generate-teamer')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(403);
    });

    it('Konfi bekommt 403', async () => {
      const res = await request(app)
        .post('/api/wrapped/generate-teamer')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(403);
    });

    it('Teamer bekommt 403', async () => {
      const res = await request(app)
        .post('/api/wrapped/generate-teamer')
        .set('Authorization', `Bearer ${teamerToken}`);

      expect(res.status).toBe(403);
    });
  });

  // ================================================================
  // DELETE /:jahrgangId
  // ================================================================
  describe('DELETE /api/wrapped/:jahrgangId', () => {
    it('OrgAdmin loescht Wrapped -> 200', async () => {
      // Zuerst generieren
      await request(app)
        .post(`/api/wrapped/generate/${JAHRGAENGE.jahrgang1.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      const res = await request(app)
        .delete(`/api/wrapped/${JAHRGAENGE.jahrgang1.id}`)
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.deleted).toBeDefined();
    });

    it('Konfi bekommt 403', async () => {
      const res = await request(app)
        .delete(`/api/wrapped/${JAHRGAENGE.jahrgang1.id}`)
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(403);
    });

    it('Nicht-existierender Jahrgang gibt 404', async () => {
      const res = await request(app)
        .delete('/api/wrapped/99999')
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(res.status).toBe(404);
    });
  });

  // ================================================================
  // GET /history/:userId
  // ================================================================
  describe('GET /api/wrapped/history/:userId', () => {
    it('Admin bekommt 200 + Wrapped-History', async () => {
      const res = await request(app)
        .get(`/api/wrapped/history/${USERS.konfi1.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('Eigene History abrufen -> 200', async () => {
      const res = await request(app)
        .get(`/api/wrapped/history/${USERS.konfi1.id}`)
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('Konfi kann History anderer User nicht abrufen -> 403', async () => {
      const res = await request(app)
        .get(`/api/wrapped/history/${USERS.konfi2.id}`)
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(403);
    });

    it('Ohne Token -> 401', async () => {
      const res = await request(app)
        .get(`/api/wrapped/history/${USERS.konfi1.id}`);

      expect(res.status).toBe(401);
    });

    it('Nach Generierung zeigt History Eintraege', async () => {
      // Vorher stand hier ein `if (res.body.length > 0)` mit dem Vermerk
      // "kann leer sein wenn Generierung fehlschlug". Damit war der Test
      // still gruen, sobald die Generierung kaputt ging -- also genau dann,
      // wenn er haette anschlagen muessen. Jetzt hart geprueft (27.08.2026).
      const genRes = await request(app)
        .post(`/api/wrapped/generate/${JAHRGAENGE.jahrgang1.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(genRes.status).toBe(200);

      const res = await request(app)
        .get(`/api/wrapped/history/${USERS.konfi1.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThan(0);
      expect(res.body[0].wrapped_type).toBe('konfi');
      expect(res.body[0].data).toBeDefined();
    });

    // Befund N5 (27.08.2026): Die Leitung bekommt in der Konfi-Detailseite
    // eine Ansicht des Konfi-Wrapped. Der Endpunkt prueft selbst NICHT, ob
    // der Jahrgang freigegeben ist -- das ist nur deshalb unbedenklich, weil
    // Snapshot-Erzeugung und wrapped_released_at in derselben Transaktion
    // laufen (wrapped.js:513-537). Ein Konfi-Snapshot existiert also nie vor
    // der Freigabe.
    //
    // Faellt diese Kopplung, wird aus der neuen Ansicht eine
    // Datenschutzluecke: Die Leitung saehe einen Rueckblick, den die Konfi
    // selbst noch nicht sehen darf. Diese Tests halten die Kopplung fest.
    describe('Freigabe-Kopplung (Grundlage von N5)', () => {
      it('ohne Generierung gibt es weder Snapshot noch Freigabe', async () => {
        const { rows: [jahrgang] } = await db.query(
          'SELECT wrapped_released_at FROM jahrgaenge WHERE id = $1',
          [JAHRGAENGE.jahrgang1.id]
        );
        expect(jahrgang.wrapped_released_at).toBeNull();

        const res = await request(app)
          .get(`/api/wrapped/history/${USERS.konfi1.id}`)
          .set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(0);
      });

      it('die Generierung setzt die Freigabe im selben Zug', async () => {
        await request(app)
          .post(`/api/wrapped/generate/${JAHRGAENGE.jahrgang1.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        const { rows: [jahrgang] } = await db.query(
          'SELECT wrapped_released_at FROM jahrgaenge WHERE id = $1',
          [JAHRGAENGE.jahrgang1.id]
        );
        expect(jahrgang.wrapped_released_at).not.toBeNull();
      });

      it('kein Snapshot liegt jemals ohne Freigabe seines Jahrgangs vor', async () => {
        // Der Kern der Zusicherung, unabhaengig vom Weg der Erzeugung.
        await request(app)
          .post(`/api/wrapped/generate/${JAHRGAENGE.jahrgang1.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        const { rows } = await db.query(
          `SELECT COUNT(*)::int AS anzahl
             FROM wrapped_snapshots ws
             JOIN jahrgaenge j ON ws.jahrgang_id = j.id
            WHERE ws.wrapped_type = 'konfi'
              AND j.wrapped_released_at IS NULL`
        );
        expect(rows[0].anzahl).toBe(0);
      });

      it('das Zuruecknehmen der Freigabe loescht die Snapshots mit', async () => {
        // Gegenprobe in die andere Richtung: Nach dem Zuruecknehmen darf
        // auch die Leitung nichts mehr sehen.
        await request(app)
          .post(`/api/wrapped/generate/${JAHRGAENGE.jahrgang1.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        // Das Zuruecknehmen ist org_admin vorbehalten -- admin bekommt hier
        // bewusst 403 (siehe DELETE-Tests oben).
        await request(app)
          .delete(`/api/wrapped/${JAHRGAENGE.jahrgang1.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(403);

        await request(app)
          .delete(`/api/wrapped/${JAHRGAENGE.jahrgang1.id}`)
          .set('Authorization', `Bearer ${orgAdminToken}`)
          .expect(200);

        const res = await request(app)
          .get(`/api/wrapped/history/${USERS.konfi1.id}`)
          .set('Authorization', `Bearer ${adminToken}`);
        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(0);

        const { rows: [jahrgang] } = await db.query(
          'SELECT wrapped_released_at FROM jahrgaenge WHERE id = $1',
          [JAHRGAENGE.jahrgang1.id]
        );
        expect(jahrgang.wrapped_released_at).toBeNull();
      });

      it('die Leitung einer FREMDEN Organisation bekommt weiterhin 403', async () => {
        // Die neue Ansicht darf die Org-Grenze nicht aufweichen.
        await request(app)
          .post(`/api/wrapped/generate/${JAHRGAENGE.jahrgang1.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        const res = await request(app)
          .get(`/api/wrapped/history/${USERS.konfi1.id}`)
          .set('Authorization', `Bearer ${orgAdmin2Token}`);
        expect(res.status).toBe(403);
      });
    });
  });

  // ================================================================
  // ORG-ISOLATION
  // ================================================================
  describe('Org-Isolation', () => {
    it('OrgAdmin2 kann Jahrgang1 nicht loeschen -> 404', async () => {
      const res = await request(app)
        .delete(`/api/wrapped/${JAHRGAENGE.jahrgang1.id}`)
        .set('Authorization', `Bearer ${orgAdmin2Token}`);

      expect(res.status).toBe(404);
    });

    it('Admin aus Org2 kann nicht fuer Jahrgang aus Org1 generieren -> 404', async () => {
      const admin2Token = generateToken('admin2');
      const res = await request(app)
        .post(`/api/wrapped/generate/${JAHRGAENGE.jahrgang1.id}`)
        .set('Authorization', `Bearer ${admin2Token}`);

      expect(res.status).toBe(404);
    });
  });
});
