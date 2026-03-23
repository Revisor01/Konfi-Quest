# Phase 66: Error Boundary und Sicherheitshaertung - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

React Error Boundaries einbauen damit Fehler nicht die ganze App crashen. CSP Headers evaluieren. MD5 durch sichere Hashes ersetzen falls verwendet. TLS-Konfiguration pruefen.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — infrastructure phase.

Aufgaben:
- React Error Boundary Komponente erstellen (Class Component, da Hooks nicht fuer Error Boundaries funktionieren)
- Error Boundary um Tab-Router wickeln (jeder Tab faengt eigene Fehler)
- Fallback-UI: Freundliche Fehlermeldung mit "Seite neu laden" Button
- CSP: helmet CSP ist bereits deaktiviert (reines API-Backend, kein HTML served) — NICHT aktivieren
- MD5: Pruefen ob irgendwo MD5 verwendet wird (z.B. fuer File-Hashing) — falls ja, durch SHA-256 ersetzen
- TLS: Backend-seitig bereits ueber Apache/KeyHelp konfiguriert — nur Frontend pruefen ob alle URLs https nutzen

</decisions>

<canonical_refs>
## Canonical References

- `frontend/src/App.tsx` — Haupt-App-Komponente wo Error Boundaries eingebaut werden
- `backend/server.js` — helmet Konfiguration (CSP bereits deaktiviert)

</canonical_refs>

<code_context>
## Existing Code Insights

### Known State
- Kein Error Boundary vorhanden — ein Fehler in einer Komponente crasht die gesamte App
- helmet ist aktiv aber CSP deaktiviert (korrekt fuer API-Backend)
- HTTPS ueberall via Apache reverse proxy

### Integration Points
- App.tsx — Error Boundary wrapper
- Jeder Tab-Router (IonRouterOutlet) — separate Error Boundary

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase.

</specifics>

<deferred>
## Deferred Ideas

None.

</deferred>

---

*Phase: 66-error-boundary-sicherheit*
*Context gathered: 2026-03-21*
