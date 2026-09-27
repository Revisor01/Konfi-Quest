import { useRef, useState } from 'react';
import { useIonModal } from '@ionic/react';
import { haptik, ImpactStyle } from '../utils/haptics';
import { useApp } from '../contexts/AppContext';
import {
  getMediaBlob,
  istGecacht,
  medienApiPfad,
  mimeAusDateiname,
  type MedienQuelle,
} from '../services/mediaCache';
// Native FileViewer über openFileNatively, FileViewerModal als Web-Fallback
import { openFileNatively } from '../utils/nativeFileViewer';
import FileViewerModal, { FileItem } from '../components/shared/FileViewerModal';

// Eine Datei öffnen — nativ (Vorschau mit Teilen und Sichern des Systems) oder
// im Datei-Betrachter der App, der Herunterladen und Teilen anbietet und durch
// die übrigen Dateien der Ansicht wischen lässt.
//
// Entstanden in useChatDateien (Chat) und seit dem 27.09.2026 gemeinsam für
// Chat und Challenges (Simon: "Und wir brauchen die gleichen Systeme wie
// Download-Fortschritt etc. bei Challenges."). Vorher ließ sich ein
// Challenge-Foto gar nicht öffnen, nur in der Karte ansehen.

/** Eine Datei der Ansicht, für den Wisch-Kontext im Betrachter. */
export interface OeffenbareDatei {
  pfad: string;
  /** Originalname mit Endung, etwa "foto.jpg"; bestimmt den Typ. */
  name?: string | null;
}

interface DateiOeffnenOptionen {
  quelle: MedienQuelle;
  /** Alle Dateien der Ansicht in Anzeigereihenfolge (Wischen im Betrachter). */
  kontext: () => OeffenbareDatei[];
  /** Ort für die Fehlermeldung an die Diagnose, etwa "chat-datei". */
  fehlerOrt: string;
}

export function useDateiOeffnen({ quelle, kontext, fehlerOrt }: DateiOeffnenOptionen) {
  const { setError } = useApp();
  // Welche Datei gerade geladen wird und wie weit. Ohne Rueckmeldung sieht man
  // beim Antippen einer PDF gar nichts passieren und tippt weiter (Simon,
  // 11.09.2026). `prozent` ist null, solange der Server keine Groesse meldet —
  // dann laeuft die Anzeige unbestimmt statt auf einer geratenen Zahl.
  const [ladendeDatei, setLadendeDatei] = useState<{ pfad: string; prozent: number | null } | null>(null);
  const viewerRef = useRef<{ files: FileItem[]; initialIndex: number }>({ files: [], initialIndex: 0 });

  // FileViewer Modal mit useIonModal Hook (universeller Datei-Viewer)
  const [presentFileViewer, dismissFileViewer] = useIonModal(FileViewerModal, {
    get files() { return viewerRef.current.files; },
    get initialIndex() { return viewerRef.current.initialIndex; },
    onClose: () => {
      dismissFileViewer();
      viewerRef.current.files.forEach(f => {
        if (f.url.startsWith('blob:')) URL.revokeObjectURL(f.url);
      });
      viewerRef.current = { files: [], initialIndex: 0 };
    }
  });

  const dateiOeffnen = async (filePath: string, fileName: string, mimeType?: string) => {
    // Zweiter Tipp auf dieselbe Datei, waehrend sie laedt: ignorieren statt
    // einen zweiten Download zu starten.
    if (ladendeDatei) return;
    try {
      await haptik(ImpactStyle.Light);

      // Ueber den Medien-Cache statt direkt per api.get (13.09.2026, Simon:
      // "Sonst muss man ja immer laden. Die moeglichst alle Dateien.").
      //
      // Beim Cache-Treffer gar keine Anzeige zeigen: Sie waere sofort wieder
      // weg und wuerde nur aufblitzen.
      const schonDa = await istGecacht(filePath, quelle);
      if (!schonDa) setLadendeDatei({ pfad: filePath, prozent: 0 });

      const blob = await getMediaBlob(filePath, {
        quelle,
        onFortschritt: (prozent) => {
          setLadendeDatei({ pfad: filePath, prozent });
        },
      });
      // Der MIME-Typ kommt aus dem Dateinamen statt aus dem Antwort-Header —
      // beim Cache-Treffer gibt es keine Antwort. mimeType ist der vom
      // Aufrufer gemeldete Typ.
      const mime: string = mimeType || mimeAusDateiname(fileName);

      // Nativ oeffnen versuchen (per D-12)
      const openedNatively = await openFileNatively(blob, fileName, mime);
      if (openedNatively) return;

      // Web-Fallback: FileViewerModal mit Swipe-Kontext. Die übrigen Dateien
      // gehen als API-Pfad hinein; der Betrachter holt sie über denselben
      // Medien-Cache.
      const blobUrl = URL.createObjectURL(new Blob([blob], { type: mime }));
      const alle = kontext();
      const files: FileItem[] = alle.map((d) => {
        if (d.pfad === filePath) {
          return { url: blobUrl, fileName: d.name || fileName, mimeType: mime };
        }
        return {
          url: `/api${medienApiPfad(d.pfad, quelle)}`,
          fileName: d.name || 'Datei',
          mimeType: mimeAusDateiname(d.name),
        };
      });
      const clickedIndex = alle.findIndex((d) => d.pfad === filePath);
      viewerRef.current = clickedIndex >= 0
        ? { files, initialIndex: clickedIndex }
        : { files: [{ url: blobUrl, fileName, mimeType: mime }], initialIndex: 0 };
      presentFileViewer({ cssClass: 'file-viewer-modal' });
    } catch (err) {
      setError('Fehler beim Öffnen der Datei', { ort: fehlerOrt, fehler: err });
    } finally {
      // finally statt einzelner Aufrufe: Der Zweig "nativ geoeffnet" steigt
      // per return aus, und ohne finally bliebe die Anzeige dort haengen.
      setLadendeDatei(null);
    }
  };

  return { dateiOeffnen, ladendeDatei };
}
