# Phase 106: Frontend Tests - Context

**Gathered:** 2026-03-28
**Status:** Ready for planning
**Mode:** Auto-generated (discuss auto — pure test/infrastructure phase)

<domain>
## Phase Boundary

Kritische Frontend-Logik (Hooks, Utilities, Kern-Komponenten) ist mit Tests abgesichert. Tests laufen mit Vitest + jsdom im Frontend-Verzeichnis.

</domain>

<decisions>
## Implementation Decisions

### Test-Strategie
- **D-01:** Vitest mit jsdom fuer Component/Hook/Utility Tests
- **D-02:** Frontend hat bereits Vitest als devDependency (pruefen, ggf. installieren)
- **D-03:** Tests in frontend/src/__tests__/ oder frontend/tests/ (bestehende Konvention folgen)
- **D-04:** Ionic Shadow-DOM Components werden NICHT getestet (ROI zu gering, per REQUIREMENTS Out of Scope)

### Hook-Tests (FRT-01)
- **D-05:** useOfflineQuery: Caching-Verhalten, Retry-Logik, Stale-While-Revalidate testen
- **D-06:** useActionGuard: Online-Guard verifizieren (blockiert wenn offline)
- **D-07:** AppContext: Rollen-Kontext, User-Daten, Login/Logout-State testen

### Utility-Tests (FRT-02)
- **D-08:** tokenStore: Token setzen/lesen/loeschen, Refresh-Token Handling
- **D-09:** networkMonitor: Online/Offline Detection, Event-Listener
- **D-10:** api-Service: Base-URL, Auth-Header, Error-Handling

### Component-Tests (FRT-03)
- **D-11:** Mindestens 5 Component-Tests fuer kritische Views
- **D-12:** Testen ob Komponenten rendern, nicht ob Ionic korrekt styled

### Claude's Discretion
Alle technischen Implementierungsdetails (Mock-Strategie, Test-Helpers, Ordnerstruktur) liegen bei Claude.

</decisions>

<canonical_refs>
## Canonical References

### Frontend-Code
- `frontend/src/hooks/` — Hooks zu testen
- `frontend/src/services/` oder `frontend/src/utils/` — Utilities zu testen
- `frontend/src/context/` — AppContext
- `frontend/package.json` — Bestehende Test-Config und Dependencies
- `frontend/vite.config.ts` — Build-Config (Vitest Config ggf. hier oder separat)

### CI-Integration
- `.github/workflows/ci.yml` — Frontend-Test Job bereits konfiguriert (npx vitest run --passWithNoTests)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- CI Pipeline hat bereits frontend-test Job (Phase 105)
- Vitest laeuft im Frontend mit --passWithNoTests

### Integration Points
- Tests muessen mit npx vitest run ausfuehrbar sein
- CI fuehrt cd frontend && npm ci && npx vitest run aus

</code_context>

<specifics>
## Specific Ideas

No specific requirements — pure test phase.

</specifics>

<deferred>
## Deferred Ideas

None.

</deferred>

---

*Phase: 106-frontend-tests*
*Context gathered: 2026-03-28*
