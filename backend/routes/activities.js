const express = require('express');
const router = express.Router();

// Dieses Modul fasst die Admin-Verwaltung von Aktivitäten, Anträgen und Bonuspunkten zusammen.
module.exports = (db, rbacVerifier, checkPermission, checkAndAwardBadges, upload) => {

  // ====================================================================
  // ACTIVITIES MANAGEMENT (Masterliste)
  // ====================================================================

  // GET all activities
  // Pfad: GET /api/activities/
  router.get('/', rbacVerifier, checkPermission('admin.activities.view'), async (req, res) => {
    try {
      const query = `
        SELECT a.*, 
               STRING_AGG(c.id || ':' || c.name, ',') as category_data
        FROM activities a
        LEFT JOIN activity_categories ac ON a.id = ac.activity_id
        LEFT JOIN categories c ON ac.category_id = c.id
        WHERE a.organization_id = $1
        GROUP BY a.id
        ORDER BY a.type, a.name
      `;
      console.log("Fetching activities for org:", req.user.organization_id);
      
      const { rows } = await db.query(query, [req.user.organization_id]);
      console.log("Activities found:", rows.length);

      // Parse categories from STRING_AGG result
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

    } catch (err) {
      console.error('Database error in GET /api/activities/:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // POST a new activity
  // Pfad: POST /api/activities/
  router.post('/', rbacVerifier, checkPermission('admin.activities.create'), async (req, res) => {
    const { name, points, type, category_ids } = req.body;
    if (!name || !points || !type) return res.status(400).json({ error: 'Name, points and type are required' });
    if (!['gottesdienst', 'gemeinde'].includes(type)) return res.status(400).json({ error: 'Type must be gottesdienst or gemeinde' });

    try {
      const insertActivityQuery = "INSERT INTO activities (name, points, type, organization_id) VALUES ($1, $2, $3, $4) RETURNING id";
      const { rows: [newActivity] } = await db.query(insertActivityQuery, [name, points, type, req.user.organization_id]);
      const activityId = newActivity.id;

      if (category_ids && Array.isArray(category_ids) && category_ids.length > 0) {
        const insertCategoryQuery = "INSERT INTO activity_categories (activity_id, category_id) VALUES ($1, $2)";
        for (const catId of category_ids) {
          await db.query(insertCategoryQuery, [activityId, catId]);
        }
      }

      res.status(201).json({ id: activityId, message: 'Activity created successfully' });

    } catch (err) {
      console.error('Database error in POST /api/activities/:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // PUT (update) an activity
  // Pfad: PUT /api/activities/:id
  router.put('/:id', rbacVerifier, checkPermission('admin.activities.edit'), async (req, res) => {
    const activityId = req.params.id;
    const { name, points, type, category_ids } = req.body;
    if (!name || !points || !type) return res.status(400).json({ error: 'Name, points and type are required' });

    try {
      const updateQuery = "UPDATE activities SET name = $1, points = $2, type = $3 WHERE id = $4 AND organization_id = $5";
      const { rowCount } = await db.query(updateQuery, [name, points, type, activityId, req.user.organization_id]);
      
      if (rowCount === 0) {
        return res.status(404).json({ error: 'Activity not found or you do not have permission to edit it' });
      }

      // Update categories: delete all existing and then add the new ones
      await db.query("DELETE FROM activity_categories WHERE activity_id = $1", [activityId]);

      if (category_ids && Array.isArray(category_ids) && category_ids.length > 0) {
        const insertCategoryQuery = "INSERT INTO activity_categories (activity_id, category_id) VALUES ($1, $2)";
        for (const catId of category_ids) {
          await db.query(insertCategoryQuery, [activityId, catId]);
        }
      }

      res.json({ message: 'Activity updated successfully' });

    } catch (err) {
      console.error(`Database error in PUT /api/activities/${activityId}:`, err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // DELETE an activity
  // Pfad: DELETE /api/activities/:id
  router.delete('/:id', rbacVerifier, checkPermission('admin.activities.delete'), async (req, res) => {
    const activityId = req.params.id;
    try {
      const checkUsageQuery = `SELECT COUNT(*) as count FROM konfi_activities ka JOIN activities a ON ka.activity_id = a.id WHERE ka.activity_id = $1 AND a.organization_id = $2`;
      const { rows: [usage] } = await db.query(checkUsageQuery, [activityId, req.user.organization_id]);

      if (usage.count > 0) {
        return res.status(409).json({ error: `Aktivität kann nicht gelöscht werden: ${usage.count} Zuordnung(en) zu Konfis vorhanden.` });
      }

      const deleteQuery = "DELETE FROM activities WHERE id = $1 AND organization_id = $2";
      const { rowCount } = await db.query(deleteQuery, [activityId, req.user.organization_id]);

      if (rowCount === 0) {
        return res.status(404).json({ error: 'Aktivität nicht gefunden' });
      }

      res.json({ message: 'Aktivität erfolgreich gelöscht' });

    } catch (err) {
      console.error(`Database error in DELETE /api/activities/${activityId}:`, err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // ====================================================================
  // ACTIVITY REQUESTS MANAGEMENT
  // ====================================================================

  // GET all activity requests for an organization
  // Pfad: GET /api/activities/requests
  router.get('/requests', rbacVerifier, checkPermission('admin.requests.view'), async (req, res) => {
    try {
      const query = `
        SELECT ar.*, u_konfi.display_name as konfi_name, a.name as activity_name, a.points as activity_points,
               u_approved.display_name as approved_by_name
        FROM activity_requests ar
        JOIN users u_konfi ON ar.konfi_id = u_konfi.id
        JOIN activities a ON ar.activity_id = a.id
        LEFT JOIN users u_approved ON ar.approved_by = u_approved.id
        WHERE a.organization_id = $1
        ORDER BY ar.created_at DESC
      `;
      console.log("Fetching activity requests for org:", req.user.organization_id);

      const { rows: requests } = await db.query(query, [req.user.organization_id]);
      console.log("Activity requests found:", requests.length);
      res.json(requests);

    } catch (err) {
      console.error('Database error in GET /api/activities/requests:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // PUT (update) an activity request status
  // Pfad: PUT /api/activities/requests/:id
  router.put('/requests/:id', rbacVerifier, checkPermission('admin.requests.approve'), async (req, res) => {
    const requestId = req.params.id;
    const { status, admin_comment } = req.body;
    if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ error: 'Invalid status' });

    try {
      const getRequestQuery = `
        SELECT ar.*, a.points, a.type, a.name as activity_name, u.display_name as konfi_name
        FROM activity_requests ar 
        JOIN activities a ON ar.activity_id = a.id 
        JOIN users u ON ar.konfi_id = u.id
        WHERE ar.id = $1 AND a.organization_id = $2
      `;
      const { rows: [request] } = await db.query(getRequestQuery, [requestId, req.user.organization_id]);
      if (!request) return res.status(404).json({ error: 'Request not found' });

      const updateRequestQuery = "UPDATE activity_requests SET status = $1, admin_comment = $2, approved_by = $3, updated_at = NOW() WHERE id = $4";
      await db.query(updateRequestQuery, [status, admin_comment, req.user.id, requestId]);
      
      let newBadges = 0;
      if (status === 'approved') {
        await db.query("INSERT INTO konfi_activities (konfi_id, activity_id, admin_id, completed_date, organization_id) VALUES ($1, $2, $3, $4, $5)", [request.konfi_id, request.activity_id, req.user.id, request.requested_date, req.user.organization_id]);

        const pointField = request.type === 'gottesdienst' ? 'gottesdienst_points' : 'gemeinde_points';
        await db.query(`UPDATE konfi_profiles SET ${pointField} = ${pointField} + $1 WHERE user_id = $2`, [request.points, request.konfi_id]);

        newBadges = await checkAndAwardBadges(db, request.konfi_id);

        // Datenschutz: Foto löschen nach Genehmigung
        if (request.photo_filename) {
          const fs = require('fs');
          const path = require('path');
          const photoPath = path.join(__dirname, '../uploads/activity-requests', request.photo_filename);

          fs.unlink(photoPath, (err) => {
            if (err) {
              console.error('Error deleting photo:', err);
            } else {
              console.log(`Photo deleted for approved request ${requestId}: ${request.photo_filename}`);
            }
          });

          // Foto-Referenz in DB entfernen
          await db.query("UPDATE activity_requests SET photo_filename = NULL WHERE id = $1", [requestId]);
        }
      }

      // Send push notification to konfi
      try {
        const notificationTitle = status === 'approved' 
          ? `Antrag genehmigt! 🎉`
          : `Antrag abgelehnt`;
        
        const notificationBody = status === 'approved'
          ? `Dein Antrag für "${request.activity_name}" wurde genehmigt. Du erhältst ${request.points} ${request.points === 1 ? 'Punkt' : 'Punkte'}!`
          : `Dein Antrag für "${request.activity_name}" wurde leider abgelehnt.${admin_comment ? ` Grund: ${admin_comment}` : ''}`;

        // Create notification entry
        await db.query(
          "INSERT INTO notifications (user_id, title, message, type, data, organization_id) VALUES ($1, $2, $3, $4, $5, $6)",
          [
            request.konfi_id,
            notificationTitle,
            notificationBody,
            'activity_request_decision',
            JSON.stringify({ 
              request_id: requestId, 
              activity_name: request.activity_name,
              status: status,
              points: request.points
            }),
            req.user.organization_id
          ]
        );

        console.log(`Notification sent to konfi ${request.konfi_name} for request ${requestId} (${status})`);
      } catch (notifErr) {
        console.error('Error sending notification:', notifErr);
        // Don't fail the request if notification fails
      }
      
      res.json({ message: 'Request status updated', newBadges });
    } catch (err) {
      console.error(`Database error in PUT /api/activities/requests/${requestId}:`, err);
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
      const { rows: [activity] } = await db.query("SELECT * FROM activities WHERE id = $1 AND organization_id = $2", [activityId, req.user.organization_id]);
      if (!activity) return res.status(404).json({ error: 'Activity not found' });
  
      await db.query("INSERT INTO konfi_activities (konfi_id, activity_id, admin_id, completed_date, organization_id) VALUES ($1, $2, $3, $4, $5)", [konfiId, activityId, req.user.id, date, req.user.organization_id]);
      
      const pointField = activity.type === 'gottesdienst' ? 'gottesdienst_points' : 'gemeinde_points';
      await db.query(`UPDATE konfi_profiles SET ${pointField} = ${pointField} + $1 WHERE user_id = $2`, [activity.points, konfiId]);
      
      const badgeResult = await checkAndAwardBadges(db, konfiId);
      res.json({ message: 'Activity assigned successfully', newBadges: badgeResult.count, badgeDetails: badgeResult.badges });
    } catch (err) {
      console.error('Database error in POST /api/activities/assign-activity:', err);
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
      await db.query("INSERT INTO bonus_points (konfi_id, points, type, description, admin_id, completed_date) VALUES ($1, $2, $3, $4, $5, $6)", [konfiId, points, type, description, req.user.id, date]);
      
      const pointField = type === 'gottesdienst' ? 'gottesdienst_points' : 'gemeinde_points';
      await db.query(`UPDATE konfi_profiles SET ${pointField} = ${pointField} + $1 WHERE user_id = $2`, [points, konfiId]);
      
      const newBadges = await checkAndAwardBadges(db, konfiId);
      res.json({ message: 'Bonus points assigned successfully', newBadges });
    } catch (err) {
      console.error('Database error in POST /api/activities/assign-bonus:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // Serve activity request photos (protected admin route)
  router.get('/requests/:id/photo', rbacVerifier, checkPermission('admin.requests.view'), async (req, res) => {
    try {
      const requestId = parseInt(req.params.id);

      // Get request with photo filename
      const { rows: [request] } = await db.query(
        'SELECT photo_filename FROM activity_requests WHERE id = $1',
        [requestId]
      );

      if (!request) {
        return res.status(404).json({ error: 'Request not found' });
      }

      if (!request.photo_filename) {
        return res.status(404).json({ error: 'No photo found' });
      }

      const fs = require('fs');
      const path = require('path');
      const photoPath = path.join(__dirname, '../uploads/requests', request.photo_filename);

      if (!fs.existsSync(photoPath)) {
        return res.status(404).json({ error: 'Photo file not found' });
      }

      // Set correct content type for images
      res.setHeader('Content-Type', 'image/jpeg');
      res.sendFile(photoPath);
    } catch (err) {
      console.error('Error serving activity request photo:', err);
      res.status(500).json({ error: 'Error loading photo' });
    }
  });

  return router;
};