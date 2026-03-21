# Phase 61: Admin- + Teamer-Queue - Context

**Gathered:** 2026-03-21
**Status:** Ready for planning

<domain>
## Phase Boundary

21 Admin-Aktionen und 2 Teamer-Aktionen queue-faehig machen. Gleiches writeQueue-Pattern wie Phase 60 — enqueue bei offline, Optimistic UI mit Corner-Badge Uhr-Icon, automatischer Flush bei Reconnect/Resume. Material mit Dateien: Metadaten sofort, Datei-Upload im Vordergrund.

</domain>

<decisions>
## Implementation Decisions

### Claude's Discretion
All implementation choices are at Claude's discretion — infrastructure phase. Gleiches Pattern wie Phase 60.

Key guidelines:
- writeQueue.enqueue() fuer alle 23 Aktionen wenn offline
- Optimistic UI: Element sofort in Liste anzeigen mit queueStatus 'pending'
- Corner-Badge Uhr-Icon (app-corner-badge--queue) an gequeuten Elementen — CSS aus Phase 58
- Material mit Dateien: resolveLocalFile Pattern aus writeQueue.ts nutzen
- client_id UUID fuer Idempotenz wo anwendbar
- Teamer Event buchen/abmelden: writeQueue + Uhr am Event

### Aktionen nach Modal/Page gruppiert
- EventModal: Event erstellen (einzeln + Serie), Event bearbeiten — QUE-A01..03
- ActivityManagementModal: Aktivitaet erstellen/bearbeiten — QUE-A04..05
- BadgeManagementModal: Badge erstellen/bearbeiten — QUE-A06..07
- AdminCategoriesPage: Kategorie erstellen/bearbeiten — QUE-A08..09
- AdminJahrgaengePage: Jahrgang erstellen/bearbeiten — QUE-A10..11
- LevelManagementModal: Level erstellen/bearbeiten — QUE-A12..13
- AdminCertificatesPage: Zertifikat-Typ erstellen/bearbeiten — QUE-A14..15
- MaterialFormModal: Material erstellen/bearbeiten (mit Dateien) — QUE-A16..17
- ActivityRequestModal (Admin): Antrag genehmigen/ablehnen — QUE-A18
- ActivityRequestModal (Admin): Antrag zuruecksetzen — QUE-A19
- BonusModal: Bonus-Punkte vergeben — QUE-A20
- ActivityModal: Aktivitaet zuweisen — QUE-A21
- TeamerEventsPage: Event buchen/abmelden — QUE-T01..02

</decisions>

<canonical_refs>
## Canonical References

### Phase 60 Artefakte (Pattern-Vorlage)
- `frontend/src/services/writeQueue.ts` — enqueue/flush/resolveLocalFile (bereits implementiert)
- `frontend/src/components/chat/ChatRoom.tsx` — Referenz fuer Queue-Integration in sendMessage
- `frontend/src/components/konfi/modals/ActivityRequestModal.tsx` — Referenz fuer Modal-Queue-Integration

### Betroffene Dateien
- `frontend/src/components/admin/modals/EventModal.tsx`
- `frontend/src/components/admin/modals/ActivityManagementModal.tsx`
- `frontend/src/components/admin/modals/BadgeManagementModal.tsx`
- `frontend/src/components/admin/modals/LevelManagementModal.tsx`
- `frontend/src/components/admin/modals/MaterialFormModal.tsx`
- `frontend/src/components/admin/modals/ActivityRequestModal.tsx`
- `frontend/src/components/admin/modals/BonusModal.tsx`
- `frontend/src/components/admin/modals/ActivityModal.tsx`
- `frontend/src/components/admin/pages/AdminCategoriesPage.tsx`
- `frontend/src/components/admin/pages/AdminJahrgaengeePage.tsx`
- `frontend/src/components/admin/pages/AdminCertificatesPage.tsx`
- `frontend/src/components/teamer/pages/TeamerEventsPage.tsx`

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- writeQueue.enqueue() — direkt nutzbar
- networkMonitor.isOnline — bereits in allen Modals via useApp() verfuegbar (Phase 59)
- useActionGuard — bereits in allen Modals (Phase 57), kann mit Queue-Logik kombiniert werden
- resolveLocalFile() in writeQueue.ts — fuer Material-Datei-Uploads

### Established Patterns
- Phase 60 Chat-Queue: `if (!networkMonitor.isOnline) { writeQueue.enqueue(...); return; }`
- Phase 60 Aktivitaets-Queue: Gleiches Pattern mit Optimistic UI
- Alle Modals haben bereits `isOnline` Check (Phase 59) — jetzt Queue statt "Du bist offline"

### Integration Points
- Jedes Modal/Page: Submit-Handler bekommt offline-Branch mit writeQueue.enqueue()
- Corner-Badge System (Phase 58): Uhr-Icon an gequeuten Listen-Elementen
- Die "Du bist offline" disabled-Buttons (Phase 59) werden fuer queue-faehige Aktionen ERSETZT durch Queue-Logik

</code_context>

<deferred>
## Deferred Ideas

None — straightforward pattern application.

</deferred>

---

*Phase: 61-admin-teamer-queue*
*Context gathered: 2026-03-21*
