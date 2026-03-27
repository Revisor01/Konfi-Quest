# Feature Landscape: Test-Suite + CI/CD

**Domain:** Testing und CI/CD fuer eine Multi-Tenant Ionic/Express App
**Recherchiert:** 2026-03-27
**Konfidenz:** HIGH (Testing-Patterns fuer Express/PostgreSQL/Ionic gut dokumentiert, Codebase vollstaendig analysiert)

---

## Table Stakes

Features die jede ernstzunehmende Test-Suite braucht. Ohne diese ist die Test-Suite unvollstaendig.

| Feature | Warum erwartet | Komplexitaet | Notizen |
|---------|----------------|--------------|---------|
| Backend Integration Tests (Auth) | Auth ist Security-kritisch: Login, Token-Refresh, Logout-Revoke, gesperrte User | Med | auth.js (833 LOC), JWT + bcrypt + RBAC Cache |
| Backend Integration Tests (RBAC/Rollen) | Jede Route prueft Rollen -- falsche Checks = Datenleck | Med | rbac.js Middleware, 5 Rollen, LRU-Cache |
| Backend Integration Tests (Events) | Groesste Route (2079 LOC), transaktionssicher, Wartelisten-Logik | High | Pflicht-Events, Timeslots, Kapazitaet, Waitlist-Nachruecken |
| Backend Integration Tests (Punkte/Aktivitaeten) | Kernfunktion der App, atomare DB-Operationen | Med | konfi.js (2039 LOC), activities.js, bonus_points |
| Backend Integration Tests (Chat) | Drittgroesste Route (1879 LOC), Org-Isolation kritisch | High | Socket.IO parallel, Polls, Dateiuploads, LATERAL Joins |
| Multi-Tenant Isolation Tests | DSG-EKD Pflicht: Daten duerfen nie zwischen Orgs leaken | High | organization_id auf JEDER Query, RBAC + Org-Checks |
| Test-Datenbank Setup (Docker) | Tests gegen echte PostgreSQL, nicht Mocks | Med | docker-compose.test.yml, Seed-Daten, Teardown |
| GitHub Actions CI Pipeline | Tests muessen bei jedem Push automatisch laufen | Low | Bestehende Workflows erweitern, PostgreSQL Service Container |
| npm audit in CI | Abhaengigkeiten auf bekannte Schwachstellen pruefen | Low | `npm audit --audit-level=moderate` |
| Frontend Build-Check in CI | TypeScript-Kompilierung muss fehlerfrei sein | Low | `tsc && vite build` als CI-Schritt |

---

## Differentiators

Features die ueber das Minimum hinausgehen und echten Mehrwert liefern.

| Feature | Wertversprechen | Komplexitaet | Notizen |
|---------|-----------------|--------------|---------|
| E2E Tests (Playwright) fuer Kernpfade | Findet Bugs die Unit/Integration Tests nicht finden: echte Browser-Interaktion | High | Login-Flow, Punkte vergeben, Event buchen, Chat senden |
| Backend Unit Tests (Utils/Services) | Schnelle Feedback-Schleife fuer isolierte Logik | Low | bookingUtils, chatUtils, pointTypeGuard, roleHierarchy, passwordUtils |
| Frontend Hook Tests | useOfflineQuery, useActionGuard, useCountUp sind komplex | Med | Vitest + @testing-library/react-hooks |
| Coverage Reports in CI | Sichtbare Metrik, verhindert Regression | Low | Vitest coverage, Badge im README |
| Lint + Type-Check in CI | Verhindert schleichende Code-Qualitaetsverschlechterung | Low | ESLint + tsc --noEmit |
| Socket.IO Integration Tests | Chat-Echtzeit-Funktionalitaet absichern | High | socket.io-client im Test, Rooms, Typing, Org-Isolation |
| Badge-Cron Logik Tests | 13 Badge-Typen mit komplexen Kriterien (Streaks, Zeitbasiert) | Med | Bulk-Query-Logik, deterministische Testdaten |
| Migration-Runner Tests | Sicherstellen dass Migrationen idempotent und korrekt sind | Low | Leere DB -> runMigrations -> Schema pruefen |
| Seed-Daten fuer manuelle Tests | Reproduzierbare Testumgebung fuer Entwickler | Med | Mehrere Orgs, Jahrgaenge, Konfis, Teamer, Admins, Events, Badges |

