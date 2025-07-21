# Konfi Quest - Vollständige API Dokumentation

## Datenbankschema

### Konfis Tabelle
```sql
CREATE TABLE konfis (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  jahrgang_id INTEGER,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  password_plain TEXT NOT NULL,
  gottesdienst_points INTEGER DEFAULT 0,    -- Direkt gespeicherte Punkte (inkl. Bonus)
  gemeinde_points INTEGER DEFAULT 0,        -- Direkt gespeicherte Punkte (inkl. Bonus)
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (jahrgang_id) REFERENCES jahrgaenge (id)
);
```

### Bonus Points Tabelle
```sql
CREATE TABLE bonus_points (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  konfi_id INTEGER,
  points INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('gottesdienst', 'gemeinde')),
  description TEXT NOT NULL,
  admin_id INTEGER,
  completed_date DATE DEFAULT CURRENT_DATE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (konfi_id) REFERENCES konfis (id),
  FOREIGN KEY (admin_id) REFERENCES admins (id)
);
```

### Punkte-Berechnung
- **Aktivitäts-Punkte**: Werden direkt zu gottesdienst_points/gemeinde_points addiert
- **Bonus-Punkte**: Werden AUCH direkt zu gottesdienst_points/gemeinde_points addiert
- **Automatische Updates**: Bei jeder Aktivitäts-/Bonus-Zuweisung werden die Punkt-Spalten aktualisiert

## API Endpunkte

### Authentication

#### `/api/auth/login` (POST) - Unified Auto-Detection Login
Versucht zuerst Admin-Login, dann Konfi-Login
```json
{
  "username": "string",
  "password": "string"
}
```

#### `/api/auth/admin/login` (POST) - Admin Login
#### `/api/auth/konfi/login` (POST) - Konfi Login

### Konfi-Daten

#### `/api/konfis/:id` (GET) - Konfi Detail-Daten
**Response:**
```json
{
  "id": 35,
  "name": "aaa aaa",
  "username": "aaa.aaa",
  "jahrgang_id": 1,
  "jahrgang_name": "2025/26",
  "gottesdienst_points": null,  // Sollte tatsächliche Punkte sein
  "gemeinde_points": null,      // Sollte tatsächliche Punkte sein
  "total_points": null,         // Berechnet oder direkt
  "activities": [
    {
      "id": 123,
      "name": "Hochzeit",
      "points": 1,
      "type": "gottesdienst",
      "date": "2024-12-15",
      "admin": "Pastor Simon"
    }
  ],
  "bonus_points": [
    {
      "id": 45,
      "description": "Extra Engagement",
      "points": 2,
      "type": "gemeinde",
      "date": "2024-12-20",
      "admin": "Pastor Simon"
    }
  ]
}
```

#### `/api/konfis/:id/badges` (GET) - Badge-Daten
**Response:**
```json
{
  "earned": [...],
  "available": [...],
  "progress": "14/49"
}
```

### Badge-System

#### Badge-Kriterien-Typen:
- `total_points`: Gesamtpunkte >= criteria_value
- `gottesdienst_points`: Gottesdienst-Punkte >= criteria_value  
- `gemeinde_points`: Gemeinde-Punkte >= criteria_value
- `both_categories`: Beide Kategorien >= criteria_value

### Events

#### `/api/events` (GET) - Alle Events
#### `/api/events/:id/book` (POST) - Event buchen

### Punkte-Management (Admin)

#### `/api/konfis/:id/activities` (POST) - Aktivität zuweisen
```json
{
  "activity_id": 123,
  "completed_date": "2024-12-15"
}
```
**Automatik:** Aktualisiert gottesdienst_points/gemeinde_points basierend auf activity.type

#### `/api/konfis/:id/bonus-points` (POST) - Bonuspunkte vergeben
```json
{
  "points": 2,
  "type": "gemeinde",
  "description": "Extra Engagement"
}
```
**Automatik:** Addiert Punkte direkt zu entsprechender Kategorie

#### `/api/konfis/:id/activities/:recordId` (DELETE) - Aktivität entfernen
**Automatik:** Subtrahiert Punkte von entsprechender Kategorie

## Wichtige Erkenntnisse

1. **Punkte sind nicht berechnet** - sie werden direkt in der Datenbank gespeichert
2. **Bonuspunkte werden zu Kategorien addiert** - nicht separat geführt
3. **NULL-Werte** bedeuten, dass Updates nicht funktioniert haben
4. **Activities Array** enthält die originalen Zuweisungen
5. **Bonus Points Array** enthält separate Bonus-Einträge

## Debug-Info für aaa.aaa (ID 35)
- **Activities**: 4 Einträge (1 gottesdienst, 3 gemeinde)
- **Erwartete Base-Punkte**: 1 gottesdienst + 3 gemeinde = 4 total
- **Bonuspunkte**: 2 Punkte (sollten zu gemeinde addiert werden)
- **Erwartete Gesamt**: 1 gottesdienst + 5 gemeinde = 6 total
- **Tatsächliche API**: gottesdienst_points: null, gemeinde_points: null

**Problem**: Die automatischen Updates der Punkt-Spalten funktionieren nicht korrekt.