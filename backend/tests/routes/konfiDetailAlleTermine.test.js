// Detailseite einer Konfi: ALLE Termine in einer Liste (13.10.2026).
//
// Simon, Seiten-Interview 13.10.2026: „ich sehe events die angemeldeten, dann
// nochmal eine zuordnung mit teilgenommenen events -- das soll eine liste
// sein, pflicht events sollten da auch gekennzeichnet sein". GET
// /admin/konfis/:id traegt dafuer additiv `alleTermine`
// (utils/terminLeitungSicht.js, alleTermineDerPerson): jede Buchung der
// Konfi -- angemeldet, Warteliste, anwesend, abwesend, abgemeldet, abgesagt
// -- mit Pflicht, Punkten und darf_verbuchen, dazu Event-Punkte ohne Buchung.
// `termine` und GET /:id/event-points bleiben unveraendert (Vertrag mit den
// Store-Apps).
//
// Sicht (Pruefung 13.10.2026): Buchungen nur an Terminen, die der Aufrufer
// sieht -- dieselbe Regel wie `termine` (gebundeneLeitungSiehtTerminSql mit
// den can_view-Jahrgaengen, Org-Leitung alles). Bis dahin stand ein Termin
// eines fremden Jahrgangs als "zu verbuchen" oben in der Liste, ohne Knoepfe,
// der Klick fuehrte auf 403, der Reiter "Verbuchen" zaehlte ihn nicht.
// Event-Punkte bleiben wie bei /:id/event-points ungefiltert -- an einem
// Termin, den der Aufrufer nicht sieht, als Punkte-Zeile ohne Buchung und
// mit darf_oeffnen = false.
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, JAHRGAENGE, ORGS } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const { invalidateUserCache } = require('../../middleware/rbac');

const ORG1 = ORGS.testGemeinde.id;
const J1 = JAHRGAENGE.jahrgang1.id;
const J_ZWEI = 94;
const KONFI = USERS.konfi1.id;

