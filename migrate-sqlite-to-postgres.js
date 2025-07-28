#!/usr/bin/env node

const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// Configuration
const SQLITE_DB_PATH = './backend/data/konfi.db';
const PG_CONFIG = {
  user: 'konfi_user',
  host: 'localhost',
  database: 'konfi_db',
  password: 'konfi_secure_password_2025',
  port: 5432,
};

console.log('🚀 Starting SQLite to PostgreSQL migration...');

// Check if SQLite file exists
if (!fs.existsSync(SQLITE_DB_PATH)) {
  console.error(`❌ SQLite database not found at: ${SQLITE_DB_PATH}`);
  process.exit(1);
}

// Initialize connections
const sqliteDb = new sqlite3.Database(SQLITE_DB_PATH);
const pgPool = new Pool(PG_CONFIG);

// Helper function to convert SQLite data types to PostgreSQL
function convertValue(value, columnType) {
  if (value === null || value === undefined) return null;
  
  // Handle boolean conversion
  if (columnType && columnType.toLowerCase().includes('boolean')) {
    return value === 1 || value === '1' || value === true;
  }
  
  // Handle timestamp conversion
  if (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}/)) {
    return new Date(value);
  }
  
  return value;
}

// Migration functions for each table
const migrations = {
  
  // 1. Organizations
  async organizations() {
    console.log('📊 Migrating organizations...');
    
    return new Promise((resolve, reject) => {
      sqliteDb.all("SELECT * FROM organizations ORDER BY id", async (err, rows) => {
        if (err) {
          console.log('ℹ️  No organizations table in SQLite, creating default organization');
          try {
            await pgPool.query(`
              INSERT INTO organizations (id, name, created_at) 
              VALUES (1, 'Default Organization', CURRENT_TIMESTAMP)
              ON CONFLICT (id) DO NOTHING
            `);
            await pgPool.query("SELECT setval('organizations_id_seq', 1, true)");
            resolve();
          } catch (pgErr) {
            reject(pgErr);
          }
          return;
        }
        
        try {
          for (const row of rows) {
            await pgPool.query(`
              INSERT INTO organizations (id, name, created_at, updated_at) 
              VALUES ($1, $2, $3, $4)
              ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                updated_at = EXCLUDED.updated_at
            `, [row.id, row.name, row.created_at || new Date(), row.updated_at || new Date()]);
          }
          
          if (rows.length > 0) {
            const maxId = Math.max(...rows.map(r => r.id));
            await pgPool.query(`SELECT setval('organizations_id_seq', $1, true)`, [maxId]);
          }
          
          console.log(`✅ Migrated ${rows.length} organizations`);
          resolve();
        } catch (pgErr) {
          reject(pgErr);
        }
      });
    });
  },

  // 2. Roles
  async roles() {
    console.log('📊 Migrating roles...');
    
    return new Promise((resolve, reject) => {
      sqliteDb.all("SELECT * FROM roles ORDER BY id", async (err, rows) => {
        if (err) {
          console.log('ℹ️  No roles table found, creating default roles');
          try {
            const defaultRoles = [
              { id: 1, name: 'super_admin', display_name: 'Super Admin', organization_id: 1 },
              { id: 2, name: 'admin', display_name: 'Admin', organization_id: 1 },
              { id: 3, name: 'konfi', display_name: 'Konfi', organization_id: 1 }
            ];
            
            for (const role of defaultRoles) {
              await pgPool.query(`
                INSERT INTO roles (id, name, display_name, organization_id, created_at) 
                VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
                ON CONFLICT (name, organization_id) DO NOTHING
              `, [role.id, role.name, role.display_name, role.organization_id]);
            }
            
            await pgPool.query("SELECT setval('roles_id_seq', 3, true)");
            resolve();
          } catch (pgErr) {
            reject(pgErr);
          }
          return;
        }
        
        try {
          for (const row of rows) {
            await pgPool.query(`
              INSERT INTO roles (id, name, display_name, description, organization_id, created_at) 
              VALUES ($1, $2, $3, $4, $5, $6)
              ON CONFLICT (name, organization_id) DO UPDATE SET
                display_name = EXCLUDED.display_name,
                description = EXCLUDED.description
            `, [
              row.id, 
              row.name, 
              row.display_name, 
              row.description, 
              row.organization_id || 1, 
              row.created_at || new Date()
            ]);
          }
          
          if (rows.length > 0) {
            const maxId = Math.max(...rows.map(r => r.id));
            await pgPool.query(`SELECT setval('roles_id_seq', $1, true)`, [maxId]);
          }
          
          console.log(`✅ Migrated ${rows.length} roles`);
          resolve();
        } catch (pgErr) {
          reject(pgErr);
        }
      });
    });
  },

  // 3. Permissions
  async permissions() {
    console.log('📊 Migrating permissions...');
    
    return new Promise((resolve, reject) => {
      sqliteDb.all("SELECT * FROM permissions ORDER BY id", async (err, rows) => {
        if (err) {
          console.log('ℹ️  No permissions table found, skipping');
          resolve();
          return;
        }
        
        try {
          for (const row of rows) {
            await pgPool.query(`
              INSERT INTO permissions (id, name, display_name, description, category, created_at) 
              VALUES ($1, $2, $3, $4, $5, $6)
              ON CONFLICT (name) DO UPDATE SET
                display_name = EXCLUDED.display_name,
                description = EXCLUDED.description,
                category = EXCLUDED.category
            `, [
              row.id, 
              row.name, 
              row.display_name, 
              row.description, 
              row.category, 
              row.created_at || new Date()
            ]);
          }
          
          if (rows.length > 0) {
            const maxId = Math.max(...rows.map(r => r.id));
            await pgPool.query(`SELECT setval('permissions_id_seq', $1, true)`, [maxId]);
          }
          
          console.log(`✅ Migrated ${rows.length} permissions`);
          resolve();
        } catch (pgErr) {
          reject(pgErr);
        }
      });
    });
  },

  // 4. Users (formerly admins + konfis)
  async users() {
    console.log('📊 Migrating users (admins + konfis)...');
    
    return new Promise((resolve, reject) => {
      // First migrate admins
      sqliteDb.all("SELECT * FROM admins ORDER BY id", async (err, adminRows) => {
        if (err) adminRows = [];
        
        // Then migrate konfis
        sqliteDb.all("SELECT * FROM konfis ORDER BY id", async (err2, konfiRows) => {
          if (err2) konfiRows = [];
          
          try {
            let maxId = 0;
            
            // Migrate admins
            for (const admin of adminRows) {
              const userId = admin.id;
              await pgPool.query(`
                INSERT INTO users (id, display_name, username, email, password_hash, role_id, organization_id, is_active, created_at) 
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                ON CONFLICT (username, organization_id) DO UPDATE SET
                  display_name = EXCLUDED.display_name,
                  email = EXCLUDED.email,
                  password_hash = EXCLUDED.password_hash
              `, [
                userId, 
                admin.name || admin.username, 
                admin.username, 
                admin.email, 
                admin.password_hash, 
                2, // admin role
                admin.organization_id || 1, 
                true,
                admin.created_at || new Date()
              ]);
              
              maxId = Math.max(maxId, userId);
            }
            
            // Migrate konfis  
            for (const konfi of konfiRows) {
              const userId = konfi.id + 10000; // Offset to avoid ID conflicts
              await pgPool.query(`
                INSERT INTO users (id, display_name, username, password_hash, role_id, organization_id, is_active, created_at) 
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT (username, organization_id) DO UPDATE SET
                  display_name = EXCLUDED.display_name,
                  password_hash = EXCLUDED.password_hash
              `, [
                userId, 
                konfi.name, 
                konfi.username, 
                konfi.password_hash, 
                3, // konfi role
                konfi.organization_id || 1, 
                true,
                konfi.created_at || new Date()
              ]);
              
              maxId = Math.max(maxId, userId);
            }
            
            if (maxId > 0) {
              await pgPool.query(`SELECT setval('users_id_seq', $1, true)`, [maxId]);
            }
            
            console.log(`✅ Migrated ${adminRows.length} admins and ${konfiRows.length} konfis as users`);
            resolve();
          } catch (pgErr) {
            reject(pgErr);
          }
        });
      });
    });
  },

  // 5. Jahrgaenge
  async jahrgaenge() {
    console.log('📊 Migrating jahrgaenge...');
    
    return new Promise((resolve, reject) => {
      sqliteDb.all("SELECT * FROM jahrgaenge ORDER BY id", async (err, rows) => {
        if (err) {
          console.log('ℹ️  No jahrgaenge table found');
          resolve();
          return;
        }
        
        try {
          for (const row of rows) {
            await pgPool.query(`
              INSERT INTO jahrgaenge (id, name, description, organization_id, created_at) 
              VALUES ($1, $2, $3, $4, $5)
              ON CONFLICT (name, organization_id) DO UPDATE SET
                description = EXCLUDED.description
            `, [
              row.id, 
              row.name, 
              row.description, 
              row.organization_id || 1, 
              row.created_at || new Date()
            ]);
          }
          
          if (rows.length > 0) {
            const maxId = Math.max(...rows.map(r => r.id));
            await pgPool.query(`SELECT setval('jahrgaenge_id_seq', $1, true)`, [maxId]);
          }
          
          console.log(`✅ Migrated ${rows.length} jahrgaenge`);
          resolve();
        } catch (pgErr) {
          reject(pgErr);
        }
      });
    });
  },

  // 6. Konfi Profiles
  async konfiProfiles() {
    console.log('📊 Migrating konfi profiles...');
    
    return new Promise((resolve, reject) => {
      sqliteDb.all("SELECT * FROM konfi_profiles ORDER BY id", async (err, rows) => {
        if (err) {
          console.log('ℹ️  No konfi_profiles table found');
          resolve();
          return;
        }
        
        try {
          for (const row of rows) {
            // Convert user_id (was konfi_id) to new user system
            const newUserId = row.user_id + 10000;
            
            await pgPool.query(`
              INSERT INTO konfi_profiles (id, user_id, jahrgang_id, gottesdienst_points, gemeinde_points, organization_id, created_at) 
              VALUES ($1, $2, $3, $4, $5, $6, $7)
              ON CONFLICT (user_id) DO UPDATE SET
                jahrgang_id = EXCLUDED.jahrgang_id,
                gottesdienst_points = EXCLUDED.gottesdienst_points,
                gemeinde_points = EXCLUDED.gemeinde_points
            `, [
              row.id, 
              newUserId, 
              row.jahrgang_id, 
              row.gottesdienst_points || 0, 
              row.gemeinde_points || 0, 
              row.organization_id || 1, 
              row.created_at || new Date()
            ]);
          }
          
          if (rows.length > 0) {
            const maxId = Math.max(...rows.map(r => r.id));
            await pgPool.query(`SELECT setval('konfi_profiles_id_seq', $1, true)`, [maxId]);
          }
          
          console.log(`✅ Migrated ${rows.length} konfi profiles`);
          resolve();
        } catch (pgErr) {
          reject(pgErr);
        }
      });
    });
  },

  // Add more migrations for other tables...
  // This is the foundation - we can add more tables as needed

};

// Main migration function
async function runMigration() {
  try {
    console.log('🔍 Testing PostgreSQL connection...');
    await pgPool.query('SELECT NOW()');
    console.log('✅ PostgreSQL connection successful');
    
    console.log('🔍 Testing SQLite connection...');
    sqliteDb.get("SELECT 1", (err) => {
      if (err) {
        console.error('❌ SQLite connection failed:', err);
        process.exit(1);
      }
      console.log('✅ SQLite connection successful');
    });
    
    // Run migrations in order
    const migrationOrder = [
      'organizations',
      'roles', 
      'permissions',
      'users',
      'jahrgaenge',
      'konfiProfiles'
    ];
    
    for (const migrationName of migrationOrder) {
      if (migrations[migrationName]) {
        await migrations[migrationName]();
      }
    }
    
    console.log('🎉 Migration completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    sqliteDb.close();
    await pgPool.end();
  }
}

// Run if called directly
if (require.main === module) {
  runMigration();
}

module.exports = { runMigration, migrations };