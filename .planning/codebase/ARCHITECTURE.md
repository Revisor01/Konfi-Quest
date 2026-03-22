# Architecture

**Analysis Date:** 2026-03-22

## Pattern Overview

**Overall:** Role-Based Multi-Tenant SPA mit Offline-First Client

**Key Characteristics:**
- Multi-Tenant: Jede Organisation (Kirchengemeinde) ist isoliert via `organization_id`
- RBAC: 5 Rollen (super_admin, org_admin, admin, teamer, konfi) mit hartem Role-Check auf jedem Route-Handler
- Offline-First: SWR-Cache (Capacitor Preferences) + FIFO WriteQueue für Offline-Aktionen
- Realtime: Socket.IO WebSocket für Live-Updates (Punkte, Chat, Buchungen)
- Hybrid-App: Ionic + Capacitor Native (iOS/Android) + Web (PWA)

## Layers

**Backend: Express Routes:**
- Purpose: HTTP REST API + WebSocket-Server
- Location: `backend/routes/`
- Contains: 18 Route-Dateien (eine pro Domäne)
- Depends on: PostgreSQL `db`-Objekt, `rbacMiddleware`, `pushService`
- Used by: Frontend via `https://konfi-quest.de/api`

**Backend: Middleware:**
- Purpose: Auth-Guard und Input-Validierung
- Location: `backend/middleware/`
- Contains: `rbac.js` (JWT-Verifikation + User-Load aus DB), `validation.js` (express-validator Helpers)
- Used by: Alle Route-Handler als `verifyTokenRBAC` Middleware

**Backend: Services:**
- Purpose: Side-Effect-Logik (Push, E-Mail, Background-Jobs)
- Location: `backend/services/`
- Contains: `pushService.js`, `emailService.js`, `backgroundService.js`
- Used by: Route-Handler nach Zustandsänderungen

**Backend: Utils:**
- Purpose: Zustandslose Hilfsfunktionen
- Location: `backend/utils/`
- Contains: `liveUpdate.js` (Socket.IO Emit), `chatUtils.js`, `dateUtils.js`, `passwordUtils.js`, `pointTypeGuard.js`, `roleHierarchy.js`
- Used by: Route-Handler und Services

**Frontend: Context Layer:**
- Purpose: Globaler App-State
- Location: `frontend/src/contexts/`
- Contains: `AppContext.tsx` (User, Online-Status, Push), `BadgeContext.tsx` (Unread-Counts), `LiveUpdateContext.tsx` (WebSocket-Events), `ModalContext.tsx`
- Depends on: `tokenStore.ts`, `api.ts`, `websocket.ts`

**Frontend: Services Layer:**
- Purpose: Persistenz, Netzwerk, Offline-Infrastruktur
- Location: `frontend/src/services/`
- Contains: `api.ts` (Axios mit JWT-Interceptor + Refresh), `tokenStore.ts` (Memory + Preferences), `offlineCache.ts` (SWR-Cache), `writeQueue.ts` (Offline-FIFO), `networkMonitor.ts` (Singleton), `websocket.ts` (Socket.IO Client)

**Frontend: Hooks:**
- Purpose: Datenlade-Pattern für Komponenten
- Location: `frontend/src/hooks/`
- Contains: `useOfflineQuery.ts` (SWR-Pattern für alle Seiten), `useActionGuard.ts`, `useCountUp.ts`
- Used by: Alle Pages und Views

**Frontend: Components:**
- Purpose: UI-Schicht, nach Rolle segmentiert
- Location: `frontend/src/components/`
- Segmente: `admin/`, `konfi/`, `teamer/`, `chat/`, `wrapped/`, `auth/`, `common/`, `layout/`, `shared/`
- Pattern: Pro Segment: `pages/` (Container), `views/` (Render-Logik), `modals/` (Dialoge)

## Data Flow

**HTTP Request-Flow:**

1. Komponente ruft `api.get/post(...)` über `frontend/src/services/api.ts`
2. Axios-Interceptor liest Access-Token synchron aus `tokenStore.ts` (Memory-Cache)
3. Request geht an `https://konfi-quest.de/api/[route]`
4. `verifyTokenRBAC`-Middleware in `backend/middleware/rbac.js` verifiziert JWT, lädt User aus DB
5. Route-Handler prüft `req.user.type` und `req.user.role_name` für Berechtigung
6. DB-Query via `pg`-Pool, Response als JSON
7. Bei 401: Axios-Interceptor triggert Token-Refresh via `/auth/refresh`, wiederholt Request

**Offline-Write-Flow:**

1. Konfi oder Teamer triggert Aktion (z.B. Aktivitäts-Antrag)
2. `useActionGuard.ts` prüft `networkMonitor.isOnline`
3. Online: direktes `api.post(...)` — Offline: `writeQueue.enqueue({method, url, body})`
4. Bei Reconnect: `websocket.ts` flusht WriteQueue automatisch (`writeQueue.flush()`)
5. Nach Flush: `offlineCache.invalidateAll()` markiert alle Cache-Einträge als stale
6. `useOfflineQuery` revalidiert automatisch

**Realtime-Update-Flow:**

