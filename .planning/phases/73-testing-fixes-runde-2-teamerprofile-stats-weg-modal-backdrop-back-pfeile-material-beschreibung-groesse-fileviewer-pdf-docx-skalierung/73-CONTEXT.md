# Phase 73: Testing-Fixes Runde 2 - Context

**Gathered:** 2026-03-22
**Status:** Ready for planning

<domain>
## Phase Boundary

5 Bugs aus dem Teamer-Testing: Stats in falscher Position, Modal-Backdrop, Back-Pfeile, Material-Beschreibung, FileViewer PDF/DOCX.

</domain>

<decisions>
## Implementation Decisions

### Bug 1: TeamerProfilePage — unerwuenschte Stats entfernen
- **D-01:** Phase 71 hat Stats in die TeamerProfilePage eingefuegt — die sollen WEG
- **D-02:** Die Stats gehoeren in den SectionHeader der KonfiPointHistory (TeamerKonfiStatsPage), nicht ins Profil
- **D-03:** TeamerKonfiStatsPage SectionHeader soll Stats in 2 Reihen zeigen, gleiche Hoehe/Breite wie EventDetailView SectionHeader

### Bug 2: Teamer Einstellungen — Modale backdroppen nicht
- **D-04:** TeamerProfilePage hat presentingElement — aber moeglicherweise ist der Wert null/undefined bei Aufruf
- **D-05:** Pruefe ob useModalPage korrekt den pageRef liefert und ob presentingElement zum Zeitpunkt des Modal-Oeffnens gesetzt ist

### Bug 3: Back-Pfeile fehlen bei Badges + KonfiStats
- **D-06:** IonBackButton ist im Code (Zeile 382 / 248) — aber zeigt moeglicherweise keinen Pfeil auf iOS
- **D-07:** Fix: IonBackButton durch manuellen arrowBack-Button ersetzen (wie Admin-Unterseiten Pattern: arrowBack Icon + window.history.back())
- **D-08:** Das ist zuverlaessiger als IonBackButton das von der Ionic Router History abhaengt

### Bug 4: Material-Beschreibung zu klein
- **D-09:** Die app-description-text CSS-Klasse existiert (Phase 70 Audit), aber wird moeglicherweise nicht ueberall angewendet
- **D-10:** Pruefe TeamerMaterialDetailPage UND MaterialFormModal — beide brauchen app-description-text
- **D-11:** Gleiche Schriftgroesse wie Event-Beschreibung: 0.95rem, line-height 1.5, padding 0 4px

### Bug 5: FileViewer — PDF/DOCX zu gross, kein Zoom, keine Skalierung
- **D-12:** PDFs werden aktuell in iframe gerendert — auf iOS funktioniert das schlecht (kein Zoom, schlechte Skalierung)
- **D-13:** DOCX faellt auf Fallback zurueck (Download-Button) — kein Inline-Viewer moeglich
- **D-14:** Loesung fuer PDF: Capacitor Browser Plugin oder @capacitor-community/file-opener nutzen statt iframe
- **D-15:** FileOpener ist bereits installiert (@capacitor-community/file-opener ^7.0.1) — PDF nativ oeffnen
- **D-16:** Auf iOS: FileOpener oeffnet PDF in nativem Quick Look mit Zoom/Pan/Skalierung
- **D-17:** Auf Web: iframe beibehalten (funktioniert im Browser)
- **D-18:** DOCX: Auch per FileOpener oeffnen — iOS oeffnet in Quick Look, Android in installierter App

### Claude's Discretion
- Genaue CSS-Werte fuer SectionHeader Stats 2-Reihen Layout
- Ob arrowBack als IonIcon oder als IonBackButton-Replacement besser ist
- FileOpener Fallback wenn kein nativer Viewer verfuegbar

</decisions>

<canonical_refs>
## Canonical References

### Betroffene Dateien
- `frontend/src/components/teamer/pages/TeamerProfilePage.tsx` — Bugs 1, 2
- `frontend/src/components/teamer/pages/TeamerKonfiStatsPage.tsx` — Bugs 1, 3
- `frontend/src/components/teamer/pages/TeamerBadgesPage.tsx` — Bug 3
- `frontend/src/components/teamer/pages/TeamerMaterialDetailPage.tsx` — Bug 4
- `frontend/src/components/admin/modals/MaterialFormModal.tsx` — Bug 4
- `frontend/src/components/shared/FileViewerModal.tsx` — Bug 5

### Referenz
- Admin-Unterseiten Pattern: arrowBack + window.history.back() (CLAUDE.md Memory)
- EventDetailView SectionHeader als Stats-Referenz
- @capacitor-community/file-opener (bereits installiert)

</canonical_refs>

<code_context>
## Existing Code Insights

### Back-Button Pattern (Admin)
Admin-Unterseiten nutzen: `<IonButton onClick={() => window.history.back()}><IonIcon icon={arrowBack} /></IonButton>` statt IonBackButton

### FileOpener
Bereits in TeamerMaterialPage und MaterialFormModal importiert — kann direkt fuer PDF/DOCX genutzt werden

### app-description-text CSS
Bereits definiert in variables.css: font-size 0.95rem, line-height 1.5, padding 0 4px

</code_context>

<specifics>
## Specific Ideas

No specific requirements.

</specifics>

<deferred>
## Deferred Ideas

None.

</deferred>

---

*Phase: 73-testing-fixes-runde-2*
*Context gathered: 2026-03-22*
