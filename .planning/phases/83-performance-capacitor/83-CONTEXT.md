# Phase 83: Performance + Capacitor - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Chat-Nachrichten-Endpoint N+1 Query Problem loesen (Reactions/Votes per Bulk-Query), und alle (window as any).Capacitor Zugriffe in AppContext.tsx durch typsichere Plugin-Imports ersetzen.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion

Alle Implementierungsentscheidungen liegen bei Claude -- reine Infrastruktur-Phase.

Bekannte Details aus Codebase-Audit:
- Chat N+1: chat.js Zeilen 599-630 fuehrt pro Nachricht (bis 200) separate Queries fuer Reactions und Poll-Votes aus
- Fix: Bulk-Query mit WHERE message_id = ANY($1::int[]), dann im JS-Code zuordnen
- Capacitor: AppContext.tsx Zeilen 23, 25, 54, 145, 173, 248, 250, 260-261 nutzen (window as any).Capacitor
- Fix: Korrekte Plugin-Imports nutzen (z.B. import { FCM } from '@capacitor-community/fcm')

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/routes/chat.js` -- Chat-Nachrichten mit N+1 Reactions-Query
- `frontend/src/contexts/AppContext.tsx` -- Capacitor-Plugin-Zugriffe

### Integration Points
- chat.js GET /rooms/:id/messages Endpoint
- AppContext.tsx FCM/Push Plugin Zugriffe

</code_context>

<specifics>
## Specific Ideas

Keine spezifischen Anforderungen -- Infrastruktur-Phase.

</specifics>

<deferred>
## Deferred Ideas

None

</deferred>
