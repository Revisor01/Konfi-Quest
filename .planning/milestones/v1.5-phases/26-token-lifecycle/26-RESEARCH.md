# Phase 26: Token-Lifecycle - Research

**Researched:** 2026-03-05
**Domain:** Push-Token Lifecycle Management (FCM, Capacitor, PostgreSQL)
**Confidence:** HIGH

## Summary

Phase 26 adressiert fuenf konkrete Probleme im bestehenden Push-Token-System: Ghost-Tokens nach Logout, gefilterte Fallback-Device-IDs, fehlender automatischer Token-Refresh, unsauberer User-Wechsel auf geteilten Geraeten, und fehlende Firebase-Error-Behandlung. Alle Aenderungen betreffen 4 existierende Dateien — keine neuen Dateien, keine neuen Dependencies.

Der Code ist bereits gut strukturiert. Die Aenderungen sind chirurgisch: Ein SQL-Filter entfernen (TKN-02), Error-Handling in `sendToUser` umbauen (CLN-01), den 12h-Refresh-Check robuster machen (TKN-03), und sicherstellen dass Logout nur den aktuellen Device-Token loescht (TKN-01). Die User-Wechsel-Logik (TKN-04) funktioniert bereits korrekt im Backend — hier muss nur verifiziert werden.

**Primary recommendation:** Alle 5 Requirements koennen in einem einzigen Plan umgesetzt werden. Reihenfolge: Backend-Fixes zuerst (CLN-01, TKN-02), dann Frontend-Anpassungen (TKN-01, TKN-03, TKN-04).

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- **Logout (TKN-01):** Nur Token des aktuellen Devices loeschen (user_id + platform + device_id), nicht alle Tokens des Users. Logout geht immer durch (best-effort). Kein Firebase-Token Invalidierung. device_id bleibt im localStorage persistent.
- **Token-Refresh (TKN-03):** Bei appStateChange pruefen ob >12h seit letztem Token-Send. Timestamp in localStorage ('push_token_last_refresh'). Still im Hintergrund (console.log/console.error). Nur Token refreshen, keine Device-ID Validierung bei Resume.
- **Firebase-Error (CLN-01):** Sofortige Token-Loeschung bei messaging/registration-token-not-registered und messaging/invalid-registration-token. Bei anderen Errors: error_count++ und last_error_at = NOW(). Bei erfolgreichem Push: error_count = 0. Error-Handling direkt in sendToUser. sendFirebasePushNotification returned (wirft nicht) — Result-Objekt pruefen.
- **Multi-User (TKN-04, TKN-02):** Bestehende DELETE WHERE token = $1 AND user_id != $2 Logik beibehalten. Fallback-Device-ID Filter (NOT LIKE '%\\_\\_%') aus getTokensForUser entfernen. Fallback-ID Generierung beibehalten. Native Device.getId() zuerst, localStorage als Fallback.

### Claude's Discretion
- Exakte Implementierung des 12h-Refresh-Checks (Timer vs. appStateChange Listener)
- SQL-Queries fuer error_count Update und Token-Loeschung
- Reihenfolge der Aenderungen innerhalb der Phase

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope.
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| TKN-01 | Device Token wird bei Logout vollstaendig geloescht (alle Tokens des Users auf diesem Device) | Logout in auth.ts:49-106 bereits implementiert mit Device.getId() + API-Call. Backend DELETE-Route in notifications.js:119-150 filtert korrekt nach user_id + platform + device_id. Funktioniert bereits — nur Verifikation noetig. |
| TKN-02 | Fallback Device-ID funktioniert zuverlaessig (keine Filterung in Queries) | pushService.js:43 hat `NOT LIKE '%\\_\\_%'` Filter der Fallback-IDs ausschliesst. Muss entfernt werden in getTokensForUser UND sendChatNotification. |
| TKN-03 | Token-Refresh bei App Resume alle 12h zuverlaessig | AppContext.tsx:388-435 hat bereits appStateChange Listener mit 12h-Check. Nutzt 'lastTokenRefresh' in localStorage. Muss auf 'push_token_last_refresh' umbenannt werden (CONTEXT.md Entscheidung). |
| TKN-04 | Token-Uebergabe bei User-Wechsel auf selben Device korrekt | notifications.js:37-42 loescht bereits andere User-Tokens bei gleicher FCM-Token. Funktioniert — nur Verifikation noetig. |
| CLN-01 | Ungueltige Tokens werden nach Firebase-Error aus DB entfernt | firebase.js:67 gibt bereits errorCode im Return-Objekt zurueck. sendToUser in pushService.js:71-84 nutzt aber try/catch statt Result-Auswertung. Muss umgebaut werden. |
</phase_requirements>

