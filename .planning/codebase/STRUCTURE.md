# Codebase Structure

**Analysis Date:** 2026-03-20

## Directory Layout

```
Konfipoints/                        # Repository-Root
├── backend/                        # Node.js/Express API
│   ├── server.js                   # Haupt-Einstiegspunkt, alle Routes gemountet
│   ├── database.js                 # PostgreSQL Pool (pg)
│   ├── Dockerfile                  # Backend Docker Image
│   ├── routes/                     # 17 Route-Module (Factory-Pattern)
│   ├── middleware/                 # RBAC + Validierung
│   ├── services/                   # Background-, Push-, Email-Services
│   ├── push/                       # Firebase Admin SDK
│   ├── utils/                      # Stateless Hilfsfunktionen
│   ├── migrations/                 # SQL-Migrationsdateien
│   ├── uploads/                    # Datei-Uploads (runtime, nicht committet)
│   │   ├── chat/                   # Chat-Dateianhänge
│   │   ├── requests/               # Aktivitäts-Antrag-Bilder
│   │   └── material/               # Material-Uploads
│   └── data/                       # Legacy SQLite-Daten (nicht mehr aktiv)
├── frontend/                       # React/Ionic SPA + Capacitor
│   ├── src/
│   │   ├── main.tsx                # React DOM-Einstiegspunkt
│   │   ├── App.tsx                 # Auth-Guard, Context-Provider-Baum
│   │   ├── components/             # Alle UI-Komponenten (nach Rolle organisiert)
│   │   │   ├── admin/              # Admin-Rolle
│   │   │   │   ├── pages/          # IonPage-Komponenten (Tab-Ziele)
│   │   │   │   ├── views/          # Detailansichten (innerhalb Pages)
│   │   │   │   ├── modals/         # useIonModal-Modals
│   │   │   │   └── settings/       # Settings-Sub-Komponenten
│   │   │   ├── konfi/              # Konfi-Rolle
│   │   │   │   ├── pages/          # IonPage-Komponenten
│   │   │   │   ├── views/          # Detailansichten
│   │   │   │   └── modals/         # Modals
│   │   │   ├── teamer/             # Teamer-Rolle
│   │   │   │   ├── pages/          # IonPage-Komponenten
│   │   │   │   └── views/          # Detailansichten
│   │   │   ├── chat/               # Chat (rollenübergreifend)
│   │   │   │   ├── pages/          # ChatOverviewPage
│   │   │   │   ├── views/          # ChatRoomView
│   │   │   │   └── modals/         # Chat-spezifische Modals
│   │   │   ├── auth/               # Login, Register, Passwort-Reset
│   │   │   ├── common/             # Kleine Shared-Komponenten (LoadingSpinner, PushSettings)
│   │   │   ├── shared/             # Wiederverwendbare Layout-Komponenten
│   │   │   └── layout/             # MainTabs (Role-Router)
│   │   ├── contexts/               # React Contexts (globaler State)
│   │   ├── services/               # API-Client, Auth, WebSocket
│   │   ├── types/                  # TypeScript Interfaces
│   │   ├── utils/                  # Stateless Hilfsfunktionen
│   │   └── theme/                  # CSS-Variablen (variables.css)
│   ├── android/                    # Capacitor Android-Projekt
│   ├── ios/                        # Capacitor iOS-Projekt
│   ├── capacitor.config.ts         # Capacitor-Konfiguration
│   ├── vite.config.ts              # Vite Build-Konfiguration
│   └── Dockerfile                  # Frontend Docker Image (nginx)
├── init-scripts/                   # PostgreSQL-Init-Scripts (beim DB-Start ausgeführt)
│   └── 01-create-schema.sql        # Haupt-Schema-Definition
├── portainer-stack.yml             # Docker Compose für Portainer-Deployment
├── .github/workflows/              # CI/CD (GitHub Actions)
└── .planning/                      # GSD Planungsdokumente
    ├── codebase/                   # Codebase-Analyse-Dokumente
    ├── milestones/                 # Abgeschlossene Milestone-Planung
    └── phases/                     # Aktuelle + geplante Phasen
```

---

## Directory Purposes

