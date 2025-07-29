const express = require('express');
const router = express.Router();

module.exports = (db, rbacVerifier, checkPermission) => {

  // GET all jahrgaenge for the admin's organization
  router.get('/', rbacVerifier, checkPermission('admin.jahrgaenge.view'), async (req, res) => {
    try {
      const query = "SELECT * FROM jahrgaenge WHERE organization_id = $1 ORDER BY name DESC";
      const { rows: jahrgaenge } = await db.query(query, [req.user.organization_id]);
      res.json(jahrgaenge);
    } catch (err) {
      console.error('Database error in GET /api/jahrgaenge:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // POST a new jahrgang
  router.post('/', rbacVerifier, checkPermission('admin.jahrgaenge.create'), async (req, res) => {
    const { name, confirmation_date } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    try {
      const query = "INSERT INTO jahrgaenge (name, confirmation_date, organization_id) VALUES ($1, $2, $3) RETURNING id";
      const params = [name, confirmation_date, req.user.organization_id];
      const { rows: [newJahrgang] } = await db.query(query, params);
      
      res.status(201).json({ id: newJahrgang.id, name, confirmation_date });
    } catch (err) {
      if (err.code === '23505') { // unique_violation
        return res.status(409).json({ error: 'Jahrgang-Name existiert bereits in dieser Organisation' });
      }
      console.error('Database error in POST /api/jahrgaenge:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // PUT (update) a jahrgang
  router.put('/:id', rbacVerifier, checkPermission('admin.jahrgaenge.edit'), async (req, res) => {
    const { name, confirmation_date } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    try {
      const query = "UPDATE jahrgaenge SET name = $1, confirmation_date = $2 WHERE id = $3 AND organization_id = $4";
      const params = [name, confirmation_date, req.params.id, req.user.organization_id];
      const { rowCount } = await db.query(query, params);
      
      if (rowCount === 0) {
        return res.status(404).json({ error: 'Jahrgang not found' });
      }
      res.json({ message: 'Jahrgang updated successfully' });
    } catch (err) {
      if (err.code === '23505') { // unique_violation
        return res.status(409).json({ error: 'Jahrgang-Name existiert bereits' });
      }
      console.error(`Database error in PUT /api/jahrgaenge/${req.params.id}:`, err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // DELETE a jahrgang
  router.delete('/:id', rbacVerifier, checkPermission('admin.jahrgaenge.delete'), async (req, res) => {
    const jahrgangId = req.params.id;
    const forceDelete = req.query.force === 'true';
    
    try {
      // Check if jahrgang is in use by konfis
      const checkKonfisQuery = "SELECT COUNT(*)::int as count FROM konfi_profiles WHERE jahrgang_id = $1";
      const { rows: [konfiUsage] } = await db.query(checkKonfisQuery, [jahrgangId]);
      
      if (konfiUsage.count > 0) {
        return res.status(409).json({ error: `Jahrgang kann nicht gelöscht werden: ${konfiUsage.count} Konfi(s) zugeordnet.` });
      }

      // Check if there are chat rooms with messages
      const checkChatQuery = `
        SELECT cr.id, 
               (SELECT COUNT(*) FROM chat_messages WHERE room_id = cr.id)::int as message_count
        FROM chat_rooms cr 
        WHERE cr.type = 'jahrgang' AND cr.jahrgang_id = $1
      `;
      const { rows: chatRooms } = await db.query(checkChatQuery, [jahrgangId]);
      
      if (chatRooms.length > 0) {
        const roomsWithMessages = chatRooms.filter(room => room.message_count > 0);
        if (roomsWithMessages.length > 0 && !forceDelete) {
          // All admins with jahrgaenge.delete permission can force delete
          return res.status(409).json({ 
            error: `Jahrgang kann nicht gelöscht werden: Chat-Raum enthält ${roomsWithMessages[0].message_count} Nachricht(en).`,
            canForceDelete: true
          });
        }
        
        // Delete chat rooms (with or without messages if force)
        if (forceDelete || roomsWithMessages.length === 0) {
          // Get all files before deleting messages (for file cleanup)
          const allFiles = [];
          for (const room of chatRooms) {
            const { rows: roomFiles } = await db.query("SELECT file_path FROM chat_messages WHERE room_id = $1 AND file_path IS NOT NULL", [room.id]);
            allFiles.push(...roomFiles);
          }
          
          // Delete chat data in correct order due to foreign keys
          for (const room of chatRooms) {
            // 1. Delete poll votes first
            await db.query("DELETE FROM chat_poll_votes WHERE poll_id IN (SELECT id FROM chat_polls WHERE room_id = $1)", [room.id]);
            
            // 2. Delete polls
            await db.query("DELETE FROM chat_polls WHERE room_id = $1", [room.id]);
            
            // 3. Delete read status
            await db.query("DELETE FROM chat_read_status WHERE room_id = $1", [room.id]);
            
            // 4. Delete messages
            await db.query("DELETE FROM chat_messages WHERE room_id = $1", [room.id]);
            
            // 5. Delete participants
            await db.query("DELETE FROM chat_participants WHERE room_id = $1", [room.id]);
          }
          
          // 6. Delete chat rooms
          await db.query("DELETE FROM chat_rooms WHERE type = 'jahrgang' AND jahrgang_id = $1", [jahrgangId]);
          
          // 7. Clean up files from filesystem (best effort)
          const fs = require('fs').promises;
          const path = require('path');
          
          for (const fileRecord of allFiles) {
            try {
              const fullPath = path.join(__dirname, '..', 'uploads', 'chat', fileRecord.file_path);
              await fs.unlink(fullPath);
              console.log(`Deleted file: ${fullPath}`);
            } catch (fileErr) {
              console.warn(`Could not delete file ${fileRecord.file_path}:`, fileErr.message);
              // Don't fail the whole operation if file deletion fails
            }
          }
        }
      }

      // Delete the jahrgang itself
      const deleteJahrgangQuery = "DELETE FROM jahrgaenge WHERE id = $1 AND organization_id = $2";
      const { rowCount } = await db.query(deleteJahrgangQuery, [jahrgangId, req.user.organization_id]);

      if (rowCount === 0) {
        return res.status(404).json({ error: 'Jahrgang not found' });
      }
      
      res.json({ message: 'Jahrgang deleted successfully' });
    } catch (err) {
      console.error(`Database error in DELETE /api/jahrgaenge/${jahrgangId}:`, err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  return router;
};