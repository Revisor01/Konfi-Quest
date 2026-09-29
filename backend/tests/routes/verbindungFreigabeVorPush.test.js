// Die Transaktions-Verbindung ist frei, bevor Chat und Push laufen
// (Nebenbefund Paket B1, 29.09.2026; Paket I2).
//
// POST /teamer/events/:id/zusage und POST /events hielten den Client ihrer
// Transaktion ueber das COMMIT hinaus fest: Chat-Mitgliedschaft, Empfaenger-
// Abfrage und Pushes liefen, waehrend die Verbindung noch ausgeliehen war --
// freigegeben wurde erst im finally. Chat und Empfaenger-Abfrage holen sich
// dabei eine ZWEITE Verbindung aus dem Pool. Unter Last halten so N Anfragen
// je eine Verbindung und warten auf eine zweite; bei N = Poolgroesse steht
// alles (dieselbe Falle wie der Promise.all-Befund in POST /events,
// 28.08.2026). Und ein Push, der sich Zeit laesst, haelt eine Verbindung,
// die niemand mehr braucht.
//
// Gemessen wird mit einem Wrapper um den Test-Pool: Er zaehlt, wie viele
// Verbindungen gerade per getClient() ausgeliehen sind, und merkt sich jede
// Pool-Abfrage (db.query), die waehrenddessen laeuft, sowie den Stand bei
// jedem Push.
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { getTestApp, warteAufNachwehen } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, JAHRGAENGE } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const PushService = require('../../services/pushService');

