const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

// ============================================
// ROLLEN-HIERARCHIE (vereinfacht)
// ============================================
// super_admin (5) - Organisations-übergreifend, nur Org-Verwaltung
// org_admin (4)   - Volle Rechte in eigener Organisation
// admin (3)       - Konfis, Events, Badges, Aktivitäten, Requests
// teamer (2)      - Events, Konfis ansehen, Punkte vergeben
// konfi (1)       - Nur eigene Daten
// ============================================

// Token verification - lädt User-Daten ohne Permissions aus DB
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

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Token expired' });
      }
      return res.status(401).json({ error: 'Invalid token' });
    }

    try {
      // User-Query mit LEFT JOIN für super_admin (organization_id kann NULL sein)
      const userQuery = `
        SELECT u.id, u.organization_id, u.username, u.display_name, u.is_active,
               u.role_title, u.is_super_admin,
               r.name as role_name, r.display_name as role_display_name,
               o.name as organization_name, o.slug as organization_slug,
               COALESCE(o.is_active, true) as organization_active
        FROM users u
        LEFT JOIN organizations o ON u.organization_id = o.id
        LEFT JOIN roles r ON u.role_id = r.id
        WHERE u.id = $1
      `;
      const { rows: [user] } = await db.query(userQuery, [decoded.id]);

      if (!user) {
        return res.status(401).json({ error: 'User not found' });
      }

      if (!user.is_active) {
        return res.status(401).json({ error: 'User account is inactive' });
      }

      // Super-Admin hat keine Organization - Skip org check
      if (user.role_name !== 'super_admin' && !user.organization_active) {
        return res.status(401).json({ error: 'Organization is inactive' });
      }

      // Jahrgänge laden (nur für nicht-super_admin)
      let assignedJahrgaenge = [];
      if (user.organization_id) {
        const jahrgaengeQuery = `
          SELECT j.id, j.name, uja.can_view, uja.can_edit
          FROM user_jahrgang_assignments uja
          JOIN jahrgaenge j ON uja.jahrgang_id = j.id
          WHERE uja.user_id = $1
        `;
        const { rows } = await db.query(jahrgaengeQuery, [decoded.id]);
        assignedJahrgaenge = rows;
      }

      // User-Objekt für Request
      req.user = {
        id: user.id,
        organization_id: user.organization_id,
        username: user.username,
        display_name: user.display_name,
        role_name: user.role_name,
        role_title: user.role_title,
        role_display_name: user.role_display_name,
        organization_name: user.organization_name,
        organization_slug: user.organization_slug,
        assigned_jahrgaenge: assignedJahrgaenge,
        // Backward compatibility
        type: user.role_name === 'konfi' ? 'konfi' : 'admin',
        // is_super_admin: Rolle ODER DB-Flag
        is_super_admin: user.role_name === 'super_admin' || user.is_super_admin === true,
        is_org_admin: user.role_name === 'org_admin'
      };

      // Last login aktualisieren
      await db.query("UPDATE users SET last_login_at = NOW() WHERE id = $1", [user.id]);

      next();
    } catch (err) {
      console.error('Database error in verifyTokenRBAC middleware:', err);
      res.status(500).json({ error: 'Database error' });
    }
  };
};

// ============================================
// ROLLEN-BASIERTE ZUGRIFFSKONTROLLE (NEU)
// ============================================

/**
 * Generische Rollen-Prüfung
 * @param {...string} allowedRoles - Erlaubte Rollennamen
 */
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Nicht angemeldet' });
    }

    if (!allowedRoles.includes(req.user.role_name)) {
      return res.status(403).json({ error: 'Keine Berechtigung' });
    }

    next();
  };
};

// ============================================
// ROLLEN-CHECKS (KORRIGIERT)
// ============================================
// super_admin: NUR Organisations-Verwaltung, sonst KEIN Zugriff
// org_admin: Alles in eigener Organisation (inkl. User)
// admin: Alles AUSSER User-Verwaltung
// teamer: Events, Konfis ansehen, Punkte vergeben
// ============================================

