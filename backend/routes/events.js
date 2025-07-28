const express = require('express');
const router = express.Router();

// Events routes
module.exports = (db, rbacVerifier, checkPermission) => {
  
  // Get all events (read-only, accessible to all authenticated users)
  router.get('/', rbacVerifier, (req, res) => {
    const query = `
      SELECT e.*, 
             COUNT(DISTINCT CASE WHEN eb.status = 'confirmed' THEN eb.id END) as registered_count,
             COUNT(DISTINCT CASE WHEN eb.status = 'pending' THEN eb.id END) as pending_count,
             COUNT(DISTINCT eb.id) as total_participants,
             e.max_participants,
             e.registration_opens_at,
             e.registration_closes_at,
             e.point_type,
             GROUP_CONCAT(DISTINCT c.id) as category_ids,
             GROUP_CONCAT(DISTINCT c.name) as category_names,
             GROUP_CONCAT(DISTINCT j.id) as jahrgang_ids,
             GROUP_CONCAT(DISTINCT j.name) as jahrgang_names,
             CASE 
               WHEN datetime('now') < e.registration_opens_at THEN 'upcoming'
               WHEN datetime('now') > e.registration_closes_at THEN 'closed'
               ELSE 'open'
             END as registration_status
      FROM events e
      LEFT JOIN event_bookings eb ON e.id = eb.event_id
      LEFT JOIN event_categories ec ON e.id = ec.event_id
      LEFT JOIN categories c ON ec.category_id = c.id
      LEFT JOIN event_jahrgang_assignments eja ON e.id = eja.event_id
      LEFT JOIN jahrgaenge j ON eja.jahrgang_id = j.id
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
      
      // Transform the data to include categories and jahrgaenge arrays
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
        
        const jahrgaenge = [];
        if (row.jahrgang_ids) {
          const ids = row.jahrgang_ids.split(',');
          const names = row.jahrgang_names.split(',');
          for (let i = 0; i < ids.length; i++) {
            jahrgaenge.push({
              id: parseInt(ids[i]),
              name: names[i]
            });
          }
        }
        
        return {
          ...row,
          categories: categories,
          jahrgaenge: jahrgaenge
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
      
      // Get participants (mit organization_id Filterung) - ALLE Status anzeigen
      const participantsQuery = `
        SELECT eb.*, u.display_name as participant_name, kp.jahrgang_id,
               j.name as jahrgang_name, et.start_time as timeslot_start_time,
               et.end_time as timeslot_end_time
        FROM event_bookings eb
        JOIN users u ON eb.user_id = u.id
        LEFT JOIN konfi_profiles kp ON u.id = kp.user_id
        LEFT JOIN jahrgaenge j ON kp.jahrgang_id = j.id
        LEFT JOIN event_timeslots et ON eb.timeslot_id = et.id
        WHERE eb.event_id = ? AND u.organization_id = ?
        ORDER BY 
          CASE eb.status 
            WHEN 'confirmed' THEN 1 
            WHEN 'pending' THEN 2 
            ELSE 3 
          END, 
          eb.created_at ASC
      `;
      
      db.all(participantsQuery, [eventId, req.user.organization_id], (err, participants) => {
        if (err) {
          console.error('Error fetching participants:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        
        // Get series events if this is part of a series
        const getSeriesEvents = (callback) => {
          if (event.is_series && event.series_id) {
            const seriesQuery = `
              SELECT e.*, COUNT(eb.id) as registered_count
              FROM events e
              LEFT JOIN event_bookings eb ON e.id = eb.event_id AND eb.status = 'confirmed'
              WHERE e.series_id = ? AND e.organization_id = ? AND e.id != ?
              GROUP BY e.id
              ORDER BY e.event_date ASC
            `;
            
            db.all(seriesQuery, [event.series_id, req.user.organization_id, eventId], (err, seriesEvents) => {
              if (err) {
                console.error('Error fetching series events:', err);
                return callback(err, null);
              }
              callback(null, seriesEvents);
            });
          } else {
            callback(null, []);
          }
        };
        
        // Get timeslots if event has them
        const getTimeslots = (callback) => {
          if (event.has_timeslots) {
            const timeslotsQuery = `
              SELECT et.*, COUNT(eb.id) as registered_count
              FROM event_timeslots et
              LEFT JOIN event_bookings eb ON et.id = eb.timeslot_id AND eb.status = 'confirmed'
              WHERE et.event_id = ? AND et.organization_id = ?
              GROUP BY et.id
              ORDER BY et.start_time ASC
            `;
            
            db.all(timeslotsQuery, [eventId, req.user.organization_id], (err, timeslots) => {
              if (err) {
                console.error('Error fetching timeslots:', err);
                return callback(err, null);
              }
              callback(null, timeslots);
            });
          } else {
            callback(null, []);
          }
        };
        
        // Fetch both series events and timeslots
        getSeriesEvents((seriesErr, seriesEvents) => {
          if (seriesErr) {
            return res.status(500).json({ error: 'Database error' });
          }
          
          getTimeslots((timeslotsErr, timeslots) => {
            if (timeslotsErr) {
              return res.status(500).json({ error: 'Database error' });
            }
            
            // Get jahrgaenge for this event
            const jahrgaengeQuery = `
              SELECT j.id, j.name
              FROM jahrgaenge j
              JOIN event_jahrgang_assignments eja ON j.id = eja.jahrgang_id
              WHERE eja.event_id = ?
            `;
            
            db.all(jahrgaengeQuery, [eventId], (err, jahrgaenge) => {
              if (err) {
                console.error('Error fetching event jahrgaenge:', err);
                return res.status(500).json({ error: 'Database error' });
              }
              
              // Get categories for this event  
              const categoriesQuery = `
                SELECT c.id, c.name
                FROM categories c
                JOIN event_categories ec ON c.id = ec.category_id
                WHERE ec.event_id = ?
              `;
              
              db.all(categoriesQuery, [eventId], (err, categories) => {
                if (err) {
                  console.error('Error fetching event categories:', err);
                  return res.status(500).json({ error: 'Database error' });
                }
                
                // Calculate correct registered_count for timeslot events
                let registeredCount = participants.filter(p => p.status === 'confirmed').length;
                let pendingCount = participants.filter(p => p.status === 'pending').length;
                
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
                  registered_count: registeredCount,
                  pending_count: pendingCount,
                  max_participants: totalCapacity,
                  available_spots: totalCapacity - registeredCount
                });
              });
            });
          });
        });
      });
    });
  });

  // Create new event
  router.post('/', rbacVerifier, checkPermission('events.create'), (req, res) => {
    
    const {
      name,
      description,
      event_date,
      event_end_time,
      location,
      location_maps_url,
      points,
      point_type,
      category_ids,
      jahrgang_ids,
      type,
      max_participants,
      registration_opens_at,
      registration_closes_at,
      has_timeslots,
      waitlist_enabled,
      max_waitlist_size,
      timeslots,
      is_series,
      series_id
    } = req.body;
    
    if (!name || !event_date || !max_participants) {
      return res.status(400).json({ error: 'Name, event_date, and max_participants are required' });
    }
    
    console.log("Creating event for org:", req.user.organization_id);
    db.run(`INSERT INTO events (
      name, description, event_date, event_end_time, location, location_maps_url, 
      points, point_type, type, max_participants, registration_opens_at, 
      registration_closes_at, has_timeslots, waitlist_enabled, max_waitlist_size, 
      is_series, series_id, created_by, organization_id
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, 
      [
        name, description, event_date, event_end_time, location, location_maps_url,
        points || 0, point_type || 'gemeinde', type || 'event', max_participants,
        registration_opens_at, registration_closes_at, has_timeslots || 0,
        waitlist_enabled !== undefined ? waitlist_enabled : 1, max_waitlist_size || 10,
        is_series || 0, series_id, req.user.id, req.user.organization_id
      ], function(err) {
        if (err) {
          console.error('Error creating event:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        
        const eventId = this.lastID;
        
        // Add categories and jahrgaenge if provided
        const addCategoriesAndJahrgaenge = () => {
          const promises = [];
          
          // Add categories
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
            promises.push(...categoryPromises);
          }
          
          // Add jahrgaenge
          if (jahrgang_ids && Array.isArray(jahrgang_ids) && jahrgang_ids.length > 0) {
            const jahrgangPromises = jahrgang_ids.map(jahrgangId => {
              return new Promise((resolve, reject) => {
                db.run("INSERT OR IGNORE INTO event_jahrgang_assignments (event_id, jahrgang_id) VALUES (?, ?)",
                  [eventId, jahrgangId], (err) => {
                    if (err) reject(err);
                    else resolve();
                  });
              });
            });
            promises.push(...jahrgangPromises);
          }
          
          return Promise.all(promises);
        };
        
        // If has timeslots, create them
        if (has_timeslots && timeslots && timeslots.length > 0) {
          const timeslotQueries = timeslots.map(slot => {
            return new Promise((resolve, reject) => {
              db.run("INSERT INTO event_timeslots (event_id, start_time, end_time, max_participants, organization_id) VALUES (?, ?, ?, ?, ?)",
                [eventId, slot.start_time, slot.end_time, slot.max_participants, req.user.organization_id], function(err) {
                  if (err) reject(err);
                  else resolve(this.lastID);
                }
              );
            });
          });
          
          Promise.all([...timeslotQueries, addCategoriesAndJahrgaenge()])
            .then(() => {
              res.json({ id: eventId, message: 'Event created successfully with timeslots' });
            })
            .catch(err => {
              console.error('Error creating timeslots or categories:', err);
              res.status(500).json({ error: 'Event created but failed to create timeslots or categories' });
            });
        } else {
          addCategoriesAndJahrgaenge()
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
  router.put('/:id', rbacVerifier, checkPermission('events.edit'), (req, res) => {
    
    const { id } = req.params;
    const {
      name,
      description,
      event_date,
      location,
      location_maps_url,
      points,
      point_type,
      category_ids,
      jahrgang_ids,
      type,
      max_participants,
      registration_opens_at,
      registration_closes_at
    } = req.body;
    
    console.log("Updating event:", id, "for org:", req.user.organization_id);
    
    db.serialize(() => {
      db.run("BEGIN TRANSACTION");
      
      // Update main event
      db.run(`UPDATE events SET 
        name = ?, description = ?, event_date = ?, location = ?, 
        location_maps_url = ?, points = ?, point_type = ?, type = ?, 
        max_participants = ?, registration_opens_at = ?, registration_closes_at = ?
        WHERE id = ? AND organization_id = ?`, 
        [
          name, description, event_date, location, location_maps_url,
          points, point_type, type, max_participants, registration_opens_at,
          registration_closes_at, id, req.user.organization_id
        ], function(err) {
          if (err) {
            console.error('Error updating event:', err);
            db.run("ROLLBACK");
            return res.status(500).json({ error: 'Database error' });
          }
          if (this.changes === 0) {
            db.run("ROLLBACK");
            return res.status(404).json({ error: 'Event not found' });
          }
          
          // Update categories
          db.run("DELETE FROM event_categories WHERE event_id = ?", [id], (err) => {
            if (err) {
              console.error('Error deleting old categories:', err);
              db.run("ROLLBACK");
              return res.status(500).json({ error: 'Database error' });
            }
            
            // Update jahrgaenge
            db.run("DELETE FROM event_jahrgang_assignments WHERE event_id = ?", [id], (err) => {
              if (err) {
                console.error('Error deleting old jahrgaenge:', err);
                db.run("ROLLBACK");
                return res.status(500).json({ error: 'Database error' });
              }
              
              const promises = [];
              
              // Add new categories
              if (category_ids && Array.isArray(category_ids) && category_ids.length > 0) {
                const categoryPromises = category_ids.map(categoryId => {
                  return new Promise((resolve, reject) => {
                    db.run("INSERT INTO event_categories (event_id, category_id) VALUES (?, ?)",
                      [id, categoryId], (err) => {
                        if (err) reject(err);
                        else resolve();
                      });
                  });
                });
                promises.push(...categoryPromises);
              }
              
              // Add new jahrgaenge
              if (jahrgang_ids && Array.isArray(jahrgang_ids) && jahrgang_ids.length > 0) {
                const jahrgangPromises = jahrgang_ids.map(jahrgangId => {
                  return new Promise((resolve, reject) => {
                    db.run("INSERT INTO event_jahrgang_assignments (event_id, jahrgang_id) VALUES (?, ?)",
                      [id, jahrgangId], (err) => {
                        if (err) reject(err);
                        else resolve();
                      });
                  });
                });
                promises.push(...jahrgangPromises);
              }
              
              Promise.all(promises)
                .then(() => {
                  db.run("COMMIT", (err) => {
                    if (err) {
                      console.error('Error committing transaction:', err);
                      return res.status(500).json({ error: 'Database error' });
                    }
                    res.json({ message: 'Event updated successfully' });
                  });
                })
                .catch(err => {
                  console.error('Error updating categories/jahrgaenge:', err);
                  db.run("ROLLBACK");
                  res.status(500).json({ error: 'Event updated but failed to update categories/jahrgaenge' });
                });
            });
          });
        }
      );
    });
  });

  // Delete event
  router.delete('/:id', rbacVerifier, checkPermission('events.delete'), (req, res) => {
    
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
          
          // Check available spots and waitlist
          db.get("SELECT COUNT(*) as confirmed_count FROM event_bookings WHERE event_id = ? AND status = 'confirmed'", 
            [eventId], (err, confirmedResult) => {
              if (err) {
                console.error('Error checking confirmed spots:', err);
                return res.status(500).json({ error: 'Database error' });
              }
              
              // Determine status based on availability
              let bookingStatus = 'confirmed';
              let message = 'Event booked successfully';
              
              if (confirmedResult.confirmed_count >= event.max_participants) {
                // Event is full, check waitlist
                db.get("SELECT COUNT(*) as pending_count FROM event_bookings WHERE event_id = ? AND status = 'pending'", 
                  [eventId], (err, pendingResult) => {
                    if (err) {
                      console.error('Error checking waitlist:', err);
                      return res.status(500).json({ error: 'Database error' });
                    }
                    
                    if (pendingResult.pending_count >= 5) {
                      return res.status(400).json({ error: 'Event and waitlist are full' });
                    }
                    
                    bookingStatus = 'pending';
                    message = 'Added to waitlist';
                    
                    // Create waitlist booking
                    db.run("INSERT INTO event_bookings (event_id, user_id, timeslot_id, status, booking_date, organization_id) VALUES (?, ?, ?, ?, datetime('now'), ?)",
                      [eventId, konfiId, timeslot_id, bookingStatus, req.user.organization_id], function(err) {
                        if (err) {
                          console.error('Error creating waitlist booking:', err);
                          return res.status(500).json({ error: 'Database error' });
                        }
                        
                        res.json({ 
                          id: this.lastID, 
                          message: message,
                          status: bookingStatus
                        });
                      });
                  });
              } else {
                // Event has space, create confirmed booking
                db.run("INSERT INTO event_bookings (event_id, user_id, timeslot_id, status, booking_date, organization_id) VALUES (?, ?, ?, ?, datetime('now'), ?)",
                  [eventId, konfiId, timeslot_id, bookingStatus, req.user.organization_id], function(err) {
                    if (err) {
                      console.error('Error creating booking:', err);
                      return res.status(500).json({ error: 'Database error' });
                    }
                    
                    res.json({ 
                      id: this.lastID, 
                      message: message,
                      status: bookingStatus
                    });
                  });
              }
            });
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
        
        // Auto-promote from waitlist
        db.get("SELECT id FROM event_bookings WHERE event_id = ? AND status = 'pending' ORDER BY created_at ASC LIMIT 1", 
          [eventId], (err, nextInLine) => {
            if (err) {
              console.error('Error checking waitlist:', err);
            } else if (nextInLine) {
              // Promote first person from waitlist
              db.run("UPDATE event_bookings SET status = 'confirmed' WHERE id = ?", 
                [nextInLine.id], (err) => {
                  if (err) {
                    console.error('Error promoting from waitlist:', err);
                  } else {
                    console.log('Promoted booking', nextInLine.id, 'from waitlist');
                    // TODO: Send push notification
                  }
                });
            }
            
            res.json({ message: 'Booking canceled successfully' });
          });
      }
    );
  });

  // Add participant to event (Admin only)
  router.post('/:id/participants', rbacVerifier, checkPermission('events.manage_bookings'), (req, res) => {
    const eventId = req.params.id;
    const { user_id, status = 'auto', timeslot_id = null } = req.body; // 'auto' determines status based on capacity
    
    console.log("Admin adding participant:", user_id, "to event:", eventId, "org:", req.user.organization_id);
    
    // Get event details
    db.get("SELECT * FROM events WHERE id = ? AND organization_id = ?", 
      [eventId, req.user.organization_id], (err, event) => {
        if (err) {
          console.error('Error fetching event:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        
        if (!event) {
          return res.status(404).json({ error: 'Event not found' });
        }
        
        // Check if event has timeslots and timeslot_id is required
        if (event.has_timeslots && !timeslot_id) {
          return res.status(400).json({ error: 'Timeslot selection required for this event' });
        }
        
        // If timeslot provided, validate it belongs to this event
        if (timeslot_id) {
          db.get("SELECT * FROM event_timeslots WHERE id = ? AND event_id = ? AND organization_id = ?", 
            [timeslot_id, eventId, req.user.organization_id], (err, timeslot) => {
              if (err) {
                console.error('Error validating timeslot:', err);
                return res.status(500).json({ error: 'Database error' });
              }
              
              if (!timeslot) {
                return res.status(404).json({ error: 'Timeslot not found' });
              }
              
              // Continue with participant validation
              validateAndCreateBooking(event, timeslot);
            });
        } else {
          // No timeslot booking
          validateAndCreateBooking(event, null);
        }
        
        function validateAndCreateBooking(event, timeslot) {
        
        // Check if user exists and belongs to same organization
        db.get("SELECT id FROM users WHERE id = ? AND organization_id = ?", 
          [user_id, req.user.organization_id], (err, user) => {
            if (err) {
              console.error('Error checking user:', err);
              return res.status(500).json({ error: 'Database error' });
            }
            
            if (!user) {
              return res.status(404).json({ error: 'User not found' });
            }
            
            // Check if already booked (for this event, any timeslot)
            const existingQuery = timeslot ? 
              "SELECT id FROM event_bookings WHERE event_id = ? AND user_id = ?" :
              "SELECT id FROM event_bookings WHERE event_id = ? AND user_id = ?";
              
            db.get(existingQuery, [eventId, user_id], (err, existing) => {
                if (err) {
                  console.error('Error checking existing booking:', err);
                  return res.status(500).json({ error: 'Database error' });
                }
                
                if (existing) {
                  return res.status(409).json({ error: 'User already booked this event' });
                }
                
                // Determine final status
                let finalStatus = status;
                if (status === 'auto') {
                  // For timeslot events, check timeslot capacity; for regular events, check event capacity
                  const capacityQuery = timeslot ? 
                    "SELECT COUNT(*) as confirmed_count FROM event_bookings WHERE timeslot_id = ? AND status = 'confirmed'" :
                    "SELECT COUNT(*) as confirmed_count FROM event_bookings WHERE event_id = ? AND status = 'confirmed'";
                  const capacityParam = timeslot ? timeslot.id : eventId;
                  const maxCapacity = timeslot ? timeslot.max_participants : event.max_participants;
                  
                  db.get(capacityQuery, [capacityParam], (err, result) => {
                      if (err) {
                        console.error('Error checking capacity:', err);
                        return res.status(500).json({ error: 'Database error' });
                      }
                      
                      // Check if event allows waitlist
                      if (result.confirmed_count >= maxCapacity) {
                        if (event.waitlist_enabled) {
                          // Check current waitlist size
                          const waitlistQuery = timeslot ? 
                            "SELECT COUNT(*) as waitlist_count FROM event_bookings WHERE timeslot_id = ? AND status = 'pending'" :
                            "SELECT COUNT(*) as waitlist_count FROM event_bookings WHERE event_id = ? AND status = 'pending'";
                          
                          db.get(waitlistQuery, [capacityParam], (err, waitlistResult) => {
                            if (err) {
                              console.error('Error checking waitlist:', err);
                              return res.status(500).json({ error: 'Database error' });
                            }
                            
                            if (waitlistResult.waitlist_count >= event.max_waitlist_size) {
                              return res.status(409).json({ error: 'Event and waitlist are full' });
                            }
                            
                            finalStatus = 'pending';
                            createBooking();
                          });
                          return; // Exit early to handle async waitlist check
                        } else {
                          return res.status(409).json({ error: 'Event is full and waitlist is disabled' });
                        }
                      } else {
                        finalStatus = 'confirmed';
                      }
                      
                      createBooking();
                      
                      function createBooking() {
                      
                      // Create booking
                      const insertQuery = "INSERT INTO event_bookings (event_id, user_id, timeslot_id, status, booking_date, organization_id) VALUES (?, ?, ?, ?, datetime('now'), ?)";
                      db.run(insertQuery, [eventId, user_id, timeslot_id, finalStatus, req.user.organization_id], function(err) {
                          if (err) {
                            console.error('Error creating booking:', err);
                            return res.status(500).json({ error: 'Database error' });
                          }
                          
                          const responseMessage = timeslot ? 
                            `Participant added to timeslot ${new Date(timeslot.start_time).toLocaleTimeString('de-DE', {hour: '2-digit', minute: '2-digit'})} - ${new Date(timeslot.end_time).toLocaleTimeString('de-DE', {hour: '2-digit', minute: '2-digit'})} ${finalStatus === 'pending' ? '(waitlist)' : 'successfully'}` :
                            `Participant added ${finalStatus === 'pending' ? 'to waitlist' : 'successfully'}`;
                          
                          res.json({ 
                            id: this.lastID, 
                            status: finalStatus,
                            timeslot_id: timeslot_id,
                            message: responseMessage
                          });
                        });
                      }
                    });
                } else {
                  // Use specified status (for manual override)
                  const insertQuery = "INSERT INTO event_bookings (event_id, user_id, timeslot_id, status, booking_date, organization_id) VALUES (?, ?, ?, ?, datetime('now'), ?)";
                  db.run(insertQuery, [eventId, user_id, timeslot_id, finalStatus, req.user.organization_id], function(err) {
                      if (err) {
                        console.error('Error creating booking:', err);
                        return res.status(500).json({ error: 'Database error' });
                      }
                      
                      const responseMessage = timeslot ? 
                        `Participant added to timeslot ${new Date(timeslot.start_time).toLocaleTimeString('de-DE', {hour: '2-digit', minute: '2-digit'})} - ${new Date(timeslot.end_time).toLocaleTimeString('de-DE', {hour: '2-digit', minute: '2-digit'})} ${finalStatus === 'pending' ? '(waitlist)' : 'successfully'}` :
                        `Participant added ${finalStatus === 'pending' ? 'to waitlist' : 'successfully'}`;
                      
                      res.json({ 
                        id: this.lastID, 
                        status: finalStatus,
                        timeslot_id: timeslot_id,
                        message: responseMessage
                      });
                    });
                }
            });
          });
        }
      });
  });

  // Delete event booking (Admin only)
  router.delete('/:id/bookings/:bookingId', rbacVerifier, checkPermission('events.manage_bookings'), (req, res) => {
    const eventId = req.params.id;
    const bookingId = req.params.bookingId;
    
    console.log("Admin deleting booking:", bookingId, "for event:", eventId, "org:", req.user.organization_id);
    
    // First check if booking exists and belongs to the same organization
    db.get(`
      SELECT eb.*, u.organization_id 
      FROM event_bookings eb 
      JOIN users u ON eb.user_id = u.id 
      WHERE eb.id = ? AND eb.event_id = ?`, 
      [bookingId, eventId], (err, booking) => {
        if (err) {
          console.error('Error checking booking:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        
        if (!booking) {
          return res.status(404).json({ error: 'Booking not found' });
        }
        
        if (booking.organization_id !== req.user.organization_id) {
          return res.status(403).json({ error: 'Access denied' });
        }
        
        // Delete the booking
        db.run("DELETE FROM event_bookings WHERE id = ?", [bookingId], function(err) {
          if (err) {
            console.error('Error deleting booking:', err);
            return res.status(500).json({ error: 'Database error' });
          }
          
          if (this.changes === 0) {
            return res.status(404).json({ error: 'Booking not found' });
          }
          
          // Auto-promote from waitlist if deleted booking was confirmed
          if (booking.status === 'confirmed') {
            db.get("SELECT id FROM event_bookings WHERE event_id = ? AND status = 'pending' ORDER BY created_at ASC LIMIT 1", 
              [eventId], (err, nextInLine) => {
                if (err) {
                  console.error('Error checking waitlist:', err);
                } else if (nextInLine) {
                  // Promote first person from waitlist
                  db.run("UPDATE event_bookings SET status = 'confirmed' WHERE id = ?", 
                    [nextInLine.id], (err) => {
                      if (err) {
                        console.error('Error promoting from waitlist:', err);
                      } else {
                        console.log('Promoted booking', nextInLine.id, 'from waitlist');
                        // TODO: Send push notification
                      }
                    });
                }
                
                res.json({ message: 'Participant removed successfully' });
              });
          } else {
            res.json({ message: 'Participant removed successfully' });
          }
        });
      });
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
  router.post('/series', rbacVerifier, checkPermission('events.create'), (req, res) => {
    
    const { 
      name, 
      description, 
      event_date,
      location, 
      location_maps_url, 
      points, 
      point_type,
      category_ids,
      jahrgang_ids,
      type, 
      max_participants, 
      registration_opens_at, 
      registration_closes_at,
      has_timeslots,
      timeslots,
      series_count,
      series_interval
    } = req.body;
    
    if (!name || !event_date || !series_count || series_count < 2) {
      return res.status(400).json({ error: 'Name, event_date, and series_count (min 2) are required' });
    }
    
    // Generate series dates based on interval
    const generateSeriesDates = (startDate, count, interval) => {
      const dates = [];
      const currentDate = new Date(startDate);
      
      for (let i = 0; i < count; i++) {
        dates.push(new Date(currentDate));
        
        // Add interval for next date
        if (i < count - 1) {
          if (interval === 'week') {
            currentDate.setDate(currentDate.getDate() + 7);
          } else if (interval === 'month') {
            currentDate.setMonth(currentDate.getMonth() + 1);
          }
        }
      }
      
      return dates;
    };
    
    const seriesDates = generateSeriesDates(event_date, series_count, series_interval);
    const seriesId = Date.now().toString();
    
    console.log('Creating series with', series_count, 'events, interval:', series_interval);
    console.log('Generated dates:', seriesDates.map(d => d.toISOString()));
    
    db.serialize(() => {
      db.run("BEGIN TRANSACTION");
      
      let completed = 0;
      const total = seriesDates.length;
      let hasError = false;
      
      seriesDates.forEach((date, index) => {
        const eventName = `${name} - Termin ${index + 1}`;
        const isoDate = date.toISOString();
        
        // Check if created_by user exists first
        db.get("SELECT id FROM users WHERE id = ? AND organization_id = ?", [req.user.id, req.user.organization_id], (err, user) => {
          if (err || !user) {
            console.error('Created_by user not found:', req.user.id);
            hasError = true;
            return;
          }

          db.run(`INSERT INTO events (
            name, description, event_date, location, location_maps_url, 
            points, point_type, type, max_participants, registration_opens_at, 
            registration_closes_at, has_timeslots, is_series, series_id, created_by, organization_id
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`, 
            [
              eventName, description, isoDate, location, location_maps_url,
              points || 0, point_type || 'gemeinde', type || 'event', max_participants,
              registration_opens_at, registration_closes_at, has_timeslots || 0, seriesId, user.id, req.user.organization_id
            ], function(err) {
            if (err) {
              console.error('Error creating series event:', err);
              hasError = true;
              return;
            }
            
            const eventId = this.lastID;
            
            // Handle categories and jahrgaenge for each event
            const handleRelations = (callback) => {
              const promises = [];
              
              // Add categories
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
                promises.push(...categoryPromises);
              }
              
              // Add jahrgaenge
              if (jahrgang_ids && Array.isArray(jahrgang_ids) && jahrgang_ids.length > 0) {
                const jahrgangPromises = jahrgang_ids.map(jahrgangId => {
                  return new Promise((resolve, reject) => {
                    db.run("INSERT OR IGNORE INTO event_jahrgang_assignments (event_id, jahrgang_id) VALUES (?, ?)",
                      [eventId, jahrgangId], (err) => {
                        if (err) reject(err);
                        else resolve();
                      });
                  });
                });
                promises.push(...jahrgangPromises);
              }
              
              // Add timeslots if provided
              if (has_timeslots && timeslots && Array.isArray(timeslots) && timeslots.length > 0) {
                const timeslotPromises = timeslots.map(timeslot => {
                  return new Promise((resolve, reject) => {
                    db.run("INSERT INTO event_timeslots (event_id, start_time, end_time, max_participants, organization_id) VALUES (?, ?, ?, ?, ?)",
                      [eventId, timeslot.start_time, timeslot.end_time, timeslot.max_participants, req.user.organization_id], (err) => {
                        if (err) reject(err);
                        else resolve();
                      });
                  });
                });
                promises.push(...timeslotPromises);
              }
              
              if (promises.length === 0) {
                return callback();
              }
              
              Promise.all(promises)
                .then(() => callback())
                .catch(err => {
                  console.error('Error adding relations:', err);
                  hasError = true;
                  callback();
                });
            };
            
            handleRelations(() => {
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
            });
          });
        });
      });
    });
  });

  // Promote/Demote participant between confirmed and waitlist
  router.put('/:id/participants/:participantId/status', rbacVerifier, checkPermission('events.manage_bookings'), (req, res) => {
    const eventId = req.params.id;
    const participantId = req.params.participantId;
    const { status } = req.body;
    
    if (!['confirmed', 'pending'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status. Must be confirmed or pending' });
    }
    
    console.log("Updating participant status:", participantId, "to:", status, "for event:", eventId);
    
    // Get current booking
    db.get("SELECT * FROM event_bookings WHERE id = ? AND event_id = ?", 
      [participantId, eventId], (err, booking) => {
        if (err) {
          console.error('Error fetching booking:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        
        if (!booking) {
          return res.status(404).json({ error: 'Booking not found' });
        }
        
        if (booking.status === status) {
          return res.status(400).json({ error: `Participant already ${status}` });
        }
        
        // Update status
        db.run("UPDATE event_bookings SET status = ? WHERE id = ?", 
          [status, participantId], function(err) {
            if (err) {
              console.error('Error updating status:', err);
              return res.status(500).json({ error: 'Database error' });
            }
            
            if (this.changes === 0) {
              return res.status(404).json({ error: 'Booking not found' });
            }
            
            const action = status === 'confirmed' ? 'promoted from waitlist' : 'moved to waitlist';
            res.json({ 
              message: `Participant ${action}`,
              status: status
            });
          });
      });
  });

  // Update participant attendance and award event points
  router.put('/:id/participants/:participantId/attendance', rbacVerifier, checkPermission('events.manage_bookings'), (req, res) => {
    const eventId = req.params.id;
    const participantId = req.params.participantId;
    const { attendance_status } = req.body;
    
    if (!['present', 'absent'].includes(attendance_status)) {
      return res.status(400).json({ error: 'Invalid attendance status' });
    }
    
    console.log("Updating attendance for participant:", participantId, "event:", eventId, "status:", attendance_status);
    
    // Get event and participant details
    db.get(`
      SELECT e.*, eb.user_id, eb.status as booking_status, u.organization_id
      FROM events e 
      JOIN event_bookings eb ON e.id = eb.event_id 
      JOIN users u ON eb.user_id = u.id
      WHERE e.id = ? AND eb.id = ? AND e.organization_id = ?
    `, [eventId, participantId, req.user.organization_id], (err, eventData) => {
      if (err) {
        console.error('Error fetching event/participant:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!eventData) {
        return res.status(404).json({ error: 'Event or participant not found' });
      }
      
      if (eventData.organization_id !== req.user.organization_id) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      // Update attendance status
      db.run("UPDATE event_bookings SET attendance_status = ? WHERE id = ?", 
        [attendance_status, participantId], function(err) {
          if (err) {
            console.error('Error updating attendance:', err);
            return res.status(500).json({ error: 'Database error' });
          }
          
          if (this.changes === 0) {
            return res.status(404).json({ error: 'Participant not found' });
          }
          
          // If marking as present and event has points, award event points
          if (attendance_status === 'present' && eventData.points > 0) {
            // Check if points already awarded
            db.get("SELECT id FROM event_points WHERE konfi_id = ? AND event_id = ?", 
              [eventData.user_id, eventId], (err, existingPoints) => {
                if (err) {
                  console.error('Error checking existing points:', err);
                  return res.status(500).json({ error: 'Database error' });
                }
                
                if (existingPoints) {
                  // Points already awarded, just update attendance
                  return res.json({ 
                    message: 'Attendance updated (points already awarded)',
                    points_awarded: false
                  });
                }
                
                // Award event points
                const description = `Event-Teilnahme: ${eventData.name}`;
                const pointType = eventData.point_type || 'gemeinde';
                const awardedDate = new Date().toISOString().split('T')[0];
                
                db.run(`INSERT INTO event_points 
                  (konfi_id, event_id, points, point_type, description, awarded_date, admin_id, organization_id) 
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                  [eventData.user_id, eventId, eventData.points, pointType, description, 
                   awardedDate, req.user.id, req.user.organization_id], function(err) {
                    if (err) {
                      console.error('Error awarding event points:', err);
                      return res.status(500).json({ error: 'Attendance updated but failed to award points' });
                    }
                    
                    // Also update konfi_profiles for the summary
                    const updateProfileQuery = pointType === 'gottesdienst' 
                      ? "UPDATE konfi_profiles SET gottesdienst_points = gottesdienst_points + ? WHERE user_id = ?"
                      : "UPDATE konfi_profiles SET gemeinde_points = gemeinde_points + ? WHERE user_id = ?";
                    
                    db.run(updateProfileQuery, [eventData.points, eventData.user_id], (err) => {
                      if (err) {
                        console.error('Error updating profile points:', err);
                      }
                      
                      res.json({ 
                        message: `Attendance updated and ${eventData.points} ${pointType} points awarded`,
                        points_awarded: true,
                        points: eventData.points,
                        point_type: pointType
                      });
                    });
                  });
              });
          } else if (attendance_status === 'absent') {
            // If marking as absent, remove event points if they exist
            db.get("SELECT id, points, point_type FROM event_points WHERE konfi_id = ? AND event_id = ?", 
              [eventData.user_id, eventId], (err, existingPoints) => {
                if (err) {
                  console.error('Error checking existing points:', err);
                  return res.status(500).json({ error: 'Database error' });
                }
                
                if (existingPoints) {
                  // Remove event points
                  db.run("DELETE FROM event_points WHERE id = ?", [existingPoints.id], (err) => {
                    if (err) {
                      console.error('Error removing event points:', err);
                      return res.status(500).json({ error: 'Attendance updated but failed to remove points' });
                    }
                    
                    // Update konfi_profiles
                    const updateProfileQuery = existingPoints.point_type === 'gottesdienst' 
                      ? "UPDATE konfi_profiles SET gottesdienst_points = gottesdienst_points - ? WHERE user_id = ?"
                      : "UPDATE konfi_profiles SET gemeinde_points = gemeinde_points - ? WHERE user_id = ?";
                    
                    db.run(updateProfileQuery, [existingPoints.points, eventData.user_id], (err) => {
                      if (err) {
                        console.error('Error updating profile points:', err);
                      }
                      
                      res.json({ 
                        message: `Attendance updated and ${existingPoints.points} ${existingPoints.point_type} points removed`,
                        points_removed: true,
                        points: existingPoints.points,
                        point_type: existingPoints.point_type
                      });
                    });
                  });
                } else {
                  res.json({ 
                    message: 'Attendance updated (no points to remove)',
                    points_removed: false
                  });
                }
              });
          } else {
            res.json({ 
              message: 'Attendance updated',
              points_awarded: false
            });
          }
        });
    });
  });

  // Create group chat for event
  router.post('/:id/chat', rbacVerifier, checkPermission('events.edit'), (req, res) => {
    
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