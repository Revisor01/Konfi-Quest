# Architecture Research

**Domain:** Ionic 8 React Multi-Tenant App -- Design-Konsistenz-Refactoring und Security Hardening
**Researched:** 2026-02-27
**Confidence:** HIGH (basiert auf direkter Codebase-Analyse, nicht auf externen Quellen)

## Standard Architecture

### System Overview

```
+---------------------------------------------------------------+
|                       Frontend (Ionic 8 React)                 |
+---------------------------------------------------------------+
|  App.tsx                                                       |
|    AppProvider (AppContext)                                     |
|      BadgeProvider (BadgeContext)                               |
|        LiveUpdateProvider (LiveUpdateContext)                   |
|          AppContent                                            |
|            IonReactRouter                                      |
|              MainTabs (Routing + Tab-Rendering)                |
+---------------------------------------------------------------+
|  ModalProvider (ModalContext) -- je Tab-Set                     |
+-------+-------+-------+-------+-------+-------+               |
| Admin | Admin | Admin | Admin | Admin | Admin |               |
| Konfis| Chat  |Events |Badges |Requests|Mehr  |               |
+-------+-------+-------+-------+-------+-------+               |
| Konfi | Konfi | Konfi | Konfi | Konfi | Konfi |               |
| Dash  | Chat  |Events |Badges |Aktiv. |Profil |               |
+-------+-------+-------+-------+-------+-------+               |
|                                                                |
|  Komponentenstruktur pro Bereich:                              |
|  Page (IonPage) --> View (Darstellung) --> Modal (useIonModal) |
|                                                                |
+---------------------------------------------------------------+
|  services/api.ts (Axios)    services/websocket.ts (Socket.io)  |
+---------------------------------------------------------------+
                        |                    |
                    HTTPS/REST          WebSocket
                        |                    |
+---------------------------------------------------------------+
|                    Backend (Node.js Express)                    |
+---------------------------------------------------------------+
|  server.js                                                     |
|    CORS + Rate Limiting                                        |
|    Socket.io (Chat Echtzeit)                                   |
|    Middleware: verifyTokenRBAC (JWT + DB-Lookup)                |
|    Routes: auth, activities, badges, categories, chat,         |
|            events, jahrgaenge, konfi, konfi-management,        |
|            levels, notifications, organizations, roles,        |
|            settings, users                                     |
|    Services: pushService (Firebase)                            |
+---------------------------------------------------------------+
|  PostgreSQL (Docker Container)                                 |
|    users, konfi_profiles, organizations, roles,                |
|    konfi_activities, bonus_points, konfi_badges,               |
|    event_bookings, chat_rooms, chat_messages, ...              |
+---------------------------------------------------------------+
```

### Component Responsibilities

| Component | Responsibility | Communicates With |
|-----------|----------------|-------------------|
| **App.tsx** | Bootstrap, Theme-Setup (iOS26/MD3), Provider-Hierarchie, Auth-Gate | AppContext, BadgeContext, MainTabs |
| **MainTabs** | Routing (Admin vs. Konfi), Tab-Bar-Rendering, Badge-Counts, iOS26-Tab-Effekt | Alle Pages, AppContext, BadgeContext |
| **AppContext** | User-State, Auth-Status, Chat-Notifications, Push-Permissions | api.ts, PushNotifications (Capacitor) |
| **BadgeContext** | Device-Badge-Count, Real-Time-Sync | AppContext, PushNotifications |
| **ModalContext** | PresentingElement-Tracking pro Tab, Modal-Cleanup bei Navigation | Alle Pages (ueber useModalPage Hook) |
| **LiveUpdateContext** | Event-basierte Live-Refreshes fuer Datenaenderungen | Pages die useLiveRefresh nutzen |
| **Page-Komponenten** | Datenlade-Logik, Modal-Praesentation, State-Management | Views, Modals, api.ts, ModalContext |
| **View-Komponenten** | Reine Darstellung, UI-Pattern-Implementierung, Event-Callbacks | Erhalten Daten via Props von Pages |
| **Modal-Komponenten** | Formulare, CRUD-Operationen, eigene API-Calls | api.ts, onClose/onSuccess Callbacks |
| **api.ts** | HTTP-Client (Axios), Token-Injection, 401-Handling | Backend REST API |
| **websocket.ts** | Socket.io-Client, Room Join/Leave | Backend Socket.io |
| **variables.css** | Design-System: CSS-Klassen, Farben, Komponenten-Styles | Alle Komponenten (ueber Klassen) |

