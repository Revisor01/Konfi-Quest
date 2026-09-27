// backend/tests/services/gesperrteGemeindeHintergrund.test.js
//
// Audit "Wer bekommt was" 27.09.2026, Befund BF-22: Eine gesperrte Gemeinde
// (organizations.is_active = false -- Testphase abgelaufen oder vom Betrieb
// gesperrt) bekam die Hintergrund-Mitteilungen weiter: Erinnerungen,
// "Neues Event!", Challenge-Start, "Events warten auf Verbuchung", stille
// Zaehler-Pushes, den Team-Rueckblick am 6.1., die Loeschwarnung. Anmelden
// kann sich dort niemand ("Organization is inactive", rbac.js; Login 403) --
// jede dieser Mitteilungen fuehrte ins Leere.
//
// Soll: Die Laeufe fassen gesperrte Gemeinden nicht an -- gefiltert in den
// Sammelabfragen, keine Abfrage je Person. Die aktive Gemeinde daneben
// bekommt alles wie bisher (erlaubter Fall in jedem Test).
//
// Org 2 ist in jedem Test gesperrt, Org 1 aktiv. Firebase und Mailversand
// sind gemockt; gezaehlt wird, an welche Tokens und Adressen etwas geht.
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, JAHRGAENGE } = require('../helpers/seed');

const firebase = require('../../push/firebase');
const sendPush = vi.spyOn(firebase, 'sendFirebasePushNotification').mockResolvedValue({ success: true });
const sendStill = vi.spyOn(firebase, 'sendFirebaseSilentPush').mockResolvedValue({ success: true });

const emailService = require('../../services/emailService');
const BackgroundService = require('../../services/backgroundService');
const badgesRoute = require('../../routes/badges');

const ORG1 = ORGS.testGemeinde.id;
const ORG2 = ORGS.andereGemeinde.id;
const tok = (u) => `token-${u.username}`;

const pushEmpfaenger = () => [...new Set(sendPush.mock.calls.map(([token]) => token))].sort();
const stillEmpfaenger = () => [...new Set(sendStill.mock.calls.map(([token]) => token))].sort();

