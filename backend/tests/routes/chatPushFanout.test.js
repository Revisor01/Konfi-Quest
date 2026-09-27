// backend/tests/routes/chatPushFanout.test.js
//
// Audit 26.09.2026, Betrieb BF-04: Eine Chat-Nachricht kostete 1.086
// Datenbankabfragen und 66 Einzel-Pushes (67 Teilnehmende). Nach der Antwort
// lief je Empfaenger:in eine Kette: `total_unread` (26,5 ms, Join ueber alle
// Raeume der Person), Raum-Organisation, Sender-Tokens, Empfaenger-Tokens,
// `berechneBadge` (Rolle, Organisationen, sieben Zaehler-Abfragen), je Geraet
// ein FCM-Aufruf und je Geraet ein UPDATE auf push_tokens. Der Aufwand wuchs
// streng linear mit der Teilnehmerzahl; bei 0,3 CPU fuer die Datenbank
// saettigten 0,65 Nachrichten je Sekunde ueber alle Gemeinden alles.
//
// Jetzt laeuft der Fan-out ueber PushService.sendChatNotificationToMany:
// Badge-Zahl und Tokens EINMAL fuer alle Empfaenger:innen, die
// Token-Buchfuehrung (erreichbar / ungueltig / Fehler) gesammelt je Block
// statt je Geraet, FCM weiterhin je Geraet (die Zahl am App-Icon ist je
// Person verschieden, ein Multicast mit einem Payload gibt es dafuer nicht).
//
// Gemessen mit dem Zaehl-Wrapper unten, Raum mit 150 Teilnehmenden, 139
// Empfaenger-Geraete, vor dem Umbau: 1.581 Abfragen, 10 Warn-Zeilen bei 10
// Personen ohne Geraet. Nach dem Umbau: 22 Abfragen (Umfrage: 24), eine
// Sammelzeile. Auf der Messdatenbank kq_i1 (490.400 Nachrichten, 278
// Geraete im Raum): 2.002 Abfragen und 2.665 ms Datenbankzeit -> 22 Abfragen
// und 170 ms.
//
// Gegenprobe (dokumentiert): Mit der alten Schleife faellt F1 mit
// "expected 1581 to be less than 50".
const request = require('supertest');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, CHAT_ROOMS, ORGS, ROLES } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

// Spy VOR dem Laden der App (die zieht pushService, der firebase beim
// Require destrukturiert) -- dasselbe Muster wie in pushService.test.js.
const firebase = require('../../push/firebase');
const sendFirebasePushNotification = vi
  .spyOn(firebase, 'sendFirebasePushNotification')
  .mockResolvedValue({ success: true });
vi.spyOn(firebase, 'sendFirebaseSilentPush').mockResolvedValue({ success: true });

const { getTestApp, warteAufNachwehen } = require('../helpers/testApp');
const PushService = require('../../services/pushService');
const chatSyncCache = require('../../utils/chatSyncCache');

const TEILNEHMENDE = 150;   // Obergrenze einer Gemeinde
const OHNE_GERAET = 10;     // davon ohne Push-Token
const SENDER_TOKEN = 'tok-sender-konfi1';

