const { sendFirebasePushNotification } = require('../push/firebase');

class PushService {
  /**
   * Helper: Holt alle Push-Tokens für einen User
   */
  static async getTokensForUser(db, userId) {
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
    return tokens || [];
  }

  /**
   * Helper: Sendet Push an einen User
   */
  static async sendToUser(db, userId, notification) {
    try {
      const tokens = await this.getTokensForUser(db, userId);

      if (tokens.length === 0) {
        console.log(`⚠️ No push tokens found for user ${userId}`);
        return { success: false, message: 'No tokens found' };
      }

      let successCount = 0;
      let errorCount = 0;

      for (const token of tokens) {
        try {
          await sendFirebasePushNotification(token.token, {
            title: notification.title,
            body: notification.body,
            badge: notification.badge || 1,
            sound: 'default',
            data: notification.data || {}
          });
          successCount++;
        } catch (error) {
          console.error('❌ Push failed for token:', error.message);
          errorCount++;
        }
      }

      console.log(`✅ Push sent to user ${userId}: ${successCount}/${tokens.length}`);
      return { success: true, sent: successCount, errors: errorCount, total: tokens.length };
    } catch (error) {
      console.error('❌ PushService.sendToUser error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Helper: Sendet Push an mehrere User (z.B. alle Admins)
   */
  static async sendToMultipleUsers(db, userIds, notification) {
    const results = [];
    for (const userId of userIds) {
      const result = await this.sendToUser(db, userId, notification);
      results.push({ userId, ...result });
    }
    return results;
  }

  /**
   * Sendet Chat-Benachrichtigung an alle User-Devices
   */
  static async sendChatNotification(db, userId, notificationData) {
    try {
      console.log('📨 Sending chat notification to user:', userId);

      // Hole zuerst die Tokens des Senders um sie auszuschließen
      const senderTokensQuery = `SELECT token FROM push_tokens WHERE user_id = $1`;
      const { rows: senderTokens } = await db.query(senderTokensQuery, [notificationData.data?.sender_id]);
      const senderTokenList = senderTokens.map(t => t.token);

      // NUR das neueste echte Device Token verwenden, Fallback-IDs ignorieren
      // UND Sender-Tokens ausschließen (für den Fall dass gleicher Token bei verschiedenen Accounts)
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
      throw error;
    }
  }

  /**
   * Sendet Badge Update (für Background App Badge Count)
   */
  static async sendBadgeUpdate(db, userId, badgeCount) {
    try {
      console.log(`🔢 Sending badge update to user ${userId}: ${badgeCount}`);

      const tokens = await this.getTokensForUser(db, userId);

      if (tokens.length === 0) {
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

  // ====================================================================
  // ACTIVITY REQUEST NOTIFICATIONS
  // ====================================================================

  /**
   * Neuer Antrag eingereicht - Push an alle Admins der Organisation
   */
  static async sendNewActivityRequestToAdmins(db, organizationId, konfiName, activityName, points) {
    try {
      console.log(`📝 Sending new request notification to admins of org ${organizationId}`);

      // Hole alle Admins der Organisation
      const { rows: admins } = await db.query(
        `SELECT u.id FROM users u
         JOIN roles r ON u.role_id = r.id
         WHERE r.name IN ('admin', 'org_admin') AND u.organization_id = $1`,
        [organizationId]
      );

      if (admins.length === 0) {
        console.log('⚠️ No admins found for organization');
        return { success: false, message: 'No admins found' };
      }

      const adminIds = admins.map(a => a.id);
      const notification = {
        title: 'Neuer Antrag',
        body: `${konfiName} hat einen Antrag für "${activityName}" (${points}P) eingereicht`,
        data: {
          type: 'new_activity_request',
          organization_id: organizationId.toString()
        }
      };

      return await this.sendToMultipleUsers(db, adminIds, notification);
    } catch (error) {
      console.error('❌ sendNewActivityRequestToAdmins error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Antrag genehmigt/abgelehnt - Push an Konfi
   */
  static async sendActivityRequestStatusToKonfi(db, konfiId, activityName, points, status, adminComment = null, requestId = null) {
    try {
      console.log(`📋 Sending request ${status} notification to konfi ${konfiId}`);

      const isApproved = status === 'approved';
      const notification = {
        title: isApproved ? 'Antrag genehmigt!' : 'Antrag abgelehnt',
        body: isApproved
          ? `Dein Antrag für "${activityName}" wurde genehmigt. +${points} Punkte!`
          : `Dein Antrag für "${activityName}" wurde leider abgelehnt.${adminComment ? ` Grund: ${adminComment}` : ''}`,
        data: {
          type: 'activity_request_status',
          status: status,
          activity_name: activityName,
          points: points.toString(),
          request_id: requestId?.toString() || ''
        }
      };

      return await this.sendToUser(db, konfiId, notification);
    } catch (error) {
      console.error('❌ sendActivityRequestStatusToKonfi error:', error);
      return { success: false, error: error.message };
    }
  }

  // ====================================================================
  // BADGE NOTIFICATIONS
  // ====================================================================

  /**
   * Badge erhalten - Push an Konfi
   */
  static async sendBadgeEarnedToKonfi(db, konfiId, badgeName, badgeIcon, badgeDescription, badgeId = null) {
    try {
      console.log(`🏆 Sending badge earned notification to konfi ${konfiId}`);

      const notification = {
        title: `Neues Badge erhalten! ${badgeIcon}`,
        body: `Herzlichen Glückwunsch! Du hast das Badge "${badgeName}" erhalten.`,
        data: {
          type: 'badge_earned',
          badge_name: badgeName,
          badge_icon: badgeIcon,
          badge_id: badgeId?.toString() || ''
        }
      };

      return await this.sendToUser(db, konfiId, notification);
    } catch (error) {
      console.error('❌ sendBadgeEarnedToKonfi error:', error);
      return { success: false, error: error.message };
    }
  }

  // ====================================================================
  // BONUS POINTS NOTIFICATIONS
  // ====================================================================

  /**
   * Aktivität direkt zugewiesen - Push an Konfi
   */
  static async sendActivityAssignedToKonfi(db, konfiId, activityName, points, type) {
    try {
      console.log(`📋 Sending activity assigned notification to konfi ${konfiId}`);

      const typeText = type === 'gottesdienst' ? 'Gottesdienst' : 'Gemeinde';
      const notification = {
        title: `+${points} Punkte!`,
        body: `Du hast ${points} ${typeText}-Punkte für "${activityName}" erhalten.`,
        data: {
          type: 'activity_assigned',
          activity_name: activityName,
          points: points.toString(),
          category: type
        }
      };

      return await this.sendToUser(db, konfiId, notification);
    } catch (error) {
      console.error('❌ sendActivityAssignedToKonfi error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Bonuspunkte erhalten - Push an Konfi
   */
  static async sendBonusPointsToKonfi(db, konfiId, points, description, type) {
    try {
      console.log(`💰 Sending bonus points notification to konfi ${konfiId}`);

      const typeText = type === 'gottesdienst' ? 'Gottesdienst' : 'Gemeinde';
      const notification = {
        title: `+${points} Bonuspunkte!`,
        body: `Du hast ${points} ${typeText}-Bonuspunkte erhalten: ${description}`,
        data: {
          type: 'bonus_points',
          points: points.toString(),
          category: type
        }
      };

      return await this.sendToUser(db, konfiId, notification);
    } catch (error) {
      console.error('❌ sendBonusPointsToKonfi error:', error);
      return { success: false, error: error.message };
    }
  }

  // ====================================================================
  // EVENT NOTIFICATIONS
  // ====================================================================

  /**
   * Event-Anmeldung bestätigt - Push an Konfi
   * @param {Object} timeslot - Optional: {start_time, end_time} des gebuchten Timeslots
   */
  static async sendEventRegisteredToKonfi(db, konfiId, eventName, eventDate, status, eventId = null, timeslot = null) {
    try {
      console.log(`✅ Sending event registration confirmation to konfi ${konfiId}`);

      const dateFormatted = new Date(eventDate).toLocaleDateString('de-DE', {
        weekday: 'long',
        day: 'numeric',
        month: 'long'
      });

      // Build time string - use timeslot time if available, otherwise event time
      let timeString = '';
      if (timeslot && timeslot.start_time) {
        const startTime = new Date(timeslot.start_time).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
        const endTime = timeslot.end_time
          ? new Date(timeslot.end_time).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
          : null;
        timeString = endTime ? ` von ${startTime} - ${endTime} Uhr` : ` um ${startTime} Uhr`;
      } else {
        const eventTime = new Date(eventDate).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
        timeString = ` um ${eventTime} Uhr`;
      }

      const isConfirmed = status === 'confirmed';
      const notification = {
        title: isConfirmed ? 'Anmeldung bestätigt!' : 'Auf Warteliste',
        body: isConfirmed
          ? `Du bist für "${eventName}" am ${dateFormatted}${timeString} angemeldet.`
          : `Du stehst auf der Warteliste für "${eventName}" am ${dateFormatted}.`,
        data: {
          type: 'event_registered',
          event_name: eventName,
          status: status,
          event_id: eventId?.toString() || ''
        }
      };

      return await this.sendToUser(db, konfiId, notification);
    } catch (error) {
      console.error('❌ sendEventRegisteredToKonfi error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Event-Abmeldung bestätigt - Push an Konfi
   */
  static async sendEventUnregisteredToKonfi(db, konfiId, eventName) {
    try {
      console.log(`📤 Sending event unregistration confirmation to konfi ${konfiId}`);

      const notification = {
        title: 'Abmeldung bestätigt',
        body: `Du hast dich von "${eventName}" abgemeldet.`,
        data: {
          type: 'event_unregistered',
          event_name: eventName
        }
      };

      return await this.sendToUser(db, konfiId, notification);
    } catch (error) {
      console.error('❌ sendEventUnregisteredToKonfi error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Konfi hat sich von Event abgemeldet - Push an alle Admins der Organisation
   */
  static async sendEventUnregistrationToAdmins(db, organizationId, konfiName, eventName, reason = null) {
    try {
      console.log(`📤 Sending event unregistration notification to admins of org ${organizationId}`);

      // Hole alle Admins der Organisation
      const { rows: admins } = await db.query(
        `SELECT u.id FROM users u
         JOIN roles r ON u.role_id = r.id
         WHERE r.name IN ('admin', 'org_admin') AND u.organization_id = $1`,
        [organizationId]
      );

      if (admins.length === 0) {
        console.log('⚠️ No admins found for organization');
        return { success: false, message: 'No admins found' };
      }

      const adminIds = admins.map(a => a.id);
      const notification = {
        title: 'Event-Abmeldung',
        body: reason
          ? `${konfiName} hat sich von "${eventName}" abgemeldet. Grund: ${reason}`
          : `${konfiName} hat sich von "${eventName}" abgemeldet.`,
        data: {
          type: 'event_unregistration',
          event_name: eventName,
          konfi_name: konfiName
        }
      };

      return await this.sendToMultipleUsers(db, adminIds, notification);
    } catch (error) {
      console.error('❌ sendEventUnregistrationToAdmins error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Level-Up - Push an Konfi
   */
  static async sendLevelUpToKonfi(db, konfiId, levelName, levelTitle, levelIcon, levelId = null) {
    try {
      console.log(`🎉 Sending level up notification to konfi ${konfiId}`);

      const notification = {
        title: `Level Up! ${levelIcon || ''}`,
        body: `Herzlichen Glückwunsch! Du hast Level "${levelTitle || levelName}" erreicht!`,
        data: {
          type: 'level_up',
          level_name: levelName,
          level_title: levelTitle || levelName,
          level_id: levelId?.toString() || ''
        }
      };

      return await this.sendToUser(db, konfiId, notification);
    } catch (error) {
      console.error('❌ sendLevelUpToKonfi error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Event-Erinnerung - Push an Konfi (1 Tag oder 1 Stunde vorher)
   */
  static async sendEventReminderToKonfi(db, konfiId, eventName, eventDate, eventTime, reminderType) {
    try {
      console.log(`⏰ Sending event reminder (${reminderType}) to konfi ${konfiId}`);

      const isOneDay = reminderType === '1_day';
      const notification = {
        title: isOneDay ? 'Morgen: Event!' : 'Gleich: Event!',
        body: isOneDay
          ? `Morgen: ${eventName}${eventTime ? ` um ${eventTime} Uhr` : ''}`
          : `In 1 Stunde: ${eventName}`,
        data: {
          type: 'event_reminder',
          reminder_type: reminderType,
          event_name: eventName
        }
      };

      return await this.sendToUser(db, konfiId, notification);
    } catch (error) {
      console.error('❌ sendEventReminderToKonfi error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Von Warteliste aufgerückt - Push an Konfi
   */
  static async sendWaitlistPromotionToKonfi(db, konfiId, eventName, eventDate = null, eventId = null) {
    try {
      console.log(`🎉 Sending waitlist promotion notification to konfi ${konfiId}`);

      let dateInfo = '';
      if (eventDate) {
        const date = new Date(eventDate);
        dateInfo = ` am ${date.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })} um ${date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr`;
      }

      const notification = {
        title: 'Platz frei geworden!',
        body: `Du bist für "${eventName}"${dateInfo} nachgerückt und jetzt angemeldet.`,
        data: {
          type: 'waitlist_promotion',
          event_name: eventName,
          event_id: eventId?.toString() || ''
        }
      };

      return await this.sendToUser(db, konfiId, notification);
    } catch (error) {
      console.error('❌ sendWaitlistPromotionToKonfi error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Event abgesagt - Push an alle angemeldeten Konfis
   */
  static async sendEventCancellationToKonfis(db, userIds, eventName, eventDate) {
    try {
      console.log(`❌ Sending event cancellation to ${userIds.length} users`);

      let dateInfo = eventDate;
      if (eventDate) {
        const date = new Date(eventDate);
        dateInfo = `${date.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' })} um ${date.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} Uhr`;
      }

      const notification = {
        title: 'Event abgesagt',
        body: `Leider abgesagt: "${eventName}" am ${dateInfo}`,
        data: {
          type: 'event_cancelled',
          event_name: eventName
        }
      };

      return await this.sendToMultipleUsers(db, userIds, notification);
    } catch (error) {
      console.error('❌ sendEventCancellationToKonfis error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Neues Event erstellt - Push an alle Konfis der Organisation
   */
  static async sendNewEventToOrgKonfis(db, organizationId, eventName, eventDate, eventId = null) {
    try {
      console.log(`📣 Sending new event notification to org ${organizationId}`);

      // Hole alle Konfi-IDs der Organisation
      const konfisQuery = `
        SELECT u.id FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE u.organization_id = $1 AND r.name = 'konfi'
      `;
      const { rows: konfis } = await db.query(konfisQuery, [organizationId]);
      const konfiIds = konfis.map(k => k.id);

      if (konfiIds.length === 0) {
        console.log('No konfis found for org', organizationId);
        return { success: true, sent: 0 };
      }

      const dateFormatted = new Date(eventDate).toLocaleDateString('de-DE', {
        weekday: 'long',
        day: 'numeric',
        month: 'long'
      });

      const notification = {
        title: 'Neues Event!',
        body: `"${eventName}" am ${dateFormatted} - Melde dich jetzt an!`,
        data: {
          type: 'new_event',
          event_name: eventName,
          event_id: eventId?.toString() || ''
        }
      };

      return await this.sendToMultipleUsers(db, konfiIds, notification);
    } catch (error) {
      console.error('❌ sendNewEventToOrgKonfis error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Event-Anwesenheit verbucht - Push an Konfi
   */
  static async sendEventAttendanceToKonfi(db, konfiId, eventName, status, points = 0, eventId = null) {
    try {
      console.log(`✅ Sending attendance notification to konfi ${konfiId}`);

      const isPresent = status === 'present';
      const notification = {
        title: isPresent ? 'Teilnahme bestätigt!' : 'Nicht erschienen',
        body: isPresent
          ? `Deine Teilnahme an "${eventName}" wurde bestätigt.${points > 0 ? ` Du erhältst +${points} Punkte!` : ''}`
          : `Du wurdest als "nicht erschienen" für "${eventName}" markiert.`,
        data: {
          type: 'event_attendance',
          status: status,
          event_name: eventName,
          points: points.toString(),
          event_id: eventId?.toString() || ''
        }
      };

      return await this.sendToUser(db, konfiId, notification);
    } catch (error) {
      console.error('❌ sendEventAttendanceToKonfi error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Events müssen verbucht werden - Push an Admins (für Cron-Job)
   */
  static async sendEventsPendingApprovalToAdmins(db, organizationId, eventCount) {
    try {
      console.log(`📊 Sending pending events reminder to admins of org ${organizationId}`);

      const { rows: admins } = await db.query(
        `SELECT u.id FROM users u
         JOIN roles r ON u.role_id = r.id
         WHERE r.name IN ('admin', 'org_admin') AND u.organization_id = $1`,
        [organizationId]
      );

      if (admins.length === 0) {
        return { success: false, message: 'No admins found' };
      }

      const adminIds = admins.map(a => a.id);
      const notification = {
        title: 'Events warten auf Verbuchung',
        body: `${eventCount} Event${eventCount > 1 ? 's' : ''} warten auf Anwesenheitsverbuchung`,
        data: {
          type: 'events_pending_approval',
          count: eventCount.toString()
        }
      };

      return await this.sendToMultipleUsers(db, adminIds, notification);
    } catch (error) {
      console.error('❌ sendEventsPendingApprovalToAdmins error:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = PushService;
