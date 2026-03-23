# Codebase Structure

**Analysis Date:** 2026-03-23

## Directory Layout

```
Konfipoints/                      # Repo-Root
├── backend/                      # Node.js Express API
│   ├── server.js                 # Einstiegspunkt, Route-Mounting, Socket.IO
│   ├── database.js               # pg-Pool, Migrations-Runner
│   ├── healthcheck.js            # Docker Healthcheck Endpoint
│   ├── middleware/
│   │   ├── rbac.js               # JWT-Verifikation + RBAC-Middleware-Factories
│   │   └── validation.js         # express-validator Wrapper
│   ├── routes/                   # 15 Route-Module (Factory-Pattern)
│   ├── services/                 # Hintergrundprozesse, Push, Mail, Losung
│   ├── utils/                    # liveUpdate, chatUtils, dateUtils, etc.
│   ├── push/
│   │   └── firebase.js           # Firebase Admin SDK Init
│   ├── migrations/               # SQL-Migrations (alphabetisch sortiert)
│   └── uploads/                  # Datei-Uploads (requests/, chat/, material/)
├── frontend/                     # React 19 + Ionic 8 Capacitor-App
│   └── src/
│       ├── main.tsx              # React-Root
│       ├── App.tsx               # Context-Stack, Auth-Guard
│       ├── components/           # UI-Komponenten nach Rolle
│       │   ├── admin/            # Admin-Bereich
│       │   ├── konfi/            # Konfi-Bereich
│       │   ├── teamer/           # Teamer-Bereich
│       │   ├── chat/             # Chat (rollenübergreifend)
│       │   ├── auth/             # Login, Register, Passwort-Reset
│       │   ├── common/           # ErrorBoundary, LoadingSpinner, PushSettings
│       │   ├── shared/           # Wiederverwendbare UI-Teile (EmptyState, etc.)
│       │   ├── wrapped/          # Jahres-Rückblick Feature (Slides, Modal)
│       │   └── layout/
│       │       └── MainTabs.tsx  # Rollen-Router + Tab-Navigation
│       ├── contexts/             # React Contexts (App, Badge, LiveUpdate, Modal)
│       ├── hooks/                # useOfflineQuery, useActionGuard, useCountUp
│       ├── services/             # api, tokenStore, offlineCache, writeQueue, etc.
│       ├── types/                # TypeScript-Typen (user, event, chat, dashboard, wrapped)
│       ├── utils/                # dateUtils, haptics, helpers, nativeFileViewer
│       └── theme/
│           └── variables.css     # Ionic CSS Custom Properties, Design Tokens
├── init-scripts/                 # PostgreSQL Docker Init-Skripte
├── docs/                         # Projektdokumentation
├── .planning/                    # GSD-Planung (Phasen, Codebase-Analyse)
│   ├── codebase/                 # Diese Analyse-Dokumente
│   └── milestones/               # Milestone-Phasen (v1.0 bis aktuell)
├── portainer-stack.yml           # Docker-Compose für Portainer-Deployment
└── CLAUDE.md                     # Projekt-Regeln für Claude Code
```

## Directory Purposes

**`backend/routes/`:**
- Purpose: Alle API-Endpunkte, nach Domain aufgeteilt
- Contains: Je ein `.js` pro Domain als Factory-Funktion
- Key files:
  - `backend/routes/auth.js` — Login, Logout, Token-Refresh, Passwort-Reset
  - `backend/routes/konfi.js` — Konfi-Dashboard, Aktivitätsanträge, Profil
  - `backend/routes/admin/konfi-management.js` → `backend/routes/konfi-management.js` — Admin: Konfi-CRUD, Punkte vergeben
  - `backend/routes/activities.js` — Admin: Aktivitäten-Verwaltung + Badge-Trigger
  - `backend/routes/badges.js` — Badge-Verwaltung + `checkAndAwardBadges` Export
  - `backend/routes/events.js` — Event-CRUD, Buchungen, Timeslots, Warteliste
  - `backend/routes/chat.js` — Chat-Rooms, Nachrichten, Datei-Uploads, Polls
  - `backend/routes/organizations.js` — Multi-Tenancy Organisations-Verwaltung
  - `backend/routes/users.js` — User-CRUD (doppelt gemountet unter `/api/admin/users` und `/api/users`)
  - `backend/routes/wrapped.js` — Jahres-Rückblick Daten + Cron-Job-Trigger

