// Teamer-Badges und Zertifikate bleiben an der Gemeinde
//
// SIMON, 28.09.2026: "Umgang mit Teamer Badges ueber Gemeindegrenzen. Es
// bleibt immer an der Gemeinde!" Badges und Zertifikate einer Teamer:in
// gehoeren zu der Gemeinde, in der sie entstanden sind. In jeder Gemeinde
// sieht sie deren Badges mit Fortschritt und Verleihungen DORT. Nichts wandert
// ueber die Grenze -- nicht die Anzeige, nicht die Zaehlung (Aktivitaeten,
// Events), nicht die Vergabe.
//
// Das Konto hier ist in Gemeinde 1 (Stamm) und 2 (user_organizations) im
// Team. Je Gemeinde gibt es ein Teamer-Badge, das mit der ersten
// Teamer-Aktivitaet DORT faellig ist.
//
// Die Befunde, die hier zu waren (Audit Punkte/Termine, Tabelle "Rolle je
// Gemeinde"):
//  - GET /teamer/:userId/badges und POST /teamer/:userId/certificates lasen
//    Rolle und Gemeinde am Konto -- die Leitung der weiteren Gemeinde bekam
//    fuer ihre Teamer:in 404.
//  - Der Abzeichen-Lauf im Hintergrund pruefte nur die Stamm-Gemeinde, und
//    nur, wer dort Konfi oder Teamer:in ist.
// Die Routen der Teamer:in selbst und /notifications/badge-counts filterten
// schon nach der aktiven Gemeinde; die Tests halten das fest.

const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ROLES } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const { checkAndAwardBadges } = require('../../routes/badges');
const BackgroundService = require('../../services/backgroundService');

const TEAMER = USERS.teamer1.id; // Stamm Gemeinde 1, dazu Teamer:in in 2
const DIENST_ORG1 = 801;
const DIENST_ORG2 = 802;
const BADGE_ORG1 = 811;
const BADGE_ORG2 = 812;
const ZERT_ORG1 = 821;
const ZERT_ORG2 = 822;

