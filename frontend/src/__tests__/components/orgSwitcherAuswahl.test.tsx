import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ReactNode } from 'react';

// Die Auswahlliste des Gemeinde-Umschalters (25.09.2026). Simon am Geraet:
// "der gruene Haken passt null ins Design, mach das ausgewaehlt fett und
// irgendwie waere es schoen, wenn der Name kuerzer und kleiner waere. Das
// nimmt viel Platz weg."
//
// Also: kein Haken mehr, die aktive Gemeinde steht fett und leicht hinterlegt
// (das Muster von app-list-item--selected), der Name am Knopf ist eine Stufe
// kleiner und in der Breite gedeckelt. Die roten Zahlen je Gemeinde bleiben.

type StubProps = { children?: ReactNode };

vi.mock('@ionic/react', () => ({
  IonButtons: (p: StubProps) => <div>{p.children}</div>,
  IonButton: (p: StubProps & { onClick?: (e: unknown) => void; className?: string; 'aria-label'?: string }) => (
    <button type="button" className={p.className} aria-label={p['aria-label']} onClick={() => p.onClick?.({ nativeEvent: {} })}>{p.children}</button>
  ),
  IonIcon: (p: { icon?: string; color?: string }) => <span data-testid="icon" data-icon={p.icon} data-color={p.color} />,
  IonPopover: (p: StubProps & { isOpen?: boolean }) => (p.isOpen ? <div data-testid="popover">{p.children}</div> : null),
  IonContent: (p: StubProps) => <div>{p.children}</div>,
  IonList: (p: StubProps) => <ul>{p.children}</ul>,
  IonListHeader: (p: StubProps) => <li>{p.children}</li>,
  IonItem: (p: StubProps & { onClick?: () => void; className?: string; 'aria-current'?: string }) => (
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
import { ICON_HAKEN_GEFUELLT, ICON_ORGANISATION, ICON_WECHSEL } from '../../components/shared/icons';

const lies = (relativ: string) => readFileSync(join(process.cwd(), relativ), 'utf8');

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

  it('traegt keinen gruenen Haken mehr -- in der Liste steht je Eintrag nur das Gemeinde-Symbol', () => {
    const { getAllByTestId } = oeffnen();
    const eintraege = getAllByTestId('org');
    expect(eintraege).toHaveLength(3);
    for (const eintrag of eintraege) {
      const icons = Array.from(eintrag.querySelectorAll('[data-testid="icon"]'));
      expect(icons).toHaveLength(1);
      expect(icons[0].getAttribute('data-icon')).toBe(ICON_ORGANISATION);
      expect(icons[0].getAttribute('data-color')).toBeNull();
    }
    expect(document.querySelector(`[data-icon="${ICON_HAKEN_GEFUELLT}"]`)).toBeNull();
    // Und der Haken wird gar nicht erst importiert.
    expect(lies('src/components/shared/OrgSwitcherButton.tsx')).not.toContain('ICON_HAKEN_GEFUELLT');
  });

  it('steht fett und hinterlegt: genau der aktive Eintrag traegt die Klasse und aria-current', () => {
    const { getAllByTestId } = oeffnen();
    const eintraege = getAllByTestId('org');
    // activeOrgId 2 (Hennstedt) schlaegt die Stamm-Gemeinde 1 (West).
    expect(eintraege[0].classList.contains('app-org-switcher__eintrag--aktiv')).toBe(false);
    expect(eintraege[1].classList.contains('app-org-switcher__eintrag--aktiv')).toBe(true);
    expect(eintraege[2].classList.contains('app-org-switcher__eintrag--aktiv')).toBe(false);
    expect(eintraege[0].getAttribute('aria-current')).toBeNull();
    expect(eintraege[1].getAttribute('aria-current')).toBe('true');
    expect(eintraege[2].getAttribute('aria-current')).toBeNull();
    // Alle drei tragen die Grundklasse; die Liste zeigt die vollen Namen.
    for (const eintrag of eintraege) expect(eintrag.classList.contains('app-org-switcher__eintrag')).toBe(true);
    expect(eintraege[1].querySelector('[data-testid="name"]')?.textContent).toBe('Kirchengemeinde Hennstedt');
  });

  it('das Fett und die Hinterlegung kommen aus dem Theme -- nach dem Muster von app-list-item--selected', () => {
    const css = lies('src/theme/variables.css');
    expect(css).toContain('ion-popover ion-item.app-org-switcher__eintrag--aktiv {\n  --background: rgba(var(--app-color-users-rgb), 0.08);\n}');
    expect(css).toContain('ion-popover ion-item.app-org-switcher__eintrag--aktiv ion-label {\n  font-weight: var(--app-schrift-fett);\n}');
    // Dasselbe Alpha wie bei jeder anderen Auswahl der App.
    expect(css).toContain('.app-list-item--selected { background: rgba(var(--app-color-konfis-rgb), 0.08); }');
  });

  it('die roten Zahlen je Gemeinde bleiben -- auch am aktiven Eintrag', async () => {
    const { getAllByTestId } = oeffnen();
    await waitFor(() => expect(getAllByTestId('offen')).toHaveLength(2));
    const eintraege = getAllByTestId('org');
    expect(eintraege[0].querySelector('[data-testid="offen"]')?.textContent).toBe('4');
    expect(eintraege[1].querySelector('[data-testid="offen"]')?.textContent).toBe('7');
    expect(eintraege[1].querySelector('[data-testid="offen"]')?.className).toBe('app-org-switcher__offen');
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

  it('ist eine Stufe kleiner (0.75rem statt 0.85rem) und in der Breite gedeckelt', () => {
    const css = lies('src/theme/variables.css');
    const anfang = css.indexOf('.app-org-switcher-btn .app-org-switcher-btn__name {');
    expect(anfang).toBeGreaterThan(0);
    const regel = css.slice(anfang, css.indexOf('}', anfang));
    expect(regel).toContain('font-size: var(--app-text-klein);');
    expect(regel).not.toContain('--app-text-sekundaer');
    expect(regel).toContain('max-width: 7em;');
    expect(regel).toContain('text-overflow: ellipsis;');
    expect(regel).toContain('white-space: nowrap;');
    // Die Tokens dahinter: klein ist wirklich kleiner als sekundaer.
    const typo = lies('src/theme/typografie.css');
    expect(typo).toContain('--app-text-klein: 0.75rem;');
    expect(typo).toContain('--app-text-sekundaer: 0.85rem;');
  });
});
