// backend/tests/routes/buchungKern.test.js
//
// EIN Buchungskern, EINE Zaehlung (01.09.2026).
//
// Warum es diese Datei gibt: Dieselbe Handlung — "ich melde mich zu einem
// Termin an" — war zweimal vollstaendig ausformuliert:
// POST /events/:id/book und POST /konfi/events/:id/register. Beide Fassungen
// waren bereits messbar auseinandergelaufen. Die register-Fassung zaehlte
// Zeitslot-Plaetze ohne Rollen- und ohne deleted_at-Filter, sperrte den Slot
// nicht und prueft seine Gemeinde nicht.
//
// Parallel dazu zaehlten die Schreibpfade die Kapazitaet an sechs Stellen mit
// mindestens fuenf Bedeutungen, obwohl die Sicht event_booking_stats
// (Migration 136) die verbindliche festlegt:
//   konfi_*  = ausschliesslich Konfis
//   teamer_* = das TEAM-Kontingent (Teamer:innen UND zugeordnete Leitung)
//   geloeschte Konten zaehlen nie mit
//
// Diese Tests halten beides fest. Wer sie rot macht, laesst die beiden Wege
// erneut auseinanderlaufen oder aendert die Bedeutung einer Zahl.
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, EVENTS, ORGS, ROLES } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

