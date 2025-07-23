const PushService = require('./pushService');

class BackgroundService {
  static badgeUpdateInterval = null;

  /**
   * Startet regelmäßige Badge Updates für alle User (alle 5 Minuten)
   */
  static startBadgeUpdateService(db) {
    if (this.badgeUpdateInterval) {
      console.log('Badge update service already running');
      return;
    }

    console.log('🔄 Starting background badge update service (every 5 minutes)');
    
    this.badgeUpdateInterval = setInterval(async () => {
      try {
        await this.updateAllUserBadges(db);
      } catch (error) {
        console.error('❌ Background badge update failed:', error);
      }
    }, 5 * 60 * 1000); // 5 Minuten
  }

  /**
   * Stoppt den Badge Update Service
   */
  static stopBadgeUpdateService() {
    if (this.badgeUpdateInterval) {
      clearInterval(this.badgeUpdateInterval);
      this.badgeUpdateInterval = null;
      console.log('🛑 Background badge update service stopped');
    }
  }

  /**
   * Aktualisiert Badge Counts für alle User mit Push Tokens
   */
  static async updateAllUserBadges(db) {
    return new Promise((resolve, reject) => {
      // Alle User mit Push Tokens laden
      const query = `
        SELECT DISTINCT pt.user_id, pt.user_type
        FROM push_tokens pt
        WHERE pt.token IS NOT NULL
      `;
      
      db.all(query, [], async (err, users) => {
        if (err) {
          console.error('❌ Error loading users for badge update:', err);
          return reject(err);
        }

        if (!users || users.length === 0) {
          console.log('⚠️ No users with push tokens found for badge update');
          return resolve({ updated: 0 });
        }

        console.log(`🔄 Updating badges for ${users.length} users...`);
        let updatedCount = 0;

        for (const user of users) {
          try {
            // Badge Count für User berechnen
            const badgeQuery = `
              SELECT COUNT(DISTINCT cm.id) as total_unread
              FROM chat_messages cm
              JOIN chat_participants cp ON cm.room_id = cp.room_id
              WHERE cp.user_id = ? 
              AND cp.user_type = ? 
              AND cm.created_at > cp.last_read_at
              AND cm.sender_id != ?
            `;

            await new Promise((resolveUser) => {
              db.get(badgeQuery, [user.user_id, user.user_type, user.user_id], async (badgeErr, result) => {
                if (badgeErr) {
                  console.error(`❌ Badge calculation failed for user ${user.user_id}:`, badgeErr);
                  return resolveUser();
                }

                const badgeCount = result?.total_unread || 0;
                
                // Nur Badge Update senden wenn Count > 0 (spart Push Notifications)
                if (badgeCount > 0) {
                  try {
                    await PushService.sendBadgeUpdate(db, user.user_id, badgeCount);
                    updatedCount++;
                  } catch (pushError) {
                    console.error(`❌ Badge push failed for user ${user.user_id}:`, pushError);
                  }
                }
                
                resolveUser();
              });
            });
          } catch (error) {
            console.error(`❌ Badge update failed for user ${user.user_id}:`, error);
          }
        }

        console.log(`✅ Badge update completed: ${updatedCount}/${users.length} users updated`);
        resolve({ updated: updatedCount, total: users.length });
      });
    });
  }
}

module.exports = BackgroundService;