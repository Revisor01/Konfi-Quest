// Kleine Darstellungsregeln fuer Material in der Web-Fassung: das Symbol einer
// Datei nach ihrem Typ und ihre Groesse. Dieselben Regeln wie in den Seiten der
// App (TeamerMaterialPage, TeamerMaterialDetailPage).

import { ICON_BILD, ICON_DATEI, ICON_MUSIK, ICON_VIDEO } from '../../../shared/icons';

/** Bild, Video, Ton oder allgemeines Dokument-Symbol nach dem Typ der Datei. */
export function dateiSymbol(mimeType: string): string {
  if (mimeType.startsWith('image/')) return ICON_BILD;
  if (mimeType.startsWith('video/')) return ICON_VIDEO;
  if (mimeType.startsWith('audio/')) return ICON_MUSIK;
  return ICON_DATEI;
}

/** "512 B", "1.5 KB", "2.4 MB". */
export function dateiGroesse(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
