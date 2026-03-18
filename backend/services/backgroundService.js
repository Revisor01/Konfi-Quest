const PushService = require('./pushService');

class BackgroundService {
  static badgeUpdateInterval = null;
  static eventReminderInterval = null;
  static pendingEventsInterval = null;
  static tokenCleanupInterval = null;

  /**
   * Startet regelmaessige Badge Updates fuer alle User (alle 5 Minuten)
   */
  static startBadgeUpdateService(db) {
    if (this.badgeUpdateInterval) {
      return;
    }

    const FIVE_MINUTES = 5 * 60 * 1000;
    this.badgeUpdateInterval = setInterval(async () => {
      try {
        await this.updateAllUserBadges(db);
      } catch (error) {
        console.error('Background badge update failed:', error);
      }
    }, FIVE_MINUTES);
  }

  /**
   * Stoppt den Badge Update Service
   */
  static stopBadgeUpdateService() {
    if (this.badgeUpdateInterval) {
      clearInterval(this.badgeUpdateInterval);
      this.badgeUpdateInterval = null;
    }
  }

  /**
   * Aktualisiert Badge Counts fuer alle User mit Push Tokens
   */
  static async updateAllUserBadges(db) {
    try {
      // Alle User mit Push Tokens laden (Admins ausschliessen)
      const usersQuery = `
        SELECT DISTINCT pt.user_id, pt.user_type,
          r.name as role_name
        FROM push_tokens pt
        JOIN users u ON pt.user_id = u.id
        JOIN roles r ON u.role_id = r.id
        WHERE pt.token IS NOT NULL
          AND r.name != 'admin'
      `;
      const { rows: users } = await db.query(usersQuery, []);

      if (!users || users.length === 0) {
        return { updated: 0 };
      }

      // Badge-Counts VOR dem Sync laden (fuer Change-Detection)
      const { rows: badgeCounts } = await db.query(`
        SELECT user_id, COUNT(*)::int as badge_count
        FROM user_badges
        GROUP BY user_id
      `);
      const previousBadgeCounts = {};
      for (const row of badgeCounts) {
        previousBadgeCounts[row.user_id] = parseInt(row.badge_count);
      }

      let updatedCount = 0;
      const checkAndAwardBadges = require('../routes/badges').checkAndAwardBadges;

      for (const user of users) {
        try {
          // Badge Count fuer User berechnen (nur Chat-Unread fuer Konfis/Teamer)
          const badgeQuery = `
            SELECT
              (SELECT COUNT(DISTINCT cm.id)::int FROM chat_messages cm
               JOIN chat_participants cp ON cm.room_id = cp.room_id
               LEFT JOIN chat_read_status crs ON cm.room_id = crs.room_id
                 AND crs.user_id = $1 AND crs.user_type = $2
               WHERE cp.user_id = $1 AND cp.user_type = $2
                 AND cm.created_at > COALESCE(crs.last_read_at, '1970-01-01')
                 AND cm.deleted_at IS NULL
                 AND NOT (cm.user_id = $1 AND cm.user_type = $2)
              ) as chat_unread
          `;
          const { rows: [result] } = await db.query(badgeQuery, [user.user_id, user.user_type]);

          const badgeCount = result?.chat_unread || 0;

          // Silent badge-count update (App-Icon Badge) wenn Count > 0
          if (badgeCount > 0) {
            await PushService.sendBadgeUpdate(db, user.user_id, badgeCount);
            updatedCount++;
          }

          // Badge-Check durchfuehren (Streak, zeitbasiert etc.)
          const awardResult = await checkAndAwardBadges(db, user.user_id);

          // Neue Badge-Counts nach Check
          const { rows: [newCount] } = await db.query(
            'SELECT COUNT(*)::int as cnt FROM user_badges WHERE user_id = $1',
            [user.user_id]
          );
          const prevCount = previousBadgeCounts[user.user_id] || 0;
          const currentCount = newCount?.cnt || 0;

          // Nur bei NEUEN Badges sichtbare Push senden
          if (currentCount > prevCount && awardResult?.badges?.length > 0) {
            for (const badge of awardResult.badges) {
              await PushService.sendNewBadgeNotification(db, user.user_id, badge.name || 'Neues Badge');
            }
          }
        } catch (error) {
          console.error(`Badge update failed for user ${user.user_id}:`, error);
        }
      }

      return { updated: updatedCount, total: users.length };

    } catch (error) {
      console.error('Error in updateAllUserBadges:', error);
      throw error;
    }
  }

  // ====================================================================
  // EVENT REMINDER SERVICE
  // ====================================================================

