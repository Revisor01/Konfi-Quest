// „Person einladen" (/admin/users) -- das Modal der App (modals/EinladungModal)
// und der Dialog der Web-Fassung (web/leitung/WebPersonEinladenDialog) im
// Vergleich (Simon, 15.10.2026: jedes Formular, das im Browser noch ein Modal
// der App öffnet, bekommt ein kompaktes Fenster der Web-Fassung).
//
// Beide lesen dieselbe Logik (usePersonEinladen). Jeder Ablauf läuft deshalb
// zweimal, einmal je Fassung, mit denselben Erwartungen: dieselben Rollen zur
// Wahl (nie Konfi, nie Super-Admin), Senden erst mit Kennung und Rolle und nur
// mit Netz, derselbe Rumpf an POST /einladungen, dieselbe Erfolgsmeldung.
// Unterschied, ausdrücklich: Ein Fehler steht in der App oben (setError), im
// Browser im Dialog.
//
// Dazu die Seite (AdminUsersPage): breit der Dialog, schmal das Modal der App
// -- und nach dem Senden in beiden dasselbe Neuladen.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, within, waitFor, cleanup, act } from '@testing-library/react';
import { konto, neuerStand, type LeitungTestStand } from './leitungTestHilfe';

const h = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  setError: vi.fn(),
  setSuccess: vi.fn(),
  refresh: vi.fn(),
  breit: true,
  online: true,
  stand: { alert: null, fenster: [], push: vi.fn() } as unknown as LeitungTestStand,
  user: {} as Record<string, unknown>,
}));

vi.mock('@ionic/react', async () => {
  const basis = await (await import('./leitungTestHilfe')).ionicFuerLeitung(h.stand);
  return {
    ...basis,
    // Das Feld der App trägt seinen Namen als `label` (sichtbare Beschriftung).
    IonInput: ({ label, value, onIonInput }: { label?: string; value?: string; onIonInput?: (e: { detail: { value: string } }) => void }) => (
      <input aria-label={label} value={value ?? ''} onChange={(e) => onIonInput?.({ detail: { value: e.target.value } })} />
    ),
  };
});
vi.mock('../../../navigation/breitesLayout', () => ({ useBreitesLayout: () => h.breit }));
vi.mock('../../../components/shared/AppKopfzeile', async () => (await import('../support/ionicAttrappe')).KopfzeileAttrappe);
vi.mock('../../../components/shared/WartungsHinweis', () => ({ default: () => null }));
vi.mock('../../../components/common/LoadingSpinner', () => ({ default: () => null }));
vi.mock('../../../services/api', () => ({ default: { get: (u: string) => h.apiGet(u), post: (u: string, b?: unknown) => h.apiPost(u, b) } }));
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({ user: h.user, setError: h.setError, setSuccess: h.setSuccess, isOnline: h.online }),
}));
vi.mock('../../../contexts/ModalContext', () => ({ useModalPage: () => ({ pageRef: { current: null }, presentingElement: null }) }));
vi.mock('../../../contexts/LiveUpdateContext', () => ({ useLiveRefresh: () => {} }));
vi.mock('../../../hooks/useOfflineQuery', () => ({
  useOfflineQuery: () => ({ data: [], loading: false, refresh: h.refresh, refreshLive: vi.fn() }),
}));
vi.mock('../../../components/admin/modals/UserManagementModal', () => ({ default: () => null }));

import EinladungModal from '../../../components/admin/modals/EinladungModal';
import WebPersonEinladenDialog from '../../../components/admin/web/leitung/WebPersonEinladenDialog';
import AdminUsersPage from '../../../components/admin/pages/AdminUsersPage';
import { rollenBeschreibung } from '../../../components/admin/useBenutzerFormular';

// GET /roles: alle Rollen des Systems.
const ROLLEN = [
  { id: 1, name: 'konfi', display_name: 'Konfi' },
  { id: 2, name: 'teamer', display_name: 'Teamer:in' },
  { id: 3, name: 'admin', display_name: 'Admin' },
  { id: 4, name: 'org_admin', display_name: 'Org-Admin' },
  { id: 5, name: 'super_admin', display_name: 'Super-Admin' },
];

const fertig = vi.fn();
const zu = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  h.apiPost.mockReset();
  Object.assign(h.stand, neuerStand());
  h.breit = true;
  h.online = true;
  h.user = konto('org_admin');
  h.apiGet.mockImplementation(async (pfad: string) => {
    if (pfad === '/roles') return { data: ROLLEN };
    if (pfad === '/einladungen') return { data: [] };
    throw new Error(`unerwartet: ${pfad}`);
  });
  h.apiPost.mockResolvedValue({ data: { display_name: 'Ben Beispiel' } });
});
afterEach(() => cleanup());

