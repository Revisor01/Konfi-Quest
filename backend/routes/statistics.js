const express = require('express');
const router = express.Router();

// Statistics routes for konfis and admins
module.exports = (db, verifyToken) => {
  
  // Get konfi statistics
  router.get('/', verifyToken, (req, res) => {
    const queries = {
      totalPoints: "SELECT SUM(gottesdienst_points + gemeinde_points) as total FROM konfis",
      mostActiveKonfi: "SELECT name, (gottesdienst_points + gemeinde_points) as total_points FROM konfis ORDER BY total_points DESC LIMIT 1",
      mostPopularActivity: `
        SELECT a.name, COUNT(*) as count 
        FROM konfi_activities ka 
        JOIN activities a ON ka.activity_id = a.id 
        GROUP BY a.name 
        ORDER BY count DESC 
        LIMIT 1
      `,
      totalActivities: "SELECT COUNT(*) as count FROM konfi_activities",
      totalKonfis: "SELECT COUNT(*) as count FROM konfis"
    };

    const results = {};
    let completed = 0;
    const totalQueries = Object.keys(queries).length;

    Object.entries(queries).forEach(([key, query]) => {
      db.get(query, [], (err, row) => {
        if (!err && row) {
          results[key] = row;
        }
        completed++;
        
        if (completed === totalQueries) {
          res.json(results);
        }
      });
    });
  });

  // Get konfi ranking (anonymized for konfis)
  router.get('/ranking', verifyToken, (req, res) => {
    const query = `
      SELECT id, name, (gottesdienst_points + gemeinde_points) as total_points
      FROM konfis 
      ORDER BY total_points DESC
    `;
    
    db.all(query, [], (err, rows) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      
      if (req.user.is_super_admin || req.user.role_name === 'admin') {
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
    });
  });

  return router;
};