const express = require('express');
const router = express.Router();
const PushService = require('../services/pushService');
const liveUpdate = require('../utils/liveUpdate');

// Events routes
// Events: Teamer darf alles (view, create, edit, delete, manage_bookings)
module.exports = (db, rbacVerifier, { requireTeamer }, checkAndAwardBadges) => {
  
  // Get all events (read-only, accessible to all authenticated users)
  router.get('/', rbacVerifier, async (req, res) => {
    try {
      const query = `
        SELECT e.*,
                COUNT(DISTINCT CASE WHEN eb.status = 'confirmed' THEN eb.id END) as registered_count,
                COUNT(DISTINCT CASE WHEN eb.status = 'pending' THEN eb.id END) as waitlist_count,
                COUNT(DISTINCT CASE WHEN eb.status = 'confirmed' AND eb.attendance_status IS NULL THEN eb.id END) as unprocessed_count,
                COUNT(DISTINCT eb.id) as total_participants,
                CASE 
                  WHEN e.has_timeslots THEN COALESCE(timeslot_capacity.total_capacity, e.max_participants)
                  ELSE e.max_participants
                END as max_participants,
                e.registration_opens_at,
                e.registration_closes_at,
                e.point_type,
                STRING_AGG(DISTINCT c.id::text, ',') as category_ids,
                STRING_AGG(DISTINCT c.name, ',') as category_names,
                STRING_AGG(DISTINCT j.id::text, ',') as jahrgang_ids,
                STRING_AGG(DISTINCT j.name, ',') as jahrgang_names,
                CASE
                  WHEN NOW() < e.registration_opens_at THEN 'upcoming'
                  WHEN NOW() > e.registration_closes_at THEN 'closed'
                  WHEN (
                    CASE WHEN e.has_timeslots THEN COALESCE(timeslot_capacity.total_capacity, e.max_participants) ELSE e.max_participants END
                  ) > 0 AND COUNT(DISTINCT CASE WHEN eb.status = 'confirmed' THEN eb.id END) >= (
                    CASE WHEN e.has_timeslots THEN COALESCE(timeslot_capacity.total_capacity, e.max_participants) ELSE e.max_participants END
                  ) AND (NOT e.waitlist_enabled OR COUNT(DISTINCT CASE WHEN eb.status = 'pending' THEN eb.id END) >= COALESCE(e.max_waitlist_size, 0)) THEN 'closed'
                  ELSE 'open'
                END as registration_status
        FROM events e
        LEFT JOIN event_bookings eb ON e.id = eb.event_id
        LEFT JOIN event_categories ec ON e.id = ec.event_id
        LEFT JOIN categories c ON ec.category_id = c.id
        LEFT JOIN event_jahrgang_assignments eja ON e.id = eja.event_id
        LEFT JOIN jahrgaenge j ON eja.jahrgang_id = j.id
        LEFT JOIN (
          SELECT event_id, SUM(max_participants) as total_capacity
          FROM event_timeslots
          GROUP BY event_id
        ) timeslot_capacity ON e.id = timeslot_capacity.event_id
        WHERE e.organization_id = $1
        GROUP BY e.id, timeslot_capacity.total_capacity
        ORDER BY e.event_date ASC
      `;
      
      console.log("Fetching events for org:", req.user.organization_id);
      const { rows } = await db.query(query, [req.user.organization_id]);
      
      // Debug: Log registration status calculations
      rows.forEach(event => {
        console.log(`Event ${event.name}: registered=${event.registered_count}/${event.max_participants}, waitlist=${event.waitlist_count}, unprocessed=${event.unprocessed_count}, status=${event.registration_status}`);
      });
      
      // Transform the data to include categories and jahrgaenge arrays
      const eventsWithRelations = rows.map(row => {
        const categories = [];
        if (row.category_ids) {
          const ids = row.category_ids.split(',');
          const names = row.category_names.split(',');
          for (let i = 0; i < ids.length; i++) {
            categories.push({
              id: parseInt(ids[i], 10),
              name: names[i]
            });
          }
        }
        
        const jahrgaenge = [];
        if (row.jahrgang_ids) {
          const ids = row.jahrgang_ids.split(',');
          const names = row.jahrgang_names.split(',');
          for (let i = 0; i < ids.length; i++) {
            jahrgaenge.push({
              id: parseInt(ids[i], 10),
              name: names[i]
            });
          }
        }
        
        const unprocessedCount = parseInt(row.unprocessed_count, 10) || 0;
        return {
          ...row,
          categories: categories,
          jahrgaenge: jahrgaenge,
          waitlist_count: parseInt(row.waitlist_count, 10) || 0,
          pending_bookings_count: unprocessedCount > 0 ? unprocessedCount : undefined
        };
      });
      
      res.json(eventsWithRelations);
      
    } catch (err) {
      console.error('Database error in GET /events:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // Get cancelled events (Admin only)
  router.get('/cancelled', rbacVerifier, requireTeamer, async (req, res) => {
    try {
      const query = `
        SELECT e.*, 
                COUNT(DISTINCT CASE WHEN eb.status = 'confirmed' THEN eb.id END) as registered_count,
                COUNT(DISTINCT CASE WHEN eb.status = 'pending' THEN eb.id END) as waitlist_count,
                COUNT(DISTINCT CASE WHEN eb.status = 'confirmed' AND eb.attendance_status IS NULL THEN eb.id END) as unprocessed_count,
                STRING_AGG(DISTINCT c.id::text, ',') as category_ids,
                STRING_AGG(DISTINCT c.name, ',') as category_names,
                STRING_AGG(DISTINCT j.id::text, ',') as jahrgang_ids,
                STRING_AGG(DISTINCT j.name, ',') as jahrgang_names
        FROM events e
        LEFT JOIN event_bookings eb ON e.id = eb.event_id
        LEFT JOIN event_categories ec ON e.id = ec.event_id
        LEFT JOIN categories c ON ec.category_id = c.id
        LEFT JOIN event_jahrgang_assignments eja ON e.id = eja.event_id
        LEFT JOIN jahrgaenge j ON eja.jahrgang_id = j.id
        WHERE e.organization_id = $1 AND e.cancelled = TRUE
        GROUP BY e.id
        ORDER BY e.cancelled_at DESC
      `;
      
      const { rows } = await db.query(query, [req.user.organization_id]);
      
      // Transform the data to include categories and jahrgaenge arrays
      const eventsWithRelations = rows.map(row => {
        const categories = [];
        if (row.category_ids) {
          const ids = row.category_ids.split(',');
          const names = row.category_names.split(',');
          for (let i = 0; i < ids.length; i++) {
            categories.push({
              id: parseInt(ids[i], 10),
              name: names[i]
            });
          }
        }
        
        const jahrgaenge = [];
        if (row.jahrgang_ids) {
          const ids = row.jahrgang_ids.split(',');
          const names = row.jahrgang_names.split(',');
          for (let i = 0; i < ids.length; i++) {
            jahrgaenge.push({
              id: parseInt(ids[i], 10),
              name: names[i]
            });
          }
        }
        
        const unprocessedCount = parseInt(row.unprocessed_count, 10) || 0;
        return {
          ...row,
          categories: categories,
          jahrgaenge: jahrgaenge,
          registration_status: 'cancelled',
          waitlist_count: parseInt(row.waitlist_count, 10) || 0,
          pending_bookings_count: unprocessedCount > 0 ? unprocessedCount : undefined
        };
      });
      
      res.json(eventsWithRelations);
      
    } catch (err) {
      console.error('Database error in GET /events/cancelled:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });
  
  // Get timeslots for an event
  router.get('/:id/timeslots', rbacVerifier, async (req, res) => {
    const eventId = req.params.id;
    try {
      console.log("Fetching timeslots for event:", eventId, "org:", req.user.organization_id);

      // Verify event exists and belongs to organization
      const { rows: [event] } = await db.query("SELECT id, has_timeslots FROM events WHERE id = $1 AND organization_id = $2", [eventId, req.user.organization_id]);

      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }

      if (!event.has_timeslots) {
        return res.json([]); // Return empty array if event doesn't use timeslots
      }

      const timeslotsQuery = `
        SELECT et.*, COUNT(eb.id) as registered_count
        FROM event_timeslots et
        LEFT JOIN event_bookings eb ON et.id = eb.timeslot_id AND eb.status = 'confirmed'
        WHERE et.event_id = $1 AND et.organization_id = $2
        GROUP BY et.id
        ORDER BY et.start_time ASC
      `;
      const { rows: timeslots } = await db.query(timeslotsQuery, [eventId, req.user.organization_id]);

      res.json(timeslots);

    } catch (err) {
      console.error(`Database error in GET /events/${req.params.id}/timeslots:`, err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // Get event details with participants
  router.get('/:id', rbacVerifier, async (req, res) => {
    const eventId = req.params.id;
    try {
      // Get event details
      console.log("Fetching event details for event:", eventId, "org:", req.user.organization_id);
      const { rows: [event] } = await db.query("SELECT * FROM events WHERE id = $1 AND organization_id = $2", [eventId, req.user.organization_id]);
      
      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }
      
      // Get participants
      const participantsQuery = `
        SELECT eb.*, u.display_name as participant_name, kp.jahrgang_id,
                j.name as jahrgang_name, et.start_time as timeslot_start_time,
                et.end_time as timeslot_end_time
        FROM event_bookings eb
        JOIN users u ON eb.user_id = u.id
        LEFT JOIN konfi_profiles kp ON u.id = kp.user_id
        LEFT JOIN jahrgaenge j ON kp.jahrgang_id = j.id
        LEFT JOIN event_timeslots et ON eb.timeslot_id = et.id
        WHERE eb.event_id = $1 AND u.organization_id = $2
        ORDER BY 
          CASE eb.status 
            WHEN 'confirmed' THEN 1 
            WHEN 'pending' THEN 2 
            ELSE 3 
          END, 
          eb.created_at ASC
      `;
      const { rows: participants } = await db.query(participantsQuery, [eventId, req.user.organization_id]);
      
      // Get series events if this is part of a series
      let seriesEvents = [];
      if (event.is_series && event.series_id) {
        const seriesQuery = `
          SELECT e.*, COUNT(eb.id) as registered_count
          FROM events e
          LEFT JOIN event_bookings eb ON e.id = eb.event_id AND eb.status = 'confirmed'
          WHERE e.series_id = $1 AND e.organization_id = $2 AND e.id != $3
          GROUP BY e.id
          ORDER BY e.event_date ASC
        `;
        const { rows } = await db.query(seriesQuery, [event.series_id, req.user.organization_id, eventId]);
        seriesEvents = rows;
      }
      
      // Get timeslots if event has them
      let timeslots = [];
      if (event.has_timeslots) {
        const timeslotsQuery = `
          SELECT et.*, COUNT(eb.id) as registered_count
          FROM event_timeslots et
          LEFT JOIN event_bookings eb ON et.id = eb.timeslot_id AND eb.status = 'confirmed'
          WHERE et.event_id = $1 AND et.organization_id = $2
          GROUP BY et.id
          ORDER BY et.start_time ASC
        `;
        const { rows } = await db.query(timeslotsQuery, [eventId, req.user.organization_id]);
        timeslots = rows;
      }
      
      // Get jahrgaenge for this event
      const jahrgaengeQuery = `
        SELECT j.id, j.name
        FROM jahrgaenge j
        JOIN event_jahrgang_assignments eja ON j.id = eja.jahrgang_id
        WHERE eja.event_id = $1
      `;
      const { rows: jahrgaenge } = await db.query(jahrgaengeQuery, [eventId]);
      
      // Get categories for this event
      const categoriesQuery = `
        SELECT c.id, c.name
        FROM categories c
        JOIN event_categories ec ON c.id = ec.category_id
        WHERE ec.event_id = $1
      `;
      const { rows: categories } = await db.query(categoriesQuery, [eventId]);

      // Get unregistrations (Abmeldungen) for this event
      const unregistrationsQuery = `
        SELECT eu.*, u.display_name as konfi_name
        FROM event_unregistrations eu
        JOIN users u ON eu.user_id = u.id
        WHERE eu.event_id = $1 AND eu.organization_id = $2
        ORDER BY eu.unregistered_at DESC
      `;
      const { rows: unregistrations } = await db.query(unregistrationsQuery, [eventId, req.user.organization_id]);

      // Calculate correct registered_count for timeslot events
      const registeredCount = participants.filter(p => p.status === 'confirmed').length;
      const pendingCount = participants.filter(p => p.status === 'pending').length;
      
      // For timeslot events, calculate total capacity and availability
      let totalCapacity = event.max_participants;
      if (event.has_timeslots && timeslots && timeslots.length > 0) {
        totalCapacity = timeslots.reduce((sum, slot) => sum + slot.max_participants, 0);
      }
      
      res.json({
        ...event,
        participants,
        timeslots,
        series_events: seriesEvents,
        jahrgaenge,
        categories,
        unregistrations,
        registered_count: registeredCount,
        pending_count: pendingCount,
        max_participants: totalCapacity,
        available_spots: totalCapacity - registeredCount
      });
      
    } catch (err) {
      console.error(`Database error in GET /events/${req.params.id}:`, err);
      res.status(500).json({ error: 'Database error' });
    }
  });
  
  // Create new event
  router.post('/', rbacVerifier, requireTeamer, async (req, res) => {
    const {
      name, description, event_date, event_end_time, location, location_maps_url,
      points, point_type, category_ids, jahrgang_ids, type, max_participants,
      registration_opens_at, registration_closes_at, has_timeslots,
      waitlist_enabled, max_waitlist_size, timeslots, is_series, series_id
    } = req.body;
    
    if (!name || !event_date || !max_participants) {
      return res.status(400).json({ error: 'Name, event_date, and max_participants are required' });
    }
    
    // NOTE: For transactions with pg-pool, a client must be checked out.
    // As per the instructions, we use db.query for everything. This is safe
    // as long as the logic is encapsulated inside a single route handler.
    try {
      console.log("Creating event for org:", req.user.organization_id);
      
      const insertEventQuery = `
        INSERT INTO events (
          name, description, event_date, event_end_time, location, location_maps_url, 
          points, point_type, type, max_participants, registration_opens_at, 
          registration_closes_at, has_timeslots, waitlist_enabled, max_waitlist_size, 
          is_series, series_id, created_by, organization_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
        RETURNING id
      `;
      const { rows: [newEvent] } = await db.query(insertEventQuery, [
        name, description, event_date, event_end_time, location, location_maps_url,
        points || 0, point_type || 'gemeinde', type || 'event', max_participants,
        registration_opens_at, registration_closes_at, has_timeslots || false,
        waitlist_enabled !== undefined ? waitlist_enabled : true, max_waitlist_size || 10,
        is_series || false, series_id, req.user.id, req.user.organization_id
      ]);
      
      const eventId = newEvent.id;
      const promises = [];
      
      // Add categories
      if (category_ids && Array.isArray(category_ids) && category_ids.length > 0) {
        const categoryQuery = "INSERT INTO event_categories (event_id, category_id) SELECT $1, unnest($2::int[]) ON CONFLICT DO NOTHING";
        promises.push(db.query(categoryQuery, [eventId, category_ids]));
      }
      
      // Add jahrgaenge
      if (jahrgang_ids && Array.isArray(jahrgang_ids) && jahrgang_ids.length > 0) {
        const jahrgangQuery = "INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) SELECT $1, unnest($2::int[]) ON CONFLICT DO NOTHING";
        promises.push(db.query(jahrgangQuery, [eventId, jahrgang_ids]));
      }
      
      // If has timeslots, create them
      if (has_timeslots && timeslots && timeslots.length > 0) {
        const timeslotQuery = "INSERT INTO event_timeslots (event_id, start_time, end_time, max_participants, organization_id) VALUES ($1, $2, $3, $4, $5)";
        timeslots.forEach(slot => {
          promises.push(db.query(timeslotQuery, [eventId, slot.start_time, slot.end_time, slot.max_participants, req.user.organization_id]));
        });
      }
      
      await Promise.all(promises);

      res.status(201).json({ id: eventId, message: 'Event created successfully' });

      // Live Update: Notify all konfis and admins about the new event
      liveUpdate.sendToOrg(req.user.organization_id, 'events', 'create', { eventId });

      // Push Notification: Notify all konfis about the new event
      try {
        await PushService.sendNewEventToOrgKonfis(db, req.user.organization_id, name, event_date);
      } catch (pushErr) {
        console.error('Push notification failed for new event:', pushErr);
      }

    } catch (err) {
      console.error('Database error in POST /events:', err);
      // '23505' is the PostgreSQL code for unique_violation
      if (err.code === '23505') {
        return res.status(409).json({ error: 'A similar event might already exist.' });
      }
      res.status(500).json({ error: 'Database error' });
    }
  });
  
  // Update event
  router.put('/:id', rbacVerifier, requireTeamer, async (req, res) => {
    const { id } = req.params;
    const {
      name, description, event_date, event_end_time, location, location_maps_url,
      points, point_type, category_ids, jahrgang_ids, type, max_participants,
      registration_opens_at, registration_closes_at, has_timeslots,
      waitlist_enabled, max_waitlist_size, timeslots
    } = req.body;
    
    // For robust transactions, a dedicated client from the pool is best practice.
    // Adhering to the prompt, we use `db.query` for BEGIN/COMMIT/ROLLBACK.
    await db.query('BEGIN');
    try {
      console.log("Updating event:", id, "for org:", req.user.organization_id);
      
      const updateQuery = `
        UPDATE events SET 
          name = $1, description = $2, event_date = $3, event_end_time = $4, location = $5, 
          location_maps_url = $6, points = $7, point_type = $8, type = $9, 
          max_participants = $10, registration_opens_at = $11, registration_closes_at = $12,
          has_timeslots = $13, waitlist_enabled = $14, max_waitlist_size = $15
        WHERE id = $16 AND organization_id = $17
      `;
      const { rowCount } = await db.query(updateQuery, [
        name, description, event_date, event_end_time, location, location_maps_url,
        points, point_type, type, max_participants, registration_opens_at,
        registration_closes_at, has_timeslots || false, 
        waitlist_enabled !== undefined ? waitlist_enabled : true, max_waitlist_size || 10,
        id, req.user.organization_id
      ]);
      
      if (rowCount === 0) {
        await db.query('ROLLBACK');
        return res.status(404).json({ error: 'Event not found or you do not have permission to edit it' });
      }
      
      // Clear and re-add categories and jahrgaenge
      await db.query("DELETE FROM event_categories WHERE event_id = $1", [id]);
      await db.query("DELETE FROM event_jahrgang_assignments WHERE event_id = $1", [id]);

      // Add categories and jahrgaenge back sequentially
      if (category_ids && Array.isArray(category_ids) && category_ids.length > 0) {
        const categoryQuery = "INSERT INTO event_categories (event_id, category_id) SELECT $1, unnest($2::int[]) ON CONFLICT DO NOTHING";
        await db.query(categoryQuery, [id, category_ids]);
      }
      if (jahrgang_ids && Array.isArray(jahrgang_ids) && jahrgang_ids.length > 0) {
        const jahrgangQuery = "INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) SELECT $1, unnest($2::int[]) ON CONFLICT DO NOTHING";
        await db.query(jahrgangQuery, [id, jahrgang_ids]);
      }

      // Handle timeslots - intelligent update to preserve booking references
      if (has_timeslots && timeslots && Array.isArray(timeslots) && timeslots.length > 0) {
        // Get existing timeslot IDs
        const { rows: existingSlots } = await db.query(
          "SELECT id FROM event_timeslots WHERE event_id = $1", [id]
        );
        const existingIds = new Set(existingSlots.map(s => s.id));

        // Track which IDs are in the new timeslots
        const newIds = new Set(timeslots.filter(ts => ts.id).map(ts => ts.id));

        // Delete timeslots that are no longer in the list (and have no bookings)
        for (const existingId of existingIds) {
          if (!newIds.has(existingId)) {
            // Check if this timeslot has bookings
            const { rows: [bookingCheck] } = await db.query(
              "SELECT COUNT(*)::int as count FROM event_bookings WHERE timeslot_id = $1", [existingId]
            );
            if (bookingCheck.count === 0) {
              await db.query("DELETE FROM event_timeslots WHERE id = $1", [existingId]);
            }
            // If has bookings, keep the timeslot but it won't show in the UI
          }
        }

        // Update existing or insert new timeslots
        for (const slot of timeslots) {
          if (slot.id && existingIds.has(slot.id)) {
            // Update existing timeslot
            await db.query(
              "UPDATE event_timeslots SET start_time = $1, end_time = $2, max_participants = $3 WHERE id = $4",
              [slot.start_time, slot.end_time, slot.max_participants, slot.id]
            );
          } else {
            // Insert new timeslot
            await db.query(
              "INSERT INTO event_timeslots (event_id, start_time, end_time, max_participants, organization_id) VALUES ($1, $2, $3, $4, $5)",
              [id, slot.start_time, slot.end_time, slot.max_participants, req.user.organization_id]
            );
          }
        }
      } else if (!has_timeslots) {
        // Only delete timeslots if event no longer has timeslots AND no bookings reference them
        const { rows: [bookingCheck] } = await db.query(
          "SELECT COUNT(*)::int as count FROM event_bookings eb JOIN event_timeslots et ON eb.timeslot_id = et.id WHERE et.event_id = $1", [id]
        );
        if (bookingCheck.count === 0) {
          await db.query("DELETE FROM event_timeslots WHERE event_id = $1", [id]);
        }
      }

      await db.query('COMMIT');
      res.json({ message: 'Event updated successfully' });

      // Live Update: Notify all konfis and admins about the event update
      liveUpdate.sendToOrg(req.user.organization_id, 'events', 'update', { eventId: id });

    } catch (err) {
      await db.query('ROLLBACK');
      console.error(`Database error in PUT /events/${id}:`, err);
      res.status(500).json({ error: 'Database error' });
    }
  });
  
  // Delete event
  router.delete('/:id', rbacVerifier, requireTeamer, async (req, res) => {
    const { id } = req.params;
    
    await db.query('BEGIN');
    try {
      console.log("Deleting event:", id, "for org:", req.user.organization_id);
      
      // First, verify the event belongs to the organization
      const { rows: [event] } = await db.query("SELECT id, name FROM events WHERE id = $1 AND organization_id = $2", [id, req.user.organization_id]);
      if (!event) {
        await db.query('ROLLBACK');
        return res.status(404).json({ error: 'Event nicht gefunden' });
      }
      
      // Check if there are bookings (confirmed participants)
      const { rows: [bookingUsage] } = await db.query("SELECT COUNT(*)::int as count FROM event_bookings WHERE event_id = $1 AND status = 'confirmed'", [id]);
      
      if (bookingUsage.count > 0) {
        await db.query('ROLLBACK');
        return res.status(409).json({ error: `Event kann nicht gelöscht werden: ${bookingUsage.count} bestätigte Anmeldung(en) vorhanden.` });
      }
      
      // Check for pending bookings (waitlist)
      const { rows: [pendingUsage] } = await db.query("SELECT COUNT(*)::int as count FROM event_bookings WHERE event_id = $1 AND status = 'pending'", [id]);
      
      if (pendingUsage.count > 0) {
        await db.query('ROLLBACK');
        return res.status(409).json({ error: `Event kann nicht gelöscht werden: ${pendingUsage.count} Wartelisten-Anmeldung(en) vorhanden.` });
      }
      
      // Check for chat rooms with messages
      const { rows: [chatUsage] } = await db.query(`
        SELECT cr.id, (SELECT COUNT(*) FROM chat_messages WHERE room_id = cr.id)::int as message_count
        FROM chat_rooms cr 
        WHERE cr.event_id = $1
      `, [id]);
      
      if (chatUsage && chatUsage.message_count > 0) {
        await db.query('ROLLBACK');
        return res.status(409).json({ error: `Event kann nicht gelöscht werden: Event-Chat enthält ${chatUsage.message_count} Nachricht(en).` });
      }
      
      // Get event chat rooms and their files before deletion
      const { rows: eventChatRooms } = await db.query("SELECT id FROM chat_rooms WHERE event_id = $1", [id]);
      const allFiles = [];
      
      for (const room of eventChatRooms) {
        const { rows: roomFiles } = await db.query("SELECT file_path FROM chat_messages WHERE room_id = $1 AND file_path IS NOT NULL", [room.id]);
        allFiles.push(...roomFiles);
      }
      
      // Proceed with deletions. Order matters due to foreign keys.
      // 1. Delete chat data first
      for (const room of eventChatRooms) {
        // Delete poll votes first (polls are linked via message_id, not room_id)
        await db.query(`
          DELETE FROM chat_poll_votes WHERE poll_id IN (
            SELECT cp.id FROM chat_polls cp 
            JOIN chat_messages cm ON cp.message_id = cm.id 
            WHERE cm.room_id = $1
          )
        `, [room.id]);
        
        // Delete polls (via message_id)
        await db.query(`
          DELETE FROM chat_polls WHERE message_id IN (
            SELECT id FROM chat_messages WHERE room_id = $1
          )
        `, [room.id]);
        await db.query("DELETE FROM chat_read_status WHERE room_id = $1", [room.id]);
        await db.query("DELETE FROM chat_messages WHERE room_id = $1", [room.id]);
        await db.query("DELETE FROM chat_participants WHERE room_id = $1", [room.id]);
      }
      await db.query("DELETE FROM chat_rooms WHERE event_id = $1", [id]);
      
      // 2. Delete event-specific data
      await db.query("DELETE FROM event_bookings WHERE event_id = $1", [id]);
      await db.query("DELETE FROM event_timeslots WHERE event_id = $1", [id]);
      await db.query("DELETE FROM event_categories WHERE event_id = $1", [id]);
      await db.query("DELETE FROM event_jahrgang_assignments WHERE event_id = $1", [id]);
      
      // 3. Clean up files from filesystem (best effort)
      const fs = require('fs').promises;
      const path = require('path');
      
      for (const fileRecord of allFiles) {
        try {
          const fullPath = path.join(__dirname, '..', 'uploads', 'chat', fileRecord.file_path);
          await fs.unlink(fullPath);
          console.log(`Deleted event chat file: ${fullPath}`);
        } catch (fileErr) {
          console.warn(`Could not delete file ${fileRecord.file_path}:`, fileErr.message);
        }
      }
      
      // Finally, delete the event itself
      const { rowCount } = await db.query("DELETE FROM events WHERE id = $1", [id]);
      
      if (rowCount === 0) {
        await db.query('ROLLBACK');
        return res.status(404).json({ error: 'Event nicht gefunden' });
      }
      
      await db.query('COMMIT');
      res.json({ message: 'Event erfolgreich gelöscht' });

      // Live Update: Notify all konfis and admins about the event deletion
      liveUpdate.sendToOrg(req.user.organization_id, 'events', 'delete', { eventId: id });

    } catch (err) {
      await db.query('ROLLBACK');
      console.error(`Database error in DELETE /events/${id}:`, err);
      res.status(500).json({ error: 'Database error' });
    }
  });
  
  // Book event (mit Transaktion gegen Race Conditions)
  router.post('/:id/book', rbacVerifier, async (req, res) => {
    const eventId = req.params.id;
    const konfiId = req.user.id;
    const { timeslot_id } = req.body;

    if (req.user.type !== 'konfi') {
      return res.status(403).json({ error: 'Only konfis can book events' });
    }

    try {
      console.log("Booking event:", eventId, "for user:", konfiId, "org:", req.user.organization_id);

      // Transaktion starten für Race-Condition-Schutz
      await db.query('BEGIN');

      // 1. Check if event exists and registration is open (FOR UPDATE sperrt die Zeile)
      const { rows: [event] } = await db.query(
        "SELECT * FROM events WHERE id = $1 AND organization_id = $2 FOR UPDATE",
        [eventId, req.user.organization_id]
      );
      if (!event) {
        await db.query('ROLLBACK');
        return res.status(404).json({ error: 'Event nicht gefunden' });
      }

      const now = new Date();
      if (now < new Date(event.registration_opens_at)) {
        await db.query('ROLLBACK');
        return res.status(400).json({ error: 'Anmeldung noch nicht geöffnet' });
      }
      if (now > new Date(event.registration_closes_at)) {
        await db.query('ROLLBACK');
        return res.status(400).json({ error: 'Anmeldung bereits geschlossen' });
      }

      // 2. Check if already booked
      const { rows: [existingBooking] } = await db.query(
        "SELECT id FROM event_bookings WHERE event_id = $1 AND user_id = $2",
        [eventId, konfiId]
      );
      if (existingBooking) {
        await db.query('ROLLBACK');
        return res.status(409).json({ error: 'Du bist bereits für dieses Event angemeldet' });
      }

      // 3. Check available spots and waitlist
      let totalCapacity = event.max_participants;
      if (event.has_timeslots) {
        const { rows: timeslots } = await db.query(
          "SELECT SUM(max_participants) as total_capacity FROM event_timeslots WHERE event_id = $1",
          [eventId]
        );
        if (timeslots[0] && timeslots[0].total_capacity) {
          totalCapacity = parseInt(timeslots[0].total_capacity, 10);
        }
      }

      const { rows: [counts] } = await db.query(
        "SELECT COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed_count, COUNT(*) FILTER (WHERE status = 'pending') as pending_count FROM event_bookings WHERE event_id = $1",
        [eventId]
      );
      const confirmedCount = parseInt(counts.confirmed_count, 10);
      const pendingCount = parseInt(counts.pending_count, 10);

      let bookingStatus = 'confirmed';
      let message = 'Erfolgreich angemeldet';

      // Only check capacity if totalCapacity > 0 (0 means unlimited)
      if (totalCapacity > 0 && confirmedCount >= totalCapacity) {
        if (!event.waitlist_enabled) {
          await db.query('ROLLBACK');
          return res.status(400).json({ error: 'Das Event ist leider bereits ausgebucht' });
        }
        if (pendingCount >= event.max_waitlist_size) {
          await db.query('ROLLBACK');
          return res.status(400).json({ error: 'Das Event und die Warteliste sind leider voll' });
        }
        bookingStatus = 'pending';
        message = 'Auf die Warteliste gesetzt';
      }

      // 4. Create booking
      const insertBookingQuery = "INSERT INTO event_bookings (event_id, user_id, timeslot_id, status, booking_date, organization_id) VALUES ($1, $2, $3, $4, NOW(), $5) RETURNING id";
      const { rows: [newBooking] } = await db.query(insertBookingQuery, [eventId, konfiId, timeslot_id, bookingStatus, req.user.organization_id]);

      // Transaktion abschließen
      await db.query('COMMIT');

      res.status(201).json({ id: newBooking.id, message, status: bookingStatus });

      // Live Update: Notify the konfi and admins about the booking
      liveUpdate.sendToUser('konfi', konfiId, 'events', 'update', { eventId, status: bookingStatus });
      liveUpdate.sendToOrgAdmins(req.user.organization_id, 'events', 'update', { eventId, action: 'booking' });

    } catch (err) {
      await db.query('ROLLBACK');
      console.error(`Database error in POST /events/${eventId}/book:`, err);
      res.status(500).json({ error: 'Datenbankfehler bei der Anmeldung' });
    }
  });
  
  // Cancel booking
  router.delete('/:id/book', rbacVerifier, async (req, res) => {
    const eventId = req.params.id;
    const konfiId = req.user.id;
    
    if (req.user.type !== 'konfi') {
      return res.status(403).json({ error: 'Only konfis can cancel bookings' });
    }
    
    try {
      console.log("Canceling booking for event:", eventId, "user:", konfiId, "org:", req.user.organization_id);

      // Get booking details before deleting (need timeslot_id and status for waitlist promotion)
      const { rows: [booking] } = await db.query(
        "SELECT status, timeslot_id FROM event_bookings WHERE event_id = $1 AND user_id = $2 AND organization_id = $3",
        [eventId, konfiId, req.user.organization_id]
      );

      if (!booking) {
        return res.status(404).json({ error: 'Booking not found' });
      }

      // Delete the booking
      await db.query("DELETE FROM event_bookings WHERE event_id = $1 AND user_id = $2 AND organization_id = $3", [eventId, konfiId, req.user.organization_id]);

      // If a confirmed spot was opened, auto-promote from waitlist
      if (booking.status === 'confirmed') {
        // For timeslot events, only promote from the same timeslot's waitlist
        const query = booking.timeslot_id
          ? "SELECT id FROM event_bookings WHERE event_id = $1 AND timeslot_id = $2 AND status = 'pending' ORDER BY created_at ASC LIMIT 1"
          : "SELECT id FROM event_bookings WHERE event_id = $1 AND status = 'pending' ORDER BY created_at ASC LIMIT 1";
        const params = booking.timeslot_id ? [eventId, booking.timeslot_id] : [eventId];

        const { rows: [nextInLine] } = await db.query(query, params);

        if (nextInLine) {
          try {
            // Get promoted user's ID and event name for push notification
            const { rows: [promotedBooking] } = await db.query(
              "SELECT eb.user_id, e.name as event_name FROM event_bookings eb JOIN events e ON eb.event_id = e.id WHERE eb.id = $1",
              [nextInLine.id]
            );

            await db.query("UPDATE event_bookings SET status = 'confirmed' WHERE id = $1", [nextInLine.id]);
            console.log(`Promoted booking ${nextInLine.id} from waitlist for event ${eventId}${booking.timeslot_id ? ` (timeslot ${booking.timeslot_id})` : ''}`);

            // Send push notification to promoted user
            if (promotedBooking) {
              await PushService.sendWaitlistPromotionToKonfi(db, promotedBooking.user_id, promotedBooking.event_name);
            }
          } catch (promotionError) {
            // Log the error but don't fail the main cancellation request
            console.error('Error promoting from waitlist:', promotionError);
          }
        }
      }

      res.json({ message: 'Booking canceled successfully' });

      // Live Update: Notify the konfi and admins about the cancellation
      liveUpdate.sendToUser('konfi', konfiId, 'events', 'update', { eventId, action: 'canceled' });
      liveUpdate.sendToOrgAdmins(req.user.organization_id, 'events', 'update', { eventId, action: 'cancellation' });

    } catch (err) {
      console.error(`Database error in DELETE /events/${eventId}/book:`, err);
      res.status(500).json({ error: 'Database error' });
    }
  });
  
  // Add participant to event (Admin only)
  router.post('/:id/participants', rbacVerifier, requireTeamer, async (req, res) => {
    const eventId = req.params.id;
    const { user_id, status = 'auto', timeslot_id = null } = req.body;
    
    try {
      console.log("Admin adding participant:", user_id, "to event:", eventId, "org:", req.user.organization_id);
      
      // 1. Get event details
      const { rows: [event] } = await db.query("SELECT * FROM events WHERE id = $1 AND organization_id = $2", [eventId, req.user.organization_id]);
      if (!event) return res.status(404).json({ error: 'Event not found' });
      
      // 2. Validate user
      const { rows: [user] } = await db.query("SELECT id FROM users WHERE id = $1 AND organization_id = $2", [user_id, req.user.organization_id]);
      if (!user) return res.status(404).json({ error: 'User not found' });
      
      // 3. Validate timeslot if provided
      let timeslot = null;
      if (event.has_timeslots) {
        if (!timeslot_id) return res.status(400).json({ error: 'Timeslot selection required for this event' });
        const { rows: [ts] } = await db.query("SELECT * FROM event_timeslots WHERE id = $1 AND event_id = $2 AND organization_id = $3", [timeslot_id, eventId, req.user.organization_id]);
        if (!ts) return res.status(404).json({ error: 'Timeslot not found' });
        timeslot = ts;
      }
      
      // 4. Check if already booked
      const { rows: [existing] } = await db.query("SELECT id FROM event_bookings WHERE event_id = $1 AND user_id = $2", [eventId, user_id]);
      if (existing) return res.status(409).json({ error: 'User already booked this event' });
      
      // 5. Determine final status
      let finalStatus = status;
      if (status === 'auto') {
        const isTimeslotBooking = !!timeslot;
        const capacityQuery = isTimeslotBooking
        ? "SELECT COUNT(*) as confirmed_count FROM event_bookings WHERE timeslot_id = $1 AND status = 'confirmed'"
        : "SELECT COUNT(*) as confirmed_count FROM event_bookings WHERE event_id = $1 AND status = 'confirmed'";
        const capacityParam = isTimeslotBooking ? timeslot.id : eventId;
        const maxCapacity = isTimeslotBooking ? timeslot.max_participants : event.max_participants;
        
        const { rows: [capacityResult] } = await db.query(capacityQuery, [capacityParam]);
        const confirmedCount = parseInt(capacityResult.confirmed_count, 10);

        // Only check capacity if maxCapacity > 0 (0 means unlimited)
        if (maxCapacity > 0 && confirmedCount >= maxCapacity) {
          if (event.waitlist_enabled) {
            const waitlistQuery = isTimeslotBooking
            ? "SELECT COUNT(*) as waitlist_count FROM event_bookings WHERE timeslot_id = $1 AND status = 'pending'"
            : "SELECT COUNT(*) as waitlist_count FROM event_bookings WHERE event_id = $1 AND status = 'pending'";
            const { rows: [waitlistResult] } = await db.query(waitlistQuery, [capacityParam]);
            const waitlistCount = parseInt(waitlistResult.waitlist_count, 10);

            if (waitlistCount >= event.max_waitlist_size) {
              return res.status(409).json({ error: 'Event and waitlist are full' });
            }
            finalStatus = 'pending';
          } else {
            return res.status(409).json({ error: 'Event is full and waitlist is disabled' });
          }
        } else {
          finalStatus = 'confirmed';
        }
      }
      
      // 6. Create booking
      const insertQuery = "INSERT INTO event_bookings (event_id, user_id, timeslot_id, status, booking_date, organization_id) VALUES ($1, $2, $3, $4, NOW(), $5) RETURNING id";
      const { rows: [newBooking] } = await db.query(insertQuery, [eventId, user_id, timeslot_id, finalStatus, req.user.organization_id]);
      
      const responseMessage = timeslot
      ? `Participant added to timeslot ${new Date(timeslot.start_time).toLocaleTimeString('de-DE', {hour: '2-digit', minute: '2-digit'})} - ${new Date(timeslot.end_time).toLocaleTimeString('de-DE', {hour: '2-digit', minute: '2-digit'})} ${finalStatus === 'pending' ? '(waitlist)' : 'successfully'}`
      : `Participant added ${finalStatus === 'pending' ? 'to waitlist' : 'successfully'}`;
      
      res.status(201).json({
        id: newBooking.id,
        status: finalStatus,
        timeslot_id: timeslot_id,
        message: responseMessage
      });

      // Live Update: Notify the konfi and admins about the admin-booking
      liveUpdate.sendToUser('konfi', user_id, 'events', 'update', { eventId, status: finalStatus });
      liveUpdate.sendToOrgAdmins(req.user.organization_id, 'events', 'update', { eventId, action: 'admin_booking' });

    } catch (err) {
      console.error(`Database error in POST /events/${req.params.id}/participants:`, err);
      if (err.code === '23505') { // unique_violation
        return res.status(409).json({ error: 'This user is already associated with this event.' });
      }
      res.status(500).json({ error: 'Database error' });
    }
  });
  
  // Delete event booking (Admin only)
  router.delete('/:id/bookings/:bookingId', rbacVerifier, requireTeamer, async (req, res) => {
    const { id: eventId, bookingId } = req.params;
    
    try {
      console.log("Admin deleting booking:", bookingId, "for event:", eventId, "org:", req.user.organization_id);
      
      // Get booking details to verify ownership and status
      const { rows: [booking] } = await db.query(`
        SELECT eb.*, u.organization_id 
        FROM event_bookings eb 
        JOIN users u ON eb.user_id = u.id 
        WHERE eb.id = $1 AND eb.event_id = $2`, [bookingId, eventId]);
      
      if (!booking) return res.status(404).json({ error: 'Booking not found' });
      if (booking.organization_id !== req.user.organization_id) return res.status(403).json({ error: 'Access denied' });
      
      // Delete the booking
      await db.query("DELETE FROM event_bookings WHERE id = $1", [bookingId]);
      
      // Auto-promote from waitlist if the deleted booking was confirmed
      if (booking.status === 'confirmed') {
        // For timeslot events, only promote from the same timeslot's waitlist
        const query = booking.timeslot_id
          ? "SELECT id FROM event_bookings WHERE event_id = $1 AND timeslot_id = $2 AND status = 'pending' ORDER BY created_at ASC LIMIT 1"
          : "SELECT id FROM event_bookings WHERE event_id = $1 AND status = 'pending' ORDER BY created_at ASC LIMIT 1";
        const params = booking.timeslot_id ? [eventId, booking.timeslot_id] : [eventId];

        const { rows: [nextInLine] } = await db.query(query, params);
        if (nextInLine) {
          try {
            // Get promoted user's ID and event name for push notification
            const { rows: [promotedBooking] } = await db.query(
              "SELECT eb.user_id, e.name as event_name FROM event_bookings eb JOIN events e ON eb.event_id = e.id WHERE eb.id = $1",
              [nextInLine.id]
            );

            await db.query("UPDATE event_bookings SET status = 'confirmed' WHERE id = $1", [nextInLine.id]);
            console.log(`Promoted booking ${nextInLine.id} from waitlist for event ${eventId}${booking.timeslot_id ? ` (timeslot ${booking.timeslot_id})` : ''}`);

            // Send push notification to promoted user
            if (promotedBooking) {
              await PushService.sendWaitlistPromotionToKonfi(db, promotedBooking.user_id, promotedBooking.event_name);
              // Live Update: Notify promoted user about their status change
              liveUpdate.sendToUser('konfi', promotedBooking.user_id, 'events', 'update', { eventId, action: 'promoted' });
            }
          } catch (promotionError) {
            console.error('Error promoting from waitlist:', promotionError);
          }
        }
      }

      res.json({ message: 'Participant removed successfully' });

      // Live Update: Notify the removed konfi and admins
      liveUpdate.sendToUser('konfi', booking.user_id, 'events', 'update', { eventId, action: 'removed' });
      liveUpdate.sendToOrgAdmins(req.user.organization_id, 'events', 'update', { eventId, action: 'booking_removed' });

    } catch (err) {
      console.error(`Database error in DELETE /events/${eventId}/bookings/${bookingId}:`, err);
      res.status(500).json({ error: 'Database error' });
    }
  });
  
  // Get user's bookings
  router.get('/user/bookings', rbacVerifier, async (req, res) => {
    try {
      if (req.user.type !== 'konfi') {
        return res.status(403).json({ error: 'Only konfis can view their bookings' });
      }
      
      const query = `
        SELECT eb.*, e.name as event_name, e.event_date, e.location
        FROM event_bookings eb
        JOIN events e ON eb.event_id = e.id
        WHERE eb.user_id = $1 AND eb.status = 'confirmed'
        ORDER BY e.event_date ASC
      `;
      const { rows: bookings } = await db.query(query, [req.user.id]);
      res.json(bookings);
      
    } catch (err) {
      console.error('Database error in GET /events/user/bookings:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });
  
  // Create series events
  router.post('/series', rbacVerifier, requireTeamer, async (req, res) => {
    const { 
      name, description, event_date, event_end_time, location, location_maps_url, points, point_type,
      category_ids, jahrgang_ids, type, max_participants, registration_opens_at, 
      registration_closes_at, has_timeslots, waitlist_enabled, max_waitlist_size,
      timeslots, series_count, series_interval
    } = req.body;
    
    if (!name || !event_date || !series_count || series_count < 2) {
      return res.status(400).json({ error: 'Name, event_date, and series_count (min 2) are required' });
    }
    
    await db.query('BEGIN');
    try {
      const generateSeriesDates = (startDate, count, interval) => {
        const dates = [];
        let currentDate = new Date(startDate);
        for (let i = 0; i < count; i++) {
          dates.push(new Date(currentDate));
          if (interval === 'day') currentDate.setDate(currentDate.getDate() + 1);
          else if (interval === 'week') currentDate.setDate(currentDate.getDate() + 7);
          else if (interval === '2weeks') currentDate.setDate(currentDate.getDate() + 14);
          else if (interval === 'month') currentDate.setMonth(currentDate.getMonth() + 1);
          else currentDate.setDate(currentDate.getDate() + 7); // default: weekly
        }
        return dates;
      };
      
      const seriesDates = generateSeriesDates(event_date, series_count, series_interval);
      let seriesId = null; // Will be set to the first event's ID
      
      console.log(`Creating series with ${series_count} events, interval: ${series_interval}`);
      
      for (let i = 0; i < seriesDates.length; i++) {
        const date = seriesDates[i];
        const eventName = `${name} #${i + 1}`;
        
        // Calculate dates for this specific event in series
        const eventStartDate = new Date(date);
        const eventEndDate = event_end_time ? new Date(date) : null;
        if (eventEndDate && event_end_time) {
          const endTime = new Date(event_end_time);
          eventEndDate.setHours(endTime.getHours(), endTime.getMinutes(), 0, 0);
        }
        
        // Calculate registration dates for this event
        const regOpens = registration_opens_at ? new Date(date) : null;
        if (regOpens && registration_opens_at) {
          const openTime = new Date(registration_opens_at);
          regOpens.setHours(openTime.getHours(), openTime.getMinutes(), 0, 0);
          regOpens.setDate(regOpens.getDate() - (new Date(event_date).getDate() - new Date(registration_opens_at).getDate()));
        }
        
        const regCloses = registration_closes_at ? new Date(date) : null;
        if (regCloses && registration_closes_at) {
          const closeTime = new Date(registration_closes_at);
          regCloses.setHours(closeTime.getHours(), closeTime.getMinutes(), 0, 0);
          regCloses.setDate(regCloses.getDate() - (new Date(event_date).getDate() - new Date(registration_closes_at).getDate()));
        }
        
        let eventId;
        
        // First event: create without series_id, then use its ID as series_id
        if (i === 0) {
          const eventQuery = `
            INSERT INTO events (
              name, description, event_date, event_end_time, location, location_maps_url, points, point_type, 
              type, max_participants, registration_opens_at, registration_closes_at, 
              has_timeslots, waitlist_enabled, max_waitlist_size, is_series, created_by, organization_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, true, $16, $17)
            RETURNING id
          `;
          const { rows: [newEvent] } = await db.query(eventQuery, [
            eventName, description, eventStartDate.toISOString(), 
            eventEndDate ? eventEndDate.toISOString() : null,
            location, location_maps_url,
            points || 0, point_type || 'gemeinde', type || 'event', max_participants,
            regOpens ? regOpens.toISOString() : null, 
            regCloses ? regCloses.toISOString() : null, 
            has_timeslots || false, 
            waitlist_enabled !== undefined ? waitlist_enabled : true,
            max_waitlist_size || 10,
            req.user.id, req.user.organization_id
          ]);
          eventId = newEvent.id;
          seriesId = eventId; // Use first event's ID as series_id
          
          // Update first event to set its own series_id
          await db.query("UPDATE events SET series_id = $1 WHERE id = $2", [seriesId, eventId]);
        } else {
          // Subsequent events: create with series_id
          const eventQuery = `
            INSERT INTO events (
              name, description, event_date, event_end_time, location, location_maps_url, points, point_type, 
              type, max_participants, registration_opens_at, registration_closes_at, 
              has_timeslots, waitlist_enabled, max_waitlist_size, is_series, series_id, created_by, organization_id
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, true, $16, $17, $18)
            RETURNING id
          `;
          const { rows: [newEvent] } = await db.query(eventQuery, [
            eventName, description, eventStartDate.toISOString(), 
            eventEndDate ? eventEndDate.toISOString() : null,
            location, location_maps_url,
            points || 0, point_type || 'gemeinde', type || 'event', max_participants,
            regOpens ? regOpens.toISOString() : null, 
            regCloses ? regCloses.toISOString() : null, 
            has_timeslots || false, 
            waitlist_enabled !== undefined ? waitlist_enabled : true,
            max_waitlist_size || 10,
            seriesId, 
            req.user.id, req.user.organization_id
          ]);
          eventId = newEvent.id;
        }

        // IMPORTANT: Create relationPromises array INSIDE the loop for each event
        // This prevents promises from previous events being executed again
        const relationPromises = [];
        if (category_ids && category_ids.length) {
          const catQuery = "INSERT INTO event_categories (event_id, category_id) SELECT $1, unnest($2::int[]) ON CONFLICT DO NOTHING";
          relationPromises.push(db.query(catQuery, [eventId, category_ids]));
        }
        if (jahrgang_ids && jahrgang_ids.length) {
          const jahrQuery = "INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) SELECT $1, unnest($2::int[]) ON CONFLICT DO NOTHING";
          relationPromises.push(db.query(jahrQuery, [eventId, jahrgang_ids]));
        }
        if (has_timeslots && timeslots && timeslots.length) {
          const tsQuery = "INSERT INTO event_timeslots (event_id, start_time, end_time, max_participants, organization_id) VALUES ($1, $2, $3, $4, $5)";
          timeslots.forEach(slot => {
            // Adjust timeslot dates to match the event date
            const slotStart = new Date(slot.start_time);
            const slotEnd = new Date(slot.end_time);
            const adjustedStart = new Date(date);
            const adjustedEnd = new Date(date);

            adjustedStart.setHours(slotStart.getHours(), slotStart.getMinutes(), 0, 0);
            adjustedEnd.setHours(slotEnd.getHours(), slotEnd.getMinutes(), 0, 0);

            relationPromises.push(db.query(tsQuery, [
              eventId,
              adjustedStart.toISOString(),
              adjustedEnd.toISOString(),
              slot.max_participants,
              req.user.organization_id
            ]));
          });
        }
        // Wait for all relations of THIS event to be created before moving to next event
        await Promise.all(relationPromises);
      }
      
      await db.query('COMMIT');
      res.status(201).json({ 
        message: 'Series events created successfully', 
        series_id: seriesId,
        events_created: seriesDates.length
      });
      
    } catch (err) {
      await db.query('ROLLBACK');
      console.error('Database error in POST /events/series:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });
  
  // Promote/Demote participant between confirmed and waitlist
  router.put('/:id/participants/:participantId/status', rbacVerifier, requireTeamer, async (req, res) => {
    const { id: eventId, participantId } = req.params;
    const { status } = req.body;
    
    try {
      if (!['confirmed', 'pending'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status. Must be confirmed or pending' });
      }
      
      console.log("Updating participant status:", participantId, "to:", status, "for event:", eventId);
      
      const { rows: [booking] } = await db.query("SELECT status FROM event_bookings WHERE id = $1 AND event_id = $2", [participantId, eventId]);
      if (!booking) return res.status(404).json({ error: 'Booking not found' });
      if (booking.status === status) return res.status(400).json({ error: `Participant already ${status}` });
      
      const { rowCount } = await db.query("UPDATE event_bookings SET status = $1 WHERE id = $2", [status, participantId]);
      if (rowCount === 0) return res.status(404).json({ error: 'Booking not found during update' }); // Should be rare
      
      const action = status === 'confirmed' ? 'promoted from waitlist' : 'moved to waitlist';
      res.json({ message: `Participant ${action}`, status });
      
    } catch (err) {
      console.error(`Database error in PUT /events/${eventId}/participants/${participantId}/status:`, err);
      res.status(500).json({ error: 'Database error' });
    }
  });
  
  // Update participant attendance and award event points
  router.put('/:id/participants/:participantId/attendance', rbacVerifier, requireTeamer, async (req, res) => {
    const { id: eventId, participantId } = req.params;
    const { attendance_status } = req.body;
    
    if (!['present', 'absent'].includes(attendance_status)) {
      return res.status(400).json({ error: 'Invalid attendance status' });
    }
    
    await db.query('BEGIN');
    try {
      console.log("Updating attendance for participant:", participantId, "event:", eventId, "status:", attendance_status);
      
      const eventDataQuery = `
        SELECT e.name, e.points, e.point_type, eb.user_id
        FROM events e 
        JOIN event_bookings eb ON e.id = eb.event_id
        WHERE e.id = $1 AND eb.id = $2 AND e.organization_id = $3
      `;
      const { rows: [eventData] } = await db.query(eventDataQuery, [eventId, participantId, req.user.organization_id]);
      if (!eventData) {
        await db.query('ROLLBACK');
        return res.status(404).json({ error: 'Event or participant not found, or access denied' });
      }
      
      await db.query("UPDATE event_bookings SET attendance_status = $1 WHERE id = $2", [attendance_status, participantId]);
      
      if (attendance_status === 'present' && eventData.points > 0) {
        // Use ON CONFLICT DO NOTHING to award points idempotently
        const description = `Event-Teilnahme: ${eventData.name}`;
        const pointType = eventData.point_type || 'gemeinde';
        const awardPointsQuery = `
          INSERT INTO event_points (konfi_id, event_id, points, point_type, description, awarded_date, admin_id, organization_id) 
          VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7)
          ON CONFLICT (konfi_id, event_id) DO NOTHING
        `;
        const { rowCount } = await db.query(awardPointsQuery, [
          eventData.user_id, eventId, eventData.points, pointType, description, 
          req.user.id, req.user.organization_id
        ]);
        
        if (rowCount > 0) { // Points were actually inserted
          const updateProfileQuery = pointType === 'gottesdienst' 
          ? "UPDATE konfi_profiles SET gottesdienst_points = gottesdienst_points + $1 WHERE user_id = $2"
          : "UPDATE konfi_profiles SET gemeinde_points = gemeinde_points + $1 WHERE user_id = $2";
          await db.query(updateProfileQuery, [eventData.points, eventData.user_id]);
          
          // Check for new badges after event points are awarded
          try {
            const newBadges = await checkAndAwardBadges(db, eventData.user_id);
            if (newBadges > 0) {
              console.log(`🏆 ${newBadges} neue Badge(s) für Konfi ${eventData.user_id} nach Event-Teilnahme vergeben`);
            }
          } catch (badgeErr) {
            console.error('Error checking badges after event attendance:', badgeErr);
            // Don't fail the request if badge checking fails
          }
          
          await db.query('COMMIT');

          // Push-Notification: Teilnahme bestaetigt mit Punkten
          try {
            await PushService.sendEventAttendanceToKonfi(db, eventData.user_id, eventData.name, 'present', eventData.points);
          } catch (pushErr) {
            console.error('Push notification failed:', pushErr);
          }

          // Live Update: Notify konfi about dashboard (points) and admins about event
          liveUpdate.sendToUser('konfi', eventData.user_id, 'dashboard', 'update', { points: eventData.points });
          liveUpdate.sendToOrgAdmins(req.user.organization_id, 'events', 'update', { eventId, action: 'attendance' });

          return res.json({ message: `Attendance updated and ${eventData.points} ${pointType} points awarded`, points_awarded: true });
        } else {
          await db.query('COMMIT');

          // Push-Notification: Teilnahme bestaetigt (Punkte bereits vergeben)
          try {
            await PushService.sendEventAttendanceToKonfi(db, eventData.user_id, eventData.name, 'present', 0);
          } catch (pushErr) {
            console.error('Push notification failed:', pushErr);
          }

          // Live Update: Notify admins about event attendance change
          liveUpdate.sendToOrgAdmins(req.user.organization_id, 'events', 'update', { eventId, action: 'attendance' });

          return res.json({ message: 'Attendance updated (points already awarded)', points_awarded: false });
        }
        
      } else if (attendance_status === 'absent') {
        const { rows: [existingPoints] } = await db.query("SELECT id, points, point_type FROM event_points WHERE konfi_id = $1 AND event_id = $2", [eventData.user_id, eventId]);
        
        if (existingPoints) {
          await db.query("DELETE FROM event_points WHERE id = $1", [existingPoints.id]);
          const updateProfileQuery = existingPoints.point_type === 'gottesdienst' 
          ? "UPDATE konfi_profiles SET gottesdienst_points = GREATEST(0, gottesdienst_points - $1) WHERE user_id = $2"
          : "UPDATE konfi_profiles SET gemeinde_points = GREATEST(0, gemeinde_points - $1) WHERE user_id = $2";
          await db.query(updateProfileQuery, [existingPoints.points, eventData.user_id]);
          await db.query('COMMIT');

          // Push-Notification: Nicht erschienen (Punkte entfernt)
          try {
            await PushService.sendEventAttendanceToKonfi(db, eventData.user_id, eventData.name, 'absent', 0);
          } catch (pushErr) {
            console.error('Push notification failed:', pushErr);
          }

          // Live Update: Notify konfi about dashboard (points removed) and admins about event
          liveUpdate.sendToUser('konfi', eventData.user_id, 'dashboard', 'update', { points: -existingPoints.points });
          liveUpdate.sendToOrgAdmins(req.user.organization_id, 'events', 'update', { eventId, action: 'attendance' });

          return res.json({ message: `Attendance updated and ${existingPoints.points} points removed`, points_removed: true });
        }

        // Push-Notification: Nicht erschienen (keine Punkte vergeben gewesen)
        try {
          await PushService.sendEventAttendanceToKonfi(db, eventData.user_id, eventData.name, 'absent', 0);
        } catch (pushErr) {
          console.error('Push notification failed:', pushErr);
        }

        // Live Update: Notify admins about event attendance change
        liveUpdate.sendToOrgAdmins(req.user.organization_id, 'events', 'update', { eventId, action: 'attendance' });
      }

      await db.query('COMMIT');
      res.json({ message: 'Attendance updated', points_awarded: false, points_removed: false });
      
    } catch (err) {
      await db.query('ROLLBACK');
      console.error(`Database error in PUT /events/${eventId}/participants/${participantId}/attendance:`, err);
      res.status(500).json({ error: 'Database error' });
    }
  });
  
  // Create group chat for event
  router.post('/:id/chat', rbacVerifier, requireTeamer, async (req, res) => {
    const eventId = req.params.id;
    
    await db.query('BEGIN');
    try {
      const { rows: [event] } = await db.query("SELECT name FROM events WHERE id = $1 AND organization_id = $2", [eventId, req.user.organization_id]);
      if (!event) {
        await db.query('ROLLBACK');
        return res.status(404).json({ error: 'Event not found' });
      }
      
      const { rows: [existingChat] } = await db.query("SELECT id FROM chat_rooms WHERE event_id = $1", [eventId]);
      if (existingChat) {
        await db.query('ROLLBACK');
        return res.status(409).json({ error: 'Chat already exists for this event' });
      }
      
      const chatName = `${event.name} - Chat`;
      const { rows: [newChat] } = await db.query("INSERT INTO chat_rooms (name, type, event_id, created_by) VALUES ($1, 'group', $2, $3) RETURNING id", [chatName, eventId, req.user.id]);
      const chatRoomId = newChat.id;
      
      await db.query("INSERT INTO chat_participants (room_id, user_id, user_type) VALUES ($1, $2, 'admin')", [chatRoomId, req.user.id]);
      
      const { rows: participants } = await db.query("SELECT DISTINCT user_id FROM event_bookings WHERE event_id = $1 AND status = 'confirmed'", [eventId]);
      
      if (participants.length > 0) {
        const participantInsertQuery = `
          INSERT INTO chat_participants (room_id, user_id, user_type)
          SELECT $1, p.user_id, 'konfi' FROM unnest($2::int[]) AS p(user_id)
        `;
        const participantIds = participants.map(p => p.user_id);
        await db.query(participantInsertQuery, [chatRoomId, participantIds]);
      }
      
      await db.query('COMMIT');
      res.status(201).json({ 
        chat_room_id: chatRoomId, 
        message: 'Chat created and participants added successfully',
        participants_added: participants.length
      });
      
    } catch (err) {
      await db.query('ROLLBACK');
      console.error(`Database error in POST /events/${eventId}/chat:`, err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // Cancel event (Admin only)
  router.put('/:id/cancel', rbacVerifier, requireTeamer, async (req, res) => {
    const eventId = req.params.id;
    const { notification_message = 'Das Event wurde abgesagt.' } = req.body;
    
    await db.query('BEGIN');
    try {
      // Get event details
      const { rows: [event] } = await db.query(
        "SELECT name, event_date, cancelled FROM events WHERE id = $1 AND organization_id = $2", 
        [eventId, req.user.organization_id]
      );
      
      if (!event) {
        await db.query('ROLLBACK');
        return res.status(404).json({ error: 'Event nicht gefunden' });
      }
      
      if (event.cancelled) {
        await db.query('ROLLBACK');
        return res.status(400).json({ error: 'Event ist bereits abgesagt' });
      }
      
      // Mark event as cancelled
      await db.query(
        "UPDATE events SET cancelled = TRUE, cancelled_at = NOW() WHERE id = $1", 
        [eventId]
      );
      
      // Get all participants to notify
      const { rows: participants } = await db.query(`
        SELECT DISTINCT eb.user_id, u.display_name, u.username
        FROM event_bookings eb
        JOIN users u ON eb.user_id = u.id
        WHERE eb.event_id = $1 AND eb.status IN ('confirmed', 'pending')
      `, [eventId]);
      
      // Send push notifications to all participants
      const userIds = participants.map(p => p.user_id);
      const eventDateFormatted = new Date(event.event_date).toLocaleDateString('de-DE');
      if (userIds.length > 0) {
        await PushService.sendEventCancellationToKonfis(db, userIds, event.name, eventDateFormatted);
      }
      console.log(`Event "${event.name}" cancelled. Notified ${participants.length} participants.`);

      await db.query('COMMIT');
      res.json({
        message: `Event "${event.name}" wurde abgesagt`,
        participants_notified: participants.length,
        notification_message
      });

      // Live Update: Notify all konfis and admins about the event cancellation
      liveUpdate.sendToOrg(req.user.organization_id, 'events', 'update', { eventId, action: 'cancelled' });

    } catch (err) {
      await db.query('ROLLBACK');
      console.error(`Database error in PUT /events/${eventId}/cancel:`, err);
      res.status(500).json({ error: 'Datenbankfehler beim Absagen des Events' });
    }
  });
  
  return router;
};