// --- Bedienung je Fassung ----------------------------------------------------------------
type Fassung = 'app' | 'web';
const ROLLENNAMEN = /^(Gemeindeleitung|Leitung|Teamer:in|Konfi|Super-Admin)/;

/** Die Rollen zur Wahl, in Anzeigereihenfolge. */
const angeboten = (fassung: Fassung): string[] => {
  if (fassung === 'app') {
    return screen.getAllByRole('button').map((k) => ROLLENNAMEN.exec(k.textContent ?? '')?.[1]).filter((n): n is string => !!n);
  }
  const auswahl = screen.getByRole('combobox', { name: 'Rolle' }) as HTMLSelectElement;
  return [...auswahl.options].map((o) => o.textContent ?? '').filter((t) => t !== 'Bitte wählen');
};

const oeffnen = async (fassung: Fassung) => {
  if (fassung === 'app') render(<EinladungModal onClose={zu} onSuccess={fertig} />);
  else render(<WebPersonEinladenDialog onSchliessen={zu} onEingeladen={fertig} />);
  await waitFor(() => expect(angeboten(fassung)).toContain('Teamer:in'));
};

const kennung = (text: string) => fireEvent.change(screen.getByLabelText('Benutzername oder E-Mail'), { target: { value: text } });
const rolle = (fassung: Fassung, name: 'Gemeindeleitung' | 'Leitung' | 'Teamer:in') => {
  if (fassung === 'app') fireEvent.click(screen.getByText(name, { exact: true }));
  else {
    const auswahl = screen.getByRole('combobox', { name: 'Rolle' }) as HTMLSelectElement;
    const option = [...auswahl.options].find((o) => o.textContent === name);
    fireEvent.change(auswahl, { target: { value: option?.value } });
  }
};
// In der App ein Haken-Knopf „Senden" mit diesem Namen, im Browser der Knopf unten.
const sendenKnopf = () => screen.getByRole('button', { name: 'Einladung senden' });
const senden = async () => { await act(async () => { fireEvent.click(sendenKnopf()); }); };

const erwarteMeldung = async (fassung: Fassung, text: string) => {
  if (fassung === 'app') {
    await waitFor(() => expect(h.setError).toHaveBeenLastCalledWith(text));
  } else {
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(text));
    expect(h.setError).not.toHaveBeenCalled();
  }
};

// --- Abläufe, je Fassung ------------------------------------------------------------------
describe.each<Fassung>(['app', 'web'])('Person einladen (%s): dieselbe Logik in App und Browser', (fassung) => {
  it('zur Wahl stehen Gemeindeleitung, Leitung und Teamer:in -- weder Konfi noch Super-Admin (GET /roles)', async () => {
    await oeffnen(fassung);
    expect(h.apiGet).toHaveBeenCalledWith('/roles');
    expect(angeboten(fassung)).toEqual(['Teamer:in', 'Leitung', 'Gemeindeleitung']);
  });

  it('die Rolle erklärt derselbe Satz wie beim Anlegen einer Benutzer:in', async () => {
    await oeffnen(fassung);
    rolle(fassung, 'Leitung');
    expect(screen.getByText(rollenBeschreibung('admin'))).toBeInTheDocument();
  });

  it('Senden erst mit Kennung UND Rolle; die Kennung geht ohne Leerzeichen am Rand an POST /einladungen', async () => {
    await oeffnen(fassung);
    expect(sendenKnopf()).toBeDisabled();
    kennung('  ben.beispiel ');
    expect(sendenKnopf()).toBeDisabled();
    rolle(fassung, 'Leitung');
    expect(sendenKnopf()).toBeEnabled();

    await senden();
    expect(h.apiPost.mock.calls).toEqual([['/einladungen', { kennung: 'ben.beispiel', role_id: 3 }]]);
    expect(h.setSuccess).toHaveBeenCalledWith('Ben Beispiel wurde eingeladen und entscheidet jetzt selbst.');
    expect(fertig).toHaveBeenCalledTimes(1);
    expect(h.setError).not.toHaveBeenCalled();
  });

  it('nur Leerzeichen als Kennung zählt nicht', async () => {
    await oeffnen(fassung);
    kennung('   ');
    rolle(fassung, 'Teamer:in');
    expect(sendenKnopf()).toBeDisabled();
  });

  it('ohne Netz lässt sich nicht senden', async () => {
    h.online = false;
    await oeffnen(fassung);
    kennung('ben');
    rolle(fassung, 'Teamer:in');
    expect(sendenKnopf()).toBeDisabled();
  });

  it('lehnt der Server ab, steht seine Begründung da -- kein Erfolg, das Fenster bleibt', async () => {
    h.apiPost.mockRejectedValue({ response: { status: 404, data: { error: 'Kein Konto mit dieser Kennung gefunden' } } });
    await oeffnen(fassung);
    kennung('niemand');
    rolle(fassung, 'Teamer:in');
    await senden();
    expect(h.apiPost.mock.calls).toEqual([['/einladungen', { kennung: 'niemand', role_id: 2 }]]);
    await erwarteMeldung(fassung, 'Kein Konto mit dieser Kennung gefunden');
    expect(h.setSuccess).not.toHaveBeenCalled();
    expect(fertig).not.toHaveBeenCalled();
    expect(zu).not.toHaveBeenCalled();
  });
});

