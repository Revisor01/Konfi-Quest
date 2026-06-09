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

### Phase 119 — Konfispruch: Pro-Jahrgang-Freischaltung + Admin-Integration

**Liefert:** SPRUCH-07..11

Dashboard-Sichtbarkeit pro Jahrgang (neu, analog Punktelogik) als Gate fuer die Spruch-Auswahl. Admin sieht Sprueche in Konfi-Details. Anwesenheitsmatrix: Umschalten Anwesenheit/Spruch + Versand per Nachricht. FAQ-Eintrag (inkl. Konfirmations-Termin-Hinweis).

**Abhaengigkeiten:** Phase 118 (Spruch-Datenmodell). Nutzt Phase 117 (Konfirmation-Flag) thematisch im FAQ.

## Naechster Milestone

v3.0 Launch (Onboarding + Landing) — siehe MEMORY.md "Geplante Milestones".
