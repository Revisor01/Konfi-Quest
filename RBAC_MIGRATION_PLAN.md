# RBAC Migration Plan - Konfi-Quest System
**Datum:** 19. November 2025
**Autor:** Simon Luthe
**Status:** Planungsphase

---

## Übersicht

Diese Dokumentation beschreibt die Migration des Konfi-Quest RBAC-Systems von einem flexiblen, datenbankbasierten Berechtigungssystem zu einem vereinfachten, hardcodierten 5-Rollen-System mit anpassbaren Rollentiteln pro Organisation.

---

## IST-Zustand (Aktuell)

### Rollen-Struktur
- **4 Rollen** in Organization 1:
  - `org_admin` (73 Berechtigungen)
  - `admin` (72 Berechtigungen)
  - `teamer` (15 Berechtigungen)
  - `konfi` (0 Berechtigungen)

### Berechtigungen
- **74 Permissions** in `permissions` Tabelle definiert
- **Flexible Zuordnung** über `role_permissions` Tabelle
- **Org_admin kann neue Rollen erstellen** und Berechtigungen zuweisen
- **UI für Rechteverwaltung** vorhanden (Rollen-Tab)

### Probleme
1. **Zu viele Berechtigungen für Teamer**: Hat `requests.view`, `requests.approve`, `requests.reject` (Datenschutz-Problem!)
2. **Keine System-Admin Rolle**: Kein super_admin für organisationsübergreifende Verwaltung
3. **Komplexität**: Flexible Berechtigungen werden nicht benötigt
4. **Fehlende Rollentitel-Anpassung**: "admin" statt "Pastor" oder "Pastorin"

### Technische Basis
- **Backend**: Node.js Express mit PostgreSQL
- **Middleware**: `middleware/rbac.js` lädt Permissions aus DB
- **Frontend**: `AppContext.tsx` prüft `user.permissions` Array
- **Hierarchie**: org_admin (4) > admin (3) > teamer (2) > konfi (1)

---

## SOLL-Zustand (Ziel)

### 1. Rollen-Struktur (5 feste Rollen)

#### Super-Admin (system-weit)
- **Name (technisch):** `super_admin`
- **Display Name (Standard):** "Super Admin"
- **Organization ID:** `NULL` (kein Zugriff auf Org-Daten!)
- **Hierarchie-Level:** 5
- **Kann verwalten:** Organisationen, org_admins erstellen
- **Sieht NICHT:** Konfis, Events, Aktivitäten, Chat (keine org_id!)

**Berechtigungen (5):**
```javascript
'admin.organizations.create',
'admin.organizations.edit',
'admin.organizations.delete',
'admin.organizations.view',
'admin.users.create'  // Nur org_admins für neue Orgs
```

#### Org-Admin (pro Organisation)
- **Name (technisch):** `org_admin`
- **Display Name (anpassbar):** z.B. "Organisations-Leitung", "Hauptverantwortlicher"
- **Organization ID:** Eigene Organisation
- **Hierarchie-Level:** 4
- **Kann verwalten:** Alle User/Rollen in seiner Org, Rollentitel anpassen

**Berechtigungen (65):**
```javascript
// Alle admin Berechtigungen PLUS:
'admin.users.create',
'admin.users.edit',
'admin.users.delete',
'admin.users.view',
'admin.users.assign_roles',
'admin.roles.edit_display_name',  // NEU: Rollentitel anpassen
'admin.roles.view',
'admin.settings.view',
'admin.settings.edit',
'admin.organization.view',
'admin.organization.edit'
```

#### Admin (Pastor/Pastorin/Leitung)
- **Name (technisch):** `admin`
- **Display Name (anpassbar):** z.B. "Pastor", "Pastorin", "Diakon", "Leitung"
- **Organization ID:** Eigene Organisation
- **Hierarchie-Level:** 3
- **Kann verwalten:** Teamer, Konfis

