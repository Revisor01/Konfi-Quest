const express = require('express');
const bcrypt = require('bcrypt');
const { generateBiblicalPassword } = require('../utils/passwordUtils');
const router = express.Router();

module.exports = (db, rbacVerifier, checkPermission, filterByJahrgangAccess) => {

    // GET all konfis for the admin's organization (with jahrgang filtering)
    router.get('/', rbacVerifier, checkPermission('admin.konfis.view'), async (req, res) => {
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
                SELECT u.id, u.display_name as name, u.username, kp.password_plain, 
                       kp.gottesdienst_points, kp.gemeinde_points,
                       j.name as jahrgang_name, j.id as jahrgang_id,
                       (SELECT COUNT(*) FROM konfi_badges WHERE konfi_id = u.id) as badgeCount
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
            res.status(500).json({ error: 'Database error' });
        }
    });

    // GET a single konfi by ID with full details
    router.get('/:id', rbacVerifier, checkPermission('admin.konfis.view'), async (req, res) => {
        try {
            const konfiQuery = `
                SELECT u.id, u.display_name as name, u.username, kp.password_plain as password,
                       kp.gottesdienst_points, kp.gemeinde_points,
                       j.name as jahrgang_name, j.id as jahrgang_id,
                       (SELECT COUNT(*) FROM konfi_badges WHERE konfi_id = u.id) as badgeCount
                FROM users u
                JOIN roles r ON u.role_id = r.id
                LEFT JOIN konfi_profiles kp ON u.id = kp.user_id
                LEFT JOIN jahrgaenge j ON kp.jahrgang_id = j.id
                WHERE r.name = 'konfi' AND u.id = $1 AND u.organization_id = $2
            `;
            const { rows: [konfi] } = await db.query(konfiQuery, [req.params.id, req.user.organization_id]);

            if (!konfi) {
                return res.status(404).json({ error: 'Konfi not found' });
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
            res.status(500).json({ error: 'Database error' });
        }
    });

    // POST (create) a new konfi
    router.post('/', rbacVerifier, checkPermission('admin.konfis.create'), async (req, res) => {
        const { name, jahrgang_id } = req.body;
        if (!name || !jahrgang_id) {
            return res.status(400).json({ error: 'Name and Jahrgang are required' });
        }

        const password = generateBiblicalPassword();
        const hashedPassword = bcrypt.hashSync(password, 10);
        const username = name.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z.äöüß]/g, '');

        try {
            await db.query('BEGIN');

            const roleQuery = "SELECT id FROM roles WHERE name = 'konfi' AND organization_id = $1";
            const { rows: [role] } = await db.query(roleQuery, [req.user.organization_id]);

            if (!role) {
                await db.query('ROLLBACK');
                return res.status(500).json({ error: 'Konfi role not found' });
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

            await db.query('COMMIT');
            res.status(201).json({ id: userId, username, password, message: 'Konfi created successfully' });

        } catch (err) {
            await db.query('ROLLBACK').catch(rbErr => console.error('Rollback failed:', rbErr));

            if (err.code === '23505') { // unique_violation
                return res.status(409).json({ error: 'Username already exists' });
            }
            console.error('Database error in POST /konfis:', err);
            res.status(500).json({ error: 'Database error' });
        }
    });

    // PUT (update) a konfi
    router.put('/:id', rbacVerifier, checkPermission('admin.konfis.edit'), async (req, res) => {
        const { name, jahrgang_id } = req.body;
        if (!name || !jahrgang_id) {
            return res.status(400).json({ error: 'Name and Jahrgang are required' });
        }
        const username = name.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z.äöüß]/g, '');

        try {
            await db.query('BEGIN');
            
            const userQuery = `
                UPDATE users SET display_name = $1, username = $2 
                WHERE id = $3 AND organization_id = $4`;
            const { rowCount: userUpdateCount } = await db.query(userQuery, [name, username, req.params.id, req.user.organization_id]);

            if (userUpdateCount === 0) {
                await db.query('ROLLBACK');
                return res.status(404).json({ error: 'Konfi not found' });
            }

            const profileQuery = `UPDATE konfi_profiles SET jahrgang_id = $1 WHERE user_id = $2`;
            await db.query(profileQuery, [jahrgang_id, req.params.id]);

            await db.query('COMMIT');
            res.json({ message: 'Konfi updated successfully' });

        } catch (err) {
            await db.query('ROLLBACK').catch(rbErr => console.error('Rollback failed:', rbErr));
            console.error('Database error in PUT /konfis/:id:', err);
            res.status(500).json({ error: 'Database error' });
        }
    });

    // DELETE a konfi
    router.delete('/:id', rbacVerifier, checkPermission('admin.konfis.delete'), async (req, res) => {
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
                return res.status(404).json({ error: 'Konfi not found' });
            }
            
            // Delete related data
            await db.query("DELETE FROM konfi_activities WHERE konfi_id = $1 AND organization_id = $2", [userId, req.user.organization_id]);
            await db.query("DELETE FROM bonus_points WHERE konfi_id = $1 AND organization_id = $2", [userId, req.user.organization_id]);
            await db.query("DELETE FROM konfi_badges WHERE konfi_id = $1", [userId]);
            await db.query("DELETE FROM activity_requests WHERE konfi_id = $1 AND organization_id = $2", [userId, req.user.organization_id]);
            await db.query("DELETE FROM chat_participants WHERE user_id = $1 AND user_type = 'konfi'", [userId]);
            await db.query("DELETE FROM konfi_profiles WHERE user_id = $1", [userId]);
            await db.query("DELETE FROM users WHERE id = $1", [userId]);
            
            await db.query('COMMIT');
            res.json({ message: 'Konfi deleted successfully' });

        } catch (err) {
            await db.query('ROLLBACK').catch(rbErr => console.error('Rollback failed:', rbErr));
            console.error('Database error in DELETE /konfis/:id:', err);
            res.status(500).json({ error: 'Database error' });
        }
    });

    // Regenerate password for a konfi
    router.post('/:id/regenerate-password', rbacVerifier, checkPermission('admin.konfis.reset_password'), async (req, res) => {
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
                return res.status(404).json({ error: 'Konfi not found' });
            }
            
            const updateProfileQuery = "UPDATE konfi_profiles SET password_plain = $1 WHERE user_id = $2";
            await db.query(updateProfileQuery, [newPassword, req.params.id]);

            await db.query('COMMIT');
            res.json({ message: 'Password regenerated successfully', password: newPassword });

        } catch (err) {
            await db.query('ROLLBACK').catch(rbErr => console.error('Rollback failed:', rbErr));
            console.error('Database error in POST /konfis/:id/regenerate-password:', err);
            res.status(500).json({ error: 'Database error' });
        }
    });

    // GET single konfi details with activities, bonusPoints, eventPoints
    router.get('/:id', rbacVerifier, checkPermission('admin.konfis.view'), async (req, res) => {
        const konfiId = req.params.id;
        console.log('📝 Loading details for konfi:', konfiId, 'Organization:', req.user.organization_id);
        
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
                return res.status(404).json({ error: 'Konfi not found' });
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
            res.status(500).json({ error: 'Database error' });
        }
    });

    // GET event points for konfi
    router.get('/:id/event-points', rbacVerifier, checkPermission('admin.konfis.view'), async (req, res) => {
        const konfiId = req.params.id;
        console.log('📝 Loading event points for konfi:', konfiId, 'Organization:', req.user.organization_id);
        
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
            res.status(500).json({ error: 'Database error' });
        }
    });

    // POST bonus points for a konfi
    router.post('/:id/bonus-points', rbacVerifier, checkPermission('admin.konfis.edit'), async (req, res) => {
        const { points, type, description } = req.body;
        if (!points || !type || !description) {
            return res.status(400).json({ error: 'Points, type and description are required' });
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

            res.status(201).json({ message: 'Bonus points added successfully' });
        } catch (err) {
            console.error('Database error in POST /konfis/:id/bonus-points:', err);
            res.status(500).json({ error: 'Database error' });
        }
    });

    // DELETE bonus points
    router.delete('/:id/bonus-points/:bonusId', rbacVerifier, checkPermission('admin.konfis.edit'), async (req, res) => {
        try {
            const { rows: [bonus] } = await db.query('SELECT * FROM bonus_points WHERE id = $1 AND konfi_id = $2', [req.params.bonusId, req.params.id]);
            
            if (!bonus) {
                return res.status(404).json({ error: 'Bonus points not found' });
            }
            
            await db.query('DELETE FROM bonus_points WHERE id = $1', [req.params.bonusId]);
            
            const updateField = bonus.type === 'gottesdienst' ? 'gottesdienst_points' : 'gemeinde_points';
            const updateQuery = `
                UPDATE konfi_profiles 
                SET ${updateField} = ${updateField} - $1 
                WHERE user_id = $2`;
            await db.query(updateQuery, [bonus.points, req.params.id]);

            res.json({ message: 'Bonus points deleted successfully' });
        } catch (err) {
            console.error('Database error in DELETE /konfis/:id/bonus-points/:bonusId:', err);
            res.status(500).json({ error: 'Database error' });
        }
    });

    // POST activity for a konfi
    router.post('/:id/activities', rbacVerifier, checkPermission('admin.konfis.edit'), async (req, res) => {
        const { activity_id, completed_date, comment } = req.body;
        if (!activity_id || !completed_date) {
            return res.status(400).json({ error: 'Activity ID and date are required' });
        }

        try {
            const { rows: [activity] } = await db.query('SELECT * FROM activities WHERE id = $1 AND organization_id = $2', [activity_id, req.user.organization_id]);

            if (!activity) {
                return res.status(404).json({ error: 'Activity not found' });
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

            res.status(201).json({ message: 'Activity added successfully' });
        } catch (err) {
            console.error('Database error in POST /konfis/:id/activities:', err);
            res.status(500).json({ error: 'Database error' });
        }
    });

    // DELETE activity for a konfi
    router.delete('/:id/activities/:activityId', rbacVerifier, checkPermission('admin.konfis.edit'), async (req, res) => {
        try {
            const getActivityQuery = `
                SELECT ka.*, a.points, a.type 
                FROM konfi_activities ka 
                JOIN activities a ON ka.activity_id = a.id
                WHERE ka.id = $1 AND ka.konfi_id = $2`;
            const { rows: [activity] } = await db.query(getActivityQuery, [req.params.activityId, req.params.id]);
            
            if (!activity) {
                return res.status(404).json({ error: 'Activity not found' });
            }
            
            await db.query('DELETE FROM konfi_activities WHERE id = $1 AND organization_id = $2', [req.params.activityId, req.user.organization_id]);
            
            const updateField = activity.type === 'gottesdienst' ? 'gottesdienst_points' : 'gemeinde_points';
            const updateQuery = `
                UPDATE konfi_profiles 
                SET ${updateField} = ${updateField} - $1 
                WHERE user_id = $2`;
            await db.query(updateQuery, [activity.points, req.params.id]);

            res.json({ message: 'Activity deleted successfully' });
        } catch (err) {
            console.error('Database error in DELETE /konfis/:id/activities/:activityId:', err);
            res.status(500).json({ error: 'Database error' });
        }
    });

    return router;
};