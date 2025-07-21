const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'konfi-secret-2025';

// Enhanced token verification with RBAC support
const verifyTokenRBAC = (db) => {
  return async (req, res, next) => {
    const authHeader = req.headers.authorization;
    
    if (!authHeader) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    const token = authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ error: 'Invalid token format' });
    }
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      
      // Get user with organization and role information
      const userQuery = `
        SELECT u.id, u.organization_id, u.username, u.display_name, u.is_active,
               r.name as role_name, r.display_name as role_display_name,
               o.name as organization_name, o.slug as organization_slug,
               o.is_active as organization_active
        FROM users u
        JOIN organizations o ON u.organization_id = o.id
        LEFT JOIN user_roles ur ON u.id = ur.user_id
        LEFT JOIN roles r ON ur.role_id = r.id
        WHERE u.id = ?
      `;
      
      const user = await new Promise((resolve, reject) => {
        db.get(userQuery, [decoded.id], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
      
      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }
      
      if (!user.is_active) {
        return res.status(401).json({ error: 'User account is inactive' });
      }
      
      if (!user.organization_active) {
        return res.status(401).json({ error: 'Organization is inactive' });
      }
      
      // Get user permissions
      const permissionsQuery = `
        SELECT p.name
        FROM users u
        JOIN user_roles ur ON u.id = ur.user_id
        JOIN roles r ON ur.role_id = r.id
        JOIN role_permissions rp ON r.id = rp.role_id
        JOIN permissions p ON rp.permission_id = p.id
        WHERE u.id = ? AND rp.granted = 1
      `;
      
      const permissions = await new Promise((resolve, reject) => {
        db.all(permissionsQuery, [decoded.id], (err, rows) => {
          if (err) reject(err);
          else resolve(rows.map(row => row.name));
        });
      });
      
      // Get user's assigned jahrgaenge
      const jahrgaengeQuery = `
        SELECT j.id, j.name, uja.can_view, uja.can_edit
        FROM user_jahrgang_assignments uja
        JOIN jahrgaenge j ON uja.jahrgang_id = j.id
        WHERE uja.user_id = ?
      `;
      
      const assignedJahrgaenge = await new Promise((resolve, reject) => {
        db.all(jahrgaengeQuery, [decoded.id], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
      
      // Attach user info to request
      req.user = {
        id: user.id,
        organization_id: user.organization_id,
        username: user.username,
        display_name: user.display_name,
        role_name: user.role_name,
        role_display_name: user.role_display_name,
        organization_name: user.organization_name,
        organization_slug: user.organization_slug,
        permissions: permissions,
        assigned_jahrgaenge: assignedJahrgaenge,
        type: 'user', // For backward compatibility
        is_super_admin: user.role_name === 'super_admin'
      };
      
      // Update last login
      db.run("UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?", [user.id]);
      
      next();
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expired' });
      }
      return res.status(401).json({ error: 'Invalid token' });
    }
  };
};

// Permission check middleware
const checkPermission = (requiredPermission) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Super admin has all permissions
    if (req.user.is_super_admin) {
      return next();
    }
    
    // Check if user has the required permission
    if (!req.user.permissions.includes(requiredPermission)) {
      return res.status(403).json({ 
        error: 'Insufficient permissions',
        required_permission: requiredPermission,
        user_permissions: req.user.permissions
      });
    }
    
    next();
  };
};

// Check if user can access specific jahrgang
const checkJahrgangAccess = (jahrgangIdParam = 'jahrgangId', requireEdit = false) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    // Super admin and organization admin have access to all jahrgaenge
    if (req.user.is_super_admin || req.user.role_name === 'admin') {
      return next();
    }
    
    const jahrgangId = parseInt(req.params[jahrgangIdParam] || req.body[jahrgangIdParam] || req.query[jahrgangIdParam]);
    
    if (!jahrgangId) {
      return res.status(400).json({ error: 'Jahrgang ID required' });
    }
    
    const assignedJahrgang = req.user.assigned_jahrgaenge.find(j => j.id === jahrgangId);
    
    if (!assignedJahrgang) {
      return res.status(403).json({ error: 'No access to this jahrgang' });
    }
    
    if (requireEdit && !assignedJahrgang.can_edit) {
      return res.status(403).json({ error: 'No edit access to this jahrgang' });
    }
    
    if (!assignedJahrgang.can_view) {
      return res.status(403).json({ error: 'No view access to this jahrgang' });
    }
    
    next();
  };
};

// Filter query results based on user's jahrgang access
const filterByJahrgangAccess = (req) => {
  if (!req.user) {
    return { where: 'WHERE 1=0', params: [] }; // No access
  }
  
  // Super admin and organization admin see everything
  if (req.user.is_super_admin || req.user.role_name === 'admin') {
    return { 
      where: 'WHERE organization_id = ?', 
      params: [req.user.organization_id] 
    };
  }
  
  // Filter by assigned jahrgaenge
  const viewableJahrgaenge = req.user.assigned_jahrgaenge
    .filter(j => j.can_view)
    .map(j => j.id);
    
  if (viewableJahrgaenge.length === 0) {
    return { where: 'WHERE 1=0', params: [] }; // No access
  }
  
  const placeholders = viewableJahrgaenge.map(() => '?').join(',');
  return {
    where: `WHERE organization_id = ? AND jahrgang_id IN (${placeholders})`,
    params: [req.user.organization_id, ...viewableJahrgaenge]
  };
};

// Organization isolation middleware
const requireSameOrganization = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  // Super admin can access any organization
  if (req.user.is_super_admin) {
    return next();
  }
  
  // For routes that specify organization_id, ensure it matches user's organization
  const requestedOrgId = parseInt(req.params.organizationId || req.body.organization_id);
  
  if (requestedOrgId && requestedOrgId !== req.user.organization_id) {
    return res.status(403).json({ error: 'Access denied to other organizations' });
  }
  
  next();
};

// Legacy admin check for backward compatibility
const requireAdmin = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  if (req.user.role_name !== 'admin' && !req.user.is_super_admin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  next();
};

module.exports = {
  verifyTokenRBAC,
  checkPermission,
  checkJahrgangAccess,
  filterByJahrgangAccess,
  requireSameOrganization,
  requireAdmin
};