## Standard Stack

### Core (bereits im Projekt)
| Library | Version | Purpose | Aenderung noetig |
|---------|---------|---------|-------------------|
| firebase-admin | bestehend | FCM Push senden | Nein — gibt bereits Result-Objekt zurueck |
| @capacitor/push-notifications | bestehend | Token-Registration | Nein |
| @capacitor/device | bestehend | Device.getId() | Nein |
| @capacitor/app | bestehend | appStateChange Listener | Nein |
| pg (PostgreSQL) | bestehend | push_tokens Tabelle | Nein — error_count/last_error_at Spalten existieren |

### Keine neuen Dependencies noetig
Alle benoetigen Libraries sind bereits installiert. Keine Migration noetig — error_count und last_error_at wurden in Phase 25 hinzugefuegt.

## Architecture Patterns

### Betroffene Dateien (exakt 4)
```
backend/
├── services/pushService.js      # CLN-01: Error-Handling in sendToUser
│                                  # TKN-02: __-Filter entfernen in getTokensForUser + sendChatNotification
├── routes/notifications.js       # TKN-04: Bestehende Logik verifizieren (keine Aenderung erwartet)
│
frontend/src/
├── contexts/AppContext.tsx        # TKN-03: 12h-Refresh localStorage-Key umbenennen
│                                  # TKN-03: sendTokenToServer auch bei Refresh aufrufen
├── services/auth.ts               # TKN-01: Bestehende Logik verifizieren (keine Aenderung erwartet)
```

### Pattern 1: Firebase Result-Auswertung (CLN-01)
**Was:** sendFirebasePushNotification gibt `{ success, error, errorCode }` zurueck statt zu werfen.
**Aktuelles Problem:** sendToUser nutzt try/catch — faengt keine returned Errors.
**Loesung:**
```javascript
// In sendToUser — NACH dem Aufruf
const result = await sendFirebasePushNotification(token.token, { ... });

if (result.success) {
  successCount++;
  // Error-Count zuruecksetzen bei Erfolg
  if (token.error_count > 0) {
    await db.query(
      'UPDATE push_tokens SET error_count = 0, last_error_at = NULL WHERE id = $1',
      [token.id]
    );
  }
} else {
  // Fatale Errors: Token sofort loeschen
  const fatalCodes = [
    'messaging/registration-token-not-registered',
    'messaging/invalid-registration-token'
  ];
  if (fatalCodes.includes(result.errorCode)) {
    await db.query('DELETE FROM push_tokens WHERE id = $1', [token.id]);
    console.warn(`Token ${token.id} geloescht (${result.errorCode})`);
  } else {
    // Sonstige Errors: Counter erhoehen
    await db.query(
      'UPDATE push_tokens SET error_count = error_count + 1, last_error_at = NOW() WHERE id = $1',
      [token.id]
    );
  }
  errorCount++;
}
```

### Pattern 2: Fallback-Filter entfernen (TKN-02)
**Was:** `device_id NOT LIKE '%\\_\\_%'` filtert Fallback-Device-IDs aus.
**Aktuelles Problem:** Geraete mit Fallback-IDs (Format: `ios_1709812345_abc123def`) erhalten keine Pushes.
**Loesung:** Filter in zwei Stellen entfernen:
1. `getTokensForUser` (Zeile 43, 48)
2. `sendChatNotification` (Zeile 122, 127)

```javascript
// getTokensForUser — vereinfacht
static async getTokensForUser(db, userId) {
  const query = `
    SELECT * FROM push_tokens
    WHERE user_id = $1
      AND id IN (
        SELECT MAX(id)
        FROM push_tokens
        WHERE user_id = $1
        GROUP BY device_id, platform
      )
  `;
  const { rows: tokens } = await db.query(query, [userId]);
  return tokens || [];
}
```