---

## Aktuelle Projektstruktur

```
frontend/src/
+-- App.tsx                    # Bootstrap + Auth-Gate
+-- main.tsx                   # Einstiegspunkt
+-- components/
|   +-- admin/                 # Admin-Bereich
|   |   +-- pages/             # 14 Pages (AdminKonfisPage, AdminEventsPage, ...)
|   |   +-- views/             # 3 Views (KonfiDetailView, EventDetailView, ActivityRings)
|   |   +-- modals/            # 14 Modals (EventModal, KonfiModal, ...)
|   |   +-- settings/          # 1 Settings-Komponente
|   |   +-- ActivitiesView.tsx # View auf Top-Level (INKONSISTENT)
|   |   +-- BadgesView.tsx     # View auf Top-Level (INKONSISTENT)
|   |   +-- EventsView.tsx     # View auf Top-Level (INKONSISTENT)
|   |   +-- KonfisView.tsx     # View auf Top-Level (INKONSISTENT)
|   |   +-- UsersView.tsx      # View auf Top-Level (INKONSISTENT)
|   |   +-- OrganizationView.tsx # View auf Top-Level (INKONSISTENT)
|   |   +-- ActivityRequestsView.tsx # View auf Top-Level (INKONSISTENT)
|   +-- konfi/                 # Konfi-Bereich
|   |   +-- pages/             # 6 Pages (KonfiDashboardPage, KonfiEventsPage, ...)
|   |   +-- views/             # 6 Views (DashboardView, EventsView, ...)
|   |   +-- modals/            # 7 Modals (EditProfileModal, PointsHistoryModal, ...)
|   +-- chat/                  # Chat-Bereich (geteilt Admin/Konfi)
|   |   +-- pages/             # 1 Page (ChatOverviewPage)
|   |   +-- views/             # 1 View (ChatRoomView)
|   |   +-- modals/            # 7 Modals
|   |   +-- ChatOverview.tsx   # Komponente auf Top-Level
|   |   +-- ChatRoom.tsx       # Komponente auf Top-Level
|   |   +-- MessageBubble.tsx  # Extrahierte Subkomponente
|   |   +-- VideoPreview.tsx   # Extrahierte Subkomponente
|   |   +-- LazyImage.tsx      # Extrahierte Subkomponente
|   |   +-- constants.ts       # Konstanten
|   +-- auth/                  # Auth-Seiten (Login, Register, etc.)
|   +-- common/                # 2 gemeinsame Komponenten (LoadingSpinner, PushNotificationSettings)
|   +-- layout/                # MainTabs.tsx
+-- contexts/                  # 4 Contexts (App, Badge, LiveUpdate, Modal)
+-- services/                  # api.ts, auth.ts, websocket.ts
+-- hooks/                     # (leer!)
+-- theme/                     # variables.css
+-- types/                     # chat.ts, dashboard.ts, ionic.d.ts
+-- utils/                     # dateUtils.ts, helpers.ts

backend/
+-- server.js                  # Express + Socket.io Setup, alle Route-Mounts
+-- database.js                # PostgreSQL-Verbindung
+-- middleware/
|   +-- rbac.js                # JWT-Verifikation, Rollen-Checks, Org-Isolation
+-- routes/                    # 15 Route-Dateien (monolithisch, nicht aufgeteilt)
+-- services/
|   +-- pushService.js         # Firebase Push Notifications
+-- push/
|   +-- firebase.js            # Firebase Admin SDK
+-- utils/                     # liveUpdate.js, passwordUtils.js
+-- migrations/                # DB-Migrationen
```

### Struktur-Probleme (Ist-Zustand)