**Berechtigungen (55):**
```javascript
// Volle Rechte außer User-/Rollen-Verwaltung
'admin.konfis.create',
'admin.konfis.edit',
'admin.konfis.delete',
'admin.konfis.view',
'admin.konfis.assign_points',
'admin.konfis.view_history',
'admin.activities.create',
'admin.activities.edit',
'admin.activities.delete',
'admin.activities.view',
'admin.categories.create',
'admin.categories.edit',
'admin.categories.delete',
'admin.categories.view',
'admin.badges.create',
'admin.badges.edit',
'admin.badges.delete',
'admin.badges.view',
'admin.badges.assign',
'admin.badges.revoke',
'admin.events.create',
'admin.events.edit',
'admin.events.delete',
'admin.events.view',
'admin.events.manage_bookings',
'admin.jahrgaenge.create',
'admin.jahrgaenge.edit',
'admin.jahrgaenge.delete',
'admin.jahrgaenge.view',
'admin.requests.view',
'admin.requests.approve',
'admin.requests.reject',
'admin.requests.delete',
'admin.chat.create_room',
'admin.chat.delete_room',
'admin.chat.manage_participants',
'admin.chat.view_all',
'admin.chat.send_message',
'admin.statistics.view',
'admin.statistics.export',
// ... weitere 15 Berechtigungen
```

#### Teamer (Helfer)
- **Name (technisch):** `teamer`
- **Display Name (anpassbar):** z.B. "Mitarbeiter", "Helfer", "Teamer"
- **Organization ID:** Eigene Organisation
- **Hierarchie-Level:** 2
- **Kann verwalten:** Nichts

**Berechtigungen (11):**
```javascript
'admin.konfis.view',              // Nur lesen!
'admin.konfis.assign_points',     // Punkte vergeben
'admin.events.create',
'admin.events.edit',
'admin.events.delete',
'admin.events.view',
'admin.events.manage_bookings',
'admin.activities.view',          // Nur lesen!
'admin.categories.view',          // Nur lesen!
'admin.badges.view',              // Nur lesen!
'admin.jahrgaenge.view'           // Nur lesen!
```

**Explizit KEINE Rechte für:**
- `admin.requests.*` (Datenschutz!)
- `admin.konfis.create/edit/delete`
- `admin.chat.*` (außer eigene Nachrichten)

#### Konfi (Teilnehmer)
- **Name (technisch):** `konfi`
- **Display Name (anpassbar):** z.B. "Konfirmand", "Teilnehmer"
- **Organization ID:** Eigene Organisation
- **Hierarchie-Level:** 1
- **Kann verwalten:** Nichts

**Berechtigungen (0):** Keine Admin-Berechtigungen, nur App-Nutzung

---

### 2. Rollentitel-Anpassung (Role Titles PRO USER!)

#### Konzept - WICHTIG!
- **Rollentitel sind pro EINZELNEM USER** anpassbar
- **NICHT pro Rolle!**
- User A (admin) kann Titel "Pastor" haben
- User B (admin) kann Titel "Diakon" haben
- User C (admin) kann Titel "Pastorin" haben

#### Beispiel
```
Organization 1 "St. Clemens Büsum":
- User: Simon Luthe (admin) → role_title: "Pastor"
- User: Maria Schmidt (admin) → role_title: "Pastorin"
- User: Peter Meyer (teamer) → role_title: "Jugendleiter"
- User: Anna Klein (teamer) → role_title: "Mitarbeiterin"
```

#### Datenbank-Struktur - NEUE Spalte!
```sql
users Table (NEU mit role_title):
┌────┬─────────────┬──────────────┬──────────────────┬─────────┬──────────────┐
│ id │ username    │ display_name │ role_title       │ role_id │ organization │
├────┼─────────────┼──────────────┼──────────────────┼─────────┼──────────────┤
│ 1  │ simon       │ Simon Luthe  │ Pastor           │ 2       │ 1            │
│ 2  │ maria       │ Maria Schmidt│ Pastorin         │ 2       │ 1            │
│ 3  │ peter       │ Peter Meyer  │ Jugendleiter     │ 3       │ 1            │
│ 4  │ anna        │ Anna Klein   │ Mitarbeiterin    │ 3       │ 1            │
│ 5  │ max         │ Max Müller   │ Diakon           │ 2       │ 2            │
└────┴─────────────┴──────────────┴──────────────────┴─────────┴──────────────┘

roles Table (KEINE display_name Spalte nötig!):
┌────┬─────────────────┬──────────────┬─────────────────┐
│ id │ organization_id │ name         │ is_system_role  │
├────┼─────────────────┼──────────────┼─────────────────┤
│ 1  │ 1               │ org_admin    │ true            │
│ 2  │ 1               │ admin        │ true            │
│ 3  │ 1               │ teamer       │ true            │
│ 4  │ 1               │ konfi        │ true            │
│ 5  │ NULL            │ super_admin  │ true            │
└────┴─────────────────┴──────────────┴─────────────────┘
```

