// backend/tests/services/neuesEventEmpfaenger.test.js
//
// "Neues Event!" nur an Konfis, die den Termin in ihrer Liste sehen
// (Audit "Wer bekommt was" 27.09.2026, BF-04 / F-05).
//
// Die Regel (CLAUDE.md, "Wer sieht und bekommt was"): Mitteilung =
// Sichtbarkeit. Die Konfi-Terminliste (GET /api/konfi/events) zeigt die
// Termine des eigenen Jahrgangs und die Termine ohne jeden Jahrgang (sie
// gelten der ganzen Gemeinde, Simon 27.09.2026), nie "Nur Team" und nie
// fremde Jahrgaenge. Eine Konfi ohne Jahrgang sieht nur die Termine ohne
// Jahrgang. Der Anmeldestart-Push fragte dagegen nur die Gemeinde -- jede
// Konfi bekam jede Einladung, tippte darauf und fand nichts.
//
// Firebase ist gemockt wie in pushEmpfaengerMultiOrg.test.js. Die
// Assertions pruefen die KONKRETE Empfaengerliste (sortierte Tokens) --
// "enthaelt" allein liesse nicht auffallen, wenn jemand dazukommt.
const request = require('supertest');
const jwt = require('jsonwebtoken');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, JAHRGAENGE } = require('../helpers/seed');
const { invalidateUserCache } = require('../../middleware/rbac');

const firebase = require('../../push/firebase');
const sendFirebasePushNotification = vi
  .spyOn(firebase, 'sendFirebasePushNotification')
  .mockResolvedValue({ success: true });
vi.spyOn(firebase, 'sendFirebaseSilentPush').mockResolvedValue({ success: true });

const PushService = require('../../services/pushService');
const BackgroundService = require('../../services/backgroundService');

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-vitest';
const ORG1 = ORGS.testGemeinde.id;

// Zweiter Jahrgang derselben Gemeinde und zwei Konfis, die der Seed nicht hat.
const JG_B = 311;
const KONFI_B = 511;        // Konfi im Jahrgang B
const KONFI_OHNE_JG = 512;  // Konfi ohne Jahrgang

const TOKEN_ZU = {
  [USERS.konfi1.id]: 'token-konfi1',
  [USERS.konfi2.id]: 'token-konfi2',
  [KONFI_B]: 'token-konfiB',
  [KONFI_OHNE_JG]: 'token-konfiOhneJg',
  [USERS.konfi3.id]: 'token-konfi3',
  [USERS.teamer1.id]: 'token-teamer1',
  [USERS.admin1.id]: 'token-admin1',
  [USERS.orgAdmin1.id]: 'token-orgadmin1',
};

const tokens = () => sendFirebasePushNotification.mock.calls
  .map(([token]) => token)
  .sort();

const konfiToken = (id) => jwt.sign(
  { id, type: 'konfi', display_name: `Konfi ${id}`, organization_id: ORG1, role_id: 1 },
  JWT_SECRET,
  { expiresIn: '1h' }
);

