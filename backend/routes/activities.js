const express = require('express');
const router = express.Router();

// Dieses Modul fasst die Admin-Verwaltung von Aktivitäten, Anträgen und Bonuspunkten zusammen.
module.exports = (db, rbacVerifier, checkPermission, checkAndAwardBadges, upload) => {

  // ====================================================================
  // ACTIVITIES MANAGEMENT (Masterliste)
  // ====================================================================

  // GET all activities
  // Pfad: GET /api/activities/
  router.get('/', rbacVerifier, checkPermission('admin.activities.view'), (req, res) => {
    const query = `
      SELECT a.*, 
             GROUP_CONCAT(c.id || ':' || c.name) as category_data
      FROM activities a
      LEFT JOIN activity_categories ac ON a.id = ac.activity_id
      LEFT JOIN categories c ON ac.category_id = c.id
      WHERE a.organization_id = ?
      GROUP BY a.id
      ORDER BY a.type, a.name
    `;
    console.log("Fetching activities for org:", req.user.organization_id);
    db.all(query, [req.user.organization_id], (err, rows) => {
      if (err) {
        console.error("Error fetching activities for admin:", err);
        console.error("Query:", query);
        console.error("Params:", [req.user.organization_id]);
        return res.status(500).json({ error: 'Database error' });
      }
      console.log("Activities found:", rows.length);
      
      // Parse categories from GROUP_CONCAT result
      const activitiesWithCategories = rows.map(row => {
        let categories = [];
        if (row.category_data) {
          categories = row.category_data.split(',').map(catData => {
            const [id, name] = catData.split(':');
            return { id: parseInt(id), name };
          });
        }
        
        return {
          id: row.id, 
          name: row.name, 
          points: row.points,
          type: row.type, 
          categories: categories,
          created_at: row.created_at
        };
      });
      res.json(activitiesWithCategories);
    });
  });

  // POST a new activity
  // Pfad: POST /api/activities/
  router.post('/', rbacVerifier, checkPermission('admin.activities.create'), (req, res) => {
    const { name, points, type, category_ids } = req.body;
    if (!name || !points || !type) return res.status(400).json({ error: 'Name, points and type are required' });
    if (!['gottesdienst', 'gemeinde'].includes(type)) return res.status(400).json({ error: 'Type must be gottesdienst or gemeinde' });
    
    db.run("INSERT INTO activities (name, points, type, organization_id) VALUES (?, ?, ?, ?)",
      [name, points, type, req.user.organization_id],
      function(err) {
        if (err) {
            console.error("Error creating activity:", err);
            return res.status(500).json({ error: 'Database error' });
        }
        
        const activityId = this.lastID;
        if (category_ids && Array.isArray(category_ids) && category_ids.length > 0) {
          const stmts = category_ids.map(catId => db.prepare("INSERT INTO activity_categories (activity_id, category_id) VALUES (?, ?)"));
          stmts.forEach((stmt, i) => stmt.run(activityId, category_ids[i], () => stmt.finalize()));
        }
        res.status(201).json({ id: activityId, message: 'Activity created successfully' });
      });
  });

  // PUT (update) an activity
  // Pfad: PUT /api/activities/:id
  router.put('/:id', rbacVerifier, checkPermission('admin.activities.edit'), (req, res) => {
    const activityId = req.params.id;
    const { name, points, type, category_ids } = req.body;
    if (!name || !points || !type) return res.status(400).json({ error: 'Name, points and type are required' });
  
    db.run("UPDATE activities SET name = ?, points = ?, type = ? WHERE id = ? AND organization_id = ?", 
      [name, points, type, activityId, req.user.organization_id], function(err) {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (this.changes === 0) return res.status(404).json({ error: 'Activity not found' });

        db.serialize(() => {
            db.run("DELETE FROM activity_categories WHERE activity_id = ?", [activityId]);
            if (category_ids && Array.isArray(category_ids) && category_ids.length > 0) {
                const stmt = db.prepare("INSERT INTO activity_categories (activity_id, category_id) VALUES (?, ?)");
                category_ids.forEach(catId => stmt.run(activityId, catId));
                stmt.finalize();
            }
            res.json({ message: 'Activity updated successfully' });
        });
      });
  });

  // DELETE an activity
  // Pfad: DELETE /api/activities/:id
  router.delete('/:id', rbacVerifier, checkPermission('admin.activities.delete'), (req, res) => {
    const activityId = req.params.id;
    db.get(`SELECT COUNT(*) as count FROM konfi_activities ka JOIN activities a ON ka.activity_id = a.id WHERE ka.activity_id = ? AND a.organization_id = ?`, [activityId, req.user.organization_id], (err, row) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (row.count > 0) return res.status(409).json({ error: `Activity is in use and cannot be deleted.` });
        
        db.run("DELETE FROM activities WHERE id = ? AND organization_id = ?", [activityId, req.user.organization_id], function(err) {
          if (err) return res.status(500).json({ error: 'Database error' });
          if (this.changes === 0) return res.status(404).json({ error: 'Activity not found' });
          res.json({ message: 'Activity deleted successfully' });
        });
      });
  });

  // ====================================================================
  // ACTIVITY REQUESTS MANAGEMENT
  // ====================================================================

  // GET all activity requests for an organization
  // Pfad: GET /api/activities/requests
  router.get('/requests', rbacVerifier, checkPermission('admin.requests.view'), (req, res) => {
      const query = `
        SELECT ar.*, u_konfi.display_name as konfi_name, a.name as activity_name, a.points as activity_points,
               u_approved.display_name as approved_by_name
        FROM activity_requests ar
        JOIN users u_konfi ON ar.konfi_id = u_konfi.id
        JOIN activities a ON ar.activity_id = a.id
        LEFT JOIN users u_approved ON ar.approved_by = u_approved.id
        WHERE a.organization_id = ?
        ORDER BY ar.created_at DESC
      `;
      console.log("Fetching activity requests for org:", req.user.organization_id);
      db.all(query, [req.user.organization_id], (err, rows) => {
        if (err) {
          console.error("Error fetching activity requests:", err);
          console.error("Query:", query);
          console.error("Params:", [req.user.organization_id]);
          return res.status(500).json({ error: 'Database error' });
        }
        console.log("Activity requests found:", rows.length);
        res.json(rows);
      });
  });

  // PUT (update) an activity request status
  // Pfad: PUT /api/activities/requests/:id
  router.put('/requests/:id', rbacVerifier, checkPermission('admin.requests.approve'), async (req, res) => {
    const requestId = req.params.id;
    const { status, admin_comment } = req.body;
    if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
  
    try {
      const request = await db.get("SELECT ar.*, a.points, a.type FROM activity_requests ar JOIN activities a ON ar.activity_id = a.id WHERE ar.id = ? AND a.organization_id = ?", [requestId, req.user.organization_id]);
      if (!request) return res.status(404).json({ error: 'Request not found' });
  
      await db.run("UPDATE activity_requests ar SET status = ?, admin_comment = ?, approved_by = ?, updated_at = CURRENT_TIMESTAMP WHERE ar.id = ? AND EXISTS (SELECT 1 FROM activities a WHERE a.id = ar.activity_id AND a.organization_id = ?)", [status, admin_comment, req.user.id, requestId, req.user.organization_id]);
      
      let newBadges = 0;
      if (status === 'approved') {
        await db.run("INSERT INTO konfi_activities (konfi_id, activity_id, admin_id, completed_date, organization_id) VALUES (?, ?, ?, ?, ?)", [request.konfi_id, request.activity_id, req.user.id, request.requested_date, req.user.organization_id]);
        const pointField = request.type === 'gottesdienst' ? 'gottesdienst_points' : 'gemeinde_points';
        await db.run(`UPDATE konfi_profiles SET ${pointField} = ${pointField} + ? WHERE user_id = ?`, [request.points, request.konfi_id]);
        newBadges = await checkAndAwardBadges(request.konfi_id);
      }
      res.json({ message: 'Request status updated', newBadges });
    } catch (err) {
      console.error('Error updating request status:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });


  // ====================================================================
  // DIRECT POINT ASSIGNMENT
  // ====================================================================
  
  // Assign activity to a konfi
  // Pfad: POST /api/activities/assign-activity
  router.post('/assign-activity', rbacVerifier, checkPermission('admin.konfis.assign_points'), async (req, res) => {
    const { konfiId, activityId, completed_date } = req.body;
    if (!konfiId || !activityId) return res.status(400).json({ error: 'Konfi ID and Activity ID are required' });
    const date = completed_date || new Date().toISOString().split('T')[0];
  
    try {
      const activity = await db.get("SELECT * FROM activities WHERE id = ? AND organization_id = ?", [activityId, req.user.organization_id]);
      if (!activity) return res.status(404).json({ error: 'Activity not found' });
  
      await db.run("INSERT INTO konfi_activities (konfi_id, activity_id, admin_id, completed_date, organization_id) VALUES (?, ?, ?, ?, ?)", [konfiId, activityId, req.user.id, date, req.user.organization_id]);
      
      const pointField = activity.type === 'gottesdienst' ? 'gottesdienst_points' : 'gemeinde_points';
      await db.run(`UPDATE konfi_profiles SET ${pointField} = ${pointField} + ? WHERE user_id = ?`, [activity.points, konfiId]);
      
      const newBadges = await checkAndAwardBadges(konfiId);
      res.json({ message: 'Activity assigned successfully', newBadges });
    } catch (err) {
      console.error('Error assigning activity:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // Assign bonus points to a konfi
  // Pfad: POST /api/activities/assign-bonus
  router.post('/assign-bonus', rbacVerifier, checkPermission('admin.konfis.assign_points'), async (req, res) => {
    const { konfiId, points, type, description, completed_date } = req.body;
    if (!konfiId || !points || !type || !description) return res.status(400).json({ error: 'All fields are required' });
    const date = completed_date || new Date().toISOString().split('T')[0];
  
    try {
      await db.run("INSERT INTO bonus_points (konfi_id, points, type, description, admin_id, completed_date) VALUES (?, ?, ?, ?, ?, ?)", [konfiId, points, type, description, req.user.id, date]);
      
      const pointField = type === 'gottesdienst' ? 'gottesdienst_points' : 'gemeinde_points';
      await db.run(`UPDATE konfi_profiles SET ${pointField} = ${pointField} + ? WHERE user_id = ?`, [points, konfiId]);
      
      const newBadges = await checkAndAwardBadges(konfiId);
      res.json({ message: 'Bonus points assigned successfully', newBadges });
    } catch (err) {
      console.error('Error adding bonus points:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // Hinweis: Routen zum Löschen von Zuweisungen sind komplexer, da Punkte zurückgerechnet werden müssen.
  // Diese können wir bei Bedarf später hinzufügen, um es jetzt einfach zu halten.

  return router;
};