**`backend/routes/`:**
- Purpose: Alle HTTP-Endpunkte, als Factory-Funktionen exportiert
- Contains: 17 `.js`-Dateien, eine pro Domäne
- Key files:
  - `backend/routes/auth.js` — Login, Logout, Passwort-Reset, Registrierung
  - `backend/routes/konfi.js` — Konfi-Selfservice (Dashboard, Badges, Events buchen, Profil)
  - `backend/routes/konfi-managment.js` — Admin-Verwaltung von Konfis (Punkte, Aktivitäten)
  - `backend/routes/activities.js` — Aktivitäten-CRUD + Antrags-Workflow
  - `backend/routes/badges.js` — Badge-CRUD + `checkAndAwardBadges()`
  - `backend/routes/events.js` — Event-CRUD, Buchungen, Timeslots, Waitlist
  - `backend/routes/chat.js` — Chat-Rooms, Nachrichten, File-Upload, Reaktionen
  - `backend/routes/organizations.js` — Multi-Tenant Organisations-Verwaltung
  - `backend/routes/users.js` — User-CRUD (scoped auf Organisation)
  - `backend/routes/notifications.js` — Push-Token-Verwaltung, Notification-Preferences
  - `backend/routes/material.js` — Material-Upload + Abruf
  - `backend/routes/teamer.js` — Teamer-spezifische Endpoints (Konfi-Stats, Punkte vergeben)
  - `backend/routes/settings.js` — Organisations-Einstellungen, Dashboard-Konfiguration
  - `backend/routes/levels.js` — Level-System-Konfiguration
  - `backend/routes/jahrgaenge.js` — Jahrgangs-CRUD
  - `backend/routes/categories.js` — Aktivitäts-Kategorien
  - `backend/routes/roles.js` — Rollen-Abfragen

**`backend/middleware/`:**
- Purpose: Wiederverwendbare Express-Middleware
- Key files:
  - `backend/middleware/rbac.js` — JWT-Verifikation + alle Rollen-Guards
  - `backend/middleware/validation.js` — express-validator Helpers

**`backend/services/`:**
- Purpose: Domänen-Services mit Seiteneffekten
- Key files:
  - `backend/services/backgroundService.js` — Intervall-Jobs: Badge-Updates (5 Min), Event-Reminder, Token-Cleanup
  - `backend/services/pushService.js` — FCM Push-Notifications, 20+ typisierte Methoden
  - `backend/services/emailService.js` — SMTP E-Mails (Passwort-Reset)

**`backend/utils/`:**
- Purpose: Pure Hilfsfunktionen ohne Seiteneffekte
- Key files:
  - `backend/utils/roleHierarchy.js` — Hierarchie-Logik + Middleware für User-Management
  - `backend/utils/chatUtils.js` — Chat-Room-Initialisierung beim Start
  - `backend/utils/liveUpdate.js` — Helper für Socket.io Live-Update-Events
  - `backend/utils/pointTypeGuard.js` — Type-Validation für Punkt-Typen

**`frontend/src/components/admin/pages/`:**
- Purpose: Top-Level-Seiten für Admin-Tabs (IonPage-Komponenten)
- Key files: `AdminKonfisPage.tsx`, `AdminEventsPage.tsx`, `AdminActivitiesPage.tsx`, `AdminBadgesPage.tsx`, `AdminActivityRequestsPage.tsx`, `AdminSettingsPage.tsx`, `AdminUsersPage.tsx`, `AdminOrganizationsPage.tsx`, `AdminMaterialPage.tsx`, `AdminCertificatesPage.tsx`

**`frontend/src/components/admin/views/`:**
- Purpose: Detailansichten die innerhalb von Pages gerendert werden (kein eigener Tab)
- Key files: `KonfiDetailView.tsx`, `EventDetailView.tsx`, `ActivityRings.tsx`

**`frontend/src/components/admin/modals/`:**
- Purpose: Alle Admin-Modals (via `useIonModal` Hook geöffnet — NIEMALS `<IonModal isOpen={...}>`)
- Key files: `KonfiModal.tsx`, `EventModal.tsx`, `ActivityModal.tsx`, `BadgeManagementModal.tsx`, `UserManagementModal.tsx`, `LevelManagementModal.tsx`, `QRDisplayModal.tsx`, `BonusModal.tsx`, `OrganizationManagementModal.tsx`

