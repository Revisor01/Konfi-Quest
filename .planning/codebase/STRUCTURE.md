# Codebase Structure

**Analysis Date:** 2026-03-23

## Directory Layout

```
Konfipoints/                        # Projekt-Root
├── backend/                        # Node.js Express API
│   ├── server.js                   # Einstiegspunkt: Express, Socket.IO, Route-Mounting
│   ├── database.js                 # PostgreSQL Pool + automatische Migrationen
│   ├── Dockerfile                  # Docker-Image fuer Backend
│   ├── package.json
│   ├── middleware/
│   │   ├── rbac.js                 # verifyTokenRBAC, requireRole, checkJahrgangAccess
│   │   └── validation.js           # express-validator Helpers
│   ├── routes/                     # 18 Express-Router (je eine Domäne)
│   │   ├── auth.js                 # Login, Logout, Refresh, Passwort-Reset
│   │   ├── konfi.js                # Konfi-eigene Endpunkte (Dashboard, Requests, Profil)
│   │   ├── konfi-management.js     # Admin: Konfi CRUD, Punkte vergeben
│   │   ├── activities.js           # Admin: Aktivitäten CRUD + Badge-Check
│   │   ├── badges.js               # Admin: Badge CRUD + checkAndAwardBadges
│   │   ├── events.js               # Events, Buchungen, Timeslots, Warteliste
│   │   ├── chat.js                 # Chat-Räume, Nachrichten, File-Upload
│   │   ├── notifications.js        # Push-Token-Registrierung, Benachrichtigungen
│   │   ├── organizations.js        # Super-Admin: Organisations-Verwaltung
│   │   ├── users.js                # Benutzer-Verwaltung (org_admin)
│   │   ├── roles.js                # Rollen-Verwaltung
│   │   ├── jahrgaenge.js           # Jahrgangs-Verwaltung
│   │   ├── categories.js           # Aktivitätskategorien
│   │   ├── levels.js               # Level-Definitionen
│   │   ├── settings.js             # Organisations-Einstellungen
│   │   ├── teamer.js               # Teamer-spezifische Endpunkte
│   │   ├── material.js             # Materialien/Dateien
│   │   └── wrapped.js              # Konfi/Teamer Wrapped
│   ├── services/
│   │   ├── backgroundService.js    # Cron-Jobs: Badge-Updates, Event-Reminder, Wrapped-Auslösung
│   │   ├── pushService.js          # Firebase FCM Push-Versand
│   │   └── emailService.js         # Nodemailer E-Mail-Versand
│   ├── push/
│   │   ├── firebase.js             # Firebase Admin SDK Initialisierung
│   │   └── firebase-service-account.json  # Firebase Credentials (nicht committen!)
│   ├── utils/
│   │   ├── chatUtils.js            # Chat-Raum-Initialisierung
│   │   ├── dateUtils.js            # Datumsformatierung
│   │   ├── passwordUtils.js        # Passwort-Stärkeprüfung
│   │   ├── pointTypeGuard.js       # Punkte-Typ-Validierung
│   │   ├── roleHierarchy.js        # Rollen-Hierarchie-Helfer
│   │   └── liveUpdate.js           # Socket.IO Live-Update-Emitter
│   ├── migrations/                 # SQL-Migrationsdateien (alphabetisch = chronologisch)
│   ├── uploads/                    # Datei-Uploads (requests/, chat/, material/)
│   └── data/                       # Datenverzeichnis (legacy, nicht mehr für SQLite)
│
├── frontend/                       # React 19 + Ionic 8 App
│   ├── src/
│   │   ├── main.tsx                # Einstiegspunkt: Storage-Migration, TokenStore-Init
│   │   ├── App.tsx                 # Auth-Check, Provider-Baum, Globale Event-Handler
│   │   ├── vite-env.d.ts
│   │   ├── contexts/
│   │   │   ├── AppContext.tsx      # User-State, Online-Status, Push-Registrierung
│   │   │   ├── BadgeContext.tsx    # Unread-Counts, WebSocket-Init, Badge-App-Icon
│   │   │   ├── LiveUpdateContext.tsx  # Socket.IO Live-Update-Event-Bus
│   │   │   └── ModalContext.tsx    # Modal-State (presentingElement)
│   │   ├── services/
│   │   │   ├── api.ts              # Axios-Instanz, Token-Interceptor, Refresh-Logic
│   │   │   ├── tokenStore.ts       # Memory-Cache + Capacitor Preferences fuer Auth
│   │   │   ├── offlineCache.ts     # TTL-Cache via Capacitor Preferences
│   │   │   ├── writeQueue.ts       # FIFO Offline-Queue fuer Schreiboperationen
│   │   │   ├── websocket.ts        # Socket.IO-Client, Reconnect-Sync
│   │   │   ├── networkMonitor.ts   # Online/Offline-Erkennung
│   │   │   ├── auth.ts             # Auth-Service-Funktionen
│   │   │   └── migrateStorage.ts   # einmalige LocalStorage→Preferences-Migration
│   │   ├── hooks/
│   │   │   ├── useOfflineQuery.ts  # SWR-Hook: Cache-First + Background-Revalidierung
│   │   │   ├── useActionGuard.ts   # Double-Submit-Schutz
│   │   │   └── useCountUp.ts       # Animierter Zähler für Dashboard
│   │   ├── types/
│   │   │   ├── user.ts             # BaseUser, AdminUser, ChatUser
│   │   │   ├── chat.ts             # Chat-Typen
│   │   │   ├── dashboard.ts        # Dashboard-Typen
│   │   │   ├── event.ts            # Event-Typen
│   │   │   └── wrapped.ts          # Wrapped-Typen
│   │   ├── utils/
│   │   │   ├── dateUtils.ts        # Datumsformatierung
│   │   │   ├── haptics.ts          # Haptic-Feedback-Wrapper
│   │   │   ├── helpers.ts          # Allgemeine Hilfsfunktionen
│   │   │   └── nativeFileViewer.ts # Datei-Vorschau-Logik
│   │   ├── theme/
│   │   │   └── variables.css       # CSS-Variablen, Design-System, .app-corner-badges
│   │   └── components/
│   │       ├── layout/
│   │       │   └── MainTabs.tsx    # Rollenbasierter Tab-Router (Admin/Teamer/Konfi)
│   │       ├── auth/
│   │       │   ├── LoginView.tsx
│   │       │   ├── KonfiRegisterPage.tsx
│   │       │   ├── ForgotPasswordPage.tsx
│   │       │   └── ResetPasswordPage.tsx
│   │       ├── admin/
│   │       │   ├── pages/          # Tab-Ziele fuer Admin (AdminKonfisPage, etc.)
│   │       │   ├── modals/         # useIonModal-basierte Modals fuer Admin
│   │       │   ├── views/          # Unterseiten (KonfiDetailView, EventDetailView)
│   │       │   └── settings/       # Admin-Einstellungsseiten
│   │       ├── konfi/
│   │       │   ├── pages/          # Tab-Ziele fuer Konfi (KonfiDashboardPage, etc.)
│   │       │   ├── modals/         # Konfi-Modals
│   │       │   └── views/          # Konfi-Views/Sektionen
│   │       ├── teamer/
│   │       │   ├── pages/          # TeamerDashboardPage, etc.
│   │       │   └── views/          # Teamer-Views
│   │       ├── chat/
│   │       │   ├── pages/          # ChatOverviewPage
│   │       │   ├── views/          # ChatRoomView
│   │       │   ├── modals/
│   │       │   ├── ChatRoom.tsx
│   │       │   ├── MessageBubble.tsx
│   │       │   └── LazyImage.tsx
│   │       ├── wrapped/
│   │       │   ├── WrappedModal.tsx
│   │       │   ├── slides/         # Einzelne Wrapped-Folien
│   │       │   └── share/          # Share-Funktionalität
│   │       ├── shared/
│   │       │   ├── index.ts        # Barrel-Export
│   │       │   ├── EmptyState.tsx
│   │       │   ├── FileViewerModal.tsx
│   │       │   ├── ListSection.tsx
│   │       │   └── SectionHeader.tsx
│   │       └── common/
│   │           ├── ErrorBoundary.tsx
│   │           ├── LoadingSpinner.tsx
│   │           └── PushNotificationSettings.tsx
│   ├── public/
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── package.json
│   └── Dockerfile                  # Nginx fuer Production-Build
│
├── init-scripts/                   # PostgreSQL-Init-Skripte fuer Docker-Erststart
├── .planning/                      # GSD-Planungsdokumente
│   ├── codebase/                   # Architektur-/Stack-Analysen
│   └── phases/                     # Implementierungsphasen
├── .github/workflows/              # CI/CD: ghcr.io Docker-Images bauen
├── portainer-stack.yml             # Production Docker Compose (Portainer)
└── CLAUDE.md                       # Projekt-Anweisungen fuer Claude
```

