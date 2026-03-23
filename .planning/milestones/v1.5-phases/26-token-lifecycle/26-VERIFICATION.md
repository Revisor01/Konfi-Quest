---
phase: 26-token-lifecycle
verified: 2026-03-06T08:00:00Z
status: passed
score: 8/8 must-haves verified
gaps: []
---

# Phase 26: Token-Lifecycle Verification Report

**Phase Goal:** Jedes Geraet erhaelt zuverlaessig Push-Notifications fuer den aktuell eingeloggten User -- keine Ghost-Tokens, keine verlorenen Geraete
**Verified:** 2026-03-06T08:00:00Z
**Status:** passed
**Re-verification:** Nein -- initiale Verifikation

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Geraete mit Fallback-Device-IDs erhalten Pushes genauso wie Geraete mit nativer Device-ID | VERIFIED | `NOT LIKE` Filter komplett entfernt aus pushService.js (0 Treffer). getTokensForUser (Z.39-52) und sendChatNotification (Z.140-148) selektieren alle Tokens ohne device_id Filterung. |
| 2 | Firebase-Errors mit ungueltigen Tokens fuehren zur sofortigen Loeschung des Tokens aus der DB | VERIFIED | sendToUser (Z.89-95) und sendChatNotification (Z.195-201): `fatalCodes` Array mit `messaging/registration-token-not-registered` und `messaging/invalid-registration-token`, bei Match: `DELETE FROM push_tokens WHERE id = $1`. |
| 3 | Bei erfolgreichem Push wird error_count auf 0 zurueckgesetzt | VERIFIED | sendToUser (Z.80-86) und sendChatNotification (Z.186-192): `if (token.error_count > 0)` dann `UPDATE push_tokens SET error_count = 0, last_error_at = NULL WHERE id = $1`. |
| 4 | Bei temporaeren Firebase-Errors wird error_count inkrementiert | VERIFIED | sendToUser (Z.97-102) und sendChatNotification (Z.203-207): `UPDATE push_tokens SET error_count = error_count + 1, last_error_at = NOW() WHERE id = $1`. |
| 5 | Nach Logout erhaelt das Geraet keine Pushes mehr fuer den abgemeldeten User | VERIFIED | auth.ts:logout() (Z.49-108) sendet `DELETE /notifications/device-token` mit device_id + platform. Backend notifications.js (Z.129-138) loescht Token per user_id + platform + device_id + organization_id. Best-effort: Logout geht immer durch. |
| 6 | Token wird bei App Resume nach >12h automatisch refreshed ohne User-Aktion | VERIFIED | AppContext.tsx (Z.400-412): handleAppActive prueft `push_token_last_refresh` localStorage-Key, vergleicht mit 12h-Schwelle, ruft `PushNotifications.register()` auf. |
| 7 | Bei User-Wechsel auf demselben Geraet erhaelt nur der neue User Pushes | VERIFIED | notifications.js (Z.37-40): Bei Token-Upsert wird `DELETE FROM push_tokens WHERE token = $1 AND user_id != $2` ausgefuehrt -- alte User-Zuordnung wird automatisch entfernt. |
| 8 | localStorage-Key fuer Token-Refresh heisst 'push_token_last_refresh' | VERIFIED | AppContext.tsx Z.402: `localStorage.getItem('push_token_last_refresh')`, Z.407: `localStorage.setItem('push_token_last_refresh', ...)`. Kein Vorkommen des alten Keys `lastTokenRefresh`. |

