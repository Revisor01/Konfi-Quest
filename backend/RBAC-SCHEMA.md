# RBAC (Role-Based Access Control) Schema Design

## Organisationen & Multi-Tenancy

### 1. organizations
```sql
CREATE TABLE organizations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,  -- URL-friendly identifier
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
);
```

## Rollen & Permissions System

### 2. roles
```sql
CREATE TABLE roles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  organization_id INTEGER,
  name TEXT NOT NULL,  -- 'admin', 'teamer', 'helper', etc.
  display_name TEXT NOT NULL,  -- 'Pastor', 'Teamer:in', 'Helfer:in'
  description TEXT,
  is_system_role BOOLEAN DEFAULT 0,  -- System roles can't be deleted
  is_active BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (organization_id) REFERENCES organizations (id),
  UNIQUE(organization_id, name)
);
```

### 3. permissions
```sql
CREATE TABLE permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,  -- 'create_badges', 'approve_requests', etc.
  display_name TEXT NOT NULL,  -- 'Badges erstellen', 'Anträge genehmigen'
  description TEXT,
  module TEXT NOT NULL,  -- 'badges', 'requests', 'konfis', 'activities', etc.
  is_system_permission BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

### 4. role_permissions
```sql
CREATE TABLE role_permissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role_id INTEGER,
  permission_id INTEGER,
  granted BOOLEAN DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (role_id) REFERENCES roles (id) ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES permissions (id) ON DELETE CASCADE,
  UNIQUE(role_id, permission_id)
);
```

## User Management mit Organisationen

### 5. users (erweiterte admins Tabelle)
```sql
CREATE TABLE users (
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
);
```

### 6. user_jahrgang_assignments
```sql
CREATE TABLE user_jahrgang_assignments (
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
);
```

## Standard Permissions

### Badges Module
- `badges.create` - Badges erstellen
- `badges.edit` - Badges bearbeiten
- `badges.delete` - Badges löschen
- `badges.view` - Badges anzeigen
- `badges.award` - Badges manuell verleihen

### Activity Requests Module
- `requests.view` - Anträge anzeigen
- `requests.approve` - Anträge genehmigen
- `requests.reject` - Anträge ablehnen
- `requests.delete` - Anträge löschen

### Konfis Module
- `konfis.create` - Konfis anlegen
- `konfis.edit` - Konfis bearbeiten
- `konfis.delete` - Konfis löschen
- `konfis.view` - Konfis anzeigen
- `konfis.reset_password` - Passwörter zurücksetzen
- `konfis.assign_points` - Punkte manuell vergeben

### Activities Module
- `activities.create` - Aktivitäten erstellen
- `activities.edit` - Aktivitäten bearbeiten
- `activities.delete` - Aktivitäten löschen
- `activities.view` - Aktivitäten anzeigen

### Events Module
- `events.create` - Events erstellen
- `events.edit` - Events bearbeiten
- `events.delete` - Events löschen
- `events.view` - Events anzeigen
- `events.manage_bookings` - Buchungen verwalten

### Admin Module
- `admin.users.create` - Admin-User erstellen
- `admin.users.edit` - Admin-User bearbeiten
- `admin.users.delete` - Admin-User löschen
- `admin.users.view` - Admin-User anzeigen
- `admin.roles.manage` - Rollen verwalten
- `admin.permissions.manage` - Berechtigungen verwalten
- `admin.jahrgaenge.assign` - Jahrgang-Zuweisungen verwalten

### Categories & Jahrgaenge Module
- `categories.create` - Kategorien erstellen
- `categories.edit` - Kategorien bearbeiten
- `categories.delete` - Kategorien löschen
- `jahrgaenge.create` - Jahrgänge erstellen
- `jahrgaenge.edit` - Jahrgänge bearbeiten
- `jahrgaenge.delete` - Jahrgänge löschen

## Standard Rollen

### 1. Admin (Pastor)
**Alle Berechtigungen** - Full Access

### 2. Teamer:in
- Anträge genehmigen/ablehnen
- Konfis anzeigen (nur zugewiesene Jahrgänge)
- Punkte manuell vergeben
- Activities und Events anzeigen
- Badges anzeigen

### 3. Helfer:in
- Anträge anzeigen (nur zugewiesene Jahrgänge)
- Konfis anzeigen (nur zugewiesene Jahrgänge)
- Activities und Events anzeigen

## Migration Strategy

1. **Schritt 1**: Neue Tabellen erstellen
2. **Schritt 2**: Standard-Organisation erstellen
3. **Schritt 3**: Standard-Rollen und Permissions erstellen
4. **Schritt 4**: Bestehende admins zu users migrieren
5. **Schritt 5**: Jahrgaenge erweitern um organization_id
6. **Schritt 6**: Konfis erweitern um organization_id
7. **Schritt 7**: Alle anderen Tabellen um organization_id erweitern

## API Changes

### Authentication
- `/api/auth/login` - Universal login (detects organization by subdomain or parameter)
- `/api/auth/users` - User management
- `/api/auth/roles` - Role management
- `/api/auth/permissions` - Permission management

### Organization Management
- `/api/organizations` - Organization CRUD
- `/api/organizations/:id/users` - Users in organization
- `/api/organizations/:id/stats` - Organization statistics

### User Management
- `/api/users` - User CRUD (scoped to organization)
- `/api/users/:id/jahrgaenge` - Assign jahrgaenge to user
- `/api/users/:id/permissions` - Check user permissions