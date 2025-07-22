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
  router.post('/login', (req, res) => {
    const { username, password } = req.body;
    
    console.log(`🔐 RBAC login attempt for: ${username}`);
    
    // Try login via unified users table (both admins and konfis)
    const userQuery = `
      SELECT u.id, u.username, u.display_name, u.password_hash, u.organization_id, u.email,
             o.name as organization_name, o.slug as organization_slug,
             r.name as role_name, r.display_name as role_display_name,
             kp.jahrgang_id, j.name as jahrgang_name,
             kp.gottesdienst_points, kp.gemeinde_points
      FROM users u 
      LEFT JOIN organizations o ON u.organization_id = o.id
      LEFT JOIN roles r ON u.role_id = r.id
      LEFT JOIN konfi_profiles kp ON u.id = kp.user_id
      LEFT JOIN jahrgaenge j ON kp.jahrgang_id = j.id
      WHERE u.username = ?
    `;
    
    db.get(userQuery, [username], (err, user) => {
      if (err) {
        console.error('Login database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!user) {
        console.log(`❌ Login failed: user '${username}' not found`);
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      if (!bcrypt.compareSync(password, user.password_hash)) {
        console.log(`❌ Login failed: wrong password for user '${username}'`);
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      // Determine user type based on role
      const userType = user.role_name === 'konfi' ? 'konfi' : 'admin';
      
      console.log(`✅ ${userType} login successful: ${username} (${user.display_name})`);
      
      // Get user permissions
      const permissionsQuery = `
        SELECT p.name
        FROM permissions p
        JOIN role_permissions rp ON p.id = rp.permission_id
        WHERE rp.role_id = ? AND rp.granted = 1
      `;
      
      db.all(permissionsQuery, [user.role_id], (err, permissions) => {
        if (err) {
          console.error('Error fetching user permissions:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        
        const userPermissions = permissions.map(p => p.name);
        
        const token = jwt.sign({ 
          id: user.id, 
          type: userType, 
          display_name: user.display_name,
          email: user.email,
          organization_id: user.organization_id,
          role_name: user.role_name,
          permissions: userPermissions
        }, JWT_SECRET, { expiresIn: '24h' });
        
        const responseUser = {
          id: user.id, 
          display_name: user.display_name, 
          username: user.username,
          email: user.email,
          organization: user.organization_name,
          role_name: user.role_name,
          type: userType,
          permissions: userPermissions
        };
      
        // Add konfi-specific data if user is konfi
        if (userType === 'konfi') {
          responseUser.jahrgang = user.jahrgang_name;
          responseUser.gottesdienst_points = user.gottesdienst_points || 0;
          responseUser.gemeinde_points = user.gemeinde_points || 0;
        }
        
        res.json({ 
          token, 
          user: responseUser
        });
      });
    });
  });

  // ===== PASSWORD MANAGEMENT =====

  // Change password (for authenticated users)
  router.post('/change-password', verifyToken, (req, res) => {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;
    const userType = req.user.type;
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Aktuelles und neues Passwort sind erforderlich' });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Das neue Passwort muss mindestens 6 Zeichen lang sein' });
    }
    
    // Get current user from users table
    db.get(`SELECT * FROM users WHERE id = ?`, [userId], (err, user) => {
      if (err || !user) {
        return res.status(404).json({ error: 'Benutzer nicht gefunden' });
      }
      
      // Verify current password
      if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
        return res.status(400).json({ error: 'Aktuelles Passwort ist falsch' });
      }
      
      // Hash new password
      const hashedPassword = bcrypt.hashSync(newPassword, 10);
      
      // Update password in users table
      const updateQuery = `UPDATE users SET password_hash = ? WHERE id = ?`;
      const params = [hashedPassword, userId];
      
      db.run(updateQuery, params, function(err) {
        if (err) {
          console.error('Password change error:', err);
          return res.status(500).json({ error: 'Fehler beim Ändern des Passworts' });
        }
        
        console.log(`✅ Password changed for ${userType} ID ${userId}`);
        res.json({ message: 'Passwort erfolgreich geändert' });
      });
    });
  });

  // Update email address (for authenticated users)
  router.post('/update-email', verifyToken, (req, res) => {
    const { email } = req.body;
    const userId = req.user.id;
    const userType = req.user.type;
    
    if (!email) {
      return res.status(400).json({ error: 'E-Mail-Adresse ist erforderlich' });
    }
    
    // Simple email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Ungültige E-Mail-Adresse' });
    }
    
    db.run(`UPDATE users SET email = ? WHERE id = ?`, [email, userId], function(err) {
      if (err) {
        console.error('Email update error:', err);
        return res.status(500).json({ error: 'Fehler beim Aktualisieren der E-Mail-Adresse' });
      }
      
      console.log(`✅ Email updated for ${userType} ID ${userId} to ${email}`);
      res.json({ message: 'E-Mail-Adresse erfolgreich aktualisiert' });
    });
  });

  // Request password reset
  router.post('/request-password-reset', (req, res) => {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: 'E-Mail-Adresse ist erforderlich' });
    }
    
    // Check in users table with role-based type determination
    const query = `
      SELECT u.id, u.email, u.display_name as name, r.name as role_name
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.email = ?
    `;
    
    db.get(query, [email], async (err, user) => {
      if (err) {
        console.error('Password reset query error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (user) {
        // Determine user type based on role
        const userType = user.role_name === 'konfi' ? 'konfi' : 'admin';
        
        // Generate reset token
        const token = generateResetToken();
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
        
        // Save reset token
        db.run('INSERT INTO password_resets (user_id, user_type, token, expires_at) VALUES (?, ?, ?, ?)',
          [user.id, userType, token, expiresAt], async (err) => {
          if (err) {
            console.error('Reset token save error:', err);
            return res.status(500).json({ error: 'Fehler beim Erstellen des Reset-Tokens' });
          }
            
            // Send reset email
            const resetUrl = `https://konfipoints.godsapp.de/reset-password?token=${token}`;
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
          
          if (emailSent) {
            console.log(`✅ Password reset email sent to ${email} for ${userType} ${user.name}`);
            res.json({ message: 'Password-Reset-E-Mail wurde gesendet' });
          } else {
            res.status(500).json({ error: 'Fehler beim Senden der E-Mail' });
          }
        });
      } else {
        // Don't reveal if email exists or not for security
        res.json({ message: 'Falls ein Konto mit dieser E-Mail-Adresse existiert, wurde eine Reset-E-Mail gesendet' });
      }
    });
  });

  // Reset password with token
  router.post('/reset-password', (req, res) => {
    const { token, newPassword } = req.body;
    
    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token und neues Passwort sind erforderlich' });
    }
    
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Das Passwort muss mindestens 6 Zeichen lang sein' });
    }
    
    // Find valid reset token
    db.get('SELECT * FROM password_resets WHERE token = ? AND used_at IS NULL AND expires_at > datetime("now")',
      [token], (err, resetRecord) => {
      if (err || !resetRecord) {
        return res.status(400).json({ error: 'Ungültiger oder abgelaufener Reset-Token' });
      }
      
      const hashedPassword = bcrypt.hashSync(newPassword, 10);
      
      // Update password in users table
      const updateQuery = `UPDATE users SET password_hash = ? WHERE id = ?`;
      const params = [hashedPassword, resetRecord.user_id];
      
      db.run(updateQuery, params, function(err) {
        if (err) {
          console.error('Password reset error:', err);
          return res.status(500).json({ error: 'Fehler beim Zurücksetzen des Passworts' });
        }
        
        // Mark token as used
        db.run('UPDATE password_resets SET used_at = datetime("now") WHERE id = ?', 
          [resetRecord.id], (err) => {
          if (err) {
            console.error('Token update error:', err);
          }
          
          console.log(`✅ Password reset successful for ${resetRecord.user_type} ID ${resetRecord.user_id}`);
          res.json({ message: 'Passwort erfolgreich zurückgesetzt' });
        });
      });
    });
  });

  return router;
};