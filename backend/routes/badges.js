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

const checkAndAwardBadges = async (db, konfiId) => {
  return new Promise((resolve, reject) => {
    // Get all active badges
    db.all("SELECT * FROM custom_badges WHERE is_active = 1", [], (err, badges) => {
      if (err) return reject(err);
      
      // Get konfi data
      db.get("SELECT * FROM konfis WHERE id = ?", [konfiId], (err, konfi) => {
        if (err) return reject(err);
        if (!konfi) return resolve(0);
        
        let newBadges = 0;
        const earnedBadgeIds = [];
        
        // Get already earned badges
        db.all("SELECT badge_id FROM konfi_badges WHERE konfi_id = ?", [konfiId], (err, earned) => {
          if (err) return reject(err);
          
          const alreadyEarned = earned.map(e => e.badge_id);
          let badgesProcessed = 0;
          
          if (badges.length === 0) {
            return resolve(0);
          }
          
          badges.forEach(badge => {
            if (alreadyEarned.includes(badge.id)) {
              badgesProcessed++;
              if (badgesProcessed === badges.length) {
                finalizeBadges();
              }
              return;
            }
            
            let earned = false;
            const criteria = JSON.parse(badge.criteria_extra || '{}');
            
            switch (badge.criteria_type) {
              case 'total_points':
                earned = (konfi.gottesdienst_points + konfi.gemeinde_points) >= badge.criteria_value;
                processBadgeResult();
                break;
              
              case 'gottesdienst_points':
                earned = konfi.gottesdienst_points >= badge.criteria_value;
                processBadgeResult();
                break;
              
              case 'gemeinde_points':
                earned = konfi.gemeinde_points >= badge.criteria_value;
                processBadgeResult();
                break;
              
              case 'specific_activity':
                if (criteria.required_activity_name) {
                  // Separate query to count specific activity occurrences
                  const countQuery = `
                    SELECT COUNT(*) as count 
                    FROM konfi_activities ka 
                    JOIN activities a ON ka.activity_id = a.id 
                    WHERE ka.konfi_id = ? AND a.name = ?
                  `;
                  db.get(countQuery, [konfiId, criteria.required_activity_name], (err, result) => {
                    if (err) {
                      console.error('Specific activity badge check error:', err);
                      earned = false;
                    } else {
                      earned = result && result.count >= badge.criteria_value;
                    }
                    processBadgeResult();
                  });
                } else {
                  processBadgeResult();
                }
                break;
              
              case 'both_categories':
                earned = konfi.gottesdienst_points >= badge.criteria_value && 
                konfi.gemeinde_points >= badge.criteria_value;
                processBadgeResult();
                break;
              
              case 'activity_combination':
                if (criteria.required_activities) {
                  // Check if all required activities have been completed at least once
                  const combinationQuery = `
                    SELECT DISTINCT a.name 
                    FROM konfi_activities ka 
                    JOIN activities a ON ka.activity_id = a.id 
                    WHERE ka.konfi_id = ?
                  `;
                  db.all(combinationQuery, [konfiId], (err, results) => {
                    if (err) {
                      console.error('Activity combination badge check error:', err);
                      earned = false;
                    } else {
                      const completedActivities = results.map(r => r.name);
                      earned = criteria.required_activities.every(req => 
                        completedActivities.includes(req)
                      );
                    }
                    processBadgeResult();
                  });
                } else {
                  processBadgeResult();
                }
                break;
              
              case 'category_activities':
                if (criteria.required_category) {
                  const categoryCountQuery = `
                    SELECT COUNT(*) as count FROM konfi_activities ka 
                    JOIN activities a ON ka.activity_id = a.id 
                    JOIN activity_categories ac ON a.id = ac.activity_id
                    JOIN categories c ON ac.category_id = c.id
                    WHERE ka.konfi_id = ? AND c.name = ?
                  `;
                  
                  const params = [konfiId, criteria.required_category];
                  
                  db.get(categoryCountQuery, params, (err, result) => {
                    if (err) {
                      console.error('Category badge check error:', err);
                      earned = false;
                    } else {
                      earned = result && result.count >= badge.criteria_value;
                    }
                    processBadgeResult();
                  });
                } else {
                  processBadgeResult();
                }
                break;
              
              case 'time_based':
                if (criteria.days) {
                  const timeQuery = `
                    SELECT completed_date FROM konfi_activities 
                    WHERE konfi_id = ? 
                    ORDER BY completed_date DESC
                  `;
                  db.all(timeQuery, [konfiId], (err, results) => {
                    if (err) {
                      console.error('Time based badge check error:', err);
                      earned = false;
                    } else {
                      const now = new Date();
                      const cutoff = new Date(now.getTime() - (criteria.days * 24 * 60 * 60 * 1000));
                      
                      const recentCount = results.filter(r => {
                        const date = new Date(r.completed_date);
                        return date >= cutoff;
                      }).length;
                      
                      earned = recentCount >= badge.criteria_value;
                    }
                    processBadgeResult();
                  });
                } else {
                  processBadgeResult();
                }
                break;
              
              case 'activity_count':
                db.get("SELECT COUNT(*) as count FROM konfi_activities WHERE konfi_id = ?", 
                  [konfiId], (err, result) => {
                    if (err) {
                      console.error('Activity count badge check error:', err);
                      earned = false;
                    } else {
                      earned = result && result.count >= badge.criteria_value;
                    }
                    processBadgeResult();
                  });
                break;
              
              case 'bonus_points':
                db.get("SELECT COUNT(*) as count FROM bonus_points WHERE konfi_id = ?", 
                  [konfiId], (err, result) => {
                    if (err) {
                      console.error('Bonus points badge check error:', err);
                      earned = false;
                    } else {
                      earned = result && result.count >= badge.criteria_value;
                    }
                    processBadgeResult();
                  });
                break;
              
              case 'streak':
                const streakQuery = `
                  SELECT completed_date FROM konfi_activities 
                  WHERE konfi_id = ? 
                  ORDER BY completed_date DESC
                `;
                db.all(streakQuery, [konfiId], (err, results) => {
                  if (err) {
                    console.error('Streak badge check error:', err);
                    earned = false;
                  } else {
                    // Hilfsfunktion: Kalenderwoche berechnen
                    function getYearWeek(date) {
                      const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
                      const dayNum = d.getUTCDay() || 7;
                      d.setUTCDate(d.getUTCDate() + 4 - dayNum);
                      const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
                      const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
                      return `${d.getUTCFullYear()}-W${weekNo.toString().padStart(2, '0')}`;
                    }
                    
                    // Aktivitätsdaten in Set einzigartiger Wochen umwandeln
                    const activityWeeks = new Set(
                      results
                      .map(r => getYearWeek(new Date(r.completed_date)))
                      .filter(week => week && !week.includes('NaN'))
                    );
                    
                    // Sortiere Wochen chronologisch (neueste zuerst)
                    const sortedWeeks = Array.from(activityWeeks).sort().reverse();
                    
                    let currentStreak = 0;
                    
                    // Finde den längsten Streak vom neuesten Datum aus
                    if (sortedWeeks.length > 0) {
                      currentStreak = 1; // Erste Woche zählt immer
                      
                      // Prüfe aufeinanderfolgende Wochen rückwärts
                      for (let i = 0; i < sortedWeeks.length - 1; i++) {
                        const thisWeek = sortedWeeks[i];
                        const nextWeek = sortedWeeks[i + 1];
                        
                        // Berechne die erwartete vorherige Woche
                        const [year, week] = thisWeek.split('-W').map(Number);
                        let expectedYear = year;
                        let expectedWeek = week - 1;
                        
                        if (expectedWeek === 0) {
                          expectedYear -= 1;
                          expectedWeek = 52; // Vereinfacht, könnte 53 sein
                        }
                        
                        const expectedWeekStr = `${expectedYear}-W${expectedWeek.toString().padStart(2, '0')}`;
                        
                        if (nextWeek === expectedWeekStr) {
                          currentStreak++;
                        } else {
                          break; // Streak unterbrochen
                        }
                      }
                    }
                    
                    earned = currentStreak >= badge.criteria_value;
                  }
                  processBadgeResult();
                });
                break;
              
              case 'unique_activities':
                db.all("SELECT DISTINCT activity_id FROM konfi_activities WHERE konfi_id = ?", 
                  [konfiId], (err, results) => {
                    if (err) {
                      console.error('Unique activities badge check error:', err);
                      earned = false;
                    } else {
                      earned = results.length >= badge.criteria_value;
                    }
                    processBadgeResult();
                  });
                break;
              
              default:
                processBadgeResult();
                break;
            }
            
            function processBadgeResult() {
              if (earned) {
                earnedBadgeIds.push(badge.id);
                newBadges++;
              }
              badgesProcessed++;
              if (badgesProcessed === badges.length) {
                finalizeBadges();
              }
            }
          });
          
          function finalizeBadges() {
            // Award new badges
            if (earnedBadgeIds.length > 0) {
              const insertPromises = earnedBadgeIds.map(badgeId => {
                return new Promise((resolve, reject) => {
                  db.run("INSERT INTO konfi_badges (konfi_id, badge_id) VALUES (?, ?)", 
                    [konfiId, badgeId], function(err) {
                      if (err) reject(err);
                      else resolve();
                    });
                });
              });
              
              Promise.all(insertPromises)
              .then(() => resolve(newBadges))
              .catch(reject);
            } else {
              resolve(newBadges);
            }
          }
        });
      });
    });
  });
};

