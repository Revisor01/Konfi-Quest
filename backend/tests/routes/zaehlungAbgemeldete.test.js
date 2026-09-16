// SIMONS FALL VOM 16.09.2026: ABGEMELDETE ZAEHLEN NICHT MIT.
//
// Beobachtet an einem Pflichttermin in Org 4 ("PRUEFLAUF Pflicht
// Nachruecken"): 13 Konfis im Jahrgang, alle automatisch eingetragen. Dann
// meldete sich eine selbst ab ('opted_out'), eine wurde von der Leitung
// abgemeldet ('excused'). Faktisch angemeldet waren 11.
//
// Die Rueckfrage vor dem Absagen sagte trotzdem "13 Konfis angemeldet",
// waehrend die Kacheln im selben Bild "11 von 13 TN" zeigten. Zwei Zahlen fuer
// dieselbe Frage, nebeneinander, in einer Ansicht.
//
// DIE REGEL, die diese Tests festschreiben:
//   Angemeldet ist, wer auf status = 'confirmed' steht.
//   Weder die Selbstabmeldung ('opted_out') noch die Abmeldung durch die
//   Leitung ('excused') zaehlt als Teilnahme -- fuer BEIDE gilt dasselbe,
//   denn beide geben den Platz frei.
//
// Und: Bei einem Pflichttermin gibt es keine Kapazitaet (max_participants =
// 0, angezeigt als "unendlich"). Die Zahl davor muss trotzdem stimmen -- ohne
// Nenner faellt ein falscher Zaehler niemandem auf.
//
// Geprueft wird JEDE Route, die eine Zahl liefert, gegen DIESELBE konkrete
// Erwartung: 11. Nicht gegeneinander -- zwei Routen koennen sich auch
// gemeinsam irren.
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, EVENTS, JAHRGAENGE } = require('../helpers/seed');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-vitest';

// Der Pflichttermin aus dem Seed: max_participants = 0 (= unbegrenzt),
// mandatory = true. Genau die Sorte Termin, an der Simon den Fehler sah.
const PFLICHT = EVENTS.pflichtEvent.id;
// Der Gottesdienst-Termin hat eine Kapazitaet (50) -- fuer den Gegenfall
// "freie Plaetze stimmen, wenn jemand abgemeldet ist".
const MIT_KAPAZITAET = EVENTS.gottesdienstEvent.id;

// Der Seed hat in Org 1 nur konfi1 und konfi2. Simons Fall braucht 13.
const KONFI_IDS = Array.from({ length: 11 }, (_, i) => 900 + i);
// 13 = konfi1 + konfi2 + die 11 zusaetzlichen.
const ALLE_KONFIS = [USERS.konfi1.id, USERS.konfi2.id, ...KONFI_IDS];

