import { describe, it, expect } from 'vitest';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { render, screen } from '@testing-library/react';
import SpiritFooter from '../../../components/shared/SpiritFooter';

// Der Abschluss der Profilseiten: "Made with [Taube] in Hennstedt" und der
// Friedensgruß in drei Sprachen (Audit Tests 26.09.2026, BF-10: ohne Test).

const PUBLIC = resolve(__dirname, '../../../../public');

describe('SpiritFooter', () => {
  it('liest sich als ein Satz: "Made with", die Taube, "in Hennstedt"', () => {
    const { container } = render(<SpiritFooter />);
    const zeile = container.firstElementChild!.firstElementChild as HTMLElement;
    expect([...zeile.children].map((k) => k.textContent || k.getAttribute('alt'))).toEqual([
      'Made with',
      'Friedenstaube',
      'in Hennstedt',
    ]);
  });

  it('die Taube hat einen Alternativtext und zeigt auf ein mitgeliefertes Bild', () => {
    render(<SpiritFooter />);
    const taube = screen.getByRole('img', { name: 'Friedenstaube' });
    const quelle = taube.getAttribute('src')!;
    expect(quelle).toBe('/assets/branding/bird.png');
    // Kein Netzabruf: Das Bild liegt im Frontend und wird mitgeliefert.
    expect(existsSync(resolve(PUBLIC, `.${quelle}`))).toBe(true);
  });

  it('schließt mit dem Friedensgruß', () => {
    const { container } = render(<SpiritFooter />);
    expect(container.firstElementChild!.lastElementChild!.textContent).toBe('Friede. Schalom. Salam.');
  });
});
