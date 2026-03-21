const express = require('express');
const router = express.Router();

module.exports = (db, rbacVerifier, roleHelpers) => {
  const { requireTeamer, requireOrgAdmin, requireAdmin } = roleHelpers;

  // Schema: siehe backend/migrations/064_consolidate_inline_schemas.sql

  // ====================================================================
  // TEAMER PROFIL
  // ====================================================================

  // GET /teamer/profile - Eingefrorene Konfi-Daten fuer Teamer
  router.get('/profile', rbacVerifier, (req, res, next) => {
    // Nur Teamer duerfen ihr Profil abrufen
    if (req.user.role_name !== 'teamer') {
      return res.status(403).json({ error: 'Nur Teamer koennen dieses Profil abrufen' });
    }
    next();
  }, async (req, res) => {
    try {
      const userId = req.user.id;

      // User-Daten aus DB laden (inkl. email, role_title, teamer_since)
      const userQuery = `
        SELECT u.display_name, u.username, u.email, u.role_title, u.teamer_since,
               o.name as organization_name
        FROM users u
        LEFT JOIN organizations o ON u.organization_id = o.id
        WHERE u.id = $1
      `;
      const { rows: [userData] } = await db.query(userQuery, [userId]);

      // Konfi-Profildaten (eingefroren nach Transition)
      const profileQuery = `
        SELECT kp.gottesdienst_points, kp.gemeinde_points,
               j.name as jahrgang_name
        FROM konfi_profiles kp
        LEFT JOIN jahrgaenge j ON kp.jahrgang_id = j.id
        WHERE kp.user_id = $1
      `;
      const { rows: [konfiProfile] } = await db.query(profileQuery, [userId]);

      // Konfi-Badges (eingefroren nach Transition)
      const badgesQuery = `
        SELECT kb.badge_id, b.name, b.description, b.icon, b.color,
               b.criteria_type, b.criteria_value,
               kb.awarded_date
        FROM user_badges kb
        JOIN custom_badges b ON kb.badge_id = b.id
        WHERE kb.user_id = $1
        ORDER BY kb.awarded_date DESC
      `;
      const { rows: badges } = await db.query(badgesQuery, [userId]);

      res.json({
        user: {
          display_name: userData?.display_name || req.user.display_name,
          username: userData?.username || req.user.username,
          email: userData?.email || '',
          role_title: userData?.role_title || '',
          teamer_since: userData?.teamer_since || null,
          organization_name: userData?.organization_name || ''
        },
        konfi_data: {
          gottesdienst_points: konfiProfile?.gottesdienst_points || 0,
          gemeinde_points: konfiProfile?.gemeinde_points || 0,
          jahrgang_name: konfiProfile?.jahrgang_name || '',
          badges: badges || []
        }
      });
    } catch (err) {
      console.error('Error loading teamer profile:', err);
      res.status(500).json({ error: 'Fehler beim Laden des Teamer-Profils' });
    }
  });

  // ====================================================================
  // TEAMER KONFI-HISTORY (Punkte-Verlauf aus der Konfi-Zeit)
  // ====================================================================

  // GET /teamer/konfi-history - Punkte-Verlauf fuer ehemalige Konfis (jetzt Teamer)
  router.get('/konfi-history', rbacVerifier, requireTeamer, async (req, res) => {
    try {
      if (req.user.role_name !== 'teamer') {
        return res.status(403).json({ error: 'Nur Teamer koennen die Konfi-Historie abrufen' });
      }

      const userId = req.user.id;
      const orgId = req.user.organization_id;

      // Get activities (Gottesdienst & Gemeinde points)
      const activitiesQuery = `
        SELECT
          ka.id,
          a.name as title,
          a.points,
          a.type as category,
          ka.completed_date as date,
          ka.comment,
          'activity' as source_type
        FROM user_activities ka
        JOIN activities a ON ka.activity_id = a.id
        WHERE ka.user_id = $1 AND ka.organization_id = $2
        ORDER BY ka.completed_date DESC
      `;
      const { rows: activities } = await db.query(activitiesQuery, [userId, orgId]);

      // Get bonus points
      const bonusQuery = `
        SELECT
          id,
          description as title,
          points,
          type as category,
          completed_date as date,
          NULL as comment,
          'bonus' as source_type
        FROM bonus_points
        WHERE konfi_id = $1 AND organization_id = $2
        ORDER BY completed_date DESC
      `;
      const { rows: bonusPoints } = await db.query(bonusQuery, [userId, orgId]);

      // Get event points
      const eventPointsQuery = `
        SELECT
          ep.id,
          e.name as title,
          ep.points,
          ep.point_type as category,
          ep.awarded_date as date,
          ep.description as comment,
          'event' as source_type
        FROM event_points ep
        JOIN events e ON ep.event_id = e.id
        WHERE ep.konfi_id = $1 AND ep.organization_id = $2
        ORDER BY ep.awarded_date DESC
      `;
      const { rows: eventPoints } = await db.query(eventPointsQuery, [userId, orgId]);

      // Combine and sort by date (newest first)
      const allPoints = [...activities, ...bonusPoints, ...eventPoints].sort((a, b) => {
        const dateA = new Date(a.date || 0);
        const dateB = new Date(b.date || 0);
        return dateB - dateA;
      });

      // Get konfi_profiles for accurate accumulated points
      const { rows: [konfiProfile] } = await db.query(
        'SELECT gottesdienst_points, gemeinde_points FROM konfi_profiles WHERE user_id = $1',
        [userId]
      );

      const totals = {
        gottesdienst: konfiProfile?.gottesdienst_points || 0,
        gemeinde: konfiProfile?.gemeinde_points || 0,
        total: (konfiProfile?.gottesdienst_points || 0) + (konfiProfile?.gemeinde_points || 0)
      };

      res.json({
        history: allPoints,
        totals
      });

    } catch (err) {
      console.error('Database error in GET /teamer/konfi-history:', err);
      res.status(500).json({ error: 'Datenbankfehler' });
    }
  });

  // ====================================================================
  // TEAMER-BADGES
  // ====================================================================

  // GET /teamer/badges - Alle verfuegbaren Teamer-Badges mit earned-Status
  router.get('/badges', rbacVerifier, requireTeamer, async (req, res) => {
    try {
      if (req.user.role_name !== 'teamer') {
        return res.status(403).json({ error: 'Nur Teamer koennen Teamer-Badges abrufen' });
      }

      const badgesQuery = `
        SELECT cb.*,
          CASE WHEN ub.id IS NOT NULL THEN true ELSE false END as earned,
          ub.awarded_date
        FROM custom_badges cb
        LEFT JOIN user_badges ub ON cb.id = ub.badge_id AND ub.user_id = $1
        WHERE cb.organization_id = $2 AND cb.target_role = 'teamer' AND (cb.is_active = true OR ub.id IS NOT NULL)
        ORDER BY ub.awarded_date DESC NULLS LAST, cb.name
      `;
      const { rows } = await db.query(badgesQuery, [req.user.id, req.user.organization_id]);
      res.json(rows);
    } catch (err) {
      console.error('Error loading teamer badges:', err);
      res.status(500).json({ error: 'Fehler beim Laden der Teamer-Badges' });
    }
  });

  // GET /teamer/badges/unseen - Anzahl ungesehener Badges
  router.get('/badges/unseen', rbacVerifier, requireTeamer, async (req, res) => {
    try {
      if (req.user.role_name !== 'teamer') {
        return res.status(403).json({ error: 'Nur Teamer koennen Badge-Status abrufen' });
      }

      const { rows: [result] } = await db.query(
        "SELECT COUNT(*) as count FROM user_badges WHERE user_id = $1 AND organization_id = $2 AND seen = false",
        [req.user.id, req.user.organization_id]
      );
      res.json({ unseen: parseInt(result.count) });
    } catch (err) {
      console.error('Error loading unseen badge count:', err);
      res.status(500).json({ error: 'Fehler beim Laden des Badge-Status' });
    }
  });

  // PUT /teamer/badges/mark-seen - Badges als gesehen markieren
  router.put('/badges/mark-seen', rbacVerifier, requireTeamer, async (req, res) => {
    try {
      if (req.user.role_name !== 'teamer') {
        return res.status(403).json({ error: 'Nur Teamer koennen Badges als gesehen markieren' });
      }

      await db.query(
        "UPDATE user_badges SET seen = true WHERE user_id = $1 AND organization_id = $2 AND seen = false",
        [req.user.id, req.user.organization_id]
      );
      res.json({ message: 'Badges als gesehen markiert' });
    } catch (err) {
      console.error('Error marking badges as seen:', err);
      res.status(500).json({ error: 'Fehler beim Aktualisieren des Badge-Status' });
    }
  });

  // ====================================================================
  // ZERTIFIKAT-TYPEN CRUD (Admin-only)
  // ====================================================================

  // GET /teamer/certificate-types - Alle aktiven Typen der Organisation
  router.get('/certificate-types', rbacVerifier, requireAdmin, async (req, res) => {
    try {
      const { rows } = await db.query(
        `SELECT id, name, icon, is_active, created_at
         FROM certificate_types
         WHERE organization_id = $1 AND is_active = true
         ORDER BY name`,
        [req.user.organization_id]
      );
      res.json(rows);
    } catch (err) {
      console.error('Error loading certificate types:', err);
      res.status(500).json({ error: 'Fehler beim Laden der Zertifikat-Typen' });
    }
  });

  // POST /teamer/certificate-types - Neuen Typ erstellen
  router.post('/certificate-types', rbacVerifier, requireOrgAdmin, async (req, res) => {
    try {
      const { name, icon } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Name ist erforderlich' });
      }

      const { rows: [created] } = await db.query(
        `INSERT INTO certificate_types (name, icon, organization_id)
         VALUES ($1, $2, $3)
         RETURNING id, name, icon, is_active, created_at`,
        [name.trim(), icon || 'ribbon', req.user.organization_id]
      );
      res.status(201).json(created);
    } catch (err) {
      if (err.code === '23505') {
        return res.status(409).json({ error: 'Ein Zertifikat-Typ mit diesem Namen existiert bereits' });
      }
      console.error('Error creating certificate type:', err);
      res.status(500).json({ error: 'Fehler beim Erstellen des Zertifikat-Typs' });
    }
  });

  // PUT /teamer/certificate-types/:id - Typ bearbeiten
  router.put('/certificate-types/:id', rbacVerifier, requireOrgAdmin, async (req, res) => {
    try {
      const { name, icon, is_active } = req.body;
      const updates = [];
      const params = [];
      let paramIdx = 1;

      if (name !== undefined) {
        if (!name.trim()) {
          return res.status(400).json({ error: 'Name darf nicht leer sein' });
        }
        updates.push(`name = $${paramIdx++}`);
        params.push(name.trim());
      }
      if (icon !== undefined) {
        updates.push(`icon = $${paramIdx++}`);
        params.push(icon);
      }
      if (is_active !== undefined) {
        updates.push(`is_active = $${paramIdx++}`);
        params.push(is_active);
      }

      if (updates.length === 0) {
        return res.status(400).json({ error: 'Keine Aenderungen angegeben' });
      }

      params.push(req.params.id, req.user.organization_id);
      const { rowCount } = await db.query(
        `UPDATE certificate_types SET ${updates.join(', ')}
         WHERE id = $${paramIdx++} AND organization_id = $${paramIdx}`,
        params
      );

      if (rowCount === 0) {
        return res.status(404).json({ error: 'Zertifikat-Typ nicht gefunden' });
      }
      res.json({ message: 'Zertifikat-Typ erfolgreich aktualisiert' });
    } catch (err) {
      if (err.code === '23505') {
        return res.status(409).json({ error: 'Ein Zertifikat-Typ mit diesem Namen existiert bereits' });
      }
      console.error('Error updating certificate type:', err);
      res.status(500).json({ error: 'Fehler beim Aktualisieren des Zertifikat-Typs' });
    }
  });

  // DELETE /teamer/certificate-types/:id - Typ loeschen (nur wenn nicht zugewiesen)
  router.delete('/certificate-types/:id', rbacVerifier, requireOrgAdmin, async (req, res) => {
    try {
      // Pruefen ob Zertifikate zugewiesen sind
      const { rows: [usage] } = await db.query(
        'SELECT COUNT(*) as count FROM user_certificates WHERE certificate_type_id = $1',
        [req.params.id]
      );

      if (parseInt(usage.count) > 0) {
        return res.status(409).json({
          error: 'Zertifikat-Typ kann nicht geloescht werden, da er bereits zugewiesen ist. Deaktivieren Sie ihn stattdessen.'
        });
      }

      const { rowCount } = await db.query(
        'DELETE FROM certificate_types WHERE id = $1 AND organization_id = $2',
        [req.params.id, req.user.organization_id]
      );

      if (rowCount === 0) {
        return res.status(404).json({ error: 'Zertifikat-Typ nicht gefunden' });
      }
      res.json({ message: 'Zertifikat-Typ erfolgreich geloescht' });
    } catch (err) {
      console.error('Error deleting certificate type:', err);
      res.status(500).json({ error: 'Fehler beim Loeschen des Zertifikat-Typs' });
    }
  });

  // ====================================================================
  // ZERTIFIKAT-ZUWEISUNG AN TEAMER (Admin-only)
  // ====================================================================

  // GET /teamer/:userId/certificates - Alle Zertifikate eines Teamers
  router.get('/:userId/certificates', rbacVerifier, requireAdmin, async (req, res) => {
    try {
      const { rows } = await db.query(
        `SELECT uc.id, uc.issued_date, uc.expiry_date, uc.created_at,
                ct.id as certificate_type_id, ct.name, ct.icon
         FROM user_certificates uc
         JOIN certificate_types ct ON uc.certificate_type_id = ct.id
         WHERE uc.user_id = $1 AND uc.organization_id = $2
         ORDER BY uc.issued_date DESC`,
        [req.params.userId, req.user.organization_id]
      );
      res.json(rows);
    } catch (err) {
      console.error('Error loading user certificates:', err);
      res.status(500).json({ error: 'Fehler beim Laden der Zertifikate' });
    }
  });

  // POST /teamer/:userId/certificates - Zertifikat zuweisen
  router.post('/:userId/certificates', rbacVerifier, requireOrgAdmin, async (req, res) => {
    try {
      const { certificate_type_id, issued_date, expiry_date } = req.body;

      if (!certificate_type_id || !issued_date) {
        return res.status(400).json({ error: 'Zertifikat-Typ und Ausstellungsdatum sind erforderlich' });
      }

      // Pruefen: User existiert und ist Teamer
      const { rows: [user] } = await db.query(
        `SELECT u.id FROM users u
         JOIN roles r ON u.role_id = r.id
         WHERE u.id = $1 AND u.organization_id = $2 AND r.name = 'teamer'`,
        [req.params.userId, req.user.organization_id]
      );

      if (!user) {
        return res.status(404).json({ error: 'Teamer nicht gefunden' });
      }

      // Pruefen: Zertifikat-Typ gehoert zur Organisation
      const { rows: [certType] } = await db.query(
        'SELECT id FROM certificate_types WHERE id = $1 AND organization_id = $2 AND is_active = true',
        [certificate_type_id, req.user.organization_id]
      );

      if (!certType) {
        return res.status(404).json({ error: 'Zertifikat-Typ nicht gefunden oder nicht aktiv' });
      }

      const { rows: [created] } = await db.query(
        `INSERT INTO user_certificates (user_id, certificate_type_id, organization_id, issued_date, expiry_date, admin_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, issued_date, expiry_date`,
        [req.params.userId, certificate_type_id, req.user.organization_id, issued_date, expiry_date || null, req.user.id]
      );

      res.status(201).json({ message: 'Zertifikat erfolgreich zugewiesen', ...created });
    } catch (err) {
      if (err.code === '23505') {
        return res.status(409).json({ error: 'Dieses Zertifikat wurde dem Teamer bereits zugewiesen' });
      }
      console.error('Error assigning certificate:', err);
      res.status(500).json({ error: 'Fehler beim Zuweisen des Zertifikats' });
    }
  });

  // DELETE /teamer/:userId/certificates/:certId - Zertifikat entfernen
  router.delete('/:userId/certificates/:certId', rbacVerifier, requireOrgAdmin, async (req, res) => {
    try {
      const { rowCount } = await db.query(
        'DELETE FROM user_certificates WHERE id = $1 AND user_id = $2 AND organization_id = $3',
        [req.params.certId, req.params.userId, req.user.organization_id]
      );

      if (rowCount === 0) {
        return res.status(404).json({ error: 'Zertifikat nicht gefunden' });
      }
      res.json({ message: 'Zertifikat erfolgreich entfernt' });
    } catch (err) {
      console.error('Error removing certificate:', err);
      res.status(500).json({ error: 'Fehler beim Entfernen des Zertifikats' });
    }
  });

  // ====================================================================
  // TEAMER-DASHBOARD
  // ====================================================================

  // GET /teamer/dashboard - Dashboard-Daten fuer Teamer
  router.get('/dashboard', rbacVerifier, requireTeamer, async (req, res) => {
    try {
      if (req.user.role_name !== 'teamer') {
        return res.status(403).json({ error: 'Nur Teamer koennen das Dashboard abrufen' });
      }

      const userId = req.user.id;
      const orgId = req.user.organization_id;

      // 1. Greeting
      const now = new Date();
      const greeting = {
        display_name: req.user.display_name,
        hour: now.getHours()
      };

      // 2. Certificates: Alle Typen der Org mit LEFT JOIN user_certificates
      const certificatesQuery = `
        SELECT ct.id, ct.name, ct.icon,
               uc.issued_date, uc.expiry_date,
               CASE
                 WHEN uc.id IS NULL THEN 'not_earned'
                 WHEN uc.expiry_date IS NOT NULL AND uc.expiry_date < CURRENT_DATE THEN 'expired'
                 ELSE 'valid'
               END as status
        FROM certificate_types ct
        LEFT JOIN user_certificates uc ON ct.id = uc.certificate_type_id AND uc.user_id = $1
        WHERE ct.organization_id = $2 AND ct.is_active = true
        ORDER BY
          CASE
            WHEN uc.id IS NOT NULL AND (uc.expiry_date IS NULL OR uc.expiry_date >= CURRENT_DATE) THEN 0
            WHEN uc.id IS NOT NULL AND uc.expiry_date < CURRENT_DATE THEN 1
            ELSE 2
          END,
          ct.name
      `;
      const { rows: certificates } = await db.query(certificatesQuery, [userId, orgId]);

      // 3. Events: Naechste 3 anstehende Events (Teamer-Events + Teamer-gesucht)
      const eventsQuery = `
        SELECT e.id, e.name AS title, e.event_date, e.event_end_time, e.location, e.type,
               e.teamer_only, e.teamer_needed, e.bring_items, e.cancelled,
               CASE WHEN eb.id IS NOT NULL THEN true ELSE false END as is_registered,
               eb.status as booking_status
        FROM events e
        LEFT JOIN event_bookings eb ON e.id = eb.event_id AND eb.user_id = $1
        WHERE e.organization_id = $2
          AND e.event_date >= CURRENT_DATE
          AND (e.cancelled IS NOT TRUE)
          AND eb.id IS NOT NULL
        ORDER BY e.event_date ASC
        LIMIT 5
      `;
      const { rows: events } = await db.query(eventsQuery, [userId, orgId]);

      // 4. Badges: Letzte 3 earned + Counts
      const recentBadgesQuery = `
        SELECT cb.icon, cb.name, ub.awarded_date
        FROM user_badges ub
        JOIN custom_badges cb ON ub.badge_id = cb.id
        WHERE ub.user_id = $1 AND ub.organization_id = $2 AND cb.target_role = 'teamer'
        ORDER BY ub.awarded_date DESC
        LIMIT 3
      `;
      const { rows: recentBadges } = await db.query(recentBadgesQuery, [userId, orgId]);

      const earnedCountQuery = `
        SELECT COUNT(*) as count FROM user_badges ub
        JOIN custom_badges cb ON ub.badge_id = cb.id
        WHERE ub.user_id = $1 AND ub.organization_id = $2 AND cb.target_role = 'teamer'
      `;
      const { rows: [earnedResult] } = await db.query(earnedCountQuery, [userId, orgId]);

      const totalCountQuery = `
        SELECT COUNT(*) as count FROM custom_badges
        WHERE organization_id = $1 AND target_role = 'teamer' AND is_active = true
      `;
      const { rows: [totalResult] } = await db.query(totalCountQuery, [orgId]);

      const badges = {
        recent: recentBadges,
        earned_count: parseInt(earnedResult.count),
        total_count: parseInt(totalResult.count)
      };

      // 5. Config: Dashboard-Config aus settings
      const configQuery = `
        SELECT key, value FROM settings
        WHERE organization_id = $1 AND key LIKE 'teamer_dashboard_show_%'
      `;
      const { rows: configRows } = await db.query(configQuery, [orgId]);

      const config = {
        show_zertifikate: true,
        show_events: true,
        show_badges: true,
        show_losung: true
      };

      configRows.forEach(row => {
        config[row.key.replace('teamer_dashboard_show_', 'show_')] = row.value === 'true' || row.value === '1';
      });

      res.json({ greeting, certificates, events, badges, config });
    } catch (err) {
      console.error('Error loading teamer dashboard:', err);
      res.status(500).json({ error: 'Fehler beim Laden des Teamer-Dashboards' });
    }
  });

  // ====================================================================
  // TAGESLOSUNG (eigener Endpoint fuer Teamer)
  // ====================================================================
  router.get('/tageslosung', rbacVerifier, requireTeamer, async (req, res) => {
    try {
      const translation = 'LUT'; // Teamer: immer Lutherbibel
      const today = new Date().toISOString().split('T')[0];

      // Check cache
      const { rows: [cachedVerse] } = await db.query(
        'SELECT verse_data FROM daily_verses WHERE date = $1 AND translation = $2',
        [today, translation]
      );

      if (cachedVerse) {
        return res.json({
          success: true,
          data: cachedVerse.verse_data,
          translation,
          cached: true
        });
      }

      // Fetch from API
      const fetch = (await import('node-fetch')).default;
      const apiUrl = `https://losung.konfi-quest.de/api/?api_key=ksadh8324oijcff45rfdsvcvhoids44&translation=${translation}`;

      const response = await fetch(apiUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Konfi-Quest-App/1.0'
        },
        timeout: 10000
      });

      if (!response.ok) {
        throw new Error(`Losungen API error: ${response.status}`);
      }

      const losungData = await response.json();

      if (!losungData.success) {
        throw new Error('Losungen API returned error');
      }

      // Cache
      try {
        await db.query(
          'INSERT INTO daily_verses (date, translation, verse_data) VALUES ($1, $2, $3) ON CONFLICT (date, translation) DO NOTHING',
          [today, translation, losungData.data]
        );
      } catch (cacheErr) {
        console.error('Cache write error:', cacheErr.message);
      }

      res.json({
        success: true,
        data: losungData.data,
        translation
      });
    } catch (err) {
      console.error('Tageslosung error:', err.message);
      res.status(500).json({ success: false, error: 'Tageslosung konnte nicht geladen werden' });
    }
  });

  return router;
};
