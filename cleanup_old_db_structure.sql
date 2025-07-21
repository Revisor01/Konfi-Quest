-- Bereinigung der alten Datenbank-Struktur
-- Dieses Skript entfernt alte Tabellen und migriert Foreign Key Referenzen

-- Schritt 1: Backup wichtiger Daten für Referenz-Migration erstellen
CREATE TEMPORARY TABLE admin_id_mapping AS
SELECT 
  a.id as old_admin_id,
  u.id as new_user_id,
  a.username
FROM admins a
JOIN users u ON a.username = u.username
WHERE u.organization_id = 1;  -- Nur für die Standard-Organisation

-- Schritt 2: Foreign Key Constraints müssen in SQLite durch Tabellen-Neuaufbau behoben werden
-- Da SQLite keine ALTER TABLE für Foreign Keys unterstützt, müssen wir Tabellen neu erstellen

-- 2.1 Aktualisiere konfi_activities (admin_id -> user_id)
CREATE TABLE konfi_activities_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    konfi_id INTEGER,
    activity_id INTEGER,
    admin_id INTEGER,  -- Wird zu user_id, aber wir behalten den Namen für Kompatibilität
    completed_date DATE DEFAULT CURRENT_DATE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (konfi_id) REFERENCES konfis (id),
    FOREIGN KEY (activity_id) REFERENCES activities (id),
    FOREIGN KEY (admin_id) REFERENCES users (id)
);

INSERT INTO konfi_activities_new 
SELECT 
  ka.id,
  ka.konfi_id,
  ka.activity_id,
  COALESCE(m.new_user_id, ka.admin_id) as admin_id,  -- Migriere admin_id zu user_id
  ka.completed_date,
  ka.created_at
FROM konfi_activities ka
LEFT JOIN admin_id_mapping m ON ka.admin_id = m.old_admin_id;

DROP TABLE konfi_activities;
ALTER TABLE konfi_activities_new RENAME TO konfi_activities;

-- 2.2 Aktualisiere bonus_points
CREATE TABLE bonus_points_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    konfi_id INTEGER,
    points INTEGER NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('gottesdienst', 'gemeinde')),
    description TEXT NOT NULL,
    admin_id INTEGER,  -- Wird zu user_id, aber wir behalten den Namen
    completed_date DATE DEFAULT CURRENT_DATE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (konfi_id) REFERENCES konfis (id),
    FOREIGN KEY (admin_id) REFERENCES users (id)
);

INSERT INTO bonus_points_new 
SELECT 
  bp.id,
  bp.konfi_id,
  bp.points,
  bp.type,
  bp.description,
  COALESCE(m.new_user_id, bp.admin_id) as admin_id,
  bp.completed_date,
  bp.created_at
FROM bonus_points bp
LEFT JOIN admin_id_mapping m ON bp.admin_id = m.old_admin_id;

DROP TABLE bonus_points;
ALTER TABLE bonus_points_new RENAME TO bonus_points;

-- 2.3 Aktualisiere custom_badges
CREATE TABLE custom_badges_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    icon TEXT NOT NULL,
    description TEXT,
    criteria_type TEXT NOT NULL,
    criteria_value INTEGER,
    criteria_extra TEXT,
    is_active BOOLEAN DEFAULT 1,
    created_by INTEGER,  -- Wird zu user_id
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_hidden BOOLEAN DEFAULT 0,
    organization_id INTEGER DEFAULT 1,
    FOREIGN KEY (created_by) REFERENCES users (id)
);

INSERT INTO custom_badges_new 
SELECT 
  cb.id,
  cb.name,
  cb.icon,
  cb.description,
  cb.criteria_type,
  cb.criteria_value,
  cb.criteria_extra,
  cb.is_active,
  COALESCE(m.new_user_id, cb.created_by) as created_by,
  cb.created_at,
  cb.is_hidden,
  cb.organization_id
FROM custom_badges cb
LEFT JOIN admin_id_mapping m ON cb.created_by = m.old_admin_id;

DROP TABLE custom_badges;
ALTER TABLE custom_badges_new RENAME TO custom_badges;

