// Absagegrund beim Absagen eines Termins (Migration 150, 15.09.2026).
//
// Simons Fall: Die Konfifreizeit faellt aus, weil die Heizung defekt ist.
// Zwanzig Konfis bekommen "Abgesagt" -- und sonst nichts. Die Rueckfragen
// landen danach einzeln im Chat und am Telefon, obwohl die Leitung den Grund
// beim Absagen im Kopf hatte.
//
// Der Grund ist FREIWILLIG (ohne ihn bleibt alles wie bisher) und fuer ALLE
// Teilnehmenden sichtbar; er geht auch in den Push (beides Entscheidung
// Simon, 15.09.2026).
//
// Der wunde Punkt ist die Rueckwaertskompatibilitaet: Ausgelieferte
// App-Fassungen schicken ausschliesslich notification_message -- ein Echo,
// das nie gespeichert wurde. Wer daraus den Absagegrund gemacht haette,
// haette den festen Satz "Das Event wurde leider abgesagt." als Begruendung
// an jedem Termin stehen gehabt. Deshalb ein eigenes Feld, und deshalb ein
// Test genau dafuer.
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, JAHRGAENGE } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const jwt = require('jsonwebtoken');
const PushService = require('../../services/pushService');

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-vitest';

const JG_FREMD = 311;      // Jahrgang, in dem der Admin NICHT ist
const ADMIN_MIT_JG = 411;  // Admin, nur in jahrgang1

