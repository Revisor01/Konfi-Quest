// Gemeinsames der Formulare fuer Kategorien, Level und Zertifikate
// (useKategorieFormular, useLevelFormular, useZertifikatFormular): wie App
// und Web-Fassung die Logik aufrufen.

export interface FormularOptionen {
  /** Nach dem Speichern (gesendet oder eingereiht): neu laden und schliessen. */
  onFertig: () => void;
  /**
   * Fehler im Formular zeigen (Dialog im Browser) statt als Meldung oben
   * (App) -- eine Meldung oben laege neben dem offenen Dialog.
   */
  fehlerImDialog?: boolean;
}

/**
 * Satz ueber dem Formular im Browser, solange die App offline ist. Gesperrt
 * wird nichts: Wie in der App geht das Gespeicherte in die Warteschlange.
 */
export const OFFLINE_HINWEIS = 'Du bist offline. Gespeichert wird, sobald du wieder online bist.';
