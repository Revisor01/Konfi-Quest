// Vollzugriff auf Termine gilt JE GEMEINDE (27.09.2026)
//
// gehoertZumTermin (utils/jahrgangsZugriff.js) nahm die Gemeindeleitung von
// der Jahrgangsgrenze aus -- aber ueber die Rolle am KONTO:
//
//   EXISTS (SELECT 1 FROM users u JOIN roles r ON u.role_id = r.id
//           WHERE u.id = $2 AND (r.name IN ('org_admin', 'super_admin')
//                                OR u.is_super_admin = true))
//
// Wer zuhause Org-Admin ist und in Gemeinde B nur Teamer:in, buchte in B so
// jeden Termin fremder Jahrgaenge -- ueber POST /events/:id/book und
// POST /teamer/events/:id/zusage (beide ueber darfTeamerAnDiesenTermin).
//
// CLAUDE.md, "Wer sieht und bekommt was": Rolle und Jahrgaenge gelten je
// Gemeinde; users.role_id fuer die Stamm-Gemeinde (sie gewinnt, wenn
// user_organizations sie doppelt fuehrt), user_organizations.role_id fuer
// weitere -- wie utils/orgMitglieder.js und middleware/rbac.js.
//
// Das Flag is_super_admin bleibt gemeindeuebergreifend: rbac.js bildet
// req.user.is_super_admin aus dem Flag unabhaengig von der aktiven Gemeinde,
// darfJahrgang und requireSuperAdmin lassen es ueberall durch.

const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, JAHRGAENGE, ROLES } = require('../helpers/seed');
const { gehoertZumTermin } = require('../../utils/jahrgangsZugriff');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-vitest';

// Am Konto org_admin in Org 1, ueber user_organizations Teamer:in in Org 2,
// dort ohne Jahrgang.
const ZUHAUSE_LEITUNG = 281;
// Am Konto Teamer:in in Org 1 (ohne Jahrgang), ueber user_organizations
// org_admin in Org 2.
const ZUSATZ_LEITUNG = 282;
// Stamm-Gemeinde Org 2 als Teamer:in; user_organizations fuehrt Org 2
// zusaetzlich als org_admin. Die Rolle am Konto gewinnt.
const STAMM_GEWINNT = 283;

const JAHRGANG_FREMD = 'Dieses Event gehört zu einem Jahrgang, dem du nicht zugewiesen bist';

function tokenFuer(id) {
  return jwt.sign({ id, type: 'admin', display_name: `User ${id}` }, JWT_SECRET, { expiresIn: '1h' });
}

