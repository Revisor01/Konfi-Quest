// ZU EINEM ABGESAGTEN TERMIN MELDET SICH NIEMAND AN (16.09.2026)
//
// Simons Befund, live am Geraet reproduziert:
//   "Ich habe [Termin] Pflicht-Nachruecken abgemeldet. Also als Konfi. Habe
//    mich selbst abgemeldet. Dann wurde das Event abgesagt. 'Wieder anmelden'
//    steht jetzt aber immer noch da, obwohl es abgesagt ist."
//
// Und auf die Rueckfrage, ob wenigstens die Leitung noch jemanden eintragen
// darf, woertlich: "Nein, gar nicht." Der Termin findet nicht statt — es gibt
// nichts, wozu man sich anmelden koennte.
//
// GESPERRT WERDEN ALLE ANMELDE-WEGE:
//   POST /konfi/events/:id/opt-in        (Rueckkehr zum Pflichttermin)
//   POST /konfi/events/:id/register      (Konfi meldet sich selbst an)
//   POST /events/:id/book                (Konfi UND Team, ueber bucheTermin)
//   POST /events/:id/participants        (Leitung traegt jemanden ein)
//   PUT  /events/:id/participants/:id/status -> 'confirmed'
//                                        (Warteliste -> bestaetigt)
//   POST /teamer/events/:id/zusage       (hatte den Riegel schon)
//
// NICHT gesperrt, und das wird hier ebenso geprueft:
//   - ABMELDEN in jeder Form. Wer weg will, kommt weg, auch am abgesagten
//     Termin. Der Riegel sperrt das Anmelden, nicht das Gegenteil.
//   - Das ZURUECKNEHMEN der Absage (PUT /:id/reaktivieren). Es stellt die
//     Buchungen ueber hebeAbsageAbmeldungenAuf mit einem eigenen UPDATE her
//     und laeuft nicht ueber die gesperrten Routen — der Riegel darf ihm
//     nicht in die Quere kommen. Das ist die Falle bei dieser Aenderung und
//     deshalb der wichtigste Test hier.
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, JAHRGAENGE } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