**Wichtig:**
- `users.display_name` = Echter Name (z.B. "Simon Luthe") - NICHT editierbar
- `users.role_title` = Funktionsbezeichnung (z.B. "Pastor", "Diakon") - editierbar durch org_admin
- `roles.name` = technischer Schlüssel (admin, teamer, etc.) - NICHT editierbar
- `roles.display_name` = NICHT MEHR BENÖTIGT! (kann entfernt werden)

---

### 3. Backend-Änderungen

#### 3.1 Neue Datei: `/backend/config/rolePermissions.js`

**Zweck:** Zentrale Definition aller hardcodierten Berechtigungen

```javascript
const ROLE_PERMISSIONS = {
  'super_admin': [
    'admin.organizations.create',
    'admin.organizations.edit',
    'admin.organizations.delete',
    'admin.organizations.view',
    'admin.users.create'
  ],

  'org_admin': [
    // Alle admin Permissions PLUS:
    'admin.users.create',
    'admin.users.edit',
    'admin.users.delete',
    'admin.users.view',
    'admin.users.assign_roles',
    'admin.roles.edit_display_name',
    'admin.roles.view',
    'admin.settings.view',
    'admin.settings.edit',
    'admin.organization.view',
    'admin.organization.edit',
    // ... alle admin permissions (55)
  ],

  'admin': [
    'admin.konfis.create',
    'admin.konfis.edit',
    'admin.konfis.delete',
    'admin.konfis.view',
    'admin.konfis.assign_points',
    // ... 50 weitere
  ],

  'teamer': [
    'admin.konfis.view',
    'admin.konfis.assign_points',
    'admin.events.create',
    'admin.events.edit',
    'admin.events.delete',
    'admin.events.view',
    'admin.events.manage_bookings',
    'admin.activities.view',
    'admin.categories.view',
    'admin.badges.view',
    'admin.jahrgaenge.view'
  ],

  'konfi': []
};

module.exports = { ROLE_PERMISSIONS };
```

---

#### 3.2 Änderung: `/backend/middleware/rbac.js`

**Zeilen 57-67:** Permissions-Abfrage aus DB entfernen

**IST:**
```javascript
const permissionsQuery = `
  SELECT p.name
  FROM users u
  JOIN roles r ON u.role_id = r.id
  JOIN role_permissions rp ON r.id = rp.role_id
  JOIN permissions p ON rp.permission_id = p.id
  WHERE u.id = $1 AND rp.granted = true
`;
const { rows: permissionRows } = await db.query(permissionsQuery, [decoded.id]);
const permissions = permissionRows.map(row => row.name);
```

**SOLL:**
```javascript
const { ROLE_PERMISSIONS } = require('../config/rolePermissions');
const permissions = ROLE_PERMISSIONS[user.role_name] || [];
```

**Zeile 91:** Bug-Fix für is_super_admin

**IST:**
```javascript
is_super_admin: user.role_name === 'super_admin' || user.role_name === 'org_admin'
```

**SOLL:**
```javascript
is_super_admin: user.role_name === 'super_admin',
is_org_admin: user.role_name === 'org_admin'
```

---

#### 3.3 Änderung: `/backend/routes/roles.js`

**Entfernen:**
- POST `/` (Zeilen 95-142) - Rolle erstellen - MUSS WEG!
- DELETE `/:id` (Zeilen 221-261) - Rolle löschen - MUSS WEG!
- POST `/:id/permissions` (Zeilen 292-333) - Berechtigungen ändern - MUSS WEG!
- PUT `/:id` (Zeilen 145-218) - Display name ändern - NICHT MEHR NÖTIG!

**Grund:** Rollentitel sind jetzt in `users.role_title`, NICHT in `roles.display_name`!

---

#### 3.4 Neue Route: `/backend/routes/users.js` - Role Title bearbeiten

