// routes/badges.js (KORRIGIERT)
const express = require('express');
const router = express.Router();

module.exports = (db, verifyToken, CRITERIA_TYPES) => {
  
  // Get all badges
  router.get('/', verifyToken, (req, res) => {
    // KORREKT: Verwendung der custom_badges Tabelle
    db.all("SELECT * FROM custom_badges WHERE is_active = 1 ORDER BY name", (err, badges) => {
      if (err) {
        console.error('Error fetching badges:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(badges);
    });
  });

  // Get badge criteria types
  router.get('/criteria-types', verifyToken, (req, res) => {
    res.json(CRITERIA_TYPES);
  });

  // Create new badge
  router.post('/', verifyToken, (req, res) => {
    if (req.user.type !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const { name, icon, description, criteria_type, criteria_value, criteria_extra, is_hidden } = req.body;
    
    if (!name || !icon || !criteria_type || criteria_value === undefined) {
      return res.status(400).json({ error: 'Name, icon, criteria_type, and criteria_value are required' });
    }
    
    // KORREKT: Verwendung der custom_badges Tabelle mit allen korrekten Feldern
    db.run(`INSERT INTO custom_badges (
      name, icon, description, criteria_type, criteria_value, 
      criteria_extra, is_active, is_hidden, created_by
    ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [name, icon, description, criteria_type, criteria_value, criteria_extra, is_hidden || 0, req.user.id],
      function(err) {
        if (err) {
          console.error('Error creating badge:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        res.status(201).json({ 
          id: this.lastID,
          name,
          icon,
          description,
          criteria_type,
          criteria_value,
          criteria_extra,
          is_hidden: is_hidden || 0
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
    const { name, icon, description, criteria_type, criteria_value, criteria_extra, is_active, is_hidden } = req.body;
    
    if (!name || !icon || !criteria_type || criteria_value === undefined) {
      return res.status(400).json({ error: 'Name, icon, criteria_type, and criteria_value are required' });
    }
    
    db.run(`UPDATE custom_badges SET 
      name = ?, icon = ?, description = ?, criteria_type = ?, criteria_value = ?, 
      criteria_extra = ?, is_active = ?, is_hidden = ? 
      WHERE id = ?`,
      [name, icon, description, criteria_type, criteria_value, criteria_extra, 
       is_active !== undefined ? is_active : 1, is_hidden || 0, badgeId],
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
    
    // Check if badge has been earned
    db.get("SELECT COUNT(*) as count FROM konfi_badges WHERE badge_id = ?", [badgeId], (err, result) => {
      if (err) {
        console.error('Error checking badge usage:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (result.count > 0) {
        return res.status(400).json({ error: 'Cannot delete badge that has been earned' });
      }
      
      db.run("DELETE FROM custom_badges WHERE id = ?", [badgeId], function(err) {
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
  });

  // Get badges for specific konfi
  router.get('/konfis/:id', verifyToken, (req, res) => {
    const konfiId = req.params.id;
    
    db.all(`SELECT b.*, kb.earned_at 
            FROM custom_badges b 
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

  // Get all badges (including hidden ones) for admin
  router.get('/all', verifyToken, (req, res) => {
    if (req.user.type !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    db.all(`SELECT b.*, 
                   COUNT(kb.id) as earned_count,
                   COUNT(DISTINCT kb.konfi_id) as unique_konfis
            FROM custom_badges b
            LEFT JOIN konfi_badges kb ON b.id = kb.badge_id
            GROUP BY b.id
            ORDER BY b.name`, [], (err, badges) => {
      if (err) {
        console.error('Error fetching all badges:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(badges);
    });
  });

  return router;
};