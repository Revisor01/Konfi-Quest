# Requirements: v2.12 Konfirmation + Konfispruch

**Defined:** 2026-06-09
**Core Value:** Konfis und Gemeindeleiter:innen haben eine zentrale, zuverlaessige App fuer Punkte, Events und den Konfirmationsweg.

## Milestone-Requirements

Zwei Features. Feature 1 (Konfirmations-Flag) ist klein und in sich geschlossen und kommt zuerst. Feature 2 (Konfispruch) ist groesser und baut teils auf bestehende Strukturen (Anwesenheitsmatrix, Dashboard-Settings, Jahrgaenge) auf.

### Konfirmations-Event-Flag (KONF)

Strikt analog zum bestehenden `mandatory`/Pflicht-Flag. Ersetzt die bisherige fragile String-basierte Kategorie-Erkennung durch ein echtes Boolean-Flag.

- [x] **KONF-01**: events-Tabelle hat eine neue Spalte `is_konfirmation BOOLEAN DEFAULT false` (Migration 091).
- [x] **KONF-02**: Beim Event-Erstellen (POST) und -Bearbeiten (PUT) kann `is_konfirmation` gesetzt werden, mit Validierung analog `mandatory`.
- [x] **KONF-03**: Im Event-Formular gibt es ein Toggle "Konfirmation" direkt neben "Pflicht-Event".
- [x] **KONF-04**: Mehrere Events koennen gleichzeitig das Konfirmations-Flag tragen.
- [x] **KONF-05**: Konfirmations-Events werden automatisch lila eingefaerbt und tragen einen "Konfirmation"-Hinweis als zweites Corner-Badge (bestehendes Corner-Badge-System).
- [x] **KONF-06**: Alle bestehenden String-basierten Konfirmations-Filter (`category_names` includes 'konfirmation' in EventsView.tsx, EventDetailView.tsx) sind auf das `is_konfirmation`-Flag umgestellt.
- [x] **KONF-07**: Die "Konfirmation"-Kategorie-Logik ist entfernt — es gibt keine waehlbare oder anlegbare Kategorie "Konfirmation" mehr, niemand kann sie versehentlich setzen.
- [x] **KONF-08**: Bestehende Konfirmations-Events (falls per Alt-Kategorie markiert) werden in der Migration auf das neue Flag ueberfuehrt (Datenmigration), ohne Datenverlust.

### Konfispruch-Auswahl (SPRUCH)

Konfis waehlen oder hinterlegen ihren Konfirmationsspruch. Sichtbarkeit pro Jahrgang steuerbar.

- [x] **SPRUCH-01**: Es gibt eine kuratierte Spruch-Liste in der DB (Vers-Referenz + Text je Uebersetzung), leicht per DB/Seed erweiterbar, ohne externe API.
- [x] **SPRUCH-02**: Pro Vers sind 4 Uebersetzungen hinterlegt: Luther 2017, Bibel in gerechter Sprache, Gute Nachricht, Elberfelder.
- [x] **SPRUCH-03**: konfi_profiles (oder verknuepfte Tabelle) speichert den gewaehlten Spruch eines Konfis (Referenz auf Liste ODER frei eingetragener Text + gewaehlte Uebersetzung).
- [x] **SPRUCH-04**: Konfi kann einen Spruch aus der Liste waehlen ODER einen eigenen frei eintragen.
- [x] **SPRUCH-05**: Im Auswahl-Modal wechselt eine Tableiste zwischen den 4 Uebersetzungen.
- [x] **SPRUCH-06**: Dashboard-Card "Dein Konfispruch" — Klick oeffnet das Auswahl-Modal (useIonModal).
- [x] **SPRUCH-07**: Dashboard-Sichtbarkeit ist pro Jahrgang steuerbar (neu einzufuehren, analog Punktelogik). Solange ein Admin die Spruch-Auswahl fuer einen Jahrgang verborgen haelt, koennen dessen Konfis nicht waehlen und sehen die Card nicht (bzw. nur als deaktiviert).
- [x] **SPRUCH-08**: Admin sieht den gewaehlten Spruch eines Konfis in den Konfi-Details.
- [x] **SPRUCH-09**: In der Anwesenheitsmatrix kann der Admin zwischen Ansicht "Anwesenheit" und "Spruch" umschalten.
- [x] **SPRUCH-10**: Admin kann Sprueche + Anwesenheit aus der Matrix per Nachricht verschicken.
- [x] **SPRUCH-11**: FAQ-Eintrag erklaert das Konfispruch-Feature (inkl. Hinweis auf die pro-Jahrgang-Freischaltung durch den Admin und den Konfirmations-Termin).

## Out of Scope

| Feature | Grund |
|---------|-------|
| Bibel-Verse live aus externer API (Losungen-API) | Stabilitaetssorge; kuratierte DB-Liste ist robuster und ausreichend |
| Weitere Uebersetzungen ueber die 4 hinaus | Bewusst auf 4 begrenzt; DB-Schema laesst Erweiterung spaeter zu |
| Spruch-Aenderung nach Konfirmation sperren / Workflow | Nicht Teil dieses Milestones |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| KONF-01..08 | Phase 117 | Satisfied (Audit 2026-06-10, Blocker-Fix 886d992) |
| SPRUCH-01..06 | Phase 118 | Satisfied (Verification 16/16) |
| SPRUCH-07..11 | Phase 119 | Satisfied (Verification 20/20) |
