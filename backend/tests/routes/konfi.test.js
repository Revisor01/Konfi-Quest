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
  // POST /api/konfi/events/:id/opt-out — Doppelversand (28.08.2026)
  //
  // Eine offline abgegebene Abmeldung kann zweimal ankommen: Die Anfrage
  // erreicht den Server, die Antwort geht auf dem Rueckweg verloren, und die
  // Warteschlange legt sie erneut vor. Der zweite Lauf traf 0 Zeilen und
  // meldete 400 — ein erfolgreicher Vorgang wurde als Fehler angezeigt.
  // ================================================================
  describe('POST /api/konfi/events/:id/opt-out', () => {
    beforeEach(async () => {
      await db.query(
        `INSERT INTO event_bookings (user_id, event_id, status, organization_id)
         VALUES ($1, $2, 'confirmed', $3)`,
        [USERS.konfi1.id, EVENTS.pflichtEvent.id, ORGS.testGemeinde.id]
      );
    });

    it('Erste Abmeldung setzt den Status -> 200', async () => {
      const res = await request(app)
        .post(`/api/konfi/events/${EVENTS.pflichtEvent.id}/opt-out`)
        .set('Authorization', `Bearer ${konfiToken}`)
        .send({ reason: 'Bin krank geworden' });

      expect(res.status).toBe(200);

      const { rows: [b] } = await db.query(
        'SELECT status, opt_out_reason FROM event_bookings WHERE user_id = $1 AND event_id = $2',
        [USERS.konfi1.id, EVENTS.pflichtEvent.id]
      );
      expect(b.status).toBe('opted_out');
      expect(b.opt_out_reason).toBe('Bin krank geworden');
    });

    it('Zweiter Versand derselben Abmeldung ist kein Fehler -> 200', async () => {
      await request(app)
        .post(`/api/konfi/events/${EVENTS.pflichtEvent.id}/opt-out`)
        .set('Authorization', `Bearer ${konfiToken}`)
        .send({ reason: 'Bin krank geworden' });

      const zweite = await request(app)
        .post(`/api/konfi/events/${EVENTS.pflichtEvent.id}/opt-out`)
        .set('Authorization', `Bearer ${konfiToken}`)
        .send({ reason: 'Bin krank geworden' });

      expect(zweite.status).toBe(200);
      expect(zweite.body.bereits_abgemeldet).toBe(true);

      // Der Grund der ERSTEN Abmeldung bleibt stehen.
      const { rows: [b] } = await db.query(
        'SELECT status, opt_out_reason FROM event_bookings WHERE user_id = $1 AND event_id = $2',
        [USERS.konfi1.id, EVENTS.pflichtEvent.id]
      );
      expect(b.status).toBe('opted_out');
      expect(b.opt_out_reason).toBe('Bin krank geworden');
    });

    it('Ohne jede Anmeldung bleibt es beim Fehler -> 400', async () => {
      await db.query(
        'DELETE FROM event_bookings WHERE user_id = $1 AND event_id = $2',
        [USERS.konfi1.id, EVENTS.pflichtEvent.id]
      );

      const res = await request(app)
        .post(`/api/konfi/events/${EVENTS.pflichtEvent.id}/opt-out`)
        .set('Authorization', `Bearer ${konfiToken}`)
        .send({ reason: 'Bin krank geworden' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Keine aktive Anmeldung gefunden');
    });
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
      // Absicherung für die Query-Parallelisierung (Audit Achse 4, Fund 8):
      // Nach dem Umbau auf Promise.all muss die Response-Struktur byte-identisch
      // bleiben. Dieser Test prüft, dass JEDES Feld aus den parallelisierten
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

    // Befund aus dem Dashboard/Profil-Durchgang (26.08.2026): has_wrapped
    // prueft nur die FREIGABE, nicht ob ein Snapshot vorliegt.
    //
    // Nachgemessen (27.08.2026): Bei gesetzter Freigabe ohne Snapshot lieferte
    // das Dashboard has_wrapped=true, GET /wrapped/me aber 404 -- die Konfi
    // sah den Einstieg und tippte ins Leere.
    //
    // Das kann wirklich passieren: Die Snapshot-Erzeugung laeuft ueber
    // Promise.allSettled (wrapped.js:735-739), zaehlt Fehler mit und setzt die
    // Freigabe TROTZDEM. Scheitert sie fuer eine einzelne Konfi, hat genau
    // diese eine Freigabe ohne eigenen Snapshot.
    describe('has_wrapped braucht Freigabe UND Snapshot', () => {
      const freigeben = () => db.query(
        'UPDATE jahrgaenge SET wrapped_released_at = NOW() WHERE id = $1',
        [JAHRGAENGE.jahrgang1.id]
      );

      const snapshotAnlegen = (userId) => db.query(
        `INSERT INTO wrapped_snapshots (user_id, organization_id, wrapped_type, jahrgang_id, year, data, computed_at)
         VALUES ($1, $2, 'konfi', $3, 2026, '{}'::jsonb, NOW())`,
        [userId, ORGS.testGemeinde.id, JAHRGAENGE.jahrgang1.id]
      );

      const hasWrapped = async () => {
        const res = await request(app)
          .get('/api/konfi/dashboard')
          .set('Authorization', `Bearer ${konfiToken}`);
        expect(res.status).toBe(200);
        return res.body.has_wrapped;
      };

      it('VERBOTEN: Freigabe ohne Snapshot zeigt keinen Einstieg', async () => {
        await freigeben();
        expect(await hasWrapped()).toBe(false);
      });

      it('ERLAUBT: Freigabe UND Snapshot zeigen den Einstieg', async () => {
        // Gegenprobe -- die zusaetzliche Bedingung darf den regulaeren Fall
        // nicht mitnehmen.
        await freigeben();
        await snapshotAnlegen(USERS.konfi1.id);
        expect(await hasWrapped()).toBe(true);
      });

      it('Snapshot ohne Freigabe zeigt ebenfalls nichts', async () => {
        // Die andere Richtung: Das Freigabe-Gate bleibt bestehen.
        await snapshotAnlegen(USERS.konfi1.id);
        expect(await hasWrapped()).toBe(false);
      });

      it('der Snapshot einer ANDEREN Konfi zaehlt nicht', async () => {
        // Sonst haette der Join die Bedingung faktisch aufgehoben, sobald
        // irgendwer im Jahrgang einen Snapshot hat.
        await freigeben();
        await snapshotAnlegen(USERS.konfi2.id);
        expect(await hasWrapped()).toBe(false);
      });

      it('deckt sich mit dem, was /wrapped/me liefert', async () => {
        // Die eigentliche Zusicherung: Wo der Einstieg steht, muss auch etwas
        // abrufbar sein.
        await freigeben();
        await snapshotAnlegen(USERS.konfi1.id);

        expect(await hasWrapped()).toBe(true);
        const me = await request(app)
          .get('/api/wrapped/me')
          .set('Authorization', `Bearer ${konfiToken}`);
        expect(me.status).toBe(200);
      });
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

    it('dashboard_config reicht den Challenges-Schalter durch (Default an, gesetzt aus)', async () => {
      const resDefault = await request(app)
        .get('/api/konfi/dashboard')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(resDefault.status).toBe(200);
      expect(resDefault.body.dashboard_config.show_challenges).toBe(true);

      await db.query(
        `INSERT INTO settings (organization_id, key, value) VALUES (1, 'dashboard_show_challenges', 'false')
         ON CONFLICT (organization_id, key) DO UPDATE SET value = EXCLUDED.value`
      );

      const resOff = await request(app)
        .get('/api/konfi/dashboard')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(resOff.status).toBe(200);
      expect(resOff.body.dashboard_config.show_challenges).toBe(false);
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

      // konfi2 soft-löschen
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

    it('konfspruch_visible ist false wenn die Leitung dashboard_show_konfispruch abschaltet', async () => {
      await db.query('UPDATE jahrgaenge SET konfspruch_enabled = true WHERE id = $1', [JAHRGAENGE.jahrgang1.id]);
      await db.query(
        `INSERT INTO settings (organization_id, key, value) VALUES (1, 'dashboard_show_konfispruch', 'false')
         ON CONFLICT (organization_id, key) DO UPDATE SET value = EXCLUDED.value`
      );

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
      // Seed hat bonus_points für konfi1 (3 Punkte Sonderpunkte Weihnachten)
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
      // Org 1 hat 4 Aktivitäten
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
      // Org 2 hat 2 Aktivitäten
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

    // Befund 24.08.2026: Die Gesamtzahl zählte die Teamer-Abzeichen mit. In
    // Org 1 standen dadurch 56 statt 50, der Fortschritt wirkte dauerhaft
    // schlechter als er war.
    it('Die Gesamtzahl zaehlt nur Konfi-Abzeichen, keine Teamer-Abzeichen', async () => {
      const vorher = await request(app)
        .get('/api/konfi/badges')
        .set('Authorization', `Bearer ${konfiToken}`);
      const zuvor = vorher.body.stats.totalVisible;
      expect(typeof zuvor).toBe('number');

      await db.query(
        `INSERT INTO custom_badges (name, criteria_type, criteria_value, icon, color, organization_id, target_role, is_active)
         VALUES ('Nur fuer Teamer', 'teamer_year', 2, 'ribbon', '#5b21b6', $1, 'teamer', true)`,
        [ORGS.testGemeinde.id]
      );

      const nachher = await request(app)
        .get('/api/konfi/badges')
        .set('Authorization', `Bearer ${konfiToken}`);
      expect(nachher.body.stats.totalVisible).toBe(zuvor);
    });

    // Befund 27.08.2026 (beim Zusammenlegen der Fortschritts-Logik, N2):
    // Die Gesamtzahl kam aus einer eigenen Query, die organisationsweit
    // zaehlte und nichts von der Ausblendung unerreichbarer Abzeichen wusste.
    // Ein Abzeichen ohne hinterlegte Bedingung stand in KEINER Liste, zaehlte
    // aber im Nenner mit — im Dashboard stand dann "3/10", obwohl nur 8
    // erreichbar waren. In Org 1 waren zehn solcher Abzeichen angelegt.
    it('Die Gesamtzahl zaehlt kein unerreichbares Abzeichen mit', async () => {
      const vorher = await request(app)
        .get('/api/konfi/badges')
        .set('Authorization', `Bearer ${konfiToken}`);
      const zuvor = vorher.body.stats.totalVisible;
      expect(typeof zuvor).toBe('number');

      // specific_activity OHNE required_activity_name: Die Wertung prueft
      // genau dieses Feld, das Abzeichen ist damit fuer niemanden erreichbar.
      await db.query(
        `INSERT INTO custom_badges (name, criteria_type, criteria_value, criteria_extra, icon, color, organization_id, target_role, is_active)
         VALUES ('Ohne Bedingung', 'specific_activity', 3, '{}', 'ribbon', '#5b21b6', $1, 'konfi', true)`,
        [ORGS.testGemeinde.id]
      );

      const nachher = await request(app)
        .get('/api/konfi/badges')
        .set('Authorization', `Bearer ${konfiToken}`);

      // Weder in der Liste noch im Nenner.
      expect(nachher.body.stats.totalVisible).toBe(zuvor);
      expect(nachher.body.available.some(b => b.name === 'Ohne Bedingung')).toBe(false);
    });

    it('Die Gesamtzahl zaehlt ein erreichbares Abzeichen sehr wohl mit', async () => {
      // Gegenprobe: Sonst wuerde der Test oben auch dann gruen bleiben, wenn
      // die Zahl gar nichts mehr zaehlt.
      const vorher = await request(app)
        .get('/api/konfi/badges')
        .set('Authorization', `Bearer ${konfiToken}`);
      const zuvor = vorher.body.stats.totalVisible;

      await db.query(
        `INSERT INTO custom_badges (name, criteria_type, criteria_value, criteria_extra, icon, color, organization_id, target_role, is_active)
         VALUES ('Mit Bedingung', 'specific_activity', 3, '{"required_activity_name":"Konfitag"}', 'ribbon', '#5b21b6', $1, 'konfi', true)`,
        [ORGS.testGemeinde.id]
      );

      const nachher = await request(app)
        .get('/api/konfi/badges')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(nachher.body.stats.totalVisible).toBe(zuvor + 1);
      expect(nachher.body.available.some(b => b.name === 'Mit Bedingung')).toBe(true);
    });

    it('Die Gesamtzahl zaehlt ein abgeschaltetes Abzeichen nicht als offenes Ziel', async () => {
      // Verdiente abgeschaltete Abzeichen bleiben in der Liste sichtbar (sonst
      // verschwaende ein erreichtes Abzeichen), duerfen aber nicht im Nenner
      // stehen — sie sind kein offenes Ziel mehr. Beim Teamer-Pfad zaehlten
      // sie mit, weshalb dieselbe Zahl je nach Rolle etwas anderes bedeutete.
      const vorher = await request(app)
        .get('/api/konfi/badges')
        .set('Authorization', `Bearer ${konfiToken}`);
      const zuvor = vorher.body.stats.totalVisible;

      const { rows: [abgeschaltet] } = await db.query(
        `INSERT INTO custom_badges (name, criteria_type, criteria_value, icon, color, organization_id, target_role, is_active)
         VALUES ('Abgeschaltet', 'event_count', 1, 'ribbon', '#5b21b6', $1, 'konfi', false)
         RETURNING id`,
        [ORGS.testGemeinde.id]
      );
      await db.query(
        `INSERT INTO user_badges (user_id, badge_id, organization_id, awarded_date)
         VALUES ($1, $2, $3, NOW())`,
        [USERS.konfi1.id, abgeschaltet.id, ORGS.testGemeinde.id]
      );

      const nachher = await request(app)
        .get('/api/konfi/badges')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(nachher.body.stats.totalVisible).toBe(zuvor);
      // Sichtbar bleibt es trotzdem — als verdient.
      expect(nachher.body.earned.some(b => b.name === 'Abgeschaltet')).toBe(true);
    });

    // Befund 24.08.2026: Die Konfi-Abfrage verlangte is_active auch für bereits
    // VERDIENTE Abzeichen. Schaltet die Leitung eines ab (Saisonende), verlor
    // der Konfi es aus der Ansicht, obwohl der Eintrag bestehen blieb — und die
    // Zähler auf dem Dashboard zählten es weiter mit.
    it('Ein verdientes Abzeichen bleibt sichtbar, auch wenn es abgeschaltet wird', async () => {
      const { rows: [badge] } = await db.query(
        `INSERT INTO custom_badges (name, criteria_type, criteria_value, icon, color, organization_id, target_role, is_active)
         VALUES ('Saison 2026', 'total_points', 1, 'trophy', '#ffd700', $1, 'konfi', true)
         RETURNING id`,
        [ORGS.testGemeinde.id]
      );
      await db.query(
        `INSERT INTO user_badges (user_id, badge_id, awarded_date, organization_id)
         VALUES ($1, $2, CURRENT_DATE, $3)`,
        [USERS.konfi1.id, badge.id, ORGS.testGemeinde.id]
      );
      await db.query('UPDATE custom_badges SET is_active = false WHERE id = $1', [badge.id]);

      const res = await request(app)
        .get('/api/konfi/badges')
        .set('Authorization', `Bearer ${konfiToken}`);
      expect(res.status).toBe(200);
      expect(res.body.earned.map(b => b.id)).toContain(badge.id);
    });

    it('Ein abgeschaltetes Abzeichen ohne Traeger bleibt verschwunden', async () => {
      const { rows: [badge] } = await db.query(
        `INSERT INTO custom_badges (name, criteria_type, criteria_value, icon, color, organization_id, target_role, is_active)
         VALUES ('Eingestellt', 'total_points', 5, 'trophy', '#ffd700', $1, 'konfi', false)
         RETURNING id`,
        [ORGS.testGemeinde.id]
      );

      const res = await request(app)
        .get('/api/konfi/badges')
        .set('Authorization', `Bearer ${konfiToken}`);
      expect(res.status).toBe(200);
      const alle = [...res.body.earned, ...res.body.available].map(b => b.id);
      expect(alle).not.toContain(badge.id);
    });

    // Befund 24.08.2026: Zehn aktive Abzeichen in Org 1 hatten eine leere
    // Bedingung und konnten deshalb nie vergeben werden — sie standen aber
    // unter "erreichbar" und liessen Konfis raetseln.
    it('Ein Abzeichen ohne hinterlegte Bedingung gilt nicht als erreichbar', async () => {
      const { rows: [ohne] } = await db.query(
        `INSERT INTO custom_badges (name, criteria_type, criteria_value, criteria_extra, icon, color, organization_id, target_role, is_active)
         VALUES ('Ohne Bedingung', 'specific_activity', 1, '{}', 'checkmark', '#10b981', $1, 'konfi', true)
         RETURNING id`,
        [ORGS.testGemeinde.id]
      );
      const { rows: [mit] } = await db.query(
        `INSERT INTO custom_badges (name, criteria_type, criteria_value, criteria_extra, icon, color, organization_id, target_role, is_active)
         VALUES ('Mit Bedingung', 'specific_activity', 1, $2, 'checkmark', '#10b981', $1, 'konfi', true)
         RETURNING id`,
        [ORGS.testGemeinde.id, JSON.stringify({ required_activity_name: 'Gottesdienst' })]
      );

      const res = await request(app)
        .get('/api/konfi/badges')
        .set('Authorization', `Bearer ${konfiToken}`);
      expect(res.status).toBe(200);

      const erreichbar = (res.body.available || []).map(b => b.id);
      expect(erreichbar).not.toContain(ohne.id);
      // Gegenprobe: Mit Bedingung steht es sehr wohl drin.
      expect(erreichbar).toContain(mit.id);
    });
  });

  // ================================================================
  // GET /api/konfi/badges/stats
  // Befund N2 (27.08.2026): Dieselbe Verwechslung wie am 24.08. in
  // konfiBadgeProgress.js, nur in der Nachbar-Query -- und dort unbemerkt
  // geblieben. total_badges filterte auf target_role='konfi',
  // earned_badges zaehlte ALLE Abzeichen der Person.
  //
  // Der Fall ist selten, aber real: Bei einer Befoerderung Konfi->Teamer
  // bleiben die Abzeichen bestehen (konfi-management.js:1136). Wer danach
  // als Teamer:in weitere verdient und wieder eine Konfi-Ansicht sieht,
  // bekam mehr "verdiente" als ueberhaupt vorhandene Abzeichen.
  //
  // Der Endpunkt hatte bis dahin KEINEN Test und keinen Aufrufer -- deshalb
  // fiel es nicht auf. Beides ist ein Grund, ihn abzusichern und nicht ihn
  // zu ignorieren: Wer ihn als naechstes einbindet, haette den Fehler geerbt.
  // ================================================================
  describe('GET /api/konfi/badges/stats', () => {
    it('Konfi bekommt 200 + beide Zaehler', async () => {
      const res = await request(app)
        .get('/api/konfi/badges/stats')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(200);
      expect(typeof res.body.total_badges).toBe('number');
      expect(typeof res.body.earned_badges).toBe('number');
    });

    it('Admin bekommt 403', async () => {
      const res = await request(app)
        .get('/api/konfi/badges/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(403);
    });

    it('ein verdientes TEAMER-Abzeichen zaehlt nicht als verdient mit', async () => {
      const vorher = await request(app)
        .get('/api/konfi/badges/stats')
        .set('Authorization', `Bearer ${konfiToken}`);
      const zuvor = vorher.body.earned_badges;

      const { rows: [teamerBadge] } = await db.query(
        `INSERT INTO custom_badges (name, criteria_type, criteria_value, icon, color, organization_id, target_role, is_active)
         VALUES ('Nur fuer Teamer', 'teamer_year', 2, 'ribbon', '#5b21b6', $1, 'teamer', true)
         RETURNING id`,
        [ORGS.testGemeinde.id]
      );
      await db.query(
        `INSERT INTO user_badges (user_id, badge_id, organization_id) VALUES ($1, $2, $3)`,
        [USERS.konfi1.id, teamerBadge.id, ORGS.testGemeinde.id]
      );

      const nachher = await request(app)
        .get('/api/konfi/badges/stats')
        .set('Authorization', `Bearer ${konfiToken}`);
      expect(nachher.body.earned_badges).toBe(zuvor);
    });

    it('ein verdientes KONFI-Abzeichen zaehlt sehr wohl mit', async () => {
      // Gegenprobe: Der Filter darf nicht einfach alles wegschneiden.
      const vorher = await request(app)
        .get('/api/konfi/badges/stats')
        .set('Authorization', `Bearer ${konfiToken}`);
      const zuvor = vorher.body.earned_badges;

      const { rows: [konfiBadge] } = await db.query(
        `INSERT INTO custom_badges (name, criteria_type, criteria_value, icon, color, organization_id, target_role, is_active)
         VALUES ('Nur fuer Konfis', 'total_points', 1, 'star', '#047857', $1, 'konfi', true)
         RETURNING id`,
        [ORGS.testGemeinde.id]
      );
      await db.query(
        `INSERT INTO user_badges (user_id, badge_id, organization_id) VALUES ($1, $2, $3)`,
        [USERS.konfi1.id, konfiBadge.id, ORGS.testGemeinde.id]
      );

      const nachher = await request(app)
        .get('/api/konfi/badges/stats')
        .set('Authorization', `Bearer ${konfiToken}`);
      expect(nachher.body.earned_badges).toBe(zuvor + 1);
    });

    it('verdient uebersteigt nie die Gesamtzahl', async () => {
      // Die Zusicherung, um die es eigentlich geht: Beide Zaehler messen
      // dieselbe Menge. Genau das war vorher nicht der Fall.
      const { rows: [teamerBadge] } = await db.query(
        `INSERT INTO custom_badges (name, criteria_type, criteria_value, icon, color, organization_id, target_role, is_active)
         VALUES ('Teamer-Abzeichen', 'teamer_year', 1, 'ribbon', '#be185d', $1, 'teamer', true)
         RETURNING id`,
        [ORGS.testGemeinde.id]
      );
      await db.query(
        `INSERT INTO user_badges (user_id, badge_id, organization_id) VALUES ($1, $2, $3)`,
        [USERS.konfi1.id, teamerBadge.id, ORGS.testGemeinde.id]
      );

      const res = await request(app)
        .get('/api/konfi/badges/stats')
        .set('Authorization', `Bearer ${konfiToken}`);
      expect(res.body.earned_badges).toBeLessThanOrEqual(res.body.total_badges);
    });
  });

  // ================================================================
  // GET /api/konfi/badges - Progress-Berechnung (Prozent-Bug-Fix, Phase 116-02)
  // ================================================================
  describe('GET /api/konfi/badges Progress-Berechnung', () => {
    // Hilfsfunktion: Badge für Org 1, target_role=konfi anlegen
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

    // Hilfsfunktion: Aktivität mit exaktem Namen anlegen und konfi1 N-mal zuweisen
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
      // 2 Aktivitäten + 3 besuchte Events -> current=5
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

    // ================================================================
    // Preload-Refactor: vormals per-Badge-Queries, jetzt Vorab-Aggregate.
    // Deckt die umgestellten Cases ab + die zwei Org-Filter-Angleichungen
    // (unique_activities/bonus_points zählten vorher org-uebergreifend,
    // die Wertung in badges.js aber org-gefiltert).
    // ================================================================

    it('unique_activities: 2 verschiedene Aktivitaeten (eine doppelt) -> current=2', async () => {
      await createActivityWithCompletions('Unique-A', 2);
      await createActivityWithCompletions('Unique-B', 1);
      const badgeId = await createKonfiBadge('unique_activities', 5);

      const res = await request(app)
        .get('/api/konfi/badges')
        .set('Authorization', `Bearer ${konfiToken}`);

      const badge = findBadge(res.body, badgeId);
      expect(badge).toBeDefined();
      expect(badge.progress.current).toBe(2);
    });

    it('unique_activities: Aktivitaeten fremder Organisationen zaehlen NICHT (Org-Filter wie Wertung)', async () => {
      await createActivityWithCompletions('Unique-Eigene-Org', 1);
      // Aktivität + Erledigung in Org 2 für denselben User (Multi-Org-Szenario)
      const { rows: [fremdAct] } = await db.query(
        `INSERT INTO activities (name, points, type, organization_id, target_role)
         VALUES ('Unique-Fremde-Org', 1, 'gottesdienst', $1, 'konfi') RETURNING id`,
        [ORGS.andereGemeinde.id]
      );
      await db.query(
        `INSERT INTO user_activities (user_id, activity_id, completed_date, admin_id, organization_id)
         VALUES ($1, $2, NOW(), $3, $4)`,
        [USERS.konfi1.id, fremdAct.id, USERS.admin1.id, ORGS.andereGemeinde.id]
      );
      const badgeId = await createKonfiBadge('unique_activities', 5);

      const res = await request(app)
        .get('/api/konfi/badges')
        .set('Authorization', `Bearer ${konfiToken}`);

      const badge = findBadge(res.body, badgeId);
      expect(badge).toBeDefined();
      // Vor dem Fix: 2 (org-uebergreifend). Wertung zählt 1 -> Progress muss 1 zeigen.
      expect(badge.progress.current).toBe(1);
    });

    it('bonus_points: summiert Punkte (3+4=7), Fremd-Org-Bonus zaehlt nicht', async () => {
      // Seed legt für konfi1 bereits Bonuspunkte an (seed.js Schritt 14) —
      // für deterministische Summen erst aufräumen.
      await db.query('DELETE FROM bonus_points WHERE konfi_id = $1', [USERS.konfi1.id]);
      await db.query(
        `INSERT INTO bonus_points (konfi_id, points, type, description, admin_id, organization_id)
         VALUES ($1, 3, 'gemeinde', 'Bonus A', $2, $3), ($1, 4, 'gemeinde', 'Bonus B', $2, $3)`,
        [USERS.konfi1.id, USERS.admin1.id, ORGS.testGemeinde.id]
      );
      await db.query(
        `INSERT INTO bonus_points (konfi_id, points, type, description, admin_id, organization_id)
         VALUES ($1, 99, 'gemeinde', 'Fremd-Bonus', $2, $3)`,
        [USERS.konfi1.id, USERS.admin1.id, ORGS.andereGemeinde.id]
      );
      const badgeId = await createKonfiBadge('bonus_points', 20);

      const res = await request(app)
        .get('/api/konfi/badges')
        .set('Authorization', `Bearer ${konfiToken}`);

      const badge = findBadge(res.body, badgeId);
      expect(badge).toBeDefined();
      expect(badge.progress.current).toBe(7);
    });

    it('category_activities: Aktivitaet + besuchtes Event derselben Kategorie -> current=2', async () => {
      const { rows: [cat] } = await db.query(
        `INSERT INTO categories (name, organization_id) VALUES ('Kategorie-Test', $1) RETURNING id`,
        [ORGS.testGemeinde.id]
      );
      const actId = await createActivityWithCompletions('Kat-Aktivitaet', 1);
      await db.query(
        `INSERT INTO activity_categories (activity_id, category_id) VALUES ($1, $2)`,
        [actId, cat.id]
      );
      const { rows: [ev] } = await db.query(
        `INSERT INTO events (name, event_date, organization_id, mandatory, max_participants, point_type, points)
         VALUES ('Kat-Event', NOW() - interval '1 day', $1, false, 0, 'gemeinde', 0) RETURNING id`,
        [ORGS.testGemeinde.id]
      );
      await db.query(
        `INSERT INTO event_categories (event_id, category_id) VALUES ($1, $2)`,
        [ev.id, cat.id]
      );
      await db.query(
        `INSERT INTO event_bookings (user_id, event_id, organization_id, status, attendance_status)
         VALUES ($1, $2, $3, 'confirmed', 'present')`,
        [USERS.konfi1.id, ev.id, ORGS.testGemeinde.id]
      );
      const badgeId = await createKonfiBadge('category_activities', 5, { required_category: 'Kategorie-Test' });

      const res = await request(app)
        .get('/api/konfi/badges')
        .set('Authorization', `Bearer ${konfiToken}`);

      const badge = findBadge(res.body, badgeId);
      expect(badge).toBeDefined();
      expect(badge.progress.current).toBe(2);
    });

    it('time_based: nur Eintraege innerhalb des Zeitfensters zaehlen', async () => {
      // 2 aktuelle Erledigungen + 1 alte (60 Tage) -> days=30 -> current=2
      const actId = await createActivityWithCompletions('Zeitfenster-Akt', 2);
      await db.query(
        `INSERT INTO user_activities (user_id, activity_id, completed_date, admin_id, organization_id)
         VALUES ($1, $2, NOW() - interval '60 days', $3, $4)`,
        [USERS.konfi1.id, actId, USERS.admin1.id, ORGS.testGemeinde.id]
      );
      const badgeId = await createKonfiBadge('time_based', 5, { days: 30 });

      const res = await request(app)
        .get('/api/konfi/badges')
        .set('Authorization', `Bearer ${konfiToken}`);

      const badge = findBadge(res.body, badgeId);
      expect(badge).toBeDefined();
      expect(badge.progress.current).toBe(2);
    });

    it('streak: Aktivitaet in dieser Woche -> current >= 1', async () => {
      await createActivityWithCompletions('Streak-Akt', 1);
      const badgeId = await createKonfiBadge('streak', 4);

      const res = await request(app)
        .get('/api/konfi/badges')
        .set('Authorization', `Bearer ${konfiToken}`);

      const badge = findBadge(res.body, badgeId);
      expect(badge).toBeDefined();
      expect(badge.progress.current).toBeGreaterThanOrEqual(1);
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

    it('die Antwort enthaelt KEIN qr_token', async () => {
      // Befund 01.09.2026: Die Abfrage holt SELECT e.* und reichte die Zeile
      // unveraendert weiter -- der Check-in-Token lag damit in der Antwort an
      // Konfis. Mit ihm kann man sich per POST /events/qr-checkin von zu
      // Hause als anwesend eintragen und Punkte gutschreiben.
      // Dieselbe Luecke war am 22.08.2026 fuer GET /events geschlossen
      // worden; die Konfi-Liste wurde uebersehen.
      await db.query(
        'INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [EVENTS.gottesdienstEvent.id, JAHRGAENGE.jahrgang1.id]
      );
      // Ohne gesetzten Token waere der Test wertlos -- er wuerde auch bei
      // durchgereichtem Feld gruen sein, weil dort dann null stuende.
      await db.query(
        "UPDATE events SET qr_token = 'geheim-testtoken-123' WHERE id = $1",
        [EVENTS.gottesdienstEvent.id]
      );

      const res = await request(app)
        .get('/api/konfi/events')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(200);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      for (const event of res.body) {
        expect(event.qr_token).toBeUndefined();
      }
      // Gegenprobe, dass der Token wirklich in der Datenbank steht:
      const { rows } = await db.query('SELECT qr_token FROM events WHERE id = $1', [EVENTS.gottesdienstEvent.id]);
      expect(rows[0].qr_token).toBe('geheim-testtoken-123');
    });

    it('Konfi bekommt Events nach Jahrgang-Assignment', async () => {
      // ON CONFLICT DO NOTHING seit 01.09.2026: Der Seed legt die Zuordnung
      // Termin -> Jahrgang seit dem 30.08.2026 selbst an (seed.js:245ff, fuer
      // die E2E-Suite ergaenzt). Diese Tests fuegten sie danach ein zweites
      // Mal ein und liefen in den Unique-Index -- vier Tests in dieser Datei
      // waren seitdem dauerhaft rot, unabhaengig vom uebrigen Code.
      // Die Zeile hier bleibt trotzdem stehen: Sie macht die Voraussetzung
      // des Tests sichtbar, statt sie stillschweigend vom Seed zu leihen.
      // event_jahrgang_assignments manuell setzen
      await db.query(
        'INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
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
        'INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
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
        'INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
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
        'INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
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
      // COUNT() liefert bigint -> pg gibt Strings zurück (Shape unverändert zur alten Query)
      expect(Number(evt.waitlist_count)).toBe(0);
      expect(Number(evt.teamer_count)).toBe(0);
      expect(evt.is_registered).toBe(false);
      expect(evt.can_register).toBeDefined();
      expect(evt.waitlist_position).toBeNull();
      expect(Array.isArray(evt.categories)).toBe(true);
    });
  });

  // ================================================================
  // chat_room_id in GET /api/konfi/events (Termin-Detail, 27.08.2026)
  // ================================================================
  // Die Liste liefert den Event-Chatraum nur an Mitglieder des Raums. Damit
  // bildet der Einstieg im Termin-Detail genau die Berechtigung ab, die
  // `darfRaumOeffnen` in chat.js durchsetzt: Eine Konfi, die nicht Mitglied
  // ist, bekommt gar keinen Knopf angeboten, der ins 403 laufen wuerde.
  describe('chat_room_id in GET /api/konfi/events', () => {
    // Termin anlegen und dem Jahrgang der Konfi zuweisen, sonst taucht er in
    // der Konfi-Liste gar nicht auf (INNER JOIN auf die Zuweisungen).
    const terminAnlegen = async (name) => {
      const { rows: [event] } = await db.query(
        `INSERT INTO events (name, event_date, organization_id, mandatory, max_participants, point_type, points)
         VALUES ($1, NOW() + interval '10 days', $2, false, 20, 'gemeinde', 1)
         RETURNING id`,
        [name, ORGS.testGemeinde.id]
      );
      await db.query(
        'INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [event.id, JAHRGAENGE.jahrgang1.id]
      );
      return event.id;
    };

    const chatraumAnlegen = async (eventId, name) => {
      const { rows: [raum] } = await db.query(
        `INSERT INTO chat_rooms (name, type, event_id, created_by, organization_id)
         VALUES ($1, 'group', $2, $3, $4) RETURNING id`,
        [name, eventId, USERS.admin1.id, ORGS.testGemeinde.id]
      );
      return raum.id;
    };

    const holeTermin = async (eventId) => {
      const res = await request(app)
        .get('/api/konfi/events')
        .set('Authorization', `Bearer ${konfiToken}`);
      expect(res.status).toBe(200);
      return res.body.find(e => e.id === eventId);
    };

    it('Konfi im Event-Chat bekommt die Raum-ID', async () => {
      const eventId = await terminAnlegen('Termin mit Chat');
      const roomId = await chatraumAnlegen(eventId, 'Termin mit Chat - Chat');
      await db.query(
        `INSERT INTO chat_participants (room_id, user_id, user_type) VALUES ($1, $2, 'konfi')`,
        [roomId, USERS.konfi1.id]
      );

      const termin = await holeTermin(eventId);
      expect(termin.chat_room_id).toBe(roomId);
    });

    it('Konfi ohne Mitgliedschaft bekommt trotz Chatraum null', async () => {
      const eventId = await terminAnlegen('Termin mit fremdem Chat');
      const roomId = await chatraumAnlegen(eventId, 'Termin mit fremdem Chat - Chat');
      // Nur eine andere Konfi und die Leitung sind im Raum.
      await db.query(
        `INSERT INTO chat_participants (room_id, user_id, user_type)
         VALUES ($1, $2, 'konfi'), ($1, $3, 'admin')`,
        [roomId, USERS.konfi2.id, USERS.admin1.id]
      );

      const termin = await holeTermin(eventId);
      expect(termin.chat_room_id).toBeNull();
    });

    it('Ohne Chatraum zum Termin ist chat_room_id null', async () => {
      const eventId = await terminAnlegen('Termin ohne Chat');

      const termin = await holeTermin(eventId);
      expect(termin.chat_room_id).toBeNull();
    });

    it('Mitgliedschaft mit falschem user_type zaehlt nicht', async () => {
      // Die Konfi-Abfrage vergleicht fest mit user_type 'konfi'. Eine Zeile
      // mit derselben user_id, aber anderem Typ darf nicht durchschlagen.
      const eventId = await terminAnlegen('Termin mit falschem Typ');
      const roomId = await chatraumAnlegen(eventId, 'Termin mit falschem Typ - Chat');
      await db.query(
        `INSERT INTO chat_participants (room_id, user_id, user_type) VALUES ($1, $2, 'teamer')`,
        [roomId, USERS.konfi1.id]
      );

      const termin = await holeTermin(eventId);
      expect(termin.chat_room_id).toBeNull();
    });

    it('Zwei Termine mit je eigenem Chat bekommen ihre eigene Raum-ID', async () => {
      const eventA = await terminAnlegen('Termin A');
      const eventB = await terminAnlegen('Termin B');
      const raumA = await chatraumAnlegen(eventA, 'Termin A - Chat');
      const raumB = await chatraumAnlegen(eventB, 'Termin B - Chat');
      await db.query(
        `INSERT INTO chat_participants (room_id, user_id, user_type)
         VALUES ($1, $3, 'konfi'), ($2, $3, 'konfi')`,
        [raumA, raumB, USERS.konfi1.id]
      );

      const terminA = await holeTermin(eventA);
      const terminB = await holeTermin(eventB);

      expect(terminA.chat_room_id).toBe(raumA);
      expect(terminB.chat_room_id).toBe(raumB);
      expect(raumA).not.toBe(raumB);
    });
  });

  // ================================================================
  // registration_status in den Konfi-Queries (Befund 1, 25.08.2026)
  // ================================================================
  // Prod-Fall Event 150 "Gemeindeversammlung": max_participants=0 (unbegrenzt),
  // Warteliste aus, Anmeldefenster offen, keine Pflicht. Der Admin-Liste-CASE
  // prüft Ausgebucht nur bei echter Kapazität (`> 0`-Guard); den Konfi-Queries
  // fehlte der Guard, dadurch war `0 >= 0` immer wahr und das Event 'closed' —
  // der Anmelden-Knopf verschwand, obwohl die Buchung angenommen würde.
  describe('registration_status Konfi-Queries (Befund 1, 25.08.2026)', () => {
    // Event-150-Konstellation: unbegrenzt, Warteliste aus, Fenster offen
    async function seedUnbegrenztOhneWarteliste() {
      const { rows } = await db.query(
        `INSERT INTO events (name, event_date, organization_id, mandatory, max_participants,
                             waitlist_enabled, point_type, points,
                             registration_opens_at, registration_closes_at)
         VALUES ('Gemeindeversammlung-Test', NOW() + interval '14 days', $1, false, 0,
                 false, 'gemeinde', 1,
                 NOW() - interval '1 day', NOW() + interval '7 days')
         RETURNING id`,
        [ORGS.testGemeinde.id]
      );
      const eventId = rows[0].id;
      await db.query(
        'INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [eventId, JAHRGAENGE.jahrgang1.id]
      );
      return eventId;
    }

    it('GET /konfi/events: unbegrenztes Event ohne Warteliste ist open, nicht closed', async () => {
      const eventId = await seedUnbegrenztOhneWarteliste();

      const res = await request(app)
        .get('/api/konfi/events')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(200);
      const evt = res.body.find(e => e.id === eventId);
      expect(evt).toBeDefined();
      expect(evt.registration_status).toBe('open');
    });

    it('GET /konfi/events: Pflicht-Event meldet mandatory wie die Admin-Liste', async () => {
      await db.query(
        'INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [EVENTS.pflichtEvent.id, JAHRGAENGE.jahrgang1.id]
      );

      const res = await request(app)
        .get('/api/konfi/events')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(200);
      const pflicht = res.body.find(e => e.id === EVENTS.pflichtEvent.id);
      expect(pflicht).toBeDefined();
      expect(pflicht.registration_status).toBe('mandatory');
    });

    it('GET /konfi/events/:id/status: unbegrenztes Event ohne Warteliste ist open', async () => {
      const eventId = await seedUnbegrenztOhneWarteliste();

      const res = await request(app)
        .get(`/api/konfi/events/${eventId}/status`)
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(200);
      expect(res.body.event_status).toBe('open');
      expect(res.body.can_register).toBe(true);
    });

    it('GET /konfi/events/:id/status: Pflicht-Event meldet mandatory', async () => {
      const res = await request(app)
        .get(`/api/konfi/events/${EVENTS.pflichtEvent.id}/status`)
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(200);
      expect(res.body.event_status).toBe('mandatory');
    });

    // Befund H6 (26.08.2026): Die Konfi-Liste lieferte einen abgesagten Termin
    // weiter mit registration_status 'cancelled', der /status-Endpunkt filterte
    // ihn hart weg und antwortete 404 -- zwei Antworten fuer denselben Termin
    // in derselben Rolle. Entscheidung Simon 27.08.2026: Abgesagte Termine darf
    // man sich weiterhin ansehen.
    describe('GET /konfi/events/:id/status: abgesagte Termine', () => {
      const abgesagterTerminMitAnmeldung = async () => {
        const { rows } = await db.query(
          `INSERT INTO events (name, event_date, organization_id, mandatory, max_participants,
                               waitlist_enabled, point_type, points,
                               registration_opens_at, registration_closes_at, cancelled)
           VALUES ('Abgesagter Termin', NOW() + interval '10 days', $1, false, 20,
                   false, 'gemeinde', 1,
                   NOW() - interval '1 day', NOW() + interval '5 days', true)
           RETURNING id`,
          [ORGS.testGemeinde.id]
        );
        const eventId = rows[0].id;
        await db.query(
          'INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [eventId, JAHRGAENGE.jahrgang1.id]
        );
        return eventId;
      };

      it('wer angemeldet war, kann den abgesagten Termin weiterhin aufrufen -> 200', async () => {
        const eventId = await abgesagterTerminMitAnmeldung();
        await db.query(
          `INSERT INTO event_bookings (event_id, user_id, status, organization_id)
           VALUES ($1, $2, 'confirmed', $3)`,
          [eventId, USERS.konfi1.id, ORGS.testGemeinde.id]
        );

        const res = await request(app)
          .get(`/api/konfi/events/${eventId}/status`)
          .set('Authorization', `Bearer ${konfiToken}`);

        expect(res.status).toBe(200);
        // Gleiche Sprache wie die Liste: 'cancelled', nicht 'open'/'closed'.
        expect(res.body.event_status).toBe('cancelled');
        expect(res.body.is_registered).toBe(true);
        // Anmelden geht natuerlich nicht mehr.
        expect(res.body.can_register).toBe(false);
      });

      it('wer NICHT angemeldet war, bekommt den abgesagten Termin nicht -> 404', async () => {
        // Gegenprobe und zugleich die Regel der Liste:
        // (e.cancelled IS NOT TRUE OR eb_konfi.id IS NOT NULL). Ein abgesagter
        // Termin, mit dem man nie zu tun hatte, taucht auch nicht auf.
        const eventId = await abgesagterTerminMitAnmeldung();

        const res = await request(app)
          .get(`/api/konfi/events/${eventId}/status`)
          .set('Authorization', `Bearer ${konfiToken}`);

        expect(res.status).toBe(404);
      });

      it('ein NICHT abgesagter Termin bleibt unveraendert erreichbar', async () => {
        // Gegenprobe: Der Umbau darf den Normalfall nicht mitnehmen.
        const res = await request(app)
          .get(`/api/konfi/events/${EVENTS.pflichtEvent.id}/status`)
          .set('Authorization', `Bearer ${konfiToken}`);

        expect(res.status).toBe(200);
        expect(res.body.event_status).toBe('mandatory');
      });
    });

    // Der /status-Endpunkt zählte außerdem ohne Rollenfilter: ein gebuchter
    // Teamer belegte rechnerisch den letzten Konfi-Platz und schloss das Event.
    it('GET /konfi/events/:id/status: Teamer-Buchung belegt keinen Konfi-Platz', async () => {
      const { rows } = await db.query(
        `INSERT INTO events (name, event_date, organization_id, mandatory, max_participants,
                             waitlist_enabled, teamer_needed, teamer_max_participants,
                             point_type, points, registration_opens_at, registration_closes_at)
         VALUES ('Teamer-Kontingent-Status', NOW() + interval '14 days', $1, false, 1,
                 false, true, 5, 'gemeinde', 1,
                 NOW() - interval '1 day', NOW() + interval '7 days')
         RETURNING id`,
        [ORGS.testGemeinde.id]
      );
      const eventId = rows[0].id;
      await db.query(
        'INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
        [eventId, JAHRGAENGE.jahrgang1.id]
      );
      await db.query(
        `INSERT INTO event_bookings (event_id, user_id, status, organization_id)
         VALUES ($1, $2, 'confirmed', $3)`,
        [eventId, USERS.teamer1.id, ORGS.testGemeinde.id]
      );

      const res = await request(app)
        .get(`/api/konfi/events/${eventId}/status`)
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(200);
      expect(res.body.confirmed_count).toBe(0);
      expect(res.body.event_status).toBe('open');
    });
  });

  // Abgeschaltete Losung wird gar nicht abgerufen (Nutzerwunsch 23.08.2026).
  describe('GET /api/konfi/tageslosung — Schalter', () => {
    it('abgeschaltete Losung wird nicht abgerufen -> 204', async () => {
      await db.query(
        `INSERT INTO settings (organization_id, key, value) VALUES (1, 'dashboard_show_losung', 'false')
         ON CONFLICT (organization_id, key) DO UPDATE SET value = 'false'`
      );
      try {
        const res = await request(app)
          .get('/api/konfi/tageslosung')
          .set('Authorization', `Bearer ${konfiToken}`);

        expect(res.status).toBe(204);
      } finally {
        await db.query("DELETE FROM settings WHERE organization_id = 1 AND key = 'dashboard_show_losung'");
      }
    });
  });

  // Befund 24.08.2026: Die Abmeldung entfernte nur bei den Teamern aus dem
  // Event-Chat. Konfis blieben drin und lasen weiter mit — und konnten den
  // Chat auch nicht selbst verlassen, weil chat.js genau auf diese Abmeldung
  // verweist.
  describe('DELETE /api/konfi/events/:id/register — Event-Chat', () => {
    // Hilfsfunktion: Termin weit genug in der Zukunft (die Abmeldung ist nur
    // bis zwei Tage vorher möglich), dazu ein Chat und eine Buchung.
    const terminMitChat = async () => {
      const zukunft = new Date();
      zukunft.setDate(zukunft.getDate() + 20);

      const { rows: [event] } = await db.query(
        `INSERT INTO events (name, event_date, organization_id, max_participants, registration_opens_at)
         VALUES ('Termin mit Chat', $1, $2, 20, NOW() - INTERVAL '1 day') RETURNING id`,
        [zukunft.toISOString(), ORGS.testGemeinde.id]
      );
      const { rows: [raum] } = await db.query(
        `INSERT INTO chat_rooms (name, type, event_id, created_by, organization_id)
         VALUES ('Termin mit Chat - Chat', 'group', $1, $2, $3) RETURNING id`,
        [event.id, USERS.admin1.id, ORGS.testGemeinde.id]
      );
      await db.query(
        `INSERT INTO event_bookings (event_id, user_id, status, booking_date, organization_id)
         VALUES ($1, $2, 'confirmed', NOW(), $3)`,
        [event.id, USERS.konfi1.id, ORGS.testGemeinde.id]
      );
      await db.query(
        `INSERT INTO chat_participants (room_id, user_id, user_type)
         VALUES ($1, $2, 'konfi'), ($1, $3, 'admin')`,
        [raum.id, USERS.konfi1.id, USERS.admin1.id]
      );
      return { eventId: event.id, roomId: raum.id };
    };

    const imChat = async (roomId, userId) => {
      const { rows } = await db.query(
        'SELECT 1 FROM chat_participants WHERE room_id = $1 AND user_id = $2',
        [roomId, userId]
      );
      return rows.length === 1;
    };

    it('Der abgemeldete Konfi fliegt aus dem Event-Chat', async () => {
      const { eventId, roomId } = await terminMitChat();
      expect(await imChat(roomId, USERS.konfi1.id)).toBe(true);

      const res = await request(app)
        .delete(`/api/konfi/events/${eventId}/register`)
        .set('Authorization', `Bearer ${konfiToken}`);
      expect(res.status).toBe(200);

      expect(await imChat(roomId, USERS.konfi1.id)).toBe(false);
    });

    it('Alle anderen bleiben im Event-Chat', async () => {
      const { eventId, roomId } = await terminMitChat();

      await request(app)
        .delete(`/api/konfi/events/${eventId}/register`)
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(await imChat(roomId, USERS.admin1.id)).toBe(true);
    });

    it('Wer sich anmeldet, kommt in den Event-Chat', async () => {
      const { eventId, roomId } = await terminMitChat();

      // konfi1 ist schon gebucht; konfi2 meldet sich neu an, NACHDEM der Chat
      // existiert — genau der Fall, der bisher nie im Chat ankam.
      expect(await imChat(roomId, USERS.konfi2.id)).toBe(false);

      const res = await request(app)
        .post(`/api/konfi/events/${eventId}/register`)
        .set('Authorization', `Bearer ${generateToken('konfi2')}`)
        .send({});
      expect(res.status).toBe(200);

      expect(await imChat(roomId, USERS.konfi2.id)).toBe(true);
    });

    it('Ohne Chat zum Termin laeuft die Anmeldung normal durch', async () => {
      const zukunft = new Date();
      zukunft.setDate(zukunft.getDate() + 20);
      const { rows: [event] } = await db.query(
        `INSERT INTO events (name, event_date, organization_id, max_participants, registration_opens_at)
         VALUES ('Termin ohne Chat', $1, $2, 20, NOW() - INTERVAL '1 day') RETURNING id`,
        [zukunft.toISOString(), ORGS.testGemeinde.id]
      );

      const res = await request(app)
        .post(`/api/konfi/events/${event.id}/register`)
        .set('Authorization', `Bearer ${konfiToken}`)
        .send({});
      expect(res.status).toBe(200);

      const { rows } = await db.query(
        "SELECT status FROM event_bookings WHERE event_id = $1 AND user_id = $2",
        [event.id, USERS.konfi1.id]
      );
      expect(rows.length).toBe(1);
      expect(rows[0].status).toBe('confirmed');
    });

    it('Wer von der Warteliste nachrueckt, kommt in den Event-Chat', async () => {
      const zukunft = new Date();
      zukunft.setDate(zukunft.getDate() + 20);

      // Ein Platz, konfi1 hat ihn, konfi2 wartet.
      const { rows: [event] } = await db.query(
        `INSERT INTO events (name, event_date, organization_id, max_participants, waitlist_enabled, registration_opens_at)
         VALUES ('Ein Platz', $1, $2, 1, true, NOW() - INTERVAL '1 day') RETURNING id`,
        [zukunft.toISOString(), ORGS.testGemeinde.id]
      );
      const { rows: [raum] } = await db.query(
        `INSERT INTO chat_rooms (name, type, event_id, created_by, organization_id)
         VALUES ('Ein Platz - Chat', 'group', $1, $2, $3) RETURNING id`,
        [event.id, USERS.admin1.id, ORGS.testGemeinde.id]
      );
      await db.query(
        `INSERT INTO event_bookings (event_id, user_id, status, booking_date, organization_id)
         VALUES ($1, $2, 'confirmed', NOW(), $4), ($1, $3, 'waitlist', NOW(), $4)`,
        [event.id, USERS.konfi1.id, USERS.konfi2.id, ORGS.testGemeinde.id]
      );
      await db.query(
        `INSERT INTO chat_participants (room_id, user_id, user_type) VALUES ($1, $2, 'konfi')`,
        [raum.id, USERS.konfi1.id]
      );

      expect(await imChat(raum.id, USERS.konfi2.id)).toBe(false);

      // konfi1 meldet sich ab -> konfi2 rueckt nach
      const res = await request(app)
        .delete(`/api/konfi/events/${event.id}/register`)
        .set('Authorization', `Bearer ${konfiToken}`);
      expect(res.status).toBe(200);

      const { rows: [nach] } = await db.query(
        'SELECT status FROM event_bookings WHERE event_id = $1 AND user_id = $2',
        [event.id, USERS.konfi2.id]
      );
      expect(nach.status).toBe('confirmed');
      expect(await imChat(raum.id, USERS.konfi2.id)).toBe(true);
      // Die abgemeldete Person ist raus.
      expect(await imChat(raum.id, USERS.konfi1.id)).toBe(false);
    });

    it('Chats anderer Termine bleiben unberuehrt', async () => {
      const { eventId } = await terminMitChat();
      const zweiter = await terminMitChat();

      await request(app)
        .delete(`/api/konfi/events/${eventId}/register`)
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(await imChat(zweiter.roomId, USERS.konfi1.id)).toBe(true);
    });
  });

  // ================================================================
  // POST /api/konfi/requests — In-App-Mitteilung an die Leitung
  // ================================================================
  // Drei-Ansichten-Befund M6 (26.08.2026): Die In-App-Mitteilung ging nur an
  // r.name='admin' — org_admin bekam zwar Push, aber nichts ins
  // Mitteilungscenter. Beide Wege (Konfi und Teamer) muessen die gesamte
  // Leitung gleich informieren.
  describe('POST /api/konfi/requests — Leitungs-Mitteilungen', () => {
    it('Antrag erzeugt In-App-Mitteilung fuer admin UND org_admin, sonst niemanden', async () => {
      const res = await request(app)
        .post('/api/konfi/requests')
        .set('Authorization', `Bearer ${konfiToken}`)
        .send({
          activity_id: ACTIVITIES.sonntagsgottesdienst.id,
          requested_date: '2026-06-01'
        });
      expect(res.status).toBe(201);

      // Der Leitungs-Versand laeuft NACH der Antwort (fire-and-forget) —
      // deshalb kurz pollen, dann HART pruefen.
      let rows = [];
      for (let i = 0; i < 40; i++) {
        ({ rows } = await db.query(
          "SELECT user_id, title FROM notifications WHERE type = 'new_activity_request' ORDER BY user_id"
        ));
        if (rows.length > 0) break;
        await new Promise(r => setTimeout(r, 50));
      }

      // Genau die Leitung der Org 1: admin1, orgAdmin1, orgAdminSuper.
      // Verbotener Fall implizit mit drin: weder der Konfi selbst noch
      // Teamer noch die Leitung der Org 2 tauchen auf.
      expect(rows.map(r => r.user_id)).toEqual([
        USERS.admin1.id,
        USERS.orgAdmin1.id,
        USERS.orgAdminSuper.id
      ]);
      expect(rows[0].title).toBe('Neuer Antrag eingegangen');
    });
  });

  // ================================================================
  // Befund N1 (27.08.2026): Guards der Konfi-Buchungsroute
  //
  // POST /konfi/events/:id/register hatte weder den teamer_only- noch den
  // cancelled-Guard, die der regulaere Weg seit jeher hat (events.js:1666
  // bzw. teamer.js:1314).
  //
  // Nachgemessen, bevor es repariert wurde: BEIDE Anmeldungen lieferten 200.
  // Eine Konfi konnte sich per API zu einem reinen Teamer-Termin und zu
  // einem abgesagten Termin anmelden. Der Bericht hielt das fuer "praktisch
  // vermutlich folgenlos" -- das gilt nur, solange niemand die API direkt
  // anspricht. Ueber die Oberflaeche ist es nicht erreichbar, weil die
  // Terminliste teamer_only fuer Konfis herausfiltert (events.js:254-256).
  // ================================================================
  describe('N1: Guards der Konfi-Anmeldung', () => {
    const terminAnlegen = async (zusatzSpalte, zusatzWert) => {
      const extraSpalte = zusatzSpalte ? `, ${zusatzSpalte}` : '';
      const extraWert = zusatzSpalte ? ', $4' : '';
      const werte = ['Testtermin N1', 10, ORGS.testGemeinde.id];
      if (zusatzSpalte) werte.push(zusatzWert);
      const { rows: [event] } = await db.query(
        `INSERT INTO events (name, event_date, max_participants, organization_id,
                             registration_opens_at, registration_closes_at${extraSpalte})
         VALUES ($1, NOW() + interval '7 days', $2, $3,
                 NOW() - interval '1 day', NOW() + interval '5 days'${extraWert})
         RETURNING id`,
        werte
      );
      return event.id;
    };

    const anmelden = (eventId) =>
      request(app)
        .post(`/api/konfi/events/${eventId}/register`)
        .set('Authorization', `Bearer ${konfiToken}`)
        .send({});

    it('VERBOTEN: Anmeldung zu einem reinen Teamer-Termin', async () => {
      const id = await terminAnlegen('teamer_only', true);
      const res = await anmelden(id);

      expect(res.status).toBe(403);

      const { rows } = await db.query(
        'SELECT COUNT(*)::int AS anzahl FROM event_bookings WHERE event_id = $1',
        [id]
      );
      expect(rows[0].anzahl).toBe(0);
    });


    it('VERBOTEN: Anmeldung zu einem abgesagten Termin', async () => {
      const id = await terminAnlegen('cancelled', true);
      const res = await anmelden(id);

      expect(res.status).toBe(400);

      const { rows } = await db.query(
        'SELECT COUNT(*)::int AS anzahl FROM event_bookings WHERE event_id = $1',
        [id]
      );
      expect(rows[0].anzahl).toBe(0);
    });

    it('ERLAUBT: Anmeldung zu einem regulaeren Termin geht weiterhin', async () => {
      // Gegenprobe -- die beiden Guards duerfen den normalen Weg nicht
      // mitnehmen.
      const id = await terminAnlegen(null, null);
      const res = await anmelden(id);

      // 200, nicht 201: Diese Route antwortet mit res.json() ohne
      // Statuscode (konfi.js:1710) -- anders als POST /konfi/requests.
      expect(res.status).toBe(200);

      const { rows } = await db.query(
        'SELECT COUNT(*)::int AS anzahl FROM event_bookings WHERE event_id = $1 AND user_id = $2',
        [id, USERS.konfi1.id]
      );
      expect(rows[0].anzahl).toBe(1);
    });

    it('Abmelden von einem abgesagten Termin bleibt moeglich', async () => {
      // Wichtig: Der cancelled-Guard sitzt nur im POST. Wer schon angemeldet
      // war, als der Termin abgesagt wurde, muss sich noch austragen koennen
      // -- sonst haette die Reparatur Angemeldete eingesperrt.
      const id = await terminAnlegen(null, null);
      await anmelden(id);
      await db.query('UPDATE events SET cancelled = true WHERE id = $1', [id]);

      const res = await request(app)
        .delete(`/api/konfi/events/${id}/register`)
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(200);
    });
  });

  // ================================================================
  // Befund N3 (27.08.2026): Antraege und target_role
  //
  // `GET /teamer/requests` filtert seit jeher `a.target_role='teamer'`
  // (teamer.js:1287-1299), der Konfi-Weg filterte gar nicht — weder beim
  // Lesen noch beim ANLEGEN.
  //
  // Nachgemessen, bevor es repariert wurde: Eine Konfi konnte per API einen
  // Antrag auf eine TEAMER-Aktivitaet stellen (POST -> 201), er erschien in
  // ihrer Liste, und die Leitung konnte ihn bestaetigen. Ergebnis waeren
  // Punkte aus einer Aktivitaet, die nicht fuer Konfis gedacht ist. Ueber
  // die Oberflaeche nicht erreichbar (die Auswahlliste dort filtert), per
  // API aber offen.
  // ================================================================
  describe('N3: Konfi-Antraege nur auf Konfi-Aktivitaeten', () => {
    let teamerAktivitaet;

    beforeEach(async () => {
      const { rows: [akt] } = await db.query(
        `INSERT INTO activities (name, points, type, organization_id, target_role)
         VALUES ('Teamer-Schulung', 5, 'gemeinde', $1, 'teamer') RETURNING id`,
        [ORGS.testGemeinde.id]
      );
      teamerAktivitaet = akt.id;
    });

    it('VERBOTEN: Antrag auf eine Teamer-Aktivitaet wird abgelehnt', async () => {
      const res = await request(app)
        .post('/api/konfi/requests')
        .set('Authorization', `Bearer ${konfiToken}`)
        .send({ activity_id: teamerAktivitaet, requested_date: '2026-08-27' });

      expect(res.status).toBe(404);

      const { rows } = await db.query(
        'SELECT COUNT(*)::int AS anzahl FROM activity_requests WHERE activity_id = $1',
        [teamerAktivitaet]
      );
      expect(rows[0].anzahl).toBe(0);
    });


    it('ERLAUBT: Antrag auf eine Konfi-Aktivitaet geht weiterhin durch', async () => {
      // Gegenprobe — der Filter darf den regulaeren Weg nicht mitnehmen.
      const res = await request(app)
        .post('/api/konfi/requests')
        .set('Authorization', `Bearer ${konfiToken}`)
        .send({
          activity_id: ACTIVITIES.sonntagsgottesdienst.id,
          requested_date: '2026-08-27'
        });

      expect(res.status).toBe(201);
    });

    it('die Liste zeigt keine Antraege auf Teamer-Aktivitaeten', async () => {
      // Altbestand: vor dem Fix konnten solche Zeilen entstehen. Am
      // Anlege-Weg vorbei direkt eingefuegt, damit der Lesepfad selbst
      // geprueft wird und nicht nur der geschlossene Eingang.
      await db.query(
        `INSERT INTO activity_requests (user_id, activity_id, requested_date, status, organization_id)
         VALUES ($1, $2, '2026-08-27', 'pending', $3)`,
        [USERS.konfi1.id, teamerAktivitaet, ORGS.testGemeinde.id]
      );

      const res = await request(app)
        .get('/api/konfi/requests')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(200);
      expect(res.body.filter(r => r.activity_name === 'Teamer-Schulung')).toHaveLength(0);
    });

    it('ein Antrag zu einer GELOESCHTEN Aktivitaet bleibt in der Liste', async () => {
      // Der LEFT JOIN bleibt bewusst ein LEFT JOIN (anders als im
      // Teamer-Weg): Sonst verschwaende ein Antrag aus der Historie, sobald
      // die Leitung die Aktivitaet loescht. Der target_role-Filter darf
      // diese Zeilen deshalb nicht mitnehmen.
      const { rows: [akt] } = await db.query(
        `INSERT INTO activities (name, points, type, organization_id, target_role)
         VALUES ('Wird geloescht', 3, 'gemeinde', $1, 'konfi') RETURNING id`,
        [ORGS.testGemeinde.id]
      );
      const { rows: [antrag] } = await db.query(
        `INSERT INTO activity_requests (user_id, activity_id, requested_date, status, organization_id)
         VALUES ($1, $2, '2026-08-27', 'pending', $3) RETURNING id`,
        [USERS.konfi1.id, akt.id, ORGS.testGemeinde.id]
      );
      await db.query('UPDATE activity_requests SET activity_id = NULL WHERE id = $1', [antrag.id]);

      const res = await request(app)
        .get('/api/konfi/requests')
        .set('Authorization', `Bearer ${konfiToken}`);

      expect(res.status).toBe(200);
      expect(res.body.map(r => r.id)).toContain(antrag.id);    });
  });

});
