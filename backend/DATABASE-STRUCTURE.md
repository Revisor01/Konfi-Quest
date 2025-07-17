# KonfipointsNew - Exakte Datenbankstruktur

## Übersicht
Diese Dokumentation beschreibt die exakte Datenbankstruktur des KonfipointsNew Systems basierend auf dem korrigierten server.js.

## Wichtige Sicherheitshinweise
- **Passwörter**: Alle Passwörter werden mit bcrypt gehashed in `password_hash` gespeichert
- **Plaintext-Passwörter**: Nur bei Konfis wird zusätzlich `password_plain` für die Ausgabe gespeichert
- **JWT**: Verwendet sicheren JWT_SECRET für Token-Signierung

## Tabellen-Struktur

### 1. admins
```sql
CREATE TABLE admins (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,  -- bcrypt gehashed
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Beispiel-Daten:**
- username: "admin"
- display_name: "Pastor Administrator"  
- password_hash: bcrypt Hash von "pastor2025"

### 2. jahrgaenge
```sql
CREATE TABLE jahrgaenge (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  confirmation_date DATE,  -- Hinzugefügt durch Migration
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Beispiel-Daten:**
- name: "2024/25", confirmation_date: "2025-05-11"
- name: "2025/26", confirmation_date: "2026-05-10"

### 3. konfis
```sql
CREATE TABLE konfis (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  jahrgang_id INTEGER,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,  -- bcrypt gehashed
  password_plain TEXT NOT NULL, -- Für Ausgabe (nur bei Konfis)
  gottesdienst_points INTEGER DEFAULT 0,
  gemeinde_points INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (jahrgang_id) REFERENCES jahrgaenge (id)
);
```

**Passwort-System:**
- Automatisch generierte biblische Passwörter (z.B. "Johannes3,16")
- Sowohl gehashed als auch plaintext gespeichert

### 4. activities
```sql
CREATE TABLE activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  points INTEGER NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('gottesdienst', 'gemeinde')),
  category TEXT,              -- Hinzugefügt durch Migration
  is_special BOOLEAN DEFAULT 0, -- Hinzugefügt durch Migration
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

**Kategorien:** z.B. "sonntagsgottesdienst", "kindergottesdienst", "gemeindefest"

### 5. konfi_activities
```sql
CREATE TABLE konfi_activities (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  konfi_id INTEGER,
  activity_id INTEGER,
  admin_id INTEGER,
  completed_date DATE DEFAULT CURRENT_DATE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (konfi_id) REFERENCES konfis (id),
  FOREIGN KEY (activity_id) REFERENCES activities (id),
  FOREIGN KEY (admin_id) REFERENCES admins (id)
);
```

### 6. bonus_points
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

### 7. settings
```sql
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

**Standard-Einstellungen:**
- target_gottesdienst: "10"
- target_gemeinde: "10"

### 8. custom_badges
```sql
CREATE TABLE custom_badges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  icon TEXT NOT NULL,
  description TEXT,
  criteria_type TEXT NOT NULL,
  criteria_value INTEGER,
  criteria_extra TEXT,        -- JSON String
  is_active BOOLEAN DEFAULT 1,
  is_hidden BOOLEAN DEFAULT 0, -- Hinzugefügt durch Migration
  created_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES admins (id)
);
```

**Badge-Kriterien-Typen:**
- total_points, gottesdienst_points, gemeinde_points
- both_categories, activity_count, unique_activities
- specific_activity, category_activities, activity_combination
- time_based, streak, bonus_points

### 9. konfi_badges
```sql
CREATE TABLE konfi_badges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  konfi_id INTEGER,
  badge_id INTEGER,
  earned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (konfi_id) REFERENCES konfis (id),
  FOREIGN KEY (badge_id) REFERENCES custom_badges (id)
);
```

### 10. activity_requests
```sql
CREATE TABLE activity_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  konfi_id INTEGER,
  activity_id INTEGER,
  requested_date DATE,
  comment TEXT,
  photo_filename TEXT,
  status TEXT DEFAULT 'pending',
  admin_comment TEXT,
  approved_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (konfi_id) REFERENCES konfis (id),
  FOREIGN KEY (activity_id) REFERENCES activities (id),
  FOREIGN KEY (approved_by) REFERENCES admins (id)
);
```

## Events System

### 11. events
```sql
CREATE TABLE events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  event_date DATETIME NOT NULL,
  location TEXT,
  location_maps_url TEXT,
  points INTEGER DEFAULT 0,
  category TEXT,
  type TEXT DEFAULT 'event',
  max_participants INTEGER NOT NULL,
  registration_opens_at DATETIME,
  registration_closes_at DATETIME,
  has_timeslots BOOLEAN DEFAULT 0,
  is_series BOOLEAN DEFAULT 0,
  series_id TEXT,
  created_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES admins (id)
);
```

### 12. event_timeslots
```sql
CREATE TABLE event_timeslots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  max_participants INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES events (id)
);
```

### 13. event_bookings
```sql
CREATE TABLE event_bookings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_id INTEGER NOT NULL,
  konfi_id INTEGER NOT NULL,
  timeslot_id INTEGER,
  status TEXT DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'cancelled', 'waiting')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (event_id) REFERENCES events (id),
  FOREIGN KEY (konfi_id) REFERENCES konfis (id),
  FOREIGN KEY (timeslot_id) REFERENCES event_timeslots (id),
  UNIQUE (event_id, konfi_id)
);
```

## Chat System

### 14. chat_rooms
```sql
CREATE TABLE chat_rooms (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('jahrgang', 'admin', 'direct', 'group')),
  jahrgang_id INTEGER,
  event_id INTEGER,
  created_by INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (jahrgang_id) REFERENCES jahrgaenge (id),
  FOREIGN KEY (event_id) REFERENCES events (id),
  FOREIGN KEY (created_by) REFERENCES admins (id)
);
```

### 15. chat_messages
```sql
CREATE TABLE chat_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  user_type TEXT NOT NULL CHECK (user_type IN ('admin', 'konfi')),
  message_type TEXT NOT NULL CHECK (message_type IN ('text', 'image', 'file', 'video', 'poll', 'system')),
  content TEXT,
  file_path TEXT,
  file_name TEXT,
  file_size INTEGER,
  reply_to INTEGER,
  edited_at DATETIME,
  deleted_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (room_id) REFERENCES chat_rooms (id),
  FOREIGN KEY (reply_to) REFERENCES chat_messages (id)
);
```

### 16. chat_participants
```sql
CREATE TABLE chat_participants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  user_type TEXT NOT NULL CHECK (user_type IN ('admin', 'konfi')),
  last_read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (room_id) REFERENCES chat_rooms (id)
);
```

### 17. chat_polls
```sql
CREATE TABLE chat_polls (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id INTEGER NOT NULL,
  question TEXT NOT NULL,
  options TEXT NOT NULL, -- JSON array
  multiple_choice BOOLEAN DEFAULT 0,
  expires_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (message_id) REFERENCES chat_messages (id)
);
```

### 18. chat_poll_votes
```sql
CREATE TABLE chat_poll_votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  poll_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  user_type TEXT NOT NULL CHECK (user_type IN ('admin', 'konfi')),
  option_index INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (poll_id) REFERENCES chat_polls (id),
  UNIQUE(poll_id, user_id, user_type, option_index)
);
```

### 19. chat_read_status
```sql
CREATE TABLE chat_read_status (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  user_type TEXT NOT NULL CHECK (user_type IN ('admin', 'konfi')),
  last_read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (room_id) REFERENCES chat_rooms (id),
  UNIQUE(room_id, user_id, user_type)
);
```

## Standard-Daten

### Default Admin
- username: "admin"
- password: "pastor2025" (bcrypt gehashed)
- display_name: "Pastor Administrator"

### Default Jahrgänge
- "2024/25" (Konfirmation: 2025-05-11)
- "2025/26" (Konfirmation: 2026-05-10)
- "2026/27" (Konfirmation: 2027-05-09)

### Default Activities
- Sonntagsgottesdienst (2 Pkt, gottesdienst, kategorie: sonntagsgottesdienst)
- Kindergottesdienst helfen (3 Pkt, gemeinde, kategorie: kindergottesdienst)
- Jugendgottesdienst (3 Pkt, gottesdienst, kategorie: jugendgottesdienst)
- Gemeindefest helfen (4 Pkt, gemeinde, kategorie: gemeindefest)
- Konfistunde (1 Pkt, gottesdienst, kategorie: konfistunde)
- Besuchsdienst (5 Pkt, gemeinde, kategorie: besuchsdienst)
- Friedhofspflege (3 Pkt, gemeinde, kategorie: friedhofspflege)
- Taizé-Gottesdienst (2 Pkt, gottesdienst, kategorie: taize)
- Weihnachtsfeier helfen (4 Pkt, gemeinde, kategorie: weihnachtsfeier)
- Ostergottesdienst (2 Pkt, gottesdienst, kategorie: ostergottesdienst)

### Default Badges
- Starter (🥉): 5 Gesamtpunkte
- Sammler (🥈): 10 Gesamtpunkte
- Zielerreichung (🥇): 20 Gesamtpunkte
- Gottesdienstgänger (📖): 10 Gottesdienst-Punkte
- Gemeindeheld (🤝): 10 Gemeinde-Punkte
- Ausgewogen (⚖️): 10 Punkte in beiden Kategorien
- All-Rounder (🏆): Spezifische Aktivitäts-Kombination
- Profi-Kirchgänger (⭐): Gottesdienst-Kombination
- Wochenend-Warrior (🔥): 3 Aktivitäten in 7 Tagen
- Aktivist (⚡): 5 verschiedene Aktivitäten
- Geheime Leistung (🎭): 25 Punkte in beiden Kategorien (versteckt)

## Migrations-History

1. **Migration 1**: confirmation_date zu jahrgaenge
2. **Migration 2**: is_special zu activities
3. **Migration 3**: 'group' type zu chat_rooms
4. **Migration 4**: is_hidden zu custom_badges
5. **Migration 5**: category zu activities
6. **Migration 6**: chat_read_status Tabelle

## Sicherheitsfeatures

### Passwort-Sicherheit
- Admin-Passwörter: bcrypt Hash (10 Rounds)
- Konfi-Passwörter: bcrypt Hash + Plaintext für Ausgabe
- Biblische Passwort-Generierung für Konfis

### JWT-Token
- Sicherer JWT_SECRET
- 14 Tage Gültigkeit
- Enthält: id, type, display_name, (jahrgang_id für Konfis)

### Datenbank-Constraints
- UNIQUE Constraints für Usernames
- CHECK Constraints für Enum-Werte
- Foreign Key Constraints für Referenzen
- NOT NULL Constraints für Pflichtfelder

## Backup & Recovery

### Datenbank-Pfad
- Entwicklung: `/backend/data/konfi.db`
- Produktion: `/opt/Konfi-Quest/backend/data/konfi.db`

### Backup-Empfehlung
```bash
# SQLite Backup
sqlite3 /opt/Konfi-Quest/backend/data/konfi.db ".backup /backup/konfi_$(date +%Y%m%d_%H%M%S).db"
```

---

**Wichtig:** Diese Struktur ist die aktuelle, funktionierende Version. Änderungen sollten nur über Migrations erfolgen!