---

## Anti-Features

Features die explizit NICHT gebaut werden sollten.

| Anti-Feature | Warum vermeiden | Stattdessen |
|--------------|-----------------|-------------|
| 100% Code Coverage erzwingen | Treibt zu sinnlosen Tests, verlangsamt Entwicklung massiv | 70-80% Backend, 50-60% Frontend als Richtwert |
| Snapshot Tests fuer Ionic Komponenten | Ionic Shadow-DOM macht Snapshots fragil und wertlos | Verhaltenstests mit Testing Library |
| Mocking der gesamten Datenbank | Verfehlt den Zweck: SQL-Fehler, Constraints, Transaktionen werden nicht getestet | Echte PostgreSQL in Docker |
| E2E Tests fuer jeden Flow | Zu langsam, zu fragil, zu teuer in Wartung | Nur 4-5 Kernpfade: Login, Punkte, Events, Chat, Admin-CRUD |
| Frontend Component Tests fuer ALLE 125 Komponenten | Unverhaeltnismaessiger Aufwand | Nur kritische Komponenten: Auth, Dashboard, EventDetail |
| Visual Regression Tests | Zwei Themes (iOS26 + MD3), enormer Wartungsaufwand | Manuelles Testing bei Design-Aenderungen |
| Performance/Load Tests in CI | Zu langsam fuer CI, benoetigt eigene Infrastruktur | Separat bei Bedarf (vor EKD-Skalierung auf 4000+ User) |
| Cypress statt Playwright | Veralteter Ansatz, langsamer, schlechtere CI-Integration | Playwright (Multi-Browser, besser fuer CI, schneller) |
| API-Dokumentation/Contract Tests | Kein externer API-Zugriff geplant (out of scope laut PROJECT.md) | Nur interne Integration Tests |

---

## Test-Prioritaeten nach Risiko/Impact

### Tier 1: Sicherheitskritisch (MUSS getestet werden)

| Was | Route/Modul | Warum kritisch | Testtyp |
|-----|-------------|----------------|---------|
| Auth-Lifecycle | auth.js (833 LOC) | Login, Token-Refresh, Logout-Revoke, gesperrte User | Integration |
| RBAC Enforcement | rbac.js Middleware | Jede Rolle sieht nur erlaubte Daten, Cache-Invalidierung | Integration |
| Multi-Tenant Isolation | Alle 18 Routes | Org A darf keine Daten von Org B sehen (DSG-EKD) | Integration |
| Punkte-Atomaritaet | konfi.js (2039 LOC) | BEGIN/COMMIT, GREATEST(0,...), keine Race Conditions | Integration |
| Event-Kapazitaet | events.js (2079 LOC) | Overbooking, Warteliste, Nachruecken transaktionssicher | Integration |

### Tier 2: Geschaeftslogik-kritisch (SOLLTE getestet werden)

| Was | Route/Modul | Warum kritisch | Testtyp |
|-----|-------------|----------------|---------|
| Badge-Vergabe | badges.js (822 LOC) | 13 Typen, Streak-Logik, auto-awarding Cron | Integration |
| Event-Booking Flow | events.js | Timeslots, Pflicht-Events, QR-Check-in, Opt-out | Integration |
| Konfi-Management | konfi-management.js (1008 LOC) | Punkte vergeben, Aktivitaeten zuweisen, Bulk-Ops | Integration |
| Chat-Nachrichten | chat.js (1879 LOC) | Senden, Org-Filter, Raum-Erstellung, Polls | Integration |
| Wrapped-Generierung | wrapped.js (798 LOC) | Daten-Aggregation, Slide-Konfiguration | Integration |
| Utility Functions | bookingUtils, chatUtils, pointTypeGuard | Isolierte Logik, schnell testbar, hoher ROI | Unit |

