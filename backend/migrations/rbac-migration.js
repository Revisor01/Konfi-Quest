const bcrypt = require('bcrypt');

// RBAC Migration Script
// This will transform the existing system to support multi-organization RBAC

const runRBACMigration = (db) => {
  return new Promise((resolve, reject) => {
    console.log('🚀 Starting RBAC Migration...');
    
    db.serialize(() => {
      db.run("BEGIN TRANSACTION");
      
      // Step 1: Create new RBAC tables
      console.log('📋 Step 1: Creating RBAC tables...');
      
      // Organizations table
      db.run(`CREATE TABLE IF NOT EXISTS organizations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        slug TEXT UNIQUE NOT NULL,
        display_name TEXT NOT NULL,
        description TEXT,
        logo_url TEXT,
        contact_email TEXT,
        contact_phone TEXT,
        address TEXT,
        website_url TEXT,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);
      
      // Roles table
      db.run(`CREATE TABLE IF NOT EXISTS roles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        organization_id INTEGER,
        name TEXT NOT NULL,
        display_name TEXT NOT NULL,
        description TEXT,
        is_system_role BOOLEAN DEFAULT 0,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (organization_id) REFERENCES organizations (id),
        UNIQUE(organization_id, name)
      )`);
      
      // Permissions table
      db.run(`CREATE TABLE IF NOT EXISTS permissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        display_name TEXT NOT NULL,
        description TEXT,
        module TEXT NOT NULL,
        is_system_permission BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);
      
      // Role permissions table
      db.run(`CREATE TABLE IF NOT EXISTS role_permissions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        role_id INTEGER,
        permission_id INTEGER,
        granted BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE CASCADE,
        FOREIGN KEY (permission_id) REFERENCES permissions (id) ON DELETE CASCADE,
        UNIQUE(role_id, permission_id)
      )`);
      
      // Users table (new, will replace admins)
      db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        organization_id INTEGER,
        username TEXT NOT NULL,
        email TEXT,
        display_name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        role_id INTEGER,
        is_active BOOLEAN DEFAULT 1,
        last_login_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (organization_id) REFERENCES organizations (id),
        FOREIGN KEY (role_id) REFERENCES roles (id),
        UNIQUE(organization_id, username),
        UNIQUE(organization_id, email)
      )`);
      
      // User jahrgang assignments table
      db.run(`CREATE TABLE IF NOT EXISTS user_jahrgang_assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        jahrgang_id INTEGER,
        can_view BOOLEAN DEFAULT 1,
        can_edit BOOLEAN DEFAULT 0,
        assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        assigned_by INTEGER,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        FOREIGN KEY (jahrgang_id) REFERENCES jahrgaenge (id) ON DELETE CASCADE,
        FOREIGN KEY (assigned_by) REFERENCES users (id),
        UNIQUE(user_id, jahrgang_id)
      )`);
      
      // Step 2: Create default organization
      console.log('🏢 Step 2: Creating default organization...');
      
      db.run(`INSERT OR IGNORE INTO organizations (
        name, slug, display_name, description, is_active
      ) VALUES (
        'Default Church', 'default', 'Standardgemeinde', 
        'Automatisch erstellte Standardorganisation', 1
      )`, function(err) {
        if (err) {
          console.error('Error creating default organization:', err);
          db.run("ROLLBACK");
          return reject(err);
        }
        
        const defaultOrgId = this.lastID || 1; // If it already exists, use ID 1
        
        // Step 3: Create standard permissions
        console.log('🔐 Step 3: Creating standard permissions...');
        
        const permissions = [
          // Badges Module
          { name: 'badges.create', display_name: 'Badges erstellen', description: 'Neue Badges erstellen', module: 'badges' },
          { name: 'badges.edit', display_name: 'Badges bearbeiten', description: 'Bestehende Badges bearbeiten', module: 'badges' },
          { name: 'badges.delete', display_name: 'Badges löschen', description: 'Badges löschen', module: 'badges' },
          { name: 'badges.view', display_name: 'Badges anzeigen', description: 'Badges anzeigen', module: 'badges' },
          { name: 'badges.award', display_name: 'Badges verleihen', description: 'Badges manuell verleihen', module: 'badges' },
          
          // Activity Requests Module
          { name: 'requests.view', display_name: 'Anträge anzeigen', description: 'Anträge anzeigen', module: 'requests' },
          { name: 'requests.approve', display_name: 'Anträge genehmigen', description: 'Anträge genehmigen', module: 'requests' },
          { name: 'requests.reject', display_name: 'Anträge ablehnen', description: 'Anträge ablehnen', module: 'requests' },
          { name: 'requests.delete', display_name: 'Anträge löschen', description: 'Anträge löschen', module: 'requests' },
          
          // Konfis Module
          { name: 'konfis.create', display_name: 'Konfis anlegen', description: 'Neue Konfis anlegen', module: 'konfis' },
          { name: 'konfis.edit', display_name: 'Konfis bearbeiten', description: 'Konfis bearbeiten', module: 'konfis' },
          { name: 'konfis.delete', display_name: 'Konfis löschen', description: 'Konfis löschen', module: 'konfis' },
          { name: 'konfis.view', display_name: 'Konfis anzeigen', description: 'Konfis anzeigen', module: 'konfis' },
          { name: 'konfis.reset_password', display_name: 'Passwörter zurücksetzen', description: 'Konfi-Passwörter zurücksetzen', module: 'konfis' },
          { name: 'konfis.assign_points', display_name: 'Punkte vergeben', description: 'Punkte manuell vergeben', module: 'konfis' },
          
          // Activities Module
          { name: 'activities.create', display_name: 'Aktivitäten erstellen', description: 'Neue Aktivitäten erstellen', module: 'activities' },
          { name: 'activities.edit', display_name: 'Aktivitäten bearbeiten', description: 'Aktivitäten bearbeiten', module: 'activities' },
          { name: 'activities.delete', display_name: 'Aktivitäten löschen', description: 'Aktivitäten löschen', module: 'activities' },
          { name: 'activities.view', display_name: 'Aktivitäten anzeigen', description: 'Aktivitäten anzeigen', module: 'activities' },
          
          // Events Module
          { name: 'events.create', display_name: 'Events erstellen', description: 'Neue Events erstellen', module: 'events' },
          { name: 'events.edit', display_name: 'Events bearbeiten', description: 'Events bearbeiten', module: 'events' },
          { name: 'events.delete', display_name: 'Events löschen', description: 'Events löschen', module: 'events' },
          { name: 'events.view', display_name: 'Events anzeigen', description: 'Events anzeigen', module: 'events' },
          { name: 'events.manage_bookings', display_name: 'Buchungen verwalten', description: 'Event-Buchungen verwalten', module: 'events' },
          
          // Admin Module
          { name: 'admin.users.create', display_name: 'Benutzer erstellen', description: 'Neue Admin-Benutzer erstellen', module: 'admin' },
          { name: 'admin.users.edit', display_name: 'Benutzer bearbeiten', description: 'Admin-Benutzer bearbeiten', module: 'admin' },
          { name: 'admin.users.delete', display_name: 'Benutzer löschen', description: 'Admin-Benutzer löschen', module: 'admin' },
          { name: 'admin.users.view', display_name: 'Benutzer anzeigen', description: 'Admin-Benutzer anzeigen', module: 'admin' },
          { name: 'admin.roles.create', display_name: 'Rollen erstellen', description: 'Neue Rollen erstellen', module: 'admin' },
          { name: 'admin.roles.edit', display_name: 'Rollen bearbeiten', description: 'Rollen bearbeiten', module: 'admin' },
          { name: 'admin.roles.delete', display_name: 'Rollen löschen', description: 'Rollen löschen', module: 'admin' },
          { name: 'admin.roles.view', display_name: 'Rollen anzeigen', description: 'Rollen anzeigen', module: 'admin' },
          { name: 'admin.permissions.manage', display_name: 'Berechtigungen verwalten', description: 'Berechtigungen verwalten', module: 'admin' },
          { name: 'admin.jahrgaenge.assign', display_name: 'Jahrgang-Zuweisungen', description: 'Jahrgang-Zuweisungen verwalten', module: 'admin' },
          { name: 'admin.organizations.view', display_name: 'Organisationen anzeigen', description: 'Organisationen anzeigen', module: 'admin' },
          { name: 'admin.organizations.create', display_name: 'Organisationen erstellen', description: 'Neue Organisationen erstellen', module: 'admin' },
          { name: 'admin.organizations.edit', display_name: 'Organisationen bearbeiten', description: 'Organisationen bearbeiten', module: 'admin' },
          { name: 'admin.organizations.delete', display_name: 'Organisationen löschen', description: 'Organisationen löschen', module: 'admin' },
          
          // Categories & Jahrgaenge Module
          { name: 'categories.create', display_name: 'Kategorien erstellen', description: 'Neue Kategorien erstellen', module: 'categories' },
          { name: 'categories.edit', display_name: 'Kategorien bearbeiten', description: 'Kategorien bearbeiten', module: 'categories' },
          { name: 'categories.delete', display_name: 'Kategorien löschen', description: 'Kategorien löschen', module: 'categories' },
          { name: 'jahrgaenge.create', display_name: 'Jahrgänge erstellen', description: 'Neue Jahrgänge erstellen', module: 'jahrgaenge' },
          { name: 'jahrgaenge.edit', display_name: 'Jahrgänge bearbeiten', description: 'Jahrgänge bearbeiten', module: 'jahrgaenge' },
          { name: 'jahrgaenge.delete', display_name: 'Jahrgänge löschen', description: 'Jahrgänge löschen', module: 'jahrgaenge' }
        ];
        
        let permissionsCreated = 0;
        const permissionIds = {};
        
        permissions.forEach((permission, index) => {
          db.run(`INSERT OR IGNORE INTO permissions (name, display_name, description, module) 
                  VALUES (?, ?, ?, ?)`,
            [permission.name, permission.display_name, permission.description, permission.module],
            function(err) {
              if (err) {
                console.error('Error creating permission:', permission.name, err);
              } else {
                permissionIds[permission.name] = this.lastID || (index + 1);
              }
              
              permissionsCreated++;
              if (permissionsCreated === permissions.length) {
                createRoles();
              }
            }
          );
        });
        
        function createRoles() {
          // Step 4: Create standard roles
          console.log('👥 Step 4: Creating standard roles...');
          
          const roles = [
            { 
              name: 'admin', 
              display_name: 'Pastor', 
              description: 'Vollzugriff auf alle Funktionen',
              permissions: Object.keys(permissionIds) // All permissions
            },
            { 
              name: 'teamer', 
              display_name: 'Teamer:in', 
              description: 'Kann Anträge bearbeiten und zugewiesene Jahrgänge verwalten',
              permissions: [
                'requests.view', 'requests.approve', 'requests.reject',
                'konfis.view', 'konfis.assign_points',
                'activities.view', 'events.view',
                'badges.view'
              ]
            },
            { 
              name: 'helper', 
              display_name: 'Helfer:in', 
              description: 'Kann zugewiesene Jahrgänge anzeigen',
              permissions: [
                'requests.view',
                'konfis.view',
                'activities.view', 'events.view',
                'badges.view'
              ]
            }
          ];
          
          let rolesCreated = 0;
          const roleIds = {};
          
          roles.forEach(role => {
            db.run(`INSERT OR IGNORE INTO roles (
              organization_id, name, display_name, description, is_system_role
            ) VALUES (?, ?, ?, ?, 1)`,
              [defaultOrgId, role.name, role.display_name, role.description],
              function(err) {
                if (err) {
                  console.error('Error creating role:', role.name, err);
                } else {
                  roleIds[role.name] = this.lastID || (rolesCreated + 1);
                  
                  // Add permissions to role
                  role.permissions.forEach(permissionName => {
                    const permissionId = permissionIds[permissionName];
                    if (permissionId) {
                      db.run(`INSERT OR IGNORE INTO role_permissions (role_id, permission_id, granted) 
                              VALUES (?, ?, 1)`,
                        [roleIds[role.name], permissionId]
                      );
                    }
                  });
                }
                
                rolesCreated++;
                if (rolesCreated === roles.length) {
                  migrateExistingAdmins();
                }
              }
            );
          });
        }
        
        function migrateExistingAdmins() {
          // Step 5: Migrate existing admins to users
          console.log('👤 Step 5: Migrating existing admins...');
          
          db.all("SELECT * FROM admins", (err, admins) => {
            if (err) {
              console.error('Error fetching existing admins:', err);
              db.run("ROLLBACK");
              return reject(err);
            }
            
            if (admins.length === 0) {
              // Create default admin user
              const defaultPassword = bcrypt.hashSync('pastor2025', 10);
              db.run(`INSERT INTO users (
                organization_id, username, display_name, password_hash, role_id
              ) VALUES (?, ?, ?, ?, ?)`,
                [defaultOrgId, 'admin', 'Pastor Administrator', defaultPassword, roleIds.admin],
                function(err) {
                  if (err) {
                    console.error('Error creating default admin:', err);
                    db.run("ROLLBACK");
                    return reject(err);
                  }
                  
                  console.log('✅ Default admin user created');
                  updateExistingTables();
                }
              );
            } else {
              let adminsMigrated = 0;
              
              admins.forEach(admin => {
                db.run(`INSERT OR IGNORE INTO users (
                  organization_id, username, display_name, password_hash, role_id
                ) VALUES (?, ?, ?, ?, ?)`,
                  [defaultOrgId, admin.username, admin.display_name, admin.password_hash, roleIds.admin],
                  function(err) {
                    if (err) {
                      console.error('Error migrating admin:', admin.username, err);
                    }
                    
                    adminsMigrated++;
                    if (adminsMigrated === admins.length) {
                      console.log(`✅ ${adminsMigrated} admins migrated to users`);
                      updateExistingTables();
                    }
                  }
                );
              });
            }
          });
        }
        
        function updateExistingTables() {
          // Step 6: Add organization_id to existing tables
          console.log('🔄 Step 6: Updating existing tables with organization_id...');
          
          const tablesToUpdate = [
            'jahrgaenge',
            'konfis', 
            'activities',
            'events',
            'categories',
            'custom_badges'
          ];
          
          let tablesUpdated = 0;
          
          tablesToUpdate.forEach(table => {
            // Check if organization_id column exists
            db.all(`PRAGMA table_info(${table})`, (err, columns) => {
              if (err) {
                console.error(`Error checking ${table} structure:`, err);
                tablesUpdated++;
                checkCompletion();
                return;
              }
              
              const hasOrgColumn = columns.some(col => col.name === 'organization_id');
              
              if (!hasOrgColumn) {
                db.run(`ALTER TABLE ${table} ADD COLUMN organization_id INTEGER DEFAULT ${defaultOrgId}`, (err) => {
                  if (err) {
                    console.error(`Error adding organization_id to ${table}:`, err);
                  } else {
                    console.log(`✅ Added organization_id to ${table}`);
                  }
                  
                  tablesUpdated++;
                  checkCompletion();
                });
              } else {
                console.log(`✅ ${table} already has organization_id`);
                tablesUpdated++;
                checkCompletion();
              }
            });
          });
          
          function checkCompletion() {
            if (tablesUpdated === tablesToUpdate.length) {
              console.log('🎉 RBAC Migration completed successfully!');
              
              db.run("COMMIT", (err) => {
                if (err) {
                  console.error('Error committing RBAC migration:', err);
                  reject(err);
                } else {
                  console.log('✅ RBAC Migration transaction committed');
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

module.exports = { runRBACMigration };