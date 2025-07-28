const express = require('express');
const router = express.Router();

// Permissions routes
module.exports = (db, rbacVerifier, checkPermission) => {
  
  // Get all available permissions
  router.get('/', rbacVerifier, checkPermission('admin.roles.view'), async (req, res) => {
    try {
      const query = `
        SELECT id, name, display_name, description, module
        FROM permissions
        WHERE is_system_permission = true
        ORDER BY module, name
      `;
      
      const { rows: permissions } = await db.query(query);
      res.json(permissions);
    } catch (err) {
      console.error('Database error in GET /permissions:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // Get permissions grouped by module
  router.get('/grouped', rbacVerifier, checkPermission('admin.roles.view'), async (req, res) => {
    try {
      const query = `
        SELECT id, name, display_name, description, module
        FROM permissions
        WHERE is_system_permission = true
        ORDER BY module, name
      `;
      
      const { rows: permissions } = await db.query(query);
      
      // Group by module
      const grouped = {};
      permissions.forEach(permission => {
        if (!grouped[permission.module]) {
          grouped[permission.module] = [];
        }
        grouped[permission.module].push(permission);
      });
      
      res.json(grouped);
    } catch (err) {
      console.error('Database error in GET /permissions/grouped:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  return router;
};