### Tier 3: Nice-to-have (KANN getestet werden)

| Was | Route/Modul | Warum weniger kritisch | Testtyp |
|-----|-------------|------------------------|---------|
| Settings CRUD | settings.js (203 LOC) | Einfache Key-Value Operationen | Integration |
| Levels CRUD | levels.js (298 LOC) | Simples CRUD ohne komplexe Logik | Integration |
| Kategorien CRUD | categories.js (135 LOC) | Simples CRUD | Integration |
| Rollen-Liste | roles.js (180 LOC) | Read-only, selten geaendert | Integration |
| Notifications CRUD | notifications.js (153 LOC) | Einfache DB-Operationen | Integration |
| Frontend Auth-Flow | auth.ts, tokenStore.ts | Login/Logout im Browser | E2E |
| Dashboard-Rendering | DashboardSections.tsx (794 LOC) | Komplexes Rendering, aber UI-fokussiert | Component |

---

## Feature Dependencies

```
Test-DB Setup (Docker)
  |-> Backend Integration Tests (alle)
  |     |-> Auth Tests (erzeugen JWT-Tokens fuer alle anderen Tests)
  |     |     |-> RBAC Tests
  |     |     |-> Multi-Tenant Tests
  |     |     |-> Route-spezifische Tests
  |     |-> Seed-Daten (konsistenter DB-Zustand)
  |           |-> E2E Tests (brauchen volle Seed-Daten)
  |
  GitHub Actions CI
  |-> Alle Tests (muessen in CI laufen)
  |-> npm audit
  |-> Frontend Build-Check -> Frontend Hook Tests
  |-> Coverage Reports
```

---

## Realistische Coverage-Ziele

| Bereich | LOC (ca.) | Ziel | Begruendung |
|---------|-----------|------|-------------|
| Backend Routes (Tier 1) | ~7.000 | 85-90% | Sicherheitskritisch, gut testbar mit supertest |
| Backend Routes (Tier 2) | ~5.100 | 70-80% | Geschaeftslogik, komplexere Setup-Anforderungen |
| Backend Routes (Tier 3) | ~1.000 | 50-60% | Einfaches CRUD, geringes Risiko |
| Backend Utils/Services | ~800 | 90%+ | Isoliert, schnell, hoher ROI |
| Backend Middleware | ~300 | 90%+ | Wenig Code, extrem kritisch (RBAC) |
| Frontend Hooks | ~400 | 70-80% | Komplexe Logik, gut isoliert testbar |
| Frontend Services | ~1.200 | 60-70% | API-Wrapper, teilweise Mocking noetig |
| Frontend Components | ~42.000 | 30-40% | Nur kritische Flows, Ionic Shadow-DOM erschwert Tests |
| E2E (Playwright) | - | 4-5 Kernpfade | Login, Punkte, Events, Chat, Admin-CRUD |
| **Gesamt Backend** | **~14.000** | **75-80%** | Realistisch, guter Schutz |
| **Gesamt Frontend** | **~42.000** | **40-50%** | Realistisch mit Ionic-Einschraenkungen |

---

## Test-Kategorien mit Aufwandsschaetzung

### 1. Backend Integration Tests (supertest + echte PostgreSQL)

**Anteil:** ~60% des gesamten Test-Aufwands
**Test-Dateien:** ~18 (eine pro Route + Middleware + Helpers)

Jeder Test:
- Laeuft gegen Docker PostgreSQL mit Seed-Daten
- Authentifiziert sich mit vorgenerierten JWT-Tokens (verschiedene Rollen: Konfi, Teamer, Admin, Orgadmin, Superadmin)
- Testet Happy Path + Error Cases + RBAC-Enforcement + Org-Isolation
- Rollback nach jedem Test (Transaction-Wrapping oder TRUNCATE CASCADE)

