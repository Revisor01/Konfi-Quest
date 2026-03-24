# Codebase Structure

**Analysis Date:** 2026-03-24

## Directory Layout

```
Konfipoints/                          # Projekt-Root
├── backend/                          # Node.js Express API
│   ├── server.js                     # Entry Point, Middleware-Setup, Route-Mounting
│   ├── database.js                   # PostgreSQL-Pool + Migration-Runner
│   ├── healthcheck.js                # Docker-Healthcheck-Endpunkt
│   ├── middleware/                   # Express-Middleware
│   │   ├── rbac.js                   # JWT-Verifikation + RBAC + LRU-Cache
│   │   ├── validation.js             # express-validator Helpers
│   │   └── uploadValidation.js       # Datei-Upload-Validierung
│   ├── routes/                       # 15 Route-Factories
│   ├── services/                     # Business-Logik / Background-Jobs
│   ├── utils/                        # Wiederverwendbare Hilfsfunktionen
│   ├── push/                         # Firebase FCM Integration
│   │   └── firebase.js
│   ├── migrations/                   # SQL-Migrationsdateien (lexikografisch sortiert)
│   └── uploads/                      # File-Upload-Verzeichnis (Laufzeit, nicht committed)
│       ├── chat/                     # Chat-Anhänge (hashed filenames)
│       ├── requests/                 # Aktivitäts-Antrags-Fotos
│       └── material/                 # Material-Uploads (20MB-Limit)
│
├── frontend/                         # React 19 + Ionic 8 SPA
│   └── src/
│       ├── App.tsx                   # Root-Komponente, Provider-Baum, Auth-Guard
│       ├── main.tsx                  # Entry Point, React-Hydration
│       ├── contexts/                 # React Context Providers (globaler State)
│       ├── services/                 # API, Auth, Offline-Infrastruktur
│       ├── hooks/                    # Custom React Hooks
│       ├── types/                    # TypeScript-Typdefinitionen
│       ├── utils/                    # Frontend-Hilfsfunktionen
│       ├── theme/                    # CSS-Variablen und globale Styles
│       │   └── variables.css
│       └── components/               # UI-Komponenten (nach Rolle organisiert)
│           ├── layout/               # App-Shell (MainTabs, TabBar)
│           ├── auth/                 # Login, Register, Passwort-Reset
│           ├── common/               # Geteilte Komponenten (ErrorBoundary, LoadingSpinner)
│           ├── shared/               # Wiederverwendbare UI-Bausteine
│           ├── admin/                # Admin-Bereich
│           ├── konfi/                # Konfi-Bereich
│           ├── teamer/               # Teamer-Bereich
│           ├── chat/                 # Chat-System (rollenübergreifend)
│           └── wrapped/              # Wrapped-Feature (Jahres-Rückblick)
│
├── init-scripts/                     # PostgreSQL-Initialisierungsskripte (Docker)
├── .planning/                        # GSD-Planungs-Dokumente
│   ├── codebase/                     # Codebase-Analyse-Dokumente
│   ├── milestones/                   # Milestone-Phasen-Planung
│   └── research/                     # Forschungsdokumente
├── .github/workflows/                # CI/CD (GitHub Actions → Docker-Images → Portainer)
├── portainer-stack.yml               # Docker-Compose für Produktions-Deployment
└── CLAUDE.md                         # Projekt-spezifische Claude-Regeln
```

---

## Directory Purposes

