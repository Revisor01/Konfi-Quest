# Project Retrospective

*A living document updated after each milestone. Lessons feed forward into future planning.*

## Milestone: v1.0 -- Security + Stabilisierung

**Shipped:** 2026-03-01
**Phases:** 2 | **Plans:** 5 | **Sessions:** ~5

### What Was Built
- helmet Security Headers + express-validator Input-Validierung auf allen 15 Backend-Routes
- Multi-Tenant-Isolation: notifications.js und settings.js mit organization_id-Filterung
- SQL-Injection-Fix: getPointField Whitelist in 8 dynamischen SQL-Stellen
- TabBar CSS-only Rendering (registerTabBarEffect entfernt)
- Theme-Isolation: iOS26/MD3 koexistieren mit Platform-scoped Overrides
- Badge-Punkte-Absicherung: Fallback-Pfad entfernt, nur konfi_profiles Werte

### What Worked
- Wave-basierte Parallelisierung: Plans 01-01 und 01-02 parallel, ebenso 02-01 und 02-02 -- halbe Wartezeit
- Checkpoint-System fuer Live-Daten-Verifikation (02-02 Task 3) -- sichergestellt dass DB-Werte konsistent sind
- Zentrale validation.js Middleware -- einmal gebaut, 15x verwendet
- Research-Phase vor Planung (Theme-Analyse, TabBar-Bug-Investigation) -- Plans waren praezise

### What Was Inefficient
- rateLimitMessage Property in api.ts implementiert, aber kein Konsument -- Wiring-Gap erst im Integration-Check entdeckt
- Phase 1 Checkbox in ROADMAP.md nicht auf [x] gesetzt (nur Phase 2) -- Tooling-Gap
- Container-Name Diskrepanz (konfi-quest-db-1 vs konfi_quest-postgres-1) -- haette in CLAUDE.md dokumentiert sein sollen

### Patterns Established
- getPointField Whitelist-Pattern fuer dynamische SQL-Spaltennamen
- Platform-scoped CSS Overrides (.md/.ios) fuer Theme-Isolation
- Badge-Punkte nur aus konfi_profiles lesen, nie manuell berechnen
- commonValidations Wiederverwendung fuer express-validator

### Key Lessons
1. Immer Integration-Check nach Phase-Completion -- Wiring-Gaps werden sonst erst spaet entdeckt
2. Live-DB-Verifikation bei Datenlogik-Aenderungen -- Code-Review allein reicht nicht
3. CSS-only Ansaetze bevorzugen vor JS-basierten DOM-Manipulationen (registerTabBarEffect war unnoetig)

### Cost Observations
- Model mix: ~70% opus (execution), ~30% sonnet (verification)
- Sessions: ~5 Sessions ueber 2 Tage
- Notable: Gesamte Execution in ~22 Minuten aktive Planausfuehrung (5 Plans, Durchschnitt 4min)

---

## Milestone: v1.1 -- Design-Konsistenz

**Shipped:** 2026-03-02
**Phases:** 5 | **Plans:** 17 | **Sessions:** ~8

### What Was Built
- Shared Components (SectionHeader, EmptyState, ListSection) mit Preset-Farbsystem in 17 Views
- 100+ CSS-Utility-Klassen in variables.css (app-header-banner, app-stats-row, app-modal-*, app-icon-color--*, app-auth-*)
- Alle 22 Admin- und Konfi-Views auf konsistentes Design-System umgestellt
- 28 Modale von isOpen-Pattern auf useIonModal migriert
- iOS Card-Modal Backdrop-Effekt und Unsaved-Changes-Schutz (isDirtyRef)
- QR-Code Onboarding: Auto-Login, differenzierte Fehlermeldungen, Username-Verfuegbarkeitspruefung, JWT 90d

### What Worked
- Wave-basierte Parallelisierung: Plans 03-02/03-03, 04-02/03/04, 05-02/05-03, 06-02/06-03 liefen parallel
- CSS-Klassen-First-Ansatz: Klassen in Wave 1 definieren, in Wave 2 anwenden -- keine Abhaengigkeits-Konflikte
- Domain-Farb-Zuordnung frueh festgelegt (Phase 6): Events=Rot, Activities=Gruen, etc. -- konsistente Anwendung danach
- Audit-Workflow am Ende: 22/22 Requirements automatisch verifiziert, nur 1 minor CSS-Gap gefunden
- Verification-Reports pro Phase: Automatische Must-Have-Checks + Human-Verification-Items getrennt

### What Was Inefficient
- Phase 4/5 Inline-Style-Ziele (unter 5/unter 40) zu ambitioniert -- viele Inline-Styles sind Ionic-Patterns (Custom Properties, dynamische Werte)
- console.log Debug-Statements in 4 Dateien erst im Audit entdeckt -- sollte in Plan-Completion-Checkliste
- Emoji-Violation in ActivityManagementModal erst im Audit -- Pre-Commit-Hook waere besser
- Phase 7 ROADMAP.md zeigte 0/3 Plans obwohl alle fertig -- Phase-Completion-Update fehlte

### Patterns Established
- app-section-icon--{domain} Pattern fuer Section-Icons in Modals (14 Varianten)
- useIonPopover mit Ref-Pattern fuer dynamische Popover-Inhalte
- canDismiss mit isDirtyRef fuer pragmatischen Unsaved-Changes-Schutz
- app-auth-* CSS-Prefix fuer Auth-Seiten-spezifische Styles
- Domain-Farbe hat Vorrang ueber technische Zuordnung (z.B. UnregisterModal = Konfi-Lila, nicht Events-Rot)

### Key Lessons
1. CSS-Klassen-Ziele lieber konservativ setzen -- Ionic Custom Properties und dynamische Werte MUESSEN inline bleiben
2. Debug-Log-Bereinigung in Phase-Completion-Checkliste aufnehmen, nicht erst im Audit finden
3. Orphan-Code (ungenutzte Modals) bewusst akzeptieren statt Loeschen, wenn Migration spaeter moeglich
4. Quick-Fix fuer Audit-Gaps (1-Zeilen-CSS-Fixes, Debug-Logs) effizienter als eigene Phase

### Cost Observations
- Model mix: ~80% opus (execution), ~20% sonnet/haiku (verification, search)
- Sessions: ~8 Sessions ueber 2 Tage
- Notable: 17 Plans in ~125min aktiver Ausfuehrung (Durchschnitt 7.4min/Plan), -1227 Netto-Zeilen

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Plans | Avg/Plan | Key Change |
|-----------|----------|--------|-------|----------|------------|
| v1.0 | ~5 | 2 | 5 | ~4min | GSD Workflow etabliert |
| v1.1 | ~8 | 5 | 17 | ~7.4min | CSS-First + Wave-Parallelisierung skaliert |

### Top Lessons (Verified Across Milestones)

1. Wave-Parallelisierung spart signifikant Zeit bei unabhaengigen Plans (v1.0 + v1.1)
2. Research vor Planung fuehrt zu praeziseren Plans (v1.0), CSS-Klassen-First ebenso (v1.1)
3. Integration-Checks und Audits am Ende finden Gaps die Phase-Verifikation uebersieht (v1.0 + v1.1)
4. Quick-Fixes fuer Minor-Gaps effizienter als eigene Phase erstellen (v1.1)
