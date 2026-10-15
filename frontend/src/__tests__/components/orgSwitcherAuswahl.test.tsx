import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import type { AriaAttributes, ReactNode } from 'react';

// Die Auswahlliste des Gemeinde-Umschalters (25.09.2026): jede Gemeinde des
// Kontos steht in der Liste, die aktive ist fuer Vorleseprogramme markiert
// (aria-current), die roten Zahlen je Gemeinde bleiben. Am Knopf steht die
// Kurzform, der volle Name im aria-label. Wie Auswahl und Name aussehen, legt
// kein Test fest (Simon, 15.10.2026).

type StubProps = { children?: ReactNode };

vi.mock('@ionic/react', () => ({
  IonButtons: (p: StubProps) => <div>{p.children}</div>,
  IonButton: (p: StubProps & { onClick?: (e: unknown) => void; className?: string; 'aria-label'?: string }) => (
    <button type="button" className={p.className} aria-label={p['aria-label']} onClick={() => p.onClick?.({ nativeEvent: {} })}>{p.children}</button>
  ),
  IonIcon: (p: { icon?: string }) => <span data-testid="icon" data-icon={p.icon} />,
  IonPopover: (p: StubProps & { isOpen?: boolean }) => (p.isOpen ? <div data-testid="popover">{p.children}</div> : null),
  IonContent: (p: StubProps) => <div>{p.children}</div>,
  IonList: (p: StubProps) => <ul>{p.children}</ul>,
  IonListHeader: (p: StubProps) => <li>{p.children}</li>,
  IonItem: (p: StubProps & { onClick?: () => void; className?: string; 'aria-current'?: AriaAttributes['aria-current'] }) => (
    <li data-testid="org" className={p.className} aria-current={p['aria-current']} onClick={p.onClick}>{p.children}</li>
  ),
  IonLabel: (p: StubProps) => <span data-testid="name">{p.children}</span>,
  IonBadge: (p: StubProps & { 'aria-label'?: string; className?: string }) => (
    <span data-testid="offen" className={p.className} aria-label={p['aria-label']}>{p.children}</span>
  ),
  useIonRouter: () => ({ push: vi.fn() }),
}));

const apiGet = vi.fn();
vi.mock('../../services/api', () => ({ default: { get: (...args: unknown[]) => apiGet(...args) } }));

const orgs = [
  { id: 1, name: 'Kirchspiel West', slug: 'kirchspiel-west', role_name: 'org_admin' },
  { id: 2, name: 'Kirchengemeinde Hennstedt', slug: 'kirchengemeinde-hennstedt', role_name: 'teamer' },
  { id: 4, name: 'Test-Demo', slug: 'test-demo', role_name: 'org_admin' },
];
vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({
    organizations: orgs,
    activeOrgId: 2,
    user: { organization_id: 1 },
    switchOrg: vi.fn(),
  }),
}));

import OrgSwitcherButton from '../../components/shared/OrgSwitcherButton';
import { ICON_WECHSEL } from '../../components/shared/icons';

const oeffnen = () => {
  const r = render(<OrgSwitcherButton />);
  fireEvent.click(r.container.querySelector('.app-org-switcher-btn')!);
  return r;
};

describe('Die aktive Gemeinde in der Auswahlliste', () => {
  beforeEach(() => {
    apiGet.mockReset();
    apiGet.mockResolvedValue({ data: { jeOrganisation: { 1: { offen: 4 }, 2: { offen: 7 } } } });
  });

  it('zeigt jede Gemeinde des Kontos als Eintrag', () => {
    const { getAllByTestId } = oeffnen();
    expect(getAllByTestId('org')).toHaveLength(3);
  });

  it('genau der aktive Eintrag traegt aria-current; die Liste zeigt die vollen Namen', () => {
    const { getAllByTestId } = oeffnen();
    const eintraege = getAllByTestId('org');
    // activeOrgId 2 (Hennstedt) schlaegt die Stamm-Gemeinde 1 (West).
    expect(eintraege[0].getAttribute('aria-current')).toBeNull();
    expect(eintraege[1].getAttribute('aria-current')).toBe('true');
    expect(eintraege[2].getAttribute('aria-current')).toBeNull();
    expect(eintraege[1].querySelector('[data-testid="name"]')?.textContent).toBe('Kirchengemeinde Hennstedt');
  });

  it('die roten Zahlen je Gemeinde bleiben -- auch am aktiven Eintrag', async () => {
    const { getAllByTestId } = oeffnen();
    await waitFor(() => expect(getAllByTestId('offen')).toHaveLength(2));
    const eintraege = getAllByTestId('org');
    expect(eintraege[0].querySelector('[data-testid="offen"]')?.textContent).toBe('4');
    expect(eintraege[1].querySelector('[data-testid="offen"]')?.textContent).toBe('7');
    expect(eintraege[2].querySelector('[data-testid="offen"]')).toBeNull();
  });
});

describe('Der Name am Knopf', () => {
  beforeEach(() => {
    apiGet.mockReset();
    apiGet.mockResolvedValue({ data: { jeOrganisation: {} } });
  });

  it('bleibt die Kurzform, der volle Name steht im aria-label -- man sieht, wo man ist', () => {
    const { container } = render(<OrgSwitcherButton />);
    const knopf = container.querySelector('.app-org-switcher-btn')!;
    expect(knopf.querySelector('.app-org-switcher-btn__name')?.textContent).toBe('Hennstedt');
    expect(knopf.getAttribute('aria-label')).toBe('Gemeinde wechseln, gerade Kirchengemeinde Hennstedt');
    expect(knopf.querySelector('[data-testid="icon"]')?.getAttribute('data-icon')).toBe(ICON_WECHSEL);
  });
});
