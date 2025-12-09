const PushService = require('./pushService');

class BackgroundService {
  static badgeUpdateInterval = null;
  static eventReminderInterval = null;
  static pendingEventsInterval = null;

  /**
   * Startet regelmäßige Badge Updates für alle User (alle 5 Minuten)
   */
  static startBadgeUpdateService(db) {
    if (this.badgeUpdateInterval) {
      console.log('Badge update service already running');
      return;
    }

    console.log('🔄 Starting background badge update service (every 5 minutes)');

    const FIVE_MINUTES = 5 * 60 * 1000;
    this.badgeUpdateInterval = setInterval(async () => {
      try {
        await this.updateAllUserBadges(db);
      } catch (error) {
        console.error('❌ Background badge update failed:', error);
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
      console.log('🛑 Background badge update service stopped');
    }
  }

  /**
   * Aktualisiert Badge Counts für alle User mit Push Tokens
   */
  static async updateAllUserBadges(db) {
    try {
      // Alle User mit Push Tokens laden
      const usersQuery = `
        SELECT DISTINCT pt.user_id, pt.user_type
        FROM push_tokens pt
        WHERE pt.token IS NOT NULL
      `;
      const { rows: users } = await db.query(usersQuery, []);

      if (!users || users.length === 0) {
        console.log('⚠️ No users with push tokens found for badge update');
        return { updated: 0 };
      }

      console.log(`🔄 Updating badges for ${users.length} users...`);
      let updatedCount = 0;

      for (const user of users) {
        try {
          // Badge Count für User berechnen
          const badgeQuery = `
            SELECT COUNT(DISTINCT cm.id)::int as total_unread
            FROM chat_messages cm
            JOIN chat_participants cp ON cm.room_id = cp.room_id
            WHERE cp.user_id = $1
            AND cp.user_type = $2 
            AND cm.created_at > cp.last_read_at
            AND cm.sender_id != $3
          `;
          const { rows: [result] } = await db.query(badgeQuery, [user.user_id, user.user_type, user.user_id]);

          const badgeCount = result?.total_unread || 0;

          // Nur Badge Update senden wenn Count > 0 (spart Push Notifications)
          if (badgeCount > 0) {
            await PushService.sendBadgeUpdate(db, user.user_id, badgeCount);
            updatedCount++;
          }
        } catch (error) {
          console.error(`❌ Badge update failed for user ${user.user_id}:`, error);
        }
      }

      console.log(`✅ Badge update completed: ${updatedCount}/${users.length} users updated`);
      return { updated: updatedCount, total: users.length };

    } catch (error) {
      console.error('❌ Error in updateAllUserBadges:', error);
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
      console.log('Event reminder service already running');
      return;
    }

    console.log('Event-Erinnerungs-Service gestartet (alle 15 Minuten)');

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
      console.log('Event reminder service stopped');
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

      if (oneDayEvents.length > 0 || oneHourEvents.length > 0) {
        console.log(`Event reminders sent: ${oneDayEvents.length} (1 day), ${oneHourEvents.length} (1 hour)`);
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
      console.log('Pending events service already running');
      return;
    }

    console.log('Pending events service gestartet (alle 4 Stunden)');

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
      console.log('Pending events service stopped');
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

      if (pendingOrgs.length > 0) {
        console.log(`Pending events reminders sent to ${pendingOrgs.length} organizations`);
      }

    } catch (error) {
      console.error('Error in checkPendingEvents:', error);
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
    console.log('Alle Background Services gestartet');
  }

  /**
   * Stoppt alle Background Services
   */
  static stopAllServices() {
    this.stopBadgeUpdateService();
    this.stopEventReminderService();
    this.stopPendingEventsService();
    console.log('Alle Background Services gestoppt');
  }
}

module.exports = BackgroundService;