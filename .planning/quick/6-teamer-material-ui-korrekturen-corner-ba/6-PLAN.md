---
phase: quick-6
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/components/teamer/pages/TeamerMaterialPage.tsx
  - frontend/src/components/teamer/pages/TeamerMaterialDetailPage.tsx
  - frontend/src/contexts/ModalContext.tsx
autonomous: true
requirements: [UI-FIX-1, UI-FIX-2, UI-FIX-3, UI-FIX-4, UI-FIX-5, UI-FIX-6, UI-FIX-7, UI-FIX-8]
must_haves:
  truths:
    - "Corner Badges in Material-Liste haben konsistente borderRadius wie in Events (0 0 8px 8px fuer einzelne Badges)"
    - "Kalender-Icon in Material-Liste ist solid (calendar statt calendarOutline)"
    - "Filter-Icon in IonListHeader hat kraeftige Farbe"
    - "SectionHeader zeigt genau 2 Stats (Materialien + Dateien) die den vollen Platz nutzen"
    - "Suchleiste hat volle Breite"
    - "Detail-View Icons konsistent mit TeamerEventsPage"
    - "Detail-View hat SectionHeader fuer Dateien-Sektion"
    - "Material Detail Modal oeffnet sich mit iOS Backdrop"
  artifacts:
    - path: "frontend/src/components/teamer/pages/TeamerMaterialPage.tsx"
      provides: "Korrigierte Material-Liste"
    - path: "frontend/src/components/teamer/pages/TeamerMaterialDetailPage.tsx"
      provides: "Korrigierte Material-Detail-Ansicht"
    - path: "frontend/src/contexts/ModalContext.tsx"
      provides: "teamer-material Route-Mapping"
  key_links:
    - from: "TeamerMaterialPage.tsx"
      to: "ModalContext"
      via: "useModalPage('teamer-material')"
      pattern: "presentingElement"
---

<objective>
8 UI-Korrekturen in TeamerMaterialPage und TeamerMaterialDetailPage umsetzen.

Purpose: Konsistente UI im Teamer-Material-Bereich, gleiche Patterns wie TeamerEventsPage
Output: Korrigierte Material-Listen- und Detail-Ansicht
</objective>

<execution_context>
@/Users/simonluthe/.claude/get-shit-done/workflows/execute-plan.md
@/Users/simonluthe/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@frontend/src/components/teamer/pages/TeamerMaterialPage.tsx
@frontend/src/components/teamer/pages/TeamerMaterialDetailPage.tsx
@frontend/src/components/teamer/pages/TeamerEventsPage.tsx (Referenz fuer Corner Badges und Detail-Icons)
@frontend/src/components/shared/SectionHeader.tsx
@frontend/src/contexts/ModalContext.tsx
@frontend/src/theme/variables.css

