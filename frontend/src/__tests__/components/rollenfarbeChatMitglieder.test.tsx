// Chat-Mitglieder und "Mitglied hinzufügen": jede Person in der Farbe ihrer
// Rolle -- an Strich, Kreis, Eck-Marke und Schrift (02.10.2026, Paket 2.4.0,
// Punkt 6).
//
// Simon, 02.10.2026: "aktuell ist es in der chat mitglieder liste nur im
// corner badge, nicht vorne beim strich und kreis und da ist es auch noch
// falsch. auch in der mitglieder hinzufügen ist es nicht korrekt. da ist es
// zwar die richtige farbe, aber nicht überall."
//
// Strich und Kreis trugen app-list-item--team / app-icon-circle--team, die
// Team-Farbe Beere fuer JEDE Leitung; nur die Eck-Marke las die Rolle. Dass
// die Eck-Marke in der Mitgliederliste "auch noch falsch" war, lag am Server
// (Rolle der Stamm-Gemeinde statt dieser Gemeinde, siehe
// backend/tests/routes/chatMitgliederRolleJeGemeinde.test.js).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { karteVon, erwarteRollenfarbe } from './rollenfarbePruefen';

const apiGet = vi.fn();
vi.mock('../../services/api', () => ({
  default: { get: (...a: unknown[]) => apiGet(...a), post: vi.fn(), delete: vi.fn() },
}));
let angemeldet: Record<string, unknown> = { id: 4, type: 'admin', role_name: 'admin', organization_id: 1 };
vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({ user: angemeldet, setError: vi.fn(), setSuccess: vi.fn(), isOnline: true }),
}));
vi.mock('../../utils/haptics', () => ({ triggerPullHaptic: vi.fn(), haptik: vi.fn() }));
vi.mock('@ionic/react', async (original) => ({
  ...(await original<typeof import('@ionic/react')>()),
  IonButton: ({ children, onClick, disabled, 'aria-label': name }: {
    children?: React.ReactNode; onClick?: () => void; disabled?: boolean; 'aria-label'?: string;
  }) => <button type="button" aria-label={name} onClick={onClick} disabled={disabled}>{children}</button>,
  useIonAlert: () => [vi.fn(), vi.fn()],
}));

import MembersModal from '../../components/chat/modals/MembersModal';

const MITGLIEDER = [
  { user_id: 5, user_type: 'admin', name: 'Olga Gemeindeleitung', role_name: 'org_admin', joined_at: '2026-09-01T10:00:00Z' },
  { user_id: 4, user_type: 'admin', name: 'Anna Leitung', role_name: 'admin', joined_at: '2026-09-01T10:00:00Z' },
  { user_id: 3, user_type: 'teamer', name: 'Tim Teamer', role_name: 'teamer', joined_at: '2026-09-01T10:00:00Z' },
  { user_id: 20, user_type: 'konfi', name: 'Emilia Konfi', role_name: 'konfi', jahrgang_name: '2026', joined_at: '2026-09-01T10:00:00Z' },
];
// GET /users: die Rolle in DIESER Gemeinde (users.js, seit 26.09.2026).
const BENUTZER = [
  { id: 15, display_name: 'Greta Gemeindeleitung', username: 'greta', role_name: 'org_admin', role_display_name: 'Org-Admin' },
  { id: 14, display_name: 'Lena Leitung', username: 'lena', role_name: 'admin', role_display_name: 'Admin' },
  { id: 13, display_name: 'Theo Teamer', username: 'theo', role_name: 'teamer', role_display_name: 'Teamer:in' },
];
const KONFIS = [{ id: 21, name: 'Karl Konfi', jahrgang_id: 1, jahrgang_name: '2026' }];

let mitglieder: unknown[] = MITGLIEDER;

beforeEach(() => {
  vi.clearAllMocks();
  mitglieder = MITGLIEDER;
  angemeldet = { id: 4, type: 'admin', role_name: 'admin', organization_id: 1 };
  apiGet.mockImplementation(async (pfad: string) => {
    if (pfad === '/chat/rooms/5/participants') return { data: mitglieder };
    if (pfad === '/users') return { data: BENUTZER };
    if (pfad === '/admin/konfis') return { data: KONFIS };
    return { data: [] };
  });
});
afterEach(() => cleanup());

const oeffne = async () => {
  render(<MembersModal roomId={5} roomType="group" onClose={vi.fn()} onSuccess={vi.fn()} />);
  for (let i = 0; i < 4; i += 1) await act(async () => { await Promise.resolve(); });
};

describe('Chat-Mitglieder: Rollenfarbe an Strich, Kreis, Eck-Marke und Schrift', () => {
  it('Gemeindeleitung Indigo, Leitung Petrol, Teamer:in Beere', async () => {
    await oeffne();
    erwarteRollenfarbe(karteVon('Olga Gemeindeleitung'), 'org_admin', 'Gemeindeleitung');
    erwarteRollenfarbe(karteVon('Anna Leitung'), 'admin', 'Leitung');
    erwarteRollenfarbe(karteVon('Tim Teamer'), 'teamer', 'Teamer:in');
  });

  it('Konfis behalten ihre Farbe (Strich, Kreis, Eck-Marke)', async () => {
    await oeffne();
    erwarteRollenfarbe(karteVon('Emilia Konfi'), 'konfi', 'Konfi', { schrift: false });
  });

  it('Rueckfall ohne role_name (aeltere Antwort): Leitung nach dem Typ, nicht mehr Beere', async () => {
    mitglieder = [
      { user_id: 4, user_type: 'admin', name: 'Anna Leitung', joined_at: '2026-09-01T10:00:00Z' },
      { user_id: 3, user_type: 'teamer', name: 'Tim Teamer', joined_at: '2026-09-01T10:00:00Z' },
    ];
    await oeffne();
    erwarteRollenfarbe(karteVon('Anna Leitung'), 'admin', 'Leitung ohne Rolle');
    erwarteRollenfarbe(karteVon('Tim Teamer'), 'teamer', 'Teamer:in ohne Rolle');
  });
});

describe('Mitglied hinzufügen: dieselben Farben an allen Stellen', () => {
  it('Gemeindeleitung, Leitung und Teamer:in aus GET /users; die Konfi wie bisher', async () => {
    mitglieder = [];
    await oeffne();
    fireEvent.click(screen.getByRole('button', { name: 'Mitglieder hinzufügen' }));
    await act(async () => { await Promise.resolve(); });

    erwarteRollenfarbe(karteVon('Greta Gemeindeleitung'), 'org_admin', 'Gemeindeleitung');
    erwarteRollenfarbe(karteVon('Lena Leitung'), 'admin', 'Leitung');
    erwarteRollenfarbe(karteVon('Theo Teamer'), 'teamer', 'Teamer:in');
    erwarteRollenfarbe(karteVon('Karl Konfi'), 'konfi', 'Konfi', { schrift: false });
  });

  it('ausgewaehlt: der zarte Grund kommt aus der Rollenfarbe (app-list-item--selected am Strich)', async () => {
    mitglieder = [];
    await oeffne();
    fireEvent.click(screen.getByRole('button', { name: 'Mitglieder hinzufügen' }));
    await act(async () => { await Promise.resolve(); });

    const lena = karteVon('Lena Leitung');
    fireEvent.click(lena);
    const nachher = karteVon('Lena Leitung');
    expect(nachher.classList.contains('app-list-item--selected')).toBe(true);
    expect(nachher.classList.contains('app-list-item--leitung')).toBe(true);
    expect(nachher.style.background).toBe('');
  });
});
