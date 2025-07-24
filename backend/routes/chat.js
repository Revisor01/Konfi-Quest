const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const PushService = require('../services/pushService');

module.exports = (db, rbacMiddleware, uploadsDir) => {
  const { verifyTokenRBAC } = rbacMiddleware;
// Chat file upload setup
const chatUpload = multer({ 
  dest: path.join(uploadsDir, 'chat'),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedExtensions = /\.(jpeg|jpg|png|gif|heic|webp|pdf|mp3|wav|m4a|mp4|mov|avi|docx|txt|pptx|xlsx|rtf|zip)$/i;
    const extname = allowedExtensions.test(file.originalname);
    
    // Check MIME types more specifically
    const allowedMimeTypes = [
      'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/heic', 'image/webp',
      'application/pdf',
      'audio/mpeg', 'audio/wav', 'audio/x-m4a', 'audio/mp4',
      'video/mp4', 'video/quicktime', 'video/x-msvideo',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // docx
      'application/vnd.openxmlformats-officedocument.presentationml.presentation', // pptx  
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // xlsx
      'text/plain', 'text/rtf', 'application/rtf',
      'application/zip', 'application/x-zip-compressed'
    ];
    const mimetype = allowedMimeTypes.includes(file.mimetype);
    
    if (extname && mimetype) {
      return cb(null, true);
    } else {
      console.log('Rejected file:', file.originalname, 'MIME:', file.mimetype);
      cb(new Error('Dateityp nicht erlaubt'));
    }
  }
});

// === UTILITY FUNCTIONS ===

// Ensure admin is in all their assigned jahrgang chats (and remove from unassigned ones)
const ensureAdminJahrgangChatMembership = (db, adminId) => {
  // Get admin's jahrgang assignments
  const assignmentsQuery = `
    SELECT uja.jahrgang_id, j.name as jahrgang_name
    FROM user_jahrgang_assignments uja
    JOIN jahrgaenge j ON uja.jahrgang_id = j.id
    WHERE uja.user_id = ? AND uja.can_view = 1
  `;
  
  db.all(assignmentsQuery, [adminId], (err, assignments) => {
    if (err) return;
    
    const assignedJahrgangIds = assignments ? assignments.map(a => a.jahrgang_id) : [];
    
    // First: Remove admin from jahrgang chats they're no longer assigned to
    const removeQuery = `
      DELETE FROM chat_participants 
      WHERE user_id = ? AND user_type = 'admin' AND room_id IN (
        SELECT cr.id FROM chat_rooms cr 
        WHERE cr.type = 'jahrgang' 
        ${assignedJahrgangIds.length > 0 ? 
          `AND cr.jahrgang_id NOT IN (${assignedJahrgangIds.map(() => '?').join(',')})` : 
          ''
        }
      )
    `;
    
    const removeParams = [adminId, ...assignedJahrgangIds];
    db.run(removeQuery, removeParams, function(err) {
      if (!err && this.changes > 0) {
        console.log(`Removed admin ${adminId} from ${this.changes} unassigned jahrgang chat(s)`);
      }
    });
    
    // Second: Add admin to assigned jahrgang chats
    assignments.forEach(assignment => {
      // Check if jahrgang chat exists
      const chatExistsQuery = `
        SELECT id FROM chat_rooms 
        WHERE type = 'jahrgang' AND jahrgang_id = ?
      `;
      
      db.get(chatExistsQuery, [assignment.jahrgang_id], (err, chatRoom) => {
        if (err || !chatRoom) return;
        
        // Check if admin is already participant
        const participantExistsQuery = `
          SELECT id FROM chat_participants 
          WHERE room_id = ? AND user_id = ? AND user_type = 'admin'
        `;
        
        db.get(participantExistsQuery, [chatRoom.id, adminId], (err, participant) => {
          if (err || participant) return; // Already exists
          
          // Add admin to jahrgang chat
          const insertQuery = `
            INSERT INTO chat_participants (room_id, user_id, user_type, joined_at)
            VALUES (?, ?, 'admin', CURRENT_TIMESTAMP)
          `;
          
          db.run(insertQuery, [chatRoom.id, adminId], (err) => {
            if (!err) {
              console.log(`Added admin ${adminId} to jahrgang chat ${chatRoom.id} (${assignment.jahrgang_name})`);
            }
          });
        });
      });
    });
  });
};

// Ensure konfi is in their jahrgang chat (and remove from others)
const ensureKonfiJahrgangChatMembership = (db, konfiId) => {
  // Get konfi's jahrgang from konfi_profiles
  const jahrgangQuery = `
    SELECT kp.jahrgang_id, j.name as jahrgang_name
    FROM konfi_profiles kp
    JOIN jahrgaenge j ON kp.jahrgang_id = j.id
    WHERE kp.user_id = ? AND kp.jahrgang_id IS NOT NULL
  `;
  
  db.get(jahrgangQuery, [konfiId], (err, jahrgang) => {
    if (err) return;
    
    // First: Remove konfi from wrong jahrgang chats
    if (jahrgang) {
      const removeQuery = `
        DELETE FROM chat_participants 
        WHERE user_id = ? AND user_type = 'konfi' AND room_id IN (
          SELECT cr.id FROM chat_rooms cr 
          WHERE cr.type = 'jahrgang' AND cr.jahrgang_id != ?
        )
      `;
      
      db.run(removeQuery, [konfiId, jahrgang.jahrgang_id], function(err) {
        if (!err && this.changes > 0) {
          console.log(`Removed konfi ${konfiId} from ${this.changes} wrong jahrgang chat(s)`);
        }
      });
    } else {
      // No jahrgang assigned - remove from all jahrgang chats
      const removeAllQuery = `
        DELETE FROM chat_participants 
        WHERE user_id = ? AND user_type = 'konfi' AND room_id IN (
          SELECT cr.id FROM chat_rooms cr WHERE cr.type = 'jahrgang'
        )
      `;
      
      db.run(removeAllQuery, [konfiId], function(err) {
        if (!err && this.changes > 0) {
          console.log(`Removed konfi ${konfiId} from all jahrgang chats (no assignment)`);
        }
      });
      return;
    }
    
    // Check if jahrgang chat exists
    const chatExistsQuery = `
      SELECT id FROM chat_rooms 
      WHERE type = 'jahrgang' AND jahrgang_id = ?
    `;
    
    db.get(chatExistsQuery, [jahrgang.jahrgang_id], (err, chatRoom) => {
      if (err || !chatRoom) {
        // Create jahrgang chat if it doesn't exist
        const createChatQuery = `
          INSERT INTO chat_rooms (name, type, jahrgang_id, created_by)
          VALUES (?, 'jahrgang', ?, 1)
        `;
        const chatName = `Jahrgang ${jahrgang.jahrgang_name}`;
        
        db.run(createChatQuery, [chatName, jahrgang.jahrgang_id], function(err) {
          if (err) return;
          
          const newChatRoomId = this.lastID;
          console.log(`Created jahrgang chat ${newChatRoomId} for ${jahrgang.jahrgang_name}`);
          
          // Add konfi to the new chat
          addKonfiToChat(db, newChatRoomId, konfiId, jahrgang.jahrgang_name);
          
          // Add all other konfis from this jahrgang to the chat
          addAllJahrgangKonfisToChat(db, newChatRoomId, jahrgang.jahrgang_id);
        });
        return;
      }
      
      // Check if konfi is already participant
      const participantExistsQuery = `
        SELECT id FROM chat_participants 
        WHERE room_id = ? AND user_id = ? AND user_type = 'konfi'
      `;
      
      db.get(participantExistsQuery, [chatRoom.id, konfiId], (err, participant) => {
        if (err || participant) return; // Already exists
        
        // Add konfi to jahrgang chat
        addKonfiToChat(db, chatRoom.id, konfiId, jahrgang.jahrgang_name);
      });
    });
  });
};

