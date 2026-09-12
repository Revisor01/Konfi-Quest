// Anwesenheit: dritter Status 'excused' plus Grund und Vermerk (12.09.2026).
//
// Simons Fall: Eine Mutter meldet ihre Tochter telefonisch ab, wegen
// Krankheit -- nicht in der App. Bisher gab es nur 'present' (falsch) und
// 'absent' (richtig, sieht aber aus wie unentschuldigtes Fehlen). Der Grund
// ging verloren, und die Kolleginnen sahen nicht, dass abgemeldet wurde.
//
// Zweiter Fall: Eine Konfirmandin bittet, schon um 14 Uhr zu gehen. Sie war
// da, bekommt ihre Punkte, ist ANWESEND -- der Vermerk soll trotzdem stehen.
//
// Gefragt ist also beides: ein eigener Status MIT Grund, und ein Vermerk
// UNABHAENGIG vom Status.
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, JAHRGAENGE } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const PushService = require('../../services/pushService');

describe('Anwesenheit: abgemeldet (excused), Grund und Vermerk', () => {
  let app;
  let db;
  let adminToken;
  let teamerToken;
  let konfiToken;

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
    await db.query(
      'INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id, can_view, can_edit) VALUES ($1, $2, true, true)',
      [USERS.admin1.id, JAHRGAENGE.jahrgang1.id]
    );
    require('../../middleware/rbac').invalidateUserCache(USERS.admin1.id);
  });

  afterAll(async () => {
    await closePool();
  });

  // Freiwilliger Termin mit Punkten: konfi1 angemeldet. Punkte gibt es nur
  // ausserhalb von Pflichtterminen -- genau der Fall, in dem der Abzug bei
  // 'excused' sichtbar wird.
  async function setupEvent({ points = 5 } = {}) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 14);
    const createRes = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Abmelde-Event',
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
      'SELECT attendance_status, excuse_reason, attendance_note FROM event_bookings WHERE id = $1',
      [bookingId]
    );
    return rows[0];
  };

  const punkte = async (eventId) => {
    const { rows } = await db.query(
      'SELECT points FROM event_points WHERE event_id = $1 AND konfi_id = $2',
      [eventId, USERS.konfi1.id]
    );
    return rows;
  };

  const gemeindePunkte = async () => {
    const { rows } = await db.query(
      'SELECT gemeinde_points FROM konfi_profiles WHERE user_id = $1',
      [USERS.konfi1.id]
    );
    return rows[0].gemeinde_points;
  };

  describe('Der Status selbst', () => {
    it('excused wird angenommen und gespeichert', async () => {
      const { eventId, bookingId } = await setupEvent();
      const res = await request(app)
        .put(`/api/events/${eventId}/participants/${bookingId}/attendance`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ attendance_status: 'excused', excuse_reason: 'krank, Mutter hat angerufen' });

      expect(res.status).toBe(200);
      const b = await buchung(bookingId);
      expect(b.attendance_status).toBe('excused');
      expect(b.excuse_reason).toBe('krank, Mutter hat angerufen');
    });

    // Gegenprobe zum erlaubten Fall: Erfundene Status bleiben verboten.
    it('ein unbekannter Status wird mit 400 abgewiesen', async () => {
      const { eventId, bookingId } = await setupEvent();
      const res = await request(app)
        .put(`/api/events/${eventId}/participants/${bookingId}/attendance`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ attendance_status: 'krank' });

      expect(res.status).toBe(400);
      expect(await buchung(bookingId)).toMatchObject({ attendance_status: null });
    });

    it('present und absent funktionieren unveraendert', async () => {
      const { eventId, bookingId } = await setupEvent();
      await request(app)
        .put(`/api/events/${eventId}/participants/${bookingId}/attendance`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ attendance_status: 'present' });
      expect((await buchung(bookingId)).attendance_status).toBe('present');

      await request(app)
        .put(`/api/events/${eventId}/participants/${bookingId}/attendance`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ attendance_status: 'absent' });
      expect((await buchung(bookingId)).attendance_status).toBe('absent');
    });
  });

  describe('Punkte: excused verhaelt sich wie absent', () => {
    it('excused vergibt keine Punkte', async () => {
      const { eventId, bookingId } = await setupEvent();
      await request(app)
        .put(`/api/events/${eventId}/participants/${bookingId}/attendance`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ attendance_status: 'excused', excuse_reason: 'krank' });

      expect(await punkte(eventId)).toEqual([]);
      expect(await gemeindePunkte()).toBe(0);
    });

    it('bereits vergebene Punkte werden beim Wechsel auf excused abgezogen', async () => {
      const { eventId, bookingId } = await setupEvent({ points: 5 });
      await request(app)
        .put(`/api/events/${eventId}/participants/${bookingId}/attendance`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ attendance_status: 'present' });
      expect(await gemeindePunkte()).toBe(5);

      const res = await request(app)
        .put(`/api/events/${eventId}/participants/${bookingId}/attendance`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ attendance_status: 'excused', excuse_reason: 'doch krank gewesen' });

      expect(res.status).toBe(200);
      expect(res.body.points_removed).toBe(true);
      expect(await punkte(eventId)).toEqual([]);
      expect(await gemeindePunkte()).toBe(0);
    });
  });

  describe('Der Grund haengt am Status', () => {
    it('wird beim Wechsel auf present geleert', async () => {
      // Sonst bliebe "krank" an einer Buchung stehen, die inzwischen auf
      // anwesend steht -- die Kolleginnen laesen einen Widerspruch.
      const { eventId, bookingId } = await setupEvent();
      await request(app)
        .put(`/api/events/${eventId}/participants/${bookingId}/attendance`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ attendance_status: 'excused', excuse_reason: 'krank' });
      expect((await buchung(bookingId)).excuse_reason).toBe('krank');

      await request(app)
        .put(`/api/events/${eventId}/participants/${bookingId}/attendance`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ attendance_status: 'present' });

      expect((await buchung(bookingId)).excuse_reason).toBeNull();
    });

    it('ein Grund ohne excused wird nicht gespeichert', async () => {
      const { eventId, bookingId } = await setupEvent();
      await request(app)
        .put(`/api/events/${eventId}/participants/${bookingId}/attendance`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ attendance_status: 'absent', excuse_reason: 'krank' });

      expect((await buchung(bookingId)).excuse_reason).toBeNull();
    });

    it('leerer Grund wird zu NULL, nicht zu einer leeren Zeichenkette', async () => {
      const { eventId, bookingId } = await setupEvent();
      await request(app)
        .put(`/api/events/${eventId}/participants/${bookingId}/attendance`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ attendance_status: 'excused', excuse_reason: '   ' });

      expect((await buchung(bookingId)).excuse_reason).toBeNull();
    });

    it('sehr lange Gruende werden auf 500 Zeichen gekuerzt', async () => {
      const { eventId, bookingId } = await setupEvent();
      await request(app)
        .put(`/api/events/${eventId}/participants/${bookingId}/attendance`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ attendance_status: 'excused', excuse_reason: 'a'.repeat(900) });

      expect((await buchung(bookingId)).excuse_reason.length).toBe(500);
    });
  });

  describe('Der Vermerk haengt NICHT am Status', () => {
    it('steht auch bei anwesend ("ging um 14 Uhr")', async () => {
      const { eventId, bookingId } = await setupEvent();
      await request(app)
        .put(`/api/events/${eventId}/participants/${bookingId}/attendance`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ attendance_status: 'present', attendance_note: 'ging um 14 Uhr' });

      const b = await buchung(bookingId);
      expect(b.attendance_status).toBe('present');
      expect(b.attendance_note).toBe('ging um 14 Uhr');
    });

    it('die Punkte bleiben trotz Vermerk erhalten', async () => {
      const { eventId, bookingId } = await setupEvent({ points: 5 });
      await request(app)
        .put(`/api/events/${eventId}/participants/${bookingId}/attendance`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ attendance_status: 'present', attendance_note: 'ging um 14 Uhr' });

      expect(await gemeindePunkte()).toBe(5);
    });

    it('ueberlebt einen Statuswechsel, solange nichts Neues geschickt wird', async () => {
      const { eventId, bookingId } = await setupEvent();
      await request(app)
        .put(`/api/events/${eventId}/participants/${bookingId}/attendance`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ attendance_status: 'present', attendance_note: 'ging um 14 Uhr' });

      await request(app)
        .put(`/api/events/${eventId}/participants/${bookingId}/attendance`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ attendance_status: 'absent' });

      const b = await buchung(bookingId);
      expect(b.attendance_status).toBe('absent');
      expect(b.attendance_note).toBe('ging um 14 Uhr');
    });

    it('laesst sich ueberschreiben', async () => {
      const { eventId, bookingId } = await setupEvent();
      await request(app)
        .put(`/api/events/${eventId}/participants/${bookingId}/attendance`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ attendance_status: 'present', attendance_note: 'ging um 14 Uhr' });
      await request(app)
        .put(`/api/events/${eventId}/participants/${bookingId}/attendance`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ attendance_status: 'present', attendance_note: 'ging um 15 Uhr' });

      expect((await buchung(bookingId)).attendance_note).toBe('ging um 15 Uhr');
    });

    it('steht neben einem Abmeldegrund, ohne ihn zu verdraengen', async () => {
      // Zwei getrennte Felder (Entscheidung Simon): beide koennen nebeneinander
      // stehen -- abgemeldet MIT Grund und zusaetzlich ein Vermerk.
      const { eventId, bookingId } = await setupEvent();
      await request(app)
        .put(`/api/events/${eventId}/participants/${bookingId}/attendance`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          attendance_status: 'excused',
          excuse_reason: 'krank, Mutter hat angerufen',
          attendance_note: 'Attest liegt vor'
        });

      const b = await buchung(bookingId);
      expect(b.excuse_reason).toBe('krank, Mutter hat angerufen');
      expect(b.attendance_note).toBe('Attest liegt vor');
    });
  });

  describe('Kein Push bei excused', () => {
    // Entscheidung Simon: Die Abmeldung kam von den Eltern. Eine Mitteilung
    // darueber waere eine Benachrichtigung ueber etwas, das sie selbst
    // veranlasst haben.
    it('excused schickt der Konfi keinen Push', async () => {
      const spy = vi.spyOn(PushService, 'sendEventAttendanceToKonfi').mockResolvedValue(undefined);
      const { eventId, bookingId } = await setupEvent();
      await request(app)
        .put(`/api/events/${eventId}/participants/${bookingId}/attendance`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ attendance_status: 'excused', excuse_reason: 'krank' });

      expect(spy).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it('absent schickt weiterhin einen Push (Gegenprobe)', async () => {
      const spy = vi.spyOn(PushService, 'sendEventAttendanceToKonfi').mockResolvedValue(undefined);
      const { eventId, bookingId } = await setupEvent();
      await request(app)
        .put(`/api/events/${eventId}/participants/${bookingId}/attendance`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ attendance_status: 'absent' });

      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][3]).toBe('absent');
      spy.mockRestore();
    });
  });

  describe('Berechtigungen', () => {
    it('Teamer:innen duerfen abmelden (erlaubter Fall)', async () => {
      const { eventId, bookingId } = await setupEvent();
      const res = await request(app)
        .put(`/api/events/${eventId}/participants/${bookingId}/attendance`)
        .set('Authorization', `Bearer ${teamerToken}`)
        .send({ attendance_status: 'excused', excuse_reason: 'krank' });

      expect(res.status).toBe(200);
      expect((await buchung(bookingId)).attendance_status).toBe('excused');
    });

    it('Konfis duerfen es nicht (verbotener Fall)', async () => {
      const { eventId, bookingId } = await setupEvent();
      const res = await request(app)
        .put(`/api/events/${eventId}/participants/${bookingId}/attendance`)
        .set('Authorization', `Bearer ${konfiToken}`)
        .send({ attendance_status: 'excused', excuse_reason: 'krank' });

      expect(res.status).toBe(403);
      expect((await buchung(bookingId)).attendance_status).toBeNull();
    });
  });

  describe('Die Teilnehmerliste liefert beide Felder mit', () => {
    it('GET /api/events/:id traegt excuse_reason und attendance_note', async () => {
      const { eventId, bookingId } = await setupEvent();
      await request(app)
        .put(`/api/events/${eventId}/participants/${bookingId}/attendance`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          attendance_status: 'excused',
          excuse_reason: 'krank, Mutter hat angerufen',
          attendance_note: 'Attest liegt vor'
        });

      const res = await request(app)
        .get(`/api/events/${eventId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const p = res.body.participants.find(x => x.id === bookingId);
      expect(p.attendance_status).toBe('excused');
      expect(p.excuse_reason).toBe('krank, Mutter hat angerufen');
      expect(p.attendance_note).toBe('Attest liegt vor');
    });
  });
});
