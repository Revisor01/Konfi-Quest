const express = require('express');
const router = express.Router();

module.exports = (db, rbacVerifier, roleHelpers) => {
  const { requireTeamer } = roleHelpers;

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
        SELECT kb.badge_id, b.name, b.icon, b.color, kb.awarded_date
        FROM user_badges kb
        JOIN badges b ON kb.badge_id = b.id
        WHERE kb.user_id = $1
        ORDER BY kb.awarded_date DESC
      `;
      const { rows: badges } = await db.query(badgesQuery, [userId]);

      res.json({
        user: {
          display_name: req.user.display_name,
          username: req.user.username,
          organization_name: req.user.organization_name || ''
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

  return router;
};
