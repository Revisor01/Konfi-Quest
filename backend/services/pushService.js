const { sendFirebasePushNotification } = require('../push/firebase');

class PushService {
  /**
   * Sendet Chat-Benachrichtigung an alle User-Devices
   */
  static async sendChatNotification(db, userId, notificationData) {
    try {
      console.log('📨 Sending chat notification to user:', userId);

      // Hole zuerst die Tokens des Senders um sie auszuschliessen
      const senderTokensQuery = `SELECT token FROM push_tokens WHERE user_id = $1`;
      const { rows: senderTokens } = await db.query(senderTokensQuery, [notificationData.data?.sender_id]);
      const senderTokenList = senderTokens.map(t => t.token);

      // NUR das neueste echte Device Token verwenden, Fallback-IDs ignorieren
      // UND Sender-Tokens ausschliessen (fuer den Fall dass gleicher Token bei verschiedenen Accounts)
      let query = `
        SELECT * FROM push_tokens
        WHERE user_id = $1
          AND device_id NOT LIKE '%\\_\\_%'
          AND id IN (
            SELECT MAX(id)
            FROM push_tokens
            WHERE user_id = $2
              AND device_id NOT LIKE '%\\_\\_%'
            GROUP BY device_id, platform
          )
      `;

      // Sender-Tokens ausschliessen wenn vorhanden
      if (senderTokenList.length > 0) {
        query += ` AND token NOT IN (${senderTokenList.map((_, i) => `$${i + 3}`).join(', ')})`;
      }

      const queryParams = [userId, userId, ...senderTokenList];
      const { rows: tokens } = await db.query(query, queryParams);

      if (!tokens || tokens.length === 0) {
        console.log('⚠️ No push tokens found for user:', userId);
        return { success: false, message: 'No tokens found' };
      }

      let successCount = 0;
      let errorCount = 0;

      // An alle Devices senden
      for (const token of tokens) {
        try {
          await sendFirebasePushNotification(token.token, {
            title: notificationData.title || 'Neue Nachricht',
            body: notificationData.body,
            badge: notificationData.badge || 1,
            sound: 'default',
            data: {
              type: 'chat',
              roomId: notificationData.roomId?.toString() || '',
              messageId: notificationData.messageId?.toString() || '',
              sender_id: notificationData.data?.sender_id?.toString() || '',
              sender_name: notificationData.data?.sender_name || '',
              room_name: notificationData.data?.room_name || ''
            }
          });
          successCount++;
        } catch (error) {
          console.error('❌ Push notification failed for token:', error);
          errorCount++;
        }
      }

      console.log(`✅ Chat notification sent: ${successCount} success, ${errorCount} errors`);
      return {
        success: true,
        sent: successCount,
        errors: errorCount,
        total: tokens.length
      };

    } catch (error) {
      console.error('❌ PushService.sendChatNotification error:', error);
      // Den Fehler weiterwerfen, damit der Aufrufer ihn behandeln kann
      throw error;
    }
  }

  /**
   * Sendet Badge Update (für Background App Badge Count)
   */
  static async sendBadgeUpdate(db, userId, badgeCount) {
    try {
      console.log(`🔢 Sending badge update to user ${userId}: ${badgeCount}`);

      // NUR das neueste echte Device Token verwenden, Fallback-IDs ignorieren
      const query = `
        SELECT * FROM push_tokens 
        WHERE user_id = $1 
          AND device_id NOT LIKE '%\\_\\_%' 
          AND id IN (
            SELECT MAX(id) 
            FROM push_tokens 
            WHERE user_id = $2 
              AND device_id NOT LIKE '%\\_\\_%'
            GROUP BY device_id, platform
          )
      `;
      const { rows: tokens } = await db.query(query, [userId, userId]);

      if (!tokens || tokens.length === 0) {
        return { success: false, message: 'No tokens found' };
      }

      let successCount = 0;
      for (const token of tokens) {
        try {
          await sendFirebasePushNotification(token.token, {
            badge: badgeCount,
            data: {
              type: 'badge_update',
              count: badgeCount.toString()
            }
          });
          successCount++;
        } catch (error) {
          console.error('❌ Badge update failed:', error);
        }
      }

      console.log(`✅ Badge update sent: ${successCount}/${tokens.length}`);
      return { success: true, sent: successCount, total: tokens.length };

    } catch (error) {
      console.error('❌ PushService.sendBadgeUpdate error:', error);
      throw error;
    }
  }
}

module.exports = PushService;