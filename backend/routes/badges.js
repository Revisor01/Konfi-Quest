// routes/badges.js
const express = require('express');
const router = express.Router();

module.exports = (db, verifyToken, CRITERIA_TYPES) => {

  // KORREKT: Greift auf `custom_badges` zu und zählt vergebene Badges
  router.get('/', verifyToken, (req, res) => {
    if (req.user.type !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    
    const query = `
      SELECT cb.*, a.display_name as created_by_name,
             COALESCE(counts.earned_count, 0) as earned_count
      FROM custom_badges cb
      LEFT JOIN admins a ON cb.created_by = a.id
      LEFT JOIN (
        SELECT badge_id, COUNT(*) as earned_count
        FROM konfi_badges
        GROUP BY badge_id
      ) counts ON cb.id = counts.badge_id
      ORDER BY cb.created_at DESC`;
      
    db.all(query, [], (err, rows) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json(rows);
    });
  });

  router.get('/criteria-types', verifyToken, (req, res) => {
    res.json(CRITERIA_TYPES);
  });

  // KORREKT: Erstellt ein `custom_badge`
  router.post('/', verifyToken, (req, res) => {
    if (req.user.type !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    
    const { name, icon, description, criteria_type, criteria_value, criteria_extra, is_hidden } = req.body;
    if (!name || !icon || !criteria_type) return res.status(400).json({ error: 'Name, icon, and criteria type are required' });
    
    const extraJson = criteria_extra ? JSON.stringify(criteria_extra) : null;
    const hiddenFlag = is_hidden ? 1 : 0;
    
    db.run("INSERT INTO custom_badges (name, icon, description, criteria_type, criteria_value, criteria_extra, is_hidden, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [name, icon, description, criteria_type, criteria_value, extraJson, hiddenFlag, req.user.id],
      function(err) {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.status(201).json({ id: this.lastID });
      });
  });

  // KORREKT: Aktualisiert ein `custom_badge`
  router.put('/:id', verifyToken, (req, res) => {
    if (req.user.type !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    
    const { name, icon, description, criteria_type, criteria_value, criteria_extra, is_active, is_hidden } = req.body;
    const extraJson = criteria_extra ? JSON.stringify(criteria_extra) : null;
    const activeFlag = is_active ? 1 : 0;
    const hiddenFlag = is_hidden ? 1 : 0;
    
    db.run("UPDATE custom_badges SET name = ?, icon = ?, description = ?, criteria_type = ?, criteria_value = ?, criteria_extra = ?, is_active = ?, is_hidden = ? WHERE id = ?",
      [name, icon, description, criteria_type, criteria_value, extraJson, activeFlag, hiddenFlag, req.params.id],
      function(err) {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (this.changes === 0) return res.status(404).json({ error: 'Badge not found' });
        res.json({ message: 'Badge updated successfully' });
      });
  });

  // KORREKT: Löscht ein `custom_badge` und die Verknüpfungen
  router.delete('/:id', verifyToken, (req, res) => {
    if (req.user.type !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    
    db.run("DELETE FROM konfi_badges WHERE badge_id = ?", [req.params.id], (err) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      
      db.run("DELETE FROM custom_badges WHERE id = ?", [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (this.changes === 0) return res.status(404).json({ error: 'Badge not found' });
        res.json({ message: 'Badge deleted successfully' });
      });
    });
  });

  return router;
};