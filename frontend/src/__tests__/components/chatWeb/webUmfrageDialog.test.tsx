// „Neue Umfrage" im Browser (components/chat/web/WebUmfrageDialog.tsx; Simon,
// 15.10.2026: „poll modal ist noch app"). Dieselben Felder, Regeln, Texte und
// derselbe Weg zum Server wie das Modal der App (modals/PollModal.tsx) --
// beide lesen useUmfrageFormular.
//
//   - Was der Dialog schickt: Route und Rumpf, Schalter für Schalter.
//   - Was fehlt, steht im Fenster; nichts geht an den Server.
//   - Ein Fehler des Servers steht im Fenster, der Dialog bleibt offen.
//   - Während des Sendens schließt nichts den Dialog; offline geht nichts.
//   - App und Browser schicken bei denselben Eingaben dieselbe Anfrage und
//     melden denselben Fehler.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, within, waitFor, cleanup, act } from '@testing-library/react';

const h = vi.hoisted(() => ({
  apiPost: vi.fn(),
  setError: vi.fn(),
  online: true,
}));

vi.mock('../../../services/api', () => ({ default: { post: (u: string, b?: unknown) => h.apiPost(u, b), get: vi.fn() } }));
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({ isOnline: h.online, setError: h.setError, setSuccess: vi.fn() }),
}));
// Für das Modal der App: JSDOM reicht ionChange/ionInput nicht an React durch
// (pushAuswahl.test.tsx) -- Schalter, Felder, Auswahl und Knöpfe als schlichte
// Elemente mit denselben Props (wie chatUmfrageRegeln.test.tsx).
vi.mock('@ionic/react', async () => {
  const echt = await vi.importActual<typeof import('@ionic/react')>('@ionic/react');
  const R = await vi.importActual<typeof import('react')>('react');
  type FeldProps = { value?: string; 'aria-label'?: string; onIonInput?: (e: { detail: { value: string } }) => void };
  const feld = (p: FeldProps) => R.createElement('input', {
    'aria-label': p['aria-label'], value: p.value ?? '',
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => p.onIonInput?.({ detail: { value: e.target.value } }),
  });
  const IonToggle = (p: { checked?: boolean; disabled?: boolean; 'aria-label'?: string; onIonChange?: (e: { detail: { checked: boolean } }) => void }) =>
    R.createElement('input', {
      type: 'checkbox', 'aria-label': p['aria-label'], checked: !!p.checked, disabled: !!p.disabled,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => p.onIonChange?.({ detail: { checked: e.target.checked } }),
    });
  const IonButton = (p: { children?: React.ReactNode; onClick?: () => void; disabled?: boolean; 'aria-label'?: string }) =>
    R.createElement('button', { onClick: p.onClick, disabled: p.disabled, 'aria-label': p['aria-label'] }, p.children);
  // Ionic gibt den Wert der Option mit ihrem Typ zurück (hier Zahlen).
  const IonSelect = (p: { label?: string; value?: number; children?: React.ReactNode; onIonChange?: (e: { detail: { value: number } }) => void }) =>
    R.createElement('select', {
      'aria-label': p.label, value: String(p.value),
      onChange: (e: React.ChangeEvent<HTMLSelectElement>) => p.onIonChange?.({ detail: { value: Number(e.target.value) } }),
    }, p.children);
  const IonSelectOption = (p: { value?: number; children?: React.ReactNode }) => R.createElement('option', { value: String(p.value) }, p.children);
  // „Option hinzufügen" ist eine antippbare Zeile mit Beschriftung.
  const IonItem = (p: { children?: React.ReactNode; onClick?: () => void }) => R.createElement('div', { onClick: p.onClick }, p.children);
  const IonLabel = (p: { children?: React.ReactNode }) => R.createElement('span', null, p.children);
  return { ...echt, IonToggle, IonButton, IonInput: feld, IonTextarea: feld, IonSelect, IonSelectOption, IonItem, IonLabel };
});

import WebUmfrageDialog from '../../../components/chat/web/WebUmfrageDialog';
import PollModal from '../../../components/chat/modals/PollModal';

