const express = require('express');
const router = express.Router();

// Settings routes for system configuration
module.exports = (db, rbacVerifier, checkPermission) => {
  
  // Get settings
  router.get('/', rbacVerifier, async (req, res) => {
    try {
      const { rows } = await db.query("SELECT key, value FROM settings");
      
      const settings = {};
      rows.forEach(row => {
        // Convert numeric settings to numbers
        if (row.key === 'target_gottesdienst' || row.key === 'target_gemeinde' || row.key === 'max_waitlist_size') {
          settings[row.key] = parseInt(row.value, 10) || 0;
        } else if (row.key === 'waitlist_enabled') {
          settings[row.key] = row.value === 'true' || row.value === '1';
        } else {
          settings[row.key] = row.value;
        }
      });
      
      res.json(settings);
    } catch (err) {
      console.error('Database error in GET /settings:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // Update settings (admin only)
  router.put('/', rbacVerifier, checkPermission('admin.settings.edit'), async (req, res) => {
    try {
      // Destructuring to get potential settings from the body
      const { 
        target_gottesdienst, 
        target_gemeinde, 
        konfi_chat_permissions, 
        waitlist_enabled, 
        max_waitlist_size 
      } = req.body;
      
      // Using '!== undefined' to allow setting empty strings or false values
      if (target_gottesdienst !== undefined) {
        await db.query("UPDATE settings SET value = $1 WHERE key = 'target_gottesdienst'", [target_gottesdienst]);
      }
      
      if (target_gemeinde !== undefined) {
        await db.query("UPDATE settings SET value = $1 WHERE key = 'target_gemeinde'", [target_gemeinde]);
      }
      
      if (konfi_chat_permissions !== undefined) {
        // Validate permissions value
        const validPermissions = [
          'direct_only_admin',      // Nur Direktchats mit Admins
          'direct_only_all',        // Direktchats mit allen im Jahrgang
          'group_direct_admin',     // Gruppen- und Direktchats nur mit Admins
          'group_direct_all'        // Gruppen- und Direktchats mit allen im Jahrgang
        ];
        if (!validPermissions.includes(konfi_chat_permissions)) {
          return res.status(400).json({ error: 'Invalid chat permissions value. Valid options: ' + validPermissions.join(', ') });
        }
        // Use PostgreSQL's "UPSERT" functionality
        const upsertQuery = `
          INSERT INTO settings (key, value) 
          VALUES ('konfi_chat_permissions', $1)
          ON CONFLICT (key) 
          DO UPDATE SET value = EXCLUDED.value;
        `;
        await db.query(upsertQuery, [konfi_chat_permissions]);
      }
      
      // Note: waitlist_enabled and max_waitlist_size are not handled in the original code,
      // so they are not handled here either to maintain logic identity.
      
      res.json({ message: 'Settings updated successfully' });

    } catch (err) {
      console.error('Database error in PUT /settings:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  return router;
};