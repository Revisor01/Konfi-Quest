# CLAUDE.md - Konfipoints/Konfi Quest System

## KRITISCHE REGELN FUER CLAUDE CODE

1. **RBAC-Struktur verwenden** - Alte `admins`/`konfis` Tabellen und `points.gottesdienst` Struktur sind deprecated
2. **Deutsche Entwicklungssprache verwenden**
3. **KEINE UNICODE EMOJIS VERWENDEN!!!** - Keine Emojis in Code, UI oder Texten!
   - VERBOTEN: Alle Unicode Emojis (Smileys, Symbole, etc.)
   - ERLAUBT: IonIcon mit Icons aus ionicons/icons (auch outline Varianten)
   - ERLAUBT: Line Icons und Icon Fonts
   - Das gilt für ALLE Dateien: .tsx, .ts, .js, .jsx, Kommentare, Strings, ÜBERALL!
4. **ECHTE UMLAUTE VERWENDEN** - Immer ü, ö, ä, ß statt ue, oe, ae, ss!
   - RICHTIG: für, Glückwunsch, bestätigt, Größe
   - FALSCH: fuer, Glueckwunsch, bestaetigt, Groesse
   - Das gilt besonders für Push-Nachrichten, UI-Texte und Meldungen!

---

## Systemarchitektur

### Backend: Node.js Express mit RBAC System
- **Database**: PostgreSQL mit RBAC-Struktur (Docker Container) -- Alle 15 Routes vollständig auf PostgreSQL migriert
- **Authentication**: JWT mit `verifyTokenRBAC` middleware
- **Port**: 5000 (Docker: 8623)
- **API Base**: https://konfi-points.de/api
- **Routes Directory**: backend/routes/

### Frontend: React 19 + Ionic 8 + TypeScript
- **Framework**: React 19 mit Ionic React 8
- **Build**: Vite 5.2
- **State**: React Context (`AppContext`)
- **Dev Port**: 5173

---

## RBAC Datenbankstruktur

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

### IMMER so (useIonModal Hook):
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

### NIEMALS `<IonModal isOpen={state}>` verwenden!

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

### Datenbankzugriff:
```bash
ssh root@server.godsapp.de "docker exec -it konfi-quest-db-1 psql -U konfi_user -d konfi_db"
```

---

## System Status

### Funktioniert:
- RBAC System vollständig migriert
- Alle 15 Routes auf PostgreSQL (activities, auth, badges, categories, chat, events, jahrgaenge, konfi-managment, konfi, levels, notifications, organizations, roles, settings, users)
- Chat-System mit organization_id Filterung (Chat-Erstellung nur innerhalb derselben Organisation)
- Badge Counts in Übersicht und Details
- Activity/Bonus CRUD Operations
- Admin Konfi Management
- Punkte-Anzeige korrekt
- Modal System mit useIonModal
- Event-Booking mit Timeslots und Waitlist

---

**WICHTIG**: Dieses System ist produktiv. Alle Änderungen müssen der RBAC-Struktur folgen!
