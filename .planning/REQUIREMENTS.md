# Requirements: v2.12 Konfirmation + Konfispruch

**Defined:** 2026-06-09
**Core Value:** Konfis und Gemeindeleiter:innen haben eine zentrale, zuverlaessige App fuer Punkte, Events und den Konfirmationsweg.

## Milestone-Requirements

Zwei Features. Feature 1 (Konfirmations-Flag) ist klein und in sich geschlossen und kommt zuerst. Feature 2 (Konfispruch) ist groesser und baut teils auf bestehende Strukturen (Anwesenheitsmatrix, Dashboard-Settings, Jahrgaenge) auf.

### Konfirmations-Event-Flag (KONF)

Strikt analog zum bestehenden `mandatory`/Pflicht-Flag. Ersetzt die bisherige fragile String-basierte Kategorie-Erkennung durch ein echtes Boolean-Flag.

- [ ] **KONF-01**: events-Tabelle hat eine neue Spalte `is_konfirmation BOOLEAN DEFAULT false` (Migration 091).
- [ ] **KONF-02**: Beim Event-Erstellen (POST) und -Bearbeiten (PUT) kann `is_konfirmation` gesetzt werden, mit Validierung analog `mandatory`.
- [ ] **KONF-03**: Im Event-Formular gibt es ein Toggle "Konfirmation" direkt neben "Pflicht-Event".
- [ ] **KONF-04**: Mehrere Events koennen gleichzeitig das Konfirmations-Flag tragen.
- [ ] **KONF-05**: Konfirmations-Events werden automatisch lila eingefaerbt und tragen einen "Konfirmation"-Hinweis als zweites Corner-Badge (bestehendes Corner-Badge-System).
- [ ] **KONF-06**: Alle bestehenden String-basierten Konfirmations-Filter (`category_names` includes 'konfirmation' in EventsView.tsx, EventDetailView.tsx) sind auf das `is_konfirmation`-Flag umgestellt.
- [ ] **KONF-07**: Die "Konfirmation"-Kategorie-Logik ist entfernt — es gibt keine waehlbare oder anlegbare Kategorie "Konfirmation" mehr, niemand kann sie versehentlich setzen.
- [ ] **KONF-08**: Bestehende Konfirmations-Events (falls per Alt-Kategorie markiert) werden in der Migration auf das neue Flag ueberfuehrt (Datenmigration), ohne Datenverlust.

### Konfispruch-Auswahl (SPRUCH)

Konfis waehlen oder hinterlegen ihren Konfirmationsspruch. Sichtbarkeit pro Jahrgang steuerbar.

- [ ] **SPRUCH-01**: Es gibt eine kuratierte Spruch-Liste in der DB (Vers-Referenz + Text je Uebersetzung), leicht per DB/Seed erweiterbar, ohne externe API.
- [ ] **SPRUCH-02**: Pro Vers sind 4 Uebersetzungen hinterlegt: Luther 2017, Bibel in gerechter Sprache, Gute Nachricht, Elberfelder.
- [ ] **SPRUCH-03**: konfi_profiles (oder verknuepfte Tabelle) speichert den gewaehlten Spruch eines Konfis (Referenz auf Liste ODER frei eingetragener Text + gewaehlte Uebersetzung).
- [ ] **SPRUCH-04**: Konfi kann einen Spruch aus der Liste waehlen ODER einen eigenen frei eintragen.
- [ ] **SPRUCH-05**: Im Auswahl-Modal wechselt eine Tableiste zwischen den 4 Uebersetzungen.
- [ ] **SPRUCH-06**: Dashboard-Card "Dein Konfispruch" — Klick oeffnet das Auswahl-Modal (useIonModal).
- [ ] **SPRUCH-07**: Dashboard-Sichtbarkeit ist pro Jahrgang steuerbar (neu einzufuehren, analog Punktelogik). Solange ein Admin die Spruch-Auswahl fuer einen Jahrgang verborgen haelt, koennen dessen Konfis nicht waehlen und sehen die Card nicht (bzw. nur als deaktiviert).
- [ ] **SPRUCH-08**: Admin sieht den gewaehlten Spruch eines Konfis in den Konfi-Details.
- [ ] **SPRUCH-09**: In der Anwesenheitsmatrix kann der Admin zwischen Ansicht "Anwesenheit" und "Spruch" umschalten.
- [ ] **SPRUCH-10**: Admin kann Sprueche + Anwesenheit aus der Matrix per Nachricht verschicken.
- [ ] **SPRUCH-11**: FAQ-Eintrag erklaert das Konfispruch-Feature (inkl. Hinweis auf die pro-Jahrgang-Freischaltung durch den Admin und den Konfirmations-Termin).

## Out of Scope

| Feature | Grund |
|---------|-------|
| Bibel-Verse live aus externer API (Losungen-API) | Stabilitaetssorge; kuratierte DB-Liste ist robuster und ausreichend |
| Weitere Uebersetzungen ueber die 4 hinaus | Bewusst auf 4 begrenzt; DB-Schema laesst Erweiterung spaeter zu |
| Spruch-Aenderung nach Konfirmation sperren / Workflow | Nicht Teil dieses Milestones |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| KONF-01..08 | Phase 117 | Pending |
| SPRUCH-01..11 | Phase 118+ | Pending |
