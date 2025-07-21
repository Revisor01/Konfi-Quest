const express = require('express');
const bcrypt = require('bcrypt');
const { generateBiblicalPassword } = require('../utils/passwordUtils');
const router = express.Router();

module.exports = (db, rbacVerifier, checkPermission) => {

    // GET all konfis for the admin's organization
    router.get('/', rbacVerifier, checkPermission('admin.konfis.view'), (req, res) => {
        const query = `
            SELECT u.id, u.display_name as name, u.username, kp.password_plain, 
                   kp.gottesdienst_points, kp.gemeinde_points,
                   j.name as jahrgang_name, j.id as jahrgang_id
            FROM users u
            JOIN roles r ON u.role_id = r.id
            LEFT JOIN konfi_profiles kp ON u.id = kp.user_id
            LEFT JOIN jahrgaenge j ON kp.jahrgang_id = j.id
            WHERE r.name = 'konfi' AND u.organization_id = ?
            ORDER BY j.name DESC, u.display_name
        `;
        db.all(query, [req.user.organization_id], (err, rows) => {
            if (err) {
                console.error('Error fetching konfis for admin:', err);
                return res.status(500).json({ error: 'Database error' });
            }
            res.json(rows);
        });
    });

    // GET a single konfi by ID
    router.get('/:id', rbacVerifier, checkPermission('admin.konfis.view'), (req, res) => {
        const query = `
            SELECT u.id, u.display_name as name, u.username, kp.password_plain,
                   kp.gottesdienst_points, kp.gemeinde_points,
                   j.name as jahrgang_name, j.id as jahrgang_id
            FROM users u
            JOIN roles r ON u.role_id = r.id
            LEFT JOIN konfi_profiles kp ON u.id = kp.user_id
            LEFT JOIN jahrgaenge j ON kp.jahrgang_id = j.id
            WHERE r.name = 'konfi' AND u.id = ? AND u.organization_id = ?
        `;
        db.get(query, [req.params.id, req.user.organization_id], (err, konfi) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            if (!konfi) return res.status(404).json({ error: 'Konfi not found' });

            res.json(konfi);
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
                        (user_id, jahrgang_id, password_plain, gottesdienst_points, gemeinde_points) 
                        VALUES (?, ?, ?, 0, 0)`;
                    
                    db.run(profileQuery, [userId, jahrgang_id, password], function(err) {
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
                db.run("DELETE FROM konfi_activities WHERE konfi_id = ?", [userId]);
                db.run("DELETE FROM bonus_points WHERE konfi_id = ?", [userId]);
                db.run("DELETE FROM konfi_badges WHERE konfi_id = ?", [userId]);
                db.run("DELETE FROM activity_requests WHERE konfi_id = ?", [userId]);
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

    return router;
};