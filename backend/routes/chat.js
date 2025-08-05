const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const PushService = require('../services/pushService');

module.exports = (db, rbacMiddleware, uploadsDir, chatUpload) => {
  const { verifyTokenRBAC } = rbacMiddleware;
  // Using passed-in encrypted chatUpload from server.js
  
  // === UTILITY FUNCTIONS ===
  
  // Ensure admin is in all their assigned jahrgang chats (and remove from unassigned ones)
  const ensureAdminJahrgangChatMembership = async (db, adminId) => {
    try {
      // Get admin's jahrgang assignments
      const assignmentsQuery = `
        SELECT uja.jahrgang_id, j.name as jahrgang_name
        FROM user_jahrgang_assignments uja
        JOIN jahrgaenge j ON uja.jahrgang_id = j.id
        WHERE uja.user_id = $1 AND uja.can_view = true
      `;
      const { rows: assignments } = await db.query(assignmentsQuery, [adminId]);
      const assignedJahrgangIds = assignments ? assignments.map(a => a.jahrgang_id) : [];
      
      // First: Remove admin from jahrgang chats they're no longer assigned to
      if (assignedJahrgangIds.length > 0) {
        const removeQuery = `
          DELETE FROM chat_participants 
          WHERE user_id = $1 AND user_type = 'admin' AND room_id IN (
            SELECT cr.id FROM chat_rooms cr 
            WHERE cr.type = 'jahrgang' 
            AND cr.jahrgang_id NOT IN (${assignedJahrgangIds.map((_, i) => `$${i + 2}`).join(',')})
          )
        `;
        const removeParams = [adminId, ...assignedJahrgangIds];
        const { rowCount } = await db.query(removeQuery, removeParams);
        if (rowCount > 0) {
          console.log(`Removed admin ${adminId} from ${rowCount} unassigned jahrgang chat(s)`);
        }
      }
      
      // Second: Add admin to assigned jahrgang chats
      for (const assignment of assignments) {
        const chatExistsQuery = `
          SELECT id FROM chat_rooms 
          WHERE type = 'jahrgang' AND jahrgang_id = $1
        `;
        const { rows: [chatRoom] } = await db.query(chatExistsQuery, [assignment.jahrgang_id]);
        if (!chatRoom) continue;
        
        const participantExistsQuery = `
          SELECT id FROM chat_participants 
          WHERE room_id = $1 AND user_id = $2 AND user_type = 'admin'
        `;
        const { rows: [participant] } = await db.query(participantExistsQuery, [chatRoom.id, adminId]);
        if (participant) continue;
        
        const insertQuery = `
          INSERT INTO chat_participants (room_id, user_id, user_type, joined_at)
          VALUES ($1, $2, 'admin', NOW())
        `;
        await db.query(insertQuery, [chatRoom.id, adminId]);
        console.log(`Added admin ${adminId} to jahrgang chat ${chatRoom.id} (${assignment.jahrgang_name})`);
      }
    } catch (err) {
      console.error('Error ensuring admin chat membership:', err);
    }
  };
  
  // Ensure konfi is in their jahrgang chat (and remove from others)
  const ensureKonfiJahrgangChatMembership = async (db, konfiId) => {
    try {
      const jahrgangQuery = `
        SELECT kp.jahrgang_id, j.name as jahrgang_name
        FROM konfi_profiles kp
        JOIN jahrgaenge j ON kp.jahrgang_id = j.id
        WHERE kp.user_id = $1 AND kp.jahrgang_id IS NOT NULL
      `;
      const { rows: [jahrgang] } = await db.query(jahrgangQuery, [konfiId]);
      
      // First: Remove konfi from wrong or all jahrgang chats
      if (jahrgang) {
        const removeQuery = `
          DELETE FROM chat_participants 
          WHERE user_id = $1 AND user_type = 'konfi' AND room_id IN (
            SELECT cr.id FROM chat_rooms cr 
            WHERE cr.type = 'jahrgang' AND cr.jahrgang_id != $2
          )
        `;
        const { rowCount } = await db.query(removeQuery, [konfiId, jahrgang.jahrgang_id]);
        if (rowCount > 0) {
          console.log(`Removed konfi ${konfiId} from ${rowCount} wrong jahrgang chat(s)`);
        }
      } else {
        const removeAllQuery = `
          DELETE FROM chat_participants 
          WHERE user_id = $1 AND user_type = 'konfi' AND room_id IN (
            SELECT cr.id FROM chat_rooms cr WHERE cr.type = 'jahrgang'
          )
        `;
        const { rowCount } = await db.query(removeAllQuery, [konfiId]);
        if (rowCount > 0) {
          console.log(`Removed konfi ${konfiId} from all jahrgang chats (no assignment)`);
        }
        return;
      }
      
      // Check if jahrgang chat exists
      let chatRoom;
      const chatExistsQuery = `SELECT id FROM chat_rooms WHERE type = 'jahrgang' AND jahrgang_id = $1`;
      const { rows: [existingChatRoom] } = await db.query(chatExistsQuery, [jahrgang.jahrgang_id]);
      chatRoom = existingChatRoom;
      
      if (!chatRoom) {
        const createChatQuery = `
          INSERT INTO chat_rooms (name, type, jahrgang_id, created_by)
          VALUES ($1, 'jahrgang', $2, 1) RETURNING id
        `;
        const chatName = `Jahrgang ${jahrgang.jahrgang_name}`;
        const { rows: [newChatRoom] } = await db.query(createChatQuery, [chatName, jahrgang.jahrgang_id]);
        
        console.log(`Created jahrgang chat ${newChatRoom.id} for ${jahrgang.jahrgang_name}`);
        chatRoom = newChatRoom;
        
        // Add this konfi and all other konfis from the jahrgang to the new chat
        await addKonfiToChat(db, chatRoom.id, konfiId, jahrgang.jahrgang_name);
        await addAllJahrgangKonfisToChat(db, chatRoom.id, jahrgang.jahrgang_id);
        return;
      }
      
      const participantExistsQuery = `
        SELECT id FROM chat_participants 
        WHERE room_id = $1 AND user_id = $2 AND user_type = 'konfi'
      `;
      const { rows: [participant] } = await db.query(participantExistsQuery, [chatRoom.id, konfiId]);
      if (participant) return;
      
      await addKonfiToChat(db, chatRoom.id, konfiId, jahrgang.jahrgang_name);
      
    } catch (err) {
      console.error('Error ensuring konfi chat membership:', err);
    }
  };
  
  const addKonfiToChat = async (db, roomId, konfiId, jahrgangName) => {
    try {
      const insertQuery = `
        INSERT INTO chat_participants (room_id, user_id, user_type, joined_at)
        VALUES ($1, $2, 'konfi', NOW())
      `;
      await db.query(insertQuery, [roomId, konfiId]);
      console.log(`Added konfi ${konfiId} to jahrgang chat ${roomId} (${jahrgangName})`);
    } catch (err) {
      // Ignore unique constraint violation if a race condition occurs
      if (err.code !== '23505') {
        console.error(`Error adding konfi ${konfiId} to chat ${roomId}:`, err);
      }
    }
  };
  
  const addAllJahrgangKonfisToChat = async (db, roomId, jahrgangId) => {
    try {
      const konfisQuery = `SELECT user_id FROM konfi_profiles WHERE jahrgang_id = $1`;
      const { rows: konfis } = await db.query(konfisQuery, [jahrgangId]);
      if (!konfis || konfis.length === 0) return;
      
      for (const konfi of konfis) {
        const checkQuery = `SELECT id FROM chat_participants WHERE room_id = $1 AND user_id = $2 AND user_type = 'konfi'`;
        const { rows: [existing] } = await db.query(checkQuery, [roomId, konfi.user_id]);
        if (existing) continue;
        
        const insertQuery = `
          INSERT INTO chat_participants (room_id, user_id, user_type, joined_at)
          VALUES ($1, $2, 'konfi', NOW())
        `;
        await db.query(insertQuery, [roomId, konfi.user_id]);
        console.log(`Added konfi ${konfi.user_id} to jahrgang chat ${roomId}`);
      }
    } catch (err) {
      console.error(`Error adding all konfis to chat ${roomId}:`, err);
    }
  };
  
  
  // === CHAT API ENDPOINTS ===
  
  // Get admins for direct contact (konfis only)
  router.get('/admins', verifyTokenRBAC, async (req, res) => {
    try {
      if (req.user.type !== 'konfi') {
        return res.status(403).json({ error: 'Konfi access required' });
      }
      
      const organizationId = req.user.organization_id;
      const query = "SELECT u.id, u.display_name, u.username FROM users u JOIN roles r ON u.role_id = r.id WHERE r.name IN ('admin', 'org_admin', 'teamer') AND u.organization_id = $1 ORDER BY u.display_name";
      const { rows: admins } = await db.query(query, [organizationId]);
      res.json(admins);
      
    } catch (err) {
      console.error('Database error in GET /admins:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });
  
  // Create or get direct chat room
  router.post('/direct', verifyTokenRBAC, async (req, res) => {
    try {
      const { target_user_id, target_user_type } = req.body;
      const organizationId = req.user.organization_id;
      
      if (!target_user_id || !target_user_type) {
        return res.status(400).json({ error: 'Target user required' });
      }
      if (!['admin', 'konfi'].includes(target_user_type)) {
        return res.status(400).json({ error: 'Invalid target user type' });
      }
      
      const { rows: [validUser] } = await db.query("SELECT id FROM users WHERE id = $1 AND organization_id = $2", [target_user_id, organizationId]);
      if (!validUser) {
        return res.status(403).json({ error: 'Target user not found in your organization' });
      }
      
      const user1_type = req.user.type;
      const user1_id = req.user.id;
      const user2_type = target_user_type;
      const user2_id = target_user_id;
      
      const existingRoomQuery = `
        SELECT r.id FROM chat_rooms r
        WHERE r.type = 'direct' AND r.organization_id = $1
        AND EXISTS (SELECT 1 FROM chat_participants p1 WHERE p1.room_id = r.id AND p1.user_id = $2 AND p1.user_type = $3)
        AND EXISTS (SELECT 1 FROM chat_participants p2 WHERE p2.room_id = r.id AND p2.user_id = $4 AND p2.user_type = $5)
      `;
      const { rows: [existingRoom] } = await db.query(existingRoomQuery, [organizationId, user1_id, user1_type, user2_id, user2_type]);
      if (existingRoom) {
        return res.json({ room_id: existingRoom.id, created: false });
      }
      
      const targetQuery = target_user_type === 'admin' ?
      "SELECT u.display_name as name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = $1 AND r.name IN ('admin', 'org_admin', 'teamer')" :
      "SELECT u.display_name as name FROM users u JOIN roles r ON u.role_id = r.id JOIN konfi_profiles kp ON u.id = kp.user_id WHERE u.id = $1 AND r.name = 'konfi'";
      const { rows: [targetUser] } = await db.query(targetQuery, [target_user_id]);
      if (!targetUser) {
        return res.status(404).json({ error: 'Target user not found' });
      }
      
      const roomName = targetUser.name;
      const insertRoomQuery = "INSERT INTO chat_rooms (name, type, created_by, organization_id) VALUES ($1, 'direct', $2, $3) RETURNING id";
      const { rows: [newRoom] } = await db.query(insertRoomQuery, [roomName, req.user.id, organizationId]);
      const roomId = newRoom.id;
      
      const insertParticipant1Query = "INSERT INTO chat_participants (room_id, user_id, user_type) VALUES ($1, $2, $3)";
      const insertParticipant2Query = "INSERT INTO chat_participants (room_id, user_id, user_type) VALUES ($1, $2, $3)";
      await Promise.all([
        db.query(insertParticipant1Query, [roomId, user1_id, user1_type]),
        db.query(insertParticipant2Query, [roomId, user2_id, user2_type])
      ]);
      
      res.json({ room_id: roomId, created: true });
      
    } catch (err) {
      console.error('Database error in POST /direct:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });
  
  // Create new chat room
  router.post('/rooms', verifyTokenRBAC, async (req, res) => {
    try {
      const { type, name, participants, jahrgang_id } = req.body;
      const createdBy = req.user.id;
      const organizationId = req.user.organization_id;
      
      if (!type || !name) {
        return res.status(400).json({ error: 'Type and name are required' });
      }
      if (!['direct', 'group', 'jahrgang', 'admin_team'].includes(type)) {
        return res.status(400).json({ error: 'Invalid chat type' });
      }
      
      if (req.user.type === 'konfi') {
        const { rows: [setting] } = await db.query("SELECT value FROM settings WHERE key = 'konfi_chat_permissions'", []);
        const permissions = setting?.value || 'direct_only';
        let allowedTypes = [];
        switch (permissions) {
          case 'direct_only': allowedTypes = ['direct']; break;
          case 'direct_and_group': allowedTypes = ['direct', 'group']; break;
          default: allowedTypes = ['direct'];
        }
        if (!allowedTypes.includes(type)) {
          return res.status(403).json({
            error: `Konfirmanden können nur diese Chat-Arten erstellen: ${allowedTypes.join(', ')}`,
            allowed_types: allowedTypes,
            user_type: req.user.type,
            current_permission: permissions
          });
        }
      }
      
      if (type === 'jahrgang') {
        if (!jahrgang_id) {
          return res.status(400).json({ error: 'Jahrgang ID required for jahrgang chats' });
        }
        const { rows: [validJahrgang] } = await db.query("SELECT id FROM jahrgaenge WHERE id = $1 AND organization_id = $2", [jahrgang_id, organizationId]);
        if (!validJahrgang) {
          return res.status(403).json({ error: 'Jahrgang not found in your organization' });
        }
        const { rows: [existing] } = await db.query("SELECT id FROM chat_rooms WHERE type = 'jahrgang' AND jahrgang_id = $1 AND organization_id = $2", [jahrgang_id, organizationId]);
        if (existing) {
          return res.status(400).json({ error: 'Jahrgang chat already exists' });
        }
      }
      
      const insertRoomQuery = "INSERT INTO chat_rooms (name, type, jahrgang_id, created_by, organization_id) VALUES ($1, $2, $3, $4, $5) RETURNING id";
      const { rows: [newRoom] } = await db.query(insertRoomQuery, [name, type, jahrgang_id || null, createdBy, organizationId]);
      const roomId = newRoom.id;
      
      // Add creator as participant
      await db.query("INSERT INTO chat_participants (room_id, user_id, user_type) VALUES ($1, $2, $3)", [roomId, createdBy, req.user.type]);
      
      if (participants && participants.length > 0) {
        const participantPromises = participants.map(participant => {
          const userId = typeof participant === 'object' ? participant.user_id : participant;
          const userType = typeof participant === 'object' ? participant.user_type : 'konfi';
          if (userId === createdBy && userType === req.user.type) return null;
          return db.query("INSERT INTO chat_participants (room_id, user_id, user_type) VALUES ($1, $2, $3)", [roomId, userId, userType]).catch(err => console.error(`Error adding participant ${userId}:`, err));
        }).filter(p => p !== null);
        await Promise.all(participantPromises);
      } else if (type === 'jahrgang') {
        const konfisQuery = `SELECT u.id FROM users u 
                              JOIN roles r ON u.role_id = r.id 
                              JOIN konfi_profiles kp ON u.id = kp.user_id 
                              WHERE r.name = 'konfi' AND kp.jahrgang_id = $1 AND u.organization_id = $2`;
        const { rows: konfis } = await db.query(konfisQuery, [jahrgang_id, organizationId]);
        
        if (konfis.length > 0) {
          const konfiPromises = konfis.map(konfi => 
            db.query("INSERT INTO chat_participants (room_id, user_id, user_type) VALUES ($1, $2, 'konfi')", [roomId, konfi.id])
            .catch(err => console.error(`Error adding konfi ${konfi.id} to jahrgang chat:`, err))
          );
          await Promise.all(konfiPromises);
        }
      }
      
      res.json({ room_id: roomId, created: true });
    } catch (err) {
      console.error('Database error in POST /rooms:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // Get chat rooms for user
  router.get('/rooms', verifyTokenRBAC, async (req, res) => {
    try {
      const userId = req.user.id;
      const userType = req.user.type;
      const organizationId = req.user.organization_id;
      
      // Ensure user is in their jahrgang chats (these functions are already async)
      if (userType === 'admin') {
        await ensureAdminJahrgangChatMembership(db, userId);
      } else if (userType === 'konfi') {
        await ensureKonfiJahrgangChatMembership(db, userId);
      }
      
      // Admins and Konfis use the same optimized query now.
      const query = `
      SELECT 
          r.*, 
          j.name as jahrgang_name,
          (
              SELECT COUNT(*) 
              FROM chat_messages m 
              WHERE m.room_id = r.id 
              AND m.deleted_at IS NULL
              AND m.created_at > COALESCE(crs.last_read_at, '1970-01-01')
          ) as unread_count,
          (
              SELECT json_build_object(
                  'content', m.content,
                  'sender_name', u.display_name,
                  'created_at', m.created_at
              )
              FROM chat_messages m
              JOIN users u ON m.user_id = u.id
              WHERE m.room_id = r.id AND m.deleted_at IS NULL
              ORDER BY m.created_at DESC
              LIMIT 1
          ) as last_message
      FROM chat_rooms r
      INNER JOIN chat_participants p ON r.id = p.room_id AND p.user_id = $1 AND p.user_type = $2
      LEFT JOIN jahrgaenge j ON r.jahrgang_id = j.id
      LEFT JOIN chat_read_status crs ON r.id = crs.room_id AND crs.user_id = $1 AND crs.user_type = $2
      WHERE r.organization_id = $3
      GROUP BY r.id, j.name, crs.last_read_at
      ORDER BY (SELECT created_at FROM chat_messages WHERE room_id = r.id AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1) DESC NULLS LAST
    `;
      const params = [userId, userType, organizationId];
      
      let { rows: rooms } = await db.query(query, params);
      
      // Fix direct chat names - get other participant's name for each direct chat
      const finalRooms = await Promise.all(rooms.map(async (room) => {
        if (room.type === 'direct') {
          const otherParticipantQuery = `
          SELECT u.display_name as participant_name
          FROM chat_participants p
          JOIN users u ON p.user_id = u.id
          WHERE p.room_id = $1 AND NOT (p.user_id = $2 AND p.user_type = $3)
          LIMIT 1
        `;
          const { rows: [otherParticipant] } = await db.query(otherParticipantQuery, [room.id, userId, userType]);
          if (otherParticipant && otherParticipant.participant_name) {
            room.name = otherParticipant.participant_name;
          }
        }
        return room;
      }));
      
      res.json(finalRooms);
      
    } catch (err) {
      console.error('Database error in GET /rooms:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });
  
  // === NEUER ENDPOINT: Get details for a single chat room ===
  router.get('/rooms/:roomId', verifyTokenRBAC, async (req, res) => {
    try {
      const roomId = req.params.roomId;
      const userId = req.user.id;
      const userType = req.user.type;
      const organizationId = req.user.organization_id;
      
      // 1. Security Check: Does the user have access to this room?
      let hasAccess = false;
      const accessQuery = `
      SELECT 1 FROM chat_participants cp
      JOIN chat_rooms cr ON cp.room_id = cr.id 
      WHERE cp.room_id = $1 AND cp.user_id = $2 AND cp.user_type = $3 AND cr.organization_id = $4
    `;
      const { rows: [access] } = await db.query(accessQuery, [roomId, userId, userType, organizationId]);
      
      if (access) {
        hasAccess = true;
      } else if (userType === 'admin') {
        const adminAccessQuery = "SELECT 1 FROM chat_rooms WHERE id = $1 AND organization_id = $2";
        const { rows: [adminAccess] } = await db.query(adminAccessQuery, [roomId, organizationId]);
        if (adminAccess) {
          hasAccess = true;
        }
      }
      
      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      // 2. Fetch room data
      const roomQuery = `
      SELECT 
        cr.*,
        j.name as jahrgang_name
      FROM chat_rooms cr
      LEFT JOIN jahrgaenge j ON cr.jahrgang_id = j.id
      WHERE cr.id = $1 AND cr.organization_id = $2
    `;
      const { rows: [room] } = await db.query(roomQuery, [roomId, organizationId]);
      
      if (!room) {
        return res.status(404).json({ error: 'Room not found' });
      }
      
      // 3. Fetch participant list
      const participantsQuery = `
      SELECT u.id as user_id, u.display_name, cp.user_type
      FROM chat_participants cp
      JOIN users u ON cp.user_id = u.id
      WHERE cp.room_id = $1
    `;
      const { rows: participants } = await db.query(participantsQuery, [roomId]);
      room.participants = participants;
      
      // 4. Adjust name for direct chats
      if (room.type === 'direct') {
        const otherParticipant = participants.find(p =>
          !(p.user_id === userId && p.user_type === userType)
        );
        if (otherParticipant) {
          room.name = otherParticipant.display_name || room.name;
        }
      }
      
      res.json(room);
      
    } catch (err) {
      console.error(`Database error in GET /rooms/${req.params.roomId}:`, err);
      res.status(500).json({ error: 'Database error' });
    }
  });
  
  // Get messages for a room
  router.get('/rooms/:roomId/messages', verifyTokenRBAC, async (req, res) => {
    try {
      const roomId = req.params.roomId;
      const limit = parseInt(req.query.limit) || 50;
      const offset = parseInt(req.query.offset) || 0;
      const userId = req.user.id;
      const userType = req.user.type;
      const organizationId = req.user.organization_id;
      
      // Check if user has access to this room (with organization check)
      const accessQuery = userType === 'admin'
      ? "SELECT 1 FROM chat_rooms WHERE id = $1 AND organization_id = $2"
      : `SELECT 1 FROM chat_participants cp 
          JOIN chat_rooms cr ON cp.room_id = cr.id 
          WHERE cp.room_id = $1 AND cp.user_id = $2 AND cp.user_type = $3 AND cr.organization_id = $4`;
      const accessParams = userType === 'admin' ? [roomId, organizationId] : [roomId, userId, userType, organizationId];
      const { rows: [access] } = await db.query(accessQuery, accessParams);
      
      if (!access) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      const messagesQuery = `
      SELECT m.*, 
              m.user_id as sender_id,
              m.user_type as sender_type,
              u.display_name as sender_name,
              u.username as sender_username,
              p.question, p.options, p.expires_at, p.multiple_choice,
              p.id as poll_id,
              CASE 
                WHEN m.deleted_at IS NOT NULL THEN 'Diese Nachricht wurde gelöscht'
                ELSE m.content
              END as content,
              CASE 
                WHEN m.deleted_at IS NOT NULL THEN true
                ELSE false
              END as is_deleted
      FROM chat_messages m
      LEFT JOIN users u ON m.user_id = u.id
      LEFT JOIN chat_polls p ON m.id = p.message_id
      WHERE m.room_id = $1
      ORDER BY m.created_at DESC
      LIMIT $2 OFFSET $3
    `;
      const { rows: messages } = await db.query(messagesQuery, [roomId, limit, offset]);
      
      // Load votes for poll messages
      const processedMessages = await Promise.all(messages.map(async (msg) => {
        if (msg.message_type === 'poll' && msg.options) {
          // Parse options from JSON string (since stored as TEXT in chat_polls table)
          try {
            msg.options = JSON.parse(msg.options);
          } catch (e) {
            console.error('Failed to parse poll options:', msg.options, e);
            msg.options = [];
          }
          const votesQuery = `
          SELECT v.*, u.display_name as voter_name
          FROM chat_poll_votes v
          LEFT JOIN users u ON v.user_id = u.id
          WHERE v.poll_id = $1
        `;
          const { rows: votes } = await db.query(votesQuery, [msg.poll_id]);
          msg.votes = votes || [];
          msg.multiple_choice = Boolean(msg.multiple_choice);
        }
        return msg;
      }));
      
      res.json(processedMessages.reverse());
    } catch (err) {
      console.error(`Database error in GET /rooms/${req.params.roomId}/messages:`, err);
      res.status(500).json({ error: 'Database error' });
    }
  });
  
  // Send message
  router.post('/rooms/:roomId/messages', verifyTokenRBAC, chatUpload.single('file'), async (req, res) => {
    try {
      const roomId = req.params.roomId;
      const { content, message_type = 'text', reply_to } = req.body;
      const userId = req.user.id;
      const userType = req.user.type;
      
      if (!content && !req.file) {
        return res.status(400).json({ error: 'Content or file required' });
      }
      
      // Check access
      const accessQuery = userType === 'admin'
      ? "SELECT 1 FROM chat_rooms WHERE id = $1"
      : "SELECT 1 FROM chat_participants WHERE room_id = $1 AND user_id = $2 AND user_type = $3";
      const accessParams = userType === 'admin' ? [roomId] : [roomId, userId, userType];
      const { rows: [access] } = await db.query(accessQuery, accessParams);
      if (!access) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      // Process file
      let filePath = null, fileName = null, fileSize = null;
      let actualMessageType = message_type;
      if (req.file) {
        filePath = req.file.filename;
        fileName = req.file.originalname;
        fileSize = req.file.size;
        const ext = path.extname(fileName).toLowerCase();
        if (['.jpg', '.jpeg', '.png', '.gif', '.heic', '.webp'].includes(ext)) {
          actualMessageType = 'image';
        } else if (['.mp4', '.mov', '.avi'].includes(ext)) {
          actualMessageType = 'video';
        } else {
          actualMessageType = 'file';
        }
      }
      
      // Insert message and get its ID back
      const insertQuery = `
      INSERT INTO chat_messages (room_id, user_id, user_type, message_type, content, file_path, file_name, file_size, reply_to)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `;
      const { rows: [newMessage] } = await db.query(insertQuery, [roomId, userId, userType, actualMessageType, content, filePath, fileName, fileSize, reply_to]);
      const messageId = newMessage.id;
      
      // Fetch the complete message object to send back and for push notifications
      const messageQuery = `
      SELECT m.*, 
              m.user_id as sender_id,
              m.user_type as sender_type,
              u.display_name as sender_name,
              u.username as sender_username
      FROM chat_messages m
      JOIN users u ON m.user_id = u.id
      WHERE m.id = $1
    `;
      const { rows: [message] } = await db.query(messageQuery, [messageId]);
      
      res.json(message); // Respond immediately
      
      // Asynchronously send push notifications
      (async () => {
        try {
          const getParticipantsQuery = `
          SELECT user_id, user_type FROM chat_participants
          WHERE room_id = $1 AND NOT (user_id = $2 AND user_type = $3)
        `;
          const { rows: participants } = await db.query(getParticipantsQuery, [roomId, userId, userType]);
          if (!participants) return;
          
          const { rows: [room] } = await db.query('SELECT name, type FROM chat_rooms WHERE id = $1', [roomId]);
          const roomName = room?.name || 'Chat';
          const isDirectChat = room?.type === 'direct';
          const pushTitle = isDirectChat ? message.sender_name : roomName;
          const pushBody = isDirectChat
          ? (content || '[Anhang]')
          : `${message.sender_name}: ${content || '[Anhang]'}`;
          
          for (const p of participants) {
            const badgeQuery = `
            SELECT COUNT(DISTINCT cm.id) as total_unread
            FROM chat_messages cm
            JOIN chat_participants cp ON cm.room_id = cp.room_id
            LEFT JOIN chat_read_status crs ON cm.room_id = crs.room_id AND crs.user_id = $1 AND crs.user_type = $2
            WHERE cp.user_id = $1
            AND cp.user_type = $2
            AND cm.created_at > COALESCE(crs.last_read_at, '1970-01-01')
            AND cm.deleted_at IS NULL
            AND NOT (cm.user_id = $1 AND cm.user_type = $2)
          `;
            const { rows: [badgeResult] } = await db.query(badgeQuery, [p.user_id, p.user_type]);
            const badgeCount = parseInt(badgeResult?.total_unread || '0', 10);
            console.log(`📱 Badge count for user ${p.user_id}: ${badgeCount} (including new message)`);
            
            await PushService.sendChatNotification(db, p.user_id, {
              title: pushTitle,
              body: pushBody,
              badge: badgeCount,
              roomId: roomId,
              messageId: message.id,
              data: {
                sender_id: userId,
                sender_name: message.sender_name,
                room_name: roomName,
                room_type: room?.type || 'unknown'
              }
            });
          }
        } catch (pushError) {
          console.error('❌ Failed to send chat push notification:', pushError);
        }
      })();
      
    } catch (err) {
      console.error(`Database error in POST /rooms/${req.params.roomId}/messages:`, err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  
  // Get chat rooms for user
  router.get('/rooms', verifyTokenRBAC, async (req, res) => {
    try {
      const userId = req.user.id;
      const userType = req.user.type;
      const organizationId = req.user.organization_id;
      
      // Ensure user is in their jahrgang chats (these functions are already async)
      if (userType === 'admin') {
        await ensureAdminJahrgangChatMembership(db, userId);
      } else if (userType === 'konfi') {
        await ensureKonfiJahrgangChatMembership(db, userId);
      }
      
      // Admins and Konfis use the same optimized query now.
      const query = `
      SELECT 
          r.*, 
          j.name as jahrgang_name,
          (
              SELECT COUNT(*) 
              FROM chat_messages m 
              WHERE m.room_id = r.id 
              AND m.deleted_at IS NULL
              AND m.created_at > COALESCE(crs.last_read_at, '1970-01-01')
          ) as unread_count,
          (
              SELECT json_build_object(
                  'content', m.content,
                  'sender_name', u.display_name,
                  'created_at', m.created_at
              )
              FROM chat_messages m
              JOIN users u ON m.user_id = u.id
              WHERE m.room_id = r.id AND m.deleted_at IS NULL
              ORDER BY m.created_at DESC
              LIMIT 1
          ) as last_message
      FROM chat_rooms r
      INNER JOIN chat_participants p ON r.id = p.room_id AND p.user_id = $1 AND p.user_type = $2
      LEFT JOIN jahrgaenge j ON r.jahrgang_id = j.id
      LEFT JOIN chat_read_status crs ON r.id = crs.room_id AND crs.user_id = $1 AND crs.user_type = $2
      WHERE r.organization_id = $3
      GROUP BY r.id, j.name, crs.last_read_at
      ORDER BY (SELECT created_at FROM chat_messages WHERE room_id = r.id AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1) DESC NULLS LAST
    `;
      const params = [userId, userType, organizationId];
      
      let { rows: rooms } = await db.query(query, params);
      
      // Fix direct chat names - get other participant's name for each direct chat
      const finalRooms = await Promise.all(rooms.map(async (room) => {
        if (room.type === 'direct') {
          const otherParticipantQuery = `
          SELECT u.display_name as participant_name
          FROM chat_participants p
          JOIN users u ON p.user_id = u.id
          WHERE p.room_id = $1 AND NOT (p.user_id = $2 AND p.user_type = $3)
          LIMIT 1
        `;
          const { rows: [otherParticipant] } = await db.query(otherParticipantQuery, [room.id, userId, userType]);
          if (otherParticipant && otherParticipant.participant_name) {
            room.name = otherParticipant.participant_name;
          }
        }
        return room;
      }));
      
      res.json(finalRooms);
      
    } catch (err) {
      console.error('Database error in GET /rooms:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });
  
  // === NEUER ENDPOINT: Get details for a single chat room ===
  router.get('/rooms/:roomId', verifyTokenRBAC, async (req, res) => {
    try {
      const roomId = req.params.roomId;
      const userId = req.user.id;
      const userType = req.user.type;
      const organizationId = req.user.organization_id;
      
      // 1. Security Check: Does the user have access to this room?
      let hasAccess = false;
      const accessQuery = `
      SELECT 1 FROM chat_participants cp
      JOIN chat_rooms cr ON cp.room_id = cr.id 
      WHERE cp.room_id = $1 AND cp.user_id = $2 AND cp.user_type = $3 AND cr.organization_id = $4
    `;
      const { rows: [access] } = await db.query(accessQuery, [roomId, userId, userType, organizationId]);
      
      if (access) {
        hasAccess = true;
      } else if (userType === 'admin') {
        const adminAccessQuery = "SELECT 1 FROM chat_rooms WHERE id = $1 AND organization_id = $2";
        const { rows: [adminAccess] } = await db.query(adminAccessQuery, [roomId, organizationId]);
        if (adminAccess) {
          hasAccess = true;
        }
      }
      
      if (!hasAccess) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      // 2. Fetch room data
      const roomQuery = `
      SELECT 
        cr.*,
        j.name as jahrgang_name
      FROM chat_rooms cr
      LEFT JOIN jahrgaenge j ON cr.jahrgang_id = j.id
      WHERE cr.id = $1 AND cr.organization_id = $2
    `;
      const { rows: [room] } = await db.query(roomQuery, [roomId, organizationId]);
      
      if (!room) {
        return res.status(404).json({ error: 'Room not found' });
      }
      
      // 3. Fetch participant list
      const participantsQuery = `
      SELECT u.id as user_id, u.display_name, cp.user_type
      FROM chat_participants cp
      JOIN users u ON cp.user_id = u.id
      WHERE cp.room_id = $1
    `;
      const { rows: participants } = await db.query(participantsQuery, [roomId]);
      room.participants = participants;
      
      // 4. Adjust name for direct chats
      if (room.type === 'direct') {
        const otherParticipant = participants.find(p =>
          !(p.user_id === userId && p.user_type === userType)
        );
        if (otherParticipant) {
          room.name = otherParticipant.display_name || room.name;
        }
      }
      
      res.json(room);
      
    } catch (err) {
      console.error(`Database error in GET /rooms/${req.params.roomId}:`, err);
      res.status(500).json({ error: 'Database error' });
    }
  });
  
  // Get messages for a room
  router.get('/rooms/:roomId/messages', verifyTokenRBAC, async (req, res) => {
    try {
      const roomId = req.params.roomId;
      const limit = parseInt(req.query.limit) || 50;
      const offset = parseInt(req.query.offset) || 0;
      const userId = req.user.id;
      const userType = req.user.type;
      const organizationId = req.user.organization_id;
      
      // Check if user has access to this room (with organization check)
      const accessQuery = userType === 'admin'
      ? "SELECT 1 FROM chat_rooms WHERE id = $1 AND organization_id = $2"
      : `SELECT 1 FROM chat_participants cp 
          JOIN chat_rooms cr ON cp.room_id = cr.id 
          WHERE cp.room_id = $1 AND cp.user_id = $2 AND cp.user_type = $3 AND cr.organization_id = $4`;
      const accessParams = userType === 'admin' ? [roomId, organizationId] : [roomId, userId, userType, organizationId];
      const { rows: [access] } = await db.query(accessQuery, accessParams);
      
      if (!access) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      const messagesQuery = `
      SELECT m.*, 
              m.user_id as sender_id,
              m.user_type as sender_type,
              u.display_name as sender_name,
              u.username as sender_username,
              p.question, p.options, p.expires_at, p.multiple_choice,
              p.id as poll_id,
              CASE 
                WHEN m.deleted_at IS NOT NULL THEN 'Diese Nachricht wurde gelöscht'
                ELSE m.content
              END as content,
              CASE 
                WHEN m.deleted_at IS NOT NULL THEN true
                ELSE false
              END as is_deleted
      FROM chat_messages m
      LEFT JOIN users u ON m.user_id = u.id
      LEFT JOIN chat_polls p ON m.id = p.message_id
      WHERE m.room_id = $1
      ORDER BY m.created_at DESC
      LIMIT $2 OFFSET $3
    `;
      const { rows: messages } = await db.query(messagesQuery, [roomId, limit, offset]);
      
      // Load votes for poll messages
      const processedMessages = await Promise.all(messages.map(async (msg) => {
        if (msg.message_type === 'poll' && msg.options) {
          // Parse options from JSON string (since stored as TEXT in chat_polls table)
          try {
            msg.options = JSON.parse(msg.options);
          } catch (e) {
            console.error('Failed to parse poll options:', msg.options, e);
            msg.options = [];
          }
          const votesQuery = `
          SELECT v.*, u.display_name as voter_name
          FROM chat_poll_votes v
          LEFT JOIN users u ON v.user_id = u.id
          WHERE v.poll_id = $1
        `;
          const { rows: votes } = await db.query(votesQuery, [msg.poll_id]);
          msg.votes = votes || [];
          msg.multiple_choice = Boolean(msg.multiple_choice);
        }
        return msg;
      }));
      
      res.json(processedMessages.reverse());
    } catch (err) {
      console.error(`Database error in GET /rooms/${req.params.roomId}/messages:`, err);
      res.status(500).json({ error: 'Database error' });
    }
  });
  
  // Send message
  router.post('/rooms/:roomId/messages', verifyTokenRBAC, chatUpload.single('file'), async (req, res) => {
    try {
      const roomId = req.params.roomId;
      const { content, message_type = 'text', reply_to } = req.body;
      const userId = req.user.id;
      const userType = req.user.type;
      
      if (!content && !req.file) {
        return res.status(400).json({ error: 'Content or file required' });
      }
      
      // Check access
      const accessQuery = userType === 'admin'
      ? "SELECT 1 FROM chat_rooms WHERE id = $1"
      : "SELECT 1 FROM chat_participants WHERE room_id = $1 AND user_id = $2 AND user_type = $3";
      const accessParams = userType === 'admin' ? [roomId] : [roomId, userId, userType];
      const { rows: [access] } = await db.query(accessQuery, accessParams);
      if (!access) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      // Process file
      let filePath = null, fileName = null, fileSize = null;
      let actualMessageType = message_type;
      if (req.file) {
        filePath = req.file.filename;
        fileName = req.file.originalname;
        fileSize = req.file.size;
        const ext = path.extname(fileName).toLowerCase();
        if (['.jpg', '.jpeg', '.png', '.gif', '.heic', '.webp'].includes(ext)) {
          actualMessageType = 'image';
        } else if (['.mp4', '.mov', '.avi'].includes(ext)) {
          actualMessageType = 'video';
        } else {
          actualMessageType = 'file';
        }
      }
      
      // Insert message and get its ID back
      const insertQuery = `
      INSERT INTO chat_messages (room_id, user_id, user_type, message_type, content, file_path, file_name, file_size, reply_to)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id
    `;
      const { rows: [newMessage] } = await db.query(insertQuery, [roomId, userId, userType, actualMessageType, content, filePath, fileName, fileSize, reply_to]);
      const messageId = newMessage.id;
      
      // Fetch the complete message object to send back and for push notifications
      const messageQuery = `
      SELECT m.*, 
              m.user_id as sender_id,
              m.user_type as sender_type,
              u.display_name as sender_name,
              u.username as sender_username
      FROM chat_messages m
      JOIN users u ON m.user_id = u.id
      WHERE m.id = $1
    `;
      const { rows: [message] } = await db.query(messageQuery, [messageId]);
      
      res.json(message); // Respond immediately
      
      // Asynchronously send push notifications
      (async () => {
        try {
          const getParticipantsQuery = `
          SELECT user_id, user_type FROM chat_participants
          WHERE room_id = $1 AND NOT (user_id = $2 AND user_type = $3)
        `;
          const { rows: participants } = await db.query(getParticipantsQuery, [roomId, userId, userType]);
          if (!participants) return;
          
          const { rows: [room] } = await db.query('SELECT name, type FROM chat_rooms WHERE id = $1', [roomId]);
          const roomName = room?.name || 'Chat';
          const isDirectChat = room?.type === 'direct';
          const pushTitle = isDirectChat ? message.sender_name : roomName;
          const pushBody = isDirectChat
          ? (content || '[Anhang]')
          : `${message.sender_name}: ${content || '[Anhang]'}`;
          
          for (const p of participants) {
            const badgeQuery = `
            SELECT COUNT(DISTINCT cm.id) as total_unread
            FROM chat_messages cm
            JOIN chat_participants cp ON cm.room_id = cp.room_id
            LEFT JOIN chat_read_status crs ON cm.room_id = crs.room_id AND crs.user_id = $1 AND crs.user_type = $2
            WHERE cp.user_id = $1
            AND cp.user_type = $2
            AND cm.created_at > COALESCE(crs.last_read_at, '1970-01-01')
            AND cm.deleted_at IS NULL
            AND NOT (cm.user_id = $1 AND cm.user_type = $2)
          `;
            const { rows: [badgeResult] } = await db.query(badgeQuery, [p.user_id, p.user_type]);
            const badgeCount = parseInt(badgeResult?.total_unread || '0', 10);
            console.log(`📱 Badge count for user ${p.user_id}: ${badgeCount} (including new message)`);
            
            await PushService.sendChatNotification(db, p.user_id, {
              title: pushTitle,
              body: pushBody,
              badge: badgeCount,
              roomId: roomId,
              messageId: message.id,
              data: {
                sender_id: userId,
                sender_name: message.sender_name,
                room_name: roomName,
                room_type: room?.type || 'unknown'
              }
            });
          }
        } catch (pushError) {
          console.error('❌ Failed to send chat push notification:', pushError);
        }
      })();
      
    } catch (err) {
      console.error(`Database error in POST /rooms/${req.params.roomId}/messages:`, err);
      res.status(500).json({ error: 'Database error' });
    }
  });
  // Mark room as read
  // NOTE: The on-demand table creation logic from the original sqlite3 code has been removed.
  // In a production environment, database schema should be managed by dedicated migration scripts,
  // not created at runtime by API endpoints.
  router.post('/rooms/:roomId/mark-read', verifyTokenRBAC, async (req, res) => {
    try {
      const roomId = req.params.roomId;
      const userId = req.user.id;
      const userType = req.user.type;
      
      // Use PostgreSQL's "UPSERT" functionality (INSERT ON CONFLICT)
      const query = `
      INSERT INTO chat_read_status (room_id, user_id, user_type, last_read_at)
      VALUES ($1, $2, $3, NOW())
      ON CONFLICT (room_id, user_id, user_type)
      DO UPDATE SET last_read_at = NOW();
    `;
      
      const { rowCount } = await db.query(query, [roomId, userId, userType]);
      
      console.log(`✅ Room ${roomId} marked as read for user ${userId} (${userType})`);
      res.json({ message: 'Room marked as read', affected: rowCount });
      
    } catch (err) {
      console.error(`Database error in POST /rooms/${req.params.roomId}/mark-read:`, err);
      res.status(500).json({ error: 'Database error: ' + err.message });
    }
  });
  
  // Get room participants
  router.get('/rooms/:roomId/participants', verifyTokenRBAC, async (req, res) => {
    try {
      const roomId = req.params.roomId;
      const userId = req.user.id;
      const userType = req.user.type;
      
      // Check if user has access to this room
      const accessQuery = userType === 'admin' 
      ? "SELECT 1 FROM chat_rooms WHERE id = $1" 
      : "SELECT 1 FROM chat_participants WHERE room_id = $1 AND user_id = $2 AND user_type = $3";
      const accessParams = userType === 'admin' ? [roomId] : [roomId, userId, userType];
      
      const { rows: [access] } = await db.query(accessQuery, accessParams);
      if (!access) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      // Get participants with their details
      const query = `
      SELECT 
        cp.user_id,
        cp.user_type,
        cp.joined_at,
        u.display_name as name,
        CASE 
          WHEN cp.user_type = 'admin' THEN NULL
          ELSE kp.jahrgang_id
        END as jahrgang_id,
        CASE 
          WHEN cp.user_type = 'admin' THEN NULL
          ELSE j.name
        END as jahrgang_name
      FROM chat_participants cp
      LEFT JOIN users u ON cp.user_id = u.id
      LEFT JOIN roles r ON u.role_id = r.id
      LEFT JOIN konfi_profiles kp ON cp.user_type = 'konfi' AND cp.user_id = kp.user_id
      LEFT JOIN jahrgaenge j ON kp.jahrgang_id = j.id
      WHERE cp.room_id = $1
      ORDER BY cp.joined_at ASC
    `;
      
      const { rows: participants } = await db.query(query, [roomId]);
      res.json(participants);
      
    } catch (err) {
      console.error(`Database error in GET /rooms/${req.params.roomId}/participants:`, err);
      res.status(500).json({ error: 'Database error' });
    }
  });
  
  // Add participant to room
  router.post('/rooms/:roomId/participants', verifyTokenRBAC, async (req, res) => {
    try {
      const roomId = req.params.roomId;
      const { user_id, user_type } = req.body;
      const requesterType = req.user.type;
      
      if (requesterType !== 'admin') {
        return res.status(403).json({ error: 'Only admins can add participants' });
      }
      if (!user_id || !user_type) {
        return res.status(400).json({ error: 'user_id and user_type are required' });
      }
      if (!['admin', 'konfi'].includes(user_type)) {
        return res.status(400).json({ error: 'Invalid user_type' });
      }
      
      const { rows: [room] } = await db.query("SELECT type FROM chat_rooms WHERE id = $1", [roomId]);
      if (!room) {
        return res.status(404).json({ error: 'Room not found' });
      }
      if (room.type !== 'group') {
        return res.status(400).json({ error: 'Can only add participants to group chats' });
      }
      
      const { rows: [existing] } = await db.query("SELECT 1 FROM chat_participants WHERE room_id = $1 AND user_id = $2 AND user_type = $3", [roomId, user_id, user_type]);
      if (existing) {
        return res.status(409).json({ error: 'User is already a participant' });
      }
      
      await db.query("INSERT INTO chat_participants (room_id, user_id, user_type) VALUES ($1, $2, $3)", [roomId, user_id, user_type]);
      res.status(201).json({ message: 'Participant added successfully' });
      
    } catch (err) {
      // Handle unique constraint violation in case of a race condition
      if (err.code === '23505') {
        return res.status(409).json({ error: 'User is already a participant' });
      }
      console.error(`Database error in POST /rooms/${req.params.roomId}/participants:`, err);
      res.status(500).json({ error: 'Database error' });
    }
  });
  
  // Remove participant from room
  router.delete('/rooms/:roomId/participants/:userId/:userType', verifyTokenRBAC, async (req, res) => {
    try {
      const roomId = req.params.roomId;
      const userId = parseInt(req.params.userId);
      const userType = req.params.userType;
      const requesterType = req.user.type;
      
      if (requesterType !== 'admin') {
        return res.status(403).json({ error: 'Only admins can remove participants' });
      }
      
      const { rows: [room] } = await db.query("SELECT type FROM chat_rooms WHERE id = $1", [roomId]);
      if (!room) {
        return res.status(404).json({ error: 'Room not found' });
      }
      if (room.type !== 'group') {
        return res.status(400).json({ error: 'Can only remove participants from group chats' });
      }
      
      const { rowCount } = await db.query("DELETE FROM chat_participants WHERE room_id = $1 AND user_id = $2 AND user_type = $3", [roomId, userId, userType]);
      if (rowCount === 0) {
        return res.status(404).json({ error: 'Participant not found' });
      }
      
      res.json({ message: 'Participant removed successfully' });
    } catch (err) {
      console.error(`Database error in DELETE /rooms/${req.params.roomId}/participants/...:`, err);
      res.status(500).json({ error: 'Database error' });
    }
  });
  
  // Serve chat files with authentication
  router.get('/files/:filename', verifyTokenRBAC, (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(uploadsDir, 'chat', filename);
    
    if (fs.existsSync(filePath)) {
      // Set correct content type for different file types
      const ext = path.extname(filename).toLowerCase();
      const contentTypes = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg', 
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.pdf': 'application/pdf',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
      };
      
      if (contentTypes[ext]) {
        res.setHeader('Content-Type', contentTypes[ext]);
      }
      
      res.sendFile(filePath);
    } else {
      res.status(404).json({ error: 'File not found' });
    }
  });

  // Badge update endpoint for Background Refresh
  router.post('/badge-update', verifyTokenRBAC, async (req, res) => {
    try {
      const userId = req.user.id;
      const userType = req.user.type;
      
      // Use the consistent query for unread counts, referencing chat_read_status
      const badgeQuery = `
      SELECT COUNT(DISTINCT m.id) as total_unread
      FROM chat_messages m
      JOIN chat_participants p ON m.room_id = p.room_id
      LEFT JOIN chat_read_status crs ON m.room_id = crs.room_id AND p.user_id = crs.user_id AND p.user_type = crs.user_type
      WHERE p.user_id = $1
        AND p.user_type = $2
        AND m.created_at > COALESCE(crs.last_read_at, '1970-01-01')
        AND m.deleted_at IS NULL
        AND m.user_id != $1
    `;
      const { rows: [result] } = await db.query(badgeQuery, [userId, userType]);
      const badgeCount = parseInt(result?.total_unread || '0', 10);
      
      // Send badge update via Push Notification
      await PushService.sendBadgeUpdate(db, userId, badgeCount);
      
      res.json({
        success: true,
        badgeCount: badgeCount,
        message: `Badge updated to ${badgeCount}`
      });
      
    } catch (error) {
      // The push service might throw an error, which should be caught but not treated as a 500
      if (error.isPushServiceError) {
        console.error('❌ Push badge update failed:', error);
        res.status(502).json({ 
          success: false, 
          error: 'Push notification failed' 
        });
      } else {
        console.error('❌ Badge update endpoint error:', error);
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  });

  // ====================================================================
  // MISSING ROUTES FROM SQLITE VERSION
  // ====================================================================
  
  // Protected file serving route
  router.get('/files/:filename', verifyTokenRBAC, async (req, res) => {
    try {
      const filename = req.params.filename;
      
      // Check if user has access to this file by checking chat membership
      const { rows: [fileMessage] } = await db.query(
        `SELECT cm.room_id 
         FROM chat_messages cm 
         WHERE cm.file_path = $1 AND cm.organization_id = $2`,
        [filename, req.user.organization_id]
      );
      
      if (!fileMessage) {
        return res.status(404).json({ error: 'File not found' });
      }
      
      // Check if user is member of the chat room
      const { rows: [membership] } = await db.query(
        `SELECT 1 FROM chat_participants cp 
         WHERE cp.room_id = $1 AND cp.user_id = $2`,
        [fileMessage.room_id, req.user.id]
      );
      
      if (!membership) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      const filePath = path.join(uploadsDir, 'chat', filename);
      
      if (fs.existsSync(filePath)) {
        res.sendFile(filePath);
      } else {
        res.status(404).json({ error: 'File not found on disk' });
      }
    } catch (error) {
      console.error('Error serving chat file:', error);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Create poll for a room
  router.post('/rooms/:roomId/polls', verifyTokenRBAC, async (req, res) => {
    const roomId = req.params.roomId;
    const { question, options, multiple_choice = false, expires_in_hours } = req.body;
    const userId = req.user.id;
    const userType = req.user.type;
    
    console.log('Poll creation request:', { question, options, multiple_choice, expires_in_hours });
    
    // Only admins can create polls
    if (userType !== 'admin') {
      return res.status(403).json({ error: 'Only admins can create polls' });
    }
    
    // Validate input
    if (!question || !question.trim()) {
      return res.status(400).json({ error: 'Question is required' });
    }
    
    if (!options || !Array.isArray(options) || options.length < 2) {
      return res.status(400).json({ error: 'At least 2 options are required' });
    }
    
    const validOptions = options.filter(opt => opt && opt.trim());
    if (validOptions.length < 2) {
      return res.status(400).json({ error: 'At least 2 valid options are required' });
    }
    
    try {
      // Check if user has access to this room
      const { rows: [room] } = await db.query("SELECT 1 FROM chat_rooms WHERE id = $1 AND organization_id = $2", [roomId, req.user.organization_id]);
      
      if (!room) {
        return res.status(404).json({ error: 'Room not found' });
      }
      
      // Calculate expires_at
      let expiresAt = null;
      if (expires_in_hours && expires_in_hours > 0) {
        expiresAt = new Date(Date.now() + expires_in_hours * 60 * 60 * 1000);
      }
      
      await db.query('BEGIN');
      
      // First create the message
      const messageQuery = `
        INSERT INTO chat_messages (room_id, user_id, user_type, message_type, content, created_at)
        VALUES ($1, $2, $3, 'poll', $4, NOW())
        RETURNING id
      `;
      const { rows: [newMessage] } = await db.query(messageQuery, [roomId, userId, userType, question]);
      const messageId = newMessage.id;
      
      // Then create the poll
      const pollQuery = `
        INSERT INTO chat_polls (message_id, question, options, multiple_choice, expires_at, created_at)
        VALUES ($1, $2, $3, $4, $5, NOW())
        RETURNING id
      `;
      const { rows: [newPoll] } = await db.query(pollQuery, [
        messageId, 
        question, 
        JSON.stringify(validOptions),
        multiple_choice,
        expiresAt
      ]);
      
      await db.query('COMMIT');
      
      // Return the created poll
      res.status(201).json({
        id: newPoll.id,
        message_id: messageId,
        question: question,
        options: validOptions,
        multiple_choice: multiple_choice,
        expires_at: expiresAt,
        votes: []
      });
      
    } catch (err) {
      await db.query('ROLLBACK').catch(rbErr => console.error('Rollback failed:', rbErr));
      console.error('Database error in POST /rooms/:roomId/polls:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // Vote for a poll (by poll ID)
  router.post('/polls/:pollId/vote', verifyTokenRBAC, async (req, res) => {
    const pollId = req.params.pollId;
    const { option_index } = req.body;
    const userId = req.user.id;
    const userType = req.user.type;
    
    console.log(`🗳️ Poll voting request: pollId=${pollId}, option=${option_index}, user=${userId} (${userType})`);
    
    if (option_index === undefined || option_index === null) {
      return res.status(400).json({ error: 'Option index is required' });
    }
    
    try {
      // Get the poll - try by poll_id first, then by message_id (frontend compatibility)
      let getPollQuery = `
        SELECT p.*, m.room_id FROM chat_polls p
        JOIN chat_messages m ON p.message_id = m.id
        WHERE p.id = $1
      `;
      let { rows: [poll] } = await db.query(getPollQuery, [pollId]);
      
      // If not found by poll_id, try by message_id (frontend might be sending message_id)
      if (!poll) {
        console.log(`Poll not found by ID ${pollId}, trying as message_id...`);
        getPollQuery = `
          SELECT p.*, m.room_id FROM chat_polls p
          JOIN chat_messages m ON p.message_id = m.id
          WHERE p.message_id = $1
        `;
        const result = await db.query(getPollQuery, [pollId]);
        poll = result.rows[0];
      }
      
      if (!poll) {
        return res.status(404).json({ error: 'Poll not found' });
      }
      
      // Check if poll has expired
      if (poll.expires_at && new Date(poll.expires_at) < new Date()) {
        return res.status(400).json({ error: 'Poll has expired' });
      }
      
      // Parse options and validate option_index
      let parsedOptions;
      try {
        parsedOptions = JSON.parse(poll.options);
      } catch (e) {
        console.error('Failed to parse poll options:', poll.options);
        return res.status(500).json({ error: 'Invalid poll data' });
      }
      
      if (option_index < 0 || option_index >= parsedOptions.length) {
        return res.status(400).json({ error: 'Invalid option index' });
      }
      
      // Check if user has access to the room
      const accessQuery = `
        SELECT 1 FROM chat_participants cp 
        JOIN chat_rooms cr ON cp.room_id = cr.id 
        WHERE cp.room_id = $1 AND cp.user_id = $2 AND cp.user_type = $3 AND cr.organization_id = $4
      `;
      const { rows: [access] } = await db.query(accessQuery, [poll.room_id, userId, userType, req.user.organization_id]);
      
      if (!access) {
        return res.status(403).json({ error: 'Access denied to this room' });
      }
      
      await db.query('BEGIN');
      
      // Use the actual poll.id from database, not the request pollId (which might be message_id)
      const actualPollId = poll.id;
      
      // Check if user already voted for this specific option
      const { rows: [existingVote] } = await db.query(
        "SELECT 1 FROM chat_poll_votes WHERE poll_id = $1 AND user_id = $2 AND user_type = $3 AND option_index = $4",
        [actualPollId, userId, userType, option_index]
      );
      
      if (existingVote) {
        // If already voted for this option, remove the vote (toggle off)
        await db.query(
          "DELETE FROM chat_poll_votes WHERE poll_id = $1 AND user_id = $2 AND user_type = $3 AND option_index = $4",
          [actualPollId, userId, userType, option_index]
        );
        await db.query('COMMIT');
        return res.json({ 
          message: 'Vote removed successfully',
          poll_id: actualPollId,
          option_index: option_index,
          user_id: userId,
          action: 'removed'
        });
      }
      
      // For single choice polls, remove any existing votes before adding new one
      if (!poll.multiple_choice) {
        await db.query(
          "DELETE FROM chat_poll_votes WHERE poll_id = $1 AND user_id = $2 AND user_type = $3",
          [actualPollId, userId, userType]
        );
      }
      
      // Add the new vote
      await db.query(
        "INSERT INTO chat_poll_votes (poll_id, user_id, user_type, option_index, created_at) VALUES ($1, $2, $3, $4, NOW())",
        [actualPollId, userId, userType, option_index]
      );
      
      await db.query('COMMIT');
      
      res.json({ 
        message: 'Vote recorded successfully',
        poll_id: actualPollId,
        option_index: option_index,
        user_id: userId,
        action: 'added'
      });
      
    } catch (err) {
      await db.query('ROLLBACK').catch(rbErr => console.error('Rollback failed:', rbErr));
      console.error('Database error in POST /polls/:pollId/vote:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // Delete message (soft delete)
  router.delete('/messages/:messageId', verifyTokenRBAC, async (req, res) => {
    const messageId = req.params.messageId;
    const userId = req.user.id;
    const userType = req.user.type;
    
    try {
      // Get message details and check ownership
      const messageQuery = `
        SELECT m.*, cr.organization_id 
        FROM chat_messages m 
        JOIN chat_rooms cr ON m.room_id = cr.id 
        WHERE m.id = $1
      `;
      const { rows: [message] } = await db.query(messageQuery, [messageId]);
      
      if (!message) {
        return res.status(404).json({ error: 'Message not found' });
      }
      
      // Check if user can delete this message (own message or admin in same org)
      const canDelete = (message.user_id == userId && message.user_type === userType) || 
                       (userType === 'admin' && message.organization_id == req.user.organization_id);
      
      if (!canDelete) {
        return res.status(403).json({ error: 'You can only delete your own messages' });
      }
      
      // Soft delete the message
      await db.query("UPDATE chat_messages SET deleted_at = NOW() WHERE id = $1", [messageId]);
      
      res.json({ message: 'Message deleted successfully' });
      
    } catch (err) {
      console.error('Database error in DELETE /messages/:messageId:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  // Vote for a poll (by message ID - for frontend compatibility)
  router.post('/messages/:messageId/vote', verifyTokenRBAC, async (req, res) => {
    const messageId = req.params.messageId;
    const { option_index } = req.body;
    const userId = req.user.id;
    const userType = req.user.type;
    
    console.log(`🗳️ Poll voting by messageId: messageId=${messageId}, option=${option_index}, user=${userId} (${userType})`);
    
    if (option_index === undefined || option_index === null) {
      return res.status(400).json({ error: 'Option index is required' });
    }
    
    try {
      // Get the poll by message_id
      const getPollQuery = `
        SELECT p.*, m.room_id FROM chat_polls p
        JOIN chat_messages m ON p.message_id = m.id
        WHERE p.message_id = $1
      `;
      
      const { rows: [poll] } = await db.query(getPollQuery, [messageId]);
      
      if (!poll) {
        return res.status(404).json({ error: 'Poll not found for this message' });
      }
      
      // Check if poll has expired
      if (poll.expires_at && new Date(poll.expires_at) < new Date()) {
        return res.status(400).json({ error: 'Poll has expired' });
      }
      
      // Parse options and validate option_index
      let parsedOptions;
      try {
        parsedOptions = JSON.parse(poll.options);
      } catch (e) {
        console.error('Failed to parse poll options:', poll.options);
        return res.status(500).json({ error: 'Invalid poll data' });
      }
      
      if (option_index < 0 || option_index >= parsedOptions.length) {
        return res.status(400).json({ error: 'Invalid option index' });
      }
      
      // Check if user has access to the room
      const accessQuery = `
        SELECT 1 FROM chat_participants cp 
        JOIN chat_rooms cr ON cp.room_id = cr.id 
        WHERE cp.room_id = $1 AND cp.user_id = $2 AND cp.user_type = $3 AND cr.organization_id = $4
      `;
      const { rows: [access] } = await db.query(accessQuery, [poll.room_id, userId, userType, req.user.organization_id]);
      
      if (!access) {
        return res.status(403).json({ error: 'Access denied to this room' });
      }
      
      await db.query('BEGIN');
      
      // For single choice polls, remove existing vote
      if (!poll.multiple_choice) {
        await db.query(
          "DELETE FROM chat_poll_votes WHERE poll_id = $1 AND user_id = $2 AND user_type = $3",
          [poll.id, userId, userType]
        );
      } else {
        // For multiple choice, check if user already voted for this option
        const { rows: [existingVote] } = await db.query(
          "SELECT 1 FROM chat_poll_votes WHERE poll_id = $1 AND user_id = $2 AND user_type = $3 AND option_index = $4",
          [poll.id, userId, userType, option_index]
        );
        
        if (existingVote) {
          await db.query('ROLLBACK');
          return res.status(400).json({ error: 'You have already voted for this option' });
        }
      }
      
      // Add the new vote
      await db.query(
        "INSERT INTO chat_poll_votes (poll_id, user_id, user_type, option_index, created_at) VALUES ($1, $2, $3, $4, NOW())",
        [poll.id, userId, userType, option_index]
      );
      
      await db.query('COMMIT');
      
      res.json({ 
        message: 'Vote recorded successfully',
        poll_id: poll.id,
        message_id: parseInt(messageId),
        option_index: option_index,
        user_id: userId
      });
      
    } catch (err) {
      await db.query('ROLLBACK').catch(rbErr => console.error('Rollback failed:', rbErr));
      console.error('Database error in POST /messages/:messageId/vote:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });
  
  // DELETE a chat room (Admin only)
  router.delete('/rooms/:roomId', verifyTokenRBAC, async (req, res) => {
    const roomId = req.params.roomId;
    const userId = req.user.id;
    const userType = req.user.type;
    const forceDelete = req.query.force === 'true';
    
    if (userType !== 'admin') {
      return res.status(403).json({ error: 'Only admins can delete chat rooms' });
    }
    
    try {
      // Get room details
      const { rows: [room] } = await db.query("SELECT * FROM chat_rooms WHERE id = $1 AND organization_id = $2", [roomId, req.user.organization_id]);
      if (!room) {
        return res.status(404).json({ error: 'Chat-Raum nicht gefunden' });
      }
      
      // Check if room has messages
      const { rows: [messageCount] } = await db.query("SELECT COUNT(*)::int as count FROM chat_messages WHERE room_id = $1 AND deleted_at IS NULL", [roomId]);
      
      if (messageCount.count > 0 && !forceDelete) {
        // All admins can force delete chat rooms
        return res.status(409).json({ 
          error: `Chat-Raum kann nicht gelöscht werden: ${messageCount.count} Nachricht(en) vorhanden.`,
          canForceDelete: true
        });
      }
      
      // Prevent deletion of system rooms (jahrgang chats can only be deleted via jahrgang)
      if (room.type === 'jahrgang') {
        return res.status(409).json({ 
          error: 'Jahrgangs-Chat-Räume können nicht direkt gelöscht werden. Bitte den Jahrgang löschen.'
        });
      }
      
      // Direct chats can be deleted by admins (no restrictions)
      
      await db.query('BEGIN');
      
      // If force delete or no messages, proceed with deletion
      if (forceDelete || messageCount.count === 0) {
        // Get all files before deleting messages (for file cleanup)
        const { rows: filesForDeletion } = await db.query("SELECT file_path FROM chat_messages WHERE room_id = $1 AND file_path IS NOT NULL", [roomId]);
        
        // Delete in correct order due to foreign keys
        // 1. Delete poll votes first (polls are linked via message_id, not room_id)
        await db.query(`
          DELETE FROM chat_poll_votes WHERE poll_id IN (
            SELECT cp.id FROM chat_polls cp 
            JOIN chat_messages cm ON cp.message_id = cm.id 
            WHERE cm.room_id = $1
          )
        `, [roomId]);
        
        // 2. Delete polls (via message_id)
        await db.query(`
          DELETE FROM chat_polls WHERE message_id IN (
            SELECT id FROM chat_messages WHERE room_id = $1
          )
        `, [roomId]);
        
        // 3. Delete read status
        await db.query("DELETE FROM chat_read_status WHERE room_id = $1", [roomId]);
        
        // 4. Delete messages
        await db.query("DELETE FROM chat_messages WHERE room_id = $1", [roomId]);
        
        // 5. Delete participants
        await db.query("DELETE FROM chat_participants WHERE room_id = $1", [roomId]);
        
        // 6. Delete room itself
        await db.query("DELETE FROM chat_rooms WHERE id = $1", [roomId]);
        
        // 7. Clean up files from filesystem (best effort, don't fail if files don't exist)
        const fs = require('fs').promises;
        const path = require('path');
        
        for (const fileRecord of filesForDeletion) {
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
      
      await db.query('COMMIT');
      res.json({ message: 'Chat-Raum erfolgreich gelöscht' });
      
    } catch (err) {
      await db.query('ROLLBACK').catch(rbErr => console.error('Rollback failed:', rbErr));
      console.error(`Database error in DELETE /rooms/${roomId}:`, err);
      res.status(500).json({ error: 'Database error' });
    }
  });
  
  // Get available chat partners for Konfis
  router.get('/available-users', verifyTokenRBAC, async (req, res) => {
    try {
      const userId = req.user.id;
      const userType = req.user.type;
      const organizationId = req.user.organization_id;

      // Nur für Konfis verfügbar
      if (userType !== 'konfi') {
        return res.status(403).json({ error: 'Only Konfis can use this endpoint' });
      }

      // 1. Get Konfi's jahrgang
      const konfiQuery = `
        SELECT kp.jahrgang_id, j.name as jahrgang_name
        FROM konfi_profiles kp
        JOIN jahrgaenge j ON kp.jahrgang_id = j.id
        WHERE kp.user_id = $1
      `;
      const { rows: [konfiProfile] } = await db.query(konfiQuery, [userId]);
      
      if (!konfiProfile || !konfiProfile.jahrgang_id) {
        return res.status(400).json({ error: 'Konfi not assigned to jahrgang' });
      }

      let availableUsers = [];
      
      // 2. Get chat permissions from settings
      const settingsQuery = `SELECT konfi_chat_permissions FROM settings WHERE organization_id = $1`;
      const { rows: [settings] } = await db.query(settingsQuery, [organizationId]);
      const chatPermissions = settings?.konfi_chat_permissions || 'admins_only';

      // 3. Always include admins assigned to the same jahrgang
      const adminQuery = `
        SELECT DISTINCT u.id, u.display_name as name, 'admin' as type, null as jahrgang_name
        FROM users u
        JOIN roles r ON u.role_id = r.id
        JOIN user_jahrgang_assignments uja ON u.id = uja.user_id
        WHERE r.name = 'admin' 
        AND u.organization_id = $1
        AND uja.jahrgang_id = $2
        AND uja.can_view = true
        AND u.id != $3
        ORDER BY u.display_name
      `;
      const { rows: admins } = await db.query(adminQuery, [organizationId, konfiProfile.jahrgang_id, userId]);
      availableUsers = [...admins];

      // 4. Add other Konfis if allowed by settings
      if (chatPermissions === 'all_in_jahrgang') {
        const konfiQuery = `
          SELECT u.id, u.display_name as name, 'konfi' as type, j.name as jahrgang_name
          FROM users u
          JOIN roles r on u.role_id = r.id
          JOIN konfi_profiles kp ON u.id = kp.user_id
          JOIN jahrgaenge j ON kp.jahrgang_id = j.id
          WHERE r.name = 'konfi'
          AND u.organization_id = $1
          AND kp.jahrgang_id = $2
          AND u.id != $3
          ORDER BY u.display_name
        `;
        const { rows: konfis } = await db.query(konfiQuery, [organizationId, konfiProfile.jahrgang_id, userId]);
        availableUsers = [...availableUsers, ...konfis];
      }

      // 5. Get existing direct chats to filter out duplicates
      const existingChatsQuery = `
        SELECT DISTINCT 
          CASE 
            WHEN cp1.user_id = $1 THEN cp2.user_id
            ELSE cp1.user_id
          END as partner_id,
          CASE 
            WHEN cp1.user_id = $1 THEN cp2.user_type
            ELSE cp1.user_type
          END as partner_type
        FROM chat_participants cp1
        JOIN chat_participants cp2 ON cp1.room_id = cp2.room_id
        JOIN chat_rooms cr ON cp1.room_id = cr.id
        WHERE cr.type = 'direct'
        AND cr.organization_id = $2
        AND ((cp1.user_id = $1 AND cp1.user_type = $3) OR (cp2.user_id = $1 AND cp2.user_type = $3))
        AND cp1.user_id != cp2.user_id
      `;
      const { rows: existingChats } = await db.query(existingChatsQuery, [userId, organizationId, userType]);
      const existingPartnerKeys = new Set(existingChats.map(chat => `${chat.partner_id}_${chat.partner_type}`));

      // 6. Filter out users with existing direct chats
      const filteredUsers = availableUsers.filter(user => {
        const key = `${user.id}_${user.type}`;
        return !existingPartnerKeys.has(key);
      });

      res.json({
        users: filteredUsers,
        jahrgang: konfiProfile.jahrgang_name,
        permissions: chatPermissions
      });

    } catch (err) {
      console.error('Database error in GET /chat/available-users:', err);
      res.status(500).json({ error: 'Database error' });
    }
  });

  return router;
};