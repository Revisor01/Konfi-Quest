// Eine Aktivität des Katalogs anlegen oder bearbeiten (/admin/activities) --
// das Modal der App (modals/ActivityManagementModal) und der Dialog der
// Web-Fassung (web/leitung/WebAktivitaetKatalogDialog) im Vergleich (Simon,
// 15.10.2026: jedes Formular, das im Browser noch ein Modal der App öffnet,
// bekommt ein kompaktes Fenster der Web-Fassung).
//
// Beide lesen dieselbe Logik (useAktivitaetKatalogFormular). Jeder Ablauf
// läuft deshalb zweimal, einmal je Fassung, mit denselben Erwartungen:
// dieselben Felder, dieselben Rümpfe an dieselben Routen, dieselben Texte bei
// Ablehnung und ohne Netz, dieselbe Rückfrage bei ungespeicherten Änderungen.
// Was sich unterscheidet, steht ausdrücklich da: Meldungen stehen in der App
// oben (setError), im Browser im Dialog.
//
// Welche Fassung die Seite im breiten und im schmalen Fenster öffnet, prüft
// termineWeb/webAntraegeAktivitaeten.test.tsx (die echte Seite).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, within, waitFor, cleanup, act } from '@testing-library/react';

const h = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
  enqueue: vi.fn(),
  setError: vi.fn(),
  setSuccess: vi.fn(),
  alert: vi.fn(),
  online: true,
}));

type Kinder = { children?: React.ReactNode };

vi.mock('@ionic/react', () => {
  const durch = ({ children }: Kinder) => <div>{children}</div>;
  return {
    IonPage: durch, IonHeader: durch, IonToolbar: durch, IonButtons: durch, IonContent: durch,
    IonList: durch, IonListHeader: durch, IonCard: durch, IonCardContent: durch, IonItem: durch,
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
    // Der Regler der App als natives Schiebefeld mit demselben Namen.
    IonRange: ({ value, min, max, onIonChange, disabled, 'aria-label': name }: {
      value?: number; min?: number; max?: number; onIonChange?: (e: { detail: { value: number } }) => void; disabled?: boolean; 'aria-label'?: string;
    }) => (
      <input type="range" aria-label={name} min={min} max={max} value={value} disabled={disabled}
        onChange={(e) => onIonChange?.({ detail: { value: Number(e.target.value) } })} />
    ),
    useIonAlert: () => [(o: unknown) => h.alert(o), vi.fn()],
  };
});
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({ setError: h.setError, setSuccess: h.setSuccess, isOnline: h.online }),
}));
vi.mock('../../../services/api', () => ({
  default: {
    get: (u: string) => h.apiGet(u),
    post: (u: string, b?: unknown) => h.apiPost(u, b),
    put: (u: string, b?: unknown) => h.apiPut(u, b),
  },
}));
vi.mock('../../../services/networkMonitor', () => ({ networkMonitor: { get isOnline() { return h.online; } } }));
vi.mock('../../../services/writeQueue', () => ({ writeQueue: { enqueue: (a: unknown) => h.enqueue(a) } }));

import ActivityManagementModal from '../../../components/admin/modals/ActivityManagementModal';
import WebAktivitaetKatalogDialog from '../../../components/admin/web/leitung/WebAktivitaetKatalogDialog';
import { TEAM_OHNE_PUNKTE, type KatalogAktivitaet, type KatalogZielgruppe } from '../../../components/admin/useAktivitaetKatalogFormular';

// --- Daten (Antwortformen wie im Backend) ------------------------------------------------
// GET /admin/categories: alle Kategorien der Gemeinde.
const KATEGORIEN = [
  { id: 1, name: 'Freizeit', type: 'both' },
  { id: 2, name: 'Ausflug', type: 'activity' },
  { id: 3, name: 'Diakonie', type: null },
];
// GET /admin/activities: die Aktivitäten mit ihren Kategorien.
const AKTIVITAETEN: KatalogAktivitaet[] = [
  { id: 7, name: 'Adventsmarkt', points: 3, type: 'gemeinde', target_role: 'konfi', categories: [{ id: 3, name: 'Diakonie' }] },
  // In Produktion tragen zwei Aktivitäten keinen Typ (nachgemessen 30.08.2026).
  { id: 8, name: 'Altbestand', points: 2, type: null, target_role: 'konfi', categories: [] },
];
/** Der Eintrag aus der Liste der Seite -- mit altem Stand: Das Formular lädt frisch. */
const AUS_DER_LISTE = (id: number): KatalogAktivitaet => ({ id, name: 'Alter Name', points: 1, type: 'gottesdienst', target_role: 'konfi' });

