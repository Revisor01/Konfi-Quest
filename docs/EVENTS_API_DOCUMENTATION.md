# 📋 Events System - API Dokumentation & Analyse

## 🗃️ **Datenbankstruktur (PostgreSQL)**

### Kern-Tabellen:
```sql
-- Haupt-Events Tabelle
events: id, name, description, event_date, event_end_time, location, location_maps_url, 
        points, point_type, type, max_participants, registration_opens_at, 
        registration_closes_at, has_timeslots, waitlist_enabled, max_waitlist_size,
        is_series, series_id, created_by, organization_id

-- Event-Buchungen (Konfi-Anmeldungen)
event_bookings: id, event_id, user_id, timeslot_id, status, booking_date, 
                attendance_status, organization_id

-- Zeitslots (optionale Unterteilung)
event_timeslots: id, event_id, start_time, end_time, max_participants, organization_id

-- Punkte-Vergabe bei Teilnahme
event_points: id, konfi_id, event_id, points, point_type, description, 
              awarded_date, admin_id, organization_id

-- Kategorie-Zuordnungen
event_categories: event_id, category_id

-- Jahrgang-Zuordnungen  
event_jahrgang_assignments: event_id, jahrgang_id
```

## 🔌 **API Endpunkte**

### **📖 GET Endpoints**

#### `GET /api/events`
- **Berechtigung**: Alle authentifizierten User
- **Beschreibung**: Alle Events der Organisation mit Statistiken
- **Response**:
```json
[{
  "id": 1,
  "name": "Gottesdienst Palmsonntag",
  "description": "...",
  "event_date": "2025-04-13T10:00:00",
  "event_end_time": "2025-04-13T11:30:00",
  "location": "St. Clemens Kirche",
  "points": 2,
  "point_type": "gottesdienst",
  "max_participants": 50,
  "registered_count": 23,
  "pending_count": 2,
  "registration_status": "open",
  "categories": [{"id": 1, "name": "Gottesdienst"}],
  "jahrgaenge": [{"id": 1, "name": "2024/2025"}],
  "has_timeslots": false,
  "waitlist_enabled": true,
  "is_series": false
}]
```

#### `GET /api/events/:id`
- **Berechtigung**: Alle authentifizierten User
- **Beschreibung**: Event-Details mit Teilnehmern und Timeslots
- **Response**:
```json
{
  "id": 1,
  "name": "Event Name",
  "participants": [{
    "id": 123,
    "participant_name": "Max Mustermann", 
    "jahrgang_name": "2024/2025",
    "status": "confirmed",
    "attendance_status": "present",
    "timeslot_start_time": "10:00:00",
    "timeslot_end_time": "11:00:00"
  }],
  "timeslots": [{
    "id": 1,
    "start_time": "10:00:00",
    "end_time": "11:00:00", 
    "max_participants": 20,
    "registered_count": 15
  }],
  "series_events": [],
  "categories": [],
  "jahrgaenge": [],
  "available_spots": 27
}
```

#### `GET /api/events/user/bookings`
- **Berechtigung**: Nur Konfis
- **Beschreibung**: Eigene Event-Buchungen des Konfis

### **✏️ POST/PUT/DELETE Endpoints**

#### `POST /api/events`
- **Berechtigung**: `events.create`
- **Beschreibung**: Neues Event erstellen
- **Body**:
```json
{
  "name": "Event Name",
  "description": "...",
  "event_date": "2025-04-13T10:00:00",
  "event_end_time": "2025-04-13T11:30:00",
  "location": "Kirche",
  "location_maps_url": "https://maps.google.com/...",
  "points": 2,
  "point_type": "gottesdienst",
  "category_ids": [1, 2],
  "jahrgang_ids": [1],
  "max_participants": 50,
  "registration_opens_at": "2025-03-01T00:00:00",
  "registration_closes_at": "2025-04-12T23:59:59",
  "has_timeslots": true,
  "timeslots": [{
    "start_time": "10:00:00",
    "end_time": "11:00:00",
    "max_participants": 25
  }],
  "waitlist_enabled": true,
  "max_waitlist_size": 10
}
```

#### `PUT /api/events/:id`
- **Berechtigung**: `events.edit`
- **Beschreibung**: Event bearbeiten
- **Body**: Wie POST (ohne timeslots)

#### `DELETE /api/events/:id`
- **Berechtigung**: `events.delete`
- **Beschreibung**: Event löschen (mit allen Buchungen, Timeslots, Chat-Rooms)
- **Validierung**: 
  - ✅ Prüft bestätigte + Wartelisten-Buchungen
  - ✅ Prüft Chat-Nachrichten
  - ✅ Deutsche Fehlermeldungen
  - ✅ Vollständige Kaskadierung

### **📅 Booking Endpoints (Konfi-seitig)**

#### `POST /api/events/:id/book`
- **Berechtigung**: Nur Konfis
- **Beschreibung**: Event buchen
- **Body**: `{"timeslot_id": 1}` (optional)
- **Logic**: 
  - ✅ Registrierungszeiten prüfen
  - ✅ Kapazität prüfen
  - ✅ Warteliste-Management
  - ✅ Duplicate-Prüfung

#### `DELETE /api/events/:id/book`
- **Berechtigung**: Nur Konfis
- **Beschreibung**: Eigene Buchung stornieren
- **Logic**: ✅ Auto-Promotion von Warteliste

