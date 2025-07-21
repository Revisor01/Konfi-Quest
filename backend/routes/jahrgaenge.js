const express = require('express');
const router = express.Router();

module.exports = (db, verifyToken, checkPermission) => {

  // GET all jahrgaenge for the admin's organization
  router.get('/', verifyToken, checkPermission('admin.jahrgaenge.view'), (req, res) => {
    const query = "SELECT * FROM jahrgaenge WHERE organization_id = ? ORDER BY name DESC";
    db.all(query, [req.user.organization_id], (err, rows) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json(rows);
    });
  });

  // POST a new jahrgang
  router.post('/', verifyToken, checkPermission('admin.jahrgaenge.create'), (req, res) => {
    const { name, confirmation_date } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const query = "INSERT INTO jahrgaenge (name, confirmation_date, organization_id) VALUES (?, ?, ?)";
    db.run(query, [name, confirmation_date, req.user.organization_id], function(err) {
      if (err) {
        if (err.code === 'SQLITE_CONSTRAINT') return res.status(409).json({ error: 'Jahrgang name already exists in this organization' });
        return res.status(500).json({ error: 'Database error' });
      }
      res.status(201).json({ id: this.lastID, name, confirmation_date });
    });
  });

  // PUT (update) a jahrgang
  router.put('/:id', verifyToken, checkPermission('admin.jahrgaenge.edit'), (req, res) => {
    const { name, confirmation_date } = req.body;
    if (!name) return res.status(400).json({ error: 'Name is required' });

    const query = "UPDATE jahrgaenge SET name = ?, confirmation_date = ? WHERE id = ? AND organization_id = ?";
    db.run(query, [name, confirmation_date, req.params.id, req.user.organization_id], function(err) {
      if (err) {
        if (err.code === 'SQLITE_CONSTRAINT') return res.status(409).json({ error: 'Jahrgang name already exists' });
        return res.status(500).json({ error: 'Database error' });
      }
      if (this.changes === 0) return res.status(404).json({ error: 'Jahrgang not found' });
      res.json({ message: 'Jahrgang updated successfully' });
    });
  });

  // DELETE a jahrgang
  router.delete('/:id', verifyToken, checkPermission('admin.jahrgaenge.delete'), (req, res) => {
    const jahrgangId = req.params.id;
    db.get("SELECT COUNT(*) as count FROM konfis WHERE jahrgang_id = ?", [jahrgangId], (err, row) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (row.count > 0) return res.status(409).json({ error: `Cannot delete: ${row.count} konfis are assigned to this jahrgang.` });

      db.run("DELETE FROM jahrgaenge WHERE id = ? AND organization_id = ?", [jahrgangId, req.user.organization_id], function(err) {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (this.changes === 0) return res.status(404).json({ error: 'Jahrgang not found' });
        
        db.run("DELETE FROM chat_rooms WHERE type = 'jahrgang' AND jahrgang_id = ?", [jahrgangId]);
        res.json({ message: 'Jahrgang deleted successfully' });
      });
    });
  });

  return router;
};