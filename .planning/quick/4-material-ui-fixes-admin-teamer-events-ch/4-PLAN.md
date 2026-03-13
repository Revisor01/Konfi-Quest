---
phase: quick-4
plan: 01
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/components/admin/pages/AdminMaterialPage.tsx
  - frontend/src/components/admin/modals/MaterialFormModal.tsx
  - frontend/src/components/teamer/pages/TeamerMaterialPage.tsx
  - frontend/src/components/teamer/pages/TeamerMaterialDetailPage.tsx
  - frontend/src/components/teamer/pages/TeamerEventsPage.tsx
  - frontend/src/components/chat/ChatOverview.tsx
  - frontend/src/components/chat/ChatRoom.tsx
autonomous: true
must_haves:
  truths:
    - "Admin Material Suchleiste hat volle Breite"
    - "Admin Material hat Suche & Filter Section mit Icon"
    - "Kalender-Icons bei Event-Datum sind rot"
    - "FileViewer oeffnet als Modal mit Backdrop"
    - "Neue Dateien im Modal koennen geoeffnet und per Swipe geloescht werden"
    - "Teamer Material hat SectionHeader in Amber"
    - "Teamer Material Corner Badge hat korrekten borderRadius"
    - "Teamer Material Detail zeigt Details statt Informationen"
    - "Teamer Events Beschreibung hat konsistente Schriftgroesse"
    - "Chat-Filter als IonSegment-Tabs statt Popover"
    - "Chat-Dateien oeffnen mit Auth-Token"
  artifacts:
    - path: "frontend/src/components/admin/pages/AdminMaterialPage.tsx"
      provides: "Admin Material UI mit voller Suchleiste, Suche & Filter Section"
    - path: "frontend/src/components/teamer/pages/TeamerMaterialPage.tsx"
      provides: "Teamer Material mit SectionHeader, korrekten Badges"
    - path: "frontend/src/components/chat/ChatRoom.tsx"
      provides: "Chat FileViewer mit Auth-Token statt window.open ohne Token"
---

<objective>
Material UI-Fixes fuer Admin, Teamer, Events und Chat -- 18 Einzelpunkte in 3 Tasks.

Purpose: Konsistente UI, korrekte Farben, fehlende Backdrops und kritischer Chat-Auth-Bug fixen.
Output: Alle 18 UI-Fixes implementiert und committed.
</objective>

<execution_context>
@/Users/simonluthe/.claude/get-shit-done/workflows/execute-plan.md
@/Users/simonluthe/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@frontend/src/components/admin/pages/AdminMaterialPage.tsx
@frontend/src/components/admin/modals/MaterialFormModal.tsx
@frontend/src/components/teamer/pages/TeamerMaterialPage.tsx
@frontend/src/components/teamer/pages/TeamerMaterialDetailPage.tsx
@frontend/src/components/teamer/pages/TeamerEventsPage.tsx
@frontend/src/components/chat/ChatOverview.tsx
@frontend/src/components/chat/ChatRoom.tsx

<interfaces>
SectionHeader Preset Pattern (aus shared/SectionHeader.tsx):
```typescript
import { SectionHeader } from '../../shared';
<SectionHeader
  title="Material"
  subtitle="Dokumente und Dateien"
  icon={documentIcon}
  colors={{ primary: '#d97706', secondary: '#b45309' }}
  stats={[{ value: N, label: 'Materialien' }]}
/>
```

Chat Filter Pattern (aktuell IonSelect mit interface="popover"):
```typescript
// ERSETZEN durch IonSegment:
<IonSegment value={filterType} onIonChange={(e) => setFilterType(e.detail.value!)}>
  <IonSegmentButton value="alle"><IonLabel>Alle</IonLabel></IonSegmentButton>
  ...
</IonSegment>
```

