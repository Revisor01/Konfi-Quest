const express = require('express');
const { sendFirebasePushNotification } = require('../push/firebase');

module.exports = (db, verifyTokenRBAC) => {
  const router = express.Router();

  // Migrierte Route: Speichert oder aktualisiert einen Geräte-Token für Push-Benachrichtigungen
  router.post('/device-token', verifyTokenRBAC, async (req, res) => {
    const { token, platform, device_id } = req.body;
    const userId = req.user.id;
    const userType = req.user.type;

    console.log('📱 Device Token Registration Request:');
    console.log('User ID:', userId);
    console.log('User Type:', userType);
    console.log('Platform:', platform);
    console.log('Device ID:', device_id || 'NOT PROVIDED');
    console.log('Token (first 20 chars):', token ? token.substring(0, 20) + '...' : 'NO TOKEN');

    if (!token || !platform) {
      console.log('❌ Missing token or platform');
      return res.status(400).json({ error: 'Token und Plattform erforderlich' });
    }

    try {
      // Regel 2 & 4: Ersetzt die Überprüfung und Erstellung der Tabelle durch PostgreSQL-Syntax.
      // `SERIAL PRIMARY KEY` ersetzt `INTEGER PRIMARY KEY AUTOINCREMENT`.
      // Der `UNIQUE`-Constraint wird angepasst, um device_id einzuschließen, was der Logik der App entspricht.
      await db.query(`
        CREATE TABLE IF NOT EXISTS push_tokens (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL,
          user_type TEXT NOT NULL,
          token TEXT NOT NULL,
          platform TEXT NOT NULL,
          device_id TEXT NOT NULL,
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(user_id, platform, device_id)
        )`);
      console.log('✅ push_tokens table checked/created');

      // Device ID generieren falls nicht vorhanden
      const finalDeviceId = device_id || `${platform}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // WICHTIG: FCM Token kann nur EINEM User gehören!
      // Wenn sich ein neuer User auf demselben Gerät anmeldet, muss der Token
      // von allen anderen Usern entfernt werden, um doppelte Benachrichtigungen zu verhindern.
      const { rowCount: deletedOtherUsers } = await db.query(
        'DELETE FROM push_tokens WHERE token = $1 AND user_id != $2',
        [token, userId]
      );
      if (deletedOtherUsers > 0) {
        console.log(`🧹 Removed token from ${deletedOtherUsers} other user(s) - same device, different account`);
      }

      // Regel 5: Die Logik wird linearisiert, keine verschachtelten Callbacks mehr.
      // Regel 2 & 4: `INSERT OR REPLACE` (SQLite) wird durch `INSERT ... ON CONFLICT ... DO UPDATE` (PostgreSQL) ersetzt.
      // `CURRENT_TIMESTAMP` wird durch `NOW()` ersetzt. Platzhalter sind nun `$1`, `$2`, etc.
      const upsertQuery = `
        INSERT INTO push_tokens (user_id, user_type, token, platform, device_id, updated_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (user_id, platform, device_id) 
        DO UPDATE SET 
          token = EXCLUDED.token, 
          user_type = EXCLUDED.user_type, 
          updated_at = NOW()
        RETURNING id;`;
      
      const { rows: [upsertedToken] } = await db.query(upsertQuery, [userId, userType, token, platform, finalDeviceId]);
      
      console.log('✅ Push token saved/updated successfully. Row ID:', upsertedToken.id);
      
      // Die Verifizierung nach dem Speichern ist optional, aber hier als Beispiel beibehalten.
      const { rows: [verifiedRow] } = await db.query(
        'SELECT * FROM push_tokens WHERE id = $1',
        [upsertedToken.id]
      );
      
      if (verifiedRow) {
        console.log('✅ Token verified in database:', {
          id: verifiedRow.id,
          user_id: verifiedRow.user_id,
          platform: verifiedRow.platform,
          device_id: verifiedRow.device_id,
          token_preview: verifiedRow.token.substring(0, 20) + '...',
          updated_at: verifiedRow.updated_at
        });
      }

      res.json({ success: true, message: 'Token erfolgreich gespeichert' });

    } catch (err) {
      // Regel 1: Zentraler Fehler-Handler für die Route.
      console.error('Database error in POST /device-token:', err);
      // Regel 4: PostgreSQL-spezifischer Fehlercode für UNIQUE-Verletzung.
      if (err.code === '23505') { 
        return res.status(409).json({ error: 'A token for this user and device already exists.' });
      }
      res.status(500).json({ error: 'Datenbankfehler' });
    }
  });

  // Migrierte Route: Sendet eine Test-Push-Benachrichtigung an alle Geräte eines Benutzers
  router.post('/test-push', verifyTokenRBAC, async (req, res) => {
    const userId = req.user.id;
    const { message = 'Test Push Notification' } = req.body;

    console.log('🧪 Testing push notification for user:', userId);

    try {
      // Regel 2 & 4: `db.all` wird durch `await db.query` ersetzt, `?` durch `$1`.
      const { rows: tokens } = await db.query('SELECT * FROM push_tokens WHERE user_id = $1', [userId]);

      if (!tokens || tokens.length === 0) {
        console.log('⚠️ No push tokens found for user:', userId);
        return res.json({ success: false, message: 'Keine Push-Tokens gefunden' });
      }

      console.log('📱 Found', tokens.length, 'push tokens');

      let sentCount = 0;
      let errorCount = 0;

      // Die Logik bleibt identisch, wird aber nun innerhalb des try-Blocks ausgeführt.
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
          console.error('❌ Error sending to token:', error.message);
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

    } catch (err) {
      // Regel 1: Zentraler Fehler-Handler für die Route.
      console.error('Database error in POST /test-push:', err);
      res.status(500).json({ error: 'Datenbankfehler' });
    }
  });

  // Migrierte Route: Entfernt einen Geräte-Token beim Logout
  router.delete('/device-token', verifyTokenRBAC, async (req, res) => {
    const { device_id, platform } = req.body;
    const userId = req.user.id;

    console.log('🗑️ Push Token Logout Request:');
    console.log('User ID:', userId);
    console.log('Device ID:', device_id);
    console.log('Platform:', platform);

    if (!device_id || !platform) {
      console.log('❌ Missing device_id or platform');
      return res.status(400).json({ error: 'Geräte-ID und Plattform erforderlich' });
    }

    try {
      // Regel 2 & 4: `db.run` wird durch `await db.query` ersetzt.
      // `this.changes` wird durch `rowCount` aus dem Ergebnisobjekt ersetzt.
      const { rowCount } = await db.query(
        'DELETE FROM push_tokens WHERE user_id = $1 AND platform = $2 AND device_id = $3',
        [userId, platform, device_id]
      );
      
      console.log('✅ Push token deleted for device:', device_id, 'Changes:', rowCount);
      res.json({ 
        success: true, 
        message: 'Push-Token für dieses Gerät entfernt',
        changes: rowCount
      });
      
    } catch (err) {
      // Regel 1: Zentraler Fehler-Handler für die Route.
      console.error('Database error in DELETE /device-token:', err);
      res.status(500).json({ error: 'Datenbankfehler' });
    }
  });

  return router;
};