Groesste Herausforderungen:
- **events.js (2079 LOC):** Pflicht-Events mit Auto-Enrollment, Timeslots mit Kapazitaet, Wartelisten-Nachruecken, QR-Check-in mit Zeitfenster, Opt-out mit Begruendung
- **chat.js (1879 LOC):** Socket.IO parallel zu REST-Endpunkten, Org-Isolation bei Raum-Erstellung, LATERAL Joins fuer DM-Namen, Polls und Reactions, Dateiuploads mit Magic-Bytes
- **konfi.js (2039 LOC):** Atomare Punkte-Operationen (BEGIN/COMMIT), Bonus-Punkte ohne Double-Count, Badge-Trigger bei Punktevergabe, Profil-Aggregation

### 2. Backend Unit Tests (isoliert, kein DB)

**Anteil:** ~10% des gesamten Test-Aufwands
**Test-Dateien:** ~7

- **bookingUtils.js:** Kapazitaetspruefung, Wartelisten-Logik, Zeitfenster
- **chatUtils.js:** Dynamischer Admin-Lookup, Raum-Queries
- **pointTypeGuard.js:** Deaktivierte Punkte-Typen blockieren (Gottesdienst/Gemeinde pro Jahrgang)
- **roleHierarchy.js:** Rollen-Vergleiche (wer darf was)
- **passwordUtils.js:** Einmalpasswort-Generierung, Hash-Validierung
- **dateUtils.js:** Datums-Hilfsfunktionen
- **losungService.js:** API-Abruf (HTTP-Client gemockt)

### 3. Frontend Hook/Service Tests (Vitest + Testing Library)

**Anteil:** ~15% des gesamten Test-Aufwands
**Test-Dateien:** ~10

- **useOfflineQuery:** SWR-Cache-Logik, Stale/Fresh-Zustaende, fetcherRef-Stabilitaet
- **useActionGuard:** Online-Check vor Aktionen, Offline-Blocking
- **useCountUp:** Animations-Timing (fuer Wrapped)
- **tokenStore:** Token-Speicherung (Capacitor Preferences), sync Getter + async Setter
- **offlineCache:** Cache-Invalidierung, TTL-Logik
- **writeQueue:** FIFO-Reihenfolge, Persistence, Retry-Logik
- **networkMonitor:** Online/Offline-Detection
- **api.ts:** Interceptors, Retry-Logik, Idempotency-Keys

### 4. E2E Tests (Playwright)

**Anteil:** ~15% des gesamten Test-Aufwands
**Test-Dateien:** ~5

- **Login-Flow:** Konfi + Admin Login, falsches Passwort, gesperrter User, Rate-Limiting
- **Punkte-Vergabe:** Admin vergibt Gottesdienst/Gemeinde-Punkte, Konfi sieht aktualisierte Punkte
- **Event-Buchung:** Event erstellen, Konfi bucht Timeslot, Warteliste-Verhalten
- **Chat:** Nachricht senden, Raum erstellen, Org-Isolation verifizieren
- **Admin-CRUD:** Konfi anlegen, Aktivitaet erstellen, Badge vergeben

Voraussetzungen:
- Frontend muss gegen Test-Backend laufen (VITE_API_URL konfigurierbar, existiert seit v2.6)
- Seed-Daten muessen konsistent sein
- Playwright braucht eigenen Docker-Compose-Stack oder lokalen Setup

---

## Abhaengigkeiten vom bestehenden Code

| Bereich | Abhaengigkeit | Impact auf Tests |
|---------|---------------|------------------|
| server.js ist monolithisch | Express-App + Socket.IO + Cron in einer Datei (~300 LOC Setup) | **Refactoring noetig:** app muss ohne listen() exportierbar sein fuer supertest |
| Routes erwarten `req.db` | Database Pool Injection via Middleware in server.js | Test-Setup muss db-Pool bereitstellen und an Request haengen |
| RBAC erwartet JWT_SECRET ENV | Umgebungsvariablen muessen in Tests gesetzt sein | .env.test Datei oder CI Secrets |
| Firebase Push in Routes | Push-Calls in Event/Badge/Notification-Routes | **Firebase muss gemockt werden** (kein echtes Senden in Tests) |
| Socket.IO in server.js | io-Objekt wird an Routes/liveUpdate uebergeben | Fuer Chat-Tests muss io gemockt oder separat gestartet werden |
| Multer File-Uploads | Chat + Material Routes erwarten multipart/form-data | supertest unterstuetzt `.attach()` fuer Datei-Tests |
| schema_migrations | Migrationen laufen bei DB-Connect automatisch | Test-DB braucht sauberen Migrations-Lauf vor Tests |
| node-cron Jobs | Badge-Cron, Wrapped-Cron starten bei server.js Import | **Cron muss deaktivierbar sein** (ENV-Flag oder Init-Funktion) |
| Bestehende CI | Nur Build+Deploy (backend.yml, frontend.yml), keine Tests | Tests als separater Job VOR dem Build-Job einfuegen |

