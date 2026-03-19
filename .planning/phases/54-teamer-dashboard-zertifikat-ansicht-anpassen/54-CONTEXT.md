# Phase 54: Teamer Dashboard Zertifikat-Ansicht anpassen - Context

**Gathered:** 2026-03-19
**Status:** Ready for planning

<domain>
## Phase Boundary

Zertifikat-Sektion im Teamer-Dashboard von horizontalem Scroll auf 2x2 Grid umstellen mit kompakteren Karten. 4 Standard-Zertifikate bei Organisations-Erstellung automatisch anlegen.

</domain>

<decisions>
## Implementation Decisions

### Layout: 2x2 Grid statt horizontalem Scroll
- Aktuelle horizontale Scroll-Ansicht (120px Karten) wird durch 2x2 CSS Grid ersetzt
- Kompaktere Karten — weniger Hoehe, kuerzere Titel
- Bei mehr als 4 Zertifikaten: weitere 2er-Reihen darunter (grid-template-columns: repeat(2, 1fr))
- Standard sind 4 Zertifikate: Teamer:innen Card, JuLeiCa, Rettungsschwimmer, Erste Hilfe

### Kompaktere Karten
- Schmaler als aktuell (120px Breite war fuer Scroll optimiert — im Grid 50% minus Gap)
- Titel kuerzer anzeigen (ggf. abkuerzen oder umbrechen)
- Icon + Status kompakt, nicht mehr so viel Padding
- Farbcodierung beibehalten: Gruen (valid), Rot (expired), Transparent/Dashed (not_earned)

### 4 Standard-Zertifikate bei Org-Erstellung
- Bei jeder neuen Organisation werden automatisch 4 Zertifikat-Typen angelegt:
  1. Teamer:innen Card
  2. JuLeiCa
  3. Rettungsschwimmer
  4. Erste Hilfe
- Pattern wie bei Default-Badges (organizations.js Zeile 222-262)
- Einfuegen in der Org-Erstellung Route (POST /organizations)
- Auch bestehende Organisationen brauchen die Standards — Migration oder Seed-Check

### Claude's Discretion
- Genaue CSS Grid-Werte (gap, padding, card-hoehe)
- Ob Titel abgekuerzt oder umgebrochen werden
- Icons fuer die 4 Standard-Zertifikate
- Ob der "X/Y ERHALTEN" Chip oben rechts bleibt oder angepasst wird

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Teamer Dashboard
- `frontend/src/components/teamer/pages/TeamerDashboardPage.tsx` — Zertifikat-Sektion (Zeile 344-420), Certificate Interface, Popover

### Org-Erstellung (Badge-Seed Pattern)
- `backend/routes/organizations.js` — Default Badges bei Org-Erstellung (Zeile 222-262) — gleiches Pattern fuer Zertifikate

### Zertifikate Backend
- `backend/routes/chat.js` oder relevante Zertifikate-Route — Zertifikat-Typen CRUD

No external specs — requirements fully captured in decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Default-Badge-Seed in organizations.js (Zeile 222-262) — Pattern fuer Zertifikat-Seed
- Certificate Interface in TeamerDashboardPage (Zeile 92) — wiederverwendbar
- Zertifikat-Popover existiert bereits — bleibt erhalten

### Established Patterns
- CSS Grid: `display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px`
- Dashboard-Sections: gradient background, glass-chip, bg-text Labels
- Org-Erstellung: Transaktionale Badge-Insertion in POST /organizations

### Integration Points
- TeamerDashboardPage: Zertifikat-Sektion umbauen (Scroll -> Grid)
- organizations.js: Zertifikat-Seed nach Badge-Seed einfuegen
- Migration/Seed fuer bestehende Orgs ohne Standard-Zertifikate

</code_context>

<specifics>
## Specific Ideas

- 2x2 ist der Standard-Case fuer die 4 Kern-Zertifikate
- Bei mehr Zertifikaten einfach weitere Reihen — kein Scroll, kein Limit
- Kompakt heisst: weniger Padding, kleinere Icons, kuerzere Texte

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 54-teamer-dashboard-zertifikat-ansicht-anpassen*
*Context gathered: 2026-03-19*
