// Daten einer Web-Seite laden -- eine Stelle fuer alle vier Seiten:
//   - der erste Abruf laeuft im Effekt, der Ladezustand ergibt sich daraus,
//     dass weder Daten noch Fehler da sind;
//   - beim Zurueckkehren auf die Seite (aus einer Mail, einer Anfrage) wird
//     still neu geladen, ohne Ladezustand -- gelesene Mails stehen nicht mehr
//     fett da, zugeordnete verschwinden;
//   - "neu laden" haelt die alten Daten stehen (kein Aufblitzen der
//     Platzhalter) und tauscht sie erst, wenn die neuen da sind.
// `lader` muss stabil sein (useCallback oder eine Funktion ausserhalb).

import { useCallback, useEffect, useRef, useState } from 'react';
import { useIonViewWillEnter } from '@ionic/react';

export interface WebDaten<T> {
  daten: T | null;
  /** Noch nichts da und noch kein Fehler: Platzhalter zeigen. */
  laedt: boolean;
  /** Der letzte Abruf ist gescheitert (ohne Daten: Fehlerzustand, mit Daten: alter Stand bleibt). */
  fehler: boolean;
  /** Zeitpunkt des letzten erfolgreichen Abrufs. */
  stand: Date | null;
  neuLaden: () => Promise<void>;
}

export function useWebDaten<T>(lader: () => Promise<T>): WebDaten<T> {
  const [daten, setDaten] = useState<T | null>(null);
  const [fehler, setFehler] = useState(false);
  const [stand, setStand] = useState<Date | null>(null);

  // Erst warten, dann Zustand setzen: Der Abruf laeuft im Effekt, dort soll
  // kein Zustand synchron wechseln -- gesetzt wird erst im Rueckruf des Versprechens.
  const holen = useCallback(
    (): Promise<void> => lader().then(
      (neu) => {
        setDaten(neu);
        setStand(new Date());
        setFehler(false);
      },
      () => { setFehler(true); },
    ),
    [lader],
  );

  useEffect(() => { void holen(); }, [holen]);

  const ersterEintritt = useRef(true);
  useIonViewWillEnter(() => {
    if (ersterEintritt.current) {
      ersterEintritt.current = false;
      return;
    }
    void holen();
  });

  const neuLaden = useCallback(() => {
    setFehler(false);
    return holen();
  }, [holen]);

  return { daten, laedt: daten === null && !fehler, fehler, stand, neuLaden };
}
