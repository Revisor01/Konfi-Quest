const express = require('express');
const router = express.Router();

// Statistics routes for konfis and admins
module.exports = (db, rbacMiddleware) => {
  const { verifyTokenRBAC } = rbacMiddleware;
  
  // Get konfi statistics
  router.get('/', verifyTokenRBAC, async (req, res) => {
    try {
      const queries = {
        totalPoints: `
          SELECT SUM(kp.gottesdienst_points + kp.gemeinde_points) as total 
          FROM konfi_profiles kp
          JOIN users u ON kp.user_id = u.id
          JOIN roles r ON u.role_id = r.id
          WHERE r.name = 'konfi'
        `,
        mostActiveKonfi: `
          SELECT u.display_name as name, (kp.gottesdienst_points + kp.gemeinde_points) as total_points 
          FROM konfi_profiles kp
          JOIN users u ON kp.user_id = u.id
          JOIN roles r ON u.role_id = r.id
          WHERE r.name = 'konfi'
          ORDER BY total_points DESC 
          LIMIT 1
        `,
        mostPopularActivity: `
          SELECT a.name, COUNT(*) as count 
          FROM konfi_activities ka 
          JOIN activities a ON ka.activity_id = a.id 
          GROUP BY a.name 
          ORDER BY count DESC 
          LIMIT 1
        `,
        totalActivities: "SELECT COUNT(*) as count FROM konfi_activities",
        totalKonfis: `
          SELECT COUNT(*) as count 
          FROM users u
          JOIN roles r ON u.role_id = r.id
          WHERE r.name = 'konfi'
        `
      };
      
      // Führe alle Abfragen parallel aus
      const queryPromises = Object.values(queries).map(query => db.query(query));
      const queryResults = await Promise.all(queryPromises);
      
      // Baue das Ergebnisobjekt wieder zusammen
      const results = {};
      Object.keys(queries).forEach((key, index) => {
        // Jede Abfrage sollte eine Zeile zurückgeben, wir nehmen die erste aus dem "rows"-Array
        results[key] = queryResults[index].rows[0] || null;
      });
      
      res.json(results);

    } catch (err) {
      console.error('Database error in GET /statistics:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // Get konfi ranking (anonymized for konfis)
  router.get('/ranking', verifyTokenRBAC, async (req, res) => {
    const query = `
      SELECT u.id, u.display_name as name, (kp.gottesdienst_points + kp.gemeinde_points) as total_points
      FROM users u
      JOIN konfi_profiles kp ON u.id = kp.user_id
      JOIN roles r ON u.role_id = r.id
      WHERE r.name = 'konfi'
      ORDER BY total_points DESC
    `;
    
    try {
      const { rows } = await db.query(query);
      
      if (req.user.is_super_admin || req.user.role_name === 'org_admin') {
        // Admins get full ranking
        res.json(rows.map((row, index) => ({
          position: index + 1,
          name: row.name,
          points: row.total_points
        })));
      } else {
        // Konfis get anonymized ranking with their position
        const myPosition = rows.findIndex(row => row.id === req.user.id) + 1;
        const myPoints = rows.find(row => row.id === req.user.id)?.total_points || 0;
        
        res.json({
          myPosition,
          myPoints,
          totalKonfis: rows.length,
          topScores: rows.slice(0, 3).map(row => row.total_points),
          topNames: rows.slice(0, 3).map(row => row.name) // NEU: Namen für Initialen
        });
      }
    } catch (err) {
      console.error('Database error in GET /statistics/ranking:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  return router;
};