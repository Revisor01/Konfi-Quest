const express = require('express');
const router = express.Router();

// Organizations routes
module.exports = (db, rbacVerifier, checkPermission) => {
  
  // Get all organizations (super admin only)
  router.get('/', rbacVerifier, checkPermission('admin.organizations.view'), (req, res) => {
    const query = `
      SELECT o.*, 
             COUNT(DISTINCT u.id) as user_count,
             COUNT(DISTINCT k.id) as konfi_count
      FROM organizations o
      LEFT JOIN users u ON o.id = u.organization_id AND u.is_active = 1
      LEFT JOIN konfis k ON o.id = k.organization_id
      GROUP BY o.id
      ORDER BY o.created_at DESC
    `;
    
    db.all(query, (err, rows) => {
      if (err) {
        console.error('Error fetching organizations:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(rows);
    });
  });

  // Get single organization by ID
  router.get('/:id', rbacVerifier, checkPermission('admin.organizations.view'), (req, res) => {
    const { id } = req.params;
    
    // Check if user can view this organization
    if (req.user.organization_id !== parseInt(id) && !req.user.is_super_admin) {
      return res.status(403).json({ error: 'Can only view your own organization' });
    }
    
    const query = `
      SELECT o.*, 
             COUNT(DISTINCT u.id) as user_count,
             COUNT(DISTINCT k.id) as konfi_count,
             COUNT(DISTINCT j.id) as jahrgang_count,
             COUNT(DISTINCT a.id) as activity_count,
             COUNT(DISTINCT e.id) as event_count,
             COUNT(DISTINCT cb.id) as badge_count
      FROM organizations o
      LEFT JOIN users u ON o.id = u.organization_id AND u.is_active = 1
      LEFT JOIN konfis k ON o.id = k.organization_id
      LEFT JOIN jahrgaenge j ON o.id = j.organization_id
      LEFT JOIN activities a ON o.id = a.organization_id
      LEFT JOIN events e ON o.id = e.organization_id
      LEFT JOIN custom_badges cb ON o.id = cb.organization_id
      WHERE o.id = ?
      GROUP BY o.id
    `;
    
    db.get(query, [id], (err, row) => {
      if (err) {
        console.error('Error fetching organization:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!row) {
        return res.status(404).json({ error: 'Organization not found' });
      }
      
      res.json(row);
    });
  });

  // Get current organization details
  router.get('/current', rbacVerifier, (req, res) => {
    const organizationId = req.user.organization_id;
    
    const query = `
      SELECT o.*, 
             COUNT(DISTINCT u.id) as user_count,
             COUNT(DISTINCT k.id) as konfi_count,
             COUNT(DISTINCT j.id) as jahrgang_count,
             COUNT(DISTINCT a.id) as activity_count,
             COUNT(DISTINCT e.id) as event_count,
             COUNT(DISTINCT cb.id) as badge_count
      FROM organizations o
      LEFT JOIN users u ON o.id = u.organization_id AND u.is_active = 1
      LEFT JOIN konfis k ON o.id = k.organization_id
      LEFT JOIN jahrgaenge j ON o.id = j.organization_id
      LEFT JOIN activities a ON o.id = a.organization_id
      LEFT JOIN events e ON o.id = e.organization_id
      LEFT JOIN custom_badges cb ON o.id = cb.organization_id
      WHERE o.id = ?
      GROUP BY o.id
    `;
    
    db.get(query, [organizationId], (err, row) => {
      if (err) {
        console.error('Error fetching organization:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!row) {
        return res.status(404).json({ error: 'Organization not found' });
      }
      
      res.json(row);
    });
  });

  // Create new organization (super admin only)
  router.post('/', rbacVerifier, checkPermission('admin.organizations.create'), (req, res) => {
    const {
      name,
      slug,
      display_name,
      description,
      contact_email,
      contact_phone,
      address,
      website_url,
      admin_username,
      admin_password,
      admin_display_name
    } = req.body;
    
    if (!name || !slug || !display_name) {
      return res.status(400).json({ error: 'Name, slug, and display_name are required' });
    }
    
    if (!admin_username || !admin_password || !admin_display_name) {
      return res.status(400).json({ error: 'Admin username, password, and display name are required' });
    }
    
    db.run(`INSERT INTO organizations (
      name, slug, display_name, description, contact_email, 
      contact_phone, address, website_url
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, 
      [name, slug, display_name, description, contact_email, contact_phone, address, website_url], 
      function(err) {
        if (err) {
          if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(409).json({ error: 'Organization slug already exists' });
          }
          console.error('Error creating organization:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        
        const organizationId = this.lastID;
        
        // Create default roles for the organization
        const defaultRoles = [
          { name: 'admin', display_name: 'Hauptamt', description: 'Vollzugriff auf alle Funktionen', is_system_role: 1 },
          { name: 'teamer', display_name: 'Teamer:in', description: 'Kann Anträge bearbeiten und zugewiesene Jahrgänge verwalten', is_system_role: 1 }
        ];
        
        let rolesCreated = 0;
        let adminRoleId = null;
        
        defaultRoles.forEach(role => {
          db.run(`INSERT INTO roles (organization_id, name, display_name, description, is_system_role) 
                  VALUES (?, ?, ?, ?, ?)`,
            [organizationId, role.name, role.display_name, role.description, role.is_system_role],
            function(err) {
              if (err) {
                console.error('Error creating default role:', err);
                return;
              }
              
              if (role.name === 'admin') {
                adminRoleId = this.lastID;
              }
              
              rolesCreated++;
              if (rolesCreated === defaultRoles.length) {
                createAdminUser();
              }
            }
          );
        });
        
        function createAdminUser() {
          const bcrypt = require('bcrypt');
          const saltRounds = 10;
          
          bcrypt.hash(admin_password, saltRounds, (err, hashedPassword) => {
            if (err) {
              console.error('Error hashing password:', err);
              return res.status(500).json({ error: 'Failed to create admin user' });
            }
            
            db.run(`INSERT INTO users (organization_id, role_id, username, email, password_hash, display_name, is_active) 
                    VALUES (?, ?, ?, ?, ?, ?, 1)`,
              [organizationId, adminRoleId, admin_username, contact_email, hashedPassword, admin_display_name],
              function(err) {
                if (err) {
                  console.error('Error creating admin user:', err);
                  return res.status(500).json({ error: 'Organization created but failed to create admin user' });
                }
                
                res.json({ 
                  id: organizationId, 
                  admin_user_id: this.lastID,
                  message: 'Organization created successfully with default roles and admin user' 
                });
              }
            );
          });
        }
      }
    );
  });

  // Update organization
  router.put('/:id', rbacVerifier, checkPermission('admin.organizations.edit'), (req, res) => {
    const { id } = req.params;
    const {
      name,
      slug,
      display_name,
      description,
      contact_email,
      contact_phone,
      address,
      website_url,
      is_active
    } = req.body;
    
    // Check if user can edit this organization
    if (req.user.organization_id !== parseInt(id) && !req.user.is_super_admin) {
      return res.status(403).json({ error: 'Can only edit your own organization' });
    }
    
    db.run(`UPDATE organizations SET 
      name = ?, slug = ?, display_name = ?, description = ?, 
      contact_email = ?, contact_phone = ?, address = ?, 
      website_url = ?, is_active = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`, 
      [name, slug, display_name, description, contact_email, contact_phone, 
       address, website_url, is_active, id], 
      function(err) {
        if (err) {
          if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(409).json({ error: 'Organization slug already exists' });
          }
          console.error('Error updating organization:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        
        if (this.changes === 0) {
          return res.status(404).json({ error: 'Organization not found' });
        }
        
        res.json({ message: 'Organization updated successfully' });
      }
    );
  });

  // Delete organization (super admin only)
  router.delete('/:id', rbacVerifier, checkPermission('admin.organizations.delete'), (req, res) => {
    const { id } = req.params;
    
    db.serialize(() => {
      db.run("BEGIN TRANSACTION");
      
      // Check if organization has any data
      db.get("SELECT COUNT(*) as count FROM konfis WHERE organization_id = ?", [id], (err, result) => {
        if (err) {
          db.run("ROLLBACK");
          return res.status(500).json({ error: 'Database error' });
        }
        
        if (result.count > 0) {
          db.run("ROLLBACK");
          return res.status(409).json({ 
            error: 'Cannot delete organization with existing konfis. Please transfer or delete all data first.' 
          });
        }
        
        // Delete organization and cascade
        db.run("DELETE FROM organizations WHERE id = ?", [id], function(err) {
          if (err) {
            console.error('Error deleting organization:', err);
            db.run("ROLLBACK");
            return res.status(500).json({ error: 'Database error' });
          }
          
          if (this.changes === 0) {
            db.run("ROLLBACK");
            return res.status(404).json({ error: 'Organization not found' });
          }
          
          db.run("COMMIT", (err) => {
            if (err) {
              console.error('Error committing transaction:', err);
              return res.status(500).json({ error: 'Database error' });
            }
            res.json({ message: 'Organization deleted successfully' });
          });
        });
      });
    });
  });

  // Get organization users
  router.get('/:id/users', rbacVerifier, checkPermission('admin.users.view'), (req, res) => {
    const { id } = req.params;
    
    // Check if user can view this organization's users
    if (req.user.organization_id !== parseInt(id) && !req.user.is_super_admin) {
      return res.status(403).json({ error: 'Can only view users in your own organization' });
    }
    
    const query = `
      SELECT u.id, u.username, u.email, u.display_name, u.is_active, 
             u.last_login_at, u.created_at,
             r.name as role_name, r.display_name as role_display_name,
             COUNT(DISTINCT uja.jahrgang_id) as assigned_jahrgaenge_count
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      LEFT JOIN user_jahrgang_assignments uja ON u.id = uja.user_id
      WHERE u.organization_id = ?
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `;
    
    db.all(query, [id], (err, rows) => {
      if (err) {
        console.error('Error fetching organization users:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(rows);
    });
  });

  // Get organization statistics
  router.get('/:id/stats', rbacVerifier, (req, res) => {
    const { id } = req.params;
    
    // Check if user can view this organization's stats
    if (req.user.organization_id !== parseInt(id) && !req.user.is_super_admin) {
      return res.status(403).json({ error: 'Can only view stats for your own organization' });
    }
    
    const statsQueries = {
      konfis: "SELECT COUNT(*) as count FROM konfis WHERE organization_id = ?",
      activities: "SELECT COUNT(*) as count FROM activities WHERE organization_id = ?",
      events: "SELECT COUNT(*) as count FROM events WHERE organization_id = ?",
      badges: "SELECT COUNT(*) as count FROM custom_badges WHERE organization_id = ?",
      requests: "SELECT COUNT(*) as count FROM activity_requests ar JOIN konfis k ON ar.konfi_id = k.id WHERE k.organization_id = ?",
      pending_requests: "SELECT COUNT(*) as count FROM activity_requests ar JOIN konfis k ON ar.konfi_id = k.id WHERE k.organization_id = ? AND ar.status = 'pending'"
    };
    
    const stats = {};
    let completed = 0;
    const total = Object.keys(statsQueries).length;
    
    Object.entries(statsQueries).forEach(([key, query]) => {
      db.get(query, [id], (err, result) => {
        if (err) {
          console.error(`Error fetching ${key} stats:`, err);
          stats[key] = 0;
        } else {
          stats[key] = result.count;
        }
        
        completed++;
        if (completed === total) {
          res.json(stats);
        }
      });
    });
  });

  return router;
};