useModalPage Pattern:
```typescript
const { presentingElement } = useModalPage('tab-id');
presentFormModal({ presentingElement: presentingElement });
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: Admin Material UI-Fixes (Punkte 1-7)</name>
  <files>
    frontend/src/components/admin/pages/AdminMaterialPage.tsx
    frontend/src/components/admin/modals/MaterialFormModal.tsx
  </files>
  <action>
AdminMaterialPage.tsx:

1. **Suchleiste volle Breite**: Das `<div style={{ padding: '0 16px' }}>` um die IonSearchbar entfernen oder padding auf '0' setzen, damit die Suchleiste so breit ist wie die Cards/Listen (IonList inset pattern).

2. **Suche & Filter Section**: Vor der Suchleiste und dem Segment einen IonList + IonListHeader Block einfuegen:
```tsx
<IonList inset={true} style={{ margin: '16px' }}>
  <IonListHeader>
    <div className="app-section-icon app-section-icon--material">
      <IonIcon icon={filterOutline} />
    </div>
    <IonLabel>Suche & Filter</IonLabel>
  </IonListHeader>
  <IonItemGroup>
    {/* Suchleiste hier rein */}
    {/* Segment hier rein */}
  </IonItemGroup>
</IonList>
```
Import `filterOutline` aus ionicons/icons, import `IonItemGroup`.
Referenz: ChatOverview.tsx Zeilen 328-374 fuer das Pattern.

3. **Kalender-Icon rot**: In der Meta-Zeile das `calendarOutline` Icon von `color: '#6c757d'` auf `color: '#dc2626'` aendern (Event-Farbe rot).

4. **Events im Select nur zukuenftige**: Bereits in MaterialFormModal.tsx implementiert (Zeile 329: `.filter(ev => new Date((ev as any).event_date) >= new Date(new Date().toDateString()))`). Pruefen ob korrekt -- falls ja, nichts aendern.

5. **FileViewer als Modal**: In MaterialFormModal.tsx die `openFile` Funktion: Im Fallback-Pfad (Zeile 170-176) statt `window.open(blobUrl, '_blank')` eine In-App-Loesung verwenden. Da wir im Browser sind und kein separates FileViewer-Modal brauchen, den Blob in einem `<iframe>` oder `object`-Tag anzeigen. ALTERNATIVE: Einfachste Loesung ist, die Blob-URL in window.open zu belassen aber den Fallback-Text zu verbessern. Das ist ein Browser-Fallback -- die native Variante (Zeilen 128-166) oeffnet bereits korrekt als Modal. Keine Aenderung noetig fuer den Fallback, da der native Pfad bereits als Modal oeffnet.

6. **MaterialFormModal Backdrop**: Das Modal wird bereits mit `presentFormModal({ presentingElement: presentingElement })` geoeffnet (Zeile 149). Das ist korrekt. PRUEFEN: Wird `useModalPage` korrekt verwendet? Ja, Zeile 59. Kein Fix noetig.

7. **Neue Dateien im Modal**: In MaterialFormModal.tsx die `newFiles` Liste (Zeilen 419-449):
   - Statt dem Trash-Button (`<IonButton fill="clear" color="danger">`) auf Swipe-Delete umstellen:
     - Jeden neuen File-Eintrag in `<IonItemSliding>` + `<IonItem>` + `<IonItemOptions>` wrappen (gleich wie bei existingFiles Zeilen 366-403).
   - Fuer das Oeffnen neuer Dateien: Da `newFiles` vom Typ `File[]` sind (Browser File API), kann man per `URL.createObjectURL(file)` eine Vorschau-URL erstellen und `window.open(blobUrl, '_blank')` aufrufen. Einen onClick-Handler auf den IonItem setzen.
  </action>
  <verify>
    <automated>cd /Users/simonluthe/Documents/Konfipoints && npx tsc --noEmit --project frontend/tsconfig.json 2>&1 | head -30</automated>
  </verify>
  <done>
    - Suchleiste hat volle Breite im inset-Pattern
    - "Suche & Filter" Section mit Icon sichtbar
    - Kalender-Icon rot bei Event-Datum
    - Neue Dateien haben Swipe-Delete und koennen geoeffnet werden
  </done>
</task>

<task type="auto">
  <name>Task 2: Teamer Material + Events UI-Fixes (Punkte 8-16)</name>
  <files>
    frontend/src/components/teamer/pages/TeamerMaterialPage.tsx
    frontend/src/components/teamer/pages/TeamerMaterialDetailPage.tsx
    frontend/src/components/teamer/pages/TeamerEventsPage.tsx
  </files>
  <action>
TeamerMaterialPage.tsx:

8. **SectionHeader einfuegen**: Nach dem condense-Header und Refresher, vor dem loading-Check:
```tsx
import { SectionHeader } from '../../shared';
// ...
<SectionHeader
  title="Material"
  subtitle="Dokumente und Dateien"
  icon={documentIcon}
  colors={{ primary: '#d97706', secondary: '#b45309' }}
  stats={[{ value: materials.length, label: 'Materialien' }]}
