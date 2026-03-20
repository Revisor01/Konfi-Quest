# Architecture

**Analysis Date:** 2026-03-20

## Pattern Overview

**Overall:** Multi-Tenant REST API + SPA mit rollenbasierter Zugriffskontrolle (RBAC)

**Key Characteristics:**
- Klare Trennung: Node.js/Express-Backend (API) + React/Ionic-Frontend (SPA) als separate Docker-Container
- Multi-Tenancy durch `organization_id` auf allen Tabellen — jede Kirchengemeinde ist eine eigene Organisation
- 5-stufige Rollenhierarchie (`super_admin` → `org_admin` → `admin` → `teamer` → `konfi`) mit hartem Enforcement in Middleware
- Realtime-Kommunikation via Socket.io (Chat, Live-Updates) + Firebase FCM (Push Notifications)
- Jahrgangs-basierte Datenisolation für Teamer (sehen nur zugewiesene Jahrgänge)

---

## Layers

**API-Layer (Routes):**
- Purpose: HTTP-Endpunkte, Request-Validierung, Response-Formatierung
- Location: `backend/routes/`
- Contains: 17 Route-Dateien, jede exportiert eine Factory-Funktion `(db, rbacVerifier, roleHelpers, ...) => Router`
- Depends on: Middleware-Layer, Services-Layer, Database-Layer
- Used by: Express app in `backend/server.js`

**Middleware-Layer:**
- Purpose: JWT-Verifikation, RBAC-Enforcement, Input-Validierung
- Location: `backend/middleware/`
- Contains: `rbac.js` (Token-Verifikation + Rollenchecks), `validation.js` (express-validator Helpers)
- Depends on: Database-Layer (verifyTokenRBAC lädt User aus DB bei jedem Request)
- Used by: Alle geschützten Routes

**Services-Layer:**
- Purpose: Domänen-Logik die über einzelne Routes hinausgeht
- Location: `backend/services/`
- Contains: `backgroundService.js` (Badge-Updates, Event-Reminder, Token-Cleanup), `pushService.js` (Firebase FCM), `emailService.js` (SMTP)
- Depends on: Database-Layer, Push-Layer
- Used by: Routes (pushService direkt), server.js (backgroundService)

**Push-Layer:**
- Purpose: Firebase-Integration für native Push Notifications
- Location: `backend/push/`
- Contains: `firebase.js` (Firebase Admin SDK init + send), `firebase-service-account.json` (Credentials)
- Depends on: Nichts (nur Firebase Admin SDK)
- Used by: `services/pushService.js`

**Database-Layer:**
- Purpose: PostgreSQL Connection Pool, Query-Interface
- Location: `backend/database.js`
- Contains: pg Pool mit `query()` und `getClient()` (für Transaktionen)
- Depends on: Env-Variable `DATABASE_URL`
- Used by: Alle anderen Layer

**Utils:**
- Purpose: Hilfsfunktionen ohne Seiteneffekte
- Location: `backend/utils/`
- Contains: `chatUtils.js`, `dateUtils.js`, `liveUpdate.js`, `passwordUtils.js`, `pointTypeGuard.js`, `roleHierarchy.js`

---

## RBAC-System

**Rollenhierarchie** (definiert in `backend/utils/roleHierarchy.js`):
```
super_admin (5) — Nur Organisations-Verwaltung, kein Zugriff auf Konfi-Daten
org_admin   (4) — Volle Rechte in eigener Organisation inkl. User-Verwaltung
admin       (3) — Konfis, Events, Badges, Aktivitäten, Requests
teamer      (2) — Events, Konfis ansehen (nur zugewiesene Jahrgänge), Punkte vergeben
konfi       (1) — Nur eigene Daten
```