**`backend/services/`:**
- Purpose: Langlebige Dienste und externe Integrationen
- Contains: Klassen und Singleton-Exporte
- Key files:
  - `backend/services/backgroundService.js` — Cron-Jobs: Badge-Updates alle 5min, Event-Reminders, Token-Cleanup, Wrapped-Cron
  - `backend/services/pushService.js` — Firebase FCM Push-Versand
  - `backend/services/emailService.js` — Nodemailer SMTP-Versand
  - `backend/services/losungService.js` — Externe API `losung.godsapp.de`

**`backend/migrations/`:**
- Purpose: Datenbankschema-Versionierung; werden beim Server-Start automatisch ausgeführt
- Contains: SQL-Dateien, alphabetisch sortiert (Format: `NNN_beschreibung.sql`)
- Key files: Letzte Migration zeigt aktuellen Schema-Stand

**`frontend/src/components/admin/`:**
- Purpose: Alle UI-Komponenten für Admin und Org-Admin
- Contains: `pages/` (Datenabruf), `views/` (Darstellung), `modals/` (Dialoge), `settings/` (Einstellungs-Unterseiten)
- Key files:
  - `frontend/src/components/admin/pages/AdminKonfisPage.tsx` — Konfis-Übersicht
  - `frontend/src/components/admin/views/KonfiDetailView.tsx` — Konfi-Detailansicht

**`frontend/src/components/konfi/`:**
- Purpose: Alle UI-Komponenten für eingeloggte Konfis
- Contains: `pages/` (Container mit Datenabruf), `views/` (Pure UI), `modals/` (Dialoge)
- Key files:
  - `frontend/src/components/konfi/pages/KonfiDashboardPage.tsx` — Konfi-Startseite
  - `frontend/src/components/konfi/views/EventsView.tsx` — Referenz-View für Design-System

**`frontend/src/components/teamer/`:**
- Purpose: UI für Teamer-Rolle (Gruppenleiter, eingeschränkte Admin-Rechte)
- Contains: `pages/`, `views/`

**`frontend/src/components/chat/`:**
- Purpose: Chat-System (rollenübergreifend, wird von allen Rollen geteilt)
- Contains: `ChatOverview.tsx`, `ChatRoom.tsx`, `pages/`, `views/`, `modals/`

**`frontend/src/components/wrapped/`:**
- Purpose: Jahres-Rückblick Feature (Spotify-Wrapped-Stil)
- Contains: `WrappedModal.tsx`, `slides/` (9 Konfi-Slides + 7 Teamer-Slides), `share/`

**`frontend/src/services/`:**
- Purpose: Technische Infrastruktur-Schicht ohne UI-Abhängigkeiten
- Contains: Singletons und pure Funktionen
- Key files:
  - `frontend/src/services/api.ts` — Axios-Instanz mit Auth + Retry + Token-Refresh
  - `frontend/src/services/tokenStore.ts` — Sync Memory + async Capacitor Preferences
  - `frontend/src/services/offlineCache.ts` — TTL-basierter SWR-Cache
  - `frontend/src/services/writeQueue.ts` — FIFO-Queue für Offline-Schreibvorgänge
  - `frontend/src/services/networkMonitor.ts` — Online/Offline-Status-Singleton
  - `frontend/src/services/websocket.ts` — Socket.IO-Client-Singleton

**`frontend/src/types/`:**
- Purpose: Zentrale TypeScript-Interface-Definitionen
- Contains: Domänen-Typen ohne Laufzeit-Code
- Key files:
  - `frontend/src/types/user.ts` — `BaseUser`, `AdminUser`, `ChatUser`
  - `frontend/src/types/event.ts` — Event-Interfaces
  - `frontend/src/types/chat.ts` — Chat-Interfaces
  - `frontend/src/types/dashboard.ts` — Dashboard-Widget-Typen
  - `frontend/src/types/wrapped.ts` — Wrapped-Feature-Typen

## Key File Locations

**Entry Points:**
- `backend/server.js`: Backend-Start, alle Routes und Middleware registriert
- `frontend/src/main.tsx`: React-Root-Rendering
- `frontend/src/App.tsx`: Auth-Guard, Context-Provider-Stack
- `frontend/src/components/layout/MainTabs.tsx`: Rollen-basiertes Routing

**Configuration:**
- `portainer-stack.yml`: Produktions-Deployment (PostgreSQL + Backend + Frontend)
- `frontend/src/theme/variables.css`: Design-Tokens, CSS Custom Properties
- `frontend/src/services/api.ts`: API-Basis-URL (`VITE_API_URL` oder `https://konfi-quest.de/api`)

