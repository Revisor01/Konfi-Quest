const express = require('express');
const { sendFirebasePushNotification } = require('../push/firebase');

module.exports = (db, verifyTokenRBAC) => {
  const router = express.Router();

  router.post('/device-token', verifyTokenRBAC, (req, res) => {
    const { token, platform } = req.body;
    const userId = req.user.id;
    const userType = req.user.type;

    console.log('📱 Device Token Registration Request:');
    console.log('User ID:', userId);
    console.log('User Type:', userType);
    console.log('Platform:', platform);
    console.log('Token (first 20 chars):', token ? token.substring(0, 20) + '...' : 'NO TOKEN');

    if (!token || !platform) {
      console.log('❌ Missing token or platform');
      return res.status(400).json({ error: 'Token and platform required' });
    }

    // Check if push_tokens table exists
    db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='push_tokens'", (err, row) => {
      if (err) {
        console.error('❌ Error checking push_tokens table:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!row) {
        console.log('⚠️ push_tokens table does not exist, creating...');
        db.run(`CREATE TABLE IF NOT EXISTS push_tokens (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          user_type TEXT NOT NULL,
          token TEXT NOT NULL,
          platform TEXT NOT NULL,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, platform)
        )`, (createErr) => {
          if (createErr) {
            console.error('❌ Error creating push_tokens table:', createErr);
            return res.status(500).json({ error: 'Database error' });
          }
          console.log('✅ push_tokens table created');
          saveToken();
        });
      } else {
        console.log('✅ push_tokens table exists');
        saveToken();
      }
    });

    function saveToken() {
      db.run(
        `INSERT OR REPLACE INTO push_tokens (user_id, user_type, token, platform, updated_at)
         VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [userId, userType, token, platform],
        function(err) {
          if (err) {
            console.error('❌ Error saving push token:', err);
            return res.status(500).json({ error: 'Database error' });
          }
          console.log('✅ Push token saved successfully. Row ID:', this.lastID);
          
          // Verify the token was saved
          db.get('SELECT * FROM push_tokens WHERE user_id = ? AND platform = ?', [userId, platform], (selectErr, row) => {
            if (selectErr) {
              console.error('❌ Error verifying saved token:', selectErr);
            } else if (row) {
              console.log('✅ Token verified in database:', {
                id: row.id,
                user_id: row.user_id,
                platform: row.platform,
                token_preview: row.token.substring(0, 20) + '...',
                updated_at: row.updated_at
              });
            }
          });
          
          res.json({ success: true });
        }
      );
    }
  });

  // Test endpoint to send push notification to all user's devices
  router.post('/test-push', verifyTokenRBAC, async (req, res) => {
    const userId = req.user.id;
    const { message = 'Test Push Notification' } = req.body;

    console.log('🧪 Testing push notification for user:', userId);

    // Get all tokens for this user
    db.all('SELECT * FROM push_tokens WHERE user_id = ?', [userId], (err, tokens) => {
      if (err) {
        console.error('❌ Error getting push tokens:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      if (!tokens || tokens.length === 0) {
        console.log('⚠️ No push tokens found for user:', userId);
        return res.json({ success: false, message: 'No push tokens found' });
      }

      console.log('📱 Found', tokens.length, 'push tokens');

      let sentCount = 0;
      let errorCount = 0;

      for (const [index, token] of tokens.entries()) {
        console.log(`📤 Sending test push ${index + 1}/${tokens.length} to token:`, token.token.substring(0, 20) + '...');
        
        try {
          await sendFirebasePushNotification(token.token, {
            title: 'Test Push',
            body: message,
            badge: 1,
            sound: 'default'
          });
          sentCount++;
        } catch (error) {
          console.error('❌ Error sending to token:', error);
          errorCount++;
        }
      }

      res.json({ 
        success: true, 
        sent: sentCount, 
        errors: errorCount,
        total: tokens.length,
        message: `Test push sent to ${sentCount} device(s)`
      });
    });
  });

  return router;
};
