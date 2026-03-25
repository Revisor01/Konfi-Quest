# Phase 98: Admin Aktivitaeten, Details, Antraege, Profil, Jahrgaenge - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Admin-seitige UI-Bugfixes und visuelle Korrekturen: Aktivitaeten-Liste/Modal, Teamer-Detail-Header, Antrags-Modal, Admin-Profil und Jahrgaenge-Datumspicker.

</domain>

<decisions>
## Implementation Decisions

### Aktivitaeten-UI (AAK)
- "Invalid Date" Fix: `toLocaleDateString('de-DE')` mit Fallback auf leeren String
- Kategorien-Symbole: Farbe aus der jeweiligen Kategorie-SectionHeader-Farbe uebernehmen + Kategorie-Icon verwenden (app-section-icon--{category})
- Teamer:innen-Aktivitaeten im Modal: Punkte-Bereich komplett ausblenden wenn Zielgruppe=Teamer:innen (Teamer bekommen keine Punkte)
- Datumspicker im ActivityManagementModal: IonDatetimeButton mit IonModal (konsistent mit Jahrgaenge-Modal)

### Teamer-Detail-Header (ATD)
- Header-Text: "Teamer:in" (statt bisherigem Text)
- Gradient-Farbe: `#e11d48 → #be185d → #9f1239` — identisch mit TeamerDashboardPage-Begruessung
- Nur 3 Stats anzeigen: Zertifikate, Events, Badges (Aktivitaeten entfernen)

### Antrags-Modal (AAN)
- Icons in Antragsdaten: personOutline (Konfi), documentTextOutline (Aktivitaet), calendarOutline (Datum), trophyOutline (Punkte)
- Entscheidungs-Buttons: Outline-Style mit farbigem Border — gruen (#059669) fuer Approve, rot (#dc3545) fuer Reject

### Admin-Profil (APR)
- Blauton: SectionHeader-Blau als Basis, Gradient `#3b82f6 → #2563eb` (statt aktuell `#667eea → #5567d5`)
- "App Info" Abschnitt: komplett entfernen (Code loeschen)
- Datumspicker: kein Endjahreszahlen-Limit

### Jahrgaenge (AJG)
- Datumspicker: kein Endjahreszahlen-Limit (max-Attribut entfernen falls vorhanden)

### Claude's Discretion
Keine — alle Entscheidungen vom User getroffen.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- SectionHeader Komponente mit preset-System (activities, success, events etc.)
- app-section-icon CSS-Klassen mit Farben pro Kategorie in variables.css (Zeile 364-383)
- app-list-item Pattern mit borderLeftColor, corner-badges
- useIonModal Hook fuer alle Modals
- useOfflineQuery fuer SWR-Caching
- IonDatetimeButton Pattern (bereits in Jahrgaenge-Modal)

### Established Patterns
- Admin-Gradient-Header: inline style mit linear-gradient
- TeamerDashboard Gradient: `#e11d48 → #be185d → #9f1239`
- Outline-Buttons: IonButton fill="outline" mit --border-color
- Stat-Chips in Header-Cards: flexbox mit gap

### Integration Points
- AdminActivitiesPage.tsx (176 Zeilen) → ActivitiesView.tsx (325 Zeilen)
- ActivityManagementModal.tsx (492 Zeilen) — Create/Edit mit Kategorien
- ActivityRequestModal.tsx (483 Zeilen) — Approve/Reject
- KonfiDetailView.tsx (648 Zeilen) + KonfiDetailSections.tsx (1181 Zeilen) — Teamer-Detail
- AdminProfilePage.tsx (336 Zeilen) — Profil mit Gradient-Header
- AdminJahrgaengeePage.tsx (572 Zeilen) — Inline JahrgangModal

</code_context>

<specifics>
## Specific Ideas

- Kategorie-Icons und -Farben sollen die SectionHeader-Presets aus variables.css nutzen
- Teamer-Header identisch zum Dashboard-Begruessung-Gradient
- Outline-Buttons wie sonst auch in der App (nicht filled)

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>
