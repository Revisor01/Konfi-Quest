# Phase 94: Globale UI-Patterns - Context

**Gathered:** 2026-03-24
**Status:** Ready for planning

<domain>
## Phase Boundary

Slider-Verhalten und Listen-Card-Abstände als globale Basis-Patterns fuer alle nachfolgenden Phasen.

</domain>

<decisions>
## Implementation Decisions

### Slider-Verhalten
- IonRange mit `pin` Property zeigt aktuellen Wert beim Ziehen
- Min/Max-Werte als kleine Zahlen links und rechts neben dem Slider
- Steps immer 1 (keine groesseren Schritte)
- Gesamtspannen sinnvoll begrenzen: Punkte-Slider z.B. 1-5 statt 0-100, so dass der Wertebereich ueber den Slider verteilt ist
- Jeder Slider-Kontext braucht passende min/max Werte (Punkte, Kapazitaet, etc.)

### Listen-Card-Abstände
- `app-card ion-card-content` Padding von `8px 16px` auf `16px` symmetrisch aendern
- Globale Aenderung in variables.css, alle Views profitieren automatisch

### Claude's Discretion
- Konkrete min/max Werte pro Slider-Kontext nach Code-Analyse festlegen

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ion-card.app-card` CSS-Klasse in `frontend/src/theme/variables.css` (Zeile 41ff)
- IonRange wird in 7 Admin-Modals verwendet (Badge, Activity, Level, Event, Bonus, Jahrgaenge, EventFormSections)

### Established Patterns
- Zentrale CSS-Klassen in variables.css fuer app-weite Konsistenz
- IonRange ohne pin Property, Wert wird teilweise separat angezeigt

### Integration Points
- variables.css Aenderung wirkt global auf alle app-card Instanzen
- IonRange-Aenderungen in den jeweiligen Modal-Dateien

</code_context>

<specifics>
## Specific Ideas

- Punkte-Slider Beispiel: min=1, max=5 (nicht 0-100)
- Kapazitaets-Slider: passende Spanne je nach Kontext

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>