function tokenFuer(id, roleId, type) {
  return jwt.sign(
    { id, type, display_name: `User ${id}`, organization_id: 1, role_id: roleId },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

describe('Abgemeldete zaehlen nicht als Teilnehmende (Simons Fall, 16.09.2026)', () => {
  let db, app, adminToken;

  beforeAll(async () => { db = getTestPool(); app = getTestApp(db); });
  afterAll(async () => { await closePool(); });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);

    // Die Terminliste filtert auch fuer 'admin' nach zugewiesenen Jahrgaengen.
    await db.query(
      `INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id, can_view, can_edit)
       VALUES ($1, $2, true, true)`,
      [USERS.admin1.id, JAHRGAENGE.jahrgang1.id]
    );

    for (const id of KONFI_IDS) {
      await db.query(
        `INSERT INTO users (id, username, password_hash, display_name, role_id, organization_id, is_active)
         VALUES ($1, $2, 'x', $3, 1, 1, true)`,
        [id, `zaehl_konfi_${id}`, `Zaehl Konfi ${id}`]
      );
      await db.query(
        'INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id, can_view) VALUES ($1, $2, true)',
        [id, JAHRGAENGE.jahrgang1.id]
      );
      await db.query(
        `INSERT INTO konfi_profiles (user_id, jahrgang_id, organization_id, gemeinde_points, gottesdienst_points)
         VALUES ($1, $2, 1, 0, 0)`,
        [id, JAHRGAENGE.jahrgang1.id]
      );
    }

    // Beide Termine an den Jahrgang haengen, sonst stehen sie in der
    // Konfi-Liste gar nicht drin.
    for (const ev of [PFLICHT, MIT_KAPAZITAET]) {
      await db.query(
        `INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id)
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [ev, JAHRGAENGE.jahrgang1.id]
      );
    }

    const { invalidateUserCache } = require('../../middleware/rbac');
    [USERS.admin1.id, ...ALLE_KONFIS].forEach(invalidateUserCache);
    adminToken = tokenFuer(USERS.admin1.id, 3, 'admin');
  });

  /**
   * Simons Ausgangslage an einem Termin: 13 eingetragen, davon eine selbst
   * abgemeldet und eine von der Leitung abgemeldet. Bleiben 11.
   *
   * Die beiden Abmeldungen laufen ueber die Status, die das Backend selbst
   * setzt: 'opted_out' fuer die Selbstabmeldung (Konfi-Opt-out), 'excused'
   * fuer die Abmeldung durch die Leitung (Migration 153).
   */
  async function dreizehnEingetragenZweiAbgemeldet(eventId) {
    for (const id of ALLE_KONFIS) {
      await db.query(
        `INSERT INTO event_bookings (user_id, event_id, status, organization_id)
         VALUES ($1, $2, 'confirmed', 1)`,
        [id, eventId]
      );
    }
    // Emilia meldet sich selbst ab.
    await db.query(
      `UPDATE event_bookings SET status = 'opted_out'
        WHERE event_id = $1 AND user_id = $2`,
      [eventId, USERS.konfi1.id]
    );
    // Die Leitung meldet eine zweite ab.
    await db.query(
      `UPDATE event_bookings SET status = 'excused', attendance_status = 'excused'
        WHERE event_id = $1 AND user_id = $2`,
      [eventId, USERS.konfi2.id]
    );
  }

  // ----------------------------------------------------------------
  // Die View -- die Quelle, aus der alle anderen lesen sollen
  // ----------------------------------------------------------------

  it('die View zaehlt 11 angemeldet, 1 selbst abgemeldet, 1 abgemeldet', async () => {
    await dreizehnEingetragenZweiAbgemeldet(PFLICHT);

    const { rows: [s] } = await db.query(
      'SELECT * FROM event_booking_stats WHERE event_id = $1', [PFLICHT]
    );

    expect(s.konfi_confirmed).toBe(11);
    expect(s.konfi_opted_out).toBe(1);
    expect(s.konfi_excused).toBe(1);
    // Die beiden Abmeldungen belegen keinen Platz mehr.
    expect(s.gebucht_gesamt).toBe(11);
    // Verbotener Fall: eine Abgemeldete als "noch zu verbuchen" fuehren.
    expect(s.konfi_offen).toBe(11);
  });

  // ----------------------------------------------------------------
  // Jede Route, die eine Zahl liefert -- gegen dieselbe konkrete 11
  // ----------------------------------------------------------------

  it('GET /events (Leitungsliste) meldet 11, nicht 13', async () => {
    await dreizehnEingetragenZweiAbgemeldet(PFLICHT);

    const res = await request(app)
      .get('/api/events')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const ev = res.body.find(e => e.id === PFLICHT);
    expect(Number(ev.registered_count)).toBe(11);
    // Additives Feld (16.09.2026): beide Abmelde-Arten zusammen.
    expect(Number(ev.abgemeldet_count)).toBe(2);
    // total_participants meint ausdruecklich ALLE Buchungen, auch die
    // abgemeldeten -- die Zahl darf hier NICHT auf 11 fallen, sonst hat sie
    // still ihre Bedeutung gewechselt.
    expect(Number(ev.total_participants)).toBe(13);
  });

  it('GET /events/:id (Leitungsdetail) meldet 11, nicht 13', async () => {
    await dreizehnEingetragenZweiAbgemeldet(PFLICHT);

    const res = await request(app)
      .get(`/api/events/${PFLICHT}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Number(res.body.registered_count)).toBe(11);
    // Pflichttermin ohne Kapazitaet: max_participants = 0 ("unendlich").
    // Die 11 muss auch ohne Nenner stimmen.
    expect(Number(res.body.max_participants)).toBe(0);
    // Die Teilnehmerliste enthaelt weiterhin alle 13 -- abgemeldet heisst
    // nicht geloescht, die Leitung muss sehen, wer sich abgemeldet hat.
    const konfis = res.body.participants.filter(p => p.role_name === 'konfi');
    expect(konfis.length).toBe(13);
    expect(konfis.filter(p => p.status === 'confirmed').length).toBe(11);
  });

  it('GET /konfi/events (Konfi-Liste) meldet 11, nicht 13', async () => {
    await dreizehnEingetragenZweiAbgemeldet(PFLICHT);

    const res = await request(app)
      .get('/api/konfi/events')
      .set('Authorization', `Bearer ${tokenFuer(KONFI_IDS[0], 1, 'konfi')}`);

    expect(res.status).toBe(200);
    const ev = res.body.find(e => e.id === PFLICHT);
    expect(ev).toBeTruthy();
    expect(Number(ev.registered_count)).toBe(11);
    expect(Number(ev.abgemeldet_count)).toBe(2);
  });

  it('GET /konfi/events/:id/status meldet 11, nicht 13', async () => {
    await dreizehnEingetragenZweiAbgemeldet(PFLICHT);

    const res = await request(app)
      .get(`/api/konfi/events/${PFLICHT}/status`)
      .set('Authorization', `Bearer ${tokenFuer(KONFI_IDS[0], 1, 'konfi')}`);

    expect(res.status).toBe(200);
    expect(Number(res.body.confirmed_count)).toBe(11);
  });

  it('die selbst Abgemeldete sieht in ihrer eigenen Ansicht auch 11', async () => {
    await dreizehnEingetragenZweiAbgemeldet(PFLICHT);

    // Emilias Fall: Sie hat sich abgemeldet und schaut den Termin an. Die
    // Teilnehmerzahl haengt nicht davon ab, WER fragt.
    const res = await request(app)
      .get('/api/konfi/events')
      .set('Authorization', `Bearer ${tokenFuer(USERS.konfi1.id, 1, 'konfi')}`);

    const ev = res.body.find(e => e.id === PFLICHT);
    expect(Number(ev.registered_count)).toBe(11);
    expect(ev.is_opted_out).toBe(true);
  });

  // ----------------------------------------------------------------
  // Kapazitaet: freie Plaetze nach einer Abmeldung
  // ----------------------------------------------------------------

  it('ein abgemeldeter Platz ist wieder frei', async () => {
    await dreizehnEingetragenZweiAbgemeldet(MIT_KAPAZITAET);

    const res = await request(app)
      .get(`/api/events/${MIT_KAPAZITAET}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(Number(res.body.registered_count)).toBe(11);
    expect(Number(res.body.max_participants)).toBe(50);
    // 50 - 11 = 39, nicht 37. Die beiden Abgemeldeten halten keinen Platz.
    expect(Number(res.body.available_spots)).toBe(39);
  });

  // ----------------------------------------------------------------
  // Serientermine -- bis 16.09.2026 die letzte Stelle mit eigener Rechnung
  // ----------------------------------------------------------------

  it('Serientermine zaehlen wie alles andere: Konfis, keine Teamer', async () => {
    // Zwei Termine derselben Serie. Der zweite ist der, dessen Zahl im Detail
    // des ersten als "N/max TN" steht.
    // series_id ist ein Fremdschluessel auf events -- der erste Termin der
    // Serie ist ihr eigener Anker.
    await db.query(
      `UPDATE events SET is_series = TRUE, series_id = $1 WHERE id IN ($1, $2)`,
      [PFLICHT, MIT_KAPAZITAET]
    );
    await dreizehnEingetragenZweiAbgemeldet(MIT_KAPAZITAET);
    // Dazu eine Teamer-Buchung: Sie darf NICHT als Konfi mitzaehlen.
    await db.query(
      `INSERT INTO event_bookings (user_id, event_id, status, organization_id)
       VALUES ($1, $2, 'confirmed', 1)`,
      [USERS.teamer1.id, MIT_KAPAZITAET]
    );

    const res = await request(app)
      .get(`/api/events/${PFLICHT}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    const serie = res.body.series_events.find(e => e.id === MIT_KAPAZITAET);
    expect(serie).toBeTruthy();
    // Vorher: 12 (11 Konfis + 1 Teamer, kein Rollenfilter).
    expect(Number(serie.registered_count)).toBe(11);
  });
});

// ------------------------------------------------------------------
// WAEHREND EINER ABSAGE und DANACH
// ------------------------------------------------------------------
//
// ENTSCHEIDUNG (16.09.2026): Waehrend ein Termin abgesagt ist, ist die Zahl
// der Teilnehmenden 0 -- und das bleibt so. Die Absage meldet alle ab
// (meldeAlleAbBeiAbsage setzt jede Buchung auf 'excused'), und wer abgemeldet
// ist, nimmt nicht teil. Die urspruengliche Zahl in registered_count stehen
// zu lassen hiesse, demselben Feldnamen bei abgesagten Terminen eine zweite
// Bedeutung zu geben -- genau die Fehlerklasse, gegen die die View gebaut
// wurde.
//
// Damit die 0 nicht nichtssagend dasteht, kommt die Zahl, um die es ging,
// ADDITIV daneben: abgemeldet_count. Die Ansicht zeigt bei einer Absage
// diese statt der Platz-Zahlen; das Feld registered_count bleibt unberuehrt
// und heisst weiter, was es ueberall heisst.
describe('Absage: waehrenddessen 0, danach wieder die urspruengliche Zahl', () => {
  let db, app, adminToken;
  const PFLICHT = EVENTS.pflichtEvent.id;
  const KONFI_IDS = Array.from({ length: 11 }, (_, i) => 940 + i);
  const ALLE_KONFIS = [USERS.konfi1.id, USERS.konfi2.id, ...KONFI_IDS];

  beforeAll(async () => { db = getTestPool(); app = getTestApp(db); });
  afterAll(async () => { await closePool(); });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    await db.query(
      `INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id, can_view, can_edit)
       VALUES ($1, $2, true, true)`,
      [USERS.admin1.id, JAHRGAENGE.jahrgang1.id]
    );
    for (const id of KONFI_IDS) {
      await db.query(
        `INSERT INTO users (id, username, password_hash, display_name, role_id, organization_id, is_active)
         VALUES ($1, $2, 'x', $3, 1, 1, true)`,
        [id, `absage_konfi_${id}`, `Absage Konfi ${id}`]
      );
      await db.query(
        'INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id, can_view) VALUES ($1, $2, true)',
        [id, JAHRGAENGE.jahrgang1.id]
      );
      await db.query(
        `INSERT INTO konfi_profiles (user_id, jahrgang_id, organization_id, gemeinde_points, gottesdienst_points)
         VALUES ($1, $2, 1, 0, 0)`,
        [id, JAHRGAENGE.jahrgang1.id]
      );
    }
    await db.query(
      `INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id)
       VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [PFLICHT, JAHRGAENGE.jahrgang1.id]
    );
    const { invalidateUserCache } = require('../../middleware/rbac');
    [USERS.admin1.id, ...ALLE_KONFIS].forEach(invalidateUserCache);
    adminToken = jwt.sign(
      { id: USERS.admin1.id, type: 'admin', display_name: 'Admin', organization_id: 1, role_id: 3 },
      JWT_SECRET, { expiresIn: '1h' }
    );
  });

  it('waehrend der Absage: 0 dabei, aber die Zahl, um die es ging, steht daneben', async () => {
    // 13 angemeldet, keine Abmeldung vorab -- der reine Absage-Fall.
    for (const id of ALLE_KONFIS) {
      await db.query(
        `INSERT INTO event_bookings (user_id, event_id, status, organization_id)
         VALUES ($1, $2, 'confirmed', 1)`,
        [id, PFLICHT]
      );
    }

    const absage = await request(app)
      .put(`/api/events/${PFLICHT}/cancel`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ notification_message: 'Faellt aus.', cancelled_reason: 'Heizung defekt' });
    expect(absage.status).toBe(200);

    const { rows: [s] } = await db.query(
      'SELECT * FROM event_booking_stats WHERE event_id = $1', [PFLICHT]
    );
    // Alle stehen auf 'excused' -- niemand nimmt teil.
    expect(s.konfi_confirmed).toBe(0);
    expect(s.konfi_excused).toBe(13);

    const res = await request(app)
      .get('/api/events/cancelled')
      .set('Authorization', `Bearer ${adminToken}`);
    const ev = res.body.find(e => e.id === PFLICHT);
    // Die entschiedene Zahl: 0 dabei.
    expect(Number(ev.registered_count)).toBe(0);
    // Und daneben, additiv: um 13 ging es.
    expect(Number(ev.durch_absage_abgemeldet_count)).toBe(13);

    // Dieselbe 0 in der Konfi-Ansicht -- konsistent, nicht je Rolle anders.
    const konfiRes = await request(app)
      .get('/api/konfi/events')
      .set('Authorization', `Bearer ${jwt.sign(
        { id: KONFI_IDS[0], type: 'konfi', display_name: 'K', organization_id: 1, role_id: 1 },
        JWT_SECRET, { expiresIn: '1h' })}`);
    const konfiEv = konfiRes.body.find(e => e.id === PFLICHT);
    expect(Number(konfiEv.registered_count)).toBe(0);
    expect(Number(konfiEv.abgemeldet_count)).toBe(13);
  });

  it('nach dem Zuruecknehmen steht wieder die urspruengliche Zahl', async () => {
    for (const id of ALLE_KONFIS) {
      await db.query(
        `INSERT INTO event_bookings (user_id, event_id, status, organization_id)
         VALUES ($1, $2, 'confirmed', 1)`,
        [id, PFLICHT]
      );
    }
    // Eine meldet sich VOR der Absage selbst ab -- sie kommt nicht zurueck.
    await db.query(
      `UPDATE event_bookings SET status = 'opted_out'
        WHERE event_id = $1 AND user_id = $2`,
      [PFLICHT, USERS.konfi1.id]
    );

    await request(app)
      .put(`/api/events/${PFLICHT}/cancel`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ notification_message: 'Faellt aus.' });

    await request(app)
      .put(`/api/events/${PFLICHT}/reaktivieren`)
      .set('Authorization', `Bearer ${adminToken}`);

    const { rows: [s] } = await db.query(
      'SELECT * FROM event_booking_stats WHERE event_id = $1', [PFLICHT]
    );
    // 12 kommen zurueck (13 minus die eine, die sich vorher selbst abmeldete).
    expect(s.konfi_confirmed).toBe(12);
    expect(s.konfi_opted_out).toBe(1);
    expect(s.konfi_excused).toBe(0);

    const res = await request(app)
      .get('/api/events')
      .set('Authorization', `Bearer ${adminToken}`);
    const ev = res.body.find(e => e.id === PFLICHT);
    expect(Number(ev.registered_count)).toBe(12);
    expect(Number(ev.abgemeldet_count)).toBe(1);
  });
});
