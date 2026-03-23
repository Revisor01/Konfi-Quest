# Phase 77: Teamer-Slides - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

7 Teamer-spezifische Slides die den gleichen WrappedModal-Container (Phase 76) nutzen. Rosa/Pink Akzentfarbe statt Lila.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
Alle Entscheidungen sind bei Claude — gleiches Pattern wie Konfi-Slides, nur mit Teamer-Daten und Rosa-Farbe.

Key points:
- WrappedModal wird um `type: 'teamer'` Parameter erweitert
- Farbe: Rosa #e11d48 statt Lila #5b21b6
- 7 Slides: Intro, Events, Konfis, Badges, Zertifikate, Jahre, Abschluss
- Wiederverwendung von SlideBase, useCountUp, CSS-Animationen
- Daten aus GET /api/wrapped/:userId (type=teamer)

</decisions>

<canonical_refs>
## Canonical References

- `frontend/src/components/wrapped/WrappedModal.tsx` — Container (Phase 76)
- `frontend/src/components/wrapped/slides/` — Konfi-Slides als Referenz
- `frontend/src/types/wrapped.ts` — TeamerWrappedData Interface
- `backend/routes/wrapped.js` — GET /wrapped/:userId

</canonical_refs>

<code_context>
## Existing Code Insights

Konfi-Slides existieren als exakte Vorlage. SlideBase-Komponente ist wiederverwendbar.

</code_context>

<specifics>
No specific requirements.
</specifics>

<deferred>
None.
</deferred>

---
*Phase: 77-teamer-slides*
