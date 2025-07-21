const bcrypt = require('bcrypt');

// Konfi Profiles Migration Script
// This will create the konfi_profiles table and migrate existing konfis

const runKonfiProfilesMigration = (db) => {
  return new Promise((resolve, reject) => {
    console.log('🚀 Starting Konfi Profiles Migration...');
    
    db.serialize(() => {
      db.run("BEGIN TRANSACTION");
      
      // Step 1: Create konfi_profiles table
      console.log('📋 Step 1: Creating konfi_profiles table...');
      
      db.run(`CREATE TABLE IF NOT EXISTS konfi_profiles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER UNIQUE NOT NULL,
        jahrgang_id INTEGER,
        gottesdienst_points INTEGER DEFAULT 0,
        gemeinde_points INTEGER DEFAULT 0,
        password_plain TEXT NOT NULL,
        email TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (jahrgang_id) REFERENCES jahrgaenge (id)
      )`, function(err) {
        if (err) {
          console.error('Error creating konfi_profiles table:', err);
          db.run("ROLLBACK");
          return reject(err);
        }
        
        console.log('✅ konfi_profiles table created');
        
        // Step 2: Create 'konfi' role if it doesn't exist
        console.log('👥 Step 2: Creating konfi role...');
        
        db.get("SELECT id FROM roles WHERE name = 'konfi' AND organization_id = 1", (err, role) => {
          if (err) {
            console.error('Error checking konfi role:', err);
            db.run("ROLLBACK");
            return reject(err);
          }
          
          if (!role) {
            db.run(`INSERT INTO roles (organization_id, name, display_name, description, is_system_role) 
                    VALUES (1, 'konfi', 'Konfirmand:in', 'Konfirmand mit eingeschränkten Berechtigungen', 1)`, 
              function(err) {
                if (err) {
                  console.error('Error creating konfi role:', err);
                  db.run("ROLLBACK");
                  return reject(err);
                }
                
                const konfiRoleId = this.lastID;
                console.log(`✅ Konfi role created with ID: ${konfiRoleId}`);
                migrateExistingKonfis(konfiRoleId);
              }
            );
          } else {
            console.log(`✅ Konfi role already exists with ID: ${role.id}`);
            migrateExistingKonfis(role.id);
          }
        });
        
        function migrateExistingKonfis(konfiRoleId) {
          // Step 3: Migrate existing konfis to users + konfi_profiles
          console.log('👤 Step 3: Migrating existing konfis...');
          
          db.all("SELECT * FROM konfis", (err, konfis) => {
            if (err) {
              console.error('Error fetching existing konfis:', err);
              db.run("ROLLBACK");
              return reject(err);
            }
            
            if (konfis.length === 0) {
              console.log('✅ No existing konfis to migrate');
              finalizeMigration();
              return;
            }
            
            let konfisMigrated = 0;
            
            konfis.forEach(konfi => {
              // Create user entry
              db.run(`INSERT INTO users (
                organization_id, username, display_name, password_hash, role_id
              ) VALUES (?, ?, ?, ?, ?)`,
                [konfi.organization_id || 1, konfi.username, konfi.name, konfi.password_hash, konfiRoleId],
                function(err) {
                  if (err) {
                    console.error('Error migrating konfi to users:', konfi.username, err);
                    konfisMigrated++;
                    if (konfisMigrated === konfis.length) {
                      finalizeMigration();
                    }
                    return;
                  }
                  
                  const userId = this.lastID;
                  
                  // Create konfi_profile entry
                  db.run(`INSERT INTO konfi_profiles (
                    user_id, jahrgang_id, gottesdienst_points, gemeinde_points, password_plain, email
                  ) VALUES (?, ?, ?, ?, ?, ?)`,
                    [userId, konfi.jahrgang_id, konfi.gottesdienst_points || 0, konfi.gemeinde_points || 0, konfi.password_plain, konfi.email],
                    function(err) {
                      if (err) {
                        console.error('Error creating konfi_profile:', konfi.username, err);
                      } else {
                        console.log(`✅ Migrated konfi: ${konfi.name} (${konfi.username})`);
                      }
                      
                      konfisMigrated++;
                      if (konfisMigrated === konfis.length) {
                        finalizeMigration();
                      }
                    }
                  );
                }
              );
            });
          });
        }
        
        function finalizeMigration() {
          // Step 4: Update foreign key references in other tables
          console.log('🔄 Step 4: Updating foreign key references...');
          
          const tablesToUpdate = [
            { table: 'konfi_activities', column: 'konfi_id' },
            { table: 'bonus_points', column: 'konfi_id' },
            { table: 'konfi_badges', column: 'konfi_id' },
            { table: 'activity_requests', column: 'konfi_id' },
            { table: 'chat_participants', column: 'user_id', condition: "user_type = 'konfi'" },
            { table: 'chat_messages', column: 'user_id', condition: "user_type = 'konfi'" }
          ];
          
          let tablesUpdated = 0;
          
          tablesToUpdate.forEach(({ table, column, condition }) => {
            // Get mapping of old konfi_id to new user_id
            db.all(`SELECT k.id as old_id, u.id as new_id 
                    FROM konfis k 
                    JOIN users u ON k.username = u.username AND k.name = u.display_name
                    WHERE u.role_id = ?`, [konfiRoleId], (err, mappings) => {
              if (err) {
                console.error(`Error getting mappings for ${table}:`, err);
                tablesUpdated++;
                checkCompletion();
                return;
              }
              
              if (mappings.length === 0) {
                console.log(`✅ No mappings needed for ${table}`);
                tablesUpdated++;
                checkCompletion();
                return;
              }
              
              let updatesCompleted = 0;
              
              mappings.forEach(mapping => {
                const updateQuery = condition ? 
                  `UPDATE ${table} SET ${column} = ? WHERE ${column} = ? AND ${condition}` :
                  `UPDATE ${table} SET ${column} = ? WHERE ${column} = ?`;
                
                db.run(updateQuery, [mapping.new_id, mapping.old_id], function(err) {
                  if (err) {
                    console.error(`Error updating ${table}:`, err);
                  } else if (this.changes > 0) {
                    console.log(`✅ Updated ${this.changes} rows in ${table}`);
                  }
                  
                  updatesCompleted++;
                  if (updatesCompleted === mappings.length) {
                    tablesUpdated++;
                    checkCompletion();
                  }
                });
              });
            });
          });
          
          function checkCompletion() {
            if (tablesUpdated === tablesToUpdate.length) {
              console.log('🎉 Konfi Profiles Migration completed successfully!');
              
              db.run("COMMIT", (err) => {
                if (err) {
                  console.error('Error committing konfi profiles migration:', err);
                  reject(err);
                } else {
                  console.log('✅ Konfi Profiles Migration transaction committed');
                  resolve();
                }
              });
            }
          }
        }
      });
    });
  });
};

module.exports = { runKonfiProfilesMigration };