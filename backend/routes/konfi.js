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
        // Get total badge count
        const { rows: [badgeCountResult] } = await db.query(
          'SELECT COUNT(*) as count FROM konfi_badges WHERE konfi_id = $1',
          [konfiId]
        );
        badgeCount = parseInt(badgeCountResult.count, 10) || 0;

        // Get recent badges for display
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

      // Get registered events count
      const { rows: [eventCountResult] } = await db.query(
        'SELECT COUNT(*) as count FROM event_bookings WHERE user_id = $1',
        [konfiId]
      );
      const eventCount = parseInt(eventCountResult.count, 10) || 0;

      // Get recent registered events
      const eventsQuery = `
        SELECT e.title, e.event_date, eb.booking_date
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
        SELECT a.id, a.name, a.description, a.points, a.type,
               STRING_AGG(c.name, ', ') as category_names
        FROM activities a
        LEFT JOIN activity_categories ac ON a.id = ac.activity_id
        LEFT JOIN categories c ON ac.category_id = c.id
        WHERE a.organization_id = $1
        GROUP BY a.id, a.name, a.description, a.points, a.type
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