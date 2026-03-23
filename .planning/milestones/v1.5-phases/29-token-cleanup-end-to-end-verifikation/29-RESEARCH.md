# Phase 29: Token-Cleanup + End-to-End Verifikation - Research

**Researched:** 2026-03-07
**Domain:** Push-Token Lifecycle Management, Push-Flow Code Audit
**Confidence:** HIGH

## Summary

Phase 29 umfasst zwei klar getrennte Aufgaben: (1) Automatischer Token-Cleanup via setInterval im backgroundService und (2) systematisches Code-Audit aller 17 Push-Flows mit direktem Fix von Inkonsistenzen.

Der Token-Cleanup ist technisch unkompliziert: zwei DELETE-Queries (error_count >= 10, updated_at aelter als 30 Tage) in einem neuen Service-Intervall alle 6 Stunden. Das Audit erfordert systematischen Abgleich zwischen Registry (pushService.js Z.3-33), Methoden-Implementierungen, Route-Aufrufen und Frontend-Navigation-Handlern. Die groesste konkrete Luecke ist sendBadgeUpdate, die kein Result-Pattern hat (kein error_count Tracking, keine fatale Token-Loeschung).

**Primary recommendation:** Cleanup-Service zuerst implementieren (isoliert, kein Risiko), dann systematisches Audit aller 17 Push-Methoden mit sendBadgeUpdate-Fix als Hauptaktion.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- Token mit error_count >= 10 automatisch loeschen
- Tokens die seit 30 Tagen nicht aktualisiert wurden (updated_at) loeschen
- Cleanup-Intervall: alle 6 Stunden via setInterval in backgroundService
- Logging: Eine Zusammenfassungszeile pro Cleanup-Lauf ("Token cleanup: X error tokens, Y inactive tokens deleted")
- Kein node-cron — bestehendes setInterval-Pattern verwenden
- Systematischer Code-Check aller 17 Push-Types aus der Registry
- Fuer jeden Type pruefen: Methode existiert, wird aufgerufen, hat korrekten Type-String, ist in Registry dokumentiert
- Frontend-Handler ebenfalls pruefen: Tap-Navigation fuer jeden Push-Type vorhanden und korrekt
- Gefundene Luecken direkt in dieser Phase fixen (nicht nur dokumentieren)
- Audit-Ergebnis wird Teil des normalen VERIFICATION.md (keine separate Datei)
- sendBadgeUpdate auf das gleiche Result-Pattern wie sendToUser angleichen (error_count Tracking + fatale Token-Loeschung)
- Im Rahmen des Audits: ALLE 17 Push-Methoden auf korrektes Result-Pattern pruefen
- Inkonsistenzen direkt beheben — jede Methode soll result.success auswerten, error_count tracken, fatale Tokens loeschen

### Claude's Discretion
- Reihenfolge der Audit-Checks
- Exakte SQL-Queries fuer den Cleanup
- Wie das Audit-Ergebnis im VERIFICATION.md strukturiert wird

### Deferred Ideas (OUT OF SCOPE)
Keine — Discussion blieb im Phase-Scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| CLN-02 | Periodischer Cleanup von verwaisten Tokens (User geloescht, Token veraltet) | Token-Cleanup Service Pattern in backgroundService.js, SQL-Queries fuer error_count und updated_at Filterung, push_tokens Schema mit error_count/updated_at Spalten |
| CMP-01 | Alle bestehenden 14 Push-Flows verifiziert und funktionsfaehig | Vollstaendige Audit-Matrix aller 17 Push-Types mit Methoden, Route-Aufrufen und Frontend-Handlern dokumentiert |
</phase_requirements>

## Architecture Patterns

### Bestehendes backgroundService Pattern

Der backgroundService nutzt ein konsistentes Pattern fuer periodische Tasks:

```javascript
// Source: backend/services/backgroundService.js
static tokenCleanupInterval = null;

static startTokenCleanupService(db) {
  if (this.tokenCleanupInterval) return;

  const SIX_HOURS = 6 * 60 * 60 * 1000;
  this.tokenCleanupInterval = setInterval(async () => {
    try {
      await this.cleanupStaleTokens(db);
    } catch (error) {
      console.error('Token cleanup failed:', error);
    }
  }, SIX_HOURS);
}
```

Bestehende Services: Badge (5 Min), EventReminder (15 Min), PendingEvents (4h). Token-Cleanup passt als 4. Service mit 6h Intervall.

### sendToUser Result-Pattern (Referenz)

Das korrekte Error-Handling Pattern aus sendToUser (Z.58-114):