  /**
   * Startet den Event-Erinnerungs-Service (alle 15 Minuten)
   */
  static startEventReminderService(db) {
    if (this.eventReminderInterval) {
      return;
    }

    // Sofort einmal ausfuehren, dann alle 15 Minuten
    this.sendEventReminders(db);

    const FIFTEEN_MINUTES = 15 * 60 * 1000;
    this.eventReminderInterval = setInterval(async () => {
      try {
        await this.sendEventReminders(db);
      } catch (error) {
        console.error('Event reminder service failed:', error);
      }
    }, FIFTEEN_MINUTES);
  }

  /**
   * Stoppt den Event-Erinnerungs-Service
   */
  static stopEventReminderService() {
    if (this.eventReminderInterval) {
      clearInterval(this.eventReminderInterval);
      this.eventReminderInterval = null;
    }
  }

  /**
   * Sendet Event-Erinnerungen (1 Tag und 1 Stunde vorher)
   */
  static async sendEventReminders(db) {
    try {
      const now = new Date();

      // 1. Events die morgen stattfinden (1 Tag vorher Erinnerung)
      const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const oneDayWindowStart = new Date(oneDayFromNow.getTime() - 15 * 60 * 1000);
      const oneDayWindowEnd = new Date(oneDayFromNow.getTime() + 15 * 60 * 1000);

      const oneDayQuery = `
        SELECT DISTINCT e.id, e.name, e.event_date, eb.user_id
        FROM events e
        JOIN event_bookings eb ON e.id = eb.event_id
        WHERE eb.status = 'confirmed'
          AND e.event_date::date = $1::date
          AND NOT EXISTS (
            SELECT 1 FROM event_reminders er
            WHERE er.event_id = e.id
              AND er.user_id = eb.user_id
              AND er.reminder_type = '1_day'
          )
      `;

      const tomorrowDate = oneDayFromNow.toISOString().split('T')[0];
      const { rows: oneDayEvents } = await db.query(oneDayQuery, [tomorrowDate]);

      for (const event of oneDayEvents) {
        try {
          // Extrahiere Zeit aus event_date
          const eventTime = event.event_date ? new Date(event.event_date).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : null;
          await PushService.sendEventReminderToKonfi(
            db,
            event.user_id,
            event.name,
            event.event_date,
            eventTime,
            '1_day'
          );

          // Erinnerung als gesendet markieren
          await db.query(
            `INSERT INTO event_reminders (event_id, user_id, reminder_type, sent_at) VALUES ($1, $2, '1_day', NOW())`,
            [event.id, event.user_id]
          );
        } catch (err) {
          console.error(`1-day reminder failed for event ${event.id}, user ${event.user_id}:`, err);
        }
      }

      // 2. Events die in ca. 1 Stunde stattfinden
      const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
      const oneHourWindowStart = new Date(oneHourFromNow.getTime() - 15 * 60 * 1000);
      const oneHourWindowEnd = new Date(oneHourFromNow.getTime() + 15 * 60 * 1000);

      const oneHourQuery = `
        SELECT DISTINCT e.id, e.name, e.event_date, eb.user_id
        FROM events e
        JOIN event_bookings eb ON e.id = eb.event_id
        WHERE eb.status = 'confirmed'
          AND e.event_date BETWEEN $1 AND $2
          AND NOT EXISTS (
            SELECT 1 FROM event_reminders er
            WHERE er.event_id = e.id
              AND er.user_id = eb.user_id
              AND er.reminder_type = '1_hour'
          )
      `;

      const { rows: oneHourEvents } = await db.query(oneHourQuery, [oneHourWindowStart, oneHourWindowEnd]);

      for (const event of oneHourEvents) {
        try {
          const eventTime = event.event_date ? new Date(event.event_date).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) : null;
          await PushService.sendEventReminderToKonfi(
            db,
            event.user_id,
            event.name,
            event.event_date,
            eventTime,
            '1_hour'
          );

          await db.query(
            `INSERT INTO event_reminders (event_id, user_id, reminder_type, sent_at) VALUES ($1, $2, '1_hour', NOW())`,
            [event.id, event.user_id]
          );
        } catch (err) {
          console.error(`1-hour reminder failed for event ${event.id}, user ${event.user_id}:`, err);
        }
      }

    } catch (error) {
      console.error('Error in sendEventReminders:', error);
      throw error;
    }
  }

  // ====================================================================
  // PENDING EVENTS ADMIN REMINDER SERVICE
  // ====================================================================

  /**
   * Startet den Service fuer Admin-Erinnerungen (alle 4 Stunden)
   */
  static startPendingEventsService(db) {
    if (this.pendingEventsInterval) {
      return;
    }

    const FOUR_HOURS = 4 * 60 * 60 * 1000;
    this.pendingEventsInterval = setInterval(async () => {
      try {
        await this.checkPendingEvents(db);
      } catch (error) {
        console.error('Pending events check failed:', error);
      }
    }, FOUR_HOURS);
  }

  /**
   * Stoppt den Pending Events Service
   */
  static stopPendingEventsService() {
    if (this.pendingEventsInterval) {
      clearInterval(this.pendingEventsInterval);
      this.pendingEventsInterval = null;
    }
  }

  /**
   * Prueft ob es Events gibt die verbucht werden muessen
   */
  static async checkPendingEvents(db) {
    try {
      // Events die vorbei sind und noch nicht alle Teilnehmer verbucht haben
      const query = `
        SELECT e.organization_id, COUNT(DISTINCT e.id) as pending_count
        FROM events e
        JOIN event_bookings eb ON e.id = eb.event_id
        WHERE e.event_date < CURRENT_DATE
          AND eb.status = 'confirmed'
          AND eb.attendance_status IS NULL
        GROUP BY e.organization_id
        HAVING COUNT(DISTINCT e.id) > 0
      `;

      const { rows: pendingOrgs } = await db.query(query);

      for (const org of pendingOrgs) {
        try {
          await PushService.sendEventsPendingApprovalToAdmins(db, org.organization_id, org.pending_count);
        } catch (err) {
          console.error(`Pending events reminder failed for org ${org.organization_id}:`, err);
        }
      }

    } catch (error) {
      console.error('Error in checkPendingEvents:', error);
      throw error;
    }
  }

  // ====================================================================
  // TOKEN CLEANUP SERVICE
  // ====================================================================

  /**
   * Startet den Token-Cleanup Service (alle 6 Stunden)
   * Bereinigt fehlerhafte, inaktive und verwaiste Push-Tokens
   */
  static startTokenCleanupService(db) {
    if (this.tokenCleanupInterval) {
      return;
    }

    // Sofort einmal ausfuehren
    this.cleanupStaleTokens(db);

    const SIX_HOURS = 6 * 60 * 60 * 1000;
    this.tokenCleanupInterval = setInterval(async () => {
      try {
        await this.cleanupStaleTokens(db);
      } catch (error) {
        console.error('Token cleanup service failed:', error);
      }
    }, SIX_HOURS);
  }

  /**
   * Stoppt den Token-Cleanup Service
   */
  static stopTokenCleanupService() {
    if (this.tokenCleanupInterval) {
      clearInterval(this.tokenCleanupInterval);
      this.tokenCleanupInterval = null;
    }
  }

  /**
   * Bereinigt verwaiste und fehlerhafte Push-Tokens
   * - error_count >= 10: Token hat zu viele Fehler
   * - updated_at > 30 Tage: Token ist inaktiv
   * - user_id nicht in users: User wurde geloescht
   */
  static async cleanupStaleTokens(db) {
    try {
      // 1. Fehlerhafte Tokens (error_count >= 10)
      const { rows: errorTokens } = await db.query(
        'DELETE FROM push_tokens WHERE error_count >= 10 RETURNING id'
      );

      // 2. Inaktive Tokens (aelter als 30 Tage)
      const { rows: inactiveTokens } = await db.query(
        "DELETE FROM push_tokens WHERE updated_at < NOW() - INTERVAL '30 days' RETURNING id"
      );

      // 3. Verwaiste Tokens (User existiert nicht mehr)
      const { rows: orphanedTokens } = await db.query(
        'DELETE FROM push_tokens WHERE user_id NOT IN (SELECT id FROM users) RETURNING id'
      );

      const totalDeleted = errorTokens.length + inactiveTokens.length + orphanedTokens.length;
      if (totalDeleted > 0) {
        console.log(`Token cleanup: ${errorTokens.length} error tokens, ${inactiveTokens.length} inactive tokens, ${orphanedTokens.length} orphaned tokens deleted`);
      }

      return { errorTokens: errorTokens.length, inactiveTokens: inactiveTokens.length, orphanedTokens: orphanedTokens.length };
    } catch (error) {
      console.error('Error in cleanupStaleTokens:', error);
      throw error;
    }
  }

  // ====================================================================
  // START ALL SERVICES
  // ====================================================================

  /**
   * Startet alle Background Services
   */
  static startAllServices(db) {
    this.startBadgeUpdateService(db);
    this.startEventReminderService(db);
    this.startPendingEventsService(db);
    this.startTokenCleanupService(db);
  }

  /**
   * Stoppt alle Background Services
   */
  static stopAllServices() {
    this.stopBadgeUpdateService();
    this.stopEventReminderService();
    this.stopPendingEventsService();
    this.stopTokenCleanupService();
  }
}

module.exports = BackgroundService;
