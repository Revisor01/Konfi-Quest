-- Admin Migration für bestehenden Admin User
-- Dieses Skript migriert den bestehenden Admin vom alten System ins neue RBAC-System

-- 1. Prüfe ob RBAC Tabellen existieren
-- Wenn nicht, wird die automatische Migration beim nächsten Server-Start ausgeführt

-- 2. Migriere den bestehenden Admin (nur wenn RBAC Tabellen existieren)
-- Ändere das Passwort entsprechend: admin rn%MWru13

-- Erstelle Organisation falls noch nicht vorhanden
INSERT OR IGNORE INTO organizations (id, name, slug, display_name, description, is_active) 
VALUES (1, 'Default Church', 'default', 'Standardgemeinde', 'Automatisch erstellte Standardorganisation', 1);

-- Erstelle Admin-Rolle falls noch nicht vorhanden  
INSERT OR IGNORE INTO roles (id, organization_id, name, display_name, description, is_system_role) 
VALUES (1, 1, 'admin', 'Pastor', 'Vollzugriff auf alle Funktionen', 1);

-- Erstelle alle Permissions (falls noch nicht vorhanden)
INSERT OR IGNORE INTO permissions (name, display_name, description, module) VALUES
-- Admin Module
('admin.users.create', 'Benutzer erstellen', 'Neue Admin-Benutzer erstellen', 'admin'),
('admin.users.edit', 'Benutzer bearbeiten', 'Admin-Benutzer bearbeiten', 'admin'),
('admin.users.delete', 'Benutzer löschen', 'Admin-Benutzer löschen', 'admin'),
('admin.users.view', 'Benutzer anzeigen', 'Admin-Benutzer anzeigen', 'admin'),
('admin.roles.create', 'Rollen erstellen', 'Neue Rollen erstellen', 'admin'),
('admin.roles.edit', 'Rollen bearbeiten', 'Rollen bearbeiten', 'admin'),
('admin.roles.delete', 'Rollen löschen', 'Rollen löschen', 'admin'),
('admin.roles.view', 'Rollen anzeigen', 'Rollen anzeigen', 'admin'),
('admin.permissions.manage', 'Berechtigungen verwalten', 'Berechtigungen verwalten', 'admin'),
('admin.jahrgaenge.assign', 'Jahrgang-Zuweisungen', 'Jahrgang-Zuweisungen verwalten', 'admin'),
('admin.organizations.view', 'Organisationen anzeigen', 'Organisationen anzeigen', 'admin'),
('admin.organizations.create', 'Organisationen erstellen', 'Neue Organisationen erstellen', 'admin'),
('admin.organizations.edit', 'Organisationen bearbeiten', 'Organisationen bearbeiten', 'admin'),
('admin.organizations.delete', 'Organisationen löschen', 'Organisationen löschen', 'admin'),
-- Badges Module  
('admin.badges.create', 'Badges erstellen', 'Neue Badges erstellen', 'badges'),
('admin.badges.edit', 'Badges bearbeiten', 'Bestehende Badges bearbeiten', 'badges'),
('admin.badges.delete', 'Badges löschen', 'Badges löschen', 'badges'),
('admin.badges.view', 'Badges anzeigen', 'Badges anzeigen', 'badges'),
('admin.badges.award', 'Badges verleihen', 'Badges manuell verleihen', 'badges'),
-- Activities Module
('admin.activities.create', 'Aktivitäten erstellen', 'Neue Aktivitäten erstellen', 'activities'),
('admin.activities.edit', 'Aktivitäten bearbeiten', 'Aktivitäten bearbeiten', 'activities'),
('admin.activities.delete', 'Aktivitäten löschen', 'Aktivitäten löschen', 'activities'),
('admin.activities.view', 'Aktivitäten anzeigen', 'Aktivitäten anzeigen', 'activities'),
-- Konfis Module
('admin.konfis.create', 'Konfis anlegen', 'Neue Konfis anlegen', 'konfis'),
('admin.konfis.edit', 'Konfis bearbeiten', 'Konfis bearbeiten', 'konfis'),
('admin.konfis.delete', 'Konfis löschen', 'Konfis löschen', 'konfis'),
('admin.konfis.view', 'Konfis anzeigen', 'Konfis anzeigen', 'konfis'),
('admin.konfis.reset_password', 'Passwörter zurücksetzen', 'Konfi-Passwörter zurücksetzen', 'konfis'),
('admin.konfis.assign_points', 'Punkte vergeben', 'Punkte manuell vergeben', 'konfis'),
-- Jahrgaenge Module
('admin.jahrgaenge.create', 'Jahrgänge erstellen', 'Neue Jahrgänge erstellen', 'jahrgaenge'),
('admin.jahrgaenge.edit', 'Jahrgänge bearbeiten', 'Jahrgänge bearbeiten', 'jahrgaenge'),
('admin.jahrgaenge.delete', 'Jahrgänge löschen', 'Jahrgänge löschen', 'jahrgaenge'),
('admin.jahrgaenge.view', 'Jahrgänge anzeigen', 'Jahrgänge anzeigen', 'jahrgaenge'),
-- Categories Module
('admin.categories.create', 'Kategorien erstellen', 'Neue Kategorien erstellen', 'categories'),
('admin.categories.edit', 'Kategorien bearbeiten', 'Kategorien bearbeiten', 'categories'),
('admin.categories.delete', 'Kategorien löschen', 'Kategorien löschen', 'categories'),
('admin.categories.view', 'Kategorien anzeigen', 'Kategorien anzeigen', 'categories'),
-- Events Module
('admin.events.create', 'Events erstellen', 'Neue Events erstellen', 'events'),
('admin.events.edit', 'Events bearbeiten', 'Events bearbeiten', 'events'),
('admin.events.delete', 'Events löschen', 'Events löschen', 'events'),
('admin.events.view', 'Events anzeigen', 'Events anzeigen', 'events'),
('admin.events.manage_bookings', 'Buchungen verwalten', 'Event-Buchungen verwalten', 'events'),
-- Settings Module
('admin.settings.edit', 'Einstellungen bearbeiten', 'Systemeinstellungen bearbeiten', 'settings');

-- Gebe der Admin-Rolle alle Permissions
INSERT OR IGNORE INTO role_permissions (role_id, permission_id, granted)
SELECT 1, p.id, 1 FROM permissions p;

-- Migriere den bestehenden Admin-User 
-- Verwende das richtige Passwort: admin rn%MWru13
INSERT OR IGNORE INTO users (
    id, organization_id, username, display_name, password_hash, role_id, is_active
) 
SELECT 
    1, -- ID
    1, -- organization_id 
    a.username,
    a.display_name,
    a.password_hash,
    1, -- role_id (admin role)
    1  -- is_active
FROM admins a 
WHERE a.username = 'admin'
LIMIT 1;

-- Update organization_id in bestehenden Tabellen falls noch nicht gesetzt
UPDATE jahrgaenge SET organization_id = 1 WHERE organization_id IS NULL;
UPDATE konfis SET organization_id = 1 WHERE organization_id IS NULL;
UPDATE activities SET organization_id = 1 WHERE organization_id IS NULL;
UPDATE custom_badges SET organization_id = 1 WHERE organization_id IS NULL;
UPDATE categories SET organization_id = 1 WHERE organization_id IS NULL;

-- Zeige das Ergebnis
SELECT 'Migration completed. New user:' as status;
SELECT u.id, u.username, u.display_name, r.name as role_name, o.name as organization
FROM users u 
JOIN roles r ON u.role_id = r.id
JOIN organizations o ON u.organization_id = o.id
WHERE u.username = 'admin';