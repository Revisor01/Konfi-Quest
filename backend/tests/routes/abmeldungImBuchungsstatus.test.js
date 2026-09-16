// DIE ABMELDUNG STEHT IM BUCHUNGSSTATUS (Migration 153/154, 15.09.2026).
//
// DER FEHLER, DEN DAS BEHEBT: Meldete die Leitung jemanden ab, setzte das nur
// attendance_status = 'excused'. event_bookings.status blieb auf 'confirmed'.
// Daran hingen vier Symptome mit EINER Ursache:
//
//   * Erinnerungen ("Morgen: Konfistunde!") gingen weiter raus.
//   * Der Platz galt als belegt, die Kapazitaet war zu klein.
//   * Die Warteliste rueckte nicht nach.
//   * Die Teilnehmerliste sortierte die abgemeldete Person ganz nach oben.
//
// Seit Migration 153 zieht der Buchungsstatus mit: 'excused'. Zusaetzlich
// haelt abgemeldet_durch_absage fest, ob die Abmeldung aus einer TERMINABSAGE
// stammt oder eine EINZELentscheidung war -- die Unterscheidung, auf der das
// Zuruecknehmen einer Absage aufbaut (Simon: "manche sind entschuldigt, dann
// machen wir es doch. Status bei allen zurueck ausser bei denen.").
//
// DIE GRENZE, DIE NICHT VERLETZT WERDEN DARF: Eine SELBSTabmeldung
// ('opted_out') ist etwas anderes und bleibt bestehen, auch wenn die Leitung
// danach verbucht. Der Fall steht ausdruecklich in
// anwesenheitSelbstabmeldungUndUrheber.test.js; hier wird er ein zweites Mal
// geprueft, weil genau er beim Umbau des UPDATE haette kippen koennen.
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, JAHRGAENGE } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

