# Codebase Structure

**Analysis Date:** 2026-03-22

## Directory Layout

```
Konfipoints/                          # Projekt-Root
├── backend/                          # Node.js Express API
│   ├── middleware/                   # Auth + Validation Middleware
│   ├── migrations/                   # SQL-Migrationsskripte
│   ├── init-scripts/                 # Docker DB-Init SQL
│   ├── routes/                       # Express Route-Handler (1 Datei pro Domäne)
│   ├── services/                     # Side-Effect-Services (Push, Mail, Background)
│   ├── uploads/                      # Datei-Uploads (Chat, Anträge)
│   │   ├── chat/                     # Chat-Anhänge
│   │   └── requests/                 # Aktivitäts-Antrags-Anhänge
│   └── utils/                        # Zustandslose Hilfsfunktionen
├── frontend/                         # React + Ionic App
│   ├── android/                      # Capacitor Android-Projekt
│   ├── ios/                          # Capacitor iOS-Projekt
│   ├── public/                       # Statische Assets
│   ├── src/
│   │   ├── components/               # UI-Komponenten, nach Rolle segmentiert
│   │   │   ├── admin/                # Admin-Bereich
│   │   │   │   ├── modals/           # Admin-Dialoge
│   │   │   │   ├── pages/            # Admin-Seiten (Container)
│   │   │   │   ├── settings/         # Settings-Unterseiten
│   │   │   │   └── views/            # Admin-Views (Render-Logik)
│   │   │   ├── auth/                 # Login, Register, Passwort-Reset
│   │   │   ├── chat/                 # Chat-Bereich (alle Rollen)
│   │   │   │   ├── modals/
│   │   │   │   ├── pages/
│   │   │   │   └── views/
│   │   │   ├── common/               # Rollenneutrale UI-Bausteine
│   │   │   ├── konfi/                # Konfi-Bereich
│   │   │   │   ├── modals/
│   │   │   │   ├── pages/
│   │   │   │   └── views/
│   │   │   ├── layout/               # App-Shell (MainTabs, Navigation)
│   │   │   ├── shared/               # Wiederverwendbare Sections
│   │   │   ├── teamer/               # Teamer-Bereich
│   │   │   │   ├── pages/
│   │   │   │   └── views/
│   │   │   └── wrapped/              # Konfi-Wrapped Feature
│   │   │       ├── share/
│   │   │       └── slides/           # Individuelle Slide-Komponenten
│   │   │           └── teamer/       # Teamer-spezifische Wrapped-Slides
│   │   ├── contexts/                 # React Context Provider
│   │   ├── hooks/                    # Custom React Hooks
│   │   ├── services/                 # API, Cache, Auth, WebSocket
│   │   ├── theme/                    # CSS-Variablen, globale Styles
│   │   ├── types/                    # TypeScript Interfaces (chat.ts, event.ts, user.ts, etc.)
│   │   └── utils/                    # Frontend-Hilfsfunktionen
│   ├── capacitor.config.ts           # Capacitor App-Konfiguration
│   ├── vite.config.ts                # Build-Konfiguration
│   └── ionic.config.json             # Ionic CLI-Konfiguration
├── .planning/                        # GSD-Planungsdokumente
├── docs/                             # Entwicklerdokumentation
├── init-scripts/                     # Root-Level DB-Init
├── portainer-stack.yml               # Docker Compose für Deployment
└── CLAUDE.md                         # Claude-Projektregeln
```

## Directory Purposes

**`backend/routes/`:**
- Purpose: Ein Route-File pro Domäne, alle als Factory-Funktionen exportiert
- Contains: `auth.js`, `activities.js`, `badges.js`, `categories.js`, `chat.js`, `events.js`, `jahrgaenge.js`, `konfi-managment.js`, `konfi.js`, `levels.js`, `material.js`, `notifications.js`, `organizations.js`, `roles.js`, `settings.js`, `teamer.js`, `users.js`, `wrapped.js`
- Key files: `backend/routes/auth.js` (Login, Refresh, Passwort-Reset), `backend/routes/konfi.js` (Konfi-Dashboard, Anträge)

