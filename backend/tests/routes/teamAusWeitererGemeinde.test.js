// Team und Leitung, die ueber eine Einladung in der Gemeinde sind (29.09.2026).
//
// Simon, 29.09.2026, nach TestFlight 233: "Außerdem kann ich keine Teamer zu
// Events hinzufügen Liste ist leer. Und bei der Leitung gibt es da auch
// Probleme."
//
// Zugehoerigkeit hat zwei Quellen (CLAUDE.md, utils/orgMitglieder.js): die
// Stamm-Gemeinde am Konto (users.organization_id/role_id) und jede weitere
// ueber user_organizations mit der Rolle DORT. Die Auswahllisten
// GET /admin/konfis/teamer und /admin/konfis/leitung und die Personenpruefung
// in POST /events/:id/participants lasen nur die Stamm-Gemeinde. Wer ueber
// eine Einladung im Team einer Gemeinde ist, fehlte deshalb in der Team-
// Verwaltung und in der Auswahl am Event, und liess sich auch direkt nicht
// eintragen (404 "Benutzer nicht gefunden").
//
// Mit geprueft: Die Jahrgaenge einer Person stammen nur aus DIESER Gemeinde
// (vorher kamen Zuweisungen aus der anderen Gemeinde mit, samt Namen), und
// die Leitungsliste nennt die Rolle in DIESER Gemeinde.
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ROLES, JAHRGAENGE } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