1. Backend-Route führt Änderung durch (z.B. Admin vergibt Punkte)
2. Route-Handler ruft `liveUpdate.sendToKonfi(konfiId, 'dashboard', 'refresh')`
3. `backend/utils/liveUpdate.js` emittiert `liveUpdate`-Event via `global.io` Socket.IO
4. Client empfängt Event in `LiveUpdateContext.tsx`
5. Subscribed Pages rufen `refresh()` aus `useOfflineQuery` auf

**State Management:**

- Globaler Auth-State: `AppContext` (User, Online, Push-Permission)
- Badge/Unread-Counts: `BadgeContext` (Chat, Anträge, Events)
- Live-Updates: `LiveUpdateContext` (WebSocket-Event-Bus)
- Seitenspezifische Daten: `useOfflineQuery` pro Page (kein globaler Query-Cache außer localStorage)

## Key Abstractions

**verifyTokenRBAC:**
- Purpose: Auth-Guard für alle Backend-Routes
- Location: `backend/middleware/rbac.js`
- Pattern: Factory-Funktion `(db) => middleware`, gibt `req.user` mit Role-Infos, verhindert Token-Reuse nach Invalidierung

**useOfflineQuery:**
- Purpose: SWR-Pattern für alle Datenladeoperationen
- Location: `frontend/src/hooks/useOfflineQuery.ts`
- Pattern: `useOfflineQuery<T>(cacheKey, fetcher, options)` — lädt aus Cache, revalidiert im Hintergrund, reagiert auf Online-Wechsel

**offlineCache:**
- Purpose: Persistenter Read-Cache (Capacitor Preferences)
- Location: `frontend/src/services/offlineCache.ts`
- Pattern: TTL-basiert, `CACHE_TTL`-Konstanten pro Domäne (5 Min bis 24 Std)

**writeQueue:**
- Purpose: FIFO-Queue für Offline-Writes
- Location: `frontend/src/services/writeQueue.ts`
- Pattern: Persistiert in Capacitor Preferences, flush bei Reconnect, Metadaten-Typen: `chat | request | opt-out | fire-and-forget | admin | teamer`

**tokenStore:**
- Purpose: Auth-Token-Management mit synchronem Read
- Location: `frontend/src/services/tokenStore.ts`
- Pattern: Memory-Cache für synchrone Getter (`getToken()`), async Setter schreiben zusätzlich in Preferences

**liveUpdate:**
- Purpose: WebSocket-Broadcast-Helper für Backend-Routes
- Location: `backend/utils/liveUpdate.js`
- Pattern: `sendToKonfi(id, type, action)`, `sendToOrgAdmins(orgId, type)`, `sendToOrg(orgId, type)` — nutzt `global.io`

## Entry Points

**Backend Server:**
- Location: `backend/` (package.json main)
- Triggers: `node server.js` / Docker
- Responsibilities: Express-Server aufbauen, alle 18 Routes mounten, Socket.IO initialisieren, BackgroundService starten, PostgreSQL-Pool öffnen

**Frontend App:**
- Location: `frontend/src/App.tsx`
- Triggers: Browser/Capacitor-Start
- Responsibilities: Context-Provider-Stack aufbauen (`AppProvider` > `LiveUpdateProvider` > `BadgeProvider`), Auth-Routing, `setupIonicReact` mit Plattform-Animationen, `MainTabs.tsx` laden

**Navigation Hub:**
- Location: `frontend/src/components/layout/MainTabs.tsx`
- Triggers: Eingeloggter User in `AppContext`
- Responsibilities: Rollenbasiertes Routing — Admin/Teamer/Konfi/SuperAdmin bekommen unterschiedliche Tab-Bars und Routen-Trees

## Error Handling

**Strategy:** Defensiv, mit Fallback auf gecachte Daten

**Patterns:**
- Backend: Express-Try-Catch in allen Route-Handlern, 500-Response mit `error: string`
- Frontend-Netzwerk: `useOfflineQuery` behält Stale-Daten bei Fehlern, setzt `isStale: true` statt zu leeren
- Frontend-Auth: Axios-Interceptor für 401 — Token-Refresh-Versuch, dann `auth:relogin-required` Custom-Event
- Frontend-Push: Retry mit exponentiellem Backoff (5s, 15s, 30s), danach Retry bei Reconnect
- Globale 429-Alerts: `App.tsx` lauscht auf `rate-limit` Window-Event, zeigt `useIonAlert`
- ErrorBoundary: `frontend/src/components/common/ErrorBoundary.tsx`

## Cross-Cutting Concerns

**Logging:** `console.error/warn` direkt in Route-Handlern und Services, kein strukturiertes Logging-Framework

**Validation:** `express-validator` im Backend (`backend/middleware/validation.js`), TypeScript-Typen im Frontend (`frontend/src/types/`)

**Authentication:** JWT Access-Token (15 Min) + Refresh-Token (90 Tage, rotierend) — `backend/middleware/rbac.js`, `frontend/src/services/api.ts`

**Multi-Tenancy:** `organization_id` auf allen relevanten DB-Queries, in `verifyTokenRBAC` aus DB geladen und in `req.user` verfügbar

**Push Notifications:** FCM via `@capacitor-community/fcm`, Token in `device_tokens`-Tabelle, `backend/services/pushService.js`

---

*Architecture analysis: 2026-03-22*
