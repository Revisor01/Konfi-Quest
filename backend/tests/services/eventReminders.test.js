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
  // `attendanceStatus` spiegelt eine bereits verbuchte Teilnahme
  // (present/absent/excused); NULL = noch offen, der Normalfall vor dem Termin.
  async function createEventWithBooking({
    eventDateSql,
    cancelled,
    userId = USERS.konfi1.id,
    attendanceStatus = null
  }) {
    const eventId = nextEventId++;
    await db.query(
      `INSERT INTO events (id, name, event_date, organization_id, cancelled, mandatory, has_timeslots)
       VALUES ($1, 'Testtermin', ${eventDateSql}, $2, $3, false, false)`,
      [eventId, ORG_ID, cancelled]
    );
    await db.query(
      `INSERT INTO event_bookings (event_id, user_id, status, attendance_status, organization_id)
       VALUES ($1, $2, 'confirmed', $3, $4)`,
      [eventId, userId, attendanceStatus, ORG_ID]
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

  // Wer wurde tatsaechlich erinnert? Deckt den Fall auf, dass die Erinnerung
  // an die falsche Person geht — eine reine Anzahl wuerde das verschlucken.
  async function reminderEmpfaenger(eventId, reminderType) {
    const { rows } = await db.query(
      'SELECT user_id FROM event_reminders WHERE event_id = $1 AND reminder_type = $2 ORDER BY user_id',
      [eventId, reminderType]
    );
    return rows.map(r => r.user_id);
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

  // ------------------------------------------------------------------
  // Abgemeldet = keine Erinnerung (Befund 15.09.2026)
  //
  // Traegt die Leitung eine Abmeldung ein, setzt das eb.attendance_status
  // auf 'excused'; eb.status bleibt 'confirmed'. Ohne den Filter bekam die
  // abgemeldete Konfi nach "Abmeldung eingetragen" trotzdem "Morgen: Event!"
  // und "Gleich: Event!".
  // ------------------------------------------------------------------

  it('Test 8: Abgemeldete Person (excused) bekommt KEINE 1-Tages-Erinnerung', async () => {
    const eventId = await createEventWithBooking({
      eventDateSql: "CURRENT_DATE + INTERVAL '1 day' + INTERVAL '10 hours'",
      cancelled: false,
      attendanceStatus: 'excused'
    });

    await BackgroundService.sendEventReminders(db);

    expect(await countReminders(eventId, '1_day')).toBe(0);
    expect(await reminderEmpfaenger(eventId, '1_day')).toEqual([]);
  });

  it('Test 9: Abgemeldete Person (excused) bekommt KEINE 1-Stunden-Erinnerung', async () => {
    const eventId = await createEventWithBooking({
      eventDateSql: "NOW() + INTERVAL '60 minutes'",
      cancelled: false,
      attendanceStatus: 'excused'
    });

    await BackgroundService.sendEventReminders(db);

    expect(await countReminders(eventId, '1_hour')).toBe(0);
    expect(await reminderEmpfaenger(eventId, '1_hour')).toEqual([]);
  });

  it('Test 10: Gegenprobe — attendance_status NULL bekommt beide Erinnerungen', async () => {
    // Beweist, dass der Filter nicht zu viel wegnimmt: derselbe Aufbau wie
    // Test 8/9, nur ohne Verbuchung.
    const morgen = await createEventWithBooking({
      eventDateSql: "CURRENT_DATE + INTERVAL '1 day' + INTERVAL '10 hours'",
      cancelled: false,
      attendanceStatus: null
    });
    const gleich = await createEventWithBooking({
      eventDateSql: "NOW() + INTERVAL '60 minutes'",
      cancelled: false,
      attendanceStatus: null
    });

    await BackgroundService.sendEventReminders(db);

    expect(await countReminders(morgen, '1_day')).toBe(1);
    expect(await reminderEmpfaenger(morgen, '1_day')).toEqual([USERS.konfi1.id]);
    expect(await countReminders(gleich, '1_hour')).toBe(1);
    expect(await reminderEmpfaenger(gleich, '1_hour')).toEqual([USERS.konfi1.id]);
  });

  it('Test 11: Verbuchte Teilnahme (present/absent) bekommt keine Erinnerung mehr', async () => {
    const present = await createEventWithBooking({
      eventDateSql: "CURRENT_DATE + INTERVAL '1 day' + INTERVAL '10 hours'",
      cancelled: false,
      attendanceStatus: 'present'
    });
    const absent = await createEventWithBooking({
      eventDateSql: "NOW() + INTERVAL '60 minutes'",
      cancelled: false,
      attendanceStatus: 'absent'
    });

    await BackgroundService.sendEventReminders(db);

    expect(await countReminders(present, '1_day')).toBe(0);
    expect(await countReminders(absent, '1_hour')).toBe(0);
  });

  it('Test 12: Am selben Termin wird nur die nicht abgemeldete Person erinnert', async () => {
    // Der scharfe Fall: EIN Termin, zwei Buchungen. Eine Anzahl allein wuerde
    // nicht zeigen, dass die richtige Person uebrig bleibt.
    const eventId = nextEventId++;
    await db.query(
      `INSERT INTO events (id, name, event_date, organization_id, cancelled, mandatory, has_timeslots)
       VALUES ($1, 'Gemischter Termin', CURRENT_DATE + INTERVAL '1 day' + INTERVAL '10 hours', $2, false, false, false)`,
      [eventId, ORG_ID]
    );
    await db.query(
      `INSERT INTO event_bookings (event_id, user_id, status, attendance_status, organization_id)
       VALUES ($1, $2, 'confirmed', 'excused', $3), ($1, $4, 'confirmed', NULL, $3)`,
      [eventId, USERS.konfi1.id, ORG_ID, USERS.konfi2.id]
    );

    await BackgroundService.sendEventReminders(db);

    expect(await countReminders(eventId, '1_day')).toBe(1);
    expect(await reminderEmpfaenger(eventId, '1_day')).toEqual([USERS.konfi2.id]);
  });

  it('Test 13: Abmeldung auch mit Buchungsstatus "excused" bekommt keine Erinnerung', async () => {
    // Das Abmelden setzt zusaetzlich zum attendance_status auch den
    // BUCHUNGSstatus auf 'excused'. Der Filter haengt bewusst am
    // attendance_status und muss deshalb in beiden Welten greifen — auch
    // wenn eb.status nicht mehr 'confirmed' ist.
    const eventId = nextEventId++;
    await db.query(
      `INSERT INTO events (id, name, event_date, organization_id, cancelled, mandatory, has_timeslots)
       VALUES ($1, 'Abgemeldet-Termin', CURRENT_DATE + INTERVAL '1 day' + INTERVAL '10 hours', $2, false, false, false)`,
      [eventId, ORG_ID]
    );
    await db.query(
      `INSERT INTO event_bookings (event_id, user_id, status, attendance_status, organization_id)
       VALUES ($1, $2, 'excused', 'excused', $3)`,
      [eventId, USERS.konfi1.id, ORG_ID]
    );

    await BackgroundService.sendEventReminders(db);

    expect(await countReminders(eventId, '1_day')).toBe(0);
    expect(await reminderEmpfaenger(eventId, '1_day')).toEqual([]);
  });

  describe('sendRegistrationOpenPushes ("Anmeldung moeglich")', () => {
    // Befund 15.09.2026: Die Query filterte `cancelled = false`, waehrend die
    // Nachbarzeilen teamer_only und mandatory ausdruecklich gegen NULL
    // absichern. Ein Termin mit cancelled = NULL fiel deshalb still heraus —
    // ohne Push und ohne Spur. Messpunkt ist registration_open_notified: Der
    // Service flippt das Flag genau fuer die Termine, fuer die er den Push
    // ausloest.
    async function createAnmeldbarenTermin(cancelledSql) {
      const eventId = nextEventId++;
      await db.query(
        `INSERT INTO events (id, name, event_date, organization_id, cancelled,
                             mandatory, teamer_only, has_timeslots, registration_open_notified)
         VALUES ($1, 'Anmeldbarer Termin', CURRENT_DATE + INTERVAL '10 days', $2, ${cancelledSql},
                 false, false, false, false)`,
        [eventId, ORG_ID]
      );
      return eventId;
    }

    async function wurdeBenachrichtigt(eventId) {
      const { rows } = await db.query(
        'SELECT registration_open_notified FROM events WHERE id = $1',
        [eventId]
      );
      return rows[0].registration_open_notified;
    }

    it('Test 14: cancelled = NULL (Altbestand) bekommt den "Anmeldung moeglich"-Push', async () => {
      const eventId = await createAnmeldbarenTermin('NULL');

      await BackgroundService.sendRegistrationOpenPushes(db);

      expect(await wurdeBenachrichtigt(eventId)).toBe(true);
    });

    it('Test 15: Gegenprobe — abgesagter Termin bekommt ihn nicht', async () => {
      const eventId = await createAnmeldbarenTermin('true');

      await BackgroundService.sendRegistrationOpenPushes(db);

      expect(await wurdeBenachrichtigt(eventId)).toBe(false);
    });

    it('Test 16: Gegenprobe — nicht abgesagter Termin bekommt ihn', async () => {
      const eventId = await createAnmeldbarenTermin('false');

      await BackgroundService.sendRegistrationOpenPushes(db);

      expect(await wurdeBenachrichtigt(eventId)).toBe(true);
    });
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