### Pattern 3: 12h Token-Refresh (TKN-03)
**Was:** Bei App Resume nach >12h Token automatisch refreshen.
**Aktueller Stand:** Bereits implementiert in AppContext.tsx:400-412. Nutzt `lastTokenRefresh` als localStorage-Key.
**Aenderung:** Key umbenennen zu `push_token_last_refresh` (CONTEXT.md Entscheidung) und sicherstellen dass nach `PushNotifications.register()` der Token auch tatsaechlich an den Server gesendet wird (der registration-Listener in Zeile 444 faengt das auf).

### Anti-Patterns zu vermeiden
- **Token-Loeschung bei Logout blockiert Logout:** Logout MUSS immer durchgehen (best-effort). Der try/catch in auth.ts:88-98 ist korrekt.
- **Alle Tokens eines Users loeschen bei Logout:** Wuerde andere Geraete entkoppeln. Nur aktuelles Device (user_id + platform + device_id).
- **Firebase-Token bei FCM invalidieren:** Nicht noetig — Firebase recycled Tokens selbst. DB-Loeschung reicht.

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Device-ID Generierung | Eigenes UUID-System | Capacitor Device.getId() + localStorage Fallback | Bestehendes Pattern funktioniert |
| Token-Refresh Timer | setInterval/setTimeout | appStateChange Event von @capacitor/app | Batterie-schonend, OS-gesteuertes Resume |
| FCM Error Codes | Eigene Error-Klassifizierung | Firebase-Admin errorCode Feld | Offizielles Firebase Error-Reporting |

## Common Pitfalls

### Pitfall 1: sendChatNotification hat eigenen __-Filter
**Was passiert:** getTokensForUser wird gefixed, aber sendChatNotification hat eine KOPIERTE Query mit dem gleichen Filter.
**Warum:** sendChatNotification nutzt nicht getTokensForUser, sondern hat eine eigene, erweiterte Query (Sender-Ausschluss).
**Vermeidung:** BEIDE Stellen fixen — Zeile 43+48 UND Zeile 122+127 in pushService.js.

### Pitfall 2: Result vs. Exception in Firebase
**Was passiert:** firebase.js gibt `{ success: false, errorCode }` zurueck statt zu werfen. sendToUser's try/catch faengt das NICHT.
**Warum:** Phase 25 hat firebase.js auf Result-Pattern umgebaut, aber sendToUser wurde nicht angepasst.
**Vermeidung:** try/catch durch Result-Pruefung ersetzen. `result.success` checken, `result.errorCode` auswerten.

### Pitfall 3: error_count Reset vergessen
**Was passiert:** Tokens mit hohem error_count werden nie zurueckgesetzt, obwohl sie wieder funktionieren.
**Warum:** Temporaere Firebase-Probleme erhoehen den Counter, aber bei Erfolg wird er nicht auf 0 gesetzt.
**Vermeidung:** Bei jedem erfolgreichen Push `error_count = 0` setzen (nur wenn vorher > 0, um unnoetige DB-Writes zu vermeiden).

### Pitfall 4: localStorage-Key Inkonsistenz
**Was passiert:** AppContext.tsx nutzt 'lastTokenRefresh', CONTEXT.md definiert 'push_token_last_refresh'.
**Vermeidung:** Key umbenennen. Bestehende Werte unter altem Key gehen verloren — kein Problem, naechster Refresh passiert dann sofort.

### Pitfall 5: sendTokenToServer Fallback-ID Inkonsistenz mit auth.ts
**Was passiert:** sendTokenToServer (AppContext.tsx:26) nutzt nur Device.getId() ohne Fallback. Erst im catch-Block (Zeile 41-44) wird localStorage-Fallback genutzt. auth.ts:62-73 hat die gleiche Logik.
**Aktueller Stand:** Funktioniert — aber die Fallback-ID in sendTokenToServer wird NUR generiert wenn Device.getId() fehlschlaegt UND der erste API-Call fehlschlaegt. Das ist korrekt.

## Code Examples

