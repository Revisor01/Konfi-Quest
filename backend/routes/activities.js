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

  
  return router;
};