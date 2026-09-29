// ABSAGE MIT OPT-OUT: AUCH SIE WIRD ENTSCHULDIGT (Entscheidung Simon, 29.09.2026)
//
// Der Fall aus dem Audit (Punkte/Termine, Abschnitt „Unklar", Nachtrag Paket E
// vom 29.09.2026): Eine Konfi meldet sich von einem Pflichttermin ab
// ('opted_out'), kommt doch, und die Leitung verbucht sie auf 'present'. Wird
// der Termin danach abgesagt, setzte meldeAlleAbBeiAbsage alle Angemeldeten
// auf „entschuldigt (Absage)" -- nur sie nicht: Die Auswahl fasste allein
// 'confirmed'/'waitlist'. Sie blieb 'present', und der abgesagte Termin zählte
// bei ihr als besuchter Pflichttermin (mandatory_event_count).
//
// Simon: „Auch sie wird entschuldigt." Das Opt-out bleibt sichtbar: Der
// Buchungsstatus bleibt 'opted_out' samt ihrem Grund, nur die Verbuchung
// wird zu „entschuldigt" mit dem Absagegrund. Wird die Absage
// zurückgenommen, steht sie wieder als Selbstabmeldung ohne Verbuchung da --
// und bekommt keinen „Du bist wieder angemeldet"-Push, denn angemeldet war
// sie nicht.
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, JAHRGAENGE } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const PushService = require('../../services/pushService');
const { getKonfiBadgeProgress } = require('../../utils/konfiBadgeProgress');

