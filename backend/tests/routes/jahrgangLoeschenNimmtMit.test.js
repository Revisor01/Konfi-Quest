// backend/tests/routes/jahrgangLoeschenNimmtMit.test.js
//
// Jahrgang loeschen nimmt seine Termine und Challenges mit -- in EINER
// Transaktion (Audit 26.09.2026, backend-fachlogik-punkte-termine BF-08;
// Simons Entscheidung vom 28.09.2026).
//
// Simon woertlich: "Events die im Jahrgang liegen muessen mit dem Jahrgang
// geloescht werden. Event mit zwei Jahrgaenge bleiben, der eine verschwindet
// dann nur aus dem Event. Loeschen muss auch challenges mit umfassen. Teamer
// und Admins sollten aber ihre Stempel behalten aus den Challenges. Konfi
// Badges werden Hard gespeichert etc."
//
// Vorher: Die Zuordnungen fielen per Kaskade weg, die Termine blieben als
// "allgemeine" Termine fuer die ganze Gemeinde stehen -- ein Pflichttermin
// ohne Jahrgang, genau der Zustand, den der Riegel beim Anlegen verbietet.
// Und rund zwanzig Abfragen liefen ohne BEGIN.
const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, ORGS, JAHRGAENGE, BADGES } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

describe('Jahrgang loeschen nimmt Termine und Challenges mit (BF-08)', () => {
  let app;
  let db;
  let alt; // der Jahrgang, der geloescht wird

  beforeAll(() => {
    db = getTestPool();
    app = getTestApp(db);
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    const { rows: [j] } = await db.query(
      `INSERT INTO jahrgaenge (name, organization_id, confirmation_date)
       VALUES ('2023/2024', $1, '2024-05-01') RETURNING id`,
      [ORGS.testGemeinde.id]
    );
    alt = j.id;
  });

  afterAll(async () => {
    await closePool();
  });

  const orgAdmin = () => generateToken('orgAdmin1');

  async function termin({ name = 'Termin', jahrgaenge = [], mandatory = false, teamerOnly = false, tageVersatz = -30 } = {}) {
    const { rows: [e] } = await db.query(
      `INSERT INTO events (name, event_date, organization_id, mandatory, max_participants, point_type, points, teamer_only)
       VALUES ($1, NOW() + ($2 || ' days')::interval, $3, $4, 0, 'gemeinde', 2, $5) RETURNING id`,
      [name, String(tageVersatz), ORGS.testGemeinde.id, mandatory, teamerOnly]
    );
    for (const jg of jahrgaenge) {
      await db.query('INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) VALUES ($1, $2)', [e.id, jg]);
    }
    return e.id;
  }

  async function challenge({ titel = 'Challenge', jahrgaenge = [], audience = 'konfis_und_team' } = {}) {
    const { rows: [c] } = await db.query(
      `INSERT INTO challenges (organization_id, title, description, audience, badge_name, badge_icon,
                               created_by, starts_at, ends_at, is_draft)
       VALUES ($1, $2, 'Beschreibung', $3, $4, 'leaf', $5, NOW() - interval '60 days', NOW() - interval '30 days', false)
       RETURNING id`,
      [ORGS.testGemeinde.id, titel, audience, `Stempel ${titel}`, USERS.orgAdmin1.id]
    );
    for (const jg of jahrgaenge) {
      await db.query('INSERT INTO challenge_jahrgang_assignments (challenge_id, jahrgang_id) VALUES ($1, $2)', [c.id, jg]);
    }
    return c.id;
  }

  async function beitrag(challengeId, userId, status = 'approved') {
    await db.query(
      `INSERT INTO challenge_submissions (challenge_id, user_id, organization_id, media_type, text_content,
                                          moderation_status, approved_at, created_at)
       VALUES ($1, $2, $3, 'text', 'Mein Beitrag', $4, NOW() - interval '40 days', NOW() - interval '41 days')`,
      [challengeId, userId, ORGS.testGemeinde.id, status]
    );
  }

  const loeschen = (id = alt, token = orgAdmin()) =>
    request(app).delete(`/api/admin/jahrgaenge/${id}`).set('Authorization', `Bearer ${token}`);

  const zahl = async (sql, params) => (await db.query(sql, params)).rows[0].n;

  // ------------------------------------------------------------------
  // Termine
  // ------------------------------------------------------------------
  describe('Termine', () => {
    it('ein Termin NUR in diesem Jahrgang geht mit -- samt Chat, Buchungen, Punkten, Erinnerungen und Postfach', async () => {
      const eventId = await termin({ name: 'Konfifreizeit 2023', jahrgaenge: [alt] });
      await db.query(
        `INSERT INTO event_bookings (event_id, user_id, status, attendance_status, organization_id)
         VALUES ($1, $2, 'confirmed', 'present', $3)`,
        [eventId, USERS.teamer1.id, ORGS.testGemeinde.id]
      );
      await db.query(
        `INSERT INTO event_reminders (event_id, user_id, reminder_type) VALUES ($1, $2, '1_day')`,
        [eventId, USERS.teamer1.id]
      );
      const { rows: [raum] } = await db.query(
        `INSERT INTO chat_rooms (name, type, event_id, created_by, organization_id)
         VALUES ('Konfifreizeit - Chat', 'group', $1, $2, $3) RETURNING id`,
        [eventId, USERS.orgAdmin1.id, ORGS.testGemeinde.id]
      );
      await db.query(
        `INSERT INTO chat_messages (room_id, user_id, user_type, message_type, content)
         VALUES ($1, $2, 'teamer', 'text', 'Wer bringt die Gitarre mit?')`,
        [raum.id, USERS.teamer1.id]
      );
      await db.query(
        `INSERT INTO notifications (user_id, title, message, type, data, organization_id)
         VALUES ($1, 'Anmeldung', 'x', 'event_registered', $2, $3)`,
        [USERS.teamer1.id, JSON.stringify({ event_id: eventId }), ORGS.testGemeinde.id]
      );

      const res = await loeschen();
      expect(res.status).toBe(200);

      expect(await zahl('SELECT COUNT(*)::int AS n FROM events WHERE id = $1', [eventId])).toBe(0);
      expect(await zahl('SELECT COUNT(*)::int AS n FROM event_bookings WHERE event_id = $1', [eventId])).toBe(0);
      expect(await zahl('SELECT COUNT(*)::int AS n FROM event_reminders WHERE event_id = $1', [eventId])).toBe(0);
      expect(await zahl('SELECT COUNT(*)::int AS n FROM chat_rooms WHERE id = $1', [raum.id])).toBe(0);
      expect(await zahl('SELECT COUNT(*)::int AS n FROM chat_messages WHERE room_id = $1', [raum.id])).toBe(0);
      expect(await zahl(`SELECT COUNT(*)::int AS n FROM notifications WHERE data->>'event_id' = $1`, [String(eventId)])).toBe(0);
    });

    it('ein Termin mit ZWEI Jahrgaengen bleibt -- nur die Zuordnung zu diesem faellt weg', async () => {
      const eventId = await termin({ name: 'Gemeinsamer Gottesdienst', jahrgaenge: [alt, JAHRGAENGE.jahrgang1.id] });
      await db.query(
        `INSERT INTO event_bookings (event_id, user_id, status, organization_id) VALUES ($1, $2, 'confirmed', $3)`,
        [eventId, USERS.konfi1.id, ORGS.testGemeinde.id]
      );

      expect((await loeschen()).status).toBe(200);

      expect(await zahl('SELECT COUNT(*)::int AS n FROM events WHERE id = $1', [eventId])).toBe(1);
      const { rows: zuordnungen } = await db.query(
        'SELECT jahrgang_id FROM event_jahrgang_assignments WHERE event_id = $1', [eventId]
      );
      expect(zuordnungen.map((z) => Number(z.jahrgang_id))).toEqual([JAHRGAENGE.jahrgang1.id]);
      expect(await zahl('SELECT COUNT(*)::int AS n FROM event_bookings WHERE event_id = $1', [eventId])).toBe(1);
    });

    it('ein Termin ohne jeden Jahrgang bleibt unberuehrt', async () => {
      const eventId = await termin({ name: 'Gemeindefest', jahrgaenge: [] });
      expect((await loeschen()).status).toBe(200);
      expect(await zahl('SELECT COUNT(*)::int AS n FROM events WHERE id = $1', [eventId])).toBe(1);
    });

    it('ein Pflichttermin des Jahrgangs verwaist nicht mehr: Er geht mit, statt jahrgangslos stehen zu bleiben', async () => {
      const eventId = await termin({ name: 'Konfi-Unterricht', jahrgaenge: [alt], mandatory: true });

      expect((await loeschen()).status).toBe(200);

      expect(await zahl('SELECT COUNT(*)::int AS n FROM events WHERE id = $1', [eventId])).toBe(0);
      // Kein Pflichttermin der Gemeinde steht ohne Jahrgang da (der Zustand,
      // den BF-08 reproduziert hat).
      expect(await zahl(
        `SELECT COUNT(*)::int AS n FROM events e
          WHERE e.organization_id = $1 AND e.mandatory = true
            AND NOT EXISTS (SELECT 1 FROM event_jahrgang_assignments eja WHERE eja.event_id = e.id)`,
        [ORGS.testGemeinde.id]
      )).toBe(0);
    });

    it('ein Termin "Nur Team" bleibt, auch wenn er diesem Jahrgang zugeordnet war -- er gehoert dem ganzen Team', async () => {
      const eventId = await termin({ name: 'Teamer-Vorbereitung', jahrgaenge: [alt], teamerOnly: true });
      expect((await loeschen()).status).toBe(200);
      expect(await zahl('SELECT COUNT(*)::int AS n FROM events WHERE id = $1', [eventId])).toBe(1);
      expect(await zahl('SELECT COUNT(*)::int AS n FROM event_jahrgang_assignments WHERE event_id = $1', [eventId])).toBe(0);
    });

    it('eine Serie des Jahrgangs geht ganz -- auch der erste Termin, auf den die anderen zeigen', async () => {
      const erster = await termin({ name: 'Unterricht 1', jahrgaenge: [alt] });
      const zweiter = await termin({ name: 'Unterricht 2', jahrgaenge: [alt] });
      const dritter = await termin({ name: 'Unterricht 3', jahrgaenge: [alt] });
      await db.query('UPDATE events SET is_series = true, series_id = $1 WHERE id = ANY($2::int[])', [erster, [erster, zweiter, dritter]]);

      const res = await loeschen();
      expect(res.status).toBe(200);
      expect(await zahl('SELECT COUNT(*)::int AS n FROM events WHERE id = ANY($1::int[])', [[erster, zweiter, dritter]])).toBe(0);
    });

    it('vergebene Event-Punkte bleiben gutgeschrieben -- der Jahrgang wird aufgeraeumt, nicht berichtigt', async () => {
      // Befoerderte Ex-Konfi mit Profil in diesem Jahrgang und 2 Punkten aus
      // einem Termin des Jahrgangs.
      await db.query(
        `INSERT INTO konfi_profiles (user_id, jahrgang_id, gottesdienst_points, gemeinde_points, organization_id)
         VALUES ($1, $2, 3, 5, $3)`,
        [USERS.teamer1.id, alt, ORGS.testGemeinde.id]
      );
      const eventId = await termin({ name: 'Konfifreizeit', jahrgaenge: [alt] });
      await db.query(
        `INSERT INTO event_points (konfi_id, event_id, points, point_type, awarded_date, organization_id)
         VALUES ($1, $2, 2, 'gemeinde', CURRENT_DATE - 30, $3)`,
        [USERS.teamer1.id, eventId, ORGS.testGemeinde.id]
      );

      expect((await loeschen()).status).toBe(200);

      const { rows: [profil] } = await db.query(
        'SELECT jahrgang_id, gottesdienst_points, gemeinde_points FROM konfi_profiles WHERE user_id = $1',
        [USERS.teamer1.id]
      );
      expect(profil.jahrgang_id).toBeNull();
      expect(Number(profil.gottesdienst_points)).toBe(3);
      expect(Number(profil.gemeinde_points)).toBe(5);
    });
  });

  // ------------------------------------------------------------------
  // Challenges und Stempel
  // ------------------------------------------------------------------
  describe('Challenges', () => {
    it('eine Challenge NUR in diesem Jahrgang geht mit samt Beitraegen; mit zwei Jahrgaengen bleibt sie; "Nur das Team" bleibt', async () => {
      const nurHier = await challenge({ titel: 'Nur hier', jahrgaenge: [alt] });
      const zwei = await challenge({ titel: 'Zwei Jahrgaenge', jahrgaenge: [alt, JAHRGAENGE.jahrgang1.id] });
      const team = await challenge({ titel: 'Team-Runde', audience: 'nur_team' });
      const ohne = await challenge({ titel: 'Ohne Jahrgang', jahrgaenge: [] });
      await beitrag(nurHier, USERS.teamer1.id);
      await beitrag(zwei, USERS.konfi1.id);
      await db.query(
        `INSERT INTO notifications (user_id, title, message, type, data, organization_id)
         VALUES ($1, 'Stempel erhalten', 'x', 'challenge_badge_earned', $2, $3)`,
        [USERS.teamer1.id, JSON.stringify({ challengeId: nurHier }), ORGS.testGemeinde.id]
      );

      expect((await loeschen()).status).toBe(200);

      const { rows } = await db.query('SELECT id FROM challenges ORDER BY id');
      expect(rows.map((r) => Number(r.id))).toEqual([zwei, team, ohne]);
      expect(await zahl('SELECT COUNT(*)::int AS n FROM challenge_submissions WHERE challenge_id = $1', [nurHier])).toBe(0);
      expect(await zahl('SELECT COUNT(*)::int AS n FROM challenge_submissions WHERE challenge_id = $1', [zwei])).toBe(1);
      const { rows: zuordnungen } = await db.query(
        'SELECT jahrgang_id FROM challenge_jahrgang_assignments WHERE challenge_id = $1', [zwei]
      );
      expect(zuordnungen.map((z) => Number(z.jahrgang_id))).toEqual([JAHRGAENGE.jahrgang1.id]);
      expect(await zahl(`SELECT COUNT(*)::int AS n FROM notifications WHERE data->>'challengeId' = $1`, [String(nurHier)])).toBe(0);
    });

    it('Teamer:in und Leitung behalten ihre Stempel aus der geloeschten Challenge -- sichtbar in "Deine Stempel"', async () => {
      const c = await challenge({ titel: 'Lieblingsort', jahrgaenge: [alt] });
      await beitrag(c, USERS.teamer1.id);
      await beitrag(c, USERS.admin1.id);
      await beitrag(c, USERS.orgAdmin1.id, 'pending'); // noch nicht freigegeben -> kein Stempel

      // Vorher: der Stempel kommt aus dem Beitrag, die bewahrte Liste ist leer
      // (sonst stuende derselbe Stempel zweimal da).
      const vorher = await request(app).get('/api/challenges/bewahrte-stempel')
        .set('Authorization', `Bearer ${generateToken('teamer1')}`);
      expect(vorher.status).toBe(200);
      expect(vorher.body).toEqual([]);

      expect((await loeschen()).status).toBe(200);

      const teamer = await request(app).get('/api/challenges/bewahrte-stempel')
        .set('Authorization', `Bearer ${generateToken('teamer1')}`);
      expect(teamer.status).toBe(200);
      expect(teamer.body).toHaveLength(1);
      expect(teamer.body[0]).toMatchObject({
        challenge_id: c,
        badge_name: 'Stempel Lieblingsort',
        badge_icon: 'leaf',
        title: 'Lieblingsort',
        description: 'Beschreibung',
        bewahrt: true
      });
      // earned_at ist die Freigabe des Beitrags (vor 40 Tagen), nicht das Loeschen.
      const alterInTagen = (Date.now() - new Date(teamer.body[0].earned_at).getTime()) / 86400000;
      expect(Math.round(alterInTagen)).toBe(40);

      const admin = await request(app).get('/api/challenges/bewahrte-stempel')
        .set('Authorization', `Bearer ${generateToken('admin1')}`);
      expect(admin.body.map((s) => s.badge_name)).toEqual(['Stempel Lieblingsort']);

      const orgAdminEigene = await request(app).get('/api/challenges/bewahrte-stempel')
        .set('Authorization', `Bearer ${orgAdmin()}`);
      expect(orgAdminEigene.body).toEqual([]);
    });

    it('Konfi-Stempel werden nicht bewahrt -- ihr Andenken sind die Abzeichen', async () => {
      const c = await challenge({ titel: 'Konfi-Runde', jahrgaenge: [alt] });
      await beitrag(c, USERS.konfi2.id);
      expect((await loeschen()).status).toBe(200);
      expect(await zahl('SELECT COUNT(*)::int AS n FROM bewahrte_stempel WHERE user_id = $1', [USERS.konfi2.id])).toBe(0);
    });

    it('die Leitung sieht die bewahrten Stempel einer Teamer:in; Teamer:innen und fremde Gemeinden nicht', async () => {
      const c = await challenge({ titel: 'Lieblingsort', jahrgaenge: [alt] });
      await beitrag(c, USERS.teamer1.id);
      expect((await loeschen()).status).toBe(200);

      const leitung = await request(app).get(`/api/challenges/admin/bewahrte-stempel/${USERS.teamer1.id}`)
        .set('Authorization', `Bearer ${orgAdmin()}`);
      expect(leitung.status).toBe(200);
      expect(leitung.body.map((s) => s.challenge_id)).toEqual([c]);

      const alsTeamer = await request(app).get(`/api/challenges/admin/bewahrte-stempel/${USERS.teamer1.id}`)
        .set('Authorization', `Bearer ${generateToken('teamer1')}`);
      expect(alsTeamer.status).toBe(403);

      const fremd = await request(app).get(`/api/challenges/admin/bewahrte-stempel/${USERS.teamer1.id}`)
        .set('Authorization', `Bearer ${generateToken('orgAdmin2')}`);
      expect(fremd.status).toBe(200);
      expect(fremd.body).toEqual([]);
    });

    it('Konfi-Abzeichen einer Befoerderten bleiben (user_badges wird nicht angefasst)', async () => {
      await db.query(
        `INSERT INTO konfi_profiles (user_id, jahrgang_id, gottesdienst_points, gemeinde_points, organization_id)
         VALUES ($1, $2, 0, 0, $3)`,
        [USERS.teamer1.id, alt, ORGS.testGemeinde.id]
      );
      await db.query(
        'INSERT INTO user_badges (user_id, badge_id, organization_id) VALUES ($1, $2, $3), ($1, $4, $3)',
        [USERS.teamer1.id, BADGES.streak.id, ORGS.testGemeinde.id, BADGES.yearly.id]
      );
      await termin({ name: 'Konfifreizeit', jahrgaenge: [alt] });
      await challenge({ titel: 'Lieblingsort', jahrgaenge: [alt] });

      expect((await loeschen()).status).toBe(200);
      expect(await zahl('SELECT COUNT(*)::int AS n FROM user_badges WHERE user_id = $1', [USERS.teamer1.id])).toBe(2);
    });
  });

  // ------------------------------------------------------------------
  // Transaktion
  // ------------------------------------------------------------------
  describe('eine Transaktion', () => {
    it('bricht das Loeschen am letzten Schritt ab, bleibt ALLES stehen -- Termine, Challenges, Chat, Stempel', async () => {
      const eventId = await termin({ name: 'Konfifreizeit', jahrgaenge: [alt] });
      await db.query(
        `INSERT INTO event_bookings (event_id, user_id, status, organization_id) VALUES ($1, $2, 'confirmed', $3)`,
        [eventId, USERS.teamer1.id, ORGS.testGemeinde.id]
      );
      const c = await challenge({ titel: 'Lieblingsort', jahrgaenge: [alt] });
      await beitrag(c, USERS.teamer1.id);
      const { rows: [raum] } = await db.query(
        `INSERT INTO chat_rooms (name, type, jahrgang_id, created_by, organization_id)
         VALUES ('Jahrgang 2023/2024', 'jahrgang', $1, $2, $3) RETURNING id`,
        [alt, USERS.orgAdmin1.id, ORGS.testGemeinde.id]
      );

      // Erzwungener Fehler genau beim DELETE FROM jahrgaenge -- nach allen
      // anderen Schritten.
      await db.query(`
        CREATE OR REPLACE FUNCTION test_jahrgang_loeschen_abbrechen() RETURNS trigger AS $$
        BEGIN RAISE EXCEPTION 'erzwungener Abbruch'; END; $$ LANGUAGE plpgsql`);
      await db.query(`
        CREATE TRIGGER test_jahrgang_loeschen_abbruch BEFORE DELETE ON jahrgaenge
        FOR EACH ROW EXECUTE FUNCTION test_jahrgang_loeschen_abbrechen()`);
      let res;
      try {
        res = await loeschen();
      } finally {
        await db.query('DROP TRIGGER IF EXISTS test_jahrgang_loeschen_abbruch ON jahrgaenge');
        await db.query('DROP FUNCTION IF EXISTS test_jahrgang_loeschen_abbrechen()');
      }

      expect(res.status).toBe(500);
      expect(await zahl('SELECT COUNT(*)::int AS n FROM jahrgaenge WHERE id = $1', [alt])).toBe(1);
      expect(await zahl('SELECT COUNT(*)::int AS n FROM events WHERE id = $1', [eventId])).toBe(1);
      expect(await zahl('SELECT COUNT(*)::int AS n FROM event_bookings WHERE event_id = $1', [eventId])).toBe(1);
      expect(await zahl('SELECT COUNT(*)::int AS n FROM challenges WHERE id = $1', [c])).toBe(1);
      expect(await zahl('SELECT COUNT(*)::int AS n FROM challenge_submissions WHERE challenge_id = $1', [c])).toBe(1);
      expect(await zahl('SELECT COUNT(*)::int AS n FROM chat_rooms WHERE id = $1', [raum.id])).toBe(1);
      expect(await zahl('SELECT COUNT(*)::int AS n FROM bewahrte_stempel', [])).toBe(0);
    });
  });

  // ------------------------------------------------------------------
  // Vorschau fuer den Bestaetigungsdialog
  // ------------------------------------------------------------------
  describe('GET /admin/jahrgaenge/:id/loeschvorschau', () => {
    it('nennt genau das, was das Loeschen dann tut', async () => {
      await termin({ name: 'Vergangen', jahrgaenge: [alt], tageVersatz: -30 });
      await termin({ name: 'Kuenftig', jahrgaenge: [alt], tageVersatz: 30 });
      await termin({ name: 'Zwei', jahrgaenge: [alt, JAHRGAENGE.jahrgang1.id] });
      await termin({ name: 'Team', jahrgaenge: [alt], teamerOnly: true });
      await termin({ name: 'Ohne', jahrgaenge: [] });
      await challenge({ titel: 'Nur hier', jahrgaenge: [alt] });
      await challenge({ titel: 'Zwei', jahrgaenge: [alt, JAHRGAENGE.jahrgang1.id] });
      await db.query(
        `INSERT INTO konfi_profiles (user_id, jahrgang_id, gottesdienst_points, gemeinde_points, organization_id)
         VALUES ($1, $2, 0, 0, $3)`,
        [USERS.teamer1.id, alt, ORGS.testGemeinde.id]
      );

      const res = await request(app).get(`/api/admin/jahrgaenge/${alt}/loeschvorschau`)
        .set('Authorization', `Bearer ${orgAdmin()}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        aktive_konfis: 0,
        befoerderte: 1,
        chat_nachrichten: 0,
        events_geloescht: 2,
        events_kuenftig: 1,
        events_behalten: 2,
        challenges_geloescht: 1,
        challenges_behalten: 1
      });

      // Und das Loeschen tut genau das: 5 Termine vorher, 3 danach.
      expect((await loeschen()).status).toBe(200);
      expect(await zahl('SELECT COUNT(*)::int AS n FROM events WHERE name = ANY($1)', [['Vergangen', 'Kuenftig', 'Zwei', 'Team', 'Ohne']])).toBe(3);
    });

    it('zaehlt aktive Konfis und Chat-Nachrichten mit (die das Loeschen blockieren bzw. bestaetigen lassen)', async () => {
      const res = await request(app).get(`/api/admin/jahrgaenge/${JAHRGAENGE.jahrgang1.id}/loeschvorschau`)
        .set('Authorization', `Bearer ${orgAdmin()}`);
      expect(res.status).toBe(200);
      expect(res.body.aktive_konfis).toBe(2);
      expect(res.body.events_geloescht).toBe(3); // die drei Seed-Termine der Gemeinde 1
    });

    it('verlangt dieselben Rechte wie das Loeschen: Teamer 403, Admin ohne Zuweisung 403, fremde Gemeinde 404', async () => {
      const teamer = await request(app).get(`/api/admin/jahrgaenge/${alt}/loeschvorschau`)
        .set('Authorization', `Bearer ${generateToken('teamer1')}`);
      expect(teamer.status).toBe(403);

      const adminOhne = await request(app).get(`/api/admin/jahrgaenge/${alt}/loeschvorschau`)
        .set('Authorization', `Bearer ${generateToken('admin1')}`);
      expect(adminOhne.status).toBe(403);

      const fremd = await request(app).get(`/api/admin/jahrgaenge/${alt}/loeschvorschau`)
        .set('Authorization', `Bearer ${generateToken('orgAdmin2')}`);
      expect(fremd.status).toBe(404);
    });
  });
});

// ------------------------------------------------------------------
// Einzel-Loeschen eines Serientermins (derselbe Loeschweg)
// ------------------------------------------------------------------
describe('DELETE /events/:id -- der erste Termin einer Serie', () => {
  let app;
  let db;

  beforeAll(() => {
    db = getTestPool();
    app = getTestApp(db);
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
  });

  afterAll(async () => {
    await closePool();
  });

  it('laesst sich loeschen; die uebrigen Termine zeigen danach auf den naechsten der Serie', async () => {
    const ids = [];
    for (const n of [1, 2, 3]) {
      const { rows: [e] } = await db.query(
        `INSERT INTO events (name, event_date, organization_id, max_participants, point_type, points, is_series)
         VALUES ($1, NOW() + ($2 || ' days')::interval, $3, 0, 'gemeinde', 1, true) RETURNING id`,
        [`Unterricht ${n}`, String(n * 7), ORGS.testGemeinde.id]
      );
      ids.push(e.id);
    }
    await db.query('UPDATE events SET series_id = $1 WHERE id = ANY($2::int[])', [ids[0], ids]);

    const res = await request(app).delete(`/api/events/${ids[0]}`)
      .set('Authorization', `Bearer ${generateToken('orgAdmin1')}`);
    expect(res.status).toBe(200);

    const { rows } = await db.query('SELECT id, series_id FROM events WHERE id = ANY($1::int[]) ORDER BY id', [ids]);
    expect(rows.map((r) => [Number(r.id), Number(r.series_id)])).toEqual([[ids[1], ids[1]], [ids[2], ids[1]]]);
  });

  it('eine ganze Serie parallel loeschen (so macht es die App) -- jede Anfrage gelingt', async () => {
    const ids = [];
    for (const n of [1, 2, 3, 4, 5]) {
      const { rows: [e] } = await db.query(
        `INSERT INTO events (name, event_date, organization_id, max_participants, point_type, points, is_series)
         VALUES ($1, NOW() + ($2 || ' days')::interval, $3, 0, 'gemeinde', 1, true) RETURNING id`,
        [`Unterricht ${n}`, String(n * 7), ORGS.testGemeinde.id]
      );
      ids.push(e.id);
    }
    await db.query('UPDATE events SET series_id = $1 WHERE id = ANY($2::int[])', [ids[0], ids]);

    const token = generateToken('orgAdmin1');
    const antworten = await Promise.all(
      ids.map((id) => request(app).delete(`/api/events/${id}`).set('Authorization', `Bearer ${token}`))
    );
    expect(antworten.map((r) => r.status)).toEqual([200, 200, 200, 200, 200]);
    const { rows: [{ n }] } = await db.query('SELECT COUNT(*)::int AS n FROM events WHERE id = ANY($1::int[])', [ids]);
    expect(n).toBe(0);
  });
});