// Route für Admin-Verwaltung von Badges
module.exports = (db, rbacVerifier, checkPermission) => {
  
  router.get('/criteria-types', rbacVerifier, (req, res) => {
    res.json(CRITERIA_TYPES);
  });
  
  // GET all badges for admin management view
  router.get('/', rbacVerifier, checkPermission('admin.badges.view'), (req, res) => {
    
    const badgeQuery = `
      SELECT cb.*, 
              u.display_name as created_by_name,
              COALESCE(badge_counts.earned_count, 0) as earned_count
      FROM custom_badges cb 
      LEFT JOIN users u ON cb.created_by = u.id
      LEFT JOIN (
        SELECT badge_id, COUNT(*) as earned_count 
        FROM konfi_badges 
        GROUP BY badge_id
      ) badge_counts ON cb.id = badge_counts.badge_id
      WHERE cb.organization_id = ?
      ORDER BY cb.created_at DESC
    `;
    
    db.all(badgeQuery, [req.user.organization_id], (err, rows) => {
      if (err) {
        console.error('Error fetching badges for admin:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(rows);
    });
  });

  // POST a new badge
  router.post('/', rbacVerifier, checkPermission('admin.badges.create'), (req, res) => {
    const { name, icon, description, criteria_type, criteria_value, criteria_extra, is_hidden } = req.body;
    
    if (!name || !icon || !criteria_type || (criteria_value === null || criteria_value === undefined)) {
      return res.status(400).json({ error: 'Name, icon, criteria type and value are required' });
    }
    
    const extraJson = criteria_extra ? JSON.stringify(criteria_extra) : null;
    const hiddenFlag = is_hidden ? 1 : 0;
    
    db.run(`INSERT INTO custom_badges 
              (name, icon, description, criteria_type, criteria_value, criteria_extra, is_hidden, created_by, organization_id) 
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [name, icon, description, criteria_type, criteria_value, extraJson, hiddenFlag, req.user.id, req.user.organization_id],
      function(err) {
        if (err) {
            console.error('Error creating badge:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.status(201).json({ id: this.lastID, message: 'Badge created successfully' });
      });
  });

  // PUT (update) a badge by ID
  router.put('/:id', rbacVerifier, checkPermission('admin.badges.edit'), (req, res) => {
    const { name, icon, description, criteria_type, criteria_value, criteria_extra, is_active, is_hidden } = req.body;
    
    const extraJson = criteria_extra ? JSON.stringify(criteria_extra) : null;
    const activeFlag = is_active ? 1 : 0;
    const hiddenFlag = is_hidden ? 1 : 0;
    
    db.run(`UPDATE custom_badges 
              SET name = ?, icon = ?, description = ?, criteria_type = ?, criteria_value = ?, criteria_extra = ?, is_active = ?, is_hidden = ? 
              WHERE id = ? AND organization_id = ?`,
      [name, icon, description, criteria_type, criteria_value, extraJson, activeFlag, hiddenFlag, req.params.id, req.user.organization_id],
      function(err) {
        if (err) {
            console.error('Error updating badge:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        if (this.changes === 0) {
            return res.status(404).json({ error: 'Badge not found or you do not have permission to edit it.' });
        }
        res.json({ message: 'Badge updated successfully' });
      });
  });

  // DELETE a badge by ID
  router.delete('/:id', rbacVerifier, checkPermission('admin.badges.delete'), (req, res) => {
    db.serialize(() => {
        db.run("BEGIN TRANSACTION");
        db.run("DELETE FROM konfi_badges WHERE badge_id = ?", [req.params.id]);
        db.run("DELETE FROM custom_badges WHERE id = ? AND organization_id = ?", [req.params.id, req.user.organization_id], function(err) {
            if (err) {
                db.run("ROLLBACK");
                console.error('Error deleting badge:', err);
                return res.status(500).json({ error: 'Database error' });
            }
            if (this.changes === 0) {
                db.run("ROLLBACK");
                return res.status(404).json({ error: 'Badge not found or you do not have permission to delete it.' });
            }
            db.run("COMMIT", (err) => {
                if (err) {
                    db.run("ROLLBACK");
                    return res.status(500).json({ error: 'Database error on commit' });
                }
                res.json({ message: 'Badge deleted successfully' });
            });
        });
    });
  });

  // Export the checkAndAwardBadges function
  router.checkAndAwardBadges = checkAndAwardBadges;
  
  return router;
};