/>
```

9. **Filter Section**: Suche und Jahrgang-Filter in eine IonList mit IonListHeader wrappen (wie Chat-Pattern). Icon-Farbe in der IonListHeader auf Amber:
```tsx
<IonList inset={true} style={{ margin: '16px' }}>
  <IonListHeader>
    <div className="app-section-icon app-section-icon--material">
      <IonIcon icon={filterOutline} />
    </div>
    <IonLabel>Suche & Filter</IonLabel>
  </IonListHeader>
  {/* Jahrgang Chips + Suchleiste hier */}
</IonList>
```
Import `filterOutline` aus ionicons/icons.

10. **Corner Badge borderRadius**: Bei nur einem Badge (kein zweiter Badge daneben) muss der borderRadius `0 0 8px 8px` sein (beide unteren Ecken rund). Aktuell hat der Jahrgang-Badge `app-corner-badge` Klasse mit `position: static`. Wenn NUR ein Badge vorhanden ist (z.B. nur event_name ODER nur jahrgang_name, nicht beide), dann inline-Style `borderRadius: '0 0 8px 8px'` setzen. Wenn BEIDE vorhanden: Linker Badge `borderRadius: '0 0 0 8px'`, Separator, rechter Badge `borderRadius: '0 0 8px 0'`.

11. **Datum-Icon rot**: In der Meta-Zeile `calendarOutline` von `color: '#6c757d'` auf `color: '#dc2626'` aendern.

12. **Teamer Material Detail**: In `TeamerMaterialDetailPage.tsx`:
    - "Informationen" (Zeile 222) aendern zu "Details"
    - `informationCircleOutline` Icon fuer diese Section aendern zu `calendarOutline` oder passendes Detail-Icon
    - Dateien-Section: IonListHeader aendern zu SectionHeader-Pattern mit Stat fuer Datei-Anzahl:
      Statt `<IonLabel>Dateien ({material.files?.length || 0})</IonLabel>` eine Mini-Stat einbauen oder einfach den Text beibehalten (da kein SectionHeader-Preset fuer Dateien existiert). Besser: IonListHeader Text auf "Dateien" und Count als zweiten Text.

13. **TeamerMaterialDetailPage Modal Backdrop**: Das Modal wird in TeamerMaterialPage.tsx Zeile 98 bereits mit `presentDetailModal({ presentingElement: presentingElement })` geoeffnet. PRUEFEN: Korrekt. In TeamerEventsPage.tsx Zeile 107-109 fehlt allerdings der presentingElement -- `presentMaterialModal()` wird ohne presentingElement aufgerufen (Zeile 582). Fixen: `useModalPage` importieren und presentingElement nutzen. TeamerEventsPage hat keinen useModalPage-Import -- aber die Seite ist keine Tab-Root-Page (hat keinen eigenen Tab), also kann man die IonPage ref direkt nutzen. ALTERNATIVE: Da TeamerEventsPage ein Tab ist, pruefen ob es eine ModalContext-Registrierung gibt. Fuer den Material-Modal in TeamerEventsPage: `presentMaterialModal({ presentingElement: document.querySelector('ion-page.ion-page-visible') || undefined })` als Workaround. Besser: `useModalPage('teamer-events')` importieren und verwenden. Import von `useModalPage` aus `../../../contexts/ModalContext` und in der Komponente aufrufen.

TeamerEventsPage.tsx:

14. **Material Section Icon rot**: Das Material-Section Icon in der Event-Detail-Ansicht (Zeile 563-564) hat bereits `color: '#d97706'` (Amber). Im Event-Kontext soll es rot sein. Aendern auf:
```tsx
<div className="app-section-icon app-section-icon--events">
```

15. **Warteliste/Teamer-Button**: Der "Ich bin dabei" Button (Zeile 659-670) wird IMMER angezeigt wenn das Event nicht past und der Teamer nicht registriert ist. Pruefen: Der Button soll NUR angezeigt werden wenn `teamer_needed` oder `teamer_only` true ist, ODER wenn das Event ein normales Event ist wo Teamer auch teilnehmen duerfen. Aktuell ist die Logik: Jedes Event kann gebucht werden. Die Events-API liefert nur Events die fuer den User sichtbar sind. KEIN FIX noetig -- die bestehende Logik ist korrekt (Teamer koennen sich bei allen sichtbaren Events anmelden).

16. **Beschreibung Schriftgroesse**: In der Event-Detail-Ansicht (Zeile 552) wird `app-info-row__sublabel` CSS-Klasse verwendet. Pruefen ob die fontSize konsistent mit dem Details-Bereich ist. Falls die Beschreibung kleiner ist als die Detail-Texte: Inline-Style `fontSize: '0.95rem'` setzen oder die Klasse `app-info-row__content` statt `app-info-row__sublabel` verwenden. Am besten: `<p>` statt `<p className="app-info-row__sublabel">` mit inline style `fontSize: '0.95rem', lineHeight: '1.5', color: '#374151', whiteSpace: 'pre-wrap', margin: 0` -- gleich wie in TeamerMaterialDetailPage.tsx Zeile 207.
  </action>
  <verify>
    <automated>cd /Users/simonluthe/Documents/Konfipoints && npx tsc --noEmit --project frontend/tsconfig.json 2>&1 | head -30</automated>
  </verify>
  <done>
    - TeamerMaterialPage hat SectionHeader in Amber mit Material-Anzahl
    - Filter in IonList mit IonListHeader gruppiert
    - Corner Badges haben korrekten borderRadius
    - Datum-Icons sind rot
    - Detail-Section zeigt "Details" statt "Informationen"
    - Material-Modal in Events hat presentingElement
    - Event-Beschreibung hat konsistente Schriftgroesse
  </done>
</task>

<task type="auto">
  <name>Task 3: Chat Filter-Tabs + Auth-Token Bug Fix (Punkte 17-18)</name>
  <files>
    frontend/src/components/chat/ChatOverview.tsx
    frontend/src/components/chat/ChatRoom.tsx
  </files>
  <action>
ChatOverview.tsx:

17. **Chat Filter als IonSegment-Tabs**: Die "Suche & Filter" Section (Zeilen 328-374) umbauen:
    - Suche bleibt als IonSearchbar (aus dem IonList/IonItem Pattern herausnehmen, eigene Searchbar wie in Material)
    - Den IonSelect mit `interface="popover"` (Zeilen 354-371) KOMPLETT entfernen
    - Stattdessen ein IonSegment einfuegen:
```tsx
<div className="app-segment-wrapper">
  <IonSegment value={filterType} onIonChange={(e) => setFilterType(e.detail.value!)}>
    <IonSegmentButton value="alle"><IonLabel>Alle</IonLabel></IonSegmentButton>
    <IonSegmentButton value="direkt"><IonLabel>Direkt</IonLabel></IonSegmentButton>
    <IonSegmentButton value="gruppe"><IonLabel>Gruppe</IonLabel></IonSegmentButton>
    <IonSegmentButton value="jahrgang"><IonLabel>Jahrgang</IonLabel></IonSegmentButton>
  </IonSegment>
