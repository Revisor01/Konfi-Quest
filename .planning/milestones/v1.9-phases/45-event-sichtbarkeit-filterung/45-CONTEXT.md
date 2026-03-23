# Phase 45: Event-Sichtbarkeit + Filterung - Context

**Gathered:** 2026-03-18
**Status:** Ready for planning

<domain>
## Phase Boundary

Konfis sehen nur die fuer sie relevanten Events (eigener Jahrgang), abgesagte Events werden kontextabhaengig behandelt, und die Segment-Reihenfolge wird angepasst. Admin-Event-Liste bekommt Jahrgangs-Filter. Auto-Enrollment bei Jahrgangs-Beitritt fuer bestehende Pflicht-Events.

</domain>

<decisions>
## Implementation Decisions

### Jahrgangs-Filterung fuer Konfis (EVT-v19-01)
- `/konfi/events` Backend-Query muss auf SQL-Ebene nach Jahrgang des Konfis filtern
- Events MIT Jahrgangs-Zuordnung: Nur Events des eigenen Jahrgangs anzeigen
- Events OHNE Jahrgangs-Zuordnung existieren nur als Teamer-Events (teamer_only) — Konfis sehen diese ohnehin nicht
- Kein Sonderfall fuer "allgemeine Events" noetig — alle Konfi-Events haben Jahrgangs-Zuordnung

### Abgesagte Events (EVT-v19-02)
- Abgesagte Events nur anzeigen wenn der Konfi zu dem Event ANGEMELDET war (damit klar ist, dass es abgesagt wurde)
- Abgesagte Events wo Konfi NICHT angemeldet war: komplett ausblenden (kein Grund den Konfi damit zu verwirren)
- Anzeige bei angemeldeten abgesagten Events: durchgestrichen mit "Abgesagt" Badge (wie aktuell)

### Abmelde-Button bei Pflicht-Events (EVT-v19-03)
- Konfi sieht keinen Abmelde-Button bei Pflicht-Events bei denen er nicht angemeldet ist
- Opt-out Button nur bei Pflicht-Events wo der Konfi angemeldet ist (existiert bereits, nur Visibility-Check anpassen)

### Auto-Enrollment bei Jahrgangs-Beitritt (EVT-v19-04)
- Neuer Konfi in einem Jahrgang wird automatisch zu allen bestehenden zukuenftigen Pflicht-Events des Jahrgangs hinzugefuegt
- Bei Registrierung funktioniert das bereits (auth.js:614-626)
- Muss auch greifen wenn Admin einen Konfi nachtraeglich einem Jahrgang zuweist

### Konfi-Event Segment-Reihenfolge (EVT-v19-08)
- Reihenfolge: **Meine**, **Alle**, **Konfi**
- **Meine**: Alle Events wo Konfi angemeldet ist/war — inklusive vergangene, abgesagte (mit Badge), nicht-teilgenommen. Das ist die persoenliche Event-Historie
- **Alle**: NUR zukuenftige Events (keine vergangenen — das verwirrt). Alle verfuegbaren Events des Jahrgangs
- **Konfi**: Konfirmations-Events (Kategorie-Filter, wie bisher)

### Admin Jahrgangs-Filter (EVT-v19-09)
- IonSelect Dropdown unter dem Header mit Optionen: "Alle Jahrgaenge" + einzelne Jahrgaenge
- Jahrgangsname(n) als Subtitle unter dem Event-Namen in jedem Listeneintrag (z.B. "Gottesdienst Advent" / "2024/25, 2025/26")
- Filter wirkt auf alle bestehenden Tabs (Aktuell, Alle, Konfi)

### Claude's Discretion
- Genaue SQL-Query-Struktur fuer den Jahrgangs-Filter
- Sortierung innerhalb der Segmente
- Styling Details fuer den Admin-Filter

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Event-System Backend
- `backend/routes/events.js` — Event CRUD, Jahrgangs-Zuordnungen (event_jahrgang_assignments), Auto-Enrollment bei Event-Erstellung (Zeile 725-739)
- `backend/routes/konfi.js` — Konfi-Event-Query (Zeile 1118-1216, KEIN Jahrgang-Filter — Hauptbug), Opt-out Logik (Zeile 1862-1926), Abmelde-Logik (Zeile 1740-1790)
- `backend/routes/auth.js` — Auto-Enrollment bei Registrierung (Zeile 612-629)

### Event-System Frontend
- `frontend/src/components/konfi/pages/KonfiEventsPage.tsx` — Segment-Tabs, Event-Filterung, Sortierung
- `frontend/src/components/konfi/views/EventsView.tsx` — Event-Liste Rendering, Status-Badges, Cancelled-Handling
- `frontend/src/components/admin/pages/AdminEventsPage.tsx` — Admin-Tabs, Event-Filterung
- `frontend/src/components/admin/EventsView.tsx` — Admin Event-Liste, Status-Farben

No external specs — requirements fully captured in decisions above and REQUIREMENTS.md (EVT-v19-01 bis EVT-v19-09).

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `event_jahrgang_assignments` Tabelle: Many-to-many Verknuepfung Event-Jahrgang, bereits genutzt in events.js
- `konfi_profiles.jahrgang_id`: Jahrgang des Konfis, bereits in Auth-Route fuer Auto-Enrollment genutzt
- `EventsView.tsx` cancelled-Handling: Durchstrich-Styling und "Abgesagt" Badge bereits implementiert (Zeile 173, 205-206)
- `IonSelect` Pattern: Wird bereits in anderen Admin-Views fuer Filter genutzt

### Established Patterns
- Events-Route laedt alle Events der Organisation, dann filtert JavaScript (events.js:98-117) — fuer Konfi-Route sollte SQL-Filter bevorzugt werden
- Konfi-Events-Query in konfi.js (Zeile 1183) nutzt nur `WHERE e.organization_id = $1` — kein JOIN auf event_jahrgang_assignments
- Admin-Events nutzen LEFT JOIN auf event_jahrgang_assignments fuer Jahrgangs-Anzeige

### Integration Points
- Konfi-Event-Query (`/konfi/events` in konfi.js) muss um Jahrgang-JOIN erweitert werden
- KonfiEventsPage.tsx Segment-Reihenfolge und Filter-Logik aendern
- AdminEventsPage.tsx um Jahrgangs-Dropdown erweitern
- Konfi-Management Route (Jahrgangs-Zuweisung) muss Auto-Enrollment triggern

</code_context>

<specifics>
## Specific Ideas

- "Meine" Segment zeigt die persoenliche Event-Historie: angemeldete Events inkl. vergangene und abgesagte
- "Alle" zeigt nur was noch kommt — keine vergangenen Events, das verwirrt
- Abgesagte Events nur sichtbar wenn Konfi angemeldet war — damit ihm klar ist dass es abgesagt wurde

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 45-event-sichtbarkeit-filterung*
*Context gathered: 2026-03-18*
