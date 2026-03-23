# Requirements: Konfi Quest

**Defined:** 2026-03-23
**Core Value:** Konfis und Gemeindeleiter haben eine zentrale, zuverlaessige App fuer die Punkteverwaltung

## v2.6 Requirements

Requirements fuer Milestone v2.6 Final Polish + Bugfixes.

### Performance (PERF)

- [x] **PERF-05**: bcrypt.hashSync/compareSync durch async-Varianten ersetzen (konfi-management.js, users.js)
- [x] **PERF-06**: Badge-Progress-Berechnung: Punkte-Daten einmal vorab laden statt N+1 Query pro Badge
- [x] **PERF-07**: Notification-Insert bei Aktivitaetsantrag: Bulk-INSERT statt Schleife pro Admin

### Konfiguration (CONF)

- [x] **CONF-01**: Frontend API_BASE_URL und WS_URL ueber Umgebungsvariable konfigurierbar (VITE_API_URL)
- [x] **CONF-02**: Backend SMTP-Host und Email-Logo-URL ohne hardcodierte IP-Fallbacks
- [x] **CONF-03**: QR_SECRET als eigene Pflicht-ENV-Variable (kein Fallback auf JWT_SECRET)

### Cleanup (CLN)

- [x] **CLN-03**: Veraltete SQLite-Skripte (start:sqlite, dev:sqlite) aus backend/package.json entfernen
- [x] **CLN-04**: 3 Migrationen ohne numerisches Praefix umbenennen (add_idempotency_keys, add_invite_codes, add_push_foundation)
- [x] **CLN-05**: Losung-API-Abruf aus konfi.js und teamer.js in losungService.js extrahieren
- [x] **CLN-06**: SIGTERM-Handler in server.js fuer Docker Graceful Shutdown hinzufuegen

### Architektur (ARCH)

- [x] **ARCH-04**: LiveUpdateContext listeners Map vom Modul-Scope in den Provider verschieben (useRef)
- [x] **ARCH-05**: window.location.href in EventDetailView (Chat-Nav) und EventDetailSections (Serie-Nav) durch useIonRouter ersetzen

### Bugfixes (BUG)

- [x] **BUG-01**: Event-Detail Chat-Erstellung leitet auf schwarze Seite (window.location.href → useIonRouter)
- [x] **BUG-02**: Badge-Progress fuer streak und time_based Kriterien zeigt immer 0% (Progress-Berechnung aus badges.js extrahieren)

## Out of Scope

| Feature | Reason |
|---------|--------|
| Grosse Komponenten aufteilen | Eigener Milestone, kein funktionaler Impact |
| CSP-Header aktivieren | Ionic braucht unsafe-inline, komplexe Konfiguration |
| Test-Suite (Backend/Frontend) | Eigener Milestone (Backlog 999.2) |
| Paginierung fuer Listen-Endpoints | Erst bei EKD-Skalierung relevant |
| Code Splitting (React.lazy) | Eigener Milestone, Performance-Optimierung |
| Frontend Produktions-Monitoring (Sentry) | Eigener Milestone, Infrastruktur |
| DB Backup-Automatisierung | Server-Ops, nicht Codebase |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| PERF-05 | Phase 90 | Complete |
| PERF-06 | Phase 90 | Complete |
| PERF-07 | Phase 90 | Complete |
| CONF-01 | Phase 90 | Complete |
| CONF-02 | Phase 90 | Complete |
| CONF-03 | Phase 90 | Complete |
| CLN-03 | Phase 90 | Complete |
| CLN-04 | Phase 90 | Complete |
| CLN-05 | Phase 90 | Complete |
| CLN-06 | Phase 90 | Complete |
| ARCH-04 | Phase 91 | Complete |
| ARCH-05 | Phase 91 | Complete |
| BUG-01 | Phase 91 | Complete |
| BUG-02 | Phase 91 | Complete |

**Coverage v2.6:**
- v2.6 requirements: 14 total
- Mapped to phases: 14
- Unmapped: 0

---
*Requirements defined: 2026-03-23*
