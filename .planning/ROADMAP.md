# Roadmap

## Abgeschlossene Milestones

- **v2.11** Admin/Teamer Design-Angleichung + Launch-Haertung (Shipped 2026-06-01) — Konfi-UI-Polish, DSGVO-Loeschung, Konfi-Limits, Badge-Erweiterung, Voll-Audit (42 Fixes). Archiv: [milestones/v2.11-ROADMAP.md](milestones/v2.11-ROADMAP.md)

## Aktueller Milestone: v2.12 Konfirmation + Konfispruch

**Ziel:** Konfirmation als sauberes Event-Flag etablieren und den Konfis ihren Konfirmationsspruch in der App zugaenglich machen (Auswahl/Eintrag, Dashboard, Admin-Einsicht und -Versand), pro Jahrgang freischaltbar.

### Phase 117 — Konfirmations-Event-Flag

**Liefert:** KONF-01..08

Echtes `is_konfirmation`-Boolean-Flag auf Events, strikt analog zum bestehenden `mandatory`-Flag. Ersetzt die fragile String-basierte Kategorie-Erkennung. Migration 091 inkl. Datenueberfuehrung bestehender Konfirmations-Events. Toggle im Event-Formular, automatische lila Faerbung + zweites Corner-Badge "Konfirmation". Entfernt die waehlbare/anlegbare Konfirmation-Kategorie.

**Abhaengigkeiten:** keine. In sich geschlossen, klein. Referenz-Implementierung ist `mandatory`.

**Plans:** 2 plans (2 Wellen)
- [ ] 117-01-PLAN.md — Migration 091 (Spalte + Datenueberfuehrung + Kategorie-Bereinigung) + Backend is_konfirmation analog mandatory + Integrationstests
- [ ] 117-02-PLAN.md — Frontend: Toggle, lila Faerbung + zweites Corner-Badge, String-Filter auf Flag umgestellt + Human-Verify

### Phase 118 — Konfispruch: Datenmodell + Konfi-Auswahl

**Liefert:** SPRUCH-01..06

Kuratierte Spruch-Liste in der DB (Vers + 4 Uebersetzungen, seed-/db-erweiterbar). Speicherung des gewaehlten Spruchs am Konfi-Profil (Listen-Referenz ODER Freitext + gewaehlte Uebersetzung). Auswahl-Modal mit Uebersetzungs-Tableiste (Luther 2017 / Bibel in gerechter Sprache / Gute Nachricht / Elberfelder). Dashboard-Card "Dein Konfispruch" -> useIonModal.

**Abhaengigkeiten:** keine harte. Eigenstaendig nutzbar.

**Plans:** 2/2 plans complete
- [x] 118-01-PLAN.md — Migration 093 (konfsprueche + konfspruch_uebersetzungen + konfi_profiles-Spalten + Referenz-Seed) + Backend GET /konfsprueche, GET/PATCH /profile + truncateAll + Integrationstests
- [x] 118-02-PLAN.md — Frontend: Dashboard-Card "Dein Konfispruch" + KonfispruchSelectModal (4 Uebersetzungs-Tabs + Freitext mit Pflicht-Referenz) + CSS + Human-Verify

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

## Naechster Milestone

v3.0 Launch (Onboarding + Landing) — siehe MEMORY.md "Geplante Milestones".
