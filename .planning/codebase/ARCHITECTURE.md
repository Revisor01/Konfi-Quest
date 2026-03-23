# Architecture

**Analysis Date:** 2026-03-23

## Pattern Overview

**Overall:** Monorepo mit getrenntem Backend (REST-API + WebSocket) und Frontend (SPA/Hybrid-App)

**Key Characteristics:**
- Backend: Node.js Express REST-API mit Socket.IO für Echtzeit-Kommunikation
- Frontend: React 19 + Ionic 8 als Capacitor-App (iOS/Android/Web) mit Offline-First-Architektur
- Datenhaltung: PostgreSQL mit migrationsbasiertem Schema-Lifecycle
- RBAC: Rollenbasierte Zugriffskontrolle mit 5 Stufen (super_admin → konfi)
- Multi-Tenancy: Vollständige Organisation-Isolation auf allen Schichten

## Layers

**API Layer (Backend):**
- Purpose: REST-Endpunkte pro Domain, JWT-Auth, Rate-Limiting, File-Uploads
- Location: `backend/routes/`
- Contains: 15 Router-Module, jedes als Factory-Funktion `(db, rbacVerifier, roleHelpers) => Router`
- Depends on: `backend/database.js`, `backend/middleware/rbac.js`
- Used by: Frontend via Axios, mobile App via Capacitor

**Middleware Layer (Backend):**
- Purpose: JWT-Verifikation, RBAC-Prüfung, Input-Validierung
- Location: `backend/middleware/`
- Contains: `rbac.js` (verifyTokenRBAC, requireSuperAdmin, requireOrgAdmin, requireAdmin, requireTeamer), `validation.js` (express-validator wrapper)
- Depends on: `backend/database.js` (DB-Lookup bei jeder Anfrage)
- Used by: Alle Routes via Dependency Injection

**Database Layer (Backend):**
- Purpose: PostgreSQL-Verbindungspool, automatische Migrationen beim Start
- Location: `backend/database.js`, `backend/migrations/*.sql`
- Contains: pg-Pool, `runMigrations()` scannt `migrations/` alphabetisch, `schema_migrations` Tracking-Tabelle
- Depends on: `DATABASE_URL` Umgebungsvariable
- Used by: Alle Routes, Services, Middleware

**Services Layer (Backend):**
- Purpose: Hintergrundprozesse, Push-Notifications, E-Mail, externe APIs
- Location: `backend/services/`
- Contains: `backgroundService.js` (Cron-Jobs via node-cron), `pushService.js` (Firebase FCM), `emailService.js` (Nodemailer), `losungService.js` (externe Losungen-API)
- Depends on: `backend/database.js`, `backend/push/firebase.js`
- Used by: `backend/server.js` beim Start

**Utils Layer (Backend):**
- Purpose: Querschnittsfunktionen ohne eigene Datenbankverbindung
- Location: `backend/utils/`
- Contains: `liveUpdate.js` (Socket.IO-Wrapper), `chatUtils.js`, `dateUtils.js`, `passwordUtils.js`, `roleHierarchy.js`, `pointTypeGuard.js`
- Depends on: Socket.IO-Instanz (via `liveUpdate.init(io)`)
- Used by: Routes und Services

**Context Layer (Frontend):**
- Purpose: Globaler App-Zustand, Authentication, Echtzeit-Updates, Badge-Counts
- Location: `frontend/src/contexts/`
- Contains: `AppContext.tsx` (User, Auth, Push-Token-Management), `BadgeContext.tsx` (Unread-Counts + Socket-Integration), `LiveUpdateContext.tsx` (WebSocket-Event-Bus), `ModalContext.tsx`
- Depends on: `frontend/src/services/`
- Used by: Alle Komponenten über Hooks (`useApp`, `useBadge`, `useLiveRefresh`)