function tokenFuer(id, roleId, type = 'admin') {
  return jwt.sign(
    { id, type, display_name: `User ${id}`, organization_id: 1, role_id: roleId },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

describe('Absagegrund: PUT /api/events/:id/cancel', () => {
  let app;
  let db;
  let adminToken;
  let konfiToken;
  let adminMitJgToken;

  beforeAll(async () => {
    db = getTestPool();
    app = getTestApp(db);
  });

  afterAll(async () => {
    await closePool();
  });

  // Spies IMMER zuruecksetzen, auch wenn eine Assertion vorher geworfen hat.
  // Ein mockRestore() am Testende reicht dafuer nicht: Faellt die Assertion
  // davor, bleibt der Spy stehen und der naechste Test zaehlt dessen Aufrufe
  // mit -- ein Fehlschlag, der nichts mit dem Code zu tun hat. Aufgefallen bei
  // der Gegenprobe (15.09.2026).
  afterEach(() => {
    vi.restoreAllMocks();
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

    // Zweiter Jahrgang plus ein Admin, der NUR in jahrgang1 sitzt — fuer den
    // verbotenen Fall weiter unten.
    await db.query(
      `INSERT INTO jahrgaenge (id, name, organization_id, confirmation_date)
       VALUES ($1, '2026/2027 Fremd', 1, '2027-05-01')`,
      [JG_FREMD]
    );
    await db.query(
      `INSERT INTO users (id, username, password_hash, display_name, role_id, organization_id, is_active)
       VALUES ($1, 'absage_admin', 'x', 'Absage Admin', 3, 1, true)`,
      [ADMIN_MIT_JG]
    );
    await db.query(
      `INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id, can_view, can_edit)
       VALUES ($1, $2, true, true)`,
      [ADMIN_MIT_JG, JAHRGAENGE.jahrgang1.id]
    );
    adminMitJgToken = tokenFuer(ADMIN_MIT_JG, 3);

    const { invalidateUserCache } = require('../../middleware/rbac');
    invalidateUserCache(USERS.admin1.id);
    invalidateUserCache(ADMIN_MIT_JG);
  });

  // Termin mit angemeldeter konfi1 — damit der Push tatsaechlich rausgeht
  // (ohne Teilnehmende ueberspringt die Route ihn).
  async function terminMitKonfi() {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 14);
    const createRes = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Konfifreizeit',
        event_date: futureDate.toISOString(),
        max_participants: 10,
        points: 0,
        jahrgang_ids: [JAHRGAENGE.jahrgang1.id],
      });
    expect(createRes.status).toBe(201);
    const eventId = createRes.body.id;
    const buchung = await request(app)
      .post(`/api/events/${eventId}/book`)
      .set('Authorization', `Bearer ${konfiToken}`);
    expect(buchung.status).toBe(201);
    return eventId;
  }

  const termin = async (eventId) => {
    const { rows: [row] } = await db.query(
      'SELECT cancelled, cancelled_reason, cancelled_by, cancelled_at FROM events WHERE id = $1',
      [eventId]
    );
    return row;
  };

  describe('Mit Grund', () => {
    it('speichert den Grund und den Urheber', async () => {
      const eventId = await terminMitKonfi();

      const res = await request(app)
        .put(`/api/events/${eventId}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ cancelled_reason: 'Heizung im Gemeindehaus defekt' });

      expect(res.status).toBe(200);
      expect(res.body.cancelled_reason).toBe('Heizung im Gemeindehaus defekt');

      const gespeichert = await termin(eventId);
      expect(gespeichert.cancelled).toBe(true);
      expect(gespeichert.cancelled_reason).toBe('Heizung im Gemeindehaus defekt');
      expect(gespeichert.cancelled_by).toBe(USERS.admin1.id);
      expect(gespeichert.cancelled_at).not.toBeNull();
    });

    it('schickt den Grund im Push mit — im Text und in den Daten', async () => {
      const eventId = await terminMitKonfi();

      // Auf der echten Push-Methode ansetzen, nicht auf ihr selbst: So laeuft
      // sendEventCancellationToKonfis wirklich durch und baut den Text, den
      // die Konfi auf dem Sperrbildschirm liest.
      let gesendet = null;
      const spy = vi.spyOn(PushService, 'sendToMultipleUsers')
        .mockImplementation(async (_db, _ids, benachrichtigung) => {
          gesendet = benachrichtigung;
          return { success: true };
        });

      const res = await request(app)
        .put(`/api/events/${eventId}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ cancelled_reason: 'Heizung im Gemeindehaus defekt' });

      expect(res.status).toBe(200);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(gesendet).not.toBeNull();
      expect(gesendet.body).toContain('Heizung im Gemeindehaus defekt');
      expect(gesendet.body.endsWith('. Heizung im Gemeindehaus defekt')).toBe(true);
      expect(gesendet.data.cancelled_reason).toBe('Heizung im Gemeindehaus defekt');
    });

    it('liefert Grund und Namen an die LEITUNG aus (GET /events, /events/:id, /events/cancelled)', async () => {
      const eventId = await terminMitKonfi();

      await request(app)
        .put(`/api/events/${eventId}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ cancelled_reason: 'Heizung im Gemeindehaus defekt' });

      const liste = await request(app)
        .get('/api/events')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(liste.status).toBe(200);
      const ausListe = liste.body.find(e => e.id === eventId);
      expect(ausListe.cancelled_reason).toBe('Heizung im Gemeindehaus defekt');
      expect(ausListe.cancelled_by_name).toBe(USERS.admin1.display_name);

      const detail = await request(app)
        .get(`/api/events/${eventId}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(detail.status).toBe(200);
      expect(detail.body.cancelled_reason).toBe('Heizung im Gemeindehaus defekt');
      expect(detail.body.cancelled_by_name).toBe(USERS.admin1.display_name);

      const abgesagt = await request(app)
        .get('/api/events/cancelled')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(abgesagt.status).toBe(200);
      const ausAbgesagt = abgesagt.body.find(e => e.id === eventId);
      expect(ausAbgesagt).toBeTruthy();
      expect(ausAbgesagt.cancelled_reason).toBe('Heizung im Gemeindehaus defekt');
      expect(ausAbgesagt.cancelled_by_name).toBe(USERS.admin1.display_name);
    });

    it('liefert Grund und Namen an die KONFI aus — der Grund ist fuer alle da', async () => {
      const eventId = await terminMitKonfi();

      await request(app)
        .put(`/api/events/${eventId}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ cancelled_reason: 'Heizung im Gemeindehaus defekt' });

      const res = await request(app)
        .get('/api/konfi/events')
        .set('Authorization', `Bearer ${konfiToken}`);
      expect(res.status).toBe(200);

      const ausKonfiListe = res.body.find(e => e.id === eventId);
      expect(ausKonfiListe).toBeTruthy();
      expect(ausKonfiListe.cancelled_reason).toBe('Heizung im Gemeindehaus defekt');
      expect(ausKonfiListe.cancelled_by_name).toBe(USERS.admin1.display_name);
    });

    it('trimmt den Grund und begrenzt ihn auf 500 Zeichen', async () => {
      const eventId = await terminMitKonfi();

      await request(app)
        .put(`/api/events/${eventId}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ cancelled_reason: `  ${'x'.repeat(600)}  ` });

      const gespeichert = await termin(eventId);
      expect(gespeichert.cancelled_reason).toBe('x'.repeat(500));
    });
  });

  describe('Ohne Grund — alles bleibt, wie es war', () => {
    it('cancelled_reason ist NULL, der Termin ist trotzdem abgesagt', async () => {
      const eventId = await terminMitKonfi();

      const res = await request(app)
        .put(`/api/events/${eventId}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.cancelled_reason).toBeNull();

      const gespeichert = await termin(eventId);
      expect(gespeichert.cancelled).toBe(true);
      expect(gespeichert.cancelled_reason).toBeNull();
      // Der Urheber wird auch ohne Grund festgehalten: Wer abgesagt hat, ist
      // unabhaengig davon interessant, ob eine Begruendung dabeistand.
      expect(gespeichert.cancelled_by).toBe(USERS.admin1.id);
    });

    it('ein leerer Grund ist dasselbe wie kein Grund (NULL, nicht "")', async () => {
      const eventId = await terminMitKonfi();

      await request(app)
        .put(`/api/events/${eventId}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ cancelled_reason: '   ' });

      const gespeichert = await termin(eventId);
      expect(gespeichert.cancelled_reason).toBeNull();
    });

    it('der Push-Text ist Zeichen fuer Zeichen derselbe wie vorher', async () => {
      const eventId = await terminMitKonfi();

      let gesendet = null;
      const spy = vi.spyOn(PushService, 'sendToMultipleUsers')
        .mockImplementation(async (_db, _ids, benachrichtigung) => {
          gesendet = benachrichtigung;
          return { success: true };
        });

      await request(app)
        .put(`/api/events/${eventId}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(spy).toHaveBeenCalledTimes(1);
      expect(gesendet.title).toBe('Event abgesagt');
      // Der alte Text endet auf "Uhr" — kein angehaengter Punkt, kein Grund.
      expect(gesendet.body.startsWith('Leider abgesagt: "Konfifreizeit" am ')).toBe(true);
      expect(gesendet.body.endsWith(' Uhr')).toBe(true);
      expect(gesendet.data.cancelled_reason).toBeUndefined();
    });
  });

  describe('Alte App-Fassungen (nur notification_message)', () => {
    // DER FALL, DER IM AUGUST SCHIEFGING: Eine ausgelieferte App schickt
    // ausschliesslich notification_message mit dem festen Satz. Sie darf
    // weiterlaufen, und der feste Satz darf NICHT als Absagegrund an allen
    // Konfis stehen.
    it('sagt ab, gibt notification_message zurueck und setzt KEINEN Grund', async () => {
      const eventId = await terminMitKonfi();

      const res = await request(app)
        .put(`/api/events/${eventId}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ notification_message: 'Das Event wurde leider abgesagt.' });

      expect(res.status).toBe(200);
      expect(res.body.notification_message).toBe('Das Event wurde leider abgesagt.');
      expect(res.body.participants_notified).toBe(1);
      expect(res.body.message).toBe('Event "Konfifreizeit" wurde abgesagt');

      const gespeichert = await termin(eventId);
      expect(gespeichert.cancelled).toBe(true);
      expect(gespeichert.cancelled_reason).toBeNull();
    });

    it('notification_message landet NICHT im Push-Text', async () => {
      const eventId = await terminMitKonfi();

      let gesendet = null;
      const spy = vi.spyOn(PushService, 'sendToMultipleUsers')
        .mockImplementation(async (_db, _ids, benachrichtigung) => {
          gesendet = benachrichtigung;
          return { success: true };
        });

      await request(app)
        .put(`/api/events/${eventId}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ notification_message: 'Das Event wurde leider abgesagt.' });

      expect(gesendet.body).not.toContain('Das Event wurde leider abgesagt.');
      expect(gesendet.body.endsWith(' Uhr')).toBe(true);
    });

    it('Standardwert bleibt "Das Event wurde abgesagt.", wenn gar nichts mitkommt', async () => {
      const eventId = await terminMitKonfi();

      const res = await request(app)
        .put(`/api/events/${eventId}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(res.body.notification_message).toBe('Das Event wurde abgesagt.');
    });
  });

  describe('Berechtigung: wer den Termin nicht sehen darf, sagt ihn nicht ab', () => {
    // Legt einen Termin direkt in der DB an, einem Jahrgang zugeordnet —
    // ueber die API ginge das im fremden Jahrgang gar nicht erst.
    async function terminImJahrgang(jahrgangId) {
      const { rows: [event] } = await db.query(
        `INSERT INTO events (name, description, event_date, location, organization_id, max_participants)
         VALUES ('Fremder Termin', 'Beschreibung', NOW() + INTERVAL '7 days', 'Ort', 1, 20)
         RETURNING id`
      );
      await db.query(
        'INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) VALUES ($1, $2)',
        [event.id, jahrgangId]
      );
      return event.id;
    }

    it('VERBOTEN: fremder Jahrgang — 403, kein Grund, kein Urheber, nicht abgesagt', async () => {
      const eventId = await terminImJahrgang(JG_FREMD);

      const res = await request(app)
        .put(`/api/events/${eventId}/cancel`)
        .set('Authorization', `Bearer ${adminMitJgToken}`)
        .send({ cancelled_reason: 'Heizung defekt' });

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Kein Zugriff auf diesen Termin');

      const gespeichert = await termin(eventId);
      expect(gespeichert.cancelled === true).toBe(false);
      expect(gespeichert.cancelled_reason).toBeNull();
      expect(gespeichert.cancelled_by).toBeNull();
    });

    it('ERLAUBT: eigener Jahrgang — 200, Grund und Urheber stehen', async () => {
      const eventId = await terminImJahrgang(JAHRGAENGE.jahrgang1.id);

      const res = await request(app)
        .put(`/api/events/${eventId}/cancel`)
        .set('Authorization', `Bearer ${adminMitJgToken}`)
        .send({ cancelled_reason: 'Heizung defekt' });

      expect(res.status).toBe(200);

      const gespeichert = await termin(eventId);
      expect(gespeichert.cancelled).toBe(true);
      expect(gespeichert.cancelled_reason).toBe('Heizung defekt');
      expect(gespeichert.cancelled_by).toBe(ADMIN_MIT_JG);
    });

    it('VERBOTEN: eine Konfi sagt gar nichts ab — 403, nichts geaendert', async () => {
      const eventId = await terminImJahrgang(JAHRGAENGE.jahrgang1.id);

      const res = await request(app)
        .put(`/api/events/${eventId}/cancel`)
        .set('Authorization', `Bearer ${konfiToken}`)
        .send({ cancelled_reason: 'Heizung defekt' });

      expect(res.status).toBe(403);

      const gespeichert = await termin(eventId);
      expect(gespeichert.cancelled === true).toBe(false);
      expect(gespeichert.cancelled_reason).toBeNull();
    });
  });

  describe('Die Absage-Meldung traegt die Termin-Kennung', () => {
    // DER FEHLER (15.09.2026): Jeder vergleichbare Termin-Push schickt
    // event_id mit -- der Absage-Push als einziger nicht. Ein Tipp auf
    // "Leider abgesagt" landete deshalb auf der Terminliste statt am Termin,
    // wo der Grund ausfuehrlich steht.

    async function absagenUndPushLesen(eventId, koerper) {
      let gesendet = null;
      const spy = vi.spyOn(PushService, 'sendToMultipleUsers')
        .mockImplementation(async (_db, _ids, benachrichtigung) => {
          gesendet = benachrichtigung;
          return { success: true };
        });
      const res = await request(app)
        .put(`/api/events/${eventId}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(koerper);
      expect(res.status).toBe(200);
      expect(spy).toHaveBeenCalledTimes(1);
      return gesendet;
    }

    it('event_id steht im data-Teil und zeigt auf den abgesagten Termin', async () => {
      const eventId = await terminMitKonfi();

      const gesendet = await absagenUndPushLesen(eventId, { cancelled_reason: 'Heizung defekt' });

      // Als Zeichenkette, wie bei jedem anderen Termin-Push (FCM/APNs nehmen
      // im data-Teil nur Zeichenketten).
      expect(gesendet.data.event_id).toBe(String(eventId));
    });

    it('ADDITIV: die bisherigen Felder stehen unveraendert daneben', async () => {
      // Der Alt-App-Vertrag: Es kommt etwas dazu, nichts faellt weg und
      // nichts wechselt die Bedeutung. Ausgelieferte Fassungen lesen
      // event_id nicht und landen weiter auf der Terminliste.
      const eventId = await terminMitKonfi();

      const gesendet = await absagenUndPushLesen(eventId, { cancelled_reason: 'Heizung defekt' });

      expect(gesendet.title).toBe('Event abgesagt');
      expect(gesendet.body.startsWith('Leider abgesagt: "Konfifreizeit" am ')).toBe(true);
      expect(gesendet.body.endsWith('. Heizung defekt')).toBe(true);
      expect(gesendet.data.type).toBe('event_cancelled');
      expect(gesendet.data.event_name).toBe('Konfifreizeit');
      expect(gesendet.data.cancelled_reason).toBe('Heizung defekt');
      expect(gesendet.data.organization_id).toBe('1');
    });

    it('auch OHNE Grund kommt die Kennung mit — sie haengt am Termin, nicht am Grund', async () => {
      const eventId = await terminMitKonfi();

      const gesendet = await absagenUndPushLesen(eventId, {});

      expect(gesendet.data.event_id).toBe(String(eventId));
      // Und der Grund fehlt weiterhin ganz, statt als leerer String
      // dazustehen.
      expect('cancelled_reason' in gesendet.data).toBe(false);
    });
  });

  describe('Loeschen: eine zweite Absage-Meldung geht nicht raus', () => {
    // ENTSCHEIDUNG (15.09.2026): Wer einen Termin erst absagt und ihn spaeter
    // aufraeumt -- der Weg, den das Handbuch empfiehlt --, schickte denselben
    // Konfis zweimal "Leider abgesagt". Beim zweiten Mal war der Termin in der
    // App laengst durchgestrichen; die Meldung erzaehlte nichts Neues.
    //
    // Beim Loeschen eines NICHT abgesagten Termins bleibt sie: Dort ist sie
    // die einzige Nachricht, die diese Leute je bekommen.

    async function loeschenUndPushZaehlen(eventId) {
      let gesendet = null;
      const spy = vi.spyOn(PushService, 'sendToMultipleUsers')
        .mockImplementation(async (_db, _ids, benachrichtigung) => {
          gesendet = benachrichtigung;
          return { success: true };
        });
      const res = await request(app)
        .delete(`/api/events/${eventId}?force=true`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.status).toBe(200);
      // nachAntwort() laeuft nach der Antwort; ohne dieses Warten waere der
      // Zaehler auch dann 0, wenn der Push sehr wohl kaeme (die Falle, die in
      // konfi-quest schon einmal "Parse Error: Expected HTTP/" ausgeloest hat).
      await new Promise(r => setTimeout(r, 200));
      return { anzahl: spy.mock.calls.length, gesendet, empfaenger: spy.mock.calls[0]?.[1] };
    }

    it('ein BEREITS ABGESAGTER Termin meldet sich beim Loeschen nicht noch einmal ab', async () => {
      const eventId = await terminMitKonfi();
      const absage = await request(app)
        .put(`/api/events/${eventId}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ cancelled_reason: 'Heizung defekt' });
      expect(absage.status).toBe(200);

      // AUSGANGSLAGE HERSTELLEN, DIE DEN WAECHTER WIRKLICH PRUEFT:
      //
      // Die Absage setzt den Buchungsstatus auf 'excused' (Migration 153).
      // Die Empfaengerliste der Loeschroute sammelt aber nur 'confirmed' und
      // 'waitlist' ein — nach einer Absage steht dort also ohnehin niemand
      // mehr, und der Zaehler bliebe auch ohne den Waechter auf 0. Der Test
      // bewiese dann nichts (gegengeprobt am 15.09.2026: genau so war es).
      //
      // Der Fall, den das Handbuch beschreibt, stellt die Lage aber her:
      // "Waren drei Konfis trotzdem da und haben beim Abbauen geholfen,
      // tippst du sie an und setzt sie auf anwesend." Danach steht die
      // Buchung wieder auf 'confirmed', an einem abgesagten Termin. Genau
      // diese Person wuerde beim Loeschen eine zweite Absage bekommen.
      const nachtraeglich = await request(app)
        .put(`/api/events/${eventId}/participants/${USERS.konfi1.id}/attendance`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ attendance_status: 'present' });
      expect(nachtraeglich.status).toBe(200);

      const { rows } = await db.query(
        'SELECT status FROM event_bookings WHERE event_id = $1 AND user_id = $2',
        [eventId, USERS.konfi1.id]
      );
      expect(rows[0].status).toBe('confirmed');

      const { anzahl } = await loeschenUndPushZaehlen(eventId);

      expect(anzahl).toBe(0);
    });

    it('GEGENSTUECK: ein NICHT abgesagter Termin meldet sich beim Loeschen sehr wohl ab', async () => {
      const eventId = await terminMitKonfi();

      const { anzahl, gesendet, empfaenger } = await loeschenUndPushZaehlen(eventId);

      expect(anzahl).toBe(1);
      // Genau eine Empfaengerin: die angemeldete konfi1.
      expect(empfaenger).toEqual([USERS.konfi1.id]);
      expect(gesendet.data.type).toBe('event_cancelled');
      expect(gesendet.data.event_name).toBe('Konfifreizeit');
    });

    it('beim Loeschen kommt KEINE Kennung mit — den Termin gibt es nicht mehr', async () => {
      // Ein Sprung auf einen geloeschten Termin fuehrte ins Leere. Ohne
      // Kennung bleibt die App auf der Terminliste.
      const eventId = await terminMitKonfi();

      const { gesendet } = await loeschenUndPushZaehlen(eventId);

      expect('event_id' in gesendet.data).toBe(false);
    });

    it('ein abgesagter Termin OHNE Anmeldungen loest ebenfalls nichts aus', async () => {
      // Gegenprobe zur Auswahl: Der Zaehler steht hier aus einem zweiten
      // Grund auf 0 (keine Empfaenger). Er darf nicht die einzige Stuetze des
      // ersten Tests sein -- deshalb steht dieser hier daneben und nicht
      // an seiner Stelle.
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 14);
      const createRes = await request(app)
        .post('/api/events')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Leerer Termin',
          event_date: futureDate.toISOString(),
          max_participants: 10,
          points: 0,
          jahrgang_ids: [JAHRGAENGE.jahrgang1.id],
        });
      expect(createRes.status).toBe(201);

      const { anzahl } = await loeschenUndPushZaehlen(createRes.body.id);

      expect(anzahl).toBe(0);
    });
  });
});
