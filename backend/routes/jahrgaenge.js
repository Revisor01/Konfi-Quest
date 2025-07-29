const express = require('express');
const router = express.Router();

module.exports = (db, rbacVerifier, checkPermission) => {

  // GET all jahrgaenge for the admin's organization
  router.get('/', rbacVerifier, checkPermission('admin.jahrgaenge.view'), async (req, res) => {
    try {
      const query = "SELECT * FROM jahrgaenge WHERE organization_id = $1 ORDER BY name DESC";
      const { rows: jahrgaenge } = await db.query(query, [req.user.organization_id]);
      res.json(jahrgaenge);
    } catch (err) {
      console.error('Database error in GET /api/jahrgaenge:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // POST a new jahrgang
  router.post('/', rbacVerifier, checkPermission('admin.jahrgaenge.create'), async (req, res) => {
    const { name, confirmation_date } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    try {
      const query = "INSERT INTO jahrgaenge (name, confirmation_date, organization_id) VALUES ($1, $2, $3) RETURNING id";
      const params = [name, confirmation_date, req.user.organization_id];
      const { rows: [newJahrgang] } = await db.query(query, params);
      
      res.status(201).json({ id: newJahrgang.id, name, confirmation_date });
    } catch (err) {
      if (err.code === '23505') { // unique_violation
        return res.status(409).json({ error: 'Jahrgang-Name existiert bereits in dieser Organisation' });
      }
      console.error('Database error in POST /api/jahrgaenge:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // PUT (update) a jahrgang
  router.put('/:id', rbacVerifier, checkPermission('admin.jahrgaenge.edit'), async (req, res) => {
    const { name, confirmation_date } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    try {
      const query = "UPDATE jahrgaenge SET name = $1, confirmation_date = $2 WHERE id = $3 AND organization_id = $4";
      const params = [name, confirmation_date, req.params.id, req.user.organization_id];
      const { rowCount } = await db.query(query, params);
      
      if (rowCount === 0) {
        return res.status(404).json({ error: 'Jahrgang not found' });
      }
      res.json({ message: 'Jahrgang updated successfully' });
    } catch (err) {
      if (err.code === '23505') { // unique_violation
        return res.status(409).json({ error: 'Jahrgang-Name existiert bereits' });
      }
      console.error(`Database error in PUT /api/jahrgaenge/${req.params.id}:`, err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // DELETE a jahrgang
  router.delete('/:id', rbacVerifier, checkPermission('admin.jahrgaenge.delete'), async (req, res) => {
    const jahrgangId = req.params.id;
    try {
      // Check if jahrgang is in use. Note: PostgreSQL returns count as a string.
      const checkQuery = "SELECT COUNT(*)::int as count FROM konfi_profiles WHERE jahrgang_id = $1";
      const { rows: [usage] } = await db.query(checkQuery, [jahrgangId]);
      
      if (usage.count > 0) {
        return res.status(409).json({ error: `Jahrgang kann nicht gelöscht werden: ${usage.count} Konfi(s) zugeordnet.` });
      }

      // Delete the jahrgang itself
      const deleteJahrgangQuery = "DELETE FROM jahrgaenge WHERE id = $1 AND organization_id = $2";
      const { rowCount } = await db.query(deleteJahrgangQuery, [jahrgangId, req.user.organization_id]);

      if (rowCount === 0) {
        return res.status(404).json({ error: 'Jahrgang not found' });
      }
      
      // Also delete associated chat room, maintaining original sequential logic.
      await db.query("DELETE FROM chat_rooms WHERE type = 'jahrgang' AND jahrgang_id = $1", [jahrgangId]);
      
      res.json({ message: 'Jahrgang deleted successfully' });
    } catch (err) {
      console.error(`Database error in DELETE /api/jahrgaenge/${jahrgangId}:`, err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  return router;
};