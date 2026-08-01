import { useEffect, useState } from 'react';

// Ab dieser Viewport-Breite gilt das Geraet als "breit genug" fuer einen
// Split-View (Liste + Detail nebeneinander). 768px entspricht dem iPad im
// Hochformat und der sw600dp-Grenze auf Android (600dp bei typischer
// Tablet-Dichte). Darunter bleibt die App bei der bisherigen
// Ein-Spalten-Navigation.
export const TABLET_MIN_WIDTH = 768;

const QUERY = `(min-width: ${TABLET_MIN_WIDTH}px)`;

/**
 * True, wenn der Viewport breit genug fuer einen Split-View ist.
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
