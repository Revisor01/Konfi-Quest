# CLAUDE.md - Konfipoints/Konfi Quest System

## ⚠️ KRITISCHE REGELN FÜR CLAUDE CODE

1. **Neue RBAC-Struktur verwenden** - Alte Strukturen sind deprecated
2. **Deutsche Entwicklungssprache verwenden**
3. **Legacy `points.gottesdienst` Struktur ist TOT - verwende `gottesdienst_points`**

---

## Aktuelle Systemarchitektur (Juli 2025)

### Backend: Node.js Express mit RBAC System
- **Database**: PostgreSQL mit neuer RBAC-Struktur (Docker Container)
- **Authentication**: JWT mit `verifyTokenRBAC` middleware
- **Port**: 5000 (Docker: 8623)
- **API Base**: https://konfi-points.de/api

### Frontend: React 19 + Ionic 8 + TypeScript
- **Framework**: React 19 mit Ionic React 8
- **Build**: Vite 5.2 
- **State**: React Context (`AppContext`)
- **Dev Port**: 5173

---

## Neue RBAC Datenbankstruktur (VERWENDEN!)

### Kern-Tabellen:
```sql
-- Alle Benutzer (Admin + Konfis)
users: id, display_name, username, role_id, organization_id

-- Konfi-spezifische Daten
konfi_profiles: user_id, gottesdienst_points, gemeinde_points, jahrgang_id

-- Aktivitäten
konfi_activities: konfi_id, activity_id, completed_date, admin_id

-- Bonus Points
bonus_points: konfi_id, points, type, description, admin_id

-- Badges
konfi_badges: konfi_id, badge_id, awarded_date

-- Events
event_bookings: user_id, event_id, status, booking_date

-- Chat System (BRAUCHT organization_id!)
chat_rooms: id, name, type, jahrgang_id, created_by, organization_id
chat_messages: id, room_id, user_id, user_type, content, created_at
chat_participants: id, room_id, user_id, user_type, joined_at
```

### ❌ DEPRECATED (NICHT VERWENDEN):
- `admins` tabelle → Ersetzt durch `users` mit role='admin'
- `konfis` tabelle → Ersetzt durch `users` + `konfi_profiles`

---

## API Endpoints (Admin) - AKTUELL GÜLTIG

### Konfi Management
- `GET /api/admin/konfis` - Alle Konfis mit badgeCount ✅
- `GET /api/admin/konfis/:id` - Einzelner Konfi mit activities, bonusPoints ✅
- `POST /api/admin/konfis` - Neuer Konfi erstellen ✅
- `PUT /api/admin/konfis/:id` - Konfi bearbeiten ✅
- `DELETE /api/admin/konfis/:id` - Konfi löschen ✅
- `POST /api/admin/konfis/:id/regenerate-password` - Passwort neu generieren ✅

### Activities & Bonus (NEU IMPLEMENTIERT)
- `POST /api/admin/konfis/:id/activities` - Aktivität hinzufügen ✅
- `DELETE /api/admin/konfis/:id/activities/:activityId` - Aktivität löschen ✅
- `POST /api/admin/konfis/:id/bonus-points` - Bonuspunkte hinzufügen ✅
- `DELETE /api/admin/konfis/:id/bonus-points/:bonusId` - Bonuspunkte löschen ✅

### Activity Requests
- `GET /api/admin/activities/requests` - Alle Anträge ✅

### Other Resources
- `GET /api/admin/activities` - Alle Aktivitäten ✅
- `GET /api/admin/jahrgaenge` - Alle Jahrgänge ✅
- `GET /api/settings` - System Settings ✅

---

## Frontend Datenstrukturen (AKTUELL)

### Konfi Interface - SO VERWENDEN:
```typescript
interface Konfi {
  id: number;
  name: string;
  username?: string;
  jahrgang_name?: string;        // ✅ Backend liefert jahrgang_name
  gottesdienst_points?: number;  // ✅ Backend neue Struktur
  gemeinde_points?: number;      // ✅ Backend neue Struktur  
  badgeCount?: number;           // ✅ Jetzt verfügbar
  password?: string;             // ✅ Für Admin Views
}
```

### ✅ RICHTIGE Implementierung:
```typescript
const getTotalPoints = (konfi: Konfi) => {
  const gottesdienst = konfi.gottesdienst_points ?? 0;
  const gemeinde = konfi.gemeinde_points ?? 0;
  return gottesdienst + gemeinde;
};

// Anzeige
{konfi.jahrgang_name} • {konfi.badgeCount || 0} Badges
G: {konfi.gottesdienst_points ?? 0}/{settings.target_gottesdienst}
Gem: {konfi.gemeinde_points ?? 0}/{settings.target_gemeinde}
```

