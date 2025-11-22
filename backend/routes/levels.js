const express = require('express');
const router = express.Router();
const db = require('../database');
const { verifyTokenRBAC } = require('../middleware/rbac');

// GET /api/levels - Alle Level für Organisation laden
router.get('/', verifyTokenRBAC, async (req, res) => {
  console.log('📊 GET /api/levels - Request received');
  console.log('👤 User:', req.user);
  try {
    const organizationId = req.user.organization_id;
    console.log('🏢 Organization ID:', organizationId);

    console.log('🔍 Executing DB query...');
    const result = await db.query(`
      SELECT * FROM levels
      WHERE organization_id = $1
      ORDER BY points_required ASC
    `, [organizationId]);
    console.log('✅ Query result:', result.rows.length, 'levels found');

    res.json(result.rows);
  } catch (error) {
    console.error('❌ Fehler beim Laden der Level:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Level' });
  }
});

// POST /api/levels - Neues Level erstellen (nur Admins)
router.post('/', verifyTokenRBAC, async (req, res) => {
  try {
    // Permission Check
    const hasPermission = await db.query(`
      SELECT 1 FROM user_permissions up
      JOIN permissions p ON up.permission_id = p.id
      WHERE up.user_id = $1 AND p.name = 'manage_levels'
    `, [req.user.id]);
    
    if (hasPermission.rows.length === 0) {
      return res.status(403).json({ error: 'Keine Berechtigung zum Verwalten von Leveln' });
    }

    const { name, title, description, points_required, icon, color, reward_type, reward_value } = req.body;
    const organizationId = req.user.organization_id;

    // Validierung
    if (!name || !title || points_required === undefined) {
      return res.status(400).json({ error: 'Name, Titel und Punkte sind erforderlich' });
    }

    if (points_required < 0) {
      return res.status(400).json({ error: 'Punkte müssen positiv sein' });
    }

    // Prüfe ob bereits ein Level mit dieser Punktzahl existiert
    const existingLevel = await db.query(`
      SELECT id FROM levels 
      WHERE organization_id = $1 AND points_required = $2
    `, [organizationId, points_required]);

    if (existingLevel.rows.length > 0) {
      return res.status(400).json({ error: 'Ein Level mit dieser Punktzahl existiert bereits' });
    }

    const result = await db.query(`
      INSERT INTO levels (organization_id, name, title, description, points_required, icon, color, reward_type, reward_value, created_by)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [organizationId, name, title, description, points_required, icon || '🏆', color || '#3880ff', reward_type, reward_value, req.user.id]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Fehler beim Erstellen des Levels:', error);
    if (error.code === '23505') { // Unique constraint violation
      res.status(400).json({ error: 'Ein Level mit diesem Namen existiert bereits' });
    } else {
      res.status(500).json({ error: 'Fehler beim Erstellen des Levels' });
    }
  }
});

// PUT /api/levels/:id - Level bearbeiten
router.put('/:id', verifyTokenRBAC, async (req, res) => {
  try {
    // Permission Check
    const hasPermission = await db.query(`
      SELECT 1 FROM user_permissions up
      JOIN permissions p ON up.permission_id = p.id
      WHERE up.user_id = $1 AND p.name = 'manage_levels'
    `, [req.user.id]);
    
    if (hasPermission.rows.length === 0) {
      return res.status(403).json({ error: 'Keine Berechtigung zum Verwalten von Leveln' });
    }

    const levelId = parseInt(req.params.id);
    const { name, title, description, points_required, icon, color, reward_type, reward_value, is_active } = req.body;
    const organizationId = req.user.organization_id;

    // Validierung
    if (!name || !title || points_required === undefined) {
      return res.status(400).json({ error: 'Name, Titel und Punkte sind erforderlich' });
    }

    if (points_required < 0) {
      return res.status(400).json({ error: 'Punkte müssen positiv sein' });
    }

    // Prüfe ob Level in dieser Organisation existiert
    const existingLevel = await db.query(`
      SELECT id FROM levels 
      WHERE id = $1 AND organization_id = $2
    `, [levelId, organizationId]);

    if (existingLevel.rows.length === 0) {
      return res.status(404).json({ error: 'Level nicht gefunden' });
    }

    // Prüfe ob bereits ein anderes Level mit dieser Punktzahl existiert
    const duplicateLevel = await db.query(`
      SELECT id FROM levels 
      WHERE organization_id = $1 AND points_required = $2 AND id != $3
    `, [organizationId, points_required, levelId]);

    if (duplicateLevel.rows.length > 0) {
      return res.status(400).json({ error: 'Ein anderes Level mit dieser Punktzahl existiert bereits' });
    }

    const result = await db.query(`
      UPDATE levels 
      SET name = $1, title = $2, description = $3, points_required = $4, 
          icon = $5, color = $6, reward_type = $7, reward_value = $8, is_active = $9,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $10 AND organization_id = $11
      RETURNING *
    `, [name, title, description, points_required, icon, color, reward_type, reward_value, is_active, levelId, organizationId]);

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Fehler beim Bearbeiten des Levels:', error);
    if (error.code === '23505') { // Unique constraint violation
      res.status(400).json({ error: 'Ein Level mit diesem Namen existiert bereits' });
    } else {
      res.status(500).json({ error: 'Fehler beim Bearbeiten des Levels' });
    }
  }
});

// DELETE /api/levels/:id - Level löschen
router.delete('/:id', verifyTokenRBAC, async (req, res) => {
  try {
    // Permission Check
    const hasPermission = await db.query(`
      SELECT 1 FROM user_permissions up
      JOIN permissions p ON up.permission_id = p.id
      WHERE up.user_id = $1 AND p.name = 'manage_levels'
    `, [req.user.id]);
    
    if (hasPermission.rows.length === 0) {
      return res.status(403).json({ error: 'Keine Berechtigung zum Verwalten von Leveln' });
    }

    const levelId = parseInt(req.params.id);
    const organizationId = req.user.organization_id;

    // Prüfe ob Level in dieser Organisation existiert
    const existingLevel = await db.query(`
      SELECT id FROM levels 
      WHERE id = $1 AND organization_id = $2
    `, [levelId, organizationId]);

    if (existingLevel.rows.length === 0) {
      return res.status(404).json({ error: 'Level nicht gefunden' });
    }

    // Prüfe ob Level verwendet wird (Konfis haben dieses Level erreicht)
    const levelUsage = await db.query(`
      SELECT COUNT(*) as count FROM konfi_profiles kp
      JOIN users u ON kp.user_id = u.id
      WHERE u.organization_id = $1 AND kp.current_level_id = $2
    `, [organizationId, levelId]);

    if (parseInt(levelUsage.rows[0].count) > 0) {
      return res.status(400).json({ 
        error: 'Level kann nicht gelöscht werden, da es von Konfis verwendet wird',
        usage_count: parseInt(levelUsage.rows[0].count)
      });
    }

    await db.query(`
      DELETE FROM levels 
      WHERE id = $1 AND organization_id = $2
    `, [levelId, organizationId]);

    res.json({ message: 'Level erfolgreich gelöscht' });
  } catch (error) {
    console.error('Fehler beim Löschen des Levels:', error);
    res.status(500).json({ error: 'Fehler beim Löschen des Levels' });
  }
});

// GET /api/levels/konfi/:userId - Level-Info für bestimmten Konfi
router.get('/konfi/:userId', verifyTokenRBAC, async (req, res) => {
  try {
    const userId = parseInt(req.params.userId);
    const organizationId = req.user.organization_id;

    // Hole Konfi-Infos mit aktuellen Punkten
    const konfiResult = await db.query(`
      SELECT 
        u.id, 
        u.display_name,
        kp.gottesdienst_points,
        kp.gemeinde_points,
        (kp.gottesdienst_points + kp.gemeinde_points) as total_points,
        kp.current_level_id,
        cl.name as current_level_name,
        cl.title as current_level_title,
        cl.icon as current_level_icon,
        cl.color as current_level_color
      FROM users u
      JOIN konfi_profiles kp ON u.id = kp.user_id
      LEFT JOIN levels cl ON kp.current_level_id = cl.id
      WHERE u.id = $1 AND u.organization_id = $2
    `, [userId, organizationId]);

    if (konfiResult.rows.length === 0) {
      return res.status(404).json({ error: 'Konfi nicht gefunden' });
    }

    const konfi = konfiResult.rows[0];
    const totalPoints = konfi.total_points || 0;

    // Hole alle Level für die Organisation
    const levelsResult = await db.query(`
      SELECT * FROM levels 
      WHERE organization_id = $1 AND is_active = true
      ORDER BY points_required ASC
    `, [organizationId]);

    const levels = levelsResult.rows;

    // Bestimme aktuelles und nächstes Level
    let currentLevel = null;
    let nextLevel = null;
    let progress = 0;

    for (let i = 0; i < levels.length; i++) {
      if (totalPoints >= levels[i].points_required) {
        currentLevel = levels[i];
        nextLevel = levels[i + 1] || null;
      } else {
        if (!currentLevel) {
          // Noch kein Level erreicht
          nextLevel = levels[i];
        }
        break;
      }
    }

    // Berechne Progress zum nächsten Level
    if (nextLevel) {
      const currentLevelPoints = currentLevel ? currentLevel.points_required : 0;
      const pointsNeeded = nextLevel.points_required - currentLevelPoints;
      const pointsAchieved = totalPoints - currentLevelPoints;
      progress = Math.max(0, Math.min(100, (pointsAchieved / pointsNeeded) * 100));
    } else {
      progress = 100; // Alle Level erreicht
    }

    res.json({
      konfi_id: konfi.id,
      display_name: konfi.display_name,
      total_points: totalPoints,
      current_level: currentLevel,
      next_level: nextLevel,
      progress_percentage: Math.round(progress),
      points_to_next_level: nextLevel ? (nextLevel.points_required - totalPoints) : 0,
      all_levels: levels
    });
  } catch (error) {
    console.error('Fehler beim Laden der Konfi-Level-Info:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Level-Informationen' });
  }
});

module.exports = router;