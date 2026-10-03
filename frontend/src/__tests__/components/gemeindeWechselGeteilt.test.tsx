import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import type { ReactNode } from 'react';

// Der Wechsel steht nur EINMAL (hooks/useGemeindeWechsel.ts): Der Knopf in der
// Kopfzeile der App und die Flaeche unten in der Leiste der Web-Version
// (Simon, 03.10.2026) rufen beide denselben Hook -- keiner baut „wechseln,
// Startseite der Rolle, Stapel leeren" noch einmal nach.
//
// Beweis durch Rendern: Beide Komponenten laufen hier NUR mit dem Hook. Das
// Konto (useApp), die API und der Router sind so ersetzt, dass jeder eigene
// Zugriff darauf scheitert -- wuerde eine der beiden selbst wechseln,
// navigieren oder die Zahlen abfragen, fiele der Test mit diesem Fehler.

type StubProps = { children?: ReactNode };

const h = vi.hoisted(() => ({
  wechseln: vi.fn(),
  laden: vi.fn(),
}));

const GEMEINDEN = [
  { id: 1, name: 'Kirchspiel West', slug: 'kirchspiel-west', role_name: 'org_admin' },
  { id: 2, name: 'Kirchengemeinde Heide', slug: 'kirchengemeinde-heide', role_name: 'teamer' },
  { id: 3, name: 'Kirchengemeinde Musterdorf', slug: 'kirchengemeinde-musterdorf', role_name: 'konfi' },
];

vi.mock('../../hooks/useGemeindeWechsel', () => ({
  useGemeindeWechsel: () => ({
    gemeinden: GEMEINDEN, aktiveId: 1, aktive: GEMEINDEN[0], mehrere: true, wechseln: h.wechseln,
  }),
  useOffenJeGemeinde: () => ({ offenJeOrg: { 2: 5 }, laden: h.laden }),
}));

const eigenerZugriff = (was: string) => () => { throw new Error(`Eigener Zugriff auf ${was} -- gehoert in den Hook`); };
vi.mock('../../contexts/AppContext', () => ({ useApp: eigenerZugriff('das Konto') }));
vi.mock('../../services/api', () => ({ default: { get: eigenerZugriff('die API') } }));

vi.mock('@ionic/react', () => ({
  IonButtons: (p: StubProps) => <div>{p.children}</div>,
  IonButton: (p: StubProps & { onClick?: (e: unknown) => void; className?: string }) => (
    <button type="button" className={p.className} onClick={() => p.onClick?.({ nativeEvent: {} })}>{p.children}</button>
  ),
  IonIcon: () => <span />,
  IonPopover: (p: StubProps & { isOpen?: boolean }) => (p.isOpen ? <div data-testid="popover">{p.children}</div> : null),
  IonContent: (p: StubProps) => <div>{p.children}</div>,
  IonList: (p: StubProps) => <ul>{p.children}</ul>,
  IonListHeader: (p: StubProps) => <li>{p.children}</li>,
  IonItem: (p: StubProps & { onClick?: () => void }) => <li data-testid="org" onClick={p.onClick}>{p.children}</li>,
  IonLabel: (p: StubProps) => <span data-testid="name">{p.children}</span>,
  IonBadge: (p: StubProps) => <span data-testid="offen">{p.children}</span>,
  // useIonRouter fehlt absichtlich: Wer ihn aufruft, bekommt undefined.
}));

import OrgSwitcherButton from '../../components/shared/OrgSwitcherButton';
import LeistenGemeinde from '../../components/layout/LeistenGemeinde';

beforeEach(() => {
  h.wechseln.mockReset();
  h.wechseln.mockResolvedValue(undefined);
  h.laden.mockReset();
  h.laden.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
});

describe('Beide Umschalter wechseln ueber denselben Hook', () => {
  it('der Knopf der Kopfzeile: Liste oeffnen fragt die Zahlen ab, Auswahl ruft wechseln(id)', async () => {
    const { container } = render(<OrgSwitcherButton />);
    fireEvent.click(container.querySelector('.app-org-switcher-btn')!);
    expect(h.laden).toHaveBeenCalledTimes(1);

    const eintraege = screen.getAllByTestId('org');
    expect(eintraege).toHaveLength(3);
    await act(async () => { fireEvent.click(eintraege[1]); });
    expect(h.wechseln).toHaveBeenCalledTimes(1);
    expect(h.wechseln).toHaveBeenCalledWith(2);
  });

  it('die Flaeche in der Leiste: Liste oeffnen fragt die Zahlen ab, Auswahl ruft wechseln(id)', async () => {
    render(<LeistenGemeinde eingeklappt={false} />);
    fireEvent.click(screen.getByRole('button', { name: /^Gemeinde wechseln/ }));
    expect(h.laden).toHaveBeenCalledTimes(1);

    const eintraege = screen.getAllByRole('menuitemradio');
    expect(eintraege).toHaveLength(3);
    await act(async () => { fireEvent.click(eintraege[1]); });
    expect(h.wechseln).toHaveBeenCalledTimes(1);
    expect(h.wechseln).toHaveBeenCalledWith(2);
  });

  it('beide zeigen dieselben roten Zahlen aus demselben Hook', () => {
    const kopfzeile = render(<OrgSwitcherButton />);
    fireEvent.click(kopfzeile.container.querySelector('.app-org-switcher-btn')!);
    const inDerKopfzeile = screen.getAllByTestId('offen').map((b) => b.textContent);
    kopfzeile.unmount();

    render(<LeistenGemeinde eingeklappt={false} />);
    fireEvent.click(screen.getByRole('button', { name: /^Gemeinde wechseln/ }));
    const inDerLeiste = screen.getAllByTestId('offen').map((b) => b.textContent);

    expect(inDerKopfzeile).toEqual(['5']);
    expect(inDerLeiste).toEqual(inDerKopfzeile);
  });
});
