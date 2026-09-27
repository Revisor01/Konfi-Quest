// backend/tests/services/appIconLaufNeustart.test.js
//
// Audit 26.09.2026, Betrieb BF-02: Der App-Icon-Lauf (alle 5 Minuten)
// schickte nach jedem Neustart an ALLE Geraete einen stillen Push -- der
// Merker `letzterZaehler` lebt im Prozessspeicher und ist nach Deploy oder
// Absturz leer, also "weicht" jeder Stand ab. Gemessen im Audit fuer 25.000
// Konten mit 48.000 Tokens: 214,8 s, 328.403 Abfragen, 96.000 Log-Zeilen,
// und das ohne FCM-Latenz. Der Takt startete trotzdem alle 5 Minuten neu --
// mehrere Laeufe gleichzeitig, jeder mit 328.000 Abfragen. Im Regelbetrieb
// kostete eine einzelne neue Chat-Nachricht im naechsten Takt 865 Abfragen
// und 66 Einzel-Pushes (sendBadgeUpdate rechnete je Kopf ~13 Abfragen).
//
// Jetzt: Der erste Lauf nach dem Start fuellt nur den Merker und sendet
// nichts (zaehlerMerkerGefuellt). Ein Takt, der einen laufenden Vorgaenger
// trifft, wird uebersprungen (badgeLauf, Muster wie eventReminderLaeuft);
// der Stundenlauf wartet statt zu ueberspringen, weil beide Takte am
// Prozessstart verankert sind und sich jede volle Stunde treffen. Die
// stillen Pushes eines Takts gehen gesammelt ueber sendBadgeUpdates (Tokens
// einmal fuer alle, Buchfuehrung je Block) mit der schon gerechneten Summe.
//
// Gemessen mit dem Zaehl-Wrapper unten, 60 Personen mit Geraet in Raum 1,
// eine neue Nachricht: vorher 59 Einzel-Pushes ueber sendBadgeUpdate mit
// 439 Abfragen; nachher 59 stille Pushes (einer je Geraet, unveraendert)
// mit 25 Abfragen. Erster Lauf nach Neustart: vorher 60 Pushes, nachher 0.
//
// Gegenprobe (dokumentiert): Ohne den Merker-Erstlauf faellt N1 mit
// "expected 60 to be 0"; ohne Laufmerker faellt N4, weil der zweite Lauf
// nicht sofort zurueckkehrt.
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, ROLES, CHAT_ROOMS } = require('../helpers/seed');

const firebase = require('../../push/firebase');
vi.spyOn(firebase, 'sendFirebasePushNotification').mockResolvedValue({ success: true });
const sendFirebaseSilentPush = vi
  .spyOn(firebase, 'sendFirebaseSilentPush')
  .mockResolvedValue({ success: true });

const BackgroundService = require('../../services/backgroundService');
const PushService = require('../../services/pushService');

const ORG_ID = ORGS.testGemeinde.id;
const MIT_GERAET = 60;