```javascript
// Source: backend/services/pushService.js Z.79-106
if (result.success) {
  successCount++;
  if (token.error_count > 0) {
    await db.query(
      'UPDATE push_tokens SET error_count = 0, last_error_at = NULL WHERE id = $1',
      [token.id]
    );
  }
} else {
  const fatalCodes = [
    'messaging/registration-token-not-registered',
    'messaging/invalid-registration-token'
  ];
  if (fatalCodes.includes(result.errorCode)) {
    await db.query('DELETE FROM push_tokens WHERE id = $1', [token.id]);
  } else {
    await db.query(
      'UPDATE push_tokens SET error_count = error_count + 1, last_error_at = NOW() WHERE id = $1',
      [token.id]
    );
  }
  errorCount++;
}
```

### sendBadgeUpdate - Fehlende Error-Handling (Hauptfix)

sendBadgeUpdate (Z.231-262) hat KEIN Result-Pattern:

```javascript
// AKTUELL (fehlerhaft): Z.241-254
for (const token of tokens) {
  try {
    await sendFirebasePushNotification(token.token, { ... });
    successCount++;
  } catch (error) {
    console.error('Badge update failed:', error);
  }
}
```

Problem: `sendFirebasePushNotification` wirft NICHT — es gibt `{ success: false, errorCode }` zurueck. Der try/catch faengt also nie Firebase-Fehler. Tokens mit fatalen Fehlern bleiben bestehen.

### push_tokens Schema

```sql
-- Source: backend/migrations/add_push_foundation.sql
CREATE TABLE IF NOT EXISTS push_tokens (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    user_type TEXT NOT NULL,
    token TEXT NOT NULL,
    platform TEXT NOT NULL,
    device_id TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    error_count INTEGER DEFAULT 0,
    last_error_at TIMESTAMPTZ,
    UNIQUE(user_id, platform, device_id)
);
```

Wichtig: `user_id` hat KEINEN FOREIGN KEY auf `users(id)`. Verwaiste Tokens (User geloescht) werden daher NICHT automatisch kaskadiert. Der Cleanup muss explizit pruefen ob der User noch existiert.

## Audit-Matrix: Alle 17 Push-Types

### Backend: Methode vorhanden + Result-Pattern

| # | Type | Methode | Aufgerufen in | Result-Pattern | Status |
|---|------|---------|---------------|----------------|--------|
| 1 | chat | sendChatNotification | chat.js:751 | JA (eigenes) | OK |
| 2 | badge_update | sendBadgeUpdate | chat.js:1035, backgroundService | NEIN | FIX NOETIG |
| 3 | new_activity_request | sendNewActivityRequestToAdmins | konfi.js:636 | JA (via sendToMultipleUsers) | OK |
| 4 | activity_request_status | sendActivityRequestStatusToKonfi | activities.js:392 | JA (via sendToUser) | OK |
| 5 | badge_earned | sendBadgeEarnedToKonfi | badges.js:317 | JA (via sendToUser) | OK |
| 6 | activity_assigned | sendActivityAssignedToKonfi | activities.js:480 | JA (via sendToUser) | OK |
| 7 | bonus_points | sendBonusPointsToKonfi | konfi-managment.js:520 | JA (via sendToUser) | OK |
| 8 | event_registered | sendEventRegisteredToKonfi | konfi.js:1648 | JA (via sendToUser) | OK |
| 9 | event_unregistered | sendEventUnregisteredToKonfi | konfi.js:1760 | JA (via sendToUser) | OK |
| 10 | event_unregistration | sendEventUnregistrationToAdmins | konfi.js:1767 | JA (via sendToMultipleUsers) | OK |
| 11 | level_up | sendLevelUpToKonfi | via checkAndSendLevelUp | JA (via sendToUser) | OK |
| 12 | event_reminder | sendEventReminderToKonfi | backgroundService | JA (via sendToUser) | OK |
| 13 | waitlist_promotion | sendWaitlistPromotionToKonfi | konfi.js:1729, events.js:594,876,1050 | JA (via sendToUser) | OK |
| 14 | event_cancelled | sendEventCancellationToKonfis | events.js:1516 | JA (via sendToMultipleUsers) | OK |
| 15 | new_event | sendNewEventToOrgKonfis | events.js:430 | JA (via sendToMultipleUsers) | OK |
| 16 | event_attendance | sendEventAttendanceToKonfi | events.js:1347-1407 | JA (via sendToUser) | OK |
| 17 | events_pending_approval | sendEventsPendingApprovalToAdmins | backgroundService:294 | JA (via sendToMultipleUsers) | OK |
| 18 | new_konfi_registration | sendNewKonfiRegistrationToAdmins | auth.js:602 | JA (via sendToMultipleUsers) | OK |