**`backend/routes/`:**
- Purpose: HTTP-Endpunkte nach Domäne organisiert
- Contains: 15 Route-Dateien als Factory-Funktionen
- Key files:
  - `backend/routes/auth.js` — Login, Logout, Token-Refresh, Passwort-Reset
  - `backend/routes/konfi.js` — Konfi-Self-Service (Dashboard, Profil, Buchungen)
  - `backend/routes/activities.js` — Aktivitäten-CRUD + Punkte-Vergabe + Requests
  - `backend/routes/events.js` — Event-CRUD, Buchungen, Timeslots, Waitlist
  - `backend/routes/chat.js` — Chat-Räume, Nachrichten, Uploads, Polls
  - `backend/routes/badges.js` — Badge-CRUD + automatische Badge-Vergabe-Logik
  - `backend/routes/konfi-management.js` — Admin-Konfi-Verwaltung
  - `backend/routes/users.js` — User-Verwaltung (alle Rollen)
  - `backend/routes/organizations.js` — Multi-Tenant Organisations-Verwaltung
  - `backend/routes/wrapped.js` — Wrapped-Jahres-Rückblick-Daten
  - `backend/routes/teamer.js` — Teamer-spezifische Endpunkte
  - `backend/routes/material.js` — Material-Uploads und -Verwaltung
  - `backend/routes/settings.js` — Organisations-Einstellungen
  - `backend/routes/jahrgaenge.js` — Jahrgangs-Verwaltung
  - `backend/routes/categories.js` — Aktivitäts-Kategorien
  - `backend/routes/levels.js` — Level-System-Konfiguration
  - `backend/routes/notifications.js` — Push-Token-Registrierung

**`backend/services/`:**
- Purpose: Background-Jobs und externe Service-Integration
- Key files:
  - `backend/services/backgroundService.js` — Cron-Jobs (Badge-Updates alle 5 min, Event-Reminders, Token-Cleanup, Wrapped-Cron)
  - `backend/services/pushService.js` — FCM Push-Notifications
  - `backend/services/emailService.js` — SMTP E-Mail-Versand
  - `backend/services/losungService.js` — Losungs-API-Integration

**`backend/utils/`:**
- Purpose: Nicht-HTTP-Hilfsfunktionen
- Key files:
  - `backend/utils/liveUpdate.js` — Socket.IO Emit-Wrapper mit `sendToUser/Org/Jahrgang/Konfi/Admin`
  - `backend/utils/chatUtils.js` — Chat-Initialisierung (Standard-Räume pro Organisation)
  - `backend/utils/bookingUtils.js` — Event-Buchungs-Logik
  - `backend/utils/pointTypeGuard.js` — Prüft ob Punkte-Typ in Einstellungen aktiv

**`backend/migrations/`:**
- Purpose: SQL-Migrationsdateien, die beim Server-Start automatisch ausgeführt werden
- Generated: Nein — manuell erstellt
- Committed: Ja
- Pattern: Dateinamen numerisch sortiert (z.B. `064_add_missing_fks.sql`, `080_add_push_foundation.sql`)

**`frontend/src/contexts/`:**
- Purpose: Globaler React-State via Context API
- Key files:
  - `frontend/src/contexts/AppContext.tsx` — Aktueller User, Online-Status, Push-Token-Verwaltung, FCM-Integration
  - `frontend/src/contexts/BadgeContext.tsx` — Ungelesene Chat-Nachrichten, ausstehende Requests/Events, Gerätebadge, WebSocket-Initialisierung
  - `frontend/src/contexts/LiveUpdateContext.tsx` — Socket.IO Event-Bus (subscribe/unsubscribe nach UpdateType)
  - `frontend/src/contexts/ModalContext.tsx` — Präsentierendes-Element für `useIonModal`

**`frontend/src/services/`:**
- Purpose: API-Kommunikation und Offline-Infrastruktur
- Key files:
  - `frontend/src/services/api.ts` — Axios-Instanz mit Token-Refresh-Interceptor, Retry-Logik (3x exponential), Rate-Limit-Events
  - `frontend/src/services/tokenStore.ts` — Synchrone Memory-Getter + Async Capacitor-Preferences-Setter für JWT-Tokens
  - `frontend/src/services/offlineCache.ts` — Key-Value-Cache auf Capacitor Preferences (TTL-basiert)
  - `frontend/src/services/writeQueue.ts` — Persistente FIFO-Queue für schreibende Aktionen bei Offline-Betrieb
  - `frontend/src/services/websocket.ts` — Socket.IO Client mit Reconnect-Sync-Sequenz (flush → invalidate → badges)
  - `frontend/src/services/networkMonitor.ts` — Online/Offline-Status mit Subscriber-System
  - `frontend/src/services/migrateStorage.ts` — Storage-Migrationen (Preferences-Format-Änderungen)

