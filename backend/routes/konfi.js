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
    
    // Get konfi basic info with points
    const konfiQuery = `
      SELECT k.*, j.name as jahrgang_name,
             COALESCE(SUM(ar.points), 0) as total_points,
             COALESCE(SUM(bp.points), 0) as bonus_points
      FROM konfis k 
      JOIN jahrgaenge j ON k.jahrgang_id = j.id
      LEFT JOIN activity_records ar ON k.id = ar.konfi_id
      LEFT JOIN bonus_points bp ON k.id = bp.konfi_id
      WHERE k.id = ?
      GROUP BY k.id
    `;
    
    // Get recent activities
    const activitiesQuery = `
      SELECT ar.*, a.name as activity_name, a.points as activity_points
      FROM activity_records ar
      JOIN activities a ON ar.activity_id = a.id
      WHERE ar.konfi_id = ?
      ORDER BY ar.created_at DESC
      LIMIT 5
    `;
    
    // Get earned badges
    const badgesQuery = `
      SELECT keb.*, cb.name as badge_name, cb.icon, cb.color
      FROM konfi_earned_badges keb
      JOIN custom_badges cb ON keb.badge_id = cb.id
      WHERE keb.konfi_id = ?
      ORDER BY keb.earned_at DESC
      LIMIT 5
    `;
    
    db.get(konfiQuery, [konfiId], (err, konfi) => {
      if (err) {
        console.error('Error fetching konfi data:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!konfi) {
        return res.status(404).json({ error: 'Konfi not found' });
      }
      
      db.all(activitiesQuery, [konfiId], (err, activities) => {
        if (err) {
          console.error('Error fetching activities:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        
        db.all(badgesQuery, [konfiId], (err, badges) => {
          if (err) {
            console.error('Error fetching badges:', err);
            return res.status(500).json({ error: 'Database error' });
          }
          
          res.json({
            konfi: konfi,
            recent_activities: activities,
            recent_badges: badges,
            total_points: (konfi.total_points || 0) + (konfi.bonus_points || 0)
          });
        });
      });
    });
  });

  // Get konfi profile
  router.get('/profile', verifyToken, (req, res) => {
    if (req.user.type !== 'konfi') {
      return res.status(403).json({ error: 'Konfi access required' });
    }
    
    const konfiId = req.user.id;
    
    const query = `
      SELECT k.*, j.name as jahrgang_name
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
      
      res.json(konfi);
    });
  });

  // Get konfi's activity requests
  router.get('/requests', verifyToken, (req, res) => {
    if (req.user.type !== 'konfi') {
      return res.status(403).json({ error: 'Konfi access required' });
    }
    
    const konfiId = req.user.id;
    
    const query = `
      SELECT ar.*, a.name as activity_name, a.points as activity_points,
             admin.display_name as reviewed_by_name
      FROM activity_requests ar
      JOIN activities a ON ar.activity_id = a.id
      LEFT JOIN admins admin ON ar.reviewed_by = admin.id
      WHERE ar.konfi_id = ?
      ORDER BY ar.created_at DESC
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
    
    const query = `
      SELECT a.*, c.name as category_name
      FROM activities a
      LEFT JOIN categories c ON a.category_id = c.id
      WHERE a.is_active = 1
      ORDER BY c.name, a.name
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
        return res.status(500).json({ error: 'Database error' });
      }
      
      res.json(badges);
    });
  });

  // Get badge statistics for konfi
  router.get('/badges/stats', verifyToken, (req, res) => {
    if (req.user.type !== 'konfi') {
      return res.status(403).json({ error: 'Konfi access required' });
    }
    
    const konfiId = req.user.id;
    
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
        return res.status(500).json({ error: 'Database error' });
      }
      
      res.json(stats);
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