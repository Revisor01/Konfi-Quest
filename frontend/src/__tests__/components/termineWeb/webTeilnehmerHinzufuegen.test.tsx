// Konfi, Team, Leitung hinzufügen -- das Modal der App
// (modals/ParticipantManagementModal) und der Dialog der Web-Fassung
// (web/termine/WebTeilnehmerHinzufuegenDialog) im Vergleich (Simon,
// 15.10.2026: im Browser ab 992 px jedes Formular als kompaktes Fenster).
//
// Beide lesen denselben Hook (useTeilnehmerHinzufuegen). Jeder Ablauf läuft
// hier deshalb zweimal, einmal je Fassung, mit denselben Erwartungen:
// dieselben wählbaren Personen je Rolle (nur wer zu einem Jahrgang des Events
// gehört; die Gemeindeleitung ist ausgenommen), derselbe Rumpf an dieselbe
// Route, dieselbe Rückfrage „Trotzdem eintragen", dieselben Texte bei
// Prüfung und Ablehnung. Was sich unterscheidet, steht ausdrücklich da:
// Meldungen stehen in der App oben (setError), im Browser im Dialog; die
// Rückfrage ist in der App ein Alert, im Browser ein kleiner Dialog.
//
// Ersetzt sind Netz, Kontext und die Ionic-Bausteine der App (schlichte
// HTML-Nachbauten mit denselben Namen).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, within, waitFor, cleanup, act } from '@testing-library/react';

const h = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  setError: vi.fn(),
  alert: vi.fn(),
  online: true,
}));

type Kinder = { children?: React.ReactNode };

vi.mock('@ionic/react', () => {
  const durch = ({ children }: Kinder) => <div>{children}</div>;
  return {
    IonPage: durch, IonHeader: durch, IonToolbar: durch, IonButtons: durch, IonContent: durch,
    IonList: durch, IonItem: durch, IonListHeader: durch, IonCard: durch, IonCardContent: durch,
    IonTitle: ({ children }: Kinder) => <h1>{children}</h1>,
    IonLabel: ({ children }: Kinder) => <span>{children}</span>,
    IonIcon: () => null,
    IonButton: ({ children, onClick, disabled, 'aria-label': name }: Kinder & { onClick?: () => void; disabled?: boolean; 'aria-label'?: string }) => (
      <button type="button" aria-label={name} onClick={onClick} disabled={disabled}>{children}</button>
    ),
    IonInput: ({ value, onIonInput, 'aria-label': name }: { value?: string; onIonInput?: (e: { detail: { value: string } }) => void; 'aria-label'?: string }) => (
      <input aria-label={name} value={value ?? ''} onChange={(e) => onIonInput?.({ detail: { value: e.target.value } })} />
    ),
    // Werte als JSON: Die Auswahl der App liefert Zahlen (Zeitfenster) und null, nicht Text.
    IonSelect: ({ children, value, onIonChange, 'aria-label': name }: Kinder & {
      value?: unknown; onIonChange?: (e: { detail: { value: unknown } }) => void; 'aria-label'?: string;
    }) => (
      <select aria-label={name} value={JSON.stringify(value ?? null)} onChange={(e) => onIonChange?.({ detail: { value: JSON.parse(e.target.value) } })}>
        {children}
      </select>
    ),
    IonSelectOption: ({ children, value }: Kinder & { value: unknown }) => <option value={JSON.stringify(value ?? null)}>{children}</option>,
    useIonAlert: () => [(o: unknown) => h.alert(o), vi.fn()],
  };
});
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({ setError: h.setError, isOnline: h.online }),
}));
vi.mock('../../../services/api', () => ({
  default: { get: (u: string) => h.apiGet(u), post: (u: string, b?: unknown) => h.apiPost(u, b) },
}));

import ParticipantManagementModal from '../../../components/admin/modals/ParticipantManagementModal';
import WebTeilnehmerHinzufuegenDialog from '../../../components/admin/web/termine/WebTeilnehmerHinzufuegenDialog';

