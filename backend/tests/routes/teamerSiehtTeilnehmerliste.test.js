// backend/tests/routes/teamerSiehtTeilnehmerliste.test.js
//
// Das Team SIEHT die Teilnehmerliste — aendern darf es daran nichts.
//
// DER BEFUND (16.09.2026, Simon am Geraet, woertlich):
//   "teamer sehen die tn liste nicht!"
//
// WO ES KLEMMTE: Am Backend nicht. GET /events/:id liefert
// `participants: istKonfi ? [] : participants` — Teamer:innen bekommen die
// Liste seit jeher, die Teamer-Ansicht rief die Route nur nie auf und las
// ihren Termin allein aus der Liste GET /events (die traegt nur Zahlen).
// Der Fix sitzt in der Oberflaeche; dieser Test haelt die Grundlage fest,
// auf der er steht — sonst faellt sie beim naechsten Umbau der Route
// unbemerkt weg und die Liste ist wieder leer.
//
// DIE ZWEITE HAELFTE ist die wichtigere: SEHEN ist nicht VERWALTEN. Simon
// hat am selben Tag entschieden, dass Termine Leitungssache sind. Der
// erlaubte Fall (lesen) und der verbotene (verbuchen, abmelden, entfernen)
// stehen deshalb beide hier.
//
// GEGENPROBE (durchgefuehrt 16.09.2026):
//   - Lesen: In routes/events/lesen.js `istKonfi` zu
//     `req.user.type !== 'admin'` verschaerft -> der erste Test faellt
//     (participants ist dann []), der Konfi-Test bleibt gruen.
//   - Schreiben: In routes/events/teilnehmer.js und anwesenheit.js
//     requireAdmin zurueck auf requireTeamer -> die 403-Faelle fallen
//     (200/404 statt 403).
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, EVENTS, ORGS, JAHRGAENGE } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

describe('Teilnehmerliste: Team sieht sie, aendert sie nicht', () => {
  let app;
  let db;
  let teamerToken;
  let konfiToken;
  let adminToken;
  let buchungId;

  beforeAll(() => {
    db = getTestPool();
    app = getTestApp(db);
  });

  afterAll(async () => {
    await closePool();
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    teamerToken = generateToken('teamer1');
    konfiToken = generateToken('konfi1');
    adminToken = generateToken('admin1');

    // Admins sind an ihre Jahrgaenge gebunden (Rollen- und Jahrgangsregel).
    // Ohne diese Zuweisung antwortet auch der ERLAUBTE Fall mit 403 -- dann
    // wuerde der Test unten das Verbot fuer eine Sperre halten, die in
    // Wahrheit gar nicht die Rolle betrifft.
    await db.query(
      `INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id) VALUES ($1, $2)`,
      [USERS.admin1.id, JAHRGAENGE.jahrgang1.id]
    );
    require('../../middleware/rbac').invalidateUserCache(USERS.admin1.id);

    // Eine Konfi ist angemeldet — sonst waere die Liste leer und der Test
    // koennte nicht zwischen "darf nicht" und "ist nichts da" unterscheiden.
    const { rows: [b] } = await db.query(
      `INSERT INTO event_bookings (event_id, user_id, status, organization_id, created_at)
       VALUES ($1, $2, 'confirmed', $3, NOW())
       RETURNING id`,
      [EVENTS.gottesdienstEvent.id, USERS.konfi1.id, ORGS.testGemeinde.id]
    );
    buchungId = b.id;
  });

  const detail = (token) => request(app)
    .get(`/api/events/${EVENTS.gottesdienstEvent.id}`)
    .set('Authorization', `Bearer ${token}`);

  // ---- ERLAUBTER FALL: LESEN ------------------------------------------
  it('Teamer:in bekommt die Teilnehmerliste mit Namen', async () => {
    const res = await detail(teamerToken);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.participants)).toBe(true);
    expect(res.body.participants.length).toBe(1);

    const p = res.body.participants[0];
    expect(p.user_id).toBe(USERS.konfi1.id);
    expect(p.participant_name).toBe(USERS.konfi1.display_name);
    expect(p.status).toBe('confirmed');
    expect(p.role_name).toBe('konfi');
  });

  // Die Gegenseite der Abgrenzung: Konfis bekommen die Namen NICHT. Ohne
  // diesen Fall koennte die Route versehentlich fuer alle offen sein und der
  // Test oben bliebe trotzdem gruen.
  it('Konfi bekommt weiterhin KEINE Teilnehmerliste', async () => {
    const res = await detail(konfiToken);

    expect(res.status).toBe(200);
    expect(res.body.participants).toEqual([]);
    expect(res.body.unregistrations).toEqual([]);
    expect(res.body.qr_token).toBeUndefined();
  });

  // ---- VERBOTENER FALL: AENDERN ---------------------------------------
  it('Teamer:in darf niemanden anwesend setzen (403)', async () => {
    const res = await request(app)
      .put(`/api/events/${EVENTS.gottesdienstEvent.id}/participants/${buchungId}/attendance`)
      .set('Authorization', `Bearer ${teamerToken}`)
      .send({ attendance_status: 'present' });

    expect(res.status).toBe(403);
  });

  it('Teamer:in darf niemanden aus der Liste entfernen (403)', async () => {
    const res = await request(app)
      .delete(`/api/events/${EVENTS.gottesdienstEvent.id}/bookings/${buchungId}`)
      .set('Authorization', `Bearer ${teamerToken}`);

    expect(res.status).toBe(403);
  });

  // ---- ERLAUBTER FALL: die Leitung darf es sehr wohl ------------------
  // Ohne diesen Fall waere nicht belegt, dass die Sperre die Rolle trifft und
  // nicht die Route ueberhaupt kaputt ist.
  it('Admin darf anwesend setzen (200)', async () => {
    const res = await request(app)
      .put(`/api/events/${EVENTS.gottesdienstEvent.id}/participants/${buchungId}/attendance`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ attendance_status: 'present' });

    expect(res.status).toBe(200);

    const { rows } = await db.query(
      'SELECT attendance_status FROM event_bookings WHERE id = $1',
      [buchungId]
    );
    expect(rows[0].attendance_status).toBe('present');
  });
});
