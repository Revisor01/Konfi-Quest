---
phase: quick-5
plan: 1
type: execute
wave: 1
depends_on: []
files_modified:
  - frontend/src/components/chat/modals/FileViewerModal.tsx
  - frontend/src/components/chat/ChatRoom.tsx
autonomous: true
requirements: [QUICK-5]

must_haves:
  truths:
    - "Chat-Bilder oeffnen sich als Fullscreen-Modal in der App statt im Browser"
    - "Chat-Dokumente (PDF etc.) oeffnen sich als In-App-Modal statt im Browser"
    - "Modal hat Backdrop/presentingElement (iOS Card Style)"
    - "Modal hat Schliessen-Button und zeigt Dateinamen als Titel"
    - "Native Capacitor FileViewer/FileOpener bleibt als primaerer Pfad erhalten"
  artifacts:
    - path: "frontend/src/components/chat/modals/FileViewerModal.tsx"
      provides: "In-App FileViewer Modal Komponente"
    - path: "frontend/src/components/chat/ChatRoom.tsx"
      provides: "Angepasste handleImageOrFileClick und openImageWithFileOpener Funktionen"
  key_links:
    - from: "ChatRoom.tsx"
      to: "FileViewerModal.tsx"
      via: "useIonModal Hook"
      pattern: "useIonModal\\(FileViewerModal"
---

<objective>
Chat-Dateien und Bilder in einem In-App FileViewer-Modal oeffnen statt per window.open() im Browser.

Purpose: Bessere UX - Dateien bleiben in der App, mit iOS-Modal-Backdrop und Schliessen-Button.
Output: FileViewerModal Komponente + angepasster ChatRoom.tsx
</objective>

<execution_context>
@/Users/simonluthe/.claude/get-shit-done/workflows/execute-plan.md
@/Users/simonluthe/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@frontend/src/components/chat/ChatRoom.tsx
@frontend/src/components/chat/modals/MembersModal.tsx (Referenz fuer Modal-Pattern in Chat)

<interfaces>
<!-- ChatRoom.tsx hat bereits presentingElement als Prop und useIonModal Pattern -->

Aus ChatRoom.tsx:
```typescript
// Props
const ChatRoom: React.FC<ChatRoomComponentProps> = ({ room, onBack, presentingElement }) => {

// Bestehender useIonModal Pattern (PollModal):
const [presentPollModalHook, dismissPollModalHook] = useIonModal(PollModal, {
  onClose: () => dismissPollModalHook(),
  onSuccess: () => { dismissPollModalHook(); handlePollCreated(); },
  roomId: room?.id ?? 0
});
const openPollModal = () => {
  presentPollModalHook({ presentingElement: presentingElement || undefined });
};

// Relevante Stellen mit window.open (Zeilen 765, 775):
// Fallback nach native FileViewer failure + generischer Datei-Fallback
// Auch openImageWithFileOpener hat keinen Web-Fallback-Modal

// Imports bereits vorhanden:
import { useIonModal } from '@ionic/react';
import api from '../../services/api';
```
</interfaces>
</context>

<tasks>