describe('Abmeldung im Buchungsstatus', () => {
  let app, db, adminToken, konfiToken;

  beforeAll(() => { db = getTestPool(); app = getTestApp(db); });
  afterAll(async () => { await closePool(); });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    adminToken = generateToken('admin1');
    konfiToken = generateToken('konfi1');
    await db.query(
      'INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id, can_view, can_edit) VALUES ($1, $2, true, true)',
      [USERS.admin1.id, JAHRGAENGE.jahrgang1.id]
    );
    require('../../middleware/rbac').invalidateUserCache(USERS.admin1.id);
  });

  async function termin({ punkte = 0, max = 20, pflicht = false, vergangen = false, warteliste = true } = {}) {
    const datum = vergangen ? "NOW() - interval '2 days'" : "NOW() + interval '14 days'";
    const { rows: [event] } = await db.query(
      `INSERT INTO events (name, event_date, organization_id, mandatory, max_participants,
                           point_type, points, cancelled, waitlist_enabled, max_waitlist_size)
       VALUES ('Konfistunde', ${datum}, $1, $2, $3, 'gemeinde', $4, false, $5, 10)
       RETURNING id`,
      [ORGS.testGemeinde.id, pflicht, max, punkte, warteliste]
    );
    await db.query(
      'INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) VALUES ($1, $2)',
      [event.id, JAHRGAENGE.jahrgang1.id]
    );
    return event.id;
  }

  async function bucht(eventId, userId, status = 'confirmed') {
    const { rows: [b] } = await db.query(
      `INSERT INTO event_bookings (user_id, event_id, status, organization_id, created_at)
       VALUES ($1, $2, $3, $4, NOW()::text) RETURNING id`,
      [userId, eventId, status, ORGS.testGemeinde.id]
    );
    return b.id;
  }

  const buchung = async (bookingId) => {
    const { rows: [row] } = await db.query(
      `SELECT status, attendance_status, excuse_reason, abgemeldet_durch_absage
         FROM event_bookings WHERE id = $1`,
      [bookingId]
    );
    return row;
  };

  const setzeAnwesenheit = (eventId, bookingId, body, token = adminToken) =>
    request(app)
      .put(`/api/events/${eventId}/participants/${bookingId}/attendance`)
      .set('Authorization', `Bearer ${token}`)
      .send(body);

  // =================================================================
  describe('Abmelden setzt beide Felder', () => {
    it('setzt attendance_status UND status auf excused', async () => {
      const eventId = await termin();
      const bookingId = await bucht(eventId, USERS.konfi1.id);

      const res = await setzeAnwesenheit(eventId, bookingId, {
        attendance_status: 'excused', excuse_reason: 'krank, Mutter hat angerufen'
      });
      expect(res.status).toBe(200);

      const b = await buchung(bookingId);
      expect(b.attendance_status).toBe('excused');
      expect(b.status).toBe('excused');
      expect(b.excuse_reason).toBe('krank, Mutter hat angerufen');
    });

    it('eine EINZELabmeldung traegt abgemeldet_durch_absage = FALSE', async () => {
      // Das ist die Unterscheidung, auf der das Zuruecknehmen einer Absage
      // aufbaut: Diese Person bleibt abgemeldet, wenn der Termin doch
      // stattfindet.
      const eventId = await termin();
      const bookingId = await bucht(eventId, USERS.konfi1.id);

      await setzeAnwesenheit(eventId, bookingId, { attendance_status: 'excused' });

      expect((await buchung(bookingId)).abgemeldet_durch_absage).toBe(false);
    });

    it('present setzt den status zurueck auf confirmed', async () => {
      const eventId = await termin();
      const bookingId = await bucht(eventId, USERS.konfi1.id);
      await setzeAnwesenheit(eventId, bookingId, { attendance_status: 'excused' });
      expect((await buchung(bookingId)).status).toBe('excused');

      const res = await setzeAnwesenheit(eventId, bookingId, { attendance_status: 'present' });
      expect(res.status).toBe(200);

      const b = await buchung(bookingId);
      expect(b.status).toBe('confirmed');
      expect(b.attendance_status).toBe('present');
      expect(b.excuse_reason).toBeNull();
    });

    it('absent setzt den status ebenfalls zurueck auf confirmed', async () => {
      // 'absent' heisst "war gebucht und nicht da" -- unentschuldigtes
      // Fehlen. Die Buchung bestand also; sie zaehlt wieder.
      const eventId = await termin();
      const bookingId = await bucht(eventId, USERS.konfi1.id);
      await setzeAnwesenheit(eventId, bookingId, { attendance_status: 'excused' });

      const res = await setzeAnwesenheit(eventId, bookingId, { attendance_status: 'absent' });
      expect(res.status).toBe(200);

      const b = await buchung(bookingId);
      expect(b.status).toBe('confirmed');
      expect(b.attendance_status).toBe('absent');
    });

    it('present ohne vorherige Abmeldung laesst confirmed unveraendert', async () => {
      // GEGENPROBE zum Rueckweg: Der CASE darf nicht pauschal auf
      // 'confirmed' schreiben, sondern nur, wenn vorher 'excused' stand.
      const eventId = await termin();
      const bookingId = await bucht(eventId, USERS.konfi1.id, 'waitlist');

      await setzeAnwesenheit(eventId, bookingId, { attendance_status: 'present' });

      expect((await buchung(bookingId)).status).toBe('waitlist');
    });
  });

  // =================================================================
  describe('opted_out bleibt erhalten, wenn die Leitung danach verbucht', () => {
    async function pflichtterminMitSelbstabmeldung() {
      const eventId = await termin({ pflicht: true });
      await request(app).post(`/api/events/${eventId}/book`).set('Authorization', `Bearer ${konfiToken}`);
      const optOut = await request(app)
        .post(`/api/konfi/events/${eventId}/opt-out`)
        .set('Authorization', `Bearer ${konfiToken}`)
        .send({ reason: 'Familienfeier an dem Tag' });
      expect(optOut.status).toBe(200);
      const { rows: [b] } = await db.query(
        'SELECT id, status FROM event_bookings WHERE event_id = $1 AND user_id = $2',
        [eventId, USERS.konfi1.id]
      );
      expect(b.status).toBe('opted_out');
      return { eventId, bookingId: b.id };
    }

    it('present ueberschreibt opted_out NICHT', async () => {
      const { eventId, bookingId } = await pflichtterminMitSelbstabmeldung();

      const res = await setzeAnwesenheit(eventId, bookingId, { attendance_status: 'present' });
      expect(res.status).toBe(200);

      const b = await buchung(bookingId);
      expect(b.status).toBe('opted_out');
      expect(b.attendance_status).toBe('present');
    });

    it('excused ueberschreibt opted_out NICHT', async () => {
      // Der zweite, subtilere Fall: Die Leitung traegt zu einer
      // Selbstabmeldung noch eine Abmeldung nach ("krank gemeldet"). Der
      // Buchungsstatus bleibt 'opted_out' -- der Vorgang, der wirklich
      // stattgefunden hat, war die Selbstabmeldung.
      const { eventId, bookingId } = await pflichtterminMitSelbstabmeldung();

      const res = await setzeAnwesenheit(eventId, bookingId, {
        attendance_status: 'excused', excuse_reason: 'krank gemeldet'
      });
      expect(res.status).toBe(200);

      const b = await buchung(bookingId);
      expect(b.status).toBe('opted_out');
      expect(b.attendance_status).toBe('excused');
      expect(b.excuse_reason).toBe('krank gemeldet');
    });

    it('der Selbst-Absagegrund bleibt dabei stehen', async () => {
      const { eventId, bookingId } = await pflichtterminMitSelbstabmeldung();
      await setzeAnwesenheit(eventId, bookingId, { attendance_status: 'present' });

      const { rows: [b] } = await db.query(
        'SELECT opt_out_reason FROM event_bookings WHERE id = $1', [bookingId]
      );
      expect(b.opt_out_reason).toBe('Familienfeier an dem Tag');
    });
  });

  // =================================================================
  describe('Eine Abmeldung belegt keinen Platz', () => {
    it('gibt den Platz in event_booking_stats frei', async () => {
      const eventId = await termin({ max: 2 });
      const b1 = await bucht(eventId, USERS.konfi1.id);
      await bucht(eventId, USERS.konfi2.id);

      const stats = async () => {
        const { rows: [s] } = await db.query(
          'SELECT konfi_confirmed, konfi_excused, konfi_opted_out, gebucht_gesamt FROM event_booking_stats WHERE event_id = $1',
          [eventId]
        );
        return s;
      };
      expect((await stats()).konfi_confirmed).toBe(2);

      await setzeAnwesenheit(eventId, b1, { attendance_status: 'excused' });

      const s = await stats();
      expect(s.konfi_confirmed).toBe(1);
      expect(s.konfi_excused).toBe(1);
      // Die Abmeldung der Leitung faellt NICHT in den Selbstabmelde-Zaehler:
      // zwei verschiedene Vorgaenge, zwei Spalten.
      expect(s.konfi_opted_out).toBe(0);
      // gebucht_gesamt laesst sie wie eine Selbstabmeldung heraus.
      expect(s.gebucht_gesamt).toBe(1);
    });

    it('zaehleBuchungen zaehlt sie nicht als bestaetigt', async () => {
      const { zaehleBuchungen } = require('../../utils/bookingUtils');
      const eventId = await termin({ max: 2 });
      const b1 = await bucht(eventId, USERS.konfi1.id);
      await bucht(eventId, USERS.konfi2.id);

      expect((await zaehleBuchungen(db, { eventId }, 'konfi')).confirmed).toBe(2);

      await setzeAnwesenheit(eventId, b1, { attendance_status: 'excused' });

      expect((await zaehleBuchungen(db, { eventId }, 'konfi')).confirmed).toBe(1);
    });

    it('der frei gewordene Platz laesst eine neue Anmeldung zu', async () => {
      // Die Zahl allein beweist noch nichts -- hier wird der Platz auch
      // wirklich benutzt. Der Termin fasst genau 1 Person.
      const eventId = await termin({ max: 1, warteliste: false });
      const b1 = await bucht(eventId, USERS.konfi2.id);

      const voll = await request(app)
        .post(`/api/events/${eventId}/book`)
        .set('Authorization', `Bearer ${konfiToken}`);
      expect(voll.status).toBe(400);
      expect(voll.body.error).toBe('Das Event ist leider bereits ausgebucht');

      await setzeAnwesenheit(eventId, b1, { attendance_status: 'excused' });

      const jetzt = await request(app)
        .post(`/api/events/${eventId}/book`)
        .set('Authorization', `Bearer ${konfiToken}`);
      expect(jetzt.status).toBe(201);
      expect(jetzt.body.status).toBe('confirmed');
    });

    it('GEGENPROBE: eine Abmeldung auf der WARTELISTE gibt keinen Platz frei', async () => {
      // Wer wartet, belegt keinen bestaetigten Platz -- eine Abmeldung dort
      // darf die Zahl der Bestaetigten nicht veraendern.
      const eventId = await termin({ max: 1 });
      await bucht(eventId, USERS.konfi2.id, 'confirmed');
      const wartend = await bucht(eventId, USERS.konfi1.id, 'waitlist');

      await setzeAnwesenheit(eventId, wartend, { attendance_status: 'excused' });

      const { rows: [s] } = await db.query(
        'SELECT konfi_confirmed, konfi_waitlist, konfi_excused FROM event_booking_stats WHERE event_id = $1',
        [eventId]
      );
      expect(s.konfi_confirmed).toBe(1);
      expect(s.konfi_waitlist).toBe(0);
      expect(s.konfi_excused).toBe(1);
    });
  });

  // =================================================================
  describe('Sortierung: Abgemeldete stehen unten', () => {
    it('sortiert die abgemeldete Person hinter Bestaetigte und Wartende', async () => {
      const eventId = await termin({ max: 10 });
      // konfi1 zuerst gebucht -- ohne den Statuswechsel stuende sie oben.
      const b1 = await bucht(eventId, USERS.konfi1.id, 'confirmed');
      await bucht(eventId, USERS.konfi2.id, 'confirmed');
      await bucht(eventId, USERS.teamer1.id, 'waitlist');

      await setzeAnwesenheit(eventId, b1, { attendance_status: 'excused' });

      const res = await request(app)
        .get(`/api/events/${eventId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);

      const reihenfolge = res.body.participants.map(p => p.user_id);
      expect(reihenfolge).toEqual([USERS.konfi2.id, USERS.teamer1.id, USERS.konfi1.id]);
    });

    it('GEGENPROBE: ohne Abmeldung steht dieselbe Person vorn', async () => {
      // Der Beweis, dass die Reihenfolge oben an der Abmeldung haengt und
      // nicht am Zufall der IDs.
      const eventId = await termin({ max: 10 });
      await bucht(eventId, USERS.konfi1.id, 'confirmed');
      await bucht(eventId, USERS.konfi2.id, 'confirmed');
      await bucht(eventId, USERS.teamer1.id, 'waitlist');

      const res = await request(app)
        .get(`/api/events/${eventId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      const reihenfolge = res.body.participants.map(p => p.user_id);
      expect(reihenfolge).toEqual([USERS.konfi1.id, USERS.konfi2.id, USERS.teamer1.id]);
    });

    it('die Abgemeldete faellt aus registered_count heraus', async () => {
      const eventId = await termin({ max: 10 });
      const b1 = await bucht(eventId, USERS.konfi1.id);
      await bucht(eventId, USERS.konfi2.id);

      await setzeAnwesenheit(eventId, b1, { attendance_status: 'excused' });

      const res = await request(app)
        .get(`/api/events/${eventId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.body.registered_count).toBe(1);
      expect(res.body.available_spots).toBe(9);
    });
  });

  // =================================================================
  describe('Herkunft: Absage gegen Einzelabmeldung', () => {
    const absagen = (eventId, body = {}) =>
      request(app)
        .put(`/api/events/${eventId}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(body);

    it('die Terminabsage setzt abgemeldet_durch_absage = TRUE', async () => {
      const eventId = await termin();
      const bookingId = await bucht(eventId, USERS.konfi1.id);

      expect((await absagen(eventId, { cancelled_reason: 'Heizung defekt' })).status).toBe(200);

      const b = await buchung(bookingId);
      expect(b.status).toBe('excused');
      expect(b.abgemeldet_durch_absage).toBe(true);
    });

    it('die Einzelabmeldung setzt es NICHT -- das ist die Unterscheidung', async () => {
      const eventId = await termin();
      const bookingId = await bucht(eventId, USERS.konfi1.id);

      await setzeAnwesenheit(eventId, bookingId, { attendance_status: 'excused', excuse_reason: 'krank' });

      const b = await buchung(bookingId);
      expect(b.status).toBe('excused');
      expect(b.abgemeldet_durch_absage).toBe(false);
    });

    it('wer VOR der Absage einzeln abgemeldet wurde, behaelt FALSE', async () => {
      // DER FALL, AUF DEN SIMON ES ANGELEGT HAT: Erst ist eine Konfi krank
      // gemeldet, dann faellt der Termin aus. Nimmt die Leitung die Absage
      // spaeter zurueck, muss genau diese eine abgemeldet bleiben -- und
      // dafuer muss ihr Kennzeichen jetzt FALSE bleiben.
      const eventId = await termin();
      const krank = await bucht(eventId, USERS.konfi1.id);
      const andere = await bucht(eventId, USERS.konfi2.id);

      await setzeAnwesenheit(eventId, krank, {
        attendance_status: 'excused', excuse_reason: 'krank, Mutter hat angerufen'
      });
      expect((await absagen(eventId, { cancelled_reason: 'Heizung defekt' })).status).toBe(200);

      const k = await buchung(krank);
      expect(k.abgemeldet_durch_absage).toBe(false);
      expect(k.excuse_reason).toBe('krank, Mutter hat angerufen');

      const a = await buchung(andere);
      expect(a.abgemeldet_durch_absage).toBe(true);
      expect(a.excuse_reason).toBe('Heizung defekt');
    });

    it('wer NACH der Absage einzeln abgemeldet wird, faellt auf FALSE zurueck', async () => {
      // Die Leitung greift eine Absage-Abmeldung heraus und macht sie zu
      // ihrer eigenen ("nein, die war wirklich krank"). Danach ist es eine
      // Einzelentscheidung und ueberlebt die Zuruecknahme.
      const eventId = await termin();
      const bookingId = await bucht(eventId, USERS.konfi1.id);
      expect((await absagen(eventId)).status).toBe(200);
      expect((await buchung(bookingId)).abgemeldet_durch_absage).toBe(true);

      await setzeAnwesenheit(eventId, bookingId, {
        attendance_status: 'excused', excuse_reason: 'krank, Mutter hat angerufen'
      });

      expect((await buchung(bookingId)).abgemeldet_durch_absage).toBe(false);
    });

    it('das Zuruecksetzen auf present raeumt das Kennzeichen ebenfalls ab', async () => {
      const eventId = await termin();
      const bookingId = await bucht(eventId, USERS.konfi1.id);
      expect((await absagen(eventId)).status).toBe(200);

      await setzeAnwesenheit(eventId, bookingId, { attendance_status: 'present' });

      const b = await buchung(bookingId);
      expect(b.status).toBe('confirmed');
      expect(b.abgemeldet_durch_absage).toBe(false);
    });
  });

  // =================================================================
  describe('Der QR-Check-in weist eine Abmeldung ab', () => {
    it('meldet excused statt not_confirmed', async () => {
      const eventId = await termin();
      const bookingId = await bucht(eventId, USERS.konfi1.id);
      await setzeAnwesenheit(eventId, bookingId, { attendance_status: 'excused' });

      const qr = await request(app)
        .post(`/api/events/${eventId}/generate-qr`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(qr.status).toBe(200);
      await db.query('UPDATE events SET event_date = NOW() WHERE id = $1', [eventId]);

      const res = await request(app)
        .post('/api/events/qr-checkin')
        .set('Authorization', `Bearer ${konfiToken}`)
        .send({ token: qr.body.qr_token });

      expect(res.status).toBe(400);
      expect(res.body.error_type).toBe('excused');
      // Und die Abmeldung steht unveraendert da -- sie liesse sich sonst von
      // der abgemeldeten Person selbst aufheben.
      const b = await buchung(bookingId);
      expect(b.status).toBe('excused');
      expect(b.attendance_status).toBe('excused');
    });

    it('GEGENPROBE: ohne Abmeldung geht der Check-in durch', async () => {
      const eventId = await termin();
      const bookingId = await bucht(eventId, USERS.konfi1.id);

      const qr = await request(app)
        .post(`/api/events/${eventId}/generate-qr`)
        .set('Authorization', `Bearer ${adminToken}`);
      await db.query('UPDATE events SET event_date = NOW() WHERE id = $1', [eventId]);

      const res = await request(app)
        .post('/api/events/qr-checkin')
        .set('Authorization', `Bearer ${konfiToken}`)
        .send({ token: qr.body.qr_token });

      expect(res.status).toBe(200);
      expect((await buchung(bookingId)).attendance_status).toBe('present');
    });
  });

  // =================================================================
  describe('Der Constraint laesst genau die vorgesehenen Werte zu', () => {
    it('nimmt excused an', async () => {
      const eventId = await termin();
      const bookingId = await bucht(eventId, USERS.konfi1.id);
      await db.query("UPDATE event_bookings SET status = 'excused' WHERE id = $1", [bookingId]);
      expect((await buchung(bookingId)).status).toBe('excused');
    });

    it('weist einen erfundenen Wert weiterhin ab', async () => {
      // GEGENPROBE: Der Constraint ist nicht einfach weggefallen.
      const eventId = await termin();
      const bookingId = await bucht(eventId, USERS.konfi1.id);
      await expect(
        db.query("UPDATE event_bookings SET status = 'abgemeldet' WHERE id = $1", [bookingId])
      ).rejects.toThrow(/event_bookings_status_check/);
    });

    it('laesst die historischen Werte cancelled und pending stehen', async () => {
      // Sie haben in Produktion null Zeilen, werden aber noch GELESEN
      // (routes/wrapped.js zaehlt status='cancelled' fuer den
      // Jahresrueckblick). Ein engerer Constraint haette diesen Lesepfad
      // unschreibbar gemacht.
      const eventId = await termin();
      const bookingId = await bucht(eventId, USERS.konfi1.id);
      await db.query("UPDATE event_bookings SET status = 'cancelled' WHERE id = $1", [bookingId]);
      expect((await buchung(bookingId)).status).toBe('cancelled');
      await db.query("UPDATE event_bookings SET status = 'pending' WHERE id = $1", [bookingId]);
      expect((await buchung(bookingId)).status).toBe('pending');
    });
  });
});