const fertig = vi.fn();
const zu = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  h.apiPost.mockReset();
  h.apiPut.mockReset();
  h.online = true;
  h.apiGet.mockImplementation(async (pfad: string) => {
    if (pfad === '/admin/categories') return { data: KATEGORIEN };
    if (pfad === '/admin/activities') return { data: AKTIVITAETEN };
    throw new Error(`unerwartet: ${pfad}`);
  });
  h.apiPost.mockResolvedValue({ data: { id: 99 } });
  h.apiPut.mockResolvedValue({ data: {} });
  h.enqueue.mockResolvedValue(undefined);
});
afterEach(() => cleanup());

// --- Bedienung je Fassung ----------------------------------------------------------------
type Fassung = 'app' | 'web';

const oeffnen = async (fassung: Fassung, optionen: { aktivitaet?: KatalogAktivitaet | null; rolle?: KatalogZielgruppe } = {}) => {
  const aktivitaet = optionen.aktivitaet ?? null;
  const rolle = optionen.rolle ?? 'konfi';
  if (fassung === 'app') {
    // Wie useAktivitaetenVerwaltung: die Aktivität und ihre Kennung.
    render(<ActivityManagementModal activity={aktivitaet} activityId={aktivitaet?.id ?? null} targetRole={rolle} onClose={zu} onSuccess={fertig} />);
  } else {
    render(<WebAktivitaetKatalogDialog aktivitaet={aktivitaet} targetRole={rolle} onSchliessen={zu} onGespeichert={fertig} />);
  }
  // Geladen ist, wenn die Kategorien zur Wahl stehen.
  await waitFor(() => expect(screen.getByText('Diakonie')).toBeInTheDocument());
};

const name = (text: string) => fireEvent.change(screen.getByLabelText('Name'), { target: { value: text } });
const punkte = (wert: number) => fireEvent.change(screen.getByLabelText('Punkte'), { target: { value: String(wert) } });

const zielgruppe = (fassung: Fassung, rolle: 'Konfis' | 'Team') => {
  if (fassung === 'app') fireEvent.click(screen.getByRole('button', { name: rolle }));
  else fireEvent.change(screen.getByRole('combobox', { name: 'Zielgruppe' }), { target: { value: rolle === 'Team' ? 'teamer' : 'konfi' } });
};
const typ = (fassung: Fassung, art: 'Gottesdienst' | 'Gemeinde') => {
  if (fassung === 'app') fireEvent.click(screen.getByRole('button', { name: art }));
  else fireEvent.change(screen.getByRole('combobox', { name: 'Typ' }), { target: { value: art.toLowerCase() } });
};
const kategorie = (fassung: Fassung, titel: string) => {
  if (fassung === 'app') fireEvent.click(screen.getByRole('button', { name: titel }));
  else fireEvent.click(screen.getByRole('checkbox', { name: titel }));
};
const speichernKnopf = (fassung: Fassung) => (fassung === 'app'
  ? screen.getByRole('button', { name: 'Aktivität speichern' })
  : within(screen.getAllByRole('dialog')[0]).getByRole('button', { name: /^(Anlegen|Speichern)$/ }));
