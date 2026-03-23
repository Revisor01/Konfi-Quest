# Phase 37: Dashboard-Widget + Anwesenheitsstatistik - Research

**Researched:** 2026-03-09
**Domain:** Frontend Widget-Erweiterung + Backend Attendance-Statistik
**Confidence:** HIGH

## Summary

Phase 37 hat zwei Teilbereiche: (1) das bestehende Events-Widget im Konfi-Dashboard um `bring_items`-Info erweitern und (2) eine pro-Konfi Anwesenheitsstatistik fuer Pflicht-Events in der Admin KonfiDetailView.

Die gute Nachricht: Das Events-Widget zeigt `bring_items` bereits an (DashboardView.tsx Zeile 930-935). Der `/konfi/events`-Endpoint nutzt `SELECT e.*`, was `bring_items` einschliesst. **EUI-02 und EUI-03 sind bereits implementiert** -- das Dashboard zeigt Events mit Titel, Datum, Ort, bring_items und der bestehende `show_events`-Toggle steuert die Sichtbarkeit. Es muss lediglich verifiziert werden, dass alles korrekt funktioniert.

Fuer die Anwesenheitsstatistik (ANW-01, ANW-02) braucht es einen neuen Backend-Endpoint und eine neue Sektion in der KonfiDetailView.

**Primary recommendation:** Einen neuen Backend-Endpoint `/admin/konfis/:id/attendance-stats` erstellen, der Pflicht-Event-Anwesenheit berechnet, und eine neue Sektion in KonfiDetailView einfuegen.

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions
- KEIN neues Widget -- bestehendes Events-Widget im Dashboard wird erweitert
- Jedes Event in der Liste bekommt die "Was mitbringen"-Info angezeigt (bring_items Feld, falls vorhanden)
- Wenn kein bring_items gesetzt: nichts zusaetzlich anzeigen
- Bestehender show_events Toggle steuert das Widget weiterhin -- KEIN neuer show_next_event Toggle
- Backend muss bring_items im /konfi/events oder /konfi/dashboard Endpoint mitliefern
- Anzeige in der bestehenden Admin KonfiDetailView als neue Sektion
- Nur Pflicht-Events (mandatory=true) werden gezaehlt
- Darstellung: "X/Y anwesend (Z%)" als Zusammenfassung
- Unterhalb der Anwesenheitsquote in der KonfiDetailView
- Zeigt vergangene Pflicht-Events wo Konfi NICHT present war
- Unterscheidung: "Opt-out: [Begruendung]" vs "Nicht erschienen"
- Sortierung chronologisch (neueste zuerst)

### Claude's Discretion
- Genaue Platzierung der Anwesenheits-Sektion in KonfiDetailView (nach Aktivitaeten oder nach Bonuspunkten)
- Farbgebung und Icons fuer die Anwesenheitsquote
- Ob Quote als Progress-Bar, Text oder Ring dargestellt wird
- Pagination oder Scrolling fuer lange Verpasste-Events-Listen
- Backend-Query-Optimierung (JOIN vs separate Abfragen)

### Deferred Ideas (OUT OF SCOPE)
None -- Diskussion blieb innerhalb Phase-Scope
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| EUI-02 | Dashboard zeigt Widget "Naechstes Event" mit Titel, Datum, Ort und Was-mitbringen-Info | BEREITS IMPLEMENTIERT: DashboardView.tsx zeigt Events mit bring_items (Zeile 930-935), /konfi/events liefert e.* inkl. bring_items. Nur Verifikation noetig. |
| EUI-03 | Dashboard-Widget ist ueber DashboardConfig steuerbar | BEREITS IMPLEMENTIERT: show_events Toggle steuert Events-Sektion (DashboardView.tsx Zeile 828). Kein neuer Toggle noetig per User-Decision. |
| ANW-01 | Admin sieht pro Konfi eine Anwesenheitsquote fuer Pflicht-Events (X/Y anwesend, Prozent) | Neuer Backend-Endpoint + Frontend-Sektion in KonfiDetailView. DB-Daten vorhanden: events.mandatory, event_bookings.attendance_status, event_jahrgang_assignments. |
| ANW-02 | Admin sieht pro Konfi eine Liste der verpassten Pflicht-Events mit Opt-out-Grund oder "Nicht erschienen" | Gleicher Backend-Endpoint liefert missed_events Array. Frontend zeigt Liste mit Unterscheidung opted_out (mit Grund) vs absent/NULL. |
</phase_requirements>

## Architecture Patterns

### Bestehende Code-Struktur

**Dashboard Events (bereits funktional):**
- `KonfiDashboardPage.tsx` laedt Events via `api.get('/konfi/events')` in `loadUpcomingEvents()`
- Filtert auf zukuenftige Events mit confirmed/waitlist Status
- `DashboardView.tsx` rendert Events-Sektion wenn `dashboardConfig?.show_events !== false`
- `bring_items` wird bereits angezeigt (Zeile 930-935) mit bagHandle-Icon
- `DashboardEvent` Interface in `types/dashboard.ts` hat bereits `bring_items?: string` und `mandatory?: boolean`