describe('Chat: Push-Fan-out an viele Teilnehmende', () => {
  let db;
  let app;
  let zaehler;
  let sqls;
  let warnungen;
  const originalWarn = console.warn;

  // Zaehl-Wrapper um den Pool (Muster aus pushServiceLast.test.js): dieselbe
  // Schnittstelle wie database.js, zaehlt aber jede Abfrage mit.
  const zaehlDb = () => ({
    query: (text, params) => {
      zaehler++;
      sqls.push(String(text).replace(/\s+/g, ' ').trim());
      return db.query(text, params);
    },
    getClient: async () => {
      const client = await db.getClient();
      return {
        query: (text, params) => {
          zaehler++;
          sqls.push(String(text).replace(/\s+/g, ' ').trim());
          return client.query(text, params);
        },
        release: () => client.release(),
      };
    },
    poolZustand: () => db.poolZustand(),
  });
  const anzahlMit = (muster) => sqls.filter((q) => q.includes(muster)).length;

  // Zusaetzliche Konfis in Org 1: ab ID 1001, damit sie sich mit dem Seed
  // (1-11) nicht ueberschneiden.
  const extraIds = [];

  beforeAll(async () => {
    db = getTestPool();
    app = getTestApp(zaehlDb());
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    chatSyncCache.clear();
    extraIds.length = 0;

    // Raum 1 hat aus dem Seed vier Teilnehmende (konfi1, konfi2, teamer1,
    // admin1). Auffuellen auf 150 mit weiteren Konfis der Org 1.
    const fehlen = TEILNEHMENDE - 4;
    const werte = [];
    const params = [];
    for (let i = 0; i < fehlen; i++) {
      const id = 1001 + i;
      extraIds.push(id);
      params.push(id, `fanoutkonfi${i}`, `Fan-out Konfi ${i}`, ROLES.konfi.id, ORGS.testGemeinde.id);
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
    // Geraete: die ersten (fehlen - OHNE_GERAET) Extras je eins, die letzten
    // zehn keins. Seed-Teilnehmende je eins; konfi1 (Sender) ebenfalls.
    const mitGeraet = extraIds.slice(0, fehlen - OHNE_GERAET);
    await db.query(
      `INSERT INTO push_tokens (user_id, token, platform, device_id)
       SELECT id, 'tok-' || id, 'ios', 'dev-' || id FROM unnest($1::bigint[]) AS id`,
      [mitGeraet]
    );
    for (const [userId, token] of [
      [USERS.konfi1.id, SENDER_TOKEN],
      [USERS.konfi2.id, 'tok-konfi2'],
      [USERS.teamer1.id, 'tok-teamer1'],
      [USERS.admin1.id, 'tok-admin1'],
    ]) {
      await db.query(
        'INSERT INTO push_tokens (user_id, token, platform, device_id) VALUES ($1, $2, $3, $4)',
        [userId, token, 'ios', 'dev-' + token]
      );
    }
    sendFirebasePushNotification.mockClear();
    sendFirebasePushNotification.mockResolvedValue({ success: true });
    warnungen = [];
    console.warn = (...args) => { warnungen.push(args.map(String).join(' ')); };
    zaehler = 0;
    sqls = [];
  });

  afterEach(() => {
    console.warn = originalWarn;
  });

  afterAll(async () => {
    await closePool();
  });

  async function nachrichtSenden(content = 'Hallo alle') {
    const res = await request(app)
      .post(`/api/chat/rooms/${CHAT_ROOMS.jahrgang.id}/messages`)
      .set('Authorization', `Bearer ${generateToken('konfi1')}`)
      .send({ content });
    expect(res.status).toBe(200);
    await warteAufNachwehen(app);
    return res.body;
  }

  const gesendete = () => sendFirebasePushNotification.mock.calls.map(
    ([token, payload]) => ({ token, ...payload })
  );

  it('F1: eine Nachricht an 150 Teilnehmende kostet weniger als 50 Abfragen (vorher 1.581)', async () => {
    await nachrichtSenden();

    // Der Zielwert aus dem Audit: unabhaengig von der Teilnehmerzahl.
    expect(zaehler).toBeLessThan(50);
    // Die Schleife je Kopf ist weg: keine total_unread-Abfrage mehr, und die
    // Sender-Tokens werden nicht mehr eigens geladen -- ein Token gehoert
    // seit Migration 095 genau einer Person (idx_push_tokens_token_unique),
    // und der Sender ist kein Empfaenger.
    expect(anzahlMit('total_unread')).toBe(0);
    expect(anzahlMit('SELECT token FROM push_tokens WHERE user_id')).toBe(0);
    // Die Buchfuehrung "Geraet erreichbar" laeuft gesammelt, nicht je Geraet
    // (139 Geraete, hoechstens drei Bloecke).
    expect(anzahlMit('UPDATE push_tokens SET updated_at = NOW()')).toBeLessThanOrEqual(3);
  });

  it('F2: jedes Empfaenger-Geraet bekommt genau einen Push, der Sender keinen', async () => {
    const antwort = await nachrichtSenden('Hallo alle');

    const pushes = gesendete();
    // 136 Extras mit Geraet + konfi2 + teamer1 + admin1 = 139; der Sender
    // selbst nicht.
    expect(pushes).toHaveLength(TEILNEHMENDE - 4 - OHNE_GERAET + 3);
    const tokens = pushes.map((p) => p.token);
    expect(new Set(tokens).size).toBe(tokens.length);
    expect(tokens).not.toContain(SENDER_TOKEN);
    expect(tokens).toContain('tok-konfi2');
    expect(tokens).toContain('tok-teamer1');
    expect(tokens).toContain('tok-admin1');

    // Payload wie bisher (Vertrag mit den Apps: pushNavigation liest type,
    // roomId, organization_id).
    const anKonfi2 = pushes.find((p) => p.token === 'tok-konfi2');
    expect(anKonfi2.title).toBe(CHAT_ROOMS.jahrgang.name);
    expect(anKonfi2.body).toBe(`${USERS.konfi1.display_name}: Hallo alle`);
    expect(anKonfi2.data).toEqual({
      type: 'chat',
      roomId: String(CHAT_ROOMS.jahrgang.id),
      messageId: String(antwort.id),
      sender_id: String(USERS.konfi1.id),
      sender_name: USERS.konfi1.display_name,
      room_name: CHAT_ROOMS.jahrgang.name,
      organization_id: String(ORGS.testGemeinde.id),
    });
  });

  it('F3: die Zahl am App-Icon ist dieselbe wie beim Einzelweg', async () => {
    await nachrichtSenden();

    // Referenz: berechneBadge rechnet je Person genau die Summe, die der
    // alte Weg je Kopf ermittelte. Der Umbau darf nur die Abfragen sparen,
    // nicht die Zahl veraendern.
    for (const [token, userId] of [
      ['tok-konfi2', USERS.konfi2.id],
      ['tok-teamer1', USERS.teamer1.id],
      ['tok-admin1', USERS.admin1.id],
      ['tok-1001', 1001],
    ]) {
      const push = gesendete().find((p) => p.token === token);
      expect(push.badge).toBe(await PushService.berechneBadge(db, userId));
    }
    // Und nicht bloss 1 fuer alle: konfi2 hat genau diese eine ungelesene
    // Nachricht und sonst nichts Offenes.
    expect(gesendete().find((p) => p.token === 'tok-konfi2').badge).toBe(1);
  });

  it('F4: Personen ohne Geraet ergeben EINE Sammelzeile im Log statt einer je Kopf', async () => {
    await nachrichtSenden();

    const ohneToken = warnungen.filter((z) => /ohne Push-Token|Keine Push-Tokens/.test(z));
    expect(ohneToken).toHaveLength(1);
    expect(ohneToken[0]).toContain(`${OHNE_GERAET} von ${TEILNEHMENDE - 1}`);
  });

  it('F5: erreichbare Geraete werden trotzdem als erreichbar vermerkt, ungueltige geloescht', async () => {
    // Die gesammelte Buchfuehrung muss dasselbe Ergebnis in der Datenbank
    // hinterlassen wie die je Geraet: updated_at aufgefrischt, Fehlerzaehler
    // zurueck, von FCM abgelehnte Tokens weg.
    await db.query(
      "UPDATE push_tokens SET updated_at = NOW() - INTERVAL '20 days', error_count = 2 WHERE token = 'tok-konfi2'"
    );
    sendFirebasePushNotification.mockImplementation(async (token) => (
      token === 'tok-teamer1'
        ? { success: false, error: 'not found', errorCode: 'messaging/registration-token-not-registered' }
        : token === 'tok-admin1'
          ? { success: false, error: 'unavailable', errorCode: 'messaging/server-unavailable' }
          : { success: true }
    ));

    await nachrichtSenden();

    const { rows: [konfi2] } = await db.query(
      "SELECT error_count, last_error_at, updated_at > NOW() - INTERVAL '1 minute' AS frisch FROM push_tokens WHERE token = 'tok-konfi2'"
    );
    expect(konfi2.error_count).toBe(0);
    expect(konfi2.last_error_at).toBeNull();
    expect(konfi2.frisch).toBe(true);

    const { rows: teamer } = await db.query("SELECT 1 FROM push_tokens WHERE token = 'tok-teamer1'");
    expect(teamer).toHaveLength(0);

    const { rows: [admin] } = await db.query(
      "SELECT error_count, last_error_at FROM push_tokens WHERE token = 'tok-admin1'"
    );
    expect(admin.error_count).toBe(1);
    expect(admin.last_error_at).not.toBeNull();
  });

  it('F6: "Nachrichten" stummgeschaltet -> kein Push an diese Person, die anderen bekommen ihn', async () => {
    await db.query(
      "UPDATE users SET push_gruppen_stumm = ARRAY['konfi_chat'] WHERE id = $1",
      [USERS.konfi2.id]
    );

    await nachrichtSenden();

    const tokens = gesendete().map((p) => p.token);
    expect(tokens).not.toContain('tok-konfi2');
    expect(tokens).toContain('tok-teamer1');
    expect(tokens).toHaveLength(TEILNEHMENDE - 4 - OHNE_GERAET + 2);
  });

  it('F7: eine Umfrage geht denselben Weg', async () => {
    const res = await request(app)
      .post(`/api/chat/rooms/${CHAT_ROOMS.jahrgang.id}/polls`)
      .set('Authorization', `Bearer ${generateToken('admin1')}`)
      .send({ question: 'Wann?', options: ['Montag', 'Dienstag'] });
    expect(res.status).toBe(201);
    await warteAufNachwehen(app);

    expect(zaehler).toBeLessThan(50);
    expect(anzahlMit('total_unread')).toBe(0);
    const pushes = gesendete();
    // Alle mit Geraet ausser admin1 (Sender): 136 Extras + konfi1 + konfi2 + teamer1.
    expect(pushes).toHaveLength(TEILNEHMENDE - 4 - OHNE_GERAET + 3);
    expect(pushes.map((p) => p.token)).not.toContain('tok-admin1');
    expect(pushes[0].body).toBe(`${USERS.admin1.display_name}: [Umfrage] Wann?`);
    expect(pushes[0].data.type).toBe('chat');
    expect(pushes[0].data.messageId).toBe(String(res.body.message_id));
  });
});
