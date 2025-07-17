// routes/konfis.js (KORRIGIERT)
const express = require('express');
const router = express.Router();

module.exports = (db, verifyToken, bcrypt, generateBiblicalPassword, checkAndAwardBadges) => {
  
  // Get all konfis
  router.get('/', verifyToken, (req, res) => {
    let query = `
      SELECT k.*, j.name as jahrgang_name,
             COALESCE(ka_count.activity_count, 0) as activity_count,
             COALESCE(bp_count.bonus_count, 0) as bonus_count
      FROM konfis k
      LEFT JOIN jahrgaenge j ON k.jahrgang_id = j.id
      LEFT JOIN (
        SELECT konfi_id, COUNT(*) as activity_count
        FROM konfi_activities
        GROUP BY konfi_id
      ) ka_count ON k.id = ka_count.konfi_id
      LEFT JOIN (
        SELECT konfi_id, COUNT(*) as bonus_count
        FROM bonus_points
        GROUP BY konfi_id
      ) bp_count ON k.id = bp_count.konfi_id
    `;
    
    const params = [];
    
    if (req.query.jahrgang_id) {
      query += " WHERE k.jahrgang_id = ?";
      params.push(req.query.jahrgang_id);
    }
    
    query += " ORDER BY k.name";
    
    db.all(query, params, (err, konfis) => {
      if (err) {
        console.error('Error fetching konfis:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(konfis);
    });
  });

  // Get single konfi
  router.get('/:id', verifyToken, (req, res) => {
    const konfiId = req.params.id;
    
    // Get konfi with detailed information
    db.get(`SELECT k.*, j.name as jahrgang_name 
            FROM konfis k 
            LEFT JOIN jahrgaenge j ON k.jahrgang_id = j.id 
            WHERE k.id = ?`, [konfiId], (err, konfi) => {
      if (err) {
        console.error('Error fetching konfi:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!konfi) {
        return res.status(404).json({ error: 'Konfi not found' });
      }
      
      // Get activities
      db.all(`SELECT ka.*, a.name as activity_name, a.points, a.type as activity_type,
                     ad.display_name as admin_name
              FROM konfi_activities ka
              JOIN activities a ON ka.activity_id = a.id
              LEFT JOIN admins ad ON ka.admin_id = ad.id
              WHERE ka.konfi_id = ?
              ORDER BY ka.completed_date DESC`, [konfiId], (err, activities) => {
        if (err) {
          console.error('Error fetching konfi activities:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        
        // Get bonus points
        db.all(`SELECT bp.*, ad.display_name as admin_name
                FROM bonus_points bp
                LEFT JOIN admins ad ON bp.admin_id = ad.id
                WHERE bp.konfi_id = ?
                ORDER BY bp.completed_date DESC`, [konfiId], (err, bonusPoints) => {
          if (err) {
            console.error('Error fetching bonus points:', err);
            return res.status(500).json({ error: 'Database error' });
          }
          
          // Get badges
          db.all(`SELECT b.*, kb.earned_at
                  FROM custom_badges b
                  JOIN konfi_badges kb ON b.id = kb.badge_id
                  WHERE kb.konfi_id = ?
                  ORDER BY kb.earned_at DESC`, [konfiId], (err, badges) => {
            if (err) {
              console.error('Error fetching konfi badges:', err);
              return res.status(500).json({ error: 'Database error' });
            }
            
            res.json({
              ...konfi,
              activities,
              bonusPoints,
              badges
            });
          });
        });
      });
    });
  });

  // Create new konfi
  router.post('/', verifyToken, (req, res) => {
    if (req.user.type !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const { name, jahrgang_id } = req.body;
    
    if (!name || !jahrgang_id) {
      return res.status(400).json({ error: 'Name and jahrgang_id are required' });
    }
    
    // Generate username and password
    const username = name.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z0-9.]/g, '');
    const password = generateBiblicalPassword();
    
    // KORREKT: Hashen des Passworts
    bcrypt.hash(password, 10, (err, hashedPassword) => {
      if (err) {
        console.error('Error hashing password:', err);
        return res.status(500).json({ error: 'Server error' });
      }
      
      // KORREKT: Speichern sowohl password_hash als auch password_plain
      db.run(`INSERT INTO konfis (
        name, username, password_hash, password_plain, jahrgang_id, 
        gottesdienst_points, gemeinde_points
      ) VALUES (?, ?, ?, ?, ?, 0, 0)`, 
        [name, username, hashedPassword, password, jahrgang_id], function(err) {
          if (err) {
            console.error('Error creating konfi:', err);
            if (err.message.includes('UNIQUE constraint failed')) {
              return res.status(409).json({ error: 'Username already exists' });
            }
            return res.status(500).json({ error: 'Database error' });
          }
          
          res.status(201).json({
            id: this.lastID,
            name,
            username,
            password, // Klartext für Admin-Ausgabe
            jahrgang_id,
            gottesdienst_points: 0,
            gemeinde_points: 0
          });
        });
    });
  });

  // Update konfi
  router.put('/:id', verifyToken, (req, res) => {
    if (req.user.type !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const konfiId = req.params.id;
    const { name, jahrgang_id } = req.body;
    
    if (!name || !jahrgang_id) {
      return res.status(400).json({ error: 'Name and jahrgang_id are required' });
    }
    
    db.run(`UPDATE konfis SET name = ?, jahrgang_id = ? WHERE id = ?`,
      [name, jahrgang_id, konfiId], function(err) {
        if (err) {
          console.error('Error updating konfi:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        if (this.changes === 0) {
          return res.status(404).json({ error: 'Konfi not found' });
        }
        res.json({ message: 'Konfi updated successfully' });
      });
  });

  // Delete konfi
  router.delete('/:id', verifyToken, (req, res) => {
    if (req.user.type !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const konfiId = req.params.id;
    
    db.serialize(() => {
      db.run("BEGIN TRANSACTION");
      
      // Delete related records
      db.run("DELETE FROM konfi_activities WHERE konfi_id = ?", [konfiId]);
      db.run("DELETE FROM bonus_points WHERE konfi_id = ?", [konfiId]);
      db.run("DELETE FROM konfi_badges WHERE konfi_id = ?", [konfiId]);
      db.run("DELETE FROM chat_participants WHERE user_id = ? AND user_type = 'konfi'", [konfiId]);
      db.run("DELETE FROM event_bookings WHERE konfi_id = ?", [konfiId]);
      db.run("DELETE FROM activity_requests WHERE konfi_id = ?", [konfiId]);
      
      // Delete konfi
      db.run("DELETE FROM konfis WHERE id = ?", [konfiId], function(err) {
        if (err) {
          console.error('Error deleting konfi:', err);
          db.run("ROLLBACK");
          return res.status(500).json({ error: 'Database error' });
        }
        
        if (this.changes === 0) {
          db.run("ROLLBACK");
          return res.status(404).json({ error: 'Konfi not found' });
        }
        
        db.run("COMMIT", (err) => {
          if (err) {
            console.error('Error committing transaction:', err);
            return res.status(500).json({ error: 'Database error' });
          }
          res.json({ message: 'Konfi deleted successfully' });
        });
      });
    });
  });

  // Regenerate password for konfi
  router.post('/:id/regenerate-password', verifyToken, (req, res) => {
    if (req.user.type !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const konfiId = req.params.id;
    const newPassword = generateBiblicalPassword();
    
    // KORREKT: Hashen des neuen Passworts
    bcrypt.hash(newPassword, 10, (err, hashedPassword) => {
      if (err) {
        console.error('Error hashing password:', err);
        return res.status(500).json({ error: 'Server error' });
      }
      
      // KORREKT: Aktualisieren sowohl password_hash als auch password_plain
      db.run("UPDATE konfis SET password_hash = ?, password_plain = ? WHERE id = ?", 
        [hashedPassword, newPassword, konfiId], function(err) {
          if (err) {
            console.error('Error regenerating password:', err);
            return res.status(500).json({ error: 'Database error' });
          }
          
          if (this.changes === 0) {
            return res.status(404).json({ error: 'Konfi not found' });
          }
          
          res.json({ 
            message: 'Password regenerated successfully',
            newPassword: newPassword
          });
        });
    });
  });

  // Assign activity to konfi (admin only)
  router.post('/:id/activities', verifyToken, async (req, res) => {
    if (req.user.type !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const konfiId = req.params.id;
    const { activity_id, completed_date } = req.body;
    
    if (!activity_id) {
      return res.status(400).json({ error: 'Activity ID is required' });
    }
    
    const date = completed_date || new Date().toISOString().split('T')[0];
    
    try {
      // Get activity details
      const activity = await new Promise((resolve, reject) => {
        db.get("SELECT * FROM activities WHERE id = ?", [activity_id], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
      
      if (!activity) {
        return res.status(404).json({ error: 'Activity not found' });
      }
      
      // Add activity to konfi
      await new Promise((resolve, reject) => {
        db.run("INSERT INTO konfi_activities (konfi_id, activity_id, admin_id, completed_date) VALUES (?, ?, ?, ?)",
          [konfiId, activity_id, req.user.id, date], function(err) {
            if (err) reject(err);
            else resolve();
          });
      });
      
      // Update konfi points
      const pointField = activity.type === 'gottesdienst' ? 'gottesdienst_points' : 'gemeinde_points';
      await new Promise((resolve, reject) => {
        db.run(`UPDATE konfis SET ${pointField} = ${pointField} + ? WHERE id = ?`,
          [activity.points, konfiId], (err) => {
            if (err) reject(err);
            else resolve();
          });
      });
      
      // Check and award badges
      const newBadges = await checkAndAwardBadges(konfiId);
      
      res.json({ 
        message: 'Activity assigned successfully',
        newBadges: newBadges,
        activity: {
          name: activity.name,
          points: activity.points,
          type: activity.type,
          date: date,
          admin: req.user.display_name
        }
      });
      
    } catch (err) {
      console.error('Error assigning activity:', err);
      res.status(500).json({ error: 'Database error: ' + err.message });
    }
  });

  // Remove activity from konfi (admin only)
  router.delete('/:id/activities/:recordId', verifyToken, (req, res) => {
    if (req.user.type !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const konfiId = req.params.id;
    const recordId = req.params.recordId;
    
    // Get activity details first to subtract points
    db.get("SELECT ka.id, ka.activity_id, a.points, a.type FROM konfi_activities ka JOIN activities a ON ka.activity_id = a.id WHERE ka.id = ? AND ka.konfi_id = ?", 
      [recordId, konfiId], (err, activityAssignment) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }
        
        if (!activityAssignment) {
          return res.status(404).json({ error: 'Activity assignment not found' });
        }
        
        // Remove the assignment
        db.run("DELETE FROM konfi_activities WHERE id = ?", [recordId], function(err) {
          if (err) {
            return res.status(500).json({ error: 'Database error' });
          }
          
          // Update konfi points (subtract)
          const pointField = activityAssignment.type === 'gottesdienst' ? 'gottesdienst_points' : 'gemeinde_points';
          db.run(`UPDATE konfis SET ${pointField} = ${pointField} - ? WHERE id = ?`,
            [activityAssignment.points, konfiId],
            (err) => {
              if (err) {
                return res.status(500).json({ error: 'Database error updating points' });
              }
              
              res.json({ 
                message: 'Activity removed successfully',
                pointsSubtracted: activityAssignment.points,
                type: activityAssignment.type
              });
            });
        });
      });
  });

  // Add bonus points
  router.post('/:id/bonus-points', verifyToken, async (req, res) => {
    if (req.user.type !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const konfiId = req.params.id;
    const { points, type, description, completed_date } = req.body;
    
    if (!points || !type || !description) {
      return res.status(400).json({ error: 'Points, type and description are required' });
    }
    
    if (!['gottesdienst', 'gemeinde'].includes(type)) {
      return res.status(400).json({ error: 'Type must be gottesdienst or gemeinde' });
    }
    
    const date = completed_date || new Date().toISOString().split('T')[0];
    
    try {
      // Add bonus points
      await new Promise((resolve, reject) => {
        db.run("INSERT INTO bonus_points (konfi_id, points, type, description, admin_id, completed_date) VALUES (?, ?, ?, ?, ?, ?)",
          [konfiId, points, type, description, req.user.id, date], function(err) {
            if (err) reject(err);
            else resolve();
          });
      });
      
      // Update konfi points
      const pointField = type === 'gottesdienst' ? 'gottesdienst_points' : 'gemeinde_points';
      await new Promise((resolve, reject) => {
        db.run(`UPDATE konfis SET ${pointField} = ${pointField} + ? WHERE id = ?`,
          [points, konfiId], (err) => {
            if (err) reject(err);
            else resolve();
          });
      });
      
      // Check and award badges
      const newBadges = await checkAndAwardBadges(konfiId);
      
      res.json({ 
        message: 'Bonus points added successfully',
        newBadges: newBadges,
        bonusPoints: {
          points: points,
          type: type,
          description: description,
          date: date,
          admin: req.user.display_name
        }
      });
      
    } catch (err) {
      console.error('Error adding bonus points:', err);
      res.status(500).json({ error: 'Database error: ' + err.message });
    }
  });

  // Remove bonus points from konfi (admin only)
  router.delete('/:id/bonus-points/:bonusId', verifyToken, (req, res) => {
    if (req.user.type !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const konfiId = req.params.id;
    const bonusId = req.params.bonusId;
    
    // Get bonus points details first to subtract points
    db.get("SELECT id, points, type FROM bonus_points WHERE id = ? AND konfi_id = ?", 
      [bonusId, konfiId], (err, bonusPoints) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }
        
        if (!bonusPoints) {
          return res.status(404).json({ error: 'Bonus points not found' });
        }
        
        // Remove the bonus points
        db.run("DELETE FROM bonus_points WHERE id = ?", [bonusId], function(err) {
          if (err) {
            return res.status(500).json({ error: 'Database error' });
          }
          
          // Update konfi points (subtract)
          const pointField = bonusPoints.type === 'gottesdienst' ? 'gottesdienst_points' : 'gemeinde_points';
          db.run(`UPDATE konfis SET ${pointField} = ${pointField} - ? WHERE id = ?`,
            [bonusPoints.points, konfiId],
            (err) => {
              if (err) {
                return res.status(500).json({ error: 'Database error updating points' });
              }
              
              res.json({ 
                message: 'Bonus points removed successfully',
                pointsSubtracted: bonusPoints.points,
                type: bonusPoints.type
              });
            });
        });
      });
  });

  return router;
};