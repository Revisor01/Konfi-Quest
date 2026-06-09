const PushService = require('./pushService');
const cron = require('node-cron');
const { deleteKonfiCascade } = require('../utils/konfiDeletion');
const emailService = require('./emailService');

// Vorlauf fuer die Lizenz-Ablauf-Erinnerung (Tage vor trial_ends_at)
const LICENSE_REMINDER_DAYS = 14;

class BackgroundService {
  static badgeUpdateInterval = null;
  static eventReminderInterval = null;
  static pendingEventsInterval = null;
  static tokenCleanupInterval = null;
  static wrappedCronTask = null;
  static autoDeletionCronTask = null;
  static trialExpiryCronTask = null;
  static wrappedRouter = null;

  /**
   * Startet regelmäßige Badge Updates für alle User (alle 5 Minuten)
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
   * Aktualisiert Badge Counts für alle User mit Push Tokens
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

      let updatedCount = 0;
      const checkAndAwardBadges = require('../routes/badges').checkAndAwardBadges;

      // BULK: Chat-Unread fuer ALLE User auf einmal berechnen (statt N einzelne Queries)
      const chatUnreadQuery = `
        SELECT cp.user_id, cp.user_type, COUNT(DISTINCT cm.id)::int as chat_unread
        FROM chat_participants cp
        JOIN chat_messages cm ON cm.room_id = cp.room_id
        LEFT JOIN chat_read_status crs ON cm.room_id = crs.room_id
          AND crs.user_id = cp.user_id AND crs.user_type = cp.user_type
        WHERE cm.created_at > COALESCE(crs.last_read_at, '1970-01-01')
          AND cm.deleted_at IS NULL
          AND NOT (cm.user_id = cp.user_id AND cm.user_type = cp.user_type)
        GROUP BY cp.user_id, cp.user_type
        HAVING COUNT(DISTINCT cm.id) > 0
      `;
      const { rows: unreadRows } = await db.query(chatUnreadQuery);
      const chatUnreadMap = {};
      for (const row of unreadRows) {
        chatUnreadMap[`${row.user_id}_${row.user_type}`] = row.chat_unread;
      }

      for (const user of users) {
        try {
          // Chat-Unread aus Bulk-Map lesen (kein DB-Query mehr pro User)
          const badgeCount = chatUnreadMap[`${user.user_id}_${user.user_type}`] || 0;

          // Silent badge-count update (App-Icon Badge) wenn Count > 0
          if (badgeCount > 0) {
            await PushService.sendBadgeUpdate(db, user.user_id, badgeCount);
            updatedCount++;
          }

          // Badge-Check durchfuehren (Streak, zeitbasiert etc.).
          // checkAndAwardBadges() vergibt neue Badges UND sendet dafuer bereits
          // selbst die Push + In-App-Notification (via insertBadgesAndNotify ->
          // sendBadgeEarnedToKonfi). KEIN zweiter Push hier — sonst bekommt der
          // Konfi pro neuem Badge zwei Benachrichtigungen.
          await checkAndAwardBadges(db, user.user_id);
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
   * Startet den Service für Admin-Erinnerungen (alle 4 Stunden)
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
   * Prüft ob es Events gibt die verbucht werden müssen
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
   * - user_id nicht in users: User wurde gelöscht
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
  // WRAPPED CRON SERVICE
  // ====================================================================

  /**
   * Startet den Wrapped-Cron Service (jaehrlich am 6. Januar um 06:00 Uhr)
   * - Teamer-Wrapped: Jaehrlich am 6.1. fuer alle Organisationen generieren
   * - Konfi-Wrapped wird NICHT mehr per Cron getriggert (Toggle pro Jahrgang, 119)
   */
  static startWrappedCron(db) {
    if (this.wrappedCronTask) {
      return;
    }

    console.log('Wrapped-Cron: Starte node-cron (0 6 6 1 * -- jaehrlich am 6.1. um 06:00 Uhr)');

    // '0 6 6 1 *' = Jaehrlich am 6. Januar um 06:00 Uhr
    // node-cron berechnet nach Neustart den naechsten Trigger korrekt
    this.wrappedCronTask = cron.schedule('0 6 6 1 *', async () => {
      console.log('Wrapped-Cron: Ausfuehrung gestartet (jaehrlich am 6.1.)');
      try {
        await this.checkWrappedTriggers(db);
      } catch (error) {
        console.error('Wrapped-Cron service failed:', error);
      }
    }, {
      timezone: 'Europe/Berlin'
    });
  }

  /**
   * Stoppt den Wrapped-Cron Service
   */
  static stopWrappedCron() {
    if (this.wrappedCronTask) {
      this.wrappedCronTask.stop();
      this.wrappedCronTask = null;
    }
  }

