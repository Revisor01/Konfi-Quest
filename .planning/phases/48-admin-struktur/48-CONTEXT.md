# Phase 48: Admin-Struktur - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Admin-Bereich bekommt Badge-Typ-Abfrage vor Erstellung, Events-Tab Badge fuer unverbuchte Events (Anzahl-basiert), und Chat-Filter mit korrekten Segment-Labels (Alle/Direkt/Konfis/Team). Navigation ist bereits korrekt — kein Strukturumbau noetig.

</domain>

<decisions>
## Implementation Decisions

### Unterseiten-Organisation (ADM-01, ADM-02, ADM-03)
- Navigation ist bereits korrekt: Zertifikate, Dashboard-Settings und Badges sind Unterseiten im Inhalt-Bereich
- Kein Strukturumbau noetig — ADM-01 und ADM-02 sind bereits erfuellt
- Nur ADM-03 braucht Arbeit: Badge-Typ-Abfrage (Konfi/Teamer) VOR der Badge-Erstellung
- AdminBadgesPage hat bereits Role-Filter Tabs (konfi/teamer) — der ausgewaehlte Tab bestimmt den Typ bei Erstellung
- Badge-Erstellungs-Button soll den aktuell ausgewaehlten Segment-Typ (Konfi oder Teamer) als target_role an BadgeManagementModal uebergeben

### Events-Tab Badge (ADM-04)
- Badge zeigt die ANZAHL der zu verbuchenden Events (z.B. "2" wenn 2 Events verbucht werden muessen)
- Zaehlt nur vergangene Events mit unverbuchten Teilnehmer:innen (aktuelles Verhalten ist korrekt)
- Badge verschwindet erst wenn ALLE ausstehenden Events verbucht/geschlossen sind
- BadgeContext hat bereits `pendingEventsCount` — sicherstellen dass es korrekt zaehlt und auf dem Events-Tab angezeigt wird

### Chat-Filter Labels (ADM-05)
- Admin-Chat bekommt Segmente wie bei Konfis, erweitert um "Team": **Alle, Direkt, Konfis, Team**
- "Konfis" filtert Chat-Raeume mit Typ `jahrgang` oder `group` die Konfis enthalten
- "Team" filtert Chat-Raeume mit Typ `admin` (Team-interne Chats)
- "Direkt" bleibt fuer Direkt-Nachrichten
- "Alle" zeigt alle Raeume
- Aktuell: Segmente sind Alle/Direkt/Gruppe/Jahrgang — umbenennen und Filterlogik anpassen

### Claude's Discretion
- Ob Badge-Typ-Abfrage als eigener Zwischenschritt (Alert/ActionSheet) oder einfach durch den aktiven Tab bestimmt wird
- Genaue Filterlogik fuer "Konfis" vs "Team" Chat-Segmente (welche room.type Werte wohin)
- Ob Events-Badge auch auf dem "Mehr"-Tab sichtbar sein soll

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Badge-Verwaltung
- `frontend/src/components/admin/pages/AdminBadgesPage.tsx` — Role-Filter Tabs (konfi/teamer), Badge-Erstellung
- `frontend/src/components/admin/modals/BadgeManagementModal.tsx` — Badge Create/Edit Modal (47KB)
- `frontend/src/components/admin/BadgesView.tsx` — Badge List Rendering

### Events-Tab Badge
- `frontend/src/contexts/BadgeContext.tsx` — `pendingEventsCount` Berechnung, `refreshAllCounts()`
- `frontend/src/components/layout/MainTabs.tsx` — Tab-Badge Anzeige

### Chat-Filter
- `frontend/src/components/chat/ChatOverview.tsx` — Segment-Filter (Zeile 356-362), `getRoomSubtitle()`, Filterlogik

### Admin Navigation
- `frontend/src/components/admin/pages/AdminSettingsPage.tsx` — "Mehr"-Tab Entry, Inhalt-Bereich Links

No external specs — requirements fully captured in decisions above and REQUIREMENTS.md (ADM-01 bis ADM-05).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `BadgeContext.tsx`: Zentrales Badge-Count-Management mit `pendingEventsCount` — bereits vorhanden, nur Anzeige pruefen
- AdminBadgesPage: Hat bereits `selectedRole` State mit Konfi/Teamer Tabs — Pattern fuer Typ-Uebergabe an Modal
- IonSegment Pattern: Existiert in ChatOverview.tsx (Zeile 356-362) — nur Labels und Filterlogik anpassen

### Established Patterns
- `useIonModal` Hook fuer alle Modals
- BadgeManagementModal bekommt Props ueber useIonModal
- Chat-Filter: `filterType` State mit IonSegment, `filteredRooms` mit switch/case

### Integration Points
- AdminBadgesPage: `selectedRole` als Prop an BadgeManagementModal bei Erstellung uebergeben
- MainTabs.tsx: Events-Tab IonBadge Anzeige pruefen
- ChatOverview.tsx: Segment-Labels und Filterlogik aendern

</code_context>

<specifics>
## Specific Ideas

- Chat-Segmente genau wie bei Konfis, nur mit "Team" als Extra-Segment
- Events-Badge muss Anzahl zeigen (nicht nur Punkt), verschwindet nur wenn 0
- Badge-Typ (Konfi/Teamer) wird durch den aktiven Tab bestimmt, kein extra Dialog noetig

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 48-admin-struktur*
*Context gathered: 2026-03-19*