const dialog = () => screen.getByRole('dialog', { name: 'Neue Umfrage' });
const feld = (name: string) => within(dialog()).getByRole('textbox', { name });
const schalter = (name: string) => within(dialog()).getByRole('switch', { name }) as HTMLInputElement;
const knopf = (name: string | RegExp) => within(dialog()).getByRole('button', { name }) as HTMLButtonElement;
const tippen = (name: string, wert: string) => fireEvent.change(feld(name), { target: { value: wert } });

const zeigen = () => {
  const onErstellt = vi.fn();
  const onSchliessen = vi.fn();
  render(<WebUmfrageDialog roomId={8} onErstellt={onErstellt} onSchliessen={onSchliessen} />);
  return { onErstellt, onSchliessen };
};

const absenden = async () => {
  fireEvent.click(knopf('Umfrage erstellen'));
  await act(async () => { await Promise.resolve(); });
};

beforeEach(() => {
  vi.clearAllMocks();
  h.online = true;
  h.apiPost.mockResolvedValue({ data: {} });
});
afterEach(() => cleanup());

describe('Web: was der Dialog schickt', () => {
  it('Frage und Antworten (leere fallen weg), Namen später, einmalig, Mehrfachauswahl, Ablauf 8 Stunden -- Route und Rumpf genau', async () => {
    const { onErstellt, onSchliessen } = zeigen();
    tippen('Frage', '  Wer kommt mit?  ');
    tippen('Option 1', 'Ja');
    fireEvent.click(knopf('Option hinzufügen'));
    tippen('Option 3', 'Nein');
    fireEvent.click(schalter('Mehrfachauswahl'));
    fireEvent.click(schalter('Namen anzeigen'));
    fireEvent.click(schalter('Namen erst später aufdecken'));
    fireEvent.click(schalter('Nur einmal antworten'));
    fireEvent.click(schalter('Ablaufdatum'));
    fireEvent.change(within(dialog()).getByRole('combobox', { name: 'Ablaufzeit' }), { target: { value: '8' } });
    await absenden();

    await waitFor(() => expect(h.apiPost).toHaveBeenCalledTimes(1));
    expect(h.apiPost).toHaveBeenCalledWith('/chat/rooms/8/polls', {
      question: 'Wer kommt mit?',
      options: ['Ja', 'Nein'],
      multiple_choice: true,
      anonymous: false,
      exclusive_options: false,
      einmalige_antwort: true,
      namen_spaeter: true,
      expires_in_hours: 8,
    });
    await waitFor(() => expect(onSchliessen).toHaveBeenCalledTimes(1));
    expect(onErstellt).toHaveBeenCalledTimes(1);
  });

  it('Voreinstellung: anonym, Einzelauswahl, ohne Ablauf', async () => {
    zeigen();
    tippen('Frage', 'Pizza?');
    tippen('Option 1', 'Ja');
    tippen('Option 2', 'Nein');
    await absenden();
    await waitFor(() => expect(h.apiPost).toHaveBeenCalledTimes(1));
    expect(h.apiPost.mock.calls[0][1]).toEqual({
      question: 'Pizza?', options: ['Ja', 'Nein'], multiple_choice: false, anonymous: true,
      exclusive_options: false, einmalige_antwort: false, namen_spaeter: false, expires_in_hours: null,
    });
  });

  it('Exklusive Optionen schalten die Mehrfachauswahl ab und sperren sie, mit dem Hinweis der App', async () => {
    zeigen();
    fireEvent.click(schalter('Mehrfachauswahl'));
    expect(schalter('Mehrfachauswahl').checked).toBe(true);
    fireEvent.click(schalter('Exklusive Optionen'));
    expect(schalter('Mehrfachauswahl').checked).toBe(false);
    expect(schalter('Mehrfachauswahl').disabled).toBe(true);
    expect(within(dialog()).getByText('Bei exklusiven Optionen nicht möglich')).toBeInTheDocument();
    tippen('Frage', 'Wer bringt was mit?');
    tippen('Option 1', 'Kuchen');
    tippen('Option 2', 'Saft');
    await absenden();
    await waitFor(() => expect(h.apiPost).toHaveBeenCalledTimes(1));
    expect(h.apiPost.mock.calls[0][1]).toMatchObject({ multiple_choice: false, exclusive_options: true });
  });

  it('„Namen anzeigen" wieder aus: anonym, und „Namen später" ist weg -- auch im Rumpf', async () => {
    zeigen();
    fireEvent.click(schalter('Namen anzeigen'));
    fireEvent.click(schalter('Namen erst später aufdecken'));
    fireEvent.click(schalter('Namen anzeigen'));
    expect(within(dialog()).queryByRole('switch', { name: 'Namen erst später aufdecken' })).toBeNull();
    tippen('Frage', 'Frage');
    tippen('Option 1', 'A');
    tippen('Option 2', 'B');
    await absenden();
    await waitFor(() => expect(h.apiPost).toHaveBeenCalledTimes(1));
    expect(h.apiPost.mock.calls[0][1]).toMatchObject({ anonymous: true, namen_spaeter: false });
  });

  it('zwei bis zehn Antworten: Entfernen erst ab der dritten, Hinzufügen bis zur zehnten', () => {
    zeigen();
    expect(within(dialog()).queryByRole('button', { name: /^Option \d+ entfernen$/ })).toBeNull();
    for (let i = 0; i < 8; i += 1) fireEvent.click(knopf('Option hinzufügen'));
    expect(within(dialog()).getAllByRole('textbox', { name: /^Option \d+$/ })).toHaveLength(10);
    expect(within(dialog()).queryByRole('button', { name: 'Option hinzufügen' })).toBeNull();
    tippen('Option 10', 'Letzte');
    fireEvent.click(knopf('Option 1 entfernen'));
    const felder = within(dialog()).getAllByRole('textbox', { name: /^Option \d+$/ }) as HTMLInputElement[];
    expect(felder).toHaveLength(9);
    expect(felder[8].value).toBe('Letzte');
    expect(knopf('Option hinzufügen')).toBeInTheDocument();
  });
});

