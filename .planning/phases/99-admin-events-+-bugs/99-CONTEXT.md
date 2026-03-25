# Phase 99: Admin Events + Bugs - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Admin Event-UI Verbesserungen und Backend-Bugfixes: Suchfeld/Filter-Struktur, Event-Details Chat+Beschreibung, Event-Absagen-Dialog, Wartelisten-Logik und Chat-Navigation-Bug.

</domain>

<decisions>
## Implementation Decisions

### Event-UI (AEV-01 bis AEV-03)
- Suchfeld und Jahrgangs-Filter: Zwischenueberschriften via IonListHeader mit app-section-icon — konsistent mit Rest der Admin-Views
- "Kind hinzufuegen" → "Konfi hinzufuegen" in EventDetailView (alle Vorkommen)
- Chat-Button im Event-Detail Header: chatbubbleOutline Icon neben QR-Button, mit Bestaetigungs-Alert "Chat erstellen?" wenn kein Chat existiert

### Beschreibungstexte (AEV-05)
- Globale CSS-Variable fuer Beschreibungstexte und Detail-Texte: `--app-description-font-size` in variables.css
- Alle Seiten nutzen diese Variable statt hartcodierter Werte
- Default-Wert: 1rem (statt aktuell kleinere Werte wie 0.85rem/0.9rem)

### Event-Absagen (AEV-06, AEV-07)
- Absagen-Dialog: IonActionSheet statt einfacher Alert, mit Event-Details (Titel, Datum, Teilnehmeranzahl) + "Wirklich absagen?"
- Nach Absage: Seite reloaden und Event aus der aktiven Liste entfernen

### Push bei Loeschen (AEV-08)
- Abgesagtes Event loeschen: bestehende `sendEventCancellationToKonfis` wiederverwenden mit angepasstem Text ("Event geloescht")
- Info "X Konfis waren angemeldet" im Loesch-Dialog anzeigen

### Backend-Bugfixes (ABG-01, ABG-02)
- Wartelisten-Nachruecken: Nur wenn `confirmedCount < maxCapacity` (strikt kleiner), nicht bei `>=`
- Chat aus Event schwarzer Screen: `useIonRouter` mit routerDirection="forward" statt router.push

### Claude's Discretion
Keine — alle Entscheidungen vom User getroffen.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- SectionHeader + IonListHeader Pattern (aus anderen Admin-Views)
- IonActionSheet fuer erweiterte Dialoge
- `sendEventCancellationToKonfis()` in PushService (bereits implementiert)
- `useIonRouter` Pattern (in v2.6 eingefuehrt)
- bookingUtils.js mit `promoteFromWaitlist()` und `determineBookingStatus()`
- CSS-Variablen-System in variables.css

### Established Patterns
- Admin Event-Seiten: useOfflineQuery + useLiveRefresh
- Swipe-Actions: IonItemSliding mit IonItemOptions
- Chat-Navigation: useIonRouter mit routerDirection
- Header-Buttons: IonButtons slot="end" mit IonIcon

### Integration Points
- AdminEventsPage.tsx → EventsView.tsx → EventDetailView.tsx → EventDetailSections.tsx
- Backend: events.js Routes + bookingUtils.js Waitlist-Logik
- PushService fuer Benachrichtigungen bei Event-Loeschung
- ChatRoomView.tsx fuer Chat-Navigation aus Event

</code_context>

<specifics>
## Specific Ideas

- CSS-Variable `--app-description-font-size` global in variables.css definieren
- Alle Beschreibungstexte und Detail-Texte sollen diese Variable nutzen
- Default 1rem, ueberall konsistent

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>
