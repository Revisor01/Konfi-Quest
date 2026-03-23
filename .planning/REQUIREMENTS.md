# Requirements: Konfi Quest

**Defined:** 2026-03-23
**Core Value:** Konfis und Gemeindeleiter haben eine zentrale, zuverlaessige App fuer die Punkteverwaltung

## v2.5 Requirements

Requirements fuer Milestone v2.5 Security-Hardening + Polish.

### Sicherheit (SEC)

- [ ] **SEC-01**: Backend-Endpoint POST /api/auth/logout revokiert das aktive Refresh Token (revoked_at = NOW())
- [ ] **SEC-02**: Frontend-Logout ruft /api/auth/logout auf bevor lokale Daten geloescht werden
- [ ] **SEC-03**: Losung-API-Key Fallback-Wert aus konfi.js und teamer.js entfernen (nur process.env, kein Fallback)
- [ ] **SEC-04**: Passwort-Minimum von 6 auf 8 Zeichen erhoehen (auth.js + validation.js)
- [ ] **SEC-05**: Chat-Nachrichten Laengenlimit isLength({ max: 4000 }) in Validierung
- [ ] **SEC-06**: Socket.IO typing/stopTyping Events pruefen Org-Zugehoerigkeit vor Weiterleitung

### Performance (PERF)

- [ ] **PERF-01**: Chat-Raum-Uebersicht: Direct-Message-Namen per JOIN statt N+1 Query laden
- [ ] **PERF-02**: Chat-Raum-Sortierung: korrelierte Subquery durch LATERAL Join oder last_message_at Spalte ersetzen
- [ ] **PERF-03**: Wrapped-Snapshot-Generierung: Queries pro Konfi parallel mit Promise.all statt sequenziell
- [ ] **PERF-04**: DB Pool-Limit explizit konfigurieren (max, idleTimeoutMillis, connectionTimeoutMillis)

### Architektur (ARCH)

- [ ] **ARCH-01**: global.io durch Dependency Injection ersetzen (io als Parameter an Routes wie db)
- [ ] **ARCH-02**: material.js Legacy Single-ID Felder (event_id, jahrgang_id) entfernen, nur Array-Format
- [ ] **ARCH-03**: Migrations-System mit schema_migrations Versionstabelle (nur neue Migrationen ausfuehren)

### Cleanup (CLN)

- [ ] **CLN-01**: Wrapped-Cron doppelter Date-Guard entfernen (node-cron Schedule reicht)
- [ ] **CLN-02**: useOfflineQuery Stale-Closure Fix (data aus revalidate-Closure entfernen, setData nutzen)

## Out of Scope

| Feature | Reason |
|---------|--------|
| CSP-Header aktivieren | Ionic braucht unsafe-inline, komplexe Konfiguration, geringes Risiko |
| Backend TypeScript Migration | Zu grosser Aufwand, eigener Milestone |
| Test-Suite | Eigener Milestone (Backlog 999.2) |
| Grosse Dateien aufteilen | Eigener Milestone (Backlog 999.3) |
| Error-Monitoring (Sentry) | Eigener Milestone, Infrastruktur-Entscheidung |
| TLS-Validierung SMTP | Bewusst deaktiviert, gleicher Server |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|

**Coverage v2.5:**
- v2.5 requirements: 15 total
- Mapped to phases: 0
- Unmapped: 15

---
*Requirements defined: 2026-03-23*
