// Symbole der Kennzahlen in der Web-Fassung (Simon, 10.10.2026): Die
// Kennzahl-Kacheln oben tragen das Symbol ihrer Kennzahl in der Bereichsfarbe,
// und Badges/Zertifikate sehen in Tabelle und Karte gleich aus -- bis
// 10.10.2026 war das Badge-Symbol auf der Karte farbig, in der Tabelle grau.
// Alle lesen dieselbe Stelle (KENNZAHL_SYMBOL).
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, within } from '@testing-library/react';

vi.mock('@ionic/react', async () => ({
  ...(await import('../support/ionicAttrappe')).ionicAttrappe(),
  // Sichtbar statt null: geprueft werden Symbol und Farbe.
  IonIcon: ({ icon, className, style, 'aria-hidden': versteckt }: { icon?: string; className?: string; style?: React.CSSProperties; 'aria-hidden'?: React.AriaAttributes['aria-hidden'] }) => (
    <i data-testid="symbol" data-icon={icon} className={className} style={style} aria-hidden={versteckt} />
  ),
}));

import WebKachel from '../../../components/web/WebKachel';
import { KENNZAHL_SYMBOL } from '../../../components/web/kennzahlSymbole';
import WebKonfiTabelle from '../../../components/admin/web/leitung/WebKonfiTabelle';
import WebKonfiKacheln from '../../../components/admin/web/leitung/WebKonfiKacheln';
import WebTeamTabelle from '../../../components/admin/web/leitung/WebTeamTabelle';
import WebTeamKacheln from '../../../components/admin/web/leitung/WebTeamKacheln';
import { ICON_ABZEICHEN, ICON_DATEI } from '../../../components/shared/icons';

const KONFI = { id: 1, name: 'Anna Müller', username: 'anna', jahrgang_name: 'Jahrgang 2026', badgeCount: 3, gottesdienst_points: 2, gemeinde_points: 1 };
const TEAMER = { id: 2, name: 'Robin Probe', username: 'robin', badge_count: 5, cert_count: 2 };
const sortierung = { schluessel: 'name', richtung: 'auf' as const };

/** Das Symbol (Glyph und Farbe) vor einer Zahl, als Paar. */
const symbolVon = (wurzel: HTMLElement) => {
  const s = within(wurzel).getByTestId('symbol');
  return { icon: s.getAttribute('data-icon'), farbe: s.style.color };
};

describe('WebKachel: Symbol vor dem Etikett', () => {
  it('mit symbol: Glyph und Bereichsfarbe vor dem Etikett, ohne Einfluss auf den Namen fuer Vorleseprogramme', () => {
    render(<WebKachel symbol={KENNZAHL_SYMBOL.badges} label="Badges" wert="8" />);
    const kachel = screen.getByRole('group', { name: 'Badges: 8' });
    expect(symbolVon(kachel)).toEqual({ icon: ICON_ABZEICHEN, farbe: 'var(--app-color-badges)' });
    expect(within(kachel).getByTestId('symbol')).toHaveClass('web-kachel__symbol');
    expect(within(kachel).getByTestId('symbol')).toHaveAttribute('aria-hidden', 'true');
    expect(kachel.querySelector('.web-kachel__titel')).toHaveTextContent('Badges');
  });

  it('ohne symbol: kein Symbol, das Etikett steht wie bisher direkt da', () => {
    render(<WebKachel label="Badges" wert="8" />);
    const kachel = screen.getByRole('group', { name: 'Badges: 8' });
    expect(within(kachel).queryByTestId('symbol')).toBeNull();
    expect(kachel.querySelector('.web-kachel__titel')).toBeNull();
    expect(kachel.querySelector('.web-kachel__label')).toHaveTextContent('Badges');
  });
});

describe('Badges und Zertifikate: Tabelle wie Karte', () => {
  it('Konfi-Tabelle: Badge-Symbol in der Badge-Farbe -- dasselbe wie auf der Karte', () => {
    render(<WebKonfiTabelle konfis={[KONFI]} suche="" sortierung={sortierung} onSortieren={vi.fn()} />);
    const zelle = screen.getByTitle('3 Badges');
    expect(symbolVon(zelle)).toEqual({ icon: ICON_ABZEICHEN, farbe: 'var(--app-color-badges)' });
  });

  it('Konfi-Karte: dasselbe Badge-Symbol in derselben Farbe', () => {
    render(<WebKonfiKacheln konfis={[KONFI]} suche="" />);
    const badge = screen.getAllByTestId('symbol').find((s) => s.getAttribute('data-icon') === ICON_ABZEICHEN) as HTMLElement;
    expect(badge.style.color).toBe('var(--app-color-badges)');
  });

  it('Team-Tabelle: Badges und Zertifikate farbig, genau wie auf der Team-Karte', () => {
    render(<WebTeamTabelle team={[TEAMER]} suche="" sortierung={sortierung} onSortieren={vi.fn()} />);
    expect(symbolVon(screen.getByTitle('5 Badges'))).toEqual({ icon: ICON_ABZEICHEN, farbe: 'var(--app-color-badges)' });
    expect(symbolVon(screen.getByTitle('2 Zertifikate'))).toEqual({ icon: ICON_DATEI, farbe: 'var(--app-color-zertifikate)' });
  });

  it('Team-Karte: Badges und Zertifikate in denselben Farben', () => {
    render(<WebTeamKacheln team={[TEAMER]} suche="" />);
    const farbeVon = (icon: string) =>
      (screen.getAllByTestId('symbol').find((s) => s.getAttribute('data-icon') === icon) as HTMLElement).style.color;
    expect(farbeVon(ICON_ABZEICHEN)).toBe('var(--app-color-badges)');
    expect(farbeVon(ICON_DATEI)).toBe('var(--app-color-zertifikate)');
  });
});