**`frontend/src/components/konfi/`:**
- Purpose: Alle Konfi-Ansichten (selbst-Service)
- Pages: `KonfiDashboardPage.tsx`, `KonfiEventsPage.tsx`, `KonfiBadgesPage.tsx`, `KonfiRequestsPage.tsx`, `KonfiProfilePage.tsx`, `KonfiEventDetailPage.tsx`
- Views: `DashboardView.tsx`, `EventsView.tsx` (Referenz-Implementierung für Design-Patterns), `BadgesView.tsx`, `RequestsView.tsx`, `ProfileView.tsx`
- Modals: `QRScannerModal.tsx`, `ActivityRequestModal.tsx`, `PointsHistoryModal.tsx`

**`frontend/src/components/teamer/`:**
- Purpose: Teamer-Ansichten
- Pages: `TeamerDashboardPage.tsx`, `TeamerEventsPage.tsx`, `TeamerMaterialPage.tsx`, `TeamerProfilePage.tsx`, `TeamerBadgesPage.tsx`, `TeamerKonfiStatsPage.tsx`, `TeamerMaterialDetailPage.tsx`
- Views: `TeamerBadgesView.tsx`

**`frontend/src/components/chat/`:**
- Purpose: Chat-System (rollenübergreifend verwendet)
- Pages: `ChatOverviewPage.tsx` — Raum-Liste
- Views: `ChatRoomView.tsx` — Nachrichten-View (wird von allen Rollen geteilt)
- Modals: `ChatOptionsModal.tsx`, `DirectMessageModal.tsx`, `FileViewerModal.tsx`, `MembersModal.tsx`, `PollModal.tsx`, `SimpleCreateChatModal.tsx`

**`frontend/src/components/shared/`:**
- Purpose: Generische UI-Building-Blocks
- Key files: `SectionHeader.tsx`, `EmptyState.tsx`, `ListSection.tsx` (alle via `src/components/shared/index.ts` exportiert)

**`frontend/src/contexts/`:**
- Purpose: Globaler React-State via Context API
- Key files:
  - `AppContext.tsx` — User-State, Push-Permissions (`useApp()` Hook)
  - `BadgeContext.tsx` — Unread-Counts, initialisiert WebSocket (`useBadge()` Hook)
  - `LiveUpdateContext.tsx` — WebSocket-Listener, pub/sub für komponentenbasierte Refreshes (`useLiveUpdate()` Hook)
  - `ModalContext.tsx` — Modal-Zustand

**`frontend/src/services/`:**
- Purpose: Externe Kommunikation
- Key files:
  - `api.ts` — axios-Instanz mit `https://konfi-quest.de/api` als Base-URL, Auth-Interceptor, 401/429-Handling
  - `auth.ts` — Login, Logout, `checkAuth()` (localStorage)
  - `websocket.ts` — Socket.io-Client, `initializeWebSocket()`, `joinRoom()`, `leaveRoom()`

**`frontend/src/types/`:**
- Purpose: TypeScript-Interface-Definitionen
- Key files: `chat.ts` (Message, ChatRoom, Reaction), `dashboard.ts` (Badge, DashboardEvent, RankingEntry)

**`frontend/src/theme/`:**
- Purpose: CSS Custom Properties für Ionic + App-spezifische Design-Tokens
- Key files: `variables.css` — alle CSS-Variablen

---

## Key File Locations

**Entry Points:**
- `backend/server.js`: Backend-Start, alle Mounts
- `frontend/src/main.tsx`: React DOM render
- `frontend/src/App.tsx`: Auth-Guard + Context-Provider-Baum
- `frontend/src/components/layout/MainTabs.tsx`: Role-basiertes Routing

**Configuration:**
- `portainer-stack.yml`: Docker Compose (Deployment)
- `frontend/capacitor.config.ts`: Capacitor App-ID, Server-URL
- `frontend/vite.config.ts`: Build-Konfiguration
- `init-scripts/01-create-schema.sql`: PostgreSQL-Schema
- `backend/migrations/`: Delta-Migrations nach initialem Schema

**Core Logic:**
- `backend/middleware/rbac.js`: Gesamte RBAC-Implementierung
- `backend/utils/roleHierarchy.js`: Rollen-Hierarchie und Vergleichsfunktionen
- `backend/routes/badges.js`: `checkAndAwardBadges()` — zentrale Badge-Vergabe-Logik
- `frontend/src/contexts/BadgeContext.tsx`: WebSocket-Init + globale Unread-Counts

