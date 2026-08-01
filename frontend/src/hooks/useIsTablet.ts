import { useEffect, useState } from 'react';

// Ab dieser Viewport-Breite ist Platz fuer einen Split-View (Liste + Detail
// nebeneinander). 900px liegt ueber der iPad-Hochformat-Breite (768px) und
// unter der Landscape-Breite des kleinsten iPads (1024px).
export const TABLET_MIN_WIDTH = 900;

// Zusaetzlich Querformat verlangt: Im Hochformat wird der Split ausdruecklich
// NICHT gewuenscht — dort bleibt die gewohnte einspaltige Ansicht mit der
// normalen Auswahl. Die Breiten-Bedingung allein wuerde iPad-Portrait
// (768px) zwar schon ausschliessen, das Orientierungs-Kriterium haelt das
// Verhalten aber auch auf groesseren Tablets eindeutig.
const QUERY = `(min-width: ${TABLET_MIN_WIDTH}px) and (orientation: landscape)`;

/**
 * True, wenn der Viewport breit genug UND im Querformat ist — nur dann wird
 * der Split-View gezeigt.
 *
 * Reagiert live auf Drehen des Geraets und auf Groessenaenderungen im
 * iPadOS-Multitasking (Slide Over / Split View halbieren die App-Breite —
 * dort soll die App wieder einspaltig laufen, deshalb Viewport- und nicht
 * Geraeteklassen-Abfrage).
 */
export const useIsTablet = (): boolean => {
  const [isTablet, setIsTablet] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(QUERY).matches;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const mql = window.matchMedia(QUERY);
    const handler = (e: MediaQueryListEvent) => setIsTablet(e.matches);

    // Startwert nachziehen (falls sich die Breite zwischen Render und Effect
    // geaendert hat, z.B. beim Rotieren waehrend des Mountens).
    setIsTablet(mql.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return isTablet;
};

export default useIsTablet;
