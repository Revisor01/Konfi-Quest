# Phase 3: Design-System Grundlagen - Context

**Gathered:** 2026-03-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Das bestehende Header-Banner-Pattern (pro Seite eigene Farbe, Icon+Titel+Stats-Row, dekorative Kreise) und die EmptyState/Listen-Patterns in wiederverwendbare Shared Components extrahieren. Die Farben, Corner Badges (Eselsohr), farbige Striche links, und die gesamte bestehende Farblogik werden BEIBEHALTEN. Hier wird nur DRY-Refactoring gemacht, NICHTS verworfen. Die Components werden in ALLE Views eingebaut (Admin + Konfi), nicht nur erstellt.

</domain>

<decisions>
## Implementation Decisions

### SectionHeader-Komponente
- Presets fuer benannte Bereiche (events, activities, konfis, users, organizations, badges, requests, jahrgang) PLUS Fallback auf freie Farbkonfiguration (colors={{primary, secondary}})
- Stats-Row zeigt IMMER genau 3 Werte: [{value: number, label: string}, ...]
- Subtitle ist IMMER required (kein optionales Prop) -- sorgt fuer konsistente Hoehe
- Dekorative Kreise (2 halbtransparente Kreise, top-right + bottom-left) sind FEST eingebaut, kein Toggle
- OrganizationView bekommt den normalen kompakten SectionHeader -- das Sonderformat (220px, grosser Hintergrundtext) wird aufgegeben zugunsten Konsistenz
- SectionHeader wird in ALLE bestehenden Views eingebaut (alle 8+ Views mit Header-Banner in Admin und Konfi)
- Dateiort: frontend/src/components/shared/SectionHeader.tsx

### EmptyState-Komponente
- Nutzt die gleichen Farb-Presets wie SectionHeader fuer die Icon-Farbe
- Zeigt NUR: zentriertes Icon + Titel (h3) + Beschreibungstext (p)
- KEIN Action-Button im EmptyState
- Groessen und Abstande werden NORMALISIERT: Icon 3rem, Padding 32px, einheitliche Text-Styles
- Wird in ALLE Views eingebaut (10+ Stellen)
- Dateiort: frontend/src/components/shared/EmptyState.tsx

### ListSection-Komponente
- Wrapped: Abschnitts-Ueberschrift (app-section-icon + Titel + optionaler Count) + IonList mit Items
- List-Items (app-list-item) bleiben in den Views -- zu unterschiedlich fuer generische Komponente
- EmptyState ist INTEGRIERT: wenn items leer sind, zeigt ListSection automatisch den EmptyState an (emptyIcon, emptyTitle, emptyMessage als Props)
- Corner Badges (app-corner-badge / Eselsohr) und farbiger Strich links (border-left) bleiben ERHALTEN -- sind bereits CSS-Klassen, nicht Teil von ListSection
- Farblogik der Listen bleibt bestehen: Gemeinde/Gottesdienst (blau/gruen), Events (rot), Chat (cyan), Konfi (lila), Bonus (orange)
- Wird in ALLE Views eingebaut
- Dateiort: frontend/src/components/shared/ListSection.tsx

### CSS-Strategie
- Neue CSS-Klassen (app-header-banner, app-header-banner__icon, app-header-banner__stats, app-stats-row, app-empty-state etc.) in bestehende variables.css einfuegen
- Bestehende CSS-Klassen (app-list-item, app-icon-circle, app-corner-badge etc.) mit Abschnitt-Kommentaren dokumentieren: /* === Header Banner === */, /* === List Items === */, /* === Empty States === */
- Farb-Presets als CSS Custom Properties in :root definieren: --app-color-events: #dc2626, --app-color-activities: #059669 etc.
- KEINE separate CSS-Datei -- alles in variables.css erweitern
- Inline-Styles im Header-Banner werden durch CSS-Klassen ersetzt. Nur die Preset-spezifische Farbe kommt als CSS Custom Property oder minimaler Inline-Style

