// backend/tests/routes/terminAnmeldeStatus.test.js
//
// Der Anmeldestatus eines Termins und seine Zeitfenster wurden bis zum
// 01.09.2026 an mehreren Stellen getrennt in SQL ausgerechnet:
//   registration_status  — dreimal (Leitungsliste, Konfi-Liste, Konfi-Detail)
//   Zeitfenster-Query    — zweimal (Leitung und Konfi), Zeichen fuer Zeichen gleich
//
// Beim Anmeldestatus ist das zweimal nachweislich auseinandergelaufen, jedes
// Mal sichtbar fuer Nutzer:innen:
//   25.08.2026 — der `> 0`-Guard und der 'mandatory'-Zweig fehlten in den
//                Konfi-Fassungen (Prod-Event 150 "Gemeindeversammlung")
//   27.08.2026 — der 'cancelled'-Zweig fehlte im Konfi-Detail
//
// Diese Datei sichert das Ergebnis der Zusammenlegung ab: Sie prueft nicht
// nur, dass jede Ansicht fuer sich das Richtige sagt (das tun konfi.test.js
// und events.test.js), sondern dass ALLE Ansichten fuer DENSELBEN Termin
// DASSELBE sagen. Genau das war jedes Mal die eigentliche Panne.
const request = require('supertest');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { getTestApp } = require('../helpers/testApp');
const { generateToken } = require('../helpers/auth');
const { seed, ORGS, JAHRGAENGE, USERS } = require('../helpers/seed');

