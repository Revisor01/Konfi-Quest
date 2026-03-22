# Phase 72: UI-Testing Fixes - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

5 Issues aus dem Testing: Material-Suchleiste, Event-Suche, Teamer-Chat Konfi-Zugriff, Teamer-Cache Luecken, Offline-Button Icon.

</domain>

<decisions>
## Implementation Decisions

### Issue 1: Material-Suchleiste zu klein
- **D-01:** TeamerMaterialPage IonSearchbar hat andere Groesse als Chat-Suchleiste
- **D-02:** Fix: ios26-searchbar-classic Klasse hinzufuegen (wie bei Chat), oder Sizing-CSS angleichen

### Issue 2: Event-Suche+Filter
- **D-03:** Events-Pages (Konfi + Teamer + Admin) brauchen eine IonSearchbar zum Filtern nach Event-Name
- **D-04:** Clientseitiges Filtern (Events sind schon alle geladen via useOfflineQuery)
- **D-05:** Searchbar mit ios26-searchbar-classic Klasse, placeholder "Events durchsuchen"

### Issue 3: Teamer-Chat — DirectMessageModal nutzt /admin/konfis (403)
- **D-06:** ROOT CAUSE: DirectMessageModal.tsx Zeile 50 ruft `api.get('/admin/konfis')` auf — Teamer hat keinen Zugriff
- **D-07:** FIX: Fuer Teamer einen eigenen Endpoint nutzen oder den bestehenden /admin/konfis auch fuer Teamer erlauben
- **D-08:** Empfehlung: Backend `/admin/konfis` Route auch fuer role 'teamer' erlauben (requireAdmin statt requireOrgAdmin) — Teamer sehen nur Konfis ihres eigenen Jahrgangs
- **D-09:** ODER: Neuer Endpoint GET /teamer/konfis der nur Konfis der zugewiesenen Jahrgaenge zurueckgibt
- **D-10:** Sicherer ist ein eigener Teamer-Endpoint — Teamer soll nicht die volle Admin-Konfi-Liste bekommen

### Issue 4: Teamer-Cache Luecken
- **D-11:** Chat-Rooms werden vom ChatOverview geladen — pruefe ob useOfflineQuery dort korrekt ist
- **D-12:** Material-Details (TeamerMaterialDetailPage) — pruefe ob useOfflineQuery dort korrekt ist
- **D-13:** Punkte-Uebersicht (TeamerKonfiStatsPage) — pruefe ob useOfflineQuery dort korrekt ist
- **D-14:** Alle drei wurden in Phase 56 migriert — moeglicherweise fehlt der erste Online-Aufruf (Cache leer weil Page noch nie besucht)

### Issue 5: Offline-Button Icon
- **D-15:** Statt nur Text "Du bist offline" + disabled → zusaetzlich cloudOfflineOutline Icon VOR dem Text
- **D-16:** Pattern: `<IonButton disabled><IonIcon icon={cloudOfflineOutline} slot="start" /> Du bist offline</IonButton>`
- **D-17:** In ALLEN Modals/Pages wo der "Du bist offline" Text steht (Phase 59 Pattern)

### Claude's Discretion
- Ob ein neuer /teamer/konfis Endpoint oder Erweiterung von /admin/konfis besser ist
- Genaue Event-Suchleiste Position (ueber der Liste oder im Header)
- Welche Pages genau den Offline-Icon-Fix brauchen (systematisch per grep)

</decisions>

<canonical_refs>
## Canonical References

### Betroffene Dateien
- `frontend/src/components/teamer/pages/TeamerMaterialPage.tsx` — Issue 1 (Suchleiste)
- `frontend/src/components/konfi/pages/KonfiEventsPage.tsx` — Issue 2 (Event-Suche)
- `frontend/src/components/teamer/pages/TeamerEventsPage.tsx` — Issue 2
- `frontend/src/components/admin/pages/AdminEventsPage.tsx` — Issue 2
- `frontend/src/components/chat/modals/DirectMessageModal.tsx` — Issue 3 (Zeile 50)
- `backend/routes/teamer.js` — Issue 3 (neuer Endpoint)
- `frontend/src/components/chat/ChatOverview.tsx` — Issue 4 (Cache)
- `frontend/src/components/teamer/pages/TeamerMaterialDetailPage.tsx` — Issue 4
- `frontend/src/components/teamer/pages/TeamerKonfiStatsPage.tsx` — Issue 4
- Alle Modals/Pages mit "Du bist offline" — Issue 5

</canonical_refs>

<code_context>
## Existing Code Insights

### Root Cause Issue 3
DirectMessageModal.tsx Zeile 50: `api.get('/admin/konfis')` — Backend RBAC blockiert Teamer.
Backend routes/konfi-managment.js hat requireAdmin Middleware auf GET /admin/konfis.

### Reusable Assets
- ios26-searchbar-classic CSS-Klasse (bereits bei Chat IonSearchbar)
- useOfflineQuery (Phase 56) — fuer Cache-Pruefung
- cloudOfflineOutline Icon aus ionicons

</code_context>

<specifics>
## Specific Ideas

No specific requirements beyond the 5 testing issues.

</specifics>

<deferred>
## Deferred Ideas

None.

</deferred>

---

*Phase: 72-ui-testing-fixes*
*Context gathered: 2026-03-22*
