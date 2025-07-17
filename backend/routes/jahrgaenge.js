// routes/jahrgaenge.js (KORRIGIERT)
const express = require('express');
const router = express.Router();

module.exports = (db, verifyToken) => {
  
  // Get all jahrgänge
  router.get('/', verifyToken, (req, res) => {
    db.all(`SELECT j.*, 
                   COUNT(k.id) as konfi_count,
                   COALESCE(AVG(k.gottesdienst_points), 0) as avg_gottesdienst_points,
                   COALESCE(AVG(k.gemeinde_points), 0) as avg_gemeinde_points
            FROM jahrgaenge j
            LEFT JOIN konfis k ON j.id = k.jahrgang_id
            GROUP BY j.id
            ORDER BY j.name`, [], (err, jahrgaenge) => {
      if (err) {
        console.error('Error fetching jahrgänge:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(jahrgaenge);
    });
  });

  // Get single jahrgang with konfis
  router.get('/:id', verifyToken, (req, res) => {
    const jahrgangId = req.params.id;
    
    db.get("SELECT * FROM jahrgaenge WHERE id = ?", [jahrgangId], (err, jahrgang) => {
      if (err) {
        console.error('Error fetching jahrgang:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!jahrgang) {
        return res.status(404).json({ error: 'Jahrgang not found' });
      }
      
      // Get konfis in this jahrgang
      db.all(`SELECT k.*, 
                     COALESCE(ka_count.activity_count, 0) as activity_count,
                     COALESCE(bp_count.bonus_count, 0) as bonus_count
              FROM konfis k
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
              WHERE k.jahrgang_id = ?
              ORDER BY k.name`, [jahrgangId], (err, konfis) => {
        if (err) {
          console.error('Error fetching konfis:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        
        res.json({
          ...jahrgang,
          konfis
        });
      });
    });
  });

  // Create new jahrgang
  router.post('/', verifyToken, (req, res) => {
    if (req.user.type !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const { name, confirmation_date } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }
    
    // KORREKT: Verwendung der confirmation_date aus der Datenbankstruktur
    db.run("INSERT INTO jahrgaenge (name, confirmation_date) VALUES (?, ?)",
      [name, confirmation_date], function(err) {
        if (err) {
          console.error('Error creating jahrgang:', err);
          if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(409).json({ error: 'Jahrgang name already exists' });
          }
          return res.status(500).json({ error: 'Database error' });
        }
        
        res.status(201).json({
          id: this.lastID,
          name,
          confirmation_date
        });
      });
  });

  // Update jahrgang
  router.put('/:id', verifyToken, (req, res) => {
    if (req.user.type !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const jahrgangId = req.params.id;
    const { name, confirmation_date } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }
    
    db.run("UPDATE jahrgaenge SET name = ?, confirmation_date = ? WHERE id = ?",
      [name, confirmation_date, jahrgangId], function(err) {
        if (err) {
          console.error('Error updating jahrgang:', err);
          if (err.message.includes('UNIQUE constraint failed')) {
            return res.status(409).json({ error: 'Jahrgang name already exists' });
          }
          return res.status(500).json({ error: 'Database error' });
        }
        if (this.changes === 0) {
          return res.status(404).json({ error: 'Jahrgang not found' });
        }
        res.json({ message: 'Jahrgang updated successfully' });
      });
  });

  // Delete jahrgang
  router.delete('/:id', verifyToken, (req, res) => {
    if (req.user.type !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const jahrgangId = req.params.id;
    
    // Check if jahrgang has konfis
    db.get("SELECT COUNT(*) as count FROM konfis WHERE jahrgang_id = ?", [jahrgangId], (err, result) => {
      if (err) {
        console.error('Error checking jahrgang usage:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (result.count > 0) {
        return res.status(400).json({ error: 'Cannot delete jahrgang with assigned konfis' });
      }
      
      db.run("DELETE FROM jahrgaenge WHERE id = ?", [jahrgangId], function(err) {
        if (err) {
          console.error('Error deleting jahrgang:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        if (this.changes === 0) {
          return res.status(404).json({ error: 'Jahrgang not found' });
        }
        res.json({ message: 'Jahrgang deleted successfully' });
      });
    });
  });

  return router;
};