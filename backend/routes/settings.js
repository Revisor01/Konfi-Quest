const express = require('express');
const router = express.Router();

// Settings routes for system configuration
module.exports = (db, rbacVerifier, checkPermission) => {
  
  // Get settings
  router.get('/', rbacVerifier, (req, res) => {
    db.all("SELECT * FROM settings", [], (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      const settings = {};
      rows.forEach(row => {
        settings[row.key] = row.value;
      });
      
      res.json(settings);
    });
  });

  // Update settings (admin only)
  router.put('/', rbacVerifier, checkPermission('admin.settings.edit'), (req, res) => {

    const { target_gottesdienst, target_gemeinde } = req.body;
    
    if (target_gottesdienst) {
      db.run("UPDATE settings SET value = ? WHERE key = 'target_gottesdienst'", [target_gottesdienst]);
    }
    
    if (target_gemeinde) {
      db.run("UPDATE settings SET value = ? WHERE key = 'target_gemeinde'", [target_gemeinde]);
    }
    
    res.json({ message: 'Settings updated successfully' });
  });

  return router;
};