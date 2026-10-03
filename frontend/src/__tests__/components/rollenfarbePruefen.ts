// Gemeinsame Pruefung fuer die gerenderten Rollenfarben-Tests der
// Personenlisten (02.10.2026, Paket 2.4.0, Punkt 6).
//
// Eine Karte zeigt ihre Rolle an bis zu vier Stellen: Strich links, Kreis,
// Eck-Marke, Schrift. Jede Stelle muss die Klasse aus rollenDarstellung tragen
// (utils/rollenNamen) -- keine Klasse einer anderen Rolle, nicht mehr die
// allgemeine Team-Farbe (app-list-item--team, app-icon-circle--team) und keine
// Inline-Farbe, die die Klasse ueberstimmen koennte. Welche Farbe jede Klasse
// im Stylesheet traegt, prueft __tests__/utils/rollenFarben.test.ts.
import { expect } from 'vitest';
import { rollenDarstellung, type RollenDarstellung } from '../../utils/rollenNamen';

const ALLE = ['org_admin', 'admin', 'teamer', 'konfi'].map((r) => rollenDarstellung(r));
const ALT = ['app-list-item--team', 'app-icon-circle--team', 'app-corner-badge--team'];

/** Die Karte (.app-list-item) um den Text `name`. */
export const karteVon = (name: string, wurzel: ParentNode = document.body): HTMLElement => {
  const treffer = Array.from(wurzel.querySelectorAll('.app-list-item'))
    .filter((k) => Array.from(k.querySelectorAll('*')).some((e) => e.childNodes.length > 0
      && Array.from(e.childNodes).some((n) => n.nodeType === 3 && n.textContent?.trim() === name)));
  // Die innerste Karte -- Karten sind nicht verschachtelt, aber sicher ist sicher.
  const karte = treffer.find((k) => !treffer.some((t) => t !== k && k.contains(t)));
  expect(karte, `Karte von ${name}`).toBeTruthy();
  return karte as HTMLElement;
};

const nurDiese = (el: Element, soll: string, stelle: keyof Omit<RollenDarstellung, 'farbe'>, wer: string) => {
  expect(el.classList.contains(soll), `${wer}: ${stelle} ${soll} (hat: ${el.className})`).toBe(true);
  for (const andere of ALLE.map((d) => d[stelle]).filter((k) => k !== soll)) {
    expect(el.classList.contains(andere), `${wer}: ${stelle} ohne ${andere}`).toBe(false);
  }
  for (const alt of ALT) expect(el.classList.contains(alt), `${wer}: ${stelle} ohne ${alt}`).toBe(false);
};

export interface Stellen {
  kreis?: boolean;
  marke?: boolean;
  schrift?: boolean;
}

/**
 * Prueft eine Karte auf die Farbe der Rolle `rolle` -- an Strich und den
 * angegebenen Stellen (Vorgabe: alle vier).
 */
export const erwarteRollenfarbe = (
  karte: HTMLElement,
  rolle: string,
  wer: string,
  { kreis = true, marke = true, schrift = true }: Stellen = {},
) => {
  const d = rollenDarstellung(rolle);
  nurDiese(karte, d.strich, 'strich', wer);
  expect(karte.style.borderLeftColor, `${wer}: kein Inline-Strich`).toBe('');

  if (kreis) {
    const el = karte.querySelector('.app-icon-circle') as HTMLElement | null;
    expect(el, `${wer}: Kreis`).toBeTruthy();
    nurDiese(el!, d.kreis, 'kreis', wer);
    expect(el!.style.backgroundColor, `${wer}: kein Inline-Kreis`).toBe('');
  }
  if (marke) {
    const el = karte.querySelector('.app-corner-badge') as HTMLElement | null;
    expect(el, `${wer}: Eck-Marke`).toBeTruthy();
    nurDiese(el!, d.marke, 'marke', wer);
    expect(el!.style.backgroundColor, `${wer}: keine Inline-Marke`).toBe('');
  }
  if (schrift) {
    const el = karte.querySelector(`.${d.schrift}`);
    expect(el, `${wer}: Schrift ${d.schrift}`).toBeTruthy();
    for (const andere of ALLE.map((x) => x.schrift).filter((k) => k !== d.schrift)) {
      expect(karte.querySelector(`.${andere}`), `${wer}: keine Schrift ${andere}`).toBeNull();
    }
  }
};