**NEUE Route hinzufügen:**

```javascript
// PUT /api/users/:id/role-title - Rollentitel eines Users ändern (org_admin)
router.put('/:id/role-title', verifyTokenRBAC, checkPermission('admin.users.edit'), async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { role_title } = req.body;

    // Validation
    if (!role_title || role_title.trim().length === 0) {
      return res.status(400).json({ error: 'Rollentitel ist erforderlich' });
    }

    if (role_title.length > 50) {
      return res.status(400).json({ error: 'Rollentitel darf maximal 50 Zeichen lang sein' });
    }

    // Hole User
    const { rows: [user] } = await db.query(
      'SELECT * FROM users WHERE id = $1',
      [userId]
    );

    if (!user) {
      return res.status(404).json({ error: 'User nicht gefunden' });
    }

    // Prüfe: Nur eigene Organisation
    if (user.organization_id !== req.user.organization_id) {
      return res.status(403).json({ error: 'Keine Berechtigung für diese Organisation' });
    }

    // Update role_title
    await db.query(
      'UPDATE users SET role_title = $1, updated_at = NOW() WHERE id = $2',
      [role_title.trim(), userId]
    );

    res.json({
      success: true,
      message: 'Rollentitel erfolgreich aktualisiert',
      role_title: role_title.trim()
    });

  } catch (error) {
    console.error('Error updating user role title:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren des Rollentitels' });
  }
});
```

---

#### 3.5 Änderung: `/backend/routes/organizations.js`

**Neue Routes hinzufügen:**

```javascript
// GET /api/organizations - Alle Orgs (nur super_admin)
router.get('/', verifyTokenRBAC, async (req, res) => {
  try {
    if (req.user.role_name !== 'super_admin') {
      return res.status(403).json({ error: 'Nur Super-Admin darf alle Organisationen sehen' });
    }

    const { rows } = await db.query('SELECT * FROM organizations ORDER BY name');
    res.json(rows);

  } catch (error) {
    console.error('Error fetching organizations:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Organisationen' });
  }
});

// POST /api/organizations - Neue Org erstellen (nur super_admin)
router.post('/', verifyTokenRBAC, async (req, res) => {
  try {
    if (req.user.role_name !== 'super_admin') {
      return res.status(403).json({ error: 'Nur Super-Admin darf Organisationen erstellen' });
    }

    const { name, slug, org_admin_username, org_admin_password } = req.body;

    // Validation
    if (!name || !slug || !org_admin_username || !org_admin_password) {
      return res.status(400).json({ error: 'Alle Felder sind erforderlich' });
    }

    const client = await db.getClient();

    try {
      await client.query('BEGIN');

      // 1. Organisation erstellen
      const { rows: [org] } = await client.query(
        'INSERT INTO organizations (name, slug, is_active) VALUES ($1, $2, true) RETURNING *',
        [name, slug]
      );

      // 2. System-Rollen erstellen (4 Stück)
      const systemRoles = [
        { name: 'org_admin', display_name: 'Organisations-Leitung' },
        { name: 'admin', display_name: 'Admin' },
        { name: 'teamer', display_name: 'Teamer' },
        { name: 'konfi', display_name: 'Konfi' }
      ];

      const roleIds = {};
      for (const role of systemRoles) {
        const { rows: [createdRole] } = await client.query(
          `INSERT INTO roles (organization_id, name, display_name, is_system_role)
           VALUES ($1, $2, $3, true) RETURNING *`,
          [org.id, role.name, role.display_name]
        );
        roleIds[role.name] = createdRole.id;
      }

      // 3. Org-Admin User erstellen
      const hashedPassword = await bcrypt.hash(org_admin_password, 10);
      await client.query(
        `INSERT INTO users (organization_id, username, display_name, password_hash, role_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [org.id, org_admin_username, org_admin_username, hashedPassword, roleIds.org_admin]
      );

      await client.query('COMMIT');

      res.json({
        success: true,
        organization: org,
        message: 'Organisation erfolgreich erstellt'
      });

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

  } catch (error) {
    console.error('Error creating organization:', error);
    res.status(500).json({ error: 'Fehler beim Erstellen der Organisation' });
  }
});

