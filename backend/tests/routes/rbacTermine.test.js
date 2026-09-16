// TERMINVERWALTUNG IST LEITUNGSSACHE: 403 fuer Teamer:innen (16.09.2026)
//
// Simons Entscheidung, woertlich:
//   "teamer erstellen keine veranstaltungen fertig. das machen admins und org
//    admins. das ist einfach nicht der weg. ich halte das fuer zu komplex.
//    lass es uns rausnehmen. also auch nicht loeschen und absagen"
// Auf Rueckfrage: Gesperrt wird in BEIDEN Ebenen -- Oberflaeche UND Backend.
//
// EINORDNUNG: Am Vormittag desselben Tages war die Teamer-Absage gebaut
// worden (Oberflaeche und Tests). Das hier nimmt sie zurueck. Es ist keine
// Fehlkorrektur, sondern eine geaenderte Anforderung -- deshalb steht sie
// hier mit Datum und Wortlaut, damit in einem halben Jahr niemand raet.
//
// BEIDE FAELLE, wie es die Regel fuer Sicherheitsfixes verlangt: Zu jeder
// umgestellten Route steht hier der VERBOTENE Fall (Teamer:in -> 403) und der
// ERLAUBTE (Admin -> 200/201). Ein Test, der nur das Verbot prueft, wuerde
// auch dann gruen bleiben, wenn die Route versehentlich fuer alle zu waere.
//
// Vorher: requireTeamer (org_admin, admin, teamer).
// Jetzt:  requireAdmin  (org_admin, admin).
//
// NICHT umgestellt und hier ebenfalls geprueft, damit die Sperre nicht
// weiter greift als beabsichtigt:
//   POST /events/:id/generate-qr und GET /events/:id/attendance-count
//     -- das Team zeigt den QR-Code zum Einchecken.
//   GET /events/cancelled -- abgesagte Termine SEHEN darf das Team.
//   POST /teamer/events/:id/zusage -- die eigene Teilnahme.
//
// GEGENPROBE (durchgefuehrt am 16.09.2026): Setzt man in
// routes/events/{verwaltung,serien,teilnehmer,anwesenheit}.js requireAdmin
// wieder auf requireTeamer zurueck, fallen alle "403"-Faelle dieser Datei --
// sie antworten dann mit 200/201/404 statt 403. Die "erlaubt"-Faelle bleiben
// gruen. Ein gruener Test, der den Fehlerfall nicht erreicht, beweist nichts.
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, JAHRGAENGE } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

