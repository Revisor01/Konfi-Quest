# Phase 6: Modal-Konsistenz - Context

**Gathered:** 2026-03-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Jedes Modal in der App auf useIonModal umstellen, konsistente Formular-Inputs mit Section-Headern sicherstellen und iOS Card-Modal-Backdrop-Effekt korrekt setzen. Alle isOpen-Patterns (Modal, Alert, Popover) werden auf Hook-Varianten migriert. Alle 28 Modals (14 Admin, 7 Konfi, 7 Chat) werden auf einheitliches Layout angeglichen.

</domain>

<decisions>
## Implementation Decisions

### Chat-Modal Umstellung
- useIonModal im Parent (ChatOverview) -- gleich wie Admin-Modals
- SimpleCreateChatModal: Nur isOpen -> useIonModal umstellen, interne Logik (Sub-Ansichten, Duplicate-Alert) beibehalten
- Close-Mechanismus: X-Button + Swipe-Down bei allen Modals
- Nach erfolgreicher Chat-Erstellung: Modal schliesst und navigiert direkt in den neuen Chat-Room
- ChatOptionsModal und PollModal werden ebenfalls auf das einheitliche Layout angeglichen (sind bereits useIonModal)

### isOpen-Bereinigung -- Vollstaendiger Scope
- ALLE isOpen-Patterns werden umgestellt: IonModal -> useIonModal, IonAlert -> useIonAlert, IonPopover -> useIonPopover
- Betrifft: GroupChatModal, DirectMessageModal, CreateChatModal, SimpleCreateChatModal, MembersModal (Alert), BadgesView (Modal->Popover), DashboardView (Popovers), KonfiDetailView (Alert)
- BadgesView Badge-Details: Von IonModal auf IonPopover umbauen -- passend zum Dashboard-Popover-Design
  - Erreichte Badges: Volle Beschreibung im Popover
  - Nicht erreichte / geheime Badges: Eingeschraenkte Info ("geheim", keine Beschreibung)

### Modal-Layout Struktur
- Modal-Header: Standard IonToolbar (Titel + X-Button, KEIN farbiges Icon-Branding im Header)
- Formular-Sektionen: Farbiger Icon-Kreis + Sektions-Titel (z.B. Kalender-Icon im roten Kreis + "Datum & Uhrzeit")
- Section-Header mit Icon-Kreis in ALLEN Modals die Sektionen haben
- Inputs in IonList + IonItem gewrappt (Standard Ionic Pattern)
- Globale ListSection/ListItem-Patterns in Modals nutzen
- Corner-Badges auf Farb-Konsistenz pruefen (z.B. Bonus+Gottesdienst/Gemeinde-Zuordnung)

