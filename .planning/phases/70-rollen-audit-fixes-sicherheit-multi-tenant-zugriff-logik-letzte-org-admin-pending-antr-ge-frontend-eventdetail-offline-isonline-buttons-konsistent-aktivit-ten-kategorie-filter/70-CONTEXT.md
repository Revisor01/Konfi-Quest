# Phase 70: Rollen-Audit Fixes - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

Fixes aus dem Rollen-Audit: 2 Sicherheits-Fixes (Multi-Tenant bonus-points, Org-Users Zugriff), 2 Logik-Fixes (letzte org_admin, pending Antraege), 3 Frontend-Fixes (EventDetail offline, isOnline-Buttons konsistent, Aktivitaeten-Kategorie-Filter).

WICHTIG: Die Agents haben bereits teilweise an konfi-managment.js (S1) und users.js (L1) gearbeitet. Diese Aenderungen sind UNSTAGED im Working Tree. Der Planner muss diese pruefen und ggf. korrigieren oder committen.

</domain>

<decisions>
## Implementation Decisions

### S1: Multi-Tenant bonus-points DELETE
- **D-01:** In konfi-managment.js DELETE bonus-points Route: Query muss organization_id via JOIN mit users-Tabelle pruefen
- **D-02:** TEILWEISE BEREITS IMPLEMENTIERT (unstaged) — muss verifiziert werden

### S2: Organizations User-Liste Zugriffspruefung
- **D-03:** In organizations.js GET /:id/users: isOwnOrg muss AUCH role_name === 'org_admin' pruefen, nicht nur organization_id Match
- **D-04:** Aktuell prueft die Route nur `req.user.organization_id === parseInt(req.params.id)` ohne Rollen-Check

### L1: Letzte org_admin nicht loeschbar
- **D-05:** In users.js DELETE /:id: Vor dem Loeschen pruefen ob der zu loeschende User ein org_admin ist UND ob er der letzte in der Organisation ist
- **D-06:** TEILWEISE BEREITS IMPLEMENTIERT (unstaged) — muss verifiziert werden
- **D-07:** Fehlermeldung: "Letzter Org-Admin kann nicht geloescht werden"

### L2: Aktivitaet mit pending Antraegen nicht loeschbar
- **D-08:** In activities.js DELETE /:id: Zusaetzlich zu bestehender user_activities Pruefung auch activity_requests mit status='pending' pruefen
- **D-09:** Fehlermeldung: "Aktivitaet kann nicht geloescht werden: X offene Antraege vorhanden."

### L5: Konfi EventDetailView auf useOfflineQuery
- **D-10:** Die Konfi EventDetailView (frontend/src/components/konfi/views/EventDetailView.tsx) laedt Event-Daten direkt via api.get() — muss auf useOfflineQuery migriert werden
- **D-11:** Nur die Haupt-Event-Daten cachen, nicht Timeslots/Participants (die aendern sich zu oft)
- **D-12:** Cache-Key: `konfi:event-detail:${eventId}`, TTL: 10 Minuten

### L6: Silent isOnline-Returns durch "Du bist offline" Buttons ersetzen
- **D-13:** Ueberall wo `if (!isOnline) return;` in Action-Handlern steht, muss der zugehoerige Button stattdessen disabled={!isOnline} sein mit Text "Du bist offline"
- **D-14:** Das ist das gleiche Pattern wie Phase 59 (OOA) — diesmal fuer Stellen die damals uebersehen wurden
- **D-15:** KEIN Toast, KEIN Alert — nur Button-Text und disabled wie in Phase 59

### F3: Aktivitaeten-Kategorie-Filter im ActivityRequestModal
- **D-16:** IonSegment oben im Modal mit "Alle" + Kategorie-Namen
- **D-17:** Filter clientseitig (Aktivitaeten sind schon alle geladen)
- **D-18:** Default-Segment: "Alle"

### Claude's Discretion
- Genaue Implementierung der Kategorie-Extraktion aus der Aktivitaeten-Liste
- Segment-Styling (Section-Farbe Activities gruen #047857)

</decisions>

<canonical_refs>
## Canonical References

### Bereits teilweise geaenderte Dateien (UNSTAGED — pruefen!)
- `backend/routes/konfi-managment.js` — S1 Fix teilweise implementiert
- `backend/routes/users.js` — L1 Fix teilweise implementiert

### Backend zu aendern
- `backend/routes/organizations.js` — S2 Fix
- `backend/routes/activities.js` — L2 Fix

### Frontend zu aendern
- `frontend/src/components/konfi/views/EventDetailView.tsx` — L5 useOfflineQuery Migration
- `frontend/src/components/konfi/pages/KonfiRequestsPage.tsx` — L6 isOnline Button Pattern
- `frontend/src/components/konfi/modals/ActivityRequestModal.tsx` — F3 Kategorie-Filter

### Referenz-Pattern
- Phase 59 OOA-Pattern: `disabled={!isOnline}` + "Du bist offline" auf Buttons
- Phase 56 useOfflineQuery Pattern: `useOfflineQuery(key, fetcher, { ttl })`

</canonical_refs>

<code_context>
## Existing Code Insights

### Unstaged Changes
- konfi-managment.js: S1 Fix (org_id JOIN) — muss verifiziert werden
- users.js: L1 Fix (letzte org_admin Check) — muss verifiziert werden
- Beide wurden von abgebrochenen Agents geschrieben und muessen geprueft werden!

### Reusable Assets
- useOfflineQuery Hook (Phase 56) — fuer L5
- isOnline aus useApp() (Phase 55) — fuer L6
- IonSegment Pattern — bereits in vielen Views vorhanden

</code_context>

<specifics>
## Specific Ideas

No specific requirements beyond audit findings.

</specifics>

<deferred>
## Deferred Ideas

- F1 (Teamer-Uebersichtsseite) — Admin hat Teamer unter Users, reicht erstmal
- F2 (Anwesenheitsstatistik in Uebersicht) — eigene Diskussion noetig
- F4 (Teamer-Stats im Profil) — nicht noetig, Dashboard zeigt alles

</deferred>

---

*Phase: 70-rollen-audit-fixes*
*Context gathered: 2026-03-21*
