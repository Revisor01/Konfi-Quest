// backend/tests/routes/postfachBeiPunkten.test.js
//
// Simons Kernanliegen (25.09.2026): "Gerade Punkte erhalten macht ja Sinn.
// Da gibts ja nur nen Push und dann keine Indikator in der App."
//
// Hier laeuft der ganze Weg ueber die Route: Die Leitung vergibt
// Bonuspunkte bzw. verbucht eine Teilnahme -- und die Konfi findet die
// Mitteilung im Postfach, mit den Kennungen fuers Antippen, und die Zahl am
// App-Symbol (badge-counts.postfach.ungelesen, vom Client addiert) zaehlt sie
// mit.
const request = require('supertest');
const { getTestApp, warteAufNachwehen } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, EVENTS, JAHRGAENGE } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

const firebase = require('../../push/firebase');
vi.spyOn(firebase, 'sendFirebasePushNotification').mockResolvedValue({ success: true });
vi.spyOn(firebase, 'sendFirebaseSilentPush').mockResolvedValue({ success: true });

describe('Punkte erhalten -> Mitteilung im Postfach', () => {
  let app, db, adminToken, konfiToken;

  beforeAll(() => { db = getTestPool(); app = getTestApp(db); });
  afterAll(async () => { await closePool(); });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    adminToken = generateToken('admin1');
    konfiToken = generateToken('konfi1');
    // admin1 braucht fuer Schreibwege an Konfis und Terminen seinen Jahrgang.
    await db.query(
      'INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id, can_view, can_edit) VALUES ($1, $2, true, true)',
      [USERS.admin1.id, JAHRGAENGE.jahrgang1.id]
    );
    require('../../middleware/rbac').invalidateUserCache(USERS.admin1.id);
  });

  async function postfachVon(token) {
    const res = await request(app)
      .get('/api/notifications/postfach')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    return res.body;
  }

  async function zaehlerVon(token) {
    const res = await request(app)
      .get('/api/notifications/badge-counts')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    return res.body;
  }

  it('Bonuspunkte: die Konfi sieht "+5 Bonuspunkte!" im Postfach, die Zahl am Symbol ist 1', async () => {
    const res = await request(app)
      .post(`/api/admin/konfis/${USERS.konfi1.id}/bonus-points`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ points: 5, type: 'gemeinde', description: 'Kuchen fürs Gemeindefest' });
    expect(res.status).toBe(201);
    await warteAufNachwehen(app);

    const { eintraege, ungelesen } = await postfachVon(konfiToken);
    const bonus = eintraege.filter((e) => e.type === 'bonus_points');
    expect(bonus).toHaveLength(1);
    expect(bonus[0]).toMatchObject({
      title: '+5 Bonuspunkte!',
      message: 'Du hast 5 Gemeinde-Bonuspunkte erhalten: Kuchen fürs Gemeindefest',
      organization_id: ORGS.testGemeinde.id,
      read_at: null
    });
    expect(bonus[0].data).toMatchObject({ type: 'bonus_points', points: '5', category: 'gemeinde' });
    // 5 Gemeindepunkte heben konfi1 von Novize (0) auf Lehrling (5): dazu
    // kommt "Level Up!" -- ebenfalls im Postfach.
    const level = eintraege.filter((e) => e.type === 'level_up');
    expect(level).toHaveLength(1);
    expect(level[0].data).toMatchObject({ level_title: 'Lehrling' });
    expect(ungelesen).toBe(eintraege.length);

    const zaehler = await zaehlerVon(konfiToken);
    expect(zaehler.postfach.ungelesen).toBe(2);
    // Beide Arten haben keinen Reiter -> ohne das Postfach haette die Konfi
    // in der App KEINEN Hinweis auf ihre Punkte. Genau Simons Befund.
    expect(zaehler.newBadges).toBe(0);
    expect(zaehler.chat.total).toBe(0);
  });

  it('Teilnahme verbucht: "Teilnahme bestätigt!" mit event_id und Punkten', async () => {
    const eventId = EVENTS.gottesdienstEvent.id;
    // Termin in die Vergangenheit legen und konfi1 anmelden.
    await db.query("UPDATE events SET event_date = NOW() - interval '1 day' WHERE id = $1", [eventId]);
    const { rows: [buchung] } = await db.query(
      `INSERT INTO event_bookings (event_id, user_id, status, organization_id)
       VALUES ($1, $2, 'confirmed', $3) RETURNING id`,
      [eventId, USERS.konfi1.id, ORGS.testGemeinde.id]
    );

    const res = await request(app)
      .put(`/api/events/${eventId}/participants/${buchung.id}/attendance`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ attendance_status: 'present' });
    expect(res.status).toBe(200);
    await warteAufNachwehen(app);

    const { eintraege } = await postfachVon(konfiToken);
    const teilnahme = eintraege.filter((e) => e.type === 'event_attendance');
    expect(teilnahme).toHaveLength(1);
    expect(teilnahme[0].title).toBe('Teilnahme bestätigt!');
    expect(teilnahme[0].data).toMatchObject({
      event_id: String(eventId),
      status: 'present',
      points: String(EVENTS.gottesdienstEvent.points)
    });
  });

  it('Gelesen -> zaehlt am Symbol nicht mehr, steht aber weiter im Postfach', async () => {
    await request(app)
      .post(`/api/admin/konfis/${USERS.konfi1.id}/bonus-points`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ points: 1, type: 'gottesdienst', description: 'Test' });
    await warteAufNachwehen(app);

    // Neben den Bonuspunkten kann die Vergabe ein Abzeichen ausloesen
    // (badges.js schreibt badge_earned selbst) -- gezaehlt wird, was im
    // Postfach liegt, und das ist alles ungelesen.
    const { eintraege } = await postfachVon(konfiToken);
    expect(eintraege.map((e) => e.type)).toContain('bonus_points');
    const vorher = await zaehlerVon(konfiToken);
    expect(vorher.postfach.ungelesen).toBe(eintraege.length);
    expect(vorher.postfach.ungelesen).toBeGreaterThan(0);

    const alle = await request(app)
      .put('/api/notifications/postfach/gelesen')
      .set('Authorization', `Bearer ${konfiToken}`);
    expect(alle.status).toBe(200);

    const nachher = await zaehlerVon(konfiToken);
    expect(nachher.postfach.ungelesen).toBe(0);
    expect((await postfachVon(konfiToken)).eintraege).toHaveLength(eintraege.length);
  });
});
