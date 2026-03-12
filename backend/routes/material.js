const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

module.exports = (db, rbacVerifier, roleHelpers, materialUpload) => {
  const { requireTeamer, requireOrgAdmin } = roleHelpers;

  // ====================================================================
  // IDEMPOTENTE MIGRATION: material_tags, materials, material_file_tags, material_files
  // ====================================================================
  const runMaterialMigration = async () => {
    try {
      // material_tags Tabelle
      await db.query(`
        CREATE TABLE IF NOT EXISTS material_tags (
          id SERIAL PRIMARY KEY,
          name VARCHAR(100) NOT NULL,
          organization_id INTEGER REFERENCES organizations(id),
          created_at TIMESTAMP DEFAULT NOW(),
          UNIQUE(organization_id, name)
        )
      `);

      // materials Tabelle
      await db.query(`
        CREATE TABLE IF NOT EXISTS materials (
          id SERIAL PRIMARY KEY,
          title VARCHAR(200) NOT NULL,
          description TEXT,
          event_id INTEGER REFERENCES events(id) ON DELETE SET NULL,
          jahrgang_id INTEGER REFERENCES jahrgaenge(id) ON DELETE SET NULL,
          organization_id INTEGER REFERENCES organizations(id),
          created_by INTEGER REFERENCES users(id),
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);

      // material_file_tags (Join-Tabelle Material <-> Tags)
      await db.query(`
        CREATE TABLE IF NOT EXISTS material_file_tags (
          material_id INTEGER REFERENCES materials(id) ON DELETE CASCADE,
          tag_id INTEGER REFERENCES material_tags(id) ON DELETE CASCADE,
          PRIMARY KEY(material_id, tag_id)
        )
      `);

      // material_files Tabelle
      await db.query(`
        CREATE TABLE IF NOT EXISTS material_files (
          id SERIAL PRIMARY KEY,
          material_id INTEGER REFERENCES materials(id) ON DELETE CASCADE,
          original_name VARCHAR(500) NOT NULL,
          stored_name VARCHAR(100) NOT NULL,
          mime_type VARCHAR(100),
          file_size INTEGER,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `);

      console.log('Material migration: OK');
    } catch (err) {
      console.error('Material migration error:', err.message);
    }
  };

  // Migration beim Laden ausfuehren
  runMaterialMigration();

  // ====================================================================
  // TAG ENDPOINTS (Lesen: requireTeamer, CRUD: requireOrgAdmin)
  // ====================================================================

  // GET /tags - Tags der eigenen Organisation laden
  router.get('/tags', rbacVerifier, requireTeamer, async (req, res) => {
    try {
      const { rows } = await db.query(
        'SELECT id, name, created_at FROM material_tags WHERE organization_id = $1 ORDER BY name',
        [req.user.organization_id]
      );
      res.json(rows);
    } catch (err) {
      console.error('Fehler beim Laden der Tags:', err.message);
      res.status(500).json({ error: 'Fehler beim Laden der Tags' });
    }
  });

  // POST /tags - Neuen Tag erstellen
  router.post('/tags', rbacVerifier, requireOrgAdmin, async (req, res) => {
    try {
      const { name } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Tag-Name ist erforderlich' });
      }

      const { rows: [tag] } = await db.query(
        'INSERT INTO material_tags (name, organization_id) VALUES ($1, $2) RETURNING id, name, created_at',
        [name.trim(), req.user.organization_id]
      );
      res.status(201).json(tag);
    } catch (err) {
      if (err.code === '23505') {
        return res.status(409).json({ error: 'Ein Tag mit diesem Namen existiert bereits' });
      }
      console.error('Fehler beim Erstellen des Tags:', err.message);
      res.status(500).json({ error: 'Fehler beim Erstellen des Tags' });
    }
  });

  // PUT /tags/:id - Tag umbenennen
  router.put('/tags/:id', rbacVerifier, requireOrgAdmin, async (req, res) => {
    try {
      const { name } = req.body;
      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Tag-Name ist erforderlich' });
      }

      const { rows: [tag] } = await db.query(
        'UPDATE material_tags SET name = $1 WHERE id = $2 AND organization_id = $3 RETURNING id, name',
        [name.trim(), req.params.id, req.user.organization_id]
      );

      if (!tag) {
        return res.status(404).json({ error: 'Tag nicht gefunden' });
      }
      res.json(tag);
    } catch (err) {
      if (err.code === '23505') {
        return res.status(409).json({ error: 'Ein Tag mit diesem Namen existiert bereits' });
      }
      console.error('Fehler beim Umbenennen des Tags:', err.message);
      res.status(500).json({ error: 'Fehler beim Umbenennen des Tags' });
    }
  });

  // DELETE /tags/:id - Tag loeschen (CASCADE loescht Zuordnungen)
  router.delete('/tags/:id', rbacVerifier, requireOrgAdmin, async (req, res) => {
    try {
      const { rowCount } = await db.query(
        'DELETE FROM material_tags WHERE id = $1 AND organization_id = $2',
        [req.params.id, req.user.organization_id]
      );

      if (rowCount === 0) {
        return res.status(404).json({ error: 'Tag nicht gefunden' });
      }
      res.json({ message: 'Tag geloescht' });
    } catch (err) {
      console.error('Fehler beim Loeschen des Tags:', err.message);
      res.status(500).json({ error: 'Fehler beim Loeschen des Tags' });
    }
  });

  // ====================================================================
  // MATERIAL ENDPOINTS
  // ====================================================================

  // GET / - Alle Materialien der Organisation laden
  router.get('/', rbacVerifier, requireTeamer, async (req, res) => {
    try {
      const orgId = req.user.organization_id;
      const { tag_id, search, event_id, jahrgang_id } = req.query;

      let query = `
        SELECT m.id, m.title, m.description, m.event_id, e.name as event_name,
               m.jahrgang_id, j.name as jahrgang_name,
               m.created_at, u.display_name as created_by_name,
               (SELECT COUNT(*) FROM material_files mf WHERE mf.material_id = m.id) as file_count
        FROM materials m
        LEFT JOIN events e ON m.event_id = e.id
        LEFT JOIN jahrgaenge j ON m.jahrgang_id = j.id
        LEFT JOIN users u ON m.created_by = u.id
        WHERE m.organization_id = $1
      `;
      const params = [orgId];
      let paramIndex = 2;

      if (tag_id) {
        query += ` AND EXISTS (SELECT 1 FROM material_file_tags mft WHERE mft.material_id = m.id AND mft.tag_id = $${paramIndex})`;
        params.push(tag_id);
        paramIndex++;
      }

      if (search) {
        query += ` AND (m.title ILIKE $${paramIndex} OR m.description ILIKE $${paramIndex})`;
        params.push(`%${search}%`);
        paramIndex++;
      }

      if (event_id) {
        query += ` AND m.event_id = $${paramIndex}`;
        params.push(event_id);
        paramIndex++;
      }

      if (jahrgang_id) {
        query += ` AND m.jahrgang_id = $${paramIndex}`;
        params.push(jahrgang_id);
        paramIndex++;
      }

      query += ' ORDER BY m.created_at DESC';

      const { rows: materials } = await db.query(query, params);

      // Tags fuer alle Materialien laden
      if (materials.length > 0) {
        const materialIds = materials.map(m => m.id);
        const { rows: tags } = await db.query(
          `SELECT mft.material_id, mt.id, mt.name
           FROM material_file_tags mft
           JOIN material_tags mt ON mft.tag_id = mt.id
           WHERE mft.material_id = ANY($1)`,
          [materialIds]
        );

        const tagsByMaterial = {};
        for (const tag of tags) {
          if (!tagsByMaterial[tag.material_id]) tagsByMaterial[tag.material_id] = [];
          tagsByMaterial[tag.material_id].push({ id: tag.id, name: tag.name });
        }

        for (const material of materials) {
          material.tags = tagsByMaterial[material.id] || [];
          material.file_count = parseInt(material.file_count, 10);
        }
      }

      res.json(materials);
    } catch (err) {
      console.error('Fehler beim Laden der Materialien:', err.message);
      res.status(500).json({ error: 'Fehler beim Laden der Materialien' });
    }
  });

  // GET /by-event/:eventId - Material zu einem bestimmten Event
  router.get('/by-event/:eventId', rbacVerifier, requireTeamer, async (req, res) => {
    try {
      const orgId = req.user.organization_id;
      const eventId = req.params.eventId;

      const { rows: materials } = await db.query(
        `SELECT m.id, m.title, m.description, m.created_at,
                u.display_name as created_by_name,
                (SELECT COUNT(*) FROM material_files mf WHERE mf.material_id = m.id) as file_count
         FROM materials m
         LEFT JOIN users u ON m.created_by = u.id
         WHERE m.organization_id = $1 AND m.event_id = $2
         ORDER BY m.created_at DESC`,
        [orgId, eventId]
      );

      for (const material of materials) {
        material.file_count = parseInt(material.file_count, 10);
      }

      res.json(materials);
    } catch (err) {
      console.error('Fehler beim Laden der Event-Materialien:', err.message);
      res.status(500).json({ error: 'Fehler beim Laden der Event-Materialien' });
    }
  });

  // GET /:id - Einzelnes Material mit Dateien und Tags
  router.get('/:id', rbacVerifier, requireTeamer, async (req, res) => {
    try {
      const orgId = req.user.organization_id;

      const { rows: [material] } = await db.query(
        `SELECT m.id, m.title, m.description, m.event_id, e.name as event_name,
                m.jahrgang_id, j.name as jahrgang_name,
                m.created_at, u.display_name as created_by_name
         FROM materials m
         LEFT JOIN events e ON m.event_id = e.id
         LEFT JOIN jahrgaenge j ON m.jahrgang_id = j.id
         LEFT JOIN users u ON m.created_by = u.id
         WHERE m.id = $1 AND m.organization_id = $2`,
        [req.params.id, orgId]
      );

      if (!material) {
        return res.status(404).json({ error: 'Material nicht gefunden' });
      }

      // Tags laden
      const { rows: tags } = await db.query(
        `SELECT mt.id, mt.name
         FROM material_file_tags mft
         JOIN material_tags mt ON mft.tag_id = mt.id
         WHERE mft.material_id = $1`,
        [material.id]
      );
      material.tags = tags;

      // Dateien laden
      const { rows: files } = await db.query(
        `SELECT id, original_name, mime_type, file_size, created_at
         FROM material_files
         WHERE material_id = $1
         ORDER BY created_at`,
        [material.id]
      );
      material.files = files;

      res.json(material);
    } catch (err) {
      console.error('Fehler beim Laden des Materials:', err.message);
      res.status(500).json({ error: 'Fehler beim Laden des Materials' });
    }
  });

  // POST / - Material erstellen
  router.post('/', rbacVerifier, requireOrgAdmin, async (req, res) => {
    try {
      const { title, description, event_id, jahrgang_id, tag_ids } = req.body;

      if (!title || !title.trim()) {
        return res.status(400).json({ error: 'Titel ist erforderlich' });
      }

      const { rows: [material] } = await db.query(
        `INSERT INTO materials (title, description, event_id, jahrgang_id, organization_id, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, title, description, event_id, jahrgang_id, created_at`,
        [title.trim(), description || null, event_id || null, jahrgang_id || null, req.user.organization_id, req.user.id]
      );

      // Tags zuordnen
      if (tag_ids && tag_ids.length > 0) {
        const tagValues = tag_ids.map((tagId, i) => `($1, $${i + 2})`).join(', ');
        const tagParams = [material.id, ...tag_ids];
        await db.query(
          `INSERT INTO material_file_tags (material_id, tag_id) VALUES ${tagValues}`,
          tagParams
        );
      }

      res.status(201).json(material);
    } catch (err) {
      console.error('Fehler beim Erstellen des Materials:', err.message);
      res.status(500).json({ error: 'Fehler beim Erstellen des Materials' });
    }
  });

  // PUT /:id - Material bearbeiten
  router.put('/:id', rbacVerifier, requireOrgAdmin, async (req, res) => {
    try {
      const { title, description, event_id, jahrgang_id, tag_ids } = req.body;
      const orgId = req.user.organization_id;
      const materialId = req.params.id;

      // Pruefen ob Material existiert und zur Organisation gehoert
      const { rows: [existing] } = await db.query(
        'SELECT id FROM materials WHERE id = $1 AND organization_id = $2',
        [materialId, orgId]
      );

      if (!existing) {
        return res.status(404).json({ error: 'Material nicht gefunden' });
      }

      const updates = [];
      const params = [];
      let paramIndex = 1;

      if (title !== undefined) {
        updates.push(`title = $${paramIndex}`);
        params.push(title.trim());
        paramIndex++;
      }
      if (description !== undefined) {
        updates.push(`description = $${paramIndex}`);
        params.push(description);
        paramIndex++;
      }
      if (event_id !== undefined) {
        updates.push(`event_id = $${paramIndex}`);
        params.push(event_id || null);
        paramIndex++;
      }
      if (jahrgang_id !== undefined) {
        updates.push(`jahrgang_id = $${paramIndex}`);
        params.push(jahrgang_id || null);
        paramIndex++;
      }

      if (updates.length > 0) {
        updates.push(`updated_at = NOW()`);
        params.push(materialId);
        await db.query(
          `UPDATE materials SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
          params
        );
      }

      // Tags aktualisieren (DELETE + INSERT)
      if (tag_ids !== undefined) {
        await db.query('DELETE FROM material_file_tags WHERE material_id = $1', [materialId]);
        if (tag_ids.length > 0) {
          const tagValues = tag_ids.map((tagId, i) => `($1, $${i + 2})`).join(', ');
          const tagParams = [materialId, ...tag_ids];
          await db.query(
            `INSERT INTO material_file_tags (material_id, tag_id) VALUES ${tagValues}`,
            tagParams
          );
        }
      }

      res.json({ message: 'Material aktualisiert' });
    } catch (err) {
      console.error('Fehler beim Bearbeiten des Materials:', err.message);
      res.status(500).json({ error: 'Fehler beim Bearbeiten des Materials' });
    }
  });

  // DELETE /:id - Material loeschen
  router.delete('/:id', rbacVerifier, requireOrgAdmin, async (req, res) => {
    try {
      const orgId = req.user.organization_id;
      const materialId = req.params.id;

      // Dateien vom Dateisystem holen bevor CASCADE loescht
      const { rows: files } = await db.query(
        `SELECT mf.stored_name FROM material_files mf
         JOIN materials m ON mf.material_id = m.id
         WHERE mf.material_id = $1 AND m.organization_id = $2`,
        [materialId, orgId]
      );

      const { rowCount } = await db.query(
        'DELETE FROM materials WHERE id = $1 AND organization_id = $2',
        [materialId, orgId]
      );

      if (rowCount === 0) {
        return res.status(404).json({ error: 'Material nicht gefunden' });
      }

      // Dateien vom Dateisystem loeschen
      const materialDir = path.join(__dirname, '..', 'uploads', 'material');
      for (const file of files) {
        try {
          const filePath = path.join(materialDir, file.stored_name);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        } catch (fileErr) {
          console.warn(`Konnte Datei ${file.stored_name} nicht loeschen:`, fileErr.message);
        }
      }

      res.json({ message: 'Material geloescht' });
    } catch (err) {
      console.error('Fehler beim Loeschen des Materials:', err.message);
      res.status(500).json({ error: 'Fehler beim Loeschen des Materials' });
    }
  });

  // ====================================================================
  // DATEI ENDPOINTS
  // ====================================================================

  // POST /:id/files - Dateien zu Material hochladen
  router.post('/:id/files', rbacVerifier, requireOrgAdmin, materialUpload.array('files', 10), async (req, res) => {
    try {
      const orgId = req.user.organization_id;
      const materialId = req.params.id;

      // Pruefen ob Material existiert und zur Organisation gehoert
      const { rows: [material] } = await db.query(
        'SELECT id FROM materials WHERE id = $1 AND organization_id = $2',
        [materialId, orgId]
      );

      if (!material) {
        return res.status(404).json({ error: 'Material nicht gefunden' });
      }

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: 'Keine Dateien hochgeladen' });
      }

      const insertedFiles = [];
      for (const file of req.files) {
        const { rows: [inserted] } = await db.query(
          `INSERT INTO material_files (material_id, original_name, stored_name, mime_type, file_size)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING id, original_name, mime_type, file_size, created_at`,
          [materialId, file.originalname, file.filename, file.mimetype, file.size]
        );
        insertedFiles.push(inserted);
      }

      // updated_at aktualisieren
      await db.query('UPDATE materials SET updated_at = NOW() WHERE id = $1', [materialId]);

      res.status(201).json(insertedFiles);
    } catch (err) {
      console.error('Fehler beim Hochladen der Dateien:', err.message);
      res.status(500).json({ error: 'Fehler beim Hochladen der Dateien' });
    }
  });

  // GET /files/:filename - Datei herunterladen
  router.get('/files/:filename', rbacVerifier, requireTeamer, async (req, res) => {
    try {
      const filename = path.basename(req.params.filename);

      // Path-Traversal-Schutz: Nur Hex-Hashes akzeptieren
      if (!/^[a-f0-9]{32}$/.test(filename)) {
        return res.status(400).json({ error: 'Ungueltiger Dateiname' });
      }

      // Pruefen ob Datei existiert und zur gleichen Organisation gehoert
      const { rows: [fileRecord] } = await db.query(
        `SELECT mf.id, mf.original_name, mf.mime_type, mf.file_size
         FROM material_files mf
         JOIN materials m ON mf.material_id = m.id
         WHERE mf.stored_name = $1 AND m.organization_id = $2`,
        [filename, req.user.organization_id]
      );

      if (!fileRecord) {
        return res.status(404).json({ error: 'Datei nicht gefunden' });
      }

      const materialDir = path.join(__dirname, '..', 'uploads', 'material');
      const filePath = path.join(materialDir, filename);

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Datei nicht auf dem Server gefunden' });
      }

      if (fileRecord.mime_type) {
        res.setHeader('Content-Type', fileRecord.mime_type);
      }
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileRecord.original_name)}"`);
      res.sendFile(filePath);
    } catch (err) {
      console.error('Fehler beim Herunterladen der Datei:', err.message);
      res.status(500).json({ error: 'Fehler beim Herunterladen der Datei' });
    }
  });

  // DELETE /files/:fileId - Einzelne Datei loeschen
  router.delete('/files/:fileId', rbacVerifier, requireOrgAdmin, async (req, res) => {
    try {
      const orgId = req.user.organization_id;
      const fileId = req.params.fileId;

      // Datei-Info holen und Organisation pruefen
      const { rows: [fileRecord] } = await db.query(
        `SELECT mf.id, mf.stored_name, mf.material_id
         FROM material_files mf
         JOIN materials m ON mf.material_id = m.id
         WHERE mf.id = $1 AND m.organization_id = $2`,
        [fileId, orgId]
      );

      if (!fileRecord) {
        return res.status(404).json({ error: 'Datei nicht gefunden' });
      }

      // DB-Eintrag loeschen
      await db.query('DELETE FROM material_files WHERE id = $1', [fileId]);

      // Datei vom Dateisystem loeschen
      const materialDir = path.join(__dirname, '..', 'uploads', 'material');
      const filePath = path.join(materialDir, fileRecord.stored_name);
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      } catch (fileErr) {
        console.warn(`Konnte Datei ${fileRecord.stored_name} nicht loeschen:`, fileErr.message);
      }

      // updated_at aktualisieren
      await db.query('UPDATE materials SET updated_at = NOW() WHERE id = $1', [fileRecord.material_id]);

      res.json({ message: 'Datei geloescht' });
    } catch (err) {
      console.error('Fehler beim Loeschen der Datei:', err.message);
      res.status(500).json({ error: 'Fehler beim Loeschen der Datei' });
    }
  });

  return router;
};
