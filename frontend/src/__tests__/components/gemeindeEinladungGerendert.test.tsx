// Gemeinde-Einladungen (2.3.0) in der Oberflaeche -- gerendert (Audit Tests
// 26.09.2026, BF-10: EinladungModal und EinladungenKarte hatten keinen Test,
// das Backend dagegen 17).
//
// Leitung: Kennung und Rolle waehlen, erst dann laesst sich senden; Konfi
// steht nicht zur Wahl. Eingeladene Person: die Karte steht nur da, wenn
// etwas offen ist; Annehmen laedt die App neu (die Zugehoerigkeit haengt am
// Anmeldetoken), Ablehnen laedt die Liste neu.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';

const { apiGet, apiPost, setError, setSuccess, zustand } = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  setError: vi.fn(),
  setSuccess: vi.fn(),
  zustand: { online: true },
}));

vi.mock('../../services/api', () => ({ default: { get: apiGet, post: apiPost } }));
vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({ setError, setSuccess, isOnline: zustand.online }),
}));
vi.mock('@ionic/react', () => {
  type P = { children?: React.ReactNode };
  const durch = ({ children }: P) => <>{children}</>;
  return {
    IonPage: durch, IonHeader: durch, IonToolbar: durch, IonTitle: durch, IonButtons: durch,
    IonContent: durch, IonList: durch, IonListHeader: durch, IonLabel: durch, IonCard: durch,
    IonCardContent: durch, IonItem: durch, IonNote: durch, IonIcon: () => null,
    IonButton: ({ children, onClick, disabled, 'aria-label': label }: P & { onClick?: () => void; disabled?: boolean; 'aria-label'?: string }) =>
      <button type="button" aria-label={label} disabled={disabled} onClick={onClick}>{children}</button>,
    IonInput: ({ label, value, onIonInput }: { label: string; value: string; onIonInput: (e: { detail: { value: string } }) => void }) =>
      <input aria-label={label} value={value} onChange={(e) => onIonInput({ detail: { value: e.target.value } })} />,
  };
});

import EinladungModal from '../../components/admin/modals/EinladungModal';
import EinladungenKarte, { type OffeneEinladung } from '../../components/shared/EinladungenKarte';

const ROLLEN = [
  { id: 1, name: 'konfi', display_name: 'Konfi' },
  { id: 2, name: 'teamer', display_name: 'Teamer:in' },
  { id: 3, name: 'admin', display_name: 'Admin' },
  { id: 4, name: 'org_admin', display_name: 'Org-Admin' },
  { id: 5, name: 'super_admin', display_name: 'Super-Admin' },
];

const einladung = (id: number, gemeinde: string, von: string | null = 'Anna Leitung'): OffeneEinladung => ({
  id, organization_display_name: gemeinde, organization_name: gemeinde.toLowerCase(),
  role_display_name: 'Admin', role_name: 'admin', eingeladen_von_name: von, expires_at: '2026-10-13T00:00:00Z',
});

beforeEach(() => {
  vi.clearAllMocks();
  // Auch nicht verbrauchte ...Once-Antworten verwerfen, sonst wandern sie in den naechsten Test.
  apiGet.mockReset();
  apiPost.mockReset();
  zustand.online = true;
});

