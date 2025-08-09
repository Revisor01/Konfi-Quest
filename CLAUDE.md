# CLAUDE.md - Konfipoints/Konfi Quest System

## ⚠️ KRITISCHE REGELN FÜR CLAUDE CODE

1. **Neue RBAC-Struktur verwenden** - Alte Strukturen sind deprecated
2. **Deutsche Entwicklungssprache verwenden**
3. **KEINE UNICODE EMOJIS VERWENDEN!!!** - Keine Emojis in Code, UI oder Texten!
   - VERBOTEN: 👋 🎯 🚀 🔥 💖 😊 und ALLE anderen Unicode Emojis
   - ERLAUBT: IonIcon mit Icons aus ionicons/icons (auch outline Varianten)
   - ERLAUBT: Line Icons und Icon Fonts
   - Das gilt für ALLE Dateien: .tsx, .ts, .js, .jsx, Kommentare, Strings, ÜBERALL!

---

## Aktuelle Systemarchitektur (Juli 2025)

### Backend: Node.js Express mit RBAC System
- **Database**: PostgreSQL mit neuer RBAC-Struktur (Docker Container)
- **Authentication**: JWT mit `verifyTokenRBAC` middleware
- **Port**: 5000 (Docker: 8623)
- **API Base**: https://konfi-points.de/api
- **Routes Directory**: `/Users/simonluthe/Documents/Konfipoints/backend/routes/`
- **Backup Directory**: `/Users/simonluthe/Documents/Konfipoints/backend/backup_sqlite/`

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

-- Chat System
chat_rooms: id, name, type, jahrgang_id, created_by, organization_id
chat_messages: id, room_id, user_id, user_type, content, created_at
chat_participants: id, room_id, user_id, user_type, joined_at
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
ssh root@server.godsapp.de "cd /opt/Konfi-Quest && auf den docker zugreifen für psotgres```

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