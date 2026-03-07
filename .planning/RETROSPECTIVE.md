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

## Milestone: v1.2 -- Polishing + Tech Debt

**Shipped:** 2026-03-02
**Phases:** 4 | **Plans:** 6 | **Sessions:** ~3

### What Was Built
- Super-Admin TabBar auf 2 Tabs reduziert
- ActivityRings 3. Runde Strichstaerke und Bright-Farbvarianten
- Dashboard Design-Review (Begruessing, Glass-Chips, Tageslosung)
- rateLimitMessage UI-Wiring + console.log Cleanup (325 Statements)
- app-condense-toolbar auf alle 20 Headers, EventDetailView BEM-Klassen
- CLAUDE.md komplett neu geschrieben

### What Worked
- Tech Debt gezielt aus v1.1 aufgeloest (condense-toolbar, Inline-Styles, rateLimitMessage)
- Kleine Plans mit klarem Scope (~6.7min/Plan Durchschnitt)

### What Was Inefficient
- Kein eigener Milestone-Audit -- haette Luecken frueher erkannt
- v1.2 Retrospektive fehlte -- erst bei v1.3 nachgeholt

### Key Lessons
1. Tech-Debt-Milestones halten Codebase-Qualitaet konstant
2. Milestone-Audit auch bei kleinen Milestones sinnvoll

### Cost Observations
- Model mix: ~80% opus, ~20% sonnet
- Sessions: ~3 Sessions an 1 Tag
- Notable: 6 Plans in ~40min (Durchschnitt 6.7min/Plan)

---

## Milestone: v1.3 -- Layout-Polishing

**Shipped:** 2026-03-04
**Phases:** 9 | **Plans:** 18 | **Sessions:** ~6