1. **Inkonsistente View-Platzierung**: Admin-Views liegen teils in `admin/views/` (3 Dateien), teils direkt in `admin/` (7 Dateien). Konfi-Views sind konsistent in `konfi/views/`.
2. **Leeres hooks/-Verzeichnis**: Custom Hooks fehlen, obwohl wiederverwendbare Logik in Pages dupliziert wird.
3. **Monolithische Backend-Routes**: Route-Dateien (z.B. events.js, chat.js) sind 500-1000+ Zeilen lang.
4. **Fehlende Shared Components**: `common/` enthaelt nur 2 Komponenten, obwohl viele Patterns (Header-Banner, Listen-Items, Empty-States) dupliziert werden.

---

## Architectural Patterns

### Pattern 1: Page-View-Modal Hierarchie

**Was:** Jeder Bereich folgt einer Drei-Ebenen-Hierarchie: Page (Daten + Logik) --> View (Darstellung) --> Modal (CRUD-Formulare).

**Wann verwenden:** Immer. Dies ist das etablierte Pattern der gesamten App.

**Trade-offs:** Klare Trennung von Datenhaltung und Darstellung. Views sind wiederverwendbar (Admin-EventsView vs. Konfi-EventsView zeigen unterschiedliche Daten mit gleichem Layout). Modals sind ueber useIonModal-Hook entkoppelt.

**Referenz-Implementierung (Konfi Events):**
```
KonfiEventsPage.tsx (Page)
  -> Laedt Events via api.get('/konfi/events')
  -> Verwaltet activeTab State
  -> Praesentiert EventDetailModal via useIonModal
  -> Rendert: EventsView (View)
    -> Bekommt events, onSelectEvent, onTabChange als Props
    -> Rendert: Header-Banner, IonSegment Tabs, Event-Liste
    -> Nutzt: CSS-Klassen aus variables.css (app-list-item, app-corner-badge, etc.)
```

### Pattern 2: Design-System ueber CSS-Klassen

**Was:** Wiederverwendbare UI-Patterns sind als CSS-Klassen in `variables.css` definiert, nicht als React-Komponenten.

**Wann verwenden:** Fuer alle visuellen Patterns die bereichsuebergreifend identisch sind.

**Aktuelle CSS-Klassen (Design-System-Kern):**
```
app-card                    -- Karten-Container
app-list-item               -- Listen-Element mit farbigem linken Rand
app-list-item--{variant}    -- Farbvarianten (events, chat, success, warning, ...)
app-list-item--selected     -- Ausgewaehlter Zustand
app-list-item__row          -- Flex-Row innerhalb eines List-Items
app-list-item__main         -- Hauptbereich (Icon + Content)
app-list-item__content      -- Text-Content
app-list-item__title        -- Titel-Text
app-list-item__subtitle     -- Untertitel
app-list-item__meta         -- Meta-Informationen (Icons + Text)
app-list-item__meta-item    -- Einzelnes Meta-Element
app-icon-circle             -- Runder Icon-Container
app-icon-circle--lg         -- Grosser Icon-Container (40px)
app-icon-circle--{variant}  -- Farbvarianten
app-section-icon            -- Section-Header-Icon (klein, 24px)
app-section-icon--{variant} -- Farbvarianten
app-corner-badge            -- Eselsohr-Badge (oben rechts)
app-chip                    -- Status-Chip
app-tag                     -- Kategorie-Tag
app-reason-box              -- Info-Box mit farbigem linken Rand
app-gradient-background     -- Seitenhintergrund-Gradient
```

**Trade-offs:** Flexibel und leichtgewichtig. Nachteil: Keine TypeScript-Typensicherheit, keine Props-Validierung. Header-Banner werden als Inline-Styles dupliziert (nicht als CSS-Klasse).

### Pattern 3: Kompakter Header-Banner

**Was:** Jeder Bereich hat einen farbigen Gradient-Banner oben mit Icon, Titel, Untertitel und Stats-Row.

**Wann verwenden:** Auf jeder Hauptseite als visueller Ankerpunkt.

**Problem:** Dieses Pattern wird als Inline-Styles in jeder View dupliziert (~50 Zeilen pro View). Es gibt keine gemeinsame Komponente oder CSS-Klasse dafuer.

