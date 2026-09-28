// Die Reihenfolge der Warteliste: wer sich neu anstellt, steht hinten -- und
// jede Anzeige nennt denselben Platz (Audit 26.09.2026, Punkte/Termine BF-05,
// dazu BF-11)
//
// DER BEFUND: Die Wiederanmeldung nach einer Abmeldung (bucheTermin,
// "Reaktivierung", seit 16.09.2026 fuer beide Rollen) setzte booking_date auf
// jetzt -- der Kommentar dort sagt ausdruecklich: "Fuer Warteliste und
// Nachruecken zaehlt die NEUE Entscheidung". Das Nachruecken sortierte aber
// nach created_at der URSPRUENGLICHEN Buchung. Wer abgemeldet war und sich
// wieder anmeldete, ueberholte alle, die seit seiner Abmeldung warteten.
// Dazu zwei Positionsanzeigen mit zwei Spalten: die Konfi-Liste nach
// created_at, die Status-Route nach booking_date -- zwei Zahlen fuer
// dieselbe Person ("Platz 1" in der Liste, "Platz 2" im Detail).
//
// BF-11 im selben Bericht: created_at ist TEXT; die Textsortierung ist in der
// Nacht der Zeitumstellung nicht chronologisch.
//
// DIE REGEL JETZT (bookingUtils.js, wartelistenRangSql/wartelistenPlatzSql):
// EIN Schluessel fuer Nachruecken, beide Positionsabfragen und die
// Teilnehmerliste der Leitung -- booking_date (timestamptz), bei Gleichstand
// die Buchungs-ID. Der Platz zaehlt nur, wer im SELBEN Kontingent (Konfi/Team)
// und im selben Zeitfenster wartet -- genau die, aus denen nachgerueckt wird.
//
// Dieselbe Regel "wer sich neu anstellt, steht hinten" gilt an zwei weiteren
// Stellen, die booking_date bis dahin nicht anfassten:
//   - Die Leitung setzt jemanden auf die Warteliste zurueck: Er stellt sich
//     hinten an. Vorher behielt er seinen alten Rang, rueckte beim Nachruecken
//     selbst wieder nach, die Route nahm das zurueck -- und der geraeumte
//     Platz blieb leer, obwohl andere warteten. Das Handbuch versprach es
//     anders ("geht an die naechste wartende Person").
//   - Eine Teamer:in sagt nach einer Absage wieder zu
//     (POST /teamer/events/:id/zusage): Sie stellt sich hinten an.

const request = require('supertest');
const jwt = require('jsonwebtoken');
const { getTestApp, warteAufNachwehen } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, JAHRGAENGE, ROLES } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const PushService = require('../../services/pushService');

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-vitest';

