import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { BREITE_SEITENLEISTE } from '../../navigation/breitesLayout';

// Die Kopfzeile im breiten Fenster der Web-Version (Simon, 03.10.2026): „In
// der Webansicht ist der Switcher für die Org unten in der Navi, das finde
// ich gut, aber auch aktuell noch im Header, das finde ich doof." Ab 992 px im
// Browser steht der Gemeinde-Umschalter nur noch unten in der Leiste; in der
// App und im schmalen Fenster bleibt die Kopfzeile, wie sie ist. Die Prop
// `gemeindeUmschalter` behaelt ihre Bedeutung.
//
// Gerendert wird die echte AppKopfzeile; ersetzt sind Ionic (schlichte
// Elemente), die beiden Knoepfe, die Plattform (Capacitor) und die
// Fensterbreite (matchMedia) -- wie in navigation/seitenleiste.test.tsx.

type StubProps = { children?: ReactNode };

const halter = vi.hoisted(() => ({ nativ: false, breit: false }));

vi.mock('@capacitor/core', async (importOriginal) => {
  const echt = await importOriginal<typeof import('@capacitor/core')>();
  return {
    ...echt,
    Capacitor: { ...echt.Capacitor, isNativePlatform: () => halter.nativ, getPlatform: () => (halter.nativ ? 'ios' : 'web') },
  };
});

vi.mock('@ionic/react', () => ({
  IonHeader: (p: StubProps) => <header>{p.children}</header>,
  IonToolbar: (p: StubProps) => <div>{p.children}</div>,
  IonTitle: (p: StubProps) => <h1>{p.children}</h1>,
  IonButtons: (p: StubProps & { slot?: string }) => <div data-testid={`knoepfe-${p.slot}`}>{p.children}</div>,
  IonButton: (p: StubProps & { onClick?: () => void; 'aria-label'?: string }) => (
    <button type="button" onClick={p.onClick} aria-label={p['aria-label']}>{p.children}</button>
  ),
  IonIcon: () => <span />,
}));

vi.mock('../../components/shared/OrgSwitcherButton', () => ({
  default: () => <span data-testid="gemeinde-umschalter" />,
}));
vi.mock('../../components/shared/PostfachGlocke', () => ({
  default: () => <span data-testid="glocke" />,
}));

import AppKopfzeile from '../../components/shared/AppKopfzeile';

type Horcher = (ereignis: { matches: boolean }) => void;
const horcher = new Set<Horcher>();
const setzeBreite = (breit: boolean) => {
  halter.breit = breit;
  act(() => { horcher.forEach((h) => h({ matches: breit })); });
};

beforeEach(() => {
  halter.nativ = false;
  halter.breit = false;
  horcher.clear();
  window.matchMedia = vi.fn((abfrage: string) => ({
    get matches() { return abfrage === `(min-width: ${BREITE_SEITENLEISTE}px)` && halter.breit; },
    media: abfrage,
    onchange: null,
    addEventListener: (_: string, h: Horcher) => horcher.add(h),
    removeEventListener: (_: string, h: Horcher) => horcher.delete(h),
    addListener: (h: Horcher) => horcher.add(h),
    removeListener: (h: Horcher) => horcher.delete(h),
    dispatchEvent: () => true,
  })) as unknown as typeof window.matchMedia;
});

afterEach(() => {
  cleanup();
});

const umschalter = () => screen.queryByTestId('gemeinde-umschalter');

describe('Kopfzeile im breiten Fenster der Web-Version', () => {
  it('Web, 992 px und breiter: kein Gemeinde-Umschalter -- er steht unten in der Leiste', () => {
    halter.breit = true;
    render(<AppKopfzeile titel="Konfis" />);
    expect(umschalter()).toBeNull();
    // Der Rest der Kopfzeile bleibt: Titel und Glocke.
    expect(screen.getByRole('heading', { name: 'Konfis' })).toBeInTheDocument();
    expect(screen.getByTestId('glocke')).toBeInTheDocument();
  });

  it('Web, schmales Fenster: der Umschalter steht wie bisher in der Kopfzeile', () => {
    render(<AppKopfzeile titel="Konfis" />);
    expect(umschalter()).not.toBeNull();
  });

  it('App auf dem Geraet, auch breit (iPad quer): der Umschalter steht wie bisher in der Kopfzeile', () => {
    halter.nativ = true;
    halter.breit = true;
    render(<AppKopfzeile titel="Konfis" />);
    expect(umschalter()).not.toBeNull();
  });

  it('Fenster ueber 992 px gezogen und wieder schmal: der Umschalter geht und kommt', () => {
    render(<AppKopfzeile titel="Konfis" />);
    expect(umschalter()).not.toBeNull();

    setzeBreite(true);
    expect(umschalter()).toBeNull();

    setzeBreite(false);
    expect(umschalter()).not.toBeNull();
  });
});

describe('Die Prop gemeindeUmschalter behaelt ihre Bedeutung', () => {
  it('false blendet ihn auch im schmalen Fenster und in der App aus', () => {
    const { unmount } = render(<AppKopfzeile titel="Detail" gemeindeUmschalter={false} />);
    expect(umschalter()).toBeNull();
    unmount();

    halter.nativ = true;
    halter.breit = true;
    render(<AppKopfzeile titel="Detail" gemeindeUmschalter={false} />);
    expect(umschalter()).toBeNull();
  });

  it('true bringt ihn im breiten Fenster nicht zurueck -- die Leiste hat ihn', () => {
    halter.breit = true;
    render(<AppKopfzeile titel="Konfis" gemeindeUmschalter />);
    expect(umschalter()).toBeNull();
  });
});