const speichern = async (fassung: Fassung) => {
  await act(async () => { fireEvent.click(speichernKnopf(fassung)); });
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

// --- Abläufe, je Fassung ------------------------------------------------------------------
describe.each<Fassung>(['app', 'web'])('Aktivität des Katalogs (%s): dieselbe Logik in App und Browser', (fassung) => {
  it('neu (Konfis): Name ohne Leerzeichen am Rand, Punkte, Typ und die Kategorien in der Reihenfolge der Klicks gehen an POST /admin/activities', async () => {
    await oeffnen(fassung);
    erwarteTitel(fassung, 'Neue Aktivität');
    expect(h.apiGet.mock.calls.map(([pfad]) => pfad)).toEqual(['/admin/categories']);

    name('  Konfi-Café  ');
    punkte(3);
    typ(fassung, 'Gemeinde');
    kategorie(fassung, 'Diakonie');
    kategorie(fassung, 'Freizeit');
    kategorie(fassung, 'Ausflug');
    // Ausflug wieder abgewählt: geht nicht mit.
    kategorie(fassung, 'Ausflug');
    await speichern(fassung);

    await waitFor(() => expect(fertig).toHaveBeenCalledTimes(1));
    expect(h.apiPost.mock.calls).toEqual([['/admin/activities', {
      name: 'Konfi-Café', points: 3, type: 'gemeinde', category_ids: [3, 1], target_role: 'konfi',
    }]]);
    expect(h.apiPut).not.toHaveBeenCalled();
    expect(h.setError).not.toHaveBeenCalled();
    expect(h.setSuccess).not.toHaveBeenCalled();
  });

  it('neu fürs Team: keine Punkte und kein Typ (mit dem Hinweis); zurück zu den Konfis gelten wieder 1 Punkt und Gottesdienst', async () => {
    await oeffnen(fassung);
    zielgruppe(fassung, 'Team');
    expect(screen.getByText(TEAM_OHNE_PUNKTE)).toBeInTheDocument();
    expect(screen.queryByLabelText('Punkte')).not.toBeInTheDocument();
    name('Freizeit begleiten');
    await speichern(fassung);
    await waitFor(() => expect(fertig).toHaveBeenCalledTimes(1));
    expect(h.apiPost.mock.calls).toEqual([['/admin/activities', {
      name: 'Freizeit begleiten', points: 0, type: null, category_ids: [], target_role: 'teamer',
    }]]);

    cleanup();
    h.apiPost.mockClear();
    fertig.mockClear();
    await oeffnen(fassung);
    zielgruppe(fassung, 'Team');
    zielgruppe(fassung, 'Konfis');
    name('Krippenspiel');
    await speichern(fassung);
    await waitFor(() => expect(fertig).toHaveBeenCalledTimes(1));
    expect(h.apiPost.mock.calls).toEqual([['/admin/activities', {
      name: 'Krippenspiel', points: 1, type: 'gottesdienst', category_ids: [], target_role: 'konfi',
    }]]);
  });

  it('die Liste der Seite fürs Team: die Zielgruppe steht schon auf Team', async () => {
    await oeffnen(fassung, { rolle: 'teamer' });
    expect(screen.getByText(TEAM_OHNE_PUNKTE)).toBeInTheDocument();
    name('Aufbau');
    await speichern(fassung);
    await waitFor(() => expect(fertig).toHaveBeenCalledTimes(1));
    expect(h.apiPost.mock.calls[0][1]).toEqual({ name: 'Aufbau', points: 0, type: null, category_ids: [], target_role: 'teamer' });
  });

  it('bearbeiten: lädt die Aktivität frisch, belegt vor und schickt PUT /admin/activities/:id -- ohne Wahl der Zielgruppe', async () => {
    await oeffnen(fassung, { aktivitaet: AUS_DER_LISTE(7) });
    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue('Adventsmarkt'));
    erwarteTitel(fassung, 'Aktivität bearbeiten');
    expect(h.apiGet.mock.calls.map(([pfad]) => pfad)).toEqual(['/admin/categories', '/admin/activities']);
    expect(screen.queryByRole('button', { name: 'Team' })).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Zielgruppe' })).not.toBeInTheDocument();

    name('Adventsmarkt 2026');
    kategorie(fassung, 'Ausflug');
    await speichern(fassung);
    await waitFor(() => expect(fertig).toHaveBeenCalledTimes(1));
    expect(h.apiPut.mock.calls).toEqual([['/admin/activities/7', {
      name: 'Adventsmarkt 2026', points: 3, type: 'gemeinde', category_ids: [3, 2], target_role: 'konfi',
    }]]);
    expect(h.apiPost).not.toHaveBeenCalled();
  });

  it('ohne Namen geht nichts an den Server -- auch nicht mit Leerzeichen allein', async () => {
    await oeffnen(fassung);
    expect(speichernKnopf(fassung)).toBeDisabled();
    name('   ');
    expect(speichernKnopf(fassung)).toBeDisabled();
    name('Gemeindefest');
    expect(speichernKnopf(fassung)).toBeEnabled();
    expect(h.apiPost).not.toHaveBeenCalled();
  });

  it('lehnt der Server ab, steht seine Begründung da -- kein Erfolg', async () => {
    h.apiPut.mockRejectedValue({ response: { status: 400, data: { error: 'Name, Punkte und Typ sind erforderlich' } } });
    await oeffnen(fassung, { aktivitaet: AUS_DER_LISTE(8) });
    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue('Altbestand'));
    name('Altbestand neu');
    await speichern(fassung);
    // Der Altbestand ohne Typ geht mit leerem Typ -- der Server sagt, was fehlt.
    expect(h.apiPut.mock.calls).toEqual([['/admin/activities/8', {
      name: 'Altbestand neu', points: 2, type: '', category_ids: [], target_role: 'konfi',
    }]]);
    await erwarteMeldung(fassung, 'Name, Punkte und Typ sind erforderlich');
    expect(fertig).not.toHaveBeenCalled();
    expect(zu).not.toHaveBeenCalled();
  });

  it('fehlt die Aktivität in der Liste des Servers, steht „Aktivität nicht gefunden" da', async () => {
    await oeffnen(fassung, { aktivitaet: AUS_DER_LISTE(42) });
    await erwarteMeldung(fassung, 'Aktivität nicht gefunden');
  });

  it('ohne Netz: das Anlegen geht in die Warteschlange, die Meldung sagt es', async () => {
    h.online = false;
    await oeffnen(fassung);
    name('Gemeindefest');
    await speichern(fassung);
    await waitFor(() => expect(fertig).toHaveBeenCalledTimes(1));
    expect(h.apiPost).not.toHaveBeenCalled();
    expect(h.enqueue.mock.calls).toEqual([[expect.objectContaining({
      method: 'POST',
      url: '/admin/activities',
      body: { name: 'Gemeindefest', points: 1, type: 'gottesdienst', category_ids: [], target_role: 'konfi' },
      metadata: expect.objectContaining({ type: 'admin', label: 'Aktivität erstellen' }),
    })]]);
    expect(h.setSuccess).toHaveBeenCalledWith('Aktivität wird erstellt sobald du wieder online bist');
  });

  it('Schließen: ohne Änderung sofort, mit Änderung erst nach der Rückfrage „Verwerfen"', async () => {
    await oeffnen(fassung);
    fireEvent.click(screen.getAllByRole('button', { name: 'Schließen' })[0]);
    expect(zu).toHaveBeenCalledTimes(1);
    cleanup();
    zu.mockClear();

    await oeffnen(fassung);
    name('Gemeindefest');
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

// --- Nur die App: Eingaben während des Ladens ---------------------------------------------
// Im Modal der App steht das Namensfeld schon, während Kategorien und
// Aktivität noch laden; der Browser zeigt die Felder erst danach. Die
// Vorbelegung ersetzt, was in der Zeit getippt wurde (wie bis 15.10.2026) --
// danach gilt das Formular als unverändert und schließt ohne Rückfrage.
describe('Aktivität des Katalogs (app): was während des Ladens getippt wurde, gilt nicht als ungespeicherte Änderung', () => {
  const wartend = () => {
    const ausgang: { freigeben: () => void } = { freigeben: () => undefined };
    const tor = new Promise<void>((ok) => { ausgang.freigeben = ok; });
    return { tor, freigeben: () => ausgang.freigeben() };
  };

  it.each([
    { fall: 'neu (die Kategorien laden)', pfad: '/admin/categories', props: { activity: null, activityId: null }, danach: '' },
    { fall: 'bearbeiten (die Aktivität lädt)', pfad: '/admin/activities', props: { activity: AUS_DER_LISTE(7), activityId: 7 }, danach: 'Adventsmarkt' },
    { fall: 'aus der Liste ohne Kennung', pfad: '/admin/categories', props: { activity: AUS_DER_LISTE(7), activityId: null }, danach: 'Alter Name' },
  ])('$fall: die Vorbelegung ersetzt die Eingabe, „Schließen" schließt sofort', async ({ pfad, props, danach }) => {
    const { tor, freigeben } = wartend();
    h.apiGet.mockImplementation(async (p: string) => {
      if (p === pfad) await tor;
      if (p === '/admin/categories') return { data: KATEGORIEN };
      if (p === '/admin/activities') return { data: AKTIVITAETEN };
      throw new Error(`unerwartet: ${p}`);
    });
    render(<ActivityManagementModal {...props} targetRole="konfi" onClose={zu} onSuccess={fertig} />);
    name('Getippt');
    expect(screen.getByLabelText('Name')).toHaveValue('Getippt');

    await act(async () => { freigeben(); });
    await waitFor(() => expect(screen.getByText('Diakonie')).toBeInTheDocument());
    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue(danach));

    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }));
    expect(h.alert).not.toHaveBeenCalled();
    expect(zu).toHaveBeenCalledTimes(1);
  });

  it('wer nach dem Laden etwas ändert, wird weiter gefragt', async () => {
    const { tor, freigeben } = wartend();
    h.apiGet.mockImplementation(async (p: string) => {
      await tor;
      if (p === '/admin/categories') return { data: KATEGORIEN };
      throw new Error(`unerwartet: ${p}`);
    });
    render(<ActivityManagementModal activity={null} activityId={null} targetRole="konfi" onClose={zu} onSuccess={fertig} />);
    name('Getippt');
    await act(async () => { freigeben(); });
    await waitFor(() => expect(screen.getByText('Diakonie')).toBeInTheDocument());
    name('Gemeindefest');
    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }));
    expect(zu).not.toHaveBeenCalled();
    expect(h.alert).toHaveBeenCalledWith(expect.objectContaining({ header: 'Ungespeicherte Änderungen' }));
  });
});

