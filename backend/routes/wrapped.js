const express = require('express');
const router = express.Router();
const { param } = require('express-validator');
const { handleValidationErrors } = require('../middleware/validation');

module.exports = (db, rbacVerifier, roleHelpers) => {
  const { requireAdmin, requireOrgAdmin } = roleHelpers;
  const PushService = require('../services/pushService');

  // Idempotente Inline-Migration
  const ensureWrappedSchema = async () => {
    try {
      await db.query(`
        CREATE TABLE IF NOT EXISTS wrapped_snapshots (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
          wrapped_type VARCHAR(10) NOT NULL CHECK (wrapped_type IN ('konfi', 'teamer')),
          jahrgang_id INTEGER REFERENCES jahrgaenge(id) ON DELETE SET NULL,
          year INTEGER NOT NULL,
          data JSONB NOT NULL,
          computed_at TIMESTAMP NOT NULL DEFAULT NOW(),
          UNIQUE(user_id, wrapped_type, year)
        )
      `);
      await db.query(`CREATE INDEX IF NOT EXISTS idx_wrapped_snapshots_org_year ON wrapped_snapshots(organization_id, year)`);
      await db.query(`CREATE INDEX IF NOT EXISTS idx_wrapped_snapshots_user ON wrapped_snapshots(user_id, wrapped_type)`);
      await db.query(`ALTER TABLE jahrgaenge ADD COLUMN IF NOT EXISTS wrapped_released_at TIMESTAMP`);
    } catch (err) {
      console.error('Wrapped schema migration error:', err.message);
    }
  };
  ensureWrappedSchema();

  // Deutsche Monatsnamen
  const MONAT_NAMEN = [
    '', 'Januar', 'Februar', 'M\u00e4rz', 'April', 'Mai', 'Juni',
    'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'
  ];

  // ====================================================================
  // HILFSFUNKTIONEN
  // ====================================================================

  async function generateKonfiSnapshot(client, userId, orgId, jahrgangId, year) {
    // Punkte aus konfi_profiles
    const { rows: [profile] } = await client.query(
      `SELECT kp.gottesdienst_points, kp.gemeinde_points
       FROM konfi_profiles kp
       WHERE kp.user_id = $1 AND kp.jahrgang_id = $2`,
      [userId, jahrgangId]
    );
    const gottesdienst = profile ? profile.gottesdienst_points : 0;
    const gemeinde = profile ? profile.gemeinde_points : 0;

    // Bonus-Punkte
    const { rows: [bonusRow] } = await client.query(
      `SELECT COALESCE(SUM(points), 0) as total FROM bonus_points WHERE konfi_id = $1 AND organization_id = $2`,
      [userId, orgId]
    );
    const bonus = parseInt(bonusRow.total, 10) || 0;

    // Events besucht
    const { rows: [eventCount] } = await client.query(
      `SELECT COUNT(*) as count FROM event_bookings eb
       JOIN events e ON eb.event_id = e.id
       JOIN event_jahrgang_assignments eja ON e.id = eja.event_id AND eja.jahrgang_id = $3
       WHERE eb.user_id = $1 AND eb.status = 'confirmed' AND eb.attendance_status = 'present'
         AND e.organization_id = $2`,
      [userId, orgId, jahrgangId]
    );
    const totalAttended = parseInt(eventCount.count, 10) || 0;

    // Gesamt-Events verfuegbar fuer diesen Jahrgang
    const { rows: [totalEventsRow] } = await client.query(
      `SELECT COUNT(DISTINCT e.id) as count FROM events e
       JOIN event_jahrgang_assignments eja ON e.id = eja.event_id AND eja.jahrgang_id = $2
       WHERE e.organization_id = $1`,
      [orgId, jahrgangId]
    );
    const totalAvailable = parseInt(totalEventsRow.count, 10) || 0;

    // Lieblings-Event (letztes besuchtes)
    const { rows: favoriteRows } = await client.query(
      `SELECT e.name, e.event_date FROM event_bookings eb
       JOIN events e ON eb.event_id = e.id
       WHERE eb.user_id = $1 AND eb.status = 'confirmed' AND eb.attendance_status = 'present'
         AND e.organization_id = $2
       ORDER BY e.event_date DESC LIMIT 1`,
      [userId, orgId]
    );
    const lieblingsEvent = favoriteRows.length > 0
      ? { name: favoriteRows[0].name, date: favoriteRows[0].event_date }
      : null;

    // Badges
    const { rows: badgeRows } = await client.query(
      `SELECT cb.name, cb.icon, cb.color FROM user_badges ub
       JOIN custom_badges cb ON ub.badge_id = cb.id
       WHERE ub.user_id = $1 AND ub.organization_id = $2
       ORDER BY ub.awarded_date DESC`,
      [userId, orgId]
    );
    const { rows: [totalBadgesRow] } = await client.query(
      `SELECT COUNT(*) as count FROM custom_badges WHERE organization_id = $1`,
      [orgId]
    );
    const totalBadgesAvailable = parseInt(totalBadgesRow.count, 10) || 0;

    // Chat-Nachrichten
    const { rows: [chatCount] } = await client.query(
      `SELECT COUNT(*) as count FROM chat_messages cm
       JOIN chat_rooms cr ON cm.room_id = cr.id
       WHERE cm.user_id = $1 AND cr.organization_id = $2`,
      [userId, orgId]
    );
    const nachrichtenGesendet = parseInt(chatCount.count, 10) || 0;

    // Aktivster Monat (Aktivitaeten + Events kombiniert)
    const { rows: monatRows } = await client.query(
      `SELECT monat, COUNT(*) as count FROM (
         SELECT EXTRACT(MONTH FROM completed_date)::int as monat
         FROM user_activities WHERE user_id = $1 AND organization_id = $2
         UNION ALL
         SELECT EXTRACT(MONTH FROM e.event_date)::int as monat
         FROM event_bookings eb
         JOIN events e ON eb.event_id = e.id
         WHERE eb.user_id = $1 AND eb.status = 'confirmed' AND eb.attendance_status = 'present'
           AND e.organization_id = $2
       ) combined
       GROUP BY monat
       ORDER BY count DESC
       LIMIT 1`,
      [userId, orgId]
    );
    const aktivsterMonat = monatRows.length > 0
      ? { monat: monatRows[0].monat, monat_name: MONAT_NAMEN[monatRows[0].monat] || '', aktivitaeten: parseInt(monatRows[0].count, 10) }
      : { monat: 0, monat_name: '', aktivitaeten: 0 };

    // Endspurt: Vergleich mit Zielwerten aus jahrgaenge
    const { rows: [jahrgang] } = await client.query(
      `SELECT target_gottesdienst, target_gemeinde, gottesdienst_enabled, gemeinde_enabled,
              confirmation_date
       FROM jahrgaenge WHERE id = $1`,
      [jahrgangId]
    );

    let zielTotal = 0;
    let aktuellTotal = gottesdienst + gemeinde;
    if (jahrgang) {
      if (jahrgang.gottesdienst_enabled) zielTotal += (jahrgang.target_gottesdienst || 0);
      if (jahrgang.gemeinde_enabled) zielTotal += (jahrgang.target_gemeinde || 0);
    }
    const fehlendePunkte = Math.max(0, zielTotal - aktuellTotal);
    const endspurtAktiv = aktuellTotal < zielTotal;

    // Zeitraum
    const zeitraumStart = jahrgang && jahrgang.confirmation_date
      ? new Date(new Date(jahrgang.confirmation_date).getFullYear() - 1, 8, 1).toISOString().split('T')[0]
      : `${year - 1}-09-01`;
    const zeitraumEnde = jahrgang && jahrgang.confirmation_date
      ? new Date(jahrgang.confirmation_date).toISOString().split('T')[0]
      : `${year}-07-31`;

    return {
      version: 1,
      slides: {
        punkte: {
          gottesdienst,
          gemeinde,
          total: gottesdienst + gemeinde,
          bonus
        },
        events: {
          total_attended: totalAttended,
          total_available: totalAvailable,
          lieblings_event: lieblingsEvent
        },
        badges: {
          total_earned: badgeRows.length,
          total_available: totalBadgesAvailable,
          badges: badgeRows.map(b => ({ name: b.name, icon: b.icon, color: b.color }))
        },
        aktivster_monat: aktivsterMonat,
        chat: {
          nachrichten_gesendet: nachrichtenGesendet
        },
        endspurt: {
          aktiv: endspurtAktiv,
          fehlende_punkte: fehlendePunkte,
          ziel_total: zielTotal,
          aktuell_total: aktuellTotal
        },
        zeitraum: {
          start: zeitraumStart,
          ende: zeitraumEnde
        }
      }
    };
  }

  async function generateTeamerSnapshot(client, userId, orgId, year) {
    // Events geleitet (Teamer war als Teilnehmer gebucht)
    const { rows: [eventsGeleitetRow] } = await client.query(
      `SELECT COUNT(*) as count FROM event_bookings eb
       JOIN events e ON eb.event_id = e.id
       WHERE eb.user_id = $1 AND eb.status = 'confirmed' AND eb.attendance_status = 'present'
         AND e.organization_id = $2`,
      [userId, orgId]
    );
    const eventsGeleitet = parseInt(eventsGeleitetRow.count, 10) || 0;

    // Event mit meisten Teilnehmern
    const { rows: topEventRows } = await client.query(
      `SELECT e.name, COUNT(eb2.id) as teilnehmer
       FROM event_bookings eb
       JOIN events e ON eb.event_id = e.id
       LEFT JOIN event_bookings eb2 ON e.id = eb2.event_id AND eb2.status = 'confirmed' AND eb2.attendance_status = 'present'
       WHERE eb.user_id = $1 AND eb.status = 'confirmed' AND eb.attendance_status = 'present'
         AND e.organization_id = $2
       GROUP BY e.id, e.name
       ORDER BY teilnehmer DESC
       LIMIT 1`,
      [userId, orgId]
    );
    const meisteTeilnehmerEvent = topEventRows.length > 0
      ? { name: topEventRows[0].name, count: parseInt(topEventRows[0].teilnehmer, 10) }
      : null;

    // Konfis betreut (ueber zugewiesene Jahrgaenge)
    const { rows: konfiRows } = await client.query(
      `SELECT COUNT(DISTINCT kp.user_id) as total,
              ARRAY_AGG(DISTINCT j.name) as jahrgaenge
       FROM teamer_jahrgang_assignments tja
       JOIN jahrgaenge j ON tja.jahrgang_id = j.id
       JOIN konfi_profiles kp ON kp.jahrgang_id = j.id
       WHERE tja.user_id = $1 AND j.organization_id = $2`,
      [userId, orgId]
    );
    const totalKonfis = konfiRows.length > 0 ? parseInt(konfiRows[0].total, 10) || 0 : 0;
    const jahrgaengeNamen = konfiRows.length > 0 && konfiRows[0].jahrgaenge
      ? konfiRows[0].jahrgaenge.filter(Boolean)
      : [];

    // Badges
    const { rows: teamerBadges } = await client.query(
      `SELECT cb.name, cb.icon, cb.color FROM user_badges ub
       JOIN custom_badges cb ON ub.badge_id = cb.id
       WHERE ub.user_id = $1 AND ub.organization_id = $2
       ORDER BY ub.awarded_date DESC`,
      [userId, orgId]
    );

    // Zertifikate
    const { rows: certRows } = await client.query(
      `SELECT ct.name, uc.issued_date FROM user_certificates uc
       JOIN certificate_types ct ON uc.certificate_type_id = ct.id
       WHERE uc.user_id = $1 AND uc.organization_id = $2
       ORDER BY uc.issued_date DESC`,
      [userId, orgId]
    );

    // Jahre aktiv (teamer_since)
    const { rows: [userRow] } = await client.query(
      `SELECT teamer_since FROM users WHERE id = $1`,
      [userId]
    );
    const teamerSeit = userRow && userRow.teamer_since ? userRow.teamer_since : null;
    const jahreAktiv = teamerSeit
      ? Math.max(1, Math.floor((Date.now() - new Date(teamerSeit).getTime()) / (365.25 * 24 * 60 * 60 * 1000)))
      : 0;

    return {
      version: 1,
      slides: {
        events_geleitet: {
          total: eventsGeleitet,
          meiste_teilnehmer_event: meisteTeilnehmerEvent
        },
        konfis_betreut: {
          total_konfis: totalKonfis,
          jahrgaenge: jahrgaengeNamen
        },
        badges: {
          total_earned: teamerBadges.length,
          badges: teamerBadges.map(b => ({ name: b.name, icon: b.icon, color: b.color }))
        },
        zertifikate: {
          total: certRows.length,
          zertifikate: certRows.map(c => ({ name: c.name, issued_date: c.issued_date }))
        },
        engagement: {
          teamer_seit: teamerSeit,
          jahre_aktiv: jahreAktiv
        },
        zeitraum: {
          year
        }
      }
    };
  }

  // ====================================================================
  // ENDPOINTS
  // ====================================================================

  // GET /me - Eigenen Wrapped-Snapshot abrufen
  router.get('/me', rbacVerifier, async (req, res) => {
    try {
      const roleName = req.user.role_name;
      const wrappedType = (roleName === 'teamer') ? 'teamer' : 'konfi';
      const currentYear = new Date().getFullYear();

      const { rows } = await db.query(
        `SELECT data, computed_at, year FROM wrapped_snapshots
         WHERE user_id = $1 AND wrapped_type = $2
         ORDER BY year DESC LIMIT 1`,
        [req.user.id, wrappedType]
      );

      if (rows.length === 0) {
        return res.status(404).json({ error: 'Kein Wrapped-Snapshot vorhanden' });
      }

      res.json({
        data: rows[0].data,
        computed_at: rows[0].computed_at,
        year: rows[0].year,
        wrapped_type: wrappedType
      });
    } catch (err) {
      console.error('Error loading wrapped snapshot:', err);
      res.status(500).json({ error: 'Fehler beim Laden des Wrapped-Snapshots' });
    }
  });

  // GET /status - Wrapped-Verfuegbarkeit pruefen
  router.get('/status', rbacVerifier, async (req, res) => {
    try {
      const roleName = req.user.role_name;
      const currentYear = new Date().getFullYear();

      if (roleName === 'konfi') {
        // Konfi: Pruefen ob wrapped_released_at auf dem Jahrgang gesetzt ist
        const { rows } = await db.query(
          `SELECT j.wrapped_released_at FROM konfi_profiles kp
           JOIN jahrgaenge j ON kp.jahrgang_id = j.id
           WHERE kp.user_id = $1`,
          [req.user.id]
        );
        const available = rows.length > 0 && rows[0].wrapped_released_at != null;
        return res.json({ available, year: currentYear });
      }

      if (roleName === 'teamer') {
        // Teamer: Pruefen ob ein Snapshot existiert
        const { rows } = await db.query(
          `SELECT id FROM wrapped_snapshots
           WHERE user_id = $1 AND wrapped_type = 'teamer'
           ORDER BY year DESC LIMIT 1`,
          [req.user.id]
        );
        return res.json({ available: rows.length > 0, year: currentYear });
      }

      // Admin/OrgAdmin: immer false (haben kein eigenes Wrapped)
      res.json({ available: false, year: currentYear });
    } catch (err) {
      console.error('Error checking wrapped status:', err);
      res.status(500).json({ error: 'Fehler beim Pr\u00fcfen des Wrapped-Status' });
    }
  });

  // POST /generate/:jahrgangId - Konfi-Snapshots fuer alle Konfis eines Jahrgangs generieren
  router.post('/generate/:jahrgangId',
    rbacVerifier,
    requireAdmin,
    param('jahrgangId').isInt({ min: 1 }),
    handleValidationErrors,
    async (req, res) => {
      const client = await db.getClient();
      try {
        const jahrgangId = parseInt(req.params.jahrgangId, 10);

        // Jahrgang validieren: gehoert zur Org des Admins
        const { rows: [jahrgang] } = await client.query(
          `SELECT id, name, confirmation_date FROM jahrgaenge WHERE id = $1 AND organization_id = $2`,
          [jahrgangId, req.user.organization_id]
        );
        if (!jahrgang) {
          client.release();
          return res.status(404).json({ error: 'Jahrgang nicht gefunden' });
        }

        const currentYear = new Date().getFullYear();

        await client.query('BEGIN');

        // Alle Konfis des Jahrgangs laden
        const { rows: konfis } = await client.query(
          `SELECT kp.user_id FROM konfi_profiles kp
           JOIN users u ON kp.user_id = u.id
           JOIN roles r ON u.role_id = r.id
           WHERE kp.jahrgang_id = $1 AND r.name = 'konfi'`,
          [jahrgangId]
        );

        let generated = 0;
        let errors = 0;

        for (const konfi of konfis) {
          try {
            const snapshot = await generateKonfiSnapshot(client, konfi.user_id, req.user.organization_id, jahrgangId, currentYear);

            await client.query(
              `INSERT INTO wrapped_snapshots (user_id, organization_id, wrapped_type, jahrgang_id, year, data, computed_at)
               VALUES ($1, $2, 'konfi', $3, $4, $5, NOW())
               ON CONFLICT (user_id, wrapped_type, year)
               DO UPDATE SET data = EXCLUDED.data, computed_at = NOW(), jahrgang_id = EXCLUDED.jahrgang_id, organization_id = EXCLUDED.organization_id`,
              [konfi.user_id, req.user.organization_id, jahrgangId, currentYear, JSON.stringify(snapshot)]
            );
            generated++;
          } catch (err) {
            console.error(`Wrapped generation error for konfi ${konfi.user_id}:`, err.message);
            errors++;
          }
        }

        // wrapped_released_at setzen (auch bei erneutem Generieren)
        await client.query(
          `UPDATE jahrgaenge SET wrapped_released_at = NOW() WHERE id = $1`,
          [jahrgangId]
        );

        await client.query('COMMIT');

        // Push-Notification an alle Konfis
        try {
          const konfiIds = konfis.map(k => k.user_id);
          await PushService.sendToMultipleUsers(db, konfiIds, {
            title: 'Dein Konfi-Jahr ist da!',
            body: 'Schau dir jetzt deinen persönlichen Jahresrückblick an!',
            data: { type: 'wrapped', wrappedType: 'konfi' }
          });
        } catch (pushErr) {
          console.error('Push-Notification für Konfi-Wrapped fehlgeschlagen:', pushErr);
        }

        res.json({
          message: `Wrapped f\u00fcr ${generated} Konfis generiert`,
          generated,
          errors,
          jahrgang: jahrgang.name,
          year: currentYear
        });
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('Error generating konfi wrapped:', err);
        res.status(500).json({ error: 'Fehler beim Generieren der Konfi-Wrapped-Snapshots' });
      } finally {
        client.release();
      }
    }
  );

  // POST /generate-teamer - Teamer-Snapshots fuer alle Teamer der Organisation generieren
  router.post('/generate-teamer',
    rbacVerifier,
    requireOrgAdmin,
    async (req, res) => {
      const client = await db.getClient();
      try {
        const currentYear = new Date().getFullYear();

        await client.query('BEGIN');

        // Alle Teamer der Organisation laden
        const { rows: teamers } = await client.query(
          `SELECT u.id as user_id FROM users u
           JOIN roles r ON u.role_id = r.id
           WHERE r.name = 'teamer' AND u.organization_id = $1`,
          [req.user.organization_id]
        );

        let generated = 0;
        let errors = 0;

        for (const teamer of teamers) {
          try {
            const snapshot = await generateTeamerSnapshot(client, teamer.user_id, req.user.organization_id, currentYear);

            await client.query(
              `INSERT INTO wrapped_snapshots (user_id, organization_id, wrapped_type, year, data, computed_at)
               VALUES ($1, $2, 'teamer', $3, $4, NOW())
               ON CONFLICT (user_id, wrapped_type, year)
               DO UPDATE SET data = EXCLUDED.data, computed_at = NOW(), organization_id = EXCLUDED.organization_id`,
              [teamer.user_id, req.user.organization_id, currentYear, JSON.stringify(snapshot)]
            );
            generated++;
          } catch (err) {
            console.error(`Wrapped generation error for teamer ${teamer.user_id}:`, err.message);
            errors++;
          }
        }

        await client.query('COMMIT');

        // Push-Notification an alle Teamer:innen
        try {
          const teamerIds = teamers.map(t => t.user_id);
          await PushService.sendToMultipleUsers(db, teamerIds, {
            title: 'Dein Teamer-Jahr ist da!',
            body: 'Schau dir jetzt deinen persönlichen Jahresrückblick an!',
            data: { type: 'wrapped', wrappedType: 'teamer' }
          });
        } catch (pushErr) {
          console.error('Push-Notification für Teamer-Wrapped fehlgeschlagen:', pushErr);
        }

        res.json({
          message: `Wrapped f\u00fcr ${generated} Teamer:innen generiert`,
          generated,
          errors,
          year: currentYear
        });
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('Error generating teamer wrapped:', err);
        res.status(500).json({ error: 'Fehler beim Generieren der Teamer-Wrapped-Snapshots' });
      } finally {
        client.release();
      }
    }
  );

  // DELETE /:jahrgangId - Wrapped-Snapshots fuer einen Jahrgang loeschen
  router.delete('/:jahrgangId',
    rbacVerifier,
    requireOrgAdmin,
    param('jahrgangId').isInt({ min: 1 }),
    handleValidationErrors,
    async (req, res) => {
      const client = await db.getClient();
      try {
        const jahrgangId = parseInt(req.params.jahrgangId, 10);

        // Jahrgang validieren
        const { rows: [jahrgang] } = await client.query(
          `SELECT id FROM jahrgaenge WHERE id = $1 AND organization_id = $2`,
          [jahrgangId, req.user.organization_id]
        );
        if (!jahrgang) {
          client.release();
          return res.status(404).json({ error: 'Jahrgang nicht gefunden' });
        }

        await client.query('BEGIN');

        const { rowCount } = await client.query(
          `DELETE FROM wrapped_snapshots WHERE jahrgang_id = $1 AND organization_id = $2`,
          [jahrgangId, req.user.organization_id]
        );

        await client.query(
          `UPDATE jahrgaenge SET wrapped_released_at = NULL WHERE id = $1`,
          [jahrgangId]
        );

        await client.query('COMMIT');
        res.json({ message: `${rowCount} Wrapped-Snapshots gel\u00f6scht`, deleted: rowCount });
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {});
        console.error('Error deleting wrapped snapshots:', err);
        res.status(500).json({ error: 'Fehler beim L\u00f6schen der Wrapped-Snapshots' });
      } finally {
        client.release();
      }
    }
  );

  // ====================================================================
  // BATCH-GENERIERUNG (fuer backgroundService Cron)
  // ====================================================================

  /**
   * Generiert Konfi-Wrapped fuer alle Konfis eines Jahrgangs.
   * Wird vom Cron oder Admin-Endpoint aufgerufen.
   */
  router.generateAllKonfiWrapped = async (dbRef, jahrgangId, orgId, year) => {
    const client = await dbRef.getClient();
    try {
      await client.query('BEGIN');

      const { rows: konfis } = await client.query(
        `SELECT kp.user_id FROM konfi_profiles kp
         JOIN users u ON kp.user_id = u.id
         JOIN roles r ON u.role_id = r.id
         WHERE kp.jahrgang_id = $1 AND r.name = 'konfi'`,
        [jahrgangId]
      );

      let generated = 0;
      let errors = 0;

      for (const konfi of konfis) {
        try {
          const snapshot = await generateKonfiSnapshot(client, konfi.user_id, orgId, jahrgangId, year);
          await client.query(
            `INSERT INTO wrapped_snapshots (user_id, organization_id, wrapped_type, jahrgang_id, year, data, computed_at)
             VALUES ($1, $2, 'konfi', $3, $4, $5, NOW())
             ON CONFLICT (user_id, wrapped_type, year)
             DO UPDATE SET data = EXCLUDED.data, computed_at = NOW(), jahrgang_id = EXCLUDED.jahrgang_id, organization_id = EXCLUDED.organization_id`,
            [konfi.user_id, orgId, jahrgangId, year, JSON.stringify(snapshot)]
          );
          generated++;
        } catch (err) {
          console.error(`Wrapped-Cron: Konfi ${konfi.user_id} Fehler:`, err.message);
          errors++;
        }
      }

      // wrapped_released_at setzen
      await client.query(
        `UPDATE jahrgaenge SET wrapped_released_at = NOW() WHERE id = $1`,
        [jahrgangId]
      );

      await client.query('COMMIT');

      // Push (fire-and-forget, dbRef statt client da client released wird)
      try {
        const konfiIds = konfis.map(k => k.user_id);
        await PushService.sendToMultipleUsers(dbRef, konfiIds, {
          title: 'Dein Konfi-Jahr ist da!',
          body: 'Schau dir jetzt deinen persönlichen Jahresrückblick an!',
          data: { type: 'wrapped', wrappedType: 'konfi' }
        });
      } catch (pushErr) {
        console.error('Wrapped-Cron Push fehlgeschlagen:', pushErr);
      }

      return { generated, errors };
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  };

  /**
   * Generiert Teamer-Wrapped fuer alle Teamer einer Organisation.
   * Wird vom Cron oder Admin-Endpoint aufgerufen.
   */
  router.generateAllTeamerWrapped = async (dbRef, orgId, year) => {
    const client = await dbRef.getClient();
    try {
      await client.query('BEGIN');

      const { rows: teamers } = await client.query(
        `SELECT u.id as user_id FROM users u
         JOIN roles r ON u.role_id = r.id
         WHERE r.name = 'teamer' AND u.organization_id = $1`,
        [orgId]
      );

      let generated = 0;
      let errors = 0;

      for (const teamer of teamers) {
        try {
          const snapshot = await generateTeamerSnapshot(client, teamer.user_id, orgId, year);
          await client.query(
            `INSERT INTO wrapped_snapshots (user_id, organization_id, wrapped_type, year, data, computed_at)
             VALUES ($1, $2, 'teamer', $3, $4, NOW())
             ON CONFLICT (user_id, wrapped_type, year)
             DO UPDATE SET data = EXCLUDED.data, computed_at = NOW(), organization_id = EXCLUDED.organization_id`,
            [teamer.user_id, orgId, year, JSON.stringify(snapshot)]
          );
          generated++;
        } catch (err) {
          console.error(`Wrapped-Cron: Teamer ${teamer.user_id} Fehler:`, err.message);
          errors++;
        }
      }

      await client.query('COMMIT');

      // Push (fire-and-forget)
      try {
        const teamerIds = teamers.map(t => t.user_id);
        await PushService.sendToMultipleUsers(dbRef, teamerIds, {
          title: 'Dein Teamer-Jahr ist da!',
          body: 'Schau dir jetzt deinen persönlichen Jahresrückblick an!',
          data: { type: 'wrapped', wrappedType: 'teamer' }
        });
      } catch (pushErr) {
        console.error('Wrapped-Cron Push fehlgeschlagen:', pushErr);
      }

      return { generated, errors };
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      throw err;
    } finally {
      client.release();
    }
  };

  return router;
};