## Directory Purposes

**`backend/routes/`:**
- Purpose: Je eine Datei pro Domäne, alle exportieren Factory-Funktion `(db, verifyToken, roleHelpers) => router`
- Contains: Express-Router mit CRUD-Endpunkten, Validierung, Datenbankabfragen
- Key files: `backend/routes/auth.js`, `backend/routes/konfi.js`, `backend/routes/wrapped.js`

**`backend/middleware/`:**
- Purpose: Wiederverwendbare Middleware-Funktionen
- Key files: `backend/middleware/rbac.js` (MUSS bei allen geschützten Routes verwendet werden), `backend/middleware/validation.js`

**`backend/migrations/`:**
- Purpose: SQL-Migrationsdateien, alphabetisch sortiert = Ausführungsreihenfolge
- Generated: Nein
- Naming: `NNN_beschreibung.sql` (z.B. `068_refresh_tokens.sql`)

**`frontend/src/components/`:**
- Purpose: UI-Komponenten, rollenbasiert aufgeteilt
- Pattern: Jede Rollengruppe hat `pages/`, `views/`, `modals/` Unterverzeichnisse

**`frontend/src/services/`:**
- Purpose: Alle Netzwerk-, Cache- und Geräte-Infrastruktur
- Regel: Keine React-Hooks hier — nur pure Funktionen/Klassen/Singletons