### **👥 Admin Booking Management**

#### `POST /api/events/:id/participants`
- **Berechtigung**: `events.manage_bookings`
- **Beschreibung**: Teilnehmer hinzufügen
- **Body**:
```json
{
  "user_id": 123,
  "status": "auto",
  "timeslot_id": 1
}
```

#### `DELETE /api/events/:id/bookings/:bookingId`
- **Berechtigung**: `events.manage_bookings`
- **Beschreibung**: Teilnehmer entfernen

#### `PUT /api/events/:id/participants/:participantId/status`
- **Berechtigung**: `events.manage_bookings`
- **Beschreibung**: Status ändern (confirmed ↔ pending)

#### `PUT /api/events/:id/participants/:participantId/attendance`
- **Berechtigung**: `events.manage_bookings`
- **Beschreibung**: Anwesenheit markieren + Punkte vergeben
- **Body**: `{"attendance_status": "present"}`
- **Logic**: 
  - ✅ Automatische Punkte-Vergabe bei "present"
  - ✅ Punkte-Entzug bei "absent"
  - ✅ Duplicate-Prevention via UNIQUE constraint

### **📋 Series Events**

#### `POST /api/events/series`
- **Berechtigung**: `events.create`
- **Beschreibung**: Event-Serie erstellen
- **Body**:
```json
{
  "name": "Konfirmanden-Unterricht",
  "series_count": 10,
  "series_interval": "week",
  "event_date": "2025-03-01T10:00:00"
}
```

### **💬 Chat Integration**

#### `POST /api/events/:id/chat`
- **Berechtigung**: `events.edit`
- **Beschreibung**: Gruppen-Chat für Event erstellen
- **Logic**: ✅ Alle bestätigten Teilnehmer werden automatisch hinzugefügt

## ⚠️ **Identifizierte Probleme & Verbesserungsvorschläge**

### 🐛 **PostgreSQL Migration Issues**

1. **❌ BOOLEAN vs BIGINT Problem**:
```sql
-- ❌ PROBLEMATISCH: has_timeslots, is_series, waitlist_enabled sind BIGINT
has_timeslots: bigint DEFAULT '0'::bigint

-- ✅ SOLLTE SEIN: 
has_timeslots: boolean DEFAULT false
```

2. **❌ Date/Time Inconsistenz**:
```sql
-- ❌ MIXED: event_date als TEXT, created_at als TIMESTAMP
event_date: text
created_at: timestamp with time zone

-- ⚠️ PROBLEM: event_date sollte TIMESTAMP WITH TIME ZONE sein
```

3. **❌ Invalid Default Values**:
```sql
-- ❌ PROBLEMATISCH: 
point_type: text DEFAULT '"gemeinde"'::text  -- Extra quotes!

-- ✅ SOLLTE SEIN:
point_type: text DEFAULT 'gemeinde'::text
```

### 🚨 **Fehlende Features**

4. **❌ Keine Event-Duplikate Prüfung**: 
   - Events können mehrfach mit identischen Daten erstellt werden

5. **❌ Keine Event-Templates**:
   - Wiederkehrende Events müssen immer neu erstellt werden

6. **❌ Keine Event-Kategorien CRUD**:
   - Categories werden in separatem System verwaltet

7. **❌ Keine Reminder/Notifications**:
   - Keine automatischen Erinnerungen vor Events

8. **❌ Attendance Bulk-Operations fehlen**:
   - Anwesenheit kann nur einzeln markiert werden

### 🔧 **API Verbesserungen**

9. **❌ Fehlende Validierung**:
   - `registration_opens_at` > `registration_closes_at` wird nicht geprüft
   - `event_date` in der Vergangenheit wird erlaubt

10. **❌ Timeslot Management**:
    - Keine separaten CRUD-Endpoints für Timeslots
    - Timeslots können nach Event-Erstellung nicht bearbeitet werden

11. **❌ Export-Funktionen fehlen**:
    - Keine CSV/Excel-Export für Teilnehmerlisten
    - Keine Anwesenheitslisten-Export

## ✅ **Bereits gut implementiert**

- ✅ **Vollständige RBAC-Integration**
- ✅ **Wartelisten-Management** 
- ✅ **Timeslot-Support**
- ✅ **Series Events**
- ✅ **Auto-Punkte-Vergabe**
- ✅ **Chat-Integration**
- ✅ **Kaskadierendes Delete**
- ✅ **Organization-Isolation**

## 🎯 **Empfohlene nächste Schritte**

1. **🔧 PostgreSQL Schema Fixes** (Kritisch):
   - BOOLEAN-Felder korrigieren 
   - Date/Time-Felder auf TIMESTAMP umstellen
   - Default Values bereinigen

2. **📋 Fehlende CRUD-Endpoints** (Hoch):
   - Timeslot Management-Endpoints
   - Bulk-Attendance Operations
   - Export-Funktionen

3. **🛡️ Validierung verbessern** (Mittel):
   - Date-Range Validierung
   - Duplicate-Prevention
   - Business Logic Checks

---

**Status**: Events System ist sehr umfangreich und funktional, hat aber kritische PostgreSQL Schema-Probleme die vor dem Produktiveinsatz behoben werden müssen!