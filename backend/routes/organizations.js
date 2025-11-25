const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');

// Organizations routes
// ============================================
// super_admin: Kann ALLE Orgs sehen, erstellen, loeschen
// org_admin: Kann NUR eigene Org sehen und bearbeiten
// ============================================
module.exports = (db, rbacVerifier, { requireSuperAdmin }) => {

  // Get all organizations - NUR super_admin
  router.get('/', rbacVerifier, requireSuperAdmin, async (req, res) => {
    try {
      const query = `
        SELECT o.*, 
               COUNT(DISTINCT CASE WHEN r.name != 'konfi' THEN u.id END) as user_count,
               COUNT(DISTINCT kp.user_id) as konfi_count
        FROM organizations o
        LEFT JOIN users u ON o.id = u.organization_id AND u.is_active = true
        LEFT JOIN roles r ON u.role_id = r.id
        LEFT JOIN konfi_profiles kp ON o.id = kp.organization_id
        GROUP BY o.id
        ORDER BY o.created_at DESC
      `;
      
      const { rows: organizations } = await db.query(query);
      res.json(organizations);
    } catch (err) {
      console.error('Database error in GET /organizations:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // Get single organization by ID
  // super_admin: alle, org_admin: nur eigene
  router.get('/:id', rbacVerifier, async (req, res) => {
    try {
      const { id } = req.params;

      // Zugriffspruefung
      const isSuperAdmin = req.user.role_name === 'super_admin';
      const isOwnOrg = req.user.organization_id === parseInt(id);

      if (!isSuperAdmin && !isOwnOrg) {
        return res.status(403).json({ error: 'Keine Berechtigung' });
      }
      
      const query = `
        SELECT o.*, 
               COUNT(DISTINCT u.id) as user_count,
               COUNT(DISTINCT kp.user_id) as konfi_count,
               COUNT(DISTINCT j.id) as jahrgang_count,
               COUNT(DISTINCT a.id) as activity_count,
               COUNT(DISTINCT e.id) as event_count,
               COUNT(DISTINCT cb.id) as badge_count
        FROM organizations o
        LEFT JOIN users u ON o.id = u.organization_id AND u.is_active = true
        LEFT JOIN konfi_profiles kp ON o.id = kp.organization_id
        LEFT JOIN jahrgaenge j ON o.id = j.organization_id
        LEFT JOIN activities a ON o.id = a.organization_id
        LEFT JOIN events e ON o.id = e.organization_id
        LEFT JOIN custom_badges cb ON o.id = cb.organization_id
        WHERE o.id = $1
        GROUP BY o.id
      `;
      
      const { rows: [organization] } = await db.query(query, [id]);
      
      if (!organization) {
        return res.status(404).json({ error: 'Organization not found' });
      }
      
      res.json(organization);
    } catch (err) {
      console.error('Database error in GET /organizations/:id:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // Get current organization details
  router.get('/current', rbacVerifier, async (req, res) => {
    try {
      const organizationId = req.user.organization_id;
      
      const query = `
        SELECT o.*, 
               COUNT(DISTINCT u.id) as user_count,
               COUNT(DISTINCT kp.user_id) as konfi_count,
               COUNT(DISTINCT j.id) as jahrgang_count,
               COUNT(DISTINCT a.id) as activity_count,
               COUNT(DISTINCT e.id) as event_count,
               COUNT(DISTINCT cb.id) as badge_count
        FROM organizations o
        LEFT JOIN users u ON o.id = u.organization_id AND u.is_active = true
        LEFT JOIN konfi_profiles kp ON o.id = kp.organization_id
        LEFT JOIN jahrgaenge j ON o.id = j.organization_id
        LEFT JOIN activities a ON o.id = a.organization_id
        LEFT JOIN events e ON o.id = e.organization_id
        LEFT JOIN custom_badges cb ON o.id = cb.organization_id
        WHERE o.id = $1
        GROUP BY o.id
      `;
      
      const { rows: [organization] } = await db.query(query, [organizationId]);
      
      if (!organization) {
        return res.status(404).json({ error: 'Organization not found' });
      }
      
      res.json(organization);
    } catch (err) {
      console.error('Database error in GET /organizations/current:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // Create new organization (super admin only)
  router.post('/', rbacVerifier, requireSuperAdmin, async (req, res) => {
    try {
      const {
        name, slug, display_name, description, contact_email, 
        contact_phone, address, website_url, admin_username,
        admin_password, admin_display_name
      } = req.body;
      
      if (!name || !slug || !display_name) {
        return res.status(400).json({ error: 'Name, slug, and display_name are required' });
      }
      
      if (!admin_username || !admin_password || !admin_display_name) {
        return res.status(400).json({ error: 'Admin username, password, and display name are required' });
      }
      
      // 1. Create Organization
      const orgQuery = `INSERT INTO organizations (
        name, slug, display_name, description, contact_email, 
        contact_phone, address, website_url
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`;
      
      const { rows: [newOrg] } = await db.query(orgQuery, [
        name, slug, display_name, description, contact_email, contact_phone, address, website_url
      ]);
      const organizationId = newOrg.id;
        
      // 2. Create default roles for the organization
      const defaultRoles = [
        { name: 'org_admin', display_name: 'Organisations-Admin', description: 'Vollzugriff auf alle Jahrgänge der Organisation', is_system_role: true },
        { name: 'admin', display_name: 'Hauptamt', description: 'Vollzugriff mit Jahrgangs-Beschränkungen', is_system_role: true },
        { name: 'teamer', display_name: 'Teamer:in', description: 'Kann Anträge bearbeiten und zugewiesene Jahrgänge verwalten', is_system_role: true }
      ];
      
      let orgAdminRoleId = null;
      const roleQuery = `INSERT INTO roles (organization_id, name, display_name, description, is_system_role) 
                         VALUES ($1, $2, $3, $4, $5) RETURNING id`;
      
      for (const role of defaultRoles) {
          const { rows: [newRole] } = await db.query(roleQuery, [
              organizationId, role.name, role.display_name, role.description, role.is_system_role
          ]);
          if (role.name === 'org_admin') {
              orgAdminRoleId = newRole.id;
          }
      }
      
      // 3. Create the admin user for the organization
      const saltRounds = 10;
      const hashedPassword = await bcrypt.hash(admin_password, saltRounds);
      
      const userQuery = `INSERT INTO users (organization_id, role_id, username, email, password_hash, display_name, is_active) 
                         VALUES ($1, $2, $3, $4, $5, $6, true) RETURNING id`;
      const { rows: [newAdmin] } = await db.query(userQuery, [
        organizationId, orgAdminRoleId, admin_username, contact_email, hashedPassword, admin_display_name
      ]);

      // 4. Create default badges for the organization
      const defaultBadges = [
        { name: "Erster Schritt", icon: "👶", description: "Herzlich willkommen! Du hast deine ersten Punkte gesammelt.", criteria_type: "total_points", criteria_value: 1 },
        { name: "Auf dem Weg", icon: "🚶", description: "Du sammelst fleißig Punkte!", criteria_type: "total_points", criteria_value: 5 },
        { name: "Fleißiger Sammler", icon: "🎯", description: "10 Punkte gesammelt - super gemacht!", criteria_type: "total_points", criteria_value: 10 },
        { name: "Punktesammler", icon: "💎", description: "15 Punkte erreicht - du bist auf einem guten Weg!", criteria_type: "total_points", criteria_value: 15 },
        { name: "Punkteprofi", icon: "🏆", description: "20 Punkte geschafft - großartig!", criteria_type: "total_points", criteria_value: 20 },
        { name: "Punktemeister", icon: "👑", description: "25 Punkte erreicht - du bist spitze!", criteria_type: "total_points", criteria_value: 25 },
        { name: "Gottesdienst-Neuling", icon: "⛪", description: "Du warst zum ersten Mal im Gottesdienst - toll!", criteria_type: "gottesdienst_points", criteria_value: 1 },
        { name: "Gottesdienst-Fan", icon: "📖", description: "5 Gottesdienst-Punkte gesammelt!", criteria_type: "gottesdienst_points", criteria_value: 5 },
        { name: "Gottesdienst-Profi", icon: "✨", description: "10 Gottesdienst-Punkte erreicht!", criteria_type: "gottesdienst_points", criteria_value: 10 },
        { name: "Gottesdienst-Experte", icon: "🙏", description: "15 Gottesdienst-Punkte geschafft!", criteria_type: "gottesdienst_points", criteria_value: 15 },
        { name: "Gemeinde-Neuling", icon: "🤝", description: "Du hast dich zum ersten Mal in der Gemeinde engagiert!", criteria_type: "gemeinde_points", criteria_value: 1 },
        { name: "Gemeinde-Helfer", icon: "💪", description: "5 Gemeinde-Punkte gesammelt - danke für dein Engagement!", criteria_type: "gemeinde_points", criteria_value: 5 },
        { name: "Gemeinde-Unterstützer", icon: "🌟", description: "10 Gemeinde-Punkte erreicht!", criteria_type: "gemeinde_points", criteria_value: 10 },
        { name: "Gemeinde-Champion", icon: "🎪", description: "15 Gemeinde-Punkte geschafft - du bist eine große Hilfe!", criteria_type: "gemeinde_points", criteria_value: 15 },
        { name: "Ausgewogen", icon: "⚖️", description: "Du sammelst in beiden Bereichen Punkte - sehr gut!", criteria_type: "both_categories", criteria_value: 3 },
        { name: "Harmonisch", icon: "🎵", description: "5 Punkte in beiden Bereichen - perfekte Balance!", criteria_type: "both_categories", criteria_value: 5 },
        { name: "Aktiv dabei", icon: "🏃", description: "Du hast schon 3 verschiedene Aktivitäten gemacht!", criteria_type: "activity_count", criteria_value: 3 },
        { name: "Vielfalts-Fan", icon: "🌈", description: "5 Aktivitäten absolviert - du probierst gerne Neues!", criteria_type: "activity_count", criteria_value: 5 },
        { name: "Aktivitäts-Sammler", icon: "📊", description: "10 Aktivitäten geschafft - beeindruckend!", criteria_type: "activity_count", criteria_value: 10 },
        { name: "Bonuspunkte-Gewinner", icon: "💰", description: "Du hast Bonuspunkte erhalten - weiter so!", criteria_type: "bonus_points", criteria_value: 1 }
      ];

      const badgeQuery = `INSERT INTO custom_badges (
        organization_id, name, icon, description, criteria_type, criteria_value, 
        is_active, is_hidden, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, true, false, $7)`;

      for (const badge of defaultBadges) {
        await db.query(badgeQuery, [
          organizationId, badge.name, badge.icon, badge.description,
          badge.criteria_type, badge.criteria_value, newAdmin.id
        ]);
      }

      res.status(201).json({ 
        id: organizationId, 
        admin_user_id: newAdmin.id,
        default_badges_created: defaultBadges.length,
        message: `Organization created successfully with default roles, admin user, and ${defaultBadges.length} badges` 
      });

    } catch (err) {
      if (err.code === '23505') { // unique_violation
        return res.status(409).json({ error: 'Organization slug already exists' });
      }
      console.error('Error creating organization:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // Update organization
  // super_admin: alle, org_admin: nur eigene
  router.put('/:id', rbacVerifier, async (req, res) => {
    try {
      const { id } = req.params;
      const {
        name, slug, display_name, description, contact_email,
        contact_phone, address, website_url, is_active
      } = req.body;

      // Zugriffspruefung
      const isSuperAdmin = req.user.role_name === 'super_admin';
      const isOwnOrg = req.user.organization_id === parseInt(id) && req.user.role_name === 'org_admin';

      if (!isSuperAdmin && !isOwnOrg) {
        return res.status(403).json({ error: 'Keine Berechtigung' });
      }
      
      const query = `UPDATE organizations SET 
        name = $1, slug = $2, display_name = $3, description = $4, 
        contact_email = $5, contact_phone = $6, address = $7, 
        website_url = $8, is_active = $9, updated_at = NOW()
        WHERE id = $10`;
      
      const { rowCount } = await db.query(query, [
        name, slug, display_name, description, contact_email, contact_phone, 
        address, website_url, is_active, id
      ]);
        
      if (rowCount === 0) {
        return res.status(404).json({ error: 'Organization not found' });
      }
        
      res.json({ message: 'Organization updated successfully' });
    } catch (err) {
      if (err.code === '23505') { // unique_violation
        return res.status(409).json({ error: 'Organization slug already exists' });
      }
      console.error('Error updating organization:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // Delete organization (super admin only)
  router.delete('/:id', rbacVerifier, requireSuperAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      
      // Check if organization has any data (konfis).
      // This is not an atomic transaction but preserves the check logic.
      const checkQuery = "SELECT COUNT(*) as count FROM konfi_profiles WHERE organization_id = $1";
      const { rows: [result] } = await db.query(checkQuery, [id]);
      
      if (parseInt(result.count, 10) > 0) {
        return res.status(409).json({ 
          error: 'Cannot delete organization with existing konfis. Please transfer or delete all data first.' 
        });
      }
      
      // Delete organization. Assumes database schema uses ON DELETE CASCADE for related data.
      const deleteQuery = "DELETE FROM organizations WHERE id = $1";
      const { rowCount } = await db.query(deleteQuery, [id]);
        
      if (rowCount === 0) {
        return res.status(404).json({ error: 'Organization not found' });
      }
        
      res.json({ message: 'Organization deleted successfully' });
    } catch (err) {
      console.error('Error deleting organization:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // Get organization users - org_admin nur fuer eigene Org
  router.get('/:id/users', rbacVerifier, async (req, res) => {
    // Zugriffspruefung: nur eigene Org
    if (req.user.organization_id !== parseInt(req.params.id)) {
      return res.status(403).json({ error: 'Keine Berechtigung' });
    }
    if (req.user.role_name !== 'org_admin') {
      return res.status(403).json({ error: 'Nur fuer Organisations-Admins' });
    }
    try {
      const { id } = req.params;

      const query = `
        SELECT u.id, u.username, u.email, u.display_name, u.is_active, 
               u.last_login_at, u.created_at,
               r.name as role_name, r.display_name as role_display_name,
               COUNT(DISTINCT uja.jahrgang_id) as assigned_jahrgaenge_count
        FROM users u
        LEFT JOIN roles r ON u.role_id = r.id
        LEFT JOIN user_jahrgang_assignments uja ON u.id = uja.user_id
        WHERE u.organization_id = $1
        GROUP BY u.id, r.name, r.display_name
        ORDER BY u.created_at DESC
      `;
      
      const { rows: users } = await db.query(query, [id]);
      res.json(users);
    } catch (err) {
      console.error('Error fetching organization users:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // Get organization statistics - nur eigene Org
  router.get('/:id/stats', rbacVerifier, async (req, res) => {
    try {
      const { id } = req.params;

      // Zugriffspruefung: nur eigene Org (oder super_admin fuer alle)
      const isSuperAdmin = req.user.role_name === 'super_admin';
      const isOwnOrg = req.user.organization_id === parseInt(id);

      if (!isSuperAdmin && !isOwnOrg) {
        return res.status(403).json({ error: 'Keine Berechtigung' });
      }
      
      const statsQueries = {
        konfis: "SELECT COUNT(*)::int as count FROM konfi_profiles WHERE organization_id = $1",
        activities: "SELECT COUNT(*)::int as count FROM activities WHERE organization_id = $1",
        events: "SELECT COUNT(*)::int as count FROM events WHERE organization_id = $1",
        badges: "SELECT COUNT(*)::int as count FROM custom_badges WHERE organization_id = $1",
        requests: "SELECT COUNT(*)::int as count FROM activity_requests ar JOIN konfi_profiles kp ON ar.konfi_id = kp.user_id WHERE kp.organization_id = $1",
        pending_requests: "SELECT COUNT(*)::int as count FROM activity_requests ar JOIN konfi_profiles kp ON ar.konfi_id = kp.user_id WHERE kp.organization_id = $1 AND ar.status = 'pending'"
      };
      
      // Execute all queries in parallel
      const queryPromises = Object.values(statsQueries).map(query => db.query(query, [id]));
      const results = await Promise.all(queryPromises);
      
      const stats = {};
      const keys = Object.keys(statsQueries);

      results.forEach((result, index) => {
        const key = keys[index];
        stats[key] = result.rows[0]?.count || 0;
      });
      
      res.json(stats);
    } catch (err) {
      console.error('Database error in GET /organizations/:id/stats:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  return router;
};