---
phase: 119-konfispruch-jahrgang-steuerzentrale
plan: 06
subsystem: website
tags: [faq, landing, konfispruch, konfirmation]
requires: []
provides:
  - "Konfispruch-FAQ-Item in landing.html"
  - "aktualisiertes Konfirmations-FAQ-Item (is_konfirmation-Event-Weg)"
affects:
  - frontend/public/landing.html
tech-stack:
  added: []
  patterns:
    - "statisches details/summary-FAQ-Item (inline-styles wie bestehende Items)"
key-files:
  created: []
  modified:
    - frontend/public/landing.html
decisions:
  - "Reines statisches HTML (D-11): keine DB-/Backend-/App-Aenderung, kein In-App-FAQ"
  - "Konfirmations-FAQ auf is_konfirmation-Event umgeschrieben (D-04): kein festes Jahrgang-Konfirmationsdatum mehr"
metrics:
  duration: "~5 min"
  completed: "2026-06-09"
  tasks_completed: 1
  tasks_total: 2
  files_modified: 1
requirements: [SPRUCH-11]
---

# Phase 119 Plan 06: Website-FAQ Konfispruch Summary

Website-FAQ in `frontend/public/landing.html` um ein Konfispruch-Item erweitert (Auswahl aus kuratierter Liste oder Freitext mit Stellenangabe, pro-Jahrgang-Freischaltung durch den Admin, Bezug zum Konfirmations-Termin) und das bestehende Konfirmations-Item auf den neuen is_konfirmation-Event-Weg korrigiert.

## Was umgesetzt wurde

- **Neues FAQ-Item "Können Konfis ihren Konfirmationsspruch hinterlegen?"** direkt nach dem Konfirmations-Item im `.faq`-Container, exakt nach dem bestehenden details/summary-Muster (gleiche inline-styles). Inhalt: Auswahl aus kuratierter Spruch-Liste oder eigener Spruch mit Stellenangabe; Auswahl wird pro Jahrgang vom Admin freigeschaltet; Bezug zum Konfirmations-Event.
- **Konfirmations-FAQ-Item aktualisiert:** Der alte Hinweis auf ein "festes Konfirmationsdatum am Jahrgang" und die "Kategorie mit Wort Konfirmation im Namen" wurde entfernt. Neuer Text: Konfirmation wird als Event mit Konfirmations-Kennzeichen angelegt; mehrere Termine = mehrere Konfirmations-Events; Dashboard zeigt den nächsten anstehenden Konfirmationstermin.

## Verifikation

Automated verify bestanden:
- `grep -q "Konfispruch"` -> vorhanden
- `grep -q "Konfirmationsspruch"` -> vorhanden
- `! grep "festes Konfirmationsdatum"` -> nicht mehr vorhanden

Deutsche Texte mit echten Umlauten (ü/ö/ä/ß), gendern (Teamer:innen) im Umfeld erhalten, "Konfis" als Plural, keine Emojis. Keine Backend-/DB-/App-Aenderung.

## Deviations from Plan

None - Task 1 wurde exakt wie geplant ausgefuehrt.

Hinweis zum Scope: Das benachbarte FAQ-Item "Können wir mehrere Jahrgänge verwalten?" erwaehnt weiterhin "ein Konfirmationsdatum" am Jahrgang. Der Plan adressiert ausdruecklich nur das eine Konfirmations-Item (Z556-559); eine Aenderung des Jahrgang-Items war nicht im Scope und wurde daher nicht vorgenommen.

## Status

- Task 1 (auto): abgeschlossen + committet (dc89af5).
- Task 2 (checkpoint:human-verify, gate="blocking"): offen — visuelle/inhaltliche Pruefung der FAQ im Browser (#faq) erforderlich. Nicht automatisierbar.

## Known Stubs

Keine.

## Tasks & Commits

| Task | Name | Commit | Files |
| ---- | ---- | ------ | ----- |
| 1 | Konfispruch-FAQ ergaenzen + Konfirmations-FAQ korrigieren | dc89af5 | frontend/public/landing.html |

## Self-Check: PASSED

- frontend/public/landing.html vorhanden
- 119-06-SUMMARY.md vorhanden
- Commit dc89af5 vorhanden (Task 1)
- Commit 9ed897e vorhanden (SUMMARY)
