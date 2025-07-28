const express = require('express');
const router = express.Router();

// Statistics routes for konfis and admins
module.exports = (db, rbacMiddleware) => {
  const { verifyTokenRBAC } = rbacMiddleware;
  
  // Get konfi statistics
  router.get('/', verifyTokenRBAC, async (req, res) => {
    try {
      const queries = {
        organizationStats: `
          SELECT 
            SUM(kp.gottesdienst_points) as total_gottesdienst_points,
            SUM(kp.gemeinde_points) as total_gemeinde_points,
            SUM(kp.gottesdienst_points + kp.gemeinde_points) as total_points,
            COUNT(DISTINCT u.id) as total_konfis,
            COUNT(DISTINCT CASE WHEN kp.gottesdienst_points > 0 OR kp.gemeinde_points > 0 THEN u.id END) as active_konfis
          FROM konfi_profiles kp
          JOIN users u ON kp.user_id = u.id
          JOIN roles r ON u.role_id = r.id
          WHERE r.name = 'konfi' AND u.organization_id = $1
        `,
        totalPoints: `
          SELECT SUM(kp.gottesdienst_points + kp.gemeinde_points) as total 
          FROM konfi_profiles kp
          JOIN users u ON kp.user_id = u.id
          JOIN roles r ON u.role_id = r.id
          WHERE r.name = 'konfi' AND u.organization_id = $1
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
      
      const orgId = req.user.organization_id;
      
      // Execute organizationStats query with parameter
      const { rows: [orgStats] } = await db.query(queries.organizationStats, [orgId]);
      
      // Execute other queries with organization filtering
      const { rows: [totalPoints] } = await db.query(queries.totalPoints, [orgId]);
      const { rows: [mostActive] } = await db.query(`
        SELECT u.display_name as name, (kp.gottesdienst_points + kp.gemeinde_points) as total_points 
        FROM konfi_profiles kp
        JOIN users u ON kp.user_id = u.id
        JOIN roles r ON u.role_id = r.id
        WHERE r.name = 'konfi' AND u.organization_id = $1
        ORDER BY total_points DESC LIMIT 1
      `, [orgId]);
      
      const { rows: [popularActivity] } = await db.query(`
        SELECT a.name, COUNT(*) as count 
        FROM konfi_activities ka 
        JOIN activities a ON ka.activity_id = a.id 
        WHERE ka.organization_id = $1
        GROUP BY a.name ORDER BY count DESC LIMIT 1
      `, [orgId]);
      
      const results = {
        organizationStats: orgStats,
        totalPoints: totalPoints,
        mostActiveKonfi: mostActive,
        mostPopularActivity: popularActivity
      };
      
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