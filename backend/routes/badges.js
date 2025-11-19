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
    help: "Badge wird vergeben, wenn die angegebene Anzahl von Aktivitäten aus einer bestimmten Kategorie absolviert wurde. Beispiel: Wert 3 + Kategorie 'Kasualien' = 3 Kasualien besucht."
  },
  activity_combination: {
    label: "🎭 Aktivitäts-Kombination",
    description: "Spezifische Kombination von Aktivitäten",
    help: "Badge wird vergeben, wenn alle ausgewählten Aktivitäten mindestens einmal absolviert wurden. Der Wert gibt die Mindestanzahl an benötigten Aktivitäten aus der Liste an. Beispiel: 'Adventskalender' - alle 24 Türchen besucht."
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
  try {
    // First get konfi's organization
    const konfiQuery = `
      SELECT kp.*, u.display_name as name, u.organization_id
      FROM konfi_profiles kp
      JOIN users u ON kp.user_id = u.id
      WHERE kp.user_id = $1
    `;
    const { rows: [konfi] } = await db.query(konfiQuery, [konfiId]);
    if (!konfi) return 0;

    // Get badges for this organization only
    const { rows: badges } = await db.query(
      "SELECT * FROM custom_badges WHERE is_active = true AND organization_id = $1", 
      [konfi.organization_id]
    );
    if (badges.length === 0) return 0;
    
    const { rows: earned } = await db.query("SELECT badge_id FROM konfi_badges WHERE konfi_id = $1 AND organization_id = $2", [konfiId, konfi.organization_id]);
    const alreadyEarned = earned.map(e => e.badge_id);
    
    let newBadges = 0;
    const earnedBadgeIds = [];
    const earnedBadgeDetails = [];
    
    for (const badge of badges) {
      if (alreadyEarned.includes(badge.id)) continue;
      
      let earned = false;
      const criteria = JSON.parse(badge.criteria_extra || '{}');
      
      switch (badge.criteria_type) {
        case 'total_points':
          earned = (konfi.gottesdienst_points + konfi.gemeinde_points) >= badge.criteria_value;
          break;
        case 'gottesdienst_points':
          earned = konfi.gottesdienst_points >= badge.criteria_value;
          break;
        case 'gemeinde_points':
          earned = konfi.gemeinde_points >= badge.criteria_value;
          break;
        case 'both_categories':
          earned = konfi.gottesdienst_points >= badge.criteria_value && konfi.gemeinde_points >= badge.criteria_value;
          break;
        
        case 'specific_activity':
          if (criteria.required_activity_name) {
            const { rows: [result] } = await db.query(`SELECT COUNT(*) as count FROM konfi_activities ka JOIN activities a ON ka.activity_id = a.id WHERE ka.konfi_id = $1 AND a.name = $2 AND a.organization_id = $3`, [konfiId, criteria.required_activity_name, konfi.organization_id]);
            earned = result && parseInt(result.count) >= badge.criteria_value;
          }
          break;
        
        case 'activity_combination':
          if (criteria.required_activities) {
            const { rows: results } = await db.query(`SELECT DISTINCT a.name FROM konfi_activities ka JOIN activities a ON ka.activity_id = a.id WHERE ka.konfi_id = $1 AND a.organization_id = $2`, [konfiId, konfi.organization_id]);
            const completedActivities = results.map(r => r.name);
            earned = criteria.required_activities.every(req => completedActivities.includes(req));
          }
          break;
        
        case 'category_activities':
          if (criteria.required_category) {
            const categoryCountQuery = `
              SELECT COUNT(*) as count FROM konfi_activities ka 
              JOIN activities a ON ka.activity_id = a.id 
              JOIN activity_categories ac ON a.id = ac.activity_id
              JOIN categories c ON ac.category_id = c.id
              WHERE ka.konfi_id = $1 AND c.name = $2 AND a.organization_id = $3 AND c.organization_id = $3
            `;
            const { rows: [result] } = await db.query(categoryCountQuery, [konfiId, criteria.required_category, konfi.organization_id]);
            earned = result && parseInt(result.count) >= badge.criteria_value;
          }
          break;
        
        case 'time_based':
          if (criteria.days) {
            const { rows: results } = await db.query(`SELECT completed_date FROM konfi_activities WHERE konfi_id = $1 ORDER BY completed_date DESC`, [konfiId]);
            const now = new Date();
            const cutoff = new Date(now.getTime() - (criteria.days * 24 * 60 * 60 * 1000));
            const recentCount = results.filter(r => new Date(r.completed_date) >= cutoff).length;
            earned = recentCount >= badge.criteria_value;
          }
          break;
        
        case 'activity_count':
          const { rows: [activityCountResult] } = await db.query("SELECT COUNT(*) as count FROM konfi_activities WHERE konfi_id = $1", [konfiId]);
          earned = activityCountResult && parseInt(activityCountResult.count) >= badge.criteria_value;
          break;
        
        case 'bonus_points':
          const { rows: [bonusResult] } = await db.query("SELECT COUNT(*) as count FROM bonus_points WHERE konfi_id = $1", [konfiId]);
          earned = bonusResult && parseInt(bonusResult.count) >= badge.criteria_value;
          break;
        
        case 'unique_activities':
          const { rows: uniqueResults } = await db.query("SELECT DISTINCT activity_id FROM konfi_activities WHERE konfi_id = $1", [konfiId]);
          earned = uniqueResults.length >= badge.criteria_value;
          break;
        
        case 'streak':
          const { rows: streakResults } = await db.query(`SELECT completed_date FROM konfi_activities WHERE konfi_id = $1 ORDER BY completed_date DESC`, [konfiId]);
          
          function getYearWeek(date) {
            const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
            const dayNum = d.getUTCDay() || 7;
            d.setUTCDate(d.getUTCDate() + 4 - dayNum);
            const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
            const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
            return `${d.getUTCFullYear()}-W${weekNo.toString().padStart(2, '0')}`;
          }
          
          const activityWeeks = new Set(streakResults.map(r => getYearWeek(new Date(r.completed_date))).filter(week => week && !week.includes('NaN')));
          const sortedWeeks = Array.from(activityWeeks).sort().reverse();
          
          let currentStreak = 0;
          if (sortedWeeks.length > 0) {
            currentStreak = 1;
            for (let i = 0; i < sortedWeeks.length - 1; i++) {
              const thisWeek = sortedWeeks[i];
              const nextWeek = sortedWeeks[i + 1];
              const [year, week] = thisWeek.split('-W').map(Number);
              let expectedYear = year;
              let expectedWeek = week - 1;
              if (expectedWeek === 0) {
                expectedYear -= 1;
                expectedWeek = 52;
              }
              const expectedWeekStr = `${expectedYear}-W${expectedWeek.toString().padStart(2, '0')}`;
              if (nextWeek === expectedWeekStr) {
                currentStreak++;
              } else {
                break;
              }
            }
          }
          earned = currentStreak >= badge.criteria_value;
          break;
      }
      
      if (earned) {
        earnedBadgeIds.push(badge.id);
        earnedBadgeDetails.push({
          id: badge.id,
          name: badge.name,
          icon: badge.icon,
          description: badge.description
        });
        newBadges++;
      }
    }
    
    if (earnedBadgeIds.length > 0) {
      const insertPromises = earnedBadgeIds.map(badgeId => 
        db.query("INSERT INTO konfi_badges (konfi_id, badge_id, organization_id) VALUES ($1, $2, $3)", [konfiId, badgeId, konfi.organization_id])
      );
      await Promise.all(insertPromises);

      // Send push notifications for new badges
      try {
        for (const badge of earnedBadgeDetails) {
          await db.query(
            "INSERT INTO notifications (user_id, title, message, type, data, organization_id) VALUES ($1, $2, $3, $4, $5, $6)",
            [
              konfiId,
              `Neues Badge erhalten! ${badge.icon}`,
              `Herzlichen Glückwunsch! Du hast das Badge "${badge.name}" erhalten: ${badge.description}`,
              'badge_earned',
              JSON.stringify({
                badge_id: badge.id,
                badge_name: badge.name,
                badge_icon: badge.icon,
                badge_description: badge.description
              }),
              konfi.organization_id
            ]
          );
        }
        console.log(`🎉 ${earnedBadgeDetails.length} Badge-Notification(s) für Konfi ${konfi.name} gesendet`);
      } catch (notifErr) {
        console.error('Error sending badge notifications:', notifErr);
        // Don't fail the badge award if notification fails
      }
    }
    
    return { count: newBadges, badges: earnedBadgeDetails };
  } catch (err) {
    console.error('Error in checkAndAwardBadges:', err);
    throw err; // Re-throw the error to be handled by the caller
  }
};