describe('Anmeldestatus und Zeitfenster: eine Rechnung fuer alle Ansichten', () => {
  let db;
  let app;
  let konfiToken;
  let adminToken;

  beforeAll(async () => {
    db = getTestPool();
    app = getTestApp(db);
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    konfiToken = generateToken('konfi1');
    adminToken = generateToken('admin1');
  });

  afterAll(async () => {
    await closePool();
  });

  /**
   * Legt einen Termin an, den BEIDE Rollen sehen: dem Jahrgang der Konfi
   * zugewiesen, nicht teamer_only. Damit ist er in allen drei Ansichten
   * abrufbar und die Zahlen sind vergleichbar.
   */
  async function termin(felder = {}) {
    const {
      mandatory = false,
      cancelled = false,
      max_participants = 10,
      waitlist_enabled = false,
      max_waitlist_size = 0,
      has_timeslots = false,
      oeffnet = "NOW() - interval '1 day'",
      schliesst = "NOW() + interval '7 days'"
    } = felder;

    const { rows } = await db.query(
      `INSERT INTO events (name, event_date, organization_id, mandatory, cancelled,
                           max_participants, waitlist_enabled, max_waitlist_size,
                           has_timeslots, point_type, points,
                           registration_opens_at, registration_closes_at)
       VALUES ('Vergleichstermin', NOW() + interval '14 days', $1, $2, $3,
               $4, $5, $6, $7, 'gemeinde', 1, ${oeffnet}, ${schliesst})
       RETURNING id`,
      [ORGS.testGemeinde.id, mandatory, cancelled, max_participants,
        waitlist_enabled, max_waitlist_size, has_timeslots]
    );
    const id = rows[0].id;
    await db.query(
      'INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [id, JAHRGAENGE.jahrgang1.id]
    );
    return id;
  }

  /** Fuellt einen Termin mit bestaetigten Konfi-Buchungen fremder Konfis. */
  async function belege(eventId, anzahl, status = 'confirmed') {
    for (let i = 0; i < anzahl; i++) {
      const { rows } = await db.query(
        `INSERT INTO users (username, display_name, password_hash, organization_id, role_id)
         VALUES ($1, $1, 'x', $2, 1) RETURNING id`,
        [`fuellkonfi_${eventId}_${status}_${i}`, ORGS.testGemeinde.id]
      );
      await db.query(
        `INSERT INTO event_bookings (event_id, user_id, status, organization_id)
         VALUES ($1, $2, $3, $4)`,
        [eventId, rows[0].id, status, ORGS.testGemeinde.id]
      );
    }
  }

  /** Anmeldestatus aus der Leitungsliste GET /events. */
  async function statusLeitungsliste(eventId) {
    const res = await request(app)
      .get('/api/events?all=true')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const evt = res.body.find(e => e.id === eventId);
    expect(evt, `Termin ${eventId} fehlt in der Leitungsliste`).toBeTruthy();
    return evt.registration_status;
  }

  /** Anmeldestatus aus der Konfi-Liste GET /konfi/events. */
  async function statusKonfiListe(eventId) {
    const res = await request(app)
      .get('/api/konfi/events?all=true')
      .set('Authorization', `Bearer ${konfiToken}`);
    expect(res.status).toBe(200);
    const evt = res.body.find(e => e.id === eventId);
    expect(evt, `Termin ${eventId} fehlt in der Konfi-Liste`).toBeTruthy();
    return evt.registration_status;
  }

  /** Anmeldestatus aus dem Konfi-Detail GET /konfi/events/:id/status. */
  async function statusKonfiDetail(eventId) {
    const res = await request(app)
      .get(`/api/konfi/events/${eventId}/status`)
      .set('Authorization', `Bearer ${konfiToken}`);
    expect(res.status).toBe(200);
    return res.body.event_status;
  }

  // ================================================================
  // Die drei Ansichten sind sich einig — in genau den Faellen, in denen
  // sie es historisch NICHT waren.
  // ================================================================
  describe('registration_status: alle drei Ansichten liefern denselben Wert', () => {
    // Prod-Event 150: max_participants = 0 heisst UNBEGRENZT. Ohne den
    // `> 0`-Guard war `0 >= 0` wahr -- die Konfi-Ansichten meldeten 'closed',
    // die Leitungsliste desselben Termins 'open'. Der Anmelden-Knopf
    // verschwand fuer Konfis bei einem Termin, dessen Buchung angenommen
    // worden waere.
    it('unbegrenzt (max=0) ohne Warteliste: dreimal open', async () => {
      const id = await termin({ max_participants: 0, waitlist_enabled: false });

      expect(await statusLeitungsliste(id)).toBe('open');
      expect(await statusKonfiListe(id)).toBe('open');
      expect(await statusKonfiDetail(id)).toBe('open');
    });

    // Pflichttermine haben immer max=0 und keine Warteliste. Ohne den
    // 'mandatory'-Zweig fielen sie in den Ausgebucht-Fall.
    it('Pflichttermin: dreimal mandatory', async () => {
      const id = await termin({ mandatory: true, max_participants: 0 });

      expect(await statusLeitungsliste(id)).toBe('mandatory');
      expect(await statusKonfiListe(id)).toBe('mandatory');
      expect(await statusKonfiDetail(id)).toBe('mandatory');
    });

    // Befund H6, 27.08.2026: Dem Konfi-Detail fehlte der 'cancelled'-Zweig.
    // Ein abgesagter PFLICHTtermin waere dort als 'mandatory' erschienen,
    // waehrend die Leitungsliste 'cancelled' meldete -- 'cancelled' muss VOR
    // 'mandatory' greifen, sonst schlaegt die Pflicht die Absage.
    it('abgesagter Pflichttermin: dreimal cancelled, nicht mandatory', async () => {
      const id = await termin({ cancelled: true, mandatory: true, max_participants: 0 });
      // Abgesagte Termine liefert die Konfi-Sicht nur, wenn die Konfi
      // angemeldet war (bewusst, damit sie die Absage sieht).
      await db.query(
        `INSERT INTO event_bookings (event_id, user_id, status, organization_id)
         VALUES ($1, $2, 'confirmed', $3)`,
        [id, USERS.konfi1.id, ORGS.testGemeinde.id]
      );

      expect(await statusLeitungsliste(id)).toBe('cancelled');
      expect(await statusKonfiListe(id)).toBe('cancelled');
      expect(await statusKonfiDetail(id)).toBe('cancelled');
    });

    it('Kontingent voll, Warteliste aus: dreimal closed', async () => {
      const id = await termin({ max_participants: 2, waitlist_enabled: false });
      await belege(id, 2);

      expect(await statusLeitungsliste(id)).toBe('closed');
      expect(await statusKonfiListe(id)).toBe('closed');
      expect(await statusKonfiDetail(id)).toBe('closed');
    });

    // Voll, aber die Warteliste hat noch Platz -> weiterhin 'open', damit der
    // Anmelden-Knopf bleibt und die Buchung auf der Warteliste landet.
    it('Kontingent voll, Warteliste offen: dreimal open', async () => {
      const id = await termin({ max_participants: 2, waitlist_enabled: true, max_waitlist_size: 5 });
      await belege(id, 2);

      expect(await statusLeitungsliste(id)).toBe('open');
      expect(await statusKonfiListe(id)).toBe('open');
      expect(await statusKonfiDetail(id)).toBe('open');
    });

    it('Kontingent voll und Warteliste voll: dreimal closed', async () => {
      const id = await termin({ max_participants: 2, waitlist_enabled: true, max_waitlist_size: 1 });
      await belege(id, 2, 'confirmed');
      await belege(id, 1, 'waitlist');

      expect(await statusLeitungsliste(id)).toBe('closed');
      expect(await statusKonfiListe(id)).toBe('closed');
      expect(await statusKonfiDetail(id)).toBe('closed');
    });

    it('Anmeldung oeffnet erst spaeter: dreimal upcoming', async () => {
      const id = await termin({
        oeffnet: "NOW() + interval '2 days'",
        schliesst: "NOW() + interval '9 days'"
      });

      expect(await statusLeitungsliste(id)).toBe('upcoming');
      expect(await statusKonfiListe(id)).toBe('upcoming');
      expect(await statusKonfiDetail(id)).toBe('upcoming');
    });

    it('Anmeldefrist vorbei: dreimal closed', async () => {
      const id = await termin({
        oeffnet: "NOW() - interval '9 days'",
        schliesst: "NOW() - interval '1 day'"
      });

      expect(await statusLeitungsliste(id)).toBe('closed');
      expect(await statusKonfiListe(id)).toBe('closed');
      expect(await statusKonfiDetail(id)).toBe('closed');
    });

    // Bei Terminen mit Zeitfenstern ist die wirksame Kapazitaet die SUMME der
    // Fenster-Kapazitaeten, nicht events.max_participants. Waere das in einer
    // der Fassungen anders, liefen die Ansichten genau hier auseinander.
    it('Zeitfenster-Termin: Kapazitaet ist die Summe der Fenster, dreimal gleich', async () => {
      const id = await termin({ has_timeslots: true, max_participants: 99 });
      await db.query(
        `INSERT INTO event_timeslots (event_id, start_time, end_time, max_participants, organization_id)
         VALUES ($1, NOW() + interval '14 days', NOW() + interval '14 days' + interval '1 hour', 1, $2),
                ($1, NOW() + interval '14 days' + interval '2 hours', NOW() + interval '14 days' + interval '3 hours', 1, $2)`,
        [id, ORGS.testGemeinde.id]
      );
      // 2 Plaetze in den Fenstern (nicht 99) -> mit 2 Buchungen voll.
      await belege(id, 2);

      expect(await statusLeitungsliste(id)).toBe('closed');
      expect(await statusKonfiListe(id)).toBe('closed');
      expect(await statusKonfiDetail(id)).toBe('closed');
    });
  });

  // ================================================================
  // Zeitfenster: beide Routen, eine Rechnung
  // ================================================================
  describe('Zeitfenster: Leitung und Konfi bekommen dieselbe Antwort', () => {
    async function terminMitFenstern() {
      const id = await termin({ has_timeslots: true, max_participants: 20 });
      const { rows } = await db.query(
        `INSERT INTO event_timeslots (event_id, start_time, end_time, max_participants, organization_id)
         VALUES ($1, NOW() + interval '14 days' + interval '3 hours', NOW() + interval '14 days' + interval '4 hours', 5, $2),
                ($1, NOW() + interval '14 days' + interval '1 hour', NOW() + interval '14 days' + interval '2 hours', 5, $2)
         RETURNING id, start_time`,
        [id, ORGS.testGemeinde.id]
      );
      return { eventId: id, slotIds: rows.map(r => r.id) };
    }

    async function fensterLeitung(eventId) {
      const res = await request(app)
        .get(`/api/events/${eventId}/timeslots`)
        .set('Authorization', `Bearer ${adminToken}`);
      return res;
    }

    async function fensterKonfi(eventId) {
      const res = await request(app)
        .get(`/api/konfi/events/${eventId}/timeslots`)
        .set('Authorization', `Bearer ${konfiToken}`);
      return res;
    }

    it('gleiche Fenster, gleiche Reihenfolge, gleiche Zaehler', async () => {
      const { eventId } = await terminMitFenstern();
      const { rows: [slot] } = await db.query(
        'SELECT id FROM event_timeslots WHERE event_id = $1 ORDER BY start_time ASC LIMIT 1',
        [eventId]
      );
      await db.query(
        `INSERT INTO event_bookings (event_id, user_id, timeslot_id, status, organization_id)
         VALUES ($1, $2, $3, 'confirmed', $4)`,
        [eventId, USERS.konfi1.id, slot.id, ORGS.testGemeinde.id]
      );

      const leitung = await fensterLeitung(eventId);
      const konfi = await fensterKonfi(eventId);

      expect(leitung.status).toBe(200);
      expect(konfi.status).toBe(200);
      expect(leitung.body).toHaveLength(2);
      expect(konfi.body).toHaveLength(2);
      // Sortierung ist Vertrag: nach start_time aufsteigend, NICHT nach id.
      // Das zweite eingefuegte Fenster liegt frueher und muss vorn stehen.
      expect(leitung.body[0].id).toBe(slot.id);
      expect(konfi.body[0].id).toBe(slot.id);
      // Zaehler kommen als ZAHLEN heraus (der pg-Treiber ist auf bigint ->
      // Number gestellt). Das ist Vertrag: Eine Umstellung auf String waere
      // eine Formaenderung fuer ausgelieferte Apps.
      expect(leitung.body[0].registered_count).toBe(1);
      expect(leitung.body[0].waitlist_count).toBe(0);
      expect(konfi.body[0].registered_count).toBe(1);
      expect(konfi.body[0].waitlist_count).toBe(0);
      // Der eigentliche Punkt: Zeichen fuer Zeichen dieselbe Antwort.
      expect(konfi.body).toEqual(leitung.body);
    });

    it('Warteliste im Fenster zaehlt in beiden Antworten gleich', async () => {
      const { eventId } = await terminMitFenstern();
      const { rows: [slot] } = await db.query(
        'SELECT id FROM event_timeslots WHERE event_id = $1 ORDER BY start_time ASC LIMIT 1',
        [eventId]
      );
      await db.query(
        `INSERT INTO event_bookings (event_id, user_id, timeslot_id, status, organization_id)
         VALUES ($1, $2, $3, 'waitlist', $4)`,
        [eventId, USERS.konfi1.id, slot.id, ORGS.testGemeinde.id]
      );

      const leitung = await fensterLeitung(eventId);
      const konfi = await fensterKonfi(eventId);

      expect(leitung.body[0].registered_count).toBe(0);
      expect(leitung.body[0].waitlist_count).toBe(1);
      expect(konfi.body).toEqual(leitung.body);
    });

    // Vertrag: Termin OHNE Zeitfenster antwortet mit leerem Array (200),
    // nicht mit 404. Die Oberflaechen unterscheiden daran "keine Fenster"
    // von "Termin weg".
    it('Termin ohne Zeitfenster: beide antworten 200 mit leerem Array', async () => {
      const id = await termin({ has_timeslots: false });

      const leitung = await fensterLeitung(id);
      const konfi = await fensterKonfi(id);

      expect(leitung.status).toBe(200);
      expect(leitung.body).toEqual([]);
      expect(konfi.status).toBe(200);
      expect(konfi.body).toEqual([]);
    });

    it('unbekannter Termin: beide antworten 404 mit derselben Meldung', async () => {
      const leitung = await fensterLeitung(999999);
      const konfi = await fensterKonfi(999999);

      expect(leitung.status).toBe(404);
      expect(leitung.body.error).toBe('Event nicht gefunden');
      expect(konfi.status).toBe(404);
      expect(konfi.body.error).toBe('Event nicht gefunden');
    });

    // Der Organisationsfilter ist Teil der zusammengelegten Rechnung --
    // ein Termin einer fremden Organisation darf auch nach dem
    // Zusammenlegen nicht durchrutschen.
    it('Termin einer fremden Organisation: beide antworten 404', async () => {
      const { rows } = await db.query(
        `INSERT INTO events (name, event_date, organization_id, has_timeslots, point_type, points,
                             registration_opens_at, registration_closes_at)
         VALUES ('Fremdtermin', NOW() + interval '5 days', $1, true, 'gemeinde', 1,
                 NOW() - interval '1 day', NOW() + interval '3 days')
         RETURNING id`,
        [ORGS.andereGemeinde.id]
      );

      const leitung = await fensterLeitung(rows[0].id);
      const konfi = await fensterKonfi(rows[0].id);

      expect(leitung.status).toBe(404);
      expect(konfi.status).toBe(404);
    });

    // Der Rollen-Guard der Konfi-Route bleibt: Die Zusammenlegung fasst nur
    // die Rechnung an, nicht die Berechtigung.
    it('Konfi-Zeitfenster-Route bleibt fuer die Leitung gesperrt', async () => {
      const { eventId } = await terminMitFenstern();

      const res = await request(app)
        .get(`/api/konfi/events/${eventId}/timeslots`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Konfi-Zugriff erforderlich');
    });
  });
});
