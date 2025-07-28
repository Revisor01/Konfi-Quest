const express = require('express');
const bcrypt = require('bcrypt');
const { generateBiblicalPassword } = require('../utils/passwordUtils');
const router = express.Router();

module.exports = (db, rbacVerifier, checkPermission, filterByJahrgangAccess) => {

    // GET all konfis for the admin's organization (with jahrgang filtering)
    router.get('/', rbacVerifier, checkPermission('admin.konfis.view'), (req, res) => {
        
        // Apply jahrgang filtering for non-org_admin users
        let jahrgangFilter = '';
        let params = [req.user.organization_id];
        
        if (!req.user.is_super_admin && req.user.role_name !== 'org_admin') {
            // Non-org_admin users see only konfis from their assigned jahrgaenge
            const viewableJahrgaenge = req.user.assigned_jahrgaenge
                .filter(j => j.can_view)
                .map(j => j.id);
                
            if (viewableJahrgaenge.length === 0) {
                return res.json([]); // No access to any jahrgaenge
            }
            
            const placeholders = viewableJahrgaenge.map(() => '?').join(',');
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
            WHERE r.name = 'konfi' AND u.organization_id = ? ${jahrgangFilter}
            ORDER BY j.name DESC, u.display_name
        `;
        
        db.all(query, params, (err, rows) => {
            if (err) {
                console.error('Error fetching konfis for admin:', err);
                return res.status(500).json({ error: 'Database error' });
            }
            res.json(rows);
        });
    });

    // GET a single konfi by ID with full details
    router.get('/:id', rbacVerifier, checkPermission('admin.konfis.view'), (req, res) => {
        const konfiQuery = `
            SELECT u.id, u.display_name as name, u.username, kp.password_plain as password,
                   kp.gottesdienst_points, kp.gemeinde_points,
                   j.name as jahrgang_name, j.id as jahrgang_id,
                   (SELECT COUNT(*) FROM konfi_badges WHERE konfi_id = u.id) as badgeCount
            FROM users u
            JOIN roles r ON u.role_id = r.id
            LEFT JOIN konfi_profiles kp ON u.id = kp.user_id
            LEFT JOIN jahrgaenge j ON kp.jahrgang_id = j.id
            WHERE r.name = 'konfi' AND u.id = ? AND u.organization_id = ?
        `;
        
        db.get(konfiQuery, [req.params.id, req.user.organization_id], (err, konfi) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            if (!konfi) return res.status(404).json({ error: 'Konfi not found' });

            // Get activities
            const activitiesQuery = `
                SELECT ka.id, a.name, a.points, a.type, ka.completed_date as date,
                       u.display_name as admin
                FROM konfi_activities ka
                JOIN activities a ON ka.activity_id = a.id
                LEFT JOIN users u ON ka.admin_id = u.id
                WHERE ka.konfi_id = ? AND a.organization_id = ?
                ORDER BY ka.completed_date DESC
            `;
            
            db.all(activitiesQuery, [req.params.id, req.user.organization_id], (err, activities) => {
                if (err) {
                    console.error('Error fetching activities:', err);
                    activities = [];
                }
                
                // Get bonus points
                const bonusQuery = `
                    SELECT bp.id, bp.points, bp.type, bp.description, bp.created_at as date,
                           u.display_name as admin
                    FROM bonus_points bp
                    LEFT JOIN users u ON bp.admin_id = u.id
                    WHERE bp.konfi_id = ? AND bp.organization_id = ?
                    ORDER BY bp.created_at DESC
                `;
                
                db.all(bonusQuery, [req.params.id, req.user.organization_id], (err, bonusPoints) => {
                    if (err) {
                        console.error('Error fetching bonus points:', err);
                        bonusPoints = [];
                    }
                    
                    konfi.activities = activities || [];
                    konfi.bonusPoints = bonusPoints || [];
                    konfi.totalBonus = bonusPoints.reduce((sum, bp) => sum + bp.points, 0);
                    
                    res.json(konfi);
                });
            });
        });
    });

    // POST (create) a new konfi
    router.post('/', rbacVerifier, checkPermission('admin.konfis.create'), (req, res) => {
        const { name, jahrgang_id } = req.body;
        if (!name || !jahrgang_id) {
            return res.status(400).json({ error: 'Name and Jahrgang are required' });
        }

        const password = generateBiblicalPassword();
        const hashedPassword = bcrypt.hashSync(password, 10);
        const username = name.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z.äöüß]/g, '');

        db.serialize(() => {
            db.run("BEGIN TRANSACTION");
            
            // Get konfi role ID
            db.get("SELECT id FROM roles WHERE name = 'konfi' AND organization_id = ?", [req.user.organization_id], (err, role) => {
                if (err || !role) {
                    db.run("ROLLBACK");
                    return res.status(500).json({ error: 'Konfi role not found' });
                }
                
                // Create user entry
                const userQuery = `INSERT INTO users 
                    (username, display_name, password_hash, role_id, organization_id) 
                    VALUES (?, ?, ?, ?, ?)`;
                
                db.run(userQuery, [username, name, hashedPassword, role.id, req.user.organization_id], function(err) {
                    if (err) {
                        db.run("ROLLBACK");
                        if (err.code === 'SQLITE_CONSTRAINT') {
                            return res.status(409).json({ error: 'Username already exists' });
                        }
                        console.error("Error creating user:", err);
                        return res.status(500).json({ error: 'Database error' });
                    }
                    
                    const userId = this.lastID;
                    
                    // Create konfi profile entry
                    const profileQuery = `INSERT INTO konfi_profiles 
                        (user_id, jahrgang_id, organization_id, password_plain, gottesdienst_points, gemeinde_points) 
                        VALUES (?, ?, ?, ?, 0, 0)`;
                    
                    db.run(profileQuery, [userId, jahrgang_id, req.user.organization_id, password], function(err) {
                        if (err) {
                            db.run("ROLLBACK");
                            console.error("Error creating konfi profile:", err);
                            return res.status(500).json({ error: 'Database error' });
                        }
                        
                        db.run("COMMIT", (err) => {
                            if (err) {
                                return res.status(500).json({ error: 'Commit failed' });
                            }
                            res.status(201).json({ id: userId, username, password, message: 'Konfi created successfully' });
                        });
                    });
                });
            });
        });
    });

    // PUT (update) a konfi
    router.put('/:id', rbacVerifier, checkPermission('admin.konfis.edit'), (req, res) => {
        const { name, jahrgang_id } = req.body;
        if (!name || !jahrgang_id) {
            return res.status(400).json({ error: 'Name and Jahrgang are required' });
        }
        const username = name.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z.äöüß]/g, '');

        db.serialize(() => {
            db.run("BEGIN TRANSACTION");
            
            // Update user table
            const userQuery = `UPDATE users SET display_name = ?, username = ? 
                               WHERE id = ? AND organization_id = ?`;
            
            db.run(userQuery, [name, username, req.params.id, req.user.organization_id], function(err) {
                if (err) {
                    db.run("ROLLBACK");
                    console.error("Error updating user:", err);
                    return res.status(500).json({ error: 'Database error' });
                }
                if (this.changes === 0) {
                    db.run("ROLLBACK");
                    return res.status(404).json({ error: 'Konfi not found' });
                }
                
                // Update konfi profile table
                const profileQuery = `UPDATE konfi_profiles SET jahrgang_id = ? 
                                      WHERE user_id = ?`;
                
                db.run(profileQuery, [jahrgang_id, req.params.id], function(err) {
                    if (err) {
                        db.run("ROLLBACK");
                        console.error("Error updating konfi profile:", err);
                        return res.status(500).json({ error: 'Database error' });
                    }
                    
                    db.run("COMMIT", (err) => {
                        if (err) {
                            return res.status(500).json({ error: 'Commit failed' });
                        }
                        res.json({ message: 'Konfi updated successfully' });
                    });
                });
            });
        });
    });

    // DELETE a konfi
    router.delete('/:id', rbacVerifier, checkPermission('admin.konfis.delete'), (req, res) => {
        const userId = req.params.id;
        db.serialize(() => {
            db.run("BEGIN TRANSACTION");
            
            // Check if user exists and is a konfi in the admin's organization
            db.get(`SELECT u.id FROM users u 
                    JOIN roles r ON u.role_id = r.id 
                    WHERE u.id = ? AND u.organization_id = ? AND r.name = 'konfi'`, 
                   [userId, req.user.organization_id], (err, user) => {
                if (err || !user) {
                    db.run("ROLLBACK");
                    return res.status(404).json({ error: 'Konfi not found' });
                }
                
                // Delete related data (foreign key references updated to user_id)
                db.run("DELETE FROM konfi_activities WHERE konfi_id = ? AND organization_id = ?", [userId, req.user.organization_id]);
                db.run("DELETE FROM bonus_points WHERE konfi_id = ? AND organization_id = ?", [userId, req.user.organization_id]);
                db.run("DELETE FROM konfi_badges WHERE konfi_id = ?", [userId]);
                db.run("DELETE FROM activity_requests WHERE konfi_id = ? AND organization_id = ?", [userId, req.user.organization_id]);
                db.run("DELETE FROM chat_participants WHERE user_id = ? AND user_type = 'konfi'", [userId]);
                
                // Delete konfi_profile (will cascade to user due to foreign key)
                db.run("DELETE FROM konfi_profiles WHERE user_id = ?", [userId]);
                
                // Delete user
                db.run("DELETE FROM users WHERE id = ?", [userId]);
                
                db.run("COMMIT", (err) => {
                    if (err) return res.status(500).json({ error: 'Commit failed' });
                    res.json({ message: 'Konfi deleted successfully' });
                });
            });
        });
    });

    // Regenerate password for a konfi
    router.post('/:id/regenerate-password', rbacVerifier, checkPermission('admin.konfis.reset_password'), (req, res) => {
        const newPassword = generateBiblicalPassword();
        const hashedPassword = bcrypt.hashSync(newPassword, 10);

        db.serialize(() => {
            db.run("BEGIN TRANSACTION");
            
            // Update password in users table
            db.run(`UPDATE users SET password_hash = ? 
                    WHERE id = ? AND organization_id = ?`,
                [hashedPassword, req.params.id, req.user.organization_id],
                function(err) {
                    if (err) {
                        db.run("ROLLBACK");
                        return res.status(500).json({ error: 'Database error' });
                    }
                    if (this.changes === 0) {
                        db.run("ROLLBACK");
                        return res.status(404).json({ error: 'Konfi not found' });
                    }
                    
                    // Update plain password in konfi_profiles table
                    db.run("UPDATE konfi_profiles SET password_plain = ? WHERE user_id = ?",
                        [newPassword, req.params.id],
                        function(err) {
                            if (err) {
                                db.run("ROLLBACK");
                                return res.status(500).json({ error: 'Database error' });
                            }
                            
                            db.run("COMMIT", (err) => {
                                if (err) {
                                    return res.status(500).json({ error: 'Commit failed' });
                                }
                                res.json({ message: 'Password regenerated successfully', password: newPassword });
                            });
                        });
                });
        });
    });

    // GET single konfi details with activities, bonusPoints, eventPoints
    router.get('/:id', rbacVerifier, checkPermission('admin.konfis.view'), (req, res) => {
        const konfiId = req.params.id;
        
        console.log('📝 Loading details for konfi:', konfiId, 'Organization:', req.user.organization_id);
        
        // Get the konfi details with all needed joins
        const konfiQuery = `
            SELECT u.*, kp.gottesdienst_points, kp.gemeinde_points, kp.password_plain,
                   j.name as jahrgang_name, j.id as jahrgang_id
            FROM users u
            JOIN roles r ON u.role_id = r.id
            LEFT JOIN konfi_profiles kp ON u.id = kp.user_id  
            LEFT JOIN jahrgaenge j ON kp.jahrgang_id = j.id
            WHERE u.id = ? AND r.name = 'konfi' AND u.organization_id = ?
        `;
        
        db.get(konfiQuery, [konfiId, req.user.organization_id], (err, konfi) => {
            if (err) {
                console.error('Error fetching konfi:', err);
                return res.status(500).json({ error: 'Database error' });
            }
            
            if (!konfi) {
                return res.status(404).json({ error: 'Konfi not found' });
            }
            
            // Get activities
            const activitiesQuery = `
                SELECT ka.*, a.name, a.points, a.type, u.display_name as admin_name
                FROM konfi_activities ka
                JOIN activities a ON ka.activity_id = a.id
                LEFT JOIN users u ON ka.admin_id = u.id
                WHERE ka.konfi_id = ? AND ka.organization_id = ?
                ORDER BY ka.completed_date DESC, ka.created_at DESC
            `;
            
            db.all(activitiesQuery, [konfiId, req.user.organization_id], (err, activities) => {
                if (err) {
                    console.error('Error fetching activities:', err);
                    return res.status(500).json({ error: 'Database error' });
                }
                
                // Get bonus points
                const bonusQuery = `
                    SELECT bp.*, u.display_name as admin_name
                    FROM bonus_points bp
                    LEFT JOIN users u ON bp.admin_id = u.id
                    WHERE bp.konfi_id = ? AND bp.organization_id = ?
                    ORDER BY bp.created_at DESC
                `;
                
                db.all(bonusQuery, [konfiId, req.user.organization_id], (err, bonusPoints) => {
                    if (err) {
                        console.error('Error fetching bonus points:', err);
                        return res.status(500).json({ error: 'Database error' });
                    }
                    
                    // Get badge count
                    const badgeQuery = `SELECT COUNT(*) as badgeCount FROM konfi_badges WHERE konfi_id = ?`;
                    
                    db.get(badgeQuery, [konfiId], (err, badgeResult) => {
                        if (err) {
                            console.error('Error fetching badge count:', err);
                            return res.status(500).json({ error: 'Database error' });
                        }
                        
                        // Return complete konfi data
                        res.json({
                            ...konfi,
                            activities: activities || [],
                            bonusPoints: bonusPoints || [],
                            badgeCount: badgeResult ? badgeResult.badgeCount : 0,
                            password: konfi.password_plain // For admin view
                        });
                    });
                });
            });
        });
    });

    // GET event points for konfi
    router.get('/:id/event-points', rbacVerifier, checkPermission('admin.konfis.view'), (req, res) => {
        const konfiId = req.params.id;
        
        console.log('📝 Loading event points for konfi:', konfiId, 'Organization:', req.user.organization_id);
        
        const eventPointsQuery = `
            SELECT ep.*, e.name as event_name, e.event_date, u.display_name as admin_name
            FROM event_points ep
            JOIN events e ON ep.event_id = e.id
            LEFT JOIN users u ON ep.admin_id = u.id
            WHERE ep.konfi_id = ? AND ep.organization_id = ?
            ORDER BY ep.awarded_date DESC, ep.created_at DESC
        `;
        
        db.all(eventPointsQuery, [konfiId, req.user.organization_id], (err, eventPoints) => {
            if (err) {
                console.error('Error fetching event points:', err);
                return res.status(500).json({ error: 'Database error' });
            }
            
            res.json(eventPoints || []);
        });
    });

    // POST bonus points for a konfi
    router.post('/:id/bonus-points', rbacVerifier, checkPermission('admin.konfis.edit'), (req, res) => {
        const { points, type, description } = req.body;
        if (!points || !type || !description) {
            return res.status(400).json({ error: 'Points, type and description are required' });
        }

        const query = `INSERT INTO bonus_points (konfi_id, points, type, description, admin_id, organization_id, created_at)
                       VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`;
        
        db.run(query, [req.params.id, points, type, description, req.user.id, req.user.organization_id], function(err) {
            if (err) {
                console.error('Error creating bonus points:', err);
                return res.status(500).json({ error: 'Database error' });
            }
            
            // Update konfi points
            const updateField = type === 'gottesdienst' ? 'gottesdienst_points' : 'gemeinde_points';
            const updateQuery = `UPDATE konfi_profiles 
                               SET ${updateField} = ${updateField} + ? 
                               WHERE user_id = ?`;
            
            db.run(updateQuery, [points, req.params.id], (err) => {
                if (err) {
                    console.error('Error updating konfi points:', err);
                    return res.status(500).json({ error: 'Database error' });
                }
                res.status(201).json({ message: 'Bonus points added successfully' });
            });
        });
    });

    // DELETE bonus points
    router.delete('/:id/bonus-points/:bonusId', rbacVerifier, checkPermission('admin.konfis.edit'), (req, res) => {
        // Get bonus points info first
        db.get('SELECT * FROM bonus_points WHERE id = ? AND konfi_id = ?', 
               [req.params.bonusId, req.params.id], (err, bonus) => {
            if (err || !bonus) {
                return res.status(404).json({ error: 'Bonus points not found' });
            }
            
            // Delete bonus points
            db.run('DELETE FROM bonus_points WHERE id = ?', [req.params.bonusId], (err) => {
                if (err) {
                    console.error('Error deleting bonus points:', err);
                    return res.status(500).json({ error: 'Database error' });
                }
                
                // Update konfi points (subtract)
                const updateField = bonus.type === 'gottesdienst' ? 'gottesdienst_points' : 'gemeinde_points';
                const updateQuery = `UPDATE konfi_profiles 
                                   SET ${updateField} = ${updateField} - ? 
                                   WHERE user_id = ?`;
                
                db.run(updateQuery, [bonus.points, req.params.id], (err) => {
                    if (err) {
                        console.error('Error updating konfi points:', err);
                        return res.status(500).json({ error: 'Database error' });
                    }
                    res.json({ message: 'Bonus points deleted successfully' });
                });
            });
        });
    });

    // POST activity for a konfi
    router.post('/:id/activities', rbacVerifier, checkPermission('admin.konfis.edit'), (req, res) => {
        const { activity_id, completed_date, comment } = req.body;
        if (!activity_id || !completed_date) {
            return res.status(400).json({ error: 'Activity ID and date are required' });
        }

        // Get activity details
        db.get('SELECT * FROM activities WHERE id = ? AND organization_id = ?', 
               [activity_id, req.user.organization_id], (err, activity) => {
            if (err || !activity) {
                return res.status(404).json({ error: 'Activity not found' });
            }
            
            // Insert konfi activity
            const query = `INSERT INTO konfi_activities 
                          (konfi_id, activity_id, completed_date, comment, admin_id, organization_id, created_at)
                          VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`;
            
            db.run(query, [req.params.id, activity_id, completed_date, comment || '', req.user.id, req.user.organization_id], function(err) {
                if (err) {
                    console.error('Error creating konfi activity:', err);
                    return res.status(500).json({ error: 'Database error' });
                }
                
                // Update konfi points
                const updateField = activity.type === 'gottesdienst' ? 'gottesdienst_points' : 'gemeinde_points';
                const updateQuery = `UPDATE konfi_profiles 
                                   SET ${updateField} = ${updateField} + ? 
                                   WHERE user_id = ?`;
                
                db.run(updateQuery, [activity.points, req.params.id], (err) => {
                    if (err) {
                        console.error('Error updating konfi points:', err);
                        return res.status(500).json({ error: 'Database error' });
                    }
                    res.status(201).json({ message: 'Activity added successfully' });
                });
            });
        });
    });

    // DELETE activity for a konfi
    router.delete('/:id/activities/:activityId', rbacVerifier, checkPermission('admin.konfis.edit'), (req, res) => {
        // Get activity info first
        db.get(`SELECT ka.*, a.points, a.type 
                FROM konfi_activities ka 
                JOIN activities a ON ka.activity_id = a.id
                WHERE ka.id = ? AND ka.konfi_id = ?`, 
               [req.params.activityId, req.params.id], (err, activity) => {
            if (err || !activity) {
                return res.status(404).json({ error: 'Activity not found' });
            }
            
            // Delete activity (mit organization_id check für Sicherheit)
            db.run('DELETE FROM konfi_activities WHERE id = ? AND organization_id = ?', [req.params.activityId, req.user.organization_id], (err) => {
                if (err) {
                    console.error('Error deleting activity:', err);
                    return res.status(500).json({ error: 'Database error' });
                }
                
                // Update konfi points (subtract)
                const updateField = activity.type === 'gottesdienst' ? 'gottesdienst_points' : 'gemeinde_points';
                const updateQuery = `UPDATE konfi_profiles 
                                   SET ${updateField} = ${updateField} - ? 
                                   WHERE user_id = ?`;
                
                db.run(updateQuery, [activity.points, req.params.id], (err) => {
                    if (err) {
                        console.error('Error updating konfi points:', err);
                        return res.status(500).json({ error: 'Database error' });
                    }
                    res.json({ message: 'Activity deleted successfully' });
                });
            });
        });
    });

    return router;
};