describe('Teamer-Badges und Zertifikate je Gemeinde', () => {
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
    BackgroundService.letzterAbzeichenAbdruck.clear();
    BackgroundService.letzterZaehler.clear();
    BackgroundService.abzeichenZeiger = 0;

    await db.query(
      'INSERT INTO user_organizations (user_id, organization_id, role_id) VALUES ($1, 2, $2)',
      [TEAMER, ROLES.teamer2.id]
    );
    await db.query(
      `INSERT INTO activities (id, name, points, type, organization_id, target_role)
       VALUES ($1, 'Dienst Gemeinde 1', 0, 'gemeinde', 1, 'teamer'),
              ($2, 'Dienst Gemeinde 2', 0, 'gemeinde', 2, 'teamer')`,
      [DIENST_ORG1, DIENST_ORG2]
    );
    await db.query(
      `INSERT INTO custom_badges (id, name, criteria_type, criteria_value, organization_id, icon, color, is_active, target_role)
       VALUES ($1, 'Erster Dienst G1', 'activity_count', 1, 1, 'star', '#10b981', true, 'teamer'),
              ($2, 'Erster Dienst G2', 'activity_count', 1, 2, 'star', '#10b981', true, 'teamer')`,
      [BADGE_ORG1, BADGE_ORG2]
    );
    await db.query(
      `INSERT INTO certificate_types (id, name, icon, organization_id, is_active)
       VALUES ($1, 'Juleica G1', 'ribbon', 1, true), ($2, 'Juleica G2', 'ribbon', 2, true)`,
      [ZERT_ORG1, ZERT_ORG2]
    );
  });

  // Teamer-Aktivitaet in einer Gemeinde eintragen, wie die Leitung es tut.
  const dienst = (orgId) => db.query(
    `INSERT INTO user_activities (user_id, activity_id, completed_date, admin_id, organization_id, points)
     VALUES ($1, $2, CURRENT_DATE, $3, $4, 0)`,
    [TEAMER, orgId === 1 ? DIENST_ORG1 : DIENST_ORG2, orgId === 1 ? USERS.admin1.id : USERS.admin2.id, orgId]
  );

  const abzeichen = async (userId = TEAMER) => {
    const { rows } = await db.query(
      'SELECT badge_id, organization_id FROM user_badges WHERE user_id = $1 ORDER BY badge_id',
      [userId]
    );
    return rows.map(r => `${r.badge_id}@${r.organization_id}`);
  };

  const alsTeamer = (req, orgId) => req
    .set('Authorization', `Bearer ${generateToken('teamer1')}`)
    .set('X-Active-Organization', String(orgId));

  // ==================================================================
  // VERGABE
  // ==================================================================
  describe('Vergabe', () => {
    it('eine Aktivitaet in Gemeinde 1 zaehlt nicht in Gemeinde 2', async () => {
      await dienst(1);
      const ergebnis = await checkAndAwardBadges(db, TEAMER, { organizationId: 2 });

      expect(ergebnis.count).toBe(0);
      expect(await abzeichen()).toEqual([]);
    });

    it('eine Aktivitaet in Gemeinde 2 gibt nur das Badge von Gemeinde 2, gebucht auf Gemeinde 2', async () => {
      await dienst(2);
      await checkAndAwardBadges(db, TEAMER, { organizationId: 2 });
      await checkAndAwardBadges(db, TEAMER, { organizationId: 1 });

      expect(await abzeichen()).toEqual([`${BADGE_ORG2}@2`]);
    });

    it('der Hintergrund-Lauf prueft auch die weitere Gemeinde', async () => {
      await dienst(2);
      await BackgroundService.updateAllUserBadges(db);

      expect(await abzeichen()).toEqual([`${BADGE_ORG2}@2`]);
    });

    it('der Hintergrund-Lauf prueft jede Gemeinde fuer sich', async () => {
      await dienst(1);
      await dienst(2);
      await BackgroundService.updateAllUserBadges(db);

      expect(await abzeichen()).toEqual([`${BADGE_ORG1}@1`, `${BADGE_ORG2}@2`]);
    });

    it('der Hintergrund-Lauf prueft auch, wer zuhause Leitung und woanders Teamer:in ist', async () => {
      await db.query(
        'INSERT INTO user_organizations (user_id, organization_id, role_id) VALUES ($1, 2, $2)',
        [USERS.orgAdmin1.id, ROLES.teamer2.id]
      );
      await db.query(
        `INSERT INTO user_activities (user_id, activity_id, completed_date, admin_id, organization_id, points)
         VALUES ($1, $2, CURRENT_DATE, $3, 2, 0)`,
        [USERS.orgAdmin1.id, DIENST_ORG2, USERS.admin2.id]
      );
      await BackgroundService.updateAllUserBadges(db);

      expect(await abzeichen(USERS.orgAdmin1.id)).toEqual([`${BADGE_ORG2}@2`]);
    });

    // Der Lauf prueft nur, wessen Abdruck sich geaendert hat
    // (utils/abzeichenKandidaten.js). Der Abdruck einer Person mit zwei
    // Gemeinden muss deshalb die Kataloge BEIDER Gemeinden enthalten.
    it.each([[1, 814], [2, 813]])(
      'ein neues Badge in Gemeinde %i laesst den naechsten Lauf die Person wieder pruefen',
      async (orgId, neueId) => {
        await dienst(orgId);
        await db.query('UPDATE custom_badges SET is_active = false');
        await BackgroundService.updateAllUserBadges(db);
        expect(await abzeichen()).toEqual([]);

        await db.query(
          `INSERT INTO custom_badges (id, name, criteria_type, criteria_value, organization_id, icon, color, is_active, target_role)
           VALUES ($1, 'Neu', 'activity_count', 1, $2, 'star', '#10b981', true, 'teamer')`,
          [neueId, orgId]
        );
        const lauf = await BackgroundService.updateAllUserBadges(db);

        // Geprueft werden genau die drei, die in DIESER Gemeinde Konfi oder
        // Teamer:in sind (Gemeinde 1: Konfi 1, Konfi 2 und diese Person;
        // Gemeinde 2: Konfi 3, Teamer:in 2 und diese Person) -- nicht die der
        // anderen Gemeinde, deren Katalog gleich blieb.
        expect(lauf.geprueft).toBe(3);
        expect(await abzeichen()).toEqual([`${neueId}@${orgId}`]);
      }
    );

    it('der Hintergrund-Lauf gibt der Leitung in ihrer Leitungs-Gemeinde nichts', async () => {
      // Zuhause Leitung mit einer Teamer-Aktivitaet in Gemeinde 1 -- dort ist
      // sie nicht Teamer:in, also kein Badge.
      await db.query(
        `INSERT INTO user_activities (user_id, activity_id, completed_date, admin_id, organization_id, points)
         VALUES ($1, $2, CURRENT_DATE, $3, 1, 0)`,
        [USERS.orgAdmin1.id, DIENST_ORG1, USERS.admin1.id]
      );
      await BackgroundService.updateAllUserBadges(db);

      expect(await abzeichen(USERS.orgAdmin1.id)).toEqual([]);
    });
  });

  // ==================================================================
  // ANZEIGE FUER DIE TEAMER:IN SELBST
  // ==================================================================
  describe('Anzeige in der aktiven Gemeinde', () => {
    it('GET /teamer/badges/v2 in Gemeinde 2: kein 404, nur deren Badges, Fortschritt nur aus Gemeinde 2', async () => {
      await dienst(1);
      const res = await alsTeamer(request(app).get('/api/teamer/badges/v2'), 2);

      expect(res.status).toBe(200);
      const alle = [...res.body.earned, ...res.body.available].map(b => Number(b.id));
      expect(alle).toEqual([BADGE_ORG2]);
      expect(res.body.available[0].progress.current).toBe(0);
    });

    it('GET /teamer/badges/v2 in Gemeinde 1 zaehlt die Aktivitaet aus Gemeinde 1', async () => {
      await dienst(1);
      const res = await alsTeamer(request(app).get('/api/teamer/badges/v2'), 1);

      expect(res.status).toBe(200);
      const alle = [...res.body.earned, ...res.body.available].map(b => Number(b.id));
      expect(alle).toEqual([BADGE_ORG1]);
      expect(res.body.available[0].progress.current).toBe(1);
    });

    it('GET /teamer/badges (alte Form, Array) in Gemeinde 2: nur deren Badges', async () => {
      await dienst(2);
      await checkAndAwardBadges(db, TEAMER, { organizationId: 2 });
      const res = await alsTeamer(request(app).get('/api/teamer/badges'), 2);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.map(b => Number(b.id))).toEqual([BADGE_ORG2]);
      expect(res.body[0].earned).toBe(true);
    });

    it('ungesehen, Zaehler am Reiter und "gesehen" gelten je Gemeinde', async () => {
      await dienst(1);
      await dienst(2);
      await checkAndAwardBadges(db, TEAMER, { organizationId: 1 });
      await checkAndAwardBadges(db, TEAMER, { organizationId: 2 });

      const zaehler = async (orgId) => (await alsTeamer(request(app).get('/api/notifications/badge-counts'), orgId)).body.newBadges;
      const ungesehen = async (orgId) => (await alsTeamer(request(app).get('/api/teamer/badges/unseen'), orgId)).body.unseen;
      expect(await zaehler(1)).toBe(1);
      expect(await zaehler(2)).toBe(1);
      expect(await ungesehen(2)).toBe(1);

      const gesehen = await alsTeamer(request(app).post('/api/teamer/badges/mark-seen'), 2);
      expect(gesehen.status).toBe(200);

      expect(await zaehler(2)).toBe(0);
      expect(await ungesehen(2)).toBe(0);
      // Gemeinde 1 bleibt unberuehrt.
      expect(await zaehler(1)).toBe(1);
      expect(await ungesehen(1)).toBe(1);

      // Die alte PUT-Route ebenso.
      await alsTeamer(request(app).put('/api/teamer/badges/mark-seen'), 1);
      expect(await zaehler(1)).toBe(0);
    });

    it('Dashboard in Gemeinde 2: Zertifikate und Badge-Zahlen nur aus Gemeinde 2', async () => {
      await dienst(1);
      await checkAndAwardBadges(db, TEAMER, { organizationId: 1 });
      await db.query(
        `INSERT INTO user_certificates (user_id, certificate_type_id, organization_id, issued_date, admin_id)
         VALUES ($1, $2, 1, CURRENT_DATE, $3)`,
        [TEAMER, ZERT_ORG1, USERS.admin1.id]
      );
      const res = await alsTeamer(request(app).get('/api/teamer/dashboard'), 2);

      expect(res.status).toBe(200);
      expect(res.body.certificates.map(c => Number(c.id))).toEqual([ZERT_ORG2]);
      expect(res.body.certificates[0].status).toBe('not_earned');
      expect(res.body.badges.earned_count).toBe(0);
      expect(res.body.badges.total_count).toBe(1);
    });
  });

  // ==================================================================
  // EINSICHT UND VERGABE DURCH DIE LEITUNG DER WEITEREN GEMEINDE
  // ==================================================================
  describe('Leitung der weiteren Gemeinde', () => {
    const alsLeitung2 = (req) => req.set('Authorization', `Bearer ${generateToken('orgAdmin2')}`);

    it('GET /teamer/:userId/badges: kein 404, nur die Badges von Gemeinde 2', async () => {
      await dienst(1);
      await dienst(2);
      await checkAndAwardBadges(db, TEAMER, { organizationId: 1 });
      await checkAndAwardBadges(db, TEAMER, { organizationId: 2 });

      const res = await alsLeitung2(request(app).get(`/api/teamer/${TEAMER}/badges`));
      expect(res.status).toBe(200);
      expect(res.body.earned.map(b => Number(b.id))).toEqual([BADGE_ORG2]);
    });

    it('GET /teamer/:userId/badges: verboten fuer eine Person, die in Gemeinde 2 nicht Teamer:in ist', async () => {
      const res = await alsLeitung2(request(app).get(`/api/teamer/${USERS.teamer2.id}/badges`));
      expect(res.status).toBe(200);

      const fremd = await alsLeitung2(request(app).get(`/api/teamer/${USERS.orgAdmin1.id}/badges`));
      expect(fremd.status).toBe(404);
      const konfi = await alsLeitung2(request(app).get(`/api/teamer/${USERS.konfi3.id}/badges`));
      expect(konfi.status).toBe(404);
    });

    it('POST /teamer/:userId/certificates: vergibt in Gemeinde 2, gebucht auf Gemeinde 2', async () => {
      const res = await alsLeitung2(request(app).post(`/api/teamer/${TEAMER}/certificates`))
        .send({ certificate_type_id: ZERT_ORG2, issued_date: '2026-09-01' });

      expect(res.status).toBe(201);
      const { rows } = await db.query(
        'SELECT organization_id FROM user_certificates WHERE user_id = $1', [TEAMER]);
      expect(rows.map(r => Number(r.organization_id))).toEqual([2]);

      // Die Liste der Leitung von Gemeinde 2 zeigt es, die von Gemeinde 1 nicht.
      const liste2 = await alsLeitung2(request(app).get(`/api/teamer/${TEAMER}/certificates`));
      expect(liste2.body.map(c => Number(c.certificate_type_id))).toEqual([ZERT_ORG2]);
      const liste1 = await request(app).get(`/api/teamer/${TEAMER}/certificates`)
        .set('Authorization', `Bearer ${generateToken('orgAdmin1')}`);
      expect(liste1.body).toEqual([]);
    });

    it('POST /teamer/:userId/certificates: verboten fuer Nicht-Mitglieder und Konfis, auch mit fremdem Typ', async () => {
      const nichtMitglied = await alsLeitung2(request(app).post(`/api/teamer/${USERS.admin1.id}/certificates`))
        .send({ certificate_type_id: ZERT_ORG2, issued_date: '2026-09-01' });
      expect(nichtMitglied.status).toBe(404);

      const konfi = await alsLeitung2(request(app).post(`/api/teamer/${USERS.konfi3.id}/certificates`))
        .send({ certificate_type_id: ZERT_ORG2, issued_date: '2026-09-01' });
      expect(konfi.status).toBe(404);

      // Der Typ aus Gemeinde 1 wandert nicht nach Gemeinde 2.
      const fremderTyp = await alsLeitung2(request(app).post(`/api/teamer/${TEAMER}/certificates`))
        .send({ certificate_type_id: ZERT_ORG1, issued_date: '2026-09-01' });
      expect(fremderTyp.status).toBe(404);

      const { rows } = await db.query('SELECT 1 FROM user_certificates');
      expect(rows).toHaveLength(0);
    });
  });
});
