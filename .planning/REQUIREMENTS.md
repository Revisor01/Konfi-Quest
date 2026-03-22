# Requirements: Konfi Quest

**Defined:** 2026-03-22
**Core Value:** Konfis und Gemeindeleiter haben eine zentrale, zuverlaessige App fuer die Punkteverwaltung

## v2.4 Requirements

Requirements fuer Milestone v2.4 Codebase-Cleanup.

### React Router Migration (RR)

- [x] **RR-01**: Alle useHistory-Aufrufe durch useIonRouter ersetzen (Ionic 8 unterstuetzt kein React Router v6, useIonRouter ist der offizielle Ersatz)
- [x] **RR-02**: Alle history.push/replace/goBack in Konfi-, Teamer- und Admin-Bereichen auf useIonRouter.push/goBack migrieren
- [x] **RR-03**: App funktioniert nach Migration identisch (keine gebrochenen Navigationen)

### Inline-Migrationen (MIG)

- [ ] **MIG-01**: Alle Inline-Schema-Checks und ALTERs aus Route-Dateien entfernen (badges.js, jahrgaenge.js, wrapped.js)
- [ ] **MIG-02**: Schema-Aenderungen in dedizierte SQL-Migrationsdateien unter backend/migrations/ verschieben (falls noch nicht vorhanden)
- [ ] **MIG-03**: Server startet sauber ohne Inline-Migrationen

### Cron-System (CRON)

- [ ] **CRON-01**: Wrapped-Cron von setInterval(24h) auf node-cron mit echtem Zeitplan umstellen
- [ ] **CRON-02**: Nach Container-Neustart wird die naechste geplante Ausfuehrung korrekt berechnet (kein Verpassen von Triggern)

### Sicherheit (SEC)

- [x] **SEC-01**: Losung-API-Key aus Quellcode in Umgebungsvariable LOSUNG_API_KEY auslagern (konfi.js + teamer.js)
- [ ] **SEC-02**: Socket.IO Room-Join prueft Organization-Zugehoerigkeit des Rooms vor socket.join()
- [ ] **SEC-03**: Nutzer aus Org A kann nicht in Rooms von Org B joinen

### Performance (PERF)

- [ ] **PERF-01**: Chat-Nachrichten-Endpoint laedt Reactions und Poll-Votes per Bulk-Query (WHERE message_id = ANY($1::int[]))
- [ ] **PERF-02**: Max. 3 DB-Queries pro /rooms/:id/messages Request statt N+1

### Capacitor-Imports (CAP)

- [ ] **CAP-01**: Alle (window as any).Capacitor Zugriffe in AppContext.tsx durch typsichere Capacitor-Plugin-Imports ersetzen
- [ ] **CAP-02**: TypeScript meldet keine any-Fehler fuer Capacitor-Plugin-Zugriffe

### Cleanup (CLN)

- [ ] **CLN-01**: sqlite3 aus backend/package.json dependencies entfernen
- [ ] **CLN-02**: SQLite-DB-Dateien (backend/data/*.db) aus Repository entfernen und in .gitignore aufnehmen
- [ ] **CLN-03**: Legacy-Multer upload aus server.js entfernen und alle Stellen auf requestUpload/materialUpload migrieren
- [ ] **CLN-04**: Deprecated FileViewerModal.tsx aus chat/modals/ loeschen
- [ ] **CLN-05**: crypto require in server.js an den Anfang der Datei verschieben
- [ ] **CLN-06**: SMTP_SECURE Bug fixen (|| true entfernen)
- [ ] **CLN-07**: konfi-managment.js in konfi-management.js umbenennen (Typo)
- [ ] **CLN-08**: activity_requests.konfi_id in user_id umbenennen (Schema-Konsistenz)
- [ ] **CLN-09**: express-validator Validierung auf material.js und teamer.js ergaenzen

## Out of Scope

| Feature | Reason |
|---------|--------|
| TLS-Zertifikatsvalidierung fuer SMTP | Server und Mail auf gleichem Host, bewusst so |
| Test-Suite | Eigener Milestone (Backlog 999.2) |
| Grosse Dateien aufteilen | Eigener Milestone (Backlog 999.3) |
| Design-Angleich | Eigener Milestone (Backlog 999.1) |
| Admin-Views auf useOfflineQuery migrieren | Nicht kritisch, separater Aufwand |
| Hardcodierte API-URLs | Capacitor-Limitation, kein einfacher Fix |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| RR-01 | Phase 81 | Complete |
| RR-02 | Phase 81 | Complete |
| RR-03 | Phase 81 | Complete |
| SEC-01 | Phase 82 | Complete |
| SEC-02 | Phase 82 | Pending |
| SEC-03 | Phase 82 | Pending |
| CRON-01 | Phase 82 | Pending |
| CRON-02 | Phase 82 | Pending |
| PERF-01 | Phase 83 | Pending |
| PERF-02 | Phase 83 | Pending |
| CAP-01 | Phase 83 | Pending |
| CAP-02 | Phase 83 | Pending |
| MIG-01 | Phase 84 | Pending |
| MIG-02 | Phase 84 | Pending |
| MIG-03 | Phase 84 | Pending |
| CLN-01 | Phase 85 | Pending |
| CLN-02 | Phase 85 | Pending |
| CLN-03 | Phase 85 | Pending |
| CLN-04 | Phase 85 | Pending |
| CLN-05 | Phase 85 | Pending |
| CLN-06 | Phase 85 | Pending |
| CLN-07 | Phase 85 | Pending |
| CLN-08 | Phase 85 | Pending |
| CLN-09 | Phase 85 | Pending |

**Coverage v2.4:**
- v2.4 requirements: 22 total
- Mapped to phases: 22
- Unmapped: 0

---
*Requirements defined: 2026-03-22*
