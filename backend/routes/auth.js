// routes/auth.js
const express = require('express');
const router = express.Router();

module.exports = (db, bcrypt, jwt, JWT_SECRET) => {
  
  // Health check
  router.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
  });

  // Admin login - EXAKT AUS BACKUP
  router.post('/admin/login', (req, res) => {
    const { username, password } = req.body;
    
    db.get("SELECT * FROM admins WHERE username = ?", [username], (err, admin) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      const token = jwt.sign({ id: admin.id, type: 'admin', display_name: admin.display_name }, JWT_SECRET, { expiresIn: '14d' });
      res.json({ token, user: { id: admin.id, username: admin.username, display_name: admin.display_name, type: 'admin' } });
    });
  });

  // Konfi login - EXAKT AUS BACKUP
  router.post('/konfi/login', (req, res) => {
    const { username, password } = req.body;
    
    db.get("SELECT k.*, j.name as jahrgang_name FROM konfis k JOIN jahrgaenge j ON k.jahrgang_id = j.id WHERE k.username = ?", [username], (err, konfi) => {
      if (err) {
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!konfi || !bcrypt.compareSync(password, konfi.password_hash)) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      const token = jwt.sign({ id: konfi.id, type: 'konfi' }, JWT_SECRET, { expiresIn: '24h' });
      res.json({ 
        token, 
        user: { 
          id: konfi.id, 
          name: konfi.name, 
          username: konfi.username,
          jahrgang: konfi.jahrgang_name,
          type: 'konfi' 
        } 
      });
    });
  });

  return router;
};