// Teilnehmerauswahl am Termin: nur Personen aus den Jahrgaengen des Termins (25.09.2026)
//
// Simons Ansage: "Das muss fuer die Konfi-Hinzufuegen-Liste gelten, und das
// muss fuer die Team-Hinzufuegen-Liste gelten. Es muss geprueft werden, ob
// dieser Termin zu den zugewiesenen Jahrgaengen passt. Denkt daran: Ein Termin
// kann auch mehrere Jahrgaenge haben."
//
// Bis dahin filterte das Modal nur die Konfis (ueber den Namen des Jahrgangs);
// Team und Leitung standen "immer" in der Auswahl. Der Server weist seit
// demselben Tag mit 403 ab (gehoertZumTermin) — hier wird geprueft, dass die
// Oberflaeche die Person gar nicht erst anbietet und erklaert, warum.
//
// Zwei Datenwege: Konfis tragen jahrgang_id (EINEN Jahrgang), Team und
// Leitung jahrgang_ids (MEHRERE). Beide werden getrennt geprueft.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';

const apiGet = vi.fn();
const apiPost = vi.fn();

vi.mock('../../services/api', () => ({
  default: {
    get: (...args: unknown[]) => apiGet(...args),
    post: (...args: unknown[]) => apiPost(...args),
  },
}));

const setError = vi.fn();
vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({ setError, isOnline: true }),
}));

vi.mock('../../hooks/useActionGuard', () => ({
  useActionGuard: () => ({ isSubmitting: false, guard: async (fn: () => Promise<void>) => fn() }),
}));

vi.mock('@ionic/react', async () => {
  const passthrough = ({ children }: { children?: React.ReactNode }) =>
    React.createElement(React.Fragment, null, children);
  return {
    IonPage: passthrough, IonHeader: passthrough, IonToolbar: passthrough, IonTitle: passthrough,
    IonContent: passthrough, IonButtons: passthrough, IonLabel: passthrough, IonList: passthrough,
    IonListHeader: passthrough, IonCard: passthrough, IonCardContent: passthrough,
    IonItem: passthrough, IonSelect: passthrough, IonSelectOption: () => null,
    IonButton: ({ children, onClick }: { children?: React.ReactNode; onClick?: () => void }) =>
      React.createElement('button', { onClick }, children),
    IonIcon: () => null,
    IonInput: () => null,
  };
});

import ParticipantManagementModal from '../../components/admin/modals/ParticipantManagementModal';
import { passtZumTermin } from '../../utils/jahrgangsPassung';

const JG_A = 301;
const JG_B = 302;

const konfis = [
  { id: 1, name: 'Konfi Anna', jahrgang_id: JG_A, jahrgang_name: 'JG A' },
  { id: 2, name: 'Konfi Bela', jahrgang_id: JG_B, jahrgang_name: 'JG B' },
];
const teamer = [
  { id: 11, name: 'Teamer Ada',   jahrgang_ids: [JG_A],       jahrgang_name: 'JG A' },
  { id: 12, name: 'Teamer Ben',   jahrgang_ids: [JG_B],       jahrgang_name: 'JG B' },
  { id: 13, name: 'Teamer Chris', jahrgang_ids: [JG_A, JG_B], jahrgang_name: 'JG A, JG B' },
  { id: 14, name: 'Teamer Dana',  jahrgang_ids: [],           jahrgang_name: null },
];
const leitung = [
  { id: 21, name: 'Leitung Bert',  role_name: 'admin',     jahrgang_ids: [JG_B], is_super_admin: false },
  { id: 22, name: 'Leitung Olga',  role_name: 'org_admin', jahrgang_ids: [],     is_super_admin: false },
  { id: 23, name: 'Leitung Sven',  role_name: 'admin',     jahrgang_ids: [],     is_super_admin: true },
];

