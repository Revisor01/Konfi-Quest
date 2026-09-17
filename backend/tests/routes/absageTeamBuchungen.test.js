// TEAM-BUCHUNGEN FOLGEN BEI EINER ABSAGE DERSELBEN LOGIK WIE KONFI-BUCHUNGEN
//
// Simons Vorgabe (17.09.2026), woertlich:
//   "Ein abgesagtes Event die Team Liste da bleiben die Stat[us]se. Die
//    muessen der Logik von Konfis voll folgen. Auf abgemeldet setzen, bei
//    wieder einrichten, sofort Status zurueck sofern selbst oder fremd
//    abgemeldet. Alle anderen auf angemeldet oder Warteliste je nachdem wie
//    es vorher war. Kein anwesend oder abwesend."
//
// WARUM DIESE DATEI EIN WAECHTER IST UND KEIN FEHLERNACHWEIS:
// meldeAlleAbBeiAbsage und hebeAbsageAbmeldungenAuf (utils/bookingUtils.js)
// arbeiten rollenagnostisch -- sie adressieren `event_bookings` allein ueber
// event_id und status, ohne jede Rollenbedingung. Team-Buchungen fallen
// deshalb bereits unter dieselbe Regel. Die vorhandenen Suiten
// (absageMeldetAb, absageZuruecknehmen, anmeldungAnAbgesagtemTermin) pruefen
// das aber ausschliesslich an Konfi-Buchungen. Ein spaeterer Rollenfilter --
// etwa "Punkte nur fuer Konfis, also auch die Abmeldung nur fuer Konfis" --
// wuerde dort nicht auffallen. Diese Datei haelt die Team-Seite fest.
//
// DIE PUNKTE-ABFRAGE IN meldeAlleAbBeiAbsage FILTERT NICHT AUF KONFIS: Sie
// liest event_points ueber konfi_id -- das ist die Spalte der Punktetabelle,
// nicht ein Rollenfilter auf den Buchungen. Teamer:innen bekommen keine
// Event-Punkte, ihre Zeilen stehen dort schlicht nicht drin. Die Abmeldung
// selbst laeuft in Schritt 3 vollstaendig ohne Rollenbezug.
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, JAHRGAENGE } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-vitest';

// Der Seed fuehrt in Org 1 genau eine Teamer:in. Die Wartelisten- und
// Abmelde-Faelle brauchen mehrere gleichzeitig.
const TEAMER_A = 541;
const TEAMER_B = 542;
const TEAMER_C = 543;
const TEAMER_D = 544;
const TEAMER_E = 545;
const TEAMER_ROLLE = 2; // roles.id der Rolle 'teamer' in Org 1 (seed.js)

