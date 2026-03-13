const express = require('express');
const bcrypt = require('bcrypt');
const { body, param } = require('express-validator');
const { handleValidationErrors, commonValidations, getPointField } = require('../middleware/validation');
const { checkPointTypeEnabled } = require('../utils/pointTypeGuard');
const { generateBiblicalPassword } = require('../utils/passwordUtils');
const PushService = require('../services/pushService');
const liveUpdate = require('../utils/liveUpdate');
const router = express.Router();

// Konfis: Teamer darf ansehen, Admin darf bearbeiten
module.exports = (db, rbacVerifier, { requireAdmin, requireTeamer }, filterByJahrgangAccess, checkAndAwardBadges) => {

    // Validierungsregeln
    const validateCreateKonfi = [
        body('name').trim().notEmpty().withMessage('Name ist erforderlich'),
        body('jahrgang_id').isInt({ min: 1 }).withMessage('Ungültige Jahrgangs-ID'),
        handleValidationErrors
    ];

    const validateUpdateKonfi = [
        param('id').isInt({ min: 1 }).withMessage('Ungültige ID'),
        body('name').trim().notEmpty().withMessage('Name ist erforderlich'),
        body('jahrgang_id').isInt({ min: 1 }).withMessage('Ungültige Jahrgangs-ID'),
        handleValidationErrors
    ];

    const validateBonusPoints = [
        param('id').isInt({ min: 1 }).withMessage('Ungültige Konfi-ID'),
        commonValidations.points,
        commonValidations.type,
        body('description').trim().notEmpty().withMessage('Beschreibung ist erforderlich'),
        handleValidationErrors
    ];

    const validateAddActivity = [
        param('id').isInt({ min: 1 }).withMessage('Ungültige Konfi-ID'),
        body('activity_id').isInt({ min: 1 }).withMessage('Ungültige Aktivitäts-ID'),
        body('completed_date').notEmpty().isISO8601().withMessage('Gültiges Datum erforderlich'),
        handleValidationErrors
    ];

    const validateParamId = [
        param('id').isInt({ min: 1 }).withMessage('Ungültige ID'),
        handleValidationErrors
    ];

    // GET all konfis for the admin's organization (with jahrgang filtering)
    router.get('/', rbacVerifier, requireTeamer, async (req, res) => {
        try {
            let jahrgangFilter = '';
            let params = [req.user.organization_id];
            let placeholderIndex = 2; // Start after $1 for organization_id

            if (!req.user.is_super_admin && req.user.role_name !== 'org_admin') {
                const viewableJahrgaenge = req.user.assigned_jahrgaenge
                    .filter(j => j.can_view)
                    .map(j => j.id);

                if (viewableJahrgaenge.length === 0) {
                    return res.json([]); // No access to any jahrgaenge
                }

                const placeholders = viewableJahrgaenge.map(() => `$${placeholderIndex++}`).join(',');
                jahrgangFilter = `AND j.id IN (${placeholders})`;
                params.push(...viewableJahrgaenge);
            }

            const query = `
                SELECT u.id, u.display_name as name, u.username,
                       kp.gottesdienst_points, kp.gemeinde_points,
                       j.name as jahrgang_name, j.id as jahrgang_id,
                       j.gottesdienst_enabled, j.gemeinde_enabled,
                       j.target_gottesdienst, j.target_gemeinde,
                       (SELECT COUNT(*) FROM user_badges WHERE user_id = u.id) as "badgeCount"
                FROM users u
                JOIN roles r ON u.role_id = r.id
                LEFT JOIN konfi_profiles kp ON u.id = kp.user_id
                LEFT JOIN jahrgaenge j ON kp.jahrgang_id = j.id
                WHERE r.name = 'konfi' AND u.organization_id = $1 ${jahrgangFilter}
                ORDER BY j.name DESC, u.display_name
            `;

            const { rows } = await db.query(query, params);
            res.json(rows);
        } catch (err) {
 console.error('Database error in GET /konfis:', err);
            res.status(500).json({ error: 'Datenbankfehler' });
        }
    });

    // GET all teamers for the admin's organization
    router.get('/teamer', rbacVerifier, requireTeamer, async (req, res) => {
        try {
            const query = `
                SELECT u.id, u.display_name as name, u.username, u.teamer_since,
                       STRING_AGG(DISTINCT j.name, ', ' ORDER BY j.name) as jahrgang_name,
                       COALESCE(badge_counts.badge_count, 0)::int as badge_count,
                       COALESCE(cert_counts.cert_count, 0)::int as cert_count
                FROM users u
                JOIN roles r ON u.role_id = r.id
                LEFT JOIN user_jahrgang_assignments uja ON u.id = uja.user_id
                LEFT JOIN jahrgaenge j ON uja.jahrgang_id = j.id
                LEFT JOIN (
                    SELECT ub.user_id, COUNT(*) as badge_count
                    FROM user_badges ub
                    JOIN custom_badges cb ON ub.badge_id = cb.id
                    WHERE cb.target_role = 'teamer'
                    GROUP BY ub.user_id
                ) badge_counts ON u.id = badge_counts.user_id
                LEFT JOIN (
                    SELECT user_id, COUNT(*) as cert_count
                    FROM user_certificates
                    WHERE organization_id = $1
                    GROUP BY user_id
                ) cert_counts ON u.id = cert_counts.user_id
                WHERE r.name = 'teamer' AND u.organization_id = $1
                GROUP BY u.id, u.display_name, u.username, u.teamer_since,
                         badge_counts.badge_count, cert_counts.cert_count
                ORDER BY u.display_name
            `;
            const { rows } = await db.query(query, [req.user.organization_id]);
            res.json(rows);
        } catch (err) {
            console.error('Database error in GET /konfis/teamer:', err);
            res.status(500).json({ error: 'Datenbankfehler' });
        }
    });

    // GET a single konfi/teamer by ID - weiterleiten an zweiten Handler

    // POST (create) a new konfi
    router.post('/', rbacVerifier, requireAdmin, validateCreateKonfi, async (req, res) => {
        const { name, jahrgang_id } = req.body;
        if (!name || !jahrgang_id) {
            return res.status(400).json({ error: 'Name und Jahrgang sind erforderlich' });
        }

        const password = generateBiblicalPassword();
        const hashedPassword = bcrypt.hashSync(password, 10);
        const username = name.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z.äöüß]/g, '');

        const client = await db.getClient();
        try {
            await client.query('BEGIN');

            // First verify that the jahrgang exists
            const jahrgangCheckQuery = "SELECT id FROM jahrgaenge WHERE id = $1 AND organization_id = $2";
            const { rows: [jahrgangExists] } = await client.query(jahrgangCheckQuery, [jahrgang_id, req.user.organization_id]);

            if (!jahrgangExists) {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'Jahrgang nicht gefunden oder gehört nicht zu Ihrer Organisation' });
            }

            const roleQuery = "SELECT id FROM roles WHERE name = 'konfi' AND organization_id = $1";
            const { rows: [role] } = await client.query(roleQuery, [req.user.organization_id]);

            if (!role) {
                await client.query('ROLLBACK');
                return res.status(500).json({ error: 'Konfi-Rolle nicht gefunden' });
            }

            const userQuery = `
                INSERT INTO users (username, display_name, password_hash, role_id, organization_id)
                VALUES ($1, $2, $3, $4, $5)
                RETURNING id`;
            const { rows: [newUser] } = await client.query(userQuery, [username, name, hashedPassword, role.id, req.user.organization_id]);
            const userId = newUser.id;

            const profileQuery = `
                INSERT INTO konfi_profiles (user_id, jahrgang_id, organization_id, gottesdienst_points, gemeinde_points)
                VALUES ($1, $2, $3, 0, 0)`;
            await client.query(profileQuery, [userId, jahrgang_id, req.user.organization_id]);

            // Add konfi to jahrgang chat room if it exists
            const jahrgangChatQuery = `
                SELECT id FROM chat_rooms
                WHERE type = 'jahrgang' AND jahrgang_id = $1 AND organization_id = $2
            `;
            const { rows: [jahrgangChat] } = await client.query(jahrgangChatQuery, [jahrgang_id, req.user.organization_id]);

            if (jahrgangChat) {
                // Check if konfi is not already a participant (shouldn't happen, but safety first)
                const existingParticipantQuery = `
                    SELECT id FROM chat_participants
                    WHERE room_id = $1 AND user_id = $2 AND user_type = 'konfi'
                `;
                const { rows: [existingParticipant] } = await client.query(existingParticipantQuery, [jahrgangChat.id, userId]);

                if (!existingParticipant) {
                    const addParticipantQuery = `
                        INSERT INTO chat_participants (room_id, user_id, user_type, joined_at)
                        VALUES ($1, $2, 'konfi', NOW())
                    `;
                    await client.query(addParticipantQuery, [jahrgangChat.id, userId]);
                }
            }

            await client.query('COMMIT');
            res.status(201).json({ id: userId, username, temporaryPassword: password, message: 'Konfi erfolgreich erstellt' });

        } catch (err) {
            await client.query('ROLLBACK').catch(rbErr => console.error('Rollback failed:', rbErr));

            if (err.code === '23505') { // unique_violation
                return res.status(409).json({ error: 'Benutzername existiert bereits' });
            }
 console.error('Database error in POST /konfis:', err);
            res.status(500).json({ error: 'Datenbankfehler' });
        } finally {
            client.release();
        }
    });

    // PUT (update) a konfi
    router.put('/:id', rbacVerifier, requireAdmin, validateUpdateKonfi, async (req, res) => {
        const { name, jahrgang_id } = req.body;
        if (!name || !jahrgang_id) {
            return res.status(400).json({ error: 'Name und Jahrgang sind erforderlich' });
        }
        const username = name.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z.äöüß]/g, '');

        const client = await db.getClient();
        try {
            await client.query('BEGIN');

            // Get current jahrgang_id before update
            const currentProfileQuery = `SELECT jahrgang_id FROM konfi_profiles WHERE user_id = $1`;
            const { rows: [currentProfile] } = await client.query(currentProfileQuery, [req.params.id]);

            const userQuery = `
                UPDATE users SET display_name = $1, username = $2
                WHERE id = $3 AND organization_id = $4`;
            const { rowCount: userUpdateCount } = await client.query(userQuery, [name, username, req.params.id, req.user.organization_id]);

            if (userUpdateCount === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'Konfi nicht gefunden' });
            }

            const profileQuery = `UPDATE konfi_profiles SET jahrgang_id = $1 WHERE user_id = $2`;
            await client.query(profileQuery, [jahrgang_id, req.params.id]);

            // Handle jahrgang chat membership changes
            if (currentProfile && currentProfile.jahrgang_id !== parseInt(jahrgang_id)) {
                // Remove from old jahrgang chat
                if (currentProfile.jahrgang_id) {
                    const oldJahrgangChatQuery = `
                        SELECT id FROM chat_rooms
                        WHERE type = 'jahrgang' AND jahrgang_id = $1 AND organization_id = $2
                    `;
                    const { rows: [oldJahrgangChat] } = await client.query(oldJahrgangChatQuery, [currentProfile.jahrgang_id, req.user.organization_id]);

                    if (oldJahrgangChat) {
                        await client.query(`
                            DELETE FROM chat_participants
                            WHERE room_id = $1 AND user_id = $2 AND user_type = 'konfi'
                        `, [oldJahrgangChat.id, req.params.id]);
                    }
                }

                // Add to new jahrgang chat
                const newJahrgangChatQuery = `
                    SELECT id FROM chat_rooms
                    WHERE type = 'jahrgang' AND jahrgang_id = $1 AND organization_id = $2
                `;
                const { rows: [newJahrgangChat] } = await client.query(newJahrgangChatQuery, [jahrgang_id, req.user.organization_id]);

                if (newJahrgangChat) {
                    // Check if not already a participant
                    const existingParticipantQuery = `
                        SELECT id FROM chat_participants
                        WHERE room_id = $1 AND user_id = $2 AND user_type = 'konfi'
                    `;
                    const { rows: [existingParticipant] } = await client.query(existingParticipantQuery, [newJahrgangChat.id, req.params.id]);

                    if (!existingParticipant) {
                        await client.query(`
                            INSERT INTO chat_participants (room_id, user_id, user_type, joined_at)
                            VALUES ($1, $2, 'konfi', NOW())
                        `, [newJahrgangChat.id, req.params.id]);
                    }
                }
            }

            await client.query('COMMIT');

            // Auto-Enrollment fuer zukuenftige Pflicht-Events des neuen Jahrgangs
            if (currentProfile && currentProfile.jahrgang_id !== parseInt(jahrgang_id)) {
              try {
                const enrollFutureEventsQuery = `
                  INSERT INTO event_bookings (event_id, user_id, status, booking_date, organization_id)
                  SELECT e.id, $1, 'confirmed', NOW(), $2
                  FROM events e
                  JOIN event_jahrgang_assignments eja ON e.id = eja.event_id
                  WHERE eja.jahrgang_id = $3
                    AND e.mandatory = true
                    AND e.event_date > NOW()
                    AND e.organization_id = $2
                    AND e.cancelled IS NOT TRUE
                  ON CONFLICT (user_id, event_id) DO NOTHING
                `;
                await db.query(enrollFutureEventsQuery, [req.params.id, req.user.organization_id, jahrgang_id]);
              } catch (enrollErr) {
                console.error('Auto-enrollment für Pflicht-Events fehlgeschlagen:', enrollErr);
              }
            }

            res.json({ message: 'Konfi erfolgreich aktualisiert' });

        } catch (err) {
            await client.query('ROLLBACK').catch(rbErr => console.error('Rollback failed:', rbErr));
 console.error('Database error in PUT /konfis/:id:', err);
            res.status(500).json({ error: 'Datenbankfehler' });
        } finally {
            client.release();
        }
    });

    // DELETE a konfi
    router.delete('/:id', rbacVerifier, requireAdmin, validateParamId, async (req, res) => {
        const userId = req.params.id;
        const client = await db.getClient();
        try {
            await client.query('BEGIN');

            const checkUserQuery = `
                SELECT u.id FROM users u
                JOIN roles r ON u.role_id = r.id
                WHERE u.id = $1 AND u.organization_id = $2 AND r.name = 'konfi'`;
            const { rows: [user] } = await client.query(checkUserQuery, [userId, req.user.organization_id]);

            if (!user) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'Konfi nicht gefunden' });
            }

            // Delete related data (in correct order to avoid FK violations)
            await client.query("DELETE FROM user_activities WHERE user_id = $1 AND organization_id = $2", [userId, req.user.organization_id]);
            await client.query("DELETE FROM bonus_points WHERE konfi_id = $1 AND organization_id = $2", [userId, req.user.organization_id]);
            await client.query("DELETE FROM event_points WHERE konfi_id = $1 AND organization_id = $2", [userId, req.user.organization_id]);
            await client.query("DELETE FROM event_bookings WHERE user_id = $1 AND organization_id = $2", [userId, req.user.organization_id]);
            await client.query("DELETE FROM user_badges WHERE user_id = $1", [userId]);
            await client.query("DELETE FROM activity_requests WHERE konfi_id = $1 AND organization_id = $2", [userId, req.user.organization_id]);
            await client.query("DELETE FROM chat_participants WHERE user_id = $1 AND user_type = 'konfi'", [userId]);
            await client.query("DELETE FROM chat_read_status WHERE user_id = $1", [userId]);
            await client.query("DELETE FROM chat_messages WHERE user_id = $1", [userId]);
            await client.query("DELETE FROM notifications WHERE user_id = $1", [userId]);
            await client.query("DELETE FROM password_resets WHERE user_id = $1", [userId]);
            await client.query("DELETE FROM user_jahrgang_assignments WHERE user_id = $1", [userId]);
            await client.query("DELETE FROM chat_poll_votes WHERE user_id = $1", [userId]);
            await client.query("DELETE FROM push_tokens WHERE user_id = $1", [userId]);
            await client.query("DELETE FROM konfi_profiles WHERE user_id = $1", [userId]);
            await client.query("DELETE FROM users WHERE id = $1", [userId]);

            await client.query('COMMIT');
            res.json({ message: 'Konfi erfolgreich gelöscht' });

        } catch (err) {
            await client.query('ROLLBACK').catch(rbErr => console.error('Rollback failed:', rbErr));
 console.error('Database error in DELETE /konfis/:id:', err);
            res.status(500).json({ error: 'Datenbankfehler' });
        } finally {
            client.release();
        }
    });

    // Regenerate password for a konfi
    router.post('/:id/regenerate-password', rbacVerifier, requireAdmin, validateParamId, async (req, res) => {
        const newPassword = generateBiblicalPassword();
        const hashedPassword = bcrypt.hashSync(newPassword, 10);

        const client = await db.getClient();
        try {
            await client.query('BEGIN');

            const updateUserQuery = `
                UPDATE users SET password_hash = $1
                WHERE id = $2 AND organization_id = $3`;
            const { rowCount } = await client.query(updateUserQuery, [hashedPassword, req.params.id, req.user.organization_id]);

            if (rowCount === 0) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'Konfi nicht gefunden' });
            }

            const updateProfileQuery = "UPDATE konfi_profiles SET password_plain = NULL WHERE user_id = $1";
            await client.query(updateProfileQuery, [req.params.id]);

            await client.query('COMMIT');
            res.json({ message: 'Passwort erfolgreich neu generiert', temporaryPassword: newPassword });

        } catch (err) {
            await client.query('ROLLBACK').catch(rbErr => console.error('Rollback failed:', rbErr));
 console.error('Database error in POST /konfis/:id/regenerate-password:', err);
            res.status(500).json({ error: 'Datenbankfehler' });
        } finally {
            client.release();
        }
    });

    // GET single konfi details with activities, bonusPoints, eventPoints
    router.get('/:id', rbacVerifier, requireTeamer, async (req, res) => {
        const konfiId = req.params.id;
        
        try {
            const konfiQuery = `
                SELECT u.*, u.teamer_since, kp.gottesdienst_points, kp.gemeinde_points,
                       j.name as jahrgang_name, j.id as jahrgang_id,
                       j.gottesdienst_enabled, j.gemeinde_enabled,
                       j.target_gottesdienst, j.target_gemeinde,
                       r.name as role_name
                FROM users u
                JOIN roles r ON u.role_id = r.id
                LEFT JOIN konfi_profiles kp ON u.id = kp.user_id
                LEFT JOIN jahrgaenge j ON kp.jahrgang_id = j.id
                WHERE u.id = $1 AND r.name IN ('konfi', 'teamer') AND u.organization_id = $2
            `;
            const { rows: [konfi] } = await db.query(konfiQuery, [konfiId, req.user.organization_id]);

            if (!konfi) {
                return res.status(404).json({ error: 'Benutzer nicht gefunden' });
            }

            const activitiesQuery = `
                SELECT ka.*, a.name, a.points, a.type, u.display_name as admin_name
                FROM user_activities ka
                JOIN activities a ON ka.activity_id = a.id
                LEFT JOIN users u ON ka.admin_id = u.id
                WHERE ka.user_id = $1 AND ka.organization_id = $2
                ORDER BY ka.completed_date DESC, ka.created_at DESC
            `;
            const { rows: activities } = await db.query(activitiesQuery, [konfiId, req.user.organization_id]);

            const bonusQuery = `
                SELECT bp.*, u.display_name as admin_name
                FROM bonus_points bp
                LEFT JOIN users u ON bp.admin_id = u.id
                WHERE bp.konfi_id = $1 AND bp.organization_id = $2
                ORDER BY bp.created_at DESC
            `;
            const { rows: bonusPoints } = await db.query(bonusQuery, [konfiId, req.user.organization_id]);

            const badgeQuery = `
                SELECT COUNT(*) as "badgeCount" FROM user_badges ub
                JOIN custom_badges cb ON ub.badge_id = cb.id
                WHERE ub.user_id = $1 AND cb.target_role = $2
            `;
            const { rows: [badgeResult] } = await db.query(badgeQuery, [konfiId, konfi.role_name]);

            // Zertifikate fuer Teamer mitladen
            let certificates = [];
            let teamerEvents = [];
            if (konfi.role_name === 'teamer') {
                const certQuery = `
                    SELECT uc.id, uc.issued_date, uc.expiry_date, ct.name, ct.icon
                    FROM user_certificates uc
                    JOIN certificate_types ct ON uc.certificate_type_id = ct.id
                    WHERE uc.user_id = $1 AND uc.organization_id = $2
                    ORDER BY uc.issued_date DESC
                `;
                const { rows: certRows } = await db.query(certQuery, [konfiId, req.user.organization_id]);
                certificates = certRows;

                // Events fuer Teamer: gebuchte Events mit Status
                const eventsQuery = `
                    SELECT e.id, e.name, e.event_date, e.location, e.teamer_only, e.teamer_needed,
                           eb.status as booking_status, eb.booking_date
                    FROM event_bookings eb
                    JOIN events e ON eb.event_id = e.id
                    WHERE eb.user_id = $1 AND e.organization_id = $2
                    ORDER BY e.event_date DESC
                `;
                const { rows: eventRows } = await db.query(eventsQuery, [konfiId, req.user.organization_id]);
                teamerEvents = eventRows;
            }

            // Konfi-Historie: Punkte-History fuer promoted Teamer
            let konfiHistory = null;
            if (konfi.role_name === 'teamer' && konfi.gottesdienst_points !== null) {
                // Activities aus der Konfi-Zeit
                const histActivities = `
                    SELECT ka.id, a.name as title, a.points, a.type as category,
                           ka.completed_date as date, 'activity' as source_type
                    FROM user_activities ka
                    JOIN activities a ON ka.activity_id = a.id
                    WHERE ka.user_id = $1 AND ka.organization_id = $2
                    ORDER BY ka.completed_date DESC
                `;
                const { rows: histAct } = await db.query(histActivities, [konfiId, req.user.organization_id]);

                const histBonus = `
                    SELECT id, description as title, points, type as category,
                           completed_date as date, 'bonus' as source_type
                    FROM bonus_points
                    WHERE konfi_id = $1 AND organization_id = $2
                    ORDER BY completed_date DESC
                `;
                const { rows: histBon } = await db.query(histBonus, [konfiId, req.user.organization_id]);

                const histEvents = `
                    SELECT ep.id, e.name as title, ep.points, ep.point_type as category,
                           ep.awarded_date as date, 'event' as source_type
                    FROM event_points ep
                    JOIN events e ON ep.event_id = e.id
                    WHERE ep.konfi_id = $1 AND ep.organization_id = $2
                    ORDER BY ep.awarded_date DESC
                `;
                const { rows: histEvt } = await db.query(histEvents, [konfiId, req.user.organization_id]);

                const allHistory = [...histAct, ...histBon, ...histEvt].sort((a, b) =>
                    new Date(b.date || 0) - new Date(a.date || 0)
                );

                konfiHistory = {
                    history: allHistory,
                    totals: {
                        gottesdienst: konfi.gottesdienst_points || 0,
                        gemeinde: konfi.gemeinde_points || 0,
                        total: (konfi.gottesdienst_points || 0) + (konfi.gemeinde_points || 0)
                    }
                };
            }

            res.json({
                ...konfi,
                activities: activities || [],
                bonusPoints: bonusPoints || [],
                badgeCount: badgeResult ? badgeResult.badgeCount : 0,
                ...(konfi.role_name === 'teamer' ? { certificates, teamerEvents, konfiHistory } : {})
            });

        } catch (err) {
 console.error('Database error in GET /konfis/:id (second route):', err);
            res.status(500).json({ error: 'Datenbankfehler' });
        }
    });

    // GET event points for konfi
    router.get('/:id/event-points', rbacVerifier, requireTeamer, async (req, res) => {
        const konfiId = req.params.id;
        
        try {
            const eventPointsQuery = `
                SELECT ep.*, e.name as event_name, e.event_date, u.display_name as admin_name
                FROM event_points ep
                JOIN events e ON ep.event_id = e.id
                LEFT JOIN users u ON ep.admin_id = u.id
                WHERE ep.konfi_id = $1 AND ep.organization_id = $2
                ORDER BY ep.awarded_date DESC, ep.created_at DESC
            `;
            const { rows: eventPoints } = await db.query(eventPointsQuery, [konfiId, req.user.organization_id]);
            res.json(eventPoints || []);
        } catch (err) {
 console.error('Database error in GET /konfis/:id/event-points:', err);
            res.status(500).json({ error: 'Datenbankfehler' });
        }
    });

    // GET attendance stats for konfi (mandatory events)
    router.get('/:id/attendance-stats', rbacVerifier, requireAdmin, async (req, res) => {
        const konfiId = req.params.id;

        try {
            // Jahrgang des Konfis ermitteln
            const jahrgangResult = await db.query(
                'SELECT jahrgang_id FROM konfi_profiles WHERE user_id = $1',
                [konfiId]
            );

            if (jahrgangResult.rows.length === 0) {
                return res.status(404).json({ error: 'Konfi nicht gefunden' });
            }

            const jahrgangId = jahrgangResult.rows[0].jahrgang_id;

            if (!jahrgangId) {
                return res.json({ total_mandatory: 0, attended: 0, percentage: 100, missed_events: [] });
            }

            // Alle vergangenen Pflicht-Events des Jahrgangs mit Booking-Status
            const { rows } = await db.query(`
                SELECT
                    e.id as event_id,
                    e.name as event_name,
                    e.event_date,
                    e.location,
                    eb.status as booking_status,
                    eb.attendance_status,
                    eb.opt_out_reason
                FROM events e
                JOIN event_jahrgang_assignments eja ON e.id = eja.event_id
                LEFT JOIN event_bookings eb ON e.id = eb.event_id AND eb.user_id = $1
                WHERE eja.jahrgang_id = $2
                    AND e.mandatory = true
                    AND e.event_date < NOW()
                    AND (e.cancelled IS NOT TRUE)
                    AND e.organization_id = $3
                ORDER BY e.event_date DESC
            `, [konfiId, jahrgangId, req.user.organization_id]);

            const total_mandatory = rows.length;
            const attended = rows.filter(r => r.attendance_status === 'present').length;
            const percentage = total_mandatory > 0 ? Math.round((attended / total_mandatory) * 100) : 100;

            const missed_events = rows
                .filter(r => r.attendance_status !== 'present')
                .map(r => ({
                    event_id: r.event_id,
                    event_name: r.event_name,
                    event_date: r.event_date,
                    location: r.location,
                    status: r.booking_status === 'opted_out' ? 'opted_out' : 'absent',
                    opt_out_reason: r.booking_status === 'opted_out' ? r.opt_out_reason : null
                }));

            res.json({ total_mandatory, attended, percentage, missed_events });
        } catch (err) {
            console.error('Database error in GET /konfis/:id/attendance-stats:', err);
            res.status(500).json({ error: 'Datenbankfehler' });
        }
    });

    // POST bonus points for a konfi
    router.post('/:id/bonus-points', rbacVerifier, requireTeamer, validateBonusPoints, async (req, res) => {
        const { points, type, description } = req.body;
        if (!points || !type || !description) {
            return res.status(400).json({ error: 'Punkte, Typ und Beschreibung sind erforderlich' });
        }

        try {
            // Guard: Punkte-Typ muss für den Jahrgang aktiviert sein
            const { enabled, error } = await checkPointTypeEnabled(db, req.params.id, type);
            if (!enabled) return res.status(400).json({ error });

            const updateField = getPointField(type);

            const client = await db.getClient();
            try {
                await client.query('BEGIN');

                const query = `
                    INSERT INTO bonus_points (konfi_id, points, type, description, admin_id, organization_id, created_at)
                    VALUES ($1, $2, $3, $4, $5, $6, NOW())`;
                await client.query(query, [req.params.id, points, type, description, req.user.id, req.user.organization_id]);

                const updateQuery = `
                    UPDATE konfi_profiles
                    SET ${updateField} = ${updateField} + $1
                    WHERE user_id = $2`;
                await client.query(updateQuery, [points, req.params.id]);

                await client.query('COMMIT');
            } catch (txErr) {
                await client.query('ROLLBACK');
                throw txErr;
            } finally {
                client.release();
            }

            // Badge-Check NACH COMMIT (verwendet db Pool)
            try {
                const newBadges = await checkAndAwardBadges(db, req.params.id);
                if (newBadges > 0) {
                }
            } catch (badgeErr) {
 console.error('Error checking badges after bonus points:', badgeErr);
                // Don't fail the request if badge checking fails
            }

            // Level-Check NACH Badge-Check
            try {
                await PushService.checkAndSendLevelUp(db, parseInt(req.params.id), req.user.organization_id);
            } catch (levelErr) {
                console.error('Level-up check failed:', levelErr);
            }

            // Push-Notification an Konfi senden
            try {
                await PushService.sendBonusPointsToKonfi(db, req.params.id, points, description, type);
            } catch (pushErr) {
 console.error('Error sending bonus points push:', pushErr);
            }

            res.status(201).json({ message: 'Bonuspunkte erfolgreich hinzugefügt' });

            // Live Update: Notify konfi about dashboard (points) and admins about konfi change
            liveUpdate.sendToUser('konfi', parseInt(req.params.id), 'dashboard', 'update', { points });
            liveUpdate.sendToOrgAdmins(req.user.organization_id, 'konfis', 'update', { konfiId: req.params.id });

        } catch (err) {
            if (err.message === 'Ungueltiger Punktetyp') {
                return res.status(400).json({ error: 'Ungueltiger Punktetyp. Erlaubt: gottesdienst, gemeinde' });
            }
 console.error('Database error in POST /konfis/:id/bonus-points:', err);
            res.status(500).json({ error: 'Datenbankfehler' });
        }
    });

    // DELETE bonus points
    router.delete('/:id/bonus-points/:bonusId', rbacVerifier, requireAdmin, async (req, res) => {
        const client = await db.getClient();
        try {
            await client.query('BEGIN');

            const { rows: [bonus] } = await client.query('SELECT * FROM bonus_points WHERE id = $1 AND konfi_id = $2', [req.params.bonusId, req.params.id]);

            if (!bonus) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'Bonuspunkte nicht gefunden' });
            }

            await client.query('DELETE FROM bonus_points WHERE id = $1', [req.params.bonusId]);

            const updateField = getPointField(bonus.type);
            const updateQuery = `
                UPDATE konfi_profiles
                SET ${updateField} = GREATEST(0, ${updateField} - $1)
                WHERE user_id = $2`;
            await client.query(updateQuery, [bonus.points, req.params.id]);

            await client.query('COMMIT');

            // Badge-Check NACH COMMIT (verwendet db Pool)
            try {
                await checkAndAwardBadges(db, req.params.id);
            } catch (badgeErr) {
 console.error('Error checking badges after bonus points removal:', badgeErr);
                // Don't fail the request if badge checking fails
            }

            res.json({ message: 'Bonuspunkte erfolgreich gelöscht' });

            // Live Update: Notify konfi about dashboard (points) and admins about konfi change
            liveUpdate.sendToUser('konfi', parseInt(req.params.id), 'dashboard', 'update', { points: -bonus.points });
            liveUpdate.sendToOrgAdmins(req.user.organization_id, 'konfis', 'update', { konfiId: req.params.id });

        } catch (err) {
 console.error('Database error in DELETE /konfis/:id/bonus-points/:bonusId:', err);
            res.status(500).json({ error: 'Datenbankfehler' });
        } finally {
            client.release();
        }
    });

    // POST activity for a konfi
    router.post('/:id/activities', rbacVerifier, requireAdmin, validateAddActivity, async (req, res) => {
        const { activity_id, completed_date, comment } = req.body;
        if (!activity_id || !completed_date) {
            return res.status(400).json({ error: 'Aktivitäts-ID und Datum sind erforderlich' });
        }

        try {
            const { rows: [activity] } = await db.query('SELECT * FROM activities WHERE id = $1 AND organization_id = $2', [activity_id, req.user.organization_id]);

            if (!activity) {
                return res.status(404).json({ error: 'Aktivität nicht gefunden' });
            }

            const isTeamerActivity = activity.target_role === 'teamer';

            if (!isTeamerActivity) {
                // Guard: Punkte-Typ muss fuer den Jahrgang aktiviert sein
                const { enabled: ptEnabled, error: ptError } = await checkPointTypeEnabled(db, req.params.id, activity.type);
                if (!ptEnabled) return res.status(400).json({ error: ptError });
            }

            const client = await db.getClient();
            try {
                await client.query('BEGIN');

                const query = `
                    INSERT INTO user_activities (user_id, activity_id, completed_date, comment, admin_id, organization_id, created_at)
                    VALUES ($1, $2, $3, $4, $5, $6, NOW())`;
                await client.query(query, [req.params.id, activity_id, completed_date, comment || '', req.user.id, req.user.organization_id]);

                if (!isTeamerActivity && activity.points && activity.type) {
                    const updateField = getPointField(activity.type);
                    const updateQuery = `
                        UPDATE konfi_profiles
                        SET ${updateField} = ${updateField} + $1
                        WHERE user_id = $2`;
                    await client.query(updateQuery, [activity.points, req.params.id]);
                }

                await client.query('COMMIT');
            } catch (txErr) {
                await client.query('ROLLBACK');
                throw txErr;
            } finally {
                client.release();
            }

            // Badge-Check NACH COMMIT (verwendet db Pool)
            try {
                const newBadges = await checkAndAwardBadges(db, req.params.id);
                if (newBadges > 0) {
                }
            } catch (badgeErr) {
 console.error('Error checking badges after activity:', badgeErr);
                // Don't fail the request if badge checking fails
            }

            res.status(201).json({ message: 'Aktivität erfolgreich hinzugefügt' });

            // Live Update: Notify konfi about dashboard (points) and admins about konfi change
            liveUpdate.sendToUser('konfi', parseInt(req.params.id), 'dashboard', 'update', { points: activity.points });
            liveUpdate.sendToOrgAdmins(req.user.organization_id, 'konfis', 'update', { konfiId: req.params.id });

        } catch (err) {
 console.error('Database error in POST /konfis/:id/activities:', err);
            res.status(500).json({ error: 'Datenbankfehler' });
        }
    });

    // DELETE activity for a konfi
    router.delete('/:id/activities/:activityId', rbacVerifier, requireAdmin, async (req, res) => {
        const client = await db.getClient();
        try {
            await client.query('BEGIN');

            const getActivityQuery = `
                SELECT ka.*, a.points, a.type
                FROM user_activities ka
                JOIN activities a ON ka.activity_id = a.id
                WHERE ka.id = $1 AND ka.user_id = $2`;
            const { rows: [activity] } = await client.query(getActivityQuery, [req.params.activityId, req.params.id]);

            if (!activity) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'Aktivität nicht gefunden' });
            }

            await client.query('DELETE FROM user_activities WHERE id = $1 AND organization_id = $2', [req.params.activityId, req.user.organization_id]);

            const updateField = getPointField(activity.type);
            const updateQuery = `
                UPDATE konfi_profiles
                SET ${updateField} = GREATEST(0, ${updateField} - $1)
                WHERE user_id = $2`;
            await client.query(updateQuery, [activity.points, req.params.id]);

            await client.query('COMMIT');

            // Badge-Check NACH COMMIT (verwendet db Pool)
            try {
                await checkAndAwardBadges(db, req.params.id);
            } catch (badgeErr) {
 console.error('Error checking badges after activity removal:', badgeErr);
                // Don't fail the request if badge checking fails
            }

            res.json({ message: 'Aktivität erfolgreich gelöscht' });

            // Live Update: Notify konfi about dashboard (points) and admins about konfi change
            liveUpdate.sendToUser('konfi', parseInt(req.params.id), 'dashboard', 'update', { points: -activity.points });
            liveUpdate.sendToOrgAdmins(req.user.organization_id, 'konfis', 'update', { konfiId: req.params.id });

        } catch (err) {
 console.error('Database error in DELETE /konfis/:id/activities/:activityId:', err);
            res.status(500).json({ error: 'Datenbankfehler' });
        } finally {
            client.release();
        }
    });

    // PUT teamer_since - Aktiv-seit-Datum aendern
    router.put('/:id/teamer-since', rbacVerifier, requireAdmin, validateParamId, async (req, res) => {
        try {
            const { teamer_since } = req.body;
            if (!teamer_since) {
                return res.status(400).json({ error: 'teamer_since ist erforderlich' });
            }
            const result = await db.query(
                'UPDATE users SET teamer_since = $1 WHERE id = $2 AND organization_id = $3 RETURNING teamer_since',
                [teamer_since, req.params.id, req.user.organization_id]
            );
            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'User nicht gefunden' });
            }
            res.json({ teamer_since: result.rows[0].teamer_since });
        } catch (err) {
            console.error('Database error in PUT /konfis/:id/teamer-since:', err);
            res.status(500).json({ error: 'Datenbankfehler' });
        }
    });

    // POST promote konfi to teamer
    router.post('/:id/promote-teamer', rbacVerifier, requireAdmin, validateParamId, async (req, res) => {
        const konfiId = parseInt(req.params.id);

        const client = await db.getClient();
        try {
            await client.query('BEGIN');

            // 1. User existiert in gleicher Organisation und ist Konfi
            const checkUserQuery = `
                SELECT u.id, u.display_name, r.name as role_name
                FROM users u
                JOIN roles r ON u.role_id = r.id
                WHERE u.id = $1 AND u.organization_id = $2
            `;
            const { rows: [user] } = await client.query(checkUserQuery, [konfiId, req.user.organization_id]);

            if (!user) {
                await client.query('ROLLBACK');
                return res.status(404).json({ error: 'User nicht gefunden' });
            }

            if (user.role_name !== 'konfi') {
                await client.query('ROLLBACK');
                return res.status(400).json({ error: 'User ist kein Konfi und kann nicht befördert werden' });
            }

            // 2. Teamer-Role-ID laden (org-spezifisch oder global)
            let teamerRoleQuery = `SELECT id FROM roles WHERE name = 'teamer' AND organization_id = $1`;
            let { rows: [teamerRole] } = await client.query(teamerRoleQuery, [req.user.organization_id]);

            if (!teamerRole) {
                // Fallback: globale Teamer-Rolle
                const globalQuery = `SELECT id FROM roles WHERE name = 'teamer' AND organization_id IS NULL`;
                const { rows: [globalRole] } = await client.query(globalQuery);
                teamerRole = globalRole;
            }

            if (!teamerRole) {
                await client.query('ROLLBACK');
                return res.status(500).json({ error: 'Teamer-Rolle nicht gefunden' });
            }

            // 3. Rolle aendern + teamer_since setzen
            await client.query('UPDATE users SET role_id = $1, teamer_since = CURRENT_DATE WHERE id = $2', [teamerRole.id, konfiId]);

            // 4. Event-Buchungen loeschen
            await client.query('DELETE FROM event_bookings WHERE user_id = $1', [konfiId]);

            // 5. Offene Antraege loeschen
            await client.query("DELETE FROM activity_requests WHERE konfi_id = $1 AND status = 'pending'", [konfiId]);

            // 6. Jahrgang aus konfi_profiles in user_jahrgang_assignments uebertragen
            const { rows: [konfiProfile] } = await client.query(
                'SELECT jahrgang_id FROM konfi_profiles WHERE user_id = $1', [konfiId]
            );
            if (konfiProfile && konfiProfile.jahrgang_id) {
                const { rows: [existing] } = await client.query(
                    'SELECT id FROM user_jahrgang_assignments WHERE user_id = $1 AND jahrgang_id = $2',
                    [konfiId, konfiProfile.jahrgang_id]
                );
                if (!existing) {
                    await client.query(
                        'INSERT INTO user_jahrgang_assignments (user_id, jahrgang_id, can_view, can_edit) VALUES ($1, $2, true, true)',
                        [konfiId, konfiProfile.jahrgang_id]
                    );
                }
            }

            // 7. konfi_profiles BLEIBT bestehen
            // 8. user_badges BLEIBEN bestehen
            // 9. Chat-Teilnahmen: user_type aktualisieren damit Räume sichtbar bleiben
            await client.query("UPDATE chat_participants SET user_type = 'teamer' WHERE user_id = $1 AND user_type = 'konfi'", [konfiId]);
            await client.query("UPDATE chat_read_status SET user_type = 'teamer' WHERE user_id = $1 AND user_type = 'konfi'", [konfiId]);

            await client.query('COMMIT');

            res.json({
                success: true,
                message: 'Konfi wurde zum Teamer befördert',
                user: {
                    id: konfiId,
                    display_name: user.display_name,
                    role_name: 'teamer'
                }
            });

        } catch (err) {
            await client.query('ROLLBACK').catch(rbErr => console.error('Rollback failed:', rbErr));
            console.error('Database error in POST /konfis/:id/promote-teamer:', err);
            res.status(500).json({ error: 'Datenbankfehler' });
        } finally {
            client.release();
        }
    });

    return router;
};