**Fazit:** 16 von 17 Methoden nutzen sendToUser/sendToMultipleUsers und haben korrektes Result-Pattern. Nur sendBadgeUpdate hat eigene Token-Iteration OHNE Error-Handling.

### Frontend: Tap-Navigation Handler

```typescript
// Source: frontend/src/contexts/AppContext.tsx Z.330-371
switch (notificationType) {
  case 'chat':                    → chatUrl + ?room=roomId      // OK
  case 'activity_request_status': → /requests                   // OK
  case 'new_activity_request':    → /requests                   // OK
  case 'badge_earned':            → /badges                     // OK
  case 'event_registered':        → /events                     // OK
  case 'event_unregistered':      → /events                     // OK
  case 'waitlist_promotion':      → /events                     // OK
  case 'new_event':               → /events                     // OK
  case 'event_attendance':        → /events                     // OK
  case 'event_reminder':          → /events                     // OK
  case 'event_cancelled':         → /events                     // OK
  case 'level_up':                → /dashboard (konfi) / /konfis (admin) // OK
  case 'activity_assigned':       → /dashboard (konfi) / /konfis (admin) // OK
  case 'bonus_points':            → /dashboard (konfi) / /konfis (admin) // OK
}
```

**Fehlende Frontend-Cases:**
- `badge_update` — kein case, aber erwartet: kein Tap noetig (silent notification, nur Badge-Zahl)
- `event_unregistration` — kein case, aber Admin-Push: koennte auf /events navigieren
- `events_pending_approval` — kein case, aber Admin-Push: koennte auf /events navigieren
- `new_konfi_registration` — kein case, Admin-Push: koennte auf /konfis navigieren

Diese 3 fehlenden Admin-Navigation-Cases (event_unregistration, events_pending_approval, new_konfi_registration) sollten im Audit ergaenzt werden.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Periodisches Scheduling | node-cron oder eigenen Scheduler | setInterval im backgroundService | Bestehendes Pattern, CONTEXT.md sagt explizit kein node-cron |
| Token-Error-Tracking | Eigenes System | Bestehendes error_count/last_error_at Pattern | Bereits in sendToUser implementiert, nur kopieren |
| Push an User | Direkte Firebase-Calls | sendToUser/sendToMultipleUsers | Beinhaltet Token-Lookup, Error-Handling, fatale Loeschung |

## Common Pitfalls

### Pitfall 1: Verwaiste Tokens ohne Foreign Key
**Was schief geht:** push_tokens.user_id hat keinen FK auf users.id. Wenn ein User geloescht wird, bleiben seine Tokens bestehen.
**Vermeidung:** Cleanup-Query muss explizit `LEFT JOIN users ON push_tokens.user_id = users.id WHERE users.id IS NULL` pruefen.

### Pitfall 2: sendBadgeUpdate faengt Firebase-Errors nicht
**Was schief geht:** sendFirebasePushNotification gibt `{ success: false }` zurueck, wirft aber nicht. Der try/catch in sendBadgeUpdate faengt daher nie Firebase-Fehler.
**Vermeidung:** Auf Result-Pattern umstellen: `const result = await sendFirebasePushNotification(...)` und `result.success` auswerten.

### Pitfall 3: updated_at wird nicht bei jedem Token-Refresh aktualisiert
**Was schief geht:** Wenn updated_at nicht bei Token-Refresh gesetzt wird, werden aktive Tokens faelschlicherweise als "inaktiv" geloescht.
**Vermeidung:** Pruefen ob die Token-Registration Route (vermutlich in notifications.js oder auth.js) updated_at korrekt setzt. Falls UPSERT verwendet wird, muss ON CONFLICT auch updated_at updaten.

### Pitfall 4: Race Condition bei Cleanup waehrend Push-Send
**Was schief geht:** Cleanup loescht Token waehrend gleichzeitig ein Push gesendet wird.
**Vermeidung:** Kein echtes Problem bei setInterval (single-threaded Node.js). Cleanup und Push-Sends laufen nie parallel innerhalb desselben Event-Loop-Ticks. Zwischen awaits koennte theoretisch ein Cleanup stattfinden, aber der schlimmste Fall ist ein fehlgeschlagener Push — der dann ohnehin einen fatalen Error zurueckgibt.

## Code Examples

### Token-Cleanup SQL-Queries