describe('Gesperrte Gemeinde: keine Hintergrund-Mitteilungen (BF-22)', () => {
  let db;

  beforeAll(() => { db = getTestPool(); });
  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    for (const u of Object.values(USERS)) {
      await db.query(
        `INSERT INTO push_tokens (user_id, token, platform, device_id) VALUES ($1, $2, 'ios', $3)`,
        [u.id, tok(u), `geraet-${u.username}`]
      );
    }
    await db.query('UPDATE organizations SET is_active = false WHERE id = $1', [ORG2]);
    sendPush.mockClear();
    sendStill.mockClear();
  });
  afterAll(async () => { await closePool(); });

  const postfach = async (type) => {
    const { rows } = await db.query(
      'SELECT user_id FROM notifications WHERE type = $1 ORDER BY user_id', [type]
    );
    return rows.map((r) => Number(r.user_id));
  };

  // ------------------------------------------------------------------
  it('Erinnerungen 24 h und 1 h: nur an Gebuchte der aktiven Gemeinde; die gesperrte bleibt unvorgemerkt', async () => {
    const termin = async (orgId, userId, stunden) => {
      const { rows: [e] } = await db.query(
        `INSERT INTO events (name, event_date, organization_id, max_participants, point_type, points)
         VALUES ('Treffen', NOW() + ($1 || ' hours')::interval, $2, 10, 'gemeinde', 1) RETURNING id`,
        [String(stunden), orgId]
      );
      await db.query(
        `INSERT INTO event_bookings (user_id, event_id, status, organization_id) VALUES ($1, $2, 'confirmed', $3)`,
        [userId, e.id, orgId]
      );
      return e.id;
    };
    const t1Tag = await termin(ORG1, USERS.konfi1.id, 24);
    const t1Std = await termin(ORG1, USERS.konfi2.id, 1);
    const t2Tag = await termin(ORG2, USERS.konfi3.id, 24);
    const t2Std = await termin(ORG2, USERS.teamer2.id, 1);

    await BackgroundService.sendEventReminders(db);

    expect(pushEmpfaenger()).toEqual([tok(USERS.konfi1), tok(USERS.konfi2)].sort());
    const { rows } = await db.query('SELECT event_id FROM event_reminders ORDER BY event_id');
    expect(rows.map((r) => Number(r.event_id))).toEqual([t1Tag, t1Std].sort((a, b) => a - b));
    expect(rows.map((r) => Number(r.event_id))).not.toContain(t2Tag);
    expect(rows.map((r) => Number(r.event_id))).not.toContain(t2Std);
  });

  // ------------------------------------------------------------------
  it('"Neues Event!" zum Anmeldestart: nur in der aktiven Gemeinde; das Event der gesperrten bleibt offen fuer spaeter', async () => {
    await db.query('UPDATE events SET registration_open_notified = true');
    const offen = async (orgId, jahrgangId) => {
      const { rows: [e] } = await db.query(
        `INSERT INTO events (name, event_date, organization_id, max_participants, point_type, points,
                             registration_opens_at, registration_open_notified)
         VALUES ('Freizeit', NOW() + interval '14 days', $1, 20, 'gemeinde', 1, NOW() - interval '1 minute', false)
         RETURNING id`,
        [orgId]
      );
      await db.query('INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) VALUES ($1, $2)', [e.id, jahrgangId]);
      return e.id;
    };
    const e1 = await offen(ORG1, JAHRGAENGE.jahrgang1.id);
    const e2 = await offen(ORG2, JAHRGAENGE.jahrgang2.id);

    await BackgroundService.sendRegistrationOpenPushes(db);

    expect(pushEmpfaenger()).toEqual([tok(USERS.konfi1), tok(USERS.konfi2)].sort());
    const { rows } = await db.query(
      'SELECT id, registration_open_notified AS n FROM events WHERE id = ANY($1::int[]) ORDER BY id', [[e1, e2]]
    );
    expect(rows.map((r) => [Number(r.id), r.n])).toEqual([[e1, true], [e2, false]]);
  });

  // ------------------------------------------------------------------
  it('Challenge-Start: nur in der aktiven Gemeinde; die Challenge der gesperrten bleibt ungemeldet', async () => {
    const challenge = async (orgId, jahrgangId) => {
      const { rows: [c] } = await db.query(
        `INSERT INTO challenges (organization_id, title, description, badge_name, starts_at, ends_at, is_draft, start_push_sent)
         VALUES ($1, 'Fotorallye', 'd', 'A', NOW() - interval '1 minute', NOW() + interval '7 days', false, false)
         RETURNING id`,
        [orgId]
      );
      await db.query('INSERT INTO challenge_jahrgang_assignments (challenge_id, jahrgang_id) VALUES ($1, $2)', [c.id, jahrgangId]);
      return c.id;
    };
    const c1 = await challenge(ORG1, JAHRGAENGE.jahrgang1.id);
    const c2 = await challenge(ORG2, JAHRGAENGE.jahrgang2.id);

    await BackgroundService.sendChallengeStartPushes(db);

    expect(pushEmpfaenger()).not.toContain(tok(USERS.konfi3));
    expect(pushEmpfaenger()).toContain(tok(USERS.konfi1));
    expect(pushEmpfaenger()).toContain(tok(USERS.konfi2));
    const { rows } = await db.query(
      'SELECT id, start_push_sent AS s FROM challenges WHERE id = ANY($1::int[]) ORDER BY id', [[c1, c2]]
    );
    expect(rows.map((r) => [Number(r.id), r.s])).toEqual([[c1, true], [c2, false]]);
  });

  // ------------------------------------------------------------------
  it('"Events warten auf Verbuchung": die Leitung der gesperrten Gemeinde bekommt nichts, die der aktiven wie bisher', async () => {
    const vorbei = async (orgId, userId) => {
      const { rows: [e] } = await db.query(
        `INSERT INTO events (name, event_date, organization_id, max_participants, point_type, points)
         VALUES ('Gottesdienst', NOW() - interval '2 days', $1, 10, 'gottesdienst', 1) RETURNING id`,
        [orgId]
      );
      await db.query(
        `INSERT INTO event_bookings (user_id, event_id, status, organization_id) VALUES ($1, $2, 'confirmed', $3)`,
        [userId, e.id, orgId]
      );
    };
    await vorbei(ORG1, USERS.konfi1.id);
    await vorbei(ORG2, USERS.konfi3.id);

    await BackgroundService.checkPendingEvents(db);

    const empfaenger = await postfach('events_pending_approval');
    expect(empfaenger).not.toContain(USERS.admin2.id);
    expect(empfaenger).not.toContain(USERS.orgAdmin2.id);
    expect(empfaenger).toContain(USERS.orgAdmin1.id);
    expect(pushEmpfaenger()).not.toContain(tok(USERS.admin2));
    expect(pushEmpfaenger()).not.toContain(tok(USERS.orgAdmin2));
    expect(pushEmpfaenger()).toContain(tok(USERS.orgAdmin1));
  });

  // ------------------------------------------------------------------
  describe('Zaehler- und Abzeichen-Lauf', () => {
    let pruefung;
    beforeEach(() => {
      BackgroundService.letzterZaehler.clear();
      BackgroundService.letzterAbzeichenAbdruck.clear();
      BackgroundService.abzeichenZeiger = 0;
      // Nicht der erste Lauf nach dem Start: der Merker gilt als gefuellt,
      // abweichende Staende werden gesendet.
      BackgroundService.zaehlerMerkerGefuellt = true;
      pruefung = vi.spyOn(badgesRoute, 'checkAndAwardBadges');
    });
    afterEach(() => {
      pruefung.mockRestore();
      BackgroundService.zaehlerMerkerGefuellt = false;
      BackgroundService.letzterZaehler.clear();
      BackgroundService.letzterAbzeichenAbdruck.clear();
    });

    it('stille Pushes und Abzeichen-Pruefung nur fuer Konten der aktiven Gemeinde', async () => {
      await BackgroundService.updateAllUserBadges(db);

      // Org 1: alle mit Token ausser dem Super-Admin (Rolle super_admin
      // laeuft nie mit). Org 2: niemand.
      expect(stillEmpfaenger()).toEqual([
        USERS.konfi1, USERS.konfi2, USERS.teamer1, USERS.admin1, USERS.orgAdmin1, USERS.orgAdminSuper
      ].map(tok).sort());
      const geprueft = pruefung.mock.calls.map(([, userId]) => Number(userId)).sort((a, b) => a - b);
      expect(geprueft).toEqual([USERS.konfi1.id, USERS.konfi2.id, USERS.teamer1.id]);
    });
  });

  // ------------------------------------------------------------------
  it('Team-Rueckblick am 6. Januar: nur fuer aktive Gemeinden', async () => {
    const generate = vi.fn().mockResolvedValue({ uebersprungen: false });
    BackgroundService.wrappedRouter = { generateAllTeamerWrapped: generate };
    try {
      await BackgroundService.checkWrappedTriggers(db);
    } finally {
      BackgroundService.wrappedRouter = null;
    }
    expect(generate.mock.calls.map(([, orgId]) => Number(orgId))).toEqual([ORG1]);
  });

  // ------------------------------------------------------------------
  it('Loeschwarnung 7 Tage vorher: weder Push, Postfach noch Mail an die gesperrte Gemeinde; der Merker bleibt offen', async () => {
    const mails = vi.spyOn(emailService, 'sendJahrgangDeletionWarningEmail').mockResolvedValue(true);
    try {
      await db.query("UPDATE users SET email = username || '@beispiel.invalid' WHERE id = ANY($1::int[])",
        [[USERS.orgAdmin1.id, USERS.orgAdmin2.id]]);
      let naechste = 9701;
      for (const [jahrgangId, orgId] of [[JAHRGAENGE.jahrgang1.id, ORG1], [JAHRGAENGE.jahrgang2.id, ORG2]]) {
        const id = naechste++;
        await db.query(
          `INSERT INTO events (id, name, event_date, organization_id, is_konfirmation, cancelled, mandatory, has_timeslots)
           VALUES ($1, 'Konfirmation', CURRENT_DATE - interval '53 days', $2, true, false, false, false)`,
          [id, orgId]
        );
        await db.query('INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) VALUES ($1, $2)', [id, jahrgangId]);
      }

      await BackgroundService.runJahrgangDeletionReminders(db);

      expect(mails.mock.calls.map(([adresse]) => adresse)).toEqual(['orgadmin1@beispiel.invalid']);
      const empfaenger = await postfach('jahrgang_deletion_warning');
      expect(empfaenger).toContain(USERS.orgAdmin1.id);
      expect(empfaenger).not.toContain(USERS.admin2.id);
      expect(empfaenger).not.toContain(USERS.orgAdmin2.id);
      const { rows } = await db.query(
        'SELECT id, deletion_reminder_sent_at IS NOT NULL AS gesendet FROM jahrgaenge ORDER BY id'
      );
      expect(rows.map((r) => [Number(r.id), r.gesendet])).toEqual([[JAHRGAENGE.jahrgang1.id, true], [JAHRGAENGE.jahrgang2.id, false]]);
    } finally {
      mails.mockRestore();
    }
  });

  // ------------------------------------------------------------------
  it('Auto-Loeschung: geloescht wird weiter (Aufbewahrungsfrist), aber die Nachrueck-Meldung geht nur in der aktiven Gemeinde', async () => {
    // Je Gemeinde: ein zweiter Jahrgang mit einer Konfi auf der Warteliste
    // eines Events, dessen einzigen Platz eine Konfi des geloeschten
    // Jahrgangs belegt.
    let nr = 0;
    const aufbauen = async (orgId, loeschJahrgang, belegtVon, konfiRolle) => {
      nr++;
      const { rows: [jg] } = await db.query(
        `INSERT INTO jahrgaenge (name, organization_id, confirmation_date) VALUES ($1, $2, '2027-05-01') RETURNING id`,
        [`Neu ${nr}`, orgId]
      );
      const { rows: [wartende] } = await db.query(
        `INSERT INTO users (username, password_hash, display_name, role_id, organization_id, is_active)
         VALUES ($1, 'x', $2, $3, $4, true) RETURNING id`,
        [`wartend${nr}`, `Wartende ${nr}`, konfiRolle, orgId]
      );
      await db.query(
        `INSERT INTO konfi_profiles (user_id, jahrgang_id, gottesdienst_points, gemeinde_points, organization_id)
         VALUES ($1, $2, 0, 0, $3)`,
        [wartende.id, jg.id, orgId]
      );
      await db.query(
        `INSERT INTO push_tokens (user_id, token, platform, device_id) VALUES ($1, $2, 'ios', $3)`,
        [wartende.id, `token-wartend${nr}`, `geraet-wartend${nr}`]
      );
      const { rows: [e] } = await db.query(
        `INSERT INTO events (name, event_date, organization_id, max_participants, point_type, points)
         VALUES ('Ausflug', NOW() + interval '10 days', $1, 1, 'gemeinde', 1) RETURNING id`,
        [orgId]
      );
      await db.query(
        `INSERT INTO event_bookings (user_id, event_id, status, organization_id, booking_date)
         VALUES ($1, $3, 'confirmed', $4, NOW() - interval '2 days'),
                ($2, $3, 'waitlist', $4, NOW() - interval '1 day')`,
        [belegtVon, wartende.id, e.id, orgId]
      );
      await db.query(
        `INSERT INTO events (id, name, event_date, organization_id, is_konfirmation, cancelled, mandatory, has_timeslots)
         VALUES ($1, 'Konfirmation', CURRENT_DATE - interval '120 days', $2, true, false, false, false)`,
        [9800 + nr, orgId]
      );
      await db.query('INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) VALUES ($1, $2)', [9800 + nr, loeschJahrgang]);
      return { wartende: wartende.id, token: `token-wartend${nr}`, eventId: e.id };
    };
    const aktiv = await aufbauen(ORG1, JAHRGAENGE.jahrgang1.id, USERS.konfi1.id, 1);
    const gesperrt = await aufbauen(ORG2, JAHRGAENGE.jahrgang2.id, USERS.konfi3.id, 6);

    await BackgroundService.runAutoDeletion(db);

    // Geloescht wird in beiden Gemeinden, nachgerueckt auch.
    const { rows: uebrig } = await db.query('SELECT id FROM users WHERE id = ANY($1::int[])', [[USERS.konfi1.id, USERS.konfi3.id]]);
    expect(uebrig).toEqual([]);
    const { rows: status } = await db.query(
      'SELECT user_id, status FROM event_bookings WHERE user_id = ANY($1::int[]) ORDER BY user_id',
      [[aktiv.wartende, gesperrt.wartende]]
    );
    expect(status.map((r) => r.status)).toEqual(['confirmed', 'confirmed']);
    // Gemeldet nur in der aktiven Gemeinde.
    expect(pushEmpfaenger()).toContain(aktiv.token);
    expect(pushEmpfaenger()).not.toContain(gesperrt.token);
    expect(await postfach('waitlist_promotion')).toEqual([aktiv.wartende]);
  });
});
