const express = require('express');
const router = express.Router();

module.exports = (db, rbacVerifier, checkPermission) => {

  // GET all categories for the admin's organization
  router.get('/', rbacVerifier, checkPermission('admin.categories.view'), async (req, res) => {
    try {
      const query = "SELECT * FROM categories WHERE organization_id = $1 ORDER BY name";
      const { rows: categories } = await db.query(query, [req.user.organization_id]);
      res.json(categories);
    } catch (err) {
      console.error('Database error in GET /api/categories:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // POST a new category
  router.post('/', rbacVerifier, checkPermission('admin.categories.create'), async (req, res) => {
    const { name, description, type } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    try {
      const query = "INSERT INTO categories (name, description, type, organization_id) VALUES ($1, $2, $3, $4) RETURNING id";
      const params = [name.trim(), description, type || 'both', req.user.organization_id];
      const { rows: [newCategory] } = await db.query(query, params);
      
      res.status(201).json({ id: newCategory.id, message: 'Category created successfully' });
    } catch (err) {
      if (err.code === '23505') { // 23505 is the code for unique_violation in PostgreSQL
        return res.status(409).json({ error: 'Category name already exists' });
      }
      console.error('Database error in POST /api/categories:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // PUT (update) a category
  router.put('/:id', rbacVerifier, checkPermission('admin.categories.edit'), async (req, res) => {
    const { name, description, type } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    try {
      const query = "UPDATE categories SET name = $1, description = $2, type = $3 WHERE id = $4 AND organization_id = $5";
      const params = [name.trim(), description, type, req.params.id, req.user.organization_id];
      const { rowCount } = await db.query(query, params);
      
      if (rowCount === 0) {
        return res.status(404).json({ error: 'Category not found' });
      }
      res.json({ message: 'Category updated successfully' });
    } catch (err) {
      if (err.code === '23505') { // 23505 is the code for unique_violation in PostgreSQL
        return res.status(409).json({ error: 'Category name already exists' });
      }
      console.error(`Database error in PUT /api/categories/${req.params.id}:`, err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // DELETE a category
  router.delete('/:id', rbacVerifier, checkPermission('admin.categories.delete'), async (req, res) => {
    const categoryId = req.params.id;

    try {
      // Check if the category is still in use. This query works in PostgreSQL as well.
      const checkQuery = `
        SELECT ((SELECT COUNT(*) FROM activity_categories WHERE category_id = $1) + 
                (SELECT COUNT(*) FROM event_categories WHERE category_id = $2))::int as count
      `;
      const { rows: [usage] } = await db.query(checkQuery, [categoryId, categoryId]);

      if (usage.count > 0) {
        return res.status(409).json({ error: `Category is in use and cannot be deleted.` });
      }

      // If not in use, proceed with deletion
      const deleteQuery = "DELETE FROM categories WHERE id = $1 AND organization_id = $2";
      const { rowCount } = await db.query(deleteQuery, [categoryId, req.user.organization_id]);
      
      if (rowCount === 0) {
        return res.status(404).json({ error: 'Category not found' });
      }
      
      res.json({ message: 'Category deleted successfully' });
    } catch (err) {
      console.error(`Database error in DELETE /api/categories/${categoryId}:`, err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  return router;
};