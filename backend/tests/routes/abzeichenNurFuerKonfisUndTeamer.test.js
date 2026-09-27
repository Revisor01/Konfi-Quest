// Abzeichen gibt es nur fuer Konfis und Teamer:innen -- in DER Gemeinde, in
// der die Person das ist.
//
// SIMONS BEFUND (27.09.2026): In Hennstedt, wo er Leitung ist, trug er sich
// beim Termin "Goode Stuuv" als anwesend ein -- und hatte danach zwoelf
// Konfi-Abzeichen. Nachgemessen in Produktion: vergeben in Kirchspiel West
// (seine Stamm-Gemeinde, dort ebenfalls Leitung), alle in derselben
// Millisekunde wie die Anwesenheit.
//
// Der Weg dahin, drei Fehler hintereinander:
//   1. checkAndAwardBadges las die Rolle am KONTO (users.role_id) statt der
//      Rolle in der Gemeinde des Termins. 'org_admin' ist nicht 'teamer' ->
//      der Konfi-Zweig lief.
//   2. Der Konfi-Zweig fragte nur, ob es ein Konfi-Profil gibt. Das gab es --
//      aus der Testgemeinde, in der Simon Konfi ist.
//   3. `SELECT kp.*, ..., u.organization_id` -- die zweite Spalte gleichen
//      Namens gewinnt. Das Profil aus der Testgemeinde wurde so gegen die
//      Abzeichen der Stamm-Gemeinde gewertet.
//
// Die Regel: Wer in der Gemeinde weder Konfi noch Teamer:in ist, bekommt dort
// nichts. Leitung (admin, org_admin) niemals.
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, JAHRGAENGE, ROLES, EVENTS } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const { checkAndAwardBadges } = require('../../routes/badges');

// Simons Konstellation: am Konto org_admin in Org 1, ueber
// user_organizations Konfi in Org 2, mit Konfi-Profil und Punkten dort.
const DOPPEL = 262;

// Je Gemeinde ein Konfi-Abzeichen, das schon mit einem Punkt faellig ist.
const ABZEICHEN_ORG1 = 901;
const ABZEICHEN_ORG2 = 902;
const TEAMER_ABZEICHEN_ORG1 = 903;

const abzeichenVon = async (db, userId) => {
  const { rows } = await db.query(
    'SELECT badge_id, organization_id FROM user_badges WHERE user_id = $1 ORDER BY badge_id',
    [userId]
  );
  return rows.map(r => ({ badge_id: Number(r.badge_id), organization_id: Number(r.organization_id) }));
};

