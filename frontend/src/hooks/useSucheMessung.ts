import { useEffect, useRef } from 'react';
import { trackHandlung } from '../services/analytics';

/**
 * Wird die Suche gebraucht? (docs/messung/umami.md, S15)
 *
 * Meldet `suche-genutzt` mit dem festen `bereich`, sobald im Suchfeld zum
 * ersten Mal etwas steht -- EINMAL je Oeffnen der Seite, nicht je
 * Tastendruck. NIE der Suchbegriff: Er geht in diese Funktion hinein, aber
 * nur als „leer oder nicht".
 *
 * Wechselt der Bereich (Konfis -> Team in derselben Ansicht), darf er noch
 * einmal melden; es ist eine andere Liste.
 */
export function useSucheMessung(bereich: 'material' | 'konfis' | 'team', suchbegriff: string | null | undefined): void {
  const gemeldet = useRef<Set<string>>(new Set());
  const sucht = typeof suchbegriff === 'string' && suchbegriff.trim() !== '';
  useEffect(() => {
    if (!sucht || gemeldet.current.has(bereich)) return;
    gemeldet.current.add(bereich);
    trackHandlung('suche-genutzt', { bereich });
  }, [sucht, bereich]);
}