function serverMitTermin(event: Record<string, unknown>) {
  apiGet.mockImplementation((url: string) => {
    if (url === '/events/7') return Promise.resolve({ data: { participants: [], ...event } });
    if (url === '/admin/konfis') return Promise.resolve({ data: konfis });
    if (url === '/admin/konfis/teamer') return Promise.resolve({ data: teamer });
    if (url === '/admin/konfis/leitung') return Promise.resolve({ data: leitung });
    return Promise.reject(new Error(`unerwartet: ${url}`));
  });
}

function rendern(filterRole: 'konfi' | 'teamer' | 'leitung') {
  return render(
    <ParticipantManagementModal eventId={7} onClose={vi.fn()} onSuccess={vi.fn()} filterRole={filterRole} />
  );
}

// Alle Namen in der Liste, in Reihenfolge. Die Aufrufer warten vorher auf
// einen konkreten Namen, damit die Liste steht.
function personenAufDerSeite(): string[] {
  return Array.from(document.querySelectorAll('.app-list-item__title')).map(el => el.textContent || '');
}

describe('Teilnehmerauswahl bietet nur Personen aus den Jahrgaengen des Termins an', () => {
  beforeEach(() => {
    apiGet.mockReset();
    apiPost.mockReset();
    setError.mockReset();
  });

  describe('Termin mit EINEM Jahrgang (A)', () => {
    const termin = { jahrgaenge: [{ id: JG_A, name: 'JG A' }] };

    it('Konfi-Liste: Anna (A) steht drin, Bela (B) nicht', async () => {
      serverMitTermin(termin);
      rendern('konfi');
      await waitFor(() => expect(screen.getByText('Konfi Anna')).toBeTruthy());
      expect(personenAufDerSeite()).toEqual(['Konfi Anna']);
      expect(screen.queryByText('Konfi Bela')).toBeNull();
    });

    it('Team-Liste: Ada (A) und Chris (A+B) stehen drin, Ben (B) und Dana (ohne) nicht', async () => {
      serverMitTermin(termin);
      rendern('teamer');
      await waitFor(() => expect(screen.getByText('Teamer Ada')).toBeTruthy());
      expect(personenAufDerSeite()).toEqual(['Teamer Ada', 'Teamer Chris']);
      expect(screen.queryByText('Teamer Ben')).toBeNull();
      expect(screen.queryByText('Teamer Dana')).toBeNull();
    });

    it('Leitungs-Liste: Bert (admin, nur B) fehlt; Olga (org_admin) und Sven (super_admin-Flag) bleiben', async () => {
      serverMitTermin(termin);
      rendern('leitung');
      await waitFor(() => expect(screen.getByText('Leitung Olga')).toBeTruthy());
      expect(personenAufDerSeite()).toEqual(['Leitung Olga', 'Leitung Sven']);
      expect(screen.queryByText('Leitung Bert')).toBeNull();
    });

    it('erklaert, warum jemand fehlt', async () => {
      serverMitTermin(termin);
      rendern('teamer');
      await waitFor(() => expect(screen.getByTestId('jahrgangs-hinweis')).toBeTruthy());
      expect(screen.getByTestId('jahrgangs-hinweis').textContent).toContain('dem Jahrgang dieses Termins (JG A)');
    });
  });

  describe('Termin mit ZWEI Jahrgaengen (A und B)', () => {
    const termin = { jahrgaenge: [{ id: JG_A, name: 'JG A' }, { id: JG_B, name: 'JG B' }] };

    it('Konfi-Liste: Anna (A) und Bela (B) — eine Ueberschneidung genuegt', async () => {
      serverMitTermin(termin);
      rendern('konfi');
      await waitFor(() => expect(screen.getByText('Konfi Bela')).toBeTruthy());
      expect(personenAufDerSeite()).toEqual(['Konfi Anna', 'Konfi Bela']);
    });

    it('Team-Liste: Ben (nur B) steht drin, Dana (ohne Jahrgang) weiterhin nicht', async () => {
      serverMitTermin(termin);
      rendern('teamer');
      await waitFor(() => expect(screen.getByText('Teamer Ben')).toBeTruthy());
      expect(personenAufDerSeite()).toEqual(['Teamer Ada', 'Teamer Ben', 'Teamer Chris']);
      expect(screen.queryByText('Teamer Dana')).toBeNull();
    });

    it('nennt beide Jahrgaenge im Hinweis', async () => {
      serverMitTermin(termin);
      rendern('konfi');
      await waitFor(() => expect(screen.getByTestId('jahrgangs-hinweis')).toBeTruthy());
      expect(screen.getByTestId('jahrgangs-hinweis').textContent).toContain('den Jahrgängen dieses Termins (JG A, JG B)');
    });
  });

  describe('Ausnahmen', () => {
    it('Termin OHNE Jahrgang: alle Teamer:innen, auch Dana ohne Zuweisung — und kein Hinweis', async () => {
      serverMitTermin({ jahrgaenge: [] });
      rendern('teamer');
      await waitFor(() => expect(screen.getByText('Teamer Dana')).toBeTruthy());
      expect(personenAufDerSeite()).toEqual(['Teamer Ada', 'Teamer Ben', 'Teamer Chris', 'Teamer Dana']);
      expect(screen.queryByTestId('jahrgangs-hinweis')).toBeNull();
    });

    it('"Nur Team"-Termin mit Jahrgang A: alle Teamer:innen — und kein Hinweis', async () => {
      serverMitTermin({ teamer_only: true, jahrgaenge: [{ id: JG_A, name: 'JG A' }] });
      rendern('teamer');
      await waitFor(() => expect(screen.getByText('Teamer Ben')).toBeTruthy());
      expect(personenAufDerSeite()).toEqual(['Teamer Ada', 'Teamer Ben', 'Teamer Chris', 'Teamer Dana']);
      expect(screen.queryByTestId('jahrgangs-hinweis')).toBeNull();
    });
  });
});

