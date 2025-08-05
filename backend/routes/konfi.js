const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'konfi-secret-2025';

// Konfi-specific routes
module.exports = (db, rbacMiddleware, upload) => {
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
      let badgeCount = 0;
      const checkBadgesTableQuery = "SELECT to_regclass('public.custom_badges')";
      const { rows: [tableExistsResult] } = await db.query(checkBadgesTableQuery);

      if (tableExistsResult && tableExistsResult.to_regclass) {
        // Get total badge count for this organization
        const { rows: [badgeCountResult] } = await db.query(
          'SELECT COUNT(*) as count FROM konfi_badges kb JOIN users u ON kb.konfi_id = u.id WHERE kb.konfi_id = $1 AND kb.organization_id = $2',
          [konfiId, req.user.organization_id]
        );
        badgeCount = parseInt(badgeCountResult.count, 10) || 0;

        // Get recent badges for display
        const badgesQuery = `
          SELECT cb.id, cb.name, cb.description, cb.icon, cb.criteria_type, cb.criteria_value,
                 kb.earned_at
          FROM custom_badges cb
          LEFT JOIN konfi_badges kb ON cb.id = kb.badge_id AND kb.konfi_id = $1 AND kb.organization_id = $2
          WHERE kb.earned_at IS NOT NULL AND cb.organization_id = $2
          ORDER BY kb.earned_at DESC
          LIMIT 3
        `;
        const { rows: badgeResults } = await db.query(badgesQuery, [konfiId, req.user.organization_id]);
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

      // Get registered events count
      const { rows: [eventCountResult] } = await db.query(
        'SELECT COUNT(*) as count FROM event_bookings WHERE user_id = $1',
        [konfiId]
      );
      const eventCount = parseInt(eventCountResult.count, 10) || 0;

      // Get recent registered events
      const eventsQuery = `
        SELECT e.name as title, e.event_date, eb.booking_date
        FROM events e
        JOIN event_bookings eb ON e.id = eb.event_id
        WHERE eb.user_id = $1
        ORDER BY eb.booking_date DESC
        LIMIT 3
      `;
      const { rows: recentEvents } = await db.query(eventsQuery, [konfiId]);

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
        badge_count: badgeCount,
        recent_events: recentEvents,
        event_count: eventCount,
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
        SELECT u.id, u.display_name, u.email, u.username, u.created_at, kp.gottesdienst_points, kp.gemeinde_points, 
               kp.jahrgang_id, kp.password_plain, kp.bible_translation, j.name as jahrgang_name
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
        SELECT ar.*, a.name as activity_name, a.points as activity_points, a.type as activity_type
        FROM activity_requests ar
        LEFT JOIN activities a ON ar.activity_id = a.id
        WHERE ar.konfi_id = $1 AND ar.organization_id = $2
        ORDER BY ar.created_at DESC
      `;
      const { rows: requests } = await db.query(query, [konfiId, req.user.organization_id]);
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
      const { activity_id, description, photo_filename, requested_date } = req.body;
      
      if (!activity_id) {
        return res.status(400).json({ error: 'Activity ID is required' });
      }
      
      const date = requested_date || new Date().toISOString().split('T')[0];
      
      // Get activity details for notification
      const { rows: [activity] } = await db.query(
        "SELECT name, points FROM activities WHERE id = $1 AND organization_id = $2",
        [activity_id, req.user.organization_id]
      );

      if (!activity) {
        return res.status(404).json({ error: 'Activity not found' });
      }

      const insertQuery = `
        INSERT INTO activity_requests (konfi_id, activity_id, requested_date, comment, photo_filename, status, organization_id)
        VALUES ($1, $2, $3, $4, $5, 'pending', $6)
        RETURNING id
      `;
      const { rows: [newRequest] } = await db.query(insertQuery, [konfiId, activity_id, date, description, photo_filename, req.user.organization_id]);
      
      // Send confirmation notification to konfi
      try {
        await db.query(
          "INSERT INTO notifications (user_id, title, message, type, data, organization_id) VALUES ($1, $2, $3, $4, $5, $6)",
          [
            konfiId,
            'Antrag eingereicht ✅',
            `Dein Antrag für "${activity.name}" wurde eingereicht und wird geprüft.`,
            'activity_request_submitted',
            JSON.stringify({ 
              request_id: newRequest.id,
              activity_name: activity.name,
              points: activity.points
            }),
            req.user.organization_id
          ]
        );
      } catch (notifErr) {
        console.error('Error sending notification:', notifErr);
        // Don't fail the request if notification fails
      }

      // Send notification to all admins about new request
      try {
        const { rows: admins } = await db.query(
          `SELECT u.id, u.display_name 
           FROM users u 
           JOIN roles r ON u.role_id = r.id 
           WHERE r.name = 'admin' AND u.organization_id = $1`,
          [req.user.organization_id]
        );

        const { rows: [konfiData] } = await db.query(
          "SELECT display_name FROM users WHERE id = $1",
          [konfiId]
        );

        for (const admin of admins) {
          await db.query(
            "INSERT INTO notifications (user_id, title, message, type, data, organization_id) VALUES ($1, $2, $3, $4, $5, $6)",
            [
              admin.id,
              'Neuer Antrag eingegangen 📝',
              `${konfiData.display_name} hat einen Antrag für "${activity.name}" (${activity.points} ${activity.points === 1 ? 'Punkt' : 'Punkte'}) eingereicht.`,
              'new_activity_request',
              JSON.stringify({
                request_id: newRequest.id,
                konfi_id: konfiId,
                konfi_name: konfiData.display_name,
                activity_name: activity.name,
                points: activity.points
              }),
              req.user.organization_id
            ]
          );
        }

        console.log(`Notified ${admins.length} admins about new request from ${konfiData.display_name}`);
      } catch (notifErr) {
        console.error('Error sending admin notifications:', notifErr);
        // Don't fail the request if notification fails
      }

      res.status(201).json({ 
        id: newRequest.id, 
        message: 'Antrag erfolgreich eingereicht' 
      });
    } catch (err) {
      console.error('Database error in POST /requests:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // Upload photo for activity request
  router.post('/upload-photo', verifyTokenRBAC, upload.single('photo'), async (req, res) => {
    if (req.user.type !== 'konfi') {
      return res.status(403).json({ error: 'Konfi access required' });
    }
    
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Kein Foto hochgeladen' });
      }
      
      res.json({ 
        filename: req.file.filename,
        message: 'Foto erfolgreich hochgeladen' 
      });
    } catch (err) {
      console.error('Error uploading photo:', err);
      res.status(500).json({ error: 'Fehler beim Hochladen des Fotos' });
    }
  });

  // Delete own activity request (only if pending)
  router.delete('/requests/:id', verifyTokenRBAC, async (req, res) => {
    if (req.user.type !== 'konfi') {
      return res.status(403).json({ error: 'Konfi access required' });
    }
    
    try {
      const requestId = req.params.id;
      const konfiId = req.user.id;
      
      // Check if request exists and belongs to this konfi and is pending
      const { rows: [request] } = await db.query(
        "SELECT * FROM activity_requests WHERE id = $1 AND konfi_id = $2 AND organization_id = $3",
        [requestId, konfiId, req.user.organization_id]
      );
      
      if (!request) {
        return res.status(404).json({ error: 'Antrag nicht gefunden' });
      }
      
      if (request.status !== 'pending') {
        return res.status(400).json({ error: 'Nur wartende Anträge können gelöscht werden' });
      }
      
      // Delete the request
      await db.query(
        "DELETE FROM activity_requests WHERE id = $1 AND konfi_id = $2 AND organization_id = $3",
        [requestId, konfiId, req.user.organization_id]
      );
      
      res.json({ message: 'Antrag erfolgreich gelöscht' });
    } catch (err) {
      console.error('Database error in DELETE /requests/:id:', err);
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
        SELECT a.id, a.name, a.points, a.type,
               STRING_AGG(c.name, ', ') as category_names
        FROM activities a
        LEFT JOIN activity_categories ac ON a.id = ac.activity_id
        LEFT JOIN categories c ON ac.category_id = c.id
        WHERE a.organization_id = $1
        GROUP BY a.id, a.name, a.points, a.type
        ORDER BY a.type, a.name
      `;
      const { rows: activities } = await db.query(query, [req.user.organization_id]);
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
        return res.json({
          available: [],
          earned: []
        });
      }

      const query = `
        SELECT cb.*, 
               CASE WHEN kb.konfi_id IS NOT NULL THEN TRUE ELSE FALSE END as earned,
               kb.earned_at
        FROM custom_badges cb
        LEFT JOIN konfi_badges kb ON cb.id = kb.badge_id AND kb.konfi_id = $1 AND kb.organization_id = $2
        WHERE cb.is_active = TRUE AND cb.organization_id = $2
        ORDER BY earned DESC, cb.name
      `;
      const { rows: badges } = await db.query(query, [konfiId, req.user.organization_id]);
      
      // Calculate progress for each badge
      for (let badge of badges) {
        if (badge.earned) {
          badge.progress = { current: badge.criteria_value, target: badge.criteria_value, percentage: 100 };
          continue;
        }

        let progress = { current: 0, target: badge.criteria_value || 1, percentage: 0 };
        
        try {
          switch (badge.criteria_type) {
            case 'total_points':
              const { rows: [totalPointsResult] } = await db.query(
                'SELECT (kp.gottesdienst_points + kp.gemeinde_points) as total FROM konfi_profiles kp WHERE user_id = $1',
                [konfiId]
              );
              progress.current = totalPointsResult?.total || 0;
              break;
              
            case 'gottesdienst_points':
              const { rows: [gottesdienstResult] } = await db.query(
                'SELECT gottesdienst_points FROM konfi_profiles WHERE user_id = $1',
                [konfiId]
              );
              progress.current = gottesdienstResult?.gottesdienst_points || 0;
              break;
              
            case 'gemeinde_points':
              const { rows: [gemeindeResult] } = await db.query(
                'SELECT gemeinde_points FROM konfi_profiles WHERE user_id = $1',
                [konfiId]
              );
              progress.current = gemeindeResult?.gemeinde_points || 0;
              break;
              
            case 'both_categories':
              // For both_categories, show progress as minimum of both categories
              const { rows: [bothCatResult] } = await db.query(
                'SELECT gottesdienst_points, gemeinde_points FROM konfi_profiles WHERE user_id = $1',
                [konfiId]
              );
              const gottesdienstPts = bothCatResult?.gottesdienst_points || 0;
              const gemeindePts = bothCatResult?.gemeinde_points || 0;
              progress.current = Math.min(gottesdienstPts, gemeindePts);
              break;
              
            case 'activity_count':
              const { rows: [activityCountResult] } = await db.query(
                'SELECT COUNT(*) as count FROM konfi_activities WHERE konfi_id = $1',
                [konfiId]
              );
              progress.current = parseInt(activityCountResult?.count || 0);
              break;
              
            case 'unique_activities':
              const { rows: [uniqueActivitiesResult] } = await db.query(
                'SELECT COUNT(DISTINCT activity_id) as count FROM konfi_activities WHERE konfi_id = $1',
                [konfiId]
              );
              progress.current = parseInt(uniqueActivitiesResult?.count || 0);
              break;

            case 'specific_activity':
              // Check if specific activity was completed (criteria_extra contains activity_id)
              let specificActivityId = null;
              try {
                const extraData = JSON.parse(badge.criteria_extra || '{}');
                specificActivityId = extraData.activity_id;
              } catch (e) {
                console.error('Error parsing criteria_extra for specific_activity badge:', e);
              }
              
              if (specificActivityId) {
                const { rows: [specificResult] } = await db.query(
                  'SELECT COUNT(*) as count FROM konfi_activities WHERE konfi_id = $1 AND activity_id = $2',
                  [konfiId, specificActivityId]
                );
                progress.current = parseInt(specificResult?.count || 0);
              } else {
                progress.current = 0;
              }
              break;

            case 'category_activities':
              // Count activities in specific category (criteria_extra contains required_category)
              let requiredCategory = null;
              try {
                const extraData = JSON.parse(badge.criteria_extra || '{}');
                requiredCategory = extraData.required_category;
              } catch (e) {
                console.error('Error parsing criteria_extra for category_activities badge:', e);
              }
              
              if (requiredCategory) {
                const { rows: [categoryResult] } = await db.query(
                  `SELECT COUNT(*) as count 
                   FROM konfi_activities ka 
                   JOIN activities a ON ka.activity_id = a.id 
                   JOIN activity_categories ac ON a.id = ac.activity_id 
                   JOIN categories c ON ac.category_id = c.id 
                   WHERE ka.konfi_id = $1 AND c.name = $2`,
                  [konfiId, requiredCategory]
                );
                progress.current = parseInt(categoryResult?.count || 0);
              } else {
                progress.current = 0;
              }
              break;

            case 'activity_combination':
              // Check if all activities in combination were completed
              let activityIds = [];
              try {
                const extraData = JSON.parse(badge.criteria_extra || '{}');
                activityIds = extraData.activity_ids || [];
              } catch (e) {
                console.error('Error parsing criteria_extra for activity_combination badge:', e);
              }
              
              if (activityIds.length > 0) {
                const placeholders = activityIds.map((_, i) => `$${i + 2}`).join(',');
                const { rows: [combinationResult] } = await db.query(
                  `SELECT COUNT(DISTINCT activity_id) as count 
                   FROM konfi_activities 
                   WHERE konfi_id = $1 AND activity_id IN (${placeholders})`,
                  [konfiId, ...activityIds]
                );
                progress.current = parseInt(combinationResult?.count || 0);
              } else {
                progress.current = 0;
              }
              break;

            case 'bonus_points':
              // Count total bonus points
              const { rows: [bonusResult] } = await db.query(
                'SELECT COALESCE(SUM(points), 0) as total FROM bonus_points WHERE konfi_id = $1',
                [konfiId]
              );
              progress.current = parseInt(bonusResult?.total || 0);
              break;
              
            case 'streak':
              // TODO: Implement streak calculation (complex)
              progress.current = 0;
              break;
              
            case 'time_based':
              // TODO: Implement time-based calculation (complex)
              progress.current = 0;
              break;
          }
          
          progress.percentage = Math.min((progress.current / progress.target) * 100, 100);
        } catch (err) {
          console.error(`Error calculating progress for badge ${badge.id}:`, err);
        }
        
        badge.progress = progress;
      }
      
      // Separate earned and available badges correctly
      const earned = badges.filter(badge => badge.earned);
      // Available = not earned AND not hidden (unless earned)
      const available = badges.filter(badge => !badge.earned && !badge.is_hidden);
      
      // Get total counts for dashboard stats
      const { rows: [totalStats] } = await db.query(`
        SELECT 
          COUNT(*) FILTER (WHERE is_hidden = false) as total_visible,
          COUNT(*) FILTER (WHERE is_hidden = true) as total_secret
        FROM custom_badges 
        WHERE is_active = TRUE AND organization_id = $1
      `, [req.user.organization_id]);
      
      res.json({
        available: available,
        earned: earned,
        stats: {
          totalVisible: parseInt(totalStats.total_visible) || 0,
          totalSecret: parseInt(totalStats.total_secret) || 0
        }
      });
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
          (SELECT COUNT(*) FROM custom_badges WHERE organization_id = $2) as total_badges,
          COUNT(kb.badge_id) as earned_badges
        FROM konfi_badges kb
        WHERE kb.konfi_id = $1 AND kb.organization_id = $2
      `;
      const { rows: [stats] } = await db.query(statsQuery, [konfiId, req.user.organization_id]);
      res.json({
        total_badges: parseInt(stats.total_badges, 10) || 0,
        earned_badges: parseInt(stats.earned_badges, 10) || 0
      });
    } catch (err) {
      console.error('Database error in GET /badges/stats:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // Get konfi's registration status for a specific event
  router.get('/events/:id/status', verifyTokenRBAC, async (req, res) => {
    if (req.user.type !== 'konfi') {
      return res.status(403).json({ error: 'Konfi access required' });
    }
    
    try {
      const konfiId = req.user.id;
      const eventId = req.params.id;
      
      // Check if konfi is registered
      const { rows: [registration] } = await db.query(
        'SELECT * FROM event_bookings WHERE user_id = $1 AND event_id = $2',
        [konfiId, eventId]
      );
      
      // Get event details with same logic as events API
      const { rows: [event] } = await db.query(`
        SELECT e.*, 
               COUNT(DISTINCT CASE WHEN eb.status = 'confirmed' THEN eb.id END) as registered_count,
               COUNT(DISTINCT CASE WHEN eb.status = 'waitlist' THEN eb.id END) as waitlist_count,
               CASE 
                 WHEN e.has_timeslots THEN COALESCE(timeslot_capacity.total_capacity, e.max_participants)
                 ELSE e.max_participants
               END as max_participants,
               CASE 
                 WHEN NOW() < e.registration_opens_at THEN 'upcoming'
                 WHEN NOW() > e.registration_closes_at THEN 'closed'
                 WHEN COUNT(DISTINCT CASE WHEN eb.status = 'confirmed' THEN eb.id END) >= 
                   CASE 
                     WHEN e.has_timeslots THEN COALESCE(timeslot_capacity.total_capacity, e.max_participants)
                     ELSE e.max_participants
                   END AND 
                      (NOT e.waitlist_enabled OR COUNT(DISTINCT CASE WHEN eb.status = 'waitlist' THEN eb.id END) >= COALESCE(e.max_waitlist_size, 0)) THEN 'closed'
                 ELSE 'open'
               END as registration_status
        FROM events e
        LEFT JOIN event_bookings eb ON e.id = eb.event_id
        LEFT JOIN (
          SELECT event_id, SUM(max_participants) as total_capacity
          FROM event_timeslots
          GROUP BY event_id
        ) timeslot_capacity ON e.id = timeslot_capacity.event_id
        WHERE e.id = $1 AND e.organization_id = $2 AND (e.cancelled = FALSE OR e.cancelled IS NULL)
        GROUP BY e.id, timeslot_capacity.total_capacity
      `, [eventId, req.user.organization_id]);
      
      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }
      
      const confirmedCount = parseInt(event.registered_count) || 0;
      const waitlistCount = parseInt(event.waitlist_count) || 0;
      const can_register = !registration && event.registration_status === 'open';
      
      // Get waitlist position if user is on waitlist
      let waitlist_position = null;
      if (registration && registration.status === 'waitlist') {
        const positionQuery = `
          SELECT COUNT(*) + 1 as position
          FROM event_bookings
          WHERE event_id = $1 AND status = 'waitlist' AND booking_date < $2
        `;
        const { rows: [posResult] } = await db.query(positionQuery, [eventId, registration.booking_date]);
        waitlist_position = parseInt(posResult.position) || 1;
      }
      
      res.json({
        is_registered: !!registration,
        registration_status: registration?.status || null,
        can_register: can_register,
        registration_date: registration?.booking_date,
        event_status: event.registration_status,
        confirmed_count: confirmedCount,
        waitlist_count: waitlistCount,
        waitlist_position: waitlist_position,
        max_participants: event.max_participants,
        max_waitlist_size: event.max_waitlist_size,
        waitlist_enabled: event.waitlist_enabled
      });
    } catch (err) {
      console.error('Database error in GET /events/:id/status:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // Get daily verse (Tageslosung) with caching
  router.get('/tageslosung', verifyTokenRBAC, async (req, res) => {
    if (req.user.type !== 'konfi') {
      return res.status(403).json({ error: 'Konfi access required' });
    }
    
    try {
      const konfiId = req.user.id;
      
      // Get konfi's preferred translation
      const { rows: [konfi] } = await db.query(
        'SELECT kp.bible_translation FROM users u JOIN konfi_profiles kp ON u.id = kp.user_id WHERE u.id = $1',
        [konfiId]
      );
      
      const translation = konfi?.bible_translation || 'LUT'; // Default: Lutherbibel
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
      
      // Check if we have cached verse for today and this translation
      const { rows: [cachedVerse] } = await db.query(
        'SELECT verse_data FROM daily_verses WHERE date = $1 AND translation = $2',
        [today, translation]
      );
      
      if (cachedVerse) {
        console.log(`Using cached verse for ${today} (${translation})`);
        return res.json({
          success: true,
          data: cachedVerse.verse_data,
          translation: translation,
          cached: true
        });
      }
      
      // Not cached - fetch from external API
      console.log(`Fetching new verse from API for ${today} (${translation})`);
      const fetch = (await import('node-fetch')).default;
      const apiUrl = `https://losung.konfi-quest.de/?translation=${translation}`;
      
      const response = await fetch(apiUrl, {
        headers: {
          'X-API-Key': 'ksadh8324oijcff45rfdsvcvhoids44',
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
      
      // Cache the verse for today
      try {
        await db.query(
          'INSERT INTO daily_verses (date, translation, verse_data) VALUES ($1, $2, $3) ON CONFLICT (date, translation) DO NOTHING',
          [today, translation, losungData.data]
        );
        console.log(`Cached verse for ${today} (${translation})`);
      } catch (cacheErr) {
        console.error('Error caching verse:', cacheErr);
        // Don't fail the request if caching fails
      }
      
      // Clean up old verses (older than 7 days)
      try {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const cleanupDate = sevenDaysAgo.toISOString().split('T')[0];
        
        const { rowCount } = await db.query(
          'DELETE FROM daily_verses WHERE date < $1',
          [cleanupDate]
        );
        
        if (rowCount > 0) {
          console.log(`Cleaned up ${rowCount} old cached verses`);
        }
      } catch (cleanupErr) {
        console.error('Error cleaning up old verses:', cleanupErr);
        // Don't fail the request if cleanup fails
      }
      
      res.json({
        success: true,
        data: losungData.data,
        translation: translation,
        cached: false
      });
      
    } catch (err) {
      console.error('Error fetching Tageslosung:', err);
      
      // Try to get a cached verse from previous days as fallback
      try {
        const { rows: [fallbackCached] } = await db.query(
          'SELECT verse_data FROM daily_verses WHERE translation = $1 ORDER BY date DESC LIMIT 1',
          [konfi?.bible_translation || 'LUT']
        );
        
        if (fallbackCached) {
          console.log('Using fallback cached verse from previous days');
          return res.json({
            success: true,
            data: fallbackCached.verse_data,
            translation: konfi?.bible_translation || 'LUT',
            fallback: true,
            error: 'Aktuelle Tageslosung nicht verfügbar - verwende letzte verfügbare Losung'
          });
        }
      } catch (fallbackErr) {
        console.error('Error getting fallback cached verse:', fallbackErr);
      }
      
      // Final fallback data if all else fails
      const fallbackVerses = [
        {
          date: new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
          losung: {
            text: "Der HERR ist mein Hirte, mir wird nichts mangeln.",
            reference: "Psalm 23,1",
            testament: "AT"
          },
          lehrtext: {
            text: "Jesus spricht: Ich bin der gute Hirte. Der gute Hirte lässt sein Leben für die Schafe.",
            reference: "Johannes 10,11", 
            testament: "NT"
          },
          translation: {
            code: "LUT",
            name: "Lutherbibel 2017",
            language: "German"
          },
          source: "Fallback"
        }
      ];
      
      const randomVerse = fallbackVerses[Math.floor(Math.random() * fallbackVerses.length)];
      
      res.json({
        success: true,
        data: randomVerse,
        fallback: true,
        error: 'Losungen API nicht erreichbar - Fallback verwendet'
      });
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
      
      // Get event details and current registration count
      const eventQuery = `
        SELECT e.*, 
               COUNT(eb.id) FILTER (WHERE eb.status = 'confirmed') as confirmed_count,
               COUNT(eb.id) FILTER (WHERE eb.status = 'waitlist') as waitlist_count
        FROM events e
        LEFT JOIN event_bookings eb ON e.id = eb.event_id
        WHERE e.id = $1 AND e.organization_id = $2
        GROUP BY e.id
      `;
      const { rows: [event] } = await db.query(eventQuery, [eventId, req.user.organization_id]);
      
      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }
      
      const confirmedCount = parseInt(event.confirmed_count) || 0;
      const waitlistCount = parseInt(event.waitlist_count) || 0;
      
      // Determine registration status
      let status;
      if (confirmedCount < event.max_participants) {
        status = 'confirmed';
      } else if (event.waitlist_enabled && waitlistCount < (event.max_waitlist_size || 10)) {
        status = 'waitlist';
      } else {
        return res.status(400).json({ 
          error: 'Event ist voll und Warteliste ist auch voll' 
        });
      }
      
      // Register for event
      const insertQuery = `
        INSERT INTO event_bookings (user_id, event_id, status, booking_date) 
        VALUES ($1, $2, $3, NOW())
        RETURNING id
      `;
      const { rows: [newBooking] } = await db.query(insertQuery, [konfiId, eventId, status]);
      
      const message = status === 'confirmed' 
        ? 'Successfully registered for event'
        : `Auf Warteliste gesetzt (Platz ${waitlistCount + 1})`;
      
      res.json({ 
        message,
        registration_id: newBooking.id,
        status 
      });
    } catch (err) {
      console.error('Database error in POST /events/:id/register:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // Unregister from event
  router.delete('/events/:id/register', verifyTokenRBAC, async (req, res) => {
    if (req.user.type !== 'konfi') {
      return res.status(403).json({ error: 'Konfi access required' });
    }
    
    try {
      const konfiId = req.user.id;
      const eventId = req.params.id;
      const { reason } = req.body;
      
      // Check if konfi is registered
      const { rows: [registration] } = await db.query(
        'SELECT * FROM event_bookings WHERE user_id = $1 AND event_id = $2',
        [konfiId, eventId]
      );
      
      if (!registration) {
        return res.status(400).json({ error: 'Du bist nicht für dieses Event angemeldet' });
      }
      
      // Check if event exists and get event date
      const { rows: [event] } = await db.query(
        'SELECT event_date FROM events WHERE id = $1 AND organization_id = $2',
        [eventId, req.user.organization_id]
      );
      
      if (!event) {
        return res.status(404).json({ error: 'Event nicht gefunden' });
      }
      
      // Check if unregistration is still allowed (2 days before event)
      const eventDate = new Date(event.event_date);
      const now = new Date();
      const twoDaysBeforeEvent = new Date(eventDate.getTime() - (2 * 24 * 60 * 60 * 1000));
      
      if (now >= twoDaysBeforeEvent) {
        return res.status(400).json({ 
          error: 'Abmeldung ist nur bis 2 Tage vor dem Event möglich' 
        });
      }
      
      // Delete registration (with reason for audit trail)
      await db.query(
        'DELETE FROM event_bookings WHERE user_id = $1 AND event_id = $2',
        [konfiId, eventId]
      );
      
      // Optional: Log unregistration with reason for admin visibility
      if (reason) {
        await db.query(
          'INSERT INTO event_unregistrations (user_id, event_id, reason, unregistered_at, organization_id) VALUES ($1, $2, $3, NOW(), $4)',
          [konfiId, eventId, reason, req.user.organization_id]
        );
      }
      
      res.json({ message: 'Successfully unregistered from event' });
    } catch (err) {
      console.error('Database error in DELETE /events/:id/register:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // Update bible translation preference
  router.put('/bible-translation', verifyTokenRBAC, async (req, res) => {
    if (req.user.type !== 'konfi') {
      return res.status(403).json({ error: 'Konfi access required' });
    }
    
    try {
      const konfiId = req.user.id;
      const { translation } = req.body;
      
      // Validate translation
      const validTranslations = ['LUT', 'ELB', 'GNB', 'BIGS', 'NIV', 'LSG', 'RVR60'];
      if (!validTranslations.includes(translation)) {
        return res.status(400).json({ 
          error: 'Invalid translation',
          valid_translations: validTranslations
        });
      }
      
      // Update konfi profile with new translation preference
      await db.query(
        'UPDATE konfi_profiles SET bible_translation = $1 WHERE user_id = $2',
        [translation, konfiId]
      );
      
      res.json({
        success: true,
        message: 'Bibelübersetzung erfolgreich aktualisiert',
        translation: translation
      });
      
    } catch (err) {
      console.error('Database error in PUT /bible-translation:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  return router;
};