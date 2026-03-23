# Phase 82: Backend-Sicherheit + Cron - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Hardcodierte Geheimnisse aus dem Quellcode entfernen, Socket.IO Room-Join mit Organization-Isolation absichern, und Wrapped-Cron von setInterval auf node-cron umstellen.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion

Alle Implementierungsentscheidungen liegen bei Claude -- reine Infrastruktur-Phase.

Bekannte Details aus Codebase-Audit:
- Losung-API-Key (`ksadh8324oijcff45rfdsvcvhoids44`) ist in konfi.js (Zeile 1439) und teamer.js (Zeile 741) hardcodiert
- Socket.IO joinRoom (server.js Zeilen 53-68, 71-106) prueft keine Organization-Zugehoerigkeit
- Wrapped-Cron nutzt setInterval(24h) in backgroundService.js (Zeile 418)
- node-cron als Dependency fuer echten Cron-Scheduler mit korrekter Zeitberechnung nach Neustart

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `backend/server.js` -- Socket.IO Setup und Room-Handling
- `backend/routes/konfi.js` + `backend/routes/teamer.js` -- Losung-API-Aufrufe
- `backend/services/backgroundService.js` -- Wrapped-Cron mit setInterval
- `docker-compose.yml` -- Umgebungsvariablen

### Established Patterns
- Umgebungsvariablen ueber process.env mit Fallback-Werten
- rbac.js Middleware fuer Auth-Checks
- db.query() fuer Datenbankzugriffe

### Integration Points
- docker-compose.yml fuer neue ENV (LOSUNG_API_KEY)
- server.js Socket.IO Event-Handler
- backgroundService.js Cron-Setup

</code_context>

<specifics>
## Specific Ideas

Keine spezifischen Anforderungen -- Infrastruktur-Phase.

</specifics>

<deferred>
## Deferred Ideas

None -- discussion stayed within phase scope

</deferred>