  /**
   * Prueft ob Wrapped-Snapshots automatisch generiert werden muessen.
   * Laeuft jaehrlich am 6.1. (Teamer-Wrapped fuer alle Organisationen).
   * Konfi-Wrapped wird NICHT mehr automatisch getriggert (Toggle pro Jahrgang, 119).
   */
  static async checkWrappedTriggers(db) {
    try {
      const today = new Date();

      let teamerOrgsGenerated = 0;

      // Teamer-Wrapped: Jaehrlich (Cron feuert nur am 6.1.) fuer alle Organisationen
      const { rows: orgs } = await db.query('SELECT id FROM organizations');

      for (const org of orgs) {
        try {
          // Pruefen ob schon generiert (Idempotenz)
          const { rows: existing } = await db.query(
            `SELECT 1 FROM wrapped_snapshots WHERE organization_id = $1 AND wrapped_type = 'teamer' AND year = $2 LIMIT 1`,
            [org.id, today.getFullYear()]
          );

          if (existing.length === 0 && this.wrappedRouter && this.wrappedRouter.generateAllTeamerWrapped) {
            await this.wrappedRouter.generateAllTeamerWrapped(db, org.id, today.getFullYear());
            teamerOrgsGenerated++;
          }
        } catch (err) {
          console.error(`Wrapped-Cron: Teamer-Org ${org.id} Fehler:`, err.message);
        }
      }

      if (teamerOrgsGenerated > 0) {
        console.log(`Wrapped-Cron: ${teamerOrgsGenerated} Teamer-Orgs generiert`);
      }
    } catch (error) {
      console.error('Error in checkWrappedTriggers:', error);
      throw error;
    }
  }

  // ====================================================================
  // AUTO-DELETION SERVICE (DSG-EKD Datenaufbewahrungsfristen, D-13/14/15)
  // ====================================================================

  /**
   * Startet den Auto-Loesch-Cron (taeglich 02:00 Uhr Europe/Berlin).
   * Prueft je Jahrgang ab confirmation_date: Tag 60 -> Soft-Loeschung,
   * Tag 120 -> kaskadierende Hard-Loeschung.
   */
  static startAutoDeletionCron(db) {
    if (this.autoDeletionCronTask) {
      return;
    }

    console.log('Auto-Deletion-Cron: Starte node-cron 0 2 * * * Europe/Berlin');

    // '0 2 * * *' = taeglich um 02:00 Uhr
    this.autoDeletionCronTask = cron.schedule('0 2 * * *', async () => {
      try {
        await this.runAutoDeletion(db);
      } catch (e) {
        console.error('Auto-Deletion-Cron failed:', e);
      }
    }, {
      timezone: 'Europe/Berlin'
    });
  }

  /**
   * Stoppt den Auto-Loesch-Cron.
   */
  static stopAutoDeletionCron() {
    if (this.autoDeletionCronTask) {
      this.autoDeletionCronTask.stop();
      this.autoDeletionCronTask = null;
    }
  }

  /**
   * Startet den Trial-Ablauf-Cron: setzt Organisationen mit abgelaufener
   * Testphase (trial_ends_at < jetzt) auf is_active = false (Sperre).
   * Login + Refresh pruefen trial_ends_at zusaetzlich direkt, daher ist der
   * Cron nur die persistente Sperre fuer bestehende Sessions/Listen-Anzeige.
   */
  static startTrialExpiryCron(db) {
    if (this.trialExpiryCronTask) {
      return;
    }

    console.log('Trial-Expiry-Cron: Starte node-cron 0 3 * * * Europe/Berlin');

    // '0 3 * * *' = taeglich um 03:00 Uhr (nach Auto-Deletion um 02:00)
    this.trialExpiryCronTask = cron.schedule('0 3 * * *', async () => {
      try {
        await this.runTrialExpiry(db);
      } catch (e) {
        console.error('Trial-Expiry-Cron failed:', e);
      }
      try {
        // Lizenz-Erinnerung (bezahlte Lizenzen ~14 Tage vor Ablauf) — laeuft NACH
        // der Sperrung, damit gerade abgelaufene Orgs nicht mehr erinnert werden.
        await this.runLicenseReminders(db);
      } catch (e) {
        console.error('Lizenz-Erinnerung-Cron failed:', e);
      }
    }, {
      timezone: 'Europe/Berlin'
    });
  }

  /**
   * Stoppt den Trial-Ablauf-Cron.
   */
  static stopTrialExpiryCron() {
    if (this.trialExpiryCronTask) {
      this.trialExpiryCronTask.stop();
      this.trialExpiryCronTask = null;
    }
  }

