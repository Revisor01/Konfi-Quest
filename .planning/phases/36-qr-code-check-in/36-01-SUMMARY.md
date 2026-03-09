---
phase: 36-qr-code-check-in
plan: 01
subsystem: api
tags: [jwt, qr-code, events, check-in, postgres]

requires:
  - phase: 35-opt-out-flow
    provides: event_bookings mit opted_out Status und opt_out_reason
provides:
  - POST /events/qr-checkin Endpoint mit Token-Validierung und Punkte-Vergabe
  - POST /events/:id/generate-qr Endpoint fuer Admin-Token-Generierung
  - GET /events/:id/attendance-count fuer Live-Zaehler
  - qr_token und checkin_window Spalten auf events-Tabelle
  - Check-in-Fenster Konfiguration im EventModal
affects: [36-02-qr-frontend]

tech-stack:
  added: []
  patterns: [qr-token-via-jwt, zeitfenster-check-in-postgresql, self-checkin-endpoint]

key-files:
  created: []
  modified:
    - init-scripts/01-create-schema.sql
    - backend/routes/events.js
    - frontend/src/components/admin/modals/EventModal.tsx

key-decisions:
  - "QR_SECRET Fallback auf JWT_SECRET wenn QR_SECRET nicht gesetzt"
  - "QR-Token hat kein expiresIn - Zeitfenster laeuft ueber event_date + checkin_window"
  - "Duplikat-Check: bereits eingecheckte Konfis erhalten 200 mit already_checked_in statt Fehler"
  - "Check-in-Fenster bei allen Event-Typen sichtbar (Pflicht und freiwillig)"

patterns-established:
  - "QR-Token: JWT mit eid/oid Claims, gespeichert in events.qr_token fuer Abgleich"
  - "Zeitfenster-Pruefung komplett in PostgreSQL (NOW() BETWEEN) fuer korrekte Zeitzonen"
  - "Self-Check-in Endpoint ohne requireTeamer, aber mit rbacVerifier"

requirements-completed: [QRC-01, QRC-03, QRC-04]

duration: 3min
completed: 2026-03-09
---

# Phase 36 Plan 01: QR-Code Check-in Backend + EventModal Summary

**QR-basiertes Self-Check-in mit JWT-Token-Generierung, Zeitfenster-Validierung in PostgreSQL und konfigurierbarem Check-in-Fenster im EventModal**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-09T18:44:10Z
- **Completed:** 2026-03-09T18:48:00Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments
- Drei neue Backend-Endpoints: generate-qr (Token-Erstellung), qr-checkin (Self-Check-in mit Punkte-Vergabe), attendance-count (Live-Zaehler)
- Vollstaendige Validierungs-Kette: Token-Verify, DB-Abgleich, Organisation-Check, Zeitfenster, Booking-Status, Duplikat-Check
- Check-in-Fenster im EventModal mit Stepper (5-120 Min, Default 30) und dynamischem Hinweistext
- DB-Schema erweitert mit qr_token und checkin_window Spalten + Migration-Kommentar

## Task Commits

Each task was committed atomically:

1. **Task 1: DB-Schema + Backend Endpoints** - `9742972` (feat)
2. **Task 2: Check-in-Fenster im EventModal** - `4c53445` (feat)

## Files Created/Modified
- `init-scripts/01-create-schema.sql` - qr_token (TEXT) und checkin_window (INTEGER) Spalten + Migration
- `backend/routes/events.js` - 3 neue Endpoints (qr-checkin, generate-qr, attendance-count), POST/PUT um checkin_window erweitert
- `frontend/src/components/admin/modals/EventModal.tsx` - QR Check-in Abschnitt mit Stepper-Feld

## Decisions Made
- QR_SECRET faellt auf JWT_SECRET zurueck (kein separates Secret noetig)
- QR-Token ohne expiresIn: Zeitfenster wird ueber event_date + checkin_window geprueft
- Duplikat-Check gibt 200 mit already_checked_in zurueck statt Fehler
- Check-in-Fenster ist bei allen Event-Typen sichtbar (Pflicht und freiwillig)
- qr-checkin Endpoint VOR parametrisierten /:id Routes platziert (Express Routing)

## Deviations from Plan

None - Plan exakt ausgefuehrt wie spezifiziert.

## Issues Encountered
None

## User Setup Required
Migration auf Live-DB ausfuehren:
```sql
ALTER TABLE events ADD COLUMN IF NOT EXISTS qr_token TEXT DEFAULT NULL;
ALTER TABLE events ADD COLUMN IF NOT EXISTS checkin_window INTEGER DEFAULT 30;
```

## Next Phase Readiness
- Backend komplett bereit fuer QR-Code Frontend (Plan 36-02)
- generate-qr Endpoint liefert Token fuer QR-Code-Anzeige
- qr-checkin Endpoint bereit fuer Konfi-Scanner
- attendance-count bereit fuer Live-Polling

---
*Phase: 36-qr-code-check-in*
*Completed: 2026-03-09*