describe('EinladungModal (Leitung laedt ein)', () => {
  const senden = () => screen.getByRole('button', { name: 'Einladung senden' });

  beforeEach(() => {
    apiGet.mockResolvedValue({ data: ROLLEN });
  });

  it('bietet Gemeindeleitung, Leitung und Teamer:in an -- weder Konfi noch Super-Admin', async () => {
    const { container } = render(<EinladungModal onClose={vi.fn()} onSuccess={vi.fn()} />);
    await screen.findByText('Teamer:in');
    expect(apiGet).toHaveBeenCalledWith('/roles');
    // Angezeigt wird der Rollenname aus utils/rollenNamen (unbekannte bleiben technisch).
    const angeboten = Array.from(container.querySelectorAll('.app-list-item span:first-child'))
      .map((s) => s.textContent);
    expect(angeboten).toEqual(['Teamer:in', 'Leitung', 'Gemeindeleitung']);
  });

  it('Senden erst mit Kennung UND Rolle; schickt die Kennung ohne Leerzeichen', async () => {
    const onSuccess = vi.fn();
    apiPost.mockResolvedValue({ data: { display_name: 'Ben Beispiel' } });
    render(<EinladungModal onClose={vi.fn()} onSuccess={onSuccess} />);
    await screen.findByText('Teamer:in');
    expect(senden()).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Benutzername oder E-Mail'), { target: { value: '  ben.beispiel ' } });
    expect(senden()).toBeDisabled();
    fireEvent.click(screen.getByText('Leitung'));
    expect(senden()).toBeEnabled();

    await act(async () => { fireEvent.click(senden()); });
    expect(apiPost).toHaveBeenCalledWith('/einladungen', { kennung: 'ben.beispiel', role_id: 3 });
    expect(setSuccess).toHaveBeenCalledWith('Ben Beispiel wurde eingeladen und entscheidet jetzt selbst.');
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('nur Leerzeichen als Kennung zaehlt nicht', async () => {
    render(<EinladungModal onClose={vi.fn()} onSuccess={vi.fn()} />);
    await screen.findByText('Teamer:in');
    fireEvent.change(screen.getByLabelText('Benutzername oder E-Mail'), { target: { value: '   ' } });
    fireEvent.click(screen.getByText('Teamer:in'));
    expect(senden()).toBeDisabled();
  });

  it('offline laesst sich nicht senden', async () => {
    zustand.online = false;
    render(<EinladungModal onClose={vi.fn()} onSuccess={vi.fn()} />);
    await screen.findByText('Teamer:in');
    fireEvent.change(screen.getByLabelText('Benutzername oder E-Mail'), { target: { value: 'ben' } });
    fireEvent.click(screen.getByText('Teamer:in'));
    expect(senden()).toBeDisabled();
  });

  it('Fehler des Servers: Meldung, kein Erfolg, Dialog bleibt offen', async () => {
    const onSuccess = vi.fn();
    apiPost.mockRejectedValue({ response: { status: 404, data: { error: 'Kein Konto mit dieser Kennung gefunden' } } });
    render(<EinladungModal onClose={vi.fn()} onSuccess={onSuccess} />);
    await screen.findByText('Teamer:in');
    fireEvent.change(screen.getByLabelText('Benutzername oder E-Mail'), { target: { value: 'niemand' } });
    fireEvent.click(screen.getByText('Teamer:in'));
    await act(async () => { fireEvent.click(senden()); });
    expect(apiPost).toHaveBeenCalledWith('/einladungen', { kennung: 'niemand', role_id: 2 });
    expect(setError).toHaveBeenCalledWith('Kein Konto mit dieser Kennung gefunden');
    expect(setSuccess).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });
});

describe('EinladungenKarte (eingeladene Person antwortet)', () => {
  let reload: ReturnType<typeof vi.fn>;
  const original = window.location;

  beforeEach(() => {
    reload = vi.fn();
    Object.defineProperty(window, 'location', { configurable: true, value: { ...original, reload } });
  });
  afterEach(() => {
    Object.defineProperty(window, 'location', { configurable: true, value: original });
    vi.useRealTimers();
  });

  it('ohne offene Einladung steht nichts da -- auch nicht, wenn die Liste nicht laedt', async () => {
    apiGet.mockResolvedValueOnce({ data: [] });
    const leer = render(<EinladungenKarte variante="users" />);
    await waitFor(() => expect(apiGet).toHaveBeenCalledWith('/einladungen/meine'));
    expect(leer.container.innerHTML).toBe('');
    leer.unmount();

    apiGet.mockRejectedValueOnce(new Error('offline'));
    const fehler = render(<EinladungenKarte variante="users" />);
    await waitFor(() => expect(apiGet).toHaveBeenCalledTimes(2));
    expect(fehler.container.innerHTML).toBe('');
    expect(setError).not.toHaveBeenCalled();
  });

  it('zeigt Gemeinde, Rolle und wer eingeladen hat; Ueberschrift nach Anzahl', async () => {
    apiGet.mockResolvedValueOnce({ data: [einladung(5, 'St. Petri'), einladung(6, 'St. Marien', null)] });
    render(<EinladungenKarte variante="teamer" />);
    expect(await screen.findByText('St. Petri')).toBeInTheDocument();
    expect(screen.getByText('Einladungen')).toBeInTheDocument();
    expect(screen.getByText('als Leitung · von Anna Leitung')).toBeInTheDocument();
    expect(screen.getByText('als Leitung')).toBeInTheDocument();
  });

  it('Ablehnen: meldet es und laedt die Liste neu -- die Karte verschwindet', async () => {
    apiGet.mockResolvedValueOnce({ data: [einladung(5, 'St. Petri')] }).mockResolvedValueOnce({ data: [] });
    apiPost.mockResolvedValue({ data: {} });
    const { container } = render(<EinladungenKarte variante="users" />);
    await screen.findByText('St. Petri');
    expect(screen.getByText('Einladung')).toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByText('Ablehnen')); });
    expect(apiPost).toHaveBeenCalledWith('/einladungen/5/ablehnen');
    expect(setSuccess).toHaveBeenCalledWith('Einladung abgelehnt.');
    expect(apiGet).toHaveBeenCalledTimes(2);
    expect(container.innerHTML).toBe('');
    expect(reload).not.toHaveBeenCalled();
  });

  it('Annehmen: meldet die Gemeinde und laedt die App neu', async () => {
    apiGet.mockResolvedValueOnce({ data: [einladung(5, 'St. Petri')] });
    apiPost.mockResolvedValue({ data: { organization: { display_name: 'St. Petri' } } });
    render(<EinladungenKarte variante="purple" />);
    await screen.findByText('St. Petri');
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    await act(async () => { fireEvent.click(screen.getByText('Annehmen')); });
    expect(apiPost).toHaveBeenCalledWith('/einladungen/5/annehmen');
    expect(setSuccess).toHaveBeenCalledWith('Du arbeitest jetzt auch in St. Petri. Die App lädt neu.');
    expect(reload).not.toHaveBeenCalled();
    await act(async () => { vi.advanceTimersByTime(1200); });
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('Fehler beim Antworten: Meldung, Knoepfe wieder frei, kein Neuladen', async () => {
    apiGet.mockResolvedValueOnce({ data: [einladung(5, 'St. Petri')] });
    apiPost.mockRejectedValue({ response: { status: 410, data: { error: 'Die Einladung ist abgelaufen' } } });
    render(<EinladungenKarte variante="users" />);
    await screen.findByText('St. Petri');
    await act(async () => { fireEvent.click(screen.getByText('Annehmen')); });
    expect(setError).toHaveBeenCalledWith('Die Einladung ist abgelaufen');
    expect(setSuccess).not.toHaveBeenCalled();
    expect(screen.getByText('Annehmen').closest('button')).toBeEnabled();
    expect(reload).not.toHaveBeenCalled();
  });

  it('offline sind Annehmen und Ablehnen gesperrt', async () => {
    zustand.online = false;
    apiGet.mockResolvedValueOnce({ data: [einladung(5, 'St. Petri')] });
    render(<EinladungenKarte variante="users" />);
    await screen.findByText('St. Petri');
    expect(screen.getByText('Annehmen').closest('button')).toBeDisabled();
    expect(screen.getByText('Ablehnen').closest('button')).toBeDisabled();
  });
});
