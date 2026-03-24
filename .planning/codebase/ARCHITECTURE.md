# Architecture

**Analysis Date:** 2026-03-24

## Pattern Overview

**Overall:** Multi-Tenant SPA mit Rollen-basierter Zugriffskontrolle (RBAC) — klassischer REST+WebSocket-Monolith im Backend, Ionic-React-SPA mit Offline-First-Schicht im Frontend.

**Key Characteristics:**
- Vollständige RBAC-Hierarchie: `super_admin (5) > org_admin (4) > admin (3) > teamer (2) > konfi (1)`
- Organisation-Isolation: Alle Daten sind durch `organization_id` mandanten-isoliert
- Offline-First: SWR-Cache (`useOfflineQuery`) + persistente WriteQueue für alle schreibenden Aktionen
- Real-Time: Socket.IO für Live-Updates (Chat, Punkte, Badges, Buchungen) und Typing-Indikatoren
- Deployment: Drei Docker-Container (postgres, backend, frontend) via Portainer/GitHub Actions CI/CD

---

## Layers

**Backend — Route Layer:**
- Purpose: HTTP-Handler, Request-Validierung, Auth-Guard, DB-Queries
- Location: `backend/routes/`
- Contains: 15 Route-Dateien, jede exportiert eine Factory-Funktion `(db, rbacVerifier, roleHelpers, ...) => Router`
- Depends on: Middleware, Services, Utils, database.js
- Used by: `backend/server.js` (montiert alle Routen)

**Backend — Middleware Layer:**
- Purpose: JWT-Verifikation, RBAC-Checks, Request-Validierung, Upload-Validierung
- Location: `backend/middleware/`
- Contains: `rbac.js` (LRU-Cache, 30s TTL, 500 Einträge), `validation.js`, `uploadValidation.js`
- Depends on: `database.js` (User-Lookup)
- Used by: Alle Route-Handler

**Backend — Services Layer:**
- Purpose: Business-Logik die nicht direkt in Routes gehört
- Location: `backend/services/`
- Contains: `backgroundService.js` (Cron-Jobs via node-cron), `pushService.js` (FCM), `emailService.js` (SMTP), `losungService.js`
- Depends on: `database.js`, `push/firebase.js`
- Used by: Routes, `server.js`

**Backend — Utils Layer:**
- Purpose: Wiederverwendbare Hilfsfunktionen
- Location: `backend/utils/`
- Contains: `liveUpdate.js` (Socket.IO Emit-Wrapper), `chatUtils.js`, `bookingUtils.js`, `dateUtils.js`, `passwordUtils.js`, `pointTypeGuard.js`, `roleHierarchy.js`
- Depends on: `database.js` (lazy require in liveUpdate)
- Used by: Routes

**Backend — Database Layer:**
- Purpose: PostgreSQL-Connection-Pool und Migration-Runner
- Location: `backend/database.js`
- Contains: `pg.Pool`, `query()`, `getClient()`, `end()`, automatischer Migration-Runner beim Start
- Depends on: `backend/migrations/*.sql` (lexikografisch sortiert, idempotent via `schema_migrations`)
- Used by: Alle anderen Backend-Module

**Frontend — Context Layer:**
- Purpose: Globaler App-State (Auth, Badges, Live-Updates, Modals)
- Location: `frontend/src/contexts/`
- Contains: `AppContext.tsx` (user, online-Status, Push-Token-Verwaltung), `BadgeContext.tsx` (unread counts, WebSocket init), `LiveUpdateContext.tsx` (Socket.IO Event-Bus), `ModalContext.tsx`
- Depends on: `services/api.ts`, `services/tokenStore.ts`, `services/websocket.ts`, `services/writeQueue.ts`
- Used by: Alle Pages/Views

**Frontend — Services Layer:**
- Purpose: API-Kommunikation, Offline-Infrastruktur, Auth-Persistenz
- Location: `frontend/src/services/`
- Contains: `api.ts` (Axios + Auto-Retry + Token-Refresh-Interceptor), `auth.ts`, `tokenStore.ts` (sync Memory + async Preferences), `offlineCache.ts` (Capacitor Preferences), `writeQueue.ts` (FIFO persistent), `networkMonitor.ts`, `websocket.ts` (Socket.IO Client)
- Depends on: Capacitor Preferences API, axios
- Used by: Contexts, Hooks, Components

**Frontend — Hook Layer:**
- Purpose: Deklarative Datenabfragen mit SWR-Pattern
- Location: `frontend/src/hooks/`
- Contains: `useOfflineQuery.ts` (Cache-first, Revalidate-on-mount, Revalidate-on-reconnect), `useActionGuard.ts`, `useCountUp.ts`
- Depends on: `services/offlineCache.ts`, `services/networkMonitor.ts`
- Used by: Alle Pages/Views