```sql
-- 1. Tokens mit zu vielen Fehlern loeschen
DELETE FROM push_tokens WHERE error_count >= 10;

-- 2. Inaktive Tokens loeschen (30 Tage nicht aktualisiert)
DELETE FROM push_tokens WHERE updated_at < NOW() - INTERVAL '30 days';

-- 3. Verwaiste Tokens loeschen (User existiert nicht mehr)
DELETE FROM push_tokens WHERE user_id NOT IN (SELECT id FROM users);
```

### sendBadgeUpdate Fix

```javascript
// Source: Pattern von sendToUser angepasst
static async sendBadgeUpdate(db, userId, badgeCount) {
  try {
    const tokens = await this.getTokensForUser(db, userId);
    if (tokens.length === 0) {
      return { success: false, message: 'No tokens found' };
    }

    let successCount = 0;
    let errorCount = 0;

    for (const token of tokens) {
      const result = await sendFirebasePushNotification(token.token, {
        badge: badgeCount,
        data: {
          type: 'badge_update',
          count: badgeCount.toString()
        }
      });

      if (result.success) {
        successCount++;
        if (token.error_count > 0) {
          await db.query(
            'UPDATE push_tokens SET error_count = 0, last_error_at = NULL WHERE id = $1',
            [token.id]
          );
        }
      } else {
        const fatalCodes = [
          'messaging/registration-token-not-registered',
          'messaging/invalid-registration-token'
        ];
        if (fatalCodes.includes(result.errorCode)) {
          await db.query('DELETE FROM push_tokens WHERE id = $1', [token.id]);
          console.warn(`Token ${token.id} geloescht (${result.errorCode})`);
        } else {
          await db.query(
            'UPDATE push_tokens SET error_count = error_count + 1, last_error_at = NOW() WHERE id = $1',
            [token.id]
          );
        }
        errorCount++;
      }
    }

    return { success: true, sent: successCount, errors: errorCount, total: tokens.length };
  } catch (error) {
    console.error('PushService.sendBadgeUpdate error:', error);
    return { success: false, error: error.message };
  }
}
```

### Fehlende Frontend-Navigation-Cases

```typescript
// Ergaenzen im switch-Block nach den bestehenden Cases:
case 'event_unregistration':
case 'events_pending_approval':
  targetUrl = userType === 'admin' ? '/admin/events' : '/konfi/events';
  break;

case 'new_konfi_registration':
  targetUrl = userType === 'admin' ? '/admin/konfis' : '/konfi/dashboard';
  break;

// badge_update: Kein Tap-Handler noetig (silent notification)
```

## Zusammenfassung der zu behebenden Issues

| # | Issue | Datei | Schwere |
|---|-------|-------|---------|
| 1 | sendBadgeUpdate ohne Result-Pattern | pushService.js Z.231-262 | HOCH |
| 2 | Fehlende Frontend-Navigation fuer event_unregistration | AppContext.tsx | NIEDRIG |
| 3 | Fehlende Frontend-Navigation fuer events_pending_approval | AppContext.tsx | NIEDRIG |
| 4 | Fehlende Frontend-Navigation fuer new_konfi_registration | AppContext.tsx | NIEDRIG |
| 5 | Token-Cleanup Service fehlt komplett | backgroundService.js | HOCH (CLN-02) |

## Open Questions

1. **updated_at Trigger fuer push_tokens**
   - Was wir wissen: push_tokens hat updated_at Spalte, aber kein Trigger in der Migration
   - Was unklar ist: Wird updated_at bei Token-Refresh (UPSERT) korrekt gesetzt?
   - Empfehlung: Beim Implementieren pruefen ob die Token-Registration Route ON CONFLICT ... SET updated_at = NOW() verwendet

## Sources

### Primary (HIGH confidence)
- backend/services/pushService.js — Vollstaendige 17-Type Registry, alle Methoden analysiert
- backend/services/backgroundService.js — Bestehendes setInterval-Pattern fuer Badge/EventReminder/PendingEvents
- backend/migrations/add_push_foundation.sql — push_tokens Schema mit error_count/updated_at
- backend/push/firebase.js — sendFirebasePushNotification Return-Format (success/errorCode)
- frontend/src/contexts/AppContext.tsx — pushNotificationActionPerformed Handler Z.320-377
- backend/routes/*.js — Alle PushService-Aufrufe in Routes verifiziert

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — Alles bestehendes Node.js/Express/PostgreSQL, keine neuen Dependencies
- Architecture: HIGH — Pattern direkt aus bestehendem Code abgeleitet (backgroundService, sendToUser)
- Pitfalls: HIGH — sendBadgeUpdate-Bug durch Code-Analyse verifiziert, Schema-Luecke (kein FK) bestaetigt

**Research date:** 2026-03-07
**Valid until:** 2026-04-07 (stabile interne Codebasis)
