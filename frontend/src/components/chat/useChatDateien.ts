import { useState, useEffect } from 'react';
import { useApp } from '../../contexts/AppContext';
import { compressImage } from '../../services/mediaCompression';
import { useDateiOeffnen } from '../../hooks/useDateiOeffnen';
import { Message } from '../../types/chat';

/**
 * Datei-Handling des Chatraums (beim Aufteilen von ChatRoom.tsx hierher
 * gezogen, Verhalten unveraendert): Datei-/Foto-Auswahl samt Kompression und
 * 10MB-Grenze, Kamera und Galerie, sowie das Oeffnen empfangener Dateien
 * (nativ, mit FileViewerModal als Web-Fallback inklusive Swipe-Kontext).
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

    // Bilder vor Upload resizen + komprimieren (max 1920px lange Kante). Andere
    // Dateien (Videos, PDFs) bleiben unverändert.
    let file = picked;
    let previewUrl: string | null = null;
    if (picked.type.startsWith('image/')) {
      try {
        const result = await compressImage(picked);
        file = result.file;
        previewUrl = result.previewUrl;
      } catch {
        file = picked;
        previewUrl = URL.createObjectURL(picked);
      }
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit (nach Kompression)
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setError('Datei ist zu groß (max. 10MB)');
      return;
    }

    setSelectedFile(file);
    setSelectedFilePreview(previewUrl);
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
