const express = require('express');
const bcrypt = require('bcrypt');
const { generateBiblicalPassword } = require('../utils/passwordUtils');
const liveUpdate = require('../utils/liveUpdate');
const router = express.Router();

// Konfis: Teamer darf ansehen, Admin darf bearbeiten
module.exports = (db, rbacVerifier, { requireAdmin, requireTeamer }, filterByJahrgangAccess, checkAndAwardBadges) => {

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
                       (SELECT COUNT(*) FROM konfi_badges WHERE konfi_id = u.id) as "badgeCount"
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

    // GET a single konfi by ID with full details
    router.get('/:id', rbacVerifier, requireTeamer, async (req, res) => {
        try {
            const konfiQuery = `
                SELECT u.id, u.display_name as name, u.username,
                       kp.gottesdienst_points, kp.gemeinde_points,
                       j.name as jahrgang_name, j.id as jahrgang_id,
                       (SELECT COUNT(*) FROM konfi_badges WHERE konfi_id = u.id) as "badgeCount"
                FROM users u
                JOIN roles r ON u.role_id = r.id
                LEFT JOIN konfi_profiles kp ON u.id = kp.user_id
                LEFT JOIN jahrgaenge j ON kp.jahrgang_id = j.id
                WHERE r.name = 'konfi' AND u.id = $1 AND u.organization_id = $2
            `;
            const { rows: [konfi] } = await db.query(konfiQuery, [req.params.id, req.user.organization_id]);

            if (!konfi) {
                return res.status(404).json({ error: 'Konfi nicht gefunden' });
            }

            // Get activities
            const activitiesQuery = `
                SELECT ka.id, a.name, a.points, a.type, ka.completed_date as date,
                       u.display_name as admin
                FROM konfi_activities ka
                JOIN activities a ON ka.activity_id = a.id
                LEFT JOIN users u ON ka.admin_id = u.id
                WHERE ka.konfi_id = $1 AND a.organization_id = $2
                ORDER BY ka.completed_date DESC
            `;
            const { rows: activities } = await db.query(activitiesQuery, [req.params.id, req.user.organization_id]);

            // Get bonus points
            const bonusQuery = `
                SELECT bp.id, bp.points, bp.type, bp.description, bp.created_at as date,
                       u.display_name as admin
                FROM bonus_points bp
                LEFT JOIN users u ON bp.admin_id = u.id
                WHERE bp.konfi_id = $1 AND bp.organization_id = $2
                ORDER BY bp.created_at DESC
            `;
            const { rows: bonusPoints } = await db.query(bonusQuery, [req.params.id, req.user.organization_id]);

            konfi.activities = activities || [];
            konfi.bonusPoints = bonusPoints || [];
            konfi.totalBonus = bonusPoints.reduce((sum, bp) => sum + bp.points, 0);

            res.json(konfi);
        } catch (err) {
 console.error('Database error in GET /konfis/:id (first route):', err);
            res.status(500).json({ error: 'Datenbankfehler' });
        }
    });

    // POST (create) a new konfi
    router.post('/', rbacVerifier, requireAdmin, async (req, res) => {
        const { name, jahrgang_id } = req.body;
        if (!name || !jahrgang_id) {
            return res.status(400).json({ error: 'Name und Jahrgang sind erforderlich' });
        }

        const password = generateBiblicalPassword();
        const hashedPassword = bcrypt.hashSync(password, 10);
        const username = name.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z.äöüß]/g, '');

        try {
            await db.query('BEGIN');

            // First verify that the jahrgang exists
            const jahrgangCheckQuery = "SELECT id FROM jahrgaenge WHERE id = $1 AND organization_id = $2";
            const { rows: [jahrgangExists] } = await db.query(jahrgangCheckQuery, [jahrgang_id, req.user.organization_id]);
            
            if (!jahrgangExists) {
                await db.query('ROLLBACK');
                return res.status(400).json({ error: 'Jahrgang nicht gefunden oder gehört nicht zu Ihrer Organisation' });
            }

            const roleQuery = "SELECT id FROM roles WHERE name = 'konfi' AND organization_id = $1";
            const { rows: [role] } = await db.query(roleQuery, [req.user.organization_id]);

            if (!role) {
                await db.query('ROLLBACK');
                return res.status(500).json({ error: 'Konfi-Rolle nicht gefunden' });
            }

            const userQuery = `
                INSERT INTO users (username, display_name, password_hash, role_id, organization_id) 
                VALUES ($1, $2, $3, $4, $5) 
                RETURNING id`;
            const { rows: [newUser] } = await db.query(userQuery, [username, name, hashedPassword, role.id, req.user.organization_id]);
            const userId = newUser.id;

            const profileQuery = `
                INSERT INTO konfi_profiles (user_id, jahrgang_id, organization_id, password_plain, gottesdienst_points, gemeinde_points) 
                VALUES ($1, $2, $3, $4, 0, 0)`;
            await db.query(profileQuery, [userId, jahrgang_id, req.user.organization_id, password]);

            // Add konfi to jahrgang chat room if it exists
            const jahrgangChatQuery = `
                SELECT id FROM chat_rooms 
                WHERE type = 'jahrgang' AND jahrgang_id = $1 AND organization_id = $2
            `;
            const { rows: [jahrgangChat] } = await db.query(jahrgangChatQuery, [jahrgang_id, req.user.organization_id]);
            
            if (jahrgangChat) {
                // Check if konfi is not already a participant (shouldn't happen, but safety first)
                const existingParticipantQuery = `
                    SELECT id FROM chat_participants 
                    WHERE room_id = $1 AND user_id = $2 AND user_type = 'konfi'
                `;
                const { rows: [existingParticipant] } = await db.query(existingParticipantQuery, [jahrgangChat.id, userId]);
                
                if (!existingParticipant) {
                    const addParticipantQuery = `
                        INSERT INTO chat_participants (room_id, user_id, user_type, joined_at) 
                        VALUES ($1, $2, 'konfi', NOW())
                    `;
                    await db.query(addParticipantQuery, [jahrgangChat.id, userId]);
 console.log(`Added konfi ${name} (${userId}) to jahrgang chat ${jahrgangChat.id}`);
                }
            }

            await db.query('COMMIT');
            res.status(201).json({ id: userId, username, password, message: 'Konfi erfolgreich erstellt' });

        } catch (err) {
 await db.query('ROLLBACK').catch(rbErr => console.error('Rollback failed:', rbErr));

            if (err.code === '23505') { // unique_violation
                return res.status(409).json({ error: 'Benutzername existiert bereits' });
            }
 console.error('Database error in POST /konfis:', err);
            res.status(500).json({ error: 'Datenbankfehler' });
        }
    });

    // PUT (update) a konfi
    router.put('/:id', rbacVerifier, requireAdmin, async (req, res) => {
        const { name, jahrgang_id } = req.body;
        if (!name || !jahrgang_id) {
            return res.status(400).json({ error: 'Name und Jahrgang sind erforderlich' });
        }
        const username = name.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z.äöüß]/g, '');

        try {
            await db.query('BEGIN');
            
            // Get current jahrgang_id before update
            const currentProfileQuery = `SELECT jahrgang_id FROM konfi_profiles WHERE user_id = $1`;
            const { rows: [currentProfile] } = await db.query(currentProfileQuery, [req.params.id]);
            
            const userQuery = `
                UPDATE users SET display_name = $1, username = $2 
                WHERE id = $3 AND organization_id = $4`;
            const { rowCount: userUpdateCount } = await db.query(userQuery, [name, username, req.params.id, req.user.organization_id]);

            if (userUpdateCount === 0) {
                await db.query('ROLLBACK');
                return res.status(404).json({ error: 'Konfi nicht gefunden' });
            }

            const profileQuery = `UPDATE konfi_profiles SET jahrgang_id = $1 WHERE user_id = $2`;
            await db.query(profileQuery, [jahrgang_id, req.params.id]);

            // Handle jahrgang chat membership changes
            if (currentProfile && currentProfile.jahrgang_id !== parseInt(jahrgang_id)) {
                // Remove from old jahrgang chat
                if (currentProfile.jahrgang_id) {
                    const oldJahrgangChatQuery = `
                        SELECT id FROM chat_rooms 
                        WHERE type = 'jahrgang' AND jahrgang_id = $1 AND organization_id = $2
                    `;
                    const { rows: [oldJahrgangChat] } = await db.query(oldJahrgangChatQuery, [currentProfile.jahrgang_id, req.user.organization_id]);
                    
                    if (oldJahrgangChat) {
                        await db.query(`
                            DELETE FROM chat_participants 
                            WHERE room_id = $1 AND user_id = $2 AND user_type = 'konfi'
                        `, [oldJahrgangChat.id, req.params.id]);
 console.log(`Removed konfi ${name} from old jahrgang chat ${oldJahrgangChat.id}`);
                    }
                }
                
                // Add to new jahrgang chat
                const newJahrgangChatQuery = `
                    SELECT id FROM chat_rooms 
                    WHERE type = 'jahrgang' AND jahrgang_id = $1 AND organization_id = $2
                `;
                const { rows: [newJahrgangChat] } = await db.query(newJahrgangChatQuery, [jahrgang_id, req.user.organization_id]);
                
                if (newJahrgangChat) {
                    // Check if not already a participant
                    const existingParticipantQuery = `
                        SELECT id FROM chat_participants 
                        WHERE room_id = $1 AND user_id = $2 AND user_type = 'konfi'
                    `;
                    const { rows: [existingParticipant] } = await db.query(existingParticipantQuery, [newJahrgangChat.id, req.params.id]);
                    
                    if (!existingParticipant) {
                        await db.query(`
                            INSERT INTO chat_participants (room_id, user_id, user_type, joined_at) 
                            VALUES ($1, $2, 'konfi', NOW())
                        `, [newJahrgangChat.id, req.params.id]);
 console.log(`Added konfi ${name} to new jahrgang chat ${newJahrgangChat.id}`);
                    }
                }
            }

            await db.query('COMMIT');
            res.json({ message: 'Konfi erfolgreich aktualisiert' });

        } catch (err) {
 await db.query('ROLLBACK').catch(rbErr => console.error('Rollback failed:', rbErr));
 console.error('Database error in PUT /konfis/:id:', err);
            res.status(500).json({ error: 'Datenbankfehler' });
        }
    });

    // DELETE a konfi
    router.delete('/:id', rbacVerifier, requireAdmin, async (req, res) => {
        const userId = req.params.id;
        try {
            await db.query('BEGIN');

            const checkUserQuery = `
                SELECT u.id FROM users u 
                JOIN roles r ON u.role_id = r.id 
                WHERE u.id = $1 AND u.organization_id = $2 AND r.name = 'konfi'`;
            const { rows: [user] } = await db.query(checkUserQuery, [userId, req.user.organization_id]);

            if (!user) {
                await db.query('ROLLBACK');
                return res.status(404).json({ error: 'Konfi nicht gefunden' });
            }
            
            // Delete related data (in correct order to avoid FK violations)
            await db.query("DELETE FROM konfi_activities WHERE konfi_id = $1 AND organization_id = $2", [userId, req.user.organization_id]);
            await db.query("DELETE FROM bonus_points WHERE konfi_id = $1 AND organization_id = $2", [userId, req.user.organization_id]);
            await db.query("DELETE FROM event_points WHERE konfi_id = $1 AND organization_id = $2", [userId, req.user.organization_id]);
            await db.query("DELETE FROM event_bookings WHERE user_id = $1 AND organization_id = $2", [userId, req.user.organization_id]);
            await db.query("DELETE FROM konfi_badges WHERE konfi_id = $1", [userId]);
            await db.query("DELETE FROM activity_requests WHERE konfi_id = $1 AND organization_id = $2", [userId, req.user.organization_id]);
            await db.query("DELETE FROM chat_participants WHERE user_id = $1 AND user_type = 'konfi'", [userId]);
            await db.query("DELETE FROM chat_read_status WHERE user_id = $1", [userId]);
            await db.query("DELETE FROM chat_messages WHERE user_id = $1", [userId]);
            await db.query("DELETE FROM notifications WHERE user_id = $1", [userId]);
            await db.query("DELETE FROM password_resets WHERE user_id = $1", [userId]);
            await db.query("DELETE FROM user_jahrgang_assignments WHERE user_id = $1", [userId]);
            await db.query("DELETE FROM chat_poll_votes WHERE user_id = $1", [userId]);
            await db.query("DELETE FROM push_tokens WHERE user_id = $1", [userId]);
            await db.query("DELETE FROM konfi_profiles WHERE user_id = $1", [userId]);
            await db.query("DELETE FROM users WHERE id = $1", [userId]);
            
            await db.query('COMMIT');
            res.json({ message: 'Konfi erfolgreich gelöscht' });

        } catch (err) {
 await db.query('ROLLBACK').catch(rbErr => console.error('Rollback failed:', rbErr));
 console.error('Database error in DELETE /konfis/:id:', err);
            res.status(500).json({ error: 'Datenbankfehler' });
        }
    });

    // Regenerate password for a konfi
    router.post('/:id/regenerate-password', rbacVerifier, requireAdmin, async (req, res) => {
        const newPassword = generateBiblicalPassword();
        const hashedPassword = bcrypt.hashSync(newPassword, 10);

        try {
            await db.query('BEGIN');

            const updateUserQuery = `
                UPDATE users SET password_hash = $1 
                WHERE id = $2 AND organization_id = $3`;
            const { rowCount } = await db.query(updateUserQuery, [hashedPassword, req.params.id, req.user.organization_id]);

            if (rowCount === 0) {
                await db.query('ROLLBACK');
                return res.status(404).json({ error: 'Konfi nicht gefunden' });
            }
            
            const updateProfileQuery = "UPDATE konfi_profiles SET password_plain = $1 WHERE user_id = $2";
            await db.query(updateProfileQuery, [newPassword, req.params.id]);

            await db.query('COMMIT');
            res.json({ message: 'Passwort erfolgreich neu generiert', password: newPassword });

        } catch (err) {
 await db.query('ROLLBACK').catch(rbErr => console.error('Rollback failed:', rbErr));
 console.error('Database error in POST /konfis/:id/regenerate-password:', err);
            res.status(500).json({ error: 'Datenbankfehler' });
        }
    });

    // GET single konfi details with activities, bonusPoints, eventPoints
    router.get('/:id', rbacVerifier, requireTeamer, async (req, res) => {
        const konfiId = req.params.id;
 console.log('Loading details for konfi:', konfiId, 'Organization:', req.user.organization_id);
        
        try {
            const konfiQuery = `
                SELECT u.*, kp.gottesdienst_points, kp.gemeinde_points, kp.password_plain,
                       j.name as jahrgang_name, j.id as jahrgang_id
                FROM users u
                JOIN roles r ON u.role_id = r.id
                LEFT JOIN konfi_profiles kp ON u.id = kp.user_id  
                LEFT JOIN jahrgaenge j ON kp.jahrgang_id = j.id
                WHERE u.id = $1 AND r.name = 'konfi' AND u.organization_id = $2
            `;
            const { rows: [konfi] } = await db.query(konfiQuery, [konfiId, req.user.organization_id]);

            if (!konfi) {
                return res.status(404).json({ error: 'Konfi nicht gefunden' });
            }

            const activitiesQuery = `
                SELECT ka.*, a.name, a.points, a.type, u.display_name as admin_name
                FROM konfi_activities ka
                JOIN activities a ON ka.activity_id = a.id
                LEFT JOIN users u ON ka.admin_id = u.id
                WHERE ka.konfi_id = $1 AND ka.organization_id = $2
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

            const badgeQuery = `SELECT COUNT(*) as "badgeCount" FROM konfi_badges WHERE konfi_id = $1`;
            const { rows: [badgeResult] } = await db.query(badgeQuery, [konfiId]);

            res.json({
                ...konfi,
                activities: activities || [],
                bonusPoints: bonusPoints || [],
                badgeCount: badgeResult ? badgeResult.badgeCount : 0,
                password: konfi.password_plain // For admin view
            });

        } catch (err) {
 console.error('Database error in GET /konfis/:id (second route):', err);
            res.status(500).json({ error: 'Datenbankfehler' });
        }
    });

    // GET event points for konfi
    router.get('/:id/event-points', rbacVerifier, requireTeamer, async (req, res) => {
        const konfiId = req.params.id;
 console.log('Loading event points for konfi:', konfiId, 'Organization:', req.user.organization_id);
        
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

    // POST bonus points for a konfi
    router.post('/:id/bonus-points', rbacVerifier, requireAdmin, async (req, res) => {
        const { points, type, description } = req.body;
        if (!points || !type || !description) {
            return res.status(400).json({ error: 'Punkte, Typ und Beschreibung sind erforderlich' });
        }

        try {
            const query = `
                INSERT INTO bonus_points (konfi_id, points, type, description, admin_id, organization_id, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, NOW())`;
            await db.query(query, [req.params.id, points, type, description, req.user.id, req.user.organization_id]);

            const updateField = type === 'gottesdienst' ? 'gottesdienst_points' : 'gemeinde_points';
            const updateQuery = `
                UPDATE konfi_profiles 
                SET ${updateField} = ${updateField} + $1 
                WHERE user_id = $2`;
            await db.query(updateQuery, [points, req.params.id]);

            // Check for new badges after bonus points are added
            try {
                const newBadges = await checkAndAwardBadges(db, req.params.id);
                if (newBadges > 0) {
 console.log(`${newBadges} neue Badge(s) für Konfi ${req.params.id} nach Bonuspunkten vergeben`);
                }
            } catch (badgeErr) {
 console.error('Error checking badges after bonus points:', badgeErr);
                // Don't fail the request if badge checking fails
            }

            res.status(201).json({ message: 'Bonuspunkte erfolgreich hinzugefügt' });

            // Live Update: Notify konfi about dashboard (points) and admins about konfi change
            liveUpdate.sendToUser('konfi', parseInt(req.params.id), 'dashboard', 'update', { points });
            liveUpdate.sendToOrgAdmins(req.user.organization_id, 'konfis', 'update', { konfiId: req.params.id });

        } catch (err) {
 console.error('Database error in POST /konfis/:id/bonus-points:', err);
            res.status(500).json({ error: 'Datenbankfehler' });
        }
    });

    // DELETE bonus points
    router.delete('/:id/bonus-points/:bonusId', rbacVerifier, requireAdmin, async (req, res) => {
        try {
            const { rows: [bonus] } = await db.query('SELECT * FROM bonus_points WHERE id = $1 AND konfi_id = $2', [req.params.bonusId, req.params.id]);
            
            if (!bonus) {
                return res.status(404).json({ error: 'Bonuspunkte nicht gefunden' });
            }
            
            await db.query('DELETE FROM bonus_points WHERE id = $1', [req.params.bonusId]);
            
            const updateField = bonus.type === 'gottesdienst' ? 'gottesdienst_points' : 'gemeinde_points';
            const updateQuery = `
                UPDATE konfi_profiles 
                SET ${updateField} = ${updateField} - $1 
                WHERE user_id = $2`;
            await db.query(updateQuery, [bonus.points, req.params.id]);

            // Check for badge changes after bonus points are removed
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
        }
    });

    // POST activity for a konfi
    router.post('/:id/activities', rbacVerifier, requireAdmin, async (req, res) => {
        const { activity_id, completed_date, comment } = req.body;
        if (!activity_id || !completed_date) {
            return res.status(400).json({ error: 'Aktivitäts-ID und Datum sind erforderlich' });
        }

        try {
            const { rows: [activity] } = await db.query('SELECT * FROM activities WHERE id = $1 AND organization_id = $2', [activity_id, req.user.organization_id]);

            if (!activity) {
                return res.status(404).json({ error: 'Aktivität nicht gefunden' });
            }
            
            const query = `
                INSERT INTO konfi_activities (konfi_id, activity_id, completed_date, comment, admin_id, organization_id, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, NOW())`;
            await db.query(query, [req.params.id, activity_id, completed_date, comment || '', req.user.id, req.user.organization_id]);
            
            const updateField = activity.type === 'gottesdienst' ? 'gottesdienst_points' : 'gemeinde_points';
            const updateQuery = `
                UPDATE konfi_profiles 
                SET ${updateField} = ${updateField} + $1 
                WHERE user_id = $2`;
            await db.query(updateQuery, [activity.points, req.params.id]);

            // Check for new badges after activity is added
            try {
                const newBadges = await checkAndAwardBadges(db, req.params.id);
                if (newBadges > 0) {
 console.log(`${newBadges} neue Badge(s) für Konfi ${req.params.id} nach Aktivität vergeben`);
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
        try {
            const getActivityQuery = `
                SELECT ka.*, a.points, a.type 
                FROM konfi_activities ka 
                JOIN activities a ON ka.activity_id = a.id
                WHERE ka.id = $1 AND ka.konfi_id = $2`;
            const { rows: [activity] } = await db.query(getActivityQuery, [req.params.activityId, req.params.id]);
            
            if (!activity) {
                return res.status(404).json({ error: 'Aktivität nicht gefunden' });
            }
            
            await db.query('DELETE FROM konfi_activities WHERE id = $1 AND organization_id = $2', [req.params.activityId, req.user.organization_id]);
            
            const updateField = activity.type === 'gottesdienst' ? 'gottesdienst_points' : 'gemeinde_points';
            const updateQuery = `
                UPDATE konfi_profiles 
                SET ${updateField} = ${updateField} - $1 
                WHERE user_id = $2`;
            await db.query(updateQuery, [activity.points, req.params.id]);

            // Check for badge changes after activity removal
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
        }
    });

    return router;
};