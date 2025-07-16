const express = require('express');
const router = express.Router();

// Settings routes
module.exports = (db, verifyToken) => {
  
  // Get settings
  router.get('/', verifyToken, (req, res) => {
    db.all("SELECT * FROM settings", [], (err, rows) => {
      if (err) {
        console.error('Error fetching settings:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      const settings = {};
      rows.forEach(row => {
        settings[row.key] = row.value;
      });
      
      res.json(settings);
    });
  });

  // Update settings
  router.put('/', verifyToken, (req, res) => {
    if (req.user.type !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const { target_gottesdienst, target_gemeinde } = req.body;
    
    const updates = [];
    
    if (target_gottesdienst !== undefined) {
      updates.push({ key: 'target_gottesdienst', value: target_gottesdienst });
    }
    
    if (target_gemeinde !== undefined) {
      updates.push({ key: 'target_gemeinde', value: target_gemeinde });
    }
    
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No valid settings provided' });
    }
    
    // Update settings
    db.serialize(() => {
      db.run("BEGIN TRANSACTION");
      
      let completed = 0;
      let hasError = false;
      
      updates.forEach(update => {
        db.run("UPDATE settings SET value = ? WHERE key = ?", [update.value, update.key], function(err) {
          if (err) {
            console.error('Error updating setting:', err);
            hasError = true;
          }
          
          completed++;
          
          if (completed === updates.length) {
            if (hasError) {
              db.run("ROLLBACK");
              return res.status(500).json({ error: 'Database error' });
            } else {
              db.run("COMMIT", (err) => {
                if (err) {
                  console.error('Error committing transaction:', err);
                  return res.status(500).json({ error: 'Database error' });
                }
                res.json({ message: 'Settings updated successfully' });
              });
            }
          }
        });
      });
    });
  });

  // Get specific setting
  router.get('/:key', verifyToken, (req, res) => {
    const key = req.params.key;
    
    db.get("SELECT value FROM settings WHERE key = ?", [key], (err, setting) => {
      if (err) {
        console.error('Error fetching setting:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!setting) {
        return res.status(404).json({ error: 'Setting not found' });
      }
      
      res.json({ [key]: setting.value });
    });
  });

  // Update specific setting
  router.put('/:key', verifyToken, (req, res) => {
    if (req.user.type !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const key = req.params.key;
    const { value } = req.body;
    
    if (value === undefined) {
      return res.status(400).json({ error: 'Value is required' });
    }
    
    db.run("UPDATE settings SET value = ? WHERE key = ?", [value, key], function(err) {
      if (err) {
        console.error('Error updating setting:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Setting not found' });
      }
      
      res.json({ message: 'Setting updated successfully', [key]: value });
    });
  });

  return router;
};