describe('Abzeichen nur fuer Konfis und Teamer:innen der jeweiligen Gemeinde', () => {
  let app;
  let db;

  beforeAll(async () => {
    db = getTestPool();
    app = getTestApp(db);
  });

  afterAll(async () => {
    await closePool();
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);

    await db.query(
      `INSERT INTO users (id, username, password_hash, display_name, role_id, organization_id, is_active)
       VALUES ($1, 'doppel-leitung', 'x', 'Leitung mit Konfi-Profil', $2, 1, true)`,
      [DOPPEL, ROLES.orgAdmin.id]
    );
    await db.query(
      `INSERT INTO user_organizations (user_id, organization_id, role_id)
       VALUES ($1, 1, $2), ($1, 2, $3)`,
      [DOPPEL, ROLES.orgAdmin.id, ROLES.konfi2.id]
    );
    await db.query(
      `INSERT INTO konfi_profiles (user_id, organization_id, jahrgang_id, gottesdienst_points, gemeinde_points)
       VALUES ($1, 2, $2, 5, 15)`,
      [DOPPEL, JAHRGAENGE.jahrgang2.id]
    );

    await db.query(
      `INSERT INTO custom_badges (id, name, criteria_type, criteria_value, organization_id, icon, color, is_active, target_role)
       VALUES ($1, 'Erster Punkt Org 1', 'total_points', 1, 1, 'star', '#10b981', true, 'konfi'),
              ($2, 'Erster Punkt Org 2', 'total_points', 1, 2, 'star', '#10b981', true, 'konfi'),
              ($3, 'Erster Termin Team', 'event_count', 1, 1, 'people', '#3b82f6', true, 'teamer')`,
      [ABZEICHEN_ORG1, ABZEICHEN_ORG2, TEAMER_ABZEICHEN_ORG1]
    );
  });

  describe('der verbotene Fall: Leitung', () => {
    it('vergibt in der Gemeinde, in der die Person Leitung ist, nichts', async () => {
      const ergebnis = await checkAndAwardBadges(db, DOPPEL, { organizationId: 1 });

      expect(ergebnis.count).toBe(0);
      expect(await abzeichenVon(db, DOPPEL)).toEqual([]);
    });

    it('vergibt ohne Gemeindeangabe (Stamm-Gemeinde, dort Leitung) ebenfalls nichts', async () => {
      const ergebnis = await checkAndAwardBadges(db, DOPPEL);

      expect(ergebnis.count).toBe(0);
      expect(await abzeichenVon(db, DOPPEL)).toEqual([]);
    });

    it('als anwesend eingetragen bei einem Termin, wo die Person Leitung ist: kein Abzeichen', async () => {
      // Der Weg aus Simons Befund: Leitung traegt sich selbst als anwesend ein.
      const { rows: [buchung] } = await db.query(
        `INSERT INTO event_bookings (event_id, user_id, status, organization_id)
         VALUES ($1, $2, 'confirmed', 1) RETURNING id`,
        [EVENTS.gottesdienstEvent.id, DOPPEL]
      );

      const res = await request(app)
        .put(`/api/events/${EVENTS.gottesdienstEvent.id}/participants/${buchung.id}/attendance`)
        .set('Authorization', `Bearer ${generateToken('orgAdmin1')}`)
        .send({ attendance_status: 'present' });

      expect(res.status).toBe(200);
      const { rows: [nachher] } = await db.query(
        'SELECT attendance_status FROM event_bookings WHERE id = $1', [buchung.id]
      );
      expect(nachher.attendance_status).toBe('present');
      expect(await abzeichenVon(db, DOPPEL)).toEqual([]);
    });

    it('eine gewoehnliche Leitung ohne Konfi-Profil bekommt ebenfalls nichts', async () => {
      const ergebnis = await checkAndAwardBadges(db, USERS.orgAdmin1.id, { organizationId: 1 });

      expect(ergebnis.count).toBe(0);
      expect(await abzeichenVon(db, USERS.orgAdmin1.id)).toEqual([]);
    });
  });

  describe('der erlaubte Fall: Konfi und Teamer:in', () => {
    it('in der Gemeinde, in der die Person Konfi ist, gibt es deren Abzeichen -- nur deren', async () => {
      const ergebnis = await checkAndAwardBadges(db, DOPPEL, { organizationId: 2 });

      expect(ergebnis.count).toBe(1);
      expect(await abzeichenVon(db, DOPPEL)).toEqual([
        { badge_id: ABZEICHEN_ORG2, organization_id: 2 }
      ]);
    });

    it('eine gewoehnliche Konfi bekommt ihr Abzeichen wie bisher, auch ohne Gemeindeangabe', async () => {
      await db.query('UPDATE konfi_profiles SET gemeinde_points = 3 WHERE user_id = $1', [USERS.konfi1.id]);

      await checkAndAwardBadges(db, USERS.konfi1.id);

      const erhalten = await abzeichenVon(db, USERS.konfi1.id);
      expect(erhalten).toContainEqual({ badge_id: ABZEICHEN_ORG1, organization_id: 1 });
      expect(erhalten.map(e => e.badge_id)).not.toContain(ABZEICHEN_ORG2);
      expect(erhalten.map(e => e.badge_id)).not.toContain(TEAMER_ABZEICHEN_ORG1);
    });

    it('eine Teamer:in bekommt ihr Teamer-Abzeichen, kein Konfi-Abzeichen', async () => {
      await db.query(
        `INSERT INTO event_bookings (event_id, user_id, status, attendance_status, organization_id)
         VALUES ($1, $2, 'confirmed', 'present', 1)`,
        [EVENTS.gottesdienstEvent.id, USERS.teamer1.id]
      );

      const ergebnis = await checkAndAwardBadges(db, USERS.teamer1.id, { organizationId: 1 });

      expect(ergebnis.count).toBe(1);
      expect(await abzeichenVon(db, USERS.teamer1.id)).toEqual([
        { badge_id: TEAMER_ABZEICHEN_ORG1, organization_id: 1 }
      ]);
    });
  });

  // "Teamer-Jahr" zaehlte bei der Vergabe Teamer-Aktivitaeten aus ALLEN
  // Gemeinden, die Fortschrittsanzeige nur die der eigenen (Befund 27.09.2026,
  // am Code geprueft; in Produktion damals noch niemand betroffen).
  describe('Teamer-Jahr zaehlt nur die eigene Gemeinde', () => {
    const TEAMER_JAHR_ORG1 = 904;
    const TEAMER_AKT_ORG1 = 911;
    const TEAMER_AKT_ORG2 = 912;
    const diesesJahr = new Date().getFullYear();

    beforeEach(async () => {
      await db.query(
        `INSERT INTO activities (id, name, points, type, organization_id, target_role)
         VALUES ($1, 'Team-Aktion 1', 0, 'gemeinde', 1, 'teamer'),
                ($2, 'Team-Aktion 2', 0, 'gemeinde', 2, 'teamer')`,
        [TEAMER_AKT_ORG1, TEAMER_AKT_ORG2]
      );
      await db.query(
        `INSERT INTO custom_badges (id, name, criteria_type, criteria_value, organization_id, icon, color, is_active, target_role)
         VALUES ($1, 'Zwei Jahre im Team', 'teamer_year', 2, 1, 'ribbon', '#3b82f6', true, 'teamer')`,
        [TEAMER_JAHR_ORG1]
      );
      // Kein teamer_since: Das Startjahr kommt aus der aeltesten Aktivitaet.
      await db.query('UPDATE users SET teamer_since = NULL WHERE id = $1', [USERS.teamer1.id]);
      await db.query(
        `INSERT INTO user_activities (user_id, activity_id, completed_date, admin_id, organization_id)
         VALUES ($1, $2, make_date($3, 3, 1), $4, 1)`,
        [USERS.teamer1.id, TEAMER_AKT_ORG1, diesesJahr, USERS.admin1.id]
      );
    });

    const hatTeamerJahr = async () =>
      (await abzeichenVon(db, USERS.teamer1.id)).some(a => a.badge_id === TEAMER_JAHR_ORG1);

    it('ein Jahr in einer anderen Gemeinde zaehlt nicht mit', async () => {
      await db.query(
        `INSERT INTO user_activities (user_id, activity_id, completed_date, admin_id, organization_id)
         VALUES ($1, $2, make_date($3, 3, 1), $4, 2)`,
        [USERS.teamer1.id, TEAMER_AKT_ORG2, diesesJahr - 1, USERS.admin2.id]
      );

      await checkAndAwardBadges(db, USERS.teamer1.id, { organizationId: 1 });

      expect(await hatTeamerJahr()).toBe(false);
    });

    it('zwei Jahre in der eigenen Gemeinde ergeben das Badge', async () => {
      await db.query(
        `INSERT INTO user_activities (user_id, activity_id, completed_date, admin_id, organization_id)
         VALUES ($1, $2, make_date($3, 3, 1), $4, 1)`,
        [USERS.teamer1.id, TEAMER_AKT_ORG1, diesesJahr - 1, USERS.admin1.id]
      );

      await checkAndAwardBadges(db, USERS.teamer1.id, { organizationId: 1 });

      expect(await hatTeamerJahr()).toBe(true);
    });
  });

  // Nachtraegliches Pruefen waehlte die Personen nach der Rolle am KONTO aus
  // (users.role_id). Wer nur in einer Zweitgemeinde Konfi ist, wurde dort nie
  // nachgeprueft (Befund 27.09.2026, am Code geprueft).
  describe('Nachpruefen waehlt nach der Rolle in DIESER Gemeinde', () => {
    const pruefe = (badgeId, tokenName) => request(app)
      .post(`/api/admin/badges/${badgeId}/pruefen`)
      .set('Authorization', `Bearer ${generateToken(tokenName)}`);

    it('erreicht die Konfi der Zweitgemeinde, deren Konto eine andere Rolle traegt', async () => {
      const res = await pruefe(ABZEICHEN_ORG2, 'orgAdmin2');

      expect(res.status).toBe(200);
      expect(res.body.neu_vergeben).toBe(1);
      expect(await abzeichenVon(db, DOPPEL)).toEqual([
        { badge_id: ABZEICHEN_ORG2, organization_id: 2 }
      ]);
    });

    it('laesst dieselbe Person in der Gemeinde, in der sie Leitung ist, aussen vor', async () => {
      const res = await pruefe(ABZEICHEN_ORG1, 'orgAdmin1');

      expect(res.status).toBe(200);
      expect(await abzeichenVon(db, DOPPEL)).toEqual([]);
    });
  });
});
