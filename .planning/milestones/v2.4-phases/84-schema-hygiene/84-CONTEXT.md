# Phase 84: Schema-Hygiene - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

Inline-Schema-Migrationen aus Route-Dateien entfernen (badges.js, jahrgaenge.js, wrapped.js). Die Migrationen sind bereits in SQL-Dateien unter backend/migrations/ vorhanden -- der Inline-Code ist redundant und muss nur geloescht werden.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion

Alle Implementierungsentscheidungen liegen bei Claude -- reine Infrastruktur-Phase.

Bekannte Details aus Codebase-Audit:
- badges.js Zeilen 631-710: Schema-Checks und ALTERs (konfi_badges → user_badges etc.)
- jahrgaenge.js: Schema-Checks beim Start
- wrapped.js Zeilen 15-30: Schema-Checks beim Start
- Alle diese Migrationen existieren bereits in backend/migrations/064_consolidate_inline_schemas.sql und 075_wrapped.sql
- Die Inline-Versionen sind redundant und erhoehen nur die Server-Startzeit

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- backend/migrations/ -- Alle Migrationen bereits als SQL-Dateien vorhanden
- backend/database.js -- Fuehrt Migrationen beim Start aus

### Integration Points
- badges.js, jahrgaenge.js, wrapped.js -- Inline-Code entfernen
- Server-Start muss weiterhin sauber funktionieren

</code_context>

<specifics>
## Specific Ideas

Keine -- einfaches Loeschen von redundantem Code.

</specifics>

<deferred>
## Deferred Ideas

None

</deferred>
