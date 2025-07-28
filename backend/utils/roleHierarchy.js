// Role Hierarchy Utility
// Definiert die Hierarchie und Berechtigungen zwischen den Rollen

const ROLE_HIERARCHY = {
  'org_admin': 4,
  'admin': 3,
  'teamer': 2,
  'konfi': 1
};

/**
 * Überprüft ob userRole eine targetRole verwalten darf
 * @param {string} userRole - Die Rolle des ausführenden Users
 * @param {string} targetRole - Die Rolle die verwaltet werden soll
 * @returns {boolean} - true wenn erlaubt
 */
const canManageRole = (userRole, targetRole) => {
  // ... (Logik unverändert)
  const userLevel = ROLE_HIERARCHY[userRole] || 0;
  const targetLevel = ROLE_HIERARCHY[targetRole] || 0;
  if (userRole === 'org_admin') return true;
  if (userRole === 'admin') return targetRole !== 'org_admin' && targetRole !== 'admin';
  if (userRole === 'teamer') return targetRole !== 'org_admin' && targetRole !== 'admin' && targetRole !== 'teamer';
  return userLevel > targetLevel;
};

/**
 * Überprüft ob userRole eine andere userRole erstellen darf
 * @param {string} userRole - Die Rolle des ausführenden Users  
 * @param {string} targetRole - Die Rolle die erstellt werden soll
 * @returns {boolean} - true wenn erlaubt
 */
const canCreateRole = (userRole, targetRole) => {
  return canManageRole(userRole, targetRole);
};

/**
 * Middleware-Funktion für User-Management-Operationen
 * Überprüft ob der aktuelle User die Ziel-User-Rolle verwalten darf
 */
const checkUserHierarchy = (operation = 'manage') => {
  return async (req, res, next) => {
    try {
      const userRole = req.user.role_name;
      const targetUserId = req.params.id;
      const targetRoleId = req.body.role_id;

      if (!userRole) {
        return res.status(403).json({ error: 'User role not found' });
      }

      // Bei Create-Operationen haben wir die role_id im Body
      if (operation === 'create' && targetRoleId) {
        const { rows: [role] } = await req.db.query('SELECT name FROM roles WHERE id = $1', [targetRoleId]);
        if (!role) {
          return res.status(404).json({ error: 'Target role not found' });
        }
        if (!canCreateRole(userRole, role.name)) {
          return res.status(403).json({
            error: `You cannot create users with role '${role.name}'. Insufficient hierarchy level.`
          });
        }
        return next();
      }

      // Bei Update/Delete/View-Operationen müssen wir erst den Ziel-User laden
      if (targetUserId) {
        const query = `
          SELECT u.id, u.role_id, r.name as role_name
          FROM users u
          JOIN roles r ON u.role_id = r.id  
          WHERE u.id = $1 AND u.organization_id = $2
        `;
        const { rows: [targetUser] } = await req.db.query(query, [targetUserId, req.user.organization_id]);

        if (!targetUser) {
          return res.status(404).json({ error: 'Target user not found in your organization' });
        }
        if (!canManageRole(userRole, targetUser.role_name)) {
          return res.status(403).json({
            error: `You cannot ${operation} users with role '${targetUser.role_name}'. Insufficient hierarchy level.`
          });
        }

        // Zusätzlich bei Role-Updates prüfen
        if (operation === 'update' && targetRoleId && targetRoleId !== targetUser.role_id) {
          const { rows: [newRole] } = await req.db.query('SELECT name FROM roles WHERE id = $1', [targetRoleId]);
          if (!newRole) {
            return res.status(404).json({ error: 'New role not found' });
          }
          if (!canCreateRole(userRole, newRole.name)) {
            return res.status(403).json({
              error: `You cannot assign role '${newRole.name}'. Insufficient hierarchy level.`
            });
          }
        }
        
        return next();
      }

      // Wenn keine spezifische Überprüfung nötig ist
      next();
    } catch (err) {
      console.error('Database error in checkUserHierarchy middleware:', err);
      res.status(500).json({ error: 'Database error' });
    }
  };
};

/**
 * Filtert Users basierend auf der Hierarchie
 * Zeigt nur Users an, die der aktuelle User verwalten darf
 */
const filterUsersByHierarchy = (users, userRole) => {
  return users.filter(user => canManageRole(userRole, user.role_name));
};

/**
 * Filtert Rollen basierend auf der Hierarchie
 * Zeigt nur Rollen an, die der aktuelle User verwalten/zuweisen darf
 */
const filterRolesByHierarchy = (roles, userRole) => {
  return roles.filter(role => canManageRole(userRole, role.name));
};

module.exports = {
  ROLE_HIERARCHY,
  canManageRole,
  canCreateRole,
  checkUserHierarchy,
  filterUsersByHierarchy,
  filterRolesByHierarchy
};