### Claude's Discretion
- Genaue Benennung der CSS-Klassen und Custom Properties
- Interne Implementierung der Preset-Map (wie die Presets auf Farben gemappt werden)
- Ob EmptyState und ListSection separate Dateien sind oder in einer index.ts re-exported werden
- TypeScript-Interface-Design fuer die Component-Props
- Reihenfolge der CSS-Abschnitte in variables.css

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `app-list-item` CSS-Klassen: Vollstaendiges Klassen-System fuer Listen (17 Farbvarianten, Meta-Zeilen, Titel, Subtitel)
- `app-icon-circle` CSS-Klassen: Icon-Container in 2 Groessen (28px, 40px) mit 10+ Farbvarianten
- `app-corner-badge` CSS-Klasse: Eselsohr-Badge oben rechts mit Status-Text
- `app-section-icon` CSS-Klassen: 24px Icons fuer Section-Header mit Farbvarianten
- `app-chip` und `app-tag` CSS-Klassen: Inline-Status-Chips und Category-Labels
- `app-reason-box` CSS-Klasse: Farbige Begruendungs-Boxen
- `LoadingSpinner.tsx` in components/common/: Bestehende Shared-Component

### Established Patterns
- Alle Views folgen dem gleichen Aufbau: Header Banner -> Tab Navigation (IonSegment) -> Listen mit IonListHeader -> Items
- Header Banner ist aktuell 100% Inline-Styles (~50 Zeilen pro View), identische Struktur in 8 Views
- EmptyState ist aktuell Inline-HTML (~15 Zeilen pro View), identisches Layout in 10+ Stellen
- Listen nutzen bereits die CSS-Klassen (app-list-item etc.), KEIN Inline-Styling bei Listen
- IonSegment fuer Tab-Navigation ist Standard in allen Views
- Konfi EventsView ist die Referenz-Implementierung

### Integration Points
- components/shared/ Ordner muss NEU erstellt werden
- variables.css wird erweitert (neue Klassen + Kommentare + Custom Properties)
- Jede View (Admin + Konfi) wird refactored um SectionHeader, EmptyState, ListSection zu importieren
- Bestehende Farben aus den Views werden in CSS Custom Properties zentralisiert

### Betroffene Dateien (alle mit Header Banner)
- frontend/src/components/konfi/views/EventsView.tsx (Referenz-Design)
- frontend/src/components/konfi/views/RequestsView.tsx
- frontend/src/components/admin/EventsView.tsx
- frontend/src/components/admin/ActivitiesView.tsx
- frontend/src/components/admin/KonfisView.tsx
- frontend/src/components/admin/UsersView.tsx
- frontend/src/components/admin/OrganizationView.tsx (Sonderformat wird normalisiert)
- frontend/src/components/admin/ActivityRequestsView.tsx

### Zusaetzliche Dateien mit EmptyState
- frontend/src/components/konfi/modals/PointsHistoryModal.tsx
- frontend/src/components/admin/views/KonfiDetailView.tsx
- Diverse weitere Views mit "Keine X gefunden" Patterns

</code_context>

<specifics>
## Specific Ideas

- Corner Badges (Eselsohr-Pattern oben rechts) gefallen dem User gut und sollen ueberall konsistent verwendet werden -- auch bei doppelten Badges
- Der farbige Strich links am List-Item ist ein bewusstes Design-Element, nicht nur Dekoration
- Die Farblogik folgt zwei Systemen: Sektionsfarben (Events=Rot, Chat=Cyan, Konfi=Lila) UND Punkteart-Farben (Gemeinde=Blau, Gottesdienst=Gruen)
- OrganizationView wird bewusst vereinfacht (Sonderformat aufgeben) fuer Konsistenz

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>

---

*Phase: 03-design-system-grundlagen*
*Context gathered: 2026-03-01*
