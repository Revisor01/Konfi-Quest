// Utility functions for chat system

// Initialize default chat rooms - UPDATED FOR RBAC SYSTEM
const initializeChatRooms = (db) => {
  return async () => {
    try {
 console.log('Starting chat room initialization with RBAC system...');
      
      // Create jahrgang chat rooms for each organization
      const { rows: jahrgaenge } = await db.query("SELECT * FROM jahrgaenge ORDER BY organization_id, id", []);
 console.log(`Found ${jahrgaenge.length} jahrgaenge to process`);

      for (const jahrgang of jahrgaenge) {
        const { rows: [existingRoom] } = await db.query(
          "SELECT id FROM chat_rooms WHERE type = 'jahrgang' AND jahrgang_id = $1 AND organization_id = $2",
          [jahrgang.id, jahrgang.organization_id]
        );

        if (!existingRoom) {
 console.log(`Creating chat room for Jahrgang "${jahrgang.name}" (ID: ${jahrgang.id})`);
          
          // Create room with proper organization_id
          const insertRoomQuery = `
            INSERT INTO chat_rooms (name, type, jahrgang_id, organization_id, created_by, created_at) 
            VALUES ($1, 'jahrgang', $2, $3, $4, NOW()) 
            RETURNING id
          `;
          const { rows: [newRoom] } = await db.query(insertRoomQuery, [
            `Jahrgang ${jahrgang.name}`, 
            jahrgang.id, 
            jahrgang.organization_id,
            1 // Default admin user ID
          ]);
          const newRoomId = newRoom.id;

          // Add all konfis of this jahrgang to the room (RBAC structure)
          const konfisQuery = `
            SELECT u.id 
            FROM users u
            JOIN roles r ON u.role_id = r.id
            JOIN konfi_profiles kp ON u.id = kp.user_id
            WHERE r.name = 'konfi' 
              AND kp.jahrgang_id = $1 
              AND u.organization_id = $2
          `;
          const { rows: konfis } = await db.query(konfisQuery, [jahrgang.id, jahrgang.organization_id]);
          
          for (const konfi of konfis) {
            const insertParticipantQuery = `
              INSERT INTO chat_participants (room_id, user_id, user_type, joined_at) 
              VALUES ($1, $2, 'konfi', NOW())
            `;
            await db.query(insertParticipantQuery, [newRoomId, konfi.id]);
          }
          
 console.log(`Created chat room for Jahrgang ${jahrgang.name} and added ${konfis.length} participants.`);
        } else {
 console.log(`Chat room already exists for Jahrgang "${jahrgang.name}"`);
        }
      }
      
 console.log('Chat room initialization completed successfully');
    } catch (err) {
 console.error('Error during chat room initialization:', err);
    }
  };
};

module.exports = {
  initializeChatRooms
};