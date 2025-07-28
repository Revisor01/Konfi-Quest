// Utility functions for chat system

// Initialize default chat rooms
const initializeChatRooms = (db) => {
  return async () => {
    try {
      // Create jahrgang chat rooms
      const { rows: jahrgaenge } = await db.query("SELECT * FROM jahrgaenge", []);

      for (const jahrgang of jahrgaenge) {
        const { rows: [existingRoom] } = await db.query(
          "SELECT id FROM chat_rooms WHERE type = 'jahrgang' AND jahrgang_id = $1",
          [jahrgang.id]
        );

        if (!existingRoom) {
          // Create room
          const insertRoomQuery = `
            INSERT INTO chat_rooms (name, type, jahrgang_id, created_by) 
            VALUES ($1, 'jahrgang', $2, 1) 
            RETURNING id
          `;
          const { rows: [newRoom] } = await db.query(insertRoomQuery, [`Jahrgang ${jahrgang.name}`, jahrgang.id]);
          const newRoomId = newRoom.id;

          // Add all konfis of this jahrgang to the room
          const { rows: konfis } = await db.query("SELECT id FROM konfis WHERE jahrgang_id = $1", [jahrgang.id]);
          
          for (const konfi of konfis) {
            const insertParticipantQuery = `
              INSERT INTO chat_participants (room_id, user_id, user_type) 
              VALUES ($1, $2, 'konfi')
            `;
            await db.query(insertParticipantQuery, [newRoomId, konfi.id]);
          }
          console.log(`✅ Created chat room for Jahrgang ${jahrgang.name} and added ${konfis.length} participants.`);
        }
      }
    } catch (err) {
      console.error('❌ Error during chat room initialization:', err);
    }
  };
};

module.exports = {
  initializeChatRooms
};