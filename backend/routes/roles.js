const express = require('express');
const router = express.Router();

// Roles management routes
module.exports = (db, rbacVerifier, checkPermission) => {
  
  // Get all roles in current organization
  router.get('/', rbacVerifier, checkPermission('admin.roles.view'), (req, res) => {
    const organizationId = req.user.organization_id;
    
    const query = `
      SELECT r.id, r.name, r.display_name, r.description, 
             r.is_system_role, r.is_active, r.created_at,
             COUNT(DISTINCT u.id) as user_count,
             COUNT(DISTINCT rp.permission_id) as permission_count
      FROM roles r
      LEFT JOIN users u ON r.id = u.role_id AND u.is_active = 1
      LEFT JOIN role_permissions rp ON r.id = rp.role_id AND rp.granted = 1
      WHERE r.organization_id = ?
      GROUP BY r.id
      ORDER BY r.is_system_role DESC, r.created_at ASC
    `;
    
    db.all(query, [organizationId], (err, rows) => {
      if (err) {
        console.error('Error fetching roles:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(rows);
    });
  });

  // Get single role with permissions
  router.get('/:id', rbacVerifier, checkPermission('admin.roles.view'), (req, res) => {
    const { id } = req.params;
    const organizationId = req.user.organization_id;
    
    const roleQuery = `
      SELECT r.id, r.name, r.display_name, r.description, 
             r.is_system_role, r.is_active, r.created_at,
             COUNT(DISTINCT u.id) as user_count
      FROM roles r
      LEFT JOIN users u ON r.id = u.role_id AND u.is_active = 1
      WHERE r.id = ? AND r.organization_id = ?
      GROUP BY r.id
    `;
    
    db.get(roleQuery, [id, organizationId], (err, role) => {
      if (err) {
        console.error('Error fetching role:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!role) {
        return res.status(404).json({ error: 'Role not found' });
      }
      
      // Get role permissions
      const permissionsQuery = `
        SELECT p.id, p.name, p.display_name, p.description, p.module,
               rp.granted
        FROM permissions p
        LEFT JOIN role_permissions rp ON p.id = rp.permission_id AND rp.role_id = ?
        ORDER BY p.module, p.name
      `;
      
      db.all(permissionsQuery, [id], (err, permissions) => {
        if (err) {
          console.error('Error fetching role permissions:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        
        res.json({
          ...role,
          permissions: permissions
        });
      });
    });
  });

  // Create new role
  router.post('/', rbacVerifier, checkPermission('admin.roles.create'), (req, res) => {
    const organizationId = req.user.organization_id;
    const userRole = req.user.role_name;
    const {
      name,
      display_name,
      description,
      permissions = []
    } = req.body;
    
    if (!name || !display_name) {
      return res.status(400).json({ error: 'Name and display_name are required' });
    }
    
    // Only org_admin can create new roles
    if (userRole !== 'org_admin') {
      return res.status(403).json({ error: 'Only org_admin can create new roles' });
    }
    
    db.run(`INSERT INTO roles (organization_id, name, display_name, description) 
            VALUES (?, ?, ?, ?)`, 
      [organizationId, name, display_name, description], 
      function(err) {
        if (err) {
          if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
            return res.status(409).json({ error: 'Role name already exists in this organization' });
          }
          console.error('Error creating role:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        
        const roleId = this.lastID;
        
        // Add permissions if provided
        if (permissions.length > 0) {
          addPermissionsToRole(roleId, permissions, (err) => {
            if (err) {
              return res.status(500).json({ error: 'Role created but failed to add permissions' });
            }
            res.json({ 
              id: roleId, 
              message: 'Role created successfully with permissions',
              permissions_added: permissions.length
            });
          });
        } else {
          res.json({ 
            id: roleId, 
            message: 'Role created successfully'
          });
        }
      }
    );
  });

  // Update role
  router.put('/:id', rbacVerifier, checkPermission('admin.roles.edit'), (req, res) => {
    const { id } = req.params;
    const organizationId = req.user.organization_id;
    const {
      name,
      display_name,
      description,
      is_active,
      permissions
    } = req.body;
    
    // Check if role exists and can be modified
    db.get("SELECT name, is_system_role FROM roles WHERE id = ? AND organization_id = ?", [id, organizationId], (err, role) => {
      if (err) {
        console.error('Error checking role:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!role) {
        return res.status(404).json({ error: 'Role not found in this organization' });
      }
      
      // Hierarchical role editing permissions
      const userRole = req.user.role_name;
      const roleToEdit = role.name;
      
      // Only konfi role is completely protected
      if (roleToEdit === 'konfi' && (name || display_name || description !== undefined)) {
        return res.status(400).json({ error: 'The konfi role cannot be modified' });
      }
      
      // org_admin can edit all roles except konfi
      if (userRole === 'org_admin' && roleToEdit !== 'konfi') {
        // org_admin can edit everything
      }
      // admin can edit teamer and custom roles, but not admin or org_admin
      else if (userRole === 'admin') {
        if (roleToEdit === 'admin' || roleToEdit === 'org_admin') {
          return res.status(403).json({ error: 'You cannot edit admin or org_admin roles' });
        }
      }
      // teamer cannot edit any roles
      else if (userRole === 'teamer') {
        return res.status(403).json({ error: 'You do not have permission to edit roles' });
      }
      else {
        return res.status(403).json({ error: 'Insufficient permissions to edit this role' });
      }
      
      let updateFields = [];
      let updateParams = [];
      
      // For system roles, only certain fields can be updated based on hierarchy
      const isSystemRole = role.is_system_role;
      const canEditBasicFields = !isSystemRole || (userRole === 'org_admin' && roleToEdit !== 'konfi');
      
      if (name && canEditBasicFields) {
        updateFields.push('name = ?');
        updateParams.push(name);
      }
      
      if (display_name && canEditBasicFields) {
        updateFields.push('display_name = ?');
        updateParams.push(display_name);
      }
      
      if (description !== undefined && canEditBasicFields) {
        updateFields.push('description = ?');
        updateParams.push(description);
      }
      
      if (is_active !== undefined) {
        updateFields.push('is_active = ?');
        updateParams.push(is_active);
      }
      
      if (updateFields.length > 0) {
        updateFields.push('updated_at = CURRENT_TIMESTAMP');
        const updateQuery = `UPDATE roles SET ${updateFields.join(', ')} WHERE id = ? AND organization_id = ?`;
        updateParams.push(id, organizationId);
        
        db.run(updateQuery, updateParams, function(err) {
          if (err) {
            if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
              return res.status(409).json({ error: 'Role name already exists in this organization' });
            }
            console.error('Error updating role:', err);
            return res.status(500).json({ error: 'Database error' });
          }
          
          updatePermissions();
        });
      } else {
        updatePermissions();
      }
      
      function updatePermissions() {
        if (permissions && Array.isArray(permissions)) {
          // Delete existing permissions
          db.run("DELETE FROM role_permissions WHERE role_id = ?", [id], (err) => {
            if (err) {
              console.error('Error deleting role permissions:', err);
              return res.status(500).json({ error: 'Database error' });
            }
            
            // Add new permissions
            addPermissionsToRole(id, permissions, (err) => {
              if (err) {
                return res.status(500).json({ error: 'Role updated but failed to update permissions' });
              }
              res.json({ 
                message: 'Role updated successfully',
                permissions_updated: permissions.length
              });
            });
          });
        } else {
          res.json({ message: 'Role updated successfully' });
        }
      }
    });
  });

  // Delete role
  router.delete('/:id', rbacVerifier, checkPermission('admin.roles.delete'), (req, res) => {
    const { id } = req.params;
    const organizationId = req.user.organization_id;
    const userRole = req.user.role_name;
    
    // Check if role can be deleted
    db.get(`SELECT r.name, r.is_system_role, COUNT(u.id) as user_count 
            FROM roles r 
            LEFT JOIN users u ON r.id = u.role_id 
            WHERE r.id = ? AND r.organization_id = ?`, [id, organizationId], (err, role) => {
      if (err) {
        console.error('Error checking role:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!role) {
        return res.status(404).json({ error: 'Role not found in this organization' });
      }
      
      // System roles cannot be deleted
      if (role.is_system_role) {
        return res.status(400).json({ error: 'Cannot delete system roles' });
      }
      
      // Only org_admin can delete custom roles
      if (userRole !== 'org_admin') {
        return res.status(403).json({ error: 'Only org_admin can delete roles' });
      }
      
      if (role.user_count > 0) {
        return res.status(409).json({ 
          error: `Cannot delete role with ${role.user_count} assigned users. Please reassign users first.` 
        });
      }
      
      db.serialize(() => {
        db.run("BEGIN TRANSACTION");
        
        // Delete role permissions
        db.run("DELETE FROM role_permissions WHERE role_id = ?", [id]);
        
        // Delete role
        db.run("DELETE FROM roles WHERE id = ? AND organization_id = ?", [id, organizationId], function(err) {
          if (err) {
            console.error('Error deleting role:', err);
            db.run("ROLLBACK");
            return res.status(500).json({ error: 'Database error' });
          }
          
          db.run("COMMIT", (err) => {
            if (err) {
              console.error('Error committing transaction:', err);
              return res.status(500).json({ error: 'Database error' });
            }
            res.json({ message: 'Role deleted successfully' });
          });
        });
      });
    });
  });

  // Get available permissions
  router.get('/permissions/available', rbacVerifier, checkPermission('admin.roles.view'), (req, res) => {
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

  // Update role permissions
  router.post('/:id/permissions', rbacVerifier, checkPermission('admin.permissions.manage'), (req, res) => {
    const { id } = req.params;
    const organizationId = req.user.organization_id;
    const { permission_ids } = req.body;
    
    if (!Array.isArray(permission_ids)) {
      return res.status(400).json({ error: 'permission_ids must be an array' });
    }
    
    // Check if role exists in organization
    db.get("SELECT id FROM roles WHERE id = ? AND organization_id = ?", [id, organizationId], (err, role) => {
      if (err) {
        console.error('Error checking role:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!role) {
        return res.status(404).json({ error: 'Role not found in this organization' });
      }
      
      db.serialize(() => {
        db.run("BEGIN TRANSACTION");
        
        // Delete existing permissions
        db.run("DELETE FROM role_permissions WHERE role_id = ?", [id], (err) => {
          if (err) {
            console.error('Error deleting role permissions:', err);
            db.run("ROLLBACK");
            return res.status(500).json({ error: 'Database error' });
          }
          
          if (permission_ids.length === 0) {
            db.run("COMMIT", (err) => {
              if (err) {
                console.error('Error committing transaction:', err);
                return res.status(500).json({ error: 'Database error' });
              }
              res.json({ 
                message: 'All permissions removed from role',
                permissions_updated: 0
              });
            });
            return;
          }
          
          // Add new permissions
          let completed = 0;
          let hasError = false;
          
          permission_ids.forEach(permissionId => {
            db.run("INSERT INTO role_permissions (role_id, permission_id, granted) VALUES (?, ?, 1)",
              [id, permissionId], (err) => {
                if (err) {
                  console.error('Error adding permission to role:', err);
                  hasError = true;
                }
                
                completed++;
                if (completed === permission_ids.length) {
                  if (hasError) {
                    db.run("ROLLBACK");
                    return res.status(500).json({ error: 'Failed to update some permissions' });
                  } else {
                    db.run("COMMIT", (err) => {
                      if (err) {
                        console.error('Error committing transaction:', err);
                        return res.status(500).json({ error: 'Database error' });
                      }
                      res.json({ 
                        message: 'Role permissions updated successfully',
                        permissions_updated: permission_ids.length
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

  // Helper function to add permissions to role
  function addPermissionsToRole(roleId, permissions, callback) {
    if (permissions.length === 0) {
      return callback();
    }
    
    let completed = 0;
    let hasError = false;
    
    permissions.forEach(permissionData => {
      const { permission_id, granted = true } = permissionData;
      
      db.run("INSERT INTO role_permissions (role_id, permission_id, granted) VALUES (?, ?, ?)",
        [roleId, permission_id, granted], (err) => {
          if (err) {
            console.error('Error adding permission to role:', err);
            hasError = true;
          }
          
          completed++;
          if (completed === permissions.length) {
            callback(hasError ? new Error('Failed to add some permissions') : null);
          }
        }
      );
    });
  }

  return router;
};