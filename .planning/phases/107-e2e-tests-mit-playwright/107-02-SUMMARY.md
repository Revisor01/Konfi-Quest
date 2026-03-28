---
phase: 107-e2e-tests-mit-playwright
plan: 02
subsystem: testing/e2e
tags: [playwright, e2e, punkte-vergabe, event-buchung, chat]
dependency_graph:
  requires: [e2e/helpers/auth.ts, e2e/login.spec.ts, backend/tests/helpers/seed.js]
  provides: [e2e/punkte-vergabe.spec.ts, e2e/event-buchung.spec.ts, e2e/chat.spec.ts]
  affects: []
tech_stack:
  added: []
  patterns: [ionic-e2e-selektoren, multi-page-browser-context, seed-data-referenz]
key_files:
  created: [e2e/punkte-vergabe.spec.ts, e2e/event-buchung.spec.ts, e2e/chat.spec.ts]
  modified: []
decisions:
  - "ActivityModal Submit via CSS-Klasse .app-modal-submit-btn--activities statt Text-Selektor"
  - "Chat-Test nutzt browser.newPage() fuer zwei unabhaengige Sessions statt page.goto Wechsel"
  - "Event-Buchung prueft Anmelden-Button via .app-action-button Klasse"
metrics:
  duration_seconds: 85
  completed: "2026-03-28T07:55:24Z"
---

# Phase 107 Plan 02: User-Journey E2E Tests Summary

3 geschaeftskritische User-Journeys als Playwright E2E Tests: Punkte-Vergabe (Admin->Konfi), Event-Buchung (Konfi), Chat-Nachricht (Konfi->Admin)

## Was gebaut wurde

### Punkte-Vergabe E2E (e2e/punkte-vergabe.spec.ts)
- Admin loggt sich ein, navigiert zu /admin/konfis, oeffnet Test Konfi 1
- Klickt "Aktivitaet hinzufuegen", waehlt Sonntagsgottesdienst im ActivityModal
- Speichert via .app-modal-submit-btn--activities
- Wechselt zu konfi1-Login, prueft Dashboard auf sichtbare Punkte
- 49 Zeilen, nutzt loginAs helper und Seed-Daten (admin1, konfi1, Activity id=1)

### Event-Buchung E2E (e2e/event-buchung.spec.ts)
- Konfi loggt sich ein, navigiert zu /konfi/events
- Oeffnet Weihnachtsgottesdienst, klickt Anmelden-Button (.app-action-button)
- Prueft Buchungsbestaetigung (Abmelden/Gebucht/Angemeldet Text)
- Navigiert zurueck zur Liste, prueft Event-Sichtbarkeit
- 36 Zeilen, nutzt loginAs helper und Seed-Daten (konfi1, Event id=1)

### Chat E2E (e2e/chat.spec.ts)
- konfi1 oeffnet Jahrgangs-Chat (Jahrgang 2025/2026), sendet unique Nachricht
- IonTextarea mit placeholder "Nachricht schreiben..." und runder Sende-Button
- admin1 oeffnet denselben Chat-Raum via /admin/chat
- Prueft ob die unique Nachricht beim Empfaenger sichtbar ist
- 56 Zeilen, nutzt browser.newPage() fuer parallele Sessions

## Commits

| Task | Commit | Beschreibung |
|------|--------|-------------|
| 1 | 5593640 | Punkte-Vergabe E2E Test |
| 2 | 4d996a3 | Event-Buchung E2E Test |
| 3 | 9065eec | Chat E2E Test |

## Deviations from Plan

None - Plan exakt wie beschrieben umgesetzt. Selektoren an tatsaechliche UI-Klassen angepasst (per Plan-Anweisung).

### Hinweis: Docker nicht lokal verfuegbar
Docker war auf dem Entwicklungsrechner nicht installiert. Alle Artefakte wurden erstellt und syntaktisch geprueft (balanced braces, korrekte Imports), aber der E2E Stack konnte nicht live getestet werden. Tests muessen bei Docker-Verfuegbarkeit manuell verifiziert werden.

## Known Stubs

Keine -- alle Test-Dateien sind vollstaendig implementiert mit echten Selektoren basierend auf der tatsaechlichen UI-Struktur.

## Self-Check: PASSED

- 3/3 Dateien vorhanden (punkte-vergabe, event-buchung, chat)
- 3/3 Commits gefunden (5593640, 4d996a3, 9065eec)
