const express = require('express');
const { sendFirebasePushNotification } = require('../push/firebase');

module.exports = (db, verifyTokenRBAC) => {
  const router = express.Router();

  // Speichert oder aktualisiert einen Geräte-Token für Push-Benachrichtigungen
  router.post('/device-token', verifyTokenRBAC, async (req, res) => {
    const { token, platform, device_id } = req.body;
    const userId = req.user.id;
    const userType = req.user.type;

    if (!token || !platform) {
      return res.status(400).json({ error: 'Token und Plattform erforderlich' });
    }

    try {
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

      // Device ID generieren falls nicht vorhanden
      const finalDeviceId = device_id || `${platform}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      // FCM Token kann nur EINEM User gehören - bei Gerätewechsel alten Token entfernen
      const { rowCount: deletedOtherUsers } = await db.query(
        'DELETE FROM push_tokens WHERE token = $1 AND user_id != $2',
        [token, userId]
      );
      if (deletedOtherUsers > 0) {
        console.log(`Removed token from ${deletedOtherUsers} other user(s) - same device, different account`);
      }

      // Upsert: Token speichern oder aktualisieren
      await db.query(`
        INSERT INTO push_tokens (user_id, user_type, token, platform, device_id, updated_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        ON CONFLICT (user_id, platform, device_id)
        DO UPDATE SET
          token = EXCLUDED.token,
          user_type = EXCLUDED.user_type,
          updated_at = NOW()`,
        [userId, userType, token, platform, finalDeviceId]
      );

      console.log('Device token registered for user:', userId);

      res.json({ success: true, message: 'Token erfolgreich gespeichert' });

    } catch (err) {
      console.error('Database error in POST /device-token:', err);
      if (err.code === '23505') {
        return res.status(409).json({ error: 'Token für diesen Benutzer und dieses Gerät existiert bereits.' });
      }
      res.status(500).json({ error: 'Datenbankfehler' });
    }
  });

  // Sendet eine Test-Push-Benachrichtigung an alle Geräte eines Benutzers
  router.post('/test-push', verifyTokenRBAC, async (req, res) => {
    const userId = req.user.id;
    const { message = 'Test Push Notification' } = req.body;

    try {
      // Org-gefiltert: Nur Tokens des eigenen Users innerhalb der eigenen Organisation
      const { rows: tokens } = await db.query(
        `SELECT pt.* FROM push_tokens pt
         JOIN users u ON pt.user_id = u.id
         WHERE pt.user_id = $1 AND u.organization_id = $2`,
        [userId, req.user.organization_id]
      );

      if (!tokens || tokens.length === 0) {
        return res.json({ success: false, message: 'Keine Push-Tokens gefunden' });
      }

      let sentCount = 0;
      let errorCount = 0;

      for (const tokenRow of tokens) {
        try {
          await sendFirebasePushNotification(tokenRow.token, {
            title: 'Test Push',
            body: message,
            badge: 1,
            sound: 'default'
          });
          sentCount++;
        } catch (error) {
          console.error('Error sending to token:', error.message);
          errorCount++;
        }
      }

      res.json({
        success: true,
        sent: sentCount,
        errors: errorCount,
        total: tokens.length,
        message: `Test-Push an ${sentCount} Gerät(e) gesendet`
      });

    } catch (err) {
      console.error('Database error in POST /test-push:', err);
      res.status(500).json({ error: 'Datenbankfehler' });
    }
  });

  // Entfernt einen Geräte-Token beim Logout
  router.delete('/device-token', verifyTokenRBAC, async (req, res) => {
    const { device_id, platform } = req.body;
    const userId = req.user.id;

    if (!device_id || !platform) {
      return res.status(400).json({ error: 'Geräte-ID und Plattform erforderlich' });
    }

    try {
      // Org-gefiltert: Nur eigene Tokens innerhalb der eigenen Organisation löschen
      const { rowCount } = await db.query(
        `DELETE FROM push_tokens pt
         USING users u
         WHERE pt.user_id = u.id
           AND pt.user_id = $1
           AND pt.platform = $2
           AND pt.device_id = $3
           AND u.organization_id = $4`,
        [userId, platform, device_id, req.user.organization_id]
      );

      console.log('Device token removed for user:', userId, 'device:', device_id);
      res.json({
        success: true,
        message: 'Push-Token für dieses Gerät entfernt',
        changes: rowCount
      });

    } catch (err) {
      console.error('Database error in DELETE /device-token:', err);
      res.status(500).json({ error: 'Datenbankfehler' });
    }
  });

  return router;
};
