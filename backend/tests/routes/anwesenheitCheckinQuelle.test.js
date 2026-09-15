// Woher kam die Anwesenheit? (Migration 151, 15.09.2026)
//
// Simon: Eine per QR-Code gesetzte Anwesenheit soll als solche gekennzeichnet
// sein -- "Eingecheckt per QR-Code, 15.09.", nach dem Muster von "Eingetragen
// von Simon Luthe, 13.09.".
//
// Der URHEBER bleibt dabei leer. Das ist keine Luecke, sondern die
// Entscheidung aus Migration 148: Die Konfi checkt sich SELBST ein; traegt man
// sie als Urheberin ein, laese sich die Zeile wie eine Leitungsentscheidung.
// Nur stand der Selbst-Check-in dadurch im selben NULL wie der Altbestand von
// vor der Migration -- zwei verschiedene Sachverhalte, nicht unterscheidbar.
//
// Diese Suite haelt die drei Faelle auseinander:
//
//   checkin_quelle = 'qr'      -> Selbst-Check-in, ohne Urheber
//   checkin_quelle = 'manuell' -> von der Leitung gesetzt, mit Urheber
//   checkin_quelle IS NULL     -> unbekannt (Altbestand), gar nichts
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, JAHRGAENGE } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

describe('Quelle der Anwesenheit: QR-Check-in, manuell, unbekannt', () => {
  let app;
  let db;
  let adminToken;
  let konfiToken;

  beforeAll(async () => {
    db = getTestPool();
    app = getTestApp(db);
  });

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

  afterAll(async () => {
    await closePool();
  });

  async function setupTermin({ points = 5 } = {}) {
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
    expect(createRes.status).toBe(201);
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
      `SELECT attendance_status, attendance_set_by, attendance_set_at,
              checkin_quelle, checked_in_at
         FROM event_bookings WHERE id = $1`,
      [bookingId]
    );
    return rows[0];
  };

  // Der Check-in laeuft nur im Zeitfenster um event_date herum.
  async function checkeEin(eventId) {
    const qrRes = await request(app)
      .post(`/api/events/${eventId}/generate-qr`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(qrRes.status).toBe(200);
    await db.query('UPDATE events SET event_date = NOW() WHERE id = $1', [eventId]);
    return request(app)
      .post('/api/events/qr-checkin')
      .set('Authorization', `Bearer ${konfiToken}`)
      .send({ token: qrRes.body.qr_token });
  }

  describe('Der QR-Check-in haelt seinen Weg fest', () => {
    it('schreibt Quelle und Zeitpunkt, laesst den Urheber aber leer', async () => {
      const { eventId, bookingId } = await setupTermin();

      const res = await checkeEin(eventId);
      expect(res.status).toBe(200);

      const b = await buchung(bookingId);
      expect(b.attendance_status).toBe('present');
      expect(b.checkin_quelle).toBe('qr');
      expect(b.checked_in_at).not.toBeNull();
      // Die Entscheidung aus Migration 148 bleibt bestehen: kein Name.
      expect(b.attendance_set_by).toBeNull();
      expect(b.attendance_set_at).toBeNull();
    });

    it('der Zeitpunkt liegt um den Check-in herum, nicht irgendwo', async () => {
      // BEIDE Grenzen aus der DATENBANK-Uhr, nicht aus der von Node: Die
      // Spalte wird mit NOW() gefuellt, und zwischen Postgres im Container
      // und dem Testprozess liegen gemessen ~140 ms. Gegen new Date() im Test
      // verglichen fiel diese Erwartung sporadisch, obwohl der Code richtig
      // ist -- ein Uhrenvergleich, kein Fehler. Innerhalb einer Uhr ist die
      // Aussage dieselbe und die Grenze kann eng bleiben.
      const { eventId, bookingId } = await setupTermin();
      const { rows: [{ jetzt: vorher }] } = await db.query('SELECT NOW() AS jetzt');

      await checkeEin(eventId);

      const { rows: [{ jetzt: nachher }] } = await db.query('SELECT NOW() AS jetzt');
      const b = await buchung(bookingId);
      const gesetzt = new Date(b.checked_in_at).getTime();
      expect(gesetzt).toBeGreaterThanOrEqual(new Date(vorher).getTime());
      expect(gesetzt).toBeLessThanOrEqual(new Date(nachher).getTime());
    });

    it('die Teilnehmerliste liefert Quelle und Zeitpunkt aus', async () => {
      const { eventId, bookingId } = await setupTermin();
      await checkeEin(eventId);

      const res = await request(app)
        .get(`/api/events/${eventId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      const teilnehmer = res.body.participants.find(p => p.id === bookingId);
      expect(teilnehmer.checkin_quelle).toBe('qr');
      expect(teilnehmer.checked_in_at).not.toBeNull();
      expect(teilnehmer.attendance_set_by_name).toBeNull();
    });
  });

  describe('Manuell eingetragen ist nachweisbar etwas anderes', () => {
    it('die Einzelroute setzt die Quelle auf manuell -- mit Urheber', async () => {
      const { eventId, bookingId } = await setupTermin();

      const res = await request(app)
        .put(`/api/events/${eventId}/participants/${bookingId}/attendance`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ attendance_status: 'present' });
      expect(res.status).toBe(200);

      const b = await buchung(bookingId);
      expect(b.checkin_quelle).toBe('manuell');
      expect(b.checked_in_at).not.toBeNull();
      expect(b.attendance_set_by).toBe(USERS.admin1.id);
    });

    it('"Alle verbuchen" setzt die Quelle ebenfalls auf manuell', async () => {
      const { eventId, bookingId } = await setupTermin();

      const res = await request(app)
        .put(`/api/events/${eventId}/participants/attendance-all`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});
      expect(res.status).toBe(200);

      const b = await buchung(bookingId);
      expect(b.attendance_status).toBe('present');
      expect(b.checkin_quelle).toBe('manuell');
      expect(b.attendance_set_by).toBe(USERS.admin1.id);
    });

    it('ein manueller Eintrag NACH dem QR-Check-in ueberschreibt die Quelle', async () => {
      // Sonst stuenden "Eingecheckt per QR-Code" und "Eingetragen von Simon
      // Luthe" untereinander und widersprechen sich. Es gilt, was zuletzt
      // gesetzt wurde.
      const { eventId, bookingId } = await setupTermin();
      await checkeEin(eventId);
      expect((await buchung(bookingId)).checkin_quelle).toBe('qr');

      await request(app)
        .put(`/api/events/${eventId}/participants/${bookingId}/attendance`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ attendance_status: 'excused', excuse_reason: 'doch krank' });

      const b = await buchung(bookingId);
      expect(b.checkin_quelle).toBe('manuell');
      expect(b.attendance_set_by).toBe(USERS.admin1.id);
    });

    it('eine nachgetragene NOTIZ allein aendert die Quelle nicht', async () => {
      // Ein Vermerk macht aus einem Selbst-Check-in keine
      // Leitungsentscheidung. Die Quelle haengt am Status, nicht an der Notiz.
      const { eventId, bookingId } = await setupTermin();
      await checkeEin(eventId);

      await request(app)
        .put(`/api/events/${eventId}/participants/${bookingId}/attendance`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ attendance_status: 'present', attendance_note: 'ging um 14 Uhr' });

      const b = await buchung(bookingId);
      expect(b.checkin_quelle).toBe('qr');
      expect(b.attendance_set_by).toBeNull();
    });
  });

  describe('Altbestand bleibt unbekannt', () => {
    it('beide Felder NULL: weder Urheber noch Quelle, und die Buchung bleibt in der Liste', async () => {
      // Buchungen von vor Migration 151. Kein Backfill -- rueckwirkend ist
      // der Weg nicht rekonstruierbar. Die Anzeige erzeugt daraus KEINE
      // Zeile, weder "Eingetragen von" noch "Eingecheckt per QR-Code".
      const { eventId, bookingId } = await setupTermin();
      await db.query(
        `UPDATE event_bookings
            SET attendance_status = 'present', attendance_set_by = NULL,
                attendance_set_at = NULL, checkin_quelle = NULL, checked_in_at = NULL
          WHERE id = $1`,
        [bookingId]
      );

      const res = await request(app)
        .get(`/api/events/${eventId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      const teilnehmer = res.body.participants.find(p => p.id === bookingId);
      expect(teilnehmer).toBeDefined();
      expect(teilnehmer.attendance_status).toBe('present');
      expect(teilnehmer.attendance_set_by_name).toBeNull();
      expect(teilnehmer.checkin_quelle).toBeNull();
      expect(teilnehmer.checked_in_at).toBeNull();
    });

    it('eine unangetastete Buchung traegt gar keine Quelle', async () => {
      const { eventId, bookingId } = await setupTermin();
      const res = await request(app)
        .get(`/api/events/${eventId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      const teilnehmer = res.body.participants.find(p => p.id === bookingId);
      expect(teilnehmer.attendance_status).toBeNull();
      expect(teilnehmer.checkin_quelle).toBeNull();
    });
  });

  describe('Die Datenbank laesst nur bekannte Wege zu', () => {
    it('ein erfundener Wert wird abgewiesen', async () => {
      // Sonst schriebe irgendwann eine neue Stelle 'QR' oder 'scan' hinein
      // und die Anzeige liesse die Zeile still weg.
      const { bookingId } = await setupTermin();
      await expect(
        db.query("UPDATE event_bookings SET checkin_quelle = 'scan' WHERE id = $1", [bookingId])
      ).rejects.toThrow();
    });
  });
});
