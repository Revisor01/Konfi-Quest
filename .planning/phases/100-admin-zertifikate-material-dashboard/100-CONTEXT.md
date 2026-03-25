# Phase 100: Admin Zertifikate, Material, Dashboard - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Admin Zertifikat-Zuweisung als vollstaendiges Modal, Material-Verwaltung mit Dropdown-Popover und verbesserter Datei-Button, Dashboard-Sektionen sortierbar mit IonReorder.

</domain>

<decisions>
## Implementation Decisions

### Zertifikate (AZE-01 bis AZE-04)
- Zertifikat-Zuweisen: Neues `CertificateAssignModal` mit useIonModal statt bisherigem IonAlert
- Modal enthaelt: IonDatetimeButton fuer Start-Datum (Default: heute), IonInput fuer Laufzeit in Monaten, Radio-Selection fuer Zertifikat-Typ
- Automatisches Start-Datum: Heutiges Datum vorausgefuellt
- Gepicktes Icon wird im Modal neben dem Zertifikat-Typ angezeigt (aus bestehendem Icon-Mapping)

### Material (AMA-01 bis AMA-04)
- AMA-01: Jahrgangs-Auswahl wird IonSelect mit popover interface + Suche statt Chip-Tabs
- AMA-02: Suchleiste folgt Chat-Pattern (ios26-searchbar-classic) — bereits vorhanden, beibehalten
- AMA-03: "Ohne Event" Tab: korrekter Text pruefen und ggf. anpassen
- AMA-04: "Datei auswaehlen" Button: IonButton expand="block" fill="solid" mit --background: var(--ion-color-primary), marginTop: 16px, padding: 0 16px

### Dashboard (ADA-01 bis ADA-02)
- ADA-01: Dashboard-Reihenfolge bei Admin und Konfi gleich machen
- ADA-02: IonReorderGroup mit IonReorder auf jedem Dashboard-Widget-Toggle
- Reihenfolge wird als `section_order` JSON-Array in bestehender settings/dashboard_config gespeichert
- Neue Backend-Route: PUT /admin/dashboard-config mit section_order Array
- Konfi-Dashboard und Teamer-Dashboard lesen section_order und rendern Sektionen in dieser Reihenfolge

### Claude's Discretion
Keine — alle Entscheidungen vom User getroffen.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- useIonModal Hook fuer Modals
- Icon-Mapping in AdminCertificatesPage (45+ Icons in 9 Kategorien)
- IonDatetimeButton Pattern (aus Phase 98 in Jahrgaenge/Aktivitaeten)
- IonReorderGroup/IonReorder aus Ionic 8 (noch nicht im Projekt verwendet)
- AdminDashboardSettingsPage.tsx mit Toggle-Logik
- MaterialFormModal.tsx mit Datei-Upload

### Established Patterns
- Modal: useIonModal mit onClose/onSuccess Props
- Offline: useOfflineQuery + WriteQueue
- Lists: SectionHeader, ListSection, EmptyState
- Suche: ios26-searchbar-classic CSS-Klasse

### Integration Points
- KonfiDetailView.tsx Zeile 407-459: Bisherige IonAlert-basierte Zertifikat-Zuweisung → neues Modal
- KonfiDetailSections.tsx: CertificatesSection zeigt Zertifikate an
- AdminMaterialPage.tsx: Chip-basierte Jahrgangswahl → IonSelect Popover
- MaterialFormModal.tsx: Datei-Button-Styling
- AdminDashboardSettingsPage.tsx: Toggle-Liste → IonReorderGroup
- Backend settings Route: Dashboard-Config speichern

</code_context>

<specifics>
## Specific Ideas

- CertificateAssignModal als separate Komponente in modals/ Verzeichnis
- IonReorder erlaubt visuelles Drag-and-Drop fuer Dashboard-Sortierung
- section_order Array im Backend: ["konfirmation", "events", "losung", "badges", "ranking"]

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>
