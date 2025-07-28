// Utility functions for chat system

// Initialize default chat rooms
const initializeChatRooms = (db) => {
  return () => {
    // Create jahrgang chat rooms
    db.all("SELECT * FROM jahrgaenge", [], (err, jahrgaenge) => {
      if (err) return;
      
      jahrgaenge.forEach(jahrgang => {
        db.get("SELECT id FROM chat_rooms WHERE type = 'jahrgang' AND jahrgang_id = ?", [jahrgang.id], (err, room) => {
          if (!room) {
            db.run("INSERT INTO chat_rooms (name, type, jahrgang_id, created_by) VALUES (?, 'jahrgang', ?, 1)",
              [`Jahrgang ${jahrgang.name}`, jahrgang.id], function(err) {
                if (!err) {
                  // Add all konfis of this jahrgang to the room
                  db.all("SELECT id FROM konfis WHERE jahrgang_id = ?", [jahrgang.id], (err, konfis) => {
                    if (!err) {
                      konfis.forEach(konfi => {
                        db.run("INSERT INTO chat_participants (room_id, user_id, user_type) VALUES (?, ?, 'konfi')",
                          [this.lastID, konfi.id]);
                      });
                    }
                  });
                }
              });
          }
        });
      });
    });
  };
};

module.exports = {
  initializeChatRooms
};