describe('Anmelden an einem abgesagten Termin', () => {
  let app;
  let db;
  let adminToken;
  let konfiToken;
  let konfi2Token;
  let teamerToken;

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
    // orgAdmin1 statt admin1: Der Org-Admin ist nicht an Jahrgaenge
    // gebunden und darf jeden Termin anlegen, absagen und verwalten. Mit
    // admin1 waere jeder Test hier erst an der Jahrgangs-Bindung
    // haengengeblieben — die wird anderswo geprueft, hier geht es um den
    // Absage-Riegel.
    adminToken = generateToken('orgAdmin1');
    konfiToken = generateToken('konfi1');
    konfi2Token = generateToken('konfi2');
    teamerToken = generateToken('teamer1');
  });

  // --------------------------------------------------------------
  // Hilfen
  // --------------------------------------------------------------

  /**
   * Termin im jahrgang1, in 14 Tagen. Alle Schalter steuerbar, weil die
   * einzelnen Wege verschiedene brauchen: der Pflicht-Weg mandatory, der
   * Team-Weg teamer_needed, der Wartelisten-Weg eine volle Kapazitaet.
   */
  async function termin(felder = {}) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 14);
    const res = await request(app)
      .post('/api/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Konfifreizeit',
        event_date: futureDate.toISOString(),
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

  async function absagen(eventId, grund = 'Heizung defekt') {
    const res = await request(app)
      .put(`/api/events/${eventId}/cancel`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ cancelled_reason: grund });
    expect(res.status).toBe(200);
    return res;
  }

  async function reaktivieren(eventId) {
    return request(app)
      .put(`/api/events/${eventId}/reaktivieren`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({});
  }

  async function buchung(eventId, userId) {
    const { rows: [row] } = await db.query(
      `SELECT status, abgemeldet_durch_absage, status_vor_absage
         FROM event_bookings WHERE event_id = $1 AND user_id = $2`,
      [eventId, userId]
    );
    return row;
  }

  async function buchungsId(eventId, userId) {
    const { rows: [row] } = await db.query(
      'SELECT id FROM event_bookings WHERE event_id = $1 AND user_id = $2',
      [eventId, userId]
    );
    expect(row).toBeTruthy();
    return row.id;
  }

  // ==============================================================
  // 1. POST /konfi/events/:id/opt-in — Simons Originalfall
  // ==============================================================
  describe('POST /konfi/events/:id/opt-in (Rueckkehr zum Pflichttermin)', () => {
    /**
     * Genau Simons Ablauf: Pflichttermin -> Konfi meldet sich selbst ab ->
     * Termin wird abgesagt -> "Wieder anmelden".
     */
    async function pflichtMitAbmeldung() {
      const eventId = await termin({ mandatory: true });
      const optOut = await request(app)
        .post(`/api/konfi/events/${eventId}/opt-out`)
        .set('Authorization', `Bearer ${konfiToken}`)
        .send({ reason: 'Bin im Urlaub' });
      expect(optOut.status).toBe(200);
      expect((await buchung(eventId, USERS.konfi1.id)).status).toBe('opted_out');
      return eventId;
    }

    it('VERBOTEN: abgesagter Pflichttermin lehnt die Wiederanmeldung ab', async () => {
      const eventId = await pflichtMitAbmeldung();
      await absagen(eventId);

      const res = await request(app)
        .post(`/api/konfi/events/${eventId}/opt-in`)
        .set('Authorization', `Bearer ${konfiToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Dieser Termin ist abgesagt');
      // Und die Buchung steht danach NICHT auf 'confirmed' — genau der
      // Zustand, den Simon am Geraet vorfand.
      expect((await buchung(eventId, USERS.konfi1.id)).status).toBe('opted_out');
    });

    it('ERLAUBT: am aktiven Pflichttermin geht die Wiederanmeldung', async () => {
      const eventId = await pflichtMitAbmeldung();

      const res = await request(app)
        .post(`/api/konfi/events/${eventId}/opt-in`)
        .set('Authorization', `Bearer ${konfiToken}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Wieder angemeldet');
      expect((await buchung(eventId, USERS.konfi1.id)).status).toBe('confirmed');
    });
  });

  // ==============================================================
  // 2. POST /konfi/events/:id/register
  // ==============================================================
  describe('POST /konfi/events/:id/register (Konfi meldet sich selbst an)', () => {
    it('VERBOTEN: abgesagter Termin lehnt die Anmeldung ab', async () => {
      const eventId = await termin();
      await absagen(eventId);

      const res = await request(app)
        .post(`/api/konfi/events/${eventId}/register`)
        .set('Authorization', `Bearer ${konfiToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Dieser Termin ist abgesagt');
      expect(await buchung(eventId, USERS.konfi1.id)).toBeUndefined();
    });

    it('ERLAUBT: am aktiven Termin geht die Anmeldung', async () => {
      const eventId = await termin();

      const res = await request(app)
        .post(`/api/konfi/events/${eventId}/register`)
        .set('Authorization', `Bearer ${konfiToken}`)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('confirmed');
      expect((await buchung(eventId, USERS.konfi1.id)).status).toBe('confirmed');
    });
  });

  // ==============================================================
  // 3. POST /events/:id/book — Konfi- UND Team-Weg
  // ==============================================================
  describe('POST /events/:id/book', () => {
    it('VERBOTEN (Konfi): abgesagter Termin lehnt die Buchung ab', async () => {
      const eventId = await termin();
      await absagen(eventId);

      const res = await request(app)
        .post(`/api/events/${eventId}/book`)
        .set('Authorization', `Bearer ${konfiToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Dieser Termin ist abgesagt');
      expect(await buchung(eventId, USERS.konfi1.id)).toBeUndefined();
    });

    it('ERLAUBT (Konfi): am aktiven Termin geht die Buchung', async () => {
      const eventId = await termin();

      const res = await request(app)
        .post(`/api/events/${eventId}/book`)
        .set('Authorization', `Bearer ${konfiToken}`)
        .send({});

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('confirmed');
      expect((await buchung(eventId, USERS.konfi1.id)).status).toBe('confirmed');
    });

    it('VERBOTEN (Team): abgesagter Termin lehnt die Zusage ab', async () => {
      const eventId = await termin({ teamer_needed: true, teamer_max_participants: 5 });
      await absagen(eventId);

      const res = await request(app)
        .post(`/api/events/${eventId}/book`)
        .set('Authorization', `Bearer ${teamerToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Dieser Termin ist abgesagt');
      expect(await buchung(eventId, USERS.teamer1.id)).toBeUndefined();
    });

    it('ERLAUBT (Team): am aktiven Termin geht die Zusage', async () => {
      const eventId = await termin({ teamer_needed: true, teamer_max_participants: 5 });

      const res = await request(app)
        .post(`/api/events/${eventId}/book`)
        .set('Authorization', `Bearer ${teamerToken}`)
        .send({});

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('confirmed');
      expect((await buchung(eventId, USERS.teamer1.id)).status).toBe('confirmed');
    });

    /**
     * Der Team-Weg kennt die "Meinungsaenderung": Eine abgesagte Teamer-
     * Buchung (opted_out) wird bei einer erneuten Zusage AKTUALISIERT statt
     * mit 409 abgewiesen. Dieser Sonderweg umging den Riegel, solange er nur
     * im Konfi-Zweig stand — genau dafuer steht er jetzt vor der
     * Rollenweiche.
     */
    it('VERBOTEN (Team): auch die zurueckgenommene Team-Absage bleibt gesperrt', async () => {
      const eventId = await termin({ teamer_needed: true, teamer_max_participants: 5 });
      // Erst zusagen, dann absagen -> Buchung steht auf 'opted_out'.
      expect((await request(app)
        .post(`/api/events/${eventId}/book`)
        .set('Authorization', `Bearer ${teamerToken}`)
        .send({})).status).toBe(201);
      const abgesagt = await request(app)
        .post(`/api/teamer/events/${eventId}/zusage`)
        .set('Authorization', `Bearer ${teamerToken}`)
        .send({ dabei: false, reason: 'Krank' });
      expect(abgesagt.status).toBe(200);
      expect((await buchung(eventId, USERS.teamer1.id)).status).toBe('opted_out');

      await absagen(eventId);

      const res = await request(app)
        .post(`/api/events/${eventId}/book`)
        .set('Authorization', `Bearer ${teamerToken}`)
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Dieser Termin ist abgesagt');
      expect((await buchung(eventId, USERS.teamer1.id)).status).toBe('opted_out');
    });
  });

  // ==============================================================
  // 4. POST /teamer/events/:id/zusage
  // ==============================================================
  describe('POST /teamer/events/:id/zusage', () => {
    it('VERBOTEN: abgesagter Termin lehnt die Zusage ab', async () => {
      const eventId = await termin({ teamer_needed: true, teamer_max_participants: 5 });
      await absagen(eventId);

      const res = await request(app)
        .post(`/api/teamer/events/${eventId}/zusage`)
        .set('Authorization', `Bearer ${teamerToken}`)
        .send({ dabei: true });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Dieser Termin ist abgesagt');
      expect(await buchung(eventId, USERS.teamer1.id)).toBeUndefined();
    });

    it('ERLAUBT: am aktiven Termin geht die Zusage', async () => {
      const eventId = await termin({ teamer_needed: true, teamer_max_participants: 5 });

      const res = await request(app)
        .post(`/api/teamer/events/${eventId}/zusage`)
        .set('Authorization', `Bearer ${teamerToken}`)
        .send({ dabei: true });

      expect(res.status).toBe(200);
      expect((await buchung(eventId, USERS.teamer1.id)).status).toBe('confirmed');
    });
  });

  // ==============================================================
  // 5. POST /events/:id/participants — die Leitung traegt ein
  // ==============================================================
  describe('POST /events/:id/participants (Leitung traegt jemanden ein)', () => {
    it('VERBOTEN: auch die Leitung traegt an einem abgesagten Termin niemanden ein', async () => {
      const eventId = await termin();
      await absagen(eventId);

      const res = await request(app)
        .post(`/api/events/${eventId}/participants`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ user_id: USERS.konfi1.id });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Dieser Termin ist abgesagt');
      expect(await buchung(eventId, USERS.konfi1.id)).toBeUndefined();
    });

    it('ERLAUBT: am aktiven Termin traegt die Leitung ein', async () => {
      const eventId = await termin();

      const res = await request(app)
        .post(`/api/events/${eventId}/participants`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ user_id: USERS.konfi1.id });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('confirmed');
      expect((await buchung(eventId, USERS.konfi1.id)).status).toBe('confirmed');
    });
  });

  // ==============================================================
  // 6. PUT /events/:id/participants/:id/status — Warteliste -> bestaetigt
  // ==============================================================
  describe('PUT /events/:id/participants/:participantId/status', () => {
    /**
     * Termin mit genau einem Platz: konfi1 bestaetigt, konfi2 wartet.
     *
     * Danach wird die Kapazitaet auf 2 angehoben. Grund: Die Route prueft
     * seit 16.09.2026 beim Befoerdern von der Warteliste die Kapazitaet und
     * lehnt einen vollen Termin mit 400 "Der Termin ist voll" ab. Ohne die
     * Anhebung liefe der ERLAUBT-Fall in genau diese 400 — und zwar zu
     * Recht. Geprueft werden soll hier aber der ABSAGE-Riegel, nicht die
     * Kapazitaet: Deshalb wird die Warteliste mit einem Platz erzeugt und
     * erst danach Raum geschaffen. Direkt in der Datenbank, damit die
     * Wartelisten-Situation dabei unveraendert bleibt.
     */
    async function terminMitWartendem() {
      const eventId = await termin({ max_participants: 1, waitlist_enabled: true });
      expect((await request(app)
        .post(`/api/events/${eventId}/book`)
        .set('Authorization', `Bearer ${konfiToken}`)
        .send({})).status).toBe(201);
      const zweite = await request(app)
        .post(`/api/events/${eventId}/book`)
        .set('Authorization', `Bearer ${konfi2Token}`)
        .send({});
      expect(zweite.status).toBe(201);
      expect(zweite.body.status).toBe('waitlist');
      // Platz schaffen (Begruendung im Kopf dieser Hilfe). konfi2 bleibt
      // dabei auf der Warteliste — von allein rueckt hier niemand nach.
      await db.query('UPDATE events SET max_participants = 2 WHERE id = $1', [eventId]);
      expect((await buchung(eventId, USERS.konfi2.id)).status).toBe('waitlist');
      return eventId;
    }

    it('VERBOTEN: an einem abgesagten Termin wird niemand von der Warteliste bestaetigt', async () => {
      const eventId = await terminMitWartendem();
      const bookingId = await buchungsId(eventId, USERS.konfi2.id);
      await absagen(eventId);

      const res = await request(app)
        .put(`/api/events/${eventId}/participants/${bookingId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'confirmed' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Dieser Termin ist abgesagt');
    });

    it('ERLAUBT: am aktiven Termin wird von der Warteliste bestaetigt', async () => {
      const eventId = await terminMitWartendem();
      const bookingId = await buchungsId(eventId, USERS.konfi2.id);

      const res = await request(app)
        .put(`/api/events/${eventId}/participants/${bookingId}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'confirmed' });

      expect(res.status).toBe(200);
      expect((await buchung(eventId, USERS.konfi2.id)).status).toBe('confirmed');
    });
  });

  // ==============================================================
  // 7. ABMELDEN bleibt offen
  // ==============================================================
  describe('Abmelden geht auch am abgesagten Termin weiter', () => {
    it('Konfi kann sich vom abgesagten Pflichttermin abmelden', async () => {
      const eventId = await termin({ mandatory: true });
      // Pflichttermin meldet die Jahrgangs-Konfis automatisch an.
      expect((await buchung(eventId, USERS.konfi1.id)).status).toBe('confirmed');
      await absagen(eventId);

      // Die Absage hat die Buchung bereits abgemeldet — deshalb zuerst
      // zuruecknehmen, damit es hier wirklich um das Abmelden am ABGESAGTEN
      // Termin geht und nicht um einen schon abgemeldeten Zustand.
      await db.query(
        `UPDATE event_bookings SET status = 'confirmed',
                abgemeldet_durch_absage = FALSE, status_vor_absage = NULL
          WHERE event_id = $1 AND user_id = $2`,
        [eventId, USERS.konfi1.id]
      );

      const res = await request(app)
        .post(`/api/konfi/events/${eventId}/opt-out`)
        .set('Authorization', `Bearer ${konfiToken}`)
        .send({ reason: 'Ich kann nicht' });

      expect(res.status).toBe(200);
      expect((await buchung(eventId, USERS.konfi1.id)).status).toBe('opted_out');
    });

    it('Die Leitung kann eine Buchung am abgesagten Termin loeschen', async () => {
      const eventId = await termin();
      expect((await request(app)
        .post(`/api/events/${eventId}/book`)
        .set('Authorization', `Bearer ${konfiToken}`)
        .send({})).status).toBe(201);
      const bookingId = await buchungsId(eventId, USERS.konfi1.id);
      await absagen(eventId);

      const res = await request(app)
        .delete(`/api/events/${eventId}/bookings/${bookingId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(await buchung(eventId, USERS.konfi1.id)).toBeUndefined();
    });
  });

  // ==============================================================
  // 8. DIE FALLE: Absage zuruecknehmen bleibt unberuehrt
  // ==============================================================
  describe('Absage zuruecknehmen funktioniert unveraendert', () => {
    /**
     * DER KRITISCHE TEST. hebeAbsageAbmeldungenAuf stellt die Buchungen her,
     * WAEHREND cancelled noch TRUE ist beziehungsweise gerade FALSE wird —
     * in derselben Transaktion. Liefe die Wiederherstellung ueber eine der
     * gesperrten Routen, kaeme jetzt niemand mehr zurueck und der Termin
     * stuende offen ohne Angemeldete da.
     */
    it('Die Abgemeldeten kommen nach der Zuruecknahme zurueck', async () => {
      const eventId = await termin();
      expect((await request(app)
        .post(`/api/events/${eventId}/book`)
        .set('Authorization', `Bearer ${konfiToken}`)
        .send({})).status).toBe(201);
      expect((await request(app)
        .post(`/api/events/${eventId}/book`)
        .set('Authorization', `Bearer ${konfi2Token}`)
        .send({})).status).toBe(201);

      await absagen(eventId);
      // Die Absage hat beide abgemeldet.
      expect((await buchung(eventId, USERS.konfi1.id)).abgemeldet_durch_absage).toBe(true);
      expect((await buchung(eventId, USERS.konfi2.id)).abgemeldet_durch_absage).toBe(true);

      const res = await reaktivieren(eventId);

      expect(res.status).toBe(200);
      // Beide wieder angemeldet — der Riegel hat nicht zugeschlagen.
      expect((await buchung(eventId, USERS.konfi1.id)).status).toBe('confirmed');
      expect((await buchung(eventId, USERS.konfi2.id)).status).toBe('confirmed');
      const { rows: [event] } = await db.query('SELECT cancelled FROM events WHERE id = $1', [eventId]);
      expect(event.cancelled).toBe(false);
    });

    it('Wer auf der Warteliste stand, kommt auf die Warteliste zurueck', async () => {
      const eventId = await termin({ max_participants: 1, waitlist_enabled: true });
      expect((await request(app)
        .post(`/api/events/${eventId}/book`)
        .set('Authorization', `Bearer ${konfiToken}`)
        .send({})).status).toBe(201);
      const zweite = await request(app)
        .post(`/api/events/${eventId}/book`)
        .set('Authorization', `Bearer ${konfi2Token}`)
        .send({});
      expect(zweite.body.status).toBe('waitlist');

      await absagen(eventId);
      expect((await reaktivieren(eventId)).status).toBe(200);

      expect((await buchung(eventId, USERS.konfi1.id)).status).toBe('confirmed');
      expect((await buchung(eventId, USERS.konfi2.id)).status).toBe('waitlist');
    });

    it('Nach der Zuruecknahme geht das Anmelden wieder', async () => {
      const eventId = await termin();
      await absagen(eventId);

      // Gesperrt, solange abgesagt.
      const gesperrt = await request(app)
        .post(`/api/events/${eventId}/book`)
        .set('Authorization', `Bearer ${konfiToken}`)
        .send({});
      expect(gesperrt.status).toBe(400);

      expect((await reaktivieren(eventId)).status).toBe(200);

      // Und danach wieder offen — der Riegel haengt an cancelled, nicht an
      // einem Zustand, der nach der Zuruecknahme zurueckbliebe.
      const offen = await request(app)
        .post(`/api/events/${eventId}/book`)
        .set('Authorization', `Bearer ${konfiToken}`)
        .send({});
      expect(offen.status).toBe(201);
      expect(offen.body.status).toBe('confirmed');
    });

    it('Wer sich VOR der Absage selbst abgemeldet hatte, bleibt abgemeldet', async () => {
      const eventId = await termin({ mandatory: true });
      expect((await request(app)
        .post(`/api/konfi/events/${eventId}/opt-out`)
        .set('Authorization', `Bearer ${konfiToken}`)
        .send({ reason: 'Bin im Urlaub' })).status).toBe(200);

      await absagen(eventId);
      expect((await reaktivieren(eventId)).status).toBe(200);

      // Unveraendert: Die eigene Abmeldung ueberlebt die Zuruecknahme.
      expect((await buchung(eventId, USERS.konfi1.id)).status).toBe('opted_out');
      // konfi2 war nur durch die Absage abgemeldet und ist wieder dabei.
      expect((await buchung(eventId, USERS.konfi2.id)).status).toBe('confirmed');
    });
  });
});
