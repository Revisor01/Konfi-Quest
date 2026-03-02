# Phase 9: Dashboard Bug-Fix + Design-Review - Context

**Gathered:** 2026-03-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Konfi Dashboard zeigt alle ActivityRings-Runden korrekt an und alle 6 Sektionen folgen dem Design-System. Inline-Styles im DashboardView werden durch CSS-Klassen ersetzt. Keine neuen Features, keine neuen Sektionen.

</domain>

<decisions>
## Implementation Decisions

### ActivityRings 3. Runde
- Strichstaerke gleich wie 2. Runde (70% der 1. Runde) — aktuell nur 35%, viel zu duenn
- Farbe: Hellere/leuchtendere Variante der Ring-Farbe — zeigt Fortschritt ueber 200% als Highlight
- Radius: Etwas kleiner als 2. Runde beibehalten (aktuelles Verhalten) — Schichteffekt
- Maximum: 3 Runden (300%) — danach bleibt der Ring voll, keine weitere Runde

### Dashboard Header
- Begruessing: Tageszeit-abhaengig (Guten Morgen / Guten Tag / Guten Abend) + Name
- Legende unter ActivityRings: Design-System-Farben (CSS-Variablen) statt hartcodierter Hex-Werte
- Level-Position: Claude's Discretion — optimale Position im Gesamtlayout
- Header-Layout: Claude's Discretion — Spacing/Groessenverhaeltnisse basierend auf Design-System pruefen und verbessern

### Sektions-Konsistenz
- Einheitlicher Card-Style fuer alle 6 Sektionen (gleicher Rahmen, Schatten, Padding, Border-Radius)
- Jede Sektion behaelt ihre eigene Farbe — das ist bereits so und bleibt so
- Ueberschriften: Icon + Titel einheitlich fuer alle Sektionen (gleiche Schriftgroesse und -gewicht, IonIcon links)
- Empty States: Sektion bleibt sichtbar mit freundlichem Hinweistext (z.B. "Noch keine Badges erhalten")
- Tageslosung: Zitat-Style — Bibelvers kursiv, mit Anfuehrungszeichen oder Balken links
- Dunkle Punkte als Detail-Element: Das bestehende Muster aus der Header-Sektion soll auch in den Sektionen verwendet werden

### Claude's Discretion
- Exakte Spacing- und Typografie-Werte (basierend auf Design-System)
- Level-Badge Position im Header
- Header-Layout Optimierung
- SVG-Ring Glow-Effekt Staerke

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ActivityRings.tsx`: Eigenstaendige SVG-Komponente mit Animation, 3-Runden-Logik bereits vorhanden aber fehlerhaft (3. Runde zu duenn)
- `DashboardView.tsx`: ~77KB Hauptdatei mit allen 6 Sektionen, massiv Inline-Styles
- `variables.css`: Design-System CSS-Klassen aus v1.1 (100+ Utility-Klassen)
- Badge-Icon-Mapping: Umfangreiche ionicons-Zuordnung in DashboardView

### Established Patterns
- Design-System CSS-Klassen in `frontend/src/theme/variables.css`
- IonIcon aus `ionicons/icons` fuer alle Icons (KEINE Unicode Emojis!)
- Referenz-View fuer Design: `EventsView.tsx`
- Kompakter Header-Style (Icon + Titel inline, Stats-Row)

### Integration Points
- `DashboardView` importiert `ActivityRings` aus `../../admin/views/ActivityRings`
- Dashboard-Daten kommen ueber Props von `KonfiDashboardPage.tsx`
- `useApp()` Context liefert User-Daten fuer Begruessing und Level

</code_context>

<specifics>
## Specific Ideas

- Dunkle Punkte (Bullet-Points) als Detail-Element aus der Header-Sektion sollen auch in den Dashboard-Sektionen als wiederkehrendes Design-Element eingesetzt werden
- Sektionsfarben: Jede Sektion hat bereits ihre eigene Farbe und das soll so bleiben — keine Vereinheitlichung der Farben
- Tageslosung als Zitat mit visuellem Unterschied zu anderen Sektionen (Kursiv, Anfuehrungszeichen oder Balken links)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 09-dashboard-bug-fix-design-review*
*Context gathered: 2026-03-02*
