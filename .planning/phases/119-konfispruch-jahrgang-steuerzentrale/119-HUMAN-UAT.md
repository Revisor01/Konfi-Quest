---
status: partial
phase: 119-konfispruch-jahrgang-steuerzentrale
source: [119-VERIFICATION.md]
started: 2026-06-09T12:00:00Z
updated: 2026-06-09T12:00:00Z
---

## Current Test

[awaiting human testing — erfordert Xcode-Build + Geraet/Simulator]

## Tests

### 1. Jahrgang-Steuerzentrale (Modal + Liste)
expected: Kein Konfirmationsdatum-Feld; Toggle 'Konfispruch-Auswahl' + (bei bestehendem Jahrgang) 'Wrapped freigeben'. Wrapped ein -> Warnhinweis -> bestaetigen -> Erfolg. Liste zeigt Wrapped-Status + Spruch-Freigabe + Punkteziele.
result: [pending]

### 2. Konfispruch-Card-Gate (SPRUCH-07)
expected: konfspruch_enabled aus -> Konfi-Dashboard zeigt KEINE Konfispruch-Card; wieder an -> Card erscheint.
result: [pending]

### 3. Admin-Einsicht Konfispruch + Konfirmationstermin (SPRUCH-08 + Punkt B)
expected: Konfi-Details zeigen 'Konfirmation'-Section: Termin (Wochentag + Datum + Uhrzeit + Ort) read-only ueber dem Spruch. Spruch aus Liste -> Referenz + Text; Freitext -> Text + Referenz; kein Spruch -> Hinweis. Kein Termin -> 'Noch kein Konfirmationstermin festgelegt'.
result: [pending]

### 4. Matrix Umschaltung + E-Mail-Versand (SPRUCH-09, SPRUCH-10)
expected: Segment Anwesenheit/Spruch; Spruch-Ansicht ist Liste (kein Zellen-Layout); E-Mails kommen an eigene Adresse; Admin ohne E-Mail -> Fehlermeldung.
result: [pending]

### 5. FAQ landing.html im Browser (SPRUCH-11)
expected: Konfispruch-FAQ-Item vorhanden; Konfirmations-Item beschreibt Konfirmations-Event; echte Umlaute; keine Emojis.
result: [pending]

### 6. Konfirmationstermin-Sicht-Check Konfi (W3)
expected: Tage-bis-Konfirmation im Konfi-Dashboard/Profil stammen aus dem is_konfirmation-Event. Kein Event -> kein Termin/keine Tage-Anzeige (Card bleibt ausgeblendet — bewusst so).
result: [pending]

### 7. Event-Modal: Datumspicker + Schliessen-Abfrage (Zusatz-Fix)
expected: Alle Datumspicker (Event-Datum, Ende, Anmeldung auf/zu) waehlbar bis Ende uebernaechstes Jahr (Termine 12+ Monate voraus). Bei ungespeicherten Aenderungen Abfrage 'Verwerfen?' bei X-Button UND Swipe-down UND Backdrop-Tap.
result: [pending]

### 8. Konfirmations-Event: keine Punkte + Lila/Badge (Zusatz-Fix)
expected: Event mit Toggle 'Konfirmation' -> keine Punkte-Auswahl im Modal, keine Punkte vergeben. Teilnehmer:innen/Warteliste/Zeitfenster bleiben. In der Admin-Events-Liste: Konfirmation lila eingefaerbt + lila Corner-Badge (Flamme).

## Summary

total: 8
passed: 0
issues: 0
pending: 8
skipped: 0
blocked: 0

## Gaps
