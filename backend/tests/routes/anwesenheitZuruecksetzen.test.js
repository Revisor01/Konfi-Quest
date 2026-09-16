// Anwesenheit: Eintrag zuruecksetzen (16.09.2026).
//
// Simons Befund: "ich kann eine abmeldung die ich eingetragen habe nicht
// loeschen und die person wieder zulassen. ich kann sie zurueck auf die
// warteliste setzen und dann bestaetigen, war das absicht?"
//
// Es war keine Absicht, sondern eine Luecke: Die Notiz laesst sich loeschen,
// der Abmeldegrund wird beim Statuswechsel geleert, eine Terminabsage laesst
// sich zuruecknehmen -- nur der Anwesenheitsstatus selbst hatte keinen
// Rueckweg. Wer sich vertippt hatte, kam aus dem Eintrag nicht mehr heraus.
//
// Diese Datei haelt fest, was das Zuruecksetzen tut UND was es nicht tut:
// keine Punkte stehenlassen, kein Nachruecken ausloesen, den Buchungsstatus
// nur dort anfassen, wo die Abmeldung ihn verschoben hatte.
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, JAHRGAENGE } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

describe('Anwesenheit: Eintrag zuruecksetzen', () => {
  let app;
  let db;
  let adminToken;
  let konfiToken;
  let konfi2Token;

  beforeAll(async () => {
    db = getTestPool();
    app = getTestApp(db);
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    adminToken = generateToken('admin1');
    konfiToken = generateToken('konfi1');
    konfi2Token = generateToken('konfi2');
    await db.query(
      'INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id, can_view, can_edit) VALUES ($1, $2, true, true)',
      [USERS.admin1.id, JAHRGAENGE.jahrgang1.id]
    );
    require('../../middleware/rbac').invalidateUserCache(USERS.admin1.id);
  });

  afterAll(async () => {
    await closePool();
  });

  // Freiwilliger Termin mit Punkten: nur dort wird der Punkte-Abzug sichtbar.
  async function setupEvent({ points = 5, max = 10 } = {}) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 14);
    const createRes = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Ruecksetz-Event',
        event_date: futureDate.toISOString(),
        max_participants: max,
        points,
        point_type: 'gemeinde',
        waitlist_enabled: true,
        max_waitlist_size: 5
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
      `SELECT attendance_status, excuse_reason, attendance_note, status,
              attendance_set_by, attendance_set_at, checkin_quelle, checked_in_at,
              note_set_by, abgemeldet_durch_absage
         FROM event_bookings WHERE id = $1`,
      [bookingId]
    );
    return rows[0];
  };

  const setze = (eventId, bookingId, body) =>
    request(app)
      .put(`/api/events/${eventId}/participants/${bookingId}/attendance`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(body);

  const gemeindePunkte = async (userId = USERS.konfi1.id) => {
    const { rows } = await db.query(
      'SELECT gemeinde_points FROM konfi_profiles WHERE user_id = $1',
      [userId]
    );
    return rows[0].gemeinde_points;
  };

  const punkteZeilen = async (eventId, userId = USERS.konfi1.id) => {
    const { rows } = await db.query(
      'SELECT points FROM event_points WHERE event_id = $1 AND konfi_id = $2',
      [eventId, userId]
    );
    return rows;
  };

  describe('Die Abmeldung zuruecknehmen', () => {
    it('raeumt Status, Grund, Urheber und Quelle ab und holt den Buchungsstatus zurueck', async () => {
      const { eventId, bookingId } = await setupEvent();

      const ab = await setze(eventId, bookingId, {
        attendance_status: 'excused',
        excuse_reason: 'krank, Mutter hat angerufen'
      });
      expect(ab.status).toBe(200);
      // Der Ausgangszustand muss wirklich gesetzt sein -- sonst prueft der
      // Test unten nur, dass NULL NULL bleibt.
      const vorher = await buchung(bookingId);
      expect(vorher.attendance_status).toBe('excused');
      expect(vorher.excuse_reason).toBe('krank, Mutter hat angerufen');
      expect(vorher.status).toBe('excused');
      expect(vorher.attendance_set_by).toBe(USERS.admin1.id);
      expect(vorher.checkin_quelle).toBe('manuell');
      expect(vorher.attendance_set_at).not.toBeNull();
      expect(vorher.checked_in_at).not.toBeNull();

      const res = await setze(eventId, bookingId, { attendance_status: null });
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Eintrag zurückgesetzt');

      const nachher = await buchung(bookingId);
      expect(nachher.attendance_status).toBeNull();
      expect(nachher.excuse_reason).toBeNull();
      expect(nachher.attendance_set_by).toBeNull();
      expect(nachher.attendance_set_at).toBeNull();
      expect(nachher.checkin_quelle).toBeNull();
      expect(nachher.checked_in_at).toBeNull();
      // Der Buchungsstatus faellt von 'excused' auf 'confirmed' zurueck --
      // genau der Weg, den auch 'excused' -> 'present' geht.
      expect(nachher.status).toBe('confirmed');
      expect(nachher.abgemeldet_durch_absage).toBe(false);
    });

    it('laesst die Notiz stehen -- sie haengt nicht am Status', async () => {
      const { eventId, bookingId } = await setupEvent();
      await setze(eventId, bookingId, {
        attendance_status: 'excused',
        excuse_reason: 'krank',
        attendance_note: 'Mutter hat um 8 Uhr angerufen'
      });
      expect((await buchung(bookingId)).attendance_note).toBe('Mutter hat um 8 Uhr angerufen');

      await setze(eventId, bookingId, { attendance_status: null });

      const b = await buchung(bookingId);
      expect(b.attendance_note).toBe('Mutter hat um 8 Uhr angerufen');
      expect(b.note_set_by).toBe(USERS.admin1.id);
      // Gegenprobe zur Aussage "die Notiz geht ihren eigenen Weg": Ueber ihr
      // eigenes Feld ist sie weiterhin loeschbar.
      await setze(eventId, bookingId, { attendance_status: null, attendance_note: '' });
      const danach = await buchung(bookingId);
      expect(danach.attendance_note).toBeNull();
      expect(danach.note_set_by).toBeNull();
    });
  });

  describe('present und absent gehen denselben Weg', () => {
    it('present -> zurueckgesetzt nimmt die Punkte mit zurueck', async () => {
      const { eventId, bookingId } = await setupEvent({ points: 5 });
      const vorPunkte = await gemeindePunkte();

      await setze(eventId, bookingId, { attendance_status: 'present' });
      expect(await gemeindePunkte()).toBe(vorPunkte + 5);
      expect(await punkteZeilen(eventId)).toHaveLength(1);

      const res = await setze(eventId, bookingId, { attendance_status: null });
      expect(res.status).toBe(200);
      expect(res.body.points_removed).toBe(true);
      expect(res.body.message).toBe('Eintrag zurückgesetzt und 5 Punkte entfernt');

      const b = await buchung(bookingId);
      expect(b.attendance_status).toBeNull();
      expect(b.attendance_set_by).toBeNull();
      expect(b.checkin_quelle).toBeNull();
      // Der Buchungsstatus war nie 'excused' -- er bleibt, wie er war.
      expect(b.status).toBe('confirmed');
      expect(await gemeindePunkte()).toBe(vorPunkte);
      expect(await punkteZeilen(eventId)).toHaveLength(0);
    });

    it('absent -> zurueckgesetzt raeumt den Eintrag ebenso ab', async () => {
      const { eventId, bookingId } = await setupEvent();
      await setze(eventId, bookingId, { attendance_status: 'absent' });
      expect((await buchung(bookingId)).attendance_status).toBe('absent');

      await setze(eventId, bookingId, { attendance_status: null });

      const b = await buchung(bookingId);
      expect(b.attendance_status).toBeNull();
      expect(b.attendance_set_by).toBeNull();
      expect(b.attendance_set_at).toBeNull();
      expect(b.checkin_quelle).toBeNull();
      expect(b.checked_in_at).toBeNull();
      expect(b.status).toBe('confirmed');
    });

    it('nach dem Zuruecksetzen gibt es die Punkte erst bei erneutem present wieder', async () => {
      const { eventId, bookingId } = await setupEvent({ points: 5 });
      const vorPunkte = await gemeindePunkte();

      await setze(eventId, bookingId, { attendance_status: 'present' });
      await setze(eventId, bookingId, { attendance_status: null });
      expect(await gemeindePunkte()).toBe(vorPunkte);

      const wieder = await setze(eventId, bookingId, { attendance_status: 'present' });
      expect(wieder.status).toBe(200);
      // Und zwar WIRKLICH wieder -- nicht "Punkte bereits vergeben".
      expect(wieder.body.points_awarded).toBe(true);
      expect(await gemeindePunkte()).toBe(vorPunkte + 5);
      expect(await punkteZeilen(eventId)).toHaveLength(1);
    });

    it('leerer String und fehlendes Feld setzen ebenfalls zurueck', async () => {
      const { eventId, bookingId } = await setupEvent();

      await setze(eventId, bookingId, { attendance_status: 'present' });
      expect((await setze(eventId, bookingId, { attendance_status: '  ' })).status).toBe(200);
      expect((await buchung(bookingId)).attendance_status).toBeNull();

      await setze(eventId, bookingId, { attendance_status: 'absent' });
      expect((await setze(eventId, bookingId, {})).status).toBe(200);
      expect((await buchung(bookingId)).attendance_status).toBeNull();
    });

    // Gegenprobe zum erlaubten Fall: Erfundene Status bleiben verboten.
    it('ein unbekannter Status wird weiterhin mit 400 abgewiesen', async () => {
      const { eventId, bookingId } = await setupEvent();
      await setze(eventId, bookingId, { attendance_status: 'present' });

      const res = await setze(eventId, bookingId, { attendance_status: 'zurueckgesetzt' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Ungültiger Anwesenheitsstatus');
      // Der bestehende Eintrag bleibt unangetastet.
      expect((await buchung(bookingId)).attendance_status).toBe('present');
    });
  });

  describe('Kein Nachruecken beim Zuruecksetzen', () => {
    // Der Termin hat genau einen Platz: konfi1 hat ihn, konfi2 wartet.
    async function vollerTermin() {
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 14);
      const createRes = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Enger Termin',
          event_date: futureDate.toISOString(),
          max_participants: 1,
          points: 0,
          point_type: 'gemeinde',
          waitlist_enabled: true,
          max_waitlist_size: 5
        });
      const eventId = createRes.body.id;
      await request(app).post(`/api/events/${eventId}/book`).set('Authorization', `Bearer ${konfiToken}`);
      await request(app).post(`/api/events/${eventId}/book`).set('Authorization', `Bearer ${konfi2Token}`);
      const { rows } = await db.query(
        'SELECT id, user_id, status FROM event_bookings WHERE event_id = $1 ORDER BY created_at',
        [eventId]
      );
      return { eventId, buchungen: rows };
    }

    it('das Abmelden rueckt nach, das Zuruecksetzen nicht', async () => {
      const { eventId, buchungen } = await vollerTermin();
      const eins = buchungen.find((b) => b.user_id === USERS.konfi1.id);
      const zwei = buchungen.find((b) => b.user_id === USERS.konfi2.id);
      expect(eins.status).toBe('confirmed');
      expect(zwei.status).toBe('waitlist');

      // Abmelden: konfi2 rueckt nach (das ist der Stand seit 15.09.).
      await setze(eventId, eins.id, { attendance_status: 'excused', excuse_reason: 'krank' });
      expect((await buchung(zwei.id)).status).toBe('confirmed');

      // Zuruecksetzen darf NICHT noch einmal nachruecken -- es wird ja
      // gerade kein Platz frei, sondern einer beansprucht.
      const vorher = await db.query(
        "SELECT COUNT(*)::int AS n FROM event_bookings WHERE event_id = $1 AND status = 'confirmed'",
        [eventId]
      );
      await setze(eventId, eins.id, { attendance_status: null });
      const nachher = await db.query(
        "SELECT COUNT(*)::int AS n FROM event_bookings WHERE event_id = $1 AND status = 'confirmed'",
        [eventId]
      );
      // konfi1 kommt zurueck auf 'confirmed' (von 'excused'), konfi2 bleibt
      // stehen. Genau EINE Zeile mehr, kein weiteres Nachruecken.
      expect(nachher.rows[0].n).toBe(vorher.rows[0].n + 1);
      expect((await buchung(eins.id)).status).toBe('confirmed');
      expect((await buchung(zwei.id)).status).toBe('confirmed');
    });

    it('eine Selbstabmeldung (opted_out) bleibt beim Zuruecksetzen erhalten', async () => {
      const { eventId, bookingId } = await setupEvent();
      await db.query("UPDATE event_bookings SET status = 'opted_out' WHERE id = $1", [bookingId]);

      await setze(eventId, bookingId, { attendance_status: 'present' });
      expect((await buchung(bookingId)).status).toBe('opted_out');

      await setze(eventId, bookingId, { attendance_status: null });
      // Die Selbstabmeldung ist die Vorgeschichte des Eintrags -- sie
      // verschwindet nicht, weil der Eintrag zurueckgenommen wird.
      const b = await buchung(bookingId);
      expect(b.status).toBe('opted_out');
      expect(b.attendance_status).toBeNull();
    });
  });
});
