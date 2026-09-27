// DIE ABGEMELDETE KONFI SIEHT DEN WEG ZURUECK; DIE WARTENDE KOMMT HERUNTER
// (Audit 26.09.2026, Screens Konfi/Teamer BF-01 und BF-02)
//
// BF-01: Das Backend erlaubt die Wiederanmeldung nach einer Abmeldung durch
// die Leitung seit dem 16.09.2026 (bucheTermin, Test
// wiederanmeldenNachAbmeldung.test.js). Die Konfi-LISTE sagte aber weiter
// `can_register = false`, sobald irgendeine Buchungszeile existierte --
// auch eine mit status 'excused' oder 'opted_out'. Die App zeigt den
// Anmelde-Knopf nur bei can_register; die abgemeldete Konfi sah deshalb
// einen offenen Termin mit grauem Knopf "Nicht verfuegbar" und kam nicht
// zurueck. Dasselbe galt fuer GET /konfi/events/:id/status.
//
// BF-02: Wer auf der Warteliste steht, belegt keinen Platz. Die
// Zwei-Tage-Frist fuers Abmelden schuetzt die Planung der Leitung vor
// kurzfristig frei werdenden PLAETZEN -- fuer eine Wartende gibt es nichts
// zu schuetzen. Trotzdem lehnte DELETE /konfi/events/:id/register die
// Wartende in den letzten 48 Stunden ab; sie blieb auf der Liste und wurde
// beim Nachruecken als abwesend verbucht.
//
// ANTWORTFORM UNVERAENDERT: can_register ist ein bestehendes boolesches Feld,
// nur sein Wert aendert sich (Store-Apps 2.2.x lesen es).
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, JAHRGAENGE } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