**`frontend/src/types/`:**
- Purpose: Zentrale TypeScript-Typdefinitionen
- Key files:
  - `frontend/src/types/user.ts` — `BaseUser`, `AdminUser`, `ChatUser`
  - `frontend/src/types/event.ts` — Event-Typen
  - `frontend/src/types/chat.ts` — Chat-Typen
  - `frontend/src/types/dashboard.ts` — Dashboard-Widget-Typen
  - `frontend/src/types/wrapped.ts` — Wrapped-Slide-Typen
  - `frontend/src/types/ionic.d.ts` — Ionic-Typ-Erweiterungen

**`frontend/src/components/admin/`:**
- Purpose: Admin-Bereich (org_admin + admin Rollen)
- Contains: `pages/` (Ionic-Pages mit App-Shell), `views/` (Container-Komponenten), `modals/` (useIonModal-Modals), `settings/`
- Key files: `pages/AdminKonfisPage.tsx`, `pages/AdminEventsPage.tsx`, `views/KonfiDetailView.tsx`

**`frontend/src/components/konfi/`:**
- Purpose: Konfi-Bereich (Selbst-Service für Konfirmanden)
- Contains: `pages/`, `views/`, `modals/`
- Key files: `pages/KonfiDashboardPage.tsx`, `pages/KonfiEventsPage.tsx`

**`frontend/src/components/teamer/`:**
- Purpose: Teamer-Bereich (eingeschränkte Admin-Funktionen)
- Contains: `pages/`, `views/`

**`frontend/src/components/chat/`:**
- Purpose: Chat-System (rollenübergreifend — wird in allen drei Bereichen verwendet)
- Contains: `pages/`, `views/`, `modals/`
- Key files: `pages/ChatOverviewPage.tsx`, `views/ChatRoomView.tsx`, `ChatRoom.tsx`

**`frontend/src/components/wrapped/`:**
- Purpose: Jahres-Rückblick ("Wrapped") mit animierten Slides
- Contains: `slides/` (Konfi-Slides), `slides/teamer/` (Teamer-Slides), `share/`
- Key files: `WrappedModal.tsx`, `slides/SlideBase.tsx`

**`frontend/src/components/shared/`:**
- Purpose: Wiederverwendbare UI-Komponenten ohne Rollen-Bezug
- Key files: `EmptyState.tsx`, `ListSection.tsx`, `SectionHeader.tsx`, `FileViewerModal.tsx`
- Barrel-Export: `frontend/src/components/shared/index.ts`

---

## Key File Locations

**Entry Points:**
- `backend/server.js` — Backend-Start, Route-Mounting, Socket.IO-Setup
- `frontend/src/main.tsx` — Frontend-Start, React-Hydration
- `frontend/src/App.tsx` — App-Root, Provider-Baum, Auth-Guard

**Configuration:**
- `portainer-stack.yml` — Produktions-Docker-Compose (postgres, backend, frontend)
- `frontend/src/theme/variables.css` — Design-System CSS-Variablen
- `CLAUDE.md` — Projekt-spezifische Regeln (RBAC, Emojis, Umlaute)

**Core Logic:**
- `backend/middleware/rbac.js` — Zentrale RBAC-Middleware mit LRU-Cache
- `backend/database.js` — DB-Pool + automatischer Migration-Runner
- `frontend/src/services/api.ts` — Alle HTTP-Anfragen laufen hierüber
- `frontend/src/hooks/useOfflineQuery.ts` — Daten-Abfrage-Pattern (auf allen Pages)

**Testing:**
- `frontend/src/App.test.tsx` — Minimal (kein umfangreiches Test-Setup)
- `frontend/src/setupTests.ts` — Test-Konfiguration

---

## Naming Conventions