</div>
```
    - Die Suchleiste kann oberhalb oder innerhalb der bestehenden IonList bleiben, oder als separate IonSearchbar:
```tsx
<IonList inset={true} style={{ margin: '16px' }}>
  <IonListHeader>
    <div className="app-section-icon app-section-icon--chat">
      <IonIcon icon={filterOutline} />
    </div>
    <IonLabel>Suche & Filter</IonLabel>
  </IonListHeader>
  <IonItemGroup>
    <IonItem>
      <IonIcon icon={search} slot="start" style={{ color: '#8e8e93', fontSize: '1rem' }} />
      <IonInput value={searchText} onIonInput={(e) => setSearchText(e.detail.value!)} placeholder="Chatraeume durchsuchen..." />
    </IonItem>
  </IonItemGroup>
</IonList>
{/* Segment AUSSERHALB der IonList */}
<div className="app-segment-wrapper">
  <IonSegment ...>
</div>
```
    - Imports: IonSegment und IonSegmentButton hinzufuegen (falls nicht vorhanden), `IonSelect` und `IonSelectOption` aus Imports entfernen, `chatbubblesOutline` kann bleiben fuer die Liste.

ChatRoom.tsx:

18. **KRITISCHER BUG: Chat-Dateien ohne Auth-Token**: In ChatRoom.tsx gibt es 2 Stellen wo Dateien per `window.open(fileUrl, '_blank')` OHNE Auth-Token geoeffnet werden:
    - Zeile 763-764: Fallback wenn native FileViewer fehlschlaegt
    - Zeile 767-768: Default-Handler fuer unbekannte Dateitypen
    - Zeile 637-638: Share-Funktion nutzt `fetch(fileUrl)` ohne Auth-Header

    FIX: An allen 3 Stellen statt `window.open(fileUrl, '_blank')` den Blob-Download-Pattern verwenden (gleich wie Material-Download):
```tsx
// Statt: window.open(fileUrl, '_blank');
// Machen:
const response = await api.get(`/chat/files/${filePath}`, { responseType: 'blob' });
const blobUrl = URL.createObjectURL(new Blob([response.data], { type: contentType || 'application/octet-stream' }));
window.open(blobUrl, '_blank');
setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
```

    Fuer die Share-Funktion (Zeile 637-638):
```tsx
// Statt: const response = await fetch(fileUrl);
// Machen:
const response = await api.get(`/chat/files/${selectedMessage.file_path}`, { responseType: 'blob' });
const blob = response.data;
```
  </action>
  <verify>
    <automated>cd /Users/simonluthe/Documents/Konfipoints && npx tsc --noEmit --project frontend/tsconfig.json 2>&1 | head -30</automated>
  </verify>
  <done>
    - Chat-Filter zeigt 4 Segment-Tabs (Alle/Direkt/Gruppe/Jahrgang) statt Popover
    - Alle Chat-Datei-Oeffnungen nutzen api.get mit Auth-Header (kein window.open ohne Token)
    - TypeScript kompiliert fehlerfrei
  </done>
</task>

</tasks>

<verification>
- `cd frontend && npx tsc --noEmit` kompiliert ohne Fehler
- Alle 18 Punkte in den 3 Tasks abgedeckt
</verification>

<success_criteria>
- Admin Material: Volle Suchleiste, Suche & Filter Section, rote Kalender-Icons, Swipe-Delete fuer neue Dateien
- Teamer Material: SectionHeader in Amber, Filter Section, korrekter Corner Badge borderRadius, rote Datum-Icons, "Details" statt "Informationen"
- Teamer Events: Konsistente Beschreibung-Schriftgroesse, rotes Material-Section-Icon, presentingElement fuer Material-Modal
- Chat: IonSegment-Tabs statt Popover, Auth-Token bei Datei-Oeffnung
</success_criteria>

<output>
After completion, create `.planning/quick/4-material-ui-fixes-admin-teamer-events-ch/4-SUMMARY.md`
</output>
