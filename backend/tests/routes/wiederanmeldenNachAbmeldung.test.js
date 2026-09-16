// WER ABGEMELDET WURDE, KANN SICH WIEDER ANMELDEN (16.09.2026)
//
// Simons Entscheidung, woertlich: "Wieder anmelden muss möglich sein. Wenn
// die sich abmelden[d] lebst wird der Termin bei ihnen ja wie[der] wie ein
// offener Termin den sie neu haben. So soll es sein. Alle anderen Regeln
// greifen wie immer. Bis zwei Tage vorher etc. Ist doch alles schon da."
//
// DER FEHLER, DEN DAS BEHEBT: Meldete die Leitung jemanden ab, bekam die
// Buchung status='excused' (Migration 153, 15.09.2026). bucheTermin kannte
// als Rueckweg aber nur status='opted_out' UND rolle='teamer' — eine
// abgemeldete Konfi lief in 409 "Du bist bereits für dieses Event
// angemeldet". Die Meldung war dabei sachlich falsch: Sie war gerade NICHT
// angemeldet, sie war abgemeldet worden.
//
// Auch der zweite Weg war zu: POST /konfi/events/:id/opt-in hat ein festes
// `AND status = 'opted_out'` im UPDATE und antwortet bei 'excused' mit 400
// "Keine Opt-out-Anmeldung gefunden" — selbst an einem Pflichttermin. Es gab
// fuer die Betroffene also gar keinen Weg zurueck.
//
// Das war ein Nebeneffekt, keine Entscheidung: Der Kommentar, der die
// Einschraenkung auf 'opted_out' begruendet, stammt vom 01.09.2026 — zwei
// Wochen VOR der Migration, die 'excused' eingefuehrt hat. Migration 153
// wurde ueberall sonst nachgezogen (Kapazitaet, Nachruecken, Erinnerungen,
// QR-Check-in); bucheTermin fiel durchs Raster.
//
// KEINE NEUE SONDERREGEL: Eine abgemeldete Person steht wieder vor einem
// offenen Termin, und ab da gilt, was ohnehin gilt — Anmeldeschluss,
// Kapazitaet, Warteliste, Zeitslot-Zwang, Konfirmations-Sperre. Genau das
// pruefen die Tests unten: nicht nur, DASS sie wieder hineinkommt, sondern
// dass sie an denselben Grenzen haengenbleibt wie alle anderen.
//
// NICHT BERUEHRT: die Check-in-Sperre am Termintag (checkin.js). Wer
// abgemeldet ist, checkt nicht per QR-Code ein — sonst holte sich eine krank
// gemeldete Konfi die Punkte selbst zurueck, die ihr die Abmeldung genommen
// hat. Das ist ein eigener Zweig in einer anderen Datei und bleibt stehen;
// der letzte Test hier haelt es fest.
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, JAHRGAENGE } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

