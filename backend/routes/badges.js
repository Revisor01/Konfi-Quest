// routes/badges.js
const express = require('express');
const router = express.Router();

// Badge criteria types
const CRITERIA_TYPES = {
  // === PUNKTE-BASIERTE KRITERIEN (Einfach & häufig verwendet) ===
  total_points: { 
    label: "🎯 Gesamtpunkte", 
    description: "Mindestanzahl aller Punkte",
    help: "Badge wird vergeben, wenn die Summe aus Gottesdienst- und Gemeindepunkten erreicht wird. Beispiel: Wert 20 = mindestens 20 Punkte insgesamt."
  },
  gottesdienst_points: { 
    label: "📖 Gottesdienst-Punkte", 
    description: "Mindestanzahl gottesdienstlicher Punkte",
    help: "Badge wird vergeben, wenn die angegebene Anzahl gottesdienstlicher Punkte erreicht wird. Beispiel: Wert 10 = mindestens 10 Gottesdienst-Punkte."
  },
  gemeinde_points: { 
    label: "🤝 Gemeinde-Punkte", 
    description: "Mindestanzahl gemeindlicher Punkte",
    help: "Badge wird vergeben, wenn die angegebene Anzahl gemeindlicher Punkte erreicht wird. Beispiel: Wert 15 = mindestens 15 Gemeinde-Punkte."
  },
  both_categories: { 
    label: "⚖️ Beide Kategorien", 
    description: "Mindestpunkte in beiden Bereichen",
    help: "Badge wird vergeben, wenn sowohl bei Gottesdienst- als auch bei Gemeindepunkten der Mindestwert erreicht wird. Beispiel: Wert 5 = mindestens 5 Gottesdienst-Punkte UND 5 Gemeinde-Punkte."
  },
  
  // === AKTIVITÄTS-BASIERTE KRITERIEN (Mittlere Komplexität) ===
  activity_count: { 
    label: "📊 Aktivitäten-Anzahl", 
    description: "Gesamtanzahl aller Aktivitäten",
    help: "Badge wird vergeben, wenn die angegebene Anzahl von Aktivitäten absolviert wurde (egal welche). Beispiel: Wert 5 = mindestens 5 Aktivitäten."
  },
  unique_activities: { 
    label: "🌟 Verschiedene Aktivitäten", 
    description: "Anzahl unterschiedlicher Aktivitäten",
    help: "Badge wird vergeben, wenn die angegebene Anzahl verschiedener Aktivitäten absolviert wurde. Mehrfache Teilnahme an derselben Aktivität zählt nur einmal. Beispiel: Wert 3 = 3 verschiedene Aktivitäten."
  },
  
  // === SPEZIFISCHE AKTIVITÄTS-KRITERIEN (Spezifischer) ===
  specific_activity: { 
    label: "🎯 Spezifische Aktivität", 
    description: "Bestimmte Aktivität X-mal absolviert",
    help: "Badge wird vergeben, wenn eine bestimmte Aktivität die angegebene Anzahl mal absolviert wurde. Beispiel: Wert 5 + 'Sonntagsgottesdienst' = 5x am Sonntagsgottesdienst teilgenommen."
  },
  category_activities: { 
    label: "🏷️ Kategorie-Aktivitäten", 
    description: "Aktivitäten aus bestimmter Kategorie",
    help: "Badge wird vergeben, wenn die angegebene Anzahl von Aktivitäten aus einer bestimmten Kategorie absolviert wurde. Beispiel: Wert 3 + Kategorie 'sonntagsgottesdienst' = 3 Sonntagsgottesdienste."
  },
  activity_combination: { 
    label: "🎭 Aktivitäts-Kombination", 
    description: "Spezifische Kombination von Aktivitäten",
    help: "Badge wird vergeben, wenn alle ausgewählten Aktivitäten mindestens einmal absolviert wurden. Der Wert gibt die Mindestanzahl an benötigten Aktivitäten aus der Liste an."
  },
  
  // === ZEIT-BASIERTE KRITERIEN (Komplex) ===
  time_based: { 
    label: "⏰ Zeitbasiert", 
    description: "Aktivitäten in einem Zeitraum",
    help: "Badge wird vergeben, wenn die angegebene Anzahl von Aktivitäten innerhalb der festgelegten Tage absolviert wurde. Beispiel: Wert 3 + 7 Tage = 3 Aktivitäten in einer Woche."
  },
  streak: { 
    label: "🔥 Serie", 
    description: "Aufeinanderfolgende Aktivitäten",
    help: "Badge wird vergeben, wenn in der angegebenen Anzahl aufeinanderfolgender Wochen mindestens eine Aktivität absolviert wurde. Beispiel: Wert 4 = 4 Wochen in Folge aktiv."
  },
  
  // === SPEZIAL-KRITERIEN (Selten verwendet) ===
  bonus_points: { 
    label: "💰 Bonuspunkte", 
    description: "Anzahl erhaltener Bonuspunkte",
    help: "Badge wird vergeben, wenn die angegebene Anzahl von Bonuspunkt-Einträgen erhalten wurde (unabhängig von der Höhe der Bonuspunkte). Beispiel: Wert 2 = mindestens 2 Bonuspunkt-Vergaben."
  }
};

