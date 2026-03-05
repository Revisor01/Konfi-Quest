# Phase 26: Token-Lifecycle - Context

**Gathered:** 2026-03-05
**Status:** Ready for planning

<domain>
## Phase Boundary

Jedes Geraet erhaelt zuverlaessig Push-Notifications fuer den aktuell eingeloggten User. Keine Ghost-Tokens, keine verlorenen Geraete. Token-Registrierung, -Refresh, -Loeschung und Error-Handling werden robust gemacht.

Explizit NICHT in dieser Phase: Periodischer Cleanup (Phase 29), Badge-Count (Phase 27), neue Push-Flows (Phase 28).

</domain>

<decisions>
## Implementation Decisions

### Logout-Verhalten (TKN-01)
- Nur Token des aktuellen Devices loeschen (user_id + platform + device_id), nicht alle Tokens des Users
- Logout geht immer durch, auch wenn Token-Loeschung fehlschlaegt (best-effort)
- Kein Firebase-Token Invalidierung — nur DB-Loeschung reicht
- device_id bleibt im localStorage persistent (geraetespezifisch, nicht userspezifisch)

### Token-Refresh Strategie (TKN-03)
- App Resume Check: Bei appStateChange pruefen ob >12h seit letztem Token-Send
- Timestamp in localStorage speichern ('push_token_last_refresh')
- Still im Hintergrund, nur console.log/console.error — kein UI-Feedback
- Nur Token refreshen, keine Device-ID Validierung bei Resume

### Firebase-Error Handling (CLN-01)
- Sofortige Token-Loeschung bei: messaging/registration-token-not-registered, messaging/invalid-registration-token
- Bei anderen Errors: error_count++ und last_error_at = NOW() in push_tokens
- Bei erfolgreichem Push: error_count = 0 zuruecksetzen (verhindert false positives)
- Error-Handling direkt in sendToUser (pushService.js), keine separate Methode
- sendFirebasePushNotification returned (wirft nicht) — Result-Objekt mit errorCode pruefen

### Multi-User auf einem Geraet (TKN-04, TKN-02)
- User-Wechsel: Nur gleichen FCM-Token loeschen (DELETE WHERE token = $1 AND user_id != $2) — bestehendes Verhalten beibehalten
- Fallback-Device-ID Filter entfernen: `NOT LIKE '%\\_\\_%'` aus getTokensForUser rausnehmen (TKN-02)
- Fallback-ID Generierung beibehalten (platform_timestamp_random via localStorage)
- Native Device.getId() zuerst, localStorage als Fallback — gleiche Logik in sendTokenToServer wie in auth.ts

### Claude's Discretion
- Exakte Implementierung des 12h-Refresh-Checks (Timer vs. appStateChange Listener)
- SQL-Queries fuer error_count Update und Token-Loeschung
- Reihenfolge der Aenderungen innerhalb der Phase

</decisions>

<specifics>
## Specific Ideas

- User will pragmatische Loesungen: Alle "Recommended" Optionen gewaehlt — kein Over-Engineering
- Ghost-Tokens werden spaeter durch CLN-02 (Phase 29) periodisch bereinigt
- sendToUser muss das Return-Objekt von sendFirebasePushNotification auswerten statt try/catch (firebase returned, wirft nicht)

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `auth.ts:49-106` — Logout mit Device.getId() + API-Call Pattern (Vorlage fuer Token-Refresh)
- `AppContext.tsx:16-58` — sendTokenToServer mit Fallback-Logik (muss angepasst werden)
- `pushService.js:59-92` — sendToUser Loop (Error-Handling hier einbauen)
- `firebase.js:67` — errorCode bereits im Return-Objekt (Phase 25 erledigt)

### Established Patterns
- Anti-Spam: fcmTokenSent + fcmTokenLastSent in window (AppContext.tsx:18-21)
- Device ID: Native via Device.getId(), Fallback via localStorage (auth.ts:62-73)
- Token Upsert: ON CONFLICT (user_id, platform, device_id) DO UPDATE (notifications.js:45-53)

### Integration Points
- `pushService.js:39-53` — getTokensForUser: __-Filter entfernen
- `pushService.js:71-84` — sendToUser: Result auswerten statt try/catch
- `AppContext.tsx` — appStateChange Listener fuer 12h-Refresh
- `notifications.js:36-40` — Bestehende User-Wechsel-Logik (DELETE WHERE token = $1)

</code_context>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 26-token-lifecycle*
*Context gathered: 2026-03-05*
