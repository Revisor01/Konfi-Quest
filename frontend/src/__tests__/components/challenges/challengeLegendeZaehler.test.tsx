import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import ChallengeLegendModal from '../../../components/shared/ChallengeLegendModal';

// Die Legende erklaert die Zeichen so, wie sie seit dem 29.09.2026 gelten
// (Simon): rot am Symbol = neue Beitraege seit dem letzten Oeffnen, auch
// wartende; orange = nur Wartendes, am Eck-Badge, am Umschalter und am
// Reiter "Wartet".

afterEach(() => cleanup());

const zeile = (container: HTMLElement, titel: string) => {
  const kopf = [...container.querySelectorAll('div')].find((d) => d.children.length === 0 && d.textContent === titel);
  return kopf?.nextElementSibling?.textContent ?? null;
};

describe('Challenge-Legende: Zaehler', () => {
  it('rote Zahl am Symbol: neue Beitraege seit dem letzten Oeffnen, auch wartende, weg beim Oeffnen', () => {
    const { container } = render(<ChallengeLegendModal onClose={vi.fn()} />);
    expect(zeile(container, 'Rote Zahl am Symbol')).toBe(
      'Neue Beiträge seit deinem letzten Öffnen, auch solche, die noch auf Freigabe warten — wie ungelesene Nachrichten im Chat. Sie verschwindet beim Öffnen.'
    );
  });

  it('oranges Feld mit Zahl und Uhr: nur wartende, ohne Hinweis auf die rote Zahl', () => {
    const { container } = render(<ChallengeLegendModal onClose={vi.fn()} />);
    expect(zeile(container, 'Zahl mit Uhr')).toBe('So viele Beiträge warten auf Freigabe.');
    expect(container.textContent).not.toContain('zählen auch in der roten Zahl');
  });

  it('orange Zahl am Umschalter und an „Wartet": wartende Freigaben', () => {
    const { container } = render(<ChallengeLegendModal onClose={vi.fn()} />);
    const text = zeile(container, 'Orange Zahl am Umschalter und an „Wartet“');
    expect(text).toContain('So viele Beiträge warten auf Freigabe');
    expect(text).toContain('am Reiter „Wartet“');
    expect(text).toContain('Neue Beiträge zählen hier nicht mit.');
  });
});
