const express = require('express');
const router = express.Router();

// Badges routes
module.exports = (db, verifyToken) => {
  
  // Get all badges
  router.get('/', verifyToken, (req, res) => {
    db.all("SELECT * FROM badges ORDER BY name", (err, badges) => {
      if (err) {
        console.error('Error fetching badges:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(badges);
    });
  });

  // Get badge criteria types
  router.get('/criteria-types', verifyToken, (req, res) => {
    res.json(['gottesdienst_points', 'gemeinde_points', 'total_points']);
  });

  // Create new badge
  router.post('/', verifyToken, (req, res) => {
    if (req.user.type !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const { name, description, criteria_type, criteria_value, icon } = req.body;
    
    if (!name || !criteria_type || !criteria_value) {
      return res.status(400).json({ error: 'Name, criteria_type, and criteria_value are required' });
    }
    
    db.run("INSERT INTO badges (name, description, criteria_type, criteria_value, icon) VALUES (?, ?, ?, ?, ?)",
      [name, description, criteria_type, criteria_value, icon],
      function(err) {
        if (err) {
          console.error('Error creating badge:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        res.json({ 
          id: this.lastID,
          name,
          description,
          criteria_type,
          criteria_value,
          icon
        });
      }
    );
  });

  // Update badge
  router.put('/:id', verifyToken, (req, res) => {
    if (req.user.type !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const badgeId = req.params.id;
    const { name, description, criteria_type, criteria_value, icon } = req.body;
    
    if (!name || !criteria_type || !criteria_value) {
      return res.status(400).json({ error: 'Name, criteria_type, and criteria_value are required' });
    }
    
    db.run("UPDATE badges SET name = ?, description = ?, criteria_type = ?, criteria_value = ?, icon = ? WHERE id = ?",
      [name, description, criteria_type, criteria_value, icon, badgeId],
      function(err) {
        if (err) {
          console.error('Error updating badge:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        if (this.changes === 0) {
          return res.status(404).json({ error: 'Badge not found' });
        }
        res.json({ message: 'Badge updated successfully' });
      }
    );
  });

  // Delete badge
  router.delete('/:id', verifyToken, (req, res) => {
    if (req.user.type !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const badgeId = req.params.id;
    
    db.run("DELETE FROM badges WHERE id = ?", [badgeId], function(err) {
      if (err) {
        console.error('Error deleting badge:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Badge not found' });
      }
      res.json({ message: 'Badge deleted successfully' });
    });
  });

  // Get badges for specific konfi
  router.get('/konfis/:id', verifyToken, (req, res) => {
    const konfiId = req.params.id;
    
    db.all(`SELECT b.*, kb.earned_at 
            FROM badges b 
            JOIN konfi_badges kb ON b.id = kb.badge_id 
            WHERE kb.konfi_id = ? 
            ORDER BY kb.earned_at DESC`, 
      [konfiId], (err, badges) => {
        if (err) {
          console.error('Error fetching konfi badges:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        res.json(badges);
      }
    );
  });

  return router;
};