describe('Web: was fehlt, steht im Fenster -- nichts geht an den Server', () => {
  it('ohne Frage: „Bitte gib eine Frage ein"; mit Frage, aber einer Antwort: „Bitte gib mindestens 2 Antwortmöglichkeiten ein"', async () => {
    const { onSchliessen } = zeigen();
    await absenden();
    expect(within(dialog()).getByRole('alert')).toHaveTextContent('Bitte gib eine Frage ein');
    tippen('Frage', 'Wer kommt?');
    // Eine Eingabe räumt die Meldung weg.
    expect(within(dialog()).queryByRole('alert')).toBeNull();
    tippen('Option 1', 'Ich');
    tippen('Option 2', '   ');
    await absenden();
    expect(within(dialog()).getByRole('alert')).toHaveTextContent('Bitte gib mindestens 2 Antwortmöglichkeiten ein');
    expect(h.apiPost).not.toHaveBeenCalled();
    expect(onSchliessen).not.toHaveBeenCalled();
    // Die Meldung steht im Fenster, nicht oben in der App.
    expect(h.setError).not.toHaveBeenCalled();
  });

  it('Fehler des Servers: „Fehler beim Erstellen der Umfrage" im Fenster, der Dialog bleibt offen mit den Eingaben', async () => {
    h.apiPost.mockRejectedValueOnce(new Error('500'));
    const { onErstellt, onSchliessen } = zeigen();
    tippen('Frage', 'Wer kommt?');
    tippen('Option 1', 'Ich');
    tippen('Option 2', 'Du');
    await absenden();
    await waitFor(() => expect(within(dialog()).getByRole('alert')).toHaveTextContent('Fehler beim Erstellen der Umfrage'));
    expect(onErstellt).not.toHaveBeenCalled();
    expect(onSchliessen).not.toHaveBeenCalled();
    expect((feld('Frage') as HTMLTextAreaElement).value).toBe('Wer kommt?');
    expect(knopf('Umfrage erstellen').disabled).toBe(false);
  });

  it('während des Sendens schließt nichts den Dialog (Abbrechen, X, Escape)', async () => {
    let fertig: (v: unknown) => void = () => undefined;
    h.apiPost.mockReturnValueOnce(new Promise((r) => { fertig = r; }));
    const { onSchliessen } = zeigen();
    tippen('Frage', 'Wer kommt?');
    tippen('Option 1', 'Ich');
    tippen('Option 2', 'Du');
    await absenden();
    expect(knopf('Abbrechen').disabled).toBe(true);
    expect(knopf('Schließen').disabled).toBe(true);
    fireEvent.keyDown(dialog(), { key: 'Escape' });
    expect(onSchliessen).not.toHaveBeenCalled();
    await act(async () => { fertig({ data: {} }); });
    await waitFor(() => expect(onSchliessen).toHaveBeenCalledTimes(1));
  });

  it('offline: „Umfrage erstellen" gesperrt, ein Hinweis dazu, nichts geht hinaus', async () => {
    h.online = false;
    zeigen();
    tippen('Frage', 'Wer kommt?');
    tippen('Option 1', 'Ich');
    tippen('Option 2', 'Du');
    expect(knopf('Umfrage erstellen').disabled).toBe(true);
    expect(within(dialog()).getByText('Du bist offline. Erstellen geht erst wieder mit Internetverbindung.')).toBeInTheDocument();
    fireEvent.submit(dialog().querySelector('form') as HTMLFormElement);
    await act(async () => { await Promise.resolve(); });
    expect(h.apiPost).not.toHaveBeenCalled();
  });
});

