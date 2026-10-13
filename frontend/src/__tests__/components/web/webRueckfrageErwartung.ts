// Wie eine Rückfrage der Web-Fassung aussehen muss -- gemeinsam für den Test
// des WebDialog und die Tests der Stellen, die eine eigene Rückfrage zeigen
// („Ungespeicherte Änderungen" bei Event und Badge, „Eingaben verwerfen?"
// beim Anlegen einer Gemeinde, „Beitrag ausblenden", „Datei löschen" in der
// Zeile des Materials). Sie sollen aussehen wie die Rückfragen der App im
// Browser (theme/rueckfragen.css): Symbol vorn, der folgenreiche Knopf rot
// gefüllt. jsdom rechnet keine Stile; geprüft wird die Kennzeichnung, an der
// das Stylesheet ansetzt -- das Stylesheet selbst prüft
// __tests__/utils/rueckfragenOptik.test.tsx.
import { expect } from 'vitest';
import type { RueckfrageArt } from '../../../utils/rueckfragenOptik';

/**
 * Die Rückfrage ist als `.web-rueckfrage` gekennzeichnet (darin ist der
 * Gefahr-Knopf rot gefüllt), trägt genau ein Symbol der erwarteten Art als
 * erstes Element ihres Kopfes bzw. ihrer Zeile, für Vorleseprogramme
 * verborgen, und genau einen folgenreichen Knopf.
 */
export function erwarteWebRueckfrage(rueckfrage: HTMLElement, art: RueckfrageArt, folgenreich: string): void {
  expect(rueckfrage).toHaveClass('web-rueckfrage');
  const symbole = [...rueckfrage.querySelectorAll<HTMLElement>('.web-rueckfrage-symbol')];
  expect(symbole).toHaveLength(1);
  const [symbol] = symbole;
  expect(symbol).toHaveClass(`web-rueckfrage-symbol--${art}`);
  expect(symbol).toHaveAttribute('aria-hidden', 'true');
  expect(symbol.parentElement?.firstElementChild).toBe(symbol);
  expect([...rueckfrage.querySelectorAll('.web-knopf--gefahr')].map((k) => k.textContent?.trim())).toEqual([folgenreich]);
}
