// Detailansicht einer Person: offene und anstehende Termine (09.10.2026).
//
// Simon: "In ein Konfi reingehen, seinen Status sehen und Offenes von da aus
// direkt bestaetigen -- zwei Wege, gleiches Ziel." GET /admin/konfis/:id
// traegt dafuer das additive Feld `termine` (utils/terminLeitungSicht.js,
// termineDerPersonFuerLeitung):
//   - 'verbuchen': begonnen, angemeldet, ohne Anwesenheit -- mit darf_verbuchen
//   - 'anstehend': noch nicht begonnen, angemeldet oder Warteliste
// Verbucht wird ueber die BESTEHENDE Route PUT /events/:id/participants/:pid/
// attendance. darf_verbuchen muss deshalb genau dann true sein, wenn diese
// Route nicht mit 403 antwortet -- geprueft fuer den verbotenen UND den
// erlaubten Fall.
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, JAHRGAENGE, ORGS } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const { invalidateUserCache } = require('../../middleware/rbac');

const ORG1 = ORGS.testGemeinde.id;
const J1 = JAHRGAENGE.jahrgang1.id;
const J_ZWEI = 93;
const KONFI = USERS.konfi1.id;

describe('GET /api/admin/konfis/:id -- Feld termine', () => {
  let app;
  let db;
  const ids = {};

  beforeAll(() => { db = getTestPool(); app = getTestApp(db); });
  afterAll(async () => { await closePool(); });

  const termin = async (name, abstandTage, { jahrgang = J1, cancelled = false } = {}) => {
    const { rows: [e] } = await db.query(
      `INSERT INTO events (name, event_date, organization_id, mandatory, max_participants, point_type, points, cancelled)
       VALUES ($1, NOW() + ($2 || ' days')::interval, $3, false, 20, 'gemeinde', 3, $4) RETURNING id`,
      [name, String(abstandTage), ORG1, cancelled]
    );
    if (jahrgang) {
      await db.query('INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) VALUES ($1, $2)', [e.id, jahrgang]);
    }
    return e.id;
  };
  const buchen = async (eventId, status, attendance = null) => {
    const { rows: [b] } = await db.query(
      `INSERT INTO event_bookings (event_id, user_id, status, attendance_status, organization_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [eventId, KONFI, status, attendance, ORG1]
    );
    return b.id;
  };
  const zuweisen = async (person, jahrgaenge) => {
    await db.query('DELETE FROM user_jahrgang_assignments WHERE user_id = $1', [USERS[person].id]);
    for (const [jg, recht] of jahrgaenge) {
      await db.query(
        `INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id, can_view, can_edit, darf_events_verbuchen)
         VALUES ($1, $2, true, true, $3)`,
        [USERS[person].id, jg, recht]
      );
    }
    invalidateUserCache(USERS[person].id);
  };
  const lesen = (person) => request(app)
    .get(`/api/admin/konfis/${KONFI}`)
    .set('Authorization', `Bearer ${generateToken(person)}`);
  const kurz = (t) => [t.event_name, t.art, t.booking_status, t.darf_verbuchen];

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    await db.query(
      `INSERT INTO jahrgaenge (id, name, organization_id, confirmation_date) VALUES ($1, 'Zweiter', $2, '2027-05-01')`,
      [J_ZWEI, ORG1]
    );
    ids.offenAlt = await termin('Offen alt', -10);
    ids.offenNeu = await termin('Offen neu', -2);
    ids.verbucht = await termin('Verbucht', -5);
    ids.abgesagt = await termin('Abgesagt', -3, { cancelled: true });
    ids.bald = await termin('Bald', 3);
    ids.spaeter = await termin('Später', 20);
    ids.abgemeldet = await termin('Abgemeldet', 5);
    ids.fremd = await termin('Fremder Jahrgang', -1, { jahrgang: J_ZWEI });
    ids.ohneJahrgang = await termin('Ohne Jahrgang', -4, { jahrgang: null });
    ids.bOffenAlt = await buchen(ids.offenAlt, 'confirmed');
    ids.bOffenNeu = await buchen(ids.offenNeu, 'confirmed');
    await buchen(ids.verbucht, 'confirmed', 'present');
    await buchen(ids.abgesagt, 'confirmed');
    await buchen(ids.bald, 'confirmed');
    await buchen(ids.spaeter, 'waitlist');
    await buchen(ids.abgemeldet, 'opted_out');
    await buchen(ids.fremd, 'confirmed');
    ids.bOhne = await buchen(ids.ohneJahrgang, 'confirmed');
  });

  it('Org-Admin: zu verbuchende (neueste zuerst), dann anstehende (naechste zuerst); Verbuchtes, Abgesagtes und Abgemeldetes fehlen', async () => {
    const res = await lesen('orgAdmin1');
    expect(res.status).toBe(200);
    expect(res.body.termine.map(kurz)).toEqual([
      ['Fremder Jahrgang', 'verbuchen', 'confirmed', true],
      ['Offen neu', 'verbuchen', 'confirmed', true],
      ['Ohne Jahrgang', 'verbuchen', 'confirmed', true],
      ['Offen alt', 'verbuchen', 'confirmed', true],
      ['Bald', 'anstehend', 'confirmed', true],
      ['Später', 'anstehend', 'waitlist', true],
    ]);
    // Die Buchungs-ID ist die participantId der Anwesenheits-Route.
    const offenNeu = res.body.termine.find((t) => t.event_name === 'Offen neu');
    expect(offenNeu.booking_id).toBe(ids.bOffenNeu);
    expect(offenNeu.event_id).toBe(ids.offenNeu);
    // Bestehende Felder bleiben (Vertrag mit den Store-Apps).
    expect(Array.isArray(res.body.activities)).toBe(true);
    expect(Array.isArray(res.body.bonusPoints)).toBe(true);
  });

  it('Admin mit Recht am Jahrgang: sieht nur Termine seiner Sicht, darf verbuchen -- und die Route nimmt es an', async () => {
    await zuweisen('admin1', [[J1, true]]);
    const res = await lesen('admin1');
    expect(res.status).toBe(200);
    expect(res.body.termine.map(kurz)).toEqual([
      ['Offen neu', 'verbuchen', 'confirmed', true],
      ['Ohne Jahrgang', 'verbuchen', 'confirmed', true],
      ['Offen alt', 'verbuchen', 'confirmed', true],
      ['Bald', 'anstehend', 'confirmed', true],
      ['Später', 'anstehend', 'waitlist', true],
    ]);

    const put = await request(app)
      .put(`/api/events/${ids.offenNeu}/participants/${ids.bOffenNeu}/attendance`)
      .set('Authorization', `Bearer ${generateToken('admin1')}`)
      .send({ attendance_status: 'present' });
    expect(put.status).toBe(200);
    const nachher = await lesen('admin1');
    expect(nachher.body.termine.map((t) => t.event_name)).toEqual(['Ohne Jahrgang', 'Offen alt', 'Bald', 'Später']);
  });

  it('Admin ohne Recht am Jahrgang: darf_verbuchen false -- und die Route antwortet 403', async () => {
    await zuweisen('admin1', [[J1, false]]);
    const res = await lesen('admin1');
    expect(res.status).toBe(200);
    const offenNeu = res.body.termine.find((t) => t.event_name === 'Offen neu');
    expect(offenNeu.darf_verbuchen).toBe(false);
    // Ohne Recht in irgendeinem Jahrgang auch nichts ohne Jahrgang.
    expect(res.body.termine.find((t) => t.event_name === 'Ohne Jahrgang').darf_verbuchen).toBe(false);

    const put = await request(app)
      .put(`/api/events/${ids.offenNeu}/participants/${ids.bOffenNeu}/attendance`)
      .set('Authorization', `Bearer ${generateToken('admin1')}`)
      .send({ attendance_status: 'present' });
    expect(put.status).toBe(403);
    const put2 = await request(app)
      .put(`/api/events/${ids.ohneJahrgang}/participants/${ids.bOhne}/attendance`)
      .set('Authorization', `Bearer ${generateToken('admin1')}`)
      .send({ attendance_status: 'present' });
    expect(put2.status).toBe(403);
  });

  it('Teamer:in sieht den Stand, darf aber nie verbuchen', async () => {
    await zuweisen('teamer1', [[J1, true]]);
    const res = await lesen('teamer1');
    expect(res.status).toBe(200);
    expect(res.body.termine.length).toBe(5);
    expect(res.body.termine.every((t) => t.darf_verbuchen === false)).toBe(true);
  });
});