describe('Warteliste: Reihenfolge und Platz', () => {
  let app;
  let db;
  let adminToken;

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
    adminToken = generateToken('orgAdmin1');
    // Keine echten Pushes; die Tests pruefen Reihenfolge und Platz.
    for (const art of [
      'sendWaitlistPromotionToKonfi', 'sendWaitlistPromotionToTeamer', 'sendEventRegisteredToKonfi',
      'sendEventUnregisteredToKonfi', 'sendEventUnregistrationToLeadership', 'sendEventRemovedByLeitung'
    ]) {
      if (typeof PushService[art] === 'function') vi.spyOn(PushService, art).mockResolvedValue(undefined);
    }
  });

  afterEach(async () => {
    await warteAufNachwehen(app);
    vi.restoreAllMocks();
  });

  // ------------------------------------------------------------------
  // Werkzeug
  // ------------------------------------------------------------------

  async function person(username, rolle) {
    const roleId = rolle === 'konfi' ? ROLES.konfi.id : ROLES.teamer.id;
    const { rows: [u] } = await db.query(
      `INSERT INTO users (username, display_name, password_hash, role_id, organization_id, is_active)
       VALUES ($1, $2, 'x', $3, $4, true) RETURNING id`,
      [username, `Person ${username}`, roleId, ORGS.testGemeinde.id]
    );
    if (rolle === 'konfi') {
      await db.query(
        `INSERT INTO konfi_profiles (user_id, jahrgang_id, gottesdienst_points, gemeinde_points, organization_id)
         VALUES ($1, $2, 0, 0, $3)`,
        [u.id, JAHRGAENGE.jahrgang1.id, ORGS.testGemeinde.id]
      );
    }
    // Die IDs beginnen nach truncateAll neu: Dieselbe ID war im Test davor
    // vielleicht eine Konfi -- der RBAC-Zwischenspeicher darf sie nicht
    // mit der alten Rolle ausliefern.
    require('../../middleware/rbac').invalidateUserCache(u.id);
    const token = jwt.sign({
      id: u.id, type: rolle, display_name: `Person ${username}`,
      organization_id: ORGS.testGemeinde.id, role_id: roleId
    }, JWT_SECRET, { expiresIn: '1h' });
    return { id: u.id, token };
  }

  const konfi = (name) => person(name, 'konfi');
  const teamer = (name) => person(name, 'teamer');

  /** Ein Platz, Warteliste an, in zwei Wochen. */
  async function event({ max = 1, teamerOnly = false, teamerMax = 0 } = {}) {
    const { rows: [e] } = await db.query(
      `INSERT INTO events (name, event_date, organization_id, max_participants, waitlist_enabled,
                           max_waitlist_size, teamer_only, teamer_needed, teamer_max_participants,
                           teamer_waitlist_enabled, teamer_max_waitlist_size, points, point_type)
       VALUES ('Konfifahrt', NOW() + interval '14 days', $1, $2, true, 10, $3, false, $4, true, 10, 0, 'gemeinde')
       RETURNING id`,
      [ORGS.testGemeinde.id, max, teamerOnly, teamerMax]
    );
    if (!teamerOnly) {
      await db.query(
        'INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) VALUES ($1, $2)',
        [e.id, JAHRGAENGE.jahrgang1.id]
      );
    }
    return e.id;
  }

  // Zwischen zwei Schritten ein wenig Zeit, damit booking_date sicher
  // verschieden ist (NOW() ist die Startzeit der Transaktion).
  const kurz = () => new Promise((r) => setTimeout(r, 15));

  const anmelden = async (eventId, token) => {
    await kurz();
    return request(app).post(`/api/konfi/events/${eventId}/register`)
      .set('Authorization', `Bearer ${token}`).send({});
  };

  const abmelden = (eventId, token) => request(app)
    .delete(`/api/konfi/events/${eventId}/register`)
    .set('Authorization', `Bearer ${token}`).send({ reason: 'Kann nicht' });

  const statusVon = async (eventId, userId) => {
    const { rows: [b] } = await db.query(
      'SELECT id, status FROM event_bookings WHERE event_id = $1 AND user_id = $2', [eventId, userId]
    );
    return b;
  };

  /** Platz laut Konfi-Liste UND laut Status-Route -- beide muessen gleich sein. */
  async function plaetze(eventId, token) {
    const liste = await request(app).get('/api/konfi/events').set('Authorization', `Bearer ${token}`);
    expect(liste.status).toBe(200);
    const eintrag = liste.body.find((e) => e.id === eventId);
    const status = await request(app).get(`/api/konfi/events/${eventId}/status`).set('Authorization', `Bearer ${token}`);
    expect(status.status).toBe(200);
    return { liste: eintrag.waitlist_position, status: status.body.waitlist_position };
  }

  /** Die Leitung meldet eine Person ab -> 'excused'. */
  async function leitungMeldetAb(eventId, userId) {
    const b = await statusVon(eventId, userId);
    const res = await request(app)
      .put(`/api/events/${eventId}/participants/${b.id}/attendance`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ attendance_status: 'excused', excuse_reason: 'krank' });
    expect(res.status).toBe(200);
    expect((await statusVon(eventId, userId)).status).toBe('excused');
  }

  // ------------------------------------------------------------------
  // Der Fall aus dem Befund (Test T2 des Audits)
  // ------------------------------------------------------------------
  describe('Wiederanmeldung nach Abmeldung', () => {
    it('stellt sich hinten an: K3 wartete laenger und rueckt zuerst nach', async () => {
      const eventId = await event();
      const k1 = await konfi('k1');
      const k2 = await konfi('k2');
      const k3 = await konfi('k3');

      expect((await anmelden(eventId, k1.token)).body.status).toBe('confirmed');
      expect((await anmelden(eventId, k2.token)).body.status).toBe('waitlist');
      await leitungMeldetAb(eventId, k2.id);
      expect((await anmelden(eventId, k3.token)).body.status).toBe('waitlist');

      // K2 meldet sich wieder an -- nach K3.
      const wieder = await anmelden(eventId, k2.token);
      expect(wieder.status).toBe(200);
      expect(wieder.body.status).toBe('waitlist');

      // K1 springt ab: Der Platz geht an K3, nicht an K2.
      await kurz();
      expect((await abmelden(eventId, k1.token)).status).toBe(200);
      expect((await statusVon(eventId, k3.id)).status).toBe('confirmed');
      expect((await statusVon(eventId, k2.id)).status).toBe('waitlist');
    });

    it('Liste und Status-Route nennen denselben Platz -- vor und nach dem Nachruecken', async () => {
      const eventId = await event();
      const k1 = await konfi('k1');
      const k2 = await konfi('k2');
      const k3 = await konfi('k3');

      await anmelden(eventId, k1.token);
      await anmelden(eventId, k2.token);
      await leitungMeldetAb(eventId, k2.id);
      await anmelden(eventId, k3.token);
      const wieder = await anmelden(eventId, k2.token);

      // Die Anmeldung selbst meldete "Platz 2" -- dieselbe Zahl ueberall.
      expect(wieder.body.message).toBe('Auf Warteliste gesetzt (Platz 2)');
      expect(await plaetze(eventId, k2.token)).toEqual({ liste: 2, status: 2 });
      expect(await plaetze(eventId, k3.token)).toEqual({ liste: 1, status: 1 });

      await kurz();
      await abmelden(eventId, k1.token).expect(200);
      expect(await plaetze(eventId, k2.token)).toEqual({ liste: 1, status: 1 });
    });
  });

  // ------------------------------------------------------------------
  // Der Platz zaehlt nur die eigene Warteliste
  // ------------------------------------------------------------------
  describe('Platz = Rang in der Warteliste, aus der nachgerueckt wird', () => {
    it('wartende Teamer:innen schieben den Platz einer Konfi nicht nach hinten', async () => {
      const eventId = await event({ max: 1, teamerMax: 1 });
      await db.query('UPDATE events SET teamer_needed = true WHERE id = $1', [eventId]);
      const t1 = await teamer('t1');
      const t2 = await teamer('t2');
      await db.query(
        'INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id) VALUES ($1, $3), ($2, $3)',
        [t1.id, t2.id, JAHRGAENGE.jahrgang1.id]
      );
      const k1 = await konfi('k1');
      const k2 = await konfi('k2');

      // Das Team wartet ZUERST, dann die Konfi.
      const zusage = (t) => request(app).post(`/api/teamer/events/${eventId}/zusage`)
        .set('Authorization', `Bearer ${t.token}`).send({ dabei: true });
      expect((await zusage(t1)).status).toBe(200);
      await kurz();
      expect((await zusage(t2)).status).toBe(200);
      expect((await statusVon(eventId, t2.id)).status).toBe('waitlist');
      await anmelden(eventId, k1.token);
      expect((await anmelden(eventId, k2.token)).body.status).toBe('waitlist');

      // Vorher: Liste und Status zaehlten t2 mit -> Platz 2.
      expect(await plaetze(eventId, k2.token)).toEqual({ liste: 1, status: 1 });
    });
  });

  // ------------------------------------------------------------------
  // Herabstufen durch die Leitung
  // ------------------------------------------------------------------
  describe('Die Leitung setzt jemanden auf die Warteliste zurueck', () => {
    it('der Platz geht an die Wartende, auch wenn die Herabgestufte frueher gebucht hatte', async () => {
      const eventId = await event();
      const k1 = await konfi('k1');
      const k2 = await konfi('k2');
      await anmelden(eventId, k1.token);           // bucht zuerst
      await anmelden(eventId, k2.token);           // wartet
      await kurz();

      const b1 = await statusVon(eventId, k1.id);
      const res = await request(app)
        .put(`/api/events/${eventId}/participants/${b1.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'waitlist' });
      expect(res.status).toBe(200);

      expect((await statusVon(eventId, k2.id)).status).toBe('confirmed');
      expect((await statusVon(eventId, k1.id)).status).toBe('waitlist');
      expect(await plaetze(eventId, k1.token)).toEqual({ liste: 1, status: 1 });
    });

    it('wartet sonst niemand, bleibt die Herabgestufte auf der Warteliste', async () => {
      const eventId = await event();
      const k1 = await konfi('k1');
      await anmelden(eventId, k1.token);
      const b1 = await statusVon(eventId, k1.id);

      await request(app)
        .put(`/api/events/${eventId}/participants/${b1.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'waitlist' })
        .expect(200);

      expect((await statusVon(eventId, k1.id)).status).toBe('waitlist');
    });
  });

  // ------------------------------------------------------------------
  // Team: Zusage nach einer Absage
  // ------------------------------------------------------------------
  describe('Teamer:in sagt nach einer Absage wieder zu', () => {
    it('stellt sich hinten an: wer laenger wartet, rueckt zuerst nach', async () => {
      const eventId = await event({ teamerOnly: true, teamerMax: 1 });
      const ta = await teamer('ta');
      const tb = await teamer('tb');
      const tc = await teamer('tc');
      const zusage = async (t, dabei, reason) => {
        await kurz();
        return request(app).post(`/api/teamer/events/${eventId}/zusage`)
          .set('Authorization', `Bearer ${t.token}`).send(reason ? { dabei, reason } : { dabei });
      };

      expect((await zusage(ta, true)).status).toBe(200);
      expect((await zusage(tb, true)).status).toBe(200);   // wartet
      expect((await zusage(tc, true)).status).toBe(200);   // wartet nach tb
      expect((await zusage(tb, false, 'Doch keine Zeit')).status).toBe(200);
      expect((await zusage(tb, true)).status).toBe(200);   // wieder dabei -- hinter tc
      expect((await statusVon(eventId, tb.id)).status).toBe('waitlist');

      expect((await zusage(ta, false, 'Krank')).status).toBe(200);

      expect((await statusVon(eventId, tc.id)).status).toBe('confirmed');
      expect((await statusVon(eventId, tb.id)).status).toBe('waitlist');
    });

    it('eine wiederholte Zusage (Doppelversand) behaelt den Platz in der Warteliste', async () => {
      const eventId = await event({ teamerOnly: true, teamerMax: 1 });
      const ta = await teamer('ta');
      const tb = await teamer('tb');
      const tc = await teamer('tc');
      const zusage = async (t, dabei, reason) => {
        await kurz();
        return request(app).post(`/api/teamer/events/${eventId}/zusage`)
          .set('Authorization', `Bearer ${t.token}`).send(reason ? { dabei, reason } : { dabei });
      };

      await zusage(ta, true);
      await zusage(tb, true);
      await zusage(tc, true);
      await zusage(tb, true);   // dieselbe Zusage noch einmal -- kein Neuanstellen

      await zusage(ta, false, 'Krank');

      expect((await statusVon(eventId, tb.id)).status).toBe('confirmed');
      expect((await statusVon(eventId, tc.id)).status).toBe('waitlist');
    });
  });

  // ------------------------------------------------------------------
  // Teilnehmerliste der Leitung: Wartende in Nachrueck-Reihenfolge
  // ------------------------------------------------------------------
  it('die Teilnehmerliste der Leitung zeigt die Wartenden in der Reihenfolge, in der sie nachruecken', async () => {
    const eventId = await event();
    const k1 = await konfi('k1');
    const k2 = await konfi('k2');
    const k3 = await konfi('k3');
    await anmelden(eventId, k1.token);
    await anmelden(eventId, k2.token);
    await leitungMeldetAb(eventId, k2.id);
    await anmelden(eventId, k3.token);
    await anmelden(eventId, k2.token);

    const res = await request(app).get(`/api/events/${eventId}`).set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    const wartende = res.body.participants
      .filter((p) => p.status === 'waitlist')
      .map((p) => Number(p.user_id));
    expect(wartende).toEqual([k3.id, k2.id]);
  });
});