describe('Verbindung frei vor Chat und Push: Teamer-Zusage und Event anlegen', () => {
  let basis, db, app;
  let ausgeliehen = 0;
  let abfragenWaehrendAusgeliehen = [];

  beforeAll(() => {
    basis = getTestPool();
    db = {
      ...basis,
      query: (text, params) => {
        if (ausgeliehen > 0) {
          abfragenWaehrendAusgeliehen.push(String(text).trim().split('\n')[0].slice(0, 80));
        }
        return basis.query(text, params);
      },
      getClient: async () => {
        const client = await basis.getClient();
        ausgeliehen += 1;
        const echtesRelease = client.release;
        let frei = false;
        client.release = (...args) => {
          if (!frei) { frei = true; ausgeliehen -= 1; }
          return echtesRelease.apply(client, args);
        };
        return client;
      },
    };
    app = getTestApp(db);

    // Die Pushes fuer die ganze Datei abfangen, nicht je Test: Laeuft eine
    // Route nach ihrer Antwort noch weiter (genau der Fehler hier), darf ein
    // spaeter Aufruf nicht den echten Versand treffen.
    for (const methode of PUSHES) {
      spione[methode] = vi.spyOn(PushService, methode).mockImplementation(async () => {
        staende[methode].push(ausgeliehen);
      });
    }
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await closePool();
  });

  beforeEach(async () => {
    await truncateAll(basis);
    await seed(basis);
    ausgeliehen = 0;
    abfragenWaehrendAusgeliehen = [];
    for (const methode of PUSHES) {
      spione[methode].mockClear();
      staende[methode] = [];
    }
  });

  const PUSHES = [
    'sendTeamerEventBookingToLeadership',
    'sendTeamerEventCancellationToLeadership',
    'sendWaitlistPromotionToTeamer',
    'sendMandatoryEventCreated',
  ];
  const spione = {};
  const staende = {};

  // Stand der ausgeliehenen Verbindungen, wenn der Push gerufen wird.
  function pushSpion(methode) {
    return { spy: spione[methode], staende: staende[methode] };
  }

  // Bis die Route ihre Verbindung zurueckgegeben hat (hoechstens 3 s). Mit
  // dem Fehler lief die Route nach der Antwort noch weiter -- ohne dieses
  // Warten saehe der Test nur "noch nicht gerufen" statt "mit ausgeliehener
  // Verbindung gerufen".
  async function bisFrei() {
    const ende = Date.now() + 3000;
    while (ausgeliehen > 0 && Date.now() < ende) {
      await new Promise((r) => setTimeout(r, 10));
    }
    await warteAufNachwehen(app);
  }

  describe('POST /teamer/events/:id/zusage', () => {
    // Team-Termin ohne Jahrgang (gilt der ganzen Gemeinde): ein Platz fuers
    // Team, Warteliste an.
    async function teamTermin() {
      const { rows: [e] } = await basis.query(
        `INSERT INTO events (name, event_date, organization_id, max_participants, teamer_needed,
                             teamer_max_participants, teamer_waitlist_enabled, created_by)
         VALUES ('Teamtreffen', NOW() + interval '7 days', $1, 10, true, 1, true, $2) RETURNING id`,
        [ORGS.testGemeinde.id, USERS.admin1.id]
      );
      return e.id;
    }

    const zusage = async (eventId, userKey, body) => {
      const res = await request(app)
        .post(`/api/teamer/events/${eventId}/zusage`)
        .set('Authorization', `Bearer ${generateToken(userKey)}`)
        .send(body);
      await bisFrei();
      return res;
    };

    it('Zusage: keine Pool-Abfrage, solange die Transaktions-Verbindung ausgeliehen ist', async () => {
      const eventId = await teamTermin();
      const leitung = pushSpion('sendTeamerEventBookingToLeadership');

      const res = await zusage(eventId, 'teamer1', { dabei: true });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'confirmed', message: 'Zusage gespeichert' });
      expect(abfragenWaehrendAusgeliehen).toEqual([]);
      expect(leitung.staende).toEqual([0]);
      expect(ausgeliehen).toBe(0);
    });

    it('Absage mit Nachrücken: beide Pushes laufen mit freier Verbindung', async () => {
      const eventId = await teamTermin();
      // Eine zweite Teamer:in in Gemeinde 1 (der Seed hat dort nur teamer1).
      const ZWEITE = 441;
      await basis.query(
        `INSERT INTO users (id, username, password_hash, display_name, role_id, organization_id, is_active)
         VALUES ($1, 'freigabe_teamer2', 'x', 'Zweite Teamerin', $2, $3, true)`,
        [ZWEITE, USERS.teamer1.role_id, ORGS.testGemeinde.id]
      );
      const zweiteToken = jwt.sign(
        { id: ZWEITE, type: 'teamer', display_name: 'Zweite Teamerin', organization_id: ORGS.testGemeinde.id, role_id: USERS.teamer1.role_id },
        process.env.JWT_SECRET, { expiresIn: '1h' }
      );
      // teamer1 hat den einen Platz, die zweite wartet.
      expect((await zusage(eventId, 'teamer1', { dabei: true })).body.status).toBe('confirmed');
      const warten = await request(app)
        .post(`/api/teamer/events/${eventId}/zusage`)
        .set('Authorization', `Bearer ${zweiteToken}`)
        .send({ dabei: true });
      await bisFrei();
      expect(warten.body.status).toBe('waitlist');
      abfragenWaehrendAusgeliehen = [];

      const nachgerueckt = pushSpion('sendWaitlistPromotionToTeamer');
      const leitung = pushSpion('sendTeamerEventCancellationToLeadership');

      const res = await zusage(eventId, 'teamer1', { dabei: false, reason: 'krank' });

      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'opted_out', message: 'Absage gespeichert' });
      expect(nachgerueckt.spy).toHaveBeenCalledTimes(1);
      expect(nachgerueckt.spy.mock.calls[0][1]).toBe(ZWEITE);
      expect(nachgerueckt.staende).toEqual([0]);
      expect(leitung.staende).toEqual([0]);
      expect(abfragenWaehrendAusgeliehen).toEqual([]);
      expect(ausgeliehen).toBe(0);
    });
  });

  describe('POST /events', () => {
    it('Pflicht-Event: Empfänger-Abfrage und Push laufen mit freier Verbindung', async () => {
      await basis.query(
        'INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id, can_view, can_edit) VALUES ($1, $2, true, true)',
        [USERS.admin1.id, JAHRGAENGE.jahrgang1.id]
      );
      require('../../middleware/rbac').invalidateUserCache(USERS.admin1.id);
      const push = pushSpion('sendMandatoryEventCreated');

      const res = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${generateToken('admin1')}`)
        .send({
          name: 'Konfisamstag',
          event_date: new Date(Date.now() + 14 * 86400000).toISOString(),
          mandatory: true,
          jahrgang_ids: [JAHRGAENGE.jahrgang1.id],
        });
      await bisFrei();

      expect(res.status).toBe(201);
      expect(res.body.message).toBe('Event erfolgreich erstellt');
      expect(push.spy).toHaveBeenCalledTimes(1);
      // Die Konfis des Jahrgangs (konfi1, konfi2) bekommen den Push.
      expect([...push.spy.mock.calls[0][1]].sort()).toEqual([USERS.konfi1.id, USERS.konfi2.id]);
      expect(push.staende).toEqual([0]);
      expect(abfragenWaehrendAusgeliehen).toEqual([]);
      expect(ausgeliehen).toBe(0);
    });
  });
});