describe('App und Browser: eine Logik (useUmfrageFormular)', () => {
  /** Dieselben Eingaben im Modal der App (Ionic-Felder als schlichte Elemente). */
  const inDerAppAusfuellen = () => {
    fireEvent.change(screen.getByLabelText('Frage'), { target: { value: ' Ausflug wohin? ' } });
    fireEvent.change(screen.getByLabelText('Option 1'), { target: { value: 'Meer' } });
    fireEvent.change(screen.getByLabelText('Option 2'), { target: { value: 'Berge' } });
    fireEvent.click(screen.getByText('Option hinzufügen'));
    fireEvent.change(screen.getByLabelText('Option 3'), { target: { value: 'Stadt' } });
    fireEvent.click(screen.getByLabelText('Exklusive Optionen'));
    fireEvent.click(screen.getByLabelText('Namen anzeigen'));
    fireEvent.click(screen.getByLabelText('Ablaufdatum'));
    fireEvent.change(screen.getByLabelText('Ablaufzeit'), { target: { value: '168' } });
  };
  const imBrowserAusfuellen = () => {
    tippen('Frage', ' Ausflug wohin? ');
    tippen('Option 1', 'Meer');
    tippen('Option 2', 'Berge');
    fireEvent.click(knopf('Option hinzufügen'));
    tippen('Option 3', 'Stadt');
    fireEvent.click(schalter('Exklusive Optionen'));
    fireEvent.click(schalter('Namen anzeigen'));
    fireEvent.click(schalter('Ablaufdatum'));
    fireEvent.change(within(dialog()).getByRole('combobox', { name: 'Ablaufzeit' }), { target: { value: '168' } });
  };

  it('dieselben Eingaben: dieselbe Route, derselbe Rumpf', async () => {
    const onSuccess = vi.fn();
    render(<PollModal roomId={8} onClose={vi.fn()} onSuccess={onSuccess} />);
    inDerAppAusfuellen();
    fireEvent.click(screen.getByRole('button', { name: 'Umfrage erstellen' }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    cleanup();

    zeigen();
    imBrowserAusfuellen();
    await absenden();
    await waitFor(() => expect(h.apiPost).toHaveBeenCalledTimes(2));

    const [app, browser] = h.apiPost.mock.calls;
    expect(browser).toEqual(app);
    expect(app).toEqual(['/chat/rooms/8/polls', {
      question: 'Ausflug wohin?', options: ['Meer', 'Berge', 'Stadt'], multiple_choice: false, anonymous: false,
      exclusive_options: true, einmalige_antwort: false, namen_spaeter: false, expires_in_hours: 168,
    }]);
  });

  it('derselbe Fehler des Servers: die App meldet ihn oben, der Browser im Fenster -- mit demselben Satz', async () => {
    h.apiPost.mockRejectedValue(new Error('500'));
    render(<PollModal roomId={8} onClose={vi.fn()} onSuccess={vi.fn()} />);
    inDerAppAusfuellen();
    fireEvent.click(screen.getByRole('button', { name: 'Umfrage erstellen' }));
    await waitFor(() => expect(h.setError).toHaveBeenCalledWith('Fehler beim Erstellen der Umfrage'));
    cleanup();

    zeigen();
    imBrowserAusfuellen();
    await absenden();
    await waitFor(() => expect(within(dialog()).getByRole('alert')).toHaveTextContent('Fehler beim Erstellen der Umfrage'));
    expect(h.setError).toHaveBeenCalledTimes(1);
  });
});
