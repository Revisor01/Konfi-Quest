const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const router = express.Router();

// Chat routes
module.exports = (db, verifyToken) => {
  
  // Chat file upload setup
  const chatUploadsDir = path.join(__dirname, '../uploads/chat');
  if (!fs.existsSync(chatUploadsDir)) {
    fs.mkdirSync(chatUploadsDir, { recursive: true });
  }

  const chatUpload = multer({
    dest: chatUploadsDir,
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
    fileFilter: (req, file, cb) => {
      // Allow images and documents
      const allowedTypes = [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'application/pdf', 'application/msword', 
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain'
      ];
      
      if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
      } else {
        cb(new Error('Dateityp nicht erlaubt'), false);
      }
    }
  });

  // Get admins for chat
  router.get('/admins', verifyToken, (req, res) => {
    if (req.user.type !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    db.all("SELECT id, username, display_name FROM admins ORDER BY display_name", [], (err, admins) => {
      if (err) {
        console.error('Error fetching admins:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      res.json(admins);
    });
  });

  // Create or get direct chat
  router.post('/direct', verifyToken, (req, res) => {
    if (req.user.type !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const { konfiId } = req.body;
    
    if (!konfiId) {
      return res.status(400).json({ error: 'konfiId is required' });
    }
    
    // Check if direct chat already exists
    db.get(`SELECT cr.id 
            FROM chat_rooms cr 
            JOIN chat_participants cp1 ON cr.id = cp1.room_id 
            JOIN chat_participants cp2 ON cr.id = cp2.room_id 
            WHERE cr.type = 'direct' 
            AND cp1.user_id = ? AND cp1.user_type = 'admin' 
            AND cp2.user_id = ? AND cp2.user_type = 'konfi'`,
      [req.user.id, konfiId], (err, existingRoom) => {
        if (err) {
          console.error('Error checking existing direct chat:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        
        if (existingRoom) {
          return res.json({ roomId: existingRoom.id, message: 'Direct chat already exists' });
        }
        
        // Get konfi name for chat name
        db.get("SELECT name FROM konfis WHERE id = ?", [konfiId], (err, konfi) => {
          if (err) {
            console.error('Error fetching konfi:', err);
            return res.status(500).json({ error: 'Database error' });
          }
          
          if (!konfi) {
            return res.status(404).json({ error: 'Konfi not found' });
          }
          
          const chatName = `Direct: ${req.user.display_name} & ${konfi.name}`;
          
          // Create new direct chat room
          db.run("INSERT INTO chat_rooms (name, type, created_by) VALUES (?, 'direct', ?)",
            [chatName, req.user.id], function(err) {
              if (err) {
                console.error('Error creating direct chat room:', err);
                return res.status(500).json({ error: 'Database error' });
              }
              
              const roomId = this.lastID;
              
              // Add participants
              db.serialize(() => {
                db.run("INSERT INTO chat_participants (room_id, user_id, user_type) VALUES (?, ?, 'admin')",
                  [roomId, req.user.id]);
                db.run("INSERT INTO chat_participants (room_id, user_id, user_type) VALUES (?, ?, 'konfi')",
                  [roomId, konfiId]);
              });
              
              res.json({ roomId, message: 'Direct chat created successfully' });
            });
        });
      });
  });

  // Create group chat room
  router.post('/rooms', verifyToken, (req, res) => {
    if (req.user.type !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const { name, participants } = req.body;
    
    if (!name || !participants || !Array.isArray(participants)) {
      return res.status(400).json({ error: 'Name and participants array are required' });
    }
    
    // Create chat room
    db.run("INSERT INTO chat_rooms (name, type, created_by) VALUES (?, 'group', ?)",
      [name, req.user.id], function(err) {
        if (err) {
          console.error('Error creating chat room:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        
        const roomId = this.lastID;
        
        // Add creator as participant
        db.run("INSERT INTO chat_participants (room_id, user_id, user_type) VALUES (?, ?, 'admin')",
          [roomId, req.user.id], (err) => {
            if (err) {
              console.error('Error adding creator to chat:', err);
              return res.status(500).json({ error: 'Database error' });
            }
            
            // Add other participants
            let addedParticipants = 0;
            participants.forEach(participant => {
              db.run("INSERT INTO chat_participants (room_id, user_id, user_type) VALUES (?, ?, ?)",
                [roomId, participant.id, participant.type], (err) => {
                  if (err) {
                    console.error('Error adding participant:', err);
                  }
                  addedParticipants++;
                  if (addedParticipants === participants.length) {
                    res.json({ 
                      roomId, 
                      message: 'Group chat created successfully',
                      participantsAdded: participants.length
                    });
                  }
                });
            });
          });
      });
  });

  // Get chat rooms
  router.get('/rooms', verifyToken, (req, res) => {
    const userType = req.user.type;
    const userId = req.user.id;
    
    db.all(`SELECT DISTINCT cr.*, 
                   COUNT(DISTINCT cp.user_id) as participant_count,
                   COUNT(CASE WHEN cm.id IS NOT NULL AND cmr.message_id IS NULL THEN 1 END) as unread_count
            FROM chat_rooms cr
            JOIN chat_participants cp ON cr.id = cp.room_id
            LEFT JOIN chat_messages cm ON cr.id = cm.room_id
            LEFT JOIN chat_message_reads cmr ON cm.id = cmr.message_id AND cmr.user_id = ? AND cmr.user_type = ?
            WHERE cr.id IN (
              SELECT room_id FROM chat_participants 
              WHERE user_id = ? AND user_type = ?
            )
            GROUP BY cr.id
            ORDER BY cr.created_at DESC`,
      [userId, userType, userId, userType], (err, rooms) => {
        if (err) {
          console.error('Error fetching chat rooms:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        res.json(rooms);
      });
  });

  // Get messages for a room
  router.get('/rooms/:roomId/messages', verifyToken, (req, res) => {
    const roomId = req.params.roomId;
    const limit = req.query.limit || 50;
    const offset = req.query.offset || 0;
    
    // Check if user is participant
    db.get("SELECT id FROM chat_participants WHERE room_id = ? AND user_id = ? AND user_type = ?",
      [roomId, req.user.id, req.user.type], (err, participant) => {
        if (err) {
          console.error('Error checking participant:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        
        if (!participant) {
          return res.status(403).json({ error: 'Not a participant of this chat' });
        }
        
        // Get messages
        db.all(`SELECT cm.*, 
                       CASE 
                         WHEN cm.sender_type = 'admin' THEN (SELECT display_name FROM admins WHERE id = cm.sender_id)
                         WHEN cm.sender_type = 'konfi' THEN (SELECT name FROM konfis WHERE id = cm.sender_id)
                       END as sender_name,
                       cm.file_name, cm.file_path, cm.file_size, cm.file_type
                FROM chat_messages cm
                WHERE cm.room_id = ?
                ORDER BY cm.created_at DESC
                LIMIT ? OFFSET ?`,
          [roomId, limit, offset], (err, messages) => {
            if (err) {
              console.error('Error fetching messages:', err);
              return res.status(500).json({ error: 'Database error' });
            }
            res.json(messages.reverse());
          });
      });
  });

  // Send message
  router.post('/rooms/:roomId/messages', verifyToken, chatUpload.single('file'), (req, res) => {
    const roomId = req.params.roomId;
    const { message } = req.body;
    const file = req.file;
    
    if (!message && !file) {
      return res.status(400).json({ error: 'Message or file is required' });
    }
    
    // Check if user is participant
    db.get("SELECT id FROM chat_participants WHERE room_id = ? AND user_id = ? AND user_type = ?",
      [roomId, req.user.id, req.user.type], (err, participant) => {
        if (err) {
          console.error('Error checking participant:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        
        if (!participant) {
          return res.status(403).json({ error: 'Not a participant of this chat' });
        }
        
        let fileName = null;
        let filePath = null;
        let fileSize = null;
        let fileType = null;
        
        if (file) {
          fileName = file.originalname;
          filePath = file.filename;
          fileSize = file.size;
          fileType = file.mimetype;
        }
        
        // Insert message
        db.run(`INSERT INTO chat_messages (
          room_id, sender_id, sender_type, message, 
          file_name, file_path, file_size, file_type
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [roomId, req.user.id, req.user.type, message, fileName, filePath, fileSize, fileType],
          function(err) {
            if (err) {
              console.error('Error sending message:', err);
              return res.status(500).json({ error: 'Database error' });
            }
            
            res.json({ 
              id: this.lastID,
              message: 'Message sent successfully',
              hasFile: !!file
            });
          });
      });
  });

  // Delete message
  router.delete('/messages/:messageId', verifyToken, (req, res) => {
    const messageId = req.params.messageId;
    
    // Check if user is the sender
    db.get("SELECT * FROM chat_messages WHERE id = ? AND sender_id = ? AND sender_type = ?",
      [messageId, req.user.id, req.user.type], (err, message) => {
        if (err) {
          console.error('Error checking message ownership:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        
        if (!message) {
          return res.status(404).json({ error: 'Message not found or not authorized' });
        }
        
        // Delete associated file if exists
        if (message.file_path) {
          const filePath = path.join(chatUploadsDir, message.file_path);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        }
        
        // Delete message
        db.run("DELETE FROM chat_messages WHERE id = ?", [messageId], function(err) {
          if (err) {
            console.error('Error deleting message:', err);
            return res.status(500).json({ error: 'Database error' });
          }
          res.json({ message: 'Message deleted successfully' });
        });
      });
  });

  // Mark messages as read
  router.put('/rooms/:roomId/read', verifyToken, (req, res) => {
    const roomId = req.params.roomId;
    
    // Check if user is participant
    db.get("SELECT id FROM chat_participants WHERE room_id = ? AND user_id = ? AND user_type = ?",
      [roomId, req.user.id, req.user.type], (err, participant) => {
        if (err) {
          console.error('Error checking participant:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        
        if (!participant) {
          return res.status(403).json({ error: 'Not a participant of this chat' });
        }
        
        // Mark all messages as read
        db.run(`INSERT OR REPLACE INTO chat_message_reads (message_id, user_id, user_type)
                SELECT id, ?, ? FROM chat_messages WHERE room_id = ?`,
          [req.user.id, req.user.type, roomId], function(err) {
            if (err) {
              console.error('Error marking messages as read:', err);
              return res.status(500).json({ error: 'Database error' });
            }
            res.json({ message: 'Messages marked as read' });
          });
      });
  });

  // Get unread message counts
  router.get('/unread-counts', verifyToken, (req, res) => {
    const userId = req.user.id;
    const userType = req.user.type;
    
    db.all(`SELECT cr.id as room_id, cr.name, 
                   COUNT(CASE WHEN cm.id IS NOT NULL AND cmr.message_id IS NULL THEN 1 END) as unread_count
            FROM chat_rooms cr
            JOIN chat_participants cp ON cr.id = cp.room_id
            LEFT JOIN chat_messages cm ON cr.id = cm.room_id
            LEFT JOIN chat_message_reads cmr ON cm.id = cmr.message_id AND cmr.user_id = ? AND cmr.user_type = ?
            WHERE cp.user_id = ? AND cp.user_type = ?
            GROUP BY cr.id
            HAVING unread_count > 0`,
      [userId, userType, userId, userType], (err, unreadCounts) => {
        if (err) {
          console.error('Error fetching unread counts:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        res.json(unreadCounts);
      });
  });

  // Get file
  router.get('/files/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(chatUploadsDir, filename);
    
    if (fs.existsSync(filePath)) {
      res.sendFile(filePath);
    } else {
      res.status(404).json({ error: 'File not found' });
    }
  });

  // Create poll
  router.post('/rooms/:roomId/polls', verifyToken, (req, res) => {
    const roomId = req.params.roomId;
    const { question, options } = req.body;
    
    if (!question || !options || !Array.isArray(options) || options.length < 2) {
      return res.status(400).json({ error: 'Question and at least 2 options are required' });
    }
    
    // Check if user is participant
    db.get("SELECT id FROM chat_participants WHERE room_id = ? AND user_id = ? AND user_type = ?",
      [roomId, req.user.id, req.user.type], (err, participant) => {
        if (err) {
          console.error('Error checking participant:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        
        if (!participant) {
          return res.status(403).json({ error: 'Not a participant of this chat' });
        }
        
        // Create poll
        db.run("INSERT INTO chat_polls (room_id, creator_id, creator_type, question) VALUES (?, ?, ?, ?)",
          [roomId, req.user.id, req.user.type, question], function(err) {
            if (err) {
              console.error('Error creating poll:', err);
              return res.status(500).json({ error: 'Database error' });
            }
            
            const pollId = this.lastID;
            
            // Add options
            let optionsAdded = 0;
            options.forEach(option => {
              db.run("INSERT INTO chat_poll_options (poll_id, option_text) VALUES (?, ?)",
                [pollId, option], (err) => {
                  if (err) {
                    console.error('Error adding poll option:', err);
                  }
                  optionsAdded++;
                  if (optionsAdded === options.length) {
                    res.json({ 
                      pollId, 
                      message: 'Poll created successfully',
                      optionsAdded: options.length
                    });
                  }
                });
            });
          });
      });
  });

  // Vote on poll
  router.post('/polls/:pollId/vote', verifyToken, (req, res) => {
    const pollId = req.params.pollId;
    const { optionId } = req.body;
    
    if (!optionId) {
      return res.status(400).json({ error: 'Option ID is required' });
    }
    
    // Check if poll exists and user is participant
    db.get(`SELECT cp.room_id FROM chat_polls cp
            JOIN chat_participants cpart ON cp.room_id = cpart.room_id
            WHERE cp.id = ? AND cpart.user_id = ? AND cpart.user_type = ?`,
      [pollId, req.user.id, req.user.type], (err, poll) => {
        if (err) {
          console.error('Error checking poll access:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        
        if (!poll) {
          return res.status(404).json({ error: 'Poll not found or not authorized' });
        }
        
        // Check if user already voted
        db.get("SELECT id FROM chat_poll_votes WHERE poll_id = ? AND voter_id = ? AND voter_type = ?",
          [pollId, req.user.id, req.user.type], (err, existingVote) => {
            if (err) {
              console.error('Error checking existing vote:', err);
              return res.status(500).json({ error: 'Database error' });
            }
            
            if (existingVote) {
              return res.status(409).json({ error: 'Already voted on this poll' });
            }
            
            // Cast vote
            db.run("INSERT INTO chat_poll_votes (poll_id, option_id, voter_id, voter_type) VALUES (?, ?, ?, ?)",
              [pollId, optionId, req.user.id, req.user.type], function(err) {
                if (err) {
                  console.error('Error casting vote:', err);
                  return res.status(500).json({ error: 'Database error' });
                }
                res.json({ message: 'Vote cast successfully' });
              });
          });
      });
  });

  // Delete chat room
  router.delete('/rooms/:roomId', verifyToken, (req, res) => {
    const roomId = req.params.roomId;
    
    // Check if user is creator or admin
    db.get("SELECT * FROM chat_rooms WHERE id = ? AND created_by = ?", [roomId, req.user.id], (err, room) => {
      if (err) {
        console.error('Error checking room ownership:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!room && req.user.type !== 'admin') {
        return res.status(403).json({ error: 'Not authorized to delete this room' });
      }
      
      db.serialize(() => {
        db.run("BEGIN TRANSACTION");
        
        // Delete all related data
        db.run("DELETE FROM chat_message_reads WHERE message_id IN (SELECT id FROM chat_messages WHERE room_id = ?)", [roomId]);
        db.run("DELETE FROM chat_poll_votes WHERE poll_id IN (SELECT id FROM chat_polls WHERE room_id = ?)", [roomId]);
        db.run("DELETE FROM chat_poll_options WHERE poll_id IN (SELECT id FROM chat_polls WHERE room_id = ?)", [roomId]);
        db.run("DELETE FROM chat_polls WHERE room_id = ?", [roomId]);
        db.run("DELETE FROM chat_messages WHERE room_id = ?", [roomId]);
        db.run("DELETE FROM chat_participants WHERE room_id = ?", [roomId]);
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
            res.json({ message: 'Chat room deleted successfully' });
          });
        });
      });
    });
  });

  // Mark room as read
  router.post('/rooms/:roomId/mark-read', verifyToken, (req, res) => {
    const roomId = req.params.roomId;
    
    // Check if user is participant
    db.get("SELECT id FROM chat_participants WHERE room_id = ? AND user_id = ? AND user_type = ?",
      [roomId, req.user.id, req.user.type], (err, participant) => {
        if (err) {
          console.error('Error checking participant:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        
        if (!participant) {
          return res.status(403).json({ error: 'Not a participant of this chat' });
        }
        
        // Mark all messages as read
        db.run(`INSERT OR REPLACE INTO chat_message_reads (message_id, user_id, user_type)
                SELECT id, ?, ? FROM chat_messages WHERE room_id = ?`,
          [req.user.id, req.user.type, roomId], function(err) {
            if (err) {
              console.error('Error marking room as read:', err);
              return res.status(500).json({ error: 'Database error' });
            }
            res.json({ message: 'Room marked as read' });
          });
      });
  });

  // Get room participants
  router.get('/rooms/:roomId/participants', verifyToken, (req, res) => {
    const roomId = req.params.roomId;
    
    // Check if user is participant
    db.get("SELECT id FROM chat_participants WHERE room_id = ? AND user_id = ? AND user_type = ?",
      [roomId, req.user.id, req.user.type], (err, participant) => {
        if (err) {
          console.error('Error checking participant:', err);
          return res.status(500).json({ error: 'Database error' });
        }
        
        if (!participant) {
          return res.status(403).json({ error: 'Not a participant of this chat' });
        }
        
        // Get participants
        db.all(`SELECT cp.user_id, cp.user_type,
                       CASE 
                         WHEN cp.user_type = 'admin' THEN (SELECT display_name FROM admins WHERE id = cp.user_id)
                         WHEN cp.user_type = 'konfi' THEN (SELECT name FROM konfis WHERE id = cp.user_id)
                       END as name
                FROM chat_participants cp
                WHERE cp.room_id = ?
                ORDER BY cp.user_type, name`, [roomId], (err, participants) => {
          if (err) {
            console.error('Error fetching participants:', err);
            return res.status(500).json({ error: 'Database error' });
          }
          res.json(participants);
        });
      });
  });

  // Add participant to room
  router.post('/rooms/:roomId/participants', verifyToken, (req, res) => {
    if (req.user.type !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const roomId = req.params.roomId;
    const { userId, userType } = req.body;
    
    if (!userId || !userType) {
      return res.status(400).json({ error: 'userId and userType are required' });
    }
    
    // Check if room exists and is group chat
    db.get("SELECT type FROM chat_rooms WHERE id = ?", [roomId], (err, room) => {
      if (err) {
        console.error('Error checking room:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!room) {
        return res.status(404).json({ error: 'Room not found' });
      }
      
      if (room.type !== 'group') {
        return res.status(400).json({ error: 'Can only add participants to group chats' });
      }
      
      // Check if user is already participant
      db.get("SELECT id FROM chat_participants WHERE room_id = ? AND user_id = ? AND user_type = ?",
        [roomId, userId, userType], (err, existing) => {
          if (err) {
            console.error('Error checking existing participant:', err);
            return res.status(500).json({ error: 'Database error' });
          }
          
          if (existing) {
            return res.status(409).json({ error: 'User is already a participant' });
          }
          
          // Add participant
          db.run("INSERT INTO chat_participants (room_id, user_id, user_type) VALUES (?, ?, ?)",
            [roomId, userId, userType], function(err) {
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
  router.delete('/rooms/:roomId/participants/:userId/:userType', verifyToken, (req, res) => {
    if (req.user.type !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    const roomId = req.params.roomId;
    const userId = req.params.userId;
    const userType = req.params.userType;
    
    // Check if room exists and is group chat
    db.get("SELECT type FROM chat_rooms WHERE id = ?", [roomId], (err, room) => {
      if (err) {
        console.error('Error checking room:', err);
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!room) {
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

  return router;
};