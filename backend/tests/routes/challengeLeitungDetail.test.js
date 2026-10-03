// backend/tests/routes/challengeLeitungDetail.test.js
//
// GET /api/challenges/admin/:id -- EINE Challenge fuer die Leitungsseite
// (2.4.0, Simon 02.10.2026: "challenge nicht in modal öffnen, sondern in
// unterseite, damit man direkt auf die challenge linken kann aus einem
// push").
//
// Bis dahin bekam die Leitungsansicht ihre Challenge aus der Liste
// (GET /admin); eine eigene Seite unter /admin/challenges/:id bzw.
// /teamer/challenges/:id braucht sie einzeln -- ein Push kann direkt
// dorthin fuehren, ohne dass die Liste je geladen war.
//
// Die Route ist ADDITIV: Liste, Beitraege und alle Antwortformen bleiben,
// wie sie sind. Sie liefert genau einen Eintrag der Liste, und sie liefert
// ihn genau dann, wenn die Liste ihn fuehrt -- dieselbe Regel-Stelle
// (utils/challengeLeitungSicht.js, CLAUDE.md "Mitteilung = Sichtbarkeit"):
//   org_admin       jede Challenge der Gemeinde
//   admin, teamer   'nur_team' immer, sonst ueber einen zugewiesenen
//                   Jahrgang der Challenge (can_view)
// Fremde Gemeinde und unbekannte Kennung: 404 (wie GET /admin/:id/submissions),
// sichtbar in der Gemeinde, aber nicht fuer diese Person: 403.
//
// Im Seed hat admin1 KEINEN Jahrgang, teamer1 Jahrgang 1. Assertions auf
// konkrete Werte.
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, JAHRGAENGE } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');
const { invalidateUserCache } = require('../../middleware/rbac');