// GET /api/organizations/me/settings - Eigene Org Settings (org_admin)
router.get('/me/settings', verifyTokenRBAC, checkPermission('admin.organization.view'), async (req, res) => {
  try {
    const { rows: [org] } = await db.query(
      'SELECT * FROM organizations WHERE id = $1',
      [req.user.organization_id]
    );

    if (!org) {
      return res.status(404).json({ error: 'Organisation nicht gefunden' });
    }

    res.json(org);

  } catch (error) {
    console.error('Error fetching organization settings:', error);
    res.status(500).json({ error: 'Fehler beim Laden der Organisations-Einstellungen' });
  }
});

// PUT /api/organizations/me/settings - Eigene Org bearbeiten (org_admin)
router.put('/me/settings', verifyTokenRBAC, checkPermission('admin.organization.edit'), async (req, res) => {
  try {
    const { name, slug } = req.body;

    await db.query(
      'UPDATE organizations SET name = $1, slug = $2, updated_at = NOW() WHERE id = $3',
      [name, slug, req.user.organization_id]
    );

    res.json({
      success: true,
      message: 'Organisations-Einstellungen erfolgreich aktualisiert'
    });

  } catch (error) {
    console.error('Error updating organization settings:', error);
    res.status(500).json({ error: 'Fehler beim Aktualisieren der Organisations-Einstellungen' });
  }
});
```

---

#### 3.6 Änderung: `/backend/utils/roleHierarchy.js`

**Zeilen 4-9:** super_admin hinzufügen

**IST:**
```javascript
const ROLE_HIERARCHY = {
  'org_admin': 4,
  'admin': 3,
  'teamer': 2,
  'konfi': 1
};
```

**SOLL:**
```javascript
const ROLE_HIERARCHY = {
  'super_admin': 5,
  'org_admin': 4,
  'admin': 3,
  'teamer': 2,
  'konfi': 1
};
```

---

### 4. Database Migration Script

```sql
-- ============================================
-- RBAC Migration zu Hardcoded Permissions + Role Titles pro User
-- Datum: 19. November 2025
-- ============================================

BEGIN;

-- 1. NEUE Spalte `role_title` in users Tabelle hinzufügen
ALTER TABLE users ADD COLUMN IF NOT EXISTS role_title TEXT;

-- 2. Super-Admin Rolle erstellen (organization_id = NULL!)
INSERT INTO roles (organization_id, name, is_system_role)
VALUES (NULL, 'super_admin', true)
ON CONFLICT DO NOTHING;

-- 3. Super-Admin User erstellen (Simon)
-- WICHTIG: Passwort muss später geändert werden!
INSERT INTO users (organization_id, username, display_name, role_title, password_hash, role_id)
SELECT
  NULL,
  'super_admin',
  'Super Admin',
  'System Administrator',  -- role_title statt roles.display_name!
  '$2b$10$TEMPORARYHASHNEEDSCHANGE',  -- MUSS GEÄNDERT WERDEN!
  r.id
FROM roles r
WHERE r.name = 'super_admin' AND r.organization_id IS NULL
ON CONFLICT DO NOTHING;

-- 4. Alle bestehenden Rollen als is_system_role markieren
UPDATE roles
SET is_system_role = true
WHERE name IN ('org_admin', 'admin', 'teamer', 'konfi');

-- 5. Default role_title für bestehende User setzen (basierend auf ihrer Rolle)
-- Org-Admins
UPDATE users u
SET role_title = 'Organisations-Leitung'
FROM roles r
WHERE u.role_id = r.id
  AND r.name = 'org_admin'
  AND u.role_title IS NULL;

-- Admins (Pastor/Pastorin basierend auf Vorname? Oder einfach "Admin"?)
UPDATE users u
SET role_title = 'Admin'
FROM roles r
WHERE u.role_id = r.id
  AND r.name = 'admin'
  AND u.role_title IS NULL;

-- Teamer
UPDATE users u
SET role_title = 'Mitarbeiter'
FROM roles r
WHERE u.role_id = r.id
  AND r.name = 'teamer'
  AND u.role_title IS NULL;

-- Konfis (bekommen keinen Titel)
UPDATE users u
SET role_title = NULL
FROM roles r
WHERE u.role_id = r.id
  AND r.name = 'konfi';

