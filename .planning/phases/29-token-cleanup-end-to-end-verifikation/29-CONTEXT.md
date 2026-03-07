# Phase 29: Token-Cleanup + End-to-End Verifikation - Context

**Gathered:** 2026-03-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Proaktiver Cleanup von verwaisten/fehlerhaften Push-Tokens und systematisches Code-Audit aller 17 Push-Flows (Backend + Frontend). Gefundene Luecken werden direkt gefixt. Keine neuen Push-Flows, keine neuen Features.

</domain>

<decisions>
## Implementation Decisions

### Token-Cleanup (CLN-02)
- Token mit error_count >= 10 automatisch loeschen
- Tokens die seit 30 Tagen nicht aktualisiert wurden (updated_at) loeschen
- Cleanup-Intervall: alle 6 Stunden via setInterval in backgroundService
- Logging: Eine Zusammenfassungszeile pro Cleanup-Lauf ("Token cleanup: X error tokens, Y inactive tokens deleted")
- Kein node-cron — bestehendes setInterval-Pattern verwenden

### Push-Flow Code-Audit (CMP-01)
- Systematischer Code-Check aller 17 Push-Types aus der Registry
- Fuer jeden Type pruefen: Methode existiert, wird aufgerufen, hat korrekten Type-String, ist in Registry dokumentiert
- Frontend-Handler ebenfalls pruefen: Tap-Navigation fuer jeden Push-Type vorhanden und korrekt
- Gefundene Luecken direkt in dieser Phase fixen (nicht nur dokumentieren)
- Audit-Ergebnis wird Teil des normalen VERIFICATION.md (keine separate Datei)

### Result-Pattern Konsistenz
- sendBadgeUpdate auf das gleiche Result-Pattern wie sendToUser angleichen (error_count Tracking + fatale Token-Loeschung)
- Im Rahmen des Audits: ALLE 17 Push-Methoden auf korrektes Result-Pattern pruefen
- Inkonsistenzen direkt beheben — jede Methode soll result.success auswerten, error_count tracken, fatale Tokens loeschen

### Claude's Discretion
- Reihenfolge der Audit-Checks
- Exakte SQL-Queries fuer den Cleanup
- Wie das Audit-Ergebnis im VERIFICATION.md strukturiert wird

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- backgroundService.js: setInterval-Pattern fuer periodische Tasks (5 Min Badge, 15 Min Reminder) — Cleanup kann gleich integriert werden
- pushService.js: error_count/last_error_at Tracking bereits in sendToUser (Z.80-102) und sendChatNotification (Z.186-207) — Pattern zum Kopieren vorhanden
- pushService.js: Push-Type Registry als Kommentar-Block (Z.3-33) — 17 Types dokumentiert, Audit-Basis

### Established Patterns
- Fatal error handling: fatalCodes Array mit 'messaging/registration-token-not-registered' und 'messaging/invalid-registration-token'
- Error tracking: error_count inkrementieren bei temporaerem Fehler, zuruecksetzen bei Erfolg
- Service-Start: BackgroundService.startAllServices(db) in server.js:446

### Integration Points
- backgroundService.js: Neuer Cleanup-Service analog zu startEventReminderService
- pushService.js: sendBadgeUpdate (Z.231-262) muss auf Result-Pattern umgestellt werden
- AppContext.tsx: pushNotificationActionPerformed Handler (Z.329-371) fuer fehlende Navigation-Cases

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 29-token-cleanup-end-to-end-verifikation*
*Context gathered: 2026-03-07*