const addKonfiToChat = (db, roomId, konfiId, jahrgangName) => {
  const insertQuery = `
    INSERT INTO chat_participants (room_id, user_id, user_type, joined_at)
    VALUES (?, ?, 'konfi', CURRENT_TIMESTAMP)
  `;
  
  db.run(insertQuery, [roomId, konfiId], (err) => {
    if (!err) {
      console.log(`Added konfi ${konfiId} to jahrgang chat ${roomId} (${jahrgangName})`);
    }
  });
};

const addAllJahrgangKonfisToChat = (db, roomId, jahrgangId) => {
  // Get all konfis from this jahrgang
  const konfisQuery = `
    SELECT user_id FROM konfi_profiles 
    WHERE jahrgang_id = ?
  `;
  
  db.all(konfisQuery, [jahrgangId], (err, konfis) => {
    if (err || !konfis) return;
    
    konfis.forEach(konfi => {
      // Check if already participant
      const checkQuery = `
        SELECT id FROM chat_participants 
        WHERE room_id = ? AND user_id = ? AND user_type = 'konfi'
      `;
      
      db.get(checkQuery, [roomId, konfi.user_id], (err, existing) => {
        if (err || existing) return;
        
        // Add konfi to chat
        const insertQuery = `
          INSERT INTO chat_participants (room_id, user_id, user_type, joined_at)
          VALUES (?, ?, 'konfi', CURRENT_TIMESTAMP)
        `;
        
        db.run(insertQuery, [roomId, konfi.user_id], (err) => {
          if (!err) {
            console.log(`Added konfi ${konfi.user_id} to jahrgang chat ${roomId}`);
          }
        });
      });
    });
  });
};

// === CHAT API ENDPOINTS ===

// Get admins for direct contact (konfis only)
router.get('/admins', verifyTokenRBAC, (req, res) => {
  if (req.user.type !== 'konfi') {
    return res.status(403).json({ error: 'Konfi access required' });
  }
  
  db.all("SELECT u.id, u.display_name, u.username FROM users u JOIN roles r ON u.role_id = r.id WHERE r.name = 'admin' ORDER BY u.display_name", [], (err, admins) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    res.json(admins);
  });
});

// Create or get direct chat room
router.post('/direct', verifyTokenRBAC, (req, res) => {
  const { target_user_id, target_user_type } = req.body;
  
  if (!target_user_id || !target_user_type) {
    return res.status(400).json({ error: 'Target user required' });
  }
  
  // Validate target user type
  if (!['admin', 'konfi'].includes(target_user_type)) {
    return res.status(400).json({ error: 'Invalid target user type' });
  }
  
  const user1_type = req.user.type;
  const user1_id = req.user.id;
  const user2_type = target_user_type;
  const user2_id = target_user_id;
  
  // Check if room already exists
  const existingRoomQuery = `
    SELECT r.id FROM chat_rooms r
    WHERE r.type = 'direct'
    AND EXISTS (SELECT 1 FROM chat_participants p1 WHERE p1.room_id = r.id AND p1.user_id = ? AND p1.user_type = ?)
    AND EXISTS (SELECT 1 FROM chat_participants p2 WHERE p2.room_id = r.id AND p2.user_id = ? AND p2.user_type = ?)
  `;
  
  db.get(existingRoomQuery, [user1_id, user1_type, user2_id, user2_type], (err, existingRoom) => {
    if (err) return res.status(500).json({ error: 'Database error' });
    
    if (existingRoom) {
      return res.json({ room_id: existingRoom.id, created: false });
    }
    
    // Get target user name for room title
    const targetQuery = target_user_type === 'admin' ? 
    "SELECT u.display_name as name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ? AND r.name IN ('admin', 'org_admin', 'teamer')" :
    "SELECT u.display_name as name FROM users u JOIN roles r ON u.role_id = r.id JOIN konfi_profiles kp ON u.id = kp.user_id WHERE u.id = ? AND r.name = 'konfi'";
    
    db.get(targetQuery, [target_user_id], (err, targetUser) => {
      if (err || !targetUser) return res.status(404).json({ error: 'Target user not found' });
      
      // Room name is just the target user's name (simplified)
      const roomName = targetUser.name;
      
      // Create new direct room
      db.run("INSERT INTO chat_rooms (name, type, created_by) VALUES (?, 'direct', ?)",
        [roomName, req.user.id], function(err) {
          if (err) return res.status(500).json({ error: 'Database error' });
          
          const roomId = this.lastID;
          
          // Add both participants
          db.run("INSERT INTO chat_participants (room_id, user_id, user_type) VALUES (?, ?, ?)",
            [roomId, user1_id, user1_type], (err) => {
              if (err) return res.status(500).json({ error: 'Database error' });
              
              db.run("INSERT INTO chat_participants (room_id, user_id, user_type) VALUES (?, ?, ?)",
                [roomId, user2_id, user2_type], (err) => {
                  if (err) return res.status(500).json({ error: 'Database error' });
                  
                  res.json({ room_id: roomId, created: true });
                });
            });
        });
    });
  });
});