-- 6. Optional: roles.display_name Spalte entfernen (wird nicht mehr genutzt)
-- ALTER TABLE roles DROP COLUMN IF EXISTS display_name;

-- 7. Optional: role_permissions Tabelle leeren (wird nicht mehr genutzt)
-- TRUNCATE role_permissions;

COMMIT;

-- ============================================
-- Verification Queries
-- ============================================

-- Check: Alle Rollen anzeigen
SELECT id, organization_id, name, is_system_role
FROM roles
ORDER BY organization_id NULLS FIRST, name;

-- Check: Super-Admin User existiert
SELECT u.id, u.username, u.display_name, u.role_title, r.name as role_name, u.organization_id
FROM users u
JOIN roles r ON u.role_id = r.id
WHERE r.name = 'super_admin';

-- Check: Alle User mit role_title
SELECT u.id, u.username, u.display_name, u.role_title, r.name as role_name, u.organization_id
FROM users u
JOIN roles r ON u.role_id = r.id
WHERE u.organization_id = 1
ORDER BY r.name, u.username
LIMIT 20;

-- Check: Anzahl Rollen pro Organisation
SELECT organization_id, COUNT(*) as role_count
FROM roles
GROUP BY organization_id
ORDER BY organization_id NULLS FIRST;
```

---

### 5. Frontend-Änderungen

#### 5.1 Entfernen: Rollen-Tab

**Datei:** `/frontend/src/components/admin/AdminTabs.tsx`

**Entfernen:**
- Tab "Rollen" aus Navigation
- Route für `/admin/roles`

**Grund:** Permissions sind hardcoded, keine UI für Rechteverwaltung nötig

---

#### 5.2 Änderung: User-Management View

**Datei:** `/frontend/src/components/admin/UsersView.tsx` (oder ähnlich)

**Zweck:** Org-Admin kann `role_title` für jeden User in seiner Org anpassen

**Neue Funktionen:**
- Spalte "Rollentitel" in User-Liste anzeigen
- Edit-Button neben jedem User
- Modal zum Bearbeiten von `role_title`
- API Call: `PUT /api/users/:id/role-title`

```typescript
// Beispiel Edit-Funktion
const updateRoleTitle = async (userId: number, newTitle: string) => {
  try {
    await api.put(`/users/${userId}/role-title`, { role_title: newTitle });
    // Refresh user list
    loadUsers();
  } catch (error) {
    console.error('Error updating role title:', error);
  }
};
```

**Integration in:** Bestehende User-Verwaltung (nur für org_admin sichtbar)

---

#### 5.3 Änderung: `/frontend/src/contexts/AppContext.tsx`

**Keine Änderung nötig!**

Permissions werden weiterhin als Array in `user.permissions` gespeichert.
Die `hasPermission()` Funktion funktioniert ohne Änderung.

**Zeilen 527-530:**
```typescript
const hasPermission = useCallback((permission: string): boolean => {
  if (!user) return false;
  return user.permissions?.includes(permission) || false;
}, [user]);
```

---

### 6. Organisations-Verwaltung (Super-Admin)

#### Neue Frontend-Komponente: OrganizationsView.tsx

**Zweck:** Super-Admin kann Organisationen verwalten

**Features:**
- Liste aller Organisationen
- Neue Organisation erstellen (+ 4 System-Rollen + Org-Admin User)
- Organisation bearbeiten (Name, Slug)
- Organisation deaktivieren (NICHT löschen!)

**Route:** `/admin/organizations` (nur für super_admin sichtbar)

---

### 7. Testing-Checkliste

#### Backend Tests

- [ ] Super-Admin kann sich einloggen
- [ ] Super-Admin sieht KEINE Konfis/Events (org_id = NULL)
- [ ] Super-Admin kann neue Organisation erstellen
- [ ] Neue Org bekommt automatisch 4 System-Rollen
- [ ] Org-Admin User wird automatisch angelegt
- [ ] Org-Admin kann `role_title` für User in seiner Org ändern
- [ ] Org-Admin kann NICHT `role_title` für User in anderer Org ändern
- [ ] Org-Admin kann KEINE neuen Rollen erstellen (Route entfernt)
- [ ] Org-Admin kann System-Rollen NICHT löschen (Route entfernt)
- [ ] Admin kann `role_title` NICHT ändern (Permission fehlt)
- [ ] User.role_title wird korrekt in API responses zurückgegeben
- [ ] Teamer hat KEINE requests.* Permissions mehr
- [ ] Teamer kann Events verwalten
- [ ] Teamer kann Punkte vergeben
- [ ] Teamer kann Konfis NICHT bearbeiten (nur ansehen)
- [ ] Permissions werden aus `config/rolePermissions.js` geladen (NICHT DB)

#### Frontend Tests

- [ ] Rollen-Tab ist verschwunden
- [ ] User-Verwaltung zeigt `role_title` Spalte an
- [ ] `role_title` kann pro User editiert werden (nur org_admin)
- [ ] Organisations-View erscheint (nur super_admin)
- [ ] Neue Org kann erstellt werden
- [ ] Rollentitel werden korrekt angezeigt (z.B. User zeigt "Pastor" als role_title)

#### Database Tests

```sql
-- Test 1: Super-Admin existiert
SELECT u.id, u.username, u.display_name, u.role_title, r.name as role_name
FROM users u
JOIN roles r ON u.role_id = r.id
WHERE r.name = 'super_admin';
-- Erwartung: 1 Row mit organization_id = NULL, role_title = 'System Administrator'

