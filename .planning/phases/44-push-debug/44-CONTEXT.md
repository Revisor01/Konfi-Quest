# Phase 44: Push-Debug - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Ghost-Push-Bug fixen: Admins erhalten alle 5 Minuten leere Push-Benachrichtigungen. Root Cause ist identifiziert — `sendBadgeUpdate()` sendet Push ohne title/body, ausgeloest durch den 5-Minuten Badge-Sync in `backgroundService.js`.

</domain>

<decisions>
## Implementation Decisions

### Badge-Sync Verhalten
- 5-Minuten-Sync BLEIBT bestehen — wird gebraucht fuer Streak-Badges und zeitbasierte Badges
- Sync lauft nur fuer Konfis und Teamer, NICHT fuer Admins
- Admin-User komplett aus dem Badge-Sync-Loop ausschliessen (keine pending_requests/pending_events Badge-Berechnung)

### Push-Benachrichtigungen bei neuem Badge
- Wenn ein Konfi/Teamer durch den Sync einen NEUEN Badge bekommt: sichtbare Push senden
- Push-Text: "Neues Badge erreicht: [Badge-Name]"
- Nur bei NEUEN Badges pushen — nicht bei jedem Sync-Durchlauf wenn Badge-Count gleich bleibt
- Change-Detection: vorherigen Badge-Count merken, nur bei Aenderung Push senden

### Admin-Push
- Admins bekommen KEINEN Badge-Sync-Push
- Admins brauchen keine Badge-Count-Updates auf dem App-Icon durch den Sync

### Claude's Discretion
- Ob der Sync-Intervall bei 5 Minuten bleibt oder angepasst wird
- Wie die Change-Detection implementiert wird (in-memory vs DB-basiert)
- Ob silent badge-count updates (ohne sichtbare Push) fuer die Badge-Zahl am App-Icon weiter laufen

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Push-System
- `backend/services/pushService.js` Zeilen 233-286 — `sendBadgeUpdate()` ohne title/body (ROOT CAUSE)
- `backend/services/backgroundService.js` Zeilen 10-105 — 5-Min Badge-Sync mit `updateAllUserBadges()`
- `backend/push/firebase.js` Zeilen 35-69 — Firebase Send mit Fallback-Handling

### Badge-Vergabe
- `backend/routes/badges.js` — `checkAndAwardBadges()` bei Punkt-Vergabe
- `backend/services/backgroundService.js` Zeilen 40-105 — Periodischer Badge-Check

</canonical_refs>

<code_context>
## Existing Code Insights

### Root Cause
- `sendBadgeUpdate()` in pushService.js (Zeile 246-252) sendet KEIN title und KEIN body
- Firebase firebase.js (Zeile 45) setzt `body: notificationData.body || notificationData.alert` — beides undefined
- Resultat: Leere Push mit "Konfi Quest" als Titel und leerem Body

### Trigger-Kette
1. `backgroundService.js` startet 5-Min-Intervall beim Server-Start (server.js:499)
2. `updateAllUserBadges()` berechnet Badge-Counts fuer ALLE User inkl. Admins
3. Admins: pending_requests + pending_events werden als Badge-Count gezaehlt (Zeile 70-83)
4. Bei badgeCount > 0: `sendBadgeUpdate()` wird aufgerufen (Zeile 91)
5. Push geht raus — leer

### Bestehende Push-Methoden (pushService.js)
- `sendPushNotification()` — generisch mit title/body (funktioniert)
- `sendBadgeUpdate()` — NUR badge count, KEIN title/body (KAPUTT)
- `sendNewBadgeNotification()` — existiert NICHT, muss erstellt werden

</code_context>

<specifics>
## Specific Ideas

- "Nur der Konfi sollte ein Update bekommen, wenn er einen Badge hat"
- "Admin muss dazu nichts wissen"
- Push-Text bei neuem Badge: "Neues Badge erreicht: [Badge-Name]"

</specifics>

<deferred>
## Deferred Ideas

None — Discussion stayed within phase scope

</deferred>

---

*Phase: 44-push-debug*
*Context gathered: 2026-03-18*
