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

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Key Change |
|-----------|----------|--------|------------|
| v1.0 | ~5 | 2 | Erstes Milestone -- GSD Workflow etabliert |

### Top Lessons (Verified Across Milestones)

1. Wave-Parallelisierung spart signifikant Zeit bei unabhaengigen Plans
2. Research vor Planung fuehrt zu praeziseren, ausfuehrbaren Plans
