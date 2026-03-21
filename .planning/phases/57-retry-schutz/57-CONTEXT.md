# Phase 57: Retry + Schutz - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

axios-retry fuer automatische Wiederholung transienter Fehler. Double-Submit-Schutz auf allen Submit-Buttons. Idempotency-Keys (client_id UUID) im Backend fuer Chat-Nachrichten und Aktivitaets-Antraege.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — infrastructure phase.

Key guidelines from Research:
- axios-retry v4.5.0+, 3 Retries, Exponential Backoff mit Jitter
- Nur 5xx, 408, 429 (mit Retry-After Header) wiederholen — NICHT 4xx
- useActionGuard Hook oder isSubmitting Pattern fuer Button-Disable
- Backend: client_id UUID Spalte auf chat_messages mit UNIQUE Index
- Backend: Idempotency-Key Middleware fuer POST /chat/rooms/:id/messages und POST /konfi/requests
- DB-Migration: ALTER TABLE chat_messages ADD COLUMN client_id UUID

</decisions>

<canonical_refs>
## Canonical References

- `.planning/research/DEEP-OFFLINE-ANALYSIS.md` §3 (Write Queue Gruppierung — Idempotenz-Strategien)
- `.planning/research/SUMMARY.md` §Phase 3 (Retry-Logik + Double-Submit-Schutz)
- `frontend/src/services/api.ts` — Bestehender Axios-Interceptor wo retry eingefuegt wird
- `backend/routes/chat.js` — Chat-Messages Route fuer client_id Deduplizierung

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- api.ts Response-Interceptor — bereits 401 + 429 Handler vorhanden, axios-retry kann als Request-Interceptor daneben existieren
- Alle Submit-Buttons nutzen bereits onClick-Handler mit try/catch — isSubmitting State kann dort eingefuegt werden

### Established Patterns
- Alle Modals haben onSuccess/onClose Callbacks — Button-Disable passt in dieses Pattern
- Chat-Nachrichten werden via POST /chat/rooms/:id/messages mit FormData gesendet

### Integration Points
- api.ts — axios-retry Konfiguration
- Alle Modals mit Submit-Buttons — isSubmitting State
- backend/routes/chat.js — client_id Parameter + Deduplizierung
- backend/routes/konfi.js — client_id fuer Aktivitaets-Antraege

</code_context>

<specifics>
## Specific Ideas

No specific requirements — infrastructure phase.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 57-retry-schutz*
*Context gathered: 2026-03-21*
