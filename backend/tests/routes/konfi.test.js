const request = require('supertest');
const { getTestApp } = require('../helpers/testApp');
const { getTestPool, truncateAll, closePool } = require('../helpers/db');
const { seed, USERS, EVENTS, ACTIVITIES, JAHRGAENGE, ORGS, CHAT_ROOMS, BADGES } = require('../helpers/seed');
const { generateToken } = require('../helpers/auth');

describe('Konfi Routes', () => {
  let app;
  let db;
  let konfiToken;
  let adminToken;
  let konfi3Token;

  beforeAll(async () => {
    db = getTestPool();
    app = getTestApp(db);
  });

  beforeEach(async () => {
    await truncateAll(db);
    await seed(db);
    konfiToken = generateToken('konfi1');
    adminToken = generateToken('admin1');
    konfi3Token = generateToken('konfi3');
  });

  afterAll(async () => {
    await closePool();
  });

  // ================================================================
  // GET /api/konfi/dashboard
  // ================================================================
  describe('GET /api/konfi/dashboard', () => {
    it('Konfi bekommt 200 + Dashboard-Daten mit Aggregation', async () => {
      const res = await request(app)
        .get('/api/konfi/dashboard')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(200);
      // Konfi-Objekt mit Punkten
      expect(res.body.konfi).toBeDefined();
      expect(res.body.konfi.gottesdienst_points).toBeDefined();
      expect(res.body.konfi.gemeinde_points).toBeDefined();
      expect(res.body.konfi.display_name).toBe(USERS.konfi1.display_name);
      // Aggregierte Felder
      expect(res.body.total_points).toBeDefined();
      expect(typeof res.body.total_points).toBe('number');
      expect(res.body.level_info).toBeDefined();
      expect(res.body.level_info.current_level).toBeDefined();
      expect(res.body.level_info.all_levels).toBeDefined();
      expect(Array.isArray(res.body.level_info.all_levels)).toBe(true);
      expect(res.body.ranking).toBeDefined();
      expect(Array.isArray(res.body.ranking)).toBe(true);
      expect(res.body.badge_count).toBeDefined();
      expect(typeof res.body.badge_count).toBe('number');
      expect(res.body.event_count).toBeDefined();
      expect(typeof res.body.event_count).toBe('number');
      // Dashboard-Config
      expect(res.body.point_config).toBeDefined();
      expect(res.body.dashboard_config).toBeDefined();
    });

    it('Struktur-Kontrakt: alle Kern-Felder der (parallelisierten) Response vorhanden', async () => {
      // Absicherung fuer die Query-Parallelisierung (Audit Achse 4, Fund 8):
      // Nach dem Umbau auf Promise.all muss die Response-Struktur byte-identisch
      // bleiben. Dieser Test prueft, dass JEDES Feld aus den parallelisierten
      // Queries weiterhin an derselben Stelle steht.
      const res = await request(app)
        .get('/api/konfi/dashboard')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(200);
      // Aus badgeCount/badges-Query
      expect(res.body).toHaveProperty('badge_count');
      expect(res.body).toHaveProperty('recent_badges');
      expect(Array.isArray(res.body.recent_badges)).toBe(true);
      // Aus ranking-Query
      expect(res.body).toHaveProperty('ranking');
      expect(Array.isArray(res.body.ranking)).toBe(true);
      // Aus userRanking-Query
      expect(res.body).toHaveProperty('rank_in_jahrgang');
      expect(res.body).toHaveProperty('total_in_jahrgang');
      // Aus eventCount/recentEvents-Query
      expect(res.body).toHaveProperty('event_count');
      expect(res.body).toHaveProperty('recent_events');
      expect(Array.isArray(res.body.recent_events)).toBe(true);
      // Aus allLevels-Query (in level_info verpackt)
      expect(res.body.level_info).toHaveProperty('all_levels');
      expect(res.body.level_info).toHaveProperty('total_levels');
      expect(res.body.level_info).toHaveProperty('level_index');
      // Aus wrapped-Query
      expect(res.body).toHaveProperty('has_wrapped');
      expect(typeof res.body.has_wrapped).toBe('boolean');
      // Aus dashboardSettings-Query
      expect(res.body.dashboard_config).toHaveProperty('section_order');
      expect(res.body).toHaveProperty('konfspruch_visible');
    });

    it('Default-section_order enthaelt konfispruch (Phase 118 Card sichtbar)', async () => {
      const res = await request(app)
        .get('/api/konfi/dashboard')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(200);
      expect(res.body.dashboard_config).toBeDefined();
      expect(Array.isArray(res.body.dashboard_config.section_order)).toBe(true);
      expect(res.body.dashboard_config.section_order).toContain('konfispruch');
    });

    it('Admin bekommt 403 (type !== konfi)', async () => {
      const res = await request(app)
        .get('/api/konfi/dashboard')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBeDefined();
    });

    it('Ohne Token gibt 401', async () => {
      const res = await request(app)
        .get('/api/konfi/dashboard');

      expect(res.status).toBe(401);
    });

    it('Soft-geloeschter Mit-Konfi zaehlt NICHT ins Ranking und erscheint nicht', async () => {
      // konfi1 und konfi2 sind beide im selben Jahrgang (jahrgang1)
      // Vor Soft-Delete: total_in_jahrgang = 2
      const before = await request(app)
        .get('/api/konfi/dashboard')
        .set('Authorization', `Bearer ${konfiToken}`);
      expect(before.status).toBe(200);
      expect(Number(before.body.total_in_jahrgang)).toBe(2);

      // konfi2 soft-loeschen
      await db.query('UPDATE users SET deleted_at = NOW() WHERE id = $1', [USERS.konfi2.id]);

      const after = await request(app)
        .get('/api/konfi/dashboard')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(after.status).toBe(200);
      // Nur noch 1 aktiver Konfi im Jahrgang
      expect(Number(after.body.total_in_jahrgang)).toBe(1);
      // Der soft-geloeschte Konfi erscheint nicht im ranking-Array
      const rankingIds = after.body.ranking.map((r) => r.id);
      expect(rankingIds).not.toContain(USERS.konfi2.id);
      expect(rankingIds).toContain(USERS.konfi1.id);
    });

    it('konfspruch_visible ist true wenn jahrgaenge.konfspruch_enabled=true', async () => {
      await db.query('UPDATE jahrgaenge SET konfspruch_enabled = true WHERE id = $1', [JAHRGAENGE.jahrgang1.id]);

      const res = await request(app)
        .get('/api/konfi/dashboard')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(200);
      expect(res.body.konfspruch_visible).toBe(true);
    });

    it('konfspruch_visible ist false wenn jahrgaenge.konfspruch_enabled=false', async () => {
      await db.query('UPDATE jahrgaenge SET konfspruch_enabled = false WHERE id = $1', [JAHRGAENGE.jahrgang1.id]);

      const res = await request(app)
        .get('/api/konfi/dashboard')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(200);
      expect(res.body.konfspruch_visible).toBe(false);
    });

    it('confirmation_date stammt aus dem is_konfirmation-Event des Jahrgangs', async () => {
      // is_konfirmation-Event anlegen und jahrgang1 zuordnen.
      await db.query(
        `INSERT INTO events (id, name, event_date, organization_id, is_konfirmation, cancelled, location, mandatory, has_timeslots)
         VALUES (9101, 'Konfirmation', '2026-05-10 10:00:00', $1, true, false, 'St. Martin', false, false)`,
        [ORGS.testGemeinde.id]
      );
      await db.query(
        `INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) VALUES (9101, $1)`,
        [JAHRGAENGE.jahrgang1.id]
      );
      // Termin kommt jetzt PRO KONFI aus dem confirmed-gebuchten is_konfirmation-Event.
      await db.query(
        `INSERT INTO event_bookings (event_id, user_id, status, organization_id)
         VALUES (9101, $1, 'confirmed', $2)`,
        [USERS.konfi1.id, ORGS.testGemeinde.id]
      );

      const res = await request(app)
        .get('/api/konfi/dashboard')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(200);
      expect(res.body.confirmation_date).not.toBeNull();
      expect(new Date(res.body.confirmation_date).getUTCFullYear()).toBe(2026);
      expect(res.body.konfi.confirmation_location).toBe('St. Martin');
    });
  });

  // ================================================================
  // GET /api/konfi/profile
  // ================================================================
  describe('GET /api/konfi/profile', () => {
    it('Konfi bekommt 200 + Profil-Daten mit Punkte-Info', async () => {
      const res = await request(app)
        .get('/api/konfi/profile')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(200);
      expect(res.body.display_name).toBe(USERS.konfi1.display_name);
      expect(res.body.username).toBe(USERS.konfi1.username);
      expect(res.body.gottesdienst_points).toBeDefined();
      expect(res.body.gemeinde_points).toBeDefined();
      expect(res.body.jahrgang_name).toBeDefined();
    });

    it('Admin bekommt 403', async () => {
      const res = await request(app)
        .get('/api/konfi/profile')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(403);
    });

    it('confirmation_date stammt aus gebuchtem is_konfirmation-Event (kein Jahrgang-Fallback)', async () => {
      // is_konfirmation-Event anlegen und konfi1 bestaetigt buchen.
      await db.query(
        `INSERT INTO events (id, name, event_date, organization_id, is_konfirmation, cancelled, location, mandatory, has_timeslots, max_participants)
         VALUES (9201, 'Konfirmation', '2026-05-10 10:00:00', $1, true, false, 'St. Martin', false, false, 100)`,
        [ORGS.testGemeinde.id]
      );
      await db.query(
        `INSERT INTO event_bookings (user_id, event_id, status, organization_id)
         VALUES ($1, 9201, 'confirmed', $2)`,
        [USERS.konfi1.id, ORGS.testGemeinde.id]
      );

      const res = await request(app)
        .get('/api/konfi/profile')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(200);
      expect(res.body.confirmation_date).not.toBeNull();
      expect(new Date(res.body.confirmation_date).getUTCFullYear()).toBe(2026);
      expect(res.body.confirmation_location).toBe('St. Martin');
    });

    it('confirmation_date ist null wenn kein is_konfirmation-Event gebucht', async () => {
      const res = await request(app)
        .get('/api/konfi/profile')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(200);
      expect(res.body.confirmation_date == null).toBe(true);
    });
  });

  // ================================================================
  // Konfispruch (GET /konfsprueche, GET /profile.konfspruch, PATCH /profile)
  // ================================================================
  describe('Konfispruch', () => {
    // truncateAll leert konfsprueche nach jedem Test (der Migration-Seed ist dann weg).
    // Daher pro Test einen globalen Spruch + seine 4 Uebersetzungen frisch anlegen.
    async function seedSpruch() {
      const { rows: [spruch] } = await db.query(
        `INSERT INTO konfsprueche (reference, book, chapter, verse, organization_id, sort_order)
         VALUES ('Josua 1,9', 'Josua', 1, 9, NULL, 1)
         RETURNING id`
      );
      const texte = {
        luther2017: 'Sei getrost und unverzagt.',
        bigs: 'Sei mutig und entschlossen.',
        gute_nachricht: 'Sei stark und entschlossen.',
        elberfelder: 'Sei stark und mutig.'
      };
      for (const [translation, text] of Object.entries(texte)) {
        await db.query(
          `INSERT INTO konfspruch_uebersetzungen (spruch_id, translation, text)
           VALUES ($1, $2, $3)`,
          [spruch.id, translation, text]
        );
      }
      return spruch.id;
    }

    it('GET /konfsprueche liefert 200 + Array mit Referenz und 4 Uebersetzungs-Keys', async () => {
      await seedSpruch();
      const res = await request(app)
        .get('/api/konfi/konfsprueche')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);
      const eintrag = res.body.find((s) => s.reference === 'Josua 1,9');
      expect(eintrag).toBeDefined();
      expect(eintrag.uebersetzungen).toBeDefined();
      expect(Object.keys(eintrag.uebersetzungen).sort()).toEqual(
        ['bigs', 'elberfelder', 'gute_nachricht', 'luther2017']
      );
      expect(eintrag.uebersetzungen.luther2017).toBe('Sei getrost und unverzagt.');
    });

    it('GET /konfsprueche als Admin gibt 403', async () => {
      const res = await request(app)
        .get('/api/konfi/konfsprueche')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(403);
    });

    it('PATCH /profile Listen-Wahl setzt Spruch; GET /profile liefert source=liste', async () => {
      const spruchId = await seedSpruch();
      const patch = await request(app)
        .patch('/api/konfi/profile')
        .set('Authorization', `Bearer ${konfiToken}`)
        .send({ konfspruch_id: spruchId, translation: 'luther2017' });

      expect(patch.status).toBe(200);
      expect(patch.body.success).toBe(true);

      const prof = await request(app)
        .get('/api/konfi/profile')
        .set('Authorization', `Bearer ${konfiToken}`);
      expect(prof.status).toBe(200);
      expect(prof.body.konfspruch).toBeDefined();
      expect(prof.body.konfspruch.source).toBe('liste');
      expect(prof.body.konfspruch.id).toBe(spruchId);
      expect(prof.body.konfspruch.translation).toBe('luther2017');
      expect(prof.body.konfspruch.text).toBe('Sei getrost und unverzagt.');
    });

    it('PATCH /profile Freitext setzt eigenen Spruch; GET /profile liefert source=freitext', async () => {
      const patch = await request(app)
        .patch('/api/konfi/profile')
        .set('Authorization', `Bearer ${konfiToken}`)
        .send({ konfspruch_freitext: 'Mein Spruch', konfspruch_freitext_referenz: 'Joh 3,16' });

      expect(patch.status).toBe(200);
      expect(patch.body.success).toBe(true);

      const prof = await request(app)
        .get('/api/konfi/profile')
        .set('Authorization', `Bearer ${konfiToken}`);
      expect(prof.status).toBe(200);
      expect(prof.body.konfspruch.source).toBe('freitext');
      expect(prof.body.konfspruch.text).toBe('Mein Spruch');
      expect(prof.body.konfspruch.reference).toBe('Joh 3,16');
    });

    it('PATCH /profile Freitext OHNE Referenz gibt 400 (Pflicht-Referenz)', async () => {
      const res = await request(app)
        .patch('/api/konfi/profile')
        .set('Authorization', `Bearer ${konfiToken}`)
        .send({ konfspruch_freitext: 'Mein Spruch ohne Stelle' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('PATCH Listen-Wahl nach Freitext loescht den Freitext (Exklusivitaet)', async () => {
      const spruchId = await seedSpruch();
      // Erst Freitext setzen
      await request(app)
        .patch('/api/konfi/profile')
        .set('Authorization', `Bearer ${konfiToken}`)
        .send({ konfspruch_freitext: 'Alter Freitext', konfspruch_freitext_referenz: 'Ps 23,1' });
      // Dann Listen-Wahl setzen
      const patch = await request(app)
        .patch('/api/konfi/profile')
        .set('Authorization', `Bearer ${konfiToken}`)
        .send({ konfspruch_id: spruchId, translation: 'elberfelder' });
      expect(patch.status).toBe(200);

      const prof = await request(app)
        .get('/api/konfi/profile')
        .set('Authorization', `Bearer ${konfiToken}`);
      expect(prof.body.konfspruch.source).toBe('liste');
      // Freitext-Felder sind nicht mehr aktiv
      expect(prof.body.konfspruch_freitext).toBeNull();
    });

    it('PATCH /profile mit ungueltiger translation gibt 400', async () => {
      const spruchId = await seedSpruch();
      const res = await request(app)
        .patch('/api/konfi/profile')
        .set('Authorization', `Bearer ${konfiToken}`)
        .send({ konfspruch_id: spruchId, translation: 'klingonisch' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('PATCH /profile als Admin gibt 403 (RBAC)', async () => {
      const res = await request(app)
        .patch('/api/konfi/profile')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ konfspruch_freitext: 'X', konfspruch_freitext_referenz: 'Ps 1,1' });

      expect(res.status).toBe(403);
    });
  });

  // ================================================================
  // GET /api/konfi/points-history
  // ================================================================
  describe('GET /api/konfi/points-history', () => {
    it('Konfi bekommt 200 + History mit Totals', async () => {
      const res = await request(app)
        .get('/api/konfi/points-history')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(200);
      expect(res.body.history).toBeDefined();
      expect(Array.isArray(res.body.history)).toBe(true);
      expect(res.body.totals).toBeDefined();
      expect(res.body.totals.gottesdienst).toBeDefined();
      expect(res.body.totals.gemeinde).toBeDefined();
      expect(res.body.totals.total).toBeDefined();
    });

    it('Konfi1 hat mindestens 1 Bonus-Eintrag aus Seed', async () => {
      const res = await request(app)
        .get('/api/konfi/points-history')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(200);
      // Seed hat bonus_points fuer konfi1 (3 Punkte Sonderpunkte Weihnachten)
      const bonusEntries = res.body.history.filter(h => h.source_type === 'bonus');
      expect(bonusEntries.length).toBeGreaterThanOrEqual(1);
      expect(bonusEntries[0].title).toBe('Sonderpunkte Weihnachten');
    });

    it('Admin bekommt 403', async () => {
      const res = await request(app)
        .get('/api/konfi/points-history')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(403);
    });
  });

  // ================================================================
  // GET /api/konfi/activities
  // ================================================================
  describe('GET /api/konfi/activities', () => {
    it('Konfi bekommt 200 + Aktivitaeten der eigenen Org', async () => {
      const res = await request(app)
        .get('/api/konfi/activities')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      // Org 1 hat 4 Aktivitaeten
      expect(res.body.length).toBe(4);
      const names = res.body.map(a => a.name);
      expect(names).toContain('Sonntagsgottesdienst');
      expect(names).toContain('Gemeindefest');
    });

    it('Konfi3 (Org 2) sieht nur Org-2-Aktivitaeten', async () => {
      const res = await request(app)
        .get('/api/konfi/activities')
        .set('Authorization', `Bearer ${konfi3Token}`);

      expect(res.status).toBe(200);
      // Org 2 hat 2 Aktivitaeten
      expect(res.body.length).toBe(2);
    });
  });

  // ================================================================
  // GET /api/konfi/badges
  // ================================================================
  describe('GET /api/konfi/badges', () => {
    it('Konfi bekommt 200 + Badge-Liste', async () => {
      const res = await request(app)
        .get('/api/konfi/badges')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(200);
      // Response hat available/earned oder Array
      expect(res.body).toBeDefined();
    });

    it('Admin bekommt 403', async () => {
      const res = await request(app)
        .get('/api/konfi/badges')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(403);
    });
  });

  // ================================================================
  // GET /api/konfi/badges - Progress-Berechnung (Prozent-Bug-Fix, Phase 116-02)
  // ================================================================
  describe('GET /api/konfi/badges Progress-Berechnung', () => {
    // Hilfsfunktion: Badge fuer Org 1, target_role=konfi anlegen
    async function createKonfiBadge(criteriaType, criteriaValue, criteriaExtra = null) {
      const { rows: [badge] } = await db.query(
        `INSERT INTO custom_badges (name, criteria_type, criteria_value, criteria_extra, icon, color, organization_id, target_role, is_active)
         VALUES ($1, $2, $3, $4, 'checkmark', '#10b981', $5, 'konfi', true)
         RETURNING id`,
        [`Badge ${criteriaType}-${Math.random()}`, criteriaType, criteriaValue, criteriaExtra ? JSON.stringify(criteriaExtra) : null, ORGS.testGemeinde.id]
      );
      return badge.id;
    }

    // Hilfsfunktion: N Events anlegen und konfi1 mit attendance_status buchen
    async function createEventsWithPresence(count, mandatory = false, present = true) {
      for (let i = 0; i < count; i++) {
        const { rows: [ev] } = await db.query(
          `INSERT INTO events (name, event_date, organization_id, mandatory, max_participants, point_type, points)
           VALUES ($1, NOW() - interval '1 day', $2, $3, 0, 'gemeinde', 0)
           RETURNING id`,
          [`Event ${i}-${Math.random()}`, ORGS.testGemeinde.id, mandatory]
        );
        await db.query(
          `INSERT INTO event_bookings (user_id, event_id, organization_id, status, attendance_status)
           VALUES ($1, $2, $3, 'confirmed', $4)`,
          [USERS.konfi1.id, ev.id, ORGS.testGemeinde.id, present ? 'present' : 'absent']
        );
      }
    }

    // Hilfsfunktion: Aktivitaet mit exaktem Namen anlegen und konfi1 N-mal zuweisen
    async function createActivityWithCompletions(name, count) {
      const { rows: [act] } = await db.query(
        `INSERT INTO activities (name, points, type, organization_id, target_role)
         VALUES ($1, 1, 'gottesdienst', $2, 'konfi')
         RETURNING id`,
        [name, ORGS.testGemeinde.id]
      );
      for (let i = 0; i < count; i++) {
        await db.query(
          `INSERT INTO user_activities (user_id, activity_id, completed_date, admin_id, organization_id)
           VALUES ($1, $2, NOW(), $3, $4)`,
          [USERS.konfi1.id, act.id, USERS.admin1.id, ORGS.testGemeinde.id]
        );
      }
      return act.id;
    }

    function findBadge(body, badgeId) {
      const all = Array.isArray(body) ? body : [...(body.available || []), ...(body.earned || [])];
      return all.find(b => b.id === badgeId);
    }

    it('event_count: 4 besuchte Events, value=6 -> current=4, percentage ca. 66', async () => {
      const badgeId = await createKonfiBadge('event_count', 6);
      await createEventsWithPresence(4, false, true);

      const res = await request(app)
        .get('/api/konfi/badges')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(200);
      const badge = findBadge(res.body, badgeId);
      expect(badge).toBeDefined();
      expect(badge.progress.current).toBe(4);
      expect(badge.progress.percentage).toBeGreaterThan(0);
      expect(Math.round(badge.progress.percentage)).toBe(67);
    });

    it('mandatory_event_count: 3 besuchte Pflicht-Events, value=12 -> current=3, percentage=25', async () => {
      const badgeId = await createKonfiBadge('mandatory_event_count', 12);
      // 3 Pflicht-Events besucht + 2 Nicht-Pflicht (besucht) + 1 Pflicht (nicht besucht)
      await createEventsWithPresence(3, true, true);
      await createEventsWithPresence(2, false, true);
      await createEventsWithPresence(1, true, false);

      const res = await request(app)
        .get('/api/konfi/badges')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(200);
      const badge = findBadge(res.body, badgeId);
      expect(badge).toBeDefined();
      expect(badge.progress.current).toBe(3);
      expect(badge.progress.percentage).toBe(25);
    });

    it('KONSISTENZ: mandatory_event_count Progress.current == Wertungs-COUNT (gleicher Konfi)', async () => {
      // Badge value=12, Konfi hat genau 3 besuchte Pflicht-Events
      const badgeId = await createKonfiBadge('mandatory_event_count', 12);
      await createEventsWithPresence(3, true, true);
      await createEventsWithPresence(4, false, true); // Nicht-Pflicht zaehlt nicht
      await createEventsWithPresence(2, true, false); // nicht besucht zaehlt nicht

      // Pfad A: Wertung (badges.js) -> dieselbe Query
      const { checkAndAwardBadges } = require('../../routes/badges');
      await checkAndAwardBadges(db, USERS.konfi1.id);
      const { rows: [mandRow] } = await db.query(
        `SELECT COUNT(*)::int as count FROM event_bookings eb JOIN events e ON eb.event_id = e.id
         WHERE eb.user_id = $1 AND eb.attendance_status = 'present' AND e.mandatory = true AND eb.organization_id = $2`,
        [USERS.konfi1.id, ORGS.testGemeinde.id]
      );
      const wertungCount = mandRow.count;

      // Pfad B: Progress (konfi.js)
      const res = await request(app)
        .get('/api/konfi/badges')
        .set('Authorization', `Bearer ${konfiToken}`);
      const badge = findBadge(res.body, badgeId);

      expect(wertungCount).toBe(3);
      expect(badge.progress.current).toBe(wertungCount); // Byte-Konsistenz der Query
    });

    it('specific_activity: required_activity_name, 2 Erledigungen -> current=2 (Extra-Feld-Fix)', async () => {
      await createActivityWithCompletions('Pfingst-Spezial', 2);
      const badgeId = await createKonfiBadge('specific_activity', 5, { required_activity_name: 'Pfingst-Spezial' });

      const res = await request(app)
        .get('/api/konfi/badges')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(200);
      const badge = findBadge(res.body, badgeId);
      expect(badge).toBeDefined();
      expect(badge.progress.current).toBe(2);
    });

    it('activity_combination: required_activities=[A,B], A erledigt -> current=1 (Extra-Feld-Fix)', async () => {
      await createActivityWithCompletions('Kombi-A', 1);
      const badgeId = await createKonfiBadge('activity_combination', 2, { required_activities: ['Kombi-A', 'Kombi-B'] });

      const res = await request(app)
        .get('/api/konfi/badges')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(200);
      const badge = findBadge(res.body, badgeId);
      expect(badge).toBeDefined();
      expect(badge.progress.current).toBe(1);
    });

    it('activity_count: zaehlt Aktivitaeten + besuchte Events (konsistent zur Wertung)', async () => {
      // 2 Aktivitaeten + 3 besuchte Events -> current=5
      await createActivityWithCompletions('Akt-Count', 2);
      await createEventsWithPresence(3, false, true);
      const badgeId = await createKonfiBadge('activity_count', 10);

      const res = await request(app)
        .get('/api/konfi/badges')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(200);
      const badge = findBadge(res.body, badgeId);
      expect(badge).toBeDefined();
      expect(badge.progress.current).toBe(5);
    });
  });

  // ================================================================
  // GET /api/konfi/events
  // ================================================================
  describe('GET /api/konfi/events', () => {
    it('Konfi bekommt 200 + Event-Liste (leer ohne Jahrgang-Assignments)', async () => {
      // Ohne event_jahrgang_assignments: INNER JOIN liefert keine Events
      const res = await request(app)
        .get('/api/konfi/events')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('Konfi bekommt Events nach Jahrgang-Assignment', async () => {
      // event_jahrgang_assignments manuell setzen
      await db.query(
        'INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) VALUES ($1, $2)',
        [EVENTS.gottesdienstEvent.id, JAHRGAENGE.jahrgang1.id]
      );

      const res = await request(app)
        .get('/api/konfi/events')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body[0].name).toBe(EVENTS.gottesdienstEvent.name);
    });

    it('Konfi3 sieht keine Events aus Org 1', async () => {
      // Event von Org 1 dem Jahrgang 1 zuweisen
      await db.query(
        'INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) VALUES ($1, $2)',
        [EVENTS.gottesdienstEvent.id, JAHRGAENGE.jahrgang1.id]
      );

      const res = await request(app)
        .get('/api/konfi/events')
        .set('Authorization', `Bearer ${konfi3Token}`);

      expect(res.status).toBe(200);
      // Konfi3 (Org 2, Jahrgang 2) sieht dieses Event nicht
      const eventNames = res.body.map(e => e.name);
      expect(eventNames).not.toContain(EVENTS.gottesdienstEvent.name);
    });

    // Legt ein Event an, das aelter als 1 Jahr ist, und weist es Jahrgang 1 zu.
    async function seedAltesKonfiEvent() {
      const { rows } = await db.query(
        `INSERT INTO events (name, event_date, organization_id, mandatory, max_participants, point_type, points, has_timeslots)
         VALUES ('Uralt-Konfi-Event', NOW() - interval '2 years', $1, false, 20, 'gemeinde', 1, false)
         RETURNING id`,
        [ORGS.testGemeinde.id]
      );
      const eventId = rows[0].id;
      await db.query(
        'INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) VALUES ($1, $2)',
        [eventId, JAHRGAENGE.jahrgang1.id]
      );
      return eventId;
    }

    it('Event aelter als 1 Jahr fehlt ohne all=true', async () => {
      const altId = await seedAltesKonfiEvent();

      const res = await request(app)
        .get('/api/konfi/events')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(200);
      const ids = res.body.map(e => e.id);
      expect(ids).not.toContain(altId);
    });

    it('Event aelter als 1 Jahr ist mit all=true enthalten', async () => {
      const altId = await seedAltesKonfiEvent();

      const res = await request(app)
        .get('/api/konfi/events?all=true')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(200);
      const ids = res.body.map(e => e.id);
      expect(ids).toContain(altId);
    });

    it('Response-Shape: Kernfelder + Konfi-spezifische Felder stabil (Query-Restrukturierung)', async () => {
      await db.query(
        'INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) VALUES ($1, $2)',
        [EVENTS.gottesdienstEvent.id, JAHRGAENGE.jahrgang1.id]
      );

      const res = await request(app)
        .get('/api/konfi/events')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(200);
      const evt = res.body.find(e => e.id === EVENTS.gottesdienstEvent.id);
      expect(evt).toBeDefined();
      expect(evt.name).toBe(EVENTS.gottesdienstEvent.name);
      expect(evt.registration_status).toBeDefined();
      expect(evt.registered_count).toBeDefined();
      expect(evt.waitlist_count).toBe(0);
      expect(evt.teamer_count).toBe(0);
      expect(evt.is_registered).toBe(false);
      expect(evt.can_register).toBeDefined();
      expect(evt.waitlist_position).toBeNull();
      expect(Array.isArray(evt.categories)).toBe(true);
    });
  });
});
