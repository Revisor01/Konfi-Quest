const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();
const { checkUserHierarchy, filterUsersByHierarchy } = require('../utils/roleHierarchy');

// User management routes
module.exports = (db, rbacVerifier, checkPermission) => {
  
  // Hierarchie-Middleware mit DB-Zugriff
  const userHierarchyMiddleware = (operation) => {
    return (req, res, next) => {
      req.db = db; // DB-Instanz für Hierarchie-Check verfügbar machen
      return checkUserHierarchy(operation)(req, res, next);
    };
  };
  
  // Get users in current organization
  router.get('/', rbacVerifier, checkPermission('admin.users.view'), (req, res) => {
    const organizationId = req.user.organization_id;
    
    const query = `
      SELECT u.id, u.username, u.email, u.display_name, u.is_active, 
             u.last_login_at, u.created_at, u.updated_at,
             r.name as role_name, r.display_name as role_display_name,
             COUNT(DISTINCT uja.jahrgang_id) as assigned_jahrgaenge_count
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      LEFT JOIN user_jahrgang_assignments uja ON u.id = uja.user_id
      WHERE u.organization_id = ?
      GROUP BY u.id
      ORDER BY u.created_at DESC
    `;
    
    db.all(query, [organizationId], (err, rows) => {
      if (err) {
        console.error('Error fetching users:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      // Markiere Users als editierbar basierend auf Hierarchie statt sie zu filtern
      const usersWithEditability = rows.map(user => ({
        ...user,
        can_edit: filterUsersByHierarchy([user], req.user.role_name).length > 0
      }));
      res.json(usersWithEditability);
    });
  });

  // Get single user with details
  router.get('/:id', rbacVerifier, checkPermission('admin.users.view'), userHierarchyMiddleware('view'), (req, res) => {
    const { id } = req.params;
    const organizationId = req.user.organization_id;
    
    const query = `
      SELECT u.id, u.username, u.email, u.display_name, u.is_active, 
             u.last_login_at, u.created_at, u.updated_at,
             r.id as role_id, r.name as role_name, r.display_name as role_display_name
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.id = ? AND u.organization_id = ?
    `;
    
    db.get(query, [id, organizationId], (err, user) => {
      if (err) {
        console.error('Error fetching user:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      
      // Get assigned jahrgaenge - check both user_jahrgang_assignments and konfi_profiles
      const jahrgaengeQuery = `
        SELECT j.id, j.name, 
               COALESCE(uja.can_view, 1) as can_view, 
               COALESCE(uja.can_edit, 1) as can_edit, 
               COALESCE(uja.assigned_at, u.created_at) as assigned_at,
               COALESCE(assigner.display_name, 'System') as assigned_by_name,
               CASE WHEN kp.jahrgang_id IS NOT NULL THEN 'konfi_profile' ELSE 'user_assignment' END as source_type
        FROM jahrgaenge j
        LEFT JOIN user_jahrgang_assignments uja ON uja.jahrgang_id = j.id AND uja.user_id = ?
        LEFT JOIN konfi_profiles kp ON kp.jahrgang_id = j.id AND kp.user_id = ?
        LEFT JOIN users assigner ON uja.assigned_by = assigner.id
        LEFT JOIN users u ON u.id = ?
        WHERE (uja.user_id = ? OR kp.user_id = ?) 
        ORDER BY j.name
      `;
      
      db.all(jahrgaengeQuery, [id, id, id, id, id], (err, jahrgaenge) => {
        if (err) {
          console.error('Error fetching user jahrgaenge:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        
        res.json({
          ...user,
          assigned_jahrgaenge: jahrgaenge
        });
      });
    });
  });

  // Create new user
  router.post('/', rbacVerifier, checkPermission('admin.users.create'), userHierarchyMiddleware('create'), (req, res) => {
    const organizationId = req.user.organization_id;
    const {
      username,
      email,
      display_name,
      password,
      role_id
    } = req.body;
    
    if (!username || !display_name || !password || !role_id) {
      return res.status(400).json({ error: 'Username, display_name, password, and role_id are required' });
    }
    
    // Verify role exists in organization
    db.get("SELECT id FROM roles WHERE id = ? AND organization_id = ?", [role_id, organizationId], (err, role) => {
      if (err) {
        console.error('Error checking role:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!role) {
        return res.status(400).json({ error: 'Invalid role for this organization' });
      }
      
      // Hash password
      const passwordHash = bcrypt.hashSync(password, 10);
      
      db.run(`INSERT INTO users (
        organization_id, username, email, display_name, password_hash, role_id
      ) VALUES (?, ?, ?, ?, ?, ?)`, 
        [organizationId, username, email, display_name, passwordHash, role_id], 
        function(err) {
          if (err) {
            if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
              return res.status(409).json({ error: 'Username or email already exists in this organization' });
            }
            console.error('Error creating user:', err);
            return res.status(500).json({ error: 'Database error' });
          }
          
          res.json({ 
            id: this.lastID, 
            message: 'User created successfully',
            username,
            display_name
          });
        }
      );
    });
  });

  // Update user
  router.put('/:id', rbacVerifier, checkPermission('admin.users.edit'), userHierarchyMiddleware('update'), (req, res) => {
    const { id } = req.params;
    const organizationId = req.user.organization_id;
    const {
      username,
      email,
      display_name,
      role_id,
      is_active,
      password
    } = req.body;
    
    // Check if user exists in organization
    db.get("SELECT id FROM users WHERE id = ? AND organization_id = ?", [id, organizationId], (err, user) => {
      if (err) {
        console.error('Error checking user:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!user) {
        return res.status(404).json({ error: 'User not found in this organization' });
      }
      
      // Verify role exists in organization if role_id is provided
      if (role_id) {
        db.get("SELECT id FROM roles WHERE id = ? AND organization_id = ?", [role_id, organizationId], (err, role) => {
          if (err) {
            console.error('Error checking role:', err);
            return res.status(500).json({ error: 'Database error' });
          }
          
          if (!role) {
            return res.status(400).json({ error: 'Invalid role for this organization' });
          }
          
          updateUser();
        });
      } else {
        updateUser();
      }
      
      function updateUser() {
        let updateQuery = `UPDATE users SET `;
        let updateParams = [];
        let updateFields = [];
        
        if (username !== undefined) {
          updateFields.push('username = ?');
          updateParams.push(username);
        }
        
        if (email !== undefined) {
          updateFields.push('email = ?');
          updateParams.push(email);
        }
        
        if (display_name !== undefined) {
          updateFields.push('display_name = ?');
          updateParams.push(display_name);
        }
        
        if (role_id !== undefined) {
          updateFields.push('role_id = ?');
          updateParams.push(role_id);
        }
        
        if (is_active !== undefined) {
          updateFields.push('is_active = ?');
          updateParams.push(is_active);
        }
        
        if (password) {
          updateFields.push('password_hash = ?');
          updateParams.push(bcrypt.hashSync(password, 10));
        }
        
        updateFields.push('updated_at = CURRENT_TIMESTAMP');
        updateQuery += updateFields.join(', ') + ' WHERE id = ? AND organization_id = ?';
        updateParams.push(id, organizationId);
        
        db.run(updateQuery, updateParams, function(err) {
          if (err) {
            if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
              return res.status(409).json({ error: 'Username or email already exists in this organization' });
            }
            console.error('Error updating user:', err);
            return res.status(500).json({ error: 'Database error' });
          }
          
          if (this.changes === 0) {
            return res.status(404).json({ error: 'User not found' });
          }
          
          res.json({ message: 'User updated successfully' });
        });
      }
    });
  });

  // Delete user
  router.delete('/:id', rbacVerifier, checkPermission('admin.users.delete'), userHierarchyMiddleware('delete'), (req, res) => {
    const { id } = req.params;
    const organizationId = req.user.organization_id;
    
    // Prevent self-deletion
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }
    
    db.serialize(() => {
      db.run("BEGIN TRANSACTION");
      
      // Delete user jahrgang assignments
      db.run("DELETE FROM user_jahrgang_assignments WHERE user_id = ?", [id]);
      
      // Delete user
      db.run("DELETE FROM users WHERE id = ? AND organization_id = ?", [id, organizationId], function(err) {
        if (err) {
          console.error('Error deleting user:', err);
          db.run("ROLLBACK");
          return res.status(500).json({ error: 'Database error' });
        }
        
        if (this.changes === 0) {
          db.run("ROLLBACK");
          return res.status(404).json({ error: 'User not found in this organization' });
        }
        
        db.run("COMMIT", (err) => {
          if (err) {
            console.error('Error committing transaction:', err);
            return res.status(500).json({ error: 'Database error' });
          }
          res.json({ message: 'User deleted successfully' });
        });
      });
    });
  });

  // Assign jahrgaenge to user
  router.post('/:id/jahrgaenge', rbacVerifier, checkPermission('admin.jahrgaenge.assign'), (req, res) => {
    const { id } = req.params;
    const organizationId = req.user.organization_id;
    const { jahrgang_assignments } = req.body; // [{ jahrgang_id, can_view, can_edit }]
    
    if (!Array.isArray(jahrgang_assignments)) {
      return res.status(400).json({ error: 'jahrgang_assignments must be an array' });
    }
    
    // Check if user exists in organization
    db.get("SELECT id FROM users WHERE id = ? AND organization_id = ?", [id, organizationId], (err, user) => {
      if (err) {
        console.error('Error checking user:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!user) {
        return res.status(404).json({ error: 'User not found in this organization' });
      }
      
      db.serialize(() => {
        db.run("BEGIN TRANSACTION");
        
        // Delete existing assignments
        db.run("DELETE FROM user_jahrgang_assignments WHERE user_id = ?", [id]);
        
        if (jahrgang_assignments.length === 0) {
          db.run("COMMIT", (err) => {
            if (err) {
              console.error('Error committing transaction:', err);
              return res.status(500).json({ error: 'Database error' });
            }
            res.json({ message: 'All jahrgang assignments removed successfully' });
          });
          return;
        }
        
        let completed = 0;
        let hasError = false;
        
        jahrgang_assignments.forEach(assignment => {
          const { jahrgang_id, can_view = true, can_edit = false } = assignment;
          
          // Verify jahrgang exists in organization
          db.get("SELECT id FROM jahrgaenge WHERE id = ? AND organization_id = ?", [jahrgang_id, organizationId], (err, jahrgang) => {
            if (err || !jahrgang) {
              hasError = true;
              return;
            }
            
            db.run(`INSERT INTO user_jahrgang_assignments 
                    (user_id, jahrgang_id, can_view, can_edit, assigned_by) 
                    VALUES (?, ?, ?, ?, ?)`,
              [id, jahrgang_id, can_view, can_edit, req.user.id], (err) => {
                if (err) {
                  hasError = true;
                  return;
                }
                
                completed++;
                if (completed === jahrgang_assignments.length) {
                  if (hasError) {
                    db.run("ROLLBACK");
                    return res.status(500).json({ error: 'Error assigning some jahrgaenge' });
                  } else {
                    db.run("COMMIT", (err) => {
                      if (err) {
                        console.error('Error committing transaction:', err);
                        return res.status(500).json({ error: 'Database error' });
                      }
                      res.json({ 
                        message: 'Jahrgang assignments updated successfully',
                        assignments_count: jahrgang_assignments.length
                      });
                    });
                  }
                }
              }
            );
          });
        });
      });
    });
  });

  // Get user's jahrgang assignments
  router.get('/:id/jahrgaenge', rbacVerifier, checkPermission('admin.users.view'), (req, res) => {
    const { id } = req.params;
    const organizationId = req.user.organization_id;
    
    const query = `
      SELECT j.id, j.name, uja.can_view, uja.can_edit, uja.assigned_at,
             assigner.display_name as assigned_by_name
      FROM user_jahrgang_assignments uja
      JOIN jahrgaenge j ON uja.jahrgang_id = j.id
      LEFT JOIN users assigner ON uja.assigned_by = assigner.id
      WHERE uja.user_id = ? AND j.organization_id = ?
      ORDER BY j.name
    `;
    
    db.all(query, [id, organizationId], (err, rows) => {
      if (err) {
        console.error('Error fetching user jahrgaenge:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(rows);
    });
  });

  // Check user permissions
  router.get('/:id/permissions', rbacVerifier, (req, res) => {
    const { id } = req.params;
    const organizationId = req.user.organization_id;
    
    // Users can only check their own permissions unless they have admin.users.view permission
    if (parseInt(id) !== req.user.id && !req.user.permissions.includes('admin.users.view')) {
      return res.status(403).json({ error: 'Can only check your own permissions' });
    }
    
    const query = `
      SELECT p.name as permission_name, p.display_name, p.description, p.module
      FROM users u
      JOIN roles r ON u.role_id = r.id
      JOIN role_permissions rp ON r.id = rp.role_id
      JOIN permissions p ON rp.permission_id = p.id
      WHERE u.id = ? AND u.organization_id = ? AND rp.granted = 1
      ORDER BY p.module, p.name
    `;
    
    db.all(query, [id, organizationId], (err, rows) => {
      if (err) {
        console.error('Error fetching user permissions:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(rows);
    });
  });

  // Get current user's assigned jahrgaenge
  router.get('/me/jahrgaenge', rbacVerifier, (req, res) => {
    const userId = req.user.id;
    
    const query = `
      SELECT uja.jahrgang_id, uja.can_view, uja.can_edit, uja.assigned_at,
             j.name as jahrgang_name, j.confirmation_date
      FROM user_jahrgang_assignments uja
      JOIN jahrgaenge j ON uja.jahrgang_id = j.id
      WHERE uja.user_id = ? AND j.organization_id = ?
      ORDER BY j.name DESC
    `;
    
    db.all(query, [userId, req.user.organization_id], (err, rows) => {
      if (err) {
        console.error('Error fetching current user jahrgaenge:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(rows);
    });
  });

  return router;
};