**KonfiDetailView (Erweiterungspunkt):**
- Datei: `frontend/src/components/admin/views/KonfiDetailView.tsx`
- Laedt Konfi-Daten via `api.get('/admin/konfis/${konfiId}')`
- Bestehende Sektionen: Header mit ActivityRings, Bonuspunkte, Event-Points, Aktivitaeten
- Pattern: `IonList className="app-section-inset"` mit `IonListHeader` + `IonCard` + `IonCardContent`
- CSS-Klassen: `app-section-icon`, `app-icon-circle`, `app-list-item`, `app-list-item__meta`

**Backend-Pattern fuer Konfi-Detail:**
- Route: `backend/routes/konfi-managment.js` (Achtung: Typo im Dateinamen, "managment")
- Endpoint `GET /admin/konfis/:id` liefert Konfi-Profil + Aktivitaeten + Bonus
- Separater Endpoint `GET /admin/konfis/:id/event-points` fuer Event-Punkte
- Pattern: Separater Endpoint pro Datenbereich, nicht alles in einen Query packen

### Empfohlene Architektur fuer Anwesenheitsstatistik

**Backend:**
```
GET /admin/konfis/:id/attendance-stats
Response: {
  total_mandatory: number,      // Anzahl vergangener Pflicht-Events fuer diesen Jahrgang
  attended: number,             // Davon mit attendance_status='present'
  percentage: number,           // attended/total_mandatory * 100
  missed_events: [{
    event_id: number,
    event_name: string,
    event_date: string,
    status: 'opted_out' | 'absent' | 'no_show',
    opt_out_reason: string | null
  }]
}
```

**SQL-Logik:**
1. Finde alle vergangenen Pflicht-Events (mandatory=true, event_date < NOW()) die dem Jahrgang des Konfis zugewiesen sind
2. LEFT JOIN auf event_bookings fuer diesen Konfi
3. "Anwesend" = attendance_status = 'present'
4. "Verpasst" = attendance_status = 'absent' ODER attendance_status IS NULL (kein Check-in)
5. "Opt-out" = booking status = 'opted_out' (mit opt_out_reason)

**Frontend:**
- Neue Sektion in KonfiDetailView nach der Events-Sektion
- Lade Daten via `api.get('/admin/konfis/${konfiId}/attendance-stats')`
- Quote als IonProgressBar + Text "X/Y anwesend (Z%)"
- Verpasste Events als Liste darunter

### Empfehlung: Platzierung
Die Anwesenheits-Sektion sollte **nach Events und vor Aktivitaeten** platziert werden, da sie thematisch zu Events gehoert.

### Empfehlung: Darstellung der Quote
IonProgressBar (bereits im Projekt verwendet) mit Prozenttext daneben. Farbgebung: Gruen (>80%), Gelb (50-80%), Rot (<50%).

## Common Pitfalls

### Pitfall 1: Pflicht-Events ohne Booking-Eintrag
**What goes wrong:** Konfis die nach Event-Erstellung dem Jahrgang zugewiesen wurden, haben evtl. keinen event_bookings-Eintrag (Auto-Enrollment Nachtrags-Hook aus Phase 34 sollte das verhindern, aber Altdaten koennten betroffen sein).
**How to avoid:** SQL muss auch Events ohne Booking zaehlen (LEFT JOIN). Kein Booking bei vergangenem Pflicht-Event = "Nicht erschienen".

### Pitfall 2: Zukuenftige Events in Statistik
**What goes wrong:** Zukuenftige Pflicht-Events wuerden die Quote verfaelschen (Konfi kann noch nicht anwesend sein).
**How to avoid:** WHERE e.event_date < NOW() -- nur vergangene Events zaehlen.

### Pitfall 3: Opted-out als "verpasst" zaehlen
**What goes wrong:** Opt-out ist eine gewollte Abmeldung, kein "Nicht erschienen".
**How to avoid:** Beides in missed_events auflisten, aber klar unterscheiden. Fuer die Quote: Opt-out zaehlt als "nicht anwesend" (per User-Decision: Quote basiert auf Anwesenheit).

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Prozentbalken | Custom CSS Progress | IonProgressBar | Bereits im Projekt verwendet (DashboardView), konsistenter Look |
| Datumsformatierung | Eigene Formatierung | toLocaleDateString('de-DE') | Pattern aus KonfiDetailView.tsx Zeile 253-258 |
| Sektions-Layout | Eigenes Layout | app-section-inset + IonListHeader Pattern | Konsistenz mit bestehenden Sektionen |

## Sources

### Primary (HIGH confidence)
- Codebase-Analyse: DashboardView.tsx, KonfiDetailView.tsx, konfi.js, types/dashboard.ts
- bring_items bereits in DashboardView gerendert (Zeile 930-935)
- /konfi/events nutzt SELECT e.* (bring_items inkludiert)
- show_events Toggle bereits in DashboardView (Zeile 828)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - alles existiert bereits im Projekt
- Architecture: HIGH - folgt bestehenden Patterns
- Pitfalls: HIGH - klare SQL-Logik, bekannte Datenstruktur

**Research date:** 2026-03-09
**Valid until:** 2026-04-09
