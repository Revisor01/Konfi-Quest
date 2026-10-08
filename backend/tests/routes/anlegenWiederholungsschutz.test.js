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
//
// Rest (Migration 203, 08.10.2026): Event-Serien tragen die client_id am
// ersten Termin (dem Anker, series_id = seine id); die Konfi-Anlage traegt
// sie am Konto. Bei der Konfi gibt eine Wiederholung dasselbe Konto mit einem
// NEUEN Einmalpasswort zurueck -- nur solange es sich noch nie angemeldet
// hat, danach 409 und kein zweites Konto.
const bcrypt = require('bcrypt');
const request = require('supertest');
const { getTestApp, warteAufNachwehen } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, JAHRGAENGE } = require('../helpers/seed');
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

  // ------------------------------------------------------------ Event-Serien

  const SERIEN_NAME = 'Konfi-Abend';
  const serie = (felder = {}, token = generateToken('orgAdmin1')) => request(app)
    .post('/api/events/series')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: SERIEN_NAME, event_date: morgen(), max_participants: 20,
      series_count: 3, series_interval: 'week', ...felder
    });
  const serienZeilen = async () => (await db.query(
    "SELECT id, series_id, client_id FROM events WHERE name LIKE 'Konfi-Abend #%' ORDER BY id"
  )).rows;

  describe('Event-Serien', () => {
    it('dieselbe Serie zweimal: drei Termine, beide Male 201 mit derselben Antwort', async () => {
      const erste = await serie({ client_id: CLIENT_ID });
      await warteAufNachwehen(app);
      const zweite = await serie({ client_id: CLIENT_ID });
      await warteAufNachwehen(app);

      expect(erste.status).toBe(201);
      expect(zweite.status).toBe(201);
      expect(erste.body).toEqual({
        message: 'Serien-Events erfolgreich erstellt',
        series_id: erste.body.series_id,
        events_created: 3
      });
      expect(zweite.body).toEqual(erste.body);
      const zeilen = await serienZeilen();
      expect(zeilen).toHaveLength(3);
      // Die Kennung haengt nur am ersten Termin, dem Anker der Serie.
      expect(zeilen.map((z) => z.client_id)).toEqual([CLIENT_ID, null, null]);
      expect(Number(zeilen[0].id)).toBe(erste.body.series_id);
    });

    it('gleichzeitig zweimal: genau eine Serie, beide Antworten mit derselben series_id', async () => {
      const antworten = await Promise.all([serie({ client_id: CLIENT_ID }), serie({ client_id: CLIENT_ID })]);
      await warteAufNachwehen(app);

      expect(antworten.map((r) => r.status)).toEqual([201, 201]);
      expect(antworten[1].body).toEqual(antworten[0].body);
      expect(await serienZeilen()).toHaveLength(3);
    });

    it('ohne client_id (Store-Apps) bleibt alles wie bisher: zwei Serien', async () => {
      expect((await serie()).status).toBe(201);
      await warteAufNachwehen(app);
      expect((await serie()).status).toBe(201);
      await warteAufNachwehen(app);
      expect(await serienZeilen()).toHaveLength(6);
    });

    it('verboten: eine client_id, die keine UUID ist -> 400, keine Serie', async () => {
      const res = await serie({ client_id: 'nochmal' });
      expect(res.status).toBe(400);
      expect(res.body.details.map((d) => d.field)).toEqual(['client_id']);
      expect(await serienZeilen()).toEqual([]);
    });

    it('dieselbe client_id in einer anderen Gemeinde ist eine eigene Serie', async () => {
      expect((await serie({ client_id: CLIENT_ID })).status).toBe(201);
      await warteAufNachwehen(app);
      const fremd = await serie({ client_id: CLIENT_ID }, generateToken('orgAdmin2'));
      await warteAufNachwehen(app);

      expect(fremd.status).toBe(201);
      const { rows } = await db.query(
        "SELECT organization_id, COUNT(*)::int AS anzahl FROM events WHERE name LIKE 'Konfi-Abend #%' GROUP BY organization_id ORDER BY organization_id"
      );
      expect(rows.map((r) => [Number(r.organization_id), r.anzahl])).toEqual([[ORGS.testGemeinde.id, 3], [2, 3]]);
    });
  });

  // ------------------------------------------------------------ Konfi-Anlage

  const KONFI_NAME = 'Lena Wiederholt';
  const konfi = (felder = {}, token = generateToken('orgAdmin1'), jahrgangId = JAHRGAENGE.jahrgang1.id) => request(app)
    .post('/api/admin/konfis')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: KONFI_NAME, jahrgang_id: jahrgangId, ...felder });
  const konten = async () => (await db.query(
    'SELECT id, username, password_hash, client_id FROM users WHERE display_name = $1 ORDER BY id', [KONFI_NAME]
  )).rows;

  describe('Konfi-Anlage', () => {
    it('dieselbe Anlage zweimal: ein Konto, beim zweiten Mal ein neues Einmalpasswort, das alte gilt nicht mehr', async () => {
      const erste = await konfi({ client_id: CLIENT_ID });
      await warteAufNachwehen(app);
      const zweite = await konfi({ client_id: CLIENT_ID });
      await warteAufNachwehen(app);

      expect(erste.status).toBe(201);
      expect(zweite.status).toBe(201);
      // Dieselbe Form, dasselbe Konto -- nur das Passwort ist neu.
      expect(Object.keys(zweite.body).sort()).toEqual(Object.keys(erste.body).sort());
      expect(zweite.body.id).toBe(erste.body.id);
      expect(zweite.body.username).toBe(erste.body.username);
      expect(zweite.body.message).toBe('Konfi erfolgreich erstellt');
      expect(typeof zweite.body.temporaryPassword).toBe('string');
      expect(zweite.body.temporaryPassword).not.toBe(erste.body.temporaryPassword);

      const zeilen = await konten();
      expect(zeilen).toHaveLength(1);
      expect(zeilen[0].client_id).toBe(CLIENT_ID);
      expect(await bcrypt.compare(zweite.body.temporaryPassword, zeilen[0].password_hash)).toBe(true);
      expect(await bcrypt.compare(erste.body.temporaryPassword, zeilen[0].password_hash)).toBe(false);
      // Kein zweites Profil, keine zweite Zaehlung gegen das Konfi-Limit.
      const { rows: profile } = await db.query('SELECT user_id FROM konfi_profiles WHERE user_id = $1', [erste.body.id]);
      expect(profile).toHaveLength(1);
    });

    it('gleichzeitig zweimal: genau ein Konto, beide Antworten nennen es', async () => {
      const antworten = await Promise.all([konfi({ client_id: CLIENT_ID }), konfi({ client_id: CLIENT_ID })]);
      await warteAufNachwehen(app);

      expect(antworten.map((r) => r.status)).toEqual([201, 201]);
      expect(antworten[1].body.id).toBe(antworten[0].body.id);
      expect(await konten()).toHaveLength(1);
    });

    it('verboten: hat sich das Konto schon angemeldet, gibt es kein neues Passwort und kein zweites Konto (409)', async () => {
      const erste = await konfi({ client_id: CLIENT_ID });
      await warteAufNachwehen(app);
      await db.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [erste.body.id]);
      const hashVorher = (await konten())[0].password_hash;

      const zweite = await konfi({ client_id: CLIENT_ID });

      expect(zweite.status).toBe(409);
      expect(zweite.body).toEqual({
        error: 'Dieses Konto ist schon angelegt und wird benutzt. Ein neues Passwort gibt es in der Detailansicht der Konfi.',
        error_code: 'bereits_angelegt',
        id: erste.body.id,
        username: erste.body.username
      });
      const zeilen = await konten();
      expect(zeilen).toHaveLength(1);
      expect(zeilen[0].password_hash).toBe(hashVorher);
    });

    it('ohne client_id (Store-Apps) bleibt alles wie bisher: zwei Konten', async () => {
      const erste = await konfi();
      await warteAufNachwehen(app);
      const zweite = await konfi();
      await warteAufNachwehen(app);

      expect([erste.status, zweite.status]).toEqual([201, 201]);
      const zeilen = await konten();
      expect(zeilen).toHaveLength(2);
      expect(zeilen.map((z) => z.client_id)).toEqual([null, null]);
    });

    it('verboten: eine client_id, die keine UUID ist -> 400, kein Konto', async () => {
      const res = await konfi({ client_id: 'nochmal' });
      expect(res.status).toBe(400);
      expect(res.body.details.map((d) => d.field)).toEqual(['client_id']);
      expect(await konten()).toEqual([]);
    });

    it('dieselbe client_id in einer anderen Gemeinde ist ein eigenes Konto', async () => {
      expect((await konfi({ client_id: CLIENT_ID })).status).toBe(201);
      await warteAufNachwehen(app);
      const fremd = await konfi({ client_id: CLIENT_ID }, generateToken('orgAdmin2'), JAHRGAENGE.jahrgang2.id);
      await warteAufNachwehen(app);

      expect(fremd.status).toBe(201);
      const zeilen = await konten();
      expect(zeilen).toHaveLength(2);
    });
  });
});