---

## Kritischer Refactoring-Bedarf fuer Testbarkeit

Minimale Aenderungen an der bestehenden Codebase, die Tests erst ermoeglichen:

1. **app-Export aus server.js:** Aktuell startet server.js direkt `server.listen()`. Fuer supertest muss die Express-App ohne `listen()` exportierbar sein.
   ```javascript
   // Am Ende von server.js:
   if (require.main === module) {
     server.listen(PORT, () => { ... });
   }
   module.exports = { app, server, io };
   ```

2. **Firebase-Mock:** pushService.js muss mockbar sein. Entweder ENV-Flag (`DISABLE_PUSH=true` fuer Tests) oder vi.mock() auf Modul-Ebene.

3. **Cron-Isolation:** node-cron Jobs sollten nicht beim Import starten. ENV-Flag `DISABLE_CRON=true` oder Refactoring zu einer expliziten `initCronJobs()` Funktion.

4. **DB-Pool fuer Tests:** database.js exportiert bereits den Pool. Test-Setup braucht nur eine separate DATABASE_URL die auf die Test-DB zeigt.

---

## MVP Empfehlung

Prioritaet fuer die erste Implementierungs-Phase:

1. **Test-DB Setup** (Docker PostgreSQL + Seed-Daten + Teardown-Mechanismus)
2. **server.js Refactoring** (app-Export, Cron-Isolation, Firebase-Mock)
3. **Backend Integration Tests: Auth + RBAC** (Sicherheit zuerst)
4. **Backend Integration Tests: Events + Konfi (Punkte)** (Kerngeschaeftslogik)
5. **Backend Unit Tests: Utils** (Schnell, hoher ROI)
6. **GitHub Actions CI: Tests + npm audit + Build-Check** (Automatisierung)

Zurueckstellen fuer Phase 2:
- **E2E Tests (Playwright):** Eigener Docker-Stack, hoher Setup-Aufwand
- **Frontend Component/Hook Tests:** Ionic Shadow-DOM Herausforderungen
- **Socket.IO Chat Tests:** Komplex, Chat seit v2.5 stabil
- **Remaining Backend Routes (Tier 2+3):** Nach Tier 1 abgedeckt

Zurueckstellen fuer Phase 3:
- **Wrapped Tests:** Saisonal, nur einmal pro Jahr relevant
- **Coverage-Enforcement:** Erst wenn Baseline steht

---

## Quellen

- Projektanalyse: 18 Backend-Route-Dateien (13.947 LOC gesamt), 125 Frontend-Komponenten (42.181 LOC gesamt)
- Bestehende CI: GitHub Actions (backend.yml, frontend.yml) -- nur Build+Deploy, keine Tests
- Bestehende Test-Infrastruktur: Minimal (App.test.tsx Scaffold, setupTests.ts mit Jest-DOM Mocks)
- Frontend package.json: `test.unit: vitest` und `test.e2e: cypress run` Scripts vordefiniert (aber nicht implementiert)
- Backend package.json: Kein Test-Framework installiert, nur Placeholder-Script
- database.js: Pool-Export und Migration-Runner bereits vorhanden (gute Testbarkeit)
- CLAUDE.md + MEMORY.md: Deployment via git push -> Portainer (Tests muessen VOR Deploy laufen)
