// Zwei Befunde aus Simons TestFlight-Lauf (13.09.2026).
//
// EINS -- Selbstabmeldung bearbeiten: "wenn die sich selbst abgemeldet haben
// kann ich deren Status nicht ändern. Kein Action Sheet." Gemeint ist eine
// Konfi, die sich per Opt-out von einem Pflichttermin abgemeldet hat
// (status='opted_out') und dann doch kam. Die Sperre sass im Frontend; das
// Backend prueft den Buchungsstatus gar nicht. Diese Suite haelt fest, dass es
// ihn weiterhin nicht prueft -- sonst faellt die Bedienung wieder aus, ohne
// dass es jemand merkt.
//
// ZWEI -- Urheber (Migration 148): "vielleicht wäre es noch gut zu wissen wer
// den Eintrag gemacht hat." attendance_set_by/_at werden beim Verbuchen
// mitgeschrieben. NULL heisst UNBEKANNT, nicht NIEMAND: Bestandszeilen und
// Selbst-Check-ins per QR-Code haben keinen Urheber.
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, JAHRGAENGE } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

describe('Selbstabmeldung nachtraeglich verbuchen und Urheber mitschreiben', () => {
  let app;
  let db;
  let adminToken;
  // ZWEITE HANDELNDE PERSON: bis zum 16.09.2026 war das eine Teamer:in.
  // Seit die Anwesenheit hinter requireAdmin steht, bekaeme sie hier 403 --
  // und diese Tests pruefen nicht die Rolle, sondern WER ZULETZT GEAENDERT
  // HAT. Deshalb ist "Person B" jetzt ein zweiter Admin (orgAdmin1). Die
  // Rollen-Matrix zur Anwesenheit steht in rbacTermine.test.js.
  let zweiterAdminToken;
  let konfiToken;

  beforeAll(async () => {
    db = getTestPool();
    app = getTestApp(db);
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    adminToken = generateToken('admin1');
    zweiterAdminToken = generateToken('orgAdmin1');
    konfiToken = generateToken('konfi1');
    await db.query(
      'INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id, can_view, can_edit) VALUES ($1, $2, true, true)',
      [USERS.admin1.id, JAHRGAENGE.jahrgang1.id]
    );
    require('../../middleware/rbac').invalidateUserCache(USERS.admin1.id);
  });

  afterAll(async () => {
    await closePool();
  });

  // Pflichttermin: nur dort ist die Selbstabmeldung ueberhaupt moeglich
  // (routes/konfi.js: "Opt-out nur bei Pflicht-Events moeglich"). Pflicht
  // heisst zugleich: keine Event-Punkte -- der Punkte-Zweig verlangt
  // !mandatory. Genau deshalb kann das nachtraegliche Verbuchen hier keine
  // Punkte ausloesen.
  async function setupPflichtterminMitAbmeldung({ points = 5 } = {}) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 14);
    const createRes = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Pflichttermin',
        event_date: futureDate.toISOString(),
        max_participants: 10,
        points,
        point_type: 'gemeinde',
        mandatory: true,
        // Ein Pflichttermin ohne Jahrgang wird mit 400 abgewiesen.
        jahrgang_ids: [JAHRGAENGE.jahrgang1.id],
      });
    expect(createRes.status).toBe(201);
    const eventId = createRes.body.id;

    await request(app).post(`/api/events/${eventId}/book`).set('Authorization', `Bearer ${konfiToken}`);

    const optOutRes = await request(app)
      .post(`/api/konfi/events/${eventId}/opt-out`)
      .set('Authorization', `Bearer ${konfiToken}`)
      .send({ reason: 'Familienfeier an dem Tag' });
    expect(optOutRes.status).toBe(200);

    const { rows: [booking] } = await db.query(
      'SELECT id, status FROM event_bookings WHERE event_id = $1 AND user_id = $2',
      [eventId, USERS.konfi1.id]
    );
    expect(booking.status).toBe('opted_out');
    return { eventId, bookingId: booking.id };
  }

  // Freiwilliger Termin mit Punkten -- fuer die Urheber-Faelle, in denen
  // Punkte fliessen sollen.
  async function setupFreiwilligerTermin({ points = 5 } = {}) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 14);
    const createRes = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Freiwilliger Termin',
        event_date: futureDate.toISOString(),
        max_participants: 10,
        points,
        point_type: 'gemeinde',
      });
    const eventId = createRes.body.id;
    await request(app).post(`/api/events/${eventId}/book`).set('Authorization', `Bearer ${konfiToken}`);
    const { rows: [booking] } = await db.query(
      'SELECT id FROM event_bookings WHERE event_id = $1 AND user_id = $2',
      [eventId, USERS.konfi1.id]
    );
    return { eventId, bookingId: booking.id };
  }

  const buchung = async (bookingId) => {
    const { rows } = await db.query(
      `SELECT status, attendance_status, excuse_reason, attendance_note,
              attendance_set_by, attendance_set_at, note_set_by, note_set_at
         FROM event_bookings WHERE id = $1`,
      [bookingId]
    );
    return rows[0];
  };

  describe('Eine Selbstabmeldung laesst sich verbuchen', () => {
    it('doch anwesend: der Anwesenheits-Status wird gesetzt', async () => {
      const { eventId, bookingId } = await setupPflichtterminMitAbmeldung();
      const res = await request(app)
        .put(`/api/events/${eventId}/participants/${bookingId}/attendance`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ attendance_status: 'present' });

      expect(res.status).toBe(200);
      expect((await buchung(bookingId)).attendance_status).toBe('present');
    });

    it('der BUCHUNGSSTATUS bleibt opted_out -- die Abmeldung wird nicht umgeschrieben', async () => {
      // Bewusst so: Die Selbstabmeldung hat stattgefunden, sie ist die
      // Vorgeschichte des Eintrags. Die Anzeige richtet sich nach dem
      // Anwesenheits-Status, sobald einer gesetzt ist (getZellStatus,
      // renderParticipant); der Buchungsstatus erklaert weiterhin, warum
      // ueberhaupt jemand nachtragen musste.
      const { eventId, bookingId } = await setupPflichtterminMitAbmeldung();
      await request(app)
        .put(`/api/events/${eventId}/participants/${bookingId}/attendance`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ attendance_status: 'present' });

      const b = await buchung(bookingId);
      expect(b.status).toBe('opted_out');
      expect(b.attendance_status).toBe('present');
    });

    it('der Absagegrund der Konfi bleibt erhalten', async () => {
      const { eventId, bookingId } = await setupPflichtterminMitAbmeldung();
      await request(app)
        .put(`/api/events/${eventId}/participants/${bookingId}/attendance`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ attendance_status: 'present' });

      const { rows: [b] } = await db.query('SELECT opt_out_reason FROM event_bookings WHERE id = $1', [bookingId]);
      expect(b.opt_out_reason).toBe('Familienfeier an dem Tag');
    });

    it('auch abgemeldet (nachgetragen) und eine Notiz gehen', async () => {
      // Simon: "Doch anwesend. Vermerk etc." -- das volle Menue, nicht nur
      // anwesend.
      const { eventId, bookingId } = await setupPflichtterminMitAbmeldung();
      await request(app)
        .put(`/api/events/${eventId}/participants/${bookingId}/attendance`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ attendance_status: 'excused', excuse_reason: 'krank gemeldet', attendance_note: 'Mutter rief an' });

      const b = await buchung(bookingId);
      expect(b.attendance_status).toBe('excused');
      expect(b.excuse_reason).toBe('krank gemeldet');
      expect(b.attendance_note).toBe('Mutter rief an');
    });

    it('KEINE Punkte -- die Selbstabmeldung gibt es nur an Pflichtterminen, und die vergeben keine', async () => {
      // Der Punkte-Zweig verlangt !mandatory. Ein Pflichttermin vergibt auch
      // dann keine Event-Punkte, wenn points > 0 gesetzt ist; gezaehlt wird
      // er ueber die Pflicht-Quote. Das nachtraegliche Verbuchen einer
      // Selbstabmeldung kann deshalb keine Punkte ausloesen.
      const { eventId, bookingId } = await setupPflichtterminMitAbmeldung({ points: 5 });
      await request(app)
        .put(`/api/events/${eventId}/participants/${bookingId}/attendance`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ attendance_status: 'present' });

      const { rows } = await db.query(
        'SELECT points FROM event_points WHERE event_id = $1 AND konfi_id = $2',
        [eventId, USERS.konfi1.id]
      );
      expect(rows).toEqual([]);
      const { rows: [profil] } = await db.query(
        'SELECT gemeinde_points FROM konfi_profiles WHERE user_id = $1',
        [USERS.konfi1.id]
      );
      expect(profil.gemeinde_points).toBe(0);
    });

    it('"Alle verbuchen" fasst eine Selbstabmeldung weiterhin NICHT an', async () => {
      // Gegenprobe zur Einzelbearbeitung: Der Sammelweg verbucht nur
      // status='confirmed'. Eine Abmeldung muss eine ausdrueckliche
      // Entscheidung bleiben, kein Nebenprodukt eines Knopfdrucks.
      const { eventId, bookingId } = await setupPflichtterminMitAbmeldung();
      const res = await request(app)
        .put(`/api/events/${eventId}/participants/attendance-all`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ rolle: 'konfi' });

      expect(res.status).toBe(200);
      const b = await buchung(bookingId);
      expect(b.attendance_status).toBeNull();
      expect(b.attendance_set_by).toBeNull();
    });
  });

  describe('Urheber: wer hat den Eintrag gemacht', () => {
    it('die Einzel-Verbuchung schreibt Person und Zeitpunkt mit', async () => {
      const { eventId, bookingId } = await setupFreiwilligerTermin();
      const vorher = new Date();
      await request(app)
        .put(`/api/events/${eventId}/participants/${bookingId}/attendance`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ attendance_status: 'present' });

      const b = await buchung(bookingId);
      expect(b.attendance_set_by).toBe(USERS.admin1.id);
      expect(b.attendance_set_at).not.toBeNull();
      expect(new Date(b.attendance_set_at).getTime()).toBeGreaterThanOrEqual(vorher.getTime() - 2000);
    });

    it('wer zuletzt geaendert hat, steht drin -- nicht wer zuerst verbucht hat', async () => {
      // Die Anwesenheit ist aenderbar. Festgehalten wird der Stand, der jetzt
      // dasteht: die Person, bei der man nachfragt.
      const { eventId, bookingId } = await setupFreiwilligerTermin();
      await request(app)
        .put(`/api/events/${eventId}/participants/${bookingId}/attendance`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ attendance_status: 'absent' });
      expect((await buchung(bookingId)).attendance_set_by).toBe(USERS.admin1.id);

      await request(app)
        .put(`/api/events/${eventId}/participants/${bookingId}/attendance`)
        .set('Authorization', `Bearer ${zweiterAdminToken}`)
        .send({ attendance_status: 'present' });

      const b = await buchung(bookingId);
      expect(b.attendance_set_by).toBe(USERS.orgAdmin1.id);
      expect(b.attendance_status).toBe('present');
    });

    it('eine reine Notiz laesst den Urheber des Status in Ruhe', async () => {
      // UMENTSCHIEDEN am 13.09.2026 (Migration 149). Bis dahin galt hier das
      // Gegenteil: "es ist derselbe Eintrag", also setzte auch eine reine
      // Notiz den einen Urheber neu.
      //
      // Simons Rueckfrage entkraeftete die Annahme: "Was ist wenn einer einen
      // Vermerk schreibt und einer den Grund. Wie wird das angezeigt." Gar
      // nicht -- wer zuletzt schrieb, ueberschrieb den anderen, und die Zeile
      // behauptete, er habe beides eingetragen. Es sind eben ZWEI Eintraege.
      // Seither hat die Notiz ihr eigenes Paar (note_set_by/_at); die
      // ausfuehrliche Abdeckung steht in
      // anwesenheitNotizLoeschenUndUrheber.test.js.
      const { eventId, bookingId } = await setupFreiwilligerTermin();
      await request(app)
        .put(`/api/events/${eventId}/participants/${bookingId}/attendance`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ attendance_status: 'present' });

      await request(app)
        .put(`/api/events/${eventId}/participants/${bookingId}/attendance`)
        .set('Authorization', `Bearer ${zweiterAdminToken}`)
        .send({ attendance_status: 'present', attendance_note: 'ging um 14 Uhr' });

      const b = await buchung(bookingId);
      expect(b.attendance_set_by).toBe(USERS.admin1.id);
      expect(b.note_set_by).toBe(USERS.orgAdmin1.id);
      expect(b.attendance_note).toBe('ging um 14 Uhr');
    });

    it('die Sammel-Verbuchung schreibt denselben Urheber -- sie ist eine Entscheidung der Leitung', async () => {
      const { eventId, bookingId } = await setupFreiwilligerTermin();
      const res = await request(app)
        .put(`/api/events/${eventId}/participants/attendance-all`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ rolle: 'konfi' });

      expect(res.status).toBe(200);
      const b = await buchung(bookingId);
      expect(b.attendance_status).toBe('present');
      expect(b.attendance_set_by).toBe(USERS.admin1.id);
      expect(b.attendance_set_at).not.toBeNull();
    });

    it('der QR-Check-in setzt KEINEN Urheber -- die Konfi checkt sich selbst ein', async () => {
      // Gegenprobe zum erlaubten Fall: "Eingetragen von Emilia" laese sich in
      // der Teilnehmerliste wie eine Leitungsentscheidung. Die Spalte
      // beantwortet "wer von uns hat das eingetragen"; darauf hat ein
      // Selbst-Check-in keine Antwort und bleibt NULL.
      const { eventId, bookingId } = await setupFreiwilligerTermin();
      const qrRes = await request(app)
        .post(`/api/events/${eventId}/generate-qr`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(qrRes.status).toBe(200);

      // Der Check-in laeuft nur im Zeitfenster um event_date herum.
      await db.query("UPDATE events SET event_date = NOW() WHERE id = $1", [eventId]);

      const res = await request(app)
        .post('/api/events/qr-checkin')
        .set('Authorization', `Bearer ${konfiToken}`)
        .send({ token: qrRes.body.qr_token });

      expect(res.status).toBe(200);
      const b = await buchung(bookingId);
      expect(b.attendance_status).toBe('present');
      expect(b.attendance_set_by).toBeNull();
      expect(b.attendance_set_at).toBeNull();
    });

    it('die Teilnehmerliste liefert den Namen des Urhebers mit', async () => {
      const { eventId, bookingId } = await setupFreiwilligerTermin();
      await request(app)
        .put(`/api/events/${eventId}/participants/${bookingId}/attendance`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ attendance_status: 'present' });

      const res = await request(app)
        .get(`/api/events/${eventId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const teilnehmer = res.body.participants.find(p => p.id === bookingId);
      expect(teilnehmer.attendance_set_by).toBe(USERS.admin1.id);
      expect(teilnehmer.attendance_set_by_name).toBe(USERS.admin1.display_name);
      expect(teilnehmer.attendance_set_at).not.toBeNull();
    });

    it('ohne Urheber bleibt das Feld null statt zu raten -- und die Buchung faellt nicht aus der Liste', async () => {
      // Bestandszeilen von vor Migration 148. Der JOIN auf users muss ein
      // LEFT JOIN sein, sonst verschwaende genau diese Buchung.
      const { eventId, bookingId } = await setupFreiwilligerTermin();
      await db.query(
        "UPDATE event_bookings SET attendance_status = 'present', attendance_set_by = NULL, attendance_set_at = NULL WHERE id = $1",
        [bookingId]
      );

      const res = await request(app)
        .get(`/api/events/${eventId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      const teilnehmer = res.body.participants.find(p => p.id === bookingId);
      expect(teilnehmer).toBeDefined();
      expect(teilnehmer.attendance_status).toBe('present');
      expect(teilnehmer.attendance_set_by).toBeNull();
      expect(teilnehmer.attendance_set_by_name).toBeNull();
    });
  });
});
