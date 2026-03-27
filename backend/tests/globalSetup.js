// backend/tests/globalSetup.js — Test-DB erstellen, Schema + Migrationen ausfuehren
// Gibt Teardown-Funktion zurueck (Vitest-Pattern)
const { Pool } = require('pg');
const path = require('path');
const fs = require('fs');

const TEST_DB_NAME = 'konfi_test';
const ADMIN_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5433/postgres';

module.exports = async function globalSetup() {
  // 1. Test-DB droppen falls vorhanden, neu erstellen
  const adminPool = new Pool({ connectionString: ADMIN_URL });
  await adminPool.query(`DROP DATABASE IF EXISTS "${TEST_DB_NAME}"`);
  await adminPool.query(`CREATE DATABASE "${TEST_DB_NAME}"`);
  await adminPool.end();

  // 2. Auf Test-DB verbinden
  const testUrl = ADMIN_URL.replace(/\/[^/]+$/, `/${TEST_DB_NAME}`);
  const testPool = new Pool({ connectionString: testUrl });

  // 3. Basis-Schema aus repo-root init-scripts (Kern-Tabellen)
  //    Einzelne Statements ausfuehren um fehlerhafte Partial Indexes zu ueberspringen
  const repoInitDir = path.join(__dirname, '..', '..', 'init-scripts');
  if (fs.existsSync(repoInitDir)) {
    const initFiles = fs.readdirSync(repoInitDir).filter(f => f.endsWith('.sql')).sort();
    for (const file of initFiles) {
      let sql = fs.readFileSync(path.join(repoInitDir, file), 'utf8');
      // Problematische Partial Indexes entfernen (CURRENT_TIMESTAMP ist nicht IMMUTABLE)
      sql = sql.replace(/CREATE INDEX[^;]*WHERE[^;]*CURRENT_TIMESTAMP[^;]*;/gi, '-- removed non-immutable partial index');
      try {
        await testPool.query(sql);
      } catch (err) {
        console.warn(`[globalSetup] init-script ${file} Warnung: ${err.message.substring(0, 100)}`);
      }
    }
  }

  // 4. Fehlende Tabellen erstellen die in Produktion existieren aber nicht in init-scripts
  //    (wurden historisch durch Route-Dateien erstellt, jetzt nur noch via Migrations referenziert)
  await testPool.query(`
    -- organizations braucht slug + is_active (in init-script nicht vorhanden)
    ALTER TABLE organizations ADD COLUMN IF NOT EXISTS slug VARCHAR(255);
    ALTER TABLE organizations ADD COLUMN IF NOT EXISTS display_name VARCHAR(255);
    ALTER TABLE organizations ADD COLUMN IF NOT EXISTS description TEXT;
    ALTER TABLE organizations ADD COLUMN IF NOT EXISTS logo_url TEXT;
    ALTER TABLE organizations ADD COLUMN IF NOT EXISTS contact_email VARCHAR(255);
    ALTER TABLE organizations ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

    -- jahrgaenge braucht is_active
    ALTER TABLE jahrgaenge ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

    -- user_jahrgang_assignments (RBAC)
    CREATE TABLE IF NOT EXISTS user_jahrgang_assignments (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      jahrgang_id INTEGER REFERENCES jahrgaenge(id) ON DELETE CASCADE,
      can_view BOOLEAN DEFAULT true,
      can_edit BOOLEAN DEFAULT false,
      assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      assigned_by INTEGER REFERENCES users(id),
      UNIQUE(user_id, jahrgang_id)
    );

    -- password_resets
    CREATE TABLE IF NOT EXISTS password_resets (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      user_type VARCHAR(20),
      token VARCHAR(255) NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- activity_requests (Konfi-Antraege)
    CREATE TABLE IF NOT EXISTS activity_requests (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      konfi_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      activity_id INTEGER NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
      requested_date DATE DEFAULT CURRENT_DATE,
      comment TEXT,
      photo_filename VARCHAR(500),
      status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
      admin_comment TEXT,
      approved_by INTEGER REFERENCES users(id),
      organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      client_id VARCHAR(100),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- user_activities (bestaetigte Aktivitaeten pro User)
    CREATE TABLE IF NOT EXISTS user_activities (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      activity_id INTEGER NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
      admin_id INTEGER REFERENCES users(id),
      completed_date DATE DEFAULT CURRENT_DATE,
      comment TEXT,
      organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, activity_id)
    );

    -- user_badges (Badge-Vergabe pro User)
    CREATE TABLE IF NOT EXISTS user_badges (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      badge_id INTEGER NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
      organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      awarded_date DATE DEFAULT CURRENT_DATE,
      awarded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, badge_id)
    );

    -- chat_read_status
    CREATE TABLE IF NOT EXISTS chat_read_status (
      id SERIAL PRIMARY KEY,
      room_id INTEGER NOT NULL REFERENCES chat_rooms(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      user_type VARCHAR(20) NOT NULL,
      last_read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(room_id, user_id)
    );

    -- chat_polls
    CREATE TABLE IF NOT EXISTS chat_polls (
      id SERIAL PRIMARY KEY,
      message_id INTEGER REFERENCES chat_messages(id) ON DELETE CASCADE,
      question TEXT NOT NULL,
      options JSONB NOT NULL,
      multiple_choice BOOLEAN DEFAULT false,
      expires_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- chat_poll_votes
    CREATE TABLE IF NOT EXISTS chat_poll_votes (
      id SERIAL PRIMARY KEY,
      poll_id INTEGER NOT NULL REFERENCES chat_polls(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      user_type VARCHAR(20) NOT NULL,
      option_index INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- users braucht zusaetzliche Spalten (historisch hinzugefuegt)
    ALTER TABLE users ADD COLUMN IF NOT EXISTS teamer_since DATE;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT false;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS role_title VARCHAR(255);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS token_invalidated_at TIMESTAMP;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMP;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS email VARCHAR(255);
    -- organization_id muss NULL erlauben fuer super_admin
    ALTER TABLE users ALTER COLUMN organization_id DROP NOT NULL;

    -- jahrgaenge braucht Punkte-Konfiguration + Konfirmationsdatum
    ALTER TABLE jahrgaenge ADD COLUMN IF NOT EXISTS confirmation_date DATE;
    ALTER TABLE jahrgaenge ADD COLUMN IF NOT EXISTS gottesdienst_enabled BOOLEAN DEFAULT true;
    ALTER TABLE jahrgaenge ADD COLUMN IF NOT EXISTS gemeinde_enabled BOOLEAN DEFAULT true;
    ALTER TABLE jahrgaenge ADD COLUMN IF NOT EXISTS target_gottesdienst INTEGER DEFAULT 10;
    ALTER TABLE jahrgaenge ADD COLUMN IF NOT EXISTS target_gemeinde INTEGER DEFAULT 10;

    -- konfi_profiles braucht bible_translation
    ALTER TABLE konfi_profiles ADD COLUMN IF NOT EXISTS bible_translation VARCHAR(100);
    ALTER TABLE konfi_profiles ADD COLUMN IF NOT EXISTS organization_id INTEGER REFERENCES organizations(id);

    -- events braucht has_timeslots (falls nicht in init-script)
    ALTER TABLE events ADD COLUMN IF NOT EXISTS has_timeslots BOOLEAN DEFAULT false;

    -- refresh_tokens (JWT Refresh Token Store)
    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash VARCHAR(255) NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      revoked_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- push_tokens (Push-Notifications)
    CREATE TABLE IF NOT EXISTS push_tokens (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token TEXT NOT NULL,
      platform VARCHAR(20),
      device_id VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, token)
    );

    -- custom_badges (Badge-Definitionen, genutzt von badges.js Route)
    CREATE TABLE IF NOT EXISTS custom_badges (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      icon VARCHAR(100),
      description TEXT,
      criteria_type VARCHAR(50) NOT NULL,
      criteria_value INTEGER,
      criteria_extra JSONB,
      is_hidden BOOLEAN DEFAULT false,
      color VARCHAR(7) DEFAULT '#667eea',
      sort_order INTEGER DEFAULT 0,
      is_active BOOLEAN DEFAULT true,
      target_role VARCHAR(10) DEFAULT 'konfi',
      created_by INTEGER REFERENCES users(id),
      organization_id INTEGER NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // 5. Backend init-scripts (z.B. 007_levels.sql — braucht organizations + users)
  const backendInitDir = path.join(__dirname, '..', 'init-scripts');
  if (fs.existsSync(backendInitDir)) {
    const initFiles = fs.readdirSync(backendInitDir).filter(f => f.endsWith('.sql')).sort();
    for (const file of initFiles) {
      try {
        await testPool.query(fs.readFileSync(path.join(backendInitDir, file), 'utf8'));
      } catch (err) {
        // init-scripts koennen fehlschlagen wenn Tabellen leer (z.B. INSERT mit SELECT FROM organizations)
        console.log(`[globalSetup] init-script ${file} uebersprungen: ${err.message.substring(0, 80)}`);
      }
    }
  }

  // 5.5 Fehlende Spalten auf Tabellen die erst durch Backend-init-scripts erstellt wurden
  await testPool.query(`
    ALTER TABLE levels ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;
  `).catch(() => {});

  // 6. Migrationen ausfuehren (identisch mit database.js runMigrations)
  await testPool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const migrationsDir = path.join(__dirname, '..', 'migrations');
  const migrationFiles = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql')).sort();
  const { rows: applied } = await testPool.query('SELECT name FROM schema_migrations');
  const appliedSet = new Set(applied.map(r => r.name));
  let migCount = 0;

  for (const file of migrationFiles) {
    if (appliedSet.has(file)) continue;
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    try {
      await testPool.query(sql);
      await testPool.query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
      migCount++;
    } catch (err) {
      console.warn(`[globalSetup] Migration ${file} Warnung: ${err.message.substring(0, 100)}`);
      // Migration als applied markieren um Wiederholungsfehler zu vermeiden
      await testPool.query('INSERT INTO schema_migrations (name) VALUES ($1) ON CONFLICT DO NOTHING', [file]);
    }
  }

  await testPool.end();
  console.log(`[globalSetup] Test-DB "${TEST_DB_NAME}" erstellt (${migCount} neue Migrationen)`);

  // Teardown-Funktion zurueckgeben (Vitest-Pattern)
  return async function globalTeardown() {
    const adminPool = new Pool({ connectionString: ADMIN_URL });
    // Aktive Connections terminieren
    await adminPool.query(`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = '${TEST_DB_NAME}' AND pid <> pg_backend_pid()
    `);
    await adminPool.query(`DROP DATABASE IF EXISTS "${TEST_DB_NAME}"`);
    await adminPool.end();
    console.log(`[globalTeardown] Test-DB "${TEST_DB_NAME}" gedroppt`);
  };
};