**Farbschema (fest definiert):**
```
Konfis:        #5b21b6 (Lila)     --> #4c1d95
Events:        #dc2626 (Rot)      --> #b91c1c
Chat:          #06b6d4 (Cyan)     --> #0891b2
Badges:        #f59e0b (Gelb)     --> #d97706
Aktivitaeten:  #059669 (Gruen)    --> #047857
Requests:      #059669 (Gruen)    --> #047857
Users:         #667eea (Indigo)   --> #5a67d8
Organizations: #2dd36f (Gruen)    --> #22c55e
Levels:        #5b21b6 (Lila)     --> #4c1d95
Jahrgaenge:    #007aff (Blau)     --> #0066cc
```

### Pattern 4: useIonModal mit Callbacks

**Was:** Modals werden IMMER ueber den `useIonModal` Hook geoeffnet, NIEMALS ueber `<IonModal isOpen={state}>`.

**Wann verwenden:** Immer. Ohne Ausnahme.

**Beispiel:**
```typescript
const [presentModal, dismissModal] = useIonModal(EventModal, {
  event: editEvent,
  onClose: () => {
    dismissModal();
    setEditEvent(null);
  },
  onSuccess: () => {
    dismissModal();
    setEditEvent(null);
    loadEvents();
  }
});

// Oeffnen mit presentingElement fuer iOS Sheet-Modal-Effekt
presentModal({
  presentingElement: presentingElement
});
```

**Trade-offs:** Korrekte iOS-Animation (Sheet-Modal mit Backdrop), korrekte Lifecycle-Events. Erfordert ModalContext + useModalPage Hook fuer das presentingElement-Tracking.

### Pattern 5: RBAC Middleware-Chain

**Was:** Backend-Routes verwenden eine Middleware-Chain: `verifyTokenRBAC --> requireRole/requireAdmin/requireTeamer --> Route-Handler`.

**Wann verwenden:** Auf jeder geschuetzten Route.

**Rollen-Hierarchie:**
```
super_admin (5) - Organisations-uebergreifend, nur Org-Verwaltung
org_admin (4)   - Volle Rechte in eigener Organisation
admin (3)       - Konfis, Events, Badges, Aktivitaeten, Requests
teamer (2)      - Events, Konfis ansehen, Punkte vergeben
konfi (1)       - Nur eigene Daten
```

---

## Data Flow

### Request Flow (Frontend --> Backend)

```
[User Action in View]
    |
    v
[Page Component] -- State Update + API Call
    |
    v
[api.ts Axios Instance]
    | -- Token aus localStorage injiziert
    v
[Backend: Express Route]
    | -- verifyTokenRBAC: JWT pruefen, User aus DB laden
    | -- requireRole: Rollen-Check
    | -- organization_id Filter: Tenant-Isolation
    v
[PostgreSQL Query]
    |
    v
[Response JSON]
    |
    v
[Page Component] -- State Update
    |
    v
[View Component] -- Re-Render via Props
```

### State Management

```
AppContext (global)
    |-- user: User | null         (Auth-Status)
    |-- chatNotifications          (Unread Counts)
    |-- error/success              (Globale Meldungen)
    |
    +-- Wird konsumiert von:
        |-- MainTabs (Tab-Routing)
        |-- Alle Pages (User-Info, Fehlermeldungen)
        |-- Alle Modals (User-Info fuer API-Calls)

BadgeContext (global)
    |-- badgeCount: number         (Device + Tab Badge)
    |
    +-- Wird konsumiert von:
        |-- MainTabs (Tab-Badge-Anzeige)

ModalContext (pro Tab-Set)
    |-- presentingElement          (Aktives IonPage-Element)
    |
    +-- Wird konsumiert von:
        |-- Alle Pages (via useModalPage Hook)
        |-- Indirekt: Alle Modals (via presentingElement)

LiveUpdateContext (global)
    |-- Event-basierte Refreshes   (Socket.io Events)
    |
    +-- Wird konsumiert von:
        |-- Pages die useLiveRefresh nutzen
```

### Key Data Flows

1. **Auth-Flow:** Login --> JWT Token --> localStorage --> api.ts Interceptor --> Jeder Request hat Bearer Token --> verifyTokenRBAC laedt vollen User aus DB (inkl. Rollen, Org, Jahrgaenge)