describe('Vollzugriff auf Termine je Gemeinde', () => {
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
       VALUES ($1, 'rjg-zuhause-leitung', 'x', 'Zuhause Leitung', $4, 1, true),
              ($2, 'rjg-zusatz-leitung', 'x', 'Zusatz Leitung',  $5, 1, true),
              ($3, 'rjg-stamm-gewinnt',  'x', 'Stamm Gewinnt',   $6, 2, true)`,
      [ZUHAUSE_LEITUNG, ZUSATZ_LEITUNG, STAMM_GEWINNT, ROLES.orgAdmin.id, ROLES.teamer.id, ROLES.teamer2.id]
    );
    await db.query(
      `INSERT INTO user_organizations (user_id, organization_id, role_id)
       VALUES ($1, 2, $4), ($2, 2, $5), ($3, 2, $5)`,
      [ZUHAUSE_LEITUNG, ZUSATZ_LEITUNG, STAMM_GEWINNT, ROLES.teamer2.id, ROLES.orgAdmin2.id]
    );

    const { invalidateUserCache } = require('../../middleware/rbac');
    [ZUHAUSE_LEITUNG, ZUSATZ_LEITUNG, STAMM_GEWINNT].forEach(invalidateUserCache);
  });

  // Termin mit Team-Bedarf in der Zukunft, wahlweise an Jahrgaengen.
  async function terminAnlegen(orgId, jahrgangIds = []) {
    const { rows: [event] } = await db.query(
      `INSERT INTO events (name, description, event_date, location, organization_id,
                           teamer_only, teamer_needed, max_participants, teamer_max_participants)
       VALUES ('Rollentest', 'Beschreibung', NOW() + INTERVAL '7 days', 'Ort', $1, false, true, 20, 0)
       RETURNING id`,
      [orgId]
    );
    for (const jg of jahrgangIds) {
      await db.query(
        'INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) VALUES ($1, $2)',
        [event.id, jg]
      );
    }
    return event.id;
  }

  async function buchungen(eventId, userId) {
    const { rows } = await db.query(
      'SELECT id FROM event_bookings WHERE event_id = $1 AND user_id = $2',
      [eventId, userId]
    );
    return rows.length;
  }

  const alsTeamerInOrg2 = (req) =>
    req.set('Authorization', `Bearer ${tokenFuer(ZUHAUSE_LEITUNG)}`).set('X-Active-Organization', '2');

  // ------------------------------------------------------------------
  // Die Wege, auf denen es sich zeigte: Selbst-Anmeldung des Teams
  // ------------------------------------------------------------------
  describe('Zuhause Org-Admin, in Gemeinde B Teamer:in ohne Jahrgang', () => {
    it('VERBOTEN: POST /events/:id/book an einem Jahrgangstermin in B -> 403, keine Buchung', async () => {
      const id = await terminAnlegen(2, [JAHRGAENGE.jahrgang2.id]);

      const res = await alsTeamerInOrg2(request(app).post(`/api/events/${id}/book`)).send({});

      expect(res.status).toBe(403);
      expect(res.body).toEqual({ error: JAHRGANG_FREMD });
      expect(await buchungen(id, ZUHAUSE_LEITUNG)).toBe(0);
    });

    it('VERBOTEN: POST /teamer/events/:id/zusage an einem Jahrgangstermin in B -> 403, keine Buchung', async () => {
      const id = await terminAnlegen(2, [JAHRGAENGE.jahrgang2.id]);

      const res = await alsTeamerInOrg2(request(app).post(`/api/teamer/events/${id}/zusage`)).send({ dabei: true });

      expect(res.status).toBe(403);
      expect(res.body).toEqual({ error: JAHRGANG_FREMD });
      expect(await buchungen(id, ZUHAUSE_LEITUNG)).toBe(0);
    });

    it('ERLAUBT: mit Zuweisung zum Jahrgang des Termins -> 201, bestaetigt', async () => {
      const id = await terminAnlegen(2, [JAHRGAENGE.jahrgang2.id]);
      await db.query(
        'INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id) VALUES ($1, $2)',
        [ZUHAUSE_LEITUNG, JAHRGAENGE.jahrgang2.id]
      );

      const res = await alsTeamerInOrg2(request(app).post(`/api/events/${id}/book`)).send({});

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('confirmed');
      expect(await buchungen(id, ZUHAUSE_LEITUNG)).toBe(1);
    });

    it('ERLAUBT: Termin ohne Jahrgang in B gilt der ganzen Gemeinde -> 201', async () => {
      const id = await terminAnlegen(2, []);

      const res = await alsTeamerInOrg2(request(app).post(`/api/events/${id}/book`)).send({});

      expect(res.status).toBe(201);
      expect(await buchungen(id, ZUHAUSE_LEITUNG)).toBe(1);
    });
  });

  // ------------------------------------------------------------------
  // Der Baustein selbst: welche Rolle zaehlt in welcher Gemeinde?
  // ------------------------------------------------------------------
  describe('gehoertZumTermin nimmt die Rolle in der Gemeinde des Termins', () => {
    it('VERBOTEN: Stamm-Rolle org_admin traegt nicht in Gemeinde B, wo die Person Teamer:in ist', async () => {
      const id = await terminAnlegen(2, [JAHRGAENGE.jahrgang2.id]);
      expect(await gehoertZumTermin(db, ZUHAUSE_LEITUNG, id)).toBe(false);
    });

    it('ERLAUBT: dieselbe Person in ihrer Stamm-Gemeinde, dort org_admin', async () => {
      const id = await terminAnlegen(1, [JAHRGAENGE.jahrgang1.id]);
      expect(await gehoertZumTermin(db, ZUHAUSE_LEITUNG, id)).toBe(true);
    });

    it('ERLAUBT: org_admin ueber user_organizations in der Gemeinde des Termins', async () => {
      const id = await terminAnlegen(2, [JAHRGAENGE.jahrgang2.id]);
      expect(await gehoertZumTermin(db, ZUSATZ_LEITUNG, id)).toBe(true);
    });

    it('VERBOTEN: dieselbe Person in ihrer Stamm-Gemeinde, dort Teamer:in ohne Jahrgang', async () => {
      const id = await terminAnlegen(1, [JAHRGAENGE.jahrgang1.id]);
      expect(await gehoertZumTermin(db, ZUSATZ_LEITUNG, id)).toBe(false);
    });

    it('VERBOTEN: in der Stamm-Gemeinde gewinnt die Rolle am Konto, auch wenn user_organizations dort org_admin fuehrt', async () => {
      const id = await terminAnlegen(2, [JAHRGAENGE.jahrgang2.id]);
      expect(await gehoertZumTermin(db, STAMM_GEWINNT, id)).toBe(false);
    });

    it('ERLAUBT: Org-Admin der Gemeinde des Termins am Konto (orgAdmin2 in Org 2)', async () => {
      const id = await terminAnlegen(2, [JAHRGAENGE.jahrgang2.id]);
      expect(await gehoertZumTermin(db, USERS.orgAdmin2.id, id)).toBe(true);
    });

    it('ERLAUBT: Teamer:in mit Zuweisung zum Jahrgang des Termins (teamer2 in Org 2)', async () => {
      const id = await terminAnlegen(2, [JAHRGAENGE.jahrgang2.id]);
      expect(await gehoertZumTermin(db, USERS.teamer2.id, id)).toBe(true);
    });

    it('ERLAUBT: das Flag is_super_admin gilt gemeindeuebergreifend (Konto in Org 1, Termin in Org 2)', async () => {
      const id = await terminAnlegen(2, [JAHRGAENGE.jahrgang2.id]);
      expect(await gehoertZumTermin(db, USERS.orgAdminSuper.id, id)).toBe(true);
      expect(await gehoertZumTermin(db, USERS.superAdmin.id, id)).toBe(true);
    });

    it('VERBOTEN: org_admin einer ganz anderen Gemeinde ohne Mitgliedschaft in B', async () => {
      const id = await terminAnlegen(2, [JAHRGAENGE.jahrgang2.id]);
      expect(await gehoertZumTermin(db, USERS.orgAdmin1.id, id)).toBe(false);
    });
  });
});