describe('Wiederanmeldung sichtbar, Warteliste verlassbar', () => {
  let app;
  let db;
  let adminToken;
  let konfiToken;
  let konfi2Token;

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
    konfiToken = generateToken('konfi1');
    konfi2Token = generateToken('konfi2');
  });

  // --------------------------------------------------------------
  // Hilfen (Muster: wiederanmeldenNachAbmeldung.test.js)
  // --------------------------------------------------------------

  async function termin(felder = {}) {
    const inZweiWochen = new Date();
    inZweiWochen.setDate(inZweiWochen.getDate() + 14);
    const res = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Konfifreizeit',
        event_date: inZweiWochen.toISOString(),
        max_participants: 10,
        points: 0,
        waitlist_enabled: false,
        max_waitlist_size: 10,
        jahrgang_ids: [JAHRGAENGE.jahrgang1.id],
        ...felder,
      });
    expect(res.status).toBe(201);
    return res.body.id;
  }

  async function anmelden(eventId, token) {
    return request(app)
      .post(`/api/konfi/events/${eventId}/register`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
  }

  async function abmelden(eventId, token, reason = 'Habe etwas anderes vor') {
    return request(app)
      .delete(`/api/konfi/events/${eventId}/register`)
      .set('Authorization', `Bearer ${token}`)
      .send({ reason });
  }

  async function buchungsId(eventId, userId) {
    const { rows: [row] } = await db.query(
      'SELECT id FROM event_bookings WHERE event_id = $1 AND user_id = $2',
      [eventId, userId]
    );
    return row && row.id;
  }

  /** Die Leitung meldet jemanden ab -> status wird 'excused'. */
  async function abmeldenDurchLeitung(eventId, userId) {
    const id = await buchungsId(eventId, userId);
    const res = await request(app)
      .put(`/api/events/${eventId}/participants/${id}/attendance`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ attendance_status: 'excused', excuse_reason: 'Krank gemeldet' });
    expect(res.status).toBe(200);
    const { rows: [row] } = await db.query(
      'SELECT status FROM event_bookings WHERE event_id = $1 AND user_id = $2',
      [eventId, userId]
    );
    expect(row.status).toBe('excused');
  }

  async function terminAusListe(eventId, token) {
    const res = await request(app)
      .get('/api/konfi/events')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const e = res.body.find(x => x.id === eventId);
    expect(e).toBeTruthy();
    return e;
  }

  async function status(eventId, token) {
    const res = await request(app)
      .get(`/api/konfi/events/${eventId}/status`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    return res.body;
  }

  /** Termin so verschieben, dass die Zwei-Tage-Frist schon laeuft. */
  async function inDieFristRuecken(eventId) {
    await db.query(
      "UPDATE events SET event_date = NOW() + INTERVAL '1 day' WHERE id = $1",
      [eventId]
    );
  }

  // ==============================================================
  // BF-01: can_register nach Abmeldung
  // ==============================================================
  describe('can_register nach einer Abmeldung', () => {
    it('von der Leitung abgemeldet (excused): die Liste sagt can_register = true', async () => {
      const eventId = await termin();
      expect((await anmelden(eventId, konfiToken)).status).toBe(200);
      await abmeldenDurchLeitung(eventId, USERS.konfi1.id);

      const e = await terminAusListe(eventId, konfiToken);
      expect(e.booking_status).toBe('excused');
      expect(e.is_registered).toBe(false);
      expect(e.can_register).toBe(true);
    });

    it('selbst abgemeldet (opted_out) am Pflichttermin: can_register = true', async () => {
      const eventId = await termin({ mandatory: true, max_participants: 0 });
      // Pflichttermin: automatisch angemeldet; Selbstabmeldung ueber Opt-out.
      const res = await request(app)
        .post(`/api/konfi/events/${eventId}/opt-out`)
        .set('Authorization', `Bearer ${konfiToken}`)
        .send({ reason: 'Bin im Urlaub' });
      expect(res.status).toBe(200);

      const e = await terminAusListe(eventId, konfiToken);
      expect(e.booking_status).toBe('opted_out');
      expect(e.can_register).toBe(true);
    });

    it('auch GET /konfi/events/:id/status sagt can_register = true', async () => {
      const eventId = await termin();
      expect((await anmelden(eventId, konfiToken)).status).toBe(200);
      await abmeldenDurchLeitung(eventId, USERS.konfi1.id);

      const s = await status(eventId, konfiToken);
      expect(s.registration_status).toBe('excused');
      expect(s.can_register).toBe(true);
    });

    it('der Knopf fuehrt auch wirklich zurueck: Wiederanmeldung -> 200, confirmed', async () => {
      const eventId = await termin();
      expect((await anmelden(eventId, konfiToken)).status).toBe(200);
      await abmeldenDurchLeitung(eventId, USERS.konfi1.id);

      const res = await anmelden(eventId, konfiToken);
      expect(res.status).toBe(200);
      const e = await terminAusListe(eventId, konfiToken);
      expect(e.booking_status).toBe('confirmed');
      expect(e.is_registered).toBe(true);
      expect(e.can_register).toBe(false);
    });

    it('am Pflichttermin von der Leitung abgemeldet: can_register = true, und POST /register fuehrt zurueck', async () => {
      // Der Pflicht-Block der App bietet "Wieder anmelden" ueber die normale
      // Konfi-Anmelderoute an (Opt-in greift nur bei 'opted_out').
      const eventId = await termin({ mandatory: true, max_participants: 0 });
      await abmeldenDurchLeitung(eventId, USERS.konfi1.id);

      const e = await terminAusListe(eventId, konfiToken);
      expect(e.booking_status).toBe('excused');
      expect(e.can_register).toBe(true);

      const res = await anmelden(eventId, konfiToken);
      expect(res.status).toBe(200);
      expect((await terminAusListe(eventId, konfiToken)).booking_status).toBe('confirmed');
    });

    it('Gegenprobe: bestaetigt angemeldet bleibt can_register = false', async () => {
      const eventId = await termin();
      expect((await anmelden(eventId, konfiToken)).status).toBe(200);

      const e = await terminAusListe(eventId, konfiToken);
      expect(e.can_register).toBe(false);
      expect((await status(eventId, konfiToken)).can_register).toBe(false);
    });

    it('Gegenprobe: auf der Warteliste bleibt can_register = false', async () => {
      const eventId = await termin({ max_participants: 1, waitlist_enabled: true });
      expect((await anmelden(eventId, konfi2Token)).status).toBe(200);
      expect((await anmelden(eventId, konfiToken)).status).toBe(200);

      const e = await terminAusListe(eventId, konfiToken);
      expect(e.booking_status).toBe('waitlist');
      expect(e.can_register).toBe(false);
    });

    it('Gegenprobe: abgemeldet, aber Anmeldeschluss vorbei -> can_register = false', async () => {
      const eventId = await termin();
      expect((await anmelden(eventId, konfiToken)).status).toBe(200);
      await abmeldenDurchLeitung(eventId, USERS.konfi1.id);
      await db.query(
        "UPDATE events SET registration_closes_at = NOW() - INTERVAL '1 hour' WHERE id = $1",
        [eventId]
      );

      const e = await terminAusListe(eventId, konfiToken);
      expect(e.booking_status).toBe('excused');
      expect(e.can_register).toBe(false);
    });

    it('Gegenprobe: abgemeldet an einem abgesagten Termin -> can_register = false', async () => {
      const eventId = await termin();
      expect((await anmelden(eventId, konfiToken)).status).toBe(200);
      await abmeldenDurchLeitung(eventId, USERS.konfi1.id);
      const absage = await request(app)
        .put(`/api/events/${eventId}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});
      expect(absage.status).toBe(200);

      const e = await terminAusListe(eventId, konfiToken);
      expect(e.can_register).toBe(false);
    });
  });

  // ==============================================================
  // BF-02: Von der Warteliste herunter
  // ==============================================================
  describe('Warteliste verlassen', () => {
    async function wartelistenTermin() {
      const eventId = await termin({ max_participants: 1, waitlist_enabled: true, max_waitlist_size: 5 });
      expect((await anmelden(eventId, konfi2Token)).status).toBe(200); // belegt den Platz
      expect((await anmelden(eventId, konfiToken)).status).toBe(200);  // wartet
      const e = await terminAusListe(eventId, konfiToken);
      expect(e.booking_status).toBe('waitlist');
      expect(e.waitlist_position).toBe(1);
      return eventId;
    }

    it('eine Wartende meldet sich ab; der Wartelistenplatz wird frei', async () => {
      const eventId = await wartelistenTermin();

      const res = await abmelden(eventId, konfiToken);
      expect(res.status).toBe(200);

      expect(await buchungsId(eventId, USERS.konfi1.id)).toBeUndefined();
      const e = await terminAusListe(eventId, konfiToken);
      expect(e.booking_status).toBeNull();
      expect(e.waitlist_count).toBe(0);
      // Der bestaetigte Platz von konfi2 bleibt, es rueckt niemand nach.
      const e2 = await terminAusListe(eventId, konfi2Token);
      expect(e2.booking_status).toBe('confirmed');
      expect(e2.registered_count).toBe(1);
    });

    it('auch in den letzten 48 Stunden: die Zwei-Tage-Frist gilt nicht fuer Wartende', async () => {
      const eventId = await wartelistenTermin();
      await inDieFristRuecken(eventId);

      const res = await abmelden(eventId, konfiToken);
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Abmeldung erfolgreich');
      expect(await buchungsId(eventId, USERS.konfi1.id)).toBeUndefined();
    });

    it('Gegenprobe: eine BESTAETIGTE Anmeldung haengt in der Frist weiter fest', async () => {
      const eventId = await wartelistenTermin();
      await inDieFristRuecken(eventId);

      const res = await abmelden(eventId, konfi2Token, 'Zu spaet');
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Abmeldung ist nur bis 2 Tage vor dem Event möglich');
      expect(await buchungsId(eventId, USERS.konfi2.id)).toBeTruthy();
    });
  });
});
