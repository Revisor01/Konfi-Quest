// Symbole der Kennzahlen in der Web-Fassung (Simon, 10.10.2026): Die
// Kennzahl-Kacheln oben tragen das Symbol ihrer Kennzahl (KENNZAHL_SYMBOL).
// Welches Symbol in welcher Farbe, ist Layout und wird nicht festgeschrieben
// (Simon, 15.10.2026); geprueft wird, dass es Vorleseprogrammen nichts
// hinzufuegt.
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, within } from '@testing-library/react';

vi.mock('@ionic/react', async () => ({
  ...(await import('../support/ionicAttrappe')).ionicAttrappe(),
  // Sichtbar statt null: geprueft wird, dass das Symbol verborgen ist.
  IonIcon: ({ 'aria-hidden': versteckt }: { 'aria-hidden'?: React.AriaAttributes['aria-hidden'] }) => (
    <i data-testid="symbol" aria-hidden={versteckt} />
  ),
}));

import WebKachel from '../../../components/web/WebKachel';
import { KENNZAHL_SYMBOL } from '../../../components/web/kennzahlSymbole';

describe('WebKachel: Symbol vor dem Etikett', () => {
  it('mit symbol: das Symbol ist fuer Vorleseprogramme verborgen, der Name der Kachel bleibt', () => {
    render(<WebKachel symbol={KENNZAHL_SYMBOL.badges} label="Badges" wert="8" />);
    const kachel = screen.getByRole('group', { name: 'Badges: 8' });
    expect(within(kachel).getByTestId('symbol')).toHaveAttribute('aria-hidden', 'true');
  });
});
