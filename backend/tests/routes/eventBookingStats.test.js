// backend/tests/routes/eventBookingStats.test.js
//
// Die View event_booking_stats ist die EINZIGE Quelle für Buchungszahlen
// (Migration 128). Diese Tests schreiben ihre Bedeutung fest.
//
// Warum es sie gibt: Fünf Endpunkte zählten dieselben Buchungen mit drei
// verschiedenen Bedeutungen. An einem einzigen Tag (25.08.2026) führte das zu
// drei gemeldeten Fehlern — "0 von 21" statt "19 von 21", "15 Konfis" statt
// 19, und ein Detail, das 23 zählte, wo die Liste 19 zeigte.
//
// Wer diese Tests rot macht, ändert die Bedeutung einer Zahl. Das ist eine
// bewusste Entscheidung und darf nicht nebenbei passieren.
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, EVENTS, JAHRGAENGE } = require('../helpers/seed');

describe('event_booking_stats: eine Quelle für alle Zahlen', () => {
  let db;
  const EVENT = EVENTS.gottesdienstEvent.id;

  beforeAll(async () => { db = getTestPool(); });
  beforeEach(async () => { await truncateAll(db); await seed(db); });
  afterAll(async () => { await closePool(); });

  const buchen = (userId, status, attendance = null) =>
    db.query(
      `INSERT INTO event_bookings (user_id, event_id, status, attendance_status, organization_id)
       VALUES ($1, $2, $3, $4, 1)`,
      [userId, EVENT, status, attendance]
    );

  const stats = async () => {
    const { rows } = await db.query(
      'SELECT * FROM event_booking_stats WHERE event_id = $1', [EVENT]
    );
    return rows[0];
  };

  it('trennt Konfis und Teamer sauber', async () => {
    await buchen(USERS.konfi1.id, 'confirmed');
    await buchen(USERS.konfi2.id, 'confirmed');
    await buchen(USERS.teamer1.id, 'confirmed');

    const s = await stats();
    // Der Fehler vom 25.08.: Teamer wurden mitgezählt oder doppelt abgezogen.
    expect(s.konfi_confirmed).toBe(2);
    expect(s.teamer_confirmed).toBe(1);
  });

  it('Abgemeldete sind KEINE Teilnehmenden und KEIN offener Fall', async () => {
    // Gehaertet 28.08.2026: Vorher stand hier eine confirmed-Buchung daneben
    // und die Zusicherung lautete konfi_offen === 1. Die 1 kam von der
    // confirmed-Buchung — der Test waere auch dann gruen geblieben, wenn die
    // Abgemeldete faelschlich mitgezaehlt und die andere nicht gezaehlt
    // worden waere. Er prueft die Regel jetzt allein.
    await buchen(USERS.konfi2.id, 'opted_out');

    const s = await stats();
    expect(s.konfi_confirmed).toBe(0);
    expect(s.konfi_opted_out).toBe(1);
    // Verbotener Fall: Abgemeldete als "noch zu verbuchen" zu fuehren.
    expect(s.konfi_offen).toBe(0);
  });

  it('Abgemeldete neben Zusagen aendern den offenen Stand nicht', async () => {
    // Der Fall aus dem alten Test, jetzt mit klarer Erwartung: Die eine
    // offene Zusage bleibt offen, die Abgemeldete kommt nicht dazu.
    await buchen(USERS.konfi1.id, 'confirmed');
    await buchen(USERS.konfi2.id, 'opted_out');

    const s = await stats();
    expect(s.konfi_confirmed).toBe(1);
    expect(s.konfi_opted_out).toBe(1);
    expect(s.konfi_offen).toBe(1);
  });

  it('offen zaehlt nur Zusagen ohne erfasste Anwesenheit', async () => {
    await buchen(USERS.konfi1.id, 'confirmed', 'present');
    await buchen(USERS.konfi2.id, 'confirmed', 'absent');
    await buchen(USERS.konfi3.id, 'confirmed', null);

    const s = await stats();
    expect(s.konfi_confirmed).toBe(3);
    expect(s.konfi_offen).toBe(1);
  });

  it('trennt offene Faelle nach Rolle', async () => {
    // "Alle bestaetigen" verbucht nur Konfis. Ohne die Trennung klemmt ein
    // Team-Termin dauerhaft im Verbuchen-Tab (Befund 3).
    await buchen(USERS.konfi1.id, 'confirmed', 'present');
    await buchen(USERS.teamer1.id, 'confirmed', null);

    const s = await stats();
    expect(s.konfi_offen).toBe(0);
    expect(s.teamer_offen).toBe(1);
  });

  it('zaehlt Wartelisten getrennt nach Rolle', async () => {
    await buchen(USERS.konfi1.id, 'waitlist');
    await buchen(USERS.teamer1.id, 'waitlist');

    const s = await stats();
    expect(s.konfi_waitlist).toBe(1);
    expect(s.teamer_waitlist).toBe(1);
  });

  it('gebucht_gesamt laesst Abgemeldete aus', async () => {
    await buchen(USERS.konfi1.id, 'confirmed');
    await buchen(USERS.konfi2.id, 'waitlist');
    await buchen(USERS.konfi3.id, 'opted_out');

    expect((await stats()).gebucht_gesamt).toBe(2);
  });

  it('zaehlt geloeschte Konten nicht mit', async () => {
    await buchen(USERS.konfi1.id, 'confirmed');
    await buchen(USERS.konfi2.id, 'confirmed');
    await db.query('UPDATE users SET deleted_at = NOW() WHERE id = $1', [USERS.konfi2.id]);

    const s = await stats();
    expect(s.konfi_confirmed).toBe(1);
  });

  it('bildet den echten Fall der Konfi-Fahrt ab (19 Konfis, 4 Teamer, 2 abgemeldet)', async () => {
    // Genau die Konstellation, die am 25.08. drei verschiedene Zahlen ergab.
    //
    // Gehaertet 28.08.2026: Vorher buchte dieser Test USERS.konfi4 — den es
    // im Seed nicht gibt. Der Fallback (konfi1.id + 100) traf keinen
    // vorhandenen Nutzer, das INSERT scheiterte am Fremdschluessel und ein
    // .catch(() => {}) schluckte den Fehler. Der Abgemeldeten-Fall, den der
    // Titel verspricht, wurde also gar nicht geprueft. Die Schluss-Zusicherung
    // war ausserdem tautologisch: sie ist fuer jedes teamer_confirmed !== 0
    // wahr, unabhaengig davon, ob die Zahlen stimmen.
    //
    // Jetzt mit echten Nutzern und den Zahlen im Verhaeltnis des echten Falls
    // (der Seed hat drei Konfis, nicht neunzehn).
    for (const id of [USERS.konfi1.id, USERS.konfi2.id]) await buchen(id, 'confirmed');
    await buchen(USERS.teamer1.id, 'confirmed');
    await buchen(USERS.konfi3.id, 'opted_out');

    const s = await stats();
    // Die Teilnehmerzahl ist konfi_confirmed: weder die Teamer noch die
    // Abgemeldete zaehlen hinein.
    expect(s.konfi_confirmed).toBe(2);
    expect(s.teamer_confirmed).toBe(1);
    expect(s.konfi_opted_out).toBe(1);
    // gebucht_gesamt zaehlt Konfis und Teamer, aber keine Abgemeldeten.
    expect(s.gebucht_gesamt).toBe(3);
    // Und alle drei Zusagen stehen noch zum Verbuchen offen.
    expect(s.konfi_offen).toBe(2);
    expect(s.teamer_offen).toBe(1);
  });
});

