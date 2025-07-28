const express = require('express');
const router = express.Router();

// Helper function to add permissions to a role.
// This async version is designed to be called within a transaction by passing the transaction client.
async function addPermissionsToRole(dbClient, roleId, permissions) {
  if (!permissions || permissions.length === 0) {
    return; // Nothing to do
  }

  const insertQuery = "INSERT INTO role_permissions (role_id, permission_id, granted) VALUES ($1, $2, $3)";
  
  // Use a for...of loop to correctly handle awaiting each insert within the transaction.
  for (const permissionData of permissions) {
    const { permission_id, granted = true } = permissionData;
    await dbClient.query(insertQuery, [roleId, permission_id, granted]);
  }
}

// Roles management routes
module.exports = (db, rbacVerifier, checkPermission) => {
  
  // Get all roles in current organization
  router.get('/', rbacVerifier, checkPermission('admin.roles.view'), async (req, res) => {
    const organizationId = req.user.organization_id;
    
    try {
      const query = `
        SELECT r.id, r.name, r.display_name, r.description, 
               r.is_system_role, r.is_active, r.created_at,
               COUNT(DISTINCT u.id)::int as user_count,
               COUNT(DISTINCT rp.permission_id)::int as permission_count
        FROM roles r
        LEFT JOIN users u ON r.id = u.role_id AND u.is_active = true
        LEFT JOIN role_permissions rp ON r.id = rp.role_id AND rp.granted = true
        WHERE r.organization_id = $1
        GROUP BY r.id
        ORDER BY r.is_system_role DESC, r.created_at ASC
      `;
      
      const { rows } = await db.query(query, [organizationId]);
      res.json(rows);

    } catch (err) {
      console.error('Database error in GET /roles:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // Get single role with permissions
  router.get('/:id', rbacVerifier, checkPermission('admin.roles.view'), async (req, res) => {
    const { id } = req.params;
    const organizationId = req.user.organization_id;
    
    try {
      const roleQuery = `
        SELECT r.id, r.name, r.display_name, r.description, 
               r.is_system_role, r.is_active, r.created_at,
               COUNT(DISTINCT u.id)::int as user_count
        FROM roles r
        LEFT JOIN users u ON r.id = u.role_id AND u.is_active = true
        WHERE r.id = $1 AND r.organization_id = $2
        GROUP BY r.id
      `;
      
      const { rows: [role] } = await db.query(roleQuery, [id, organizationId]);
      
      if (!role) {
        return res.status(404).json({ error: 'Role not found' });
      }
      
      // Get role permissions
      const permissionsQuery = `
        SELECT p.id, p.name, p.display_name, p.description, p.module,
               COALESCE(rp.granted, false) as granted
        FROM permissions p
        LEFT JOIN role_permissions rp ON p.id = rp.permission_id AND rp.role_id = $1
        ORDER BY p.module, p.name
      `;
      
      const { rows: permissions } = await db.query(permissionsQuery, [id]);
      
      res.json({
        ...role,
        permissions: permissions
      });

    } catch (err) {
      console.error(`Database error in GET /roles/${id}:`, err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // Create new role
  router.post('/', rbacVerifier, checkPermission('admin.roles.create'), async (req, res) => {
    const organizationId = req.user.organization_id;
    const userRole = req.user.role_name;
    const { name, display_name, description, permissions = [] } = req.body;
    
    if (!name || !display_name) {
      return res.status(400).json({ error: 'Name and display_name are required' });
    }
    
    if (userRole !== 'org_admin') {
      return res.status(403).json({ error: 'Only org_admin can create new roles' });
    }

    // Creating a role and its permissions should be an atomic operation.
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      
      const insertQuery = `
        INSERT INTO roles (organization_id, name, display_name, description) 
        VALUES ($1, $2, $3, $4)
        RETURNING id
      `;
      const { rows: [newRole] } = await client.query(insertQuery, [organizationId, name, display_name, description]);
      const roleId = newRole.id;
      
      // Pass the transaction client to the helper function
      await addPermissionsToRole(client, roleId, permissions);
      
      await client.query('COMMIT');
      
      res.status(201).json({ 
        id: roleId, 
        message: 'Role created successfully with permissions',
        permissions_added: permissions.length
      });

    } catch (err) {
      await client.query('ROLLBACK');
      if (err.code === '23505') { // unique_violation
        return res.status(409).json({ error: 'Role name already exists in this organization' });
      }
      console.error('Database error in POST /roles:', err);
      return res.status(500).json({ error: 'Database error' });
    } finally {
      client.release();
    }
  });

  // Update role
  router.put('/:id', rbacVerifier, checkPermission('admin.roles.edit'), async (req, res) => {
    const { id } = req.params;
    const organizationId = req.user.organization_id;
    const { name, display_name, description, is_active, permissions } = req.body;
    
    const client = await db.connect();
    try {
      await client.query('BEGIN');

      // Check if role exists and can be modified, lock the row for update
      const { rows: [role] } = await client.query(
        "SELECT name, is_system_role FROM roles WHERE id = $1 AND organization_id = $2 FOR UPDATE", 
        [id, organizationId]
      );
      
      if (!role) {
        return res.status(404).json({ error: 'Role not found in this organization' });
      }
      
      const userRole = req.user.role_name;
      const roleToEdit = role.name;
      
      if (roleToEdit === 'konfi' && (name || display_name || description !== undefined)) {
        return res.status(400).json({ error: 'The konfi role cannot be modified' });
      }
      if (userRole === 'admin' && (roleToEdit === 'admin' || roleToEdit === 'org_admin')) {
        return res.status(403).json({ error: 'You cannot edit admin or org_admin roles' });
      }
      if (userRole === 'teamer') {
        return res.status(403).json({ error: 'You do not have permission to edit roles' });
      }
      
      let updateFields = [];
      let updateParams = [];
      let paramIndex = 1;

      const isSystemRole = role.is_system_role;
      const canEditBasicFields = !isSystemRole || (userRole === 'org_admin' && roleToEdit !== 'konfi');
      
      if (name !== undefined && canEditBasicFields) { updateFields.push(`name = $${paramIndex++}`); updateParams.push(name); }
      if (display_name !== undefined && canEditBasicFields) { updateFields.push(`display_name = $${paramIndex++}`); updateParams.push(display_name); }
      if (description !== undefined && canEditBasicFields) { updateFields.push(`description = $${paramIndex++}`); updateParams.push(description); }
      if (is_active !== undefined) { updateFields.push(`is_active = $${paramIndex++}`); updateParams.push(is_active); }
      
      if (updateFields.length > 0) {
        updateFields.push('updated_at = NOW()');
        const updateQuery = `UPDATE roles SET ${updateFields.join(', ')} WHERE id = $${paramIndex++} AND organization_id = $${paramIndex++}`;
        updateParams.push(id, organizationId);
        await client.query(updateQuery, updateParams);
      }
      
      if (permissions && Array.isArray(permissions)) {
        await client.query("DELETE FROM role_permissions WHERE role_id = $1", [id]);
        await addPermissionsToRole(client, id, permissions);
      }

      await client.query('COMMIT');

      res.json({ 
        message: 'Role updated successfully',
        ...(permissions && { permissions_updated: permissions.length })
      });
      
    } catch (err) {
      await client.query('ROLLBACK');
      if (err.code === '23505') { // unique_violation
        return res.status(409).json({ error: 'Role name already exists in this organization' });
      }
      console.error(`Database error in PUT /roles/${id}:`, err);
      res.status(500).json({ error: 'Database error' });
    } finally {
      client.release();
    }
  });

  // Delete role
  router.delete('/:id', rbacVerifier, checkPermission('admin.roles.delete'), async (req, res) => {
    const { id } = req.params;
    const organizationId = req.user.organization_id;
    const userRole = req.user.role_name;
    
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      
      const checkQuery = `
        SELECT r.name, r.is_system_role, COUNT(u.id)::int as user_count 
        FROM roles r 
        LEFT JOIN users u ON r.id = u.role_id 
        WHERE r.id = $1 AND r.organization_id = $2
        GROUP BY r.id, r.name, r.is_system_role
        FOR UPDATE
      `;
      const { rows: [role] } = await client.query(checkQuery, [id, organizationId]);
      
      if (!role) { return res.status(404).json({ error: 'Role not found in this organization' }); }
      if (role.is_system_role) { return res.status(400).json({ error: 'Cannot delete system roles' }); }
      if (userRole !== 'org_admin') { return res.status(403).json({ error: 'Only org_admin can delete roles' }); }
      if (role.user_count > 0) {
        return res.status(409).json({ error: `Cannot delete role with ${role.user_count} assigned users. Please reassign users first.` });
      }
      
      await client.query("DELETE FROM role_permissions WHERE role_id = $1", [id]);
      await client.query("DELETE FROM roles WHERE id = $1 AND organization_id = $2", [id, organizationId]);

      await client.query('COMMIT');

      res.json({ message: 'Role deleted successfully' });

    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`Database error in DELETE /roles/${id}:`, err);
      res.status(500).json({ error: 'Database error' });
    } finally {
      client.release();
    }
  });

  // Get available permissions
  router.get('/permissions/available', rbacVerifier, checkPermission('admin.roles.view'), async (req, res) => {
    try {
      const query = `
        SELECT id, name, display_name, description, module
        FROM permissions
        WHERE is_system_permission = true
        ORDER BY module, name
      `;
      
      const { rows } = await db.query(query);
      
      const grouped = {};
      rows.forEach(permission => {
        if (!grouped[permission.module]) {
          grouped[permission.module] = [];
        }
        grouped[permission.module].push(permission);
      });
      
      res.json(grouped);

    } catch (err) {
      console.error('Database error in GET /roles/permissions/available:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // Update role permissions
  router.post('/:id/permissions', rbacVerifier, checkPermission('admin.permissions.manage'), async (req, res) => {
    const { id } = req.params;
    const organizationId = req.user.organization_id;
    const { permission_ids } = req.body;
    
    if (!Array.isArray(permission_ids)) {
      return res.status(400).json({ error: 'permission_ids must be an array' });
    }
    
    const client = await db.connect();
    try {
      await client.query('BEGIN');
      
      const { rowCount } = await client.query("SELECT 1 FROM roles WHERE id = $1 AND organization_id = $2", [id, organizationId]);
      if (rowCount === 0) {
        return res.status(404).json({ error: 'Role not found in this organization' });
      }
      
      await client.query("DELETE FROM role_permissions WHERE role_id = $1", [id]);
      
      if (permission_ids.length > 0) {
        const insertQuery = "INSERT INTO role_permissions (role_id, permission_id, granted) VALUES ($1, $2, true)";
        for (const permissionId of permission_ids) {
            await client.query(insertQuery, [id, permissionId]);
        }
      }
      
      await client.query('COMMIT');
      
      res.json({ 
        message: 'Role permissions updated successfully',
        permissions_updated: permission_ids.length
      });

    } catch (err) {
      await client.query('ROLLBACK');
      console.error(`Database error in POST /roles/${id}/permissions:`, err);
      res.status(500).json({ error: 'Database error' });
    } finally {
      client.release();
    }
  });

  return router;
};