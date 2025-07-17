// routes/auth.js (KORRIGIERT)
const express = require('express');
const router = express.Router();

module.exports = (db, bcrypt, jwt, JWT_SECRET) => {
  
  // Health check
  router.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
  });

  // Admin login
  router.post('/admin/login', (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    // KORREKT: Abfrage nach password_hash
    db.get("SELECT * FROM admins WHERE username = ?", [username], (err, admin) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!admin) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      // KORREKT: bcrypt.compare für Passwort-Verifizierung
      bcrypt.compare(password, admin.password_hash, (err, isMatch) => {
        if (err) {
          console.error('Bcrypt error:', err);
          return res.status(500).json({ error: 'Server error' });
        }
        
        if (!isMatch) {
          return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // Generate JWT token
        const token = jwt.sign(
          { 
            id: admin.id, 
            type: 'admin', 
            display_name: admin.display_name 
          }, 
          JWT_SECRET, 
          { expiresIn: '14d' }
        );
        
        res.json({ 
          token, 
          user: { 
            id: admin.id, 
            username: admin.username, 
            display_name: admin.display_name, 
            type: 'admin' 
          } 
        });
      });
    });
  });

  // Konfi login
  router.post('/konfi/login', (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }
    
    // KORREKT: Abfrage nach password_hash UND password_plain
    db.get(`SELECT k.*, j.name as jahrgang_name 
            FROM konfis k 
            LEFT JOIN jahrgaenge j ON k.jahrgang_id = j.id 
            WHERE k.username = ?`, [username], (err, konfi) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!konfi) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      // KORREKT: bcrypt.compare für Passwort-Verifizierung
      bcrypt.compare(password, konfi.password_hash, (err, isMatch) => {
        if (err) {
          console.error('Bcrypt error:', err);
          return res.status(500).json({ error: 'Server error' });
        }
        
        if (!isMatch) {
          return res.status(401).json({ error: 'Invalid credentials' });
        }
        
        // Generate JWT token
        const token = jwt.sign({ 
          id: konfi.id, 
          type: 'konfi', 
          display_name: konfi.name, 
          jahrgang_id: konfi.jahrgang_id,
          jahrgang_name: konfi.jahrgang_name 
        }, JWT_SECRET, { expiresIn: '14d' });
        
        res.json({ 
          token, 
          user: { 
            id: konfi.id, 
            username: konfi.username, 
            display_name: konfi.name, 
            type: 'konfi',
            jahrgang_id: konfi.jahrgang_id,
            jahrgang_name: konfi.jahrgang_name,
            gottesdienst_points: konfi.gottesdienst_points,
            gemeinde_points: konfi.gemeinde_points
          } 
        });
      });
    });
  });

  return router;
};