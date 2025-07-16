// routes/konfis.js
const express = require('express');
const router = express.Router();

module.exports = (db, verifyToken, bcrypt, generateBiblicalPassword, checkAndAwardBadges) => {
  
  // GET all konfis (Logik aus server.js.txt übernommen)
  router.get('/', verifyToken, (req, res) => {
      if (req.user.type !== 'admin') return res.status(403).json({ error: 'Admin access required' });
      // Dies ist die komplette, korrekte Route aus deiner server.js.txt
      const konfisQuery = `SELECT k.*, j.name as jahrgang_name, j.confirmation_date FROM konfis k JOIN jahrgaenge j ON k.jahrgang_id = j.id ORDER BY j.name DESC, k.name`;
      db.all(konfisQuery, [], (err, konfisRows) => {
          if (err) return res.status(500).json({ error: 'Database error' });
          const badgeCountQuery = `SELECT konfi_id, COUNT(*) as badge_count FROM konfi_badges GROUP BY konfi_id`;
          db.all(badgeCountQuery, [], (err, badgeCounts) => {
              if (err) return res.status(500).json({ error: 'Database error' });
              const badgeCountMap = badgeCounts.reduce((acc, bc) => ({ ...acc, [bc.konfi_id]: bc.badge_count }), {});
              const konfis = konfisRows.map(row => ({
                  ...row,
                  password: row.password_plain, // Plaintext-Passwort für die Anzeige
                  badgeCount: badgeCountMap[row.id] || 0
              }));
              res.json(konfis);
          });
      });
  });

  // GET single konfi
  router.get('/:id', verifyToken, (req, res) => {
    const konfiId = req.params.id;
    if (req.user.type === 'konfi' && req.user.id !== parseInt(konfiId)) return res.status(403).json({ error: 'Access denied' });
    
    const konfiQuery = `SELECT k.*, j.name as jahrgang_name FROM konfis k JOIN jahrgaenge j ON k.jahrgang_id = j.id WHERE k.id = ?`;
    db.get(konfiQuery, [konfiId], (err, konfi) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (!konfi) return res.status(404).json({ error: 'Konfi not found' });

        const activitiesQuery = `SELECT a.name, a.points, a.type, ka.completed_date as date, adm.display_name as admin, ka.id FROM konfi_activities ka JOIN activities a ON ka.activity_id = a.id LEFT JOIN admins adm ON ka.admin_id = adm.id WHERE ka.konfi_id = ? ORDER BY ka.completed_date DESC`;
        const bonusQuery = `SELECT bp.description, bp.points, bp.type, bp.completed_date as date, adm.display_name as admin, bp.id FROM bonus_points bp LEFT JOIN admins adm ON bp.admin_id = adm.id WHERE bp.konfi_id = ? ORDER BY bp.completed_date DESC`;
        // KORREKT: `custom_badges` statt `badges`
        const badgesQuery = `SELECT cb.*, kb.earned_at FROM custom_badges cb JOIN konfi_badges kb ON cb.id = kb.badge_id WHERE kb.konfi_id = ? ORDER BY kb.earned_at DESC`;
        
        Promise.all([
            new Promise((resolve) => db.all(activitiesQuery, [konfiId], (_, rows) => resolve(rows || []))),
            new Promise((resolve) => db.all(bonusQuery, [konfiId], (_, rows) => resolve(rows || []))),
            new Promise((resolve) => db.all(badgesQuery, [konfiId], (_, rows) => resolve(rows || [])))
        ]).then(([activities, bonusPoints, badges]) => {
            res.json({ ...konfi, password: konfi.password_plain, activities, bonusPoints, badges });
        });
    });
  });

  // POST new konfi
  router.post('/', verifyToken, (req, res) => {
    if (req.user.type !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    const { name, jahrgang_id } = req.body;
    if (!name || !jahrgang_id) return res.status(400).json({ error: 'Name and Jahrgang are required' });

    // KORREKT: generateBiblicalPassword verwenden
    const password = generateBiblicalPassword();
    // KORREKT: Passwort hashen
    const hashedPassword = bcrypt.hashSync(password, 10);
    const username = name.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z.]/g, '');

    db.run("INSERT INTO konfis (name, jahrgang_id, username, password_hash, password_plain) VALUES (?, ?, ?, ?, ?)",
      [name, jahrgang_id, username, hashedPassword, password],
      function(err) {
        if (err) {
          if (err.message.includes('UNIQUE')) return res.status(400).json({ error: 'Username already exists' });
          return res.status(500).json({ error: 'Database error' });
        }
        res.status(201).json({ id: this.lastID, name, username, password });
      });
  });

  // POST regenerate password
  router.post('/:id/regenerate-password', verifyToken, (req, res) => {
    if (req.user.type !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    const konfiId = req.params.id;
    const newPassword = generateBiblicalPassword();
    // KORREKT: Passwort hashen
    const hashedPassword = bcrypt.hashSync(newPassword, 10);

    db.run("UPDATE konfis SET password_hash = ?, password_plain = ? WHERE id = ?",
      [hashedPassword, newPassword, konfiId],
      function(err) {
        if (err) return res.status(500).json({ error: 'Database error' });
        if (this.changes === 0) return res.status(404).json({ error: 'Konfi not found' });
        res.json({ message: 'Password regenerated successfully', password: newPassword });
      });
  });

  // DELETE konfi
  router.delete('/:id', verifyToken, (req, res) => {
      if (req.user.type !== 'admin') return res.status(403).json({ error: 'Admin access required' });
      const konfiId = req.params.id;
      db.serialize(() => {
          db.run("DELETE FROM konfi_activities WHERE konfi_id = ?", [konfiId]);
          db.run("DELETE FROM bonus_points WHERE konfi_id = ?", [konfiId]);
          db.run("DELETE FROM konfi_badges WHERE konfi_id = ?", [konfiId]);
          db.run("DELETE FROM activity_requests WHERE konfi_id = ?", [konfiId]);
          db.run("DELETE FROM chat_participants WHERE user_id = ? AND user_type = 'konfi'", [konfiId]);
          db.run("DELETE FROM event_bookings WHERE konfi_id = ?", [konfiId]);
          db.run("DELETE FROM konfis WHERE id = ?", [konfiId], function(err) {
              if (err) return res.status(500).json({ error: 'Database error' });
              if (this.changes === 0) return res.status(404).json({ error: 'Konfi not found' });
              res.json({ message: 'Konfi deleted successfully' });
          });
      });
  });

  return router;
};