# Phase 32: Punkte-UI Frontend - Context

**Gathered:** 2026-03-08
**Status:** Ready for planning

<domain>
## Phase Boundary

Alle Punkte-bezogenen UI-Elemente reagieren korrekt auf deaktivierte Punkte-Typen. ActivityRings, Progress-Bars, Ranking und Punkte-Historie passen sich dynamisch an die Jahrgang-Konfiguration an. Konfi-Ansicht blendet deaktivierte Typen komplett aus, Admin-Ansicht zeigt sie ausgegraut.

</domain>

<decisions>
## Implementation Decisions

### ActivityRings
- Dynamische Ring-Anzahl: 1 Ring bei 1 aktivem Typ, 3 Ringe bei 2 aktiven Typen (inkl. Total)
- Bei 1 aktivem Typ: kein Total-Ring (waere identisch)
- Ring-Groesse bleibt konstant (size=160), kein Layout-Sprung
- Stats unter den Ringen zeigen nur aktive Typen (kein Gesamt-Chip bei 1 Typ)
- Gleiches Verhalten in Admin-KonfiDetailView wie im Konfi-Dashboard

### Fortschritts-Anzeigen (Progress-Bars, Chips)
- Konfi-Ansicht: Deaktivierte Typen komplett ausblenden (Progress-Bars und Chips)
- Bei 1 aktivem Typ: nur 1 Progress-Bar, kein Gesamt-Chip
- Admin-KonfiDetailView: Deaktivierte Typen ausgegraut mit '(deaktiviert)' Label sichtbar
- Admin sieht historische Punktedaten auch fuer deaktivierte Typen

### Ranking
- Label bleibt generisch 'Punkte' (Backend liefert schon korrekte Summe nur aktiver Typen)
- Admin-Ranking (KonfisView Sortierung) nutzt gleiche Logik wie Konfi-Ranking (nur aktive Typen)

### Punkte-Historie
- Konfi-Ansicht (PointsHistoryModal): Eintraege deaktivierter Typen komplett ausblenden
- Admin-Ansicht (KonfiDetailView): Alle historischen Eintraege sichtbar, deaktivierte ausgegraut mit Label

### Claude's Discretion
- CSS-Klassen fuer ausgegraut-Darstellung in Admin-Views
- Exakte Implementierung der dynamischen Ring-Berechnung
- Wie point_config vom Dashboard-Endpoint in die Komponenten propagiert wird
- Uebergangsanimation wenn sich Ring-Anzahl aendert (oder keine)

</decisions>

<specifics>
## Specific Ideas

- Konfi = clean, nur aktive Typen sichtbar. Admin = vollstaendiger Ueberblick mit visueller Unterscheidung
- Ausgegraut + '(deaktiviert)' Label ist das Pattern fuer Admin-Ansichten
- Kein Gesamt/Total wenn nur 1 Typ aktiv (redundante Information vermeiden)

</specifics>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ActivityRings.tsx`: Apple Health-Style Ringe mit Animation, aktuell 6 Props (totalPoints, gottesdienstPoints, gemeindePoints, gottesdienstGoal, gemeindeGoal, size)
- `DashboardView.tsx`: Ranking-Sektion, Glass-Chips fuer Punkte-Anzeige, point_config bereits vom Backend geliefert
- `PointsHistoryModal.tsx`: Punkte-Historie als Modal
- `KonfiDetailView.tsx`: Admin-Detail mit ActivityRings + Punkte-Aufschluesselung
- `KonfisView.tsx`: Admin-Uebersicht mit Progress-Bars pro Konfi

### Established Patterns
- point_config wird vom Dashboard-Endpoint geliefert (gottesdienst_enabled, gemeinde_enabled, target_gottesdienst, target_gemeinde)
- RankingEntry Typ hat total_points Feld (backend liefert schon korrekte Summe)
- 13 Dateien referenzieren gottesdienst_points/gemeinde_points

### Integration Points
- Dashboard-Endpoint liefert point_config -- muss in ActivityRings, Stats, Ranking propagiert werden
- ActivityRings Props muessen um point_config erweitert oder bedingt gesetzt werden
- KonfisView und KonfiDetailView brauchen Zugriff auf Jahrgang-point_config

</code_context>

<deferred>
## Deferred Ideas

None -- Diskussion blieb im Phase-Scope

</deferred>

---

*Phase: 32-punkte-ui-frontend*
*Context gathered: 2026-03-08*
