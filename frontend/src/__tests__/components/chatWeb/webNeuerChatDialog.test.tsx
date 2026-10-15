// „Neuer Chat" -- das Modal der App (modals/SimpleCreateChatModal) und der
// Dialog der Web-Fassung (web/WebNeuerChatDialog) im Vergleich (Simon,
// 15.10.2026: „neuer chat modal ist noch app").
//
// Beide lesen denselben Hook (useNeuerChat). Jeder Ablauf laeuft hier deshalb
// zweimal, einmal je Fassung, mit denselben Erwartungen: dieselben waehlbaren
// Personen je Rolle (Konfis nur Direktnachrichten an ihr Team, Teamer:innen
// nur Konfis ihrer Jahrgaenge), dieselben Filter, dieselben Ruempfe an
// dieselben Routen, dieselben Texte bei Ablehnung, Offline und Pruefung. Was
// sich unterscheidet, steht ausdruecklich da: Meldungen stehen in der App oben
// (setError), im Browser im Dialog; den Gruppenchat ohne Namen sperrt die App
// am Haken, der Browser sagt im Dialog, was fehlt.
//
// Ersetzt sind Netz, Kontexte und die Ionic-Bausteine der App (schlichte
// HTML-Nachbauten mit denselben Namen).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { createContext, useContext } from 'react';
import { render, screen, fireEvent, within, waitFor, cleanup, act } from '@testing-library/react';
import { karteVon } from '../rollenfarbePruefen';

const h = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  setError: vi.fn(),
  zaehler: vi.fn(async () => undefined),
  alert: vi.fn(),
  online: true,
  user: { id: 14, type: 'admin' } as Record<string, unknown>,
}));

type Kinder = { children?: React.ReactNode };
const SegmentWahl = createContext<(wert: string) => void>(() => undefined);

vi.mock('@ionic/react', () => {
  const durch = ({ children }: Kinder) => <div>{children}</div>;
  return {
    IonPage: React.forwardRef<HTMLDivElement, Kinder>(({ children }, ref) => <div ref={ref}>{children}</div>),
    IonHeader: durch, IonToolbar: durch, IonButtons: durch, IonContent: durch,
    IonList: durch, IonItem: durch, IonItemGroup: durch, IonListHeader: durch, IonCard: durch, IonCardContent: durch,
    IonTitle: ({ children }: Kinder) => <h1>{children}</h1>,
    IonLabel: ({ children }: Kinder) => <span>{children}</span>,
    IonIcon: () => null,
    IonSpinner: () => <span role="progressbar" />,
    IonButton: ({ children, onClick, disabled, 'aria-label': name }: Kinder & { onClick?: () => void; disabled?: boolean; 'aria-label'?: string }) => (
      <button type="button" aria-label={name} onClick={onClick} disabled={disabled}>{children}</button>
    ),
    IonInput: ({ value, onIonInput, disabled, 'aria-label': name }: {
      value?: string; onIonInput?: (e: { detail: { value: string } }) => void; disabled?: boolean; 'aria-label'?: string;
    }) => <input aria-label={name} value={value ?? ''} disabled={disabled} onChange={(e) => onIonInput?.({ detail: { value: e.target.value } })} />,
    IonSelect: ({ children, value, onIonChange, 'aria-label': name }: Kinder & {
      value?: string; onIonChange?: (e: { detail: { value: string } }) => void; 'aria-label'?: string;
    }) => <select aria-label={name} value={value} onChange={(e) => onIonChange?.({ detail: { value: e.target.value } })}>{children}</select>,
    IonSelectOption: ({ children, value }: Kinder & { value: string }) => <option value={value}>{children}</option>,
    IonSegment: ({ children, onIonChange }: Kinder & { onIonChange?: (e: { detail: { value: string } }) => void }) => (
      <SegmentWahl.Provider value={(wert) => onIonChange?.({ detail: { value: wert } })}>
        <div role="tablist">{children}</div>
      </SegmentWahl.Provider>
    ),
    IonSegmentButton: ({ children, value }: Kinder & { value: string }) => {
      const waehle = useContext(SegmentWahl);
      return <button type="button" role="tab" onClick={() => waehle(value)}>{children}</button>;
    },
    useIonAlert: () => [(o: unknown) => h.alert(o), vi.fn()],
  };
});
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({ user: h.user, setError: h.setError, isOnline: h.online }),
}));
vi.mock('../../../contexts/BadgeContext', () => ({ useBadge: () => ({ refreshFromAPI: h.zaehler }) }));
vi.mock('../../../services/api', () => ({
  default: { get: (u: string) => h.apiGet(u), post: (u: string, b?: unknown) => h.apiPost(u, b) },
}));

