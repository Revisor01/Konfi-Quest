// backend/tests/services/registrationOpenDrosselung.test.js
//
// Audit 26.09.2026, Betrieb BF-15: sendRegistrationOpenPushes flippte in
// EINEM Minutenlauf alle faelligen Termine und schickte fuer jeden den
// "Anmeldung moeglich"-Push an alle Konfis der Gemeinde. Stauen sich
// faellige Termine (Import, langer Ausfall des Cron-Leaders, Migration mit
// false-Vorgabe), geht alles auf einmal hinaus: gemessen im Audit mit 5.000
// Terminen 34,1 s, 50.365 Abfragen, 137.910 Log-Zeilen in einem Lauf.
//
// Jetzt: hoechstens REGISTRIERUNG_MAX_JE_LAUF Termine je Minutenlauf, die
// aeltesten zuerst (registration_opens_at, NULL als "schon immer offen"
// vorn). Der Rest kommt in den naechsten Minuten dran. Im Regelbetrieb --
// ein, zwei Termine je Lauf -- aendert sich nichts; die bestehenden Tests
// 14-16 in eventReminders.test.js laufen unveraendert.
//
// Gegenprobe (dokumentiert): Ohne LIMIT faellt R1 mit "expected 50 to be 20".
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, ORGS } = require('../helpers/seed');

const firebase = require('../../push/firebase');
vi.spyOn(firebase, 'sendFirebasePushNotification').mockResolvedValue({ success: true });
vi.spyOn(firebase, 'sendFirebaseSilentPush').mockResolvedValue({ success: true });

const BackgroundService = require('../../services/backgroundService');
const PushService = require('../../services/pushService');

const ORG_ID = ORGS.testGemeinde.id;
let nextEventId = 9001;

describe('"Anmeldung möglich"-Push: Rückstand gedrosselt abarbeiten', () => {
  let db;
  let push;

  beforeAll(() => {
    db = getTestPool();
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    // Die Seed-Termine (1, 3, 4) sind ebenfalls anmeldbar und noch nicht
    // benachrichtigt -- hier als erledigt markieren, damit nur der
    // angelegte Rueckstand zaehlt.
    await db.query('UPDATE events SET registration_open_notified = true');
    push = vi.spyOn(PushService, 'sendNewEventToOrgKonfis').mockResolvedValue([]);
  });

  afterEach(() => {
    push.mockRestore();
  });

  afterAll(async () => {
    await closePool();
  });

  // `anzahl` anmeldbare Termine, deren Fenster schon offen ist. Der erste ist
  // am laengsten offen (opensAtStunden Stunden zurueck), der letzte am
  // kuerzesten; `ohneFenster` davon bekommen registration_opens_at = NULL.
  async function rueckstand(anzahl, { ohneFenster = 0 } = {}) {
    const ids = [];
    for (let i = 0; i < anzahl; i++) {
      const id = nextEventId++;
      ids.push(id);
      const opensAt = i < ohneFenster ? null : `NOW() - INTERVAL '${anzahl - i} hours'`;
      await db.query(
        `INSERT INTO events (id, name, event_date, organization_id, cancelled, mandatory, teamer_only,
                             has_timeslots, registration_open_notified, registration_opens_at)
         VALUES ($1, $2, CURRENT_DATE + INTERVAL '30 days', $3, false, false, false, false, false, ${opensAt ?? 'NULL'})`,
        [id, `Termin ${i}`, ORG_ID]
      );
    }
    return ids;
  }

  async function benachrichtigt() {
    const { rows } = await db.query(
      'SELECT id FROM events WHERE registration_open_notified = true AND id >= 9001 ORDER BY id'
    );
    return rows.map((r) => r.id);
  }

  it('R1: 50 faellige Termine -> ein Lauf nimmt hoechstens REGISTRIERUNG_MAX_JE_LAUF (vorher alle 50)', async () => {
    const ids = await rueckstand(50);
    const grenze = BackgroundService.REGISTRIERUNG_MAX_JE_LAUF;
    expect(grenze).toBe(20);

    await BackgroundService.sendRegistrationOpenPushes(db);

    expect(push).toHaveBeenCalledTimes(grenze);
    expect(await benachrichtigt()).toHaveLength(grenze);
    // Die am laengsten offenen zuerst -- also die ersten 20 der Reihe.
    expect(await benachrichtigt()).toEqual(ids.slice(0, grenze));
    expect(push.mock.calls.map((c) => c[4]).sort((a, b) => a - b)).toEqual(ids.slice(0, grenze));
  });

  it('R2: der Rest folgt in den naechsten Laeufen -- 20, 20, 10, dann nichts mehr', async () => {
    const ids = await rueckstand(50);

    const jeLauf = [];
    for (let i = 0; i < 4; i++) {
      push.mockClear();
      await BackgroundService.sendRegistrationOpenPushes(db);
      jeLauf.push(push.mock.calls.length);
    }

    expect(jeLauf).toEqual([20, 20, 10, 0]);
    expect(await benachrichtigt()).toEqual(ids);
  });

  it('R3: Termine ohne Fensterbeginn (NULL) gelten als am laengsten offen und kommen zuerst', async () => {
    const ids = await rueckstand(25, { ohneFenster: 3 });

    await BackgroundService.sendRegistrationOpenPushes(db);

    const dran = await benachrichtigt();
    expect(dran).toHaveLength(20);
    expect(dran.slice(0, 3)).toEqual(ids.slice(0, 3));
  });

  it('R4: Regelbetrieb -- ein faelliger Termin geht im ersten Lauf raus, die Grenze verzoegert nichts', async () => {
    const [id] = await rueckstand(1);

    await BackgroundService.sendRegistrationOpenPushes(db);

    expect(push).toHaveBeenCalledTimes(1);
    expect(push.mock.calls[0][1]).toBe(ORG_ID);
    expect(push.mock.calls[0][4]).toBe(id);
    expect(await benachrichtigt()).toEqual([id]);
  });

  it('R5: die Grenze ist eine Stellgroesse -- mit 5 nimmt ein Lauf genau 5', async () => {
    await rueckstand(12);
    const original = BackgroundService.REGISTRIERUNG_MAX_JE_LAUF;
    BackgroundService.REGISTRIERUNG_MAX_JE_LAUF = 5;
    try {
      await BackgroundService.sendRegistrationOpenPushes(db);
      expect(push).toHaveBeenCalledTimes(5);
      expect(await benachrichtigt()).toHaveLength(5);
    } finally {
      BackgroundService.REGISTRIERUNG_MAX_JE_LAUF = original;
    }
  });

  it('R6: ein Termin wird auch im Rueckstand nur EINMAL gepusht', async () => {
    const ids = await rueckstand(30);

    await BackgroundService.sendRegistrationOpenPushes(db);
    await BackgroundService.sendRegistrationOpenPushes(db);

    const gepusht = push.mock.calls.map((c) => c[4]);
    expect(gepusht).toHaveLength(30);
    expect(new Set(gepusht).size).toBe(30);
    expect([...gepusht].sort((a, b) => a - b)).toEqual(ids);
  });
});