**Design Reference:**
- `frontend/src/components/konfi/views/EventsView.tsx`: Referenz-View für Design-Patterns
- `frontend/src/theme/variables.css`: Alle CSS Design-Tokens

---

## Naming Conventions

**Backend-Dateien:**
- Routes: `kebab-case.js` — `konfi-managment.js`, `jahrgaenge.js`
- Services/Utils: `camelCase.js` — `backgroundService.js`, `roleHierarchy.js`
- SQL: `NN_beschreibung.sql` — `007_levels.sql`

**Frontend-Dateien:**
- Komponenten: `PascalCase.tsx` — `AdminKonfisPage.tsx`, `EventsView.tsx`
- Services/Utils/Contexts: `camelCase.ts` — `api.ts`, `AppContext.tsx`
- CSS: `kebab-case.css` — `variables.css`

**Komponenten-Suffix-Konvention:**
- `*Page.tsx` — Top-Level IonPage, registriert in Router (Tab-Ziel)
- `*View.tsx` — Unter-Komponente/Detailansicht, wird innerhalb einer Page gerendert
- `*Modal.tsx` — Wird via `useIonModal()` Hook geöffnet

**Verzeichnisse:**
- Nach Rolle sortiert: `admin/`, `konfi/`, `teamer/`, `chat/`
- Innerhalb jeder Rolle: `pages/`, `views/`, `modals/`

---

## Where to Add New Code

**Neuer Admin-Feature:**
- Backend-Route: `backend/routes/` (neue Datei oder in bestehende Route einfügen)
- Route mounten: `backend/server.js` unter `app.use('/api/admin/...',...)`
- Frontend-Seite: `frontend/src/components/admin/pages/AdminNEWPage.tsx`
- Route registrieren: `frontend/src/components/layout/MainTabs.tsx` im Admin-Block
- Modals: `frontend/src/components/admin/modals/NEWModal.tsx`

**Neues Konfi-Feature:**
- Backend: in `backend/routes/konfi.js` oder neue Route
- Frontend-Seite: `frontend/src/components/konfi/pages/KonfiNEWPage.tsx`
- View (Detailansicht): `frontend/src/components/konfi/views/NEWView.tsx`
- Route registrieren: `frontend/src/components/layout/MainTabs.tsx` im Konfi-Block

**Neues Teamer-Feature:**
- Backend: in `backend/routes/teamer.js`
- Frontend: `frontend/src/components/teamer/pages/TeamerNEWPage.tsx`
- Route: `frontend/src/components/layout/MainTabs.tsx` im Teamer-Block

**Neue TypeScript-Typen:**
- Domänen-spezifisch: in bestehende Datei in `frontend/src/types/`
- Neue Domäne: neue Datei in `frontend/src/types/`

**Neue Hilfsfunktionen:**
- Frontend: `frontend/src/utils/helpers.ts` oder `frontend/src/utils/dateUtils.ts`
- Backend: `backend/utils/` (neue Datei für separate Domäne)

**Shared UI-Komponenten:**
- Kleine, generische Komponenten: `frontend/src/components/shared/`
- In `frontend/src/components/shared/index.ts` re-exportieren

**Neue Push-Notification-Typen:**
- Backend: neue statische Methode in `backend/services/pushService.js`

**Neue DB-Tabelle:**
- Migration anlegen: `backend/migrations/BESCHREIBUNG.sql`

---

## Special Directories

**`backend/uploads/`:**
- Purpose: Runtime-Datei-Uploads (Bilder, PDFs, Videos)
- Generated: Ja (beim Server-Start)
- Committed: Nein (in .gitignore)
- Zugriff: Nur über geschützte Backend-Endpoints (kein statisches Serving)

**`frontend/android/` und `frontend/ios/`:**
- Purpose: Capacitor native Projekte
- Generated: Teilweise (Capacitor sync)
- Committed: Ja (native Konfiguration)

**`frontend/dist/`:**
- Purpose: Vite Build-Output für Production
- Generated: Ja (`npm run build`)
- Committed: Nein

**`.planning/`:**
- Purpose: GSD Planungsdokumente, Codebase-Analyse, Milestone-History
- Generated: Nein
- Committed: Ja

**`init-scripts/`:**
- Purpose: SQL-Scripts die beim ersten DB-Start ausgeführt werden (Docker `docker-entrypoint-initdb.d`)
- Key file: `init-scripts/01-create-schema.sql`

---

*Structure analysis: 2026-03-20*