### Domain-Farben fuer Modal-Sektionen
- Events-Modals (EventModal, ParticipantManagement): Rot (#dc2626)
- Aktivitaeten/Antraege-Modals (ActivityModal, ActivityManagement, ActivityRequest): Gruen (#059669)
- Badges-Modals (BadgeManagement): Orange (#f59e0b)
- Konfi-Modals (KonfiModal, EditProfile, PointsHistory, RequestDetail, Unregister, ChangeEmail/Password konfi): Lila (#5b21b6)
- Settings/User-Modals (UserManagement, ChangeEmail/Password/RoleTitle admin, LevelManagement, OrganizationManagement): Blau (#667eea)
- Chat-Modals (GroupChat, DirectMessage, CreateChat, SimpleCreateChat, ChatOptions, Poll, Members): Tuerkis (bestehendes Chat-Tuerkis beibehalten)
- WICHTIG: Alle Icon-Kreise INNERHALB eines Modals nutzen die EINE Domain-Farbe, NICHT gemischte Icon-Farben (sonst wird es zu bunt)

### Formular-Konsistenz
- Pattern-konsistent mit EventModal als Referenz (gleiche CSS-Klassen/Patterns, aber individuelle Anpassungen erlaubt)
- NICHT pixel-genau identisch, sondern gleiche visuelle Sprache

### CSS-Klassen
- Neue Modal-spezifische CSS-Klassen erstellen: app-modal-section, app-modal-section-header, app-modal-footer etc.
- NICHT die View-Klassen (app-info-row etc.) in Modals wiederverwenden -- klare Trennung

### iOS Card-Modal
- Presenting Element: Claude waehlt die technisch beste Loesung (pageRef vs. IonRouterOutlet)
- Verschachtelte Modals: Card-Stack-Effekt (zweites Modal schiebt sich ueber das erste)
- Swipe-to-Dismiss Schutz bei Formularen mit ungespeicherten Aenderungen
- Schutz-Dialog: Standard IonAlert mit "Abbrechen" / "Verwerfen"
- Ionic kuemmert sich automatisch um Android-Kompatibilitaet (plattform-typische Animation)

### Angleichung aller Modals
- ALLE 28 Modals werden angeglichen, auch die bereits auf useIonModal sind
- Admin-Modals (14): einheitliches Layout (Section-Header mit Domain-Farbe, CSS-Klassen, konsistente Inputs)
- Konfi-Modals (7): gleiches Pattern
- Chat-Modals (7): gleiches Pattern

### Claude's Discretion
- Presenting Element technische Loesung (pageRef vs. IonRouterOutlet)
- Exakte CSS-Klassen-Benennung und Struktur (app-modal-*)
- Welche Modals Unsaved-Changes-Schutz brauchen (alle Formular-Modals mit Eingaben)
- Reihenfolge der Umstellung (Chat zuerst wegen isOpen, oder alle parallel)
- BonusModal Domain-Farbe (Konfi-Lila oder eigene Farbe)

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `useIonModal`: Bereits in 20+ Dateien korrekt verwendet -- Pattern ist etabliert
- `SectionHeader` Komponente: Fuer Views, NICHT fuer Modals (Modals bekommen eigene Section-Header CSS)
- `ListSection` Komponente: Kann in Modals wiederverwendet werden
- CSS-Klassen aus Phase 4/5: app-icon-color--, app-stepper, app-avatar-initials, app-settings-item
- `EventModal` (admin): Referenz-Implementation fuer Formular-Layout
- Dashboard Popovers: Referenz fuer Badge-Detail-Popover Design

### Established Patterns
- Admin-Pages oeffnen Modals via `const [present, dismiss] = useIonModal(Component, { onClose, onSuccess })`
- presentingElement wird in Admin-Pages bereits korrekt gesetzt (ueber pageRef)
- Chat-Modals nutzen noch altes Pattern: `<IonModal isOpen={isOpen}>` mit Props
- IonList + IonItem fuer Formular-Inputs ist Standard-Ionic-Pattern

### Integration Points
- ChatOverview.tsx: Hier muessen die Chat-Modal useIonModal-Aufrufe hin
- variables.css: Neue app-modal-* CSS-Klassen
- Alle 28 Modal-Dateien werden angefasst

### Aktuelle isOpen-Bestandsaufnahme
| Datei | isOpen-Typ | Aktion |
|-------|-----------|--------|
| GroupChatModal.tsx | IonModal | -> useIonModal |
| DirectMessageModal.tsx | IonModal | -> useIonModal |
| CreateChatModal.tsx | IonModal | -> useIonModal |
| SimpleCreateChatModal.tsx | IonModal (+ Alert) | -> useIonModal + useIonAlert |
| MembersModal.tsx | IonAlert | -> useIonAlert |
| BadgesView.tsx | IonModal | -> useIonPopover (Redesign) |
| DashboardView.tsx | IonPopover (x2) | -> useIonPopover |
| KonfiDetailView.tsx | IonAlert | -> useIonAlert |

</code_context>

<specifics>
## Specific Ideas

- Badge-Popover soll dem Dashboard-Popover-Design folgen: kompakt, mit Status (erreicht/geheim/nicht erreicht)
- Corner-Badges bei Konfi-Punkten: Bonus und Event klar benannt, dahinter Gemeinde/Gottesdienst-Zuordnung anzeigen
- Chat-Modals nach Erstellung: Direkt in den neuen Chat navigieren, nicht Toast zeigen
- Icon-Kreise in Sektionen: EINE Domain-Farbe pro Modal, nicht bunt gemischt
- "Wird sonst zu bunt" -- Konsistenz und Ruhe im Design wichtiger als semantische Differenzierung

</specifics>

<deferred>
## Deferred Ideas

None -- Diskussion blieb im Phase-Scope.

</deferred>

---

*Phase: 06-modal-konsistenz*
*Context gathered: 2026-03-02*
