# Phase 79: Dashboard-Integration + Freischaltung - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Dashboard-Cards "Wrapped ist da!" fuer Konfi und Teamer. Push-Notification bei Freischaltung. Einmaligkeit sicherstellen.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
Alle Entscheidungen bei Claude:

- KonfiDashboardPage: Neue Card wenn has_wrapped=true → oeffnet WrappedModal
- TeamerDashboardPage: Gleiche Card mit Rosa-Farbe
- Push via bestehendes pushService.sendToUser Pattern
- Push-Text: "Dein Konfi-Jahr ist da!" / "Dein Teamer-Jahr ist da!"
- Einmaligkeit: wrapped_snapshots hat UNIQUE auf (user_id, type, year) — Backend generiert nicht doppelt
- Card verschwindet NICHT nach dem Oeffnen — bleibt fuer erneutes Anschauen

</decisions>

<canonical_refs>
## Canonical References

- `frontend/src/components/konfi/pages/KonfiDashboardPage.tsx` — Dashboard-Card einfuegen
- `frontend/src/components/teamer/pages/TeamerDashboardPage.tsx` — Dashboard-Card einfuegen
- `backend/services/pushService.js` — Push-Notification Pattern
- `backend/routes/wrapped.js` — has_wrapped Flag bereits in Phase 75 implementiert

</canonical_refs>

<code_context>
## Existing Code Insights

- has_wrapped Flag im Dashboard-Response (Phase 75)
- WrappedModal fertig (Phase 76+77)
- useIonModal Pattern fuer Modal-Oeffnung
- pushService.sendToUser fuer Push-Benachrichtigungen

</code_context>

<specifics>
No specific requirements.
</specifics>

<deferred>
None.
</deferred>

---
*Phase: 79-dashboard-integration-freischaltung*
