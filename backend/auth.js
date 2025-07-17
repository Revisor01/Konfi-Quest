const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const router = express.Router();

// JWT Secret
const JWT_SECRET = process.env.JWT_SECRET || 'konfi-secret-2025';

// Bible books for password generation
const BIBLE_BOOKS = [
  'Genesis', 'Exodus', 'Levitikus', 'Numeri', 'Deuteronomium',
  'Josua', 'Richter', 'Ruth', 'Samuel', 'Koenige', 'Chronik',
  'Esra', 'Nehemia', 'Ester', 'Hiob', 'Psalmen', 'Sprueche',
  'Prediger', 'Hohelied', 'Jesaja', 'Jeremia', 'Klagelieder',
  'Hesekiel', 'Daniel', 'Hosea', 'Joel', 'Amos', 'Obadja',
  'Jona', 'Micha', 'Nahum', 'Habakuk', 'Zephanja', 'Haggai',
  'Sacharja', 'Maleachi', 'Matthaeus', 'Markus', 'Lukas',
  'Johannes', 'Apostelgeschichte', 'Roemer', 'Korinther',
  'Galater', 'Epheser', 'Philipper', 'Kolosser', 'Thessalonicher',
  'Timotheus', 'Titus', 'Philemon', 'Hebraeer', 'Jakobus',
  'Petrus', 'Johannes', 'Judas', 'Offenbarung'
];

// Function to generate biblical password
function generateBiblicalPassword() {
  const book = BIBLE_BOOKS[Math.floor(Math.random() * BIBLE_BOOKS.length)];
  const chapter = Math.floor(Math.random() * 50) + 1; // 1-50
  const verse = Math.floor(Math.random() * 30) + 1; // 1-30
  return `${book}${chapter},${verse}`;
}

// Middleware to verify JWT token
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'No token provided' });
  }
  
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    req.user = decoded;
    next();
  });
};

// Admin login
router.post('/admin/login', (req, res) => {
  const { username, password } = req.body;
  
  req.db.get("SELECT * FROM admins WHERE username = ?", [username], (err, admin) => {
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

// Konfi login
router.post('/konfi/login', (req, res) => {
  const { username, password } = req.body;
  
  req.db.get("SELECT k.*, j.name as jahrgang_name FROM konfis k JOIN jahrgaenge j ON k.jahrgang_id = j.id WHERE k.username = ?", [username], (err, konfi) => {
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

// Reset konfi password (admin only)
router.put('/konfis/:id/reset-password', verifyToken, (req, res) => {
  if (req.user.type !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  const konfiId = req.params.id;
  const newPassword = generateBiblicalPassword();
  const hashedPassword = bcrypt.hashSync(newPassword, 10);
  
  req.db.run("UPDATE konfis SET password_hash = ?, password_plain = ? WHERE id = ?",
         [hashedPassword, newPassword, konfiId],
         function(err) {
           if (err) {
             return res.status(500).json({ error: 'Database error' });
           }
           
           if (this.changes === 0) {
             return res.status(404).json({ error: 'Konfi not found' });
           }
           
           res.json({ message: 'Password reset successfully', new_password: newPassword });
         });
});

// Export the router and helper functions
module.exports = {
  router,
  verifyToken,
  generateBiblicalPassword,
  JWT_SECRET
};