describe('Aktivität des Katalogs: App und Browser schicken dasselbe', () => {
  const anlegen = async (fassung: Fassung) => {
    await oeffnen(fassung);
    name('Jugendgottesdienst');
    punkte(5);
    kategorie(fassung, 'Ausflug');
    kategorie(fassung, 'Freizeit');
    await speichern(fassung);
    await waitFor(() => expect(fertig).toHaveBeenCalledTimes(1));
    const gesendet = [...h.apiPost.mock.calls];
    cleanup();
    h.apiPost.mockClear();
    fertig.mockClear();
    return gesendet;
  };

  it('dieselbe neue Aktivität ergibt in beiden Fassungen denselben Aufruf', async () => {
    const app = await anlegen('app');
    const web = await anlegen('web');
    expect(app).toEqual([['/admin/activities', {
      name: 'Jugendgottesdienst', points: 5, type: 'gottesdienst', category_ids: [2, 1], target_role: 'konfi',
    }]]);
    expect(web).toEqual(app);
  });
});

// --- Nur der Browser ----------------------------------------------------------------------
describe('Aktivität des Katalogs (web): solange gespeichert wird, bleibt der Dialog', () => {
  it('X, Abbrechen, Escape und ein Klick daneben schließen nicht; die Ablehnung steht danach im Dialog', async () => {
    const ausgang: { ablehnen: (grund: unknown) => void } = { ablehnen: () => undefined };
    h.apiPost.mockReturnValue(new Promise((_ok, nein) => { ausgang.ablehnen = nein; }));
    await oeffnen('web');
    name('Gemeindefest');
    await speichern('web');
    const dialog = screen.getByRole('dialog', { name: 'Neue Aktivität' });
    const knopf = (n: string) => within(dialog).getByRole('button', { name: n });
    expect(knopf('Schließen')).toBeDisabled();
    expect(knopf('Abbrechen')).toBeDisabled();
    expect(knopf('Anlegen')).toBeDisabled();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    fireEvent.mouseDown(dialog.parentElement as HTMLElement);
    expect(zu).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog', { name: 'Ungespeicherte Änderungen' })).not.toBeInTheDocument();

    await act(async () => { ausgang.ablehnen(new Error('Netzwerkfehler')); });
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Fehler beim Speichern der Aktivität');
    expect(fertig).not.toHaveBeenCalled();
    // Wieder frei -- und weil der Name noch da ist, fragt Escape erst nach.
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(zu).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Ungespeicherte Änderungen' })).toBeInTheDocument();
  });

  it('Enter im Namen speichert wie der Knopf', async () => {
    await oeffnen('web');
    name('Gemeindefest');
    const feld = screen.getByLabelText('Name') as HTMLInputElement;
    await act(async () => { fireEvent.submit(feld.form as HTMLFormElement); });
    await waitFor(() => expect(fertig).toHaveBeenCalledTimes(1));
    expect(h.apiPost.mock.calls).toEqual([['/admin/activities', {
      name: 'Gemeindefest', points: 1, type: 'gottesdienst', category_ids: [], target_role: 'konfi',
    }]]);
  });

  it('ein Typ, den es nicht mehr gibt (Altbestand), steht als „Bitte wählen" da, bis jemand wählt', async () => {
    await oeffnen('web', { aktivitaet: AUS_DER_LISTE(8) });
    await waitFor(() => expect(screen.getByLabelText('Name')).toHaveValue('Altbestand'));
    const auswahl = screen.getByRole('combobox', { name: 'Typ' }) as HTMLSelectElement;
    expect(auswahl.value).toBe('');
    expect([...auswahl.options].map((o) => o.textContent)).toEqual(['Bitte wählen', 'Gottesdienst', 'Gemeinde']);
    typ('web', 'Gemeinde');
    await speichern('web');
    await waitFor(() => expect(fertig).toHaveBeenCalledTimes(1));
    expect(h.apiPut.mock.calls[0][1]).toEqual({ name: 'Altbestand', points: 2, type: 'gemeinde', category_ids: [], target_role: 'konfi' });
  });
});