<interfaces>
<!-- Referenz: Corner Badges in TeamerEventsPage (Zeile 793-816) -->
<!-- Einzelner Badge: borderRadius: '0 0 8px 8px' -->
<!-- Zwei Badges nebeneinander: linker '0 0 8px 8px', rechter '0 0 8px 0', getrennt durch 2px white div -->
<!-- Events-Referenz: calendar (solid) Icon mit app-icon-color--events Klasse (#dc2626) -->
<!-- Detail-Icons: calendar (solid, rot), time (solid), people (solid, gruen), trophy (solid) -->
<!-- SectionHeader stats: Array von {value, label}, flex: 1 1 0 + max-width: 100px in CSS -->
<!-- ModalContext: Route '/teamer/material' muss auf tabId 'teamer-material' gemappt werden -->
<!-- useModalPage('teamer-material') ist bereits in TeamerMaterialPage vorhanden -->
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: TeamerMaterialPage - 5 Fixes (Corner Badges, Icon, Filter, Stats, Suchleiste)</name>
  <files>frontend/src/components/teamer/pages/TeamerMaterialPage.tsx</files>
  <action>
5 Aenderungen in TeamerMaterialPage.tsx:

1. **Corner Badge borderRadius korrigieren** (Zeile 248-276): Konsistent mit TeamerEventsPage machen.
   - Wenn NUR ein Badge (event_name ODER jahrgang_name): borderRadius '0 0 8px 8px'
   - Wenn BEIDE Badges: linker Badge '0 0 0 8px', rechter Badge '0 0 8px 0', dazwischen 2px white Trenner
   - WICHTIG: Aktuell ist die Logik falsch. Schaue TeamerEventsPage Zeile 793-816 als Referenz.

2. **Kalender-Icon solid machen** (Zeile 312): `calendarOutline` durch `calendar` ersetzen.
   - Import anpassen: `calendar` aus ionicons/icons importieren (wie in TeamerEventsPage)
   - `calendarOutline` aus den Imports entfernen (wird nirgends sonst verwendet)

3. **Filter-Icon Farbe kraeftiger** (Zeile 149): Die `app-section-icon app-section-icon--material` Klasse auf dem div setzt background-color auf #d97706 und icon-color auf white. Das ist korrekt. ABER: Pruefen ob das div die richtige Klasse hat. Aktuell steht `app-section-icon app-section-icon--material` - das ist korrekt. Das Problem koennte sein dass `filterOutline` zu duenn ist. Aendere `filterOutline` zu `filter` (solid Icon) fuer bessere Sichtbarkeit. Importiere `filter` statt `filterOutline`.

4. **SectionHeader Stats: 2 Felder statt 1** (Zeile 138-144): Aktuell nur 1 Stat (`materials.length, 'Materialien'`).
   Aendern auf 2 Stats:
   ```typescript
   stats={[
     { value: materials.length, label: 'Materialien' },
     { value: materials.reduce((sum, m) => sum + (m.file_count || 0), 0), label: 'Dateien' }
   ]}
   ```
   Die CSS-Klasse `app-stats-row__item` hat bereits `flex: 1 1 0` und `max-width: 100px`. Fuer 2 Items breit genug: max-width auf 140px erhoehen geht NICHT ueber CSS hier, aber 2 Items mit flex:1 und max-width 100px sieht schon breit genug aus. Falls es zu schmal wirkt: Ueberspringe die max-width-Aenderung, das Layout passt sich automatisch an da flex:1.

5. **Suchleiste volle Breite** (Zeile 147): Das `<IonList inset={true} style={{ margin: '16px' }}>` um die Suchleiste hat `inset={true}` was standardmaessig margin hinzufuegt. Das `style={{ margin: '16px' }}` ueberschreibt das. Aendere zu `style={{ margin: '0 16px 16px' }}` und pruefe ob die IonSearchbar padding hat das sie schmaler macht. Entferne auch jegliches eigenes padding vom Searchbar-Container falls vorhanden.
  </action>
  <verify>
    <automated>cd /Users/simonluthe/Documents/Konfipoints/frontend && npx tsc --noEmit --skipLibCheck 2>&1 | head -20</automated>
  </verify>
  <done>Corner Badges haben korrekte borderRadius, Kalender-Icon ist solid, Filter-Icon ist solid/kraeftiger, SectionHeader zeigt 2 Stats, Suchleiste hat volle Breite</done>
</task>

<task type="auto">
  <name>Task 2: TeamerMaterialDetailPage - 3 Fixes (Icons, SectionHeader Dateien, Backdrop)</name>
  <files>frontend/src/components/teamer/pages/TeamerMaterialDetailPage.tsx, frontend/src/contexts/ModalContext.tsx</files>
  <action>
3 Aenderungen:

**A) Detail-View Icons korrigieren** (TeamerMaterialDetailPage.tsx Zeile 216-256):
Referenz: TeamerEventsPage Detail-View (Zeile 417-540). Dort werden SOLID Icons verwendet mit CSS-Klassen:
- Event-Datum: `calendar` (solid) mit `className="app-info-row__icon app-icon-color--events"` (rot #dc2626)
- Personen: `people` (solid) mit eigener Farbe
- Punkte: `trophy` (solid)

Aenderungen in der Details-Sektion:
- "Event: ..." Zeile: Icon von `calendarOutline` auf `calendar` (solid), behalte `style={{ color: '#dc2626' }}` oder nutze `className="app-info-row__icon app-icon-color--events"`
- "Jahrgang: ..." Zeile: Icon von `personOutline` auf `people` (solid), Farbe bleibt #5b21b6
- "Erstellt am ..." Zeile: Icon von `calendarOutline` auf `time` (solid), nutze `className="app-info-row__icon"` mit `style={{ color: '#6c757d' }}` - da "Erstellt am" eher ein Zeitstempel ist, passt `time` besser als doppeltes calendar-Icon
- "Von ..." (admin_name) Zeile: Icon von `personOutline` auf `person` (solid)
- Details-Section ListHeader Icon: von `calendarOutline` auf `informationCircle` (solid) aendern - wie in TeamerEventsPage Zeile 548

Imports aktualisieren:
- Hinzufuegen: `calendar, time, people, person, informationCircle` aus ionicons/icons
- Entfernen: `calendarOutline, personOutline, informationCircleOutline` (pruefen ob noch anderswo verwendet, sonst entfernen)

**B) SectionHeader fuer Dateien-Sektion hinzufuegen** (vor der Dateien-Liste, Zeile 259):
Importiere `SectionHeader` aus `'../../shared'`.
Fuege vor der IonList fuer Dateien (Zeile 260) einen SectionHeader ein:
```tsx
<SectionHeader
  title={material.title}
  subtitle="Dateien"
  icon={documentIcon}
  colors={{ primary: '#d97706', secondary: '#b45309' }}
  stats={[{ value: material.files?.length || 0, label: 'Dateien' }]}
/>
```
Entferne die bestehende IonListHeader fuer "Dateien (X)" (Zeile 261-266) da der SectionHeader diese Funktion uebernimmt. Behalte die IonCard darunter.