**Frontend — Component Layer:**
- Purpose: UI-Komponenten, Pages, Modals, Views
- Location: `frontend/src/components/`
- Contains: Unterteilt nach Rolle (`admin/`, `konfi/`, `teamer/`, `chat/`, `wrapped/`, `shared/`, `auth/`, `common/`, `layout/`)
- Depends on: Contexts, Hooks, Services
- Used by: `App.tsx` via Router

---

## Data Flow

**Lesender Request (Online):**
1. Page nutzt `useOfflineQuery(cacheKey, () => api.get('/endpoint'))`
2. Hook prüft `offlineCache` (Capacitor Preferences) — Cache vorhanden?
3. Falls Cache frisch: Daten anzeigen, im Hintergrund Revalidierung starten (SWR)
4. `api.ts`-Axios: Hängt JWT Bearer-Token aus `tokenStore` (sync Memory) an
5. Backend: `rbacVerifier` prüft JWT, lädt User aus LRU-Cache (30s TTL) oder DB
6. Backend: Route-Handler führt PostgreSQL-Query aus, gibt JSON zurück
7. Hook: Setzt Cache, updated React-State

**Schreibender Request (Offline-tolerant):**
1. Component ruft `api.post(...)` auf oder nutzt `writeQueue.add(...)`
2. Bei Online: direkter API-Call, bei Offline: in WriteQueue (Capacitor Preferences) persistieren
3. Bei Reconnect: `websocket.ts` triggert `writeQueue.flush()` → alle queued Requests werden in FIFO-Reihenfolge abgespielt
4. Nach erfolgreichem Write: `offlineCache.invalidateAll()` markiert alle Cache-Einträge als stale
5. Backend: Route führt DB-Write aus, ruft `liveUpdate.sendToUser/Org/Jahrgang()` auf
6. Betroffene Clients empfangen `liveUpdate`-Event via Socket.IO, `LiveUpdateContext` benachrichtigt Subscriber
7. Subscriber rufen `refresh()` auf `useOfflineQuery` auf → Revalidierung

**Auth-Flow:**
1. Login: POST `/api/auth/login` → Access-Token (15 min) + Refresh-Token (90 Tage rotierend)
2. `tokenStore.ts`: Token in Memory + Capacitor Preferences persistieren
3. Bei 401: `api.ts`-Interceptor versucht Token-Refresh via `/api/auth/refresh`
4. Refresh fehlgeschlagen: `clearAuth()` + CustomEvent `auth:relogin-required`
5. `App.tsx` horcht auf Event, zeigt Re-Login-Dialog

**Chat-Flow:**
1. User tritt Chat-Raum bei: Socket-Event `joinRoom` mit `roomId`
2. Server prüft `organization_id`-Match (Org-Isolation)
3. Nachrichten via POST `/api/chat/rooms/:roomId/messages` (Rate-Limit: 30/min)
4. Server emittiert `newMessage`-Event an `room_${roomId}` Socket-Room
5. Client empfängt Event, appended Nachricht ohne API-Call

**State Management:**
- Globaler State: React Context (`AppContext`, `BadgeContext`, `LiveUpdateContext`)
- Server State: `useOfflineQuery` Hook (SWR-Pattern, kein Redux/Zustand)
- Persistenz: Capacitor Preferences (Token, Cache, WriteQueue)
- Echtzeit-Updates: Socket.IO Events → `LiveUpdateContext` Subscriber-System

---

## Key Abstractions

**`useOfflineQuery<T>(cacheKey, fetcher, options)`:**
- Purpose: Universeller SWR-Hook für alle Datenabrufe
- Examples: Alle 30 Pages nutzen diesen Hook
- Pattern: Cache-First → Background-Revalidate → Network-on-miss; gibt `{ data, loading, error, isStale, isOffline, refresh }` zurück
- Location: `frontend/src/hooks/useOfflineQuery.ts`

**`writeQueue`:**
- Purpose: Persistente FIFO-Queue für schreibende Aktionen bei Offline
- Examples: Chat-Nachrichten, Aktivitäts-Anträge, Opt-out-Buchungen
- Pattern: `writeQueue.add({ method, url, body, metadata })` → flush bei Reconnect
- Location: `frontend/src/services/writeQueue.ts`

