const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();

// Activity requests routes
module.exports = (db, verifyToken) => {
  
  // Upload setup for activity request photos
  const uploadsDir = path.join(__dirname, '../uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  const upload = multer({ 
    dest: uploadsDir,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
      if (file.mimetype.startsWith('image/')) {
        cb(null, true);
      } else {
        cb(null, false);
      }
    }
  });

  // Get all activity requests
  router.get('/', verifyToken, (req, res) => {
    if (req.user.type !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    db.all(`SELECT ar.*, k.name as konfi_name, j.name as jahrgang_name
            FROM activity_requests ar
            JOIN konfis k ON ar.konfi_id = k.id
            LEFT JOIN jahrgaenge j ON k.jahrgang_id = j.id
            ORDER BY ar.created_at DESC`, [], (err, requests) => {
      if (err) {
        console.error('Error fetching activity requests:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(requests);
    });
  });

  // Get activity requests for specific konfi
  router.get('/konfi/:konfiId', verifyToken, (req, res) => {
    const konfiId = req.params.konfiId;
    
    // Check if user is admin or the konfi themselves
    if (req.user.type !== 'admin' && req.user.id !== parseInt(konfiId)) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    db.all(`SELECT ar.*, k.name as konfi_name, j.name as jahrgang_name
            FROM activity_requests ar
            JOIN konfis k ON ar.konfi_id = k.id
            LEFT JOIN jahrgaenge j ON k.jahrgang_id = j.id
            WHERE ar.konfi_id = ?
            ORDER BY ar.created_at DESC`, [konfiId], (err, requests) => {
      if (err) {
        console.error('Error fetching activity requests:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(requests);
    });
  });

  // Create new activity request
  router.post('/', upload.single('photo'), (req, res) => {
    const { konfi_id, activity_name, description, completed_date, category } = req.body;
    const photo = req.file;
    
    if (!konfi_id || !activity_name || !description) {
      return res.status(400).json({ error: 'konfi_id, activity_name, and description are required' });
    }
    
    const photoPath = photo ? photo.filename : null;
    const date = completed_date || new Date().toISOString().split('T')[0];
    
    db.run(`INSERT INTO activity_requests (
      konfi_id, activity_name, description, completed_date, 
      category, photo_filename, status
    ) VALUES (?, ?, ?, ?, ?, ?, 'pending')`,
      [konfi_id, activity_name, description, date, category || 'gemeinde', photoPath],
      function(err) {
        if (err) {
          console.error('Error creating activity request:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        
        res.json({
          id: this.lastID,
          message: 'Activity request created successfully',
          hasPhoto: !!photo
        });
      }
    );
  });

  // Update activity request (approve/reject)
  router.put('/:id', verifyToken, async (req, res) => {
    if (req.user.type !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const requestId = req.params.id;
    const { status, admin_comment, points } = req.body;
    
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Status must be approved or rejected' });
    }
    
    // Get the request details
    db.get("SELECT * FROM activity_requests WHERE id = ?", [requestId], async (err, request) => {
      if (err) {
        console.error('Error fetching request:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!request) {
        return res.status(404).json({ error: 'Activity request not found' });
      }
      
      if (request.status !== 'pending') {
        return res.status(400).json({ error: 'Request has already been processed' });
      }
      
      try {
        // Update the request status
        await new Promise((resolve, reject) => {
          db.run("UPDATE activity_requests SET status = ?, admin_comment = ?, approved_by = ?, approved_at = ? WHERE id = ?",
            [status, admin_comment, req.user.id, new Date().toISOString(), requestId], 
            function(err) {
              if (err) reject(err);
              else resolve();
            });
        });
        
        // If approved, create activity and assign points
        if (status === 'approved') {
          const activityPoints = points || 1;
          const category = request.category || 'gemeinde';
          
          // Create activity
          const activityId = await new Promise((resolve, reject) => {
            db.run("INSERT INTO activities (name, points, type, category) VALUES (?, ?, ?, 'custom')",
              [request.activity_name, activityPoints, category], 
              function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
              });
          });
          
          // Assign activity to konfi
          await new Promise((resolve, reject) => {
            db.run("INSERT INTO konfi_activities (konfi_id, activity_id, admin_id, completed_date) VALUES (?, ?, ?, ?)",
              [request.konfi_id, activityId, req.user.id, request.completed_date], 
              function(err) {
                if (err) reject(err);
                else resolve();
              });
          });
          
          // Update konfi points
          const pointField = category === 'gottesdienst' ? 'gottesdienst_points' : 'gemeinde_points';
          await new Promise((resolve, reject) => {
            db.run(`UPDATE konfis SET ${pointField} = ${pointField} + ? WHERE id = ?`,
              [activityPoints, request.konfi_id], 
              function(err) {
                if (err) reject(err);
                else resolve();
              });
          });
        }
        
        res.json({ 
          message: `Activity request ${status} successfully`,
          activityCreated: status === 'approved'
        });
        
      } catch (error) {
        console.error('Error processing request:', error);
        res.status(500).json({ error: 'Database error' });
      }
    });
  });

  // Delete activity request
  router.delete('/:id', verifyToken, (req, res) => {
    if (req.user.type !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const requestId = req.params.id;
    
    // Get request details to delete photo
    db.get("SELECT photo_filename FROM activity_requests WHERE id = ?", [requestId], (err, request) => {
      if (err) {
        console.error('Error fetching request for deletion:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!request) {
        return res.status(404).json({ error: 'Activity request not found' });
      }
      
      // Delete associated photo
      if (request.photo_filename) {
        const photoPath = path.join(uploadsDir, request.photo_filename);
        if (fs.existsSync(photoPath)) {
          fs.unlinkSync(photoPath);
        }
      }
      
      // Delete request
      db.run("DELETE FROM activity_requests WHERE id = ?", [requestId], function(err) {
        if (err) {
          console.error('Error deleting request:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        
        if (this.changes === 0) {
          return res.status(404).json({ error: 'Activity request not found' });
        }
        
        res.json({ message: 'Activity request deleted successfully' });
      });
    });
  });

  // Get activity request photo
  router.get('/:id/photo', (req, res) => {
    const requestId = req.params.id;
    
    db.get("SELECT photo_filename FROM activity_requests WHERE id = ?", [requestId], (err, request) => {
      if (err) {
        console.error('Error fetching request photo:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!request || !request.photo_filename) {
        return res.status(404).json({ error: 'Photo not found' });
      }
      
      const photoPath = path.join(uploadsDir, request.photo_filename);
      
      if (fs.existsSync(photoPath)) {
        res.sendFile(photoPath);
      } else {
        res.status(404).json({ error: 'Photo file not found' });
      }
    });
  });

  // Get activity categories
  router.get('/categories', verifyToken, (req, res) => {
    res.json(['gottesdienst', 'gemeinde']);
  });

  return router;
};