describe('App-Icon-Lauf: Neustart, Ueberlappung, Sammelversand', () => {
  let db;
  let zaehler;
  let sqls;
  const originalWarn = console.warn;
  let warnungen;

  const zaehlDb = () => ({
    query: (text, params) => {
      zaehler++;
      sqls.push(String(text).replace(/\s+/g, ' ').trim());
      return db.query(text, params);
    },
    getClient: () => db.getClient(),
  });

  const extraIds = [];

  beforeAll(() => {
    db = getTestPool();
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    // Raum 1: konfi1, konfi2, teamer1, admin1 aus dem Seed + 56 weitere
    // Konfis -> 60 Personen, jede mit einem Geraet.
    extraIds.length = 0;
    const werte = [];
    const params = [];
    for (let i = 0; i < MIT_GERAET - 4; i++) {
      const id = 3001 + i;
      extraIds.push(id);
      params.push(id, `iconkonfi${i}`, `Icon-Konfi ${i}`, ROLES.konfi.id, ORG_ID);
      const b = i * 5;
      werte.push(`($${b + 1}, $${b + 2}, 'x', $${b + 3}, $${b + 4}, $${b + 5}, true)`);
    }
    await db.query(
      `INSERT INTO users (id, username, password_hash, display_name, role_id, organization_id, is_active)
       VALUES ${werte.join(', ')}`,
      params
    );
    await db.query(
      `INSERT INTO chat_participants (room_id, user_id, user_type)
       SELECT $1, unnest($2::bigint[]), 'konfi'`,
      [CHAT_ROOMS.jahrgang.id, extraIds]
    );
    await db.query(
      `INSERT INTO push_tokens (user_id, token, platform, device_id)
       SELECT id, 'tok-' || id, 'ios', 'dev-' || id
         FROM unnest($1::bigint[]) AS id`,
      [[...extraIds, USERS.konfi1.id, USERS.konfi2.id, USERS.teamer1.id, USERS.admin1.id]]
    );

    // Wie nach einem Neustart: Merker leer, noch kein Lauf.
    BackgroundService.letzterZaehler.clear();
    BackgroundService.letzterAbzeichenAbdruck.clear();
    BackgroundService.zaehlerMerkerGefuellt = false;

    sendFirebaseSilentPush.mockClear();
    sendFirebaseSilentPush.mockResolvedValue({ success: true });
    warnungen = [];
    console.warn = (...args) => { warnungen.push(args.map(String).join(' ')); };
    zaehler = 0;
    sqls = [];
  });

  afterEach(() => {
    console.warn = originalWarn;
    // Eine im Test gesetzte mockImplementation (Schranke, Fehlercodes) wieder
    // wegraeumen -- der Spy selbst bleibt, damit die Zaehlung weiter stimmt.
    sendFirebaseSilentPush.mockReset();
    sendFirebaseSilentPush.mockResolvedValue({ success: true });
  });

  afterAll(async () => {
    await closePool();
  });

  const neueNachricht = () => db.query(
    `INSERT INTO chat_messages (room_id, user_id, user_type, message_type, content)
     VALUES ($1, $2, 'konfi', 'text', 'Hallo')`,
    [CHAT_ROOMS.jahrgang.id, USERS.konfi1.id]
  );

  it('N1: der erste Lauf nach dem Start fuellt den Merker und sendet NICHTS (vorher 60 Pushes)', async () => {
    const ergebnis = await BackgroundService.updateAllUserBadges(zaehlDb(), { nurZaehler: true });

    expect(firebase.sendFirebaseSilentPush).toHaveBeenCalledTimes(0);
    expect(ergebnis.updated).toBe(0);
    // Alle 60 Personen mit Geraet stehen jetzt im Merker.
    expect(BackgroundService.letzterZaehler.size).toBe(MIT_GERAET);
    expect(BackgroundService.zaehlerMerkerGefuellt).toBe(true);
  });

  it('N2: der zweite Lauf ohne Aenderung sendet weiterhin nichts', async () => {
    await BackgroundService.updateAllUserBadges(db, { nurZaehler: true });
    await BackgroundService.updateAllUserBadges(db, { nurZaehler: true });

    expect(firebase.sendFirebaseSilentPush).toHaveBeenCalledTimes(0);
  });

  it('N3: eine neue Nachricht -> genau ein stiller Push je Geraet der 59 anderen, mit der richtigen Summe, in 25 Abfragen (vorher 439)', async () => {
    await BackgroundService.updateAllUserBadges(db, { nurZaehler: true });
    await neueNachricht();
    zaehler = 0;
    sqls = [];

    const ergebnis = await BackgroundService.updateAllUserBadges(zaehlDb(), { nurZaehler: true });

    // Der Sender selbst hat keine neue ungelesene Nachricht -> kein Push.
    const aufrufe = firebase.sendFirebaseSilentPush.mock.calls;
    expect(aufrufe).toHaveLength(MIT_GERAET - 1);
    expect(ergebnis.updated).toBe(MIT_GERAET - 1);
    const tokens = aufrufe.map(([t]) => t);
    expect(new Set(tokens).size).toBe(MIT_GERAET - 1);
    expect(tokens).not.toContain(`tok-${USERS.konfi1.id}`);
    // Die Zahl ist die Gesamtsumme fuers App-Icon dieser Person -- dieselbe,
    // die der Einzelweg rechnet.
    for (const [token, userId] of [[`tok-${USERS.konfi2.id}`, USERS.konfi2.id], [`tok-${USERS.teamer1.id}`, USERS.teamer1.id], ['tok-3001', 3001]]) {
      const [, badge] = aufrufe.find(([t]) => t === token);
      expect(badge).toBe(await PushService.berechneBadge(db, userId));
    }
    expect(aufrufe.find(([t]) => t === `tok-${USERS.konfi2.id}`)[1]).toBe(1);
    // Sammelversand: nicht ~13 Abfragen je Kopf, sondern ein paar fuer alle.
    expect(zaehler).toBeLessThan(30);
  });

  it('N4: ein zweiter Zaehler-Takt waehrend eines laufenden kehrt sofort zurueck und sendet nichts doppelt', async () => {
    await BackgroundService.updateAllUserBadges(db, { nurZaehler: true });
    await neueNachricht();

    let freigeben;
    const schranke = new Promise((r) => { freigeben = r; });
    firebase.sendFirebaseSilentPush.mockImplementation(async () => { await schranke; return { success: true }; });

    const erster = BackgroundService.updateAllUserBadges(db, { nurZaehler: true });
    await vi.waitFor(() => expect(firebase.sendFirebaseSilentPush.mock.calls.length).toBeGreaterThan(0));

    const zweiterDb = zaehlDb();
    const zweiter = BackgroundService.updateAllUserBadges(zweiterDb, { nurZaehler: true });
    const ausgang = await Promise.race([
      zweiter.then(() => 'uebersprungen'),
      new Promise((r) => setTimeout(() => r('haengt'), 500)),
    ]);
    expect(ausgang).toBe('uebersprungen');
    expect(zaehler).toBe(0);
    expect(warnungen.some((z) => /vorheriger Lauf noch aktiv/.test(z))).toBe(true);

    freigeben();
    await erster;
    await zweiter;
    expect(firebase.sendFirebaseSilentPush).toHaveBeenCalledTimes(MIT_GERAET - 1);
  });

  it('N5: der Stundenlauf (Abzeichen) wartet auf einen laufenden Zaehler-Takt, statt ihn zu ueberspringen', async () => {
    // Beide Takte sind am Prozessstart verankert und treffen sich jede volle
    // Stunde; der Zaehler-Takt ist zuerst registriert und startet zuerst.
    // Wuerde der Stundenlauf dann uebersprungen, liefe die Abzeichen-Pruefung
    // nie. Er wartet deshalb und laeuft danach.
    await BackgroundService.updateAllUserBadges(db, { nurZaehler: true });
    await neueNachricht();

    let freigeben;
    const schranke = new Promise((r) => { freigeben = r; });
    firebase.sendFirebaseSilentPush.mockImplementation(async () => { await schranke; return { success: true }; });

    const zaehlerTakt = BackgroundService.updateAllUserBadges(db, { nurZaehler: true });
    await vi.waitFor(() => expect(firebase.sendFirebaseSilentPush.mock.calls.length).toBeGreaterThan(0));

    let stundenlaufFertig = false;
    const stundenlauf = BackgroundService.updateAllUserBadges(db).then((e) => { stundenlaufFertig = true; return e; });
    await new Promise((r) => setTimeout(r, 300));
    expect(stundenlaufFertig).toBe(false);

    freigeben();
    await zaehlerTakt;
    const ergebnis = await stundenlauf;
    expect(ergebnis.uebersprungen).toBeUndefined();
    // Der Stundenlauf hat die Abzeichen-Pruefung tatsaechlich gemacht
    // (erster voller Lauf: alle Konfis und Teamer:innen stehen an).
    expect(ergebnis.geprueft).toBeGreaterThan(0);
  });

  it('N6: nach einem abgebrochenen Lauf ist der Merker wieder frei', async () => {
    const kaputt = { query: async () => { throw new Error('DB weg (simuliert)'); } };
    await expect(BackgroundService.updateAllUserBadges(kaputt, { nurZaehler: true })).rejects.toThrow('DB weg (simuliert)');

    const ergebnis = await BackgroundService.updateAllUserBadges(db, { nurZaehler: true });
    expect(ergebnis.uebersprungen).toBeUndefined();
    expect(BackgroundService.letzterZaehler.size).toBe(MIT_GERAET);
  });

  it('N7: sendBadgeUpdates fuehrt die Buchfuehrung wie der Einzelweg: ungueltige Tokens weg, Fehler gezaehlt', async () => {
    await BackgroundService.updateAllUserBadges(db, { nurZaehler: true });
    await neueNachricht();
    firebase.sendFirebaseSilentPush.mockImplementation(async (token) => (
      token === `tok-${USERS.konfi2.id}`
        ? { success: false, error: 'not found', errorCode: 'messaging/registration-token-not-registered' }
        : token === `tok-${USERS.teamer1.id}`
          ? { success: false, error: 'unavailable', errorCode: 'messaging/server-unavailable' }
          : { success: true }
    ));

    await BackgroundService.updateAllUserBadges(db, { nurZaehler: true });

    const { rows: konfi2 } = await db.query('SELECT 1 FROM push_tokens WHERE token = $1', [`tok-${USERS.konfi2.id}`]);
    expect(konfi2).toHaveLength(0);
    const { rows: [teamer] } = await db.query('SELECT error_count, last_error_at FROM push_tokens WHERE token = $1', [`tok-${USERS.teamer1.id}`]);
    expect(teamer.error_count).toBe(1);
    expect(teamer.last_error_at).not.toBeNull();
  });
});