### Firebase Error Codes (relevant fuer CLN-01)
```javascript
// Source: Firebase Admin SDK — bekannte Error Codes
// Fatale Errors (Token ungueltig, sofort loeschen):
'messaging/registration-token-not-registered'  // Token wurde deregistriert (App deinstalliert, Token expired)
'messaging/invalid-registration-token'          // Token-Format ungueltig

// Temporaere Errors (error_count erhoehen):
'messaging/internal-error'                      // Firebase interner Fehler
'messaging/server-unavailable'                  // Firebase temporaer nicht erreichbar
'messaging/message-rate-exceeded'               // Rate Limit
'messaging/device-message-rate-exceeded'         // Device Rate Limit
'messaging/topics-message-rate-exceeded'         // Topic Rate Limit
```

### SQL fuer error_count Updates
```sql
-- Token loeschen (fataler Error)
DELETE FROM push_tokens WHERE id = $1;

-- Error-Count erhoehen (temporaerer Error)
UPDATE push_tokens SET error_count = error_count + 1, last_error_at = NOW() WHERE id = $1;

-- Error-Count zuruecksetzen (erfolgreicher Push)
UPDATE push_tokens SET error_count = 0, last_error_at = NULL WHERE id = $1;
```

### getTokensForUser ohne __-Filter
```sql
-- Vorher (filtert Fallback-IDs aus):
SELECT * FROM push_tokens
WHERE user_id = $1
  AND device_id NOT LIKE '%\_\_%'
  AND id IN (SELECT MAX(id) FROM push_tokens WHERE user_id = $2 AND device_id NOT LIKE '%\_\_%' GROUP BY device_id, platform)

-- Nachher (alle Device-IDs):
SELECT * FROM push_tokens
WHERE user_id = $1
  AND id IN (SELECT MAX(id) FROM push_tokens WHERE user_id = $1 GROUP BY device_id, platform)
```

## State of the Art

| Aktuell (Problem) | Nachher (Fix) | Auswirkung |
|--------------------|---------------|------------|
| Fallback-IDs werden gefiltert | Alle Device-IDs gleichberechtigt | Geraete ohne native ID erhalten Pushes |
| Firebase-Errors werden ignoriert | Fatale Errors loeschen Token sofort | Keine Ghost-Tokens bei deinstallierten Apps |
| error_count wird nie zurueckgesetzt | Reset bei erfolgreichem Push | Akkurate Error-Tracking |
| sendToUser nutzt try/catch | Result-Auswertung | Firebase-Errors werden erkannt |
| localStorage-Key 'lastTokenRefresh' | 'push_token_last_refresh' | Konsistenz mit CONTEXT.md |

## Open Questions

1. **sendChatNotification Refactoring**
   - Was wir wissen: sendChatNotification hat eine eigene Query-Kopie statt getTokensForUser zu nutzen (wegen Sender-Ausschluss)
   - Was unklar ist: Sollte sendChatNotification refactored werden um getTokensForUser mit optionalem Exclude-Parameter zu nutzen?
   - Empfehlung: In dieser Phase NUR den __-Filter entfernen. Refactoring ist optional und kann spaeter erfolgen.

2. **error_count Threshold fuer Phase 29**
   - Was wir wissen: error_count wird erhoeht bei temporaeren Errors
   - Was unklar ist: Ab welchem Schwellwert soll Phase 29 (CLN-02) Tokens loeschen?
   - Empfehlung: Jetzt nur zaehlen. Phase 29 definiert den Schwellwert.

## Sources

### Primary (HIGH confidence)
- pushService.js — Direkte Code-Analyse, alle relevanten Stellen identifiziert
- firebase.js — Result-Pattern verifiziert (Zeile 64-68)
- AppContext.tsx — 12h-Refresh bereits implementiert (Zeile 400-412)
- auth.ts — Logout-Flow bereits korrekt (Zeile 49-106)
- notifications.js — DELETE-Route und UPSERT verifiziert
- add_push_foundation.sql — error_count und last_error_at Spalten existieren

### Secondary (MEDIUM confidence)
- Firebase Admin SDK Error Codes — aus Training Data, aber stabile API seit Jahren

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — keine neuen Dependencies, alles bereits im Projekt
- Architecture: HIGH — 4 Dateien, chirurgische Aenderungen, Code vollstaendig analysiert
- Pitfalls: HIGH — alle 5 Stellen im Code identifiziert und verifiziert

**Research date:** 2026-03-05
**Valid until:** 2026-04-05 (stabile Architektur, keine externen Abhaengigkeiten)