module.exports = (db, verifyToken) => {
  
  // GET /api/badges - Alle Badges abrufen
  router.get('/', verifyToken, (req, res) => {
    if (req.user.type !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const badgeQuery = `
      SELECT cb.*, 
              a.display_name as created_by_name,
              COALESCE(badge_counts.earned_count, 0) as earned_count
      FROM custom_badges cb 
      LEFT JOIN admins a ON cb.created_by = a.id
      LEFT JOIN (
        SELECT badge_id, COUNT(*) as earned_count 
        FROM konfi_badges 
        GROUP BY badge_id
      ) badge_counts ON cb.id = badge_counts.badge_id
      ORDER BY cb.created_at DESC
    `;
    
    db.all(badgeQuery, [], (err, rows) => {
      if (err) {
        console.error('Error fetching badges:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      console.log('Badge results:', rows); // Debug-Log
      res.json(rows);
    });
  });

  // GET /api/badge-criteria-types - Badge-Kriterien-Typen
  router.get('/criteria-types', verifyToken, (req, res) => {
    res.json(CRITERIA_TYPES);
  });

  // GET /api/activity-categories - Aktivität-Kategorien
  router.get('/activity-categories', verifyToken, (req, res) => {
    db.all("SELECT DISTINCT category FROM activities WHERE category IS NOT NULL AND category != '' ORDER BY category", [], (err, rows) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      const categories = rows.map(row => row.category);
      res.json(categories);
    });
  });

  // POST /api/badges - Badge erstellen
  router.post('/', verifyToken, (req, res) => {
    if (req.user.type !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    const { name, icon, description, criteria_type, criteria_value, criteria_extra, is_hidden } = req.body;
    
    if (!name || !icon || !criteria_type || !criteria_value) {
      return res.status(400).json({ error: 'Name, icon, criteria type and value are required' });
    }
    
    const extraJson = criteria_extra ? JSON.stringify(criteria_extra) : null;
    const hiddenFlag = is_hidden ? 1 : 0; // BOOLEAN ZU INTEGER
    
    db.run("INSERT INTO custom_badges (name, icon, description, criteria_type, criteria_value, criteria_extra, is_hidden, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      [name, icon, description, criteria_type, criteria_value, extraJson, hiddenFlag, req.user.id],
      function(err) {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ id: this.lastID, name, icon, description, criteria_type, criteria_value, criteria_extra: extraJson, is_hidden: hiddenFlag });
      });
  });

  // PUT /api/badges/:id - Badge bearbeiten
  router.put('/:id', verifyToken, (req, res) => {
    if (req.user.type !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    const { name, icon, description, criteria_type, criteria_value, criteria_extra, is_active, is_hidden } = req.body;
    
    const extraJson = criteria_extra ? JSON.stringify(criteria_extra) : null;
    const activeFlag = is_active ? 1 : 0; // BOOLEAN ZU INTEGER
    const hiddenFlag = is_hidden ? 1 : 0; // BOOLEAN ZU INTEGER
    
    db.run("UPDATE custom_badges SET name = ?, icon = ?, description = ?, criteria_type = ?, criteria_value = ?, criteria_extra = ?, is_active = ?, is_hidden = ? WHERE id = ?",
      [name, icon, description, criteria_type, criteria_value, extraJson, activeFlag, hiddenFlag, req.params.id],
      function(err) {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ message: 'Badge updated successfully' });
      });
  });

  // DELETE /api/badges/:id - Badge löschen
  router.delete('/:id', verifyToken, (req, res) => {
    if (req.user.type !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    db.run("DELETE FROM konfi_badges WHERE badge_id = ?", [req.params.id], (err) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      db.run("DELETE FROM custom_badges WHERE id = ?", [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ message: 'Badge deleted successfully' });
      });
    });
  });

  // GET /api/konfis/:id/badges - Badges eines Konfis
  router.get('/konfis/:id', verifyToken, (req, res) => {
    const konfiId = req.params.id;
    if (req.user.type === 'konfi' && req.user.id !== parseInt(konfiId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const earnedQuery = `
      SELECT cb.*, kb.earned_at FROM custom_badges cb
      JOIN konfi_badges kb ON cb.id = kb.badge_id
      WHERE kb.konfi_id = ? AND cb.is_active = 1
      ORDER BY kb.earned_at DESC
    `;
    
    db.all(earnedQuery, [konfiId], (err, earnedBadges) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      
      db.all("SELECT * FROM custom_badges WHERE is_active = 1 ORDER BY criteria_value", [], (err, allBadges) => {
        if (err) return res.status(500).json({ error: 'Database error' });
        res.json({ 
          earned: earnedBadges, 
          available: allBadges,
          progress: `${earnedBadges.length}/${allBadges.length}`
        });
      });
    });
  });

  return router;
};