-- Test 2: Alle Orgs haben 4 System-Rollen
SELECT organization_id, COUNT(*) as role_count
FROM roles
WHERE is_system_role = true
GROUP BY organization_id;
-- Erwartung: Jede Org hat 4 Rollen

-- Test 3: role_title ist gesetzt für User
SELECT u.id, u.username, u.display_name, u.role_title, r.name as role_name
FROM users u
JOIN roles r ON u.role_id = r.id
WHERE u.organization_id = 1 AND r.name IN ('admin', 'teamer', 'org_admin')
LIMIT 10;
-- Erwartung: Admin-User haben role_title (z.B. "Pastor", "Admin", etc.)

-- Test 4: users Tabelle hat role_title Spalte
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'users' AND column_name = 'role_title';
-- Erwartung: 1 Row mit data_type = 'text'

-- Test 5: role_permissions wird nicht mehr verwendet (optional)
SELECT COUNT(*) FROM role_permissions;
-- Erwartung: 0 (falls truncated) oder ignoriert
```

---

### 8. Deployment-Plan

#### Phase 1: Backend Migration (2 Stunden)
1. `config/rolePermissions.js` erstellen
2. `middleware/rbac.js` anpassen
3. `routes/roles.js` einschränken
4. `routes/organizations.js` erweitern
5. `utils/roleHierarchy.js` anpassen
6. SQL Migration ausführen (super_admin erstellen)

#### Phase 2: Frontend Anpassungen (3 Stunden)
1. Rollen-Tab entfernen
2. User-Verwaltung: `role_title` Spalte + Edit-Funktion hinzufügen
3. Organisations-View erstellen (super_admin)
4. API Integration: `PUT /users/:id/role-title`
5. Testing

#### Phase 3: Production Deployment (1 Stunde)
1. Lokale Tests abschließen
2. Git Commit + Push
3. SSH zu Server
4. Docker Rebuild
5. SQL Migration auf Production ausführen
6. Super-Admin Passwort setzen
7. Live-Tests durchführen

**Geschätzte Gesamtdauer:** 6 Stunden

---

### 9. Wichtige Hinweise

#### Display Name vs. Role Title vs. Name

**users.display_name (Echter Name):**
- Echter Name des Users (z.B. "Simon Luthe", "Maria Schmidt")
- NICHT editierbar (oder nur vom User selbst)
- Wird in der App angezeigt

**users.role_title (Funktionsbezeichnung):**
- Funktionsbezeichnung des Users (z.B. "Pastor", "Pastorin", "Diakon")
- Editierbar durch org_admin
- Kann beliebig sein und ist pro USER unterschiedlich!
- Wird in der User-Verwaltung angezeigt

**roles.name (technisch):**
- Wird in Code verwendet (`if (role_name === 'admin')`)
- NICHT editierbar
- Muss eindeutig sein pro Organisation
- System-Rollen: `super_admin`, `org_admin`, `admin`, `teamer`, `konfi`

#### Rollentitel sind PRO USER!

**RICHTIG (jetzt):**
- User A (admin) hat role_title "Pastor"
- User B (admin) hat role_title "Diakon"
- User C (admin) hat role_title "Pastorin"

**Beispiel:**
```
users Tabelle:
┌────┬──────────────┬──────────────────┬─────────┐
│ id │ display_name │ role_title       │ role_id │
├────┼──────────────┼──────────────────┼─────────┤
│ 1  │ Simon Luthe  │ Pastor           │ 2       │
│ 2  │ Maria Schmidt│ Pastorin         │ 2       │
│ 3  │ Peter Meyer  │ Diakon           │ 2       │
└────┴──────────────┴──────────────────┴─────────┘
         ↑                ↑                ↑
    Echter Name    Funktions-         Alle sind
                  bezeichnung         role "admin"