describe('GET /api/admin/konfis/:id -- Feld alleTermine', () => {
  let app;
  let db;
  const ids = {};

  beforeAll(() => { db = getTestPool(); app = getTestApp(db); });
  afterAll(async () => { await closePool(); });

  const termin = async (name, abstandTage, { jahrgang = J1, cancelled = false, mandatory = false, konfirmation = false } = {}) => {
    const { rows: [e] } = await db.query(
      `INSERT INTO events (name, event_date, organization_id, mandatory, is_konfirmation, max_participants, point_type, points, cancelled)
       VALUES ($1, NOW() + ($2 || ' days')::interval, $3, $4, $5, 20, 'gemeinde', 3, $6) RETURNING id`,
      [name, String(abstandTage), ORG1, mandatory, konfirmation, cancelled]
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
  const punkte = async (eventId, points, type = 'gemeinde') => {
    await db.query(
      `INSERT INTO event_points (konfi_id, event_id, points, point_type, awarded_date, admin_id, organization_id)
       VALUES ($1, $2, $3, $4, CURRENT_DATE, $5, $6)`,
      [KONFI, eventId, points, type, USERS.admin1.id, ORG1]
    );
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
  const lesen = (person, id = KONFI) => request(app)
    .get(`/api/admin/konfis/${id}`)
    .set('Authorization', `Bearer ${generateToken(person)}`);
  const kurz = (t) => [t.event_name, t.art, t.booking_status, t.attendance_status, t.mandatory, t.points];

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    await db.query(
      `INSERT INTO jahrgaenge (id, name, organization_id, confirmation_date) VALUES ($1, 'Zweiter', $2, '2027-05-01')`,
      [J_ZWEI, ORG1]
    );
    ids.offen = await termin('Offen', -2, { mandatory: true });
    ids.anwesend = await termin('Anwesend', -5);
    ids.pflichtDa = await termin('Pflicht da', -6, { mandatory: true });
    ids.abwesend = await termin('Abwesend', -7);
    ids.entschuldigt = await termin('Entschuldigt', -8, { mandatory: true });
    ids.abgemeldet = await termin('Abgemeldet', -9, { mandatory: true });
    ids.abgesagt = await termin('Abgesagt', -3, { cancelled: true });
    ids.bald = await termin('Bald', 3, { konfirmation: true });
    ids.warteliste = await termin('Warteliste', 10);
    ids.fremd = await termin('Fremder Jahrgang', -4, { jahrgang: J_ZWEI });
    ids.nurPunkte = await termin('Nur Punkte', -20);

    ids.bOffen = await buchen(ids.offen, 'confirmed');
    await buchen(ids.anwesend, 'confirmed', 'present');
    await buchen(ids.pflichtDa, 'confirmed', 'present');
    await buchen(ids.abwesend, 'confirmed', 'absent');
    await buchen(ids.entschuldigt, 'confirmed', 'excused');
    await buchen(ids.abgemeldet, 'opted_out');
    await buchen(ids.abgesagt, 'confirmed');
    await buchen(ids.bald, 'confirmed');
    await buchen(ids.warteliste, 'waitlist');
    ids.bFremd = await buchen(ids.fremd, 'confirmed');
    await punkte(ids.anwesend, 3);
    // Event-Punkte, deren Buchung spaeter entfernt wurde: stehen trotzdem in der Liste.
    await punkte(ids.nurPunkte, 2, 'gottesdienst');
  });

  it('Org-Admin: jede Buchung und Punkte ohne Buchung, mit Stand, Pflicht und Punkten -- Eventdatum absteigend', async () => {
    const res = await lesen('orgAdmin1');
    expect(res.status).toBe(200);
    expect(res.body.alleTermine.map(kurz)).toEqual([
      ['Warteliste', 'anstehend', 'waitlist', null, false, 0],
      ['Bald', 'anstehend', 'confirmed', null, false, 0],
      ['Offen', 'verbuchen', 'confirmed', null, true, 0],
      ['Abgesagt', 'erledigt', 'confirmed', null, false, 0],
      ['Fremder Jahrgang', 'verbuchen', 'confirmed', null, false, 0],
      ['Anwesend', 'erledigt', 'confirmed', 'present', false, 3],
      ['Pflicht da', 'erledigt', 'confirmed', 'present', true, 0],
      ['Abwesend', 'erledigt', 'confirmed', 'absent', false, 0],
      ['Entschuldigt', 'erledigt', 'confirmed', 'excused', true, 0],
      ['Abgemeldet', 'erledigt', 'opted_out', null, true, 0],
      ['Nur Punkte', 'erledigt', null, null, false, 2],
    ]);
    // ERLAUBT: Die Org-Leitung sieht auch den Termin des fremden Jahrgangs und darf jeden oeffnen.
    expect(res.body.alleTermine.every((t) => t.darf_oeffnen === true)).toBe(true);
    const offen = res.body.alleTermine.find((t) => t.event_name === 'Offen');
    // Die Buchungs-ID ist die participantId der Anwesenheits-Route.
    expect(offen.booking_id).toBe(ids.bOffen);
    expect(offen.event_id).toBe(ids.offen);
    expect(offen.darf_verbuchen).toBe(true);
    expect(res.body.alleTermine.find((t) => t.event_name === 'Abgesagt').cancelled).toBe(true);
    expect(res.body.alleTermine.find((t) => t.event_name === 'Bald').is_konfirmation).toBe(true);
    const anwesend = res.body.alleTermine.find((t) => t.event_name === 'Anwesend');
    expect(anwesend.point_type).toBe('gemeinde');
    expect(anwesend.points_von).toBe(USERS.admin1.display_name);
    const nurPunkte = res.body.alleTermine.find((t) => t.event_name === 'Nur Punkte');
    expect(nurPunkte.booking_id).toBeNull();
    expect(nurPunkte.point_type).toBe('gottesdienst');
    // Bestehende Felder bleiben, wie sie waren (Vertrag mit den Store-Apps).
    expect(res.body.termine.map((t) => t.event_name)).toEqual(['Offen', 'Fremder Jahrgang', 'Bald', 'Warteliste']);
    expect(Array.isArray(res.body.activities)).toBe(true);
    const ep = await request(app)
      .get(`/api/admin/konfis/${KONFI}/event-points`)
      .set('Authorization', `Bearer ${generateToken('orgAdmin1')}`);
    expect(ep.status).toBe(200);
    expect(ep.body).toHaveLength(2);
  });

  it('Admin nur am Jahrgang der Konfi: ohne den Termin des fremden Jahrgangs -- dieselbe Regel wie `termine`', async () => {
    await zuweisen('admin1', [[J1, true]]);
    const res = await lesen('admin1');
    expect(res.status).toBe(200);
    // VERBOTEN: Die Buchung am Termin des fremden Jahrgangs fehlt.
    expect(res.body.alleTermine.map((t) => t.event_name)).toEqual([
      'Warteliste', 'Bald', 'Offen', 'Abgesagt', 'Anwesend', 'Pflicht da',
      'Abwesend', 'Entschuldigt', 'Abgemeldet', 'Nur Punkte',
    ]);
    // Liste und `termine` lesen dieselbe Regel: Offenes und Anstehendes sind dieselben Termine.
    expect(res.body.termine.map((t) => t.event_name)).toEqual(['Offen', 'Bald', 'Warteliste']);
    expect(res.body.alleTermine.filter((t) => t.art !== 'erledigt').map((t) => t.event_name).sort())
      .toEqual(['Bald', 'Offen', 'Warteliste']);
    expect(res.body.alleTermine.every((t) => t.darf_oeffnen === true)).toBe(true);
    const offen = res.body.alleTermine.find((t) => t.event_name === 'Offen');
    expect(offen.darf_verbuchen).toBe(true);

    // VERBOTEN: der Termin des fremden Jahrgangs -- die Route antwortet 403.
    const verboten = await request(app)
      .put(`/api/events/${ids.fremd}/participants/${ids.bFremd}/attendance`)
      .set('Authorization', `Bearer ${generateToken('admin1')}`)
      .send({ attendance_status: 'present' });
    expect(verboten.status).toBe(403);
    // ERLAUBT: der eigene Pflichttermin.
    const erlaubt = await request(app)
      .put(`/api/events/${ids.offen}/participants/${ids.bOffen}/attendance`)
      .set('Authorization', `Bearer ${generateToken('admin1')}`)
      .send({ attendance_status: 'present' });
    expect(erlaubt.status).toBe(200);
    const nachher = await lesen('admin1');
    expect(kurz(nachher.body.alleTermine.find((t) => t.event_name === 'Offen')))
      .toEqual(['Offen', 'erledigt', 'confirmed', 'present', true, 0]);
  });

  it('Teamer:in als Aufrufer: ohne den fremden Jahrgang, darf nie verbuchen', async () => {
    await zuweisen('teamer1', [[J1, true]]);
    const res = await lesen('teamer1');
    expect(res.status).toBe(200);
    expect(res.body.alleTermine).toHaveLength(10);
    expect(res.body.alleTermine.map((t) => t.event_name)).not.toContain('Fremder Jahrgang');
    expect(res.body.alleTermine.every((t) => t.darf_verbuchen === false)).toBe(true);
  });

  it('Termin eines fremden Jahrgangs mit Punkten: Punkte-Zeile ohne Buchung und ohne Oeffnen; Org-Leitung sieht die Buchung', async () => {
    // Die Konfi war im alten Jahrgang da und bekam Punkte; ein Termin ohne
    // Jahrgang gilt der ganzen Gemeinde und bleibt sichtbar.
    const alt = await termin('Alter Jahrgang', -30, { jahrgang: J_ZWEI });
    await buchen(alt, 'confirmed', 'present');
    await punkte(alt, 2);
    const gemeinde = await termin('Gemeindefest', -12, { jahrgang: null });
    await buchen(gemeinde, 'confirmed', 'present');
    await zuweisen('admin1', [[J1, true]]);

    const res = await lesen('admin1');
    expect(res.status).toBe(200);
    const zeileAlt = res.body.alleTermine.find((t) => t.event_name === 'Alter Jahrgang');
    expect([zeileAlt.booking_id, zeileAlt.booking_status, zeileAlt.attendance_status, zeileAlt.art, zeileAlt.points, zeileAlt.darf_oeffnen])
      .toEqual([null, null, null, 'erledigt', 2, false]);
    const zeileGemeinde = res.body.alleTermine.find((t) => t.event_name === 'Gemeindefest');
    expect([zeileGemeinde.attendance_status, zeileGemeinde.darf_oeffnen]).toEqual(['present', true]);
    // Die Punkte der Liste sind dieselben wie in GET /:id/event-points (ungefiltert, wie bisher).
    const ep = await request(app)
      .get(`/api/admin/konfis/${KONFI}/event-points`)
      .set('Authorization', `Bearer ${generateToken('admin1')}`);
    expect(ep.status).toBe(200);
    const summe = (zeilen) => zeilen.reduce((s, z) => s + Number(z.points), 0);
    expect(summe(res.body.alleTermine)).toBe(7);
    expect(summe(ep.body)).toBe(7);

    // ERLAUBT: Die Org-Leitung sieht jeden Termin der Gemeinde mit seiner Buchung.
    const voll = await lesen('orgAdmin1');
    const vollAlt = voll.body.alleTermine.find((t) => t.event_name === 'Alter Jahrgang');
    expect([vollAlt.booking_status, vollAlt.attendance_status, vollAlt.points, vollAlt.darf_oeffnen])
      .toEqual(['confirmed', 'present', 2, true]);
    expect(voll.body.alleTermine.filter((t) => t.event_name === 'Alter Jahrgang')).toHaveLength(1);
  });

  it('fremde Gemeinde: 404, keine Liste', async () => {
    const res = await lesen('orgAdmin2');
    expect(res.status).toBe(404);
    expect(res.body.alleTermine).toBeUndefined();
  });

  it('Admin ohne den Jahrgang der Konfi: 403, keine Liste', async () => {
    await zuweisen('admin1', [[J_ZWEI, true]]);
    const res = await lesen('admin1');
    expect(res.status).toBe(403);
    expect(res.body.alleTermine).toBeUndefined();
  });

  it('eine Teamer:in als Zielobjekt bekommt das Feld nicht (ihre Buchungen stehen in teamerEvents)', async () => {
    const res = await lesen('orgAdmin1', USERS.teamer1.id);
    expect(res.status).toBe(200);
    expect(res.body.role_name).toBe('teamer');
    expect(res.body.alleTermine).toBeUndefined();
    expect(Array.isArray(res.body.teamerEvents)).toBe(true);
  });
});
