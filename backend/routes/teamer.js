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

  return router;
};