  /**
   * Sperrt Organisationen mit abgelaufener Testphase.
   * Nur Orgs mit trial_ends_at gesetzt (NULL = bezahlt/unbegrenzt bleibt unangetastet)
   * und die noch aktiv sind. Idempotent durch is_active = true-Bedingung.
   */
  static async runTrialExpiry(db) {
    try {
      const { rows } = await db.query(
        `UPDATE organizations
         SET is_active = false, updated_at = NOW()
         WHERE trial_ends_at IS NOT NULL
           AND trial_ends_at < NOW()
           AND is_active = true
         RETURNING id, display_name`
      );
      if (rows.length > 0) {
        console.log(`Trial-Expiry: ${rows.length} Organisation(en) gesperrt:`, rows.map(r => r.display_name).join(', '));
      }
      return { locked: rows.length };
    } catch (error) {
      console.error('Trial-Expiry: Sperrung fehlgeschlagen:', error.message);
      return { locked: 0 };
    }
  }

  /**
   * Lizenz-Ablauf-Erinnerung per Mail an Org-Admins.
   * Nur fuer BEZAHLTE Lizenzen (is_trial = false) mit gesetztem trial_ends_at,
   * die in <= LICENSE_REMINDER_DAYS Tagen ablaufen, noch nicht abgelaufen sind
   * und fuer die noch keine Erinnerung verschickt wurde (license_reminder_sent_at IS NULL).
   * Trials (is_trial = true) bekommen KEINE Mail — die zeigen den App-Banner.
   * Pro Org wird einmal erinnert; der Marker wird beim Aendern von trial_ends_at zurueckgesetzt.
   */
  static async runLicenseReminders(db) {
    let sent = 0;
    try {
      const { rows: orgs } = await db.query(
        `SELECT id, display_name, trial_ends_at
         FROM organizations
         WHERE is_trial = false
           AND is_active = true
           AND trial_ends_at IS NOT NULL
           AND trial_ends_at > NOW()
           AND trial_ends_at <= NOW() + ($1 || ' days')::interval
           AND license_reminder_sent_at IS NULL`,
        [LICENSE_REMINDER_DAYS]
      );

      for (const org of orgs) {
        try {
          // Org-Admins mit E-Mail laden (admin + org_admin, aktiv)
          const { rows: admins } = await db.query(
            `SELECT u.display_name, u.email
             FROM users u
             JOIN roles r ON u.role_id = r.id
             WHERE u.organization_id = $1
               AND u.is_active = true
               AND r.name IN ('admin', 'org_admin')
               AND u.email IS NOT NULL AND u.email <> ''`,
            [org.id]
          );

          const end = new Date(org.trial_ends_at);
          const daysLeft = Math.ceil((end.getTime() - Date.now()) / (1000 * 60 * 60 * 24));

          let anySent = false;
          for (const admin of admins) {
            try {
              await emailService.sendLicenseExpiryReminderEmail(
                admin.email, admin.display_name, org.display_name, end, daysLeft
              );
              anySent = true;
              sent++;
            } catch (mailErr) {
              console.error(`Lizenz-Erinnerung: Mail an ${admin.email} fehlgeschlagen:`, mailErr.message);
            }
          }

          // Marker nur setzen, wenn mindestens eine Mail rausging — sonst naechster
          // Lauf erneut versuchen (z.B. SMTP-Ausfall).
          if (anySent) {
            await db.query(
              'UPDATE organizations SET license_reminder_sent_at = NOW() WHERE id = $1',
              [org.id]
            );
          }
        } catch (orgErr) {
          console.error(`Lizenz-Erinnerung: Org ${org.id} fehlgeschlagen:`, orgErr.message);
        }
      }

      if (sent > 0) {
        console.log(`Lizenz-Erinnerung: ${sent} Mail(s) fuer ${orgs.length} Organisation(en) verschickt.`);
      }
      return { sent };
    } catch (error) {
      console.error('Lizenz-Erinnerung fehlgeschlagen:', error.message);
      return { sent: 0 };
    }
  }

