### Phase 119 — Konfispruch-Integration + Jahrgang-Steuerzentrale

**Liefert:** SPRUCH-07..11

Scope in Discuss (2026-06-09) bewusst erweitert zur **Jahrgang-Steuerzentrale**. Mehrere Plans:
- **Jahrgang-Steuerzentrale** (Modal + Liste umbauen): pro Jahrgang Punkteziele, Konfispruch-Freischaltung (Toggle konfspruch_enabled), Wrapped-Freigabe (Toggle); Liste zeigt Punkteziele + Wrapped-Status (ob/wann) + Spruch-Freigabe. Erklaertext erweitert.
- **Konfispruch-Gate (SPRUCH-07):** Card erscheint nur bei konfspruch_enabled=true, sonst komplett weg.
- **Wrapped-Toggle-Logik:** Konfi-Wrapped per Jahrgang-Toggle getriggert (An=generieren mit Warnhinweis, Aus=loeschen, gefahrlos testbar) statt Cron. Teamer-Wrapped automatisch am 6.1. jedes Jahres (Cron umstellen).
- **Konfirmations-Termin-Umzug (Datenmodell):** jahrgaenge.confirmation_date faellt GANZ weg (nirgends mehr beruecksichtigt, auch nicht im Konfi-Dashboard/Wrapped-Cron); Termin lebt nur noch als Konfi-Event (is_konfirmation, Phase 117).
- **Admin-Einsicht (SPRUCH-08):** gewaehlter Spruch in Konfi-Details (read-only Section).
- **Anwesenheitsmatrix (SPRUCH-09/10):** Umschaltung Anwesenheit/Spruch (Spruch = Liste Konfi->Spruch); Admin laesst sich Anwesenheit ODER Sprueche-Liste (mit Name + Konfirmationstermin) **per E-Mail an sich selbst** schicken (fuers Buero).
- **FAQ (SPRUCH-11):** NUR auf der Website (statisches HTML in frontend/public/), NICHT in der App. Eigener kleiner Plan.

**Abhaengigkeiten:** Phase 118 (Spruch-Datenmodell), Phase 117 (Konfirmation-Event-Flag = Termin-Quelle nach confirmation_date-Wegfall). Siehe 119-CONTEXT.md.

**Plans:** 6/6 plans complete
- [x] 119-01-PLAN.md — Migration 094 (jahrgaenge.konfspruch_enabled) + jahrgaenge.js POST/PUT akzeptiert Flag, confirmation_date als Pflicht entkoppelt [Wave 1]
- [x] 119-02-PLAN.md — confirmation_date-Umzug Backend: Wrapped-Cron auf 6.1. + Konfi-Cron raus, Auto-Loesch-Service + Konfi-Dashboard/Profile auf is_konfirmation-Event, konfspruch_visible-Flag [Wave 2]
- [x] 119-03-PLAN.md — Frontend Jahrgang-Steuerzentrale (Modal: konfspruch_enabled + Wrapped-Toggle, kein Konfirmationsdatum; Liste erweitert) + Konfispruch-Card-Gate [Wave 3]
- [x] 119-04-PLAN.md — Admin-Einsicht (SPRUCH-08): Konfispruch in konfi-management GET /:id + read-only KonfispruchSection [Wave 1]
- [x] 119-05-PLAN.md — Anwesenheitsmatrix (SPRUCH-09/10): Backend Sprueche-Liste + E-Mail-Versand (emailService) + Frontend IonSegment Anwesenheit/Spruch + Mail-Button [Wave 2]
- [x] 119-06-PLAN.md — FAQ (SPRUCH-11): Konfispruch-Eintrag + Konfirmations-Eintrag-Korrektur in landing.html [Wave 1]

## Naechster Milestone

v3.0 Launch (Onboarding + Landing) — siehe MEMORY.md "Geplante Milestones".
