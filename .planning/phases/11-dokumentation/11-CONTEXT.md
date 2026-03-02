# Phase 11: Dokumentation - Context

**Gathered:** 2026-03-02
**Status:** Ready for planning

<domain>
## Phase Boundary

CLAUDE.md komplett neu schreiben, damit sie den tatsaechlichen Projektstatus korrekt widerspiegelt und Claude bei der taeglichen Arbeit maximal hilft. Keine historischen Migrations-Details, keine veralteten Status-Angaben -- nur aktuell relevante Informationen.

</domain>

<decisions>
## Implementation Decisions

### Migrationssektion
- Gesamte "PostgreSQL Migration Status" Sektion entfernen (inkl. "NOCH NICHT MIGRIERT", "MIGRATION VORGEHEN", Detail-Notizen pro System)
- Eine Zeile bei Systemarchitektur ergaenzen: "Alle 15 Routes vollstaendig auf PostgreSQL migriert"
- Keine historischen Problem/Loesung Details behalten

### Veraltete Informationen
- Unvollstaendiger DB-Befehl (Zeile 108): Ganze "Database direkt bearbeiten" Sektion entfernen
- SQLite/backup_sqlite Referenzen entfernen -- Migration abgeschlossen
- "WICHTIGE ERKENNTNISSE" Sektion bereinigen (alte SQLite Zeile raus)
- "System Status" Block komplett aktualisieren (IN ARBEIT, DEPRECATED auf aktuellen Stand)

### Daten und Zeitangaben
- Keine spezifischen Daten (z.B. "Juli 2025") verwenden
- Stattdessen Versions-Referenzen nutzen ("seit v1.0", "seit v1.1", "seit v1.2")
- Wartbarer, da sich Daten staendig aendern

### Gesamtansatz: Komplett neu schreiben
- CLAUDE.md wird von Grund auf neu geschrieben
- Nur behalten was Claude fuer die taegliche Arbeit wirklich braucht:
  - Architektur-Ueberblick (Frontend, Backend, DB)
  - Aktuelle DB-Struktur (Kern-Tabellen)
  - Entwicklungs- und Deployment-Kommandos (korrekt!)
  - Aktive Patterns und Constraints (Modal-Pattern, Design-Regeln, Emojis etc.)
  - Aktueller System-Status
- Rausfliegen: Historische Migrations-Details, geloeste Bugs, veraltete TODO-Listen

### Claude's Discretion
- Genaue Reihenfolge und Gruppierung der Sektionen
- Welche bestehenden Inhalte noch relevant sind (z.B. RBAC Tabellen-Schema)
- Formulierung der einzelnen Eintraege
- Ob "DEPRECATED" Sektion noch noetig ist oder die Constraints reichen

</decisions>

<specifics>
## Specific Ideas

- User will eine CLAUDE.md die Claude wirklich hilft -- kein historisches Dokument, sondern ein aktuelles Arbeitsdokument
- Kompakt und auf den Punkt -- keine veralteten Details die Claude verwirren

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- PROJECT.md: Enthaelt bereits aktuelle Key Decisions und Milestone-History -- CLAUDE.md muss das nicht duplizieren
- MEMORY.md: Enthaelt Design-System Referenz, bekannte Probleme, Patterns -- CLAUDE.md ergaenzt, nicht dupliziert

### Established Patterns
- CLAUDE.md wird bei jedem Gespraech geladen -- muss kompakt sein
- Kritische Regeln (Emojis, Umlaute, Modal-Pattern) stehen ganz oben und muessen bleiben
- DB-Schema Referenz wird aktiv genutzt fuer Route-Arbeit

### Integration Points
- CLAUDE.md ist die primaere Instruktionsdatei fuer Claude Code
- Zusammenspiel mit MEMORY.md (auto-memory) und PROJECT.md (GSD Planung)

</code_context>

<deferred>
## Deferred Ideas

None -- Diskussion blieb innerhalb des Phase-Scopes

</deferred>

---

*Phase: 11-dokumentation*
*Context gathered: 2026-03-02*
