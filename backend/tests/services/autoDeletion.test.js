// backend/tests/services/autoDeletion.test.js
// Tests fuer die Auto-Loeschung (D-13/14/15): runAutoDeletion prueft je Jahrgang
// ab dem Stichtag (is_konfirmation-Event) -> Tag 60 Soft-Loeschung, Tag 120
// kaskadierende Hard-Loeschung. Teamer-Ausnahme (D-10), Idempotenz und
// Fehler-Isolation (D-15) werden abgedeckt. Sicherer Default: Jahrgang ohne
// is_konfirmation-Event wird uebersprungen (keine Loeschung).
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ROLES, JAHRGAENGE } = require('../helpers/seed');
const BackgroundService = require('../../services/backgroundService');

const ORG_ID = 1;

// Event-IDs ausserhalb des Seed-Bereichs (Seed nutzt 1-4), um Kollisionen zu vermeiden.
let nextKonfirmationEventId = 9001;

describe('runAutoDeletion (Auto-Loeschung)', () => {
  let db;

  beforeAll(() => {
    db = getTestPool();
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
  });

  afterAll(async () => {
    await closePool();
  });

  // Legt fuer einen Jahrgang ein is_konfirmation-Event an, dessen event_date
  // `days` Tage in der Vergangenheit liegt, und ordnet es dem Jahrgang ueber
  // event_jahrgang_assignments zu. Das ist die Stichtag-Quelle der Auto-Loeschung
  // (analog dem Service-Pfad: MIN(event_date) der nicht-cancelled is_konfirmation-Events).
  async function setKonfirmationEventDaysAgo(jahrgangId, days) {
    // Org des Jahrgangs aus den Seed-Fixtures ableiten (jahrgang1=Org1, jahrgang2=Org2).
    const jg = Object.values(JAHRGAENGE).find((j) => j.id === jahrgangId);
    const orgId = jg ? jg.org_id : ORG_ID;
    const eventId = nextKonfirmationEventId++;
    await db.query(
      `INSERT INTO events (id, name, event_date, organization_id, is_konfirmation, cancelled, mandatory, has_timeslots)
       VALUES ($1, 'Konfirmation', CURRENT_DATE - ($3 || ' days')::interval, $2, true, false, false, false)`,
      [eventId, orgId, String(days)]
    );
    await db.query(
      `INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) VALUES ($1, $2)`,
      [eventId, jahrgangId]
    );
  }

  it('Test 1: Konfi mit Konfirmations-Event vor 60 Tagen wird soft-geloescht (deleted_at + archived_at gesetzt)', async () => {
    // jahrgang1 (Org 1) auf 60 Tage zurueck setzen -> Soft-Bucket
    await setKonfirmationEventDaysAgo(JAHRGAENGE.jahrgang1.id, 60);

    await BackgroundService.runAutoDeletion(db);

    const { rows } = await db.query(
      'SELECT deleted_at, archived_at FROM users WHERE id = $1',
      [USERS.konfi1.id]
    );
    expect(rows.length).toBe(1);
    expect(rows[0].deleted_at).not.toBeNull();
    expect(rows[0].archived_at).not.toBeNull();
  });

  it('Test 2: Konfi mit Konfirmations-Event vor 120 Tagen wird kaskadierend hart geloescht', async () => {
    await setKonfirmationEventDaysAgo(JAHRGAENGE.jahrgang1.id, 120);

    // Abhaengige Daten anlegen, um die Kaskade zu pruefen
    await db.query(
      `INSERT INTO user_badges (user_id, badge_id, organization_id) VALUES ($1, 1, $2)`,
      [USERS.konfi1.id, ORG_ID]
    );

    await BackgroundService.runAutoDeletion(db);

    const userRows = await db.query('SELECT id FROM users WHERE id = $1', [USERS.konfi1.id]);
    expect(userRows.rows.length).toBe(0);

    const profileRows = await db.query('SELECT 1 FROM konfi_profiles WHERE user_id = $1', [USERS.konfi1.id]);
    expect(profileRows.rows.length).toBe(0);

    const badgeRows = await db.query('SELECT 1 FROM user_badges WHERE user_id = $1', [USERS.konfi1.id]);
    expect(badgeRows.rows.length).toBe(0);
  });

  it('Test 3: Konfi mit Konfirmations-Event vor 30 Tagen bleibt unveraendert (Rettungsfenster, D-07)', async () => {
    await setKonfirmationEventDaysAgo(JAHRGAENGE.jahrgang1.id, 30);

    await BackgroundService.runAutoDeletion(db);

    const { rows } = await db.query(
      'SELECT id, deleted_at, archived_at FROM users WHERE id = $1',
      [USERS.konfi1.id]
    );
    expect(rows.length).toBe(1);
    expect(rows[0].deleted_at).toBeNull();
    expect(rows[0].archived_at).toBeNull();
  });

  it('Test 4: Zu Teamer promotete Person im 120-Tage-Jahrgang wird NICHT geloescht (D-10)', async () => {
    // konfi2 zum Teamer promoten: role_id auf teamer-Rolle wechseln, teamer_since setzen.
    await db.query(
      `UPDATE users SET role_id = $1, teamer_since = CURRENT_DATE WHERE id = $2`,
      [ROLES.teamer.id, USERS.konfi2.id]
    );
    await setKonfirmationEventDaysAgo(JAHRGAENGE.jahrgang1.id, 120);

    await BackgroundService.runAutoDeletion(db);

    // Promoteter Teamer existiert noch und ist nicht archiviert
    const { rows } = await db.query(
      'SELECT id, deleted_at, archived_at FROM users WHERE id = $1',
      [USERS.konfi2.id]
    );
    expect(rows.length).toBe(1);
    expect(rows[0].deleted_at).toBeNull();
    expect(rows[0].archived_at).toBeNull();
  });

  it('Test 5: Idempotenz - zweiter Lauf am selben Tag aendert nichts', async () => {
    // 60 Tage -> Soft. Zweiter Lauf darf deleted_at NICHT erneut setzen / keinen Fehler werfen.
    await setKonfirmationEventDaysAgo(JAHRGAENGE.jahrgang1.id, 60);

    await BackgroundService.runAutoDeletion(db);
    const firstRun = await db.query('SELECT deleted_at FROM users WHERE id = $1', [USERS.konfi1.id]);
    expect(firstRun.rows[0].deleted_at).not.toBeNull();
    const erstesDeletedAt = firstRun.rows[0].deleted_at;

    // Zweiter Lauf (kein Fehler, kein erneutes Setzen)
    await BackgroundService.runAutoDeletion(db);
    const secondRun = await db.query('SELECT deleted_at FROM users WHERE id = $1', [USERS.konfi1.id]);
    expect(secondRun.rows[0].deleted_at).not.toBeNull();
    // deleted_at bleibt unveraendert (idempotent: nur WHERE deleted_at IS NULL)
    expect(secondRun.rows[0].deleted_at.getTime()).toBe(erstesDeletedAt.getTime());

    // Hard-Bucket-Idempotenz: 120 Tage, zweiter Lauf findet die Zeile nicht mehr -> kein Fehler
    await setKonfirmationEventDaysAgo(JAHRGAENGE.jahrgang2.id, 120);
    await BackgroundService.runAutoDeletion(db);
    await expect(BackgroundService.runAutoDeletion(db)).resolves.not.toThrow();
    const konfi3Rows = await db.query('SELECT id FROM users WHERE id = $1', [USERS.konfi3.id]);
    expect(konfi3Rows.rows.length).toBe(0);
  });

  it('Test 6: Fehler bei einem Jahrgang bricht den Job nicht ab, andere werden weiter verarbeitet (D-15)', async () => {
    // jahrgang1 (Org 1): 60 Tage -> Soft erwartet.
    // jahrgang2 (Org 2): 120 Tage -> Hard erwartet.
    await setKonfirmationEventDaysAgo(JAHRGAENGE.jahrgang1.id, 60);
    await setKonfirmationEventDaysAgo(JAHRGAENGE.jahrgang2.id, 120);

    // Simulierter Fehler: ein db-Wrapper, der beim ERSTEN getClient()-Aufruf
    // (Hard-Delete fuer jahrgang2) wirft, danach normal weiterarbeitet.
    let clientCalls = 0;
    const flakyDb = {
      query: (text, params) => db.query(text, params),
      getClient: async () => {
        clientCalls++;
        if (clientCalls === 1) {
          throw new Error('Simulierter DB-Fehler beim Hard-Delete');
        }
        return db.getClient();
      },
    };

    // Darf NICHT werfen (Fehler pro Jahrgang/Konfi isoliert)
    await expect(BackgroundService.runAutoDeletion(flakyDb)).resolves.not.toThrow();

    // Trotz Fehler beim Hard-Delete-Kandidaten wurde der Soft-Delete (jahrgang1) ausgefuehrt
    const softRows = await db.query(
      'SELECT deleted_at FROM users WHERE id = $1',
      [USERS.konfi1.id]
    );
    expect(softRows.rows[0].deleted_at).not.toBeNull();
  });

  it('Test 7: Jahrgang OHNE is_konfirmation-Event wird uebersprungen (sicherer Default, kein Datenverlust)', async () => {
    // Kein Konfirmations-Event fuer jahrgang1 -> kein Stichtag -> keine Aufbewahrungs-
    // frist -> KEINE Auto-Loeschung, egal wie alt die Daten sind.
    await BackgroundService.runAutoDeletion(db);

    const { rows } = await db.query(
      'SELECT id, deleted_at, archived_at FROM users WHERE id = $1',
      [USERS.konfi1.id]
    );
    expect(rows.length).toBe(1);
    expect(rows[0].deleted_at).toBeNull();
    expect(rows[0].archived_at).toBeNull();
  });
});
