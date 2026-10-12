// Wie oft eine Seite wieder betreten wurde, seit Ionic sie im Speicher hält
// -- 0 beim ersten Betreten.
//
// Ionic baut eine Seite nicht neu, wenn man auf sie zurückkehrt, auch nicht
// über einen Link mit derselben Adresse (Übersicht → /admin/support/vorgaenge/1
// zweimal hintereinander). Zustand, der aus der Adresse kommt (gewählter
// Eintrag, ?mail=, „Breit lesen" je Gerät), zieht mit dieser Zahl nach --
// beim Rendern, nicht in einem Effekt:
//
//   const eintritt = useWiedereintritt();
//   const [gesehen, setGesehen] = useState(eintritt);
//   if (eintritt !== gesehen) { setGesehen(eintritt); … }
//
// Das erste ionViewWillEnter kommt beim Öffnen selbst und zählt nicht -- wie
// in components/web/useWebDaten.ts und utils/supportAktualisieren.ts.

import { useRef, useState } from 'react';
import { useIonViewWillEnter } from '@ionic/react';

export function useWiedereintritt(): number {
  const [eintritte, setEintritte] = useState(0);
  const erster = useRef(true);
  useIonViewWillEnter(() => {
    if (erster.current) {
      erster.current = false;
      return;
    }
    setEintritte((n) => n + 1);
  });
  return eintritte;
}