const requireSuperAdmin = requireRole('super_admin');           // NUR für Org Create/Delete
const requireOrgAdmin = requireRole('org_admin');               // User-Verwaltung in Org
const requireAdmin = requireRole('org_admin', 'admin');         // Konfis, Requests, Badges, etc.
const requireTeamer = requireRole('org_admin', 'admin', 'teamer'); // Events, Punkte vergeben

// ============================================
// JAHRGANG-ZUGRIFF
// ============================================

const checkJahrgangAccess = (jahrgangIdParam = 'jahrgangId', requireEdit = false) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Nicht angemeldet' });
    }

    // super_admin hat KEINEN Zugriff auf Jahrgangs-Daten
    if (req.user.role_name === 'super_admin') {
      return res.status(403).json({ error: 'Super-Admin hat keinen Zugriff auf Jahrgangs-Daten' });
    }

    // Org-Admin und Admin haben Zugriff auf alle Jahrgänge ihrer Organisation
    if (['org_admin', 'admin'].includes(req.user.role_name)) {
      return next();
    }

    const jahrgangId = parseInt(req.params[jahrgangIdParam] || req.body[jahrgangIdParam] || req.query[jahrgangIdParam]);

    if (!jahrgangId) {
      return res.status(400).json({ error: 'Jahrgang ID erforderlich' });
    }

    const assignedJahrgang = req.user.assigned_jahrgaenge.find(j => j.id === jahrgangId);

    if (!assignedJahrgang) {
      return res.status(403).json({ error: 'Kein Zugriff auf diesen Jahrgang' });
    }

    if (requireEdit && !assignedJahrgang.can_edit) {
      return res.status(403).json({ error: 'Keine Bearbeitungsrechte für diesen Jahrgang' });
    }

    if (!assignedJahrgang.can_view) {
      return res.status(403).json({ error: 'Keine Leserechte für diesen Jahrgang' });
    }

    next();
  };
};

// Filter für Jahrgang-basierte Queries
const filterByJahrgangAccess = (req) => {
  if (!req.user) {
    return { where: 'WHERE 1=0', params: [] };
  }

  // super_admin hat KEINEN Zugriff auf Jahrgangs-Daten
  if (req.user.role_name === 'super_admin') {
    return { where: 'WHERE 1=0', params: [] };
  }

  // Org-Admin und Admin sehen alles in ihrer Organisation
  if (['org_admin', 'admin'].includes(req.user.role_name)) {
    return {
      where: 'WHERE organization_id = $1',
      params: [req.user.organization_id]
    };
  }

  // Teamer sehen nur zugewiesene Jahrgänge
  const viewableJahrgaenge = req.user.assigned_jahrgaenge
    .filter(j => j.can_view)
    .map(j => j.id);

  if (viewableJahrgaenge.length === 0) {
    return { where: 'WHERE 1=0', params: [] };
  }

  const placeholders = viewableJahrgaenge.map((_, i) => `$${i + 2}`).join(',');
  return {
    where: `WHERE organization_id = $1 AND jahrgang_id IN (${placeholders})`,
    params: [req.user.organization_id, ...viewableJahrgaenge]
  };
};

// ============================================
// ORGANISATIONS-ISOLATION
// ============================================

const requireSameOrganization = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Nicht angemeldet' });
  }

  // Super-Admin kann auf alle Organisationen zugreifen
  if (req.user.role_name === 'super_admin') {
    return next();
  }

  const requestedOrgId = parseInt(req.params.organizationId || req.body.organization_id);

  if (requestedOrgId && requestedOrgId !== req.user.organization_id) {
    return res.status(403).json({ error: 'Kein Zugriff auf andere Organisationen' });
  }

  next();
};

module.exports = {
  verifyTokenRBAC,
  // Rollen-Checks
  requireRole,
  requireSuperAdmin,
  requireOrgAdmin,
  requireAdmin,
  requireTeamer,
  // Jahrgang-Zugriff
  checkJahrgangAccess,
  filterByJahrgangAccess,
  // Organisation
  requireSameOrganization
};
