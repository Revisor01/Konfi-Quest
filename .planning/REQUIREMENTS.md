# Requirements: Konfi Quest

**Defined:** 2026-03-23
**Core Value:** Konfis und Gemeindeleiter haben eine zentrale, zuverlaessige App fuer die Punkteverwaltung

## v2.7 Requirements

Requirements fuer Milestone v2.7 Backend-Hardening.

### Sicherheit (SEC)

- [ ] **SEC-07**: Alle Auth-Routes (change-password, update-email, update-role-title, me, invite-code, logout) nutzen verifyTokenRBAC statt verifyToken — gesperrte/deaktivierte User werden sofort blockiert
- [ ] **SEC-08**: Upload-Filter validiert Dateitypen zusaetzlich ueber Magic-Bytes (file-type Paket) statt nur Client-MIME-Header

### Performance (PERF)

- [x] **PERF-08**: backgroundService Badge-Check nutzt Bulk-SQL statt N+1 pro User (checkAndAwardBadges + Chat-Unread in einer Query)
- [x] **PERF-09**: verifyTokenRBAC cached User-Objekte in LRU-Cache (30s TTL) statt DB-Query bei jedem Request

### Architektur (ARCH)

- [ ] **ARCH-06**: chatUtils erstellt Raeume mit dynamischem Admin (erster aktiver Admin der Organisation) statt hardcodiertem created_by=1
- [ ] **ARCH-07**: Event-Buchungslogik (Waitlist, Cancel, Nachruecken) liegt in bookingUtils.js — konfi.js und events.js delegieren dorthin
- [ ] **ARCH-08**: useOfflineQuery Fetcher-Referenzen sind stabil (useCallback oder internes Ref-Pattern) — keine redundanten Revalidierungen bei Re-Render

## Out of Scope

| Feature | Reason |
|---------|--------|
| Grosse Route-Dateien aufteilen (events 2071, konfi 2052 Zeilen) | Eigener Milestone, erfordert umfangreiche Restructuring |
| CSP-Header aktivieren | Ionic braucht unsafe-inline |
| Test-Suite | Eigener Milestone |
| Logging-Framework (console.* ersetzen) | Eigener Milestone |
| DB-Backup-Automatisierung | Server-Ops |
| TLS-Zertifikatsvalidierung SMTP | Bewusst deaktiviert, interner Server |
| verifyToken komplett entfernen | Erst nach Migration aller Routes evaluieren |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| SEC-07 | Phase 92 | Pending |
| SEC-08 | Phase 92 | Pending |
| PERF-08 | Phase 92 | Complete |
| PERF-09 | Phase 92 | Complete |
| ARCH-06 | Phase 93 | Pending |
| ARCH-07 | Phase 93 | Pending |
| ARCH-08 | Phase 93 | Pending |

**Coverage v2.7:**
- v2.7 requirements: 7 total
- Mapped to phases: 7
- Unmapped: 0

---
*Requirements defined: 2026-03-23*