function teamerToken(id) {
  return jwt.sign(
    { id, type: 'teamer', display_name: `Teamer ${id}`, organization_id: 1, role_id: TEAMER_ROLLE },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

describe('Absage und Zuruecknahme: Team-Buchungen folgen der Konfi-Logik', () => {
  let app;
  let db;
  let adminToken;
  const tokens = {};

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
    adminToken = generateToken('admin1');

    await db.query(
      `INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id, can_view, can_edit)
       VALUES ($1, $2, true, true)`,
      [USERS.admin1.id, JAHRGAENGE.jahrgang1.id]
    );

    for (const id of [TEAMER_A, TEAMER_B, TEAMER_C, TEAMER_D, TEAMER_E]) {
      await db.query(
        `INSERT INTO users (id, username, password_hash, display_name, role_id, organization_id, is_active)
         VALUES ($1, $2, 'x', $3, $4, 1, true)`,
        [id, `absage_teamer_${id}`, `Teamer ${id}`, TEAMER_ROLLE]
      );
      // Ohne Jahrgangs-Zuweisung weist darfTeamerAnDiesenTermin die Buchung
      // an einem Jahrgangstermin mit 403 ab (Simons Rollen-Regel 08.09.2026).
      await db.query(
        'INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id, can_view) VALUES ($1, $2, true)',
        [id, JAHRGAENGE.jahrgang1.id]
      );
      tokens[id] = teamerToken(id);
    }

    const { invalidateUserCache } = require('../../middleware/rbac');
    [USERS.admin1.id, TEAMER_A, TEAMER_B, TEAMER_C, TEAMER_D, TEAMER_E]
      .forEach(invalidateUserCache);
  });

  // --------------------------------------------------------------
  // Hilfen
  // --------------------------------------------------------------

  /**
   * Termin mit Team-Kontingent. teamerMax steuert, ab wann die Team-
   * Warteliste greift -- Team-Buchungen haben nie einen Zeitslot, die
   * Kapazitaet kommt immer aus events.teamer_max_participants.
   */
  async function termin({ teamerMax = 10, teamerWarteliste = false } = {}) {
    const inZweiWochen = new Date();
    inZweiWochen.setDate(inZweiWochen.getDate() + 14);
    const res = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Konfifreizeit mit Team',
        event_date: inZweiWochen.toISOString(),
        max_participants: 10,
        points: 0,
        teamer_needed: true,
        teamer_max_participants: teamerMax,
        teamer_waitlist_enabled: teamerWarteliste,
        teamer_max_waitlist_size: 10,
        jahrgang_ids: [JAHRGAENGE.jahrgang1.id],
      });
    expect(res.status).toBe(201);
    // Gegenprobe auf die Huelle: Was der Termin ueber das Team-Kontingent
    // sagt, muss auch gespeichert sein -- sonst laeuft der Wartelisten-Fall
    // unten ins Leere, ohne dass es auffiele.
    const { rows: [e] } = await db.query(
      'SELECT teamer_needed, teamer_max_participants, teamer_waitlist_enabled FROM events WHERE id = $1',
      [res.body.id]
    );
    expect(e.teamer_needed).toBe(true);
    expect(e.teamer_max_participants).toBe(teamerMax);
    expect(e.teamer_waitlist_enabled).toBe(teamerWarteliste);
    return res.body.id;
  }

  /** Team-Buchung ueber den normalen Weg: POST /api/events/:id/book. */
  async function bucheTeam(eventId, userId, erwarteterStatus = 201) {
    const res = await request(app)
      .post(`/api/events/${eventId}/book`)
      .set('Authorization', `Bearer ${tokens[userId]}`);
    expect(res.status).toBe(erwarteterStatus);
    return res;
  }

  /** Teamer-Absage ueber den eigenen Weg -> status 'opted_out'. */
  async function teamerSagtAb(eventId, userId, grund = 'Bin im Urlaub') {
    const res = await request(app)
      .post(`/api/teamer/events/${eventId}/zusage`)
      .set('Authorization', `Bearer ${tokens[userId]}`)
      .send({ dabei: false, reason: grund });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('opted_out');
    return res;
  }

  async function buchungsId(eventId, userId) {
    const { rows: [row] } = await db.query(
      'SELECT id FROM event_bookings WHERE event_id = $1 AND user_id = $2',
      [eventId, userId]
    );
    expect(row).toBeTruthy();
    return row.id;
  }

  /** Anwesenheit/Abmeldung durch die Leitung eintragen. */
  async function verbuche(eventId, userId, attendance_status, excuse_reason) {
    const bid = await buchungsId(eventId, userId);
    const res = await request(app)
      .put(`/api/events/${eventId}/participants/${bid}/attendance`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(excuse_reason ? { attendance_status, excuse_reason } : { attendance_status });
    expect(res.status).toBe(200);
    return res;
  }

  async function absagen(eventId, grund = 'Heizung defekt') {
    const res = await request(app)
      .put(`/api/events/${eventId}/cancel`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ cancelled_reason: grund });
    expect(res.status).toBe(200);
    return res;
  }

  async function reaktivieren(eventId) {
    const res = await request(app)
      .put(`/api/events/${eventId}/reaktivieren`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
    expect(res.status).toBe(200);
    return res;
  }

  async function buchung(eventId, userId) {
    const { rows: [row] } = await db.query(
      `SELECT status, attendance_status, excuse_reason, abgemeldet_durch_absage,
              status_vor_absage, attendance_set_by, checkin_quelle
         FROM event_bookings WHERE event_id = $1 AND user_id = $2`,
      [eventId, userId]
    );
    expect(row).toBeTruthy();
    return row;
  }

  // ==================================================================
  // ABSAGEN: alle Team-Buchungen auf abgemeldet
  // ==================================================================
  describe('Termin absagen', () => {
    it('eine Zusage wird abgemeldet, ohne Anwesenheitseintrag', async () => {
      const eventId = await termin();
      await bucheTeam(eventId, TEAMER_A);
      expect((await buchung(eventId, TEAMER_A)).status).toBe('confirmed');

      await absagen(eventId);

      const b = await buchung(eventId, TEAMER_A);
      expect(b.status).toBe('excused');
      expect(b.attendance_status).toBe('excused');
      expect(b.abgemeldet_durch_absage).toBe(true);
      expect(b.status_vor_absage).toBe('confirmed');
      expect(b.excuse_reason).toBe('Heizung defekt');
    });

    it('eine bereits als anwesend verbuchte Team-Buchung faellt mit', async () => {
      const eventId = await termin();
      await bucheTeam(eventId, TEAMER_A);
      await verbuche(eventId, TEAMER_A, 'present');

      const vorher = await buchung(eventId, TEAMER_A);
      expect(vorher.attendance_status).toBe('present');
      expect(vorher.status).toBe('confirmed');

      await absagen(eventId);

      const b = await buchung(eventId, TEAMER_A);
      expect(b.status).toBe('excused');
      // Simons "Kein anwesend oder abwesend": der Eintrag ist weg.
      expect(b.attendance_status).toBe('excused');
      expect(b.status_vor_absage).toBe('confirmed');
      // Die Spuren der alten Verbuchung werden mit abgeraeumt -- sonst
      // behauptete die Teilnehmerliste eine Urheberin fuer eine Anwesenheit,
      // die es nicht mehr gibt.
      expect(b.attendance_set_by).toBeNull();
      expect(b.checkin_quelle).toBeNull();
    });

    it('eine als abwesend verbuchte Team-Buchung ebenso', async () => {
      const eventId = await termin();
      await bucheTeam(eventId, TEAMER_A);
      await verbuche(eventId, TEAMER_A, 'absent');
      expect((await buchung(eventId, TEAMER_A)).attendance_status).toBe('absent');

      await absagen(eventId);

      const b = await buchung(eventId, TEAMER_A);
      expect(b.status).toBe('excused');
      expect(b.attendance_status).toBe('excused');
    });

    it('eine Team-Warteliste wird mit abgemeldet und merkt sich ihren Platz', async () => {
      const eventId = await termin({ teamerMax: 1, teamerWarteliste: true });
      await bucheTeam(eventId, TEAMER_A);
      await bucheTeam(eventId, TEAMER_B);
      expect((await buchung(eventId, TEAMER_A)).status).toBe('confirmed');
      expect((await buchung(eventId, TEAMER_B)).status).toBe('waitlist');

      await absagen(eventId);

      const a = await buchung(eventId, TEAMER_A);
      const b = await buchung(eventId, TEAMER_B);
      expect(a.status).toBe('excused');
      expect(a.status_vor_absage).toBe('confirmed');
      expect(b.status).toBe('excused');
      expect(b.status_vor_absage).toBe('waitlist');
      expect(b.attendance_status).toBe('excused');
    });

    it('wer sich VOR der Absage selbst abgemeldet hat, wird nicht angefasst', async () => {
      const eventId = await termin();
      await bucheTeam(eventId, TEAMER_A);
      await teamerSagtAb(eventId, TEAMER_A, 'Bin im Urlaub');

      await absagen(eventId);

      const b = await buchung(eventId, TEAMER_A);
      expect(b.status).toBe('opted_out');
      expect(b.abgemeldet_durch_absage).toBe(false);
      expect(b.status_vor_absage).toBeNull();
    });

    it('wer VOR der Absage von der Leitung abgemeldet wurde, behaelt seinen Grund', async () => {
      const eventId = await termin();
      await bucheTeam(eventId, TEAMER_A);
      await verbuche(eventId, TEAMER_A, 'excused', 'Krank gemeldet');

      await absagen(eventId);

      const b = await buchung(eventId, TEAMER_A);
      expect(b.status).toBe('excused');
      expect(b.attendance_status).toBe('excused');
      // Der eigene Grund wird NICHT vom Absagegrund ueberschrieben.
      expect(b.excuse_reason).toBe('Krank gemeldet');
      expect(b.abgemeldet_durch_absage).toBe(false);
    });
  });

  // ==================================================================
  // ZURUECKNEHMEN: jede Buchung auf ihren eigenen alten Stand
  // ==================================================================
  describe('Absage zuruecknehmen', () => {
    it('eine Zusage kommt als Zusage zurueck', async () => {
      const eventId = await termin();
      await bucheTeam(eventId, TEAMER_A);
      await absagen(eventId);
      await reaktivieren(eventId);

      const b = await buchung(eventId, TEAMER_A);
      expect(b.status).toBe('confirmed');
      expect(b.attendance_status).toBeNull();
      expect(b.excuse_reason).toBeNull();
      expect(b.abgemeldet_durch_absage).toBe(false);
      expect(b.status_vor_absage).toBeNull();
    });

    it('eine Warteliste kommt als Warteliste zurueck, nicht als Zusage', async () => {
      const eventId = await termin({ teamerMax: 1, teamerWarteliste: true });
      await bucheTeam(eventId, TEAMER_A);
      await bucheTeam(eventId, TEAMER_B);
      await absagen(eventId);
      await reaktivieren(eventId);

      expect((await buchung(eventId, TEAMER_A)).status).toBe('confirmed');
      const b = await buchung(eventId, TEAMER_B);
      expect(b.status).toBe('waitlist');
      expect(b.attendance_status).toBeNull();
      expect(b.status_vor_absage).toBeNull();
    });

    it('kein anwesend oder abwesend kommt zurueck -- die Buchung ist wieder unverbucht', async () => {
      const eventId = await termin();
      await bucheTeam(eventId, TEAMER_A);
      await bucheTeam(eventId, TEAMER_B);
      await verbuche(eventId, TEAMER_A, 'present');
      await verbuche(eventId, TEAMER_B, 'absent');

      await absagen(eventId);
      await reaktivieren(eventId);

      for (const id of [TEAMER_A, TEAMER_B]) {
        const b = await buchung(eventId, id);
        expect(b.status).toBe('confirmed');
        expect(b.attendance_status).toBeNull();
        expect(b.attendance_set_by).toBeNull();
      }
    });

    it('wer sich VOR der Absage selbst abgemeldet hat, bleibt abgemeldet', async () => {
      const eventId = await termin();
      await bucheTeam(eventId, TEAMER_A);
      await teamerSagtAb(eventId, TEAMER_A, 'Bin im Urlaub');

      await absagen(eventId);
      await reaktivieren(eventId);

      const b = await buchung(eventId, TEAMER_A);
      expect(b.status).toBe('opted_out');
      expect(b.attendance_status).toBeNull();
      expect(b.abgemeldet_durch_absage).toBe(false);
    });

    it('wer VOR der Absage von der Leitung abgemeldet wurde, bleibt abgemeldet', async () => {
      const eventId = await termin();
      await bucheTeam(eventId, TEAMER_A);
      await verbuche(eventId, TEAMER_A, 'excused', 'Krank gemeldet');

      await absagen(eventId);
      await reaktivieren(eventId);

      const b = await buchung(eventId, TEAMER_A);
      expect(b.status).toBe('excused');
      expect(b.attendance_status).toBe('excused');
      expect(b.excuse_reason).toBe('Krank gemeldet');
      expect(b.abgemeldet_durch_absage).toBe(false);
    });

    it('der ganze Fall auf einmal: fuenf Team-Buchungen, jede auf ihren eigenen Stand', async () => {
      // Genau Simons Satz in einem Durchlauf: Zusage, Warteliste, verbucht,
      // selbst abgemeldet, von der Leitung abgemeldet.
      const eventId = await termin({ teamerMax: 3, teamerWarteliste: true });
      await bucheTeam(eventId, TEAMER_A); // confirmed
      await bucheTeam(eventId, TEAMER_B); // confirmed, wird verbucht
      await bucheTeam(eventId, TEAMER_C); // confirmed, meldet sich selbst ab
      await bucheTeam(eventId, TEAMER_D); // waitlist
      await bucheTeam(eventId, TEAMER_E); // waitlist, Leitung meldet ab

      await verbuche(eventId, TEAMER_B, 'present');
      await teamerSagtAb(eventId, TEAMER_C, 'Doch nicht');
      await verbuche(eventId, TEAMER_E, 'excused', 'Krank gemeldet');

      // TEAMER_C hat mit seiner Absage einen Platz freigegeben -- TEAMER_D
      // rueckt nach. Das ist der normale Weg und gehoert zum Ausgangsstand.
      expect((await buchung(eventId, TEAMER_D)).status).toBe('confirmed');
      expect((await buchung(eventId, TEAMER_E)).status).toBe('excused');

      await absagen(eventId);

      expect((await buchung(eventId, TEAMER_A)).status).toBe('excused');
      expect((await buchung(eventId, TEAMER_B)).attendance_status).toBe('excused');
      expect((await buchung(eventId, TEAMER_C)).status).toBe('opted_out');
      expect((await buchung(eventId, TEAMER_D)).status_vor_absage).toBe('confirmed');
      expect((await buchung(eventId, TEAMER_E)).abgemeldet_durch_absage).toBe(false);

      await reaktivieren(eventId);

      const a = await buchung(eventId, TEAMER_A);
      expect(a.status).toBe('confirmed');
      expect(a.attendance_status).toBeNull();

      const b = await buchung(eventId, TEAMER_B);
      expect(b.status).toBe('confirmed');
      expect(b.attendance_status).toBeNull();

      const c = await buchung(eventId, TEAMER_C);
      expect(c.status).toBe('opted_out');

      const d = await buchung(eventId, TEAMER_D);
      expect(d.status).toBe('confirmed');
      expect(d.attendance_status).toBeNull();

      const e = await buchung(eventId, TEAMER_E);
      expect(e.status).toBe('excused');
      expect(e.excuse_reason).toBe('Krank gemeldet');
    });
  });
});
