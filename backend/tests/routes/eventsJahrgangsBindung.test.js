// Jahrgangs-Bindung fuer die Schreibrouten unter /api/events (Befund 14.09.2026).
//
// Das gesamte Modul routes/events/ kannte die Jahrgangsgrenze nicht: Null
// Treffer fuer darfJahrgang/darfKonfi in 3523 Zeilen. Alle Leitungsrouten
// trugen nur rbacVerifier + requireTeamer und prueften im Rumpf ausschliesslich
// organization_id.
//
// Der Widerspruch lag INNERHALB derselben Ressource: Die Listen-Route
// (lesen.js) filtert sehr wohl nach zugewiesenen Jahrgaengen, mit
// ausdruecklichem Verweis auf Simons Regel vom 08.09.2026 ("teamer sollen nur
// jahrgaenge und events buchen koennen wenn sie auch in dem jahrgang sind. nur
// teamer ist davon ausgenommen"). Auch das Buchen prueft
// (utils/bookingUtils.js, darfTeamerAnDiesenTermin).
//
// Ergebnis war: SEHEN nein, BUCHEN nein — aber LOESCHEN, ABSAGEN und
// ANWESENHEIT SAMT PUNKTEN verbuchen ja.
//
// Die Regel folgt der Listen-Route:
//   - reine Teamer-Termine (teamer_only): immer erlaubt, haengen an keinem Jahrgang
//   - allgemeine Termine (keine Jahrgangszuordnung): immer erlaubt
//   - jahrgangsgebundene Termine: nur bei Ueberschneidung mit den eigenen
//   - org_admin / super_admin: ausgenommen

const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-vitest';

const JG_A = 301;          // Jahrgang des Admins
const JG_B = 302;          // fremder Jahrgang
const ADMIN_MIT_JG = 401;
const TEAMER_MIT_JG = 402;

