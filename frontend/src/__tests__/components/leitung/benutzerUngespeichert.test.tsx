// Ungespeicherte Änderungen im Fenster „Benutzer:in bearbeiten" -- in der App
// (modals/UserManagementModal.tsx) und im Browser (web/leitung/WebBenutzerDialog.tsx)
// dieselbe Frage, aus derselben Logik (useBenutzerFormular, isDirty).
//
// Befund 15.10.2026: Das Fenster des Browsers schloss mit Abbrechen, X,
// Escape oder einem Klick daneben ohne zu fragen, auch nach Änderungen. Die
// App hatte die Frage zwar (handleClose), rief sie aber nur im Ladezustand;
// das X des fertigen Formulars schloss ebenfalls sofort. Jetzt fragen beide
// nach -- wie die Fenster für Events und Badges --, und auch eine geänderte
// Jahrgangs-Zuweisung zählt als Änderung.
//
// Jeder Ablauf läuft einmal gegen das Fenster der App und einmal gegen das des
// Browsers, mit denselben Erwartungen (describe.each).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, within, act, waitFor } from '@testing-library/react';
import { konto, neuerStand, type LeitungTestStand } from './leitungTestHilfe';

const h = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
  setError: vi.fn(),
  schliessen: vi.fn(),
  stand: { alert: null, fenster: [], push: vi.fn() } as unknown as LeitungTestStand,
  user: {} as Record<string, unknown>,
}));

vi.mock('@ionic/react', async () => (await import('./leitungTestHilfe')).ionicFuerLeitung(h.stand));
vi.mock('../../../services/api', () => ({ default: { get: h.apiGet, post: h.apiPost, put: h.apiPut } }));
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({ user: h.user, setError: h.setError, isOnline: true }),
}));

import UserManagementModal from '../../../components/admin/modals/UserManagementModal';
import WebBenutzerDialog from '../../../components/admin/web/leitung/WebBenutzerDialog';

const ROLLEN = [
  { id: 1, name: 'org_admin', display_name: 'Gemeindeleitung', is_system_role: true, is_active: true, user_count: 1 },
  { id: 2, name: 'admin', display_name: 'Leitung', is_system_role: true, is_active: true, user_count: 2 },
  { id: 3, name: 'teamer', display_name: 'Teamer:in', is_system_role: true, is_active: true, user_count: 5 },
];
const JAHRGAENGE = [{ id: 11, name: '2026/27' }, { id: 12, name: '2027/28' }];
const PERSON = {
  id: 40, username: 'sam.muster', display_name: 'Sam Muster', email: '', role_title: '',
  role_id: 3, role_name: 'teamer', is_active: true, mitgliedschaft: 'stamm',
  assigned_jahrgaenge: [{ id: 11, name: '2026/27', can_view: true, can_edit: false }],
};

/** Die Rückfrage, wie die Person sie liest: Titel, Satz, Knöpfe (ohne das X des Fensters). */
interface Rueckfrage { titel: string; text: string; knoepfe: string[] }

interface Fassung {
  oeffnen: () => Promise<void>;
  /** Das Formular schließen wollen (das X der App, „Abbrechen" im Browser). */
  schliessen: () => void;
  anzeigename: () => HTMLInputElement;
  /** Einen Jahrgang an- oder abwählen. */
  jahrgang: (name: string) => void;
  rueckfrage: () => Rueckfrage | null;
  /** In der Rückfrage einen Knopf drücken. */
  antworten: (knopf: 'Abbrechen' | 'Verwerfen') => Promise<void>;
  /** Das Formular steht (noch) da. */
  formularOffen: () => boolean;
}

const app: Fassung = {
  oeffnen: async () => {
    render(<UserManagementModal userId={40} onClose={h.schliessen} onSuccess={vi.fn()} />);
    // Erst wenn die Person geladen und gezeichnet ist -- sonst nähme das
    // Formular die Vorbelegung selbst schon als Änderung.
    await waitFor(() => expect(app.anzeigename().value).toBe('Sam Muster'));
  },
  schliessen: () => fireEvent.click(screen.getByRole('button', { name: 'Schließen' })),
  anzeigename: () => screen.getByLabelText('Anzeigename') as HTMLInputElement,
  jahrgang: (name) => fireEvent.click(screen.getAllByRole('button').find((b) => b.textContent === name)!),
  rueckfrage: () => (h.stand.alert
    ? { titel: h.stand.alert.header ?? '', text: h.stand.alert.message ?? '', knoepfe: (h.stand.alert.buttons ?? []).map((b) => b.text) }
    : null),
  antworten: async (knopf) => {
    const alert = h.stand.alert!;
    h.stand.alert = null;
    await act(async () => { await alert.buttons!.find((b) => b.text === knopf)!.handler?.(); });
  },
  formularOffen: () => h.schliessen.mock.calls.length === 0 && screen.queryByRole('button', { name: 'Benutzer:in speichern' }) !== null,
};