describe('Wieder anmelden, nachdem die Leitung abgemeldet hat', () => {
  let app;
  let db;
  let adminToken;
  let konfiToken;
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
    // orgAdmin1 wie in anmeldungAnAbgesagtemTermin.test.js: nicht an
    // Jahrgaenge gebunden, damit die Tests am Thema haengenbleiben und nicht
    // an der Jahrgangs-Bindung.
    adminToken = generateToken('orgAdmin1');
    konfiToken = generateToken('konfi1');
    teamerToken = generateToken('teamer1');
  });

  // --------------------------------------------------------------
  // Hilfen
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

  async function anmelden(eventId, token, koerper = {}) {
    return request(app)
      .post(`/api/events/${eventId}/book`)
      .set('Authorization', `Bearer ${token}`)
      .send(koerper);
  }

  async function buchungsId(eventId, userId) {
    const { rows: [row] } = await db.query(
      'SELECT id FROM event_bookings WHERE event_id = $1 AND user_id = $2',
      [eventId, userId]
    );
    return row && row.id;
  }

  /** Die Leitung meldet jemanden ab -> status wird 'excused'. */
  async function abmeldenDurchLeitung(eventId, userId, grund = 'Krank gemeldet') {
    const id = await buchungsId(eventId, userId);
    const res = await request(app)
      .put(`/api/events/${eventId}/participants/${id}/attendance`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ attendance_status: 'excused', excuse_reason: grund });
    expect(res.status).toBe(200);
    // Gegenprobe, dass der Ausgangszustand wirklich der beschriebene ist --
    // sonst pruefen die Tests unten am Fall vorbei.
    const { rows: [row] } = await db.query(
      'SELECT status FROM event_bookings WHERE event_id = $1 AND user_id = $2',
      [eventId, userId]
    );
    expect(row.status).toBe('excused');
    return res;
  }

  async function buchung(eventId, userId) {
    const { rows: [row] } = await db.query(
      `SELECT status, timeslot_id, excuse_reason, attendance_status
         FROM event_bookings WHERE event_id = $1 AND user_id = $2`,
      [eventId, userId]
    );
    return row;
  }

  async function zeilenZahl(eventId, userId) {
    const { rows: [row] } = await db.query(
      'SELECT COUNT(*)::int AS anzahl FROM event_bookings WHERE event_id = $1 AND user_id = $2',
      [eventId, userId]
    );
    return row.anzahl;
  }

  // --------------------------------------------------------------
  // Der Kern: der Weg zurueck steht offen
  // --------------------------------------------------------------

  describe('Der Weg zurueck', () => {
    it('eine abgemeldete Konfi meldet sich wieder an und ist bestaetigt', async () => {
      const eventId = await termin();

      expect((await anmelden(eventId, konfiToken)).status).toBe(201);
      await abmeldenDurchLeitung(eventId, USERS.konfi1.id);

      const wieder = await anmelden(eventId, konfiToken);

      expect(wieder.status).toBe(201);
      expect((await buchung(eventId, USERS.konfi1.id)).status).toBe('confirmed');
    });

    it('die alte Zeile wird aktualisiert, es entsteht keine zweite', async () => {
      // Der UNIQUE-Index idx_event_bookings_user_event (user_id, event_id)
      // kennt keinen Statusfilter: Ein INSERT liefe auf 23505. Der Rueckweg
      // MUSS die vorhandene Zeile aktualisieren.
      const eventId = await termin();
      await anmelden(eventId, konfiToken);
      await abmeldenDurchLeitung(eventId, USERS.konfi1.id);

      await anmelden(eventId, konfiToken);

      expect(await zeilenZahl(eventId, USERS.konfi1.id)).toBe(1);
    });

    it('Abmeldegrund und Anwesenheitsstempel sind danach weg', async () => {
      // Die neue Anmeldung ERSETZT die Abmeldung, sie ergaenzt sie nicht.
      // Bliebe "Krank gemeldet" stehen, zeigte die Teilnehmerliste einen
      // Grund an einer Person, die wieder angemeldet ist.
      const eventId = await termin();
      await anmelden(eventId, konfiToken);
      await abmeldenDurchLeitung(eventId, USERS.konfi1.id, 'Masern');

      await anmelden(eventId, konfiToken);

      const nachher = await buchung(eventId, USERS.konfi1.id);
      expect(nachher.excuse_reason).toBeNull();
      expect(nachher.attendance_status).toBeNull();
    });

    it('auch eine abgemeldete Teamer:in meldet sich wieder an', async () => {
      const eventId = await termin({ teamer_needed: true, teamer_max_participants: 5 });

      expect((await anmelden(eventId, teamerToken)).status).toBe(201);
      await abmeldenDurchLeitung(eventId, USERS.teamer1.id);

      const wieder = await anmelden(eventId, teamerToken);

      expect(wieder.status).toBe(201);
      expect((await buchung(eventId, USERS.teamer1.id)).status).toBe('confirmed');
    });

    it('an einem Pflichttermin geht es ueber denselben Weg', async () => {
      const eventId = await termin({ mandatory: true });
      await anmelden(eventId, konfiToken);
      await abmeldenDurchLeitung(eventId, USERS.konfi1.id);

      const wieder = await anmelden(eventId, konfiToken);

      expect(wieder.status).toBe(201);
      expect((await buchung(eventId, USERS.konfi1.id)).status).toBe('confirmed');
    });
  });

  // --------------------------------------------------------------
  // "Alle anderen Regeln greifen wie immer" -- das ist der eigentliche
  // Gegenstand von Simons Entscheidung und deshalb ausfuehrlich geprueft.
  // --------------------------------------------------------------

  describe('Alle anderen Regeln greifen unveraendert', () => {
    it('nach Anmeldeschluss kommt sie NICHT mehr hinein', async () => {
      const gestern = new Date();
      gestern.setDate(gestern.getDate() - 1);
      const eventId = await termin({ registration_closes_at: gestern.toISOString() });

      // Anmelden, solange das Fenster noch offen ist: dafuer den Schluss
      // kurz in die Zukunft legen, buchen, dann wieder zurueckdrehen.
      const morgen = new Date();
      morgen.setDate(morgen.getDate() + 1);
      await db.query('UPDATE events SET registration_closes_at = $1 WHERE id = $2', [morgen, eventId]);
      expect((await anmelden(eventId, konfiToken)).status).toBe(201);
      await abmeldenDurchLeitung(eventId, USERS.konfi1.id);
      await db.query('UPDATE events SET registration_closes_at = $1 WHERE id = $2', [gestern, eventId]);

      const wieder = await anmelden(eventId, konfiToken);

      expect(wieder.status).toBe(400);
      expect((await buchung(eventId, USERS.konfi1.id)).status).toBe('excused');
    });

    it('ist der Termin voll, landet sie auf der Warteliste', async () => {
      const eventId = await termin({ max_participants: 1, waitlist_enabled: true });
      await anmelden(eventId, konfiToken);
      await abmeldenDurchLeitung(eventId, USERS.konfi1.id);
      // Der frei gewordene Platz geht an jemand anderen.
      expect((await anmelden(eventId, generateToken('konfi2'))).status).toBe(201);

      const wieder = await anmelden(eventId, konfiToken);

      expect(wieder.status).toBe(201);
      expect((await buchung(eventId, USERS.konfi1.id)).status).toBe('waitlist');
    });

    it('ist der Termin voll und die Warteliste aus, wird abgelehnt', async () => {
      const eventId = await termin({ max_participants: 1, waitlist_enabled: false });
      await anmelden(eventId, konfiToken);
      await abmeldenDurchLeitung(eventId, USERS.konfi1.id);
      expect((await anmelden(eventId, generateToken('konfi2'))).status).toBe(201);

      const wieder = await anmelden(eventId, konfiToken);

      expect(wieder.status).toBe(400);
      expect((await buchung(eventId, USERS.konfi1.id)).status).toBe('excused');
    });

    it('an einem abgesagten Termin bleibt sie draussen', async () => {
      // Der Riegel von heute frueh (bucheTermin, "ABGESAGT SCHLAEGT ALLES")
      // steht VOR der Doppelbuchungspruefung und muss weiter greifen.
      const eventId = await termin();
      await anmelden(eventId, konfiToken);
      await abmeldenDurchLeitung(eventId, USERS.konfi1.id);
      await request(app)
        .put(`/api/events/${eventId}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ cancelled_reason: 'Heizung defekt' })
        .expect(200);

      const wieder = await anmelden(eventId, konfiToken);

      expect(wieder.status).toBe(400);
      expect(wieder.body.error).toBe('Dieser Termin ist abgesagt');
    });

    it('bei Zeitslot-Terminen braucht sie wieder einen Slot', async () => {
      const eventId = await termin({ has_timeslots: true });
      const { rows: [slot] } = await db.query(
        `INSERT INTO event_timeslots (event_id, start_time, end_time, max_participants, organization_id)
         VALUES ($1, NOW() + interval '14 days', NOW() + interval '14 days' + interval '2 hours', 5, 1)
         RETURNING id`,
        [eventId]
      );
      await anmelden(eventId, konfiToken, { timeslot_id: slot.id });
      await abmeldenDurchLeitung(eventId, USERS.konfi1.id);

      const ohneSlot = await anmelden(eventId, konfiToken);
      expect(ohneSlot.status).toBe(400);

      const mitSlot = await anmelden(eventId, konfiToken, { timeslot_id: slot.id });
      expect(mitSlot.status).toBe(201);
      expect((await buchung(eventId, USERS.konfi1.id)).timeslot_id).toBe(slot.id);
    });
  });

  // --------------------------------------------------------------
  // Was NICHT aufgeht
  // --------------------------------------------------------------

  describe('Was gesperrt bleibt', () => {
    it('eine bestaetigte Buchung meldet weiterhin 409', async () => {
      // Die Ausnahme gilt abgemeldeten Zeilen, nicht jeder Zeile: Ein
      // zweiter Versuch bei bestehender Anmeldung bleibt ein Doppelklick.
      const eventId = await termin();
      await anmelden(eventId, konfiToken);

      const nochmal = await anmelden(eventId, konfiToken);

      expect(nochmal.status).toBe(409);
      expect(await zeilenZahl(eventId, USERS.konfi1.id)).toBe(1);
    });

    it('wer auf der Warteliste steht, meldet sich nicht ein zweites Mal an', async () => {
      const eventId = await termin({ max_participants: 1, waitlist_enabled: true });
      expect((await anmelden(eventId, generateToken('konfi2'))).status).toBe(201);
      expect((await anmelden(eventId, konfiToken)).status).toBe(201);
      expect((await buchung(eventId, USERS.konfi1.id)).status).toBe('waitlist');

      const nochmal = await anmelden(eventId, konfiToken);

      expect(nochmal.status).toBe(409);
    });

    // DER QR-CHECK-IN BLEIBT GESPERRT -- geprueft wird das nicht hier,
    // sondern in abmeldungImBuchungsstatus.test.js ("Der QR-Check-in weist
    // eine Abmeldung ab"). Dort steht der Fall vollstaendig, samt
    // Token-Erzeugung und der Gegenprobe, dass die Abmeldung unveraendert
    // stehen bleibt. Ihn hier ein zweites Mal zu bauen hiesse, zwei Fassungen
    // derselben Pruefung zu pflegen, die beim naechsten Wortlautwechsel
    // auseinanderlaufen.
    //
    // Fuer diese Aenderung zaehlt nur: Der Weg zurueck fuehrt ueber die
    // ANMELDUNG (bucheTermin), nicht ueber den Check-in. Wer abgemeldet ist
    // und doch kommt, meldet sich vorher wieder an oder wird von der Leitung
    // verbucht -- er scannt sich nicht selbst die Punkte zurueck.
  });
});
