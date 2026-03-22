# Phase 81: React Router Migration - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Migrate von React Router v5 auf v6 in der gesamten App. Alle useHistory-Aufrufe durch useNavigate ersetzen, Route-component-Pattern durch Route-element-Pattern ersetzen. Ionic-Routing-Kompatibilitaet sicherstellen.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion

Alle Implementierungsentscheidungen liegen bei Claude -- reine Infrastruktur-Phase. Wichtig: Ionic React nutzt eigene Routing-Wrapper (@ionic/react-router). Pruefen ob IonReactRouter mit React Router v6 kompatibel ist, da Ionic moeglicheweise eigene v6-kompatible Version mitbringt.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `frontend/src/App.tsx` -- Haupt-Router mit allen Routes
- React Router v5 Patterns: `useHistory`, `<Route component={...}>`, `<Redirect>`
- `@ionic/react-router` -- IonReactRouter Wrapper

### Established Patterns
- IonRouterOutlet fuer Tab-basiertes Routing (Konfi, Teamer, Admin)
- useHistory().push() fuer programmatische Navigation
- Route-Guards in App.tsx

### Integration Points
- Alle Pages mit useHistory Hook
- App.tsx zentrale Route-Konfiguration
- IonTabs + IonRouterOutlet Struktur

</code_context>

<specifics>
## Specific Ideas

User will pruefen was Ionic aktuell unterstuetzt bzgl. React Router Version. Die Migration muss Ionic-kompatibel sein.

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>
