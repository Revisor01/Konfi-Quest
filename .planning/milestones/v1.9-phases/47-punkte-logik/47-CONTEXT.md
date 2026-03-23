# Phase 47: Punkte-Logik - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Punkte-System funktioniert korrekt bei ein oder zwei aktiven Punkt-Typen: Toggle-Sperre verhindert Deaktivierung beider Typen, Admin-Konfi-Liste zeigt korrekte Gesamtpunkte, Statusbalken passt sich an aktive Typen an, und History-Header zeigt 6 Stats in besserem Layout. Auch fuer Teamer-Konfi-History anwenden.

</domain>

<decisions>
## Implementation Decisions

### Toggle-Sperre (PKT-v19-01)
- Wenn ein Punkt-Typ deaktiviert wird, wird der Toggle des anderen ausgegraut/disabled
- Inline-Hinweis unter dem disabled Toggle: "Mindestens ein Punkt-Typ muss aktiv bleiben. X Konfis haben bereits Y Punkte."
- Die Konfi-Anzahl und Punkte-Summe kommen aus der bestehenden Warnung im Backend (jahrgaenge.js:141-159)
- Frontend: Toggle disabled Attribut setzen wenn der andere Typ deaktiviert ist

### Admin-Konfi-Liste Gesamtpunkte (PKT-v19-02)
- `getTotalPoints()` in KonfisView.tsx (Zeile 116) muss die enabled-Flags respektieren
- Formel: `(godiEnabled ? gottesdienst_points : 0) + (gemEnabled ? gemeinde_points : 0)`
- Aktuell summiert die Funktion BEIDE Typen unabhaengig — das ist der Bug

### Ein-Typ Statusbalken (PKT-v19-03)
- Bei nur einem aktiven Punkt-Typ: Breiter Einzelbalken statt 2 schmaler Balken
- Farbe des aktiven Typs (blau #3b82f6 fuer Gottesdienst, gruen #059669 fuer Gemeinde)
- Breite wie der Gesamtbalken bei 2 Typen (volle Breite)
- ActivityRings hat bereits 1-Ring-Modus — nur die Progress-Balken in KonfisView anpassen

### History-Header Layout (PKT-v19-04)
- 3x2 Grid Layout (3 Spalten, 2 Reihen):
  - Oben: Gesamt / Gottesdienst / Gemeinde
  - Unten: Events / Aktivitaeten / Bonus
- Layout wie SectionHeader-Style (kompakt, inline Stats) nur mit zwei Reihen
- Bei nur einem aktiven Typ: Gesamt-Stat entfaellt, nur aktiver Typ anzeigen (2+3 Grid oder angepasst)
- Auch auf die Konfi-Punkte-History in der Teamer-Ansicht anwenden (TeamerKonfiStatsPage)

### Claude's Discretion
- Exact Grid-Spacing und Typography fuer den History-Header
- Wie "Aktivitaeten"-Count berechnet wird (source_type Filter oder eigene Zaehlweise)
- Animation/Transition wenn sich die Stats aendern
- Ob Konfi-History und Teamer-History exakt gleich aussehen oder leicht unterschiedlich

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Punkte-Konfiguration
- `backend/routes/jahrgaenge.js` — Toggle-Spalten Migration (Zeile 10-44), PUT mit Warnung (Zeile 141-159)
- `frontend/src/components/admin/pages/AdminJahrgaengeePage.tsx` — Toggle UI (Zeile 210-274), JahrgangModal

### Admin-Konfi-Liste
- `frontend/src/components/admin/KonfisView.tsx` — getTotalPoints Bug (Zeile 113-125), getKonfiTargets (Zeile 156-163), Progress Bars (Zeile 439-491)

### Konfi-Dashboard
- `frontend/src/components/admin/views/ActivityRings.tsx` — 1-Ring vs 3-Ring Modus (Zeile 32-36, 244-293)
- `frontend/src/components/konfi/views/DashboardView.tsx` — Punkt-Berechnung (Zeile 563-567)

### Points History
- `frontend/src/components/konfi/modals/PointsHistoryModal.tsx` — Stats Header (Zeile 203-238), gefilterte Totals (Zeile 100-108)
- `frontend/src/components/teamer/pages/TeamerKonfiStatsPage.tsx` — Teamer-Konfi-History (gleicher Style anwenden)

### Referenz-Design
- `frontend/src/components/shared/SectionHeader.tsx` — SectionHeader-Style als Vorlage fuer den History-Header

No external specs — requirements fully captured in decisions above and REQUIREMENTS.md (PKT-v19-01 bis PKT-v19-04).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `getKonfiTargets()` in KonfisView.tsx: Berechnet bereits enabled-basierte Targets korrekt — Pattern fuer getTotalPoints nutzen
- ActivityRings: Hat bereits 1-Ring vs 3-Ring Logik (Zeile 32-36) — kein Umbau noetig
- Backend Warnung bei Deaktivierung: jahrgaenge.js gibt bereits Konfi-Count + Punkte-Summe zurueck
- SectionHeader Shared Component: Als Layout-Vorlage fuer den History-Header

### Established Patterns
- `CASE WHEN j.gottesdienst_enabled THEN kp.gottesdienst_points ELSE 0 END` — SQL Pattern fuer enabled-basierte Berechnung
- Frontend: `(godiEnabled ? gottesdienstPoints : 0)` — clientseitiges Pattern
- Conditional render: `{godiEnabled && ( ... )}` fuer typ-abhaengige UI-Elemente

### Integration Points
- JahrgangModal: Toggle disabled Attribut + Inline-Hinweis hinzufuegen
- KonfisView: getTotalPoints fixen + Progress Bars fuer Ein-Typ anpassen
- PointsHistoryModal: Stats Header auf 3x2 Grid umbauen
- TeamerKonfiStatsPage: Gleichen History-Header-Style anwenden

</code_context>

<specifics>
## Specific Ideas

- Layout wie SectionHeader: kompakte Stats in 2 Reihen a 3 Spalten, nicht zu gross
- Breiter Einzelbalken in der Farbe des aktiven Typs soll genauso aussehen wie der Gesamtbalken bei 2 Typen
- Teamer-Konfi-History soll denselben History-Header bekommen wie die Konfi-History

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 47-punkte-logik*
*Context gathered: 2026-03-19*
