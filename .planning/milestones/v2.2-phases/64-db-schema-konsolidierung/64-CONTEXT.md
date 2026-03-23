# Phase 64: DB-Schema-Konsolidierung - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Einheitliches DB-Schema herstellen: Altlasten bereinigen, fehlende Indizes ergaenzen, Foreign Keys wo noetig, Namenskonventionen vereinheitlichen. Backend-Migrations erstellen.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — infrastructure phase.

Aufgaben:
- DB-Schema analysieren (alle CREATE TABLE Statements + Migrationen)
- Fehlende Foreign Keys identifizieren und ergaenzen
- Fehlende Indizes auf haeufig abgefragte Spalten ergaenzen (organization_id, user_id, jahrgang_id, room_id)
- Altlasten-Tabellen identifizieren (deprecated admins/konfis Tables falls noch vorhanden)
- Namenskonventionen pruefen (snake_case konsistent)
- Alle Aenderungen als Backend-Migrations erstellen (nicht direkt in DB)
- WICHTIG: Bestehende Daten duerfen NICHT verloren gehen

</decisions>

<canonical_refs>
## Canonical References

- `backend/server.js` — DB-Initialisierung und Schema
- `backend/routes/*.js` — SQL-Queries zeigen welche Spalten/Tabellen genutzt werden
- `backend/migrations/` — Bestehende Migrations (falls vorhanden)

</canonical_refs>

<code_context>
## Existing Code Insights

### Established Patterns
- PostgreSQL mit pg Client (kein ORM)
- Migrationen als SQL-Dateien in backend/migrations/
- Docker-Deployment auf server.godsapp.de

### Integration Points
- Alle Backend-Routes nutzen direkte SQL-Queries
- Deployment: git push → Portainer auto-build

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

*Phase: 64-db-schema-konsolidierung*
*Context gathered: 2026-03-21*
