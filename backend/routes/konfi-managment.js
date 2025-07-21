const express = require('express');
const bcrypt = require('bcrypt');
const router = express.Router();

function generateBiblicalPassword() {
    // Diese Funktion wird hier gebraucht
    const BIBLE_BOOKS = ['Genesis', 'Exodus', /* ... alle Bücher ... */];
    const book = BIBLE_BOOKS[Math.floor(Math.random() * BIBLE_BOOKS.length)];
    const chapter = Math.floor(Math.random() * 50) + 1;
    const verse = Math.floor(Math.random() * 30) + 1;
    return `${book}${chapter},${verse}`;
}

module.exports = (db, verifyToken, checkPermission) => {

    // GET all konfis for the admin's organization
    router.get('/', verifyToken, checkPermission('admin.konfis.view'), (req, res) => {
        const query = `
            SELECT k.id, k.name, k.username, k.password_plain, k.gottesdienst_points, k.gemeinde_points,
                   j.name as jahrgang_name, j.id as jahrgang_id
            FROM konfis k
            JOIN jahrgaenge j ON k.jahrgang_id = j.id
            WHERE k.organization_id = ?
            ORDER BY j.name DESC, k.name
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
    router.get('/:id', verifyToken, checkPermission('admin.konfis.view'), (req, res) => {
        const query = `
            SELECT k.*, j.name as jahrgang_name
            FROM konfis k
            JOIN jahrgaenge j ON k.jahrgang_id = j.id
            WHERE k.id = ? AND k.organization_id = ?
        `;
        db.get(query, [req.params.id, req.user.organization_id], (err, konfi) => {
            if (err) return res.status(500).json({ error: 'Database error' });
            if (!konfi) return res.status(404).json({ error: 'Konfi not found' });

            // Passwort-Hash nicht senden
            delete konfi.password_hash;
            res.json(konfi);
        });
    });

    // POST (create) a new konfi
    router.post('/', verifyToken, checkPermission('admin.konfis.create'), (req, res) => {
        const { name, jahrgang_id } = req.body;
        if (!name || !jahrgang_id) {
            return res.status(400).json({ error: 'Name and Jahrgang are required' });
        }

        const password = generateBiblicalPassword();
        const hashedPassword = bcrypt.hashSync(password, 10);
        const username = name.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z.äöüß]/g, '');

        const query = `INSERT INTO konfis 
            (name, jahrgang_id, username, password_hash, password_plain, organization_id) 
            VALUES (?, ?, ?, ?, ?, ?)`;
        
        db.run(query, [name, jahrgang_id, username, hashedPassword, password, req.user.organization_id], function(err) {
            if (err) {
                if (err.code === 'SQLITE_CONSTRAINT') {
                    return res.status(409).json({ error: 'Username already exists' });
                }
                console.error("Error creating konfi:", err);
                return res.status(500).json({ error: 'Database error' });
            }
            res.status(201).json({ id: this.lastID, username, password, message: 'Konfi created successfully' });
        });
    });

    // PUT (update) a konfi
    router.put('/:id', verifyToken, checkPermission('admin.konfis.edit'), (req, res) => {
        const { name, jahrgang_id } = req.body;
        if (!name || !jahrgang_id) {
            return res.status(400).json({ error: 'Name and Jahrgang are required' });
        }
        const username = name.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z.äöüß]/g, '');

        const query = `UPDATE konfis SET name = ?, jahrgang_id = ?, username = ? 
                       WHERE id = ? AND organization_id = ?`;
        
        db.run(query, [name, jahrgang_id, username, req.params.id, req.user.organization_id], function(err) {
            if (err) { /* ... Error Handling ... */ }
            if (this.changes === 0) return res.status(404).json({ error: 'Konfi not found' });
            res.json({ message: 'Konfi updated successfully' });
        });
    });

    // DELETE a konfi
    router.delete('/:id', verifyToken, checkPermission('admin.konfis.delete'), (req, res) => {
        const konfiId = req.params.id;
        db.serialize(() => {
            db.run("BEGIN TRANSACTION");
            // Wir müssen sicherstellen, dass wir nur Konfis aus der eigenen Organisation löschen
            db.get("SELECT id FROM konfis WHERE id = ? AND organization_id = ?", [konfiId, req.user.organization_id], (err, konfi) => {
                if (err || !konfi) {
                    db.run("ROLLBACK");
                    return res.status(404).json({ error: 'Konfi not found' });
                }
                
                // Jetzt sicher löschen
                db.run("DELETE FROM konfi_activities WHERE konfi_id = ?", [konfiId]);
                db.run("DELETE FROM bonus_points WHERE konfi_id = ?", [konfiId]);
                db.run("DELETE FROM konfi_badges WHERE konfi_id = ?", [konfiId]);
                db.run("DELETE FROM activity_requests WHERE konfi_id = ?", [konfiId]);
                db.run("DELETE FROM konfis WHERE id = ?", [konfiId]);
                
                db.run("COMMIT", (err) => {
                    if (err) return res.status(500).json({ error: 'Commit failed' });
                    res.json({ message: 'Konfi deleted successfully' });
                });
            });
        });
    });

    // Regenerate password for a konfi
    router.post('/:id/regenerate-password', verifyToken, checkPermission('admin.konfis.reset_password'), (req, res) => {
        const newPassword = generateBiblicalPassword();
        const hashedPassword = bcrypt.hashSync(newPassword, 10);

        db.run("UPDATE konfis SET password_hash = ?, password_plain = ? WHERE id = ? AND organization_id = ?",
            [hashedPassword, newPassword, req.params.id, req.user.organization_id],
            function(err) {
                if (err) return res.status(500).json({ error: 'Database error' });
                if (this.changes === 0) return res.status(404).json({ error: 'Konfi not found' });
                res.json({ message: 'Password regenerated successfully', password: newPassword });
            });
    });

    return router;
};