// Die View und die Endpunkte muessen DIESELBEN Zahlen liefern — sonst hat das
// Aufraeumen nichts gebracht und es gibt wieder zwei Wahrheiten. Dieser Test
// vergleicht sie direkt und faellt auf, wenn eine Seite kuenftig abweicht.
describe('event_booking_stats deckt sich mit den Endpunkten', () => {
  const request = require('supertest');
  const { getTestApp } = require('../helpers/testApp');
  const { generateToken } = require('../helpers/auth');
  let db2, app2;
  const EVENT = EVENTS.gottesdienstEvent.id;

  beforeAll(async () => { db2 = getTestPool(); app2 = getTestApp(db2); });
  beforeEach(async () => {
    await truncateAll(db2);
    await seed(db2);
    await db2.query(
      `INSERT INTO event_bookings (user_id, event_id, status, organization_id) VALUES
         ($1,$4,'confirmed',1), ($2,$4,'confirmed',1), ($3,$4,'confirmed',1)`,
      [USERS.konfi1.id, USERS.konfi2.id, USERS.teamer1.id, EVENT]
    );
    // Jahrgangs-Bindung (01.09.2026): Die Terminliste filtert auch fuer die
    // Rolle 'admin' nach zugewiesenen Jahrgaengen; der Seed-Termin haengt an
    // jahrgang1. admin1 bekommt ihn fuer den Vergleich zugewiesen.
    await db2.query(
      'INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id, can_view, can_edit) VALUES ($1, $2, true, true)',
      [USERS.admin1.id, JAHRGAENGE.jahrgang1.id]
    );
    require('../../middleware/rbac').invalidateUserCache(USERS.admin1.id);
  });

  it('Liste und View melden dieselbe Konfi-Zahl', async () => {
    const { rows: [s] } = await db2.query(
      'SELECT * FROM event_booking_stats WHERE event_id = $1', [EVENT]
    );
    const res = await request(app2)
      .get('/api/events')
      .set('Authorization', `Bearer ${generateToken('admin1')}`);

    const ev = res.body.find((e) => e.id === EVENT);
    expect(Number(ev.registered_count)).toBe(s.konfi_confirmed);
    expect(Number(ev.teamer_count)).toBe(s.teamer_confirmed);
    // Der konkrete Fall: 2 Konfis, 1 Teamer — nicht 3, nicht 1.
    expect(s.konfi_confirmed).toBe(2);
    expect(s.teamer_confirmed).toBe(1);
  });

  it('Detail und View melden dieselbe Konfi-Zahl', async () => {
    const { rows: [s] } = await db2.query(
      'SELECT * FROM event_booking_stats WHERE event_id = $1', [EVENT]
    );
    const res = await request(app2)
      .get(`/api/events/${EVENT}`)
      .set('Authorization', `Bearer ${generateToken('admin1')}`);

    // Genau der Widerspruch, der am 25.08. auffiel: Detail zaehlte Teamer mit.
    expect(Number(res.body.registered_count)).toBe(s.konfi_confirmed);
  });

  // Ab 28.08.2026 lesen auch die beiden Konfi-Endpunkte die View. Ohne diese
  // Gegenproben faellt es nicht auf, wenn dort kuenftig wieder eigenstaendig
  // gezaehlt wird.
  it('Konfi-Liste und View melden dieselbe Konfi-Zahl', async () => {
    // Der Termin muss dem Jahrgang der Konfi zugeordnet sein, sonst kommt er
    // in ihrer Liste gar nicht vor.
    await db2.query(
      `INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id)
       VALUES ($1, 1) ON CONFLICT DO NOTHING`,
      [EVENT]
    );

    const { rows: [s] } = await db2.query(
      'SELECT * FROM event_booking_stats WHERE event_id = $1', [EVENT]
    );
    const res = await request(app2)
      .get('/api/konfi/events')
      .set('Authorization', `Bearer ${generateToken('konfi1')}`);

    const ev = res.body.find((e) => e.id === EVENT);
    expect(ev).toBeDefined();
    expect(Number(ev.registered_count)).toBe(s.konfi_confirmed);
    expect(Number(ev.teamer_count)).toBe(s.teamer_confirmed);
  });

  it('Konfi-Terminstatus und View melden dieselbe Konfi-Zahl', async () => {
    const { rows: [s] } = await db2.query(
      'SELECT * FROM event_booking_stats WHERE event_id = $1', [EVENT]
    );
    const res = await request(app2)
      .get(`/api/konfi/events/${EVENT}/status`)
      .set('Authorization', `Bearer ${generateToken('konfi1')}`);

    expect(res.status).toBe(200);
    expect(Number(res.body.confirmed_count)).toBe(s.konfi_confirmed);
    expect(Number(res.body.waitlist_count)).toBe(s.konfi_waitlist);
  });

  it('Abgesagte Termine und View melden dieselbe Konfi-Zahl', async () => {
    await db2.query(
      'UPDATE events SET cancelled = TRUE, cancelled_at = NOW() WHERE id = $1',
      [EVENT]
    );

    const { rows: [s] } = await db2.query(
      'SELECT * FROM event_booking_stats WHERE event_id = $1', [EVENT]
    );
    const res = await request(app2)
      .get('/api/events/cancelled')
      .set('Authorization', `Bearer ${generateToken('admin1')}`);

    const ev = res.body.find((e) => e.id === EVENT);
    // Vorher zaehlte diese Route Teamer mit und meldete 3 statt 2.
    expect(Number(ev.registered_count)).toBe(s.konfi_confirmed);
    expect(Number(ev.teamer_count)).toBe(s.teamer_confirmed);
  });
});