import SimpleCreateChatModal from '../../../components/chat/modals/SimpleCreateChatModal';
import WebNeuerChatDialog from '../../../components/chat/web/WebNeuerChatDialog';
import { OFFLINE_AKTION_MELDUNG } from '../../../utils/offlineAktion';

// --- Daten (Antwortformen wie im Backend) ----------------------------------------------
// GET /chat/team-contacts: die Rolle in DIESER Gemeinde.
const TEAM = [
  { id: 15, display_name: 'Greta Gemeindeleitung', role_name: 'org_admin', role_description: 'Gemeindeleitung' },
  { id: 14, display_name: 'Lena Leitung', role_name: 'admin', role_description: 'Leitung' },
  { id: 13, display_name: 'Theo Teamer', role_name: 'teamer', role_description: 'Teamer:in' },
];
// GET /admin/konfis: Name als `name`, Jahrgang als jahrgang_id/jahrgang_name.
const KONFIS = [
  { id: 21, name: 'Karl Konfi', jahrgang_id: 1, jahrgang_name: '2026' },
  { id: 22, name: 'Mia Muster', jahrgang_id: 2, jahrgang_name: '2027' },
  { id: 23, name: 'Ole Ohne', jahrgang_id: null, jahrgang_name: null },
];
// GET /chat/available-users (nur Konfis): das eigene Team.
const KONTAKTE_DER_KONFI = {
  users: [
    { id: 14, name: 'Lena Leitung', type: 'admin', role_name: 'admin', role_description: 'Leitung', jahrgang_name: null },
    { id: 13, name: 'Theo Teamer', type: 'teamer', role_name: 'teamer', role_description: 'Teamer:in', jahrgang_name: null },
  ],
  jahrgang: '2026',
};

const KONFI = { id: 21, type: 'konfi', role_name: 'konfi' };
const TEAMERIN = { id: 13, type: 'teamer', role_name: 'teamer' };
const LEITUNG = { id: 14, type: 'admin', role_name: 'admin' };

const fertig = vi.fn();
const zu = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  h.online = true;
  h.user = LEITUNG;
  h.apiGet.mockImplementation(async (pfad: string) => {
    if (pfad === '/chat/team-contacts') return { data: TEAM };
    if (pfad === '/admin/konfis') return { data: KONFIS };
    // Teamer:in und Leitung sind dem Jahrgang 2026 zugewiesen.
    if (pfad === '/users/me/jahrgaenge') return { data: [{ id: 1, name: '2026' }] };
    if (pfad === '/chat/available-users') return { data: KONTAKTE_DER_KONFI };
    throw new Error(`unerwartet: ${pfad}`);
  });
  h.apiPost.mockImplementation(async (pfad: string) => ({ data: { room_id: pfad === '/chat/direct' ? 41 : 77 } }));
});
afterEach(() => cleanup());

// --- Bedienung je Fassung ----------------------------------------------------------------
type Fassung = 'app' | 'web';

