// Liste oder Kacheln: die eine Wahl fuer Events, Challenges und Konfis in der
// Web-Fassung (Simon, 06.10.2026: „kacheln oder listen ... ein umschalter").
// Jede Seite hat einen Umschalter (WebAnsichtUmschalter); der Browser merkt
// sich die Wahl je Seite. Beim ersten Oeffnen startet die Leitung mit der
// Liste, Konfis und Team mit Kacheln.

import { useCallback, useState } from 'react';

export type WebAnsicht = 'liste' | 'kacheln';

/** Die Seiten mit Umschalter -- je Seite eine eigene Wahl. */
export type WebAnsichtSeite =
  | 'events-leitung'
  | 'events-mitglied'
  | 'challenges-leitung'
  | 'challenges-mitglied'
  | 'konfis';

const LEITUNG = new Set(['admin', 'org_admin', 'super_admin']);

/** Womit eine Seite beim ersten Oeffnen startet: Leitung Liste, Konfis und Team Kacheln. */
export function ansichtVorgabe(rolle?: string | null): WebAnsicht {
  return rolle && LEITUNG.has(rolle) ? 'liste' : 'kacheln';
}

export const ansichtSchluessel = (seite: WebAnsichtSeite): string => `konfiquest.ansicht.${seite}`;

// Speicher kann fehlen oder werfen (privates Fenster, gesperrte
// Website-Daten). Dann gilt die Vorgabe, und der Umschalter wirkt bis zum
// Neuladen -- wie bei der Leiste (layout/Seitenleiste.tsx).
const lesen = (seite: WebAnsichtSeite): WebAnsicht | null => {
  try {
    const wert = window.localStorage.getItem(ansichtSchluessel(seite));
    return wert === 'liste' || wert === 'kacheln' ? wert : null;
  } catch {
    return null;
  }
};

const merken = (seite: WebAnsichtSeite, ansicht: WebAnsicht): void => {
  try {
    window.localStorage.setItem(ansichtSchluessel(seite), ansicht);
  } catch {
    // Nicht merkbar -- die Wahl gilt trotzdem bis zum Neuladen.
  }
};

/** Die gemerkte Ansicht der Seite (sonst die Vorgabe) und die Funktion, sie zu wechseln. */
export function useAnsicht(seite: WebAnsichtSeite, vorgabe: WebAnsicht): [WebAnsicht, (a: WebAnsicht) => void] {
  const [ansicht, setAnsicht] = useState<WebAnsicht>(() => lesen(seite) ?? vorgabe);
  const waehlen = useCallback((a: WebAnsicht) => {
    setAnsicht(a);
    merken(seite, a);
  }, [seite]);
  return [ansicht, waehlen];
}