**Services Layer (Frontend):**
- Purpose: HTTP-Client, Token-Persistenz, Offline-Infrastruktur
- Location: `frontend/src/services/`
- Contains: `api.ts` (Axios + axiosRetry + Token-Refresh-Interceptor), `tokenStore.ts` (sync Memory-Getter + async Preferences-Setter), `offlineCache.ts` (SWR-Cache), `writeQueue.ts` (FIFO-Persistenz für Offline-Schreibvorgänge), `networkMonitor.ts`, `websocket.ts`
- Depends on: `@capacitor/preferences` für Persistenz
- Used by: Contexts, Hooks, Komponenten

**Hooks Layer (Frontend):**
- Purpose: Wiederverwendbare Datenabruf-Logik mit Offline-Support
- Location: `frontend/src/hooks/`
- Contains: `useOfflineQuery.ts` (SWR-Pattern: Cache zuerst, dann Netzwerk), `useActionGuard.ts`, `useCountUp.ts`
- Depends on: `services/offlineCache.ts`, `services/networkMonitor.ts`
- Used by: Alle Page-Komponenten

**Components Layer (Frontend):**
- Purpose: UI nach Rolle und Funktion organisiert
- Location: `frontend/src/components/`
- Contains: `admin/`, `konfi/`, `teamer/`, `chat/`, `auth/`, `common/`, `shared/`, `wrapped/`, `layout/`
- Depends on: Contexts, Hooks, Services
- Used by: `MainTabs.tsx` als Router-Ziel

## Data Flow

**Read-Flow (Normalfall online):**

1. Page-Komponente ruft `useOfflineQuery(cacheKey, fetcher)` auf
2. Hook prüft `offlineCache` → bei Cache-Hit wird sofort gerendert
3. Im Hintergrund wird `api.get(...)` ausgeführt (SWR-Revalidierung)
4. `api.ts`-Interceptor hängt JWT aus `tokenStore.getToken()` an
5. Backend-Route prüft Token via `verifyTokenRBAC` (DB-Lookup)
6. Route liest aus PostgreSQL via `db.query()`
7. Antwort wird in `offlineCache` geschrieben, Komponente re-rendert

**Write-Flow (online):**

1. Komponente ruft `api.post/put/delete(...)` direkt auf
2. Backend ändert Datenbankzustand
3. Backend ruft `liveUpdate.sendToUser/sendToOrg(...)` auf
4. Socket.IO emittiert `liveUpdate`-Event an betroffene User
5. `LiveUpdateContext` empfängt Event und benachrichtigt Subscriber
6. Subscriber-Page ruft `refresh()` von `useOfflineQuery` auf

**Write-Flow (offline, WriteQueue):**

1. Komponente erstellt `QueueItem` und ruft `writeQueue.enqueue(item)` auf
2. Item wird in `@capacitor/preferences` persistiert
3. Bei `networkMonitor`-Event `online` wird `writeQueue.flush()` ausgeführt
4. Fehlgeschlagene Items bleiben in Queue (FIFO, max Retries)

**Auth-Flow:**

1. Login → Backend gibt `accessToken` (15min) + `refreshToken` (90d rotierend)
2. `tokenStore` speichert beides in Memory + `@capacitor/preferences`
3. Bei 401: `api.ts`-Interceptor versucht Token-Refresh via `/auth/refresh`
4. Rotation: Neues Refresh-Token ersetzt altes (Soft-Revoke via `token_invalidated_at`)
5. Fehlgeschlagener Refresh → `auth:relogin-required` Window-Event → Login-Dialog

**State Management:**

- Globaler User-State: `AppContext` (user, loading, isOnline)
- Badge-Counts: `BadgeContext` (chatUnreadByRoom, pendingRequestsCount, pendingEventsCount)
- Server-Push: `LiveUpdateContext` als pub/sub Event-Bus über WebSocket
- Lokaler Daten-State: `useOfflineQuery` pro Page/View
- Persistenz: `tokenStore` + `offlineCache` + `writeQueue` via `@capacitor/preferences`

## Key Abstractions

**RBAC Middleware (`verifyTokenRBAC`):**
- Purpose: JWT prüfen + User aus DB laden + Jahrgang-Zuweisungen laden + `req.user` befüllen
- Examples: `backend/middleware/rbac.js`
- Pattern: Factory-Funktion `verifyTokenRBAC(db)` → Middleware-Funktion; alle Routes nutzen via Dependency Injection