describe('passtZumTermin — die Regel, ohne Oberflaeche', () => {
  const terminA = { jahrgaenge: [{ id: JG_A, name: 'A' }] };

  it('Konfi: ueber jahrgang_id (EIN Jahrgang)', () => {
    expect(passtZumTermin({ role_name: 'konfi', jahrgang_id: JG_A }, terminA, [JG_A])).toBe(true);
    expect(passtZumTermin({ role_name: 'konfi', jahrgang_id: JG_B }, terminA, [JG_A])).toBe(false);
    expect(passtZumTermin({ role_name: 'konfi' }, terminA, [JG_A])).toBe(false);
  });

  it('Team: ueber jahrgang_ids (MEHRERE), eine Ueberschneidung genuegt', () => {
    expect(passtZumTermin({ role_name: 'teamer', jahrgang_ids: [JG_B, JG_A] }, terminA, [JG_A])).toBe(true);
    expect(passtZumTermin({ role_name: 'teamer', jahrgang_ids: [JG_B] }, terminA, [JG_A])).toBe(false);
    expect(passtZumTermin({ role_name: 'teamer' }, terminA, [JG_A])).toBe(false);
    expect(passtZumTermin({ role_name: 'teamer', jahrgang_ids: [JG_B] }, terminA, [JG_A, JG_B])).toBe(true);
  });

  it('Leitung: admin nur mit Ueberschneidung, org_admin und super_admin-Flag immer', () => {
    expect(passtZumTermin({ role_name: 'admin', jahrgang_ids: [JG_B] }, terminA, [JG_A])).toBe(false);
    expect(passtZumTermin({ role_name: 'org_admin', jahrgang_ids: [] }, terminA, [JG_A])).toBe(true);
    expect(passtZumTermin({ role_name: 'admin', is_super_admin: true }, terminA, [JG_A])).toBe(true);
  });

  it('Termin ohne Jahrgang und "Nur Team": immer', () => {
    expect(passtZumTermin({ role_name: 'konfi', jahrgang_id: JG_B }, { jahrgaenge: [] }, [])).toBe(true);
    expect(passtZumTermin({ role_name: 'teamer', jahrgang_ids: [JG_B] }, { ...terminA, teamer_only: true }, [JG_A])).toBe(true);
  });
});
