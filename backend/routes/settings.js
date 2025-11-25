const express = require('express');
const router = express.Router();

// Settings: Nur org_admin darf bearbeiten
module.exports = (db, rbacVerifier, { requireOrgAdmin }) => {

  // Get settings (alle Admins)
  router.get('/', rbacVerifier, async (req, res) => {
    try {
      const { rows } = await db.query("SELECT key, value FROM settings");

      const settings = {};
      rows.forEach(row => {
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

  // Update settings (nur org_admin)
  router.put('/', rbacVerifier, requireOrgAdmin, async (req, res) => {
    try {
      const {
        target_gottesdienst,
        target_gemeinde,
        konfi_chat_permissions,
        waitlist_enabled,
        max_waitlist_size
      } = req.body;

      if (target_gottesdienst !== undefined) {
        await db.query("UPDATE settings SET value = $1 WHERE key = 'target_gottesdienst'", [target_gottesdienst]);
      }

      if (target_gemeinde !== undefined) {
        await db.query("UPDATE settings SET value = $1 WHERE key = 'target_gemeinde'", [target_gemeinde]);
      }

      if (konfi_chat_permissions !== undefined) {
        const validPermissions = [
          'direct_only_admin',
          'direct_only_all',
          'group_direct_admin',
          'group_direct_all'
        ];
        if (!validPermissions.includes(konfi_chat_permissions)) {
          return res.status(400).json({ error: 'Invalid chat permissions value. Valid options: ' + validPermissions.join(', ') });
        }
        const upsertQuery = `
          INSERT INTO settings (key, value)
          VALUES ('konfi_chat_permissions', $1)
          ON CONFLICT (key)
          DO UPDATE SET value = EXCLUDED.value;
        `;
        await db.query(upsertQuery, [konfi_chat_permissions]);
      }

      res.json({ message: 'Settings updated successfully' });

    } catch (err) {
      console.error('Database error in PUT /settings:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  return router;
};
