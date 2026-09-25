import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';

// Indikatoren am Gemeinde-Umschalter (25.09.2026). Simon: "Koennen wir an den
// Switcher der Orgs an jede Org einen Indikator haengen? Das wuerde helfen,
// wenn was offen ist."
//
// Die Liste fragt beim Oeffnen einmal ab, was je Gemeinde offen ist, und zeigt
// die Zahl als rote Kugel am Eintrag. Gemeinden ohne Offenes bleiben ohne
// Zahl; ein alter Server ohne die Route laesst die Liste unveraendert.

type StubProps = { children?: ReactNode };

vi.mock('@ionic/react', () => ({
  IonButtons: (p: StubProps) => <div>{p.children}</div>,
  IonButton: (p: StubProps & { onClick?: (e: unknown) => void; className?: string }) => (
    <button type="button" className={p.className} onClick={() => p.onClick?.({ nativeEvent: {} })}>{p.children}</button>
  ),
  IonIcon: (p: { icon?: string }) => <span data-testid="icon" data-icon={p.icon} />,
  IonPopover: (p: StubProps & { isOpen?: boolean }) => (p.isOpen ? <div data-testid="popover">{p.children}</div> : null),
  IonContent: (p: StubProps) => <div>{p.children}</div>,
  IonList: (p: StubProps) => <ul>{p.children}</ul>,
  IonListHeader: (p: StubProps) => <li>{p.children}</li>,
  IonItem: (p: StubProps & { onClick?: () => void }) => <li data-testid="org" onClick={p.onClick}>{p.children}</li>,
  IonLabel: (p: StubProps) => <span>{p.children}</span>,
  IonBadge: (p: StubProps & { 'aria-label'?: string; className?: string }) => (
    <span data-testid="offen" className={p.className} aria-label={p['aria-label']}>{p.children}</span>
  ),
  useIonRouter: () => ({ push: vi.fn() }),
}));

const apiGet = vi.fn();
vi.mock('../../services/api', () => ({ default: { get: (...args: unknown[]) => apiGet(...args) } }));

const orgs = [
  { id: 1, name: 'West', slug: 'kirchspiel-west', role_name: 'org_admin' },
  { id: 2, name: 'Hennstedt', slug: 'kirchengemeinde-hennstedt', role_name: 'teamer' },
  { id: 4, name: 'Test', slug: 'test-demo', role_name: 'org_admin' },
];
let mockOrganizations: typeof orgs = orgs;
vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({
    organizations: mockOrganizations,
    activeOrgId: 1,
    user: { organization_id: 1 },
    switchOrg: vi.fn(),
  }),
}));

import OrgSwitcherButton, { offenJeOrgAusAntwort } from '../../components/shared/OrgSwitcherButton';

const PFAD = '/notifications/badge-counts/je-organisation';

const oeffnen = () => {
  const r = render(<OrgSwitcherButton />);
  fireEvent.click(r.container.querySelector('.app-org-switcher-btn')!);
  return r;
};

describe('offenJeOrgAusAntwort -- die Regel, ohne Rendern', () => {
  it('uebernimmt nur Gemeinden mit einer Zahl groesser 0', () => {
    expect(offenJeOrgAusAntwort({ jeOrganisation: { 1: { offen: 4 }, 2: { offen: 0 }, 4: { offen: 29 } } }))
      .toEqual({ 1: 4, 4: 29 });
  });

  it('Zahlen als Text werden gelesen, Unsinn wird 0', () => {
    expect(offenJeOrgAusAntwort({ jeOrganisation: { 1: { offen: '3' }, 2: { offen: 'x' } } })).toEqual({ 1: 3 });
  });

  it('alter Server ohne das Feld: leer, kein Fehler', () => {
    expect(offenJeOrgAusAntwort({})).toEqual({});
    expect(offenJeOrgAusAntwort(null)).toEqual({});
    expect(offenJeOrgAusAntwort({ jeOrganisation: 'kaputt' })).toEqual({});
  });
});

describe('OrgSwitcherButton mit Indikatoren', () => {
  beforeEach(() => {
    apiGet.mockReset();
    mockOrganizations = orgs;
  });

  it('fragt beim Oeffnen genau einmal die Zahlen je Gemeinde ab', async () => {
    apiGet.mockResolvedValue({ data: { jeOrganisation: {} } });
    oeffnen();
    await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(1));
    expect(apiGet).toHaveBeenCalledWith(PFAD);
  });

  it('zeigt 4 an West und 29 an Test, nichts an Hennstedt', async () => {
    apiGet.mockResolvedValue({ data: { jeOrganisation: { 1: { offen: 4 }, 2: { offen: 0 }, 4: { offen: 29 } } } });
    const { getAllByTestId } = oeffnen();

    await waitFor(() => expect(getAllByTestId('offen')).toHaveLength(2));
    const eintraege = getAllByTestId('org');
    expect(eintraege).toHaveLength(3);
    expect(eintraege[0].querySelector('[data-testid="offen"]')?.textContent).toBe('4');
    expect(eintraege[1].querySelector('[data-testid="offen"]')).toBeNull();
    expect(eintraege[2].querySelector('[data-testid="offen"]')?.textContent).toBe('29');
    // Screenreader lesen den Sinn, nicht nur die Zahl.
    expect(eintraege[0].querySelector('[data-testid="offen"]')?.getAttribute('aria-label')).toBe('4 offen');
  });

  it('ueber 99 wird 99+', async () => {
    apiGet.mockResolvedValue({ data: { jeOrganisation: { 4: { offen: 250 } } } });
    const { getAllByTestId } = oeffnen();
    await waitFor(() => expect(getAllByTestId('offen')).toHaveLength(1));
    expect(getAllByTestId('offen')[0].textContent).toBe('99+');
  });

  it('alter Server ohne die Route: Liste ohne Zahlen, kein Fehler', async () => {
    apiGet.mockRejectedValue(new Error('404'));
    const { getAllByTestId, queryAllByTestId } = oeffnen();
    await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(1));
    expect(getAllByTestId('org')).toHaveLength(3);
    expect(queryAllByTestId('offen')).toHaveLength(0);
  });

  it('mit nur einer Gemeinde gibt es weder Knopf noch Abfrage', () => {
    mockOrganizations = [orgs[0]];
    const { container } = render(<OrgSwitcherButton />);
    expect(container.querySelector('.app-org-switcher-btn')).toBeNull();
    expect(apiGet).not.toHaveBeenCalled();
  });
});
