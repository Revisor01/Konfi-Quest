# Konfi Management API Dokumentation

## Übersicht
Die `konfi-managment.js` Route verwaltet alle CRUD-Operationen für Konfis (Konfirmanden) im System. Diese API unterstützt das neue RBAC-System mit organization_id-basierter Isolation.

---

## Authentifizierung & Berechtigung
- Alle Routen erfordern `rbacVerifier` Middleware
- Spezifische Permissions werden für jede Operation geprüft
- Organization-basierte Isolation wird durchgesetzt

---

## API Endpoints

### 1. GET `/api/admin/konfis`
**Zweck:** Liste aller Konfis für die Admin-Organisation abrufen

**Berechtigung:** `admin.konfis.view`

**Parameter:** 
- Automatische Jahrgang-Filterung basierend auf Admin-Permissions

**Response:**
```json
[
  {
    "id": 123,
    "name": "Max Mustermann",
    "username": "max.mustermann",
    "password_plain": "Abraham123",
    "gottesdienst_points": 15,
    "gemeinde_points": 8,
    "jahrgang_name": "2024/25",
    "jahrgang_id": 5,
    "badgeCount": 3
  }
]
```

**SQL Query:**
```sql
SELECT u.id, u.display_name as name, u.username, kp.password_plain, 
       kp.gottesdienst_points, kp.gemeinde_points,
       j.name as jahrgang_name, j.id as jahrgang_id,
       (SELECT COUNT(*) FROM konfi_badges WHERE konfi_id = u.id) as "badgeCount"
FROM users u
JOIN roles r ON u.role_id = r.id
LEFT JOIN konfi_profiles kp ON u.id = kp.user_id
LEFT JOIN jahrgaenge j ON kp.jahrgang_id = j.id
WHERE r.name = 'konfi' AND u.organization_id = $1 [+ jahrgang filter]
ORDER BY j.name DESC, u.display_name
```

---

### 2. GET `/api/admin/konfis/:id`
**Zweck:** Einzelnen Konfi mit vollständigen Details laden

**Berechtigung:** `admin.konfis.view`

**Parameter:**
- `:id` - Konfi User ID

**Response:**
```json
{
  "id": 123,
  "name": "Max Mustermann",
  "username": "max.mustermann",
  "password": "Abraham123",
  "gottesdienst_points": 15,
  "gemeinde_points": 8,
  "jahrgang_name": "2024/25",
  "jahrgang_id": 5,
  "badgeCount": 3,
  "activities": [
    {
      "id": 45,
      "name": "Gottesdienst besuchen",
      "points": 2,
      "type": "gottesdienst",
      "completed_date": "2024-01-15",
      "admin_name": "Admin User"
    }
  ],
  "bonusPoints": [
    {
      "id": 67,
      "points": 5,
      "type": "gemeinde",
      "description": "Besondere Hilfe",
      "created_at": "2024-01-20",
      "admin_name": "Admin User"
    }
  ]
}
```

**Geladene Daten:**
1. Konfi Grunddaten
2. Alle zugewiesenen Aktivitäten
3. Alle Bonuspunkte
4. Badge-Anzahl

---

### 3. POST `/api/admin/konfis`
**Zweck:** Neuen Konfi erstellen

**Berechtigung:** `admin.konfis.create`

**Request Body:**
```json
{
  "name": "Max Mustermann",
  "jahrgang_id": 5
}
```

**Response:**
```json
{
  "id": 123,
  "username": "max.mustermann",
  "password": "Abraham123",
  "message": "Konfi created successfully"
}
```

**Automatische Aktionen:**
1. Username generieren: `name.toLowerCase().replace(/\s+/g, '.').replace(/[^a-z.äöüß]/g, '')`
2. Biblisches Passwort generieren
3. Passwort hashen (bcrypt)
4. User in `users` Tabelle erstellen
5. Profil in `konfi_profiles` erstellen mit Punkten = 0

**Transaktion:** Ja (BEGIN/COMMIT/ROLLBACK)

---

### 4. PUT `/api/admin/konfis/:id`
**Zweck:** Konfi-Daten bearbeiten

**Berechtigung:** `admin.konfis.edit`

**Parameter:**
- `:id` - Konfi User ID

**Request Body:**
```json
{
  "name": "Max Mustermann",
  "jahrgang_id": 5
}
```

**Response:**
```json
{
  "message": "Konfi updated successfully"
}
```

**Geänderte Daten:**
1. `users.display_name` und `users.username`
2. `konfi_profiles.jahrgang_id`

**Transaktion:** Ja

---

### 5. DELETE `/api/admin/konfis/:id`
**Zweck:** Konfi und alle Referenzen löschen

**Berechtigung:** `admin.konfis.delete`

**Parameter:**
- `:id` - Konfi User ID

**Response:**
```json
{
  "message": "Konfi deleted successfully"
}
```

**⚠️ KRITISCHE LÖSCHVORGÄNGE (in dieser Reihenfolge):**
1. `konfi_activities` - Alle zugewiesenen Aktivitäten
2. `bonus_points` - Alle Bonuspunkte
3. `konfi_badges` - Alle erworbenen Badges
4. `activity_requests` - Alle Aktivitäts-Anträge
5. `chat_participants` - Chat-Teilnahmen
6. `konfi_profiles` - Konfi-Profil
7. `users` - User-Account

