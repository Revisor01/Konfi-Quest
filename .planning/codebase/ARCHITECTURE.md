# Architecture

**Analysis Date:** 2026-03-23

## Pattern Overview

**Overall:** Multi-Tenant SPA + REST API mit Offline-First Client

**Key Characteristics:**
- Klare Frontend/Backend-Trennung mit JWT-basierter Auth
- RBAC (Role-Based Access Control) auf Backend-Ebene mit 5 Rollen
- Offline-First Frontend: SWR-Pattern (useOfflineQuery), WriteQueue, offlineCache
- Real-Time via Socket.IO (Chat, Live-Updates)
- Multi-Tenant: Alle Daten sind an `organization_id` gebunden

## Layers

**Backend - Express API (`backend/`):**
- Purpose: REST API + WebSocket-Server, alle Geschäftslogik und DB-Zugriff
- Location: `backend/server.js` (Einstiegspunkt), `backend/routes/` (18 Router)
- Contains: Express-Router, RBAC-Middleware, PostgreSQL-Queries, Push/Email-Services
- Depends on: PostgreSQL via `backend/database.js`, Firebase für Push
- Used by: Frontend (HTTP + WebSocket)

**Backend - Middleware (`backend/middleware/`):**
- Purpose: Auth-Prüfung und Zugriffskontrolle
- Location: `backend/middleware/rbac.js`, `backend/middleware/validation.js`
- Contains: `verifyTokenRBAC` (JWT + DB-Lookup), `requireRole`, `checkJahrgangAccess`, `filterByJahrgangAccess`
- Depends on: PostgreSQL (JWT-Payload wird gegen DB verifiziert)
- Used by: Alle geschützten Routes

**Backend - Services (`backend/services/`):**
- Purpose: Seiteneffekte und Background-Jobs
- Location: `backend/services/backgroundService.js`, `backend/services/pushService.js`, `backend/services/emailService.js`
- Contains: Cron-Jobs (Badge-Updates, Event-Reminder, Wrapped-Auslösung), Firebase-Push, Nodemailer-E-Mail
- Depends on: DB, Firebase-SDK
- Used by: `server.js` (Start), Routes (direkte Push-Trigger)

**Frontend - Contexts (`frontend/src/contexts/`):**
- Purpose: Globaler State
- Location: `frontend/src/contexts/AppContext.tsx` (User/Auth/Netzwerk), `frontend/src/contexts/BadgeContext.tsx` (Unread-Counts), `frontend/src/contexts/LiveUpdateContext.tsx` (Socket-Events), `frontend/src/contexts/ModalContext.tsx`
- Contains: User-Objekt, Online-Status, Push-Token-Registrierung, Chat-Unread-Counts, Admin-Badge-Counts
- Depends on: `tokenStore`, `api`, `websocket`, `writeQueue`, `offlineCache`
- Used by: Alle Pages und Views

**Frontend - Services (`frontend/src/services/`):**
- Purpose: Infrastruktur-Schicht (Netzwerk, Cache, Token)
- Location: `frontend/src/services/`
- Contains: `api.ts` (Axios + Interceptoren), `tokenStore.ts` (Memory-Cache + Preferences), `offlineCache.ts` (Preferences-basierter TTL-Cache), `writeQueue.ts` (FIFO Offline-Queue), `networkMonitor.ts`, `websocket.ts`
- Depends on: Capacitor Preferences, Socket.IO-Client, Axios
- Used by: Contexts, Hooks

**Frontend - Pages/Views (`frontend/src/components/`):**
- Purpose: UI-Darstellung, rollenbasiert aufgeteilt
- Location: `frontend/src/components/admin/`, `frontend/src/components/konfi/`, `frontend/src/components/teamer/`, `frontend/src/components/chat/`
- Contains: Pages (Tab-Ziele), Views (Unterseiten), Modals (useIonModal)
- Depends on: Contexts, Hooks, Services
- Used by: Router in `frontend/src/components/layout/MainTabs.tsx`

## Data Flow

**Lese-Anfrage (Offline-First SWR):**

1. Page/View ruft `useOfflineQuery(cacheKey, fetcher)` auf
2. `offlineCache.get(key)` lädt gecachte Daten aus Capacitor Preferences
3. Falls Cache vorhanden: Daten sofort anzeigen, im Hintergrund revalidieren
4. `fetcher()` ruft `api.get(...)` auf (Axios, mit Bearer-Token aus `tokenStore`)
5. Antwort landet in Cache, UI wird mit frischen Daten aktualisiert
6. Bei Offline: gecachte Daten bleiben, `isStale=true` wird gesetzt

**Schreib-Anfrage (Online):**

1. Komponente ruft `api.post/put/delete(...)` direkt auf
2. Axios-Interceptor fügt Bearer-Token aus `tokenStore` (Memory) hinzu
3. Bei 401: Token-Refresh via `/api/auth/refresh`, Original-Request wird wiederholt
4. Backend: `verifyTokenRBAC` prüft JWT + lädt User aus DB (inkl. Jahrgangs-Zuweisungen)
5. `requireRole`/`requireAdmin` etc. prüft Rolle
6. Route-Handler führt Geschäftslogik aus, schreibt in PostgreSQL
7. Bei Punktevergabe: `checkAndAwardBadges` wird aufgerufen
8. Socket.IO-Event an betroffene User-Rooms

**Schreib-Anfrage (Offline):**

1. Komponente enqueued Item via `writeQueue.enqueue({method, url, body})`
2. Item wird in Capacitor Preferences persistiert
3. Bei Reconnect: `websocket.ts` triggert `writeQueue.flush()` → HTTP-Requests nachgeholt
4. Socket.IO `sync:reconnect` Event invalidiert offlineCache → Revalidierung

