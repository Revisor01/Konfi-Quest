// backend/tests/services/eventReminders.test.js
// Tests für die Event-Erinnerungen (sendEventReminders) und die Admin-Erinnerung
// an unverbuchte Termine (checkPendingEvents).
//
// Befund H1 (27.08.2026): Beide Reminder-Queries prüften `cancelled` nicht. Die
// Absage lässt die Buchungen auf 'confirmed' stehen, also feuerte nach der
// Nachricht "Leider abgesagt" am Vortag trotzdem "Morgen: Event!".
//
// Messpunkt ist die Tabelle event_reminders: Der Service schreibt dort pro
// tatsächlich verschickter Erinnerung genau eine Zeile. Ob der Push selbst beim
// Gerät ankommt, hängt an Device-Tokens, die es im Test nicht gibt — die Zeile
// in event_reminders beweist aber, dass der Service die Erinnerung ausgelöst hat.
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS } = require('../helpers/seed');
const BackgroundService = require('../../services/backgroundService');

const ORG_ID = 1;

// Event-IDs außerhalb des Seed-Bereichs (Seed nutzt 1-4), um Kollisionen zu vermeiden.
let nextEventId = 7001;

describe('sendEventReminders (Event-Erinnerungen)', () => {
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

  // Legt einen Termin zum übergebenen Zeitpunkt an und bucht konfi1 bestätigt darauf.
  // `cancelled` steuert, ob der Termin abgesagt ist.
  async function createEventWithBooking({ eventDateSql, cancelled, userId = USERS.konfi1.id }) {
    const eventId = nextEventId++;
    await db.query(
      `INSERT INTO events (id, name, event_date, organization_id, cancelled, mandatory, has_timeslots)
       VALUES ($1, 'Testtermin', ${eventDateSql}, $2, $3, false, false)`,
      [eventId, ORG_ID, cancelled]
    );
    await db.query(
      `INSERT INTO event_bookings (event_id, user_id, status, organization_id)
       VALUES ($1, $2, 'confirmed', $3)`,
      [eventId, userId, ORG_ID]
    );
    return eventId;
  }

  async function countReminders(eventId, reminderType) {
    const { rows } = await db.query(
      'SELECT COUNT(*)::int AS anzahl FROM event_reminders WHERE event_id = $1 AND reminder_type = $2',
      [eventId, reminderType]
    );
    return rows[0].anzahl;
  }

  it('Test 1: Abgesagter Termin morgen loest KEINE 1-Tages-Erinnerung aus', async () => {
    const eventId = await createEventWithBooking({
      eventDateSql: "CURRENT_DATE + INTERVAL '1 day' + INTERVAL '10 hours'",
      cancelled: true
    });

    await BackgroundService.sendEventReminders(db);

    expect(await countReminders(eventId, '1_day')).toBe(0);
  });

  it('Test 2: Gegenprobe — nicht abgesagter Termin morgen loest die 1-Tages-Erinnerung aus', async () => {
    const eventId = await createEventWithBooking({
      eventDateSql: "CURRENT_DATE + INTERVAL '1 day' + INTERVAL '10 hours'",
      cancelled: false
    });

    await BackgroundService.sendEventReminders(db);

    expect(await countReminders(eventId, '1_day')).toBe(1);
  });

  it('Test 3: Abgesagter Termin in einer Stunde loest KEINE 1-Stunden-Erinnerung aus', async () => {
    const eventId = await createEventWithBooking({
      eventDateSql: "NOW() + INTERVAL '60 minutes'",
      cancelled: true
    });

    await BackgroundService.sendEventReminders(db);

    expect(await countReminders(eventId, '1_hour')).toBe(0);
  });

  it('Test 4: Gegenprobe — nicht abgesagter Termin in einer Stunde loest die 1-Stunden-Erinnerung aus', async () => {
    const eventId = await createEventWithBooking({
      eventDateSql: "NOW() + INTERVAL '60 minutes'",
      cancelled: false
    });

    await BackgroundService.sendEventReminders(db);

    expect(await countReminders(eventId, '1_hour')).toBe(1);
  });

  it('Test 5: cancelled = NULL (Altbestand) zaehlt als nicht abgesagt und erinnert', async () => {
    // Die Spalte hat DEFAULT false, ältere Zeilen können aber NULL tragen.
    // `cancelled IS NOT TRUE` muss NULL wie "nicht abgesagt" behandeln —
    // ein simples `cancelled = false` würde diese Termine still verschlucken.
    const eventId = nextEventId++;
    await db.query(
      `INSERT INTO events (id, name, event_date, organization_id, cancelled, mandatory, has_timeslots)
       VALUES ($1, 'Altbestand-Termin', CURRENT_DATE + INTERVAL '1 day' + INTERVAL '10 hours', $2, NULL, false, false)`,
      [eventId, ORG_ID]
    );
    await db.query(
      `INSERT INTO event_bookings (event_id, user_id, status, organization_id)
       VALUES ($1, $2, 'confirmed', $3)`,
      [eventId, USERS.konfi1.id, ORG_ID]
    );

    await BackgroundService.sendEventReminders(db);

    expect(await countReminders(eventId, '1_day')).toBe(1);
  });

  describe('checkPendingEvents (Admin-Erinnerung an unverbuchte Termine)', () => {
    // Legt einen vergangenen Termin mit unverbuchter Buchung an. Genau so ein
    // Termin taucht in der Nachverbuchungs-Erinnerung an die Leitung auf.
    async function createPastUnbookedEvent(cancelled) {
      const eventId = nextEventId++;
      await db.query(
        `INSERT INTO events (id, name, event_date, organization_id, cancelled, mandatory, has_timeslots)
         VALUES ($1, 'Vergangener Termin', CURRENT_DATE - INTERVAL '2 days', $2, $3, false, false)`,
        [eventId, ORG_ID, cancelled]
      );
      await db.query(
        `INSERT INTO event_bookings (event_id, user_id, status, attendance_status, organization_id)
         VALUES ($1, $2, 'confirmed', NULL, $3)`,
        [eventId, USERS.konfi1.id, ORG_ID]
      );
      return eventId;
    }

    // Spiegelt die Zaehl-Query aus checkPendingEvents inklusive des cancelled-Filters.
    // So wird gemessen, was der Service der Leitung als "offen" meldet.
    async function countPendingForOrg() {
      const { rows } = await db.query(
        `SELECT COUNT(DISTINCT e.id)::int AS anzahl
         FROM events e
         JOIN event_bookings eb ON e.id = eb.event_id
         JOIN users u ON eb.user_id = u.id AND u.deleted_at IS NULL
         WHERE e.event_date < CURRENT_DATE
           AND e.cancelled IS NOT TRUE
           AND eb.status = 'confirmed'
           AND eb.attendance_status IS NULL
           AND e.organization_id = $1`,
        [ORG_ID]
      );
      return rows[0].anzahl;
    }

    it('Test 6: Abgesagter vergangener Termin zaehlt nicht als nachzuverbuchen', async () => {
      await createPastUnbookedEvent(true);

      // Der Service darf nicht werfen und darf diesen Termin nicht mitzaehlen.
      await BackgroundService.checkPendingEvents(db);

      expect(await countPendingForOrg()).toBe(0);
    });

    it('Test 7: Gegenprobe — nicht abgesagter vergangener Termin zaehlt als nachzuverbuchen', async () => {
      await createPastUnbookedEvent(false);

      await BackgroundService.checkPendingEvents(db);

      expect(await countPendingForOrg()).toBe(1);
    });
  });
});
