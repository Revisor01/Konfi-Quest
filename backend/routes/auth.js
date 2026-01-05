const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'konfi-secret-2025';

// Unified auth routes - combines all login functionality
module.exports = (db, verifyToken, transporter, SMTP_CONFIG, rateLimiters = {}) => {
  const { authLimiter, registerLimiter } = rateLimiters;
  
  // Helper function to send email
  const sendEmail = async (to, subject, html) => {
    try {
      const info = await transporter.sendMail({
        from: `"Konfi Quest" <${SMTP_CONFIG.auth.user}>`,
        to: to,
        subject: subject,
        html: html
      });
      console.log('✅ Email sent successfully:', info.messageId);
      return true;
    } catch (error) {
      console.error('❌ Email sending failed:', error);
      return false;
    }
  };

  // Generate password reset token
  const generateResetToken = () => {
    return crypto.randomBytes(32).toString('hex');
  };

  // ===== UNIFIED LOGIN ENDPOINTS =====

  // Rate Limiter Middleware für Login (falls vorhanden)
  const loginMiddleware = authLimiter ? [authLimiter] : [];

  // Unified RBAC login - works for both admins and konfis
  router.post('/login', ...loginMiddleware, async (req, res) => {
    const { username, password } = req.body;
    console.log(`🔐 RBAC login attempt for: ${username}`);

    try {
      const userQuery = `
        SELECT u.id, u.username, u.display_name, u.password_hash, u.organization_id, u.email, u.role_id,
               u.is_super_admin,
               o.name as organization_name, o.slug as organization_slug,
               r.name as role_name, r.display_name as role_display_name,
               kp.jahrgang_id, j.name as jahrgang_name,
               kp.gottesdienst_points, kp.gemeinde_points
        FROM users u
        LEFT JOIN organizations o ON u.organization_id = o.id
        LEFT JOIN roles r ON u.role_id = r.id
        LEFT JOIN konfi_profiles kp ON u.id = kp.user_id
        LEFT JOIN jahrgaenge j ON kp.jahrgang_id = j.id
        WHERE u.username = $1
      `;
      
      const { rows: [user] } = await db.query(userQuery, [username]);

      if (!user) {
        console.log(`❌ Login failed: user '${username}' not found`);
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      const passwordMatch = await bcrypt.compare(password, user.password_hash);
      if (!passwordMatch) {
        console.log(`❌ Login failed: wrong password for user '${username}'`);
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      const userType = user.role_name === 'konfi' ? 'konfi' : 'admin';
      console.log(`✅ ${userType} login successful: ${username} (${user.display_name})`);

      // JWT Token - Rollen-basiert (keine Permissions mehr)
      const token = jwt.sign({
        id: user.id,
        type: userType,
        display_name: user.display_name,
        email: user.email,
        organization_id: user.organization_id,
        role_name: user.role_name,
        is_super_admin: user.is_super_admin || false
      }, JWT_SECRET, { expiresIn: '24h' });

      const responseUser = {
        id: user.id,
        display_name: user.display_name,
        username: user.username,
        email: user.email,
        organization: user.organization_name,
        role_name: user.role_name,
        type: userType,
        is_super_admin: user.is_super_admin || false
      };
    
      if (userType === 'konfi') {
        responseUser.jahrgang = user.jahrgang_name;
        responseUser.gottesdienst_points = user.gottesdienst_points || 0;
        responseUser.gemeinde_points = user.gemeinde_points || 0;
      }
      
      res.json({ token, user: responseUser });

    } catch (err) {
      console.error('Database error in POST /api/auth/login:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // ===== PASSWORD MANAGEMENT =====

  // Change password (for authenticated users)
  router.post('/change-password', verifyToken, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Aktuelles und neues Passwort sind erforderlich' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Das neue Passwort muss mindestens 6 Zeichen lang sein' });
    }
    
    try {
      const { rows: [user] } = await db.query(`SELECT * FROM users WHERE id = $1`, [userId]);
      if (!user) {
        return res.status(404).json({ error: 'Benutzer nicht gefunden' });
      }
      
      const passwordMatch = await bcrypt.compare(currentPassword, user.password_hash);
      if (!passwordMatch) {
        return res.status(400).json({ error: 'Aktuelles Passwort ist falsch' });
      }
      
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      
      await db.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [hashedPassword, userId]);
      
      console.log(`✅ Password changed for ${req.user.type} ID ${userId}`);
      res.json({ message: 'Passwort erfolgreich geändert' });

    } catch (err) {
      console.error('Database error in POST /api/auth/change-password:', err);
      res.status(500).json({ error: 'Fehler beim Ändern des Passworts' });
    }
  });

  // Update email address (for authenticated users)
  router.post('/update-email', verifyToken, async (req, res) => {
    const { email } = req.body;
    const userId = req.user.id;

    // E-Mail ist optional - wenn angegeben, muss sie gueltig sein
    const trimmedEmail = email?.trim() || null;

    if (trimmedEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedEmail)) {
        return res.status(400).json({ error: 'Ungültige E-Mail-Adresse' });
      }
    }

    try {
      await db.query(`UPDATE users SET email = $1 WHERE id = $2`, [trimmedEmail, userId]);

      console.log(`✅ Email updated for ${req.user.type} ID ${userId} to ${trimmedEmail || '(removed)'}`);
      res.json({ message: 'E-Mail-Adresse erfolgreich aktualisiert', email: trimmedEmail });

    } catch (err) {
        if (err.code === '23505') { // unique_violation for email
            return res.status(409).json({ error: 'Diese E-Mail-Adresse wird bereits verwendet.' });
        }
        console.error('Database error in POST /api/auth/update-email:', err);
        res.status(500).json({ error: 'Fehler beim Aktualisieren der E-Mail-Adresse' });
    }
  });

  // Update role title / Funktionsbeschreibung (for authenticated users - only admins/teamers)
  router.post('/update-role-title', verifyToken, async (req, res) => {
    const { role_title } = req.body;
    const userId = req.user.id;

    // Nur Admins und Teamer können ihren Titel ändern (keine Konfis)
    if (req.user.type === 'konfi') {
      return res.status(403).json({ error: 'Konfis können keine Funktionsbeschreibung setzen' });
    }

    try {
      // Leerer String oder null wird als NULL gespeichert
      const titleValue = role_title?.trim() || null;

      await db.query(`UPDATE users SET role_title = $1 WHERE id = $2`, [titleValue, userId]);

      console.log(`✅ Role title updated for ${req.user.type} ID ${userId} to "${titleValue}"`);
      res.json({
        message: 'Funktionsbeschreibung erfolgreich aktualisiert',
        role_title: titleValue
      });

    } catch (err) {
      console.error('Database error in POST /api/auth/update-role-title:', err);
      res.status(500).json({ error: 'Fehler beim Aktualisieren der Funktionsbeschreibung' });
    }
  });

  // Get current user profile (for authenticated users)
  router.get('/me', verifyToken, async (req, res) => {
    const userId = req.user.id;

    try {
      const { rows: [user] } = await db.query(`
        SELECT u.id, u.username, u.display_name, u.email, u.role_title,
               r.name as role_name, r.display_name as role_display_name
        FROM users u
        LEFT JOIN roles r ON u.role_id = r.id
        WHERE u.id = $1
      `, [userId]);

      if (!user) {
        return res.status(404).json({ error: 'Benutzer nicht gefunden' });
      }

      res.json(user);

    } catch (err) {
      console.error('Database error in GET /api/auth/me:', err);
      res.status(500).json({ error: 'Fehler beim Laden des Profils' });
    }
  });

  // Request password reset (mit Rate Limiting gegen Spam)
  router.post('/request-password-reset', ...loginMiddleware, async (req, res) => {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'E-Mail-Adresse ist erforderlich' });
    
    try {
      const query = `
        SELECT u.id, u.email, u.display_name as name, r.name as role_name
        FROM users u
        LEFT JOIN roles r ON u.role_id = r.id
        WHERE u.email = $1
      `;
      const { rows: [user] } = await db.query(query, [email]);
      
      if (user) {
        const userType = user.role_name === 'konfi' ? 'konfi' : 'admin';
        const token = generateResetToken();
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
        
        await db.query('INSERT INTO password_resets (user_id, user_type, token, expires_at) VALUES ($1, $2, $3, $4)',
          [user.id, userType, token, expiresAt]);
          
        const resetUrl = `https://konfi-quest.de/reset-password?token=${token}`;
        const emailHtml = `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #667eea;">Konfi Quest - Passwort zurücksetzen</h2>
                <p>Hallo ${user.name},</p>
                <p>du hast eine Passwort-Zurücksetzung für dein Konfi Quest Konto angefordert.</p>
                <p>Klicke auf den folgenden Link um dein Passwort zurückzusetzen:</p>
                <p style="margin: 20px 0;">
                  <a href="${resetUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">
                    Passwort zurücksetzen
                  </a>
                </p>
                <p><strong>Dieser Link ist 24 Stunden gültig.</strong></p>
                <p>Falls du diese Anfrage nicht gestellt hast, kannst du diese E-Mail ignorieren.</p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
                <p style="color: #666; font-size: 0.9rem;">
                  Mit freundlichen Grüßen,<br>
                  Das Konfi Quest Team
                </p>
              </div>
            `;
        
        const emailSent = await sendEmail(email, 'Konfi Quest - Passwort zurücksetzen', emailHtml);
        
        if (!emailSent) {
          // The error is already logged in sendEmail, but we should inform the client
          return res.status(500).json({ error: 'Fehler beim Senden der E-Mail' });
        }
      }

      // Always return a success message to not reveal if an email exists or not
      console.log(`Password reset request processed for email: ${email}`);
      res.json({ message: 'Falls ein Konto mit dieser E-Mail-Adresse existiert, wurde eine Reset-E-Mail gesendet' });

    } catch (err) {
      console.error('Database error in POST /api/auth/request-password-reset:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // ===== INVITE CODE SYSTEM =====

  // Generate invite code for Konfi registration (org_admin only)
  router.post('/invite-code', verifyToken, async (req, res) => {
    const { jahrgang_id } = req.body;
    const userId = req.user.id;
    const organizationId = req.user.organization_id;

    // Only org_admin can generate invite codes
    if (req.user.role_name !== 'org_admin' && !req.user.is_super_admin) {
      return res.status(403).json({ error: 'Nur Org-Admins können Einladungscodes erstellen' });
    }

    if (!jahrgang_id) {
      return res.status(400).json({ error: 'Jahrgang ist erforderlich' });
    }

    try {
      // Verify jahrgang belongs to same organization
      const { rows: [jahrgang] } = await db.query(
        'SELECT id, name FROM jahrgaenge WHERE id = $1 AND organization_id = $2',
        [jahrgang_id, organizationId]
      );

      if (!jahrgang) {
        return res.status(404).json({ error: 'Jahrgang nicht gefunden' });
      }

      // Generate unique invite code (8 characters, uppercase alphanumeric)
      const inviteCode = crypto.randomBytes(4).toString('hex').toUpperCase();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      // Store invite code
      await db.query(`
        INSERT INTO invite_codes (code, organization_id, jahrgang_id, created_by, expires_at)
        VALUES ($1, $2, $3, $4, $5)
      `, [inviteCode, organizationId, jahrgang_id, userId, expiresAt]);

      console.log(`✅ Invite code ${inviteCode} created for jahrgang ${jahrgang.name} by user ${userId}`);
      res.json({
        invite_code: inviteCode,
        jahrgang_name: jahrgang.name,
        expires_at: expiresAt
      });

    } catch (err) {
      console.error('Database error in POST /api/auth/invite-code:', err);
      res.status(500).json({ error: 'Fehler beim Erstellen des Einladungscodes' });
    }
  });

  // Get all invite codes for organization (org_admin only)
  router.get('/invite-codes', verifyToken, async (req, res) => {
    const organizationId = req.user.organization_id;

    if (req.user.role_name !== 'org_admin') {
      return res.status(403).json({ error: 'Nur Administratoren können Einladungscodes einsehen' });
    }

    try {
      const { rows } = await db.query(`
        SELECT ic.id, ic.code as invite_code, ic.jahrgang_id, j.name as jahrgang_name,
               ic.expires_at, ic.created_at,
               (SELECT COUNT(*) FROM users u
                JOIN konfi_profiles kp ON u.id = kp.user_id
                WHERE kp.invite_code_id = ic.id) as used_count
        FROM invite_codes ic
        JOIN jahrgaenge j ON ic.jahrgang_id = j.id
        WHERE ic.organization_id = $1 AND ic.expires_at > NOW()
        ORDER BY ic.created_at DESC
      `, [organizationId]);

      res.json(rows);

    } catch (err) {
      console.error('Database error in GET /api/auth/invite-codes:', err);
      res.status(500).json({ error: 'Fehler beim Laden der Einladungscodes' });
    }
  });

  // Extend invite code by 7 days (org_admin only)
  router.post('/invite-codes/:id/extend', verifyToken, async (req, res) => {
    const { id } = req.params;
    const organizationId = req.user.organization_id;

    if (req.user.role_name !== 'org_admin') {
      return res.status(403).json({ error: 'Nur Administratoren können Einladungscodes verlängern' });
    }

    try {
      const { rows: [invite] } = await db.query(`
        SELECT * FROM invite_codes WHERE id = $1 AND organization_id = $2
      `, [id, organizationId]);

      if (!invite) {
        return res.status(404).json({ error: 'Einladungscode nicht gefunden' });
      }

      // Add 7 days to current expiry
      const newExpiry = new Date(invite.expires_at);
      newExpiry.setDate(newExpiry.getDate() + 7);

      await db.query(`
        UPDATE invite_codes SET expires_at = $1 WHERE id = $2
      `, [newExpiry, id]);

      res.json({ message: 'Einladungscode verlängert', expires_at: newExpiry });

    } catch (err) {
      console.error('Database error in POST /api/auth/invite-codes/:id/extend:', err);
      res.status(500).json({ error: 'Fehler beim Verlängern des Einladungscodes' });
    }
  });

  // Validate invite code (public endpoint)
  router.get('/validate-invite/:code', async (req, res) => {
    const { code } = req.params;

    try {
      const { rows: [invite] } = await db.query(`
        SELECT ic.*, j.name as jahrgang_name, COALESCE(o.display_name, o.name) as organization_name
        FROM invite_codes ic
        JOIN jahrgaenge j ON ic.jahrgang_id = j.id
        JOIN organizations o ON ic.organization_id = o.id
        WHERE ic.code = $1 AND ic.expires_at > NOW() AND ic.used_at IS NULL
      `, [code.toUpperCase()]);

      if (!invite) {
        return res.status(400).json({ error: 'Ungültiger oder abgelaufener Einladungscode' });
      }

      res.json({
        valid: true,
        jahrgang_name: invite.jahrgang_name,
        organization_name: invite.organization_name
      });

    } catch (err) {
      console.error('Database error in GET /api/auth/validate-invite:', err);
      res.status(500).json({ error: 'Fehler bei der Validierung' });
    }
  });

  // Register new Konfi with invite code (public endpoint)
  router.post('/register-konfi', async (req, res) => {
    const { invite_code, display_name, username, password, email } = req.body;

    if (!invite_code || !display_name || !username || !password) {
      return res.status(400).json({ error: 'Alle Felder sind erforderlich' });
    }

    // Passwort-Validierung: min 8 Zeichen, Groß/Klein, Zahl, Sonderzeichen
    if (password.length < 8) {
      return res.status(400).json({ error: 'Passwort muss mindestens 8 Zeichen lang sein' });
    }
    if (!/[A-Z]/.test(password)) {
      return res.status(400).json({ error: 'Passwort muss mindestens einen Großbuchstaben enthalten' });
    }
    if (!/[a-z]/.test(password)) {
      return res.status(400).json({ error: 'Passwort muss mindestens einen Kleinbuchstaben enthalten' });
    }
    if (!/[0-9]/.test(password)) {
      return res.status(400).json({ error: 'Passwort muss mindestens eine Zahl enthalten' });
    }
    if (!/[!@#$%^&*(),.?":{}|<>_\-+=\[\]\\\/~`]/.test(password)) {
      return res.status(400).json({ error: 'Passwort muss mindestens ein Sonderzeichen enthalten' });
    }

    if (username.length < 3) {
      return res.status(400).json({ error: 'Benutzername muss mindestens 3 Zeichen lang sein' });
    }

    // Optional: E-Mail validieren wenn angegeben
    if (email && email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({ error: 'Ungültige E-Mail-Adresse' });
      }
    }

    try {
      // Validate invite code
      const { rows: [invite] } = await db.query(`
        SELECT ic.*, j.name as jahrgang_name
        FROM invite_codes ic
        JOIN jahrgaenge j ON ic.jahrgang_id = j.id
        WHERE ic.code = $1 AND ic.expires_at > NOW() AND ic.used_at IS NULL
      `, [invite_code.toUpperCase()]);

      if (!invite) {
        return res.status(400).json({ error: 'Ungültiger oder abgelaufener Einladungscode' });
      }

      // Check if username already exists
      const { rows: existingUsers } = await db.query(
        'SELECT id FROM users WHERE username = $1',
        [username.toLowerCase()]
      );

      if (existingUsers.length > 0) {
        return res.status(409).json({ error: 'Benutzername bereits vergeben' });
      }

      // Get konfi role id
      const { rows: [konfiRole] } = await db.query("SELECT id FROM roles WHERE name = 'konfi'");
      if (!konfiRole) {
        return res.status(500).json({ error: 'Konfi-Rolle nicht gefunden' });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Create user in transaction
      const client = await db.connect();
      try {
        await client.query('BEGIN');

        // Create user (mit optionaler E-Mail)
        const { rows: [newUser] } = await client.query(`
          INSERT INTO users (username, display_name, password_hash, role_id, organization_id, email)
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING id
        `, [username.toLowerCase(), display_name, passwordHash, konfiRole.id, invite.organization_id, email?.trim() || null]);

        // Create konfi profile
        await client.query(`
          INSERT INTO konfi_profiles (user_id, jahrgang_id, gottesdienst_points, gemeinde_points)
          VALUES ($1, $2, 0, 0)
        `, [newUser.id, invite.jahrgang_id]);

        // Mark invite code as used (optional - can be reused)
        // await client.query('UPDATE invite_codes SET used_at = NOW() WHERE id = $1', [invite.id]);

        await client.query('COMMIT');

        console.log(`✅ New Konfi registered: ${display_name} (${username}) for jahrgang ${invite.jahrgang_name}`);
        res.json({
          message: 'Registrierung erfolgreich',
          user: {
            id: newUser.id,
            display_name: display_name,
            username: username,
            jahrgang: invite.jahrgang_name
          }
        });

      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }

    } catch (err) {
      if (err.code === '23505') { // unique constraint
        return res.status(409).json({ error: 'Benutzername bereits vergeben' });
      }
      console.error('Database error in POST /api/auth/register-konfi:', err);
      res.status(500).json({ error: 'Fehler bei der Registrierung' });
    }
  });

  // Reset password with token
  router.post('/reset-password', async (req, res) => {
    const { token, newPassword } = req.body;
    
    if (!token || !newPassword) return res.status(400).json({ error: 'Token und neues Passwort sind erforderlich' });
    if (newPassword.length < 6) return res.status(400).json({ error: 'Das Passwort muss mindestens 6 Zeichen lang sein' });
    
    try {
      const { rows: [resetRecord] } = await db.query(
        'SELECT * FROM password_resets WHERE token = $1 AND used_at IS NULL AND expires_at > NOW()',
        [token]
      );

      if (!resetRecord) {
        return res.status(400).json({ error: 'Ungültiger oder abgelaufener Reset-Token' });
      }
      
      const hashedPassword = await bcrypt.hash(newPassword, 10);
      
      await db.query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [hashedPassword, resetRecord.user_id]);
      await db.query('UPDATE password_resets SET used_at = NOW() WHERE id = $1', [resetRecord.id]);
      
      console.log(`✅ Password reset successful for ${resetRecord.user_type} ID ${resetRecord.user_id}`);
      res.json({ message: 'Passwort erfolgreich zurückgesetzt' });

    } catch (err) {
      console.error('Database error in POST /api/auth/reset-password:', err);
      res.status(500).json({ error: 'Fehler beim Zurücksetzen des Passworts' });
    }
  });

  return router;
};