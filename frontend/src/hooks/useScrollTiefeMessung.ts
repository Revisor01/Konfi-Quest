import { useCallback, useRef } from 'react';
import { track } from '../services/analytics';

/**
 * Anonyme Messung der Scroll-Tiefe einer Startseite: Werden die unteren
 * Abschnitte ueberhaupt gesehen? Ereignis `dashboard-gescrollt` mit `tiefe`
 * 25 | 50 | 75 | 100; jede Marke NUR EINMAL, solange die Seite besteht (Ref
 * statt State, damit das Scrollen kein Rendern ausloest).
 *
 * Gemeinsam fuer die Startseite der Konfis (seit August) und die des Teams
 * (docs/messung/umami.md, S13) -- die Rolle trennt beide im Dashboard.
 *
 * Gebraucht an `<IonContent scrollEvents onIonScroll={...}>`.
 */
export function useScrollTiefeMessung(): (ev: CustomEvent) => void {
  const scrollMarken = useRef<Set<number>>(new Set());
  return useCallback((ev: CustomEvent) => {
    const el = ev.target as HTMLIonContentElement & { scrollHeight?: number; clientHeight?: number };
    // ion-content liefert im scroll-Ereignis { scrollTop, scrollLeft };
    // ein eigener Ionic-Typ dafuer ist nicht exportiert.
    const detail = (ev.detail || {}) as { scrollTop?: number };
    const hoehe = (el?.scrollHeight || 0) - (el?.clientHeight || 0);
    if (hoehe <= 0) return;
    const anteil = Math.round(((detail.scrollTop || 0) / hoehe) * 100);
    for (const marke of [25, 50, 75, 100]) {
      if (anteil >= marke && !scrollMarken.current.has(marke)) {
        scrollMarken.current.add(marke);
        track('dashboard-gescrollt', { tiefe: marke });
      }
    }
  }, []);
}
