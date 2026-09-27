import { useState, useEffect } from 'react';
import { useApp } from '../../contexts/AppContext';
import { fuerUploadVorbereiten, DateiZuGrossFehler, UPLOAD_GRENZE } from '../../services/mediaCompression';
import { useDateiOeffnen } from '../../hooks/useDateiOeffnen';
import { Message } from '../../types/chat';

/**
 * Datei-Handling des Chatraums (beim Aufteilen von ChatRoom.tsx hierher
 * gezogen): Datei-/Foto-Auswahl samt Kompression und Groessengrenze, Kamera
 * und Galerie, sowie das Oeffnen empfangener Dateien (nativ, mit
 * FileViewerModal als Web-Fallback inklusive Swipe-Kontext).
 *
 * Das Oeffnen laeuft seit dem 27.09.2026 ueber useDateiOeffnen — denselben
 * Weg wie bei den Challenges (Ladeanzeige, Cache, Betrachter).
 */

interface ChatDateienDeps {
  // Fuer den Swipe-Kontext im Viewer: alle Datei-Nachrichten des Raums.
  messages: Message[];
}

export function useChatDateien({ messages }: ChatDateienDeps) {
  const { setError } = useApp();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFilePreview, setSelectedFilePreview] = useState<string | null>(null);

  // Empfangene Dateien oeffnen: Ladeanzeige mit Prozent, Medien-Cache, nativ
  // oder im Betrachter mit allen Dateien des Raums zum Wischen.
  const { dateiOeffnen: handleFileClick, ladendeDatei } = useDateiOeffnen({
    quelle: 'chat',
    fehlerOrt: 'chat-datei',
    kontext: () => messages
      .filter(m => m.file_path)
      .map(m => ({ pfad: m.file_path!, name: m.file_name })),
  });

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files?.[0];
    // Input zuruecksetzen, damit dieselbe Datei erneut waehlbar ist.
    event.target.value = '';
    if (!picked) return;

    // Bilder vor Upload resizen + komprimieren (max 1920px lange Kante), dann
    // gegen die Grenze pruefen — derselbe Weg wie bei den Challenges
    // (27.09.2026). Andere Dateien (Videos, PDFs) bleiben unverändert.
    //
    // Die Grenze ist die des Servers: 5 MB. Bis zum 27.09.2026 stand hier
    // 10 MB — eine Datei zwischen 5 und 10 MB ging durch und scheiterte dann
    // beim Senden, ohne verstaendliche Meldung.
    try {
      const { file, bildVorschau } = await fuerUploadVorbereiten(picked, UPLOAD_GRENZE.chat);
      setSelectedFile(file);
      setSelectedFilePreview(bildVorschau);
    } catch (err) {
      setError(err instanceof DateiZuGrossFehler ? err.message : 'Datei konnte nicht ausgewählt werden');
    }
  };

  // Cleanup preview URL on unmount or file change
  useEffect(() => {
    return () => {
      if (selectedFilePreview) {
        URL.revokeObjectURL(selectedFilePreview);
      }
    };
  }, [selectedFilePreview]);

  const clearSelectedFile = () => {
    if (selectedFilePreview) {
      URL.revokeObjectURL(selectedFilePreview);
    }
    setSelectedFile(null);
    setSelectedFilePreview(null);
  };

  return {
    selectedFile,
    selectedFilePreview,
    handleFileSelect,
    clearSelectedFile,
    handleFileClick,
    ladendeDatei,
  };
}
