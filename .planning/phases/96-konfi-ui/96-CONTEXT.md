# Phase 96: Konfi UI - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Konfi-Bereich komplett polieren: Dashboard Events-Card, Events-Suche, Badges-Grid, Aktivitaeten-Modal, Historie-Akkordeons, Profil-Stats, Bibeluebersetzungs-Modal. Plus globale CSS-Klasse fuer Beschreibungstexte.

</domain>

<decisions>
## Implementation Decisions

### Globale Beschreibungstexte (NEU — uebergreifend)
- Neue CSS-Klasse `app-description-text` in variables.css definieren (z.B. font-size: 0.875rem, color: #4a4a4a, line-height: 1.5)
- Diese Klasse UEBERALL verwenden wo Beschreibungstexte angezeigt werden (Event-Details, Material, Badge-Details, etc.)
- Ermoeglicht globale Anpassung der Beschreibungs-Schriftgroesse an einer Stelle
- Betrifft ALLE Rollen (Konfi, Teamer, Admin) — nicht nur diese Phase, aber hier eingefuehrt

### Dashboard Events-Card (KDB-01, KDB-02)
- Events-Card IMMER anzeigen, auch wenn keine Events vorhanden
- Bei leerer Liste: "Buche dein naechstes Event" als Aufforderung mit Button/Link zu Events-Seite
- Layout angleichen: Titel+Datum/Uhrzeit → Ort → Mitbringen auf eigenen Zeilen (wie EventsView-Pattern)

### Events (KEV-01, KEV-02, KEV-03)
- Beschreibungstext: `app-description-text` CSS-Klasse verwenden statt eigener Groesse
- Teilnehmer:innen-Abstand: Standard app-list-item Pattern wie in allen anderen Listen (kein Extra-Spacing)
- Suchleiste: "Suche & Filter" SectionHeader mit searchOutline Icon + IonSearchbar in IonList inset (Chat-Pattern aus Phase 95)

### Badges (KBD-01, KBD-02, KBD-03)
- "Suche & Filter" SectionHeader mit searchOutline Icon ueber den Filter-Segment-Buttons
- Badge-Kacheln: CSS Grid `grid-template-columns: repeat(3, 1fr)` fuer gleich grosse Kacheln
- Titel: text-overflow ellipsis, 1 Zeile statt 2 (WebkitLineClamp von 2 auf 1)
- Popover-Breite: `--width: auto; --max-width: 80vw; white-space: nowrap`

### Aktivitaeten (KAK-01)
- Kategorien-Auswahl komplett aus dem Antrag-Modal/Flow entfernen (nicht nur ausblenden)

### Historie (KHI-01, KHI-02)
- Punkte-Uebersicht und Badges als IonAccordionGroup mit 2 ausklappbaren Akkordeons direkt im Profil einbauen
- Das separate PointsHistoryModal wird NICHT mehr benoetigt — Daten kommen direkt in die Akkordeons
- SectionHeader: "Fuer Uebersicht klicken" faellt WEG (Akkordeons ersetzen das)
- Zweite Stats-Zeile im SectionHeader: Events + Bonus anzeigen
- "GD" statt "Gottesdienst" als Abkuerzung

### Profil (KPR-01, KPR-02)
- Punkte-Uebersicht SectionHeader wie Teamer:innen-Profil
- 6 Stats in 2 Reihen (3+3), Stats-Felder in Standard-SectionHeader-Groesse (nicht kleiner)
- Bibeluebersetzung: Neues Modal mit IonList — je Uebersetzung Name + 2-3 Saetze Erklaerung + Radio-Button

### Claude's Discretion
- Exakte font-size/color/line-height Werte fuer `app-description-text`
- Welche 6 Stats im Profil-SectionHeader angezeigt werden
- Erklaerungstexte fuer die 7 Bibeluebersetzungen
- Ob PointsHistoryModal komplett geloescht oder nur nicht mehr aufgerufen wird

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- SectionHeader Shared Component mit Stats-Chips und Preset-Farbsystem
- `app-list-item` CSS-Pattern in variables.css fuer konsistente Listen
- IonAccordionGroup als Ionic-Komponente verfuegbar
- EventsView.tsx als Referenz fuer Event-Layout
- TeamerProfilePage.tsx als Referenz fuer Profil-Stats-Layout

### Established Patterns
- Dashboard-Cards: Gradient-Background, Glass Chips, Section-basiert
- Events-Card aktuell bedingt (`regularEvents.length > 0`)
- Badge-Grid: 3-spaltig mit 12px Gap, 56px Icon-Circle
- Searchbar: `ios26-searchbar-classic` Klasse
- Bibeluebersetzung: 7 Optionen in Object-Map, PUT API

### Integration Points
- KonfiDashboardPage.tsx / DashboardSections.tsx — Events-Card
- KonfiEventsPage.tsx — Suchleiste
- KonfiBadgesPage.tsx / BadgesView.tsx — Grid + Filter
- KonfiProfilePage.tsx / ProfileView.tsx — Stats + Bibeluebersetzung
- PointsHistoryModal.tsx — wird durch Akkordeons ersetzt
- RequestDetailModal.tsx — Kategorien-Auswahl entfernen
- variables.css — neue app-description-text Klasse

</code_context>

<specifics>
## Specific Ideas

- "Buche dein naechstes Event" (nicht "erstes")
- app-description-text als globale Klasse fuer ALLE Beschreibungstexte ueberall
- Stats-Felder im Profil: Standard-SectionHeader-Groesse, nicht kleiner
- PointsHistoryModal Daten direkt in Akkordeons im Profil

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>