module.exports = (db, rbacVerifier, checkPermission) => {
  
  router.get('/criteria-types', rbacVerifier, (req, res) => {
    res.json(CRITERIA_TYPES);
  });
  
  router.get('/', rbacVerifier, checkPermission('admin.badges.view'), async (req, res) => {
    try {
      const badgeQuery = `
        SELECT cb.*,
                u.display_name as created_by_name,
                COALESCE(badge_counts.earned_count, 0)::int as earned_count
        FROM custom_badges cb
        LEFT JOIN users u ON cb.created_by = u.id
        LEFT JOIN (
          SELECT badge_id, COUNT(*) as earned_count
          FROM konfi_badges
          GROUP BY badge_id
        ) badge_counts ON cb.id = badge_counts.badge_id
        WHERE cb.organization_id = $1
        ORDER BY cb.created_at DESC
      `;
      const { rows } = await db.query(badgeQuery, [req.user.organization_id]);
      res.json(rows);
    } catch (err) {
      console.error('Database error in GET /api/badges:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  router.get('/:id', rbacVerifier, checkPermission('admin.badges.view'), async (req, res) => {
    try {
      const badgeQuery = `
        SELECT cb.*,
                u.display_name as created_by_name,
                COALESCE(badge_counts.earned_count, 0)::int as earned_count
        FROM custom_badges cb
        LEFT JOIN users u ON cb.created_by = u.id
        LEFT JOIN (
          SELECT badge_id, COUNT(*) as earned_count
          FROM konfi_badges
          GROUP BY badge_id
        ) badge_counts ON cb.id = badge_counts.badge_id
        WHERE cb.id = $1 AND cb.organization_id = $2
      `;
      const { rows: [badge] } = await db.query(badgeQuery, [req.params.id, req.user.organization_id]);

      if (!badge) {
        return res.status(404).json({ error: 'Badge not found' });
      }

      res.json(badge);
    } catch (err) {
      console.error('Database error in GET /api/badges/:id:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });
  
  router.post('/', rbacVerifier, checkPermission('admin.badges.create'), async (req, res) => {
    const { name, icon, description, criteria_type, criteria_value, criteria_extra, is_hidden, color } = req.body;
    
    if (!name || !icon || !criteria_type || (criteria_value === null || criteria_value === undefined)) {
      return res.status(400).json({ error: 'Name, icon, criteria type and value are required' });
    }
    
    try {
      const extraJson = criteria_extra ? JSON.stringify(criteria_extra) : null;
      const hiddenFlag = !!is_hidden;
      
      const query = `INSERT INTO custom_badges 
                    (name, icon, description, criteria_type, criteria_value, criteria_extra, is_hidden, color, created_by, organization_id) 
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                    RETURNING id`;
      
      const params = [name, icon, description, criteria_type, criteria_value, extraJson, hiddenFlag, color || '#667eea', req.user.id, req.user.organization_id];
      const { rows: [newBadge] } = await db.query(query, params);
      
      res.status(201).json({ id: newBadge.id, message: 'Badge created successfully' });
    } catch (err) {
      console.error('Database error in POST /api/badges:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });
  
  router.put('/:id', rbacVerifier, checkPermission('admin.badges.edit'), async (req, res) => {
    const { name, icon, description, criteria_type, criteria_value, criteria_extra, is_active, is_hidden, color } = req.body;
    
    try {
      const extraJson = criteria_extra ? JSON.stringify(criteria_extra) : null;
      const activeFlag = !!is_active;
      const hiddenFlag = !!is_hidden;
      
      const query = `UPDATE custom_badges 
                    SET name = $1, icon = $2, description = $3, criteria_type = $4, criteria_value = $5, criteria_extra = $6, is_active = $7, is_hidden = $8, color = $9 
                    WHERE id = $10 AND organization_id = $11`;
      
      const params = [name, icon, description, criteria_type, criteria_value, extraJson, activeFlag, hiddenFlag, color || '#667eea', req.params.id, req.user.organization_id];
      const { rowCount } = await db.query(query, params);
      
      if (rowCount === 0) {
        return res.status(404).json({ error: 'Badge not found or you do not have permission to edit it.' });
      }
      res.json({ message: 'Badge updated successfully' });
    } catch (err) {
      console.error(`Database error in PUT /api/badges/${req.params.id}:`, err);
      res.status(500).json({ error: 'Database error' });
    }
  });
  
  router.delete('/:id', rbacVerifier, checkPermission('admin.badges.delete'), async (req, res) => {
    try {
      await db.query('BEGIN');
      
      await db.query("DELETE FROM konfi_badges WHERE badge_id = $1", [req.params.id]);
      
      const { rowCount } = await db.query("DELETE FROM custom_badges WHERE id = $1 AND organization_id = $2", [req.params.id, req.user.organization_id]);
      
      if (rowCount === 0) {
        await db.query('ROLLBACK');
        return res.status(404).json({ error: 'Badge not found or you do not have permission to delete it.' });
      }
      
      await db.query('COMMIT');
      res.json({ message: 'Badge deleted successfully' });
    } catch (err) {
      // Attempt to rollback transaction on error
      try {
        await db.query('ROLLBACK');
      } catch (rollbackErr) {
        console.error('Failed to rollback transaction:', rollbackErr);
      }
      console.error(`Database error in DELETE /api/badges/${req.params.id}:`, err);
      res.status(500).json({ error: 'Database error' });
    }
  });
  
  router.checkAndAwardBadges = checkAndAwardBadges;
  
  return router;
};