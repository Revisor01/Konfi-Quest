const express = require('express');
const router = express.Router();

// Statistics routes
module.exports = (db, verifyToken) => {
  
  // Get statistics
  router.get('/', verifyToken, (req, res) => {
    const stats = {};
    
    // Get total konfis
    db.get("SELECT COUNT(*) as total FROM konfis", [], (err, konfiCount) => {
      if (err) {
        console.error('Error fetching konfi count:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      stats.totalKonfis = konfiCount.total;
      
      // Get total activities
      db.get("SELECT COUNT(*) as total FROM activities", [], (err, activityCount) => {
        if (err) {
          console.error('Error fetching activity count:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        stats.totalActivities = activityCount.total;
        
        // Get total badges
        db.get("SELECT COUNT(*) as total FROM badges", [], (err, badgeCount) => {
          if (err) {
            console.error('Error fetching badge count:', err);
            return res.status(500).json({ error: 'Database error' });
          }
          stats.totalBadges = badgeCount.total;
          
          // Get average points
          db.get("SELECT AVG(gottesdienst_points) as avg_gottesdienst, AVG(gemeinde_points) as avg_gemeinde FROM konfis", [], (err, avgPoints) => {
            if (err) {
              console.error('Error fetching average points:', err);
              return res.status(500).json({ error: 'Database error' });
            }
            stats.averageGottesdienstPoints = Math.round(avgPoints.avg_gottesdienst || 0);
            stats.averageGemeindePoints = Math.round(avgPoints.avg_gemeinde || 0);
            
            // Get total assigned activities
            db.get("SELECT COUNT(*) as total FROM konfi_activities", [], (err, assignedCount) => {
              if (err) {
                console.error('Error fetching assigned activities count:', err);
                return res.status(500).json({ error: 'Database error' });
              }
              stats.totalAssignedActivities = assignedCount.total;
              
              // Get total bonus points
              db.get("SELECT COUNT(*) as total FROM bonus_points", [], (err, bonusCount) => {
                if (err) {
                  console.error('Error fetching bonus points count:', err);
                  return res.status(500).json({ error: 'Database error' });
                }
                stats.totalBonusPoints = bonusCount.total;
                
                // Get activity type distribution
                db.all(`SELECT a.type, COUNT(*) as count 
                        FROM konfi_activities ka 
                        JOIN activities a ON ka.activity_id = a.id 
                        GROUP BY a.type`, [], (err, typeDistribution) => {
                  if (err) {
                    console.error('Error fetching type distribution:', err);
                    return res.status(500).json({ error: 'Database error' });
                  }
                  stats.activityTypeDistribution = typeDistribution;
                  
                  // Get monthly activity trends (last 12 months)
                  db.all(`SELECT 
                            strftime('%Y-%m', ka.completed_date) as month,
                            COUNT(*) as count
                          FROM konfi_activities ka
                          WHERE ka.completed_date >= date('now', '-12 months')
                          GROUP BY month
                          ORDER BY month`, [], (err, monthlyTrends) => {
                    if (err) {
                      console.error('Error fetching monthly trends:', err);
                      return res.status(500).json({ error: 'Database error' });
                    }
                    stats.monthlyActivityTrends = monthlyTrends;
                    
                    res.json(stats);
                  });
                });
              });
            });
          });
        });
      });
    });
  });

  // Get ranking
  router.get('/ranking', verifyToken, (req, res) => {
    const type = req.query.type || 'total'; // 'total', 'gottesdienst', 'gemeinde'
    const limit = req.query.limit || 10;
    
    let orderBy = 'k.gottesdienst_points + k.gemeinde_points';
    if (type === 'gottesdienst') {
      orderBy = 'k.gottesdienst_points';
    } else if (type === 'gemeinde') {
      orderBy = 'k.gemeinde_points';
    }
    
    db.all(`SELECT k.id, k.name, k.gottesdienst_points, k.gemeinde_points,
                   (k.gottesdienst_points + k.gemeinde_points) as total_points,
                   j.name as jahrgang_name,
                   COUNT(DISTINCT kb.badge_id) as badge_count
            FROM konfis k
            LEFT JOIN jahrgaenge j ON k.jahrgang_id = j.id
            LEFT JOIN konfi_badges kb ON k.id = kb.konfi_id
            GROUP BY k.id
            ORDER BY ${orderBy} DESC
            LIMIT ?`, [limit], (err, ranking) => {
      if (err) {
        console.error('Error fetching ranking:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      // Add ranking position
      const rankedData = ranking.map((konfi, index) => ({
        ...konfi,
        position: index + 1
      }));
      
      res.json(rankedData);
    });
  });

  // Get jahrgang statistics
  router.get('/jahrgaenge', verifyToken, (req, res) => {
    db.all(`SELECT j.id, j.name,
                   COUNT(k.id) as konfi_count,
                   COALESCE(AVG(k.gottesdienst_points), 0) as avg_gottesdienst_points,
                   COALESCE(AVG(k.gemeinde_points), 0) as avg_gemeinde_points,
                   COALESCE(AVG(k.gottesdienst_points + k.gemeinde_points), 0) as avg_total_points,
                   COUNT(DISTINCT kb.badge_id) as total_badges_earned
            FROM jahrgaenge j
            LEFT JOIN konfis k ON j.id = k.jahrgang_id
            LEFT JOIN konfi_badges kb ON k.id = kb.konfi_id
            GROUP BY j.id
            ORDER BY j.name`, [], (err, jahrgangStats) => {
      if (err) {
        console.error('Error fetching jahrgang statistics:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      res.json(jahrgangStats.map(stat => ({
        ...stat,
        avg_gottesdienst_points: Math.round(stat.avg_gottesdienst_points),
        avg_gemeinde_points: Math.round(stat.avg_gemeinde_points),
        avg_total_points: Math.round(stat.avg_total_points)
      })));
    });
  });

  // Get activity statistics
  router.get('/activities', verifyToken, (req, res) => {
    db.all(`SELECT a.id, a.name, a.type, a.points,
                   COUNT(ka.id) as assigned_count,
                   COUNT(DISTINCT ka.konfi_id) as unique_konfis
            FROM activities a
            LEFT JOIN konfi_activities ka ON a.id = ka.activity_id
            GROUP BY a.id
            ORDER BY assigned_count DESC`, [], (err, activityStats) => {
      if (err) {
        console.error('Error fetching activity statistics:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      res.json(activityStats);
    });
  });

  // Get badge statistics
  router.get('/badges', verifyToken, (req, res) => {
    db.all(`SELECT b.id, b.name, b.criteria_type, b.criteria_value,
                   COUNT(kb.id) as earned_count,
                   COUNT(DISTINCT kb.konfi_id) as unique_konfis
            FROM badges b
            LEFT JOIN konfi_badges kb ON b.id = kb.badge_id
            GROUP BY b.id
            ORDER BY earned_count DESC`, [], (err, badgeStats) => {
      if (err) {
        console.error('Error fetching badge statistics:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      res.json(badgeStats);
    });
  });

  return router;
};