const personenGruppe = () => screen.getByRole('group', { name: /^Personen \(/ });

/** Die waehlbaren Personen in Anzeigereihenfolge. */
const namen = (fassung: Fassung): string[] => {
  if (fassung === 'app') {
    return Array.from(document.querySelectorAll('.app-list-item__title')).map((t) => t.textContent?.trim() ?? '');
  }
  const gruppe = screen.queryByRole('group', { name: /^Personen \(/ });
  if (!gruppe) return [];
  return [...within(gruppe).queryAllByRole('button'), ...within(gruppe).queryAllByRole('checkbox')]
    .map((el) => (el.getAttribute('aria-label') ?? '').split(', ')[0]);
};

const oeffnen = async (fassung: Fassung) => {
  if (fassung === 'app') render(<SimpleCreateChatModal onClose={zu} onSuccess={fertig} />);
  else render(<WebNeuerChatDialog onSchliessen={zu} onAngelegt={fertig} />);
  await waitFor(() => expect(namen(fassung).length).toBeGreaterThan(0));
};

const artWahl = (fassung: Fassung, art: 'Direktnachricht' | 'Gruppenchat'): HTMLElement | null => (fassung === 'app'
  ? screen.queryByRole('tab', { name: art })
  : screen.queryByRole('group', { name: 'Art des Chats' }) && within(screen.getByRole('group', { name: 'Art des Chats' })).getByRole('button', { name: art }));

const waehleArt = (fassung: Fassung, art: 'Direktnachricht' | 'Gruppenchat') => {
  const knopf = artWahl(fassung, art);
  expect(knopf, art).not.toBeNull();
  fireEvent.click(knopf as HTMLElement);
};

const tippePerson = async (fassung: Fassung, name: string) => {
  const ziel = fassung === 'app'
    ? karteVon(name)
    : [...within(personenGruppe()).queryAllByRole('button'), ...within(personenGruppe()).queryAllByRole('checkbox')]
      .find((el) => el.getAttribute('aria-label')?.startsWith(`${name},`));
  expect(ziel, name).toBeTruthy();
  await act(async () => { fireEvent.click(ziel as HTMLElement); });
};

const gruppenname = (fassung: Fassung, text: string) => {
  const feld = fassung === 'app'
    ? screen.getByLabelText('Gruppenname eingeben')
    : screen.getByRole('textbox', { name: 'Gruppenname' });
  fireEvent.change(feld, { target: { value: text } });
};

const erstellen = async () => {
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Gruppenchat erstellen' })); });
};

const erwarteTitel = (fassung: Fassung, titel: string) => {
  if (fassung === 'app') expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(titel);
  else expect(screen.getByRole('dialog', { name: titel })).toBeInTheDocument();
};

/** Die Meldung: in der App oben (setError), im Browser im Dialog -- derselbe Text. */
const erwarteMeldung = async (fassung: Fassung, text: string) => {
  if (fassung === 'app') {
    await waitFor(() => expect(h.setError).toHaveBeenLastCalledWith(text));
  } else {
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(text));
    expect(h.setError).not.toHaveBeenCalled();
  }
};

// --- Ablaeufe, je Fassung -----------------------------------------------------------------
describe.each<Fassung>(['app', 'web'])('Neuer Chat (%s): dieselbe Logik in App und Browser', (fassung) => {
  it('Konfi: nur Direktnachricht an das eigene Team (GET /chat/available-users); ein Klick legt sie an und meldet den Raum', async () => {
    h.user = KONFI;
    await oeffnen(fassung);
    expect(namen(fassung)).toEqual(['Lena Leitung', 'Theo Teamer']);
    expect(h.apiGet.mock.calls.map(([pfad]) => pfad)).toEqual(['/chat/available-users']);
    expect(artWahl(fassung, 'Gruppenchat')).toBeNull();
    expect(screen.queryByLabelText('Nach Rolle filtern')).not.toBeInTheDocument();
    erwarteTitel(fassung, 'Neue Direktnachricht');

    await tippePerson(fassung, 'Theo Teamer');
    await waitFor(() => expect(fertig).toHaveBeenCalledTimes(1));
    expect(h.apiPost.mock.calls).toEqual([['/chat/direct', { target_user_id: 13, target_user_type: 'teamer' }]]);
    expect(fertig).toHaveBeenCalledWith(41);
    expect(h.zaehler).toHaveBeenCalledTimes(1);
  });

  it('Teamer:in: Konfis nur der eigenen Jahrgaenge, das Team ohne sich selbst -- im Gruppenchat mit sich selbst', async () => {
    h.user = TEAMERIN;
    await oeffnen(fassung);
    expect(namen(fassung)).toEqual(['Karl Konfi', 'Greta Gemeindeleitung', 'Lena Leitung']);
    erwarteTitel(fassung, 'Neue Direktnachricht');

    waehleArt(fassung, 'Gruppenchat');
    await waitFor(() => expect(namen(fassung)).toEqual(['Karl Konfi', 'Greta Gemeindeleitung', 'Lena Leitung', 'Theo Teamer']));
    erwarteTitel(fassung, 'Neuer Gruppenchat');
  });

  it('Leitung: alle Konfis der Gemeinde; Suche, Rolle und Jahrgang filtern dieselbe Liste', async () => {
    await oeffnen(fassung);
    expect(namen(fassung)).toEqual(['Karl Konfi', 'Mia Muster', 'Ole Ohne', 'Greta Gemeindeleitung', 'Theo Teamer']);

    const rolle = screen.getByLabelText('Nach Rolle filtern');
    fireEvent.change(rolle, { target: { value: 'konfi' } });
    expect(namen(fassung)).toEqual(['Karl Konfi', 'Mia Muster', 'Ole Ohne']);
    // "Team" meint Leitung UND Teamer:innen.
    fireEvent.change(rolle, { target: { value: 'admin' } });
    expect(namen(fassung)).toEqual(['Greta Gemeindeleitung', 'Theo Teamer']);
    fireEvent.change(rolle, { target: { value: 'alle' } });

    // Der Jahrgang filtert nur Konfis; zur Wahl stehen die Jahrgaenge der waehlbaren Konfis.
    const jahrgang = screen.getByLabelText('Nach Jahrgang filtern');
    expect(Array.from(jahrgang.querySelectorAll('option')).map((o) => o.getAttribute('value'))).toEqual(['alle', '2026', '2027']);
    fireEvent.change(jahrgang, { target: { value: '2027' } });
    expect(namen(fassung)).toEqual(['Mia Muster', 'Greta Gemeindeleitung', 'Theo Teamer']);
    fireEvent.change(jahrgang, { target: { value: 'alle' } });

    fireEvent.change(screen.getByLabelText('Person suchen'), { target: { value: 'LE' } });
    expect(namen(fassung)).toEqual(['Ole Ohne', 'Greta Gemeindeleitung']);
  });

  it('Gruppenchat: der Name (ohne Leerzeichen am Rand) und die gewaehlten Personen in der Reihenfolge der Wahl gehen an POST /chat/rooms', async () => {
    await oeffnen(fassung);
    waehleArt(fassung, 'Gruppenchat');
    await waitFor(() => expect(namen(fassung)).toContain('Lena Leitung'));
    gruppenname(fassung, '  Freizeit-Team  ');
    await tippePerson(fassung, 'Theo Teamer');
    await tippePerson(fassung, 'Mia Muster');
    await tippePerson(fassung, 'Karl Konfi');
    // Mia wieder abgewaehlt: Sie geht nicht mit.
    await tippePerson(fassung, 'Mia Muster');

    await erstellen();
    await waitFor(() => expect(fertig).toHaveBeenCalledTimes(1));
    expect(h.apiPost.mock.calls).toEqual([['/chat/rooms', {
      name: 'Freizeit-Team',
      type: 'group',
      participants: [{ user_id: 13, user_type: 'teamer' }, { user_id: 21, user_type: 'konfi' }],
    }]]);
    expect(fertig).toHaveBeenCalledWith(77);
    expect(h.zaehler).toHaveBeenCalledTimes(1);
  });

  it('Gruppenchat ohne Namen oder ohne Person: nichts geht an den Server', async () => {
    await oeffnen(fassung);
    waehleArt(fassung, 'Gruppenchat');
    await waitFor(() => expect(namen(fassung)).toContain('Lena Leitung'));
    const knopf = () => screen.getByRole('button', { name: 'Gruppenchat erstellen' });

    if (fassung === 'app') {
      // Die App sperrt den Haken, bis Name und eine Person da sind.
      expect(knopf()).toBeDisabled();
      gruppenname(fassung, 'Freizeit-Team');
      expect(knopf()).toBeDisabled();
      await tippePerson(fassung, 'Karl Konfi');
      expect(knopf()).not.toBeDisabled();
    } else {
      // Der Browser laesst klicken und sagt im Dialog, was fehlt -- mit den Texten des Hooks.
      expect(knopf()).not.toBeDisabled();
      await erstellen();
      await erwarteMeldung(fassung, 'Bitte gib einen Gruppennamen ein');
      gruppenname(fassung, 'Freizeit-Team');
      // Die naechste Eingabe raeumt die Meldung weg.
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      await erstellen();
      await erwarteMeldung(fassung, 'Bitte wähle mindestens eine:n Teilnehmer:in aus');
    }
    expect(h.apiPost).not.toHaveBeenCalled();
    expect(fertig).not.toHaveBeenCalled();
  });

  it('lehnt der Server die Direktnachricht ab, steht seine Begruendung da -- kein Raum oeffnet sich', async () => {
    h.apiPost.mockRejectedValue({ response: { status: 403, data: { error: 'Diese Person ist nicht für deinen Jahrgang zuständig.' } } });
    await oeffnen(fassung);
    await tippePerson(fassung, 'Greta Gemeindeleitung');
    expect(h.apiPost.mock.calls).toEqual([['/chat/direct', { target_user_id: 15, target_user_type: 'admin' }]]);
    await erwarteMeldung(fassung, 'Diese Person ist nicht für deinen Jahrgang zuständig.');
    expect(fertig).not.toHaveBeenCalled();
    expect(zu).not.toHaveBeenCalled();
  });

  it('scheitert der Gruppenchat, steht dieselbe Meldung mit dem Grund da', async () => {
    h.apiPost.mockRejectedValue(new Error('Netzwerkfehler'));
    await oeffnen(fassung);
    waehleArt(fassung, 'Gruppenchat');
    await waitFor(() => expect(namen(fassung)).toContain('Lena Leitung'));
    gruppenname(fassung, 'Freizeit-Team');
    await tippePerson(fassung, 'Karl Konfi');
    await erstellen();
    await erwarteMeldung(fassung, 'Fehler beim Erstellen des Gruppenchats: Netzwerkfehler');
    expect(fertig).not.toHaveBeenCalled();
  });

  it('offline: keine Direktnachricht, dieselbe Meldung', async () => {
    h.online = false;
    await oeffnen(fassung);
    await tippePerson(fassung, 'Karl Konfi');
    await erwarteMeldung(fassung, OFFLINE_AKTION_MELDUNG);
    expect(h.apiPost).not.toHaveBeenCalled();
  });

  it('Schliessen: ohne Aenderung sofort, mit Gruppenname erst nach der Rueckfrage „Verwerfen"', async () => {
    await oeffnen(fassung);
    fireEvent.click(screen.getAllByRole('button', { name: 'Schließen' })[0]);
    expect(zu).toHaveBeenCalledTimes(1);
    cleanup();
    zu.mockClear();

    await oeffnen(fassung);
    waehleArt(fassung, 'Gruppenchat');
    gruppenname(fassung, 'Freizeit-Team');
    fireEvent.click(screen.getAllByRole('button', { name: 'Schließen' })[0]);
    expect(zu).not.toHaveBeenCalled();
    if (fassung === 'app') {
      expect(h.alert).toHaveBeenCalledWith(expect.objectContaining({ header: 'Ungespeicherte Änderungen', message: 'Möchtest du die Änderungen verwerfen?' }));
      const knoepfe = (h.alert.mock.calls[0][0] as { buttons: Array<{ text: string; handler?: () => void }> }).buttons;
      knoepfe.find((k) => k.text === 'Verwerfen')?.handler?.();
    } else {
      const rueckfrage = screen.getByRole('dialog', { name: 'Ungespeicherte Änderungen' });
      expect(rueckfrage).toHaveAccessibleDescription('Möchtest du die Änderungen verwerfen?');
      fireEvent.click(within(rueckfrage).getByRole('button', { name: 'Verwerfen' }));
    }
    expect(zu).toHaveBeenCalledTimes(1);
    expect(h.apiPost).not.toHaveBeenCalled();
  });
});

describe('Neuer Chat: App und Browser schicken dasselbe', () => {
  const gruppeAnlegen = async (fassung: Fassung) => {
    await oeffnen(fassung);
    waehleArt(fassung, 'Gruppenchat');
    await waitFor(() => expect(namen(fassung)).toContain('Lena Leitung'));
    gruppenname(fassung, 'Konfi-Freizeit');
    await tippePerson(fassung, 'Ole Ohne');
    await tippePerson(fassung, 'Greta Gemeindeleitung');
    await erstellen();
    await waitFor(() => expect(fertig).toHaveBeenCalledTimes(1));
    const gesendet = [...h.apiPost.mock.calls];
    cleanup();
    h.apiPost.mockClear();
    fertig.mockClear();
    return gesendet;
  };

  it('derselbe Gruppenchat ergibt in beiden Fassungen denselben Aufruf', async () => {
    const app = await gruppeAnlegen('app');
    const web = await gruppeAnlegen('web');
    expect(app).toEqual([['/chat/rooms', {
      name: 'Konfi-Freizeit',
      type: 'group',
      participants: [{ user_id: 23, user_type: 'konfi' }, { user_id: 15, user_type: 'admin' }],
    }]]);
    expect(web).toEqual(app);
  });
});

// --- Nur der Browser: Schliessen waehrend des Sendens und per Escape oder Klick daneben ----
// Die App sperrt ihr X waehrend des Sendens (SimpleCreateChatModal,
// `disabled={creating}`). Im Browser gilt dasselbe fuer jeden Weg aus dem
// Dialog: X, Abbrechen, Escape, Klick auf den Grund. Sonst ginge eine
// Ablehnung des Servers ins Leere, und nach erneutem Oeffnen liesse sich
// derselbe Chat sofort ein zweites Mal anlegen.
describe('Neuer Chat (web): solange gesendet wird, bleibt der Dialog', () => {
  /** Die Anfrage haengt, bis der Test sie ablehnt. */
  const sendenHaengt = () => {
    const ausgang: { ablehnen: (grund: unknown) => void } = { ablehnen: () => undefined };
    h.apiPost.mockReturnValue(new Promise((_ok, nein) => { ausgang.ablehnen = nein; }));
    return ausgang;
  };

  /** Jeder Weg hinaus: X, Abbrechen, Escape, Klick daneben. */
  const allesVersuchen = (dialog: HTMLElement) => {
    const knopf = (name: string) => within(dialog).getByRole('button', { name });
    fireEvent.click(knopf('Schließen'));
    fireEvent.click(knopf('Abbrechen'));
    fireEvent.keyDown(dialog, { key: 'Escape' });
    fireEvent.mouseDown(dialog.parentElement as HTMLElement);
    expect(zu).not.toHaveBeenCalled();
    // Auch keine Rueckfrage: Der Dialog bleibt, wie er ist.
    expect(screen.queryByRole('dialog', { name: 'Ungespeicherte Änderungen' })).not.toBeInTheDocument();
    // X und Abbrechen zeigen es: gesperrt, wie das X der App.
    expect(knopf('Schließen')).toBeDisabled();
    expect(knopf('Abbrechen')).toBeDisabled();
  };

  it('Direktnachricht: waehrend POST /chat/direct schliesst nichts; die Ablehnung steht danach im Dialog, dann schliesst Escape', async () => {
    const senden = sendenHaengt();
    await oeffnen('web');
    const dialog = screen.getByRole('dialog', { name: 'Neue Direktnachricht' });
    await tippePerson('web', 'Theo Teamer');
    expect(h.apiPost.mock.calls).toEqual([['/chat/direct', { target_user_id: 13, target_user_type: 'teamer' }]]);

    allesVersuchen(dialog);
    expect(screen.getByRole('dialog', { name: 'Neue Direktnachricht' })).toBe(dialog);

    await act(async () => { senden.ablehnen({ response: { status: 403, data: { error: 'Diese Person ist nicht für deinen Jahrgang zuständig.' } } }); });
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Diese Person ist nicht für deinen Jahrgang zuständig.');
    expect(fertig).not.toHaveBeenCalled();
    expect(within(dialog).getByRole('button', { name: 'Schließen' })).toBeEnabled();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(zu).toHaveBeenCalledTimes(1);
  });

  it('Gruppenchat: waehrend POST /chat/rooms schliesst nichts und fragt nichts; nach der Ablehnung fragt Escape nach, Verwerfen schliesst', async () => {
    const senden = sendenHaengt();
    await oeffnen('web');
    waehleArt('web', 'Gruppenchat');
    await waitFor(() => expect(namen('web')).toContain('Lena Leitung'));
    gruppenname('web', 'Freizeit-Team');
    await tippePerson('web', 'Karl Konfi');
    await erstellen();
    expect(h.apiPost.mock.calls).toEqual([['/chat/rooms', {
      name: 'Freizeit-Team', type: 'group', participants: [{ user_id: 21, user_type: 'konfi' }],
    }]]);
    const dialog = screen.getByRole('dialog', { name: 'Neuer Gruppenchat' });
    expect(within(dialog).getByRole('button', { name: 'Gruppenchat erstellen' })).toBeDisabled();

    allesVersuchen(dialog);
    expect(screen.getByRole('dialog', { name: 'Neuer Gruppenchat' })).toBe(dialog);

    await act(async () => { senden.ablehnen(new Error('Netzwerkfehler')); });
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Fehler beim Erstellen des Gruppenchats: Netzwerkfehler');
    expect(fertig).not.toHaveBeenCalled();
    // Wieder frei -- und weil Name und Person noch da sind, fragt Escape erst nach.
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(zu).not.toHaveBeenCalled();
    const rueckfrage = screen.getByRole('dialog', { name: 'Ungespeicherte Änderungen' });
    fireEvent.click(within(rueckfrage).getByRole('button', { name: 'Verwerfen' }));
    expect(zu).toHaveBeenCalledTimes(1);
  });

  it('mit Gruppenname fragen auch Escape und ein Klick daneben nach, statt sofort zu schliessen', async () => {
    await oeffnen('web');
    waehleArt('web', 'Gruppenchat');
    gruppenname('web', 'Freizeit-Team');
    const dialog = screen.getByRole('dialog', { name: 'Neuer Gruppenchat' });

    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(zu).not.toHaveBeenCalled();
    let rueckfrage = screen.getByRole('dialog', { name: 'Ungespeicherte Änderungen' });
    expect(rueckfrage).toHaveAccessibleDescription('Möchtest du die Änderungen verwerfen?');
    // Escape in der Rueckfrage schliesst nur sie; der Dialog mit dem Namen bleibt.
    fireEvent.keyDown(rueckfrage, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Ungespeicherte Änderungen' })).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Gruppenname' })).toHaveValue('Freizeit-Team');
    expect(zu).not.toHaveBeenCalled();

    fireEvent.mouseDown(dialog.parentElement as HTMLElement);
    expect(zu).not.toHaveBeenCalled();
    rueckfrage = screen.getByRole('dialog', { name: 'Ungespeicherte Änderungen' });
    fireEvent.click(within(rueckfrage).getByRole('button', { name: 'Verwerfen' }));
    expect(zu).toHaveBeenCalledTimes(1);
    expect(h.apiPost).not.toHaveBeenCalled();
  });
});