2. **Konfi-Dashboard-Flow:** KonfiDashboardPage laedt /konfi/dashboard --> DashboardView rendert Punkte-Uebersicht, Activity Rings, naechste Events, Ranking, Badges --> Modals fuer Details

3. **Admin-Event-Management-Flow:** AdminEventsPage laedt /events --> EventsView zeigt Liste mit Status-Farben, Corner-Badges, Sliding-Actions --> EventModal fuer Create/Edit --> EventDetailView fuer Teilnehmer-Management

4. **Chat-Real-Time-Flow:** ChatRoomView --> Socket.io joinRoom --> Server broadcastet newMessage --> Alle Clients im Room erhalten Update --> MessageBubble-Rendering --> Push-Notification an Offline-User

5. **Multi-Tenant-Isolation-Flow:** verifyTokenRBAC setzt req.user.organization_id --> Jede Route filtert mit `WHERE organization_id = $1` --> Daten sind organisations-isoliert

---

## Component Boundaries -- Refactoring-Architektur

### Ziel-Architektur fuer Design-Konsistenz

Die Refactoring-Architektur sollte drei Ebenen von Wiederverwendung etablieren:

#### Ebene 1: Shared UI Components (NEU zu erstellen)

| Component | Props | Ersetzt |
|-----------|-------|---------|
| `SectionHeader` | title, subtitle, icon, color, stats[] | ~50 Zeilen Inline-Styles pro View (Header-Banner) |
| `EmptyState` | icon, title, message, color | Duplizierter Empty-State in jeder View |
| `ListSection` | title, icon, color, count, children | IonListHeader + IonCard app-card Pattern |

**NICHT als Shared Component:** Listen-Items (zu unterschiedlich pro Bereich), Modals (zu spezifisch), Status-Logik (bereichsspezifisch).

#### Ebene 2: CSS-Klassen (BEREITS VORHANDEN, erweitern)

Das CSS-Design-System in `variables.css` ist bereits umfangreich. Fehlend:

| Klasse | Zweck |
|--------|-------|
| `app-header-banner` | Gradient-Banner (aktuell Inline-Styles) |
| `app-header-banner--{variant}` | Farbvarianten fuer Bereiche |
| `app-stats-row` | Stats-Reihe im Header-Banner |
| `app-stats-item` | Einzelnes Stat-Element |

#### Ebene 3: Hooks (NEU zu erstellen)

| Hook | Zweck | Ersetzt |
|------|-------|---------|
| `useDataLoader(url)` | Lade-Logik mit Loading/Error-State | Duplizierter useEffect + try/catch in jeder Page |
| `useRefresher(loadFn)` | IonRefresher-Handler | Duplizierter Refresher-Code |

### Build-Reihenfolge (Abhaengigkeiten)

```
Phase 1: Design-System-Grundlagen
  1.1 CSS-Klassen fuer Header-Banner    -- Keine Abhaengigkeit
  1.2 SectionHeader-Komponente          -- Abhaengig von 1.1
  1.3 EmptyState-Komponente             -- Keine Abhaengigkeit
  1.4 ListSection-Komponente            -- Keine Abhaengigkeit

Phase 2: Admin-Views angleichen
  2.1 Admin-Views nach views/ verschieben  -- Strukturbereinigung
  2.2 SectionHeader in Admin-Views einbauen -- Abhaengig von 1.2
  2.3 EmptyState in Admin-Views einbauen    -- Abhaengig von 1.3
  2.4 ListSection in Admin-Views einbauen   -- Abhaengig von 1.4

Phase 3: Konfi-Views angleichen
  3.1 SectionHeader in Konfi-Views          -- Abhaengig von 1.2
  3.2 EmptyState in Konfi-Views             -- Abhaengig von 1.3

Phase 4: Modal-Konsistenz pruefen
  4.1 Alle 28 Modals auf useIonModal Pattern pruefen  -- Keine Abhaengigkeit
  4.2 Farblogik und Spacing in Modals angleichen       -- Abhaengig von 4.1

Phase 5: Security Hardening
  5.1 organization_id-Filterung in allen Routes pruefen -- Keine Abhaengigkeit
  5.2 JWT Token-Lifecycle verbessern                     -- Keine Abhaengigkeit
  5.3 Rate-Limiting erweitern                            -- Keine Abhaengigkeit
```

