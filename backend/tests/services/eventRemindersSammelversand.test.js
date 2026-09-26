// backend/tests/services/eventRemindersSammelversand.test.js
//
// Audit 26.09.2026, Betrieb BF-05 (Rest): Der Erinnerungslauf arbeitete je
// Empfaenger:in -- ein Push ueber sendToUser (Postfach-Pruefung, Tokens,
// Badge-Summe, UPDATE je Geraet) und danach ein INSERT in event_reminders.
// Gemessen im Audit: 14 Abfragen und 9,2 ms je Kopf; bei 6.000 Empfaengern
// je Takt (200 Gemeinden, ein Gottesdienst, 30 Zusagen) 55 s Datenbankzeit,
// mit FCM-Latenz rund zehn Minuten. Das Fenster und der Laufmerker sind seit
// fix(erinnerungen) da; hier geht es um den Versand selbst.
//
// Jetzt: je Termin EIN blockweises INSERT ... ON CONFLICT DO NOTHING
// RETURNING user_id VOR dem Versand (wer die Zeile setzt, sendet -- eine
// zweite Replica bekaeme fuer dieselben Leute nichts zurueck), und EIN
// Sammel-Push je Termin ueber sendToMultipleUsers (der Text ist je Termin
// gleich). Die Fachlogik (Fenster, Laufmerker, wer erinnert wird) ist
// unveraendert; eventReminders.test.js laeuft unveraendert weiter.
//
// Gemessen mit dem Zaehl-Wrapper unten, ein Termin mit 200 Zusagen:
// vorher 200 Push-Aufrufe (sendEventReminderToKonfi je Kopf), 200 INSERTs,
// 1.802 Abfragen; nachher 1 Push-Aufruf mit 200 Empfaenger:innen, 1 INSERT,
// 35 Abfragen. Jede Person bekommt weiterhin genau einen Push, und in
// event_reminders steht je Person genau eine Zeile.
//
// Gegenprobe (dokumentiert): Mit der alten Schleife faellt S1 mit
// "expected 200 to be 1" (Push-Aufrufe) und S2 mit "expected 200 to be 1"
// (INSERTs).
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, ROLES } = require('../helpers/seed');

const firebase = require('../../push/firebase');
const sendFirebasePushNotification = vi
  .spyOn(firebase, 'sendFirebasePushNotification')
  .mockResolvedValue({ success: true });
vi.spyOn(firebase, 'sendFirebaseSilentPush').mockResolvedValue({ success: true });

const BackgroundService = require('../../services/backgroundService');
const PushService = require('../../services/pushService');

const ORG_ID = ORGS.testGemeinde.id;
const EMPFAENGER = 200;
let nextEventId = 8001;