// --- Daten (Antwortformen wie im Backend) ----------------------------------------------
const JG_A = 301;
const JG_B = 302;
const KONFIS = [
  { id: 1, name: 'Konfi Anna', jahrgang_id: JG_A, jahrgang_name: 'JG A' },
  { id: 2, name: 'Konfi Bela', jahrgang_id: JG_B, jahrgang_name: 'JG B' },
  { id: 3, name: 'Konfi Carl', jahrgang_id: JG_A, jahrgang_name: 'JG A' },
];
const TEAM = [
  { id: 11, name: 'Teamer Ada', jahrgang_ids: [JG_A], jahrgang_name: 'JG A' },
  { id: 12, name: 'Teamer Ben', jahrgang_ids: [JG_B], jahrgang_name: 'JG B' },
];
const LEITUNG = [
  { id: 21, name: 'Leitung Bert', role_name: 'admin', jahrgang_ids: [JG_B] },
  { id: 22, name: 'Leitung Olga', role_name: 'org_admin', jahrgang_ids: [] },
];
const ZEITFENSTER = [
  { id: 41, start_time: '2026-10-20T08:00:00Z', end_time: '2026-10-20T09:00:00Z', max_participants: 8, registered_count: 3 },
  { id: 42, start_time: '2026-10-20T09:00:00Z', end_time: '2026-10-20T10:00:00Z', max_participants: 2, registered_count: 2 },
];

/** GET /events/7: Jahrgang A, Carl ist schon eingetragen. */
let termin: Record<string, unknown>;

const fertig = vi.fn();
const zu = vi.fn();

beforeEach(() => {
  // reset statt clear: Ein nicht verbrauchtes mockResolvedValueOnce eines
  // Tests (etwa wenn er fällt) soll nicht in den nächsten hinüberreichen.
  vi.resetAllMocks();
  h.online = true;
  termin = { id: 7, jahrgaenge: [{ id: JG_A, name: 'JG A' }], participants: [{ id: 90, user_id: 3, role_name: 'konfi', status: 'confirmed' }] };
  h.apiGet.mockImplementation(async (pfad: string) => {
    if (pfad === '/events/7') return { data: termin };
    if (pfad === '/admin/konfis') return { data: KONFIS };
    if (pfad === '/admin/konfis/teamer') return { data: TEAM };
    if (pfad === '/admin/konfis/leitung') return { data: LEITUNG };
    throw new Error(`unerwartet: ${pfad}`);
  });
  h.apiPost.mockResolvedValue({ data: {} });
});
afterEach(() => cleanup());

// --- Bedienung je Fassung ----------------------------------------------------------------
type Fassung = 'app' | 'web';
type Rolle = 'konfi' | 'teamer' | 'leitung';

