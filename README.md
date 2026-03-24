# Konfi Quest

**Konfirmandenpunkte-App für Kirchengemeinden**

Ionic Hybrid-App (iOS/Android) zur spielerischen Verwaltung von Konfirmandenpunkten in Kirchengemeinden. Version v2.7 — 93 Phasen, 146 Plans, ~36.800 Zeilen (TS/TSX/CSS).

---

## Was ist Konfi Quest?

Konfi Quest ist eine Hybrid-App, in der Konfis Punkte sammeln, während sie am Gemeindeleben teilnehmen. Zwei Punktetypen — Gottesdienst und Gemeinde — dokumentieren unterschiedliche Formen der Beteiligung. Durch Aktivitäten, Events und Bonuspunkte sollen Konfis motiviert werden, aktiv dabei zu sein.

Kirchengemeinden verwalten das System über ein rollenbasiertes Admin-Interface: Teamer:innen betreuen Konfis direkt, Admins verwalten Jahrgänge und Inhalte, Orgadmins überwachen die gesamte Organisation. Das System unterstützt mehrere Organisationen gleichzeitig (Multi-Tenancy) mit vollständiger Datentrennung.

Die App läuft produktiv auf Docker (server.godsapp.de) und wird über Portainer mit automatischem Build-Deployment betrieben. Ein öffentlicher Launch unter dem EKD-Kontext ist für v3.0 geplant.

---

## Features

### Punktesystem

- Zwei Punktetypen: **Gottesdienst** und **Gemeinde**, pro Jahrgang einzeln aktivierbar
- Individuelle Zielwerte pro Jahrgang und Punktetyp
- ActivityRings-Visualisierung (1–3 Ringe, dynamisch nach aktiven Typen)
- Bonus-Punkte mit Beschreibung und Admin-Zuweisung
- Transaktionssichere Punkteoperationen (BEGIN/COMMIT, GREATEST(0,...))
- Ranking-Liste und Punkte-Historie

### Aktivitäten und Kategorien

- Aktivitäten mit Kategorien und konfigurierbaren Punktwerten
- Antragsystem: Konfis stellen Anträge, Teamer:innen und Admins genehmigen
- Offline-fähige Antragsstellung via WriteQueue
- IonSegment-Filter nach Kategorie im Antragsmodal

### Event-System

- Buchung mit Timeslots und automatischer Warteliste
- Pflicht-Events mit Auto-Enrollment aller Jahrgangs-Konfis
- Opt-out mit Freitext-Begründung und Admin-Übersicht
- QR-Code Self-Check-in mit konfigurierbarem Zeitfenster (5–120 Min)
- Manuelle Admin-Korrektur der Anwesenheit
- "Was mitbringen"-Feld mit Dashboard-Widget-Integration
- Pro-Konfi Anwesenheitsstatistik mit Farbcodierung

### Badge-System

- 13 Kriterientypen für automatische Badge-Vergabe
- Levels mit konfigurierbaren Schwellenwerten
- Streak-Logik mit Jahreswechsel-Behandlung
- Badge-Progress mit percentage und points
- Geheime Badges (nicht sichtbar bis zur Vergabe)

### Chat

- Echtzeit-Messaging via Socket.IO
- Gruppen-Chats, Direkt-Nachrichten
- Polls und Datei-Uploads (Bilder, Dokumente, Videos)
- Org-Isolation: Org-übergreifende Room-Beitritte blockiert
- Nachrichtenlimit: 4.000 Zeichen
- Fullscreen FileViewerModal mit Pinch-to-Zoom, Multi-Datei-Swipe
- LATERAL Joins eliminieren N+1-Queries bei DM-Namen

### Push-Notifications

- 18 dokumentierte Notification-Types
- Event-Erinnerungen (15-Min-Intervall vor Event)
- Admin-Alert bei Konfi-Registrierung
- Level-Up-Notifications
- Selbstreinigendes Token-System (6h-Cleanup)
- Firebase (Android) und APNS (iOS)