describe('Team und Leitung aus einer weiteren Gemeinde', () => {
  let app;
  let db;
  let orgAdminToken;

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
    // teamer2 (zuhause Gemeinde 2) ist per Einladung Teamer:in in Gemeinde 1;
    // orgAdmin2 (zuhause Org-Leitung in Gemeinde 2) ist in Gemeinde 1 Leitung.
    await db.query(
      `INSERT INTO user_organizations (user_id, organization_id, role_id)
       VALUES ($1, 1, $2), ($3, 1, $4)`,
      [USERS.teamer2.id, ROLES.teamer.id, USERS.orgAdmin2.id, ROLES.admin.id]
    );
    // Der Seed weist teamer1 Jahrgang 1 (Gemeinde 1) und teamer2 Jahrgang 2
    // (Gemeinde 2) zu. teamer2 bekommt Jahrgang 1 dazu -- danach traegt sie
    // Zuweisungen aus BEIDEN Gemeinden.
    await db.query(
      `INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id, can_view, can_edit)
       VALUES ($1, $2, true, false)`,
      [USERS.teamer2.id, JAHRGAENGE.jahrgang1.id]
    );
    orgAdminToken = generateToken('orgAdmin1');
  });

  const liste = (pfad) => request(app)
    .get(`/api/admin/konfis/${pfad}`)
    .set('Authorization', `Bearer ${orgAdminToken}`);

  describe('GET /admin/konfis/teamer', () => {
    it('nennt Teamer:innen beider Quellen, keine der anderen Gemeinde ohne Mitgliedschaft', async () => {
      // Eine Teamer:in der Gemeinde 2 OHNE Mitgliedschaft in Gemeinde 1.
      await db.query(
        `INSERT INTO users (id, username, password_hash, display_name, role_id, organization_id, is_active)
         VALUES (901, 'nur_zwei', 'x', 'Nur Gemeinde Zwei', $1, 2, true)`,
        [ROLES.teamer2.id]
      );

      const res = await liste('teamer');

      expect(res.status).toBe(200);
      expect(res.body.map((t) => Number(t.id)).sort((a, b) => a - b))
        .toEqual([USERS.teamer1.id, USERS.teamer2.id]);
    });

    it('liefert nur Jahrgaenge dieser Gemeinde, auch fuer Eingeladene', async () => {
      const res = await liste('teamer');
      const zwei = res.body.find((t) => Number(t.id) === USERS.teamer2.id);

      expect(zwei.jahrgang_ids).toEqual([JAHRGAENGE.jahrgang1.id]);
      expect(zwei.jahrgang_name).toBe(JAHRGAENGE.jahrgang1.name);
    });

    it('behaelt die Antwortform (Felder und Typen der Store-Apps)', async () => {
      const res = await liste('teamer');
      const eins = res.body.find((t) => Number(t.id) === USERS.teamer1.id);

      expect(Object.keys(eins).sort()).toEqual([
        'badge_count', 'cert_count', 'id', 'jahrgang_ids', 'jahrgang_name', 'name', 'teamer_since', 'username'
      ]);
      expect(eins.name).toBe(USERS.teamer1.display_name);
      expect(eins.badge_count).toBe(0);
      expect(eins.cert_count).toBe(0);
    });

    // DIE URSACHE DER LEEREN LISTE AM EVENT: pg liefert bigint[] als Text
    // (["1"]), die App vergleicht streng mit den Zahlen des Events
    // (jahrgangsPassung.ts) -- keine Teamer:in passte je zu irgendeinem Event.
    it('liefert jahrgang_ids als Zahlen, wie dokumentiert (integer[])', async () => {
      const res = await liste('teamer');
      const eins = res.body.find((t) => Number(t.id) === USERS.teamer1.id);

      expect(eins.jahrgang_ids).toEqual([JAHRGAENGE.jahrgang1.id]);
      expect(typeof eins.jahrgang_ids[0]).toBe('number');
    });
  });

  describe('GET /admin/konfis/leitung', () => {
    it('nennt eingeladene Leitung mit der Rolle in DIESER Gemeinde', async () => {
      const res = await liste('leitung');

      expect(res.status).toBe(200);
      const rollen = Object.fromEntries(res.body.map((p) => [Number(p.id), p.role_name]));
      expect(rollen[USERS.orgAdmin2.id]).toBe('admin');
      expect(rollen[USERS.admin1.id]).toBe('admin');
      expect(rollen[USERS.orgAdmin1.id]).toBe('org_admin');
      // Leitung der Gemeinde 2 ohne Mitgliedschaft in Gemeinde 1 fehlt.
      expect(rollen[USERS.admin2.id]).toBe(undefined);
    });

    it('liefert jahrgang_ids als Zahlen und nur aus dieser Gemeinde', async () => {
      // admin1 bekommt Jahrgang 1 (Gemeinde 1), orgAdmin2 Jahrgang 2 (Gemeinde 2).
      await db.query(
        `INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id, can_view, can_edit)
         VALUES ($1, $3, true, true), ($2, $4, true, true)`,
        [USERS.admin1.id, USERS.orgAdmin2.id, JAHRGAENGE.jahrgang1.id, JAHRGAENGE.jahrgang2.id]
      );

      const res = await liste('leitung');
      const jahrgaenge = Object.fromEntries(res.body.map((p) => [Number(p.id), p.jahrgang_ids]));

      expect(jahrgaenge[USERS.admin1.id]).toEqual([JAHRGAENGE.jahrgang1.id]);
      expect(jahrgaenge[USERS.orgAdmin2.id]).toEqual([]);
    });
  });

  describe('POST /events/:id/participants', () => {
    async function event() {
      const { rows: [e] } = await db.query(
        `INSERT INTO events (name, description, event_date, location, organization_id,
                             teamer_needed, max_participants, teamer_max_participants)
         VALUES ('Mit Team', 'x', NOW() + INTERVAL '7 days', 'Ort', 1, true, 20, 0)
         RETURNING id`
      );
      await db.query(
        'INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) VALUES ($1, $2)',
        [e.id, JAHRGAENGE.jahrgang1.id]
      );
      return e.id;
    }

    const eintragen = (eventId, userId) => request(app)
      .post(`/api/events/${eventId}/participants`)
      .set('Authorization', `Bearer ${orgAdminToken}`)
      .send({ user_id: userId, status: 'confirmed' });

    it('traegt eine eingeladene Teamer:in ein', async () => {
      const eventId = await event();

      const res = await eintragen(eventId, USERS.teamer2.id);

      expect(res.status).toBe(201);
      const { rows } = await db.query(
        'SELECT status FROM event_bookings WHERE event_id = $1 AND user_id = $2',
        [eventId, USERS.teamer2.id]
      );
      expect(rows).toEqual([{ status: 'confirmed' }]);
    });

    it('weist eine Person der anderen Gemeinde ohne Mitgliedschaft weiter mit 404 ab', async () => {
      const eventId = await event();

      const res = await eintragen(eventId, USERS.admin2.id);

      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Benutzer nicht gefunden');
    });
  });
});