---

## Anti-Patterns

### Anti-Pattern 1: Inline-Style-Duplizierung fuer Design-Patterns

**Was passiert:** Der Header-Banner (Gradient, Icon, Stats-Row) wird in jeder View als ~50 Zeilen Inline-Styles kopiert. EventsView, KonfisView, BadgesView, ActivitiesView, DashboardView -- alle haben identische Struktur mit minimalen Unterschieden (Farbe, Titel, Stats-Werte).

**Warum problematisch:** Design-Aenderungen muessen in 10+ Dateien manuell synchronisiert werden. Abweichungen schleichen sich ein (z.B. unterschiedliche Padding-Werte, fehlende dekorative Kreise).

**Stattdessen:** Eine `SectionHeader`-Komponente erstellen, die `color`, `icon`, `title`, `subtitle` und `stats` als Props akzeptiert. Alternativ CSS-Klassen fuer die Struktur, nur Farbe als Inline-Style.

### Anti-Pattern 2: Views auf falscher Verzeichnisebene

**Was passiert:** Admin-Views liegen teils in `admin/views/` (KonfiDetailView, EventDetailView, ActivityRings), teils direkt in `admin/` (EventsView, KonfisView, BadgesView, UsersView, etc.).

**Warum problematisch:** Inkonsistente Dateistruktur. Entwickler muessen suchen, wo Views liegen. Neue Entwickler verstehen das Pattern nicht.

**Stattdessen:** Alle Views in `admin/views/` verschieben. Import-Pfade in Pages anpassen.

### Anti-Pattern 3: organization_id-Filter nicht in allen Routes

**Was passiert:** Einige Backend-Routes (z.B. notifications, settings) filtern nicht oder nur teilweise nach `organization_id`. Dies ermoeglicht theoretisch Cross-Tenant-Datenlecks.

**Warum problematisch:** Multi-Tenant-Isolation ist nur so stark wie die schwaechste Route.

**Stattdessen:** Systematisches Audit aller Routes. Jede Query die Tenant-Daten zurueckgibt MUSS `WHERE organization_id = req.user.organization_id` enthalten.

### Anti-Pattern 4: JWT ohne Refresh-Token-Mechanismus

**Was passiert:** JWT-Token werden mit 24h Laufzeit ausgestellt. Es gibt keinen Refresh-Token-Mechanismus. Bei Ablauf wird der User ausgeloggt und muss sich neu anmelden.

**Warum problematisch:** Schlechte UX (ploetzliches Ausloggen), Sicherheitsrisiko (langes Token-Fenster).

**Stattdessen:** Refresh-Token-Rotation implementieren oder Token-Laufzeit auf 1h reduzieren mit automatischem Refresh.

---

## Security Architecture -- Multi-Tenant Hardening

### Ist-Zustand der Tenant-Isolation

| Route-Datei | org_id Filterung | Status |
|-------------|------------------|--------|
| activities.js | 32 Vorkommen | Gut abgedeckt |
| events.js | 75 Vorkommen | Gut abgedeckt |
| chat.js | 35 Vorkommen | Behoben (Juli 2025) |
| konfi-managment.js | 54 Vorkommen | Gut abgedeckt |
| konfi.js | 76 Vorkommen | Gut abgedeckt |
| badges.js | 37 Vorkommen | Zu pruefen (nicht migriert) |
| organizations.js | 37 Vorkommen | Durch super_admin-Check abgedeckt |
| users.js | 25 Vorkommen | Zu pruefen |
| categories.js | 11 Vorkommen | Zu pruefen |
| jahrgaenge.js | 11 Vorkommen | Zu pruefen |
| auth.js | 13 Vorkommen | Login-spezifisch, OK |
| levels.js | 19 Vorkommen | Zu pruefen |
| notifications.js | 0 Vorkommen | KRITISCH -- keine Isolation! |
| roles.js | 6 Vorkommen | Minimal, zu pruefen |
| settings.js | Nicht geprueft | Zu pruefen |