### Konfi + Teamer Wrapped

- Spotify-Wrapped-Style Jahresrückblick
- Konfi: 9 Slides (Intro, Punkte, Events, Badges, Aktivster Monat, Chat, Endspurt, Abschluss)
- Teamer: 7 Slides mit Rosa-Farbschema
- Swiper 12 mit EffectCreative 3D-Übergängen und Count-up-Animationen
- Share-Funktion: 1080x1920 Story-Export via html-to-image + natives Share-Sheet
- highlight_type-basierte Slide-Reihenfolge, seed-gesteuerte Formulierungsvarianten
- Kategorie-Balkendiagramm, Gottesdienst-Counter, Über-das-Ziel-Konfetti
- Wiederansicht "Meine Wrappeds" in Konfi- und Teamer-Profilen
- Dashboard-Cards und Push-Notification bei Freischaltung

### Dashboard

- Konfigurierbare Widgets: Konfirmation, Events, Losung, Badges, Ranking
- 5 Sektionen vom Orgadmin ein-/ausblendbar
- Tageslosung-Integration (externe API, kein Request bei deaktivierter Losung)
- Tageszeitabhängige Begrüßung, Badge-Stats als Glass-Chips

### Multi-Tenancy und RBAC

- 5 Rollen: **Konfi**, **Teamer**, **Admin**, **Orgadmin**, **Superadmin**
- Vollständige Datentrennung pro Organisation auf allen 15 Backend-Routes
- Gesperrte User werden sofort bei Token-Validierung blockiert (LRU-Cache 30s TTL)
- QR-Code Onboarding mit Multi-Use Invite Codes und Auto-Login

### Offline-First

- SWR-Cache via `useOfflineQuery` auf allen 30 Pages
- WriteQueue (FIFO, persistent): Chat, Anträge, Admin-CRUD (30 Queue-Aktionen)
- Corner-Badge-System für Queue-Status und Fehler
- 42 Online-Only-Buttons mit `isOnline`-Guard
- axios-retry mit Exponential Backoff + Jitter
- Idempotency-Keys (client_id UUID) gegen Doppel-Ausführung
- Koordinierter Reconnect-Sync: flush → invalidateAll → badge-refresh

### Sicherheit

- helmet Security Headers auf allen Responses
- express-validator Input-Validierung auf allen 15 Routes
- JWT mit Refresh-Token-Rotation (Access 15 Min, Refresh 90 Tage, Soft-Revoke)
- Magic-Bytes Upload-Validierung (file-type@19) — Client-MIME nicht vertrauenswürdig
- Rate-Limiting mit deutscher Fehlermeldung
- SQL-Injection-Schutz via getPointField-Whitelist
- Serverseitiges Refresh-Token-Revoke beim Logout
- Passwort-Minimum 8 Zeichen

---

## Tech-Stack

| Bereich | Technologie |
|---------|-------------|
| **Frontend Framework** | React 19, Ionic 8, TypeScript |
| **Mobile** | Capacitor 7 (iOS / Android) |
| **Build** | Vite 5.2 |
| **Slides** | Swiper 12 (EffectCreative) |
| **Themes** | iOS 26 Theme + Material Design 3 (platform-scoped) |
| **Backend** | Node.js, Express |
| **Datenbank** | PostgreSQL |
| **Echtzeit** | Socket.IO |
| **Auth** | JWT (jose), bcrypt |
| **E-Mail** | Nodemailer (SMTP) |
| **Cron** | node-cron |
| **Deployment** | Docker, Portainer (Auto-Deploy via git push) |

---

## Architektur

### Frontend

