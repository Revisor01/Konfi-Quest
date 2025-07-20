const express = require('express');
const router = express.Router();

// Konfi-specific routes
module.exports = (db, verifyToken) => {
  
  // Get konfi dashboard data
  router.get('/dashboard', verifyToken, (req, res) => {
    if (req.user.type !== 'konfi') {
      return res.status(403).json({ error: 'Konfi access required' });
    }
    
    const konfiId = req.user.id;
    
    // Get konfi basic info 
    const konfiQuery = `
      SELECT k.*, j.name as jahrgang_name, j.confirmation_date
      FROM konfis k 
      JOIN jahrgaenge j ON k.jahrgang_id = j.id
      WHERE k.id = ?
    `;
    
    db.get(konfiQuery, [konfiId], (err, konfi) => {
      if (err) {
        console.error('Error fetching konfi data:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!konfi) {
        return res.status(404).json({ error: 'Konfi not found' });
      }
      
      // Check if badges table exists and get badges for this konfi
      db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='custom_badges'", (err, result) => {
        let badges = [];
        
        if (err || !result) {
          // Table doesn't exist, skip badges and continue with ranking
          continueWithRanking();
          return;
        }
        
        const badgesQuery = `
          SELECT cb.id, cb.name, cb.description, cb.icon_name, cb.criteria_type, cb.criteria_value,
                 keb.earned_at
          FROM custom_badges cb
          LEFT JOIN konfi_earned_badges keb ON cb.id = keb.badge_id AND keb.konfi_id = ?
          WHERE keb.earned_at IS NOT NULL
          ORDER BY keb.earned_at DESC
          LIMIT 3
        `;
        
        db.all(badgesQuery, [konfiId], (err, badgeResults) => {
          if (err) {
            console.error('Error fetching badges:', err);
            badges = [];
          } else {
            badges = badgeResults;
          }
          continueWithRanking();
        });
      });
      
      function continueWithRanking() {
        // Get ranking for jahrgang
        const rankingQuery = `
          SELECT k.id, k.display_name, 
                 (k.gottesdienst_points + k.gemeinde_points) as points
          FROM konfis k
          WHERE k.jahrgang_id = ?
          ORDER BY points DESC
          LIMIT 3
        `;
        
        db.all(rankingQuery, [konfi.jahrgang_id], (err, ranking) => {
          if (err) {
            console.error('Error fetching ranking:', err);
            ranking = [];
          }
          
          // Add initials to ranking
          const rankingWithInitials = ranking.map(r => ({
            ...r,
            initials: r.display_name ? r.display_name.split(' ').map(word => word.charAt(0)).join('').toUpperCase().substring(0, 2) : '??'
          }));
          
          // Calculate days to confirmation
          let daysToConfirmation = null;
          if (konfi.confirmation_date) {
            const confirmationDate = new Date(konfi.confirmation_date);
            const now = new Date();
            const diffTime = confirmationDate.getTime() - now.getTime();
            daysToConfirmation = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
          }
          
          // Return dashboard data
          res.json({
            konfi: konfi,
            recent_badges: badges,
            ranking: rankingWithInitials,
            total_points: (konfi.gottesdienst_points || 0) + (konfi.gemeinde_points || 0),
            days_to_confirmation: daysToConfirmation > 0 ? daysToConfirmation : null,
            confirmation_date: konfi.confirmation_date
          });
        });
      }
    });
  });

  // Get konfi profile
  router.get('/profile', verifyToken, (req, res) => {
    if (req.user.type !== 'konfi') {
      return res.status(403).json({ error: 'Konfi access required' });
    }
    
    const konfiId = req.user.id;
    
    const query = `
      SELECT k.*, j.name as jahrgang_name, j.year as jahrgang_year
      FROM konfis k 
      JOIN jahrgaenge j ON k.jahrgang_id = j.id
      WHERE k.id = ?
    `;
    
    db.get(query, [konfiId], (err, konfi) => {
      if (err) {
        console.error('Error fetching konfi profile:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!konfi) {
        return res.status(404).json({ error: 'Konfi not found' });
      }
      
      // Don't send sensitive data
      delete konfi.password_hash;
      
      // Get additional profile stats (simplified to avoid missing tables)
      const statsQuery = `
        SELECT 
          0 as badge_count,
          COUNT(DISTINCT ar.id) as activity_count,
          0 as event_count,
          COUNT(DISTINCT CASE WHEN ar.status = 'pending' THEN ar.id END) as pending_requests
        FROM konfis k
        LEFT JOIN activity_requests ar ON k.id = ar.konfi_id
        WHERE k.id = ?
      `;
      
      db.get(statsQuery, [konfiId], (err, stats) => {
        if (err) {
          console.error('Error fetching konfi stats:', err);
          stats = { badge_count: 0, activity_count: 0, event_count: 0, pending_requests: 0 };
        }
        
        // Get ranking position
        const rankingQuery = `
          SELECT COUNT(*) + 1 as rank_in_jahrgang,
                 (SELECT COUNT(*) FROM konfis WHERE jahrgang_id = ?) as total_in_jahrgang
          FROM konfis 
          WHERE jahrgang_id = ? 
          AND (gottesdienst_points + gemeinde_points) > ?
        `;
        
        const totalPoints = (konfi.gottesdienst_points || 0) + (konfi.gemeinde_points || 0);
        
        db.get(rankingQuery, [konfi.jahrgang_id, konfi.jahrgang_id, totalPoints], (err, ranking) => {
          if (err) {
            console.error('Error fetching ranking:', err);
            ranking = { rank_in_jahrgang: null, total_in_jahrgang: null };
          }
          
          // Mock progress overview for now (can be enhanced later)
          const progressOverview = {
            achievements: {
              total_activities: stats.activity_count || 0,
              total_events: stats.event_count || 0,
              total_badges: stats.badge_count || 0
            }
          };
          
          res.json({
            ...konfi,
            total_points: totalPoints,
            badge_count: stats.badge_count || 0,
            activity_count: stats.activity_count || 0,
            event_count: stats.event_count || 0,
            pending_requests: stats.pending_requests || 0,
            rank_in_jahrgang: ranking.rank_in_jahrgang,
            total_in_jahrgang: ranking.total_in_jahrgang,
            recent_activities: [], // Could be enhanced
            progress_overview: progressOverview
          });
        });
      });
    });
  });

  // Get konfi's activity requests
  router.get('/requests', verifyToken, (req, res) => {
    if (req.user.type !== 'konfi') {
      return res.status(403).json({ error: 'Konfi access required' });
    }
    
    const konfiId = req.user.id;
    
    // Simplified query to match existing table structure
    const query = `
      SELECT ar.*, a.title as activity_title, a.points as activity_points
      FROM activity_requests ar
      LEFT JOIN activities a ON ar.activity_id = a.id
      WHERE ar.konfi_id = ?
      ORDER BY ar.submitted_at DESC
    `;
    
    db.all(query, [konfiId], (err, requests) => {
      if (err) {
        console.error('Error fetching activity requests:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      res.json(requests);
    });
  });

  // Submit new activity request
  router.post('/requests', verifyToken, (req, res) => {
    if (req.user.type !== 'konfi') {
      return res.status(403).json({ error: 'Konfi access required' });
    }
    
    const konfiId = req.user.id;
    const { activity_id, description, photo_path } = req.body;
    
    if (!activity_id) {
      return res.status(400).json({ error: 'Activity ID is required' });
    }
    
    const insertQuery = `
      INSERT INTO activity_requests (konfi_id, activity_id, description, photo_path, status)
      VALUES (?, ?, ?, ?, 'pending')
    `;
    
    db.run(insertQuery, [konfiId, activity_id, description, photo_path], function(err) {
      if (err) {
        console.error('Error creating activity request:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      res.json({ 
        id: this.lastID, 
        message: 'Activity request submitted successfully' 
      });
    });
  });

  // Get available activities for requests
  router.get('/activities', verifyToken, (req, res) => {
    if (req.user.type !== 'konfi') {
      return res.status(403).json({ error: 'Konfi access required' });
    }
    
    // Simplified query to match existing table structure
    const query = `
      SELECT a.*, c.name as category_name
      FROM activities a
      LEFT JOIN categories c ON a.category_id = c.id
      ORDER BY c.name, a.title
    `;
    
    db.all(query, (err, activities) => {
      if (err) {
        console.error('Error fetching activities:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      res.json(activities);
    });
  });

  // Get konfi's badges
  router.get('/badges', verifyToken, (req, res) => {
    if (req.user.type !== 'konfi') {
      return res.status(403).json({ error: 'Konfi access required' });
    }
    
    const konfiId = req.user.id;
    
    // Check if badges table exists first
    db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='custom_badges'", (err, result) => {
      if (err || !result) {
        // Table doesn't exist, return empty array
        return res.json([]);
      }
      
      // Get all badges with earned status
      const query = `
        SELECT cb.*, 
               CASE WHEN keb.konfi_id IS NOT NULL THEN 1 ELSE 0 END as earned,
               keb.earned_at
        FROM custom_badges cb
        LEFT JOIN konfi_earned_badges keb ON cb.id = keb.badge_id AND keb.konfi_id = ?
        ORDER BY earned DESC, cb.name
      `;
      
      db.all(query, [konfiId], (err, badges) => {
        if (err) {
          console.error('Error fetching badges:', err);
          return res.json([]); // Return empty array instead of error
        }
        
        res.json(badges);
      });
    });
  });

  // Get badge statistics for konfi
  router.get('/badges/stats', verifyToken, (req, res) => {
    if (req.user.type !== 'konfi') {
      return res.status(403).json({ error: 'Konfi access required' });
    }
    
    const konfiId = req.user.id;
    
    // Check if badges table exists first
    db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='custom_badges'", (err, result) => {
      if (err || !result) {
        // Table doesn't exist, return empty stats
        return res.json({ total_badges: 0, earned_badges: 0 });
      }
      
      const statsQuery = `
        SELECT 
          COUNT(cb.id) as total_badges,
          COUNT(keb.badge_id) as earned_badges
        FROM custom_badges cb
        LEFT JOIN konfi_earned_badges keb ON cb.id = keb.badge_id AND keb.konfi_id = ?
      `;
      
      db.get(statsQuery, [konfiId], (err, stats) => {
        if (err) {
          console.error('Error fetching badge stats:', err);
          return res.json({ total_badges: 0, earned_badges: 0 });
        }
        
        res.json(stats);
      });
    });
  });

  // Get konfi's events
  router.get('/events', verifyToken, (req, res) => {
    if (req.user.type !== 'konfi') {
      return res.status(403).json({ error: 'Konfi access required' });
    }
    
    const konfiId = req.user.id;
    
    const query = `
      SELECT e.*, 
             CASE WHEN ker.konfi_id IS NOT NULL THEN 1 ELSE 0 END as registered,
             ker.registered_at
      FROM events e
      LEFT JOIN konfi_event_registrations ker ON e.id = ker.event_id AND ker.konfi_id = ?
      WHERE e.is_active = 1 AND e.event_date >= date('now')
      ORDER BY e.event_date, e.start_time
    `;
    
    db.all(query, [konfiId], (err, events) => {
      if (err) {
        console.error('Error fetching events:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      res.json(events);
    });
  });

  // Register for event
  router.post('/events/:id/register', verifyToken, (req, res) => {
    if (req.user.type !== 'konfi') {
      return res.status(403).json({ error: 'Konfi access required' });
    }
    
    const konfiId = req.user.id;
    const eventId = req.params.id;
    
    // Check if already registered
    db.get('SELECT id FROM konfi_event_registrations WHERE konfi_id = ? AND event_id = ?', 
      [konfiId, eventId], (err, existing) => {
      if (err) {
        console.error('Error checking registration:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (existing) {
        return res.status(409).json({ error: 'Already registered for this event' });
      }
      
      // Register for event
      db.run('INSERT INTO konfi_event_registrations (konfi_id, event_id) VALUES (?, ?)',
        [konfiId, eventId], function(err) {
        if (err) {
          console.error('Error registering for event:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        
        res.json({ 
          message: 'Successfully registered for event',
          registration_id: this.lastID 
        });
      });
    });
  });

  return router;
};