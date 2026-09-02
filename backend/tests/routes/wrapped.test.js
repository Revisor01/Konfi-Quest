const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, JAHRGAENGE, ORGS } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const PushService = require('../../services/pushService');

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

    // Jahrgangs-Bindung (01.09.2026): Freigeben (POST /generate/:jahrgangId)
    // und die Historie fremder Konfis verlangen seither eine Zuweisung —
    // admin1 hat im Seed bewusst keine. Fuer die Bestandstests bekommt er
    // jahrgang1; der Fall OHNE Zuweisung steht in
    // jahrgangsBindungAdmin.test.js.
    await db.query(
      'INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id, can_view, can_edit) VALUES ($1, $2, true, true)',
      [USERS.admin1.id, JAHRGAENGE.jahrgang1.id]
    );
    // Die Zuweisung haengt sonst im rbac-Cache (30 s TTL) des vorigen Tests.
    require('../../middleware/rbac').invalidateUserCache(USERS.admin1.id);
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
      // Harte Zahl statt toBeDefined: Der Seed legt zwei Teamer:innen in Org 1
      // an (teamer1, teamer2 gehoert zu Org 2). Ein stiller Fehlschlag der
      // Generierung liefe sonst als "definiert" durch.
      expect(res.body.generated).toBe(1);
      expect(res.body.errors).toBe(0);
      expect(res.body.year).toBe(new Date().getFullYear());
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
      // Der Seed hat zwei Konfis in Jahrgang 1 (konfi1, konfi2) -- genau deren
      // Snapshots muessen weg sein. `toBeDefined()` haette auch bei 0 gegruent,
      // also gerade dann, wenn das Loeschen gar nichts trifft.
      expect(res.body.deleted).toBe(2);
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
  // Befund W-D (01.09.2026): Schluessel, Push und Loeschweg
  // ================================================================
  describe('Snapshot-Schluessel, Push und Loeschweg (W-D)', () => {
    it('haelt fuer zwei Jahrgaenge im selben Jahr zwei Snapshots', async () => {
      // Der Schluessel lautete UNIQUE(user_id, wrapped_type, year) -- ohne
      // Jahrgang. Gehoerte eine Konfi im selben Jahr zu zwei Jahrgaengen,
      // ueberschrieb der zweite Lauf den ersten still: kein Fehler, der
      // Zaehler meldete trotzdem Erfolg, und der erste Jahrgang verlor
      // seinen Rueckblick. Migration 140 nimmt den Jahrgang in den Schluessel.
      const zweiterJahrgang = await db.query(
        `INSERT INTO jahrgaenge (name, organization_id) VALUES ($1, $2) RETURNING id`,
        ['Zweiter Jahrgang', ORGS.testGemeinde.id]
      );
      const jgZwei = zweiterJahrgang.rows[0].id;

      const jahr = new Date().getFullYear();
      const daten = JSON.stringify({ version: 1 });

      await db.query(
        `INSERT INTO wrapped_snapshots (user_id, organization_id, wrapped_type, jahrgang_id, year, data)
         VALUES ($1, $2, 'konfi', $3, $4, $5)`,
        [USERS.konfi1.id, ORGS.testGemeinde.id, JAHRGAENGE.jahrgang1.id, jahr, daten]
      );
      await db.query(
        `INSERT INTO wrapped_snapshots (user_id, organization_id, wrapped_type, jahrgang_id, year, data)
         VALUES ($1, $2, 'konfi', $3, $4, $5)`,
        [USERS.konfi1.id, ORGS.testGemeinde.id, jgZwei, jahr, daten]
      );

      const { rows } = await db.query(
        `SELECT jahrgang_id FROM wrapped_snapshots
         WHERE user_id = $1 AND wrapped_type = 'konfi' AND year = $2
         ORDER BY jahrgang_id`,
        [USERS.konfi1.id, jahr]
      );

      // Vor der Migration stand hier genau eine Zeile.
      expect(rows).toHaveLength(2);
      expect(rows.map(r => r.jahrgang_id).sort((a, b) => a - b))
        .toEqual([JAHRGAENGE.jahrgang1.id, jgZwei].sort((a, b) => a - b));
    });

    it('haelt Teamer-Snapshots weiterhin eindeutig pro Person und Jahr', async () => {
      // Der neue Schluessel benutzt COALESCE(jahrgang_id, 0). Ohne das waeren
      // Teamer-Snapshots (jahrgang_id IS NULL) gar nicht mehr eindeutig --
      // in einem UNIQUE-Index gelten zwei NULL als verschieden, jeder Lauf
      // legte eine neue Zeile an und das ON CONFLICT liefe ins Leere.
      await request(app)
        .post('/api/wrapped/generate-teamer')
        .set('Authorization', `Bearer ${orgAdminToken}`);
      await request(app)
        .post('/api/wrapped/generate-teamer')
        .set('Authorization', `Bearer ${orgAdminToken}`);

      const { rows } = await db.query(
        `SELECT COUNT(*)::int AS anzahl FROM wrapped_snapshots
         WHERE user_id = $1 AND wrapped_type = 'teamer'`,
        [USERS.teamer1.id]
      );

      expect(rows[0].anzahl).toBe(1);
    });

    // Der Push wird am echten Versand geprueft, nicht an der Antwortmarke:
    // Wer den Aufruf aendert und `benachrichtigt` stehen laesst, wuerde sonst
    // nicht auffallen. (Beim Schreiben dieser Tests genau so passiert -- die
    // Gegenprobe blieb gruen, bis auch die Marke zurueckgedreht war.)
    it('benachrichtigt bei der ersten Freigabe', async () => {
      const spy = vi.spyOn(PushService, 'sendWrappedReleased').mockResolvedValue(undefined);

      const res = await request(app)
        .post(`/api/wrapped/generate/${JAHRGAENGE.jahrgang1.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.benachrichtigt).toBe(true);
      expect(spy).toHaveBeenCalledTimes(1);
      // An beide Konfis des Jahrgangs, als Konfi-Wrapped.
      const [, userIds, typ] = spy.mock.calls[0];
      expect([...userIds].sort((a, b) => a - b)).toEqual([USERS.konfi1.id, USERS.konfi2.id]);
      expect(typ).toBe('konfi');

      spy.mockRestore();
    });

    it('benachrichtigt beim erneuten Generieren NICHT noch einmal', async () => {
      // Wer nach einer Korrektur neu generiert, schickte dem ganzen Jahrgang
      // ein zweites Mal "Dein Konfi-Jahr ist da!".
      await request(app)
        .post(`/api/wrapped/generate/${JAHRGAENGE.jahrgang1.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      const spy = vi.spyOn(PushService, 'sendWrappedReleased').mockResolvedValue(undefined);

      const zweiter = await request(app)
        .post(`/api/wrapped/generate/${JAHRGAENGE.jahrgang1.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(zweiter.status).toBe(200);
      expect(zweiter.body.benachrichtigt).toBe(false);
      expect(spy).not.toHaveBeenCalled();
      // Die Snapshots werden trotzdem erneuert -- nur eben still.
      expect(zweiter.body.generated).toBe(2);
      expect(zweiter.body.errors).toBe(0);

      spy.mockRestore();
    });

    it('benachrichtigt wieder, nachdem die Freigabe zurueckgenommen wurde', async () => {
      await request(app)
        .post(`/api/wrapped/generate/${JAHRGAENGE.jahrgang1.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      await request(app)
        .delete(`/api/wrapped/${JAHRGAENGE.jahrgang1.id}`)
        .set('Authorization', `Bearer ${orgAdminToken}`);

      const spy = vi.spyOn(PushService, 'sendWrappedReleased').mockResolvedValue(undefined);

      const erneut = await request(app)
        .post(`/api/wrapped/generate/${JAHRGAENGE.jahrgang1.id}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(erneut.body.benachrichtigt).toBe(true);
      expect(spy).toHaveBeenCalledTimes(1);

      spy.mockRestore();
    });

    it('loescht Teamer-Snapshots ueber DELETE /teamer', async () => {
      // Teamer-Snapshots haben keinen Jahrgang. DELETE /:jahrgangId filtert
      // auf jahrgang_id und traf sie deshalb nie -- einmal erzeugt, blieben
      // sie fuer immer stehen.
      await request(app)
        .post('/api/wrapped/generate-teamer')
        .set('Authorization', `Bearer ${orgAdminToken}`);

      const vorher = await db.query(
        `SELECT COUNT(*)::int AS anzahl FROM wrapped_snapshots WHERE wrapped_type = 'teamer'`
      );
      expect(vorher.rows[0].anzahl).toBe(1);

      const res = await request(app)
        .delete('/api/wrapped/teamer')
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.deleted).toBe(1);

      const nachher = await db.query(
        `SELECT COUNT(*)::int AS anzahl FROM wrapped_snapshots WHERE wrapped_type = 'teamer'`
      );
      expect(nachher.rows[0].anzahl).toBe(0);
    });

    it('laesst beim Loeschen eines Jahrgangs die Teamer-Snapshots stehen', async () => {
      await request(app)
        .post(`/api/wrapped/generate/${JAHRGAENGE.jahrgang1.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      await request(app)
        .post('/api/wrapped/generate-teamer')
        .set('Authorization', `Bearer ${orgAdminToken}`);

      const res = await request(app)
        .delete(`/api/wrapped/${JAHRGAENGE.jahrgang1.id}`)
        .set('Authorization', `Bearer ${orgAdminToken}`);

      // Nur die beiden Konfi-Zeilen des Jahrgangs, nicht die Teamer-Zeile.
      expect(res.body.deleted).toBe(2);

      const { rows } = await db.query(
        `SELECT COUNT(*)::int AS anzahl FROM wrapped_snapshots WHERE wrapped_type = 'teamer'`
      );
      expect(rows[0].anzahl).toBe(1);
    });

    it('loescht keine Teamer-Snapshots einer fremden Organisation', async () => {
      await request(app)
        .post('/api/wrapped/generate-teamer')
        .set('Authorization', `Bearer ${orgAdminToken}`);
      await request(app)
        .post('/api/wrapped/generate-teamer')
        .set('Authorization', `Bearer ${orgAdmin2Token}`);

      const res = await request(app)
        .delete('/api/wrapped/teamer')
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(res.body.deleted).toBe(1);

      const { rows } = await db.query(
        `SELECT COUNT(*)::int AS anzahl FROM wrapped_snapshots
         WHERE wrapped_type = 'teamer' AND organization_id = $1`,
        [ORGS.andereGemeinde.id]
      );
      expect(rows[0].anzahl).toBe(1);
    });

    it('loescht nur das angefragte Jahr und laesst aeltere Teamer-Wrappeds stehen', async () => {
      // Teamer bekommen JEDES Jahr einen neuen Rückblick, und die alten
      // müssen erhalten bleiben (Simons Regel 02.09.2026). Bei den Konfis
      // leistet das der Jahrgangsfilter in DELETE /:jahrgangId — Teamer haben
      // keinen Jahrgang, dort ist das Jahr die einzige Trennlinie.
      //
      // Ohne den Filter löschte die Route ALLE Jahre der Organisation auf
      // einmal: Ein "neu erzeugen" im nächsten Jahr hätte die gesamte
      // Historie aller Teamer:innen vernichtet, ohne Rückfrage und ohne Spur.
      await request(app)
        .post('/api/wrapped/generate-teamer')
        .set('Authorization', `Bearer ${orgAdminToken}`);

      // Einen Snapshot aus dem Vorjahr danebenlegen (so entsteht er im echten
      // Betrieb: der Lauf des letzten Jahres).
      const { rows: [vorhanden] } = await db.query(
        `SELECT user_id, organization_id, data FROM wrapped_snapshots
         WHERE wrapped_type = 'teamer' LIMIT 1`
      );
      await db.query(
        `INSERT INTO wrapped_snapshots (user_id, organization_id, wrapped_type, year, data, computed_at)
         VALUES ($1, $2, 'teamer', 2025, $3, NOW())`,
        [vorhanden.user_id, vorhanden.organization_id, vorhanden.data]
      );

      const res = await request(app)
        .delete('/api/wrapped/teamer?year=2026')
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.deleted).toBe(1);

      const { rows } = await db.query(
        `SELECT year FROM wrapped_snapshots WHERE wrapped_type = 'teamer' ORDER BY year`
      );
      expect(rows.map(r => r.year)).toEqual([2025]);
    });

    it('loescht ohne Jahresangabe weiterhin alle Jahre (bisheriges Verhalten)', async () => {
      // Der Vertrag der ausgelieferten Oberfläche: Ein DELETE ohne year
      // räumt wie bisher komplett auf. Nur so bleibt der vorhandene
      // Aufruf in der Leitungsansicht gültig.
      await request(app)
        .post('/api/wrapped/generate-teamer')
        .set('Authorization', `Bearer ${orgAdminToken}`);
      const { rows: [vorhanden] } = await db.query(
        `SELECT user_id, organization_id, data FROM wrapped_snapshots
         WHERE wrapped_type = 'teamer' LIMIT 1`
      );
      await db.query(
        `INSERT INTO wrapped_snapshots (user_id, organization_id, wrapped_type, year, data, computed_at)
         VALUES ($1, $2, 'teamer', 2025, $3, NOW())`,
        [vorhanden.user_id, vorhanden.organization_id, vorhanden.data]
      );

      const res = await request(app)
        .delete('/api/wrapped/teamer')
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(res.body.deleted).toBe(2);

      const { rows } = await db.query(
        `SELECT COUNT(*)::int AS anzahl FROM wrapped_snapshots WHERE wrapped_type = 'teamer'`
      );
      expect(rows[0].anzahl).toBe(0);
    });

    it('weist ein unsinniges Jahr ab', async () => {
      const res = await request(app)
        .delete('/api/wrapped/teamer?year=abc')
        .set('Authorization', `Bearer ${orgAdminToken}`);
      expect(res.status).toBe(400);
    });

    it('laesst Admin und Konfi nicht an DELETE /teamer', async () => {
      const alsAdmin = await request(app)
        .delete('/api/wrapped/teamer')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(alsAdmin.status).toBe(403);

      const alsKonfi = await request(app)
        .delete('/api/wrapped/teamer')
        .set('Authorization', `Bearer ${konfiToken}`);
      expect(alsKonfi.status).toBe(403);
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
  // ZAHLEN (Befunde W-A / W-B / W-C, 01.09.2026)
  //
  // Die Suite prueft bis hier ausschliesslich Rechte, Isolation und
  // Freigabe -- keine einzige Zahl. Genau deshalb standen W-A und W-B
  // bei gruenen Tests im Code. Alles hier prueft konkrete Werte.
  // ================================================================
  describe('Zahlen im Konfi-Snapshot', () => {
    const JAHR = new Date().getFullYear();

    // Zeitraum ohne Konfirmations-Termin: 1.9.(JAHR-1) .. 31.8.(JAHR).
    const IM_ZEITRAUM = `${JAHR - 1}-11-15`;
    const AUGUST = `${JAHR}-08-15`;          // frueher aus dem Fallback gefallen
    const VOR_ZEITRAUM = `${JAHR - 1}-06-15`; // liegt davor
    const NACH_ZEITRAUM = `${JAHR}-10-15`;    // liegt danach

    /** Termin anlegen und dem Jahrgang zuordnen; gibt die Event-ID zurueck. */
    async function termin(name, datum, opts = {}) {
      const { rows: [e] } = await db.query(
        `INSERT INTO events (name, event_date, organization_id, mandatory, max_participants, point_type, points)
         VALUES ($1, $2::timestamp, $3, $4, 0, $5, 1) RETURNING id`,
        [name, `${datum} 10:00:00`, opts.orgId || ORGS.testGemeinde.id, opts.mandatory || false, opts.pointType || 'gemeinde']
      );
      const jgId = opts.jahrgangId === null ? null : (opts.jahrgangId || JAHRGAENGE.jahrgang1.id);
      if (jgId !== null) {
        await db.query('INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) VALUES ($1, $2)', [e.id, jgId]);
      }
      return e.id;
    }

    async function buchung(userId, eventId, opts = {}) {
      await db.query(
        `INSERT INTO event_bookings (user_id, event_id, organization_id, status, attendance_status, booking_date)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [userId, eventId, opts.orgId || ORGS.testGemeinde.id, opts.status || 'confirmed', opts.attendance || null]
      );
    }

    /** Erzeugt Wrapped fuer Jahrgang 1 und gibt den Snapshot von konfi1 zurueck. */
    async function snapshotVonKonfi1() {
      const gen = await request(app)
        .post(`/api/wrapped/generate/${JAHRGAENGE.jahrgang1.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(gen.status).toBe(200);

      const { rows } = await db.query(
        `SELECT data FROM wrapped_snapshots WHERE user_id = $1 AND wrapped_type = 'konfi'`,
        [USERS.konfi1.id]
      );
      expect(rows).toHaveLength(1);
      return rows[0].data;
    }

    beforeEach(async () => {
      // Der Seed legt vier Termine 7 Tage in der Zukunft an und bucht nichts.
      // Fuer die Zahlen-Tests raeumen wir das Feld leer und stellen eine
      // bekannte Datenlage her.
      await db.query('DELETE FROM event_bookings');
      await db.query('DELETE FROM event_jahrgang_assignments');
      await db.query('DELETE FROM events');
    });

    // ------------------------------------------------------------
    // W-A: Wrapped und Dashboard zaehlen dieselbe Sache gleich.
    // ------------------------------------------------------------
    it('Wrapped und Dashboard liefern fuer dieselbe Person dieselbe Terminzahl', async () => {
      // Genau die Mischung, die in Produktion den Faktor 15 erzeugte:
      // gebucht ohne gepflegte Anwesenheit, gebucht + present, und ein
      // Termin OHNE Jahrgangszuordnung.
      const a = await termin('Gebucht ohne Anwesenheit', IM_ZEITRAUM);
      const b = await termin('Gebucht und anwesend', IM_ZEITRAUM);
      const c = await termin('Ohne Jahrgangszuordnung', IM_ZEITRAUM, { jahrgangId: null });
      await buchung(USERS.konfi1.id, a);
      await buchung(USERS.konfi1.id, b, { attendance: 'present' });
      await buchung(USERS.konfi1.id, c);

      const dash = await request(app)
        .get('/api/konfi/dashboard')
        .set('Authorization', `Bearer ${konfiToken}`);
      expect(dash.status).toBe(200);
      expect(dash.body.event_count).toBe(3);

      const snap = await snapshotVonKonfi1();
      expect(snap.slides.events.total_attended).toBe(3);
      expect(snap.slides.events.total_attended).toBe(dash.body.event_count);
    });

    it('gottesdienst_count zaehlt nach derselben Regel wie die Termine', async () => {
      // Frueher zaehlte gottesdienst_count in DERSELBEN Funktion nach einer
      // dritten Regel (present, aber ohne Jahrgangs-JOIN).
      const gd1 = await termin('Gottesdienst gebucht', IM_ZEITRAUM, { pointType: 'gottesdienst' });
      const gd2 = await termin('Gottesdienst anwesend', IM_ZEITRAUM, { pointType: 'gottesdienst' });
      const gem = await termin('Gemeindeabend', IM_ZEITRAUM, { pointType: 'gemeinde' });
      await buchung(USERS.konfi1.id, gd1);
      await buchung(USERS.konfi1.id, gd2, { attendance: 'present' });
      await buchung(USERS.konfi1.id, gem);

      const snap = await snapshotVonKonfi1();
      expect(snap.slides.gottesdienst.count).toBe(2);
      expect(snap.slides.events.total_attended).toBe(3);
    });

    // ------------------------------------------------------------
    // W-B: Der Jahresrueckblick filtert nach Jahr.
    // ------------------------------------------------------------
    it('Ein Termin AUSSERHALB des Zeitraums zaehlt nicht mit', async () => {
      const drin = await termin('Im Zeitraum', IM_ZEITRAUM);
      const davor = await termin('Vor dem Zeitraum', VOR_ZEITRAUM);
      const danach = await termin('Nach dem Zeitraum', NACH_ZEITRAUM);
      await buchung(USERS.konfi1.id, drin);
      await buchung(USERS.konfi1.id, davor);
      await buchung(USERS.konfi1.id, danach);

      const snap = await snapshotVonKonfi1();
      // Das Dashboard zaehlt weiterhin alle drei -- es kennt keinen Zeitraum.
      expect(snap.slides.events.total_attended).toBe(1);
      expect(snap.slides.events.lieblings_event.name).toBe('Im Zeitraum');
    });

    it('Absagen ausserhalb des Zeitraums zaehlen nicht mit', async () => {
      const drin = await termin('Abgesagt im Zeitraum', IM_ZEITRAUM);
      const davor = await termin('Abgesagt davor', VOR_ZEITRAUM);
      await buchung(USERS.konfi1.id, drin, { status: 'cancelled' });
      await buchung(USERS.konfi1.id, davor, { status: 'cancelled' });

      const snap = await snapshotVonKonfi1();
      expect(snap.slides.events.abgesagt).toBe(1);
    });

    it('aktivster_monat mittelt nicht ueber mehrere Jahre', async () => {
      // Zwei Termine im November des VORJAHRES (im Zeitraum) und drei im
      // Dezember eines noch frueheren Jahres (ausserhalb). Ohne Zeitfilter
      // gewaenne der Dezember mit 3 -- obwohl er gar nicht zum Rueckblick
      // gehoert.
      const nov1 = await termin('November A', `${JAHR - 1}-11-05`);
      const nov2 = await termin('November B', `${JAHR - 1}-11-20`);
      const dez1 = await termin('Dezember alt A', `${JAHR - 3}-12-05`);
      const dez2 = await termin('Dezember alt B', `${JAHR - 3}-12-10`);
      const dez3 = await termin('Dezember alt C', `${JAHR - 3}-12-15`);
      for (const id of [nov1, nov2, dez1, dez2, dez3]) {
        await buchung(USERS.konfi1.id, id);
      }

      const snap = await snapshotVonKonfi1();
      expect(snap.slides.aktivster_monat.monat).toBe(11);
      expect(snap.slides.aktivster_monat.monat_name).toBe('November');
      expect(snap.slides.aktivster_monat.aktivitaeten).toBe(2);
    });

    // ------------------------------------------------------------
    // W-C: Fallback-Zeitraum, und der August fehlt nicht.
    // ------------------------------------------------------------
    it('Ein Jahrgang OHNE Konfirmationstermin bekommt 1.9. bis 31.8. -- der August fehlt nicht', async () => {
      const { rows: [k] } = await db.query(
        'SELECT COUNT(*)::int AS anzahl FROM events WHERE is_konfirmation = true'
      );
      expect(k.anzahl).toBe(0);

      const imAugust = await termin('Sommerfreizeit im August', AUGUST);
      await buchung(USERS.konfi1.id, imAugust);

      const snap = await snapshotVonKonfi1();
      expect(snap.slides.zeitraum.start).toBe(`${JAHR - 1}-09-01`);
      expect(snap.slides.zeitraum.ende).toBe(`${JAHR}-08-31`);
      // Ohne Konfirmations-Termin gibt es KEINEN Konfirmationstermin --
      // frueher wurde dafuer das Zeitraum-Ende als Datum angezeigt.
      expect(snap.slides.zeitraum.konfirmation).toBe(null);
      // Und der August zaehlt mit.
      expect(snap.slides.events.total_attended).toBe(1);
    });

    it('Mit Konfirmationstermin endet der Zeitraum am Termin, ohne Zeitzonen-Verschiebung', async () => {
      // Der 1.9. als Startdatum rutschte per new Date(y,8,1).toISOString()
      // in Sommerzeit auf den 31.8.
      const konf = await termin('Konfirmation', `${JAHR}-05-10`);
      await db.query('UPDATE events SET is_konfirmation = true WHERE id = $1', [konf]);

      const snap = await snapshotVonKonfi1();
      expect(snap.slides.zeitraum.start).toBe(`${JAHR - 1}-09-01`);
      expect(snap.slides.zeitraum.ende).toBe(`${JAHR}-05-10`);
      expect(snap.slides.zeitraum.konfirmation).toBe(`${JAHR}-05-10`);
    });

    // ------------------------------------------------------------
    // Mandantengrenze: die Absagen-Query hatte keinen Org-Filter.
    // ------------------------------------------------------------
    it('Die Absagen-Query liefert nichts aus einer fremden Organisation', async () => {
      // konfi1 gehoert zu Org 1, bekommt aber zusaetzlich eine abgesagte
      // Buchung in Org 2 -- genau die Konstellation eines Kontos, das in
      // mehreren Gemeinden auftaucht.
      const eigen = await termin('Eigene Org abgesagt', IM_ZEITRAUM);
      const fremd = await termin('Fremde Org abgesagt', IM_ZEITRAUM, {
        orgId: ORGS.andereGemeinde.id,
        jahrgangId: JAHRGAENGE.jahrgang2.id
      });
      await buchung(USERS.konfi1.id, eigen, { status: 'cancelled' });
      await buchung(USERS.konfi1.id, fremd, { status: 'cancelled', orgId: ORGS.andereGemeinde.id });

      const snap = await snapshotVonKonfi1();
      expect(snap.slides.events.abgesagt).toBe(1);
    });

    it('Auch die Terminzahl zaehlt keine fremde Organisation mit', async () => {
      const eigen = await termin('Eigene Org', IM_ZEITRAUM);
      const fremd = await termin('Fremde Org', IM_ZEITRAUM, {
        orgId: ORGS.andereGemeinde.id,
        jahrgangId: JAHRGAENGE.jahrgang2.id
      });
      await buchung(USERS.konfi1.id, eigen);
      await buchung(USERS.konfi1.id, fremd, { orgId: ORGS.andereGemeinde.id });

      const snap = await snapshotVonKonfi1();
      expect(snap.slides.events.total_attended).toBe(1);
    });
  });

  // ================================================================
  // PERSOENLICHE HIGHLIGHTS (Snapshot-Version 3, 01.09.2026)
  // ================================================================
  // Simons Wunsch: Der Rueckblick soll sich von Konfi zu Konfi dynamisch
  // unterscheiden. Gewaehlt wird nicht mehr der groesste Rohwert, sondern
  // das, worin jemand im Vergleich zum eigenen Jahrgang heraussticht.
  describe('Persoenliche Highlights (Version 3)', () => {
    const JAHR = new Date().getFullYear();
    const IM_ZEITRAUM = `${JAHR - 1}-11-15`;
    const VOR_ZEITRAUM = `${JAHR - 1}-06-15`;

    async function termin(name, datum, opts = {}) {
      const { rows: [e] } = await db.query(
        `INSERT INTO events (name, event_date, organization_id, mandatory, max_participants, point_type, points)
         VALUES ($1, $2::timestamp, $3, false, 0, $4, 1) RETURNING id`,
        [name, `${datum} 10:00:00`, opts.orgId || ORGS.testGemeinde.id, opts.pointType || 'gemeinde']
      );
      await db.query('INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) VALUES ($1, $2)',
        [e.id, opts.jahrgangId || JAHRGAENGE.jahrgang1.id]);
      return e.id;
    }

    async function buchung(userId, eventId, opts = {}) {
      await db.query(
        `INSERT INTO event_bookings (user_id, event_id, organization_id, status, booking_date)
         VALUES ($1, $2, $3, 'confirmed', NOW())`,
        [userId, eventId, opts.orgId || ORGS.testGemeinde.id]
      );
    }

    /** Chat-Nachricht in Raum 1 (Jahrgangs-Chat Org 1), Datum frei waehlbar. */
    async function nachricht(userId, datum, opts = {}) {
      const { rows: [m] } = await db.query(
        `INSERT INTO chat_messages (room_id, user_id, user_type, message_type, content, created_at, deleted_at)
         VALUES ($1, $2, 'konfi', 'text', $3, $4::timestamp, $5) RETURNING id`,
        [opts.roomId || 1, userId, opts.content || 'Hallo', `${datum} 12:00:00`,
         opts.geloescht ? `${datum} 13:00:00` : null]
      );
      return m.id;
    }

    async function reaktion(messageId, userId, datum, opts = {}) {
      await db.query(
        `INSERT INTO chat_message_reactions (message_id, user_id, user_type, emoji, created_at)
         VALUES ($1, $2, $3, $4, $5::timestamp)`,
        [messageId, userId, opts.userType || 'konfi', opts.emoji || ':like:', `${datum} 12:30:00`]
      );
    }

    async function challenge(title) {
      const { rows: [c] } = await db.query(
        `INSERT INTO challenges (organization_id, title, description, challenge_type, badge_name, badge_icon, starts_at, ends_at, is_draft)
         VALUES ($1, $2, 'Testbeschreibung', 'frei', $2, 'flag', NOW() - INTERVAL '1 year', NOW() + INTERVAL '1 year', false)
         RETURNING id`,
        [ORGS.testGemeinde.id, title]
      );
      return c.id;
    }

    async function beitrag(userId, challengeId, datum, opts = {}) {
      await db.query(
        `INSERT INTO challenge_submissions (challenge_id, user_id, organization_id, media_type, text_content, moderation_status, created_at)
         VALUES ($1, $2, $3, 'text', 'Mein Beitrag', $4, $5::timestamp)`,
        [challengeId, userId, ORGS.testGemeinde.id, opts.status || 'approved', `${datum} 15:00:00`]
      );
    }

    async function abmeldung(userId, eventId, datum) {
      await db.query(
        `INSERT INTO event_unregistrations (user_id, event_id, reason, unregistered_at, organization_id)
         VALUES ($1, $2, 'Testgrund', $3::timestamp, $4)`,
        [userId, eventId, `${datum} 09:00:00`, ORGS.testGemeinde.id]
      );
    }

    /** Erzeugt Wrapped fuer Jahrgang 1 und gibt den Snapshot eines Konfis zurueck. */
    async function snapshotVon(userId) {
      const gen = await request(app)
        .post(`/api/wrapped/generate/${JAHRGAENGE.jahrgang1.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(gen.status).toBe(200);

      const { rows } = await db.query(
        `SELECT data FROM wrapped_snapshots WHERE user_id = $1 AND wrapped_type = 'konfi'`,
        [userId]
      );
      expect(rows).toHaveLength(1);
      return rows[0].data;
    }

    beforeEach(async () => {
      // Bekannte Datenlage: Seed-Termine raus (wie im Zahlen-describe).
      await db.query('DELETE FROM event_bookings');
      await db.query('DELETE FROM event_jahrgang_assignments');
      await db.query('DELETE FROM events');
    });

    // ------------------------------------------------------------
    // chat_star
    // ------------------------------------------------------------
    it('Wer den Jahrgangs-Chat traegt, wird chat_star -- wer kaum schreibt, nicht', async () => {
      for (let i = 0; i < 25; i++) await nachricht(USERS.konfi1.id, IM_ZEITRAUM);
      for (let i = 0; i < 2; i++) await nachricht(USERS.konfi2.id, IM_ZEITRAUM);

      const snap1 = await snapshotVon(USERS.konfi1.id);
      expect(snap1.highlight_type).toBe('chat_star');
      expect(snap1.slides.chat.nachrichten_gesendet).toBe(25);
      expect(snap1.slides.highlight.type).toBe('chat_star');
      expect(snap1.slides.highlight.wert).toBe(25);
      // Jahrgangsschnitt: (25 + 2) / 2 Konfis = 13.5 -- anonym, keine Namen.
      expect(snap1.slides.highlight.jahrgangsschnitt).toBe(13.5);

      const { rows } = await db.query(
        `SELECT data FROM wrapped_snapshots WHERE user_id = $1 AND wrapped_type = 'konfi'`,
        [USERS.konfi2.id]
      );
      const snap2 = rows[0].data;
      // 2 Nachrichten sind kein Highlight (Mindestwert 20) -> Default.
      expect(snap2.highlight_type).toBe('events_held');
      expect(snap2.slides.chat.nachrichten_gesendet).toBe(2);
    });

    it('Geloeschte Nachrichten zaehlen nicht, fremde Organisationen auch nicht', async () => {
      await nachricht(USERS.konfi1.id, IM_ZEITRAUM);
      await nachricht(USERS.konfi1.id, IM_ZEITRAUM, { geloescht: true });
      // Raum 4 gehoert Org 2 -- die Nachricht darf nicht mitzaehlen.
      await nachricht(USERS.konfi1.id, IM_ZEITRAUM, { roomId: 4 });

      const snap = await snapshotVon(USERS.konfi1.id);
      expect(snap.slides.chat.nachrichten_gesendet).toBe(1);
    });

    // ------------------------------------------------------------
    // reaktions_magnet
    // ------------------------------------------------------------
    it('Viel Zustimmung BEKOMMEN macht den reaktions_magnet -- eigene Reaktionen zaehlen nicht', async () => {
      // konfi1 schreibt 6 Nachrichten, konfi2 reagiert auf jede.
      const ids = [];
      for (let i = 0; i < 6; i++) ids.push(await nachricht(USERS.konfi1.id, IM_ZEITRAUM));
      for (const id of ids) await reaktion(id, USERS.konfi2.id, IM_ZEITRAUM);
      // Selbst-Reaktion auf die eigene Nachricht: zaehlt NICHT als bekommen.
      await reaktion(ids[0], USERS.konfi1.id, IM_ZEITRAUM, { emoji: ':herz:' });

      const snap1 = await snapshotVon(USERS.konfi1.id);
      expect(snap1.highlight_type).toBe('reaktions_magnet');
      expect(snap1.slides.chat.reaktionen_bekommen).toBe(6);
      expect(snap1.slides.chat.reaktionen_gegeben).toBe(1);
      expect(snap1.slides.highlight.wert).toBe(6);

      const { rows } = await db.query(
        `SELECT data FROM wrapped_snapshots WHERE user_id = $1 AND wrapped_type = 'konfi'`,
        [USERS.konfi2.id]
      );
      const snap2 = rows[0].data;
      expect(snap2.highlight_type).not.toBe('reaktions_magnet');
      expect(snap2.slides.chat.reaktionen_bekommen).toBe(0);
      expect(snap2.slides.chat.reaktionen_gegeben).toBe(6);
    });

    // ------------------------------------------------------------
    // challenge_fan
    // ------------------------------------------------------------
    it('Viele Challenge-Beitraege machen den challenge_fan, samt Top-Challenge -- versteckte zaehlen nicht', async () => {
      const foto = await challenge('Foto-Challenge');
      const mut = await challenge('Mut-Challenge');
      await beitrag(USERS.konfi1.id, foto, IM_ZEITRAUM);
      await beitrag(USERS.konfi1.id, foto, IM_ZEITRAUM);
      await beitrag(USERS.konfi1.id, mut, IM_ZEITRAUM);
      // Versteckter Beitrag: von der Moderation aus dem Rueckblick genommen.
      await beitrag(USERS.konfi1.id, mut, IM_ZEITRAUM, { status: 'hidden' });

      const snap1 = await snapshotVon(USERS.konfi1.id);
      expect(snap1.highlight_type).toBe('challenge_fan');
      expect(snap1.slides.challenges.beitraege).toBe(3);
      expect(snap1.slides.challenges.top_challenge.title).toBe('Foto-Challenge');
      expect(snap1.slides.challenges.top_challenge.count).toBe(2);
      expect(snap1.slides.highlight.wert).toBe(3);

      const { rows } = await db.query(
        `SELECT data FROM wrapped_snapshots WHERE user_id = $1 AND wrapped_type = 'konfi'`,
        [USERS.konfi2.id]
      );
      const snap2 = rows[0].data;
      expect(snap2.highlight_type).toBe('events_held');
      expect(snap2.slides.challenges.beitraege).toBe(0);
      expect(snap2.slides.challenges.top_challenge).toBe(null);
    });

    // ------------------------------------------------------------
    // verlaesslich -- und Simons Kernszenario: zwei Konfis mit
    // aehnlichem Verhalten bekommen NACHWEISLICH verschiedene Seiten.
    // ------------------------------------------------------------
    it('Nie abgesagt bei genug Buchungen wird verlaesslich -- wer abgesagt hat, bekommt ein anderes Highlight', async () => {
      // Beide buchen dieselben 6 Termine; konfi2 meldet sich zweimal ab.
      const termine = [];
      for (let i = 0; i < 6; i++) termine.push(await termin(`Termin ${i}`, IM_ZEITRAUM));
      for (const t of termine) {
        await buchung(USERS.konfi1.id, t);
        await buchung(USERS.konfi2.id, t);
      }
      await abmeldung(USERS.konfi2.id, termine[0], IM_ZEITRAUM);
      await abmeldung(USERS.konfi2.id, termine[1], IM_ZEITRAUM);

      const snap1 = await snapshotVon(USERS.konfi1.id);
      const { rows } = await db.query(
        `SELECT data FROM wrapped_snapshots WHERE user_id = $1 AND wrapped_type = 'konfi'`,
        [USERS.konfi2.id]
      );
      const snap2 = rows[0].data;

      // konfi1: 0 Absagen bei 6 Buchungen -> Fels in der Brandung.
      expect(snap1.highlight_type).toBe('verlaesslich');
      expect(snap1.slides.verlaesslichkeit.nie_abgesagt).toBe(true);
      expect(snap1.slides.verlaesslichkeit.abmeldungen).toBe(0);

      // konfi2: KEIN beschaemendes Absage-Highlight -- die Absagen stehen
      // nur neutral im Snapshot, das Highlight ist das naechstbeste.
      expect(snap2.highlight_type).toBe('events_held');
      expect(snap2.slides.verlaesslichkeit.nie_abgesagt).toBe(false);
      expect(snap2.slides.verlaesslichkeit.abmeldungen).toBe(2);

      // Der eigentliche Test fuer Simons Wunsch: zwei Konfis, fast gleiches
      // Verhalten, nachweislich verschiedene Highlights.
      expect(snap1.highlight_type).not.toBe(snap2.highlight_type);
    });

    it('Wenige Buchungen sind keine Verlaesslichkeits-Aussage', async () => {
      // 2 Buchungen ohne Absage: "nie abgesagt" waere eine Aussage ueber
      // fehlende Gelegenheit, nicht ueber die Person.
      const a = await termin('Termin A', IM_ZEITRAUM);
      const b = await termin('Termin B', IM_ZEITRAUM);
      await buchung(USERS.konfi1.id, a);
      await buchung(USERS.konfi1.id, b);

      const snap = await snapshotVon(USERS.konfi1.id);
      expect(snap.slides.verlaesslichkeit.nie_abgesagt).toBe(false);
      expect(snap.highlight_type).not.toBe('verlaesslich');
    });

    // ------------------------------------------------------------
    // Zeitraum-Grenze
    // ------------------------------------------------------------
    it('Chat-Nachrichten und Abmeldungen VOR dem Zeitraum zaehlen nicht', async () => {
      await nachricht(USERS.konfi1.id, IM_ZEITRAUM);
      await nachricht(USERS.konfi1.id, VOR_ZEITRAUM);
      await nachricht(USERS.konfi1.id, VOR_ZEITRAUM);

      const termine = [];
      for (let i = 0; i < 5; i++) termine.push(await termin(`Termin ${i}`, IM_ZEITRAUM));
      for (const t of termine) await buchung(USERS.konfi1.id, t);
      // Abmeldung aus dem VORIGEN Konfi-Jahr: gehoert nicht in diesen Rueckblick.
      await abmeldung(USERS.konfi1.id, termine[0], VOR_ZEITRAUM);

      const snap = await snapshotVon(USERS.konfi1.id);
      expect(snap.slides.chat.nachrichten_gesendet).toBe(1);
      expect(snap.slides.verlaesslichkeit.abmeldungen).toBe(0);
      expect(snap.slides.verlaesslichkeit.nie_abgesagt).toBe(true);
    });

    // ------------------------------------------------------------
    // Formwaechter: Version 3 ist ADDITIV -- alle bisherigen Felder
    // sind noch da und haben denselben Typ (ausgelieferte Apps!).
    // ------------------------------------------------------------
    it('Version 3 behaelt alle bisherigen Snapshot-Felder mit denselben Typen', async () => {
      const a = await termin('Ein Termin', IM_ZEITRAUM);
      await buchung(USERS.konfi1.id, a);

      const snap = await snapshotVon(USERS.konfi1.id);

      expect(snap.version).toBe(3);
      expect(typeof snap.highlight_type).toBe('string');
      expect(typeof snap.formulierung_seed).toBe('number');

      // Bestandsfelder (Version 2) -- Form und Typ unveraendert.
      expect(typeof snap.slides.punkte.gottesdienst).toBe('number');
      expect(typeof snap.slides.punkte.gemeinde).toBe('number');
      expect(typeof snap.slides.punkte.total).toBe('number');
      expect(typeof snap.slides.punkte.bonus).toBe('number');
      expect(snap.slides.events.total_attended).toBe(1);
      expect(typeof snap.slides.events.total_available).toBe('number');
      expect(typeof snap.slides.events.abgesagt).toBe('number');
      expect(snap.slides.events.lieblings_event.name).toBe('Ein Termin');
      expect(typeof snap.slides.badges.total_earned).toBe('number');
      expect(Array.isArray(snap.slides.badges.badges)).toBe(true);
      expect(typeof snap.slides.pflicht.besucht).toBe('number');
      expect(typeof snap.slides.pflicht.gesamt).toBe('number');
      expect(typeof snap.slides.aktivster_monat.monat).toBe('number');
      expect(typeof snap.slides.aktivster_monat.monat_name).toBe('string');
      expect(typeof snap.slides.endspurt.aktiv).toBe('boolean');
      expect(typeof snap.slides.endspurt.fehlende_punkte).toBe('number');
      expect(typeof snap.slides.zeitraum.start).toBe('string');
      expect(typeof snap.slides.zeitraum.ende).toBe('string');
      expect(typeof snap.slides.gottesdienst.count).toBe('number');
      expect(Array.isArray(snap.slides.kategorie.verteilung)).toBe(true);
      expect(Array.isArray(snap.slides.challenge_momente)).toBe(true);

      // Neue Felder (Version 3) -- vorhanden und richtig getypt.
      expect(typeof snap.slides.chat.nachrichten_gesendet).toBe('number');
      expect(typeof snap.slides.chat.reaktionen_gegeben).toBe('number');
      expect(typeof snap.slides.chat.reaktionen_bekommen).toBe('number');
      expect(typeof snap.slides.challenges.beitraege).toBe('number');
      expect(typeof snap.slides.verlaesslichkeit.abmeldungen).toBe('number');
      expect(typeof snap.slides.verlaesslichkeit.nie_abgesagt).toBe('boolean');
      expect(snap.slides.highlight.type).toBe(snap.highlight_type);
      expect(typeof snap.slides.highlight.wert).toBe('number');
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
