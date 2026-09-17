// EIGENE BUCHUNG IN EINER ANDEREN ORGANISATION (17.09.2026, Simons Befund)
//
// WOERTLICH: "Ich drücke auf dabei. Er zeigt ne Meldung angemeldet. Aber der
// Button ändert sich nicht. Und ich werde nicht in die Team Liste
// eingetragen."
//
// DIE SPUR KAM AUS SIMONS NETZWERKANZEIGE. Der Aufruf ging raus und kam mit
// 200 zurueck -- die Zusage wurde gespeichert. Entscheidend war sein Token:
//
//   "id": 41, "organization_id": 1, "active_organization_id": 4
//   Header: X-Active-Organization: 4
//
// Er arbeitet als Benutzer mit HEIMAT-Org 1 per Org-Wechsel in Org 4. Genau
// deshalb war der Fehler mit einem fest in Org 4 sitzenden Konto nicht
// reproduzierbar -- und meine erste Diagnose ("die Anfrage erreicht den
// Server nicht") war falsch.
//
// DER FEHLER, gegen Produktion nachgemessen: Nach der Zusage lieferte
//
//   GET /api/events        (Liste) -> booking_status 'confirmed'   RICHTIG
//   GET /api/events/:id    (Detail) -> booking_status null          FALSCH
//                                      eigene Zeile fehlt in participants
//
// URSACHE: Die Teilnehmer-Abfrage der Detailroute filtert mit
//
//   WHERE eb.event_id = $1 AND u.organization_id = $2
//
// also ueber die HEIMAT-Organisation in der users-Tabelle -- nicht ueber die
// Buchung. Wer per Org-Wechsel arbeitet, traegt dort eine andere Org als die
// aktive und faellt aus der eigenen Teilnehmerliste heraus. Und weil
// booking_status in derselben Route aus genau diesem Array abgeleitet wird
// (participants.find(p => p.user_id === req.user.id)), ist auch der null.
//
// EINE URSACHE, BEIDE SYMPTOME: Der Knopf liest booking_status und bleibt
// deshalb auf "noch nichts entschieden"; die Team-Liste liest participants
// und zeigt die Person nicht.
//
// RICHTIG IST eb.organization_id: Die Buchung selbst traegt die Organisation
// (Spalte existiert samt Index und Fremdschluessel). Der Org-Riegel BLEIBT
// damit bestehen -- er wird nur an der richtigen Zeile festgemacht.
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