### ❌ FALSCH (Legacy - NICHT verwenden):
```typescript
// ❌ NIEMALS SO:
konfi.points?.gottesdienst  // TOT
konfi.points?.gemeinde     // TOT
konfi.jahrgang            // Backend liefert jahrgang_name
```

---

## Modals korrekt verwenden

### ✅ IMMER so (useIonModal Hook):
```typescript
const [presentModal, dismissModal] = useIonModal(MyModal, {
  onClose: () => dismissModal(),
  onSuccess: () => { 
    dismissModal(); 
    loadData(); // Daten neu laden
  }
});

// Öffnen
presentModal({ presentingElement: presentingElement });
```

### ❌ NIEMALS `<IonModal isOpen={state}>` verwenden!

---

## Entwicklungskommandos

### Backend starten:
```bash
cd backend && npm start
```

### Frontend development:
```bash
cd frontend && npm run dev
```

### Deployment:
```bash
ssh root@server.godsapp.de
cd /opt/Konfi-Quest/
git pull && docker-compose down && docker-compose up -d --build
```

### Database direkt bearbeiten:
```bash
ssh root@server.godsapp.de "cd /opt/Konfi-Quest && sqlite3 data/konfi.db 'ALTER TABLE event_bookings...'
```

---

## Häufige Probleme & Lösungen

### 1. 403 Forbidden Errors
- RBAC middleware prüfen in `middleware/rbac.js`
- JWT Token und Organization ID prüfen
- Permissions in Database validieren

### 2. "Daten werden nicht angezeigt"
**GRUND**: Legacy Datenstruktur verwendet!
**LÖSUNG**: 
- ✅ `konfi.gottesdienst_points` verwenden
- ✅ `konfi.gemeinde_points` verwenden  
- ✅ `konfi.jahrgang_name` verwenden
- ✅ `konfi.badgeCount` ist verfügbar

### 3. Modal 404 Errors
**GRUND**: Falsche API Routes
**LÖSUNG**:
- ✅ `/api/admin/konfis/:id/activities` 
- ✅ `/api/admin/konfis/:id/bonus-points`

### 4. Database Errors
- `konfi_event_registrations` → `event_bookings` verwenden
- `a.title` → `a.name` verwenden

### 5. useEffect Loop in ModalContext
**PROBLEM**: "Maximum update depth exceeded" in ModalContext
**GRUND**: `registerPage` Funktion wird bei jedem Render neu erstellt
**LÖSUNG**: `useCallback` verwenden für `registerPage`

```tsx
// ❌ FALSCH - verursacht Loop
const registerPage = (tabId: string, element: HTMLElement | null) => {
  // ...
};

// ✅ RICHTIG - verhindert Loop
const registerPage = useCallback((tabId: string, element: HTMLElement | null) => {
  // ...
}, []);
```

**WICHTIG**: Diese Lösung ist kritisch für Tab-Navigation und Modal-Funktionalität!

---

## Database Schema Mapping

### User/Konfi Queries:
```sql
-- Alle Konfis laden
SELECT u.id, u.display_name as name, u.username, 
       kp.gottesdienst_points, kp.gemeinde_points,
       j.name as jahrgang_name,
       (SELECT COUNT(*) FROM konfi_badges WHERE konfi_id = u.id) as badgeCount
FROM users u
JOIN roles r ON u.role_id = r.id
LEFT JOIN konfi_profiles kp ON u.id = kp.user_id
LEFT JOIN jahrgaenge j ON kp.jahrgang_id = j.id
WHERE r.name = 'konfi' AND u.organization_id = ?
```

---

## Typische API Aufrufe

```typescript
// ✅ Konfis laden (mit badges)
const konfis = await api.get('/admin/konfis');

// ✅ Einzelnen Konfi laden (komplett mit activities, bonusPoints)
const konfi = await api.get(`/admin/konfis/${id}`);

// ✅ Aktivität hinzufügen
await api.post(`/admin/konfis/${konfiId}/activities`, {
  activity_id: activityId,
  completed_date: date,
  comment: comment
});

// ✅ Bonuspunkte hinzufügen
await api.post(`/admin/konfis/${konfiId}/bonus-points`, {
  points: points,
  type: 'gottesdienst', // oder 'gemeinde'
  description: description
});
```

---

## PostgreSQL Migration Status (Juli 2025)

