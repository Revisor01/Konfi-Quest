// Chat anlegen: jede Person in der Farbe ihrer Rolle -- an Strich, Kreis,
// Eck-Marke und Schrift (02.10.2026, Paket 2.4.0, Punkt 6).
//
// Nachgestellt: Die Auswahlliste warf role_name beim Uebernehmen der
// Team-Kontakte (GET /chat/team-contacts) und der Kontakte der Konfis
// (GET /chat/available-users) weg -- beide liefern die Rolle in dieser
// Gemeinde mit. Die Eck-Marke fiel damit fuer jede Leitung auf den Rueckfall
// Beere; Strich und Kreis trugen ohnehin die allgemeine Team-Farbe.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { karteVon, erwarteRollenfarbe } from './rollenfarbePruefen';

const apiGet = vi.fn();
vi.mock('../../services/api', () => ({
  default: { get: (...a: unknown[]) => apiGet(...a), post: vi.fn() },
}));
let angemeldet: Record<string, unknown> = { id: 4, type: 'admin', role_name: 'admin', organization_id: 1 };
vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({ user: angemeldet, setError: vi.fn(), setSuccess: vi.fn(), isOnline: true }),
}));
vi.mock('../../contexts/BadgeContext', () => ({ useBadge: () => ({ refreshFromAPI: vi.fn() }) }));
vi.mock('../../utils/haptics', () => ({ triggerPullHaptic: vi.fn(), haptik: vi.fn() }));
vi.mock('@ionic/react', async (original) => ({
  ...(await original<typeof import('@ionic/react')>()),
  IonButton: ({ children, onClick, disabled, 'aria-label': name }: {
    children?: React.ReactNode; onClick?: () => void; disabled?: boolean; 'aria-label'?: string;
  }) => <button type="button" aria-label={name} onClick={onClick} disabled={disabled}>{children}</button>,
  // Das Segment als Knoepfe: ein Tipp setzt den Wert wie Ionic.
  IonSegment: ({ children, onIonChange }: {
    children?: React.ReactNode; onIonChange?: (e: { detail: { value: string } }) => void;
  }) => (
    <div onClick={(e) => {
      const wert = (e.target as HTMLElement).closest('[data-wert]')?.getAttribute('data-wert');
      if (wert) onIonChange?.({ detail: { value: wert } });
    }}>{children}</div>
  ),
  IonSegmentButton: ({ children, value }: { children?: React.ReactNode; value?: string }) =>
    <button type="button" data-wert={value}>{children}</button>,
  useIonAlert: () => [vi.fn(), vi.fn()],
}));

import SimpleCreateChatModal from '../../components/chat/modals/SimpleCreateChatModal';

// GET /chat/team-contacts (chat.js, TEAM_MITGLIED_ROLLE): Rolle in DIESER Gemeinde.
const TEAM = [
  { id: 15, display_name: 'Greta Gemeindeleitung', role_name: 'org_admin', role_description: 'Gemeindeleitung' },
  { id: 14, display_name: 'Lena Leitung', role_name: 'admin', role_description: 'Leitung' },
  { id: 13, display_name: 'Theo Teamer', role_name: 'teamer', role_description: 'Teamer:in' },
];
const KONFIS = [{ id: 21, name: 'Karl Konfi', jahrgang_id: 1, jahrgang_name: '2026' }];
// GET /chat/available-users (nur fuer Konfis): ebenfalls mit role_name.
const KONTAKTE_DER_KONFI = {
  users: [
    { id: 15, name: 'Greta Gemeindeleitung', type: 'admin', role_name: 'org_admin', role_description: 'Gemeindeleitung', jahrgang_name: null },
    { id: 14, name: 'Lena Leitung', type: 'admin', role_name: 'admin', role_description: 'Leitung', jahrgang_name: null },
    { id: 13, name: 'Theo Teamer', type: 'teamer', role_name: 'teamer', role_description: 'Teamer:in', jahrgang_name: null },
  ],
  jahrgang: '2026',
};

beforeEach(() => {
  vi.clearAllMocks();
  angemeldet = { id: 4, type: 'admin', role_name: 'admin', organization_id: 1 };
  apiGet.mockImplementation(async (pfad: string) => {
    if (pfad === '/chat/team-contacts') return { data: TEAM };
    if (pfad === '/admin/konfis') return { data: KONFIS };
    if (pfad === '/users/me/jahrgaenge') return { data: [{ id: 1, name: '2026' }] };
    if (pfad === '/chat/available-users') return { data: KONTAKTE_DER_KONFI };
    return { data: [] };
  });
});
afterEach(() => cleanup());

const oeffne = async () => {
  render(<SimpleCreateChatModal onClose={vi.fn()} onSuccess={vi.fn()} />);
  for (let i = 0; i < 5; i += 1) await act(async () => { await Promise.resolve(); });
};

describe('Chat anlegen als Leitung: Rollenfarbe an allen vier Stellen', () => {
  it('Direktnachricht: Gemeindeleitung Indigo, Leitung Petrol, Teamer:in Beere; Konfi wie bisher', async () => {
    await oeffne();
    erwarteRollenfarbe(karteVon('Greta Gemeindeleitung'), 'org_admin', 'Gemeindeleitung');
    erwarteRollenfarbe(karteVon('Lena Leitung'), 'admin', 'Leitung');
    erwarteRollenfarbe(karteVon('Theo Teamer'), 'teamer', 'Teamer:in');
    erwarteRollenfarbe(karteVon('Karl Konfi'), 'konfi', 'Konfi', { schrift: false });
  });

  it('Gruppenchat: die Auswahl faerbt den Grund in der Rollenfarbe, nicht pauschal Beere', async () => {
    await oeffne();
    fireEvent.click(screen.getByText('Gruppenchat'));
    for (let i = 0; i < 5; i += 1) await act(async () => { await Promise.resolve(); });

    fireEvent.click(karteVon('Greta Gemeindeleitung'));
    const greta = karteVon('Greta Gemeindeleitung');
    expect(greta.classList.contains('app-list-item--selected')).toBe(true);
    expect(greta.classList.contains('app-list-item--users')).toBe(true);
    expect(greta.style.background).toBe('');
    erwarteRollenfarbe(greta, 'org_admin', 'Gemeindeleitung ausgewaehlt');
  });
});

describe('Chat anlegen als Konfi: das Team in den Farben seiner Rollen', () => {
  it('Gemeindeleitung, Leitung und Teamer:in aus GET /chat/available-users', async () => {
    angemeldet = { id: 1, type: 'konfi', role_name: 'konfi', organization_id: 1 };
    await oeffne();
    erwarteRollenfarbe(karteVon('Greta Gemeindeleitung'), 'org_admin', 'Gemeindeleitung');
    erwarteRollenfarbe(karteVon('Lena Leitung'), 'admin', 'Leitung');
    erwarteRollenfarbe(karteVon('Theo Teamer'), 'teamer', 'Teamer:in');
  });
});
