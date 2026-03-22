# Phase 78: Share-Funktion - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Screenshot-Export einzelner Slides als Bild, natives Share-Sheet, Text-Fallback, Wasserzeichen. Funktioniert fuer Konfi UND Teamer Wrapped.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
Alle Entscheidungen bei Claude — Research hat klare Vorgaben:

- html-to-image (npm install html-to-image) fuer Screenshot-Export
- Share-Cards als REINE HTML/CSS Elemente (kein Ionic Shadow-DOM — html-to-image rendert das nicht zuverlaessig)
- Capacitor Share + Filesystem (bereits installiert) fuer nativen Share-Flow
- Format: 1080x1920 (Story-Format fuer Instagram/WhatsApp)
- Dezentes Wasserzeichen unten (App-Name + Logo)
- Text-Fallback wenn Bild-Export fehlschlaegt
- Share-Button auf jedem Slide (unten rechts oder in Toolbar)

### Wichtig aus Research (Pitfalls)
- html-to-image rendert Ionic Shadow-DOM nicht zuverlaessig
- Share-Cards muessen als separate Hidden-Divs gerendert werden (nicht der sichtbare Slide)
- iOS WKWebView hat bekannte Rendering-Probleme — Text-Fallback ist Pflicht

</decisions>

<canonical_refs>
## Canonical References

- `.planning/research/STACK.md` — html-to-image Empfehlung
- `.planning/research/PITFALLS.md` — Shadow-DOM Rendering
- `frontend/src/components/wrapped/WrappedModal.tsx` — Share-Button Integration
- `frontend/src/utils/nativeFileViewer.ts` — Filesystem+Share Pattern (Referenz)

</canonical_refs>

<code_context>
## Existing Code Insights

- @capacitor/share und @capacitor/filesystem bereits installiert
- nativeFileViewer.ts hat Filesystem-Write + Share Pattern
- WrappedModal hat bereits Slide-Komponenten wo Share-Button eingefuegt wird

</code_context>

<specifics>
No specific requirements.
</specifics>

<deferred>
None.
</deferred>

---
*Phase: 78-share-funktion*
