---
gsd_state_version: 1.0
milestone: v1.7
milestone_name: Unterricht + Pflicht-Events
status: unknown
last_updated: "2026-03-09T18:57:58.194Z"
progress:
  total_phases: 12
  completed_phases: 12
  total_plans: 21
  completed_plans: 21
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-09)

**Core value:** Konfis und Gemeindeleiter haben eine zentrale, zuverlaessige App fuer die Punkteverwaltung
**Current focus:** v1.7 Phase 36 -- QR-Code Check-in

## Current Position

Phase: 36 of 37 (QR-Code Check-in)
Plan: 2 of 2
Status: Plan 36-02 complete
Last activity: 2026-03-09 -- Plan 36-02 abgeschlossen (QR-Code Frontend Modals + View-Integration)

Progress: [################----] 80%

## Performance Metrics

**Velocity:**
- Total plans completed: 6
- Average duration: 17min
- Total execution time: 99min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 34 | 2/2 | 88min | 44min |
| 35 | 2/2 | 5min | 2.5min |
| 36 | 2/2 | 6min | 3min |

*Updated after each plan completion*

## Accumulated Context

### Decisions

All v1.0-v1.6 decisions archived in PROJECT.md Key Decisions table.

- [Phase 34-01] Punkte-Guard: mandatory Events erzwingen immer points=0, unabhaengig vom Frontend-Input
- [Phase 34-01] Auto-Enrollment nach COMMIT mit db.query statt client.query fuer Nachtrags-Hooks
- [Phase 34-01] max_participants=0 bedeutet unbegrenzte Teilnehmer bei Pflicht-Events
- [Phase 34-02] Pflicht-Toggle blendet 6 Felder aus (Punkte, TN, Zeitfenster, Warteliste, Anmeldezeitraum)
- [Phase 34-02] Konfi sieht "automatisch angemeldet" statt Anmelde-Button bei Pflicht-Events
- [Phase 34-02] Solid Icons (shieldCheckmark, bagHandle) fuer Pflicht/Mitbringen-Indikatoren
- [Phase 35-01] Opt-out als Status-Wechsel (confirmed -> opted_out) statt Booking loeschen
- [Phase 35-01] opt_out_reason bleibt bei Opt-in erhalten (per User-Decision)
- [Phase 35-01] DELETE-Guard verhindert Abmeldung von Pflicht-Events ueber alten Endpoint
- [Phase 35-02] Separater useIonModal-Hook fuer Opt-out Modal mit mandatory=true
- [Phase 35-02] X/Y Zaehler bei Pflicht-Events: confirmed/gesamt (entspricht Jahrgangs-Groesse)
- [Phase 35-02] Opted_out Teilnehmer bleiben inline in Teilnehmerliste (keine separate Sektion)
- [Phase 36-01] QR_SECRET faellt auf JWT_SECRET zurueck wenn nicht separat gesetzt
- [Phase 36-01] QR-Token ohne expiresIn, Zeitfenster ueber event_date + checkin_window
- [Phase 36-01] Duplikat-Check gibt 200 mit already_checked_in statt Fehler
- [Phase 36-01] Check-in-Fenster bei allen Event-Typen sichtbar (Pflicht + freiwillig)
- [Phase 36-02] Android CAMERA Permission uebersprungen (kein android-Ordner vorhanden)
- [Phase 36-02] Scanner-Feedback als inline Banners ueber Video-Feed statt Toast
- [Phase 36-02] QR-Display-Button im Admin-Header neben Edit-Button platziert

### Pending Todos

None.

### Blockers/Concerns

- Research-Flag Phase 36: QR-Scan-Richtung muss entschieden werden (Konfi scannt Event-QR vs. Admin scannt Konfi-QR). Research empfiehlt: Konfi scannt Event-QR (skaliert besser).
- ERLEDIGT: CHECK-Constraint auf event_bookings.status wurde in Phase 34-01 synchronisiert.
- ERLEDIGT: Opt-out-Endpunkt gebaut (Phase 35-01), DELETE-Guard verhindert Missbrauch bei Pflicht-Events.

## Session Continuity

Last session: 2026-03-09
Stopped at: Phase 37 context gathered
Resume file: .planning/phases/37-dashboard-widget-anwesenheitsstatistik/37-CONTEXT.md
