// backend/tests/services/pushProtokollMenge.test.js
//
// Log-Volumen der Push-Versandwege (Audit 26.09.2026, Betrieb BF-11).
//
// Die Container-Logs rotieren bei 10 MB x 3. Gemessen am 29.09.2026 mit
// 20.000 Konten (die Haelfte ohne Geraet, wie in Produktion) und
// zugestelltem FCM schrieb der Versand an viele je Person ohne Geraet eine
// Zeile: eine Absage an 1.000 Empfaenger:innen 500 Zeilen (55 kB), jeder
// Anmeldung-offen-Lauf (jede Minute) bis zu 400, ein Erinnerungslauf 400. Bei
// einem FCM-Ausfall kam je Geraet eine Fehlerzeile dazu (1.000 Zeilen,
// 111 kB je Absage). Der Chat-Weg fasste die Personen ohne Geraet schon zu
// einer Sammelzeile zusammen (Betrieb BF-04), die uebrigen Wege nicht.
//
// Jetzt: eine Sammelzeile je Versand fuer "ohne Geraet", eine fuer
// geloeschte Tokens, eine fuer Fehlschlaege -- mit Zahl, Fehlercodes und der
// ersten Meldung. Fehler bleiben damit im Protokoll, nur nicht tausendfach.
// Der Einzelversand an EINE Person bleibt, wie er war (eine Zeile, auch fuer
// "kein Geraet": dort ist sie die Antwort auf "warum kam bei mir nichts?").
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, ROLES } = require('../helpers/seed');

const firebase = require('../../push/firebase');
const sendFirebasePushNotification = vi
  .spyOn(firebase, 'sendFirebasePushNotification')
  .mockResolvedValue({ success: true });
vi.spyOn(firebase, 'sendFirebaseSilentPush').mockResolvedValue({ success: true });

const PushService = require('../../services/pushService');

const MIT_GERAET = 60;   // Konfis mit Token
const OHNE_GERAET = 60;  // Konfis ohne Token
const ERSTE_ID = 2001;

describe('Push: Log-Zeilen je Versand an viele', () => {
  let db;
  let zeilen;
  let empfaenger;
  const original = { warn: console.warn, error: console.error, log: console.log };

  beforeAll(() => { db = getTestPool(); });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    empfaenger = [];
    for (let i = 0; i < MIT_GERAET + OHNE_GERAET; i++) {
      const id = ERSTE_ID + i;
      empfaenger.push(id);
      await db.query(
        `INSERT INTO users (id, username, display_name, password_hash, role_id, organization_id)
         VALUES ($1, $2, $3, 'x', $4, $5)`,
        [id, `logkonfi${id}`, `Log Konfi ${id}`, ROLES.konfi.id, ORGS.testGemeinde.id]
      );
      if (i < MIT_GERAET) {
        await db.query(
          `INSERT INTO push_tokens (user_id, token, platform, device_id) VALUES ($1, $2, 'android', $3)`,
          [id, `tok-${id}`, `dev-${id}`]
        );
      }
    }
    sendFirebasePushNotification.mockReset();
    sendFirebasePushNotification.mockResolvedValue({ success: true });
    PushService.EMPFAENGER_PAUSE_MS = 0;
    PushService.WIEDERHOLUNG_PAUSE_MS = 0;
    zeilen = [];
    for (const m of ['warn', 'error', 'log']) {
      console[m] = (...a) => { zeilen.push(a.map(String).join(' ')); };
    }
  });

  afterEach(() => {
    Object.assign(console, original);
  });

  afterAll(async () => { await closePool(); });

  const absage = () => PushService.sendToMultipleUsers(db, empfaenger, {
    title: 'Abgesagt', body: 'x', data: { type: 'event_cancelled', organization_id: String(ORGS.testGemeinde.id) },
  });

  it('Personen ohne Geraet: EINE Sammelzeile statt einer je Kopf', async () => {
    const ergebnis = await absage();
    // Das Ergebnis je Person bleibt, wie es war.
    expect(ergebnis.filter((e) => e.message === 'No tokens found')).toHaveLength(OHNE_GERAET);
    expect(zeilen).toEqual([
      `Push event_cancelled: ${OHNE_GERAET} von ${MIT_GERAET + OHNE_GERAET} Empfänger:innen ohne Push-Token`,
    ]);
  });

  it('FCM-Ausfall: EINE Fehlerzeile mit Zahl, Code und erster Meldung -- der Fehler bleibt sichtbar', async () => {
    sendFirebasePushNotification.mockResolvedValue({
      success: false, error: 'Service unavailable', errorCode: 'messaging/server-unavailable',
    });
    await absage();
    const fehler = zeilen.filter((z) => /fehlgeschlagen/.test(z));
    expect(fehler).toEqual([
      `Push event_cancelled: an ${MIT_GERAET} Geräte fehlgeschlagen `
        + `(messaging/server-unavailable ×${MIT_GERAET}), erste Meldung: Service unavailable`,
    ]);
    expect(zeilen).toHaveLength(2); // dazu die Sammelzeile "ohne Push-Token"
    // Die Buchfuehrung in der Datenbank ist dieselbe wie je Geraet.
    const { rows: [{ n }] } = await db.query(
      'SELECT count(*)::int AS n FROM push_tokens WHERE error_count = 1 AND user_id >= $1', [ERSTE_ID]
    );
    expect(n).toBe(MIT_GERAET);
  });

  it('abgemeldete Geraete: EINE Zeile ueber die geloeschten Tokens', async () => {
    sendFirebasePushNotification.mockResolvedValue({
      success: false, error: 'Requested entity was not found.', errorCode: 'messaging/registration-token-not-registered',
    });
    await absage();
    expect(zeilen.filter((z) => /gelöscht/.test(z))).toEqual([
      `Push event_cancelled: ${MIT_GERAET} Token gelöscht (messaging/registration-token-not-registered ×${MIT_GERAET})`,
    ]);
    const { rows: [{ n }] } = await db.query(
      'SELECT count(*)::int AS n FROM push_tokens WHERE user_id >= $1', [ERSTE_ID]
    );
    expect(n).toBe(0);
  });

  it('alles zugestellt, alle mit Geraet: keine Zeile', async () => {
    await PushService.sendToMultipleUsers(db, empfaenger.slice(0, MIT_GERAET), {
      title: 'x', body: 'y', data: { type: 'event_cancelled', organization_id: '1' },
    });
    expect(zeilen).toEqual([]);
  });

  it('Einzelversand an eine Person ohne Geraet: weiter genau eine Zeile', async () => {
    await PushService.sendActivityRequestStatusToKonfi(db, USERS.konfi2.id, 'Aktivität', 2, 'approved');
    expect(zeilen).toEqual([`Keine Push-Tokens für User ${USERS.konfi2.id} gefunden`]);
  });

  it('Einzelversand, FCM-Fehler: weiter die Zeile je Geraet', async () => {
    await db.query(
      `INSERT INTO push_tokens (user_id, token, platform, device_id) VALUES ($1, 'tok-einzeln', 'ios', 'dev-einzeln')`,
      [USERS.konfi2.id]
    );
    sendFirebasePushNotification.mockResolvedValue({
      success: false, error: 'Service unavailable', errorCode: 'messaging/server-unavailable',
    });
    await PushService.sendActivityRequestStatusToKonfi(db, USERS.konfi2.id, 'Aktivität', 2, 'approved');
    expect(zeilen).toEqual(['Push failed for token: Service unavailable']);
  });
});