**Transaktion:** Ja (kritisch für Datenintegrität)

---

### 6. POST `/api/admin/konfis/:id/regenerate-password`
**Zweck:** Neues Passwort für Konfi generieren

**Berechtigung:** `admin.konfis.reset_password`

**Parameter:**
- `:id` - Konfi User ID

**Response:**
```json
{
  "message": "Password regenerated successfully",
  "password": "Moses456"
}
```

**Aktionen:**
1. Neues biblisches Passwort generieren
2. Passwort hashen und in `users.password_hash` speichern
3. Klartext in `konfi_profiles.password_plain` speichern

**Transaktion:** Ja

---

### 7. POST `/api/admin/konfis/:id/bonus-points`
**Zweck:** Bonuspunkte für Konfi vergeben

**Berechtigung:** `admin.konfis.edit`

**Parameter:**
- `:id` - Konfi User ID

**Request Body:**
```json
{
  "points": 5,
  "type": "gottesdienst",
  "description": "Besondere Hilfe beim Gottesdienst"
}
```

**Response:**
```json
{
  "message": "Bonus points added successfully"
}
```

**Aktionen:**
1. Eintrag in `bonus_points` erstellen
2. Punkte zu `konfi_profiles.gottesdienst_points` oder `gemeinde_points` addieren

---

### 8. DELETE `/api/admin/konfis/:id/bonus-points/:bonusId`
**Zweck:** Bonuspunkte löschen und von Gesamtpunkten abziehen

**Berechtigung:** `admin.konfis.edit`

**Parameter:**
- `:id` - Konfi User ID
- `:bonusId` - Bonus Points ID

**Response:**
```json
{
  "message": "Bonus points deleted successfully"
}
```

**Aktionen:**
1. Bonuspunkt-Daten laden
2. Eintrag aus `bonus_points` löschen
3. Punkte von `konfi_profiles` Gesamtpunkten abziehen

---

### 9. POST `/api/admin/konfis/:id/activities`
**Zweck:** Aktivität für Konfi zuweisen

**Berechtigung:** `admin.konfis.edit`

**Parameter:**
- `:id` - Konfi User ID

**Request Body:**
```json
{
  "activity_id": 10,
  "completed_date": "2024-01-15",
  "comment": "Optional comment"
}
```

**Response:**
```json
{
  "message": "Activity added successfully"
}
```

**Aktionen:**
1. Aktivität aus `activities` laden
2. Eintrag in `konfi_activities` erstellen
3. Punkte basierend auf `activity.type` zu entsprechendem Feld addieren

---

### 10. DELETE `/api/admin/konfis/:id/activities/:activityId`
**Zweck:** Zugewiesene Aktivität löschen

**Berechtigung:** `admin.konfis.edit`

**Parameter:**
- `:id` - Konfi User ID
- `:activityId` - Konfi Activity Record ID

**Response:**
```json
{
  "message": "Activity deleted successfully"
}
```

**Aktionen:**
1. Aktivitäts-Daten laden (für Punkte-Korrektur)
2. Eintrag aus `konfi_activities` löschen
3. Punkte von `konfi_profiles` abziehen

---

### 11. GET `/api/admin/konfis/:id/event-points`
**Zweck:** Event-Punkte für Konfi abrufen

**Berechtigung:** `admin.konfis.view`

**Parameter:**
- `:id` - Konfi User ID

**Response:**
```json
[
  {
    "id": 89,
    "points": 3,
    "point_type": "gottesdienst",
    "description": "Teilnahme an Event XYZ",
    "event_name": "Jugendgottesdienst",
    "event_date": "2024-01-20",
    "awarded_date": "2024-01-20",
    "admin_name": "Admin User"
  }
]
```

---

## Sicherheitsaspekte

### Organization Isolation
- Alle Queries enthalten `organization_id` Filter
- Verhindert Cross-Organization Data Access

### Transaktionale Sicherheit
- Kritische Operations (CREATE, UPDATE, DELETE) verwenden Transaktionen
- ROLLBACK bei Fehlern garantiert Datenintegrität

### Jahrgang-basierte Zugriffskontrolle
- Nicht-Super-Admins sehen nur zugewiesene Jahrgänge
- `assigned_jahrgaenge` mit `can_view` Permissions

---

## Fehlerbehandlung

### Häufige Fehler:
- `404` - Konfi not found
- `409` - Username already exists (bei Creation)
- `400` - Missing required fields
- `500` - Database errors

### Logging:
- Alle Database Errors werden in Console geloggt
- Request-spezifische Logs für Debugging

---

## Performance Considerations

### Optimierte Queries:
- Badge Counts als Subquery in der Hauptabfrage
- LEFT JOINs für optionale Daten
- INDEX auf foreign keys sollte vorhanden sein

### Batch Operations:
- Einzelne Konfi-Details laden alle zugehörigen Daten in separaten Queries
- Könnte für große Datensätze optimiert werden