```
src/
  components/
    admin/          -- Admin-Views (mit Sektionen-Dateien)
    konfi/          -- Konfi-Views
    teamer/         -- Teamer-Views
    shared/         -- SectionHeader, EmptyState, ListSection
    wrapped/        -- Wrapped-Slides (Konfi + Teamer)
  context/
    AppContext       -- Globaler State (User, Auth, Online-Status)
    LiveUpdateContext -- Triggerbasiertes Daten-Refresh-System
  services/
    tokenStore      -- sync Memory-Cache + async Capacitor Preferences
    offlineCache    -- useOfflineQuery SWR-Pattern
    writeQueue      -- FIFO persistent für Offline-Aktionen
    networkMonitor  -- Capacitor Network Plugin Singleton
  theme/
    variables.css   -- 100+ CSS-Utility-Klassen, Design-System
```

**Schlüsselmuster:**
- `useOfflineQuery`: SWR-Hook mit stale-while-revalidate und dataRef (kein Stale-Closure)
- `useIonModal`: Einziges erlaubtes Modal-Pattern (kein `isOpen`-State)
- `useIonRouter`: Ionic 8 native Navigation (kein React Router v6)
- `WriteQueue`: FIFO-Queue mit Auto-Flush bei Online/Resume

### Backend

```
backend/
  routes/           -- 15 Express-Routes (vollständig PostgreSQL)
  migrations/       -- SQL-Dateien, via Migration-Runner beim Start ausgeführt
  middleware/       -- verifyTokenRBAC (LRU-Cache 30s), upload
  services/
    liveUpdate      -- Socket.IO Dependency Injection
    losungService   -- Tageslosung-API
    emailService    -- Nodemailer SMTP
    pushService     -- Firebase / APNS
  utils/
    bookingUtils    -- 5 geteilte Booking-Funktionen
    chatUtils       -- Dynamischer Admin-Lookup
```

**Schlüsselmuster:**
- RBAC Middleware: `verifyTokenRBAC` mit LRU-Cache (500 Einträge, 30s TTL)
- Migration-Runner: alle .sql-Dateien aus `migrations/` beim Server-Start
- Dependency Injection: `liveUpdate.init(io)` statt `global.io`
- Schema-Tracking: `schema_migrations`-Tabelle

### Datenbank

- ~30 Tabellen, 73 Indizes, 23 Foreign Keys
- Kern-Tabellen: `users`, `konfi_profiles`, `konfi_activities`, `bonus_points`, `konfi_badges`, `event_bookings`, `chat_rooms`, `chat_messages`, `wrapped_snapshots`

---

## Screenshots

_Screenshots folgen vor dem v3.0 Launch._

```
![Dashboard](docs/screenshots/dashboard.png)
![Events](docs/screenshots/events.png)
![Chat](docs/screenshots/chat.png)
![Wrapped](docs/screenshots/wrapped.png)
![Admin](docs/screenshots/admin.png)
```

---

## Entwicklung und Setup

### Voraussetzungen

- Node.js 20+
- PostgreSQL 15+
- Docker (für Deployment)
- Capacitor CLI (für iOS/Android Build)

### Umgebungsvariablen

```env
# Backend (.env oder docker-compose.yml)
DB_HOST=localhost
DB_PORT=5432
DB_USER=konfi_user
DB_PASSWORD=...
DB_NAME=konfi_db
JWT_SECRET=...
REFRESH_TOKEN_SECRET=...
QR_SECRET=...
LOSUNG_API_KEY=...
SMTP_HOST=...
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
PG_POOL_MAX=10
FRONTEND_URL=https://konfi-points.de

# Frontend
VITE_API_URL=https://konfi-points.de/api
```

### Backend starten

```bash
cd backend && npm install && npm start
```

### Frontend (Development)

```bash
cd frontend && npm install && npm run dev
```

Dev-Server läuft auf `http://localhost:5173`.

### iOS-Build (Xcode)

```bash
cd frontend
npm run build
npx cap sync ios
open ios/App/App.xcworkspace
```

### Deployment

Deployment läuft vollautomatisch über Portainer:

```bash
git push
# Portainer erkennt den Push, baut Docker-Images neu und startet Container
```

Manueller Datenbankzugriff (nur im Notfall):

