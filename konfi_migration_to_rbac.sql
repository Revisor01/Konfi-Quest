-- Konfi Migration ins RBAC-System
-- Dieses Skript migriert alle Konfis aus der alten konfis Tabelle in die neue users Tabelle

BEGIN TRANSACTION;

-- Schritt 1: Erstelle eine spezielle Konfi-Rolle falls noch nicht vorhanden
INSERT OR IGNORE INTO roles (organization_id, name, display_name, description, is_system_role) 
VALUES (1, 'konfi', 'Konfirmand:in', 'Konfirmanden haben Zugriff auf ihre eigenen Daten und können Aktivitäten beantragen', 1);

-- Schritt 2: Migriere alle Konfis in die users Tabelle
INSERT OR IGNORE INTO users (
    organization_id, 
    username, 
    email,
    display_name, 
    password_hash, 
    role_id,
    is_active
)
SELECT 
    COALESCE(k.organization_id, 1) as organization_id,
    k.username,
    k.email,
    k.name as display_name,
    k.password_hash,
    (SELECT id FROM roles WHERE name = 'konfi' AND organization_id = COALESCE(k.organization_id, 1) LIMIT 1) as role_id,
    1 as is_active
FROM konfis k
WHERE NOT EXISTS (
    SELECT 1 FROM users u 
    WHERE u.username = k.username 
    AND u.organization_id = COALESCE(k.organization_id, 1)
);

-- Schritt 3: Erstelle eine Mapping-Tabelle für Konfi-spezifische Daten
-- Da Konfis spezielle Felder haben (jahrgang_id, gottesdienst_points, gemeinde_points, password_plain)
CREATE TABLE IF NOT EXISTS konfi_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    jahrgang_id INTEGER,
    gottesdienst_points INTEGER DEFAULT 0,
    gemeinde_points INTEGER DEFAULT 0,
    password_plain TEXT, -- Für Reset-Funktionen
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
    FOREIGN KEY (jahrgang_id) REFERENCES jahrgaenge (id),
    UNIQUE(user_id)
);

-- Schritt 4: Migriere Konfi-spezifische Daten in konfi_profiles
INSERT OR IGNORE INTO konfi_profiles (
    user_id,
    jahrgang_id,
    gottesdienst_points,
    gemeinde_points,
    password_plain
)
SELECT 
    u.id as user_id,
    k.jahrgang_id,
    k.gottesdienst_points,
    k.gemeinde_points,
    k.password_plain
FROM konfis k
JOIN users u ON k.username = u.username AND u.organization_id = COALESCE(k.organization_id, 1)
WHERE NOT EXISTS (
    SELECT 1 FROM konfi_profiles kp WHERE kp.user_id = u.id
);

-- Schritt 5: Aktualisiere Foreign Key Referenzen in bestehenden Tabellen
-- konfi_activities: Aktualisiere konfi_id auf user_id
UPDATE konfi_activities 
SET konfi_id = (
    SELECT u.id 
    FROM users u 
    JOIN konfis k ON u.username = k.username 
    WHERE k.id = konfi_activities.konfi_id 
    LIMIT 1
)
WHERE EXISTS (
    SELECT 1 
    FROM users u 
    JOIN konfis k ON u.username = k.username 
    WHERE k.id = konfi_activities.konfi_id
);

-- bonus_points: Aktualisiere konfi_id auf user_id
UPDATE bonus_points 
SET konfi_id = (
    SELECT u.id 
    FROM users u 
    JOIN konfis k ON u.username = k.username 
    WHERE k.id = bonus_points.konfi_id 
    LIMIT 1
)
WHERE EXISTS (
    SELECT 1 
    FROM users u 
    JOIN konfis k ON u.username = k.username 
    WHERE k.id = bonus_points.konfi_id
);

-- konfi_badges: Aktualisiere konfi_id auf user_id
UPDATE konfi_badges 
SET konfi_id = (
    SELECT u.id 
    FROM users u 
    JOIN konfis k ON u.username = k.username 
    WHERE k.id = konfi_badges.konfi_id 
    LIMIT 1
)
WHERE EXISTS (
    SELECT 1 
    FROM users u 
    JOIN konfis k ON u.username = k.username 
    WHERE k.id = konfi_badges.konfi_id
);

