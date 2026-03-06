# Phase 27: Badge-Count Single Source of Truth - Context

**Gathered:** 2026-03-06
**Status:** Ready for planning

<domain>
## Phase Boundary

Unread-Badge-Zahlen ueberall konsistent machen: App-Icon, TabBar und Chat-Liste zeigen denselben korrekten Wert. Badge = "erfordert Aufmerksamkeit/Interaktion", nicht "etwas Neues passiert".

Explizit NICHT: Level-Up/Punkte-Notifications (Phase 28 Push-Flows), periodischer Token-Cleanup (Phase 29).

</domain>

<decisions>
## Implementation Decisions

### Single Source of Truth: BadgeContext
- BadgeContext.tsx wird zur zentralen Stelle fuer ALLE Badge-Counts
- chatNotifications State aus AppContext wird komplett nach BadgeContext verschoben (unreadByRoom + totalUnread)
- pendingRequestsCount und pendingEventsCount aus MainTabs werden nach BadgeContext verschoben
- AppContext chatNotifications wird entfernt
- MainTabs wird schlank: liest nur noch aus BadgeContext

### Badge-Kategorien (was zaehlt)
- **Admin:** Chat-Unreads + offene Antraege + Events zu verbuchen
- **Konfi:** Chat-Unreads (nur)
- Level-Up, Punkte, Achievements sind KEINE Badge-Counts — das sind Push-Notifications (Phase 28)
- Prinzip: Badge nur fuer Dinge die Interaktion erfordern

### App-Icon Badge (BDG-02)
- App-Icon = Summe aller Badge-Kategorien (Admin: Chat + Antraege + Events / Konfi: Chat)
- Echter Count bis erledigt — KEIN Reset bei App-Open
- backgroundService.js (Server-Push) muss auch Antraege und Events mitzaehlen (nicht nur Chat)
- backgroundService bleibt als Fallback fuer App-Icon wenn App geschlossen ist

### Chat-Liste Unread-Counts (BDG-03)
- WebSocket 'newMessage' Event + API Refresh (BadgeContext.refreshFromAPI)
- Per-Room unreadByRoom in BadgeContext verwaltet
- Unread-Count sofort auf 0 beim Betreten des Raums (last_read_at Update)
- ChatOverview nutzt unreadByRoom aus BadgeContext statt eigene Berechnung

### TabBar-Badges (BDG-04)
- Admin: Chat-Tab (Chat-Unreads), Antraege-Tab (offene Antraege), Events-Tab (Events zu verbuchen)
- Konfi: Chat-Tab (Chat-Unreads)
- Dashboard-Tab hat keinen Badge
- Alle Counts kommen aus BadgeContext

### Refresh-Strategie
- API-Call bei App-Start fuer Baseline aller Counts
- WebSocket 'newMessage' fuer Chat-Unreads Live-Update
- Window Events ('requestStatusChanged', 'events-updated') fuer Antraege/Events Live-Update
- backgroundService als Server-seitiger Fallback (Silent Push fuer App-Icon)

### Claude's Discretion
- Exakte BadgeContext Interface-Erweiterung (welche Felder, welche Methoden)
- Wie backgroundService die zusaetzlichen Counts (Antraege, Events) berechnet
- Reihenfolge der Migration (Backend-first oder Frontend-first)
- Ob refreshFromAPI ein oder mehrere API-Calls macht

</decisions>

<specifics>
## Specific Ideas

- User-Beispiel: "3 Chat + 2 Antraege + 1 Event = Icon zeigt 6, Tabs zeigen 3/2/1. Nach Antraege erledigen: Icon 4, Tabs 3/0/1"
- User will Pragmatismus: Alle "Recommended" Optionen gewaehlt
- Push und Badge auch wenn App geschlossen ist — backgroundService muss erweitert werden

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `BadgeContext.tsx` — Bereits vorhanden mit refreshFromAPI, Badge.set/clear, WebSocket-Listener
- `MainTabs.tsx:64-132` — pendingRequestsCount + pendingEventsCount Polling-Logik (wird nach BadgeContext verschoben)
- `backgroundService.js:40-79` — Badge-Update Loop (muss um Antraege/Events erweitert werden)
- `AppContext.tsx:109-135` — chatNotifications State (wird entfernt, nach BadgeContext)

### Established Patterns
- Window Events: 'requestStatusChanged', 'events-updated' fuer sofortige Aktualisierung
- Badge.set/Badge.clear via @capawesome/capacitor-badge
- WebSocket 'newMessage' fuer Chat-Updates
- API Polling als Fallback (30s Antraege, 60s Events)

### Integration Points
- `BadgeContext.tsx` — Erweitern um unreadByRoom, pendingRequests, pendingEvents
- `AppContext.tsx` — chatNotifications State + Loading entfernen
- `MainTabs.tsx` — Polling-Logik raus, nur noch useBadge()
- `ChatOverview.tsx` — unreadByRoom aus BadgeContext statt eigene Berechnung
- `backgroundService.js` — Badge-Query um Antraege + Events erweitern
- `pushService.js:sendBadgeUpdate` — Badge-Count Payload anpassen

</code_context>

<deferred>
## Deferred Ideas

- Badge fuer neue Achievements/Badges bei Konfis — aktuell existiert newBadgesCount in MainTabs, aber nicht als "Interaktion erforderlich" klassifiziert. Koennte spaeter ergaenzt werden.

</deferred>

---

*Phase: 27-badge-count-single-source-of-truth*
*Context gathered: 2026-03-06*
