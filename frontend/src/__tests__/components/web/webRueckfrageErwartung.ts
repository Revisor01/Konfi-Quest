// Woran eine Rückfrage der Web-Fassung zu erkennen ist -- gemeinsam für die
// Tests der Stellen, die eine eigene Rückfrage in einem Fenster oder einer
// Zeile zeigen (wer: Suche nach `erwarteWebRueckfrage`). An dieser
// Kennzeichnung setzt theme/rueckfragen.css an: dasselbe Symbol und derselbe
// rot gefüllte Knopf wie bei den Rückfragen der App im Browser. jsdom rechnet
// keine Stile; geprüft wird die Kennzeichnung. Dass das Stylesheet dort die
// Farbpaare benutzt, deren Kontrast gerechnet ist, prüft
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