  /**
   * Fuehrt die Auto-Loeschung durch (D-13/14/15).
   *
   * Pro Jahrgang (Fehler-Isolation, D-15):
   *  - HARD-DELETE (>= 120 Tage seit confirmation_date): aktive Konfis dieses
   *    Jahrgangs (nur r.name='konfi' -> Teamer-Ausnahme D-10) werden kaskadierend
   *    via deleteKonfiCascade geloescht (je Konfi eigene Transaktion).
   *  - SOFT-DELETE (>= 60 und < 120 Tage, deleted_at IS NULL): aktive Konfis
   *    erhalten deleted_at + archived_at (NOW()). Idempotent durch IS NULL-Bedingung.
   *
   * Die 120er-Schwelle hat Vorrang; die 60er-Query grenzt mit `< 120` ab, damit
   * ein Konfi nie gleichzeitig in beiden Buckets landet (T-114-17).
   */
  static async runAutoDeletion(db) {
    let totalSoft = 0;
    let totalHard = 0;

    let jahrgaenge;
    try {
      const res = await db.query(
        'SELECT id, organization_id, confirmation_date FROM jahrgaenge'
      );
      jahrgaenge = res.rows;
    } catch (error) {
      console.error('Auto-Deletion: Jahrgaenge konnten nicht geladen werden:', error.message);
      return { soft: 0, hard: 0 };
    }

    for (const jg of jahrgaenge) {
      try {
        // --- HARD-DELETE (>= 120 Tage) ---
        // Nur aktive Konfis (r.name='konfi'); promotete Teamer (role gewechselt,
        // teamer_since gesetzt) werden durch den Rollen-Filter NIE erfasst (D-10).
        const { rows: hardKandidaten } = await db.query(
          `SELECT u.id
             FROM users u
             JOIN konfi_profiles kp ON kp.user_id = u.id
             JOIN roles r ON u.role_id = r.id
            WHERE kp.jahrgang_id = $1
              AND r.name = 'konfi'
              AND (CURRENT_DATE - $2::date) >= 120`,
          [jg.id, jg.confirmation_date]
        );

        for (const konfi of hardKandidaten) {
          // Jeder Konfi in eigener Transaktion + try/catch (Fehler-Isolation, D-15).
          let client;
          try {
            client = await db.getClient();
          } catch (clientErr) {
            console.error(`Auto-Deletion: Client-Fehler bei Konfi ${konfi.id} (Jahrgang ${jg.id}):`, clientErr.message);
            continue;
          }
          try {
            await client.query('BEGIN');
            await deleteKonfiCascade(client, konfi.id, jg.organization_id);
            await client.query('COMMIT');
            totalHard++;
          } catch (delErr) {
            try { await client.query('ROLLBACK'); } catch (_) { /* ignore */ }
            console.error(`Auto-Deletion: Hard-Delete fuer Konfi ${konfi.id} (Jahrgang ${jg.id}) fehlgeschlagen:`, delErr.message);
          } finally {
            client.release();
          }
        }

        // --- SOFT-DELETE (>= 60 und < 120 Tage, deleted_at IS NULL) ---
        // Idempotent: nur Konfis ohne gesetztes deleted_at. Rollen-Filter (D-10).
        const { rows: softUpdated } = await db.query(
          `UPDATE users u
              SET deleted_at = NOW(), archived_at = NOW()
             FROM konfi_profiles kp, roles r
            WHERE u.id = kp.user_id
              AND u.role_id = r.id
              AND kp.jahrgang_id = $1
              AND r.name = 'konfi'
              AND u.deleted_at IS NULL
              AND (CURRENT_DATE - $2::date) >= 60
              AND (CURRENT_DATE - $2::date) < 120
            RETURNING u.id`,
          [jg.id, jg.confirmation_date]
        );
        totalSoft += softUpdated.length;
      } catch (jgErr) {
        // Fehler pro Jahrgang isolieren -> Job laeuft weiter (D-15).
        console.error(`Auto-Deletion: Jahrgang ${jg.id} fehlgeschlagen:`, jgErr.message);
      }
    }

    if (totalSoft > 0 || totalHard > 0) {
      console.log(`Auto-Deletion: ${totalSoft} soft-geloescht, ${totalHard} hart-geloescht`);
    }

    return { soft: totalSoft, hard: totalHard };
  }

  // ====================================================================
  // START ALL SERVICES
  // ====================================================================

  /**
   * Startet alle Background Services
   */
  static startAllServices(db, options = {}) {
    if (options.wrappedRouter) {
      this.wrappedRouter = options.wrappedRouter;
    }
    this.startBadgeUpdateService(db);
    this.startEventReminderService(db);
    this.startPendingEventsService(db);
    this.startTokenCleanupService(db);
    this.startWrappedCron(db);
    this.startAutoDeletionCron(db);
    this.startTrialExpiryCron(db);
  }

  /**
   * Stoppt alle Background Services
   */
  static stopAllServices() {
    this.stopBadgeUpdateService();
    this.stopEventReminderService();
    this.stopPendingEventsService();
    this.stopTokenCleanupService();
    this.stopWrappedCron();
    this.stopAutoDeletionCron();
    this.stopTrialExpiryCron();
  }
}

module.exports = BackgroundService;
