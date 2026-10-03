// Termin: Team und Leitung hinzufügen -- die Personen in der Farbe ihrer
// Rolle (02.10.2026, Paket 2.4.0, Punkt 6).
//
// Nachgestellt: Die Auswahlliste trug fuer JEDE Person Strich und Kreis in der
// Termin-Farbe (app-list-item--events, Rot) und schrieb fuer Gemeindeleitung
// wie Leitung dasselbe Wort "Leitung". Jetzt: Team und Leitung in ihrer
// Rollenfarbe (utils/rollenNamen: rollenDarstellung), das Wort nach der Rolle
// (rollenName). Die Konfi-Auswahl bleibt, wie sie war.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { karteVon, erwarteRollenfarbe } from './rollenfarbePruefen';

const apiGet = vi.fn();
vi.mock('../../services/api', () => ({
  default: { get: (...args: unknown[]) => apiGet(...args), post: vi.fn() },
}));
vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({ setError: vi.fn(), isOnline: true }),
}));
vi.mock('../../hooks/useActionGuard', () => ({
  useActionGuard: () => ({ isSubmitting: false, guard: async (fn: () => Promise<void>) => fn() }),
}));
vi.mock('@ionic/react', async () => {
  const durch = ({ children }: { children?: React.ReactNode }) => React.createElement(React.Fragment, null, children);
  return {
    IonPage: durch, IonHeader: durch, IonToolbar: durch, IonTitle: durch,
    IonContent: durch, IonButtons: durch, IonLabel: durch, IonList: durch,
    IonListHeader: durch, IonCard: durch, IonCardContent: durch,
    IonItem: durch, IonSelect: durch, IonSelectOption: () => null,
    IonButton: ({ children, onClick }: { children?: React.ReactNode; onClick?: () => void }) =>
      React.createElement('button', { onClick }, children),
    IonIcon: () => null,
    IonInput: () => null,
    useIonAlert: () => [vi.fn(), vi.fn()],
  };
});

import ParticipantManagementModal from '../../components/admin/modals/ParticipantManagementModal';

const JG = 301;
beforeEach(() => {
  apiGet.mockReset();
  apiGet.mockImplementation((url: string) => {
    if (url === '/events/7') return Promise.resolve({ data: { participants: [], jahrgaenge: [{ id: JG, name: 'JG A' }] } });
    if (url === '/admin/konfis') return Promise.resolve({ data: [{ id: 1, name: 'Karl Konfi', jahrgang_id: JG, jahrgang_name: 'JG A' }] });
    if (url === '/admin/konfis/teamer') return Promise.resolve({ data: [{ id: 11, name: 'Tim Teamer', jahrgang_ids: [JG], jahrgang_name: 'JG A' }] });
    if (url === '/admin/konfis/leitung') {
      return Promise.resolve({ data: [
        { id: 22, name: 'Olga Gemeindeleitung', role_name: 'org_admin', jahrgang_ids: [], is_super_admin: false },
        { id: 21, name: 'Anna Leitung', role_name: 'admin', jahrgang_ids: [JG], is_super_admin: false },
      ] });
    }
    return Promise.reject(new Error(`unerwartet: ${url}`));
  });
});

const rendern = (filterRole: 'konfi' | 'teamer' | 'leitung') =>
  render(<ParticipantManagementModal eventId={7} onClose={vi.fn()} onSuccess={vi.fn()} filterRole={filterRole} />);

describe('Leitung hinzufügen: Gemeindeleitung Indigo, Leitung Petrol', () => {
  it('Strich und Kreis in der Rollenfarbe, das Wort nach der Rolle', async () => {
    rendern('leitung');
    await waitFor(() => expect(screen.getByText('Olga Gemeindeleitung')).toBeTruthy());
    const olga = karteVon('Olga Gemeindeleitung');
    const anna = karteVon('Anna Leitung');
    erwarteRollenfarbe(olga, 'org_admin', 'Gemeindeleitung', { marke: false, schrift: false });
    erwarteRollenfarbe(anna, 'admin', 'Leitung', { marke: false, schrift: false });
    expect(olga.querySelector('.app-list-item__subtitle')?.textContent).toBe('Gemeindeleitung');
    expect(anna.querySelector('.app-list-item__subtitle')?.textContent).toBe('Leitung');
  });

  it('ausgewaehlt: zarter Grund in der Rollenfarbe, nicht in der Termin-Farbe', async () => {
    rendern('leitung');
    await waitFor(() => expect(screen.getByText('Anna Leitung')).toBeTruthy());
    fireEvent.click(karteVon('Anna Leitung'));
    const anna = karteVon('Anna Leitung');
    expect(anna.classList.contains('app-list-item--selected')).toBe(true);
    expect(anna.style.background).toBe('');
    erwarteRollenfarbe(anna, 'admin', 'Leitung ausgewaehlt', { marke: false, schrift: false });
  });
});

describe('Teamer:in hinzufügen: Beere statt Termin-Rot', () => {
  it('Strich und Kreis in der Teamer-Farbe', async () => {
    rendern('teamer');
    await waitFor(() => expect(screen.getByText('Tim Teamer')).toBeTruthy());
    const tim = karteVon('Tim Teamer');
    erwarteRollenfarbe(tim, 'teamer', 'Teamer:in', { marke: false, schrift: false });
    expect(tim.querySelector('.app-list-item__subtitle')?.textContent).toBe('Teamer:in · JG A');
  });
});

describe('Kind hinzufügen: die Konfi-Auswahl bleibt, wie sie war', () => {
  it('Strich und Kreis in der Termin-Farbe', async () => {
    rendern('konfi');
    await waitFor(() => expect(screen.getByText('Karl Konfi')).toBeTruthy());
    const karl = karteVon('Karl Konfi');
    expect(karl.classList.contains('app-list-item--events')).toBe(true);
    expect(karl.querySelector('.app-icon-circle')?.classList.contains('app-icon-circle--events')).toBe(true);
  });
});
