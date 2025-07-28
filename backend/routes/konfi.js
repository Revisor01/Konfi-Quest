const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'konfi-secret-2025';

// Konfi-specific routes
module.exports = (db, rbacMiddleware) => {
  const { verifyTokenRBAC } = rbacMiddleware;

  // Get konfi dashboard data
  router.get('/dashboard', verifyTokenRBAC, async (req, res) => {
    if (req.user.type !== 'konfi') {
      return res.status(403).json({ error: 'Konfi access required' });
    }
    
    try {
      const konfiId = req.user.id;
      
      // Get konfi basic info 
      const konfiQuery = `
        SELECT u.id, u.display_name, kp.gottesdienst_points, kp.gemeinde_points, 
               kp.jahrgang_id, j.name as jahrgang_name, j.confirmation_date
        FROM users u
        JOIN konfi_profiles kp ON u.id = kp.user_id
        JOIN jahrgaenge j ON kp.jahrgang_id = j.id
        JOIN roles r ON u.role_id = r.id
        WHERE u.id = $1 AND r.name = 'konfi'
      `;
      const { rows: [konfi] } = await db.query(konfiQuery, [konfiId]);

      if (!konfi) {
        return res.status(404).json({ error: 'Konfi not found' });
      }

      // Check if badges table exists and get badges for this konfi
      let badges = [];
      const checkBadgesTableQuery = "SELECT to_regclass('public.custom_badges')";
      const { rows: [tableExistsResult] } = await db.query(checkBadgesTableQuery);

      if (tableExistsResult && tableExistsResult.to_regclass) {
        const badgesQuery = `
          SELECT cb.id, cb.name, cb.description, cb.icon, cb.criteria_type, cb.criteria_value,
                 kb.earned_at
          FROM custom_badges cb
          LEFT JOIN konfi_badges kb ON cb.id = kb.badge_id AND kb.konfi_id = $1
          WHERE kb.earned_at IS NOT NULL
          ORDER BY kb.earned_at DESC
          LIMIT 3
        `;
        const { rows: badgeResults } = await db.query(badgesQuery, [konfiId]);
        badges = badgeResults;
      }

      // Get ranking for jahrgang
      const rankingQuery = `
        SELECT u.id, u.display_name, 
               (kp.gottesdienst_points + kp.gemeinde_points) as points
        FROM users u
        JOIN konfi_profiles kp ON u.id = kp.user_id
        JOIN roles r ON u.role_id = r.id
        WHERE kp.jahrgang_id = $1 AND r.name = 'konfi'
        ORDER BY points DESC
        LIMIT 3
      `;
      const { rows: ranking } = await db.query(rankingQuery, [konfi.jahrgang_id]);

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
      
    } catch (err) {
      console.error('Database error in GET /dashboard:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // Get konfi profile
  router.get('/profile', verifyTokenRBAC, async (req, res) => {
    if (req.user.type !== 'konfi') {
      return res.status(403).json({ error: 'Konfi access required' });
    }
    
    try {
      const konfiId = req.user.id;
      
      const query = `
        SELECT u.id, u.display_name, kp.gottesdienst_points, kp.gemeinde_points, 
               kp.jahrgang_id, kp.password_plain, j.name as jahrgang_name
        FROM users u
        JOIN konfi_profiles kp ON u.id = kp.user_id
        JOIN jahrgaenge j ON kp.jahrgang_id = j.id
        JOIN roles r ON u.role_id = r.id
        WHERE u.id = $1 AND r.name = 'konfi'
      `;
      const { rows: [konfi] } = await db.query(query, [konfiId]);
      
      if (!konfi) {
        return res.status(404).json({ error: 'Konfi not found' });
      }
      
      // Get additional profile stats
      const statsQuery = `
        SELECT 
          0 as badge_count, -- Placeholder, as custom_badges might not exist
          COUNT(DISTINCT ar.id) as activity_count,
          0 as event_count, -- Placeholder
          COUNT(DISTINCT CASE WHEN ar.status = 'pending' THEN ar.id END) as pending_requests
        FROM users u
        JOIN konfi_profiles kp ON u.id = kp.user_id
        JOIN roles r ON u.role_id = r.id
        LEFT JOIN activity_requests ar ON u.id = ar.konfi_id
        WHERE u.id = $1 AND r.name = 'konfi'
      `;
      const { rows: [stats] } = await db.query(statsQuery, [konfiId]);
      
      // Get ranking position
      const totalPoints = (konfi.gottesdienst_points || 0) + (konfi.gemeinde_points || 0);
      const rankingQuery = `
        WITH MyRank AS (
          SELECT 
            (kp.gottesdienst_points + kp.gemeinde_points) as total_points,
            RANK() OVER (PARTITION BY kp.jahrgang_id ORDER BY (kp.gottesdienst_points + kp.gemeinde_points) DESC) as rank_in_jahrgang
          FROM users u
          JOIN konfi_profiles kp ON u.id = kp.user_id
          JOIN roles r ON u.role_id = r.id
          WHERE kp.jahrgang_id = $1 AND r.name = 'konfi'
        ), TotalCount AS (
           SELECT COUNT(*) as total_in_jahrgang 
           FROM users u2 
           JOIN konfi_profiles kp2 ON u2.id = kp2.user_id 
           JOIN roles r2 ON u2.role_id = r2.id 
           WHERE kp2.jahrgang_id = $1 AND r2.name = 'konfi'
        )
        SELECT r.rank_in_jahrgang, tc.total_in_jahrgang
        FROM MyRank r, TotalCount tc
        WHERE r.total_points = $2
        LIMIT 1;
      `;
      const { rows: [ranking] } = await db.query(rankingQuery, [konfi.jahrgang_id, totalPoints]);

      // Mock progress overview
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
        rank_in_jahrgang: ranking ? ranking.rank_in_jahrgang : null,
        total_in_jahrgang: ranking ? ranking.total_in_jahrgang : null,
        recent_activities: [], // Could be enhanced
        progress_overview: progressOverview
      });

    } catch (err) {
      console.error('Database error in GET /profile:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // Get konfi's activity requests
  router.get('/requests', verifyTokenRBAC, async (req, res) => {
    if (req.user.type !== 'konfi') {
      return res.status(403).json({ error: 'Konfi access required' });
    }
    
    try {
      const konfiId = req.user.id;
      const query = `
        SELECT ar.*, a.name as activity_name, a.points as activity_points
        FROM activity_requests ar
        LEFT JOIN activities a ON ar.activity_id = a.id
        WHERE ar.konfi_id = $1
        ORDER BY ar.created_at DESC
      `;
      const { rows: requests } = await db.query(query, [konfiId]);
      res.json(requests);
    } catch (err) {
      console.error('Database error in GET /requests:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // Submit new activity request
  router.post('/requests', verifyTokenRBAC, async (req, res) => {
    if (req.user.type !== 'konfi') {
      return res.status(403).json({ error: 'Konfi access required' });
    }
    
    try {
      const konfiId = req.user.id;
      const { activity_id, description, photo_filename } = req.body;
      
      if (!activity_id) {
        return res.status(400).json({ error: 'Activity ID is required' });
      }
      
      const insertQuery = `
        INSERT INTO activity_requests (konfi_id, activity_id, comment, photo_filename, status)
        VALUES ($1, $2, $3, $4, 'pending')
        RETURNING id
      `;
      const { rows: [newRequest] } = await db.query(insertQuery, [konfiId, activity_id, description, photo_filename]);
      
      res.status(201).json({ 
        id: newRequest.id, 
        message: 'Activity request submitted successfully' 
      });
    } catch (err) {
      console.error('Database error in POST /requests:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // Get available activities for requests
  router.get('/activities', verifyTokenRBAC, async (req, res) => {
    if (req.user.type !== 'konfi') {
      return res.status(403).json({ error: 'Konfi access required' });
    }
    
    try {
      const query = `
        SELECT a.*, a.name, c.name as category_name
        FROM activities a
        LEFT JOIN activity_categories ac ON a.id = ac.activity_id
        LEFT JOIN categories c ON ac.category_id = c.id
        ORDER BY c.name, a.name
      `;
      const { rows: activities } = await db.query(query);
      res.json(activities);
    } catch (err) {
      console.error('Database error in GET /activities:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // Get konfi's badges
  router.get('/badges', verifyTokenRBAC, async (req, res) => {
    if (req.user.type !== 'konfi') {
      return res.status(403).json({ error: 'Konfi access required' });
    }
    
    try {
      const konfiId = req.user.id;
      const checkBadgesTableQuery = "SELECT to_regclass('public.custom_badges')";
      const { rows: [tableExistsResult] } = await db.query(checkBadgesTableQuery);

      if (!tableExistsResult || !tableExistsResult.to_regclass) {
        return res.json([]);
      }

      const query = `
        SELECT cb.*, 
               CASE WHEN kb.konfi_id IS NOT NULL THEN TRUE ELSE FALSE END as earned,
               kb.earned_at
        FROM custom_badges cb
        LEFT JOIN konfi_badges kb ON cb.id = kb.badge_id AND kb.konfi_id = $1
        ORDER BY earned DESC, cb.name
      `;
      const { rows: badges } = await db.query(query, [konfiId]);
      res.json(badges);
    } catch (err) {
      console.error('Database error in GET /badges:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // Get badge statistics for konfi
  router.get('/badges/stats', verifyTokenRBAC, async (req, res) => {
    if (req.user.type !== 'konfi') {
      return res.status(403).json({ error: 'Konfi access required' });
    }
    
    try {
      const konfiId = req.user.id;
      const checkBadgesTableQuery = "SELECT to_regclass('public.custom_badges')";
      const { rows: [tableExistsResult] } = await db.query(checkBadgesTableQuery);
      
      if (!tableExistsResult || !tableExistsResult.to_regclass) {
        return res.json({ total_badges: 0, earned_badges: 0 });
      }

      const statsQuery = `
        SELECT 
          (SELECT COUNT(*) FROM custom_badges) as total_badges,
          COUNT(kb.badge_id) as earned_badges
        FROM konfi_badges kb
        WHERE kb.konfi_id = $1
      `;
      const { rows: [stats] } = await db.query(statsQuery, [konfiId]);
      res.json({
        total_badges: parseInt(stats.total_badges, 10) || 0,
        earned_badges: parseInt(stats.earned_badges, 10) || 0
      });
    } catch (err) {
      console.error('Database error in GET /badges/stats:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // Get konfi's events
  router.get('/events', verifyTokenRBAC, async (req, res) => {
    if (req.user.type !== 'konfi') {
      return res.status(403).json({ error: 'Konfi access required' });
    }
    
    try {
      const konfiId = req.user.id;
      const query = `
        SELECT e.*, 
               CASE WHEN eb.user_id IS NOT NULL THEN TRUE ELSE FALSE END as registered,
               eb.booking_date as registered_at
        FROM events e
        LEFT JOIN event_bookings eb ON e.id = eb.event_id AND eb.user_id = $1
        WHERE e.is_active = TRUE AND e.event_date >= CURRENT_DATE
        ORDER BY e.event_date, e.start_time
      `;
      const { rows: events } = await db.query(query, [konfiId]);
      res.json(events);
    } catch (err) {
      console.error('Database error in GET /events:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // Register for event
  router.post('/events/:id/register', verifyTokenRBAC, async (req, res) => {
    if (req.user.type !== 'konfi') {
      return res.status(403).json({ error: 'Konfi access required' });
    }
    
    try {
      const konfiId = req.user.id;
      const eventId = req.params.id;
      
      // Check if already registered
      const checkQuery = 'SELECT id FROM event_bookings WHERE user_id = $1 AND event_id = $2';
      const { rows: [existing] } = await db.query(checkQuery, [konfiId, eventId]);
      
      if (existing) {
        return res.status(409).json({ error: 'Already registered for this event' });
      }
      
      // Register for event
      const insertQuery = `
        INSERT INTO event_bookings (user_id, event_id, status, booking_date) 
        VALUES ($1, $2, 'confirmed', NOW())
        RETURNING id
      `;
      const { rows: [newBooking] } = await db.query(insertQuery, [konfiId, eventId]);
      
      res.json({ 
        message: 'Successfully registered for event',
        registration_id: newBooking.id 
      });
    } catch (err) {
      console.error('Database error in POST /events/:id/register:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  return router;
};