### What Was Built
- Admin-Modal-Bugs behoben (Participant, Badges, QR-Code) + sicheres Einmalpasswort-System
- Globale UI-Konsistenz: Listen-Icons 32px, Fokus-Rahmen entfernt, Checkbox-Farben dynamisch
- Konfi-Views: Tab "Start", EmptyStates, PointsHistory 3+2, Profil Lila, Antrags-Icons Gruen
- Admin-Views: Corner-Badges, Solid-Icons, Standard-Stepper, Beschreibungs-Cards, Checkbox links
- Settings: Struktur Konto/Verwaltung/Inhalt, Kategorien Sky-Blue, Gottesdienst Blau, Badges Oberkategorie-Icons
- Super-Admin: TabBar entfernt, Vollbild-Layout, mattes Blau (#667eea), Logout-Button

### What Worked
- Systematischer View-fuer-View Durchgang: Alle Issues in einem Audit erfasst, dann nach Bereich gruppiert
- Dezimal-Phase (17.1) fuer dringende Fixes zwischendurch eingefuegt -- sauberer als Ad-hoc-Aenderungen
- Plan-Metriken zeigen ~1.4min/Plan Durchschnitt -- kleinere, fokussierte Plans sind deutlich schneller
- 48/48 Requirements alle complete -- kein einziger Gap im finalen Audit

### What Was Inefficient
- Initiales Audit zeigte 41/48 Requirements weil Phase 19 noch nicht ausgefuehrt war -- Audit-Timing besser am Ende
- SUMMARY-Dateien haben kein `one_liner` Feld -- summary-extract Tool konnte Accomplishments nicht extrahieren
- Phase Details in ROADMAP.md blieben vollstaendig statt nach Archivierung bereinigt zu werden

### Patterns Established
- getCriteriaTypeIcon Mapping: 13 Badge criteria_types auf individuelle ionicons
- Kategorien-Farbe Sky-Blue (#0ea5e9) als eigene CSS-Klasse getrennt von Activities/Badges
- Super-Admin IonRouterOutlet statt IonTabs fuer tabfreie Layouts
- subHeader statt HTML-in-message fuer IonAlert-Inhalte

### Key Lessons
1. Kleine Plans (~1min) mit klarem 1-2 Task Scope sind effizienter als groessere Multi-Task Plans
2. Systematischer Audit VOR Milestone-Start liefert praezise Issue-Liste fuer Requirements
3. Dezimal-Phasen (17.1) gut fuer dringende Zwischendurch-Fixes
4. Milestone-Audit erst ausfuehren wenn alle Phasen fertig sind

### Cost Observations
- Model mix: ~85% opus, ~15% sonnet (verifier)
- Sessions: ~6 Sessions ueber 2 Tage
- Notable: 18 Plans in ~25min (Durchschnitt ~1.4min/Plan), schnellster Milestone bisher

---

## Milestone: v1.4 -- Logik-Debug

**Shipped:** 2026-03-05
**Phases:** 5 | **Plans:** 9

### What Was Built
- Event-Logik transaktionssicher: Waitlist-Status, Registrierungsfenster, Nachruecken, Kapazitaetspruefung
- Badge-Kriterien komplett repariert: alle 13 Typen, Streak-Jahreswechsel, category_activities UNION ALL
- Punkteoperationen atomar: client.connect()/BEGIN/COMMIT, GREATEST(0,...), Bonus-Route konsolidiert
- RBAC gehaertet: last_login_at nur beim Login, Jahrgang-Filter, Org-Loeschkette, Rate-Limiting
- Chat-Sicherheit: Path-Traversal-Schutz, Org-Dateizugriff, Socket-Disconnect bei Rollenaenderung

### What Worked
- Systematischer Debug-Durchgang nach Logik-Bereichen (Events, Badges, Punkte, User, Chat)
- Transaktionssicherheit als Grundprinzip fuer alle Datenbank-Operationen

### Key Lessons
1. Logik-Bugs verstecken sich oft hinter Race Conditions -- Transaktionen sind Pflicht
2. Badge-Kriterien-System braucht UNION ALL statt UNION fuer korrekte Zaehlung

---

## Milestone: v1.5 -- Push-Notifications

**Shipped:** 2026-03-07
**Phases:** 5 | **Plans:** 8

### What Was Built
- Push-Type Registry mit 18 Notification-Types und Firebase Error-Code Forwarding
- Token-Lifecycle: Logout-Cleanup, 12h-Refresh, User-Wechsel-Handling, Fallback-Device-ID Fix
- BadgeContext als Single Source of Truth fuer alle Unread-Counts
- Neue Push-Flows: Event-Erinnerungen (15min), Admin-Alert bei Registrierung, Level-Up
- Selbstreinigendes Token-System mit 6h-Cleanup fuer verwaiste Tokens
- Konsistentes Result-Pattern in allen Push-Send-Methoden

### What Worked
- Klare Phasen-Trennung: Foundation -> Lifecycle -> Badge -> Flows -> Cleanup
- Integration-Checker fand keine Luecken -- Cross-Phase-Wiring war durchgehend korrekt
- 3-Source Cross-Reference (VERIFICATION + SUMMARY + REQUIREMENTS) lieferte 100% Abdeckung
- Research-Phase identifizierte kritische Bugs (sendBadgeUpdate try/catch) vor der Planung

### What Was Inefficient
- SUMMARY-Dateien fehlt weiterhin `one_liner` Feld -- Accomplishments manuell extrahiert
- Vorheriger Milestone-Audit (vor Phase 29) zeigte gaps_found weil Phase 29 noch nicht fertig war

### Patterns Established
- Result-Pattern fuer Firebase-Push: result.success Check, fatalCodes Array, error_count Tracking
- Background-Service-Pattern: startXxxService mit Guard-Variable, sofortiger Aufruf + setInterval
- checkAndSendLevelUp als wiederverwendbare Helper-Methode an allen Punkte-Vergabe-Stellen

### Key Lessons
1. Push-Notification-System braucht konsistentes Error-Handling-Pattern in ALLEN Send-Methoden
2. Token-Cleanup als Background-Service ist besser als reaktives Loeschen -- proaktive Bereinigung
3. BadgeContext als Single Source of Truth eliminiert Inkonsistenzen zwischen 4 vorherigen Systemen
4. Milestone-Audit erst nach der letzten Phase ausfuehren -- nicht davor

### Cost Observations
- Model mix: ~85% opus (execution), ~15% sonnet (verification)
- Sessions: ~6 Sessions ueber 3 Tage
- Notable: 8 Plans in ~14min aktiver Ausfuehrung (Durchschnitt ~1.8min/Plan)

---

## Cross-Milestone Trends

### Process Evolution

| Milestone | Sessions | Phases | Plans | Avg/Plan | Key Change |
|-----------|----------|--------|-------|----------|------------|
| v1.0 | ~5 | 2 | 5 | ~4min | GSD Workflow etabliert |
| v1.1 | ~8 | 5 | 17 | ~7.4min | CSS-First + Wave-Parallelisierung skaliert |
| v1.2 | ~3 | 4 | 6 | ~6.7min | Tech Debt gezielt aufloesen |
| v1.3 | ~6 | 9 | 18 | ~1.4min | Kleine fokussierte Plans, systematischer Audit |
| v1.4 | ~4 | 5 | 9 | ~2min | Logik-Debug nach Bereichen, Transaktionssicherheit |
| v1.5 | ~6 | 5 | 8 | ~1.8min | Push-System E2E, Integration-Checker ohne Luecken |

### Top Lessons (Verified Across Milestones)

1. Wave-Parallelisierung spart signifikant Zeit bei unabhaengigen Plans (v1.0 + v1.1)
2. Research vor Planung fuehrt zu praeziseren Plans (v1.0 + v1.5), CSS-Klassen-First ebenso (v1.1)
3. Integration-Checks und Audits am Ende finden Gaps die Phase-Verifikation uebersieht (v1.0 + v1.1 + v1.3)
4. Kleinere Plans (1-2 Tasks) sind deutlich schneller als Multi-Task Plans (v1.2 + v1.3 + v1.5)
5. Systematischer View-Audit vor Milestone liefert praezise Issue-Listen (v1.3)
6. Tech-Debt-Milestones halten Codebase-Qualitaet konstant (v1.2)
7. Konsistente Patterns (Result-Pattern, Background-Service) ueber alle Methoden spart spaetere Bug-Fixes (v1.5)
8. Milestone-Audit erst nach letzter Phase, nicht davor (v1.3 + v1.5)