**Enforcement-Kette** (bei jedem geschützten Request):
1. `verifyTokenRBAC(db)` in `backend/middleware/rbac.js`: Verifiziert JWT, lädt User + Rolle + zugewiesene Jahrgänge aus DB, befüllt `req.user`
2. Rollen-Guard (`requireAdmin`, `requireTeamer`, etc.): Prüft `req.user.role_name` gegen Allowlist
3. Jahrgangs-Filter (`filterByJahrgangAccess`): Teamer sehen nur Konfis in ihren Jahrgängen

**req.user-Struktur** (nach verifyTokenRBAC):
```javascript
{
  id, organization_id, username, display_name,
  role_name,          // 'super_admin' | 'org_admin' | 'admin' | 'teamer' | 'konfi'
  role_title,         // Custom-Anzeigename (z.B. "Pastor")
  organization_name, organization_slug,
  assigned_jahrgaenge: [{ id, name, can_view, can_edit }],
  type,               // Backward-Compat: 'admin' | 'teamer' | 'konfi'
  is_super_admin, is_org_admin
}
```

**Route-Factory-Pattern** (alle 17 Routes folgen diesem Muster):
```javascript
module.exports = (db, rbacVerifier, roleHelpers, ...) => {
  const router = express.Router();
  router.get('/', rbacVerifier, roleHelpers.requireAdmin, async (req, res) => { ... });
  return router;
};
```

---

## Data Flow

**Typischer Admin-Request (z.B. Punkte vergeben):**
1. Frontend: `api.post('/admin/konfis/:id/activities', data)` — axios mit JWT aus `localStorage`
2. `api.interceptors.request`: Fügt `Authorization: Bearer <token>` hinzu
3. Express: Rate Limiter → `verifyTokenRBAC` (DB-Query für User) → `requireTeamer` → Route-Handler
4. Route-Handler: PostgreSQL-Query mit `organization_id` aus `req.user` (Multi-Tenant-Isolation)
5. Optional: `PushService.sendActivityAssignedToKonfi()` → Firebase FCM → Native App
6. Optional: `global.io.to('user_konfi_<id>').emit('liveUpdate', ...)` → WebSocket → Frontend
7. Response: JSON zurück an Frontend

**Realtime-Kommunikation (Chat):**
1. Socket.io-Verbindung: JWT-Auth in Handshake, `socket.user` wird gesetzt
2. User tritt `user_<type>_<id>`-Room bei (für direkte Benachrichtigungen)
3. Chat-Room-Beitritt: `socket.emit('joinRoom', roomId)` → `socket.join('room_<roomId>')`
4. Nachricht senden: REST POST `/api/chat/rooms/:id/messages` → DB speichern → `io.to('room_<id>').emit('newMessage', ...)` → alle Room-Mitglieder
5. Live-Updates (Punkte, Badges): Backend emittiert auf `user_<type>_<id>` → `LiveUpdateContext` dispatcht an abonnierte Komponenten

**Auth-Flow:**
1. Login: `POST /api/auth/login` → bcrypt-Vergleich → JWT signieren → Response mit `{ token, user }`
2. Client: `localStorage.setItem('konfi_token', token)` + `konfi_user`
3. `checkAuth()` in `src/services/auth.ts`: Liest `konfi_user` aus localStorage für initialen State
4. 401-Response: `api.interceptors.response` löscht localStorage und redirectet zu `/`

**State Management:**
- `AppContext` (`src/contexts/AppContext.tsx`): Globaler User-State, Push-Permissions
- `BadgeContext` (`src/contexts/BadgeContext.tsx`): Unread-Counts für Chat + Admin-Badges
- `LiveUpdateContext` (`src/contexts/LiveUpdateContext.tsx`): WebSocket-Listener, pub/sub für komponentenbasierte Refreshes
- `ModalContext` (`src/contexts/ModalContext.tsx`): Modal-Zustand
- Kein globales State-Management (kein Redux/Zustand) — lokaler State in Komponenten + Contexts

---

## Key Abstractions

**Organisation (Multi-Tenant-Boundary):**
- Jede Kirchengemeinde = eine Organisation
- Alle Tabellen haben `organization_id`
- Alle Queries filtern nach `req.user.organization_id`
- Beispiele: `backend/routes/konfi-managment.js`, `backend/routes/events.js`

