// Von Hand bestaetigen: Kapazitaet und war_auf_warteliste (16.09.2026).
//
// PUT /events/:id/participants/:pid/status auf 'confirmed' hatte KEINE
// Kapazitaetspruefung. Solange nichts automatisch nachrueckte, fiel das nicht
// auf -- die Leitung befoerderte genau die Person, fuer die sie Platz sah.
//
// Seit dem 15.09. rueckt bei jeder Abmeldung und jeder Herabstufung die
// naechste wartende Person automatisch nach. Damit wurde der Umweg, mit dem
// Simon eine Abmeldung rueckgaengig machte ("zurueck auf die Warteliste, dann
// bestaetigen"), zur stillen Ueberbuchung: beim Herabstufen rueckt Y nach,
// beim Bestaetigen kommt X ungeprueft dazu. Zwei auf einem Platz.
//
// Diese Datei haelt den verbotenen Fall (voll -> abgelehnt) UND den erlaubten
// (Platz da -> befoerdert) fest, dazu die Frage, wann war_auf_warteliste
// gesetzt werden darf.
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, JAHRGAENGE } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

describe('Bestaetigen von Hand: Kapazitaet und war_auf_warteliste', () => {
  let app;
  let db;
  let adminToken;

  beforeAll(async () => {
    db = getTestPool();
    app = getTestApp(db);
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    adminToken = generateToken('admin1');
    await db.query(
      'INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id, can_view, can_edit) VALUES ($1, $2, true, true)',
      [USERS.admin1.id, JAHRGAENGE.jahrgang1.id]
    );
    require('../../middleware/rbac').invalidateUserCache(USERS.admin1.id);
  });

  afterAll(async () => {
    await closePool();
  });

  async function termin({ max, teilnehmer }) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 14);
    const createRes = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Kapazitaets-Termin',
        event_date: futureDate.toISOString(),
        max_participants: max,
        points: 0,
        point_type: 'gemeinde',
        waitlist_enabled: true,
        max_waitlist_size: 5
      });
    const eventId = createRes.body.id;
    for (const name of teilnehmer) {
      await request(app)
        .post(`/api/events/${eventId}/book`)
        .set('Authorization', `Bearer ${generateToken(name)}`);
    }
    const { rows } = await db.query(
      'SELECT id, user_id, status, war_auf_warteliste FROM event_bookings WHERE event_id = $1 ORDER BY created_at',
      [eventId]
    );
    return { eventId, buchungen: rows };
  }

  const setzeStatus = (eventId, bookingId, status) =>
    request(app)
      .put(`/api/events/${eventId}/participants/${bookingId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status });

  const lies = async (bookingId) => {
    const { rows } = await db.query(
      'SELECT status, war_auf_warteliste, attendance_status FROM event_bookings WHERE id = $1',
      [bookingId]
    );
    return rows[0];
  };

  describe('Der verbotene Fall: der Termin ist voll', () => {
    it('lehnt das Bestaetigen ab, statt still zu ueberbuchen', async () => {
      // Ein Platz, zwei Leute: konfi1 bestaetigt, konfi2 wartet.
      const { eventId, buchungen } = await termin({ max: 1, teilnehmer: ['konfi1', 'konfi2'] });
      const zwei = buchungen.find((b) => b.user_id === USERS.konfi2.id);
      expect(zwei.status).toBe('waitlist');

      const res = await setzeStatus(eventId, zwei.id, 'confirmed');

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Der Termin ist voll. Erhöhe die Teilnehmerzahl, um weitere Plätze zu vergeben.');
      // Nichts geschrieben: die Wartende wartet weiter.
      expect((await lies(zwei.id)).status).toBe('waitlist');
      const { rows: [zahl] } = await db.query(
        "SELECT COUNT(*)::int AS n FROM event_bookings WHERE event_id = $1 AND status = 'confirmed'",
        [eventId]
      );
      expect(zahl.n).toBe(1);
    });

    it('Simons Umweg kann den Termin nicht mehr ueberbuchen', async () => {
      // Genau Simons Ablauf: ein Platz, konfi1 drauf, konfi2 wartet.
      const { eventId, buchungen } = await termin({ max: 1, teilnehmer: ['konfi1', 'konfi2'] });
      const eins = buchungen.find((b) => b.user_id === USERS.konfi1.id);
      const zwei = buchungen.find((b) => b.user_id === USERS.konfi2.id);

      // Nachgemessen (16.09.2026): Ohne diesen Schritt laeuft der Umweg ins
      // Leere. Das Nachruecken nimmt den AELTESTEN Wartelisten-Eintrag; wird
      // konfi1 herabgestuft, ist das ihr eigener frischer Eintrag -- nur weil
      // konfi1 zuerst gebucht hatte und `created_at` damit vorn liegt. Sie
      // rueckt sich selbst nach, und die Route nimmt das als wirkungslos
      // zurueck. Im Alltag wartet die andere Person laenger, als die
      // bestaetigte auf der Warteliste steht; genau das stellt diese Zeile her.
      await db.query(
        "UPDATE event_bookings SET created_at = NOW() - INTERVAL '1 day' WHERE id = $1",
        [zwei.id]
      );

      // Schritt 1: konfi1 auf die Warteliste. Dabei rueckt konfi2 nach.
      expect((await setzeStatus(eventId, eins.id, 'waitlist')).status).toBe(200);
      expect((await lies(zwei.id)).status).toBe('confirmed');
      expect((await lies(eins.id)).status).toBe('waitlist');

      // Schritt 2: konfi1 wieder bestaetigen -- FRUEHER ging das ungeprueft
      // durch und der Termin hatte zwei Personen auf einem Platz.
      const res = await setzeStatus(eventId, eins.id, 'confirmed');
      expect(res.status).toBe(400);
      expect((await lies(eins.id)).status).toBe('waitlist');

      const { rows: [zahl] } = await db.query(
        "SELECT COUNT(*)::int AS n FROM event_bookings WHERE event_id = $1 AND status = 'confirmed'",
        [eventId]
      );
      expect(zahl.n).toBe(1);
    });
  });

  describe('Der erlaubte Fall: es ist Platz', () => {
    it('befoerdert und merkt sich, dass die Person gewartet hat', async () => {
      // Zwei Plaetze, drei Leute: konfi1 und konfi2 drauf, konfi3 wartet.
      // Danach wird ein Platz frei, indem die Kapazitaet nicht reicht -- also
      // direkt mit Platz: ein Platz, eine Person, die wartet.
      const { eventId, buchungen } = await termin({ max: 2, teilnehmer: ['konfi1', 'konfi2'] });
      const zwei = buchungen.find((b) => b.user_id === USERS.konfi2.id);
      // Erst herabstufen, damit wirklich eine Wartende existiert und ein
      // Platz frei ist (kein anderer rueckt nach, es wartet niemand sonst).
      expect((await setzeStatus(eventId, zwei.id, 'waitlist')).status).toBe(200);
      expect((await lies(zwei.id)).status).toBe('waitlist');

      const res = await setzeStatus(eventId, zwei.id, 'confirmed');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('confirmed');
      const b = await lies(zwei.id);
      expect(b.status).toBe('confirmed');
      // Sie kam wirklich aus der Warteliste -- die Spalte gehoert gesetzt.
      expect(b.war_auf_warteliste).toBe(true);
    });

    it('ein Termin ohne Obergrenze laesst sich weiter frei bestaetigen', async () => {
      // max_participants = 0 heisst "unbegrenzt": Dort gibt es nichts zu
      // ueberschreiten, die Pruefung darf nicht greifen.
      const { eventId, buchungen } = await termin({ max: 0, teilnehmer: ['konfi1', 'konfi2'] });
      const zwei = buchungen.find((b) => b.user_id === USERS.konfi2.id);
      await db.query("UPDATE event_bookings SET status = 'waitlist' WHERE id = $1", [zwei.id]);

      const res = await setzeStatus(eventId, zwei.id, 'confirmed');

      expect(res.status).toBe(200);
      expect((await lies(zwei.id)).status).toBe('confirmed');
    });
  });

  describe('war_auf_warteliste wird nicht faelschlich gesetzt', () => {
    it('bleibt false, wenn die Person nie auf der Warteliste stand', async () => {
      const { eventId, buchungen } = await termin({ max: 10, teilnehmer: ['konfi1'] });
      const eins = buchungen.find((b) => b.user_id === USERS.konfi1.id);
      // Nachgemessen: Wer direkt bestaetigt bucht, bekommt die Spalte gar
      // nicht gesetzt -- sie steht auf NULL, nicht auf false. Der Test haelt
      // den TATSAECHLICHEN Ausgangswert fest, damit unten sichtbar wird, dass
      // ihn niemand auf true dreht.
      expect(eins.war_auf_warteliste).toBeNull();

      // Eine von der Leitung eingetragene Abmeldung setzt status='excused'.
      // Von dort aus zu bestaetigen ist genau Simons Umweg -- die Person hat
      // dabei nie gewartet.
      await request(app)
        .put(`/api/events/${eventId}/participants/${eins.id}/attendance`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ attendance_status: 'excused', excuse_reason: 'krank' });
      expect((await lies(eins.id)).status).toBe('excused');

      const res = await setzeStatus(eventId, eins.id, 'confirmed');

      expect(res.status).toBe(200);
      const b = await lies(eins.id);
      expect(b.status).toBe('confirmed');
      expect(b.war_auf_warteliste).toBeNull();
    });
  });
});
