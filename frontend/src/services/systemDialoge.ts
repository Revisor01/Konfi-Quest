import { Share } from '@capacitor/share';
import type { ShareOptions } from '@capacitor/share';
import { ohneSperre, ausflugStarten, ausflugBeenden } from './appSperre';

// ---------------------------------------------------------------------------
// Systemdialoge, die die App in den Hintergrund schicken.
//
// WARUM ES DIESE DATEI GIBT:
// Ein Teilen-Blatt, eine Dateiauswahl, ein geoeffneter Link oder eine Datei,
// die in einer fremden App aufgeht, legen die App in den Hintergrund, ohne dass
// die Person sie verlaesst. Fuer die App-Sperre
// (services/appSperre.ts) sieht das zunaechst aus wie "App verlassen" — und bei
// der Einstellung "sofort" saesse man nach dem Teilen vor einem Sperrbildschirm.
//
// Statt an acht Aufrufstellen einen Merker zu setzen (und beim neunten daran zu
// denken), laufen die Dialoge hier durch EINE Huelle, die den Ausflug an- und
// abmeldet. Wer kuenftig teilt, importiert von hier und bekommt das Verhalten
// geschenkt.
//
// Die Karenzzeit in appSperre.ts bleibt trotzdem noetig: sie faengt die
// Dialoge ab, die nie durch diese Datei laufen (Fotoauswahl ueber ein
// verstecktes <input type="file">, window.open auf Karten und Weblinks).
// ---------------------------------------------------------------------------

/**
 * `Share.share` mit abgemeldeter App-Sperre.
 * Verhaelt sich sonst in jeder Hinsicht wie das Original — auch im Fehlerfall:
 * ein Abbruch wirft weiterhin, die Aufrufstellen behandeln ihn wie bisher.
 */
export const teilen = (optionen: ShareOptions) =>
  ohneSperre(() => Share.share(optionen));

/** `navigator.share` mit abgemeldeter App-Sperre (Browser-Weg). */
export const teilenImBrowser = (daten: ShareData) =>
  ohneSperre(() => navigator.share(daten));

/**
 * Oeffnet einen Link ausserhalb der App (Karten, Store, Weblinks).
 * Gibt es nur, damit auch diese Abgaenge die Sperre nicht ausloesen.
 */
export const linkOeffnen = (url: string): void => {
  ohneSperre(async () => {
    window.open(url, '_blank');
    // Kurz offen halten: window.open kehrt sofort zurueck, der Wechsel in den
    // Hintergrund passiert erst danach. Ohne diese Spanne waere der Merker
    // wieder weg, bevor er gebraucht wird.
    await new Promise((fertig) => setTimeout(fertig, 1500));
  });
};

/**
 * Wie lange der Ausflug nach dem Öffnen einer Datei noch läuft. Dieselbe
 * Spanne wie bei `linkOeffnen`, aus demselben Grund (siehe dort).
 */
export const DATEI_NACHLAUF_MS = 1500;

/**
 * Notbremse: Spätestens nach dieser Zeit endet der Ausflug, auch wenn das
 * Plugin nie antwortet.
 *
 * WARUM (29.09.2026): Die Plugins antworten unterschiedlich. Auf Android kehren
 * beide sofort nach dem Start der fremden App zurück. Auf iOS antwortet der
 * FileOpener erst, wenn die Vorschau geschlossen ist, und der FileViewer, wenn
 * das System seinen Vorschau-Baustein freigibt — wann genau, steht in keiner
 * Dokumentation. Hinge das Ende des Ausflugs allein an dieser Antwort, wäre
 * die App-Sperre bei einem Plugin, das nie antwortet, ab da tot. Lieber sperrt
 * die App nach so langer Zeit einmal zu oft (harmlos) als nie wieder
 * (Sicherheitsleck, siehe KARENZZEIT in appSperre.ts).
 */
export const DATEI_AUSFLUG_HOECHSTENS_MS = 5 * 60 * 1000;

/**
 * Öffnet eine Datei in einer fremden App oder in der Vorschau des Systems —
 * mit abgemeldeter App-Sperre.
 *
 * WOFÜR (Simons Befund 29.09.2026, Android-Testbuild 2.3.0): „Das führt bei
 * aktivierter Biometrie sofort immer zu einer Biometrie-Abfrage." Ein
 * Word-Dokument öffnet auf Android in einer anderen App; die App-Sperre hielt
 * das für „App verlassen" und fragte bei der Rückkehr nach dem Fingerabdruck.
 *
 * Das Plugin kehrt auf Android sofort zurück, der Wechsel in den Hintergrund
 * kommt erst danach. Deshalb bleibt der Ausflug nach der Antwort noch
 * `DATEI_NACHLAUF_MS` stehen — wie bei `linkOeffnen`. Anders als dort wartet
 * der Aufrufer diese Spanne NICHT ab: Die Ladeanzeige der Datei soll nicht
 * anderthalb Sekunden länger stehen, als das Öffnen dauert.
 *
 * Scheitert das Öffnen, wirft die Hülle den Fehler unverändert weiter; der
 * Ausflug endet auch dann erst nach dem Nachlauf. Ob das Plugin vor dem Fehler
 * schon etwas gestartet hat, lässt sich von hier nicht sehen — ein Nachlauf zu
 * viel schadet nicht.
 */
export const dateiExternOeffnen = async <T>(oeffnen: () => Promise<T>): Promise<T> => {
  ausflugStarten();
  let laeuft = true;
  // Die Notbremse und der Nachlauf können beide feuern — der Ausflug darf aber
  // nur einmal abgemeldet werden. Ein zweites ausflugBeenden() räumte sonst
  // einen fremden, gleichzeitig laufenden Ausflug mit ab (der Merker zählt).
  const beenden = () => {
    if (!laeuft) return;
    laeuft = false;
    clearTimeout(notbremse);
    ausflugBeenden();
  };
  const notbremse = setTimeout(beenden, DATEI_AUSFLUG_HOECHSTENS_MS);
  try {
    return await oeffnen();
  } finally {
    setTimeout(beenden, DATEI_NACHLAUF_MS);
  }
};
