# Phase 25: Foundation + Konfiguration - Research

**Researched:** 2026-03-05
**Domain:** Push-Notification Infrastruktur (DB-Schema, Firebase Error Handling)
**Confidence:** HIGH

## Summary

Phase 25 ist eine schlanke Infrastruktur-Phase: DB-Schema aufraumen, fehlende Tabellen/Spalten anlegen, Firebase Error-Codes an PushService weiterreichen. Kein neues Abstraktions-Layer, keine Runtime-Konfiguration. Der User hat explizit entschieden, dass pushService.js mit seinen 16 statischen Methoden die "Registry" IST und keine zusaetzliche NotificationTypeRegistry gebaut werden soll.

Die drei Arbeitsbereiche sind klar abgegrenzt: (1) SQL-Migrations-Dateien fuer push_tokens-Erweiterung und event_reminders-Tabelle, (2) CREATE TABLE IF NOT EXISTS aus notifications.js Route entfernen, (3) Firebase Error-Code Forwarding in firebase.js anpassen.

**Primary recommendation:** Drei isolierte Aenderungen in backend/migrations/, backend/push/firebase.js und backend/routes/notifications.js -- keine Abhaengigkeiten untereinander, parallele Bearbeitung moeglich.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- pushService.js mit seinen 16 statischen Methoden IST die Registry -- kein zusaetzliches Abstraktions-Layer, keine Type-Definitionen-Datei
- Push-Types abschalten = Aufruf in der Route auskommentieren (eine Zeile)
- CFG-01/CFG-02 werden pragmatisch abgedeckt: Code-Kommentare dokumentieren die Types
- DB-Schema: SQL Migration-Dateien in `backend/migrations/` (einmalig ausgefuehrt, kein automatisches Migration-System)
- `push_tokens` Tabelle: Spalten `error_count` (INT DEFAULT 0) und `last_error_at` (TIMESTAMPTZ) hinzufuegen
- `event_reminders` Tabelle erstellen (wird von backgroundService.js referenziert aber existiert nicht)
- CREATE TABLE IF NOT EXISTS aus `notifications.js:33-43` in Migration verschieben, aus Route entfernen
- Firebase Error-Code Forwarding: `firebase.js` gibt Error-Code (z.B. `messaging/registration-token-not-registered`) mit zurueck
- pushService.js entscheidet was mit dem Error-Code passiert (saubere Trennung)
- Eigentliche Token-Loeschung passiert in Phase 26

### Claude's Discretion
- Exaktes SQL-Schema fuer event_reminders (Spalten, Constraints)
- Migration-Datei-Namenskonvention
- Wie der Error-Code im Return-Objekt strukturiert wird

### Deferred Ideas (OUT OF SCOPE)
None -- discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CFG-01 | Push-Types koennen per Konfig-Flag aktiviert/deaktiviert werden (Code-Level Defaults) | Pragmatisch geloest: pushService.js IST die Registry, Abschalten = Aufruf auskommentieren. Code-Kommentare dokumentieren alle 16 Types mit enabled-Status. |
| CFG-02 | Notification-Type Registry mit zentraler Type-Definition und Default-Einstellungen | Pragmatisch geloest: pushService.js mit 16 statischen Methoden IST die Registry. Keine separate Type-Datei noetig. Kommentar-Block am Dateianfang listet alle Types. |
</phase_requirements>

## Architecture Patterns

### Bestehende Migration-Konvention
Es existiert bereits `backend/migrations/add_invite_codes.sql` als Vorlage:
- Verzeichnis: `backend/migrations/`
- Format: SQL-Dateien mit Kommentar-Header ("Migration: ...", "Run this SQL on the production database")
- Verwendet `CREATE TABLE IF NOT EXISTS` und `CREATE INDEX IF NOT EXISTS`
- Keine automatische Migration-Engine -- manuelles Ausfuehren auf Production

### Empfohlene Migration-Datei-Namenskonvention
Bestehend: `add_invite_codes.sql` (ohne Datum/Nummer). Fuer Konsistenz:
```
backend/migrations/
  add_invite_codes.sql          # bestehend
  add_push_foundation.sql       # NEU: push_tokens erweitern + event_reminders erstellen
```

Ein einziges Migration-File fuer alle Schema-Aenderungen dieser Phase, da sie logisch zusammengehoeren (Push-Foundation).

### Firebase Error-Code Return-Struktur

