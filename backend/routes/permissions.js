const express = require('express');
const router = express.Router();

// Permissions routes
module.exports = (db, verifyToken, checkPermission) => {
  
  // Get all available permissions
  router.get('/', verifyToken, checkPermission('admin.roles.view'), (req, res) => {
    const query = `
      SELECT id, name, display_name, description, module
      FROM permissions
      WHERE is_system_permission = 1
      ORDER BY module, name
    `;
    
    db.all(query, (err, rows) => {
      if (err) {
        console.error('Error fetching permissions:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      res.json(rows);
    });
  });

  // Get permissions grouped by module
  router.get('/grouped', verifyToken, checkPermission('admin.roles.view'), (req, res) => {
    const query = `
      SELECT id, name, display_name, description, module
      FROM permissions
      WHERE is_system_permission = 1
      ORDER BY module, name
    `;
    
    db.all(query, (err, rows) => {
      if (err) {
        console.error('Error fetching permissions:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      // Group by module
      const grouped = {};
      rows.forEach(permission => {
        if (!grouped[permission.module]) {
          grouped[permission.module] = [];
        }
        grouped[permission.module].push(permission);
      });
      
      res.json(grouped);
    });
  });

  return router;
};