describe('Terminerinnerungen: Sammelversand je Termin', () => {
  let db;
  let zaehler;
  let sqls;

  const zaehlDb = () => ({
    query: (text, params) => {
      zaehler++;
      sqls.push(String(text).replace(/\s+/g, ' ').trim());
      return db.query(text, params);
    },
    getClient: () => db.getClient(),
  });
  const anzahlMit = (muster) => sqls.filter((q) => q.includes(muster)).length;

  // 198 weitere Konfis in Org 1 (ab ID 2001), jede mit einem Geraet.
  const extraIds = [];

  async function terminMitZusagen(userIds, { eventDateSql = "NOW() + INTERVAL '24 hours'" } = {}) {
    const eventId = nextEventId++;
    await db.query(
      `INSERT INTO events (id, name, event_date, organization_id, cancelled, mandatory, has_timeslots)
       VALUES ($1, 'Gottesdienst', ${eventDateSql}, $2, false, false, false)`,
      [eventId, ORG_ID]
    );
    await db.query(
      `INSERT INTO event_bookings (event_id, user_id, status, attendance_status, organization_id)
       SELECT $1, unnest($2::bigint[]), 'confirmed', NULL, $3`,
      [eventId, userIds, ORG_ID]
    );
    return eventId;
  }

  async function erinnerte(eventId, typ) {
    const { rows } = await db.query(
      'SELECT user_id FROM event_reminders WHERE event_id = $1 AND reminder_type = $2 ORDER BY user_id',
      [eventId, typ]
    );
    return rows.map((r) => r.user_id);
  }

  beforeAll(() => {
    db = getTestPool();
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    extraIds.length = 0;
    const werte = [];
    const params = [];
    for (let i = 0; i < EMPFAENGER - 2; i++) {
      const id = 2001 + i;
      extraIds.push(id);
      params.push(id, `erinnerkonfi${i}`, `Erinner-Konfi ${i}`, ROLES.konfi.id, ORG_ID);
      const b = i * 5;
      werte.push(`($${b + 1}, $${b + 2}, 'x', $${b + 3}, $${b + 4}, $${b + 5}, true)`);
    }
    await db.query(
      `INSERT INTO users (id, username, password_hash, display_name, role_id, organization_id, is_active)
       VALUES ${werte.join(', ')}`,
      params
    );
    await db.query(
      `INSERT INTO push_tokens (user_id, token, platform, device_id)
       SELECT id, 'tok-' || id, 'ios', 'dev-' || id
         FROM unnest($1::bigint[]) AS id`,
      [[...extraIds, USERS.konfi1.id, USERS.konfi2.id]]
    );
    sendFirebasePushNotification.mockClear();
    sendFirebasePushNotification.mockResolvedValue({ success: true });
    zaehler = 0;
    sqls = [];
  });

  // Spies auf PushService je Test anlegen und danach einzeln zuruecknehmen --
  // NICHT vi.restoreAllMocks(): das wuerde auch den Firebase-Spy oben auf das
  // Original zuruecksetzen, und die Zaehlung `sendFirebasePushNotification`
  // liefe ins Leere.
  const spione = [];
  const spion = (name) => {
    const s = vi.spyOn(PushService, name);
    spione.push(s);
    return s;
  };

  afterEach(() => {
    for (const s of spione.splice(0)) s.mockRestore();
  });

  afterAll(async () => {
    await closePool();
  });

  const alle = () => [USERS.konfi1.id, USERS.konfi2.id, ...extraIds];

  it('S1: ein Termin mit 200 Zusagen -> EIN Push-Aufruf mit allen 200 statt 200 einzelne', async () => {
    const eventId = await terminMitZusagen(alle());
    const push = spion('sendEventReminderToKonfi');
    const sammel = spion('sendToMultipleUsers');

    await BackgroundService.sendEventReminders(zaehlDb());

    expect(push).toHaveBeenCalledTimes(1);
    const [, empfaenger, name, , , typ, orgId, kennung] = push.mock.calls[0];
    expect(Array.isArray(empfaenger)).toBe(true);
    expect([...empfaenger].sort((a, b) => a - b)).toEqual(alle().sort((a, b) => a - b));
    expect(name).toBe('Gottesdienst');
    expect(typ).toBe('1_day');
    expect(orgId).toBe(ORG_ID);
    expect(kennung).toBe(eventId);
    expect(sammel).toHaveBeenCalledTimes(1);
    expect(sammel.mock.calls[0][1]).toHaveLength(EMPFAENGER);
  });

  it('S2: je Termin EIN INSERT in event_reminders, und zwar VOR dem Versand', async () => {
    const eventId = await terminMitZusagen(alle());
    const reihenfolge = [];
    spion('sendToMultipleUsers').mockImplementation(async () => {
      reihenfolge.push('push');
      return [];
    });

    const wrapper = zaehlDb();
    const echt = wrapper.query;
    wrapper.query = (text, params) => {
      if (/INSERT INTO event_reminders/.test(String(text))) reihenfolge.push('insert');
      return echt(text, params);
    };
    await BackgroundService.sendEventReminders(wrapper);

    expect(anzahlMit('INSERT INTO event_reminders')).toBe(1);
    expect(reihenfolge).toEqual(['insert', 'push']);
    expect(await erinnerte(eventId, '1_day')).toEqual(alle().sort((a, b) => a - b));
  });

  it('S3: der ganze Lauf kostet weniger als 100 Abfragen (vorher 1.802) -- und jedes Geraet bekommt genau einen Push', async () => {
    const eventId = await terminMitZusagen(alle());

    await BackgroundService.sendEventReminders(zaehlDb());

    expect(zaehler).toBeLessThan(100);
    // Genau ein FCM-Aufruf je Geraet, keiner doppelt.
    const tokens = sendFirebasePushNotification.mock.calls.map(([t]) => t);
    expect(tokens).toHaveLength(EMPFAENGER);
    expect(new Set(tokens).size).toBe(EMPFAENGER);
    // Text und Daten wie beim Einzelversand.
    const [, payload] = sendFirebasePushNotification.mock.calls[0];
    expect(payload.title).toBe('Morgen: Event!');
    expect(payload.body).toMatch(/^Morgen: Gottesdienst um \d{2}:\d{2} Uhr$/);
    expect(payload.data.type).toBe('event_reminder');
    expect(payload.data.reminder_type).toBe('1_day');
    expect(payload.data.event_id).toBe(String(eventId));
    expect(payload.data.organization_id).toBe(String(ORG_ID));
    // Und je Person genau eine Zeile.
    expect(await erinnerte(eventId, '1_day')).toHaveLength(EMPFAENGER);
  });

  it('S4: zwei Termine im Fenster -> zwei Push-Aufrufe, jeder mit den Zusagen seines Termins', async () => {
    const a = await terminMitZusagen([USERS.konfi1.id, USERS.konfi2.id]);
    const b = await terminMitZusagen(extraIds.slice(0, 3), { eventDateSql: "NOW() + INTERVAL '60 minutes'" });
    const push = spion('sendEventReminderToKonfi');

    await BackgroundService.sendEventReminders(db);

    expect(push).toHaveBeenCalledTimes(2);
    const jeTermin = new Map(push.mock.calls.map((c) => [c[7], { ids: [...c[1]].sort((x, y) => x - y), typ: c[5] }]));
    expect(jeTermin.get(a)).toEqual({ ids: [USERS.konfi1.id, USERS.konfi2.id], typ: '1_day' });
    expect(jeTermin.get(b)).toEqual({ ids: extraIds.slice(0, 3).sort((x, y) => x - y), typ: '1_hour' });
  });

  it('S5: wer schon eine Zeile hat, bekommt keinen Push -- die anderen desselben Termins schon', async () => {
    const eventId = await terminMitZusagen([USERS.konfi1.id, USERS.konfi2.id, extraIds[0]]);
    await db.query(
      "INSERT INTO event_reminders (event_id, user_id, reminder_type, sent_at) VALUES ($1, $2, '1_day', NOW())",
      [eventId, USERS.konfi1.id]
    );
    const push = spion('sendEventReminderToKonfi');

    await BackgroundService.sendEventReminders(db);

    expect(push).toHaveBeenCalledTimes(1);
    expect([...push.mock.calls[0][1]].sort((x, y) => x - y)).toEqual([USERS.konfi2.id, extraIds[0]]);
    expect(await erinnerte(eventId, '1_day')).toEqual([USERS.konfi1.id, USERS.konfi2.id, extraIds[0]]);
  });

  it('S6: sendEventReminderToKonfi mit EINER Person sendet weiter ueber den Einzelweg', async () => {
    // Der Einzelweg bleibt fuer Aufrufer, die eine Person meinen (und fuer
    // postfachSchreiben.test.js). Eine Liste geht ueber sendToMultipleUsers.
    const einzeln = spion('sendToUser');
    const sammel = spion('sendToMultipleUsers');

    await PushService.sendEventReminderToKonfi(db, USERS.konfi1.id, 'Gottesdienst', new Date(), '10:00', '1_day', ORG_ID, 5);
    expect(einzeln).toHaveBeenCalledTimes(1);
    expect(sammel).not.toHaveBeenCalled();

    await PushService.sendEventReminderToKonfi(db, [USERS.konfi1.id, USERS.konfi2.id], 'Gottesdienst', new Date(), '10:00', '1_day', ORG_ID, 5);
    expect(sammel).toHaveBeenCalledTimes(1);
    expect(sammel.mock.calls[0][1]).toEqual([USERS.konfi1.id, USERS.konfi2.id]);
    // Der Sammelweg liefert je Empfaenger ein Ergebnis in derselben Form.
    expect(sendFirebasePushNotification).toHaveBeenCalledTimes(3);
  });
});