**`frontend/src/contexts/`:**
- Purpose: Globaler React-State
- Mounting-Reihenfolge in `App.tsx`: `AppProvider` → `BadgeProvider` → `LiveUpdateProvider` → `ErrorBoundary`

## Key File Locations

**Entry Points:**
- `backend/server.js`: Backend-Einstiegspunkt
- `frontend/src/main.tsx`: Frontend-Einstiegspunkt
- `frontend/src/App.tsx`: Auth-Guard und Provider-Baum
- `frontend/src/components/layout/MainTabs.tsx`: Rollenbasierter Router und Tab-Bars

**Configuration:**
- `portainer-stack.yml`: Production Docker Compose
- `frontend/vite.config.ts`: Vite Build-Konfiguration
- `frontend/tsconfig.json`: TypeScript-Konfiguration
- `backend/.env`: Lokale Entwicklungs-Umgebungsvariablen (nicht committen)

**Core Logic:**
- `backend/middleware/rbac.js`: RBAC-Middleware — für alle neuen geschützten Endpunkte
- `frontend/src/hooks/useOfflineQuery.ts`: Standard-Hook fuer alle Datenladungen
- `frontend/src/services/api.ts`: Axios-Client mit Token-Refresh — zentrale HTTP-Infrastruktur
- `frontend/src/services/tokenStore.ts`: Token-Verwaltung

**Testing:**
- `frontend/src/App.test.tsx`: Minimaler Test (kein umfangreiches Test-Setup vorhanden)
- `frontend/src/setupTests.ts`: Vitest/Jest-Setup