<task type="auto">
  <name>Task 1: FileViewerModal Komponente erstellen</name>
  <files>frontend/src/components/chat/modals/FileViewerModal.tsx</files>
  <action>
    Neue Modal-Komponente `FileViewerModal` erstellen mit folgenden Props:
    - `blobUrl: string` - Object URL des Blobs
    - `fileName: string` - Anzeigename der Datei
    - `mimeType: string` - MIME-Type fuer Darstellungsentscheidung
    - `onClose: () => void` - Schliessen-Callback

    Aufbau:
    - IonPage > IonHeader (Toolbar mit closeOutline-Icon-Button links, fileName als IonTitle) > IonContent
    - Content-Bereich:
      - Bilder (mimeType startsWith 'image/'): `<img>` Tag mit `src={blobUrl}`, `object-fit: contain`, zentriert, max 100% Breite/Hoehe
      - PDF (mimeType === 'application/pdf'): `<iframe>` mit `src={blobUrl}`, 100% Breite/Hoehe, kein Border
      - Andere Dateien: Zentrierter Hinweis "Vorschau nicht verfuegbar" mit documentOutline IonIcon und Download-Button (IonButton mit downloadOutline Icon), der `window.open(blobUrl, '_blank')` ausfuehrt als letzter Fallback
    - CSS: img container mit `display: flex; align-items: center; justify-content: center; height: 100%;`, img selbst `max-width: 100%; max-height: 100%; object-fit: contain;`
    - KEINE Emojis, deutsche Texte mit echten Umlauten
    - IonContent mit `className="ion-padding"` fuer Nicht-Bild/PDF-Inhalte, fuer Bilder/PDF ohne Padding

    Icons importieren: closeOutline, documentOutline, downloadOutline aus ionicons/icons
  </action>
  <verify>
    <automated>cd /Users/simonluthe/Documents/Konfipoints/frontend && npx tsc --noEmit --skipLibCheck 2>&1 | grep -i "FileViewerModal" || echo "Keine TypeScript-Fehler in FileViewerModal"</automated>
  </verify>
  <done>FileViewerModal.tsx existiert, rendert Bilder als img, PDFs als iframe, andere Dateien mit Download-Hinweis</done>
</task>