**Aktuell (firebase.js:65-68):**
```javascript
return { success: false, error: error.message };
```

**Empfohlen:**
```javascript
return { success: false, error: error.message, errorCode: error.code || null };
```

Firebase Admin SDK Error-Objekt hat `error.code` als String, z.B.:
- `messaging/registration-token-not-registered` -- Token ungueltig, sollte geloescht werden
- `messaging/invalid-registration-token` -- Token-Format ungueltig, sollte geloescht werden
- `messaging/message-rate-exceeded` -- Temporaer, NICHT loeschen
- `messaging/server-unavailable` -- Temporaer, NICHT loeschen
- `messaging/internal-error` -- Temporaer, NICHT loeschen

**Confidence:** HIGH -- verifiziert mit Firebase-Dokumentation

### PushService Error-Code Nutzung (Vorbereitung fuer Phase 26)

In `pushService.js:39-53` (sendToUser for-loop): Aktuell wird der Error nur geloggt. Nach dem firebase.js-Update kann der Error-Code im Return-Objekt gelesen werden. Die tatsaechliche Token-Loeschung/error_count-Erhoehung passiert erst in Phase 26.

Fuer Phase 25 reicht es, den Error-Code durchzureichen. pushService.js muss in dieser Phase NICHT angepasst werden (da sendFirebasePushNotification returned und nicht throws -- siehe Code Zeile 41-48, der Aufruf ist in einem try-catch aber die Funktion returned statt zu throwen).

**WICHTIG:** `sendFirebasePushNotification` returned `{ success: false, error, errorCode }` -- es wirft keine Exception. Der bestehende try-catch in pushService.js (Zeile 49-52) faengt nur Netzwerk-Fehler ab, nicht Firebase-Fehler. Das bedeutet: pushService.js muss das Return-Objekt pruefen, nicht den catch-Block. Dies ist Phase-26-Arbeit.

### Notifications Route Cleanup

`notifications.js:33-43` enthaelt einen inline `CREATE TABLE IF NOT EXISTS push_tokens`. Das muss raus, weil:
1. Es wird bei jedem POST /device-token aufgerufen (unnoetige DB-Last)
2. Die Tabelle existiert laengst in Production
3. Schema-Definition gehoert in Migration, nicht in Route

**Aenderung:** Die 11 Zeilen (33-43) komplett entfernen. Die Tabelle existiert bereits und wird durch die Migration mit den neuen Spalten erweitert.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Migration-System | Automatisches Migrations-Framework | Einfache SQL-Dateien manuell ausfuehren | Projekt hat bereits dieses Pattern, kein Overhead fuer 2-3 Migrationen |
| NotificationTypeRegistry | Eigene Registry-Klasse mit Type-Maps | pushService.js statische Methoden + Kommentare | User-Entscheidung: Over-Engineering vermeiden |
| Error-Code Mapping | Eigene Error-Code-zu-Action Map | Einfaches `errorCode` Feld im Return-Objekt | Phase 26 entscheidet ueber Actions |

## Common Pitfalls

### Pitfall 1: ALTER TABLE ohne IF NOT EXISTS
**Was schief geht:** `ALTER TABLE push_tokens ADD COLUMN error_count INT` schlaegt fehl wenn die Spalte schon existiert (z.B. bei erneutem Ausfuehren).
**Warum:** PostgreSQL hat kein `ADD COLUMN IF NOT EXISTS` vor Version 9.6. Dieses Projekt laeuft auf Docker-PostgreSQL, vermutlich >= 14.
**Vermeidung:** PostgreSQL >= 9.6 unterstuetzt `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`. Verwenden:
```sql
ALTER TABLE push_tokens ADD COLUMN IF NOT EXISTS error_count INTEGER DEFAULT 0;
ALTER TABLE push_tokens ADD COLUMN IF NOT EXISTS last_error_at TIMESTAMPTZ;
```
**Confidence:** HIGH

### Pitfall 2: event_reminders ohne Foreign Keys
**Was schief geht:** event_reminders ohne FK-Constraints fuehrt zu verwaisten Eintraegen wenn Events oder User geloescht werden.
**Vermeidung:** `ON DELETE CASCADE` auf event_id und user_id setzen.

### Pitfall 3: Firebase Error.code ist undefined bei Netzwerk-Fehlern
**Was schief geht:** Nicht alle Errors haben einen `error.code`. Netzwerk-Timeouts oder Connection-Errors haben moeglicherweise keinen Firebase-spezifischen Code.
**Vermeidung:** `errorCode: error.code || null` -- immer null-safe zurueckgeben.

