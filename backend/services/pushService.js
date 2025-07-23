const { sendFirebasePushNotification } = require('../push/firebase');

class PushService {
  /**
   * Sendet Chat-Benachrichtigung an alle User-Devices
   */
  static async sendChatNotification(db, userId, notificationData) {
    try {
      console.log('📨 Sending chat notification to user:', userId);
      
      // Alle Push Tokens des Users laden
      return new Promise((resolve, reject) => {
        db.all('SELECT * FROM push_tokens WHERE user_id = ?', [userId], async (err, tokens) => {
          if (err) {
            console.error('❌ Error getting push tokens:', err);
            return reject(err);
          }

          if (!tokens || tokens.length === 0) {
            console.log('⚠️ No push tokens found for user:', userId);
            return resolve({ success: false, message: 'No tokens found' });
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
          resolve({ 
            success: true, 
            sent: successCount, 
            errors: errorCount,
            total: tokens.length 
          });
        });
      });
    } catch (error) {
      console.error('❌ PushService.sendChatNotification error:', error);
      throw error;
    }
  }

  /**
   * Sendet Badge Update (für Background App Badge Count)
   */
  static async sendBadgeUpdate(db, userId, badgeCount) {
    try {
      console.log(`🔢 Sending badge update to user ${userId}: ${badgeCount}`);
      
      return new Promise((resolve, reject) => {
        db.all('SELECT * FROM push_tokens WHERE user_id = ?', [userId], async (err, tokens) => {
          if (err) return reject(err);
          if (!tokens || tokens.length === 0) {
            return resolve({ success: false, message: 'No tokens found' });
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
          resolve({ success: true, sent: successCount, total: tokens.length });
        });
      });
    } catch (error) {
      console.error('❌ PushService.sendBadgeUpdate error:', error);
      throw error;
    }
  }
}

module.exports = PushService;