describe('Absage mit Opt-out: auch eine verbuchte Selbstabmeldung wird entschuldigt', () => {
  let app, db, adminToken;

  beforeAll(() => { db = getTestPool(); app = getTestApp(db); });
  afterAll(async () => { await closePool(); });
  afterEach(() => { vi.restoreAllMocks(); });

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

  // Pflichttermin im jahrgang1 -- nur dort gibt es den Konfi-Opt-out.
  async function pflichttermin() {
    const { rows: [event] } = await db.query(
      `INSERT INTO events (name, event_date, organization_id, mandatory, max_participants,
                           point_type, points, cancelled)
       VALUES ('Gottesdienst Pflicht', NOW() - interval '1 hour', $1, true, 20, 'gottesdienst', 0, false)
       RETURNING id`,
      [ORGS.testGemeinde.id]
    );
    await db.query(
      'INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) VALUES ($1, $2)',
      [event.id, JAHRGAENGE.jahrgang1.id]
    );
    return event.id;
  }

  async function bucht(eventId, userId, status, optOutGrund = null) {
    const { rows: [b] } = await db.query(
      `INSERT INTO event_bookings (user_id, event_id, status, organization_id, opt_out_reason, opt_out_date)
       VALUES ($1, $2, $3, $4, $5, CASE WHEN $5::text IS NULL THEN NULL ELSE NOW() END) RETURNING id`,
      [userId, eventId, status, ORGS.testGemeinde.id, optOutGrund]
    );
    return b.id;
  }

  // Verbuchen über den echten Weg der Leitung (routes/events/anwesenheit.js):
  // Er lässt 'opted_out' stehen und trägt Urheber und Quelle ein.
  async function verbuche(eventId, bookingId, attendance_status, excuse_reason) {
    const res = await request(app)
      .put(`/api/events/${eventId}/participants/${bookingId}/attendance`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send(excuse_reason ? { attendance_status, excuse_reason } : { attendance_status });
    expect(res.status).toBe(200);
  }

  const absagen = (eventId, grund = 'Heizung defekt') =>
    request(app)
      .put(`/api/events/${eventId}/cancel`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ cancelled_reason: grund });

  const buchung = async (eventId, userId) => {
    const { rows: [row] } = await db.query(
      `SELECT status, attendance_status, excuse_reason, opt_out_reason, abgemeldet_durch_absage,
              status_vor_absage, attendance_set_by, checkin_quelle, checked_in_at
         FROM event_bookings WHERE event_id = $1 AND user_id = $2`,
      [eventId, userId]
    );
    return row;
  };

  // Die Ausgangslage aus dem Audit: konfi1 abgemeldet, doch gekommen und
  // verbucht; konfi2 regulär angemeldet und anwesend.
  async function ausgangslage(verbuchung = 'present') {
    const eventId = await pflichttermin();
    const optOutId = await bucht(eventId, USERS.konfi1.id, 'opted_out', 'Bin im Urlaub');
    const regulaerId = await bucht(eventId, USERS.konfi2.id, 'confirmed');
    await verbuche(eventId, optOutId, verbuchung);
    await verbuche(eventId, regulaerId, 'present');

    // Gegenprobe zur Ausgangslage: Die Verbuchung hat das Opt-out stehen lassen.
    const vorher = await buchung(eventId, USERS.konfi1.id);
    expect(vorher.status).toBe('opted_out');
    expect(vorher.attendance_status).toBe(verbuchung);
    expect(vorher.attendance_set_by).toBe(USERS.admin1.id);
    expect(vorher.checkin_quelle).toBe('manuell');
    return eventId;
  }

  describe('Absagen', () => {
    it('setzt eine als anwesend verbuchte Selbstabmeldung auf entschuldigt mit dem Absagegrund', async () => {
      const eventId = await ausgangslage('present');

      expect((await absagen(eventId)).status).toBe(200);

      const b = await buchung(eventId, USERS.konfi1.id);
      expect(b.attendance_status).toBe('excused');
      expect(b.excuse_reason).toBe('Heizung defekt');
      expect(b.abgemeldet_durch_absage).toBe(true);
      // Die Absage beurteilt keine Anwesenheit -- die Spuren der alten
      // Verbuchung gehen mit, wie bei den regulär Angemeldeten.
      expect(b.attendance_set_by).toBeNull();
      expect(b.checkin_quelle).toBeNull();
      expect(b.checked_in_at).toBeNull();
    });

    it('lässt das Opt-out sichtbar: Status bleibt opted_out, ihr Grund bleibt stehen', async () => {
      const eventId = await ausgangslage('present');

      expect((await absagen(eventId)).status).toBe(200);

      const b = await buchung(eventId, USERS.konfi1.id);
      expect(b.status).toBe('opted_out');
      expect(b.opt_out_reason).toBe('Bin im Urlaub');
      // status_vor_absage kennt nur 'confirmed'/'waitlist' (Migration 155);
      // das Opt-out steht ohnehin weiter in status.
      expect(b.status_vor_absage).toBeNull();

      // Die regulär Angemeldete zum Vergleich: wie bisher.
      const r = await buchung(eventId, USERS.konfi2.id);
      expect(r.status).toBe('excused');
      expect(r.attendance_status).toBe('excused');
      expect(r.status_vor_absage).toBe('confirmed');
    });

    it('zählt den abgesagten Termin nicht mehr als besuchten Pflichttermin', async () => {
      const eventId = await ausgangslage('present');
      await db.query(
        `INSERT INTO custom_badges (name, criteria_type, criteria_value, organization_id, target_role, is_active, icon, color)
         VALUES ('Pflichtbewusst', 'mandatory_event_count', 3, $1, 'konfi', true, 'star', '#000000')`,
        [ORGS.testGemeinde.id]
      );
      const fortschritt = async () => {
        const { available } = await getKonfiBadgeProgress(db, USERS.konfi1.id, ORGS.testGemeinde.id);
        return available.find((badge) => badge.name === 'Pflichtbewusst').progress.current;
      };
      // Gegenprobe: vor der Absage zählt die Teilnahme.
      expect(await fortschritt()).toBe(1);

      expect((await absagen(eventId)).status).toBe(200);

      expect(await fortschritt()).toBe(0);
    });

    it('setzt auch eine als abwesend verbuchte Selbstabmeldung auf entschuldigt', async () => {
      const eventId = await ausgangslage('absent');

      expect((await absagen(eventId)).status).toBe(200);

      const b = await buchung(eventId, USERS.konfi1.id);
      expect(b.status).toBe('opted_out');
      expect(b.attendance_status).toBe('excused');
      expect(b.excuse_reason).toBe('Heizung defekt');
      expect(b.abgemeldet_durch_absage).toBe(true);
    });

    it('lässt eine unverbuchte Selbstabmeldung unangetastet', async () => {
      const eventId = await pflichttermin();
      await bucht(eventId, USERS.konfi1.id, 'opted_out', 'Bin im Urlaub');

      expect((await absagen(eventId)).status).toBe(200);

      const b = await buchung(eventId, USERS.konfi1.id);
      expect(b.status).toBe('opted_out');
      expect(b.attendance_status).toBeNull();
      expect(b.excuse_reason).toBeNull();
      expect(b.abgemeldet_durch_absage).toBe(false);
    });

    it('überschreibt eine von der Leitung schon eingetragene Entschuldigung mit eigenem Grund nicht', async () => {
      const eventId = await pflichttermin();
      const optOutId = await bucht(eventId, USERS.konfi1.id, 'opted_out', 'Bin im Urlaub');
      await verbuche(eventId, optOutId, 'excused', 'krank, Mutter hat angerufen');

      expect((await absagen(eventId)).status).toBe(200);

      const b = await buchung(eventId, USERS.konfi1.id);
      expect(b.status).toBe('opted_out');
      expect(b.attendance_status).toBe('excused');
      expect(b.excuse_reason).toBe('krank, Mutter hat angerufen');
      expect(b.attendance_set_by).toBe(USERS.admin1.id);
      expect(b.abgemeldet_durch_absage).toBe(false);
    });

    it('trägt einen später korrigierten Absagegrund auch bei ihr nach', async () => {
      const eventId = await ausgangslage('present');
      expect((await absagen(eventId, 'Heizng defket')).status).toBe(200);

      const res = await request(app)
        .put(`/api/events/${eventId}/absagegrund`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ cancelled_reason: 'Heizung defekt' });
      expect(res.status).toBe(200);

      expect((await buchung(eventId, USERS.konfi1.id)).excuse_reason).toBe('Heizung defekt');
    });
  });

  describe('Absage zurücknehmen', () => {
    it('stellt sie als Selbstabmeldung ohne Verbuchung wieder her, nicht als Angemeldete', async () => {
      const eventId = await ausgangslage('present');
      expect((await absagen(eventId)).status).toBe(200);

      const res = await request(app)
        .put(`/api/events/${eventId}/reaktivieren`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});
      expect(res.status).toBe(200);

      const b = await buchung(eventId, USERS.konfi1.id);
      expect(b.status).toBe('opted_out');
      expect(b.opt_out_reason).toBe('Bin im Urlaub');
      expect(b.attendance_status).toBeNull();
      expect(b.excuse_reason).toBeNull();
      expect(b.abgemeldet_durch_absage).toBe(false);
      // Die regulär Angemeldete ist wieder angemeldet.
      expect((await buchung(eventId, USERS.konfi2.id)).status).toBe('confirmed');
    });

    it('lässt eine Verbuchung stehen, die die Leitung nach der Absage selbst eingetragen hat', async () => {
      // „Abmelden ist die Voreinstellung, nicht das Ende" (Simon, 15.09.2026):
      // Die Leitung setzt sie nach der Absage wieder auf anwesend. Das ist
      // eine Einzelentscheidung -- das Zurücknehmen darf sie nicht kassieren,
      // und ein korrigierter Absagegrund gehört nicht mehr an ihre Zeile.
      const eventId = await ausgangslage('present');
      expect((await absagen(eventId)).status).toBe(200);
      const { rows: [{ id: optOutId }] } = await db.query(
        'SELECT id FROM event_bookings WHERE event_id = $1 AND user_id = $2',
        [eventId, USERS.konfi1.id]
      );
      await verbuche(eventId, optOutId, 'present');

      const nachVerbuchung = await buchung(eventId, USERS.konfi1.id);
      expect(nachVerbuchung.status).toBe('opted_out');
      expect(nachVerbuchung.attendance_status).toBe('present');
      expect(nachVerbuchung.abgemeldet_durch_absage).toBe(false);

      const grund = await request(app)
        .put(`/api/events/${eventId}/absagegrund`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ cancelled_reason: 'Sturm' });
      expect(grund.status).toBe(200);
      expect((await buchung(eventId, USERS.konfi1.id)).excuse_reason).toBeNull();

      const res = await request(app)
        .put(`/api/events/${eventId}/reaktivieren`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});
      expect(res.status).toBe(200);
      const b = await buchung(eventId, USERS.konfi1.id);
      expect(b.status).toBe('opted_out');
      expect(b.attendance_status).toBe('present');
    });

    it('schickt ihr keinen „wieder angemeldet"-Push und zählt sie nicht als wieder angemeldet', async () => {
      const eventId = await ausgangslage('present');
      expect((await absagen(eventId)).status).toBe(200);

      // Die Rückfrage vor dem Zurücknehmen nennt die Zahl aus dieser Angabe.
      const detail = await request(app)
        .get(`/api/events/${eventId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(detail.status).toBe(200);
      expect(detail.body.durch_absage_abgemeldet_count).toBe(1);

      const push = vi.spyOn(PushService, 'sendEventReactivationToKonfis').mockResolvedValue(undefined);
      const res = await request(app)
        .put(`/api/events/${eventId}/reaktivieren`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});
      expect(res.status).toBe(200);
      expect(res.body.reaktiviert).toBe(1);
      expect(res.body.participants_notified).toBe(1);
      expect(push).toHaveBeenCalledTimes(1);
      expect(push.mock.calls[0][1]).toEqual([USERS.konfi2.id]);
    });
  });
});
