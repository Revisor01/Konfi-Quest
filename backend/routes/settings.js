const express = require('express');
const router = express.Router();

// Settings: Nur org_admin darf bearbeiten
module.exports = (db, rbacVerifier, { requireOrgAdmin }) => {

  // Sicherstellen, dass settings-Tabelle organization_id-Spalte hat
  // (Migration: idempotent, läuft bei jedem Start)
  const ensureOrgColumn = async () => {
    try {
      // Prüfen ob organization_id Spalte existiert
      const { rows } = await db.query(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'settings' AND column_name = 'organization_id'
      `);

      if (rows.length === 0) {
        console.log('Migrating settings table: adding organization_id column...');

        // Spalte hinzufügen (nullable zunächst)
        await db.query('ALTER TABLE settings ADD COLUMN organization_id INTEGER REFERENCES organizations(id)');

        // Bestehende Settings der ersten Organisation zuweisen
        const { rows: orgs } = await db.query('SELECT id FROM organizations ORDER BY id LIMIT 1');
        if (orgs.length > 0) {
          await db.query('UPDATE settings SET organization_id = $1 WHERE organization_id IS NULL', [orgs[0].id]);
        }

        // UNIQUE constraint auf (organization_id, key) setzen
        // Zuerst alten UNIQUE constraint auf key entfernen falls vorhanden
        await db.query(`
          DO $$ BEGIN
            ALTER TABLE settings DROP CONSTRAINT IF EXISTS settings_key_key;
            ALTER TABLE settings DROP CONSTRAINT IF EXISTS settings_pkey;
          EXCEPTION WHEN OTHERS THEN NULL;
          END $$;
        `);
        await db.query('ALTER TABLE settings ADD CONSTRAINT settings_org_key_unique UNIQUE (organization_id, key)');

        console.log('Settings table migration complete');
      }
    } catch (err) {
      console.error('Settings migration error:', err.message);
    }
  };

  // Migration beim Laden ausführen
  ensureOrgColumn();

  // GET settings (alle authentifizierten User der eigenen Org)
  router.get('/', rbacVerifier, async (req, res) => {
    try {
      const orgFilter = req.user.is_super_admin ? '' : 'WHERE organization_id = $1';
      const params = req.user.is_super_admin ? [] : [req.user.organization_id];

      const { rows } = await db.query(
        `SELECT key, value FROM settings ${orgFilter}`,
        params
      );

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
      res.status(500).json({ error: 'Datenbankfehler' });
    }
  });

  // PUT settings (nur org_admin der eigenen Org)
  router.put('/', rbacVerifier, requireOrgAdmin, async (req, res) => {
    try {
      const orgId = req.user.organization_id;
      const {
        target_gottesdienst,
        target_gemeinde,
        konfi_chat_permissions,
        waitlist_enabled,
        max_waitlist_size
      } = req.body;

      if (target_gottesdienst !== undefined) {
        await db.query(
          `INSERT INTO settings (organization_id, key, value) VALUES ($1, 'target_gottesdienst', $2)
           ON CONFLICT (organization_id, key) DO UPDATE SET value = EXCLUDED.value`,
          [orgId, target_gottesdienst]
        );
      }

      if (target_gemeinde !== undefined) {
        await db.query(
          `INSERT INTO settings (organization_id, key, value) VALUES ($1, 'target_gemeinde', $2)
           ON CONFLICT (organization_id, key) DO UPDATE SET value = EXCLUDED.value`,
          [orgId, target_gemeinde]
        );
      }

      if (konfi_chat_permissions !== undefined) {
        const validPermissions = [
          'direct_only_admin',
          'direct_only_all',
          'group_direct_admin',
          'group_direct_all'
        ];
        if (!validPermissions.includes(konfi_chat_permissions)) {
          return res.status(400).json({
            error: 'Ungültiger Chat-Berechtigungswert. Gültige Optionen: ' + validPermissions.join(', ')
          });
        }
        await db.query(
          `INSERT INTO settings (organization_id, key, value) VALUES ($1, 'konfi_chat_permissions', $2)
           ON CONFLICT (organization_id, key) DO UPDATE SET value = EXCLUDED.value`,
          [orgId, konfi_chat_permissions]
        );
      }

      if (waitlist_enabled !== undefined) {
        await db.query(
          `INSERT INTO settings (organization_id, key, value) VALUES ($1, 'waitlist_enabled', $2)
           ON CONFLICT (organization_id, key) DO UPDATE SET value = EXCLUDED.value`,
          [orgId, String(waitlist_enabled)]
        );
      }

      if (max_waitlist_size !== undefined) {
        await db.query(
          `INSERT INTO settings (organization_id, key, value) VALUES ($1, 'max_waitlist_size', $2)
           ON CONFLICT (organization_id, key) DO UPDATE SET value = EXCLUDED.value`,
          [orgId, max_waitlist_size]
        );
      }

      res.json({ message: 'Einstellungen erfolgreich aktualisiert' });

    } catch (err) {
      console.error('Database error in PUT /settings:', err);
      res.status(500).json({ error: 'Datenbankfehler' });
    }
  });

  return router;
};