**Core Logic:**
- `backend/middleware/rbac.js`: RBAC-Middleware (Zugriffskontrolle)
- `backend/database.js`: DB-Pool + Migrations-Runner
- `backend/utils/liveUpdate.js`: Socket.IO-Event-Versand
- `frontend/src/hooks/useOfflineQuery.ts`: SWR-Datenabruf-Hook
- `frontend/src/services/writeQueue.ts`: Offline-Schreib-Queue
- `frontend/src/contexts/AppContext.tsx`: Auth + Push-Token-Verwaltung

**Testing:**
- `frontend/src/App.test.tsx`: Minimal-Testdatei (Testing-Infrastruktur vorhanden, aber wenig Tests)
- `frontend/src/setupTests.ts`: Test-Setup

## Naming Conventions

**Backend-Dateien:**
- Routes: `kebab-case.js` (z.B. `konfi-management.js`)
- Services: `camelCaseService.js` (z.B. `backgroundService.js`)
- Utils: `camelCaseUtils.js` (z.B. `liveUpdate.js`)
- Migrations: `NNN_beschreibung_mit_unterstrichen.sql`

**Frontend-Dateien:**
- Komponenten: `PascalCase.tsx` (z.B. `KonfiDashboardPage.tsx`)
- Hooks: `useCamelCase.ts` (z.B. `useOfflineQuery.ts`)
- Services: `camelCase.ts` (z.B. `tokenStore.ts`)
- Types: `camelCase.ts` (z.B. `user.ts`)
- CSS: `PascalCase.css` neben der Komponente

**Komponenten-Suffix-Konvention:**
- `*Page.tsx`: Container mit Datenabruf via `useOfflineQuery`, enthält `IonPage`
- `*View.tsx`: Pure Darstellungskomponente, nimmt Daten als Props
- `*Modal.tsx`: Dialog-Komponente, wird mit `useIonModal` geöffnet
- `*Sections.tsx`: Unterabschnitte einer View, aufgeteilt für Übersichtlichkeit

**Verzeichnisse:**
- `pages/`: Routable-Container-Komponenten
- `views/`: Darstellungs-Unterkomponenten
- `modals/`: Modal-Dialoge

## Where to Add New Code

**Neues Backend-Feature (z.B. neue Domain):**
- Route: `backend/routes/new-feature.js` als Factory `(db, rbacVerifier, roleHelpers) => Router`
- Mounting: `backend/server.js` — Import + `app.use('/api/new-feature', newFeatureRoutes(db, rbacVerifier, roleHelpers))`
- DB-Schema: neue Migration `backend/migrations/NNN_add_new_feature.sql`

**Neue Admin-Seite:**
- Page: `frontend/src/components/admin/pages/AdminNewFeaturePage.tsx`
- View: `frontend/src/components/admin/views/NewFeatureView.tsx` (wenn komplex)
- Modal: `frontend/src/components/admin/modals/NewFeatureModal.tsx`
- Route: `frontend/src/components/layout/MainTabs.tsx` unter Admin-Routen

**Neue Konfi-Seite:**
- Page: `frontend/src/components/konfi/pages/KonfiNewFeaturePage.tsx`
- Route: `frontend/src/components/layout/MainTabs.tsx` unter Konfi-Routen

**Neue Typen:**
- Domänen-Typen: in passende `frontend/src/types/[domain].ts` oder neue Datei

**Shared UI-Komponenten:**
- `frontend/src/components/shared/` + Export in `frontend/src/components/shared/index.ts`

**Neuer Background-Service (Cron-Job):**
- `backend/services/backgroundService.js` — neue `static start*()` Methode + Aufruf in `startAllServices()`

## Special Directories

**`backend/uploads/`:**
- Purpose: Persistente Datei-Uploads (Fotos, Dokumente)
- Generated: Ja (beim Server-Start)
- Committed: Nein (Volume-Mount in Docker)
- Sub-Verzeichnisse: `requests/` (Aktivitätsantrags-Bilder), `chat/` (Chat-Medien), `material/` (Lernmaterial)
- Sicherheit: Keine direkte Static-Route; alle Files werden über geschützte Endpunkte ausgeliefert

**`backend/migrations/`:**
- Purpose: Datenbankschema-Versionierung
- Generated: Nein
- Committed: Ja
- Wichtig: Dateinamen bestimmen Ausführungsreihenfolge (alphabetisch); nie bestehende Migrations ändern

**`.planning/`:**
- Purpose: GSD-Planungs-Dokumente (Phasen, Codebase-Analyse)
- Generated: Ja (durch GSD-Befehle)
- Committed: Ja

---

*Structure analysis: 2026-03-23*