## Naming Conventions

**Backend-Dateien:**
- Routes: `kebab-case.js` (z.B. `konfi-management.js`)
- Services/Utils: `camelCase.js` (z.B. `backgroundService.js`)
- Migrations: `NNN_beschreibung.sql` (numerisches Präfix = Reihenfolge)

**Frontend-Dateien:**
- Komponenten: `PascalCase.tsx` (z.B. `KonfiDashboardPage.tsx`)
- Services/Utils/Hooks: `camelCase.ts` (z.B. `offlineCache.ts`, `useOfflineQuery.ts`)
- CSS: Gleicher Name wie Komponente (z.B. `WrappedModal.css`)

**Komponenten-Typen (Frontend):**
- `*Page.tsx` → Tab-Ziel, hat IonPage + IonHeader + IonContent
- `*View.tsx` → Unterseite oder Inhaltssektions-Komponente ohne eigene Navigation
- `*Modal.tsx` → useIonModal-basiertes Modal
- `*Sections.tsx` → Aufgeteilte Abschnitte einer Page/View (nur Darstellung)

**Rollen-Präfixe:**
- `Admin*` → Nur für `admin`/`org_admin`-Rollen
- `Konfi*` → Nur für `konfi`-Rolle
- `Teamer*` → Nur für `teamer`-Rolle

## Where to Add New Code

**Neuer Backend-Endpunkt:**
- Neue Route in passendem File in `backend/routes/` oder neue Datei nach gleichem Muster
- Middleware: `verifyTokenRBAC(db)` + `requireAdmin`/`requireTeamer` aus `backend/middleware/rbac.js`
- Route in `backend/server.js` mounten: `app.use('/api/PFAD', ROUTES(db, rbacVerifier, roleHelpers))`

**Neue Frontend-Page (Tab-Ziel):**
- Implementation: `frontend/src/components/[rolle]/pages/[Rolle][Name]Page.tsx`
- Route eintragen in `frontend/src/components/layout/MainTabs.tsx`
- Datenladen: `useOfflineQuery(cacheKey, () => api.get('/...'))`

**Neue Modal-Komponente:**
- Implementation: `frontend/src/components/[rolle]/modals/[Name]Modal.tsx`
- Aufruf: `useIonModal(NameModal, { onClose: () => dismissModal(), ... })`
- NIEMALS `<IonModal isOpen={state}>` verwenden

**Neue Unterseite (nicht Tab-Ziel):**
- Implementation: `frontend/src/components/[rolle]/views/[Name]View.tsx`

**Neuer globaler Typ:**
- `frontend/src/types/[domäne].ts`

**Neue SQL-Migration:**
- `backend/migrations/NNN_beschreibung.sql` (nächste freie Nummer)
- Migration wird beim Server-Start automatisch ausgeführt

**Geteilte UI-Komponenten:**
- `frontend/src/components/shared/` (mit Export in `index.ts`)
- Sehr generische Utility-Komponenten: `frontend/src/components/common/`

## Special Directories

**`backend/uploads/`:**
- Purpose: Datei-Uploads (requests, chat, material)
- Generated: Ja (beim Server-Start auto-erstellt)
- Committed: Nein (.gitignore)
- In Production: Volume-Mount `/opt/Konfi-Quest/uploads:/app/uploads`

**`backend/migrations/`:**
- Purpose: SQL-Schema-Änderungen
- Generated: Nein (manuell angelegt)
- Committed: Ja
- Anmerkung: Idempotent formulieren (IF NOT EXISTS etc.)

**`frontend/dist/` (nach Build):**
- Purpose: Vite-Build-Output für Nginx
- Generated: Ja
- Committed: Nein

**`.planning/`:**
- Purpose: GSD-Planungsdokumente (Milestones, Phasen, Codebase-Analysen)
- Generated: Nein
- Committed: Ja

---

*Structure analysis: 2026-03-23*
