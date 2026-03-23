# Phase 25: Foundation + Konfiguration - Context

**Gathered:** 2026-03-05
**Status:** Ready for planning

<domain>
## Phase Boundary

DB-Schema aufraumen, fehlende Tabellen/Spalten anlegen, Firebase Error-Codes an PushService weiterreichen. Grundlage fuer Token-Lifecycle (Phase 26) und alle weiteren Push-Aenderungen.

Explizit NICHT in dieser Phase: Keine NotificationTypeRegistry, keine Runtime-Konfiguration, keine neuen Push-Flows.

</domain>

<decisions>
## Implementation Decisions

### Keine NotificationTypeRegistry
- pushService.js mit seinen 16 statischen Methoden IST die Registry
- Kein zusaetzliches Abstraktions-Layer, keine Type-Definitionen-Datei
- Push-Types abschalten = Aufruf in der Route auskommentieren (eine Zeile)
- CFG-01/CFG-02 werden pragmatisch abgedeckt: Code-Kommentare dokumentieren die Types

### DB-Schema: SQL Migration-Dateien
- Neues Verzeichnis: `backend/migrations/`
- SQL-Dateien die einmalig ausgefuehrt werden (kein automatisches Migration-System)
- Inhalt:
  - `push_tokens` Tabelle: Spalten `error_count` (INT DEFAULT 0) und `last_error_at` (TIMESTAMPTZ) hinzufuegen
  - `event_reminders` Tabelle erstellen (wird von backgroundService.js referenziert aber existiert nicht)
  - CREATE TABLE IF NOT EXISTS aus `notifications.js:33-43` in Migration verschieben, aus Route entfernen

### Firebase Error-Code Forwarding
- `firebase.js:sendFirebasePushNotification()` gibt aktuell nur `{ success: false, error: error.message }` zurueck
- Aendern: Error-Code (z.B. `messaging/registration-token-not-registered`, `messaging/invalid-registration-token`) mit zurueckgeben
- pushService.js entscheidet was mit dem Error-Code passiert (saubere Trennung)
- Eigentliche Token-Loeschung passiert in Phase 26

### Claude's Discretion
- Exaktes SQL-Schema fuer event_reminders (Spalten, Constraints)
- Migration-Datei-Namenskonvention
- Wie der Error-Code im Return-Objekt strukturiert wird

</decisions>

<specifics>
## Specific Ideas

- User will keine Over-Engineering: "Macht es ueberhaupt Sinn so ne zentrale Verwaltung einzubauen?" → Nein, pragmatisch bleiben
- Phase 25 ist deutlich schlanker als original geplant — reines Fundament fuer Phase 26+

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `pushService.js` — 16 Push-Methoden, sendToUser/sendToMultipleUsers als Basis-Helper
- `backgroundService.js` — 3 setInterval-Services (Badge, Event-Reminder, Pending Events), nutzt event_reminders Tabelle

### Established Patterns
- pushService.js: Statische Klasse mit try/catch pro Methode, console.error bei Fehlern
- firebase.js: Singleton-Pattern fuer Firebase-Init, returns `{ success, messageId }` oder `{ success: false, error }`
- notifications.js: CREATE TABLE IF NOT EXISTS inline bei POST (muss raus)

### Integration Points
- `firebase.js:65-68` — Error-Return anpassen (Error-Code hinzufuegen)
- `pushService.js:39-53` — sendToUser for-loop nutzt firebase Return
- `notifications.js:33-43` — CREATE TABLE raus, in Migration
- `backgroundService.js:167-170` — Schreibt in event_reminders (Tabelle muss existieren)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 25-foundation-konfiguration*
*Context gathered: 2026-03-05*