**Score:** 8/8 Truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `backend/services/pushService.js` | getTokensForUser ohne Filter, sendToUser/sendChatNotification mit Result-Auswertung | VERIFIED | 738 Zeilen, `result.success` 2x, `fatalCodes` 4x, `error_count` 6x, kein `NOT LIKE` Filter |
| `frontend/src/contexts/AppContext.tsx` | 12h Token-Refresh mit korrektem localStorage-Key | VERIFIED | `push_token_last_refresh` 2x vorhanden, 12h-Check in handleAppActive |
| `frontend/src/services/auth.ts` | Logout mit Device-Token-Loeschung | VERIFIED | DELETE /notifications/device-token mit device_id + platform, TKN-01 Kommentar vorhanden |
| `backend/routes/notifications.js` | Token-Upsert mit User-Wechsel-Logik | VERIFIED | DELETE WHERE token = $1 AND user_id != $2 bei Upsert (Z.38) |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| pushService.js:sendToUser | firebase.js:sendFirebasePushNotification | Result-Objekt Auswertung | WIRED | `result.success` Check statt try/catch, firebase.js returniert `{success, error, errorCode}` |
| pushService.js:getTokensForUser | push_tokens Tabelle | SQL Query ohne device_id Filter | WIRED | `SELECT * FROM push_tokens WHERE user_id = $1 AND id IN (SELECT MAX(id)...)` -- kein NOT LIKE |
| AppContext.tsx:handleAppActive | PushNotifications.register() | 12h-Check mit localStorage | WIRED | `push_token_last_refresh` geprueft, bei >12h wird register() aufgerufen |
| auth.ts:logout | /notifications/device-token DELETE | API-Call mit device_id + platform | WIRED | `api.delete('/notifications/device-token', { data: { device_id, platform } })` |

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| TKN-01 | 26-02 | Device Token wird bei Logout vollstaendig geloescht | SATISFIED | auth.ts logout sendet DELETE mit device_id + platform, Backend loescht per user_id + platform + device_id |
| TKN-02 | 26-01 | Fallback Device-ID funktioniert zuverlaessig | SATISFIED | NOT LIKE Filter komplett entfernt, alle Device-IDs werden in Queries einbezogen |
| TKN-03 | 26-02 | Token-Refresh bei App Resume alle 12h zuverlaessig | SATISFIED | AppContext.tsx handleAppActive mit push_token_last_refresh und 12h-Schwelle |
| TKN-04 | 26-02 | Token-Uebergabe bei User-Wechsel korrekt | SATISFIED | notifications.js Z.38: DELETE WHERE token=$1 AND user_id!=$2 bei Token-Upsert |
| CLN-01 | 26-01 | Ungueltige Tokens werden nach Firebase-Error aus DB entfernt | SATISFIED | fatalCodes Array mit sofortiger Loeschung in sendToUser und sendChatNotification |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| backend/services/pushService.js | 240-253 | sendBadgeUpdate nutzt noch altes try/catch statt Result-Pattern | Info | Inkonsistenz, aber nicht Phase-26-Scope. Tokens werden dort nicht bereinigt. |

### Human Verification Required

#### 1. Push-Empfang nach Logout

**Test:** Auf einem echten Geraet einloggen, Push erhalten, ausloggen, erneut Push an den User senden.
**Expected:** Nach Logout kommt kein Push mehr auf dem ausgeloggten Geraet an.
**Why human:** Erfordert echtes Geraet mit Firebase-Verbindung und Backend-Push-Ausloeser.

#### 2. 12h Token-Refresh

**Test:** App oeffnen, 12h warten (oder localStorage-Key manuell auf alten Timestamp setzen), App in Hintergrund und wieder oeffnen.
**Expected:** PushNotifications.register() wird aufgerufen, localStorage Timestamp wird aktualisiert.
**Why human:** Erfordert native App mit Capacitor-Plugins und App-Lifecycle-Events.

#### 3. User-Wechsel auf gleichem Geraet

**Test:** User A einloggen, Push empfangen. Ausloggen, User B einloggen. Push an User A senden.
**Expected:** User A Push kommt NICHT an, nur User B Pushes kommen an.
**Why human:** Erfordert zwei Accounts und echtes Geraet mit Firebase.

### Gaps Summary

Keine Gaps gefunden. Alle 5 Requirements (TKN-01 bis TKN-04, CLN-01) sind durch Code-Evidenz abgedeckt. Alle 8 must-have Truths aus beiden Plans sind verifiziert. Die einzige Anmerkung ist die Inkonsistenz in sendBadgeUpdate (altes try/catch Pattern), was aber nicht zum Phase-26-Scope gehoert.

---

_Verified: 2026-03-06T08:00:00Z_
_Verifier: Claude (gsd-verifier)_
