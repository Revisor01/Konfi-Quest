// Symbole der Kennzahlen in der Web-Fassung (Simon, 10.10.2026): Die
// Kennzahl-Kacheln oben tragen das Symbol ihrer Kennzahl in der Bereichsfarbe,
// und Badges/Zertifikate sehen in Tabelle und Karte gleich aus -- bis
// 10.10.2026 war das Badge-Symbol auf der Karte farbig, in der Tabelle grau.
// Alle lesen dieselbe Stelle (KENNZAHL_SYMBOL).
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, within, fireEvent } from '@testing-library/react';

const h = vi.hoisted(() => ({
  standort: { pathname: '/admin/konfis', search: '' },
  apiGet: vi.fn(),
}));

vi.mock('@ionic/react', async () => ({
  ...(await import('../support/ionicAttrappe')).ionicAttrappe(),
  // Sichtbar statt null: geprueft werden Symbol und Farbe.
  IonIcon: ({ icon, className, style, 'aria-hidden': versteckt }: { icon?: string; className?: string; style?: React.CSSProperties; 'aria-hidden'?: React.AriaAttributes['aria-hidden'] }) => (
    <i data-testid="symbol" data-icon={icon} className={className} style={style} aria-hidden={versteckt} />
  ),
}));
// Konfis und Team stehen seit 10.10.2026 in einer Seite (WebKonfis auf WebListenSeite):
// gerendert wird die Seite, Daten und Konto sind nachgestellt.
vi.mock('../../../components/shared/AppKopfzeile', async () => (await import('../support/ionicAttrappe')).KopfzeileAttrappe);
vi.mock('../../../components/shared/WartungsHinweis', () => ({ default: () => null }));
vi.mock('../../../components/shared/TrialBanner', () => ({ default: () => null }));
vi.mock('../../../services/api', () => ({ default: { get: h.apiGet } }));
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({ user: { id: 9, role_name: 'org_admin', organization_id: 1 }, setError: vi.fn(), setSuccess: vi.fn(), isOnline: true }),
}));
vi.mock('../../../navigation/useAppLocation', () => ({ useAppLocation: () => h.standort }));

import WebKachel from '../../../components/web/WebKachel';
import { KENNZAHL_SYMBOL } from '../../../components/web/kennzahlSymbole';
import WebKonfis from '../../../components/admin/web/leitung/WebKonfis';
import { ICON_ABZEICHEN, ICON_DATEI } from '../../../components/shared/icons';

const KONFI = { id: 1, name: 'Anna Müller', username: 'anna', jahrgang_name: 'Jahrgang 2026', badgeCount: 3, gottesdienst_points: 2, gemeinde_points: 1 };
const TEAMER = { id: 2, name: 'Robin Probe', username: 'robin', badge_count: 5, cert_count: 2 };

/** Die Seite Konfis bzw. Team, in der Ansicht Liste oder Kacheln. */
const zeigen = async (reiter: 'konfis' | 'team', ansicht: 'Liste' | 'Kacheln') => {
  window.localStorage.clear();
  h.standort = { pathname: '/admin/konfis', search: reiter === 'team' ? '?filter=team' : '' };
  h.apiGet.mockResolvedValue({ data: [TEAMER] });
  render(
    <WebKonfis konfis={[KONFI]} jahrgaenge={[{ id: 1, name: 'Jahrgang 2026' }]} laedt={false} ohneJahrgang={false}
      onKonfiAnlegen={vi.fn()} onTeamAnlegen={vi.fn()} onMatrix={vi.fn()} onKonfiLoeschen={vi.fn()} onTeamerLoeschen={vi.fn()} />,
  );
  if (reiter === 'team') await screen.findByRole('table', { name: 'Team' });
  fireEvent.click(within(screen.getByRole('group', { name: 'Ansicht' })).getByRole('button', { name: ansicht }));
};

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
  it('Konfi-Tabelle: Badge-Symbol in der Badge-Farbe -- dasselbe wie auf der Karte', async () => {
    await zeigen('konfis', 'Liste');
    const zelle = screen.getByTitle('3 Badges');
    expect(symbolVon(zelle)).toEqual({ icon: ICON_ABZEICHEN, farbe: 'var(--app-color-badges)' });
  });

  it('Konfi-Karte: dasselbe Badge-Symbol in derselben Farbe', async () => {
    await zeigen('konfis', 'Kacheln');
    const badge = within(screen.getByRole('list', { name: 'Konfis' })).getAllByTestId('symbol').find((s) => s.getAttribute('data-icon') === ICON_ABZEICHEN) as HTMLElement;
    expect(badge.style.color).toBe('var(--app-color-badges)');
  });

  it('Team-Tabelle: Badges und Zertifikate farbig, genau wie auf der Team-Karte', async () => {
    await zeigen('team', 'Liste');
    expect(symbolVon(screen.getByTitle('5 Badges'))).toEqual({ icon: ICON_ABZEICHEN, farbe: 'var(--app-color-badges)' });
    expect(symbolVon(screen.getByTitle('2 Zertifikate'))).toEqual({ icon: ICON_DATEI, farbe: 'var(--app-color-zertifikate)' });
  });

  it('Team-Karte: Badges und Zertifikate in denselben Farben', async () => {
    await zeigen('team', 'Kacheln');
    const karten = screen.getByRole('list', { name: 'Team' });
    const farbeVon = (icon: string) =>
      (within(karten).getAllByTestId('symbol').find((s) => s.getAttribute('data-icon') === icon) as HTMLElement).style.color;
    expect(farbeVon(ICON_ABZEICHEN)).toBe('var(--app-color-badges)');
    expect(farbeVon(ICON_DATEI)).toBe('var(--app-color-zertifikate)');
  });
});
