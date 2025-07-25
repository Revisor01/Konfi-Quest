const express = require('express');
const router = express.Router();

// Events routes
module.exports = (db, rbacVerifier, checkPermission) => {
  
  // Get all events (read-only, accessible to all authenticated users)
  router.get('/', rbacVerifier, (req, res) => {
    const query = `
      SELECT e.*, 
             COUNT(eb.id) as registered_count,
             e.max_participants,
             e.registration_opens_at,
             e.registration_closes_at,
             GROUP_CONCAT(c.id) as category_ids,
             GROUP_CONCAT(c.name) as category_names,
             CASE 
               WHEN datetime('now') < e.registration_opens_at THEN 'upcoming'
               WHEN datetime('now') > e.registration_closes_at THEN 'closed'
               ELSE 'open'
             END as registration_status
      FROM events e
      LEFT JOIN event_bookings eb ON e.id = eb.event_id AND eb.status = 'confirmed'
      LEFT JOIN event_categories ec ON e.id = ec.event_id
      LEFT JOIN categories c ON ec.category_id = c.id
      WHERE e.organization_id = ?
      GROUP BY e.id
      ORDER BY e.event_date ASC
    `;
    
    console.log("Fetching events for org:", req.user.organization_id);
    db.all(query, [req.user.organization_id], (err, rows) => {
      if (err) {
        console.error('Error fetching events:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      // Transform the data to include categories array
      const eventsWithCategories = rows.map(row => {
        const categories = [];
        if (row.category_ids) {
          const ids = row.category_ids.split(',');
          const names = row.category_names.split(',');
          for (let i = 0; i < ids.length; i++) {
            categories.push({
              id: parseInt(ids[i]),
              name: names[i]
            });
          }
        }
        
        return {
          ...row,
          categories: categories
        };
      });
      
      res.json(eventsWithCategories);
    });
  });

  // Get event details with participants
  router.get('/:id', rbacVerifier, (req, res) => {
    const eventId = req.params.id;
    
    // Get event details
    console.log("Fetching event details for event:", eventId, "org:", req.user.organization_id);
    db.get("SELECT * FROM events WHERE id = ? AND organization_id = ?", [eventId, req.user.organization_id], (err, event) => {
      if (err) {
        console.error('Error fetching event:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }
      
      // Get participants (mit organization_id Filterung)
      const participantsQuery = `
        SELECT eb.*, u.display_name as participant_name, kp.jahrgang_id,
               j.name as jahrgang_name
        FROM event_bookings eb
        JOIN users u ON eb.user_id = u.id
        LEFT JOIN konfi_profiles kp ON u.id = kp.user_id
        LEFT JOIN jahrgaenge j ON kp.jahrgang_id = j.id
        WHERE eb.event_id = ? AND eb.status = 'confirmed' AND u.organization_id = ?
        ORDER BY eb.created_at ASC
      `;
      
      db.all(participantsQuery, [eventId, req.user.organization_id], (err, participants) => {
        if (err) {
          console.error('Error fetching participants:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        
        res.json({
          ...event,
          participants,
          available_spots: event.max_participants - participants.length
        });
      });
    });
  });

  // Create new event
  router.post('/', rbacVerifier, checkPermission('admin.events.create'), (req, res) => {
    
    const {
      name,
      description,
      event_date,
      location,
      location_maps_url,
      points,
      category_ids,
      type,
      max_participants,
      registration_opens_at,
      registration_closes_at,
      has_timeslots,
      timeslots,
      is_series,
      series_id
    } = req.body;
    
    if (!name || !event_date || !max_participants) {
      return res.status(400).json({ error: 'Name, event_date, and max_participants are required' });
    }
    
    console.log("Creating event for org:", req.user.organization_id);
    db.run(`INSERT INTO events (
      name, description, event_date, location, location_maps_url, 
      points, type, max_participants, registration_opens_at, 
      registration_closes_at, has_timeslots, is_series, series_id, created_by, organization_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
      [
        name, description, event_date, location, location_maps_url,
        points || 0, type || 'event', max_participants,
        registration_opens_at, registration_closes_at, has_timeslots || 0,
        is_series || 0, series_id, req.user.id, req.user.organization_id
      ], function(err) {
        if (err) {
          console.error('Error creating event:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        
        const eventId = this.lastID;
        
        // Add categories if provided
        const addCategories = () => {
          if (category_ids && Array.isArray(category_ids) && category_ids.length > 0) {
            const categoryPromises = category_ids.map(categoryId => {
              return new Promise((resolve, reject) => {
                db.run("INSERT OR IGNORE INTO event_categories (event_id, category_id) VALUES (?, ?)",
                  [eventId, categoryId], (err) => {
                    if (err) reject(err);
                    else resolve();
                  });
              });
            });
            
            return Promise.all(categoryPromises);
          }
          return Promise.resolve();
        };
        
        // If has timeslots, create them
        if (has_timeslots && timeslots && timeslots.length > 0) {
          const timeslotQueries = timeslots.map(slot => {
            return new Promise((resolve, reject) => {
              db.run("INSERT INTO event_timeslots (event_id, start_time, end_time, max_participants) VALUES (?, ?, ?, ?)",
                [eventId, slot.start_time, slot.end_time, slot.max_participants], function(err) {
                  if (err) reject(err);
                  else resolve(this.lastID);
                }
              );
            });
          });
          
          Promise.all([...timeslotQueries, addCategories()])
            .then(() => {
              res.json({ id: eventId, message: 'Event created successfully with timeslots' });
            })
            .catch(err => {
              console.error('Error creating timeslots or categories:', err);
              res.status(500).json({ error: 'Event created but failed to create timeslots or categories' });
            });
        } else {
          addCategories()
            .then(() => {
              res.json({ id: eventId, message: 'Event created successfully' });
            })
            .catch(err => {
              console.error('Error adding categories:', err);
              res.status(500).json({ error: 'Event created but failed to add categories' });
            });
        }
      }
    );
  });

  // Update event
  router.put('/:id', rbacVerifier, checkPermission('admin.events.edit'), (req, res) => {
    
    const { id } = req.params;
    const {
      name,
      description,
      event_date,
      location,
      location_maps_url,
      points,
      category,
      type,
      max_participants,
      registration_opens_at,
      registration_closes_at
    } = req.body;
    
    console.log("Updating event:", id, "for org:", req.user.organization_id);
    db.run(`UPDATE events SET 
      name = ?, description = ?, event_date = ?, location = ?, 
      location_maps_url = ?, points = ?, category = ?, type = ?, 
      max_participants = ?, registration_opens_at = ?, registration_closes_at = ?
      WHERE id = ? AND organization_id = ?`, 
      [
        name, description, event_date, location, location_maps_url,
        points, category, type, max_participants, registration_opens_at,
        registration_closes_at, id, req.user.organization_id
      ], function(err) {
        if (err) {
          console.error('Error updating event:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        if (this.changes === 0) {
          return res.status(404).json({ error: 'Event not found' });
        }
        res.json({ message: 'Event updated successfully' });
      }
    );
  });

  // Delete event
  router.delete('/:id', rbacVerifier, checkPermission('admin.events.delete'), (req, res) => {
    
    const { id } = req.params;
    
    console.log("Deleting event:", id, "for org:", req.user.organization_id);
    
    db.serialize(() => {
      db.run("BEGIN TRANSACTION");
      
      // First check if event belongs to organization
      db.get("SELECT id FROM events WHERE id = ? AND organization_id = ?", [id, req.user.organization_id], (err, event) => {
        if (err || !event) {
          db.run("ROLLBACK");
          return res.status(404).json({ error: 'Event not found' });
        }
        
        // Delete bookings (mit organization_id check)
        db.run("DELETE FROM event_bookings WHERE event_id = ? AND organization_id = ?", [id, req.user.organization_id]);
        
        // Delete timeslots (mit organization_id check) 
        db.run("DELETE FROM event_timeslots WHERE event_id = ? AND organization_id = ?", [id, req.user.organization_id]);
        
        // Delete event
        db.run("DELETE FROM events WHERE id = ? AND organization_id = ?", [id, req.user.organization_id], function(err) {
          if (err) {
            console.error('Error deleting event:', err);
            db.run("ROLLBACK");
            return res.status(500).json({ error: 'Database error' });
          }
          
          if (this.changes === 0) {
            db.run("ROLLBACK");
            return res.status(404).json({ error: 'Event not found' });
          }
          
          db.run("COMMIT", (err) => {
            if (err) {
              console.error('Error committing transaction:', err);
              return res.status(500).json({ error: 'Database error' });
            }
            res.json({ message: 'Event deleted successfully' });
          });
        });
      });
    });
    });
  });

  // Book event
  router.post('/:id/book', rbacVerifier, (req, res) => {
    const eventId = req.params.id;
    const konfiId = req.user.id;
    const { timeslot_id } = req.body;
    
    if (req.user.type !== 'konfi') {
      return res.status(403).json({ error: 'Only konfis can book events' });
    }
    
    // Check if event exists and registration is open
    console.log("Booking event:", eventId, "for user:", konfiId, "org:", req.user.organization_id);
    db.get("SELECT * FROM events WHERE id = ? AND organization_id = ?", [eventId, req.user.organization_id], (err, event) => {
      if (err) {
        console.error('Error fetching event:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }
      
      // Check registration status
      const now = new Date();
      const opensAt = new Date(event.registration_opens_at);
      const closesAt = new Date(event.registration_closes_at);
      
      if (now < opensAt) {
        return res.status(400).json({ error: 'Registration not yet open' });
      }
      
      if (now > closesAt) {
        return res.status(400).json({ error: 'Registration is closed' });
      }
      
      // Check if already booked
      db.get("SELECT id FROM event_bookings WHERE event_id = ? AND user_id = ? AND status = 'confirmed'", 
        [eventId, konfiId], (err, existing) => {
          if (err) {
            console.error('Error checking existing booking:', err);
            return res.status(500).json({ error: 'Database error' });
          }
          
          if (existing) {
            return res.status(409).json({ error: 'Already booked this event' });
          }
          
          // Check available spots
          db.get("SELECT COUNT(*) as count FROM event_bookings WHERE event_id = ? AND status = 'confirmed'", 
            [eventId], (err, result) => {
              if (err) {
                console.error('Error checking available spots:', err);
                return res.status(500).json({ error: 'Database error' });
              }
              
              if (result.count >= event.max_participants) {
                return res.status(400).json({ error: 'Event is full' });
              }
              
              // Create booking
              db.run("INSERT INTO event_bookings (event_id, user_id, timeslot_id, status, booking_date, organization_id) VALUES (?, ?, ?, 'confirmed', datetime('now'), ?)",
                [eventId, konfiId, timeslot_id, req.user.organization_id], function(err) {
                  if (err) {
                    console.error('Error creating booking:', err);
                    return res.status(500).json({ error: 'Database error' });
                  }
                  
                  res.json({ 
                    id: this.lastID, 
                    message: 'Event booked successfully',
                    booking_id: this.lastID
                  });
                }
              );
            }
          );
        }
      );
    });
  });

  // Cancel booking
  router.delete('/:id/book', rbacVerifier, (req, res) => {
    const eventId = req.params.id;
    const konfiId = req.user.id;
    
    if (req.user.type !== 'konfi') {
      return res.status(403).json({ error: 'Only konfis can cancel bookings' });
    }
    
    console.log("Canceling booking for event:", eventId, "user:", konfiId, "org:", req.user.organization_id);
    db.run("DELETE FROM event_bookings WHERE event_id = ? AND user_id = ? AND organization_id = ?", 
      [eventId, konfiId, req.user.organization_id], function(err) {
        if (err) {
          console.error('Error canceling booking:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        
        if (this.changes === 0) {
          return res.status(404).json({ error: 'Booking not found' });
        }
        
        res.json({ message: 'Booking canceled successfully' });
      }
    );
  });

  // Get user's bookings
  router.get('/user/bookings', rbacVerifier, (req, res) => {
    const konfiId = req.user.id;
    
    if (req.user.type !== 'konfi') {
      return res.status(403).json({ error: 'Only konfis can view their bookings' });
    }
    
    const query = `
      SELECT eb.*, e.name as event_name, e.event_date, e.location
      FROM event_bookings eb
      JOIN events e ON eb.event_id = e.id
      WHERE eb.user_id = ? AND eb.status = 'confirmed'
      ORDER BY e.event_date ASC
    `;
    
    db.all(query, [konfiId], (err, bookings) => {
      if (err) {
        console.error('Error fetching user bookings:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      res.json(bookings);
    });
  });

  // Create series events
  router.post('/series', rbacVerifier, checkPermission('admin.events.create'), (req, res) => {
    
    const { 
      name, 
      description, 
      dates, 
      location, 
      location_maps_url, 
      points, 
      category, 
      type, 
      max_participants, 
      registration_opens_at, 
      registration_closes_at 
    } = req.body;
    
    if (!name || !dates || !Array.isArray(dates) || dates.length === 0) {
      return res.status(400).json({ error: 'Name and dates array are required' });
    }
    
    // Generate series ID
    const seriesId = Date.now().toString();
    
    db.serialize(() => {
      db.run("BEGIN TRANSACTION");
      
      let completed = 0;
      const total = dates.length;
      let hasError = false;
      
      dates.forEach((date, index) => {
        const eventName = `${name} - Termin ${index + 1}`;
        
        db.run(`INSERT INTO events (
          name, description, event_date, location, location_maps_url, 
          points, category, type, max_participants, registration_opens_at, 
          registration_closes_at, is_series, series_id, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`, 
          [
            eventName, description, date, location, location_maps_url,
            points || 0, category || '', type || 'event', max_participants,
            registration_opens_at, registration_closes_at, seriesId, req.user.id
          ], function(err) {
            if (err) {
              console.error('Error creating series event:', err);
              hasError = true;
              return;
            }
            
            completed++;
            
            if (completed === total) {
              if (hasError) {
                db.run("ROLLBACK");
                return res.status(500).json({ error: 'Error creating series events' });
              } else {
                db.run("COMMIT", (err) => {
                  if (err) {
                    console.error('Error committing transaction:', err);
                    return res.status(500).json({ error: 'Database error' });
                  }
                  res.json({ 
                    message: 'Series events created successfully', 
                    series_id: seriesId,
                    events_created: total
                  });
                });
              }
            }
          }
        );
      });
    });
  });

  // Create group chat for event
  router.post('/:id/chat', rbacVerifier, checkPermission('admin.events.edit'), (req, res) => {
    
    const eventId = req.params.id;
    
    // Get event details
    db.get("SELECT name FROM events WHERE id = ?", [eventId], (err, event) => {
      if (err) {
        console.error('Error fetching event:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!event) {
        return res.status(404).json({ error: 'Event not found' });
      }
      
      // Check if chat already exists
      db.get("SELECT id FROM chat_rooms WHERE event_id = ?", [eventId], (err, existingChat) => {
        if (err) {
          console.error('Error checking existing chat:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        
        if (existingChat) {
          return res.status(409).json({ error: 'Chat already exists for this event' });
        }
        
        // Create chat room
        const chatName = `${event.name} - Chat`;
        db.run("INSERT INTO chat_rooms (name, type, event_id, created_by) VALUES (?, 'group', ?, ?)",
          [chatName, eventId, req.user.id], function(err) {
            if (err) {
              console.error('Error creating chat room:', err);
              return res.status(500).json({ error: 'Database error' });
            }
            
            const chatRoomId = this.lastID;
            
            // Add admin as participant
            db.run("INSERT INTO chat_participants (room_id, user_id, user_type) VALUES (?, ?, 'admin')",
              [chatRoomId, req.user.id], (err) => {
                if (err) {
                  console.error('Error adding admin to chat:', err);
                  return res.status(500).json({ error: 'Database error' });
                }
                
                // Add all event participants to chat
                const participantsQuery = `
                  SELECT DISTINCT user_id FROM event_bookings 
                  WHERE event_id = ? AND status = 'confirmed'
                `;
                
                db.all(participantsQuery, [eventId], (err, participants) => {
                  if (err) {
                    console.error('Error fetching participants:', err);
                    return res.status(500).json({ error: 'Database error' });
                  }
                  
                  if (participants.length === 0) {
                    return res.json({ 
                      chat_room_id: chatRoomId, 
                      message: 'Chat created but no participants to add yet' 
                    });
                  }
                  
                  let addedParticipants = 0;
                  participants.forEach(participant => {
                    db.run("INSERT INTO chat_participants (room_id, user_id, user_type) VALUES (?, ?, 'konfi')",
                      [chatRoomId, participant.user_id], (err) => {
                        if (err) {
                          console.error('Error adding participant to chat:', err);
                        }
                        
                        addedParticipants++;
                        if (addedParticipants === participants.length) {
                          res.json({ 
                            chat_room_id: chatRoomId, 
                            message: 'Chat created and participants added successfully',
                            participants_added: participants.length
                          });
                        }
                      }
                    );
                  });
                });
              }
            );
          }
        );
      });
    });
  });

  return router;
};