```

#### Super-Admin Organisation Isolation

**Super-Admin:**
- `organization_id = NULL` in `users` Tabelle
- Sieht KEINE Konfis, Events, Aktivitäten
- Kann NUR Organisationen verwalten
- Hat KEINEN Zugriff auf Org-spezifische Daten

**Grund:**
- Alle Backend-Queries filtern mit `WHERE organization_id = $1`
- Ohne org_id kein Zugriff auf Org-Daten

#### Migration ist rückwärts-kompatibel

- Bestehende `role_permissions` Tabelle bleibt erhalten (wird nur ignoriert)
- Bestehende Rollen werden NICHT gelöscht
- Bestehende User funktionieren weiter
- Super-Admin ist NEUE Rolle (keine Änderung an bestehenden)

---

### 10. Offene Fragen / Entscheidungen

- [ ] **Super-Admin Passwort:** Wie soll das initial gesetzt werden?
- [ ] **role_permissions Tabelle:** Komplett entfernen oder behalten (ignoriert)?
- [ ] **Permissions Tabelle:** Auch entfernen oder als Referenz behalten?
- [ ] **Organisation löschen:** Soll Super-Admin Orgs löschen können oder nur deaktivieren?
- [ ] **Rollentitel Validierung:** Max. Länge 50 Zeichen OK? Regex nötig?
- [ ] **Org-Admin als Simon:** Separater Account oder bestehender User bekommt neue Rolle?
- [ ] **Default role_title:** Soll jeder User automatisch einen Default-Titel bekommen basierend auf seiner Rolle?
- [ ] **Konfis bekommen role_title?** Oder nur admin/teamer/org_admin?

---

## Zusammenfassung

### Was ändert sich?

1. **5 feste Rollen** statt flexible Rollen-Erstellung
2. **Hardcoded Permissions** in JavaScript statt Datenbank
3. **Super-Admin** für organisationsübergreifende Verwaltung
4. **Rollentitel PRO USER anpassbar** (z.B. User A "Pastor", User B "Diakon")
5. **Neue Spalte `users.role_title`** für Funktionsbezeichnungen
6. **Teamer Rechte reduziert** (keine Requests mehr!)
7. **Rollen-Tab entfernt** (keine UI für Rechteverwaltung nötig)
8. **Organisations-Verwaltung** für Super-Admin
9. **User-Verwaltung erweitert** um role_title Edit-Funktion

### Was bleibt gleich?

1. **Organizations Isolation** funktioniert weiter
2. **Hierarchie-System** bleibt (super_admin > org_admin > admin > teamer > konfi)
3. **RBAC Middleware** funktioniert weiter (nur Permissions-Quelle ändert sich)
4. **Frontend Permission-Checks** funktionieren weiter

### Vorteile

- **Einfacher:** Keine komplexe Rechteverwaltung mehr
- **Sicherer:** Keine versehentliche Rechtevergabe möglich
- **Flexibler:** Rollentitel können PRO USER angepasst werden
- **Individuell:** Jeder User kann seine eigene Funktionsbezeichnung haben
- **Klarer:** 5 Rollen mit festen Berechtigungen
- **Realistisch:** "Pastor", "Pastorin", "Diakon" statt generisches "Admin"

---

**Ende der Dokumentation**

Bei Fragen oder Unklarheiten: simon@godsapp.de
