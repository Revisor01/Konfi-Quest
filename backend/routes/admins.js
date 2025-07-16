const express = require('express');
const router = express.Router();

// Admins routes
module.exports = (db, verifyToken) => {
  
  // Get all admins
  router.get('/', verifyToken, (req, res) => {
    if (req.user.type !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    db.all("SELECT id, username, display_name, created_at FROM admins ORDER BY username", [], (err, admins) => {
      if (err) {
        console.error('Error fetching admins:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(admins);
    });
  });

  // Create new admin
  router.post('/', verifyToken, (req, res) => {
    if (req.user.type !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const { username, password, display_name } = req.body;
    
    if (!username || !password || !display_name) {
      return res.status(400).json({ error: 'Username, password, and display_name are required' });
    }
    
    // Check if username already exists
    db.get("SELECT id FROM admins WHERE username = ?", [username], (err, existingAdmin) => {
      if (err) {
        console.error('Error checking existing admin:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (existingAdmin) {
        return res.status(409).json({ error: 'Username already exists' });
      }
      
      db.run("INSERT INTO admins (username, password, display_name) VALUES (?, ?, ?)",
        [username, password, display_name],
        function(err) {
          if (err) {
            console.error('Error creating admin:', err);
            return res.status(500).json({ error: 'Database error' });
          }
          
          res.json({
            id: this.lastID,
            username,
            display_name,
            message: 'Admin created successfully'
          });
        }
      );
    });
  });

  // Update admin
  router.put('/:id', verifyToken, (req, res) => {
    if (req.user.type !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const adminId = req.params.id;
    const { username, password, display_name } = req.body;
    
    if (!username || !display_name) {
      return res.status(400).json({ error: 'Username and display_name are required' });
    }
    
    // Check if username already exists (excluding current admin)
    db.get("SELECT id FROM admins WHERE username = ? AND id != ?", [username, adminId], (err, existingAdmin) => {
      if (err) {
        console.error('Error checking existing admin:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (existingAdmin) {
        return res.status(409).json({ error: 'Username already exists' });
      }
      
      let query = "UPDATE admins SET username = ?, display_name = ?";
      let params = [username, display_name];
      
      if (password) {
        query += ", password = ?";
        params.push(password);
      }
      
      query += " WHERE id = ?";
      params.push(adminId);
      
      db.run(query, params, function(err) {
        if (err) {
          console.error('Error updating admin:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        if (this.changes === 0) {
          return res.status(404).json({ error: 'Admin not found' });
        }
        res.json({ message: 'Admin updated successfully' });
      });
    });
  });

  // Delete admin
  router.delete('/:id', verifyToken, (req, res) => {
    if (req.user.type !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const adminId = req.params.id;
    
    // Check if this is the last admin
    db.get("SELECT COUNT(*) as count FROM admins", [], (err, result) => {
      if (err) {
        console.error('Error checking admin count:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (result.count <= 1) {
        return res.status(400).json({ error: 'Cannot delete the last admin' });
      }
      
      // Check if admin is currently logged in user
      if (parseInt(adminId) === req.user.id) {
        return res.status(400).json({ error: 'Cannot delete your own admin account' });
      }
      
      db.run("DELETE FROM admins WHERE id = ?", [adminId], function(err) {
        if (err) {
          console.error('Error deleting admin:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        if (this.changes === 0) {
          return res.status(404).json({ error: 'Admin not found' });
        }
        res.json({ message: 'Admin deleted successfully' });
      });
    });
  });

  return router;
};