describe('"Neues Event!" nur an Konfis, die den Termin sehen (BF-04)', () => {
  let db;
  let app;

  beforeAll(() => {
    db = getTestPool();
    app = getTestApp(db);
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);

    await db.query(
      `INSERT INTO jahrgaenge (id, name, organization_id, confirmation_date)
       VALUES ($1, '2026/2027 B', $2, '2027-05-01')`,
      [JG_B, ORG1]
    );
    await db.query(
      `INSERT INTO users (id, username, password_hash, display_name, role_id, organization_id, is_active)
       VALUES ($1, 'konfi_b', 'x', 'Konfi B', 1, $3, true),
              ($2, 'konfi_ohne', 'x', 'Konfi ohne Jahrgang', 1, $3, true)`,
      [KONFI_B, KONFI_OHNE_JG, ORG1]
    );
    await db.query(
      `INSERT INTO konfi_profiles (user_id, jahrgang_id, organization_id)
       VALUES ($1, $2, $4), ($3, NULL, $4)`,
      [KONFI_B, JG_B, KONFI_OHNE_JG, ORG1]
    );
    for (const [userId, token] of Object.entries(TOKEN_ZU)) {
      await db.query(
        `INSERT INTO push_tokens (user_id, token, platform, device_id) VALUES ($1, $2, 'ios', $3)`,
        [userId, token, `dev-${token}`]
      );
    }
    // Die Seed-Termine sind anmeldbar und noch nicht gemeldet -- hier als
    // erledigt markieren, damit der Lauf nur die Termine des Tests meldet.
    await db.query('UPDATE events SET registration_open_notified = true');
    for (const id of [KONFI_B, KONFI_OHNE_JG, USERS.konfi1.id, USERS.konfi2.id]) invalidateUserCache(id);
    sendFirebasePushNotification.mockClear();
  });

  afterAll(async () => {
    await closePool();
  });

  async function termin({ jahrgaenge = [], teamerOnly = false, name = 'Termin' } = {}) {
    const { rows: [e] } = await db.query(
      `INSERT INTO events (name, event_date, organization_id, teamer_only, mandatory, max_participants,
                           registration_open_notified)
       VALUES ($1, NOW() + INTERVAL '10 days', $2, $3, false, 20, false)
       RETURNING id`,
      [name, ORG1, teamerOnly]
    );
    for (const j of jahrgaenge) {
      await db.query('INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) VALUES ($1, $2)', [e.id, j]);
    }
    return e.id;
  }

  const neuesEvent = (eventId) =>
    PushService.sendNewEventToOrgKonfis(db, ORG1, 'Termin', new Date(Date.now() + 864e6).toISOString(), eventId);

  it('verboten: Konfis eines fremden Jahrgangs bekommen "Neues Event!" nicht', async () => {
    const id = await termin({ jahrgaenge: [JG_B] });
    await neuesEvent(id);
    // Nur Konfi B. konfi1/konfi2 (Jahrgang 1) und die Konfi ohne Jahrgang
    // sehen den Termin nicht und bekommen nichts.
    expect(tokens()).toEqual(['token-konfiB']);
  });

  it('erlaubt: die Konfis des Jahrgangs bekommen ihn -- mit Art, Kennung und Gemeinde', async () => {
    const id = await termin({ jahrgaenge: [JAHRGAENGE.jahrgang1.id] });
    await neuesEvent(id);
    expect(tokens()).toEqual(['token-konfi1', 'token-konfi2']);
    const [, payload] = sendFirebasePushNotification.mock.calls[0];
    expect(payload.title).toBe('Neues Event!');
    expect(payload.data.type).toBe('new_event');
    expect(payload.data.event_id).toBe(String(id));
    expect(payload.data.organization_id).toBe(String(ORG1));
  });

  it('erlaubt: ein Termin fuer zwei Jahrgaenge erreicht beide, jede Konfi einmal', async () => {
    const id = await termin({ jahrgaenge: [JAHRGAENGE.jahrgang1.id, JG_B] });
    await neuesEvent(id);
    expect(tokens()).toEqual(['token-konfi1', 'token-konfi2', 'token-konfiB']);
  });

  it('Termin ohne Jahrgang: jede Konfi der Gemeinde -- auch die ohne Jahrgang', async () => {
    const id = await termin();
    await neuesEvent(id);
    // Ganze Gemeinde (Simon 27.09.2026). konfi3 gehoert zu Gemeinde 2.
    expect(tokens()).toEqual(['token-konfi1', 'token-konfi2', 'token-konfiB', 'token-konfiOhneJg']);
  });

  it('"Nur Team": nie an Konfis, auch wenn ein Jahrgang daranhaengt', async () => {
    const id = await termin({ jahrgaenge: [JAHRGAENGE.jahrgang1.id], teamerOnly: true });
    await neuesEvent(id);
    expect(tokens()).toEqual([]);
  });

  it('Team und Leitung bekommen "Neues Event!" nie, andere Gemeinden auch nicht', async () => {
    const id = await termin({ jahrgaenge: [JAHRGAENGE.jahrgang1.id, JG_B] });
    await neuesEvent(id);
    const empfangen = tokens();
    for (const t of ['token-teamer1', 'token-admin1', 'token-orgadmin1', 'token-konfi3', 'token-konfiOhneJg']) {
      expect(empfangen).not.toContain(t);
    }
  });

  it('ohne Termin-Kennung geht die Meldung an niemanden (die Jahrgaenge sind unbekannt)', async () => {
    await PushService.sendNewEventToOrgKonfis(db, ORG1, 'Termin', new Date().toISOString());
    expect(tokens()).toEqual([]);
  });

  it('der Hintergrundlauf meldet jeden Termin nur an die Konfis, die ihn sehen', async () => {
    await termin({ jahrgaenge: [JG_B], name: 'Nur B' });
    await termin({ name: 'Ohne Jahrgang' });
    await BackgroundService.sendRegistrationOpenPushes(db);
    // "Nur B" an Konfi B, "Ohne Jahrgang" an alle vier Konfis der Gemeinde.
    expect(tokens()).toEqual([
      'token-konfi1', 'token-konfi2', 'token-konfiB', 'token-konfiB', 'token-konfiOhneJg',
    ]);
  });

  it('Paritaet: "Neues Event!" bekommt genau, wer den Termin in GET /api/konfi/events findet', async () => {
    const termine = {
      jahrgang1: await termin({ jahrgaenge: [JAHRGAENGE.jahrgang1.id] }),
      jahrgangB: await termin({ jahrgaenge: [JG_B] }),
      beide: await termin({ jahrgaenge: [JAHRGAENGE.jahrgang1.id, JG_B] }),
      ohneJahrgang: await termin(),
      nurTeam: await termin({ jahrgaenge: [JAHRGAENGE.jahrgang1.id], teamerOnly: true }),
    };
    const konfis = [USERS.konfi1.id, USERS.konfi2.id, KONFI_B, KONFI_OHNE_JG];

    const liste = {};
    for (const k of konfis) {
      const res = await request(app).get('/api/konfi/events').set('Authorization', `Bearer ${konfiToken(k)}`);
      expect(res.status).toBe(200);
      liste[k] = new Set(res.body.map((e) => e.id));
    }

    for (const [art, id] of Object.entries(termine)) {
      sendFirebasePushNotification.mockClear();
      await neuesEvent(id);
      const bekommen = tokens();
      const sehen = konfis.filter((k) => liste[k].has(id)).map((k) => TOKEN_ZU[k]).sort();
      expect({ art, bekommen }).toEqual({ art, bekommen: sehen });
    }
    // Nicht leer zu vergleichen: Die Liste zeigt die Jahrgangstermine
    // tatsaechlich, die Paritaet prueft also beide Richtungen.
    expect(liste[USERS.konfi1.id].has(termine.jahrgang1)).toBe(true);
    expect(liste[KONFI_B].has(termine.beide)).toBe(true);
    expect(liste[KONFI_B].has(termine.ohneJahrgang)).toBe(true);
    expect([...liste[KONFI_OHNE_JG]]).toEqual([termine.ohneJahrgang]);
  });
});