**Auth-Flow:**

1. `main.tsx`: `initTokenStore()` lädt Token+User aus Preferences in Memory
2. `AppContext`: Prüft `getUser()` aus tokenStore → bestimmt `user`-State
3. Login: POST `/api/auth/login` → JWT (15 Min) + Refresh-Token (90d) → `setToken` + `setRefreshToken`
4. `App.tsx`: Wenn `user === null` → Auth-Routen, sonst → MainTabs
5. `MainTabs.tsx`: Rendert Admin/Teamer/Konfi-Tabs basierend auf `user.type`

**Real-Time (Socket.IO):**

1. `BadgeContext` initialisiert WebSocket via `initializeWebSocket(token)`
2. Socket verbindet zu `https://konfi-quest.de` (Socket.IO)
3. Server: JWT-Authentifizierung, User tritt `user_[type]_[id]` Room bei
4. Chat-Räume: Client sendet `joinRoom(roomId)`, Server prüft Org-Isolation
5. Backend-Events (z.B. neue Badge): `global.io.to(userRoom).emit('live_update', event)`
6. `LiveUpdateContext` verteilt Events an abonnierte Components

## Key Abstractions

**verifyTokenRBAC (`backend/middleware/rbac.js`):**
- Purpose: Einziges Auth-Gate für alle geschützten Endpoints
- Pattern: JWT verifizieren + User aus DB laden (inkl. Org, Rolle, Jahrgänge)
- Setzt `req.user` mit: `id`, `organization_id`, `role_name`, `type`, `assigned_jahrgaenge`

**useOfflineQuery (`frontend/src/hooks/useOfflineQuery.ts`):**
- Purpose: Universelles SWR-Hook für alle Datenlese-Operationen
- Pattern: Cache-First + Background-Revalidierung, Network-Listener, Race-Condition-Schutz
- Verwendet auf allen ~30 Pages/Views

**tokenStore (`frontend/src/services/tokenStore.ts`):**
- Purpose: Sync-fähiger Token-Speicher (Memory-Cache + async Preferences)
- Pattern: Synchrone Getter für Axios-Interceptor, async Setter für Persistenz
- Enthält: Access-Token, Refresh-Token, User, Device-ID, Push-Token-Timestamp

**writeQueue (`frontend/src/services/writeQueue.ts`):**
- Purpose: FIFO-Queue für Offline-Aktionen
- Pattern: Persistiert in Preferences, wird bei Reconnect geflusht
- Typen: `chat`, `request`, `opt-out`, `fire-and-forget`, `admin`, `teamer`

**offlineCache (`frontend/src/services/offlineCache.ts`):**
- Purpose: TTL-basierter Lese-Cache
- Pattern: Preferences-backed, definierte TTLs pro Datentyp (DASHBOARD: 5min, TAGESLOSUNG: 24h)
- Wird bei Socket-Reconnect komplett invalidiert

**checkAndAwardBadges (in `backend/routes/badges.js`):**
- Purpose: Automatische Badge-Vergabe nach Aktivität/Bonus/Event
- Pattern: Wird von `activities`, `konfi-management`, `events` importiert und nach Punkteänderung aufgerufen

## Entry Points

**Backend:**
- Location: `backend/server.js`
- Triggers: `node server.js` (Docker: npm start)
- Responsibilities: Express-Setup, Socket.IO-Init, Middleware-Kette, Route-Mounting, Background-Services starten

**Frontend:**
- Location: `frontend/src/main.tsx`
- Triggers: Vite-Build, Ionic Capacitor
- Responsibilities: Storage-Migration, Token-Store-Init, React-Root rendern

**Router (Frontend):**
- Location: `frontend/src/App.tsx` (Auth-Check) → `frontend/src/components/layout/MainTabs.tsx` (Rollenbasiertes Routing)
- Pattern: `user.type === 'admin'` → Admin-Tabs, `'teamer'` → Teamer-Tabs, `'konfi'` → Konfi-Tabs, `is_super_admin` → Nur Organisations-View ohne TabBar

## Error Handling

**Strategy:** Zentrale Interceptoren im Axios-Client + lokale UI-Anzeige

**Patterns:**
- 401 → Token-Refresh-Versuch → bei Fehler: `auth:relogin-required` CustomEvent → Alert-Dialog in `App.tsx`
- 429 → `rate-limit` CustomEvent → generischer Alert in `App.tsx`
- Offline + 401 → Token behalten, gecachte Daten nutzen (kein Re-Login)
- `useOfflineQuery`: Bei Fetch-Fehler mit vorhandenem Cache → `isStale=true`, keine Fehlermeldung
- Backend: Globaler Express-Error-Handler (`500 Something went wrong!`), Validierungsfehler über `express-validator`
- Frontend: `ErrorBoundary` in `App.tsx` wrappen für unerwartete Render-Fehler

## Cross-Cutting Concerns

**Logging:** `console.error/warn/log` direkt, kein strukturiertes Logging-Framework
**Validation:** Backend: `express-validator` in `backend/middleware/validation.js`; Frontend: Inline in Formularen
**Authentication:** JWT (15 min Access) + Refresh-Token (90d, rotierend, SHA-256-gehasht in DB), Soft-Revoke über `token_invalidated_at`
**Multi-Tenancy:** `organization_id` auf allen Queries, Org-Isolation in RBAC-Middleware und Socket.IO-Handler
**Push-Notifications:** Firebase FCM über `backend/push/firebase.js` und `backend/services/pushService.js`, Device-Tokens in `push_tokens` Tabelle

---

*Architecture analysis: 2026-03-23*