**`backend/middleware/`:**
- Purpose: Wiederverwendbare Express-Middleware
- Contains: `rbac.js` (Auth-Guard), `validation.js` (express-validator Helpers)
- Key files: `backend/middleware/rbac.js` — wird von allen Routes als `verifyTokenRBAC` genutzt

**`backend/services/`:**
- Purpose: Side-Effect-Logik, die mehrere Routes teilen
- Contains: `pushService.js` (FCM), `emailService.js` (SMTP), `backgroundService.js` (Intervall-Jobs für Badges + Wrapped-Cron)

**`backend/utils/`:**
- Purpose: Zustandslose Helfer ohne Side-Effects
- Key files: `backend/utils/liveUpdate.js` (Socket.IO Broadcast-API), `backend/utils/pointTypeGuard.js` (prüft ob Punkttyp für Jahrgang aktiv), `backend/utils/roleHierarchy.js`

**`backend/migrations/`:**
- Purpose: Nummerierte SQL-Migrationsskripte
- Generated: Nein
- Committed: Ja
- Key files: `064_consolidate_inline_schemas.sql`, `068_refresh_tokens.sql`, `075_wrapped.sql`

**`frontend/src/contexts/`:**
- Purpose: Globaler React-State
- Contains: `AppContext.tsx` (User, Online, Push), `BadgeContext.tsx` (Unread-Counts + WebSocket-Init), `LiveUpdateContext.tsx` (WebSocket-Event-Bus), `ModalContext.tsx`

**`frontend/src/services/`:**
- Purpose: Infrastruktur-Layer ohne React-Abhängigkeit
- Key files: `api.ts` (Axios-Client mit JWT-Interceptor + Refresh), `tokenStore.ts` (Memory+Preferences), `offlineCache.ts` (SWR-Cache), `writeQueue.ts` (Offline-FIFO), `networkMonitor.ts` (Singleton), `websocket.ts` (Socket.IO)

**`frontend/src/hooks/`:**
- Purpose: Wiederverwendbare React-Hooks
- Key files: `useOfflineQuery.ts` (SWR-Datenlade-Pattern, auf allen ~30 Pages verwendet), `useActionGuard.ts` (Online-Check vor Mutationen)

**`frontend/src/components/layout/`:**
- Purpose: App-Shell und Navigation
- Key files: `MainTabs.tsx` (rollenbasiertes Routing + Tab-Bars), `frontend/src/App.tsx` (Context-Provider-Stack, Root-Routing)

**`frontend/src/types/`:**
- Purpose: Zentrale TypeScript-Typdefinitionen
- Key files: `user.ts` (BaseUser, AdminUser, ChatUser), `event.ts`, `chat.ts`, `dashboard.ts`, `wrapped.ts`

**`frontend/src/theme/`:**
- Purpose: Design-System CSS-Variablen
- Key files: `variables.css` (Ionic CSS-Custom-Properties, App-Farben)

## Key File Locations

**Entry Points:**
- `frontend/src/App.tsx`: Frontend-Root, Provider-Stack, Auth-Routing
- `frontend/src/components/layout/MainTabs.tsx`: Rollenbasiertes Routing nach Login
- `backend/` (server.js): Backend-Start, Route-Mounting, Socket.IO-Setup

**Configuration:**
- `frontend/capacitor.config.ts`: App-ID, Capacitor-Plugin-Konfiguration
- `frontend/vite.config.ts`: Build-Setup
- `portainer-stack.yml`: Docker Deployment
- `frontend/ionic.config.json`: Ionic CLI

**Core Logic:**
- `backend/middleware/rbac.js`: Zentraler Auth-Guard
- `backend/utils/liveUpdate.js`: WebSocket-Broadcast-API
- `frontend/src/services/api.ts`: HTTP-Client mit Token-Refresh
- `frontend/src/services/offlineCache.ts`: SWR-Cache-Implementierung
- `frontend/src/services/writeQueue.ts`: Offline-FIFO-Queue
- `frontend/src/hooks/useOfflineQuery.ts`: Datenlade-Hook

**Key Pages (Referenz für Patterns):**
- `frontend/src/components/konfi/views/EventsView.tsx`: Referenz-View laut Design-System
- `frontend/src/components/konfi/pages/KonfiDashboardPage.tsx`: Beispiel für Page+View-Trennung
- `frontend/src/components/admin/pages/AdminKonfisPage.tsx`: Admin-Seiten-Pattern