**Jahrgang:**
- Konfirmanden-Jahrgang (z.B. "2024/25")
- Teamer werden Jahrgängen mit `can_view`/`can_edit` zugewiesen
- `filterByJahrgangAccess(req)` in `backend/middleware/rbac.js` erzeugt passende WHERE-Klausel

**Konfi-Profil:**
- `users`-Tabelle + `konfi_profiles`-Tabelle (gottesdienst_points, gemeinde_points, jahrgang_id)
- Punkte in zwei Typen getrennt: `gottesdienst` + `gemeinde`
- Bonus-Punkte in separater `bonus_points`-Tabelle

**Badge-System:**
- Badges mit `criteria_type` (`total_points` | `activities_count` | `specific_activity` | `streak` | `konfi_days`)
- Automatische Vergabe via `checkAndAwardBadges()` in `backend/routes/badges.js` — wird nach jeder Punkte-Vergabe aufgerufen
- Hintergrund-Check via `BackgroundService.startBadgeUpdateService()` alle 5 Minuten

**Route-Factory:**
- Jede Route exportiert eine Funktion, die `db`, `rbacVerifier`, `roleHelpers` injiziert bekommt
- Verhindert globale Variablen, ermöglicht testbares Design
- Pattern: `backend/routes/activities.js`, `backend/routes/badges.js` etc.

---

## Entry Points

**Backend:**
- Location: `backend/server.js`
- Triggers: Node.js-Prozess, Docker-Container-Start
- Responsibilities: Express-App, Socket.io, SMTP, Rate-Limiter, alle Routes mounten, BackgroundService starten

**Frontend:**
- Location: `frontend/src/main.tsx` → `frontend/src/App.tsx`
- Triggers: Browser-Load oder Capacitor-App-Start
- Responsibilities: Context-Provider-Baum, Auth-Guard, role-basiertes Routing via `MainTabs.tsx`

**MainTabs (Role-Router):**
- Location: `frontend/src/components/layout/MainTabs.tsx`
- Triggers: Jeder Seitenaufruf nach Login
- Responsibilities: Rendert komplett unterschiedliche Tab-Navigationen je nach `user.type` (`admin`/`teamer`/`konfi`) bzw. `super_admin`-Flag

---

## Error Handling

**Strategy:** Try/catch in Route-Handlern, globaler Express-Error-Handler als Fallback

**Patterns:**
- Alle async Route-Handler wrappen DB-Queries in try/catch mit `res.status(500).json({ error: '...' })`
- Middleware gibt `401`/`403` mit deutschen Fehlermeldungen zurück
- Frontend: `api.interceptors.response` fängt 401 (Logout) und 429 (Rate-Limit-Alert) global ab
- DB-Verbindungsfehler beim Start: `process.exit(1)`

---

## Cross-Cutting Concerns

**Logging:** `console.log/error/warn` direkt — kein strukturiertes Logging-Framework

**Validation:** `express-validator` in Routes + `backend/middleware/validation.js` (`handleValidationErrors`)

**Authentication:** JWT Bearer Token in `Authorization`-Header; Token enthält `id` und minimale Claims; vollständiger User wird bei jedem Request aus DB nachgeladen (`verifyTokenRBAC`)

**Organisation-Isolation:** Jeder geschützte Endpoint filtert nach `req.user.organization_id` — keine separate Middleware, sondern Konvention in Route-Handlern

**File Uploads:** `multer` mit drei konfigurierten Instanzen in `server.js`: `requestUpload` (Aktivitäts-Anträge, 5MB, nur Bilder), `chatUpload` (Chat-Dateien, 5MB, diverse MIME-Types), `materialUpload` (Material, 20MB, diverse MIME-Types). Alle mit gehashten Dateinamen (kein statischer Serve — Zugriff nur über geschützte Endpunkte).

---

*Architecture analysis: 2026-03-20*