**Route-Factory:**
- Purpose: Routes erhalten `db`, `rbacVerifier`, `roleHelpers` als Parameter statt global
- Examples: `backend/routes/konfi.js`, `backend/routes/activities.js`
- Pattern: `module.exports = (db, rbacVerifier, roleHelpers) => { const router = express.Router(); ...; return router; }`

**useOfflineQuery Hook:**
- Purpose: SWR-Datenabruf mit Offline-Fallback, Race-Condition-Schutz, TTL-Cache
- Examples: `frontend/src/hooks/useOfflineQuery.ts`
- Pattern: `useOfflineQuery<T>(cacheKey, fetcher, options)` → `{ data, loading, error, isStale, isOffline, refresh }`

**Page/View/Modal Trennung:**
- Purpose: Pages halten Datenabruf-Logik; Views rendern UI aus Props; Modals via `useIonModal`
- Examples: `frontend/src/components/konfi/pages/KonfiDashboardPage.tsx`, `frontend/src/components/konfi/views/DashboardView.tsx`
- Pattern: Page = `useOfflineQuery` + Handler + `<View data={data} />`; View = reine Darstellung

**liveUpdate Modul:**
- Purpose: Typisierte Socket.IO-Events von beliebigen Backend-Modulen absenden
- Examples: `backend/utils/liveUpdate.js`
- Pattern: Singleton mit `init(io)`, dann `sendToKonfi(id, type, action)` / `sendToOrg(orgId, type, action)` etc.

## Entry Points

**Backend:**
- Location: `backend/server.js`
- Triggers: `node server.js` oder Docker-Container-Start
- Responsibilities: Express-App erstellen, Socket.IO binden, Middleware registrieren, alle 15 Routes mounten, Background-Services starten, Graceful-Shutdown registrieren

**Frontend:**
- Location: `frontend/src/main.tsx`
- Triggers: Vite-Dev-Server oder Capacitor-App-Start
- Responsibilities: React-Root rendern mit `<App />`

**App-Shell:**
- Location: `frontend/src/App.tsx`
- Triggers: Geladen von `main.tsx`
- Responsibilities: Context-Provider stacken (AppProvider → BadgeProvider → LiveUpdateProvider → ErrorBoundary), Auth-Guard (Login/App trennen), Push-Listener registrieren, `<MainTabs>` mounten

**Routing:**
- Location: `frontend/src/components/layout/MainTabs.tsx`
- Triggers: User ist eingeloggt
- Responsibilities: `user.type` und `role_name` bestimmen welcher Tab-Set gerendert wird (super_admin / admin / teamer / konfi); alle Routen pro Rolle definieren

## Error Handling

**Strategy:** Fehler werden so früh wie möglich abgefangen; Backend antwortet mit strukturierten `{ error: string }`-Objekten; Frontend unterscheidet Offline-Fehler von echten API-Fehlern

**Patterns:**
- Backend: Try/catch in jedem Route-Handler; globaler Express-Fehler-Handler in `server.js` für 500er
- Frontend API: `api.ts` Interceptor fängt 401 (Token-Refresh), 429 (Rate-Limit-Event) ab; `axiosRetry` für 5xx und Netzwerkfehler
- Frontend Offline: `useOfflineQuery` zeigt Cached-Data mit `isStale=true` statt Fehler; echte Fehler nur wenn kein Cache vorhanden
- Frontend App: `ErrorBoundary` in `App.tsx` als letzter Fallback

## Cross-Cutting Concerns

**Logging:** `console.log/warn/error` direkt, kein Log-Framework; Server-Start gibt strukturierten Status-Block aus
**Validation:** `express-validator` in Routes via `handleValidationErrors` aus `backend/middleware/validation.js`
**Authentication:** JWT Bearer Token in `Authorization`-Header; Socket.IO prüft Token in `handshake.auth.token`
**Multi-Tenancy:** `organization_id` auf `req.user` (gesetzt von RBAC-Middleware); alle Queries filtern danach; `rbac.js` prüft Organisation-Isolation auch für Socket.IO-Rooms

---

*Architecture analysis: 2026-03-23*