const web: Fassung = {
  oeffnen: async () => {
    const Rahmen: React.FC = () => {
      const [offen, setOffen] = React.useState(true);
      return offen
        ? <WebBenutzerDialog userId={40} onSchliessen={() => { h.schliessen(); setOffen(false); }} onGespeichert={vi.fn()} />
        : null;
    };
    render(<Rahmen />);
    await waitFor(() => expect(web.anzeigename().value).toBe('Sam Muster'));
  },
  schliessen: () => fireEvent.click(within(screen.getByRole('dialog', { name: 'Benutzer:in bearbeiten' })).getByRole('button', { name: 'Abbrechen' })),
  anzeigename: () => within(screen.getByRole('dialog', { name: 'Benutzer:in bearbeiten' })).getByLabelText('Anzeigename') as HTMLInputElement,
  jahrgang: (name) => fireEvent.click(within(screen.getByRole('dialog', { name: 'Benutzer:in bearbeiten' })).getByRole('checkbox', { name: new RegExp(`^${name.replace('/', '\\/')}`) })),
  rueckfrage: () => {
    const d = screen.queryByRole('dialog', { name: 'Ungespeicherte Änderungen' });
    if (!d) return null;
    return {
      titel: 'Ungespeicherte Änderungen',
      text: d.getAttribute('aria-describedby') ? document.getElementById(d.getAttribute('aria-describedby')!)!.textContent ?? '' : '',
      knoepfe: within(d).getAllByRole('button').map((b) => b.textContent ?? '').filter((t) => t !== ''),
    };
  },
  antworten: async (knopf) => {
    const d = screen.getByRole('dialog', { name: 'Ungespeicherte Änderungen' });
    await act(async () => { fireEvent.click(within(d).getByRole('button', { name: knopf })); });
  },
  formularOffen: () => screen.queryByRole('dialog', { name: 'Benutzer:in bearbeiten' }) !== null,
};

/** Bis das Formular seine Vorbelegung als Ausgangsstand genommen hat (useBenutzerFormular, 100 ms). */
const vorbelegt = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 150)); }); };

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(h.stand, neuerStand());
  h.user = konto('org_admin');
  h.apiGet.mockImplementation(async (url: string) => {
    if (url === '/roles') return { data: ROLLEN };
    if (url === '/admin/jahrgaenge') return { data: JAHRGAENGE };
    if (url === '/users/40') return { data: PERSON };
    throw new Error(`nicht vorgesehen: ${url}`);
  });
  h.apiPost.mockResolvedValue({ data: {} });
  h.apiPut.mockResolvedValue({ data: {} });
});

describe.each([
  ['App', app],
  ['Browser', web],
])('%s: Benutzer:in bearbeiten mit ungespeicherten Änderungen', (_name, f) => {
  it('ohne Änderung schließt das Formular sofort, ohne Rückfrage', async () => {
    await f.oeffnen();
    await vorbelegt();
    f.schliessen();
    expect(f.rueckfrage()).toBeNull();
    expect(h.schliessen).toHaveBeenCalledTimes(1);
  });

  it('nach einer Änderung fragt es nach; „Abbrechen" lässt das Formular mit der Eingabe offen', async () => {
    await f.oeffnen();
    await vorbelegt();
    fireEvent.change(f.anzeigename(), { target: { value: 'Sam Neu' } });
    f.schliessen();
    expect(f.rueckfrage()).toEqual({
      titel: 'Ungespeicherte Änderungen',
      text: 'Möchtest du die Änderungen verwerfen?',
      knoepfe: ['Abbrechen', 'Verwerfen'],
    });
    expect(h.schliessen).not.toHaveBeenCalled();
    await f.antworten('Abbrechen');
    expect(f.rueckfrage()).toBeNull();
    expect(f.formularOffen()).toBe(true);
    expect(f.anzeigename().value).toBe('Sam Neu');
  });

  it('„Verwerfen" schließt das Formular; gesendet wird nichts', async () => {
    await f.oeffnen();
    await vorbelegt();
    fireEvent.change(f.anzeigename(), { target: { value: 'Sam Neu' } });
    f.schliessen();
    await f.antworten('Verwerfen');
    expect(h.schliessen).toHaveBeenCalledTimes(1);
    expect(f.formularOffen()).toBe(false);
    expect(h.apiPut).not.toHaveBeenCalled();
    expect(h.apiPost).not.toHaveBeenCalled();
  });

  it('auch ein an- oder abgewählter Jahrgang ist eine Änderung', async () => {
    await f.oeffnen();
    await vorbelegt();
    f.jahrgang('2027/28');
    f.schliessen();
    expect(f.rueckfrage()?.titel).toBe('Ungespeicherte Änderungen');
    expect(h.schliessen).not.toHaveBeenCalled();
  });
});

describe('Browser: auch X und Escape fragen nach', () => {
  it('X und Escape öffnen dieselbe Rückfrage statt zu schließen', async () => {
    await web.oeffnen();
    await vorbelegt();
    fireEvent.change(web.anzeigename(), { target: { value: 'Sam Neu' } });
    const formular = screen.getByRole('dialog', { name: 'Benutzer:in bearbeiten' });
    fireEvent.click(within(formular).getByRole('button', { name: 'Schließen' }));
    expect(web.rueckfrage()?.titel).toBe('Ungespeicherte Änderungen');
    await web.antworten('Abbrechen');
    fireEvent.keyDown(formular, { key: 'Escape' });
    expect(web.rueckfrage()?.titel).toBe('Ungespeicherte Änderungen');
    expect(h.schliessen).not.toHaveBeenCalled();
  });
});