### ✅ BEREITS MIGRIERT UND GETESTET:
- **Chat System**: Vollständig auf PostgreSQL portiert
  - Problem: Poll-Voting 404 Fehler (Frontend sendete message_id statt poll_id)
  - Lösung: Fallback-Logic in Backend implementiert
  - Problem: 4 fehlende Routes aus SQLite Version (polls, files, etc.)
  - Lösung: Alle Routes aus backup_sqlite/routes/chat.js übernommen
  - Status: ✅ Funktioniert vollständig

- **Konfi Management**: Vollständig auf PostgreSQL portiert  
  - RBAC System migriert von `admins`/`konfis` Tabellen zu `users`+`konfi_profiles`
  - Badge Counts funktionieren korrekt
  - Activity/Bonus CRUD Operations funktionieren
  - Status: ✅ Funktioniert vollständig

- **Aktivitäten System**: ✅ VOLLSTÄNDIG MIGRIERT
  - Deutsche Fehlermeldungen bei Delete-Konflikten implementiert
  - Auto-Slide Funktionalität bei Fehlern hinzugefügt  
  - Usage-Validation für Kategorien und Aktivitäten funktioniert
  - Status: ✅ Funktioniert vollständig

- **Kategorien System**: ✅ VOLLSTÄNDIG MIGRIERT
  - Deutsche Fehlermeldungen bei Delete-Konflikten implementiert
  - Kategorien werden korrekt angezeigt und können CRUD-Operations durchführen
  - Auto-Slide Funktionalität bei Fehlern hinzugefügt
  - Status: ✅ Funktioniert vollständig

- **Jahrgänge System**: ✅ VOLLSTÄNDIG MIGRIERT
  - Chat-Room Validation bei Delete hinzugefügt
  - Deutsche Fehlermeldungen implementiert
  - Auto-Slide Funktionalität hinzugefügt
  - Status: ✅ Funktioniert vollständig

- **Events System**: ✅ VOLLSTÄNDIG MIGRIERT
  - War bereits PostgreSQL-ready (STRING_AGG, transactions, etc.)
  - Deutsche Delete-Fehlermeldungen hinzugefügt
  - Validation für Buchungen, Wartelisten und Chat-Rooms bei Delete
  - Umfangreiche Event-Booking Logik mit Timeslots und Waitlist
  - Status: ✅ Funktioniert vollständig

### ❌ NOCH NICHT MIGRIERT:
- Badge System (custom_badges Tabelle)
- Statistics System  
- Organizations System
- Auth System
- Push Notifications

### MIGRATION VORGEHEN (Route für Route):
1. ✅ **Erledigt**: `/routes/activities.js` - Aktivitäten und Kategorien migriert
2. ✅ **Erledigt**: `/routes/jahrgaenge.js` - Jahrgänge System migriert  
3. ✅ **Erledigt**: `/routes/events.js` - Event System migriert
4. **Nächste**: `/routes/badges.js` - Badge System portieren  
5. **Dann**: `/routes/statistics.js` - Statistics portieren
6. **Dann**: `/routes/organizations.js` - Organizations portieren
7. **Zuletzt**: `/routes/auth.js` - Auth System prüfen

### WICHTIGE ERKENNTNISSE:
- **SQLite Backup**: `/backend/backup_sqlite/` enthält funktionierende SQLite Version
- **PostgreSQL Live**: Docker Container mit aktueller PostgreSQL DB
- **Datenbankzugriff**: `ssh root@server.godsapp.de "docker exec -it konfi-quest-db-1 psql -U konfi_user -d konfi_db"`
- **Alte SQLite**: `ssh root@server.godsapp.de "cd /opt/Konfi-Quest && sqlite3 data/konfi.db"` (NUR als Referenz!)

## System Status (Juli 2025)

### ✅ FUNKTIONIERT:
- RBAC System komplett migriert
- Badge Counts in Übersicht und Details
- Activity/Bonus CRUD Operations
- Admin Konfi Management
- Punkte werden korrekt angezeigt
- Modal System mit useIonModal

### 🔄 IN ARBEIT:
- Events Sektion für KonfiDetailView
- Legacy Code cleanup

### ✅ SICHERHEITSLÜCKE BEHOBEN (Juli 2025):
- **Chat-System jetzt MIT organization_id Filterung!**
- Alle Chat-Routes prüfen jetzt organization_id
- Chat-Erstellung nur innerhalb derselben Organisation
- Bestehende Chat-Rooms wurden migriert

### ❌ DEPRECATED:
- Alte `points.gottesdienst` Struktur
- `admins`/`konfis` Tabellen
- `<IonModal isOpen>` Pattern

---

**WICHTIG**: Dieses System ist produktiv. Alle Änderungen müssen der neuen RBAC-Struktur folgen!