-- activity_requests: Aktualisiere konfi_id auf user_id
UPDATE activity_requests 
SET konfi_id = (
    SELECT u.id 
    FROM users u 
    JOIN konfis k ON u.username = k.username 
    WHERE k.id = activity_requests.konfi_id 
    LIMIT 1
)
WHERE EXISTS (
    SELECT 1 
    FROM users u 
    JOIN konfis k ON u.username = k.username 
    WHERE k.id = activity_requests.konfi_id
);

-- event_bookings: Aktualisiere konfi_id auf user_id
UPDATE event_bookings 
SET konfi_id = (
    SELECT u.id 
    FROM users u 
    JOIN konfis k ON u.username = k.username 
    WHERE k.id = event_bookings.konfi_id 
    LIMIT 1
)
WHERE EXISTS (
    SELECT 1 
    FROM users u 
    JOIN konfis k ON u.username = k.username 
    WHERE k.id = event_bookings.konfi_id
);

-- chat_participants: Aktualisiere user_id für konfis
UPDATE chat_participants 
SET user_id = (
    SELECT u.id 
    FROM users u 
    JOIN konfis k ON u.username = k.username 
    WHERE k.id = chat_participants.user_id AND chat_participants.user_type = 'konfi'
    LIMIT 1
)
WHERE user_type = 'konfi' AND EXISTS (
    SELECT 1 
    FROM users u 
    JOIN konfis k ON u.username = k.username 
    WHERE k.id = chat_participants.user_id
);

-- chat_messages: Aktualisiere user_id für konfis
UPDATE chat_messages 
SET user_id = (
    SELECT u.id 
    FROM users u 
    JOIN konfis k ON u.username = k.username 
    WHERE k.id = chat_messages.user_id AND chat_messages.user_type = 'konfi'
    LIMIT 1
)
WHERE user_type = 'konfi' AND EXISTS (
    SELECT 1 
    FROM users u 
    JOIN konfis k ON u.username = k.username 
    WHERE k.id = chat_messages.user_id
);

-- chat_read_status: Aktualisiere user_id für konfis
UPDATE chat_read_status 
SET user_id = (
    SELECT u.id 
    FROM users u 
    JOIN konfis k ON u.username = k.username 
    WHERE k.id = chat_read_status.user_id AND chat_read_status.user_type = 'konfi'
    LIMIT 1
)
WHERE user_type = 'konfi' AND EXISTS (
    SELECT 1 
    FROM users u 
    JOIN konfis k ON u.username = k.username 
    WHERE k.id = chat_read_status.user_id
);

-- chat_poll_votes: Aktualisiere user_id für konfis
UPDATE chat_poll_votes 
SET user_id = (
    SELECT u.id 
    FROM users u 
    JOIN konfis k ON u.username = k.username 
    WHERE k.id = chat_poll_votes.user_id AND chat_poll_votes.user_type = 'konfi'
    LIMIT 1
)
WHERE user_type = 'konfi' AND EXISTS (
    SELECT 1 
    FROM users u 
    JOIN konfis k ON u.username = k.username 
    WHERE k.id = chat_poll_votes.user_id
);

COMMIT;

-- Überprüfung der Migration
SELECT 'Migration completed. Results:' as status;

SELECT COUNT(*) as migrated_konfis, 'konfis migrated to users table' as description
FROM users u
JOIN roles r ON u.role_id = r.id
WHERE r.name = 'konfi';

SELECT COUNT(*) as konfi_profiles, 'konfi profiles created' as description
FROM konfi_profiles;

-- Zeige ein paar Beispiele
SELECT u.username, u.display_name, r.name as role, kp.jahrgang_id, kp.gottesdienst_points, kp.gemeinde_points
FROM users u
JOIN roles r ON u.role_id = r.id
LEFT JOIN konfi_profiles kp ON u.id = kp.user_id
WHERE r.name = 'konfi'
LIMIT 5;