**C) ModalContext Route-Mapping fuer teamer-material** (ModalContext.tsx):
In der `getCurrentPresentingElement` Funktion fehlt das Mapping fuer Teamer-Routes. Fuege nach den Konfi-Routes (Zeile 68) hinzu:
```typescript
// Teamer Routes
else if (currentPath.includes('/teamer/material')) currentTabId = 'teamer-material';
else if (currentPath.includes('/teamer/events')) currentTabId = 'teamer-events';
else if (currentPath.includes('/teamer/dashboard')) currentTabId = 'teamer-dashboard';
else if (currentPath.includes('/teamer/chat')) currentTabId = 'teamer-chat';
else if (currentPath.includes('/teamer/badges')) currentTabId = 'teamer-badges';
else if (currentPath.includes('/teamer/profile')) currentTabId = 'teamer-profile';
```
Damit funktioniert `useModalPage('teamer-material')` korrekt und das presentingElement wird gesetzt, was den iOS-Backdrop-Effekt aktiviert.

Das presentingElement wird bereits in TeamerMaterialPage.tsx an presentDetailModal uebergeben (Zeile 101), also muss dort nichts geaendert werden. Der Fix im ModalContext reicht.
  </action>
  <verify>
    <automated>cd /Users/simonluthe/Documents/Konfipoints/frontend && npx tsc --noEmit --skipLibCheck 2>&1 | head -20</automated>
  </verify>
  <done>Detail-Icons sind solid und konsistent mit Events, Dateien-Sektion hat SectionHeader, Material Detail Modal oeffnet sich mit iOS Backdrop-Effekt</done>
</task>

</tasks>

<verification>
- TypeScript kompiliert fehlerfrei
- Alle 8 Punkte adressiert
</verification>

<success_criteria>
- Corner Badges: konsistente borderRadius (0 0 8px 8px fuer einzeln, korrekte Aufteilung fuer zwei)
- Kalender-Icon: solid in Material-Liste
- Filter-Icon: solid/kraeftiger sichtbar
- Stats: 2 Felder (Materialien + Dateien) statt 1
- Suchleiste: volle Breite
- Detail-Icons: solid, konsistent mit Events-Referenz
- Dateien-SectionHeader: vorhanden mit Stat-Wert
- Backdrop: iOS-Backdrop-Effekt bei Material Detail Modal
</success_criteria>

<output>
After completion, create `.planning/quick/6-teamer-material-ui-korrekturen-corner-ba/6-SUMMARY.md`
</output>
