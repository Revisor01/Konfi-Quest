const express = require('express');
const router = express.Router();

// Activities routes
module.exports = (db, verifyToken, checkAndAwardBadges, formatDate) => {
  
  // Get all activities
  router.get('/', verifyToken, (req, res) => {
    db.all("SELECT * FROM activities ORDER BY type, name", (err, activities) => {
      if (err) {
        console.error('Error fetching activities:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(activities);
    });
  });

  // Create new activity
  router.post('/', verifyToken, (req, res) => {
    if (req.user.type !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const { name, points, type, category } = req.body;
    
    if (!name || !points || !type) {
      return res.status(400).json({ error: 'Name, points and type are required' });
    }
    
    if (!['gottesdienst', 'gemeinde'].includes(type)) {
      return res.status(400).json({ error: 'Type must be gottesdienst or gemeinde' });
    }
    
    db.run("INSERT INTO activities (name, points, type, category) VALUES (?, ?, ?, ?)", 
      [name, points, type, category], function(err) {
        if (err) {
          console.error('Error creating activity:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        res.json({ 
          id: this.lastID, 
          name, 
          points,
          type,
          category
        });
      }
    );
  });

  // Update activity
  router.put('/:id', verifyToken, (req, res) => {
    if (req.user.type !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const activityId = req.params.id;
    const { name, points, type, category } = req.body;
    
    if (!name || !points || !type) {
      return res.status(400).json({ error: 'Name, points and type are required' });
    }
    
    if (!['gottesdienst', 'gemeinde'].includes(type)) {
      return res.status(400).json({ error: 'Type must be gottesdienst or gemeinde' });
    }
    
    // Handle category - can be empty string or null
    const categoryValue = category && category.trim() ? category.trim() : null;
    
    db.run("UPDATE activities SET name = ?, points = ?, type = ?, category = ? WHERE id = ?", 
      [name, points, type, categoryValue, activityId], function(err) {
        if (err) {
          console.error('Database error updating activity:', err);
          return res.status(500).json({ error: 'Database error: ' + err.message });
        }
        if (this.changes === 0) {
          return res.status(404).json({ error: 'Activity not found' });
        }
        res.json({ message: 'Activity updated successfully' });
      }
    );
  });

  // Delete activity
  router.delete('/:id', verifyToken, (req, res) => {
    if (req.user.type !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const activityId = req.params.id;
    
    // Check if activity is used
    db.get("SELECT COUNT(*) as count FROM konfi_activities WHERE activity_id = ?", [activityId], (err, row) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (row.count > 0) {
        return res.status(400).json({ error: 'Cannot delete activity that has been assigned to konfis' });
      }
      
      db.run("DELETE FROM activities WHERE id = ?", [activityId], function(err) {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }
        
        if (this.changes === 0) {
          return res.status(404).json({ error: 'Activity not found' });
        }
        
        res.json({ message: 'Activity deleted successfully' });
      });
    });
  });

  // Assign activity to konfi (admin only)
  router.post('/konfis/:id/activities', verifyToken, async (req, res) => {
    if (req.user.type !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const konfiId = req.params.id;
    const { activityId, completed_date } = req.body;
    
    if (!activityId) {
      return res.status(400).json({ error: 'Activity ID is required' });
    }
    
    const date = completed_date || new Date().toISOString().split('T')[0];
    
    try {
      // Get activity details
      const activity = await new Promise((resolve, reject) => {
        db.get("SELECT * FROM activities WHERE id = ?", [activityId], (err, row) => {
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
          [konfiId, activityId, req.user.id, date], function(err) {
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
          date: formatDate(date),
          admin: req.user.display_name
        }
      });
      
    } catch (err) {
      console.error('Error assigning activity:', err);
      res.status(500).json({ error: 'Database error: ' + err.message });
    }
  });
  
  // Remove activity from konfi (admin only)
  router.delete('/konfis/:id/activities/:recordId', verifyToken, (req, res) => {
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
  router.post('/konfis/:id/bonus-points', verifyToken, async (req, res) => {
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
          date: formatDate(date),
          admin: req.user.display_name
        }
      });
      
    } catch (err) {
      console.error('Error adding bonus points:', err);
      res.status(500).json({ error: 'Database error: ' + err.message });
    }
  });
  
  return router;
};