describe('Person einladen: App und Browser schicken dasselbe', () => {
  const einladen = async (fassung: Fassung) => {
    await oeffnen(fassung);
    kennung('anna@example.org');
    rolle(fassung, 'Gemeindeleitung');
    await senden();
    await waitFor(() => expect(fertig).toHaveBeenCalledTimes(1));
    const gesendet = [...h.apiPost.mock.calls];
    cleanup();
    h.apiPost.mockClear();
    fertig.mockClear();
    return gesendet;
  };

  it('dieselbe Einladung ergibt in beiden Fassungen denselben Aufruf', async () => {
    const app = await einladen('app');
    const web = await einladen('web');
    expect(app).toEqual([['/einladungen', { kennung: 'anna@example.org', role_id: 4 }]]);
    expect(web).toEqual(app);
  });
});

// --- Nur der Browser ----------------------------------------------------------------------
describe('Person einladen (web)', () => {
  it('während gesendet wird, schließt nichts den Dialog; ein Fehler steht danach in ihm', async () => {
    const ausgang: { ablehnen: (grund: unknown) => void } = { ablehnen: () => undefined };
    h.apiPost.mockReturnValue(new Promise((_ok, nein) => { ausgang.ablehnen = nein; }));
    await oeffnen('web');
    kennung('ben');
    rolle('web', 'Teamer:in');
    await senden();
    const dialog = screen.getByRole('dialog', { name: 'Person einladen' });
    expect(within(dialog).getByRole('button', { name: 'Schließen' })).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: 'Abbrechen' })).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: 'Einladung senden' })).toBeDisabled();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    fireEvent.mouseDown(dialog.parentElement as HTMLElement);
    expect(zu).not.toHaveBeenCalled();

    await act(async () => { ausgang.ablehnen({ response: { status: 409, data: { error: 'Für diese Person steht schon eine Einladung offen' } } }); });
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Für diese Person steht schon eine Einladung offen');
    // Die nächste Eingabe nimmt die Meldung weg.
    kennung('bena');
    expect(within(dialog).queryByRole('alert')).not.toBeInTheDocument();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(zu).toHaveBeenCalledTimes(1);
  });

  it('Enter in der Kennung sendet wie der Knopf -- aber erst, wenn eine Rolle gewählt ist', async () => {
    await oeffnen('web');
    kennung('ben.beispiel');
    const feld = screen.getByLabelText('Benutzername oder E-Mail') as HTMLInputElement;
    await act(async () => { fireEvent.submit(feld.form as HTMLFormElement); });
    expect(h.apiPost).not.toHaveBeenCalled();
    rolle('web', 'Teamer:in');
    await act(async () => { fireEvent.submit(feld.form as HTMLFormElement); });
    expect(h.apiPost.mock.calls).toEqual([['/einladungen', { kennung: 'ben.beispiel', role_id: 2 }]]);
  });
});

// --- Die Seite: welches Fenster aufgeht ---------------------------------------------------
describe('Person einladen auf der Seite Benutzer:innen', () => {
  it('breit: „Person einladen" öffnet den Dialog der Web-Fassung, nicht das Modal der App; nach dem Senden lädt die Seite neu', async () => {
    render(<AdminUsersPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Person einladen' }));
    const dialog = screen.getByRole('dialog', { name: 'Person einladen' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(h.stand.fenster).toEqual([]);
    await waitFor(() => expect(within(dialog).getByRole('combobox', { name: 'Rolle' })).toHaveTextContent('Teamer:in'));

    const einladungenVorher = h.apiGet.mock.calls.filter(([u]) => u === '/einladungen').length;
    kennung('ben');
    rolle('web', 'Teamer:in');
    await senden();
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Person einladen' })).not.toBeInTheDocument());
    expect(h.refresh).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(h.apiGet.mock.calls.filter(([u]) => u === '/einladungen').length).toBe(einladungenVorher + 1));
  });

  it('schmal: das Modal der App, kein Dialog -- sein Erfolg lädt dieselben Listen neu', async () => {
    h.breit = false;
    render(<AdminUsersPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Person in diese Gemeinde einladen' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(h.stand.fenster).toHaveLength(1);
    expect(h.stand.fenster[0].komponente).toBe(EinladungModal);
    await act(async () => { (h.stand.fenster[0].props.onSuccess as () => void)(); });
    expect(h.refresh).toHaveBeenCalledTimes(1);
  });
});