// Create new chat room
router.post('/rooms', verifyTokenRBAC, (req, res) => {
  const { type, name, participants, jahrgang_id } = req.body;
  const createdBy = req.user.id;
  
  if (!type || !name) {
    return res.status(400).json({ error: 'Type and name are required' });
  }
  
  // Validate type
  if (!['direct', 'group', 'jahrgang', 'admin_team'].includes(type)) {
    return res.status(400).json({ error: 'Invalid chat type' });
  }
  
  // Check Konfi chat permissions based on settings
  if (req.user.type === 'konfi') {
    // Get chat permissions from settings (default: direct_only)
    db.get("SELECT value FROM settings WHERE key = 'konfi_chat_permissions'", [], (err, setting) => {
      if (err) {
        return res.status(500).json({ error: 'Database error checking permissions' });
      }
      
      const permissions = setting?.value || 'direct_only';
      let allowedTypes = [];
      
      switch (permissions) {
        case 'direct_only':
          allowedTypes = ['direct'];
          break;
        case 'direct_and_group':
          allowedTypes = ['direct', 'group'];
          break;
        default:
          allowedTypes = ['direct']; // Fallback to most restrictive
      }
      
      if (!allowedTypes.includes(type)) {
        return res.status(403).json({ 
          error: `Konfirmanden können nur diese Chat-Arten erstellen: ${allowedTypes.join(', ')}`,
          allowed_types: allowedTypes,
          user_type: req.user.type,
          current_permission: permissions
        });
      }
      
      // If permission check passes, continue with room creation
      proceedWithRoomCreation();
    });
    return; // Exit here to wait for async permission check
  }
  
  // For admins, proceed directly
  proceedWithRoomCreation();
  
  function proceedWithRoomCreation() {
    // For jahrgang chats, check if one already exists
  if (type === 'jahrgang') {
    if (!jahrgang_id) {
      return res.status(400).json({ error: 'Jahrgang ID required for jahrgang chats' });
    }
    
    db.get("SELECT id FROM chat_rooms WHERE type = 'jahrgang' AND jahrgang_id = ?", [jahrgang_id], (err, existing) => {
      if (err) return res.status(500).json({ error: 'Database error' });
      if (existing) {
        return res.status(400).json({ error: 'Jahrgang chat already exists' });
      }
      
      createRoom();
    });
  } else {
    createRoom();
  }
  
  function createRoom() {
    console.log('Creating room with:', { name, type, jahrgang_id, createdBy });
    
    // Create the room
    db.run("INSERT INTO chat_rooms (name, type, jahrgang_id, created_by) VALUES (?, ?, ?, ?)",
      [name, type, jahrgang_id || null, createdBy], function(err) {
        if (err) {
          console.error('Room creation error:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        
        const roomId = this.lastID;
        
        // Add creator as participant
        console.log('Adding creator as participant:', { roomId, createdBy, userType: req.user.type });
        db.run("INSERT INTO chat_participants (room_id, user_id, user_type) VALUES (?, ?, ?)",
          [roomId, createdBy, req.user.type], (err) => {
            if (err) {
              console.error('Creator participant error:', err);
              return res.status(500).json({ error: 'Database error' });
            }
            
            // Add other participants
            if (participants && participants.length > 0) {
              let participantCount = 0;
              const totalParticipants = participants.length;
              
              participants.forEach(participant => {
                // Support both old format (just ID) and new format (object with user_id and user_type)
                const userId = typeof participant === 'object' ? participant.user_id : participant;
                const userType = typeof participant === 'object' ? participant.user_type : 'konfi';
                
                console.log('Adding participant:', { roomId, userId, userType, participant });
                
                // Skip if it's the creator (already added)
                if (userId === createdBy && userType === req.user.type) {
                  console.log('Skipping creator duplicate');
                  participantCount++;
                  if (participantCount === totalParticipants) {
                    res.json({ room_id: roomId, created: true });
                  }
                  return;
                }
                
                db.run("INSERT INTO chat_participants (room_id, user_id, user_type) VALUES (?, ?, ?)",
                  [roomId, userId, userType], (err) => {
                    if (err) {
                      console.error('Error adding participant:', err);
                      console.error('Participant data:', { roomId, userId, userType });
                    }
                    
                    participantCount++;
                    if (participantCount === totalParticipants) {
                      res.json({ room_id: roomId, created: true });
                    }
                  });
              });
            } else if (type === 'jahrgang') {
              // Add all konfis from the jahrgang
              db.all("SELECT u.id FROM users u JOIN roles r ON u.role_id = r.id JOIN konfi_profiles kp ON u.id = kp.user_id WHERE r.name = 'konfi' AND kp.jahrgang_id = ?", [jahrgang_id], (err, konfis) => {
                if (err) return res.status(500).json({ error: 'Database error' });
                
                if (konfis.length === 0) {
                  return res.json({ room_id: roomId, created: true });
                }
                
                let konfiCount = 0;
                konfis.forEach(konfi => {
                  db.run("INSERT INTO chat_participants (room_id, user_id, user_type) VALUES (?, ?, 'konfi')",
                    [roomId, konfi.id], (err) => {
                      if (err) console.error('Error adding konfi to jahrgang chat:', err);
                      
                      konfiCount++;
                      if (konfiCount === konfis.length) {
                        res.json({ room_id: roomId, created: true });
                      }
                    });
                });
              });
            } else {
              res.json({ room_id: roomId, created: true });
            }
          });
      });
  }
  } // End of proceedWithRoomCreation function
});

// Get chat rooms for user
router.get('/rooms', verifyTokenRBAC, (req, res) => {
  const userId = req.user.id;
  const userType = req.user.type;
  
  // Ensure user is in their jahrgang chats
  if (userType === 'admin') {
    ensureAdminJahrgangChatMembership(db, userId);
  } else if (userType === 'konfi') {
    ensureKonfiJahrgangChatMembership(db, userId);
  }
  
  let query;
  let params;
  
  if (userType === 'admin') {
    // Admins see ONLY their own rooms - PRIVACY FIX!
    query = `
      SELECT r.*, j.name as jahrgang_name,
              COUNT(CASE WHEN m.created_at > COALESCE(crs.last_read_at, '1970-01-01') AND m.deleted_at IS NULL THEN 1 END) as unread_count,
              (SELECT content FROM chat_messages WHERE room_id = r.id AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1) as last_message,
              (SELECT created_at FROM chat_messages WHERE room_id = r.id AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1) as last_message_time,
              NULL as last_message_sender
      FROM chat_rooms r
      LEFT JOIN jahrgaenge j ON r.jahrgang_id = j.id
      INNER JOIN chat_participants p ON r.id = p.room_id AND p.user_id = ? AND p.user_type = ?
      LEFT JOIN chat_read_status crs ON r.id = crs.room_id AND crs.user_id = ? AND crs.user_type = ?
      LEFT JOIN chat_messages m ON r.id = m.room_id
      GROUP BY r.id
      ORDER BY last_message_time DESC NULLS LAST
    `;
    params = [userId, userType, userId, userType];
  } else {
    // Konfis see only their rooms using chat_read_status table
    query = `
      SELECT r.*, j.name as jahrgang_name,
              COUNT(CASE WHEN m.created_at > COALESCE(crs.last_read_at, '1970-01-01') AND m.deleted_at IS NULL THEN 1 END) as unread_count,
              (SELECT content FROM chat_messages WHERE room_id = r.id AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1) as last_message,
              (SELECT created_at FROM chat_messages WHERE room_id = r.id AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1) as last_message_time,
              NULL as last_message_sender
      FROM chat_rooms r
      LEFT JOIN jahrgaenge j ON r.jahrgang_id = j.id
      INNER JOIN chat_participants p ON r.id = p.room_id AND p.user_id = ? AND p.user_type = ?
      LEFT JOIN chat_read_status crs ON r.id = crs.room_id AND crs.user_id = ? AND crs.user_type = ?
      LEFT JOIN chat_messages m ON r.id = m.room_id
      GROUP BY r.id
      ORDER BY last_message_time DESC NULLS LAST
    `;
    params = [userId, userType, userId, userType];
  }
  
  db.all(query, params, (err, rooms) => {
    if (err) {
      console.error('Error fetching chat rooms:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    // Process rooms to format last_message properly and fix direct chat names
    const processedRooms = rooms.map(room => {
      let processedRoom = { ...room };
      
      if (room.last_message && room.last_message_sender && room.last_message_time) {
        processedRoom.last_message = {
          content: room.last_message,
          sender_name: room.last_message_sender,
          created_at: room.last_message_time
        };
      } else {
        processedRoom.last_message = null;
      }
      
      // Remove the individual fields since we now have the structured last_message
      delete processedRoom.last_message_sender;
      delete processedRoom.last_message_time;
      
      return processedRoom;
    });
    
    // Fix direct chat names - get other participant's name for each direct chat
    const fixDirectChatNames = async (rooms) => {
      const fixedRooms = await Promise.all(rooms.map(async (room) => {
        if (room.type === 'direct') {
          // Get the OTHER participant's name for this direct chat
          const otherParticipantQuery = `
            SELECT p.user_id, p.user_type, 
                   CASE 
                     WHEN p.user_type = 'admin' THEN u.display_name
                     WHEN p.user_type = 'konfi' THEN u.display_name
                   END as participant_name
            FROM chat_participants p
            LEFT JOIN users u ON p.user_id = u.id
            WHERE p.room_id = ? AND NOT (p.user_id = ? AND p.user_type = ?)
            LIMIT 1
          `;
          
          return new Promise((resolve) => {
            db.get(otherParticipantQuery, [room.id, userId, userType], (err, otherParticipant) => {
              if (!err && otherParticipant && otherParticipant.participant_name) {
                room.name = otherParticipant.participant_name;
              }
              resolve(room);
            });
          });
        }
        return room;
      }));
      return fixedRooms;
    };
    
    // Apply the fix and return
    fixDirectChatNames(processedRooms).then(finalRooms => {
      res.json(finalRooms);
    }).catch(err => {
      console.error('Error fixing direct chat names:', err);
      res.json(processedRooms); // Fallback to original rooms
    });
  });
});

// Get messages for a room
router.get('/rooms/:roomId/messages', verifyTokenRBAC, (req, res) => {
  const roomId = req.params.roomId;
  const limit = parseInt(req.query.limit) || 50;
  const offset = parseInt(req.query.offset) || 0;
  const userId = req.user.id;
  const userType = req.user.type;
  
  // Check if user has access to this room
  const accessQuery = userType === 'admin' ? 
  "SELECT 1 FROM chat_rooms WHERE id = ?" :
  "SELECT 1 FROM chat_participants WHERE room_id = ? AND user_id = ? AND user_type = ?";
  const accessParams = userType === 'admin' ? [roomId] : [roomId, userId, userType];
  
  db.get(accessQuery, accessParams, (err, access) => {
    if (err || !access) {
      console.error('Access denied for room', roomId, 'user', userId, 'type', userType);
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
                WHEN m.deleted_at IS NOT NULL THEN 1
                ELSE 0
              END as is_deleted
      FROM chat_messages m
      LEFT JOIN users u ON m.user_id = u.id
      LEFT JOIN chat_polls p ON m.id = p.message_id
      WHERE m.room_id = ?
      ORDER BY m.created_at DESC
      LIMIT ? OFFSET ?
    `;
    
    db.all(messagesQuery, [roomId, limit, offset], async (err, messages) => {
      if (err) {
        console.error('Error fetching messages:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      // Load votes for poll messages
      const processedMessages = await Promise.all(messages.map(async (msg) => {
        if (msg.message_type === 'poll' && msg.options) {
          try {
            // Check if options is already an array or needs parsing
            if (typeof msg.options === 'string') {
              msg.options = JSON.parse(msg.options);
            }
            
            // Load votes for this poll
            const votes = await new Promise((resolve, reject) => {
              db.all(`
                SELECT v.*, u.display_name as voter_name
                FROM chat_poll_votes v
                LEFT JOIN users u ON v.user_id = u.id
                WHERE v.poll_id = ?
              `, [msg.poll_id], (err, votes) => {
                if (err) reject(err);
                else resolve(votes || []);
              });
            });
            
            msg.votes = votes;
            
            // Convert multiple_choice to boolean
            msg.multiple_choice = Boolean(msg.multiple_choice);
          } catch (e) {
            console.error('Error parsing poll options:', e, 'Raw options:', msg.options);
            msg.options = [];
            msg.votes = [];
          }
        }
        return msg;
      }));
      
      res.json(processedMessages.reverse());
    });
  });
});

// Send message - KORRIGIERT mit verifyTokenRBAC
  
  router.post('/rooms/:roomId/messages', verifyTokenRBAC, chatUpload.single('file'), (req, res) => {
    const roomId = req.params.roomId;
    const { content, message_type = 'text', reply_to } = req.body;
    const userId = req.user.id;
    const userType = req.user.type;
    
    if (!content && !req.file) {
      return res.status(400).json({ error: 'Content or file required' });
    }
    
    const accessQuery = userType === 'admin'
    ? "SELECT 1 FROM chat_rooms WHERE id = ?"
    : "SELECT 1 FROM chat_participants WHERE room_id = ? AND user_id = ? AND user_type = ?";
    const accessParams = userType === 'admin' ? [roomId] : [roomId, userId, userType];
    
    db.get(accessQuery, accessParams, (err, access) => {
      if (err || !access) return res.status(403).json({ error: 'Access denied' });
      
      // Datei verarbeiten
      let filePath = null, fileName = null, fileSize = null;
      let actualMessageType = message_type;
      
      if (req.file) {
        filePath = req.file.filename;
        fileName = req.file.originalname;
        fileSize = req.file.size;
        
        const ext = path.extname(fileName).toLowerCase();
        if (['.jpg', '.jpeg', '.png', '.gif'].includes(ext)) {
          actualMessageType = 'image';
        } else if (['.mp4', '.mov', '.avi'].includes(ext)) {
          actualMessageType = 'video';
        } else {
          actualMessageType = 'file';
        }
      }
      
      const insertQuery = `
      INSERT INTO chat_messages (room_id, user_id, user_type, message_type, content, file_path, file_name, file_size, reply_to, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '+2 hours'))
    `;
      
      db.run(insertQuery, [roomId, userId, userType, actualMessageType, content, filePath, fileName, fileSize, reply_to], function (err) {
        if (err) return res.status(500).json({ error: 'Database error' });
        
        const messageId = this.lastID;
        
        const messageQuery = `
        SELECT m.*, 
                m.user_id as sender_id,
                m.user_type as sender_type,
                CASE 
                  WHEN m.user_type = 'admin' THEN u_admin.display_name
                  ELSE u_konfi.display_name
                END as sender_name,
                CASE
                  WHEN m.user_type = 'admin' THEN u_admin.username
                  ELSE u_konfi.username  
                END as sender_username
        FROM chat_messages m
        LEFT JOIN (SELECT u.id, u.display_name, u.username FROM users u JOIN roles r ON u.role_id = r.id WHERE r.name = 'admin') u_admin 
          ON m.user_id = u_admin.id AND m.user_type = 'admin'
        LEFT JOIN (SELECT u.id, u.display_name, u.username FROM users u JOIN roles r ON u.role_id = r.id WHERE r.name = 'konfi') u_konfi 
          ON m.user_id = u_konfi.id AND m.user_type = 'konfi'
        WHERE m.id = ?
      `;
        
        db.get(messageQuery, [messageId], (err, message) => {
          if (err) return res.status(500).json({ error: 'Database error' });
          
          res.json(message); // sofort zurückgeben
          
          // 🔔 Push an andere Teilnehmer senden
          const getParticipantsQuery = `
          SELECT user_id, user_type FROM chat_participants
          WHERE room_id = ? AND NOT (user_id = ? AND user_type = ?)
        `;
          db.all(getParticipantsQuery, [roomId, userId, userType], (err, participants) => {
            if (err || !participants) return;
            
            participants.forEach(async (p) => {
              try {
                // Berechne aktuellen Badge Count für diesen User - FIXED mit chat_read_status
                const badgeQuery = `
                  SELECT COUNT(DISTINCT cm.id) as total_unread
                  FROM chat_messages cm
                  JOIN chat_participants cp ON cm.room_id = cp.room_id
                  LEFT JOIN chat_read_status crs ON cm.room_id = crs.room_id AND crs.user_id = ? AND crs.user_type = ?
                  WHERE cp.user_id = ? 
                  AND cp.user_type = ? 
                  AND cm.created_at > COALESCE(crs.last_read_at, '1970-01-01')
                  AND cm.deleted_at IS NULL
                  AND NOT (cm.user_id = ? AND cm.user_type = ?)
                `;
                
                db.get(badgeQuery, [p.user_id, p.user_type, p.user_id, p.user_type, p.user_id, p.user_type], async (err, badgeResult) => {
                  const badgeCount = (badgeResult?.total_unread || 0) + 1; // +1 für die neue Nachricht
                  console.log(`📱 Badge count for user ${p.user_id}: ${badgeCount} (was ${badgeResult?.total_unread || 0}, +1 for new message)`);
                  
                  // Room Name laden für Push Notification
                  db.get('SELECT name, type FROM chat_rooms WHERE id = ?', [roomId], async (roomErr, room) => {
                    const roomName = room?.name || 'Chat';
                    const isDirectChat = room?.type === 'direct';
                    
                    // Für Direct Chats: Sender als Titel, für Group Chats: Room Name als Titel
                    const pushTitle = isDirectChat ? message.sender_name : roomName;
                    const pushBody = isDirectChat ? 
                      (content || '[Anhang]') : 
                      `${message.sender_name}: ${content || '[Anhang]'}`;
                    
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
                  });
                });
              } catch (error) {
                console.error('❌ Failed to send chat push notification:', error);
              }
            });
          });
        });
      });
    });
  });
  
// Delete message (only for admins)
router.delete('/messages/:messageId', verifyTokenRBAC, (req, res) => {
  const messageId = req.params.messageId;
  const userId = req.user.id;
  const userType = req.user.type;

  // Only admin+ roles can delete messages (admin, org_admin, teamer)
  const roleName = req.user.role_name;
  if (!roleName || !['admin', 'org_admin', 'teamer'].includes(roleName)) {
    return res.status(403).json({ error: 'Admin privileges required' });
  }

  // Check if message exists and get its info
  db.get("SELECT * FROM chat_messages WHERE id = ? AND deleted_at IS NULL", [messageId], (err, message) => {
    if (err) {
      console.error('Error fetching message:', err);
      return res.status(500).json({ error: 'Database error' });
    }

    if (!message) {
      return res.status(404).json({ error: 'Message not found' });
    }

    // Soft delete the message
    db.run("UPDATE chat_messages SET deleted_at = datetime('now', '+2 hours') WHERE id = ?", [messageId], function(err) {
      if (err) {
        console.error('Error deleting message:', err);
        return res.status(500).json({ error: 'Database error' });
      }

      if (this.changes === 0) {
        return res.status(404).json({ error: 'Message not found' });
      }

      res.json({ message: 'Message deleted successfully' });
    });
  });
});

// Mark room as read
router.put('/rooms/:roomId/read', verifyTokenRBAC, (req, res) => {
  const roomId = req.params.roomId;
  const userId = req.user.id;
  const userType = req.user.type;
  
  // First try to update existing participant record
  db.run("UPDATE chat_participants SET last_read_at = CURRENT_TIMESTAMP WHERE room_id = ? AND user_id = ? AND user_type = ?",
    [roomId, userId, userType], function(err) {
      if (err) {
        console.error('Error marking room as read:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      // If no rows were affected, insert a new participant record
      if (this.changes === 0) {
        db.run("INSERT INTO chat_participants (room_id, user_id, user_type, last_read_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)",
          [roomId, userId, userType], function(insertErr) {
            if (insertErr) {
              console.error('Error inserting participant record:', insertErr);
              return res.status(500).json({ error: 'Database error' });
            }
            res.json({ message: 'Marked as read' });
          });
      } else {
        res.json({ message: 'Marked as read' });
      }
    });
});

// Get unread counts for all rooms
router.get('/unread-counts', verifyTokenRBAC, (req, res) => {
  const userId = req.user.id;
  const userType = req.user.type;
  
  let query;
  if (userType === 'admin') {
    query = `
      SELECT r.id as room_id, COUNT(m.id) as unread_count
      FROM chat_rooms r
      LEFT JOIN chat_participants p ON r.id = p.room_id AND p.user_id = ? AND p.user_type = ?
      LEFT JOIN chat_messages m ON r.id = m.room_id 
        AND (p.last_read_at IS NULL OR m.created_at > p.last_read_at)
        AND m.deleted_at IS NULL
      GROUP BY r.id
    `;
  } else {
    query = `
      SELECT r.id as room_id, COUNT(m.id) as unread_count
      FROM chat_rooms r
      INNER JOIN chat_participants p ON r.id = p.room_id AND p.user_id = ? AND p.user_type = ?
      LEFT JOIN chat_messages m ON r.id = m.room_id 
        AND m.created_at > p.last_read_at
        AND m.deleted_at IS NULL
      GROUP BY r.id
    `;
  }
  
  db.all(query, [userId, userType], (err, counts) => {
    if (err) {
      console.error('Error fetching unread counts:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    const result = {};
    counts.forEach(c => {
      result[c.room_id] = c.unread_count;
    });
    
    res.json(result);
  });
});

// Get chat file
router.get('/files/:filename', (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(uploadsDir, 'chat', filename);
  
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).json({ error: 'File not found' });
  }
});

// Create poll for a room
router.post('/rooms/:roomId/polls', verifyTokenRBAC, (req, res) => {
  const roomId = req.params.roomId;
  const { question, options, multiple_choice = false, expires_in_hours } = req.body;
  const userId = req.user.id;
  const userType = req.user.type;
  
  // Debug log to check what we're receiving
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
  
  // Check if user has access to this room
  db.get("SELECT 1 FROM chat_rooms WHERE id = ?", [roomId], (err, room) => {
    if (err || !room) {
      return res.status(403).json({ error: 'Room not found or access denied' });
    }
    
    // Calculate expiration date
    let expiresAt = null;
    if (expires_in_hours && expires_in_hours > 0) {
      const expirationDate = new Date();
      expirationDate.setHours(expirationDate.getHours() + expires_in_hours);
      expiresAt = expirationDate.toISOString();
    }
    
    // Create the poll message first
    const insertMessageQuery = `
      INSERT INTO chat_messages (room_id, user_id, user_type, message_type, content, created_at)
      VALUES (?, ?, ?, 'poll', ?, datetime('now', '+2 hours'))
    `;
    
    db.run(insertMessageQuery, [roomId, userId, userType, question.trim()], function(err) {
      if (err) {
        console.error('Error creating poll message:', err);
        return res.status(500).json({ error: 'Database error creating poll message' });
      }
      
      const messageId = this.lastID;
      
      // Create the poll entry
      const insertPollQuery = `
        INSERT INTO chat_polls (message_id, question, options, multiple_choice, expires_at)
        VALUES (?, ?, ?, ?, ?)
      `;
      
      // Ensure multiple_choice is converted to proper boolean for SQLite
      const multipleChoiceValue = multiple_choice ? 1 : 0;
      console.log('Saving poll with multiple_choice:', multipleChoiceValue);
      
      db.run(insertPollQuery, [messageId, question.trim(), JSON.stringify(validOptions), multipleChoiceValue, expiresAt], function(err) {
        if (err) {
          console.error('Error creating poll:', err);
          return res.status(500).json({ error: 'Database error creating poll' });
        }
        
        // Get the complete poll data with sender info
        const pollQuery = `
          SELECT m.*, 
                  m.user_id as sender_id,
                  m.user_type as sender_type,
                  CASE 
                    WHEN m.user_type = 'admin' THEN u_admin.display_name
                    ELSE u_konfi.display_name
                  END as sender_name,
                  CASE
                    WHEN m.user_type = 'admin' THEN u_admin.username
                    ELSE u_konfi.username  
                  END as sender_username,
                  p.question, p.options, p.expires_at, p.multiple_choice
          FROM chat_messages m
          LEFT JOIN (SELECT u.id, u.display_name, u.username FROM users u JOIN roles r ON u.role_id = r.id WHERE r.name = 'admin') u_admin ON m.user_id = u_admin.id AND m.user_type = 'admin'
          LEFT JOIN (SELECT u.id, u.display_name, u.username FROM users u JOIN roles r ON u.role_id = r.id WHERE r.name = 'konfi') u_konfi ON m.user_id = u_konfi.id AND m.user_type = 'konfi'
          LEFT JOIN chat_polls p ON m.id = p.message_id
          WHERE m.id = ?
        `;
        
        db.get(pollQuery, [messageId], (err, pollData) => {
          if (err) {
            console.error('Error fetching created poll:', err);
            return res.status(500).json({ error: 'Database error fetching poll' });
          }
          
          // Parse options back to array safely
          if (pollData.options) {
            try {
              if (typeof pollData.options === 'string') {
                pollData.options = JSON.parse(pollData.options);
              }
            } catch (e) {
              console.error('Error parsing poll options on creation:', e);
              pollData.options = [];
            }
          }
          
          // Convert multiple_choice to boolean
          pollData.multiple_choice = Boolean(pollData.multiple_choice);
          
          // Add empty votes array for new polls
          pollData.votes = [];
          
          res.json(pollData);
        });
      });
    });
  });
});

// Vote on a poll
router.post('/polls/:pollId/vote', verifyTokenRBAC, (req, res) => {
  const pollId = req.params.pollId;
  const { option_index } = req.body;
  const userId = req.user.id;
  const userType = req.user.type;
  
  if (option_index === undefined || option_index === null) {
    return res.status(400).json({ error: 'Option index is required' });
  }
  
  // First, get the poll to check if it exists and get poll details
  const getPollQuery = `
    SELECT p.*, m.room_id FROM chat_polls p
    JOIN chat_messages m ON p.message_id = m.id
    WHERE p.message_id = ?
  `;
  
  db.get(getPollQuery, [pollId], (err, poll) => {
    if (err) {
      console.error('Error fetching poll:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (!poll) {
      return res.status(404).json({ error: 'Poll not found' });
    }
    
    // Check if poll has expired
    if (poll.expires_at && new Date(poll.expires_at) < new Date()) {
      return res.status(400).json({ error: 'Poll has expired' });
    }
    
    // Check if user has access to this room
    const accessQuery = userType === 'admin' ? 
      "SELECT 1 FROM chat_rooms WHERE id = ?" :
      "SELECT 1 FROM chat_participants WHERE room_id = ? AND user_id = ? AND user_type = ?";
    const accessParams = userType === 'admin' ? [poll.room_id] : [poll.room_id, userId, userType];
    
    db.get(accessQuery, accessParams, (err, access) => {
      if (err || !access) {
        return res.status(403).json({ error: 'Access denied' });
      }
      
      // Parse options to validate option_index
      const options = JSON.parse(poll.options);
      if (option_index < 0 || option_index >= options.length) {
        return res.status(400).json({ error: 'Invalid option index' });
      }
      
      // Check if this is a single choice poll and user already voted
      if (!poll.multiple_choice) {
        // Remove existing vote for single choice polls
        db.run("DELETE FROM chat_poll_votes WHERE poll_id = ? AND user_id = ? AND user_type = ?",
          [poll.id, userId, userType], (err) => {
            if (err) {
              console.error('Error removing existing vote:', err);
              return res.status(500).json({ error: 'Database error' });
            }
            
            // Add new vote
            insertVote();
          });
      } else {
        // For multiple choice, check if user already voted for this option
        db.get("SELECT 1 FROM chat_poll_votes WHERE poll_id = ? AND user_id = ? AND user_type = ? AND option_index = ?",
          [poll.id, userId, userType, option_index], (err, existingVote) => {
            if (err) {
              console.error('Error checking existing vote:', err);
              return res.status(500).json({ error: 'Database error' });
            }
            
            if (existingVote) {
              // Remove vote (toggle)
              db.run("DELETE FROM chat_poll_votes WHERE poll_id = ? AND user_id = ? AND user_type = ? AND option_index = ?",
                [poll.id, userId, userType, option_index], (err) => {
                  if (err) {
                    console.error('Error removing vote:', err);
                    return res.status(500).json({ error: 'Database error' });
                  }
                  res.json({ message: 'Vote removed successfully' });
                });
            } else {
              // Add new vote
              insertVote();
            }
          });
      }
      
      function insertVote() {
        db.run("INSERT INTO chat_poll_votes (poll_id, user_id, user_type, option_index) VALUES (?, ?, ?, ?)",
          [poll.id, userId, userType, option_index], function(err) {
            if (err) {
              console.error('Error inserting vote:', err);
              return res.status(500).json({ error: 'Database error' });
            }
            res.json({ message: 'Vote recorded successfully' });
          });
      }
    });
  });
});

// Delete chat room
router.delete('/rooms/:roomId', verifyTokenRBAC, (req, res) => {
  const roomId = req.params.roomId;
  const userId = req.user.id;
  const userType = req.user.type;
  
  // First check if room exists and user has permission
  const roomQuery = `
    SELECT cr.*, cp.user_id as participant_user_id, cp.user_type as participant_user_type
    FROM chat_rooms cr
    LEFT JOIN chat_participants cp ON cr.id = cp.room_id 
    WHERE cr.id = ?
  `;
  
  db.all(roomQuery, [roomId], (err, roomData) => {
    if (err) {
      console.error('Error fetching room:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (roomData.length === 0) {
      return res.status(404).json({ error: 'Room not found' });
    }
    
    const room = roomData[0];
    
    // Only allow deletion of direct and group chats, not jahrgang or admin chats
    if (room.type === 'jahrgang' || room.type === 'admin') {
      return res.status(403).json({ error: 'Cannot delete system chats' });
    }
    
    // Check permission: admin can delete anything, user must be participant
    let hasPermission = false;
    if (userType === 'admin') {
      hasPermission = true;
    } else {
      // Check if user is participant
      hasPermission = roomData.some(row => 
        row.participant_user_id === userId && row.participant_user_type === userType
      );
    }
    
    if (!hasPermission) {
      return res.status(403).json({ error: 'Permission denied' });
    }
    
    // Delete room and all associated data
    db.serialize(() => {
      db.run("BEGIN TRANSACTION");
      
      // Step 1: Delete chat_read_status (references room_id)
      db.run("DELETE FROM chat_read_status WHERE room_id = ?", [roomId]);
      
      // Step 2: Delete poll votes (references poll_id)
      db.run(`DELETE FROM chat_poll_votes WHERE poll_id IN (
        SELECT p.id FROM chat_polls p 
        JOIN chat_messages m ON p.message_id = m.id 
        WHERE m.room_id = ?
      )`, [roomId]);
      
      // Step 3: Delete polls (references message_id)
      db.run(`DELETE FROM chat_polls WHERE message_id IN (
        SELECT id FROM chat_messages WHERE room_id = ?
      )`, [roomId]);
      
      // Step 4: Clear reply_to references first (self-referencing foreign key)
      db.run("UPDATE chat_messages SET reply_to = NULL WHERE room_id = ?", [roomId]);
      
      // Step 5: Delete messages (now safe from self-references)
      db.run("DELETE FROM chat_messages WHERE room_id = ?", [roomId]);
      
      // Step 6: Delete participants
      db.run("DELETE FROM chat_participants WHERE room_id = ?", [roomId]);
      
      // Step 7: Delete room
      db.run("DELETE FROM chat_rooms WHERE id = ?", [roomId], function(err) {
        if (err) {
          console.error('Error deleting room:', err);
          db.run("ROLLBACK");
          return res.status(500).json({ error: 'Database error' });
        }
        
        db.run("COMMIT", (err) => {
          if (err) {
            console.error('Error committing transaction:', err);
            return res.status(500).json({ error: 'Database error' });
          }
          
          res.json({ message: 'Room deleted successfully' });
        });
      });
    });
  });
});

// Mark room as read
router.post('/rooms/:roomId/mark-read', verifyTokenRBAC, (req, res) => {
  const roomId = req.params.roomId;
  const userId = req.user.id;
  const userType = req.user.type;
  
  // Ensure chat_read_status table exists first
  db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='chat_read_status'", (err, row) => {
    if (err) {
      console.error('Error checking chat_read_status table:', err);
      return res.status(500).json({ error: 'Database error' });
    }
    
    if (!row) {
      // Create table if it doesn't exist
      db.run(`CREATE TABLE chat_read_status (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        room_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        user_type TEXT NOT NULL CHECK (user_type IN ('admin', 'konfi')),
        last_read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (room_id) REFERENCES chat_rooms (id),
        UNIQUE(room_id, user_id, user_type)
      )`, (createErr) => {
        if (createErr) {
          console.error('Error creating chat_read_status table:', createErr);
          return res.status(500).json({ error: 'Database error' });
        }
        console.log('✅ chat_read_status table created on demand');
        insertReadStatus();
      });
    } else {
      insertReadStatus();
    }
  });
  
  function insertReadStatus() {
    // Update or insert read status
    const query = `
      INSERT OR REPLACE INTO chat_read_status (room_id, user_id, user_type, last_read_at)
      VALUES (?, ?, ?, datetime('now', '+2 hours'))
    `;
    
    db.run(query, [roomId, userId, userType], function(err) {
      if (err) {
        console.error('Error marking room as read:', err);
        console.error('Failed query:', query);
        console.error('Parameters:', [roomId, userId, userType]);
        return res.status(500).json({ error: 'Database error: ' + err.message });
      }
      
      console.log(`✅ Room ${roomId} marked as read for user ${userId} (${userType})`);
      res.json({ message: 'Room marked as read', affected: this.changes });
    });
  }
});

// Get room participants
router.get('/rooms/:roomId/participants', verifyTokenRBAC, (req, res) => {
  const roomId = req.params.roomId;
  const userId = req.user.id;
  const userType = req.user.type;
  
  // Check if user has access to this room
  const accessQuery = userType === 'admin' ? 
    "SELECT 1 FROM chat_rooms WHERE id = ?" :
    "SELECT 1 FROM chat_participants WHERE room_id = ? AND user_id = ? AND user_type = ?";
  const accessParams = userType === 'admin' ? [roomId] : [roomId, userId, userType];
  
  db.get(accessQuery, accessParams, (err, access) => {
    if (err || !access) {
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
      WHERE cp.room_id = ?
      ORDER BY cp.joined_at ASC
    `;
    
    db.all(query, [roomId], (err, participants) => {
      if (err) {
        console.error('Error fetching participants:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      res.json(participants);
    });
  });
});

// Add participant to room
router.post('/rooms/:roomId/participants', verifyTokenRBAC, (req, res) => {
  const roomId = req.params.roomId;
  const { user_id, user_type } = req.body;
  const requesterId = req.user.id;
  const requesterType = req.user.type;
  
  // Only admins can add participants
  if (requesterType !== 'admin') {
    return res.status(403).json({ error: 'Only admins can add participants' });
  }
  
  // Validate input
  if (!user_id || !user_type) {
    return res.status(400).json({ error: 'user_id and user_type are required' });
  }
  
  if (!['admin', 'konfi'].includes(user_type)) {
    return res.status(400).json({ error: 'Invalid user_type' });
  }
  
  // Check if room exists and is a group chat
  db.get("SELECT type FROM chat_rooms WHERE id = ?", [roomId], (err, room) => {
    if (err || !room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    
    if (room.type !== 'group') {
      return res.status(400).json({ error: 'Can only add participants to group chats' });
    }
    
    // Check if user is already a participant
    db.get("SELECT 1 FROM chat_participants WHERE room_id = ? AND user_id = ? AND user_type = ?", 
      [roomId, user_id, user_type], (err, existing) => {
        if (err) {
          return res.status(500).json({ error: 'Database error' });
        }
        
        if (existing) {
          return res.status(409).json({ error: 'User is already a participant' });
        }
        
        // Add participant
        db.run("INSERT INTO chat_participants (room_id, user_id, user_type) VALUES (?, ?, ?)",
          [roomId, user_id, user_type], function(err) {
            if (err) {
              console.error('Error adding participant:', err);
              return res.status(500).json({ error: 'Database error' });
            }
            
            res.json({ message: 'Participant added successfully' });
          });
      });
  });
});

// Remove participant from room
router.delete('/rooms/:roomId/participants/:userId/:userType', verifyTokenRBAC, (req, res) => {
  const roomId = req.params.roomId;
  const userId = parseInt(req.params.userId);
  const userType = req.params.userType;
  const requesterId = req.user.id;
  const requesterType = req.user.type;
  
  // Only admins can remove participants
  if (requesterType !== 'admin') {
    return res.status(403).json({ error: 'Only admins can remove participants' });
  }
  
  // Check if room exists and is a group chat
  db.get("SELECT type FROM chat_rooms WHERE id = ?", [roomId], (err, room) => {
    if (err || !room) {
      return res.status(404).json({ error: 'Room not found' });
    }
    
    if (room.type !== 'group') {
      return res.status(400).json({ error: 'Can only remove participants from group chats' });
    }
    
    // Remove participant
    db.run("DELETE FROM chat_participants WHERE room_id = ? AND user_id = ? AND user_type = ?",
      [roomId, userId, userType], function(err) {
        if (err) {
          console.error('Error removing participant:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        
        if (this.changes === 0) {
          return res.status(404).json({ error: 'Participant not found' });
        }
        
        res.json({ message: 'Participant removed successfully' });
      });
  });
});
  // Badge update endpoint für Background Refresh
  router.post('/badge-update', verifyTokenRBAC, async (req, res) => {
    try {
      const userId = req.user.id;
      
      // Aktuellen Badge Count berechnen
      const badgeQuery = `
        SELECT COUNT(DISTINCT cm.id) as total_unread
        FROM chat_messages cm
        JOIN chat_participants cp ON cm.room_id = cp.room_id
        WHERE cp.user_id = ? 
        AND cp.user_type = ? 
        AND cm.created_at > cp.last_read_at
        AND cm.sender_id != ?
      `;
      
      db.get(badgeQuery, [userId, req.user.type, userId], async (err, result) => {
        if (err) {
          console.error('❌ Error calculating badge count:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        
        const badgeCount = result?.total_unread || 0;
        
        try {
          // Badge Update via Push Notification senden
          await PushService.sendBadgeUpdate(db, userId, badgeCount);
          
          res.json({ 
            success: true, 
            badgeCount: badgeCount,
            message: `Badge updated to ${badgeCount}` 
          });
        } catch (pushError) {
          console.error('❌ Push badge update failed:', pushError);
          res.json({ 
            success: false, 
            badgeCount: badgeCount,
            error: 'Push notification failed' 
          });
        }
      });
    } catch (error) {
      console.error('❌ Badge update endpoint error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return router;
};