### Pitfall 4: notifications.js CREATE TABLE entfernen bricht Erstinstallation
**Was schief geht:** Wenn jemand das Projekt frisch aufsetzt, existiert die push_tokens Tabelle nicht.
**Vermeidung:** Die Migration-Datei enthaelt `CREATE TABLE IF NOT EXISTS push_tokens (...)` mit dem vollstaendigen Schema (inkl. neuer Spalten). Damit funktioniert auch eine Erstinstallation.

## Code Examples

### Migration-Datei: add_push_foundation.sql

```sql
-- Migration: Push Foundation (Phase 25)
-- Erweitert push_tokens und erstellt event_reminders
-- Run this SQL on the production database

-- 1. push_tokens Tabelle erstellen falls nicht vorhanden (Erstinstallation)
CREATE TABLE IF NOT EXISTS push_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    user_type TEXT NOT NULL,
    token TEXT NOT NULL,
    platform TEXT NOT NULL,
    device_id TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, platform, device_id)
);

-- 2. Neue Spalten fuer Token-Fehler-Tracking (Phase 26 nutzt diese)
ALTER TABLE push_tokens ADD COLUMN IF NOT EXISTS error_count INTEGER DEFAULT 0;
ALTER TABLE push_tokens ADD COLUMN IF NOT EXISTS last_error_at TIMESTAMPTZ;

-- 3. event_reminders Tabelle (von backgroundService.js benoetigt)
CREATE TABLE IF NOT EXISTS event_reminders (
    id SERIAL PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reminder_type VARCHAR(10) NOT NULL,  -- '1_day' oder '1_hour'
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(event_id, user_id, reminder_type)
);

-- Index fuer schnelle Lookup in backgroundService
CREATE INDEX IF NOT EXISTS idx_event_reminders_event_user
    ON event_reminders(event_id, user_id);
```

**Confidence:** HIGH -- Schema abgeleitet aus backgroundService.js:167-170 (INSERT INTO event_reminders mit event_id, user_id, reminder_type, sent_at) und notifications.js:33-43 (bestehende push_tokens Struktur).

### event_reminders Schema-Herleitung

Aus backgroundService.js Zeilen 167-170 und 209-211:
```javascript
await db.query(
    `INSERT INTO event_reminders (event_id, user_id, reminder_type, sent_at) VALUES ($1, $2, '1_day', NOW())`,
    [event.id, event.user_id]
);
```

Daraus ergeben sich die Spalten: `event_id`, `user_id`, `reminder_type`, `sent_at`. Plus `id` als PK und UNIQUE-Constraint auf (event_id, user_id, reminder_type) um doppelte Erinnerungen zu verhindern (was der `NOT EXISTS`-Check in den Queries sicherstellt).

### Firebase Error-Code Forwarding

```javascript
// firebase.js - Zeilen 65-68 aendern
} catch (error) {
    console.error('Firebase notification error:', error);
    return { success: false, error: error.message, errorCode: error.code || null };
}
```

### Push-Type Dokumentation (CFG-01/CFG-02)

Am Anfang von pushService.js als Kommentar-Block:
```javascript
/**
 * Push Notification Type Registry
 *
 * Alle Push-Types werden durch statische Methoden in dieser Klasse definiert.
 * Zum Deaktivieren eines Types: Aufruf in der jeweiligen Route auskommentieren.
 *
 * Type                              | Methode                              | Empfaenger | Enabled
 * ----------------------------------|--------------------------------------|------------|--------
 * chat                              | sendChatNotification                 | User       | ja
 * badge_update                      | sendBadgeUpdate                      | User       | ja
 * new_activity_request              | sendNewActivityRequestToAdmins       | Admins     | ja
 * activity_request_status           | sendActivityRequestStatusToKonfi     | Konfi      | ja
 * badge_earned                      | sendBadgeEarnedToKonfi               | Konfi      | ja
 * activity_assigned                 | sendActivityAssignedToKonfi          | Konfi      | ja
 * bonus_points                      | sendBonusPointsToKonfi               | Konfi      | ja
 * event_registered                  | sendEventRegisteredToKonfi           | Konfi      | ja
 * event_unregistered                | sendEventUnregisteredToKonfi         | Konfi      | ja
 * event_unregistration              | sendEventUnregistrationToAdmins      | Admins     | ja
 * level_up                          | sendLevelUpToKonfi                   | Konfi      | ja
 * event_reminder                    | sendEventReminderToKonfi             | Konfi      | ja
 * waitlist_promotion                | sendWaitlistPromotionToKonfi         | Konfi      | ja
 * event_cancelled                   | sendEventCancellationToKonfis        | Konfis     | ja
 * new_event                         | sendNewEventToOrgKonfis              | Konfis     | ja
 * event_attendance                  | sendEventAttendanceToKonfi           | Konfi      | ja
 * events_pending_approval           | sendEventsPendingApprovalToAdmins    | Admins     | ja
 */
```