### Security-Hardening-Massnahmen (priorisiert)

1. **notifications.js auditieren** -- Keine organization_id-Filterung gefunden. Push-Tokens koennten bereichsuebergreifend sein.
2. **badges.js migrieren und auditieren** -- Noch nicht auf PostgreSQL migriert, organization_id-Filter unklar.
3. **Alle Routes mit <20 org_id-Vorkommen einzeln pruefen** -- categories, jahrgaenge, levels, roles, settings.
4. **JWT Token-Laufzeit reduzieren** -- Aktuell 24h, besser 1-4h mit Refresh-Token.
5. **Rate-Limiting auf fehlende Routes erweitern** -- Aktuell nur Chat, Events, File-Uploads abgedeckt.

---

## Integration Points

### Externe Services

| Service | Integration Pattern | Sicherheitsrelevanz |
|---------|---------------------|---------------------|
| Firebase Cloud Messaging | Server --> Firebase Admin SDK --> APNS/FCM | Push-Token-Isolation pro Organisation sicherstellen |
| Capacitor Push Notifications | Natives Plugin --> AppDelegate --> FCM Token --> Backend | Token-Duplikat-Bereinigung vorhanden |
| Capacitor Badge Plugin | @capawesome/capacitor-badge --> Device Badge Count | Rein lokal, kein Sicherheitsrisiko |
| Socket.io | WebSocket mit JWT-Auth --> Room-basierte Isolation | JWT wird bei Connection verifiziert |

### Interne Grenzen

| Grenze | Kommunikation | Sicherheitsaspekte |
|--------|---------------|---------------------|
| Frontend Admin <-> Konfi | Getrennte Route-Pfade (/admin/* vs /konfi/*) | Frontend-Trennung, Backend-RBAC-Checks pro Route |
| Page <-> View | Props (one-way) | Keine Sicherheitsrelevanz |
| Page <-> Modal | useIonModal + Callbacks (onClose, onSuccess) | Modal-Daten stammen aus Page-State |
| Frontend <-> Backend API | REST via Axios + Bearer Token | Token in localStorage, 401-Auto-Redirect |
| Frontend <-> Backend Socket | Socket.io mit JWT-Auth | JWT in handshake.auth, Room-Isolation |
| Backend Route <-> PostgreSQL | Pool-basierte Queries mit Parametrisierung | SQL Injection: durch parametrisierte Queries geschuetzt |

---

## Scaling Considerations

| Scale | Architecture Adjustments |
|-------|--------------------------|
| 0-500 User (aktuell) | Monolith reicht. Fokus auf Korrektheit und Design-Konsistenz. |
| 500-5k User | Connection Pooling pruefen, Socket.io Redis-Adapter fuer Multi-Instance |
| 5k+ User | Backend-Routes in Services aufteilen, Caching-Layer, CDN fuer Uploads |

### Erste Engpaesse

1. **Socket.io Memory:** Bei vielen gleichzeitigen Chat-Connections. Loesung: Redis-Adapter.
2. **PostgreSQL Queries:** Einige Routes laden zu viele Daten (z.B. alle Events ohne Pagination). Loesung: Pagination einfuehren.
3. **Push-Token-Tabelle:** CREATE TABLE IF NOT EXISTS bei jedem Request. Loesung: In Migrations verschieben.

---

## Sources

- Direkte Codebase-Analyse (alle Dateien gelesen und ausgewertet)
- `/Users/simonluthe/Documents/Konfipoints/.planning/PROJECT.md` -- Projektkontext
- `/Users/simonluthe/Documents/Konfipoints/CLAUDE.md` -- Migrationsstatus und bekannte Probleme
- `/Users/simonluthe/Documents/Konfipoints/6.2-Analyse.md` -- Vorherige Analyse mit erledigten und offenen Punkten
- `/Users/simonluthe/Documents/Konfipoints/DESIGN_VORLAGE_LISTE.md` -- Design-Vorlage fuer Listen

---
*Architecture research for: Konfi Quest -- Design-Konsistenz-Refactoring und Security Hardening*
*Researched: 2026-02-27*