**Backend-Dateien:**
- Routes: `kebab-case.js` (z.B. `konfi-management.js`)
- Services/Utils: `camelCase.js` (z.B. `backgroundService.js`, `liveUpdate.js`)
- Migrations: `NNN_beschreibung.sql` (numerisch, z.B. `080_add_push_foundation.sql`)

**Frontend-Dateien:**
- Komponenten/Pages: `PascalCase.tsx` (z.B. `KonfiDashboardPage.tsx`)
- Services/Hooks/Utils: `camelCase.ts` (z.B. `useOfflineQuery.ts`, `tokenStore.ts`)
- CSS-Dateien: Gleicher Name wie Komponente (z.B. `WrappedModal.css`)

**Verzeichnisse:**
- Frontend-Komponenten: Singular nach Domäne/Rolle (`admin/`, `konfi/`, `teamer/`)
- Sub-Verzeichnisse: `pages/`, `views/`, `modals/` innerhalb von Rollenverzeichnissen

---

## Where to Add New Code

**Neuer API-Endpunkt:**
- Route-Datei erstellen: `backend/routes/[domäne].js` als Factory-Funktion
- In `backend/server.js` mounten: `app.use('/api/[pfad]', require('./routes/[domäne]')(db, rbacVerifier, roleHelpers))`
- RBAC-Guard mit `rbacVerifier` + passendem `require*`-Helper

**Neues DB-Schema / -Änderung:**
- Migration erstellen: `backend/migrations/NNN_beschreibung.sql` (nächste freie Nummer)
- Migration ist automatisch beim nächsten Server-Start aktiv

**Neue Page (Konfi-Bereich):**
- Page: `frontend/src/components/konfi/pages/KonfiNeuerBereichPage.tsx`
- View (falls nötig): `frontend/src/components/konfi/views/NeuerBereichView.tsx`
- Route in `frontend/src/components/layout/MainTabs.tsx` unter Konfi-Tabs hinzufügen

**Neue Page (Admin-Bereich):**
- Page: `frontend/src/components/admin/pages/AdminNeuerBereichPage.tsx`
- Route in `frontend/src/components/layout/MainTabs.tsx` unter Admin-Tabs hinzufügen

**Neues Modal:**
- Datei: `frontend/src/components/[bereich]/modals/NeuesModal.tsx`
- Immer via `useIonModal` Hook öffnen (NIEMALS `<IonModal isOpen={state}>`)

**Neuer Hook:**
- `frontend/src/hooks/useNeuerHook.ts`
- Datenabruf-Hooks nutzen `useOfflineQuery` als Basis

**Neuer Typ:**
- In existierende Typ-Datei in `frontend/src/types/` eintragen, oder neue Datei `frontend/src/types/[domäne].ts` erstellen

**Wiederverwendbare UI-Komponente:**
- `frontend/src/components/shared/[KomponentenName].tsx`
- In Barrel-Export `frontend/src/components/shared/index.ts` eintragen

---

## Special Directories

**`backend/uploads/`:**
- Purpose: Laufzeit-Upload-Verzeichnis (Chat, Anträge, Material)
- Generated: Ja (beim Server-Start automatisch erstellt)
- Committed: Nein (nur das Verzeichnis, nicht die Inhalte)
- Production: Via Docker-Volume `/opt/Konfi-Quest/uploads:/app/uploads`

**`backend/migrations/`:**
- Purpose: SQL-Migrationsdateien für inkrementelle Schema-Änderungen
- Generated: Nein — manuell erstellt
- Committed: Ja
- Automatisch: Beim Server-Start via `runMigrations()` in `database.js`

**`.planning/`:**
- Purpose: GSD-Planungs-Workflow (Milestones, Phasen, Codebase-Analysen)
- Generated: Nein
- Committed: Ja

**`init-scripts/`:**
- Purpose: PostgreSQL-Initialisierungsskripte für Docker-Container-Erststart
- Committed: Ja

---

*Structure analysis: 2026-03-24*