Hinweis: Es sind 17 Methoden (nicht 16 wie im Context angegeben), inklusive sendBadgeUpdate die eher ein Badge-Sync als ein User-facing Push ist. Beide Zahlungen sind akzeptabel, da der Kommentar-Block alle abdeckt.

## State of the Art

| Bereich | Ist-Zustand | Soll-Zustand (Phase 25) | Impact |
|---------|-------------|------------------------|--------|
| push_tokens Schema | Kein error_count/last_error_at | Spalten vorhanden (DEFAULT 0 / NULL) | Vorbereitung fuer Phase 26 Token-Cleanup |
| event_reminders | Tabelle existiert nicht, backgroundService schreibt trotzdem | Tabelle existiert mit FK-Constraints | backgroundService laeuft fehlerfrei |
| Firebase Error-Codes | Nur error.message zurueckgegeben | error.code als errorCode im Return | Phase 26 kann Token-Loeschentscheidungen treffen |
| CREATE TABLE in Route | Inline in notifications.js bei jedem Request | In Migration-Datei, aus Route entfernt | Saubere Trennung Schema/Business-Logik |
| Push-Type Dokumentation | Keine zentrale Uebersicht | Kommentar-Block in pushService.js | CFG-01/CFG-02 erfuellt |

## Firebase Error-Codes Referenz (fuer Phase 26)

Aus offizieller Firebase-Dokumentation -- Token sollte geloescht werden bei:
- `messaging/registration-token-not-registered` -- Token abgelaufen/deregistriert
- `messaging/invalid-registration-token` -- Token-Format ungueltig

Token NICHT loeschen bei (temporaere Fehler):
- `messaging/message-rate-exceeded`
- `messaging/device-message-rate-exceeded`
- `messaging/server-unavailable`
- `messaging/internal-error`

**Confidence:** HIGH -- Firebase offizielle Dokumentation

## Open Questions

1. **PostgreSQL-Version im Docker-Container**
   - Was wir wissen: Projekt nutzt Docker-PostgreSQL
   - Was unklar ist: Exakte Version (relevant fuer ADD COLUMN IF NOT EXISTS, funktioniert ab 9.6)
   - Empfehlung: `ADD COLUMN IF NOT EXISTS` verwenden, da jede aktuelle Docker-PostgreSQL-Version >= 14 ist

2. **push_tokens Tabelle: Existiert sie in Production?**
   - Was wir wissen: CREATE TABLE IF NOT EXISTS wird bei jedem POST /device-token aufgerufen, also existiert sie
   - Was unklar ist: Ob sie genau das Schema aus notifications.js:33-43 hat
   - Empfehlung: Migration mit IF NOT EXISTS und ADD COLUMN IF NOT EXISTS ist idempotent -- sicher

## Sources

### Primary (HIGH confidence)
- Codebase-Analyse: pushService.js, firebase.js, notifications.js, backgroundService.js
- Bestehende Migration: backend/migrations/add_invite_codes.sql (Pattern-Vorlage)
- Firebase FCM Error Codes: https://firebase.google.com/docs/cloud-messaging/error-codes

### Secondary (MEDIUM confidence)
- Firebase Admin Node Error-Objekt Struktur (error.code Property): https://github.com/firebase/firebase-admin-node/blob/main/src/utils/error.ts

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH -- Keine neuen Abhaengigkeiten, nur bestehender Code
- Architecture: HIGH -- Alle Patterns aus bestehendem Code abgeleitet
- Pitfalls: HIGH -- PostgreSQL IF NOT EXISTS und Firebase Error-Handling gut dokumentiert

**Research date:** 2026-03-05
**Valid until:** 2026-04-05 (stabile Infrastruktur-Phase, keine Fast-Moving Dependencies)
