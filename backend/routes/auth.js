const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'konfi-secret-2025';

// Unified auth routes - combines all login functionality
module.exports = (db, verifyToken, transporter, SMTP_CONFIG) => {
  
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
  
  // Unified RBAC login - works for both admins and konfis
  router.post('/login', async (req, res) => {
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

    if (!email) return res.status(400).json({ error: 'E-Mail-Adresse ist erforderlich' });

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Ungültige E-Mail-Adresse' });
    }

    try {
      await db.query(`UPDATE users SET email = $1 WHERE id = $2`, [email, userId]);

      console.log(`✅ Email updated for ${req.user.type} ID ${userId} to ${email}`);
      res.json({ message: 'E-Mail-Adresse erfolgreich aktualisiert' });

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

  // Request password reset
  router.post('/request-password-reset', async (req, res) => {
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