describe('Buchungskern: beide Routen, eine Zaehlung', () => {
  let app;
  let db;
  let konfi1Token;
  let konfi2Token;
  let teamerToken;

  beforeAll(async () => {
    db = getTestPool();
    app = getTestApp(db);
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    konfi1Token = generateToken('konfi1');
    konfi2Token = generateToken('konfi2');
    teamerToken = generateToken('teamer1');
  });

  afterAll(async () => { await closePool(); });

  // Ein frischer Termin mit genau den Eigenschaften, die der Test braucht.
  const terminAnlegen = async (felder = {}) => {
    const {
      max_participants = 1,
      waitlist_enabled = false,
      max_waitlist_size = 10,
      teamer_needed = false,
      teamer_max_participants = 0,
      teamer_waitlist_enabled = false,
      has_timeslots = false,
      org_id = ORGS.testGemeinde.id,
      jahrgang_id = 1
    } = felder;
    const { rows: [e] } = await db.query(
      `INSERT INTO events
         (name, event_date, organization_id, mandatory, max_participants,
          point_type, points, has_timeslots, waitlist_enabled, max_waitlist_size,
          teamer_needed, teamer_max_participants, teamer_waitlist_enabled,
          teamer_max_waitlist_size)
       VALUES ('Kern-Termin', NOW() + interval '30 days', $1, false, $2,
               'gemeinde', 1, $3, $4, $5, $6, $7, $8, 10)
       RETURNING id`,
      [org_id, max_participants, has_timeslots, waitlist_enabled, max_waitlist_size,
       teamer_needed, teamer_max_participants, teamer_waitlist_enabled]
    );
    await db.query(
      'INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) VALUES ($1, $2)',
      [e.id, jahrgang_id]
    );
    return e.id;
  };

  const slotAnlegen = async (eventId, max) => {
    const { rows: [s] } = await db.query(
      `INSERT INTO event_timeslots (event_id, start_time, end_time, max_participants, organization_id)
       VALUES ($1, NOW() + interval '30 days', NOW() + interval '30 days' + interval '2 hours', $2, $3)
       RETURNING id`,
      [eventId, max, ORGS.testGemeinde.id]
    );
    return s.id;
  };

  const buchungenLesen = (eventId) =>
    db.query(
      `SELECT user_id, status, timeslot_id FROM event_bookings
        WHERE event_id = $1 ORDER BY user_id`,
      [eventId]
    ).then(r => r.rows);

  // ==================================================================
  // 1. Beide Routen, gleiche Ausgangslage, gleiches Ergebnis
  //    Das ist der Test gegen erneutes Auseinanderlaufen.
  // ==================================================================
  describe('Beide Routen entscheiden gleich', () => {
    // Jeder Fall wird zweimal gespielt: einmal ueber /events/:id/book,
    // einmal ueber /konfi/events/:id/register. Verglichen wird die
    // fachliche Entscheidung (HTTP-Status, Buchungsstatus), nicht die
    // Huelle — die ist bei beiden Routen bewusst verschieden.
    const ueberBook = (eventId, token, body) =>
      request(app).post(`/api/events/${eventId}/book`)
        .set('Authorization', `Bearer ${token}`).send(body || {});
    const ueberRegister = (eventId, token, body) =>
      request(app).post(`/api/konfi/events/${eventId}/register`)
        .set('Authorization', `Bearer ${token}`).send(body || {});

    it('freier Platz: beide bestaetigen', async () => {
      const a = await terminAnlegen({ max_participants: 5 });
      const b = await terminAnlegen({ max_participants: 5 });

      const rBook = await ueberBook(a, konfi1Token);
      const rReg = await ueberRegister(b, konfi1Token);

      expect(rBook.status).toBe(201);
      expect(rReg.status).toBe(200);
      expect(rBook.body.status).toBe('confirmed');
      expect(rReg.body.status).toBe('confirmed');
    });

    it('voll ohne Warteliste: beide lehnen mit 400 und derselben Meldung ab', async () => {
      const a = await terminAnlegen({ max_participants: 1 });
      const b = await terminAnlegen({ max_participants: 1 });
      await ueberBook(a, konfi1Token);
      await ueberRegister(b, konfi1Token);

      const rBook = await ueberBook(a, konfi2Token);
      const rReg = await ueberRegister(b, konfi2Token);

      expect(rBook.status).toBe(400);
      expect(rReg.status).toBe(400);
      expect(rBook.body.error).toBe('Das Event ist leider bereits ausgebucht');
      expect(rReg.body.error).toBe('Das Event ist leider bereits ausgebucht');
    });

    it('voll mit Warteliste: beide setzen auf die Warteliste', async () => {
      const a = await terminAnlegen({ max_participants: 1, waitlist_enabled: true });
      const b = await terminAnlegen({ max_participants: 1, waitlist_enabled: true });
      await ueberBook(a, konfi1Token);
      await ueberRegister(b, konfi1Token);

      const rBook = await ueberBook(a, konfi2Token);
      const rReg = await ueberRegister(b, konfi2Token);

      expect(rBook.status).toBe(201);
      expect(rReg.status).toBe(200);
      expect(rBook.body.status).toBe('waitlist');
      expect(rReg.body.status).toBe('waitlist');
    });

    it('Doppelbuchung: beide melden 409', async () => {
      const a = await terminAnlegen({ max_participants: 5 });
      const b = await terminAnlegen({ max_participants: 5 });
      await ueberBook(a, konfi1Token);
      await ueberRegister(b, konfi1Token);

      const rBook = await ueberBook(a, konfi1Token);
      const rReg = await ueberRegister(b, konfi1Token);

      expect(rBook.status).toBe(409);
      expect(rReg.status).toBe(409);
      expect(rBook.body.error).toBe('Du bist bereits für dieses Event angemeldet');
      expect(rReg.body.error).toBe('Du bist bereits für dieses Event angemeldet');
    });

    it('Zeitslot-Termin ohne Slot-Angabe: beide melden 400', async () => {
      const a = await terminAnlegen({ has_timeslots: true, max_participants: 5 });
      const b = await terminAnlegen({ has_timeslots: true, max_participants: 5 });
      await slotAnlegen(a, 5);
      await slotAnlegen(b, 5);

      const rBook = await ueberBook(a, konfi1Token);
      const rReg = await ueberRegister(b, konfi1Token);

      expect(rBook.status).toBe(400);
      expect(rReg.status).toBe(400);
    });

    it('Termin ohne Zeitslots, aber Slot mitgeschickt: beide melden 400', async () => {
      const a = await terminAnlegen({ max_participants: 5 });
      const b = await terminAnlegen({ max_participants: 5 });
      const fremderSlot = await slotAnlegen(EVENTS.timeslotEvent.id, 5);

      const rBook = await ueberBook(a, konfi1Token, { timeslot_id: fremderSlot });
      const rReg = await ueberRegister(b, konfi1Token, { timeslot_id: fremderSlot });

      expect(rBook.status).toBe(400);
      expect(rReg.status).toBe(400);
      expect(rBook.body.error).toBe('Dieses Event hat keine Zeitslots');
      expect(rReg.body.error).toBe('Dieses Event hat keine Zeitslots');
      // Und es steht nichts in der Datenbank.
      expect(await buchungenLesen(a)).toEqual([]);
      expect(await buchungenLesen(b)).toEqual([]);
    });

    it('abgesagter Termin: beide lehnen ab', async () => {
      const a = await terminAnlegen({ max_participants: 5 });
      const b = await terminAnlegen({ max_participants: 5 });
      await db.query('UPDATE events SET cancelled = true WHERE id = ANY($1)', [[a, b]]);

      const rBook = await ueberBook(a, konfi1Token);
      const rReg = await ueberRegister(b, konfi1Token);

      expect(rBook.status).toBe(400);
      expect(rReg.status).toBe(400);
      expect(rBook.body.error).toBe('Dieser Termin ist abgesagt');
      expect(rReg.body.error).toBe('Dieser Termin ist abgesagt');
    });

    it('reiner Teamer-Termin: beide lehnen die Konfi mit 403 ab', async () => {
      const a = await terminAnlegen({ max_participants: 5 });
      const b = await terminAnlegen({ max_participants: 5 });
      await db.query('UPDATE events SET teamer_only = true WHERE id = ANY($1)', [[a, b]]);

      const rBook = await ueberBook(a, konfi1Token);
      const rReg = await ueberRegister(b, konfi1Token);

      expect(rBook.status).toBe(403);
      expect(rReg.status).toBe(403);
    });

    it('Anmeldefenster geschlossen: beide melden 400 mit derselben Meldung', async () => {
      const a = await terminAnlegen({ max_participants: 5 });
      const b = await terminAnlegen({ max_participants: 5 });
      await db.query(
        "UPDATE events SET registration_closes_at = NOW() - interval '1 day' WHERE id = ANY($1)",
        [[a, b]]
      );

      const rBook = await ueberBook(a, konfi1Token);
      const rReg = await ueberRegister(b, konfi1Token);

      expect(rBook.status).toBe(400);
      expect(rReg.status).toBe(400);
      expect(rBook.body.error).toBe('Anmeldung bereits geschlossen');
      expect(rReg.body.error).toBe('Anmeldung bereits geschlossen');
    });

    it('zweiter Konfirmationstermin: beide melden 409', async () => {
      const a = await terminAnlegen({ max_participants: 5 });
      const b = await terminAnlegen({ max_participants: 5 });
      const schon = await terminAnlegen({ max_participants: 5 });
      await db.query('UPDATE events SET is_konfirmation = true WHERE id = ANY($1)',
        [[a, b, schon]]);
      await db.query(
        `INSERT INTO event_bookings (user_id, event_id, status, organization_id)
         VALUES ($1, $2, 'confirmed', 1)`,
        [USERS.konfi1.id, schon]
      );

      const rBook = await ueberBook(a, konfi1Token);
      const rReg = await ueberRegister(b, konfi1Token);

      expect(rBook.status).toBe(409);
      expect(rReg.status).toBe(409);
    });
  });

  // ==================================================================
  // 2. Antwortform: der Vertragstest
  //    Beide Huellen sind bewusst VERSCHIEDEN und muessen es bleiben.
  //    Ausgelieferte Store-Apps lesen genau diese Felder — der Vorfall
  //    vom 29.08.2026 (/teamer/badges, Array -> Objekt) darf sich nicht
  //    wiederholen.
  // ==================================================================
  describe('Antwortform beider Routen unveraendert', () => {
    it('POST /events/:id/book: 201 mit genau {id, message, status}', async () => {
      const id = await terminAnlegen({ max_participants: 5 });
      const res = await request(app)
        .post(`/api/events/${id}/book`)
        .set('Authorization', `Bearer ${konfi1Token}`)
        .send({});

      expect(res.status).toBe(201);
      expect(Object.keys(res.body).sort()).toEqual(['id', 'message', 'status']);
      expect(typeof res.body.id).toBe('number');
      expect(res.body.message).toBe('Erfolgreich angemeldet');
      expect(res.body.status).toBe('confirmed');
    });

    it('POST /events/:id/book auf der Warteliste: message unveraendert', async () => {
      const id = await terminAnlegen({ max_participants: 1, waitlist_enabled: true });
      await request(app).post(`/api/events/${id}/book`)
        .set('Authorization', `Bearer ${konfi1Token}`).send({});

      const res = await request(app).post(`/api/events/${id}/book`)
        .set('Authorization', `Bearer ${konfi2Token}`).send({});

      expect(res.status).toBe(201);
      expect(res.body.message).toBe('Auf die Warteliste gesetzt');
      expect(res.body.status).toBe('waitlist');
    });

    it('POST /konfi/events/:id/register: 200 mit genau {message, registration_id, status, timeslot_id}', async () => {
      const id = await terminAnlegen({ max_participants: 5 });
      const res = await request(app)
        .post(`/api/konfi/events/${id}/register`)
        .set('Authorization', `Bearer ${konfi1Token}`)
        .send({});

      expect(res.status).toBe(200);
      expect(Object.keys(res.body).sort())
        .toEqual(['message', 'registration_id', 'status', 'timeslot_id']);
      expect(typeof res.body.registration_id).toBe('number');
      expect(res.body.message).toBe('Erfolgreich angemeldet');
      expect(res.body.status).toBe('confirmed');
      expect(res.body.timeslot_id).toBe(null);
    });

    it('register auf der Warteliste: Platzhinweis bleibt in der Meldung', async () => {
      const id = await terminAnlegen({ max_participants: 1, waitlist_enabled: true });
      await request(app).post(`/api/konfi/events/${id}/register`)
        .set('Authorization', `Bearer ${konfi1Token}`).send({});

      const res = await request(app).post(`/api/konfi/events/${id}/register`)
        .set('Authorization', `Bearer ${konfi2Token}`).send({});

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('waitlist');
      expect(res.body.message).toBe('Auf Warteliste gesetzt (Platz 1)');
    });

    it('register mit Zeitslot: timeslot_id kommt zurueck', async () => {
      const id = await terminAnlegen({ has_timeslots: true, max_participants: 5 });
      const slot = await slotAnlegen(id, 5);

      const res = await request(app)
        .post(`/api/konfi/events/${id}/register`)
        .set('Authorization', `Bearer ${konfi1Token}`)
        .send({ timeslot_id: slot });

      expect(res.status).toBe(200);
      expect(res.body.timeslot_id).toBe(slot);
      expect(res.body.status).toBe('confirmed');
    });

    it('book behaelt error_code konfirmation_already_booked, register liefert ihn weiterhin NICHT', async () => {
      const a = await terminAnlegen({ max_participants: 5 });
      const b = await terminAnlegen({ max_participants: 5 });
      const schon = await terminAnlegen({ max_participants: 5 });
      await db.query('UPDATE events SET is_konfirmation = true WHERE id = ANY($1)',
        [[a, b, schon]]);
      await db.query(
        `INSERT INTO event_bookings (user_id, event_id, status, organization_id)
         VALUES ($1, $2, 'confirmed', 1)`,
        [USERS.konfi1.id, schon]
      );

      const rBook = await request(app).post(`/api/events/${a}/book`)
        .set('Authorization', `Bearer ${konfi1Token}`).send({});
      const rReg = await request(app).post(`/api/konfi/events/${b}/register`)
        .set('Authorization', `Bearer ${konfi1Token}`).send({});

      expect(rBook.body.error_code).toBe('konfirmation_already_booked');
      // register hat den Code nie geliefert — das bleibt so, sonst waere es
      // eine Formaenderung fuer die Konfi-App.
      expect(Object.keys(rReg.body)).toEqual(['error']);
    });

    it('Teamer-Buchung ueber book: 201 mit genau {id, message, status}', async () => {
      const id = await terminAnlegen({ teamer_needed: true, teamer_max_participants: 5 });
      const res = await request(app)
        .post(`/api/events/${id}/book`)
        .set('Authorization', `Bearer ${teamerToken}`)
        .send({});

      expect(res.status).toBe(201);
      expect(Object.keys(res.body).sort()).toEqual(['id', 'message', 'status']);
      expect(res.body.status).toBe('confirmed');
    });
  });

  // ==================================================================
  // 3. Der konkrete Drift-Fall: geloeschte Konten belegen keinen Platz
  //    Vorher zaehlte register die Zeitslot-Plaetze ganz ohne Filter —
  //    ein geloeschtes Konto machte den Slot fuer alle anderen dicht.
  // ==================================================================
  describe('Geloeschte Konten belegen keinen Platz', () => {
    const loeschen = (userId) =>
      db.query('UPDATE users SET deleted_at = NOW() WHERE id = $1', [userId]);

    it('register: geloeschte Konfi im Zeitslot blockiert den letzten Platz nicht', async () => {
      const id = await terminAnlegen({ has_timeslots: true, max_participants: 5 });
      const slot = await slotAnlegen(id, 1);
      await db.query(
        `INSERT INTO event_bookings (user_id, event_id, timeslot_id, status, organization_id)
         VALUES ($1, $2, $3, 'confirmed', 1)`,
        [USERS.konfi2.id, id, slot]
      );
      await loeschen(USERS.konfi2.id);

      const res = await request(app)
        .post(`/api/konfi/events/${id}/register`)
        .set('Authorization', `Bearer ${konfi1Token}`)
        .send({ timeslot_id: slot });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('confirmed');
    });

    it('register: geloeschte Konfi blockiert auch event-weit nicht', async () => {
      const id = await terminAnlegen({ max_participants: 1 });
      await db.query(
        `INSERT INTO event_bookings (user_id, event_id, status, organization_id)
         VALUES ($1, $2, 'confirmed', 1)`,
        [USERS.konfi2.id, id]
      );
      await loeschen(USERS.konfi2.id);

      const res = await request(app)
        .post(`/api/konfi/events/${id}/register`)
        .set('Authorization', `Bearer ${konfi1Token}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('confirmed');
    });

    it('book: geloeschte Konfi blockiert den letzten Platz nicht', async () => {
      const id = await terminAnlegen({ max_participants: 1 });
      await db.query(
        `INSERT INTO event_bookings (user_id, event_id, status, organization_id)
         VALUES ($1, $2, 'confirmed', 1)`,
        [USERS.konfi2.id, id]
      );
      await loeschen(USERS.konfi2.id);

      const res = await request(app)
        .post(`/api/events/${id}/book`)
        .set('Authorization', `Bearer ${konfi1Token}`)
        .send({});

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('confirmed');
    });

    it('Storno: eine geloeschte Buchung haelt den Nachrueckplatz nicht besetzt', async () => {
      // EIN Platz. Darauf sitzt ein geloeschtes Konto, dazu haelt konfi1 eine
      // (rechnerisch ueberzaehlige) Bestaetigung und konfi2 wartet. Meldet
      // sich konfi1 ab, ist der Termin nach alter Zaehlung weiterhin "voll" —
      // das geloeschte Konto zaehlte mit — und konfi2 rueckte nie nach.
      const id = await terminAnlegen({ max_participants: 1, waitlist_enabled: true });
      const { rows: [geloeschte] } = await db.query(
        `INSERT INTO users (username, display_name, password_hash, role_id, organization_id)
         VALUES ('geloescht1', 'Geloescht', 'x', $1, 1) RETURNING id`,
        [ROLES.konfi.id]
      );
      await db.query(
        `INSERT INTO event_bookings (user_id, event_id, status, organization_id)
         VALUES ($1, $2, 'confirmed', 1)`, [USERS.konfi1.id, id]);
      await db.query(
        `INSERT INTO event_bookings (user_id, event_id, status, organization_id)
         VALUES ($1, $2, 'confirmed', 1)`, [geloeschte.id, id]);
      await db.query(
        `INSERT INTO event_bookings (user_id, event_id, status, organization_id)
         VALUES ($1, $2, 'waitlist', 1)`, [USERS.konfi2.id, id]);
      await db.query('UPDATE users SET deleted_at = NOW() WHERE id = $1', [geloeschte.id]);

      const res = await request(app)
        .delete(`/api/events/${id}/book`)
        .set('Authorization', `Bearer ${konfi1Token}`);
      expect(res.status).toBe(200);

      const { rows: [nach] } = await db.query(
        'SELECT status FROM event_bookings WHERE user_id = $1 AND event_id = $2',
        [USERS.konfi2.id, id]
      );
      expect(nach.status).toBe('confirmed');
    });
  });

  // ==================================================================
  // 4. Leitung zaehlt gegen das TEAM-Kontingent (Migration 136)
  // ==================================================================
  describe('Leitung gehoert auf die Team-Seite', () => {
    // admin1 ist Leitung (Rolle 'admin'), USERS.admin1.
    const leitungBucht = (eventId, status = 'confirmed') =>
      db.query(
        `INSERT INTO event_bookings (user_id, event_id, status, organization_id)
         VALUES ($1, $2, $3, 1)`,
        [USERS.admin1.id, eventId, status]
      );

    it('eine gebuchte Leitung belegt KEINEN Konfi-Platz (register)', async () => {
      const id = await terminAnlegen({ max_participants: 1 });
      await leitungBucht(id);

      const res = await request(app)
        .post(`/api/konfi/events/${id}/register`)
        .set('Authorization', `Bearer ${konfi1Token}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('confirmed');
    });

    it('eine gebuchte Leitung belegt KEINEN Konfi-Platz (book)', async () => {
      const id = await terminAnlegen({ max_participants: 1 });
      await leitungBucht(id);

      const res = await request(app)
        .post(`/api/events/${id}/book`)
        .set('Authorization', `Bearer ${konfi1Token}`)
        .send({});

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('confirmed');
    });

    it('eine gebuchte Leitung belegt einen TEAM-Platz: das Kontingent ist damit voll', async () => {
      const id = await terminAnlegen({ teamer_needed: true, teamer_max_participants: 1 });
      await leitungBucht(id);

      const res = await request(app)
        .post(`/api/events/${id}/book`)
        .set('Authorization', `Bearer ${teamerToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Das Event ist leider bereits ausgebucht');
    });

    it('Zusage: eine gebuchte Leitung fuellt das Team-Kontingent', async () => {
      const id = await terminAnlegen({ teamer_needed: true, teamer_max_participants: 1 });
      await leitungBucht(id);

      const res = await request(app)
        .post(`/api/teamer/events/${id}/zusage`)
        .set('Authorization', `Bearer ${teamerToken}`)
        .send({ dabei: true });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Das Event ist leider bereits ausgebucht');
    });

    it('die Zaehlung des Kerns stimmt mit event_booking_stats ueberein', async () => {
      const id = await terminAnlegen({ max_participants: 10, teamer_needed: true, teamer_max_participants: 10 });
      await leitungBucht(id);
      await db.query(
        `INSERT INTO event_bookings (user_id, event_id, status, organization_id)
         VALUES ($1, $2, 'confirmed', 1)`, [USERS.konfi1.id, id]);
      await db.query(
        `INSERT INTO event_bookings (user_id, event_id, status, organization_id)
         VALUES ($1, $2, 'confirmed', 1)`, [USERS.teamer1.id, id]);

      const { zaehleBuchungen } = require('../../utils/bookingUtils');
      const konfiSeite = await zaehleBuchungen(db, { eventId: id }, 'konfi');
      const teamSeite = await zaehleBuchungen(db, { eventId: id }, 'team');
      const { rows: [sicht] } = await db.query(
        'SELECT * FROM event_booking_stats WHERE event_id = $1', [id]
      );

      expect(konfiSeite.confirmed).toBe(sicht.konfi_confirmed);
      expect(teamSeite.confirmed).toBe(sicht.teamer_confirmed);
      // Konkret: eine Konfi, dazu Leitung UND Teamer:in auf der Team-Seite.
      expect(konfiSeite.confirmed).toBe(1);
      expect(teamSeite.confirmed).toBe(2);
    });
  });

  // ==================================================================
  // 5. Nebenlaeufigkeit: der letzte Platz gehoert genau einer Person
  // ==================================================================
  describe('Zwei gleichzeitige Buchungen auf den letzten Platz', () => {
    it('book: genau eine bekommt ihn, die andere wird abgewiesen', async () => {
      const id = await terminAnlegen({ max_participants: 1 });

      const [a, b] = await Promise.all([
        request(app).post(`/api/events/${id}/book`)
          .set('Authorization', `Bearer ${konfi1Token}`).send({}),
        request(app).post(`/api/events/${id}/book`)
          .set('Authorization', `Bearer ${konfi2Token}`).send({})
      ]);

      const codes = [a.status, b.status].sort();
      expect(codes).toEqual([201, 400]);

      const buchungen = await buchungenLesen(id);
      expect(buchungen.length).toBe(1);
      expect(buchungen[0].status).toBe('confirmed');
    });

    it('register: genau eine bekommt den letzten Zeitslot-Platz', async () => {
      // Genau der Fall, den die alte register-Fassung NICHT abfing:
      // sie sperrte den Zeitslot nicht (kein FOR UPDATE), beide Anfragen
      // lasen dieselbe Null und beide wurden bestaetigt.
      const id = await terminAnlegen({ has_timeslots: true, max_participants: 5 });
      const slot = await slotAnlegen(id, 1);

      const [a, b] = await Promise.all([
        request(app).post(`/api/konfi/events/${id}/register`)
          .set('Authorization', `Bearer ${konfi1Token}`).send({ timeslot_id: slot }),
        request(app).post(`/api/konfi/events/${id}/register`)
          .set('Authorization', `Bearer ${konfi2Token}`).send({ timeslot_id: slot })
      ]);

      const codes = [a.status, b.status].sort();
      expect(codes).toEqual([200, 400]);

      const buchungen = await buchungenLesen(id);
      expect(buchungen.length).toBe(1);
      expect(buchungen[0].status).toBe('confirmed');
    });

    it('register mit Warteliste: genau eine bestaetigt, eine wartet', async () => {
      const id = await terminAnlegen({
        has_timeslots: true, max_participants: 5, waitlist_enabled: true
      });
      const slot = await slotAnlegen(id, 1);

      const [a, b] = await Promise.all([
        request(app).post(`/api/konfi/events/${id}/register`)
          .set('Authorization', `Bearer ${konfi1Token}`).send({ timeslot_id: slot }),
        request(app).post(`/api/konfi/events/${id}/register`)
          .set('Authorization', `Bearer ${konfi2Token}`).send({ timeslot_id: slot })
      ]);

      expect(a.status).toBe(200);
      expect(b.status).toBe(200);
      const stati = [a.body.status, b.body.status].sort();
      expect(stati).toEqual(['confirmed', 'waitlist']);
    });
  });

  // ==================================================================
  // 6. Mandantengrenze
  // ==================================================================
  describe('Die Gemeindegrenze bleibt dicht', () => {
    it('book: fremder Termin -> 404, keine Buchung', async () => {
      const res = await request(app)
        .post(`/api/events/${EVENTS.event2.id}/book`)
        .set('Authorization', `Bearer ${konfi1Token}`)
        .send({});

      expect(res.status).toBe(404);
      expect(await buchungenLesen(EVENTS.event2.id)).toEqual([]);
    });

    it('register: fremder Termin -> 404, keine Buchung', async () => {
      const res = await request(app)
        .post(`/api/konfi/events/${EVENTS.event2.id}/register`)
        .set('Authorization', `Bearer ${konfi1Token}`)
        .send({});

      expect(res.status).toBe(404);
      expect(await buchungenLesen(EVENTS.event2.id)).toEqual([]);
    });

    it('register: Zeitslot aus einer fremden Gemeinde wird abgewiesen', async () => {
      // Vorher pruefte register die organization_id des Zeitslots nicht.
      // Der Slot musste nur zum Termin passen — was er hier tut, weil er
      // fuer die Pruefung praepariert wird.
      const id = await terminAnlegen({ has_timeslots: true, max_participants: 5 });
      const { rows: [fremderSlot] } = await db.query(
        `INSERT INTO event_timeslots (event_id, start_time, end_time, max_participants, organization_id)
         VALUES ($1, NOW() + interval '30 days', NOW() + interval '30 days' + interval '2 hours', 5, $2)
         RETURNING id`,
        [id, ORGS.andereGemeinde.id]
      );

      const res = await request(app)
        .post(`/api/konfi/events/${id}/register`)
        .set('Authorization', `Bearer ${konfi1Token}`)
        .send({ timeslot_id: fremderSlot.id });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Ungültiger Zeitslot');
      expect(await buchungenLesen(id)).toEqual([]);
    });

    it('register: Zeitslot eines ANDEREN Termins wird abgewiesen', async () => {
      const a = await terminAnlegen({ has_timeslots: true, max_participants: 5 });
      const b = await terminAnlegen({ has_timeslots: true, max_participants: 5 });
      await slotAnlegen(a, 5);
      const fremd = await slotAnlegen(b, 5);

      const res = await request(app)
        .post(`/api/konfi/events/${a}/register`)
        .set('Authorization', `Bearer ${konfi1Token}`)
        .send({ timeslot_id: fremd });

      expect(res.status).toBe(400);
      expect(await buchungenLesen(a)).toEqual([]);
    });

    it('book: Teamer aus einer anderen Gemeinde kommt nicht an den Termin', async () => {
      const id = await terminAnlegen({ teamer_needed: true, teamer_max_participants: 5 });
      const fremderTeamer = generateToken('teamer2');

      const res = await request(app)
        .post(`/api/events/${id}/book`)
        .set('Authorization', `Bearer ${fremderTeamer}`)
        .send({});

      expect(res.status).toBe(404);
      expect(await buchungenLesen(id)).toEqual([]);
    });
  });
});
