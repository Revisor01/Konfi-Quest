const express = require('express');
const router = express.Router();

module.exports = (db, verifyToken, checkPermission) => {

  // GET all categories for the admin's organization
  router.get('/', verifyToken, checkPermission('admin.categories.view'), (req, res) => {
    const query = "SELECT * FROM categories WHERE organization_id = ? ORDER BY name";
    db.all(query, [req.user.organization_id], (err, rows) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      res.json(rows);
    });
  });

  // POST a new category
  router.post('/', verifyToken, checkPermission('admin.categories.create'), (req, res) => {
    const { name, description, type } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });

    const query = "INSERT INTO categories (name, description, type, organization_id) VALUES (?, ?, ?, ?)";
    db.run(query, [name.trim(), description, type || 'both', req.user.organization_id], function(err) {
      if (err) {
        if (err.code === 'SQLITE_CONSTRAINT') return res.status(409).json({ error: 'Category name already exists' });
        return res.status(500).json({ error: 'Database error' });
      }
      res.status(201).json({ id: this.lastID, message: 'Category created successfully' });
    });
  });

  // PUT (update) a category
  router.put('/:id', verifyToken, checkPermission('admin.categories.edit'), (req, res) => {
    const { name, description, type } = req.body;
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });

    const query = "UPDATE categories SET name = ?, description = ?, type = ? WHERE id = ? AND organization_id = ?";
    db.run(query, [name.trim(), description, type, req.params.id, req.user.organization_id], function(err) {
      if (err) {
        if (err.code === 'SQLITE_CONSTRAINT') return res.status(409).json({ error: 'Category name already exists' });
        return res.status(500).json({ error: 'Database error' });
      }
      if (this.changes === 0) return res.status(404).json({ error: 'Category not found' });
      res.json({ message: 'Category updated successfully' });
    });
  });

  // DELETE a category
  router.delete('/:id', verifyToken, checkPermission('admin.categories.delete'), (req, res) => {
    const categoryId = req.params.id;
    // Prüfen, ob die Kategorie noch in Verwendung ist
    const checkQuery = `
      SELECT (SELECT COUNT(*) FROM activity_categories WHERE category_id = ?) + 
             (SELECT COUNT(*) FROM event_categories WHERE category_id = ?) as count
    `;
    db.get(checkQuery, [categoryId, categoryId], (err, row) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (row.count > 0) return res.status(409).json({ error: `Category is in use and cannot be deleted.` });

      db.run("DELETE FROM categories WHERE id = ? AND organization_id = ?", [categoryId, req.user.organization_id], function(err) {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (this.changes === 0) return res.status(404).json({ error: 'Category not found' });
        res.json({ message: 'Category deleted successfully' });
      });
    });
  });

  return router;
};