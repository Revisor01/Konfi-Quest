const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();
const { body, param } = require('express-validator');
const { handleValidationErrors, commonValidations } = require('../middleware/validation');
const { checkUserHierarchy, filterUsersByHierarchy } = require('../utils/roleHierarchy');

// User management routes
// WICHTIGER HINWEIS: Das übergebene 'db'-Objekt ist eine PostgreSQL Pool-Instanz.
// Transaktionen werden direkt über db.query('BEGIN'/'COMMIT'/'ROLLBACK') verwaltet.
// Users: Nur org_admin darf verwalten
module.exports = (db, rbacVerifier, { requireOrgAdmin }) => {

  // Validierungsregeln
  const validateCreateUser = [
    commonValidations.username,
    body('display_name').trim().notEmpty().withMessage('Anzeigename ist erforderlich'),
    commonValidations.password,
    body('role_id').isInt({ min: 1 }).withMessage('Ungültige Rollen-ID'),
    handleValidationErrors
  ];

  const validateUpdateUser = [
    param('id').isInt({ min: 1 }).withMessage('Ungültige ID'),
    body('username').optional().trim().isLength({ min: 3 }).withMessage('Benutzername muss mindestens 3 Zeichen lang sein'),
    body('display_name').optional().trim().notEmpty().withMessage('Anzeigename darf nicht leer sein'),
    handleValidationErrors
  ];

  const validateUserId = [
    param('id').isInt({ min: 1 }).withMessage('Ungültige ID'),
    handleValidationErrors
  ];

  const validateResetPassword = [
    param('id').isInt({ min: 1 }).withMessage('Ungültige ID'),
    body('password').isLength({ min: 6 }).withMessage('Passwort muss mindestens 6 Zeichen lang sein'),
    handleValidationErrors
  ];

  const validateJahrgangAssignments = [
    param('id').isInt({ min: 1 }).withMessage('Ungültige ID'),
    body('jahrgang_assignments').isArray().withMessage('jahrgang_assignments muss ein Array sein'),
    handleValidationErrors
  ];

  // Hierarchie-Middleware mit DB-Zugriff
  // Diese Middleware erfordert eine Modifikation in der checkUserHierarchy-Funktion,
  // um asynchron zu sein und das db-Objekt korrekt zu verwenden, falls es dort
  // ebenfalls Datenbankabfragen durchführt. Hier wird angenommen, dass die
  // Übergabe von req.db ausreicht.
  const userHierarchyMiddleware = (operation) => {
    return (req, res, next) => {
      // Das 'db' Objekt wird hier explizit an den Request angehängt.
      // In einer Express-Anwendung ist es oft besser, die DB-Verbindung
      // über eine dedizierte Middleware am Anfang der Kette bereitzustellen.
      req.db = db;
      return checkUserHierarchy(operation)(req, res, next);
    };
  };

  // Get users in current organization
  router.get('/', rbacVerifier, requireOrgAdmin, async (req, res) => {
    const organizationId = req.user.organization_id;

    const query = `
      SELECT u.id, u.username, u.email, u.display_name, u.role_title, u.is_active,
             u.last_login_at, u.created_at, u.updated_at,
             r.name as role_name, r.display_name as role_display_name,
             r.description as role_description,
             COUNT(DISTINCT uja.jahrgang_id) as assigned_jahrgaenge_count
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      LEFT JOIN user_jahrgang_assignments uja ON u.id = uja.user_id
      WHERE u.organization_id = $1 AND r.name NOT IN ('konfi', 'super_admin')
      GROUP BY u.id, r.name, r.display_name, r.description
      ORDER BY u.created_at DESC
    `;

    try {
      const { rows: users } = await db.query(query, [organizationId]);

      // Markiere Users als editierbar basierend auf Hierarchie statt sie zu filtern
      const usersWithEditability = users.map(user => ({
        ...user,
        can_edit: filterUsersByHierarchy([user], req.user.role_name).length > 0
      }));
      res.json(usersWithEditability);

    } catch (err) {
 console.error('Database error in GET /users:', err);
      res.status(500).json({ error: 'Datenbankfehler' });
    }
  });

  // Get single user with details
  router.get('/:id', rbacVerifier, requireOrgAdmin, userHierarchyMiddleware('view'), async (req, res) => {
    const { id } = req.params;
    const organizationId = req.user.organization_id;

    const userQuery = `
      SELECT u.id, u.username, u.email, u.display_name, u.role_title, u.is_active,
             u.last_login_at, u.created_at, u.updated_at,
             r.id as role_id, r.name as role_name, r.display_name as role_display_name
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.id = $1 AND u.organization_id = $2
    `;

    const jahrgaengeQuery = `
      SELECT j.id, j.name, uja.can_view, uja.can_edit, uja.assigned_at,
             assigner.display_name as assigned_by_name
      FROM user_jahrgang_assignments uja
      JOIN jahrgaenge j ON uja.jahrgang_id = j.id
      LEFT JOIN users assigner ON uja.assigned_by = assigner.id
      WHERE uja.user_id = $1
      ORDER BY j.name
    `;

    try {
      const { rows: [user] } = await db.query(userQuery, [id, organizationId]);

      if (!user) {
        return res.status(404).json({ error: 'Benutzer nicht gefunden' });
      }

      const { rows: jahrgaenge } = await db.query(jahrgaengeQuery, [id]);

      res.json({
        ...user,
        assigned_jahrgaenge: jahrgaenge
      });

    } catch (err) {
 console.error(`Database error in GET /users/${id}:`, err);
      res.status(500).json({ error: 'Datenbankfehler' });
    }
  });

  // Create new user
  router.post('/', rbacVerifier, requireOrgAdmin, userHierarchyMiddleware('create'), validateCreateUser, async (req, res) => {
    const organizationId = req.user.organization_id;
    const { username, email, display_name, role_title, password, role_id } = req.body;

    if (!username || !display_name || !password || !role_id) {
      return res.status(400).json({ error: 'Benutzername, Name, Passwort und Rolle sind erforderlich' });
    }

    try {
      // Verify role exists in organization
      const roleCheckQuery = "SELECT id FROM roles WHERE id = $1 AND organization_id = $2";
      const { rows: [role] } = await db.query(roleCheckQuery, [role_id, organizationId]);

      if (!role) {
        return res.status(400).json({ error: 'Ungültige Rolle für diese Organisation' });
      }

      // Prüfen ob Benutzername bereits existiert (GLOBAL eindeutig!)
      const { rows: [existingUser] } = await db.query(
        "SELECT id FROM users WHERE username = $1",
        [username]
      );

      if (existingUser) {
        return res.status(409).json({ error: 'Benutzername existiert bereits (muss systemweit eindeutig sein)' });
      }

      // Hash password
      const passwordHash = bcrypt.hashSync(password, 10);

      const insertQuery = `
        INSERT INTO users (organization_id, username, email, display_name, role_title, password_hash, role_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `;
      const insertParams = [organizationId, username, email, display_name, role_title || null, passwordHash, role_id];
      const { rows: [newUser] } = await db.query(insertQuery, insertParams);

      res.status(201).json({
        id: newUser.id,
        message: 'Benutzer erfolgreich erstellt',
        username,
        display_name
      });

    } catch (err) {
      // '23505' is the code for unique_violation in PostgreSQL
      if (err.code === '23505') {
        return res.status(409).json({ error: 'Benutzername oder E-Mail existiert bereits' });
      }
 console.error('Database error in POST /users:', err);
      res.status(500).json({ error: 'Datenbankfehler' });
    }
  });

  // Update user
  router.put('/:id', rbacVerifier, requireOrgAdmin, userHierarchyMiddleware('update'), validateUpdateUser, async (req, res) => {
    const { id } = req.params;
    const organizationId = req.user.organization_id;
    const { username, email, display_name, role_title, role_id, is_active, password } = req.body;

    try {
      // Check if user exists in organization
      const { rows: [user] } = await db.query("SELECT id FROM users WHERE id = $1 AND organization_id = $2", [id, organizationId]);
      if (!user) {
        return res.status(404).json({ error: 'Benutzer in dieser Organisation nicht gefunden' });
      }

      // Verify role exists in organization if role_id is provided
      if (role_id) {
        const { rows: [role] } = await db.query("SELECT id FROM roles WHERE id = $1 AND organization_id = $2", [role_id, organizationId]);
        if (!role) {
          return res.status(400).json({ error: 'Ungültige Rolle für diese Organisation' });
        }
      }

      let updateParams = [];
      let updateFields = [];

      function addUpdate(field, value) {
        if (value !== undefined) {
          updateFields.push(`${field} = $${updateParams.length + 1}`);
          updateParams.push(value);
        }
      }

      addUpdate('username', username);
      addUpdate('email', email);
      addUpdate('display_name', display_name);
      addUpdate('role_title', role_title);
      addUpdate('role_id', role_id);
      addUpdate('is_active', is_active);

      if (password) {
        updateFields.push(`password_hash = $${updateParams.length + 1}`);
        updateParams.push(bcrypt.hashSync(password, 10));
      }

      if (updateFields.length === 0) {
        return res.status(400).json({ error: 'Keine Felder zum Aktualisieren' });
      }

      updateFields.push('updated_at = NOW()');

      updateParams.push(id, organizationId);
      const whereClause = `WHERE id = $${updateParams.length - 1} AND organization_id = $${updateParams.length}`;
      let updateQuery = `UPDATE users SET ${updateFields.join(', ')} ${whereClause}`;

      const { rowCount } = await db.query(updateQuery, updateParams);

      if (rowCount === 0) {
        // This case should theoretically not be hit due to the initial check, but is good for safety.
        return res.status(404).json({ error: 'Benutzer nicht gefunden' });
      }

      res.json({ message: 'Benutzer erfolgreich aktualisiert' });

    } catch (err) {
      if (err.code === '23505') {
        return res.status(409).json({ error: 'Benutzername oder E-Mail existiert bereits' });
      }
 console.error(`Database error in PUT /users/${id}:`, err);
      res.status(500).json({ error: 'Datenbankfehler' });
    }
  });

  // Delete user
  router.delete('/:id', rbacVerifier, requireOrgAdmin, userHierarchyMiddleware('delete'), validateUserId, async (req, res) => {
    const { id } = req.params;
    const organizationId = req.user.organization_id;

    // Prevent self-deletion
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: 'Du kannst dein eigenes Konto nicht löschen' });
    }

    try {
      await db.query('BEGIN');

      // Delete user jahrgang assignments
      await db.query("DELETE FROM user_jahrgang_assignments WHERE user_id = $1", [id]);

      // Delete user
      const deleteUserResult = await db.query("DELETE FROM users WHERE id = $1 AND organization_id = $2", [id, organizationId]);

      if (deleteUserResult.rowCount === 0) {
        await db.query('ROLLBACK');
        return res.status(404).json({ error: 'Benutzer in dieser Organisation nicht gefunden' });
      }

      await db.query('COMMIT');
      res.json({ message: 'Benutzer erfolgreich gelöscht' });

    } catch (err) {
 await db.query('ROLLBACK').catch(rbErr => console.error('Rollback failed:', rbErr));
 console.error(`Database error in DELETE /users/${id}:`, err);
      res.status(500).json({ error: 'Datenbankfehler' });
    }
  });

  // Assign jahrgaenge to user
  router.post('/:id/jahrgaenge', rbacVerifier, requireOrgAdmin, validateJahrgangAssignments, async (req, res) => {
    const { id: userId } = req.params;
    const organizationId = req.user.organization_id;
    const { jahrgang_assignments } = req.body; // [{ jahrgang_id, can_view, can_edit }]

    if (!Array.isArray(jahrgang_assignments)) {
      return res.status(400).json({ error: 'jahrgang_assignments must be an array' });
    }

    try {
        // Check if user exists in organization
        const { rows: [user] } = await db.query("SELECT id FROM users WHERE id = $1 AND organization_id = $2", [userId, organizationId]);
        if (!user) {
            return res.status(404).json({ error: 'Benutzer in dieser Organisation nicht gefunden' });
        }

        await db.query('BEGIN');

        // Get current assignments to determine chat changes
        const { rows: currentAssignments } = await db.query(
            "SELECT jahrgang_id FROM user_jahrgang_assignments WHERE user_id = $1", 
            [userId]
        );
        const currentJahrgangIds = currentAssignments.map(a => a.jahrgang_id);
        const newJahrgangIds = jahrgang_assignments.map(a => a.jahrgang_id);
        
        // Find jahrgänge that are being removed
        const removedJahrgangIds = currentJahrgangIds.filter(id => !newJahrgangIds.includes(id));
        
        // Find jahrgänge that are being added  
        const addedJahrgangIds = newJahrgangIds.filter(id => !currentJahrgangIds.includes(id));
        
        // Remove from chat rooms for removed jahrgänge BEFORE deleting assignments
        for (const jahrgangId of removedJahrgangIds) {
            const chatRoomQuery = `
                SELECT id FROM chat_rooms 
                WHERE type = 'jahrgang' AND jahrgang_id = $1 AND organization_id = $2
            `;
            const { rows: [chatRoom] } = await db.query(chatRoomQuery, [jahrgangId, organizationId]);
            
            if (chatRoom) {
                await db.query(
                    "DELETE FROM chat_participants WHERE room_id = $1 AND user_id = $2", 
                    [chatRoom.id, userId]
                );
 console.log(`Removed user ${userId} from jahrgang chat ${chatRoom.id} (Jahrgang ${jahrgangId})`);
            }
        }

        // Delete existing assignments for this user
        await db.query("DELETE FROM user_jahrgang_assignments WHERE user_id = $1", [userId]);

        if (jahrgang_assignments.length > 0) {
            // First, verify all jahrgaenge exist in the organization
            const jahrgangIds = jahrgang_assignments.map(a => a.jahrgang_id);
            const placeholders = jahrgangIds.map((_, i) => `$${i + 2}`).join(',');
            const verifyQuery = `SELECT id FROM jahrgaenge WHERE organization_id = $1 AND id IN (${placeholders})`;
            const { rows: validJahrgaenge } = await db.query(verifyQuery, [organizationId, ...jahrgangIds]);

            if (validJahrgaenge.length !== jahrgangIds.length) {
                await db.query('ROLLBACK');
                return res.status(400).json({ error: 'Mindestens eine Jahrgangs-ID ist ungültig oder gehört nicht zu dieser Organisation.' });
            }

            // Now, insert all new assignments
            for (const assignment of jahrgang_assignments) {
                const { jahrgang_id, can_view = true, can_edit = false } = assignment;
                const insertQuery = `
                    INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id, can_view, can_edit, assigned_by)
                    VALUES ($1, $2, $3, $4, $5)
                `;
                await db.query(insertQuery, [userId, jahrgang_id, can_view, can_edit, req.user.id]);
            }
            
            // Add to chat rooms for new jahrgänge AFTER creating assignments
            for (const jahrgangId of addedJahrgangIds) {
                // First ensure chat room exists
                let { rows: [chatRoom] } = await db.query(
                    "SELECT id FROM chat_rooms WHERE type = 'jahrgang' AND jahrgang_id = $1 AND organization_id = $2",
                    [jahrgangId, organizationId]
                );
                
                // Create chat room if it doesn't exist
                if (!chatRoom) {
                    const { rows: [jahrgang] } = await db.query("SELECT name FROM jahrgaenge WHERE id = $1", [jahrgangId]);
                    if (jahrgang) {
                        const createChatQuery = `
                            INSERT INTO chat_rooms (name, type, jahrgang_id, organization_id, created_by, created_at) 
                            VALUES ($1, 'jahrgang', $2, $3, $4, NOW()) 
                            RETURNING id
                        `;
                        const { rows: [newChatRoom] } = await db.query(createChatQuery, [
                            `Jahrgang ${jahrgang.name}`, 
                            jahrgangId, 
                            organizationId, 
                            req.user.id
                        ]);
                        chatRoom = newChatRoom;
 console.log(`Created missing jahrgang chat room ${chatRoom.id} for Jahrgang ${jahrgang.name}`);
                    }
                }
                
                // Add user to chat room
                if (chatRoom) {
                    // Check if not already a participant
                    const { rows: [existingParticipant] } = await db.query(
                        "SELECT id FROM chat_participants WHERE room_id = $1 AND user_id = $2",
                        [chatRoom.id, userId]
                    );
                    
                    if (!existingParticipant) {
                        // Get user type
                        const { rows: [userInfo] } = await db.query(
                            "SELECT r.name as role_name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = $1",
                            [userId]
                        );
                        const userType = userInfo?.role_name === 'konfi' ? 'konfi' : 'admin';
                        
                        await db.query(
                            "INSERT INTO chat_participants (room_id, user_id, user_type, joined_at) VALUES ($1, $2, $3, NOW())",
                            [chatRoom.id, userId, userType]
                        );
 console.log(`Added user ${userId} (${userType}) to jahrgang chat ${chatRoom.id} (Jahrgang ${jahrgangId})`);
                    }
                }
            }
        }

        await db.query('COMMIT');
        res.json({
            message: jahrgang_assignments.length > 0 ? 'Jahrgang assignments updated successfully' : 'All jahrgang assignments removed successfully',
            assignments_count: jahrgang_assignments.length
        });

    } catch (err) {
 await db.query('ROLLBACK').catch(rbErr => console.error('Rollback failed:', rbErr));
 console.error(`Database error in POST /users/${userId}/jahrgaenge:`, err);
        res.status(500).json({ error: 'Datenbankfehler beim Zuweisen der Jahrgänge' });
    }
  });


  // Get user's jahrgang assignments
  router.get('/:id/jahrgaenge', rbacVerifier, requireOrgAdmin, async (req, res) => {
    const { id } = req.params;
    const organizationId = req.user.organization_id;

    const query = `
      SELECT j.id, j.name, uja.can_view, uja.can_edit, uja.assigned_at,
             assigner.display_name as assigned_by_name
      FROM user_jahrgang_assignments uja
      JOIN jahrgaenge j ON uja.jahrgang_id = j.id
      LEFT JOIN users assigner ON uja.assigned_by = assigner.id
      WHERE uja.user_id = $1 AND j.organization_id = $2
      ORDER BY j.name
    `;

    try {
      const { rows } = await db.query(query, [id, organizationId]);
      res.json(rows);
    } catch (err) {
 console.error(`Database error in GET /users/${id}/jahrgaenge:`, err);
      res.status(500).json({ error: 'Datenbankfehler' });
    }
  });

  // ENTFERNT: /users/:id/permissions Route
  // Permissions sind jetzt rollen-basiert (hardcoded), keine DB-Abfrage mehr noetig

  // Get current user's assigned jahrgaenge
  router.get('/me/jahrgaenge', rbacVerifier, async (req, res) => {
    const userId = req.user.id;
    const organizationId = req.user.organization_id;

    const query = `
      SELECT uja.jahrgang_id, uja.can_view, uja.can_edit, uja.assigned_at,
             j.name as jahrgang_name, j.confirmation_date
      FROM user_jahrgang_assignments uja
      JOIN jahrgaenge j ON uja.jahrgang_id = j.id
      WHERE uja.user_id = $1 AND j.organization_id = $2
      ORDER BY j.name DESC
    `;

    try {
      const { rows } = await db.query(query, [userId, organizationId]);
      res.json(rows);
    } catch (err) {
 console.error('Database error in GET /me/jahrgaenge:', err);
      res.status(500).json({ error: 'Datenbankfehler' });
    }
  });

  // Reset password for a user (super_admin or org_admin of same org)
  router.put('/:id/reset-password', rbacVerifier, validateResetPassword, async (req, res) => {
    const { id } = req.params;
    const { password } = req.body;

    if (!password || password.length < 6) {
      return res.status(400).json({ error: 'Passwort muss mindestens 6 Zeichen lang sein' });
    }

    try {
      // Pruefen ob User existiert
      const { rows: [targetUser] } = await db.query(`
        SELECT u.id, u.organization_id, r.name as role_name
        FROM users u
        LEFT JOIN roles r ON u.role_id = r.id
        WHERE u.id = $1
      `, [id]);

      if (!targetUser) {
        return res.status(404).json({ error: 'Benutzer nicht gefunden' });
      }

      // Berechtigungspruefung
      const isSuperAdmin = req.user.role_name === 'super_admin';
      const isOrgAdmin = req.user.role_name === 'org_admin';
      const isSameOrg = req.user.organization_id === targetUser.organization_id;

      // super_admin darf alle resetten, org_admin nur in eigener Org
      if (!isSuperAdmin && !(isOrgAdmin && isSameOrg)) {
        return res.status(403).json({ error: 'Keine Berechtigung' });
      }

      // org_admin darf andere org_admins in seiner Org resetten (neue Regel)
      // Nur super_admin ist geschützt

      const hashedPassword = await bcrypt.hash(password, 10);
      await db.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [hashedPassword, id]);

 console.log(`Password reset by ${req.user.role_name} (ID: ${req.user.id}) for user ID ${id}`);
      res.json({ message: 'Passwort erfolgreich zurückgesetzt' });

    } catch (err) {
 console.error(`Database error in PUT /users/${id}/reset-password:`, err);
      res.status(500).json({ error: 'Datenbankfehler' });
    }
  });

  return router;
};