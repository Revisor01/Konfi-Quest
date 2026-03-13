---
phase: quick-6b
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/components/teamer/pages/TeamerMaterialPage.tsx
  - frontend/src/components/teamer/pages/TeamerMaterialDetailPage.tsx
  - frontend/src/components/admin/pages/AdminMaterialPage.tsx
autonomous: true
requirements: [UI-FIX-INLINE, UI-FIX-BADGES, UI-FIX-ADMIN-VIEWER]
must_haves:
  truths:
    - "Material Detail wird inline angezeigt (kein Modal), Zurueck-Button fuehrt zur Liste"
    - "Corner Badges in Material-Liste haben borderRadius 0 0 8px 8px (wie Events)"
    - "FileViewer im Admin Material funktioniert mit korrektem Backdrop"
  artifacts:
    - path: "frontend/src/components/teamer/pages/TeamerMaterialPage.tsx"
      provides: "Inline Detail-View statt Modal, korrigierte Corner Badges"
    - path: "frontend/src/components/teamer/pages/TeamerMaterialDetailPage.tsx"
      provides: "Wird als inline Komponente verwendet (nicht mehr als Modal-Page)"
  key_links:
    - from: "TeamerMaterialPage.tsx"
      to: "TeamerMaterialDetailPage.tsx"
      via: "selectedMaterial State + Conditional Rendering"
      pattern: "selectedMaterial.*setSelectedMaterial"
---

<objective>
Material Detail von Modal auf Inline-View umbauen (wie TeamerEventsPage), Corner Badges korrigieren, Admin FileViewer Backdrop fixen.

Purpose: Konsistentes UX-Pattern fuer alle Teamer-Seiten (Events und Material gleich), korrekte iOS-Darstellung
Output: TeamerMaterialPage mit Inline-Detail, korrigierte Badges, Admin-Fix
</objective>

<execution_context>
@/Users/simonluthe/.claude/get-shit-done/workflows/execute-plan.md
@/Users/simonluthe/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@frontend/src/components/teamer/pages/TeamerMaterialPage.tsx
@frontend/src/components/teamer/pages/TeamerMaterialDetailPage.tsx
@frontend/src/components/teamer/pages/TeamerEventsPage.tsx (Referenz fuer Inline-Detail-Pattern)
@frontend/src/components/admin/pages/AdminMaterialPage.tsx
@frontend/src/theme/variables.css

<interfaces>
<!-- TeamerEventsPage Inline-Pattern (Zeile 366-389): -->
<!-- if (selectedEvent) { return <IonPage>..Detail-View..</IonPage> } -->
<!-- Zurueck: onClick={() => setSelectedEvent(null)} mit arrowBack Icon -->
<!-- IonHeader mit Back-Button + Titel, dann IonContent mit SectionHeader + Details -->

<!-- TeamerEventsPage Corner Badge Pattern (Zeile 792-816): -->
<!-- Erster Badge: inline borderRadius '0 0 8px 8px', KEIN app-corner-badge Klasse -->
<!-- Zweiter Badge: app-corner-badge Klasse mit position: 'static' -->
<!-- Dazwischen: 2px white divider -->
<!-- Container: position absolute, top 0, right 0, flexDirection row -->

<!-- TeamerMaterialPage aktuell (Zeile 94-101): -->
<!-- useIonModal(TeamerMaterialDetailPage, {...}) fuer Detail -->
<!-- presentDetailModal({ presentingElement }) zum Oeffnen -->
<!-- MUSS ersetzt werden durch: selectedMaterial State + Conditional Rendering -->

<!-- TeamerMaterialDetailPage Props: materialId: number, onClose: () => void -->
<!-- Laedt Material-Daten per API: api.get(`/material/${materialId}`) -->
<!-- Zeigt: Beschreibung, Details (Event, Jahrgang, Erstellt am, Von), Dateien -->

<!-- Corner Badge CSS (.app-corner-badge): border-radius: 0 10px 0 10px -->
<!-- Wird NICHT fuer den ersten Badge verwendet (Events nutzt inline styles) -->
<!-- Zweiter Badge nutzt app-corner-badge + position:static weil Container positioniert -->

<!-- Material Corner Badges aktuell: Erster Badge (event_name) hat inline borderRadius '0 0 8px 8px' -->
<!-- Zweiter Badge (jahrgang_name) nutzt app-corner-badge--purple mit position:static -->
<!-- Das app-corner-badge hat border-radius: 0 10px 0 10px - FALSCH fuer position:static -->
<!-- Fix: Beide Badges mit inline borderRadius, NICHT app-corner-badge Klasse -->
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: TeamerMaterialPage - Material Detail von Modal zu Inline + Corner Badge Fix</name>
  <files>frontend/src/components/teamer/pages/TeamerMaterialPage.tsx, frontend/src/components/teamer/pages/TeamerMaterialDetailPage.tsx</files>
  <action>