describe('GET /api/challenges/admin/:id', () => {
  let app;
  let db;

  beforeAll(() => { db = getTestPool(); app = getTestApp(db); });
  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    for (const u of Object.values(USERS)) invalidateUserCache(u.id);
  });
  afterAll(async () => { await closePool(); });

  async function challenge(audience, {
    jahrgang = JAHRGAENGE.jahrgang1.id,
    org = ORGS.testGemeinde.id,
    entwurf = false,
    titel = `Runde ${audience}`
  } = {}) {
    const { rows: [c] } = await db.query(
      `INSERT INTO challenges (organization_id, title, description, audience, visibility, moderated,
         allowed_media, badge_name, badge_icon, created_by, starts_at, ends_at, is_draft)
       VALUES ($1, $2, 'Beschreibung', $3, 'konfi_choice', true, '["text","photo"]'::jsonb, 'Stempel', 'flag', $4,
               NOW() - interval '1 day', NOW() + interval '7 days', $5)
       RETURNING *`,
      [org, titel, audience, USERS.orgAdmin1.id, entwurf]
    );
    if (jahrgang && audience !== 'nur_team') {
      await db.query('INSERT INTO challenge_jahrgang_assignments (challenge_id, jahrgang_id) VALUES ($1, $2)', [c.id, jahrgang]);
    }
    return c;
  }

  async function jahrgangZuweisen(userKey, jahrgangId, canView = true) {
    await db.query(
      'INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id, can_view) VALUES ($1, $2, $3)',
      [USERS[userKey].id, jahrgangId, canView]
    );
    invalidateUserCache(USERS[userKey].id);
  }

  const detail = (wer, id) => request(app).get(`/api/challenges/admin/${id}`)
    .set('Authorization', `Bearer ${generateToken(wer)}`);
  const liste = async (wer) => (await request(app).get('/api/challenges/admin')
    .set('Authorization', `Bearer ${generateToken(wer)}`)).body;

  describe('erlaubt', () => {
    it('Org-Admin bekommt die Challenge eines Jahrgangs ohne eigene Zuweisung -- genau den Listeneintrag', async () => {
      const c = await challenge('konfis');
      // Ein eigener Beitrag und ein wartender, damit die Zaehler etwas zeigen.
      await db.query(
        `INSERT INTO challenge_submissions (challenge_id, user_id, organization_id, media_type, text_content, moderation_status)
         VALUES ($1, $2, $3, 'text', 'Hallo', 'pending'), ($1, $4, $3, 'text', 'Meins', 'approved')`,
        [c.id, USERS.konfi1.id, ORGS.testGemeinde.id, USERS.orgAdmin1.id]
      );

      const res = await detail('orgAdmin1', c.id);
      expect(res.status).toBe(200);
      // Ein Objekt, kein Array -- und Feld fuer Feld derselbe Eintrag wie in
      // der Liste (gleiche Abfrage, gleiche Aufbereitung).
      expect(Array.isArray(res.body)).toBe(false);
      const ausListe = (await liste('orgAdmin1')).find((e) => e.id === c.id);
      expect(res.body).toEqual(ausListe);
      expect(res.body).toMatchObject({
        id: c.id,
        title: 'Runde konfis',
        audience: 'konfis',
        status: 'active',
        locked: true,
        allowed_media: ['text', 'photo'],
        submission_count: 2,
        pending_count: 1,
        own_submission_count: 1,
        has_badge: true,
        jahrgaenge: [{ id: JAHRGAENGE.jahrgang1.id, name: JAHRGAENGE.jahrgang1.name }],
      });
    });

    it('Org-Admin bekommt auch einen Entwurf ohne Jahrgang', async () => {
      const c = await challenge('konfis', { jahrgang: null, entwurf: true });
      const res = await detail('orgAdmin1', c.id);
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('draft');
      expect(res.body.jahrgaenge).toEqual([]);
    });

    it('Teamer:in bekommt die Challenge ihres Jahrgangs', async () => {
      const c = await challenge('konfis_und_team');
      const res = await detail('teamer1', c.id);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(c.id);
      expect(res.body.own_submission_count).toBe(0);
      expect(res.body.has_badge).toBe(false);
    });

    it('Admin mit Zuweisung bekommt die Challenge seines Jahrgangs', async () => {
      await jahrgangZuweisen('admin1', JAHRGAENGE.jahrgang1.id);
      const c = await challenge('konfis');
      const res = await detail('admin1', c.id);
      expect(res.status).toBe(200);
      expect(res.body.id).toBe(c.id);
    });

    it('"Nur das Team" bekommen Admin und Teamer:in ohne passenden Jahrgang', async () => {
      const c = await challenge('nur_team');
      expect((await detail('admin1', c.id)).status).toBe(200);
      expect((await detail('teamer1', c.id)).status).toBe(200);
    });
  });

  describe('verboten', () => {
    it('Admin ohne passenden Jahrgang: 403 mit Grund, keine Daten', async () => {
      const c = await challenge('konfis_und_team');
      const res = await detail('admin1', c.id);
      expect(res.status).toBe(403);
      expect(res.body.error_code).toBe('jahrgang_nicht_zugewiesen');
      expect(res.body.title).toBeUndefined();
    });

    it('Teamer:in bei der Challenge eines fremden Jahrgangs derselben Gemeinde: 403', async () => {
      const { rows: [jg] } = await db.query(
        `INSERT INTO jahrgaenge (name, organization_id, confirmation_date) VALUES ('2026/2027', $1, '2027-05-01') RETURNING id`,
        [ORGS.testGemeinde.id]
      );
      const c = await challenge('konfis', { jahrgang: jg.id });
      const res = await detail('teamer1', c.id);
      expect(res.status).toBe(403);
      expect(res.body.title).toBeUndefined();
    });

    it('Zuweisung ohne Leserecht (can_view = false) oeffnet nichts', async () => {
      await jahrgangZuweisen('admin1', JAHRGAENGE.jahrgang1.id, false);
      const c = await challenge('konfis');
      expect((await detail('admin1', c.id)).status).toBe(403);
    });

    it('Fremde Gemeinde: 404 -- auch fuer deren Org-Admin', async () => {
      const c = await challenge('konfis');
      for (const wer of ['orgAdmin2', 'admin2', 'teamer2']) {
        const res = await detail(wer, c.id);
        expect(res.status, wer).toBe(404);
        expect(res.body.title, wer).toBeUndefined();
      }
    });

    it('Unbekannte Kennung: 404, ungueltige: 400', async () => {
      expect((await detail('orgAdmin1', 999999)).status).toBe(404);
      expect((await detail('orgAdmin1', 'abc')).status).toBe(400);
    });

    it('Konfis haben keinen Zugang zur Leitungsansicht: 403', async () => {
      const c = await challenge('konfis');
      expect((await detail('konfi1', c.id)).status).toBe(403);
    });
  });

  // Die eigentliche Zusage: Die Einzelroute und die Liste lesen dieselbe
  // Regel. Fuer jede Person und jede Challenge gilt "200 genau dann, wenn
  // die Liste sie fuehrt" -- sonst landete ein Push-Tipp auf einer Seite,
  // die die Liste verschweigt (oder umgekehrt).
  it('200 genau dann, wenn die Liste der Person die Challenge fuehrt', async () => {
    await jahrgangZuweisen('admin1', JAHRGAENGE.jahrgang1.id, false);
    const challenges = [
      await challenge('konfis'),
      await challenge('konfis_und_team'),
      await challenge('nur_team'),
      await challenge('konfis', { jahrgang: null, entwurf: true, titel: 'Entwurf ohne Jahrgang' }),
    ];
    const vergleiche = [];
    for (const wer of ['orgAdmin1', 'admin1', 'teamer1']) {
      const inListe = new Set((await liste(wer)).map((e) => e.id));
      for (const c of challenges) {
        const status = (await detail(wer, c.id)).status;
        vergleiche.push(`${wer} ${c.title}: ${inListe.has(c.id) ? 200 : 403} -> ${status}`);
        expect(status, `${wer} ${c.title}`).toBe(inListe.has(c.id) ? 200 : 403);
      }
    }
    // Die Probe deckt beide Ausgaenge ab, sonst bewiese sie nichts.
    expect(vergleiche.filter((v) => v.endsWith('-> 200')).length).toBe(8);
    expect(vergleiche.filter((v) => v.endsWith('-> 403')).length).toBe(4);
  });
});
