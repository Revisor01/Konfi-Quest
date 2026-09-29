// SERIE IM FORTSCHRITT EHRLICH ZEIGEN (Entscheidung Simon, 29.09.2026)
//
// Der Befund (Audit Punkte/Termine, „Unklar", Serienfolge der Abzeichen):
// Die Serie zaehlt ab der letzten aktiven Woche rueckwaerts, nicht ab heute.
// Wer vor zehn Wochen drei Wochen am Stueck aktiv war und seitdem nichts,
// sah am offenen Serien-Abzeichen „3/4" -- als fehlte nur noch eine Woche.
// Kam er diese Woche wieder, zaehlte die Serie aber bei 1 neu.
//
// Simon: Die Wertung bleibt, der angezeigte Fortschritt zeigt 0, wenn die
// letzte aktive Woche aelter als die Vorwoche ist. Die Antwortform bleibt
// (progress.current / progress.percentage, die die Apps lesen); nur der Wert
// aendert sich.
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const { getKonfiBadgeProgress } = require('../../utils/konfiBadgeProgress');
const { getTeamerBadgeProgress } = require('../../utils/teamerBadgeProgress');

describe('Serien-Abzeichen: Fortschritt zeigt die laufende Serie', () => {
  let app, db;

  beforeAll(() => { db = getTestPool(); app = getTestApp(db); });
  afterAll(async () => { await closePool(); });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
  });

  // Kalendertag vor `tage` Tagen als 'YYYY-MM-DD' (Ortszeit), damit die Woche
  // im Test und in der Rechnung dieselbe ist.
  function vorTagen(tage) {
    const heute = new Date();
    const d = new Date(heute.getFullYear(), heute.getMonth(), heute.getDate() - tage);
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
  }

  async function serienAbzeichen(zielgruppe, wochen = 4) {
    const { rows: [b] } = await db.query(
      `INSERT INTO custom_badges (name, criteria_type, criteria_value, organization_id, target_role, is_active, icon, color)
       VALUES ('Dranbleiben', 'streak', $1, $2, $3, true, 'flame', '#000000') RETURNING id`,
      [wochen, ORGS.testGemeinde.id, zielgruppe]
    );
    return b.id;
  }

  async function aktivitaet(zielgruppe) {
    const { rows: [a] } = await db.query(
      `INSERT INTO activities (name, points, type, organization_id, target_role)
       VALUES ('Mitgemacht', 1, 'gemeinde', $1, $2) RETURNING id`,
      [ORGS.testGemeinde.id, zielgruppe]
    );
    return a.id;
  }

  // Ein Eintrag je Woche, `tage` Tage zurueck.
  async function eintraege(userId, activityId, tageListe) {
    for (const tage of tageListe) {
      await db.query(
        `INSERT INTO user_activities (user_id, activity_id, completed_date, admin_id, organization_id)
         VALUES ($1, $2, $3::date, $4, $5)`,
        [userId, activityId, vorTagen(tage), USERS.admin1.id, ORGS.testGemeinde.id]
      );
    }
  }

  const konfiFortschritt = async (badgeId) => {
    const { available } = await getKonfiBadgeProgress(db, USERS.konfi1.id, ORGS.testGemeinde.id);
    return available.find((b) => b.id === badgeId).progress;
  };

  const teamerFortschritt = async (badgeId) => {
    const { available } = await getTeamerBadgeProgress(db, USERS.teamer1.id, ORGS.testGemeinde.id);
    return available.find((b) => b.id === badgeId).progress;
  };

  describe('Konfi', () => {
    it('zeigt 0, wenn die Serie seit Wochen gerissen ist', async () => {
      const badgeId = await serienAbzeichen('konfi', 4);
      await eintraege(USERS.konfi1.id, await aktivitaet('konfi'), [70, 77, 84]);

      expect(await konfiFortschritt(badgeId)).toEqual({ current: 0, target: 4, percentage: 0 });
    });

    it('zeigt die Serie, wenn die letzte aktive Woche die Vorwoche ist', async () => {
      const badgeId = await serienAbzeichen('konfi', 4);
      await eintraege(USERS.konfi1.id, await aktivitaet('konfi'), [7, 14, 21]);

      expect(await konfiFortschritt(badgeId)).toEqual({ current: 3, target: 4, percentage: 75 });
    });

    it('zeigt die Serie, wenn in dieser Woche schon etwas eingetragen ist', async () => {
      const badgeId = await serienAbzeichen('konfi', 4);
      await eintraege(USERS.konfi1.id, await aktivitaet('konfi'), [0, 7, 14]);

      expect(await konfiFortschritt(badgeId)).toEqual({ current: 3, target: 4, percentage: 75 });
    });

    it('liefert denselben Wert über GET /konfi/badges (Form unverändert)', async () => {
      const badgeId = await serienAbzeichen('konfi', 4);
      await eintraege(USERS.konfi1.id, await aktivitaet('konfi'), [70, 77, 84]);

      const res = await request(app)
        .get('/api/konfi/badges')
        .set('Authorization', `Bearer ${generateToken('konfi1')}`);
      expect(res.status).toBe(200);
      const abzeichen = res.body.available.find((b) => b.id === badgeId);
      expect(abzeichen.progress).toEqual({ current: 0, target: 4, percentage: 0 });
    });

    it('die Wertung bleibt: eine erreichte, später gerissene Serie wird weiter vergeben', async () => {
      const badgeId = await serienAbzeichen('konfi', 3);
      await eintraege(USERS.konfi1.id, await aktivitaet('konfi'), [70, 77, 84]);
      // Der Fortschritt davor zeigt 0 ...
      expect(await konfiFortschritt(badgeId)).toEqual({ current: 0, target: 3, percentage: 0 });

      const { checkAndAwardBadges } = require('../../routes/badges');
      await checkAndAwardBadges(db, USERS.konfi1.id);

      // ... die Wertung zählt ab der letzten aktiven Woche und vergibt.
      const { rows } = await db.query(
        'SELECT 1 FROM user_badges WHERE user_id = $1 AND badge_id = $2',
        [USERS.konfi1.id, badgeId]
      );
      expect(rows.length).toBe(1);
    });
  });

  describe('Teamer:in', () => {
    it('zeigt 0, wenn die Serie seit Wochen gerissen ist', async () => {
      const badgeId = await serienAbzeichen('teamer', 4);
      await eintraege(USERS.teamer1.id, await aktivitaet('teamer'), [70, 77, 84]);

      expect(await teamerFortschritt(badgeId)).toEqual({ current: 0, target: 4, percentage: 0 });
    });

    it('zeigt die Serie, wenn die letzte aktive Woche die Vorwoche ist', async () => {
      const badgeId = await serienAbzeichen('teamer', 4);
      await eintraege(USERS.teamer1.id, await aktivitaet('teamer'), [7, 14, 21]);

      expect(await teamerFortschritt(badgeId)).toEqual({ current: 3, target: 4, percentage: 75 });
    });
  });
});