/** Die wählbaren Personen in Anzeigereihenfolge. */
const namen = (fassung: Fassung): string[] => {
  if (fassung === 'app') {
    return Array.from(document.querySelectorAll('.app-list-item__title')).map((t) => t.textContent?.trim() ?? '');
  }
  const gruppe = screen.queryByRole('group', { name: /^Personen \(/ });
  if (!gruppe) return [];
  return within(gruppe).queryAllByRole('checkbox').map((el) => (el.getAttribute('aria-label') ?? '').split(', ')[0]);
};

const oeffnen = async (fassung: Fassung, rolle: Rolle, erwartet: string) => {
  if (fassung === 'app') render(<ParticipantManagementModal eventId={7} filterRole={rolle} onClose={zu} onSuccess={fertig} />);
  else render(<WebTeilnehmerHinzufuegenDialog eventId={7} filterRole={rolle} onSchliessen={zu} onSuccess={fertig} />);
  await waitFor(() => expect(namen(fassung)).toContain(erwartet));
};

const waehle = (fassung: Fassung, name: string) => {
  if (fassung === 'app') {
    const titel = [...document.querySelectorAll('.app-list-item__title')].find((t) => t.textContent === name);
    fireEvent.click(titel!.closest('[role="button"]') as HTMLElement);
  } else {
    const gruppe = screen.getByRole('group', { name: /^Personen \(/ });
    const haken = within(gruppe).getAllByRole('checkbox').find((el) => el.getAttribute('aria-label')?.startsWith(`${name}`));
    fireEvent.click(haken as HTMLElement);
  }
};

const hinzufuegen = async (fassung: Fassung) => {
  const knopf = fassung === 'app'
    ? screen.getByRole('button', { name: 'Teilnehmer:innen hinzufügen' })
    : within(screen.getAllByRole('dialog')[0]).getByRole('button', { name: /^\d+ hinzufügen$/ });
  await act(async () => { fireEvent.click(knopf); });
};

const zeitfenster = (fassung: Fassung, id: number) => {
  const feld = fassung === 'app' ? screen.getByLabelText('Zeitslot') : screen.getByRole('combobox', { name: 'Zeitslot' });
  fireEvent.change(feld, { target: { value: fassung === 'app' ? JSON.stringify(id) : String(id) } });
};

/** Die Meldung: in der App oben (setError), im Browser im Dialog -- derselbe Text. */
const erwarteMeldung = async (fassung: Fassung, text: string) => {
  if (fassung === 'app') {
    await waitFor(() => expect(h.setError.mock.calls.at(-1)?.[0]).toBe(text));
  } else {
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(text));
    expect(h.setError).not.toHaveBeenCalled();
  }
};

/** Die Rückfrage „voll -- trotzdem eintragen?" beantworten; gibt Kopf und Satz zurück. */
const ueberbuchen = async (fassung: Fassung, ja: boolean): Promise<{ titel: string; satz: string }> => {
  if (fassung === 'app') {
    await waitFor(() => expect(h.alert).toHaveBeenCalled());
    const frage = h.alert.mock.calls.at(-1)![0] as { header: string; message: string; buttons: Array<{ text: string; handler?: () => void }> };
    await act(async () => { frage.buttons.find((b) => b.text === (ja ? 'Trotzdem eintragen' : 'Abbrechen'))!.handler!(); });
    return { titel: frage.header, satz: frage.message };
  }
  const rueckfrage = await screen.findByRole('dialog', { name: /voll$/ });
  const titel = rueckfrage.getAttribute('aria-labelledby') ? within(rueckfrage).getByRole('heading').textContent ?? '' : '';
  const satz = rueckfrage.querySelector('.web-dialog__beschreibung')?.textContent ?? '';
  await act(async () => { fireEvent.click(within(rueckfrage).getByRole('button', { name: ja ? 'Trotzdem eintragen' : 'Abbrechen' })); });
  return { titel, satz };
};

// --- Abläufe, je Fassung -----------------------------------------------------------------
describe.each<Fassung>(['app', 'web'])('Teilnehmende hinzufügen (%s): dieselbe Logik in App und Browser', (fassung) => {
  it('Konfis: nur aus dem Jahrgang des Events, wer schon dabei ist, fehlt; die Erklärung steht da', async () => {
    await oeffnen(fassung, 'konfi', 'Konfi Anna');
    expect(namen(fassung)).toEqual(['Konfi Anna']);
    expect(document.body).toHaveTextContent('Angeboten werden nur Personen aus dem Jahrgang dieses Events (JG A). Die Gemeindeleitung ist davon ausgenommen.');
    expect(h.apiGet.mock.calls.map(([p]) => p)).toEqual(['/events/7', '/admin/konfis', '/admin/konfis/teamer']);
  });

  it('Team: nur aus dem Jahrgang des Events; Leitung: die Gemeindeleitung ist ausgenommen, Leitung anderer Jahrgänge fehlt', async () => {
    await oeffnen(fassung, 'teamer', 'Teamer Ada');
    expect(namen(fassung)).toEqual(['Teamer Ada']);
    cleanup();
    await oeffnen(fassung, 'leitung', 'Leitung Olga');
    expect(namen(fassung)).toEqual(['Leitung Olga']);
    expect(h.apiGet.mock.calls.map(([p]) => p)).toContain('/admin/konfis/leitung');
  });

  it('ohne Jahrgang: alle aus dem Team, kein Hinweis; die Suche filtert dieselbe Liste', async () => {
    termin = { id: 7, jahrgaenge: [], participants: [] };
    await oeffnen(fassung, 'teamer', 'Teamer Ben');
    expect(namen(fassung)).toEqual(['Teamer Ada', 'Teamer Ben']);
    expect(document.body).not.toHaveTextContent('Angeboten werden nur Personen');
    fireEvent.change(screen.getByLabelText('Person suchen'), { target: { value: 'ben' } });
    expect(namen(fassung)).toEqual(['Teamer Ben']);
  });

  it('Eintragen: je Person POST /events/7/participants mit Status, ohne Zeitfenster, ueberbuchen ausdrücklich false', async () => {
    termin = { id: 7, jahrgaenge: [], participants: [] };
    await oeffnen(fassung, 'konfi', 'Konfi Bela');
    waehle(fassung, 'Konfi Bela');
    waehle(fassung, 'Konfi Anna');
    await hinzufuegen(fassung);
    await waitFor(() => expect(fertig).toHaveBeenCalledTimes(1));
    expect(h.apiPost.mock.calls).toEqual([
      ['/events/7/participants', { user_id: 2, status: 'confirmed', ueberbuchen: false }],
      ['/events/7/participants', { user_id: 1, status: 'confirmed', ueberbuchen: false }],
    ]);
  });

  it('mit Zeitfenstern: ohne Wahl nichts gesendet, dieselbe Meldung; mit Wahl die timeslot_id im Rumpf', async () => {
    termin = { id: 7, jahrgaenge: [], participants: [], has_timeslots: true, timeslots: ZEITFENSTER };
    await oeffnen(fassung, 'konfi', 'Konfi Anna');
    waehle(fassung, 'Konfi Anna');
    await hinzufuegen(fassung);
    await erwarteMeldung(fassung, 'Bitte wähle einen Zeitslot aus');
    expect(h.apiPost).not.toHaveBeenCalled();

    zeitfenster(fassung, 41);
    await hinzufuegen(fassung);
    await waitFor(() => expect(fertig).toHaveBeenCalledTimes(1));
    expect(h.apiPost.mock.calls).toEqual([['/events/7/participants', { user_id: 1, status: 'confirmed', timeslot_id: 41, ueberbuchen: false }]]);
  });

  it('Event voll: dieselbe Rückfrage; nach „Trotzdem eintragen" derselbe Aufruf mit ueberbuchen true', async () => {
    h.apiPost
      .mockRejectedValueOnce({ response: { status: 400, data: { error: 'voll', error_code: 'event_voll', max: 20, belegt: 20, seite: 'konfi' } } })
      .mockResolvedValueOnce({ data: {} });
    await oeffnen(fassung, 'konfi', 'Konfi Anna');
    waehle(fassung, 'Konfi Anna');
    await hinzufuegen(fassung);
    const frage = await ueberbuchen(fassung, true);
    expect(frage).toEqual({ titel: 'Das Event ist voll', satz: 'Alle 20 Plätze sind vergeben. Konfi Anna trotzdem eintragen? Das Event ist dann überbucht.' });
    await waitFor(() => expect(fertig).toHaveBeenCalledTimes(1));
    expect(h.apiPost.mock.calls).toEqual([
      ['/events/7/participants', { user_id: 1, status: 'confirmed', ueberbuchen: false }],
      ['/events/7/participants', { user_id: 1, status: 'confirmed', ueberbuchen: true }],
    ]);
  });

  it('Event voll, „Abbrechen": kein zweiter Aufruf, niemand eingetragen', async () => {
    h.apiPost.mockRejectedValueOnce({ response: { status: 400, data: { error_code: 'event_voll', max: 20, belegt: 20 } } });
    await oeffnen(fassung, 'konfi', 'Konfi Anna');
    waehle(fassung, 'Konfi Anna');
    await hinzufuegen(fassung);
    await ueberbuchen(fassung, false);
    await act(async () => { await Promise.resolve(); });
    expect(h.apiPost).toHaveBeenCalledTimes(1);
    expect(fertig).not.toHaveBeenCalled();
  });

  it('lehnt der Server ab, steht seine Begründung da -- niemand gilt als eingetragen', async () => {
    h.apiPost.mockRejectedValue({ response: { status: 403, data: { error: 'Konfi Anna gehört zu keinem Jahrgang dieses Events.' } } });
    await oeffnen(fassung, 'konfi', 'Konfi Anna');
    waehle(fassung, 'Konfi Anna');
    await hinzufuegen(fassung);
    await erwarteMeldung(fassung, 'Konfi Anna gehört zu keinem Jahrgang dieses Events.');
    expect(fertig).not.toHaveBeenCalled();
    expect(zu).not.toHaveBeenCalled();
  });

  it('scheitert das Laden, dieselbe Meldung', async () => {
    h.apiGet.mockRejectedValue(new Error('Netz weg'));
    if (fassung === 'app') render(<ParticipantManagementModal eventId={7} filterRole="konfi" onClose={zu} onSuccess={fertig} />);
    else render(<WebTeilnehmerHinzufuegenDialog eventId={7} filterRole="konfi" onSchliessen={zu} onSuccess={fertig} />);
    await erwarteMeldung(fassung, 'Fehler beim Laden der Daten');
  });

  it('offline: Eintragen gesperrt, nichts gesendet', async () => {
    h.online = false;
    await oeffnen(fassung, 'konfi', 'Konfi Anna');
    waehle(fassung, 'Konfi Anna');
    const knopf = fassung === 'app'
      ? screen.getByRole('button', { name: 'Teilnehmer:innen hinzufügen' })
      : within(screen.getByRole('dialog')).getByRole('button', { name: '1 hinzufügen' });
    expect(knopf).toBeDisabled();
    expect(h.apiPost).not.toHaveBeenCalled();
  });
});

// --- Nur der Browser ----------------------------------------------------------------------
describe('Teilnehmende hinzufügen (web): das Fenster', () => {
  it('heißt wie der Knopf, der es öffnet', async () => {
    for (const [rolle, titel] of [['konfi', 'Konfi hinzufügen'], ['teamer', 'Team hinzufügen'], ['leitung', 'Leitung hinzufügen']] as const) {
      render(<WebTeilnehmerHinzufuegenDialog eventId={7} filterRole={rolle} onSchliessen={zu} onSuccess={fertig} />);
      expect(screen.getByRole('dialog', { name: titel })).toBeInTheDocument();
      await act(async () => { await Promise.resolve(); });
      cleanup();
    }
  });

  it('solange gesendet wird, schließt nichts das Fenster (X, Abbrechen, Escape)', async () => {
    let ablehnen: (grund: unknown) => void = () => undefined;
    h.apiPost.mockReturnValue(new Promise((_ok, nein) => { ablehnen = nein; }));
    await oeffnen('web', 'konfi', 'Konfi Anna');
    waehle('web', 'Konfi Anna');
    await hinzufuegen('web');
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Schließen' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Abbrechen' }));
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(zu).not.toHaveBeenCalled();
    await act(async () => { ablehnen(new Error('Netzwerkfehler')); });
    await erwarteMeldung('web', 'Fehler beim Hinzufügen der Teilnehmer:innen');
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Abbrechen' }));
    expect(zu).toHaveBeenCalledTimes(1);
  });
});
