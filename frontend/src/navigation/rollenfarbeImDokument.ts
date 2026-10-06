import { useEffect } from 'react';
import { rollenFarbe } from '../utils/rollenNamen';

/**
 * Schreibt die Rollenfarbe der angemeldeten Person als `data-rolle` an
 * <html> (Web-Version). theme/web-ansicht.css leitet daraus --web-rolle ab:
 * gewählte Filter stehen in dieser Farbe (Simon, 06.10.2026: „nein
 * korrigieren" -- auf die Frage, ob sie in der Grundfarbe bleiben).
 *
 * Die Zuordnung Rolle -> Farbe steht an EINER Stelle (utils/rollenNamen.ts).
 * Ohne bekannte Rolle (Support-Konto, abgemeldet) steht kein Attribut; dann
 * gilt die Grundfarbe.
 */
export function useRollenfarbeImDokument(rolle?: string | null): void {
  const farbe = rollenFarbe(rolle);
  useEffect(() => {
    if (farbe === 'neutral') return undefined;
    const wurzel = document.documentElement;
    wurzel.dataset.rolle = farbe;
    return () => {
      delete wurzel.dataset.rolle;
    };
  }, [farbe]);
}