```bash
ssh root@server.godsapp.de "docker exec -it konfi-quest-db-1 psql -U konfi_user -d konfi_db"
```

---

## Milestone-Historie

| Version | Datum | Beschreibung | Phasen | Plans |
|---------|-------|--------------|--------|-------|
| v1.0 | 2026-03-01 | Security Hardening: helmet, express-validator, SQL-Injection-Fix, TabBar-Stabilisierung | 2 | 5 |
| v1.1 | 2026-03-02 | Design-Konsistenz: Shared Components, 100+ CSS-Klassen, 28 Modals auf useIonModal | 5 | 17 |
| v1.2 | 2026-03-02 | Polishing + Tech Debt: ActivityRings, Dashboard-Design, console.log-Cleanup | 4 | 6 |
| v1.3 | 2026-03-04 | Layout-Polishing: Konfi-Views, Admin-Views, Settings, Super-Admin Vollbild | 9 | 18 |
| v1.4 | 2026-03-05 | Logik-Debug: Event-Transaktionen, Badge-Kriterien, Punkte-Atomarität, RBAC-Härtung | 5 | 9 |
| v1.5 | 2026-03-07 | Push-Notifications: 18 Types, Token-Lifecycle, BadgeContext, Event-Erinnerungen | 5 | 8 |
| v1.6 | 2026-03-09 | Dashboard-Konfig + Punkte-Logik: Jahrgangs-Konfiguration, Widget-Toggles | 4 | 7 |
| v1.7 | 2026-03-09 | Pflicht-Events: Auto-Enrollment, Opt-out, QR-Check-in, Anwesenheitsstatistik | 4 | 8 |
| v1.8 | 2026-03-12 | Teamer-Rolle: Dashboard, Konfi-Betreuung, Badges, Events, Zertifikate, Material | 5 | 14 |
| v1.9 | 2026-03-19 | Bugfix + Polish: Ghost-Push-Fix, Event-Filter, Chat-Erstellung, Badge-UI | 10 | 13 |
| v2.0 | 2026-03-19 | Ionic Update + Theme: Ionic 8.8.1, Ionicons 8, iOS 26 Theme, MD3 1.1.0 | 10 | 13 |
| v2.1 | 2026-03-21 | App-Resilienz: Offline-First, SWR, WriteQueue (30 Aktionen), Corner-Badges | 15 | 23 |
| v2.2 | 2026-03-21 | Codebase-Hardening: Types, 73 DB-Indizes, Token-Refresh, Datei-Viewer, Performance-Splits | 19 | 25 |
| v2.3 | 2026-03-22 | Konfi + Teamer Wrapped: 9+7 Slides, Swiper 12, Share, Individualisierung | 6 | 11 |
| v2.4 | 2026-03-22 | Codebase-Cleanup: useIonRouter, Socket.IO Org-Isolation, node-cron, Chat Bulk-Queries | 5 | 12 |
| v2.5 | 2026-03-23 | Security-Hardening: Logout-Revoke, Magic-Bytes-Upload, LATERAL Joins, DI für Socket.IO | 4 | 6 |
| v2.6 | 2026-03-23 | Final Polish + Bugfixes: bcrypt async, Notification Bulk-INSERT, Badge-Progress | 2 | 3 |
| v2.7 | 2026-03-24 | Backend-Hardening: verifyTokenRBAC LRU-Cache, bookingUtils, fetcherRef-Stabilisierung | 2 | 3 |

**Gesamt: 93 Phasen, 146 Plans, 17 Milestones (v1.0–v2.7)**

---

## Geplant: v3.0 Onboarding + Landing

- Onboarding-Flow für neue Gemeinden
- Landing Website mit Projektbeschreibung
- GitHub Wiki und Dokumentation
- Vorbereitung für öffentlichen Launch (EKD-Kontext, 4.000+ User)

---

## Lizenz und Kontakt

_Lizenz und Kontaktinformationen folgen vor dem v3.0 Launch._
