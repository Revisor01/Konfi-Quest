# Phase 71: Teamer+Badge Polish - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

11 Issues aus dem Teamer/Badge Testing. Profil-Modale, Badge-Anzeige, Zurueck-Buttons, Listen-Padding, Dashboard-Badges, Jahres-Badge-Logik, Zertifikat-Karten, Stats-Header.

</domain>

<decisions>
## Implementation Decisions

### Issue 1: Teamer Profil — 3 Modale ohne iOS Backdrop
- **D-01:** ChangePasswordModal, ChangeEmailModal, ChangeRoleTitleModal werden via useIonModal praesentiert — presentingElement muss uebergeben werden
- **D-02:** Pruefe TeamerProfilePage.tsx wo die Modals geoeffnet werden und fuege presentingElement hinzu

### Issue 2: Teamer Badges — Zurueck-Button fehlt
- **D-03:** TeamerBadgesPage braucht einen Zurueck-Button im Header (IonBackButton oder arrowBack-Icon + onBack)
- **D-04:** Pattern: arrowBack Icon in IonButtons slot="start" + window.history.back()

### Issue 3: Teamer Badges — Nur 2 von 6 angezeigt
- **D-05:** Backend oder Frontend filtert Teamer-Badges falsch — muss debuggt werden
- **D-06:** Pruefe GET /teamer/badges Endpoint und TeamerBadgesPage/TeamerBadgesView Filterlogik

### Issue 4: Konfi History — Zurueck-Pfeil fehlt
- **D-07:** TeamerKonfiStatsPage braucht Zurueck-Button wie Issue 2

### Issue 5: Badge-Grid — Feste Breite, Name mit ... kuerzen
- **D-08:** Badge-Karten im Grid sollen alle gleich breit sein (33.33% minus Gap)
- **D-09:** Badge-Name: `text-overflow: ellipsis; overflow: hidden; white-space: nowrap`
- **D-10:** 3 Badges pro Reihe, feste Breite, nicht vom Namen abhaengig

### Issue 6: Geheime Badges anzeigen
- **D-11:** Geheime Badges die noch nicht verdient sind: Als graue Kreise mit Fragezeichen anzeigen
- **D-12:** Geheime Badges die verdient sind: Normal anzeigen (nicht mehr versteckt)
- **D-13:** Segment "Sichtbar" / "Geheim" wenn es geheime Badges gibt

### Issue 7: Punkte-Stats wie andere SectionHeaders
- **D-14:** TeamerProfilePage Punkte-Uebersicht: SectionHeader mit Stats in 2 Reihen (wie z.B. EventDetailView Stats)
- **D-15:** Stats-Reihe mit den gleichen CSS-Klassen wie andere Header (app-stats-row)

### Issue 8: Listen-Padding fuer Corner-Badges
- **D-16:** Globales CSS: app-list-item__title und app-icon-circle bekommen padding-top: 4px
- **D-17:** Damit Corner-Badges nicht ueber dem Titel/Icon stehen

### Issue 9: Dashboard Badges wie Konfi
- **D-18:** Teamer-Dashboard Badge-Sektion: Graue Kreise fuer nicht verdiente Badges (wie Konfi-Dashboard)
- **D-19:** Unterscheidung sichtbar/geheim: Geheime Badges als Fragezeichen-Kreise, nur wenn es geheime gibt
- **D-20:** Referenz: KonfiDashboardPage Badge-Sektion

### Issue 10: Jahres-Badge Luecken erlauben
- **D-21:** Backend badges.js: years_active Berechnung muss Luecken erlauben
- **D-22:** Beispiel: Teamer aktiv in Jahr 1 und 3 (nicht 2) → bekommt "1 Jahr aktiv" und "3 Jahre aktiv", NICHT "2 Jahre aktiv"
- **D-23:** Zaehlung: Nur Jahre mit mindestens 1 Aktivitaet oder Event zaehlen, inaktive Jahre ueberspringen

### Issue 11: Zertifikat-Karten gleiche Groesse
- **D-24:** Zertifikat-Karten im Grid sollen alle gleich gross sein, auch wenn kein Datum vorhanden
- **D-25:** min-height oder feste Hoehe setzen, als ob Datum-Zeile immer vorhanden waere

### Claude's Discretion
- Genaue CSS-Werte fuer Badge-Grid Breiten
- Genauer Fix fuer den Badge-Filter-Bug (muss Code analysiert werden)
- Genaue min-height fuer Zertifikat-Karten

</decisions>

<canonical_refs>
## Canonical References

### Betroffene Dateien
- `frontend/src/components/teamer/pages/TeamerProfilePage.tsx` — Issues 1, 7
- `frontend/src/components/teamer/pages/TeamerBadgesPage.tsx` — Issues 2, 3
- `frontend/src/components/teamer/views/TeamerBadgesView.tsx` — Issues 3, 5, 6
- `frontend/src/components/teamer/pages/TeamerKonfiStatsPage.tsx` — Issue 4
- `frontend/src/components/teamer/pages/TeamerDashboardPage.tsx` — Issues 9, 11
- `frontend/src/components/konfi/views/BadgesView.tsx` — Issues 5, 6 (Referenz)
- `frontend/src/theme/variables.css` — Issues 8, 5
- `backend/routes/badges.js` — Issue 10
- `backend/routes/teamer.js` — Issue 3

### Referenz-Implementierungen
- `frontend/src/components/konfi/pages/KonfiDashboardPage.tsx` — Badge-Sektion mit grauen Kreisen (Issue 9 Referenz)
- `frontend/src/components/konfi/views/BadgesView.tsx` — Badge-Grid Layout (Issue 5 Referenz)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- Konfi BadgesView hat bereits Badge-Grid mit grauen Kreisen — Pattern fuer Teamer uebernehmen
- SectionHeader mit Stats-Row existiert bereits — nur CSS-Klassen anwenden
- arrowBack + window.history.back() Pattern fuer Zurueck-Buttons

### Established Patterns
- useIonModal mit presentingElement fuer iOS Backdrop
- Badge-Grid in BadgesView.tsx als Referenz
- Listen-Items nutzen app-list-item CSS-Klassen

</code_context>

<specifics>
## Specific Ideas

- Badge-Grid soll wie bei Konfis aussehen — gleiche Breite, gleiche Hoehe, Name mit ... kuerzen
- Dashboard-Badges sollen 1:1 wie bei Konfis sein (graue Kreise, geheim/sichtbar Segment)
- Jahres-Badge darf Luecken haben — nicht konsekutiv zaehlen

</specifics>

<deferred>
## Deferred Ideas

None — all 11 issues are in scope.

</deferred>

---

*Phase: 71-teamer-badge-polish*
*Context gathered: 2026-03-22*