-- 2.4 Aktualisiere activity_requests
CREATE TABLE activity_requests_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    konfi_id INTEGER,
    activity_id INTEGER,
    requested_date DATE,
    comment TEXT,
    photo_filename TEXT,
    status TEXT DEFAULT 'pending',
    admin_comment TEXT,
    approved_by INTEGER,  -- Wird zu user_id
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (konfi_id) REFERENCES konfis (id),
    FOREIGN KEY (activity_id) REFERENCES activities (id),
    FOREIGN KEY (approved_by) REFERENCES users (id)
);

INSERT INTO activity_requests_new 
SELECT 
  ar.id,
  ar.konfi_id,
  ar.activity_id,
  ar.requested_date,
  ar.comment,
  ar.photo_filename,
  ar.status,
  ar.admin_comment,
  COALESCE(m.new_user_id, ar.approved_by) as approved_by,
  ar.created_at,
  ar.updated_at
FROM activity_requests ar
LEFT JOIN admin_id_mapping m ON ar.approved_by = m.old_admin_id;

DROP TABLE activity_requests;
ALTER TABLE activity_requests_new RENAME TO activity_requests;

-- 2.5 Aktualisiere chat_rooms
CREATE TABLE chat_rooms_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('jahrgang', 'admin', 'direct', 'group')),
    jahrgang_id INTEGER,
    created_by INTEGER,  -- Wird zu user_id
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    event_id INTEGER,
    FOREIGN KEY (jahrgang_id) REFERENCES jahrgaenge (id),
    FOREIGN KEY (created_by) REFERENCES users (id)
);

INSERT INTO chat_rooms_new 
SELECT 
  cr.id,
  cr.name,
  cr.type,
  cr.jahrgang_id,
  COALESCE(m.new_user_id, cr.created_by) as created_by,
  cr.created_at,
  cr.event_id
FROM chat_rooms cr
LEFT JOIN admin_id_mapping m ON cr.created_by = m.old_admin_id;

DROP TABLE chat_rooms;
ALTER TABLE chat_rooms_new RENAME TO chat_rooms;

-- 2.6 Aktualisiere events
CREATE TABLE events_new (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    event_date TEXT NOT NULL,
    location TEXT,
    location_maps_url TEXT,
    points INTEGER DEFAULT 0,
    type TEXT DEFAULT 'event',
    max_participants INTEGER NOT NULL,
    registration_opens_at TEXT,
    registration_closes_at TEXT,
    has_timeslots INTEGER DEFAULT 0,
    is_series INTEGER DEFAULT 0,
    series_id INTEGER,
    created_by INTEGER,  -- Wird zu user_id
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    organization_id INTEGER DEFAULT 1,
    FOREIGN KEY (created_by) REFERENCES users (id),
    FOREIGN KEY (series_id) REFERENCES events (id)
);

INSERT INTO events_new 
SELECT 
  e.id,
  e.name,
  e.description,
  e.event_date,
  e.location,
  e.location_maps_url,
  e.points,
  e.type,
  e.max_participants,
  e.registration_opens_at,
  e.registration_closes_at,
  e.has_timeslots,
  e.is_series,
  e.series_id,
  COALESCE(m.new_user_id, e.created_by) as created_by,
  e.created_at,
  e.organization_id
FROM events e
LEFT JOIN admin_id_mapping m ON e.created_by = m.old_admin_id;

DROP TABLE events;
ALTER TABLE events_new RENAME TO events;

-- Schritt 3: Jetzt können wir sicher die alte admins Tabelle löschen
DROP TABLE admins;

-- Schritt 4: Entferne das temporäre Mapping
DROP TABLE admin_id_mapping;

-- Schritt 5: Überprüfung der Migration
SELECT 'Migration completed. Check results:' as status;

-- Zeige die aktuelle Anzahl der Benutzer in der neuen users Tabelle
SELECT COUNT(*) as user_count, 'users in new table' as table_type FROM users;

-- Prüfe ob alle Foreign Key Referenzen korrekt sind
SELECT 'All foreign key constraints should now reference users table' as note;

PRAGMA foreign_key_check;