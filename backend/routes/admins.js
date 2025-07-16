// routes/admins.js (KORRIGIERT)
const express = require('express');
const router = express.Router();

module.exports = (db, verifyToken, bcrypt) => {
  
  router.get('/', verifyToken, (req, res) => {
    if (req.user.type !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    db.all("SELECT id, username, display_name, created_at FROM admins ORDER BY created_at", [], (err, rows) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json(rows);
    });
  });

  router.post('/', verifyToken, (req, res) => {
    if (req.user.type !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    const { username, display_name, password } = req.body;
    if (!username || !display_name || !password) return res.status(400).json({ error: 'All fields are required' });

    // KORREKT: Hashen des Passworts vor dem Speichern
    const hashedPassword = bcrypt.hashSync(password, 10);
    
    // KORREKT: Speichern in `password_hash`
    db.run("INSERT INTO admins (username, display_name, password_hash) VALUES (?, ?, ?)",
      [username, display_name, hashedPassword], function(err) {
        if (err) {
          if (err.message.includes('UNIQUE constraint failed')) return res.status(400).json({ error: 'Username already exists' });
          return res.status(500).json({ error: 'Database error' });
        }
        res.status(201).json({ id: this.lastID, username, display_name });
      });
  });

  router.put('/:id', verifyToken, (req, res) => {
    if (req.user.type !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    const { username, display_name, password } = req.body;
    if (!username || !display_name) return res.status(400).json({ error: 'Username and display name are required' });

    let query = "UPDATE admins SET username = ?, display_name = ?";
    let params = [username, display_name];
    
    if (password) {
      // KORREKT: Hashen des neuen Passworts
      const hashedPassword = bcrypt.hashSync(password, 10);
      query += ", password_hash = ?";
      params.push(hashedPassword);
    }
    
    query += " WHERE id = ?";
    params.push(req.params.id);

    db.run(query, params, function(err) {
      if (err) {
        if (err.message.includes('UNIQUE constraint failed')) return res.status(400).json({ error: 'Username already exists' });
        return res.status(500).json({ error: 'Database error' });
      }
      if (this.changes === 0) return res.status(404).json({ error: 'Admin not found' });
      res.json({ message: 'Admin updated successfully' });
    });
  });

  router.delete('/:id', verifyToken, (req, res) => {
    if (req.user.type !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    const adminId = req.params.id;
    if (parseInt(adminId) === req.user.id) return res.status(400).json({ error: 'Cannot delete your own account' });

    db.get("SELECT COUNT(*) as count FROM admins", [], (err, row) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (row.count <= 1) return res.status(400).json({ error: 'Cannot delete the last admin account' });
      
      db.run("DELETE FROM admins WHERE id = ?", [adminId], function(err) {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (this.changes === 0) return res.status(404).json({ error: 'Admin not found' });
        res.json({ message: 'Admin deleted successfully' });
      });
    });
  });

  return router;
};