function tokenFuer(id, roleId, type = 'admin') {
  return jwt.sign(
    { id, type, display_name: `User ${id}`, organization_id: 1, role_id: roleId },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

describe('Jahrgangs-Bindung der Termin-Schreibrouten', () => {
  let app;
  let db;
  let adminMitJgToken;
  let teamerMitJgToken;
  let orgAdminToken;

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

    await db.query(
      `INSERT INTO jahrgaenge (id, name, organization_id, confirmation_date)
       VALUES ($1, '2026/2027 EV-A', 1, '2027-05-01'), ($2, '2026/2027 EV-B', 1, '2027-05-01')`,
      [JG_A, JG_B]
    );

    // admin (role_id 3) und teamer (role_id 2), beide nur in JG_A
    await db.query(
      `INSERT INTO users (id, username, password_hash, display_name, role_id, organization_id, is_active)
       VALUES ($1, 'ev_admin', 'x', 'EV Admin', 3, 1, true),
              ($2, 'ev_teamer', 'x', 'EV Teamer', 2, 1, true)`,
      [ADMIN_MIT_JG, TEAMER_MIT_JG]
    );
    await db.query(
      `INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id, can_view, can_edit)
       VALUES ($1, $3, true, true), ($2, $3, true, true)`,
      [ADMIN_MIT_JG, TEAMER_MIT_JG, JG_A]
    );

    adminMitJgToken  = tokenFuer(ADMIN_MIT_JG, 3);
    teamerMitJgToken = tokenFuer(TEAMER_MIT_JG, 2, 'teamer');
    orgAdminToken    = generateToken('orgAdmin1');

    const { invalidateUserCache } = require('../../middleware/rbac');
    invalidateUserCache(ADMIN_MIT_JG);
    invalidateUserCache(TEAMER_MIT_JG);
  });

  // Legt einen Termin an, optional einem Jahrgang zugeordnet.
  async function terminAnlegen({ jahrgangId = null, teamerOnly = false, name = 'Testtermin' } = {}) {
    const { rows: [event] } = await db.query(
      `INSERT INTO events (name, description, event_date, location, organization_id, teamer_only, max_participants)
       VALUES ($1, 'Beschreibung', NOW() + INTERVAL '7 days', 'Ort', 1, $2, 20) RETURNING id`,
      [name, teamerOnly]
    );
    if (jahrgangId) {
      await db.query(
        'INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) VALUES ($1, $2)',
        [event.id, jahrgangId]
      );
    }
    return event.id;
  }

  describe('DELETE /api/events/:id', () => {
    it('VERBOTEN: Admin loescht keinen Termin aus fremdem Jahrgang — 403, Termin bleibt', async () => {
      const id = await terminAnlegen({ jahrgangId: JG_B });

      const res = await request(app)
        .delete(`/api/events/${id}`)
        .set('Authorization', `Bearer ${adminMitJgToken}`);

      expect(res.status).toBe(403);

      const { rows } = await db.query('SELECT id FROM events WHERE id = $1', [id]);
      expect(rows.length).toBe(1);
    });

    it('ERLAUBT: Admin loescht im eigenen Jahrgang', async () => {
      const id = await terminAnlegen({ jahrgangId: JG_A });

      const res = await request(app)
        .delete(`/api/events/${id}`)
        .set('Authorization', `Bearer ${adminMitJgToken}`);

      expect(res.status).toBe(200);
    });

    it('ERLAUBT: allgemeiner Termin ohne Jahrgang bleibt fuer alle loeschbar', async () => {
      const id = await terminAnlegen({ jahrgangId: null });

      const res = await request(app)
        .delete(`/api/events/${id}`)
        .set('Authorization', `Bearer ${adminMitJgToken}`);

      expect(res.status).toBe(200);
    });

    it('ERLAUBT: reiner Teamer-Termin bleibt erreichbar (Ausnahme der Regel)', async () => {
      const id = await terminAnlegen({ jahrgangId: JG_B, teamerOnly: true });

      const res = await request(app)
        .delete(`/api/events/${id}`)
        .set('Authorization', `Bearer ${adminMitJgToken}`);

      expect(res.status).toBe(200);
    });

    it('REGRESSION: org_admin loescht in JEDEM Jahrgang', async () => {
      const id = await terminAnlegen({ jahrgangId: JG_B });

      const res = await request(app)
        .delete(`/api/events/${id}`)
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(res.status).toBe(200);
    });
  });

  describe('PUT /api/events/:id/cancel', () => {
    it('VERBOTEN: Admin sagt keinen fremden Termin ab — 403, nicht abgesagt', async () => {
      const id = await terminAnlegen({ jahrgangId: JG_B });

      const res = await request(app)
        .put(`/api/events/${id}/cancel`)
        .set('Authorization', `Bearer ${adminMitJgToken}`)
        .send({ grund: 'Test' });

      expect(res.status).toBe(403);

      const { rows: [event] } = await db.query('SELECT cancelled FROM events WHERE id = $1', [id]);
      expect(event.cancelled === true).toBe(false);
    });

    it('ERLAUBT: Admin sagt im eigenen Jahrgang ab', async () => {
      const id = await terminAnlegen({ jahrgangId: JG_A });

      const res = await request(app)
        .put(`/api/events/${id}/cancel`)
        .set('Authorization', `Bearer ${adminMitJgToken}`)
        .send({ grund: 'Test' });

      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/events/series (Serientermine)', () => {
    // Der Kommentar in serien.js sagt selbst: "Diese Liste muss mit POST /
    // (Einzel-Event, verwaltung.js) synchron bleiben." Genau das war sie beim
    // Jahrgangs-Check zunaechst nicht — die Serie blieb ein offener Weg,
    // Termine in fremde Jahrgaenge zu legen, waehrend der Einzeltermin schon
    // gebunden war. Aufgefallen beim Nachziehen der API-Doku (14.09.2026).
    it('VERBOTEN: Serie in einem fremden Jahrgang — 403, kein Termin angelegt', async () => {
      const vorher = await db.query('SELECT COUNT(*)::int AS n FROM events WHERE organization_id = 1');

      const res = await request(app)
        .post('/api/events/series')
        .set('Authorization', `Bearer ${adminMitJgToken}`)
        .send({
          name: 'Fremde Serie',
          event_date: new Date(Date.now() + 7 * 864e5).toISOString(),
          max_participants: 10,
          jahrgang_ids: [JG_B],
          series_count: 3,
          series_interval: 'week'
        });

      expect(res.status).toBe(403);

      const nachher = await db.query('SELECT COUNT(*)::int AS n FROM events WHERE organization_id = 1');
      expect(nachher.rows[0].n).toBe(vorher.rows[0].n);
    });

    it('ERLAUBT: Serie im eigenen Jahrgang', async () => {
      const res = await request(app)
        .post('/api/events/series')
        .set('Authorization', `Bearer ${adminMitJgToken}`)
        .send({
          name: 'Eigene Serie',
          event_date: new Date(Date.now() + 7 * 864e5).toISOString(),
          max_participants: 10,
          jahrgang_ids: [JG_A],
          series_count: 2,
          series_interval: 'week'
        });

      expect(res.status).toBe(201);
    });
  });

  describe('PUT /api/events/:id (aendern)', () => {
    it('VERBOTEN: Admin aendert keinen fremden Termin — 403, Name unveraendert', async () => {
      const id = await terminAnlegen({ jahrgangId: JG_B, name: 'Unveraendert' });

      const res = await request(app)
        .put(`/api/events/${id}`)
        .set('Authorization', `Bearer ${adminMitJgToken}`)
        .send({
          name: 'Umbenannt',
          description: 'Neu',
          event_date: new Date(Date.now() + 7 * 864e5).toISOString(),
          location: 'Ort',
          max_participants: 20
        });

      expect(res.status).toBe(403);

      const { rows: [event] } = await db.query('SELECT name FROM events WHERE id = $1', [id]);
      expect(event.name).toBe('Unveraendert');
    });
  });

  describe('PUT /api/events/:id/participants/attendance-all', () => {
    // AUF ADMIN UMGESTELLT (16.09.2026): Diese beiden Faelle liefen bis dahin
    // mit teamerMitJgToken. Seit die Anwesenheit hinter requireAdmin steht,
    // wuerde eine Teamer:in hier IMMER 403 bekommen -- der "VERBOTEN"-Test
    // waere tautologisch geworden (gruen aus dem falschen Grund) und der
    // "ERLAUBT"-Test waere gefallen. Diese Datei prueft die JAHRGANGSGRENZE,
    // nicht die Rolle; mit dem Admin-Token tut sie das wieder, wie alle
    // Schwesterfaelle darueber. Die Rollen-Matrix steht in rbacTermine.test.js.
    it('VERBOTEN: Admin verbucht keine Anwesenheit im fremden Jahrgang — 403', async () => {
      const id = await terminAnlegen({ jahrgangId: JG_B });

      const res = await request(app)
        .put(`/api/events/${id}/participants/attendance-all`)
        .set('Authorization', `Bearer ${adminMitJgToken}`)
        .send({ status: 'present' });

      expect(res.status).toBe(403);
    });

    it('ERLAUBT: Admin verbucht im eigenen Jahrgang', async () => {
      const id = await terminAnlegen({ jahrgangId: JG_A });

      const res = await request(app)
        .put(`/api/events/${id}/participants/attendance-all`)
        .set('Authorization', `Bearer ${adminMitJgToken}`)
        .send({ status: 'present' });

      expect(res.status).toBe(200);
    });

    it('eine Teamer:in scheitert schon an der Rolle -- sogar im EIGENEN Jahrgang', async () => {
      // Der Beleg dafuer, dass die Umstellung oben noetig war und nicht nur
      // bequem: teamerMitJgToken hat can_edit auf JG_A, die Jahrgangsgrenze
      // waere also offen. Es scheitert allein an requireAdmin.
      const id = await terminAnlegen({ jahrgangId: JG_A });

      const res = await request(app)
        .put(`/api/events/${id}/participants/attendance-all`)
        .set('Authorization', `Bearer ${teamerMitJgToken}`)
        .send({ status: 'present' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Keine Berechtigung');
    });
  });

  describe('POST /api/events/:id/participants (Person eintragen)', () => {
    it('VERBOTEN: Admin traegt niemanden in einen fremden Termin ein — 403', async () => {
      const id = await terminAnlegen({ jahrgangId: JG_B });

      const res = await request(app)
        .post(`/api/events/${id}/participants`)
        .set('Authorization', `Bearer ${adminMitJgToken}`)
        .send({ user_id: USERS.konfi1.id });

      expect(res.status).toBe(403);

      const { rows } = await db.query(
        'SELECT id FROM event_bookings WHERE event_id = $1 AND user_id = $2',
        [id, USERS.konfi1.id]
      );
      expect(rows.length).toBe(0);
    });
  });

  // LESEN eines einzelnen Termins (24.09.2026). Die Liste verschweigt fremde
  // Termine seit dem 22.08./01.09.2026, die Schreibrouten oben pruefen seit
  // dem 14.09. -- nur GET /api/events/:id gab bis hierher JEDEN Termin der
  // Organisation heraus, samt Klarnamen der Teilnehmenden und ihren
  // Abmeldegruenden. Die API-Doku fuehrte das sogar als offenen Hinweis
  // ("Teamer: KEIN Jahrgang-Check"). Anlass, es jetzt zu schliessen: Mit der
  // App-Route /teamer/events/:id wandert die Kennung erstmals per Push-Link
  // herum -- ein Termin, den die Liste verschweigt, darf am Link nicht doch
  // aufgehen.
  describe('GET /api/events/:id (Detail lesen)', () => {
    it('VERBOTEN: Teamer:in liest keinen Termin aus fremdem Jahrgang — 403 ohne Teilnehmerliste', async () => {
      const id = await terminAnlegen({ jahrgangId: JG_B });

      const res = await request(app)
        .get(`/api/events/${id}`)
        .set('Authorization', `Bearer ${teamerMitJgToken}`);

      expect(res.status).toBe(403);
      // Dieselbe Meldung wie bei PUT/DELETE /api/events/:id, dazu der Grund
      // als error_code (25.09.2026) -- und NUR das: kein Feld des Termins,
      // keine participants[]. `error` bleibt unveraendert, die Store-Apps
      // lesen nur dieses Feld.
      expect(res.body).toEqual({
        error: 'Kein Zugriff auf diesen Termin',
        error_code: 'jahrgang_nicht_zugewiesen'
      });
    });

    it('VERBOTEN: Admin liest keinen Termin aus fremdem Jahrgang — 403', async () => {
      const id = await terminAnlegen({ jahrgangId: JG_B });

      const res = await request(app)
        .get(`/api/events/${id}`)
        .set('Authorization', `Bearer ${adminMitJgToken}`);

      expect(res.status).toBe(403);
      expect(res.body).toEqual({
        error: 'Kein Zugriff auf diesen Termin',
        error_code: 'jahrgang_nicht_zugewiesen'
      });
    });

    it('VERBOTEN: Admin OHNE Jahrgang, selbst am Termin eingetragen — 403 mit Grund (Simons Fall)', async () => {
      // Simon (25.09.2026): "Konkret fuege ich einen Admin zu einem
      // Jahrgangstermin hinzu, und der Admin selbst hat keinen Jahrgang.
      // Kriegt er einen Push, er klickt auf den Push und kommt dann aber
      // nicht auf das Event." Die eigene Buchung aendert an der Regel
      // nichts -- sie prueft die Jahrgangszuweisung, nicht die Teilnahme.
      // Der error_code ist das, woran die App die Erklaerung festmacht.
      const ADMIN_OHNE_JG = 403;
      await db.query(
        `INSERT INTO users (id, username, password_hash, display_name, role_id, organization_id, is_active)
         VALUES ($1, 'ev_admin_ohne', 'x', 'EV Admin ohne Jahrgang', 3, 1, true)`,
        [ADMIN_OHNE_JG]
      );
      require('../../middleware/rbac').invalidateUserCache(ADMIN_OHNE_JG);
      const id = await terminAnlegen({ jahrgangId: JG_B });
      await db.query(
        `INSERT INTO event_bookings (user_id, event_id, status, organization_id)
         VALUES ($1, $2, 'confirmed', 1)`,
        [ADMIN_OHNE_JG, id]
      );

      const res = await request(app)
        .get(`/api/events/${id}`)
        .set('Authorization', `Bearer ${tokenFuer(ADMIN_OHNE_JG, 3)}`);

      expect(res.status).toBe(403);
      expect(res.body).toEqual({
        error: 'Kein Zugriff auf diesen Termin',
        error_code: 'jahrgang_nicht_zugewiesen'
      });
    });

    it('ERLAUBT: Teamer:in liest im eigenen Jahrgang — 200 mit Teilnehmerliste', async () => {
      const id = await terminAnlegen({ jahrgangId: JG_A });

      const res = await request(app)
        .get(`/api/events/${id}`)
        .set('Authorization', `Bearer ${teamerMitJgToken}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(id);
      expect(res.body.name).toBe('Testtermin');
      // Teamer:innen bekommen die Teilnehmerliste weiterhin (nur Konfis nicht).
      expect(Array.isArray(res.body.participants)).toBe(true);
    });

    it('ERLAUBT: allgemeiner Termin ohne Jahrgang — 200 fuer Teamer:in und Admin', async () => {
      const id = await terminAnlegen();

      for (const token of [teamerMitJgToken, adminMitJgToken]) {
        const res = await request(app)
          .get(`/api/events/${id}`)
          .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.id).toBe(id);
      }
    });

    it('ERLAUBT: reiner Teamer-Termin an fremdem Jahrgang — 200 (Ausnahme der Regel)', async () => {
      const id = await terminAnlegen({ jahrgangId: JG_B, teamerOnly: true });

      const res = await request(app)
        .get(`/api/events/${id}`)
        .set('Authorization', `Bearer ${teamerMitJgToken}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(id);
      expect(res.body.teamer_only).toBe(true);
    });

    it('REGRESSION: org_admin liest in JEDEM Jahrgang — 200', async () => {
      const id = await terminAnlegen({ jahrgangId: JG_B });

      const res = await request(app)
        .get(`/api/events/${id}`)
        .set('Authorization', `Bearer ${orgAdminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.id).toBe(id);
    });

    it('unbekannte Kennung bleibt 404 — die Jahrgangspruefung kommt erst danach', async () => {
      const res = await request(app)
        .get('/api/events/999999')
        .set('Authorization', `Bearer ${teamerMitJgToken}`);

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Event nicht gefunden' });
    });
  });
});