**`liveUpdate`:**
- Purpose: Typsichere Wrapper zum Emittieren von Socket.IO-Events an User/Org/Jahrgang
- Examples: `liveUpdate.sendToKonfi(id, 'points', 'refresh')`, `liveUpdate.sendToOrg(orgId, 'events', 'create')`
- Pattern: Dependency Injection von `io` bei Server-Start via `liveUpdate.init(io)`
- Location: `backend/utils/liveUpdate.js`

**`verifyTokenRBAC(db)`:**
- Purpose: JWT-Middleware mit In-Memory LRU-Cache (30s TTL, max 500 User)
- Pattern: Factory-Funktion, gibt Express-Middleware zurück; cached User-Objekt inkl. `organization_id`
- Location: `backend/middleware/rbac.js`

**Route-Factories:**
- Purpose: Alle 15 Backend-Routen sind Factory-Funktionen, nicht direkte Module
- Pattern: `module.exports = (db, rbacVerifier, roleHelpers, ...) => Router`
- Examples: `backend/routes/activities.js`, `backend/routes/chat.js`, alle anderen Routen

**`tokenStore`:**
- Purpose: Sync Memory-Getter + async Capacitor-Preferences-Setter für Auth-Tokens
- Pattern: In-Memory-Cache mit Capacitor Preferences als Persistenz-Backend; `initTokenStore()` lädt beim App-Start
- Location: `frontend/src/services/tokenStore.ts`

---

## Entry Points

**Backend — `backend/server.js`:**
- Location: `backend/server.js`
- Triggers: `node server.js` (npm start), Docker-Container-Start
- Responsibilities: Express-App, Socket.IO-Server, Rate-Limiter, Multer-Konfiguration, Route-Mounting, Background-Services starten, Graceful Shutdown

**Frontend — `frontend/src/main.tsx`:**
- Location: `frontend/src/main.tsx`
- Triggers: Vite Dev-Server, Browser-Aufruf der App
- Responsibilities: React-Hydration, Capacitor-Plugin-Initialisierung

**Frontend — `frontend/src/App.tsx`:**
- Location: `frontend/src/App.tsx`
- Triggers: main.tsx
- Responsibilities: Context-Provider-Baum (`AppProvider > BadgeProvider > LiveUpdateProvider > ErrorBoundary`), Auth-Guard (Login-Route vs. MainTabs), Push-Notification-Listener, Rate-Limit-Alert-Handler

**Frontend — `frontend/src/components/layout/MainTabs.tsx`:**
- Location: `frontend/src/components/layout/MainTabs.tsx`
- Triggers: App.tsx (bei eingeloggtem User)
- Responsibilities: Rollen-basiertes Routing — rendert Admin-Tabs, Teamer-Tabs, Konfi-Tabs oder Super-Admin-View je nach `user.type` und `user.role_name`

---

## Error Handling

**Strategy:** Fehler werden in mehreren Schichten abgefangen und nicht weiterpropagiert.

**Backend-Patterns:**
- Globaler Express-Error-Handler in `server.js` (500 JSON-Response)
- Route-Handler nutzen try/catch und geben strukturierte JSON-Fehler zurück
- Input-Validierung via `express-validator` + `handleValidationErrors`-Middleware (`backend/middleware/validation.js`)

**Frontend-Patterns:**
- `ErrorBoundary` in `frontend/src/components/common/ErrorBoundary.tsx` umschließt gesamte App
- `api.ts`-Interceptor handelt 401 (Token-Refresh oder Re-Login), 429 (Rate-Limit-Alert via CustomEvent)
- `useOfflineQuery`: Bei Fetch-Fehler mit vorhandenem Cache → `isStale=true` statt Error-State
- `writeQueue`: Fehlgeschlagene Requests werden nach maxRetries in `failedItems` überführt

---

## Cross-Cutting Concerns

**Logging:** `console.log/warn/error` direkt, kein strukturiertes Logging-Framework. Server-Start gibt strukturierte ASCII-Übersicht aus.

**Validierung:**
- Backend: `express-validator` (body, param) + eigene `handleValidationErrors`-Middleware in `backend/middleware/validation.js`
- Frontend: Inline-Validierung in Formularen

**Authentication:** JWT Bearer-Token, Access 15 min + Refresh 90 Tage rotierend. Soft-Revoke bei Rollen-Änderung via Socket-Disconnect.

**Organisation-Isolation:** Jeder DB-Query filtert nach `organization_id` aus dem JWT-Payload (via `rbacVerifier`). Socket.IO prüft ebenfalls `organization_id` bei `joinRoom`.

**File-Upload-Sicherheit:** Keine statisch erreichbaren Upload-Pfade — alle Dateien werden durch authentifizierte Endpunkte ausgeliefert. Hashed Filenames via SHA-256.

---

*Architecture analysis: 2026-03-24*