describe('Terminverwaltung: nur org_admin und admin', () => {
  let app;
  let db;
  let adminToken;
  let orgAdminToken;
  let teamerToken;

  beforeAll(() => {
    db = getTestPool();
    app = getTestApp(db);
  });

  afterAll(async () => {
    await closePool();
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    adminToken = generateToken('admin1');
    orgAdminToken = generateToken('orgAdmin1');
    teamerToken = generateToken('teamer1');

    // ALLE DREI bekommen den Jahrgang MIT Schreibrecht -- auch die Teamer:in.
    //
    // Das ist der Kern dieser Datei: Die 403 muss aus der ROLLE kommen, nicht
    // aus der Jahrgangsbindung. Ohne can_edit fuer teamer1 antworteten
    // PUT /events/:id und POST /events/series mit "Kein Zugriff auf diesen
    // Jahrgang" -- ebenfalls 403, aber aus einem ganz anderen Grund. Die
    // Gegenprobe (Sperre zurueckdrehen) liess genau diese zwei Tests gruen,
    // weil sie den Fehlerfall nie erreichten. Deshalb hier das Schreibrecht
    // UND unten die Pruefung auf den Fehlertext.
    // teamer1 hat die Zuweisung schon aus dem Seed (ohne can_edit), deshalb
    // ein Upsert statt eines blanken INSERT.
    await db.query(
      `INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id, can_view, can_edit)
       VALUES ($1, $4, true, true), ($2, $4, true, true), ($3, $4, true, true)
       ON CONFLICT (user_id, jahrgang_id)
       DO UPDATE SET can_view = true, can_edit = true`,
      [USERS.admin1.id, USERS.orgAdmin1.id, USERS.teamer1.id, JAHRGAENGE.jahrgang1.id]
    );
    const { invalidateUserCache } = require('../../middleware/rbac');
    [USERS.admin1.id, USERS.orgAdmin1.id, USERS.teamer1.id].forEach(invalidateUserCache);
  });

  // --------------------------------------------------------------
  // Hilfen
  // --------------------------------------------------------------

  const inZweiWochen = () => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString();
  };

  const terminKoerper = (name = 'Konfifreizeit') => ({
    name,
    event_date: inZweiWochen(),
    max_participants: 10,
    points: 0,
    jahrgang_ids: [JAHRGAENGE.jahrgang1.id],
  });

  /** Legt einen Termin als admin1 an und liefert seine id. */
  async function termin(name = 'Konfifreizeit') {
    const res = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(terminKoerper(name));
    expect(res.status).toBe(201);
    return res.body.id;
  }

  /** Meldet konfi1 an und liefert die Buchungs-ID (eb.id, NICHT die User-ID). */
  async function buchungVon(eventId, userKey = 'konfi1') {
    const res = await request(app)
      .post(`/api/events/${eventId}/participants`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ user_id: USERS[userKey].id });
    expect(res.status).toBe(201);
    const { rows } = await db.query(
      'SELECT id FROM event_bookings WHERE event_id = $1 AND user_id = $2',
      [eventId, USERS[userKey].id]
    );
    expect(rows).toHaveLength(1);
    return rows[0].id;
  }

  const alsTeamer = (r) => r.set('Authorization', `Bearer ${teamerToken}`);
  const alsAdmin = (r) => r.set('Authorization', `Bearer ${adminToken}`);
  const alsOrgAdmin = (r) => r.set('Authorization', `Bearer ${orgAdminToken}`);

  // --------------------------------------------------------------
  // Anlegen, Bearbeiten, Loeschen
  // --------------------------------------------------------------

  describe('POST /api/events -- Termin anlegen', () => {
    it('VERBOTEN: eine Teamer:in bekommt 403', async () => {
      const res = await alsTeamer(request(app).post('/api/events')).send(terminKoerper('Von Teamer'));
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Keine Berechtigung');
    });

    it('und es entsteht wirklich kein Termin', async () => {
      // Ohne diese Zeile wuerde der Test auch dann gruen bleiben, wenn die
      // Route den Termin anlegt und danach 403 antwortet.
      await alsTeamer(request(app).post('/api/events')).send(terminKoerper('Von Teamer'));
      const { rows } = await db.query("SELECT id FROM events WHERE name = 'Von Teamer'");
      expect(rows).toHaveLength(0);
    });

    it('ERLAUBT: ein Admin bekommt 201', async () => {
      const res = await alsAdmin(request(app).post('/api/events')).send(terminKoerper('Von Admin'));
      expect(res.status).toBe(201);
      expect(res.body.id).toBeGreaterThan(0);
    });

    it('ERLAUBT: ein Org-Admin bekommt 201', async () => {
      const res = await alsOrgAdmin(request(app).post('/api/events')).send(terminKoerper('Von OrgAdmin'));
      expect(res.status).toBe(201);
    });
  });

  describe('PUT /api/events/:id -- Termin bearbeiten', () => {
    it('VERBOTEN: eine Teamer:in bekommt 403, der Name bleibt', async () => {
      const id = await termin('Urspruenglich');
      const res = await alsTeamer(request(app).put(`/api/events/${id}`))
        .send({ ...terminKoerper('Umbenannt durch Teamer'), event_date: inZweiWochen() });
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Keine Berechtigung');

      const { rows } = await db.query('SELECT name FROM events WHERE id = $1', [id]);
      expect(rows[0].name).toBe('Urspruenglich');
    });

    it('ERLAUBT: ein Admin bekommt 200 und der Name aendert sich', async () => {
      const id = await termin('Urspruenglich');
      const res = await alsAdmin(request(app).put(`/api/events/${id}`))
        .send({ ...terminKoerper('Umbenannt durch Admin'), event_date: inZweiWochen() });
      expect(res.status).toBe(200);

      const { rows } = await db.query('SELECT name FROM events WHERE id = $1', [id]);
      expect(rows[0].name).toBe('Umbenannt durch Admin');
    });
  });

  describe('DELETE /api/events/:id -- Termin loeschen', () => {
    it('VERBOTEN: eine Teamer:in bekommt 403, der Termin steht noch', async () => {
      // Bis zum 16.09.2026 stand hier das Gegenteil (events.test.js:
      // "Teamer:in darf loeschen (bewusste Designentscheidung, 26.08.2026)").
      const id = await termin();
      const res = await alsTeamer(request(app).delete(`/api/events/${id}`));
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Keine Berechtigung');

      const { rows } = await db.query('SELECT id FROM events WHERE id = $1', [id]);
      expect(rows).toHaveLength(1);
    });

    it('ERLAUBT: ein Admin bekommt 200 und der Termin ist weg', async () => {
      const id = await termin();
      const res = await alsAdmin(request(app).delete(`/api/events/${id}`));
      expect(res.status).toBe(200);

      const { rows } = await db.query('SELECT id FROM events WHERE id = $1', [id]);
      expect(rows).toHaveLength(0);
    });
  });

  // --------------------------------------------------------------
  // Absagen, Absagegrund, Reaktivieren
  // --------------------------------------------------------------

  describe('PUT /api/events/:id/cancel -- Termin absagen', () => {
    it('VERBOTEN: eine Teamer:in bekommt 403, der Termin bleibt aktiv', async () => {
      const id = await termin();
      const res = await alsTeamer(request(app).put(`/api/events/${id}/cancel`))
        .send({ cancelled_reason: 'Heizung defekt' });
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Keine Berechtigung');

      const { rows } = await db.query('SELECT cancelled, cancelled_reason FROM events WHERE id = $1', [id]);
      expect(rows[0].cancelled).toBe(false);
      expect(rows[0].cancelled_reason).toBeNull();
    });

    it('ERLAUBT: ein Admin bekommt 200 und der Termin ist abgesagt', async () => {
      const id = await termin();
      const res = await alsAdmin(request(app).put(`/api/events/${id}/cancel`))
        .send({ cancelled_reason: 'Heizung defekt' });
      expect(res.status).toBe(200);

      const { rows } = await db.query('SELECT cancelled, cancelled_reason FROM events WHERE id = $1', [id]);
      expect(rows[0].cancelled).toBe(true);
      expect(rows[0].cancelled_reason).toBe('Heizung defekt');
    });
  });

  describe('PUT /api/events/:id/absagegrund -- Grund nachtragen', () => {
    it('VERBOTEN: eine Teamer:in bekommt 403, der Grund bleibt stehen', async () => {
      const id = await termin();
      await alsAdmin(request(app).put(`/api/events/${id}/cancel`)).send({ cancelled_reason: 'Erster Grund' });

      const res = await alsTeamer(request(app).put(`/api/events/${id}/absagegrund`))
        .send({ cancelled_reason: 'Vom Teamer geaendert' });
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Keine Berechtigung');

      const { rows } = await db.query('SELECT cancelled_reason FROM events WHERE id = $1', [id]);
      expect(rows[0].cancelled_reason).toBe('Erster Grund');
    });

    it('ERLAUBT: ein Admin bekommt 200 und der Grund aendert sich', async () => {
      const id = await termin();
      await alsAdmin(request(app).put(`/api/events/${id}/cancel`)).send({ cancelled_reason: 'Erster Grund' });

      const res = await alsAdmin(request(app).put(`/api/events/${id}/absagegrund`))
        .send({ cancelled_reason: 'Zweiter Grund' });
      expect(res.status).toBe(200);

      const { rows } = await db.query('SELECT cancelled_reason FROM events WHERE id = $1', [id]);
      expect(rows[0].cancelled_reason).toBe('Zweiter Grund');
    });
  });

  describe('PUT /api/events/:id/reaktivieren -- Absage zuruecknehmen', () => {
    it('VERBOTEN: eine Teamer:in bekommt 403, der Termin bleibt abgesagt', async () => {
      const id = await termin();
      await alsAdmin(request(app).put(`/api/events/${id}/cancel`)).send({ cancelled_reason: 'Heizung defekt' });

      const res = await alsTeamer(request(app).put(`/api/events/${id}/reaktivieren`)).send({});
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Keine Berechtigung');

      const { rows } = await db.query('SELECT cancelled FROM events WHERE id = $1', [id]);
      expect(rows[0].cancelled).toBe(true);
    });

    it('ERLAUBT: ein Admin bekommt 200 und der Termin findet wieder statt', async () => {
      const id = await termin();
      await alsAdmin(request(app).put(`/api/events/${id}/cancel`)).send({ cancelled_reason: 'Heizung defekt' });

      const res = await alsAdmin(request(app).put(`/api/events/${id}/reaktivieren`)).send({});
      expect(res.status).toBe(200);

      const { rows } = await db.query('SELECT cancelled FROM events WHERE id = $1', [id]);
      expect(rows[0].cancelled).toBe(false);
    });
  });

  // --------------------------------------------------------------
  // Serien
  // --------------------------------------------------------------

  describe('POST /api/events/series -- Serie anlegen', () => {
    const serie = () => ({
      ...terminKoerper('Serienabend'),
      series_count: 3,
      // Erlaubt sind day/week/2weeks/month (serien.js). 'weekly' waere ein 400
      // und der Test haette die Rolle gar nicht mehr erreicht.
      series_interval: 'week',
    });

    it('VERBOTEN: eine Teamer:in bekommt 403, es entsteht kein Termin', async () => {
      const res = await alsTeamer(request(app).post('/api/events/series')).send(serie());
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Keine Berechtigung');

      const { rows } = await db.query("SELECT id FROM events WHERE name LIKE 'Serienabend%'");
      expect(rows).toHaveLength(0);
    });

    it('ERLAUBT: ein Admin bekommt 201 und es entstehen drei Termine', async () => {
      const res = await alsAdmin(request(app).post('/api/events/series')).send(serie());
      expect(res.status).toBe(201);

      const { rows } = await db.query("SELECT id FROM events WHERE name LIKE 'Serienabend%'");
      expect(rows).toHaveLength(3);
    });
  });

  // --------------------------------------------------------------
  // Teilnehmerverwaltung
  // --------------------------------------------------------------

  describe('POST /api/events/:id/participants -- Teilnehmer:in eintragen', () => {
    it('VERBOTEN: eine Teamer:in bekommt 403, niemand wird eingetragen', async () => {
      const id = await termin();
      const res = await alsTeamer(request(app).post(`/api/events/${id}/participants`))
        .send({ user_id: USERS.konfi1.id });
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Keine Berechtigung');

      const { rows } = await db.query('SELECT id FROM event_bookings WHERE event_id = $1', [id]);
      expect(rows).toHaveLength(0);
    });

    it('ERLAUBT: ein Admin bekommt 201 und die Buchung steht', async () => {
      const id = await termin();
      const res = await alsAdmin(request(app).post(`/api/events/${id}/participants`))
        .send({ user_id: USERS.konfi1.id });
      expect(res.status).toBe(201);

      const { rows } = await db.query('SELECT status FROM event_bookings WHERE event_id = $1', [id]);
      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe('confirmed');
    });
  });

  describe('DELETE /api/events/:id/bookings/:bookingId -- Buchung entfernen', () => {
    it('VERBOTEN: eine Teamer:in bekommt 403, die Buchung bleibt', async () => {
      const id = await termin();
      const buchungId = await buchungVon(id);

      const res = await alsTeamer(request(app).delete(`/api/events/${id}/bookings/${buchungId}`));
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Keine Berechtigung');

      const { rows } = await db.query('SELECT id FROM event_bookings WHERE id = $1', [buchungId]);
      expect(rows).toHaveLength(1);
    });

    it('ERLAUBT: ein Admin bekommt 200 und die Buchung ist weg', async () => {
      const id = await termin();
      const buchungId = await buchungVon(id);

      const res = await alsAdmin(request(app).delete(`/api/events/${id}/bookings/${buchungId}`));
      expect(res.status).toBe(200);

      const { rows } = await db.query('SELECT id FROM event_bookings WHERE id = $1', [buchungId]);
      expect(rows).toHaveLength(0);
    });
  });

  describe('PUT /api/events/:id/participants/:participantId/status -- Warteliste/bestaetigt', () => {
    it('VERBOTEN: eine Teamer:in bekommt 403, der Status bleibt confirmed', async () => {
      const id = await termin();
      const buchungId = await buchungVon(id);

      const res = await alsTeamer(request(app).put(`/api/events/${id}/participants/${buchungId}/status`))
        .send({ status: 'waitlist' });
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Keine Berechtigung');

      const { rows } = await db.query('SELECT status FROM event_bookings WHERE id = $1', [buchungId]);
      expect(rows[0].status).toBe('confirmed');
    });

    it('ERLAUBT: ein Admin bekommt 200 und der Status wechselt', async () => {
      const id = await termin();
      const buchungId = await buchungVon(id);

      const res = await alsAdmin(request(app).put(`/api/events/${id}/participants/${buchungId}/status`))
        .send({ status: 'waitlist' });
      expect(res.status).toBe(200);

      const { rows } = await db.query('SELECT status FROM event_bookings WHERE id = $1', [buchungId]);
      expect(rows[0].status).toBe('waitlist');
    });
  });

  // --------------------------------------------------------------
  // Anwesenheit
  // --------------------------------------------------------------

  describe('PUT /api/events/:id/participants/:participantId/attendance -- einzeln verbuchen', () => {
    it('VERBOTEN: eine Teamer:in bekommt 403, nichts ist verbucht', async () => {
      const id = await termin();
      const buchungId = await buchungVon(id);

      const res = await alsTeamer(request(app).put(`/api/events/${id}/participants/${buchungId}/attendance`))
        .send({ attendance_status: 'present' });
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Keine Berechtigung');

      const { rows } = await db.query('SELECT attendance_status FROM event_bookings WHERE id = $1', [buchungId]);
      expect(rows[0].attendance_status).toBeNull();
    });

    it('ERLAUBT: ein Admin bekommt 200 und die Anwesenheit steht', async () => {
      const id = await termin();
      const buchungId = await buchungVon(id);

      const res = await alsAdmin(request(app).put(`/api/events/${id}/participants/${buchungId}/attendance`))
        .send({ attendance_status: 'present' });
      expect(res.status).toBe(200);

      const { rows } = await db.query('SELECT attendance_status FROM event_bookings WHERE id = $1', [buchungId]);
      expect(rows[0].attendance_status).toBe('present');
    });
  });

  describe('PUT /api/events/:id/participants/attendance-all -- alle verbuchen', () => {
    it('VERBOTEN: eine Teamer:in bekommt 403, nichts ist verbucht', async () => {
      const id = await termin();
      const buchungId = await buchungVon(id);

      const res = await alsTeamer(request(app).put(`/api/events/${id}/participants/attendance-all`)).send({});
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Keine Berechtigung');

      const { rows } = await db.query('SELECT attendance_status FROM event_bookings WHERE id = $1', [buchungId]);
      expect(rows[0].attendance_status).toBeNull();
    });

    it('ERLAUBT: ein Admin bekommt 200 und die Anwesenheit steht', async () => {
      const id = await termin();
      const buchungId = await buchungVon(id);

      const res = await alsAdmin(request(app).put(`/api/events/${id}/participants/attendance-all`)).send({});
      expect(res.status).toBe(200);

      const { rows } = await db.query('SELECT attendance_status FROM event_bookings WHERE id = $1', [buchungId]);
      expect(rows[0].attendance_status).toBe('present');
    });
  });

  // --------------------------------------------------------------
  // Chat ANLEGEN ist Verwaltung -- Chat OEFFNEN braucht keine Route
  // --------------------------------------------------------------

  describe('POST /api/events/:id/chat -- Chatraum zum Termin anlegen', () => {
    it('VERBOTEN: eine Teamer:in bekommt 403, es entsteht kein Raum', async () => {
      const id = await termin();
      const res = await alsTeamer(request(app).post(`/api/events/${id}/chat`)).send({});
      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Keine Berechtigung');

      const { rows } = await db.query('SELECT id FROM chat_rooms WHERE event_id = $1', [id]);
      expect(rows).toHaveLength(0);
    });

    it('ERLAUBT: ein Admin bekommt 201 und der Raum steht', async () => {
      const id = await termin();
      const res = await alsAdmin(request(app).post(`/api/events/${id}/chat`)).send({});
      expect(res.status).toBe(201);

      const { rows } = await db.query('SELECT id FROM chat_rooms WHERE event_id = $1', [id]);
      expect(rows).toHaveLength(1);
    });
  });

  // --------------------------------------------------------------
  // WAS DEM TEAM BLEIBT
  //
  // Ohne diesen Block wuesste niemand, ob die Sperre zu weit greift: Ein
  // pauschales requireAdmin vor dem ganzen Router waere durch alle Tests
  // oben gekommen und haette dem Team gleichzeitig den QR-Code und die
  // eigene Zusage genommen.
  // --------------------------------------------------------------

  describe('dem Team bleibt, was ihm bleiben soll', () => {
    it('POST /api/events/:id/generate-qr -- der QR-Code zum Einchecken', async () => {
      const id = await termin();
      const res = await alsTeamer(request(app).post(`/api/events/${id}/generate-qr`)).send({});
      expect(res.status).toBe(200);
      expect(typeof res.body.qr_token).toBe('string');
      expect(res.body.qr_token.length).toBeGreaterThan(0);
    });

    it('GET /api/events/:id/attendance-count -- der Zaehler dazu', async () => {
      const id = await termin();
      const res = await alsTeamer(request(app).get(`/api/events/${id}/attendance-count`));
      expect(res.status).toBe(200);
      expect(res.body.checked_in).toBe(0);
      expect(res.body.total).toBe(0);
    });

    it('GET /api/events/cancelled -- abgesagte Termine SEHEN', async () => {
      const id = await termin('Faellt aus');
      await alsAdmin(request(app).put(`/api/events/${id}/cancel`)).send({ cancelled_reason: 'Heizung defekt' });

      const res = await alsTeamer(request(app).get('/api/events/cancelled'));
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      const eintrag = res.body.find((e) => e.id === id);
      expect(eintrag).toBeDefined();
      // Der Grund gehoert dazu: Sehen heisst auch erfahren, warum.
      expect(eintrag.cancelled_reason).toBe('Heizung defekt');
    });

    it('GET /api/events -- die Terminliste', async () => {
      const id = await termin();
      const res = await alsTeamer(request(app).get('/api/events'));
      expect(res.status).toBe(200);
      expect(res.body.some((e) => e.id === id)).toBe(true);
    });

    it('POST /api/teamer/events/:id/zusage -- die eigene Teilnahme', async () => {
      // teamer_needed muss gesetzt sein: An einem reinen Konfi-Termin gibt es
      // fuer das Team nichts zuzusagen (bookingUtils, 400).
      const angelegt = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ ...terminKoerper('Termin mit Team'), teamer_needed: true, teamer_max_participants: 5 });
      expect(angelegt.status).toBe(201);
      const id = angelegt.body.id;
      const res = await alsTeamer(request(app).post(`/api/teamer/events/${id}/zusage`))
        .send({ dabei: true });
      expect(res.status).toBe(200);

      const { rows } = await db.query(
        'SELECT status FROM event_bookings WHERE event_id = $1 AND user_id = $2',
        [id, USERS.teamer1.id]
      );
      expect(rows).toHaveLength(1);
      expect(rows[0].status).toBe('confirmed');
    });
  });

  // --------------------------------------------------------------
  // Konfis bleiben ebenfalls aussen vor -- sie waren es schon vorher.
  // --------------------------------------------------------------

  describe('ein Konfi darf weiterhin nichts davon', () => {
    it.each([
      ['POST', '/api/events'],
      ['POST', '/api/events/series'],
    ])('%s %s -> 403', async (methode, pfad) => {
      const konfiToken = generateToken('konfi1');
      const res = await request(app)[methode.toLowerCase()](pfad)
        .set('Authorization', `Bearer ${konfiToken}`)
        .send(terminKoerper('Von Konfi'));
      expect(res.status).toBe(403);
    });
  });
});
