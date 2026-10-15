import { teilenImBrowser } from '../../services/systemDialoge';
import { getMediaBlob } from '../../services/mediaCache';
import { mimeAusDateiname } from '../../utils/dateiTypen';
import type { Message } from '../../types/chat';

/**
 * Eine Datei aus dem Chat im Browser weitergeben (Befund 15.10.2026).
 *
 * Die App teilt eine Datei über das Teilen-Blatt aus dem Cache des Geräts
 * (chatTeilen.nachrichtTeilen). Diesen Cache gibt es im Browser nicht -- dort
 * kam beim Teilen ein leerer Pfad an statt der Datei. Im Browser gilt deshalb:
 * Kann er Dateien teilen (navigator.canShare mit files, etwa am Handy), geht
 * die Datei selbst an sein Teilen-Fenster; sonst (Desktop) steht an der
 * Nachricht „Herunterladen", und die Datei landet im Download-Ordner.
 *
 * Ob ein Browser eine Datei teilen kann, sagt nur canShare -- und nur für eine
 * Datei mit Namen und Typ. Die Frage geht deshalb mit einer leeren Datei
 * desselben Namens und Typs, bevor die echte geladen ist.
 */

/** Kann der Browser eine Datei dieses Namens über sein Teilen-Fenster weitergeben? */
export const dateiImBrowserTeilbar = (name: string): boolean => {
  if (typeof navigator === 'undefined' || typeof navigator.canShare !== 'function') return false;
  try {
    return navigator.canShare({ files: [new File([], name, { type: mimeAusDateiname(name) })] });
  } catch {
    return false;
  }
};

/** Die Datei im Browser speichern (Download unter ihrem Namen). */
export const dateiSpeichern = (blob: Blob, name: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Die Datei an das Teilen-Fenster des Browsers geben -- oder, wenn er keine
 * Dateien teilen kann, herunterladen. Ein Abbruch im Teilen-Fenster wirft
 * weiter (AbortError) und löst keinen Download aus: Die Person hat abgesagt.
 * Der Begleittext ist derselbe wie im Teilen-Blatt der App (Bildunterschrift
 * der Nachricht, sonst der Dateiname).
 */
export async function dateiImBrowserWeitergeben(blob: Blob, name: string, titel: string, text: string): Promise<void> {
  const datei = new File([blob], name, { type: blob.type || mimeAusDateiname(name) });
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [datei] })) {
    await teilenImBrowser({ files: [datei], title: titel, text });
    return;
  }
  dateiSpeichern(blob, name);
}

/** „Herunterladen" an einer Datei-Nachricht im Browser. */
export async function nachrichtHerunterladen(
  message: Message,
  setError: (msg: string) => void
): Promise<void> {
  if (!message.file_path) return;
  try {
    const blob = await getMediaBlob(message.file_path);
    dateiSpeichern(blob, message.file_name || 'datei');
  } catch {
    setError('Die Datei konnte nicht geladen werden');
  }
}
