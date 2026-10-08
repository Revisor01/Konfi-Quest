// backend/tests/routes/anlegenWiederholungsschutz.test.js
//
// Wiederholungsschutz beim Anlegen (offene Befunde, Grundgeruest BF-02, Rest).
//
// Am Code geprueft 08.10.2026: Online wiederholt die App POST nie selbst
// (api.ts), offline aber reiht sie Bonuspunkte und Events in die
// Warteschlange (services/writeQueue.ts, maxRetries 5) -- und die wiederholt
// bei Netzfehler, Zeitlimit und 5xx. Kommt die erste Anfrage an und nur die
// Antwort geht verloren, entstanden Bonuspunkte bzw. ein Event doppelt.
//
// Jetzt tragen beide eine client_id (Muster: utils/antragIdempotenz.js bei
// activity_requests, Migration 201). Ein zweiter Eingang derselben client_id
// in derselben Gemeinde legt nichts an und bekommt dieselbe Antwort.
const request = require('supertest');
const { getTestApp, warteAufNachwehen } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

const CLIENT_ID = '7f1c2b4e-9a3d-4c55-8e21-0b6f4a9d1e77';

describe('Wiederholungsschutz beim Anlegen', () => {
  let app;
  let db;

  beforeAll(() => {
    db = getTestPool();
    app = getTestApp(db);
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    await db.query('UPDATE konfi_profiles SET gemeinde_points = 0 WHERE user_id = $1', [USERS.konfi1.id]);
  });

  afterAll(async () => {
    await closePool();
  });

  // ------------------------------------------------------------ Bonuspunkte

  const bonus = (felder = {}, token = generateToken('orgAdmin1'), konfiId = USERS.konfi1.id) => request(app)
    .post(`/api/admin/konfis/${konfiId}/bonus-points`)
    .set('Authorization', `Bearer ${token}`)
    .send({ points: 3, type: 'gemeinde', description: 'Hilfe beim Gemeindefest', ...felder });

  const bonusZeilen = async () => (await db.query(
    // Nur die Buchungen dieser Tests -- der Seed bringt eigene Bonuspunkte mit.
    "SELECT points, client_id FROM bonus_points WHERE konfi_id = $1 AND description = 'Hilfe beim Gemeindefest' ORDER BY id",
    [USERS.konfi1.id]
  )).rows;

  const gemeindePunkte = async () => (await db.query(
    'SELECT gemeinde_points FROM konfi_profiles WHERE user_id = $1', [USERS.konfi1.id]
  )).rows[0].gemeinde_points;

  describe('Bonuspunkte', () => {
    it('derselbe Eingang zweimal: einmal gebucht, beide Male 201 mit derselben Antwort', async () => {
      const erste = await bonus({ client_id: CLIENT_ID });
      await warteAufNachwehen(app);
      const zweite = await bonus({ client_id: CLIENT_ID });
      await warteAufNachwehen(app);

      expect(erste.status).toBe(201);
      expect(zweite.status).toBe(201);
      expect(zweite.body).toEqual(erste.body);
      expect(await bonusZeilen()).toEqual([{ points: 3, client_id: CLIENT_ID }]);
      expect(await gemeindePunkte()).toBe(3);
    });

    it('gleichzeitig zweimal: genau eine Buchung', async () => {
      const antworten = await Promise.all([bonus({ client_id: CLIENT_ID }), bonus({ client_id: CLIENT_ID })]);
      await warteAufNachwehen(app);

      expect(antworten.map((r) => r.status)).toEqual([201, 201]);
      expect(await bonusZeilen()).toHaveLength(1);
      expect(await gemeindePunkte()).toBe(3);
    });

    it('ohne client_id (Store-Apps) bleibt alles wie bisher: zwei Eingänge, zwei Buchungen', async () => {
      expect((await bonus()).status).toBe(201);
      await warteAufNachwehen(app);
      expect((await bonus()).status).toBe(201);
      await warteAufNachwehen(app);

      expect(await bonusZeilen()).toHaveLength(2);
      expect(await gemeindePunkte()).toBe(6);
    });

    it('verboten: eine client_id, die keine UUID ist -> 400, nichts gebucht', async () => {
      const res = await bonus({ client_id: 'nochmal' });
      expect(res.status).toBe(400);
      expect(res.body.details.map((d) => d.field)).toEqual(['client_id']);
      expect(await bonusZeilen()).toEqual([]);
    });

    it('dieselbe client_id in einer anderen Gemeinde ist ein eigener Vorgang', async () => {
      expect((await bonus({ client_id: CLIENT_ID })).status).toBe(201);
      await warteAufNachwehen(app);
      const fremd = await bonus({ client_id: CLIENT_ID }, generateToken('orgAdmin2'), USERS.konfi3.id);
      await warteAufNachwehen(app);

      expect(fremd.status).toBe(201);
      const { rows } = await db.query('SELECT konfi_id FROM bonus_points WHERE client_id = $1 ORDER BY id', [CLIENT_ID]);
      expect(rows.map((r) => Number(r.konfi_id))).toEqual([USERS.konfi1.id, USERS.konfi3.id]);
    });
  });

  // ------------------------------------------------------------ Events

  const morgen = () => new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
  const event = (felder = {}) => request(app)
    .post('/api/events')
    .set('Authorization', `Bearer ${generateToken('orgAdmin1')}`)
    .send({ name: 'Gemeindefest', event_date: morgen(), max_participants: 20, ...felder });
  const eventZeilen = async () => (await db.query(
    "SELECT id FROM events WHERE name = 'Gemeindefest' AND organization_id = $1", [ORGS.testGemeinde.id]
  )).rows;

  describe('Events', () => {
    it('derselbe Eingang zweimal: ein Event, beide Male 201 mit derselben id', async () => {
      const erste = await event({ client_id: CLIENT_ID });
      await warteAufNachwehen(app);
      const zweite = await event({ client_id: CLIENT_ID });
      await warteAufNachwehen(app);

      expect(erste.status).toBe(201);
      expect(zweite.status).toBe(201);
      expect(zweite.body).toEqual(erste.body);
      expect((await eventZeilen()).map((e) => Number(e.id))).toEqual([erste.body.id]);
    });

    it('gleichzeitig zweimal: genau ein Event', async () => {
      const antworten = await Promise.all([event({ client_id: CLIENT_ID }), event({ client_id: CLIENT_ID })]);
      await warteAufNachwehen(app);

      expect(antworten.map((r) => r.status)).toEqual([201, 201]);
      expect(antworten[1].body.id).toBe(antworten[0].body.id);
      expect(await eventZeilen()).toHaveLength(1);
    });

    it('ohne client_id bleibt alles wie bisher: zwei Events', async () => {
      expect((await event()).status).toBe(201);
      await warteAufNachwehen(app);
      expect((await event()).status).toBe(201);
      await warteAufNachwehen(app);
      expect(await eventZeilen()).toHaveLength(2);
    });

    it('verboten: eine client_id, die keine UUID ist -> 400, kein Event', async () => {
      const res = await event({ client_id: 'nochmal' });
      expect(res.status).toBe(400);
      expect(await eventZeilen()).toEqual([]);
    });
  });
});