describe('Eigene Buchung bei aktivem Org-Wechsel', () => {
  let app;
  let db;

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
  });

  /**
   * admin1 (id 4, Heimat-Org 1) bekommt zusaetzlich Org 2 -- dieselbe Lage
   * wie bei Simon (Heimat-Org 1, arbeitet in Org 4). Muster aus
   * auth.test.js, "Multi-Org Switcher".
   */
  async function adminMitZweiterOrg() {
    const { invalidateUserCache } = require('../../middleware/rbac');
    await db.query(`INSERT INTO user_organizations (user_id, organization_id, role_id)
      VALUES (4, 1, 3) ON CONFLICT DO NOTHING`);
    await db.query(`INSERT INTO user_organizations (user_id, organization_id, role_id)
      VALUES (4, 2, 7) ON CONFLICT DO NOTHING`);
    invalidateUserCache(4);
  }

  /** Termin in der ZWEITEN Organisation, offen fuer das Team. */
  async function terminInOrgZwei() {
    const inZweiWochen = new Date();
    inZweiWochen.setDate(inZweiWochen.getDate() + 14);
    const { rows: [e] } = await db.query(
      `INSERT INTO events (name, event_date, max_participants, points, point_type,
                           teamer_needed, teamer_max_participants, organization_id)
       VALUES ('Termin in Org 2', $1, 10, 0, 'gemeinde', true, 5, $2)
       RETURNING id`,
      [inZweiWochen, ORGS.andereGemeinde.id]
    );
    return e.id;
  }

  const mitOrg = (req, orgId) => req.set('X-Active-Organization', String(orgId));

  // ----------------------------------------------------------------
  // Der Befund
  // ----------------------------------------------------------------

  it('die eigene Zusage steht danach in der Detailansicht', async () => {
    await adminMitZweiterOrg();
    const token = generateToken('admin1');
    const eventId = await terminInOrgZwei();

    const zusage = await mitOrg(
      request(app)
        .post(`/api/teamer/events/${eventId}/zusage`)
        .set('Authorization', `Bearer ${token}`),
      ORGS.andereGemeinde.id
    ).send({ dabei: true });
    expect(zusage.status).toBe(200);
    expect(zusage.body.status).toBe('confirmed');

    const detail = await mitOrg(
      request(app)
        .get(`/api/events/${eventId}`)
        .set('Authorization', `Bearer ${token}`),
      ORGS.andereGemeinde.id
    );
    expect(detail.status).toBe(200);
    // DAS ist Simons "der Button ändert sich nicht": Der Knopf liest genau
    // dieses Feld.
    expect(detail.body.booking_status).toBe('confirmed');
    expect(detail.body.is_registered).toBe(true);
  });

  it('die eigene Zeile steht in der Teilnehmerliste', async () => {
    // Simons zweite Haelfte: "Und ich werde nicht in die Team Liste
    // eingetragen."
    await adminMitZweiterOrg();
    const token = generateToken('admin1');
    const eventId = await terminInOrgZwei();

    await mitOrg(
      request(app)
        .post(`/api/teamer/events/${eventId}/zusage`)
        .set('Authorization', `Bearer ${token}`),
      ORGS.andereGemeinde.id
    ).send({ dabei: true }).expect(200);

    const detail = await mitOrg(
      request(app)
        .get(`/api/events/${eventId}`)
        .set('Authorization', `Bearer ${token}`),
      ORGS.andereGemeinde.id
    );

    const eigene = (detail.body.participants || []).find(p => p.user_id === USERS.admin1.id);
    expect(eigene).toBeTruthy();
    expect(eigene.status).toBe('confirmed');
  });

  it('Liste und Detailansicht sagen dasselbe', async () => {
    // Der messbare Widerspruch aus Produktion: Die Liste liest den eigenen
    // Stand direkt von der Buchung und lag richtig, die Detailansicht ueber
    // die users-Tabelle und lag falsch.
    await adminMitZweiterOrg();
    const token = generateToken('admin1');
    const eventId = await terminInOrgZwei();

    await mitOrg(
      request(app)
        .post(`/api/teamer/events/${eventId}/zusage`)
        .set('Authorization', `Bearer ${token}`),
      ORGS.andereGemeinde.id
    ).send({ dabei: true }).expect(200);

    const liste = await mitOrg(
      request(app).get('/api/events').set('Authorization', `Bearer ${token}`),
      ORGS.andereGemeinde.id
    );
    const ausListe = liste.body.find(e => e.id === eventId);
    const detail = await mitOrg(
      request(app).get(`/api/events/${eventId}`).set('Authorization', `Bearer ${token}`),
      ORGS.andereGemeinde.id
    );

    expect(ausListe.booking_status).toBe('confirmed');
    expect(detail.body.booking_status).toBe(ausListe.booking_status);
  });

  it('auch die Absage kommt in der Detailansicht an', async () => {
    await adminMitZweiterOrg();
    const token = generateToken('admin1');
    const eventId = await terminInOrgZwei();

    await mitOrg(
      request(app).post(`/api/teamer/events/${eventId}/zusage`).set('Authorization', `Bearer ${token}`),
      ORGS.andereGemeinde.id
    ).send({ dabei: true }).expect(200);
    await mitOrg(
      request(app).post(`/api/teamer/events/${eventId}/zusage`).set('Authorization', `Bearer ${token}`),
      ORGS.andereGemeinde.id
    ).send({ dabei: false, reason: 'Doch verhindert' }).expect(200);

    const detail = await mitOrg(
      request(app).get(`/api/events/${eventId}`).set('Authorization', `Bearer ${token}`),
      ORGS.andereGemeinde.id
    );
    expect(detail.body.booking_status).toBe('opted_out');
    expect(detail.body.is_registered).toBe(false);
  });

  // ----------------------------------------------------------------
  // Der Org-Riegel MUSS bestehen bleiben. Ein Filter an der falschen
  // Stelle ist ein Fehler -- gar kein Filter waere ein Sicherheitsloch.
  // ----------------------------------------------------------------

  describe('Der Org-Riegel bleibt', () => {
    it('ohne Mitgliedschaft in der Ziel-Org: 403', async () => {
      // admin1 bekommt NUR die Heimat-Org, keine zweite.
      const { invalidateUserCache } = require('../../middleware/rbac');
      await db.query(`INSERT INTO user_organizations (user_id, organization_id, role_id)
        VALUES (4, 1, 3) ON CONFLICT DO NOTHING`);
      invalidateUserCache(4);
      const token = generateToken('admin1');
      const eventId = await terminInOrgZwei();

      const res = await mitOrg(
        request(app).get(`/api/events/${eventId}`).set('Authorization', `Bearer ${token}`),
        ORGS.andereGemeinde.id
      );

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Kein Zugriff auf diese Organisation');
    });

    it('die Teilnehmerliste zeigt keine Buchungen aus einer FREMDEN Org', async () => {
      // Der eigentliche Zweck des Filters: Ein Termin in Org 2 darf keine
      // Zeile zeigen, die zu einer Buchung aus Org 1 gehoert. Dass es die
      // technisch gar nicht geben sollte, ist kein Grund, es nicht zu
      // pruefen -- der Filter ist die Absicherung dagegen.
      await adminMitZweiterOrg();
      const token = generateToken('admin1');
      const eventId = await terminInOrgZwei();

      // Eine Buchung mit FALSCHER organization_id einschmuggeln.
      await db.query(
        `INSERT INTO event_bookings (event_id, user_id, status, booking_date, organization_id)
         VALUES ($1, $2, 'confirmed', NOW(), $3)`,
        [eventId, USERS.konfi1.id, ORGS.testGemeinde.id]
      );

      const detail = await mitOrg(
        request(app).get(`/api/events/${eventId}`).set('Authorization', `Bearer ${token}`),
        ORGS.andereGemeinde.id
      );

      const fremde = (detail.body.participants || []).find(p => p.user_id === USERS.konfi1.id);
      expect(fremde).toBeUndefined();
    });
  });
});
