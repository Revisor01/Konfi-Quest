import { useEffect, useRef } from 'react';

/**
 * Eine Folge von Folien (Jahresrueckblick, „Was ist neu?") EINMAL beim
 * Schliessen melden -- mit der Angabe, ob die letzte Folie erreicht wurde
 * (docs/messung/umami.md, S7 und S16).
 *
 * WARUM BEIM SCHLIESSEN: Beim Oeffnen steht noch nicht fest, wie weit
 * jemand blaettert; zwei Meldungen (geoeffnet, dann am Ende) zaehlten
 * dieselbe Ansicht doppelt. Gemeldet wird beim Abbau der Komponente -- das
 * erfasst den Schliessen-Knopf, das Wegwischen des Fensters und das Ende
 * der Tour gleichermassen.
 *
 * Ohne Folien (Laden gescheitert, noch nicht freigeschaltet) wird nichts
 * gemeldet: Dann wurde nichts angesehen.
 *
 * @param melden  wird hoechstens einmal gerufen, mit `bisEnde`
 * @param anzahl  Zahl der Folien, 0 solange nichts zu sehen ist
 * @param index   die gerade gezeigte Folie
 */
export function useBisEndeMessung(
  melden: ((bisEnde: boolean) => void) | undefined,
  anzahl: number,
  index: number
): void {
  const stand = useRef({ anzahl: 0, weitester: 0 });
  const meldenRef = useRef(melden);

  useEffect(() => {
    meldenRef.current = melden;
  }, [melden]);

  useEffect(() => {
    stand.current.anzahl = anzahl;
    stand.current.weitester = Math.max(stand.current.weitester, index);
  }, [anzahl, index]);

  useEffect(() => () => {
    const { anzahl: n, weitester } = stand.current;
    if (n > 0) meldenRef.current?.(weitester >= n - 1);
  }, []);
}