<task type="auto">
  <name>Task 2: ChatRoom.tsx - window.open durch FileViewerModal ersetzen</name>
  <files>frontend/src/components/chat/ChatRoom.tsx</files>
  <action>
    1. FileViewerModal importieren:
       `import FileViewerModal from './modals/FileViewerModal';`

    2. State fuer FileViewer hinzufuegen (nach den bestehenden useState-Deklarationen):
       ```typescript
       const [viewerBlobUrl, setViewerBlobUrl] = useState<string | null>(null);
       const [viewerFileName, setViewerFileName] = useState('');
       const [viewerMimeType, setViewerMimeType] = useState('');
       ```

    3. useIonModal Hook fuer FileViewerModal (nach dem bestehenden PollModal useIonModal, ca. Zeile 135):
       ```typescript
       const [presentFileViewer, dismissFileViewer] = useIonModal(FileViewerModal, {
         blobUrl: viewerBlobUrl || '',
         fileName: viewerFileName,
         mimeType: viewerMimeType,
         onClose: () => {
           dismissFileViewer();
           if (viewerBlobUrl) {
             URL.revokeObjectURL(viewerBlobUrl);
             setViewerBlobUrl(null);
           }
         }
       });
       ```

    4. Hilfsfunktion `openInAppViewer` erstellen (vor handleImageOrFileClick):
       ```typescript
       const openInAppViewer = (blob: Blob, fileName: string, mimeType: string) => {
         const url = URL.createObjectURL(new Blob([blob], { type: mimeType }));
         setViewerBlobUrl(url);
         setViewerFileName(fileName);
         setViewerMimeType(mimeType);
         // useIonModal aktualisiert Props nicht reaktiv, daher setTimeout
         setTimeout(() => {
           presentFileViewer({ presentingElement: presentingElement || undefined });
         }, 50);
       };
       ```

    WICHTIG: Da useIonModal Props beim Erstellen bindet und nicht reaktiv aktualisiert, muss das Modal NACH dem State-Update gepraesentiert werden. Das setTimeout(50) stellt sicher, dass React den State-Update verarbeitet hat. ALTERNATIVE falls das nicht funktioniert: Stattdessen die blobUrl direkt in einer Ref speichern und im Modal per Ref auslesen - aber zuerst den setTimeout-Ansatz versuchen.

    NOCH BESSER: Da useIonModal Props bei der Hook-Erstellung bindet, wird das Modal immer die initialen State-Werte sehen. Stattdessen einen Ref verwenden:
    ```typescript
    const viewerDataRef = useRef<{ blobUrl: string; fileName: string; mimeType: string }>({ blobUrl: '', fileName: '', mimeType: '' });
    ```
    Und den useIonModal so anpassen:
    ```typescript
    const [presentFileViewer, dismissFileViewer] = useIonModal(FileViewerModal, {
      get blobUrl() { return viewerDataRef.current.blobUrl; },
      get fileName() { return viewerDataRef.current.fileName; },
      get mimeType() { return viewerDataRef.current.mimeType; },
      onClose: () => {
        dismissFileViewer();
        if (viewerDataRef.current.blobUrl) {
          URL.revokeObjectURL(viewerDataRef.current.blobUrl);
          viewerDataRef.current = { blobUrl: '', fileName: '', mimeType: '' };
        }
      }
    });
    ```
    Und openInAppViewer:
    ```typescript
    const openInAppViewer = (blob: Blob, fileName: string, mimeType: string) => {
      const url = URL.createObjectURL(new Blob([blob], { type: mimeType }));
      viewerDataRef.current = { blobUrl: url, fileName, mimeType };
      presentFileViewer({ presentingElement: presentingElement || undefined });
    };
    ```

    5. In `openImageWithFileOpener` (Zeile ~118-121, catch-Block):
       Statt `setError('Fehler beim Oeffnen des Bildes')` den In-App-Viewer verwenden:
       ```typescript
       } catch (error) {
         console.warn('Native image opener failed, using in-app viewer:', error);
         try {
           const response = await api.get(`/chat/files/${filePath}`, { responseType: 'blob' });
           const fileName = filePath.split('/').pop() || 'Bild';
           openInAppViewer(response.data, fileName, 'image/jpeg');
         } catch {
           setError('Fehler beim Oeffnen des Bildes');
         }
       }
       ```

    6. In `handleImageOrFileClick` - Dokument-Fallback (Zeile ~760-769):
       Im catch(viewerError) Block statt window.open:
       ```typescript
       } catch (viewerError) {
         console.warn('Native viewer failed, using in-app viewer:', viewerError);
         try {
           const fallbackResponse = await api.get(`/chat/files/${filePath}`, { responseType: 'blob' });
           const mime = fallbackResponse.headers?.['content-type'] || 'application/octet-stream';
           openInAppViewer(fallbackResponse.data, fileName, mime);
         } catch {
           setError('Fehler beim Oeffnen der Datei');
         }
       }
       ```

    7. In `handleImageOrFileClick` - generischer else-Block (Zeile ~772-779):
       Statt window.open:
       ```typescript
       } else {
         try {
           const fileResponse = await api.get(`/chat/files/${filePath}`, { responseType: 'blob' });
           const mime = fileResponse.headers?.['content-type'] || 'application/octet-stream';
           openInAppViewer(fileResponse.data, fileName, mime);
         } catch {
           setError('Fehler beim Oeffnen der Datei');
         }
       }
       ```

    8. FileViewer und FileOpener Imports BEHALTEN - die werden weiterhin fuer den nativen Pfad gebraucht.

    KEINE Emojis, deutsche Texte mit echten Umlauten.
  </action>
  <verify>
    <automated>cd /Users/simonluthe/Documents/Konfipoints/frontend && npx tsc --noEmit --skipLibCheck 2>&1 | tail -20</automated>
  </verify>
  <done>Alle 3 window.open Stellen in ChatRoom.tsx durch openInAppViewer ersetzt. Native Pfade bleiben primaer. FileViewerModal oeffnet als iOS-Card-Modal mit presentingElement.</done>
</task>

</tasks>

<verification>
- `cd frontend && npx tsc --noEmit --skipLibCheck` kompiliert ohne Fehler
- Kein `window.open` mehr in ChatRoom.tsx (ausser ggf. im FileViewerModal als letzter Download-Fallback)
- FileViewerModal wird per useIonModal mit presentingElement geoeffnet
</verification>

<success_criteria>
- Chat-Bilder und Dateien oeffnen sich in einem In-App-Modal statt im Browser
- Modal hat iOS-Card-Style mit Backdrop (presentingElement)
- Bilder werden als img, PDFs als iframe angezeigt
- Native Capacitor-Viewer bleibt primaerer Oeffnungspfad
- Kein window.open mehr in ChatRoom.tsx Datei-Handling
</success_criteria>

<output>
After completion, create `.planning/quick/5-chat-dateien-bilder-in-app-fileviewer-st/5-SUMMARY.md`
</output>