Zwei grosse Aenderungen in TeamerMaterialPage.tsx:

**A) Material Detail von Modal zu Inline-View umbauen (wie TeamerEventsPage Zeile 366-389):**

1. State aendern: `selectedMaterialId` (number | null) BLEIBT, aber `useIonModal` komplett ENTFERNEN (Zeile 94-97 und import). Stattdessen neuen State `selectedMaterial` mit den vollen Material-Daten:
   ```typescript
   const [selectedMaterial, setSelectedMaterial] = useState<MaterialDetail | null>(null);
   ```
   Importiere das `MaterialDetail` Interface aus TeamerMaterialDetailPage (oder definiere es hier).

2. `openDetail` Funktion (Zeile 99-102) aendern: Statt Modal zu oeffnen, API direkt aufrufen und selectedMaterial setzen:
   ```typescript
   const openDetail = async (matId: number) => {
     try {
       const res = await api.get(`/material/${matId}`);
       setSelectedMaterial(res.data);
     } catch {
       setError('Fehler beim Laden des Materials');
     }
   };
   ```

3. Conditional Rendering am Anfang der return-Anweisung (VOR der normalen Liste), genau wie TeamerEventsPage Zeile 366:
   ```typescript
   if (selectedMaterial) {
     return (
       <IonPage>
         <IonHeader translucent={true}>
           <IonToolbar>
             <IonButtons slot="start">
               <IonButton onClick={() => setSelectedMaterial(null)}>
                 <IonIcon icon={arrowBack} slot="icon-only" />
               </IonButton>
             </IonButtons>
             <IonTitle>{selectedMaterial.title}</IonTitle>
           </IonToolbar>
         </IonHeader>
         <IonContent className="app-gradient-background" fullscreen>
           <IonHeader collapse="condense">
             <IonToolbar className="app-condense-toolbar">
               <IonTitle size="large">{selectedMaterial.title}</IonTitle>
             </IonToolbar>
           </IonHeader>
           {/* Inhalt aus TeamerMaterialDetailPage uebernehmen */}
         </IonContent>
       </IonPage>
     );
   }
   ```

4. Den INHALT der Detail-Ansicht direkt aus TeamerMaterialDetailPage.tsx kopieren:
   - SectionHeader oben (bereits vorhanden in TeamerMaterialDetailPage Zeile 263-269)
   - Beschreibungs-Section (Zeile 201-216)
   - Details-Section mit app-info-row (Zeile 218-260)
   - Dateien-SectionHeader + Dateien-Liste (Zeile 262-312)
   - Die `getFileIcon`, `formatFileSize`, `openFile` Funktionen aus TeamerMaterialDetailPage in TeamerMaterialPage verschieben
   - Alle Imports (Haptics, Filesystem, FileViewer, FileOpener etc.) in TeamerMaterialPage hinzufuegen

5. Imports aufraeumen:
   - `useIonModal` ENTFERNEN aus Ionic-Imports
   - `TeamerMaterialDetailPage` Import ENTFERNEN (wird nicht mehr als Modal gebraucht)
   - `arrowBack` aus ionicons/icons hinzufuegen
   - `IonButtons, IonButton` hinzufuegen falls nicht vorhanden
   - Alle File-Handling Imports von TeamerMaterialDetailPage uebernehmen
   - `useModalPage` und `presentingElement` ENTFERNEN (kein Modal mehr noetig)

6. Refresher im Detail-View: Daten neu laden und selectedMaterial aktualisieren:
   ```typescript
   onIonRefresh={async (e) => {
     const res = await api.get(`/material/${selectedMaterial.id}`);
     setSelectedMaterial(res.data);
     e.detail.complete();
   }}
   ```

**B) Corner Badges korrigieren (Zeile 251-275):**

Das Jahrgang-Badge (Zeile 271-273) nutzt aktuell `className="app-corner-badge app-corner-badge--purple"` mit `style={{ position: 'static' }}`. Die CSS-Klasse hat `border-radius: 0 10px 0 10px` was NICHT zum Event-Badge-Pattern passt.

Fix: BEIDE Badges mit inline Styles, KEINE app-corner-badge Klasse:

```tsx
{mat.event_name && (
  <>
    <div style={{
      backgroundColor: '#dc2626',
      color: 'white',
      fontSize: '0.65rem',
      fontWeight: '600',
      padding: '4px 8px',
      borderRadius: mat.jahrgang_name ? '0 0 0 8px' : '0 0 8px 8px',
      textTransform: 'uppercase',
      letterSpacing: '0.3px'
    }}>
      {mat.event_name.length > 15 ? mat.event_name.substring(0, 15) + '...' : mat.event_name}
    </div>
    {mat.jahrgang_name && (
      <div style={{ width: '2px', background: 'white' }} />
    )}
  </>
)}
{mat.jahrgang_name && (
  <div style={{
    backgroundColor: '#5b21b6',
    color: 'white',
    fontSize: '0.65rem',
    fontWeight: '600',
    padding: '4px 8px',
    borderRadius: mat.event_name ? '0 0 8px 0' : '0 0 8px 8px',
    textTransform: 'uppercase',
    letterSpacing: '0.3px'
  }}>
    {mat.jahrgang_name}
  </div>
)}
```

Logik: Wenn nur EIN Badge: `0 0 8px 8px` (beide unten rund). Wenn ZWEI Badges: linker `0 0 0 8px` (nur links-unten rund), rechter `0 0 8px 0` (nur rechts-unten rund). Genau wie im letzten Commit (772c335) angegeben.
  </action>
  <verify>
    <automated>cd /Users/simonluthe/Documents/Konfipoints/frontend && npx tsc --noEmit --skipLibCheck 2>&1 | head -20</automated>
  </verify>
  <done>Material Detail wird inline angezeigt mit Back-Button, kein Modal mehr. Corner Badges haben korrekte borderRadius (0 0 8px 8px einzeln, 0 0 0 8px / 0 0 8px 0 paarweise). useIonModal und TeamerMaterialDetailPage-Import entfernt.</done>
</task>

<task type="auto">
  <name>Task 2: AdminMaterialPage - FileViewer presentingElement pruefen</name>
  <files>frontend/src/components/admin/pages/AdminMaterialPage.tsx</files>
  <action>
In AdminMaterialPage.tsx pruefen ob der FileViewer/FileOpener korrekt mit presentingElement arbeitet:

1. Pruefen ob `useModalPage` importiert und verwendet wird. Falls nicht, hinzufuegen:
   ```typescript
   import { useModalPage } from '../../../contexts/ModalContext';
   // In der Komponente:
   const { presentingElement } = useModalPage('admin-material');
   ```
   HINWEIS: Die Route '/admin/material' muss in ModalContext.tsx gemappt sein. Falls nicht vorhanden, hinzufuegen:
   ```typescript
   else if (currentPath.includes('/admin/material')) currentTabId = 'admin-material';
   ```

2. Pruefen ob MaterialFormModal (falls vorhanden) mit `presentingElement` geoeffnet wird:
   ```typescript
   presentModal({ presentingElement: presentingElement });
   ```

3. Falls in AdminMaterialPage ein FileViewer als Modal verwendet wird, sicherstellen dass dieser auch `presentingElement` bekommt.

4. Falls AdminMaterialPage KEINEN FileViewer hat (sondern der ist im MaterialFormModal oder einer Sub-Komponente), dann dort pruefen ob presentingElement weitergegeben wird.

WICHTIG: Nur Aenderungen machen die tatsaechlich noetig sind. Wenn presentingElement bereits korrekt ist, nichts aendern.
  </action>
  <verify>
    <automated>cd /Users/simonluthe/Documents/Konfipoints/frontend && npx tsc --noEmit --skipLibCheck 2>&1 | head -20</automated>
  </verify>
  <done>Admin Material FileViewer/Modals oeffnen sich mit iOS Backdrop-Effekt (presentingElement korrekt gesetzt)</done>
</task>

</tasks>

<verification>
- TypeScript kompiliert fehlerfrei
- Material Detail ist inline (kein Modal), Back-Button funktioniert
- Corner Badges korrekt gerundet
- Admin Material Modal/FileViewer mit Backdrop
</verification>

<success_criteria>
- Material Detail als Inline-View (selectedMaterial State + Conditional Rendering)
- Kein useIonModal fuer Detail in TeamerMaterialPage
- Corner Badges: Einzeln 0 0 8px 8px, Paarweise links 0 0 0 8px / rechts 0 0 8px 0
- Admin Material presentingElement korrekt
</success_criteria>

<output>
After completion, create `.planning/quick/6-teamer-material-ui-korrekturen-corner-ba/6-SUMMARY.md`
</output>