**Testing:**
- `frontend/cypress/`: E2E-Tests (Cypress)
- `frontend/cypress.config.ts`: Cypress-Konfiguration

## Naming Conventions

**Files:**
- React-Komponenten: PascalCase + Rolle als Präfix: `KonfiDashboardPage.tsx`, `AdminEventsPage.tsx`
- Services/Utils: camelCase: `api.ts`, `offlineCache.ts`, `liveUpdate.js`
- CSS: kebab-case: `variables.css`, `WrappedModal.css`
- SQL-Migrationen: nummeriert + Beschreibung: `068_refresh_tokens.sql`

**Directories:**
- Rollen-Segmente: lowercase: `admin/`, `konfi/`, `teamer/`
- Komponenten-Typen: lowercase: `pages/`, `views/`, `modals/`

**Komponenten-Typen:**
- `*Page.tsx`: Container-Komponente mit `IonPage`, `IonHeader`, `IonContent`, ruft View auf
- `*View.tsx`: Render-Komponente ohne IonPage-Wrapper, erhält Daten als Props
- `*Modal.tsx`: Dialog-Komponente, wird via `useIonModal` geöffnet
- `*Sections.tsx`: Wiederverwendbare Seiten-Abschnitte

## Where to Add New Code

**Neue Backend-Route:**
- Route-Handler: `backend/routes/[domäne].js` (neue Datei oder in bestehende)
- In server.js mounten: `app.use('/api/[pfad]', require('./routes/[domäne]')(db, rbac, ...))`
- Auth: `verifyTokenRBAC` aus `backend/middleware/rbac.js` als Middleware

**Neue Frontend-Page (Konfi):**
- Page-Container: `frontend/src/components/konfi/pages/[Name]Page.tsx`
- View-Komponente: `frontend/src/components/konfi/views/[Name]View.tsx`
- Route in: `frontend/src/components/layout/MainTabs.tsx` unter Konfi-Segment
- Daten laden mit: `useOfflineQuery` aus `frontend/src/hooks/useOfflineQuery.ts`

**Neue Frontend-Page (Admin):**
- Page: `frontend/src/components/admin/pages/Admin[Name]Page.tsx`
- View: `frontend/src/components/admin/views/[Name]View.tsx`
- Route in: `frontend/src/components/layout/MainTabs.tsx` unter Admin-Segment

**Neues Modal:**
- Datei: `frontend/src/components/[rolle]/modals/[Name]Modal.tsx`
- Öffnen via: `useIonModal` Hook (NIEMALS `<IonModal isOpen={state}>`)

**Neue TypeScript-Typen:**
- Domain-Typen: `frontend/src/types/[domäne].ts`
- User-bezogen: `frontend/src/types/user.ts`

**Neue Backend-Migration:**
- Datei: `backend/migrations/[NNN]_[beschreibung].sql`
- Nummerierung: nächste freie Nummer nach bestehenden

**Shared/Rollenneutrale Komponenten:**
- `frontend/src/components/common/` für UI-Bausteine ohne Rollen-Kontext
- `frontend/src/components/shared/` für wiederverwendbare Sections

**Utilities:**
- Backend: `backend/utils/[name].js`
- Frontend: `frontend/src/utils/[name].ts`

## Special Directories

**`backend/uploads/`:**
- Purpose: Hochgeladene Dateien (Chat-Bilder, Antrags-Anhänge)
- Generated: Ja (via Multer)
- Committed: Nein (in .gitignore)

**`frontend/android/` und `frontend/ios/`:**
- Purpose: Capacitor-generierte Native-Projekte
- Generated: Zum Teil (`capacitor sync`)
- Committed: Ja (für Build-Pipeline)

**`frontend/dist/`:**
- Purpose: Vite Build-Output
- Generated: Ja
- Committed: Nein

**`.planning/`:**
- Purpose: GSD-Planungsdokumente, Milestones, Phasen
- Generated: Nein (manuell durch Claude Code)
- Committed: Ja

---

*Structure analysis: 2026-03-22*
