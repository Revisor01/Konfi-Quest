// Solange die Web-Fassung des Chats offen ist, laufen keine Seitenuebergaenge.
//
// Liste und Raum sind zwei Seiten des Routers, die dieselbe zweigeteilte
// Ansicht zeichnen. Ein Klick auf einen Raum navigiert ohne Uebergang (WebLink:
// push, 'none'), aber die Zurueck-Taste des Browsers laeuft ueber Ionics
// Rueckwaerts-Uebergang: Die Ansicht rutscht ein Stueck zur Seite und blendet
// ueber die gleiche Ansicht -- bei einem Raumwechsel in einem Messenger wirkt
// das wie ein Ruckeln. Ionic liest die Einstellung `animated` bei jedem
// Uebergang neu (ion-router-outlet), sie laesst sich zur Laufzeit umlegen.
//
// Mitgezaehlt wird, wie viele Chat-Seiten gerade offen sind: Beim Wechsel baut
// die neue Seite sich auf, bevor oder nachdem die alte abgebaut ist -- ohne
// Zaehler stellte die alte Seite die Einstellung wieder an, nachdem die neue
// sie ausgeschaltet hat. Zurueckgestellt wird auf den Wert von vorher (wer
// "Bewegung reduzieren" eingestellt hat, hat sie ohnehin aus). Sie gilt auch
// fuer Fenster und Menues (Mitglieder, Umfrage): Sie erscheinen ohne
// Einblenden, wie der Rest der Web-Fassung.

import { useEffect } from 'react';
import { getConfig } from '@ionic/react';

let offeneSeiten = 0;
let vorherigerWert: boolean | undefined;

export function useOhneSeitenanimation(): void {
  useEffect(() => {
    const konfig = getConfig();
    if (!konfig) return;
    if (offeneSeiten === 0) vorherigerWert = konfig.getBoolean('animated', true);
    offeneSeiten += 1;
    konfig.set('animated', false);
    return () => {
      offeneSeiten -= 1;
      if (offeneSeiten === 0 && vorherigerWert !== undefined) {
        konfig.set('animated', vorherigerWert);
        vorherigerWert = undefined;
      }
    };
  }, []);
}
