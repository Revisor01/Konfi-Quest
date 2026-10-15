// Termin: Team und Leitung hinzufügen -- das Wort nach der Rolle
// (02.10.2026, Paket 2.4.0, Punkt 6).
//
// Nachgestellt: Die Auswahlliste schrieb fuer Gemeindeleitung wie Leitung
// dasselbe Wort "Leitung". Jetzt steht das Wort nach der Rolle (rollenName).
// Die Farben der Rollen sind Gestaltung und bleiben frei (Simon, 15.10.2026).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { karteVon } from './rollenfarbePruefen';

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

describe('Leitung hinzufügen: das Wort nach der Rolle', () => {
  it('Gemeindeleitung heisst Gemeindeleitung, Leitung heisst Leitung', async () => {
    rendern('leitung');
    await waitFor(() => expect(screen.getByText('Olga Gemeindeleitung')).toBeTruthy());
    expect(karteVon('Olga Gemeindeleitung').querySelector('.app-list-item__subtitle')?.textContent).toBe('Gemeindeleitung');
    expect(karteVon('Anna Leitung').querySelector('.app-list-item__subtitle')?.textContent).toBe('Leitung');
  });
});

describe('Teamer:in hinzufügen: das Wort nach der Rolle, dazu der Jahrgang', () => {
  it('Teamer:in · JG A', async () => {
    rendern('teamer');
    await waitFor(() => expect(screen.getByText('Tim Teamer')).toBeTruthy());
    expect(karteVon('Tim Teamer').querySelector('.app-list-item__subtitle')?.textContent).toBe('Teamer:in · JG A');
  });
});
