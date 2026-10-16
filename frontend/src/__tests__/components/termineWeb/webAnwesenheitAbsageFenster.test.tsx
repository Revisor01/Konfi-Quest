// Abmeldung, Notiz und Absage -- die Modale der App
// (AbmeldungNachtragenModal, AnwesenheitNotizModal, TerminAbsagenModal) und
// die Dialoge der Web-Fassung (WebAbmeldungDialog, WebNotizDialog,
// WebTerminAbsagenDialog) im Vergleich (Simon, 15.10.2026: im Browser ab
// 992 px jedes Formular als kompaktes Fenster).
//
// Beide lesen denselben Hook (useAbmeldungFormular, useNotizFormular,
// useTerminAbsagen). Jeder Ablauf läuft deshalb zweimal, mit denselben
// Erwartungen: dieselben Felder und Vorbelegungen, dasselbe Ergebnis an die
// Seite (getrimmt, leer heißt löschen), dieselben Texte bei Ablehnung,
// geschlossen nur nach Erfolg. Was sich unterscheidet: Meldungen stehen in
// der App oben (setError), im Browser im Fenster.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, within, waitFor, cleanup, act } from '@testing-library/react';

const h = vi.hoisted(() => ({ setError: vi.fn(), online: true }));

type K = { children?: React.ReactNode; className?: string };
vi.mock('@ionic/react', () => {
  const durch = ({ children }: K) => <>{children}</>;
  return {
    IonPage: ({ children }: K) => <main>{children}</main>,
    IonHeader: durch, IonToolbar: durch, IonButtons: durch, IonContent: durch,
    IonTitle: ({ children }: K) => <h1>{children}</h1>,
    IonList: ({ children }: K) => <section>{children}</section>,
    IonListHeader: ({ children }: K) => <header>{children}</header>,
    IonItem: durch, IonCard: durch, IonCardContent: durch,
    IonLabel: ({ children }: K) => <span>{children}</span>,
    IonNote: ({ children }: K) => <p>{children}</p>,
    IonSpinner: () => <span data-testid="laedt" />,
    IonIcon: () => null,
    IonButton: ({ children, onClick, disabled, 'aria-label': label }: K & { onClick?: () => void; disabled?: boolean; 'aria-label'?: string }) => (
      <button type="button" onClick={onClick} disabled={disabled} aria-label={label}>{children}</button>
    ),
    IonTextarea: ({ label, value, onIonInput, 'aria-label': ariaLabel, disabled }: {
      label?: string; value?: string; onIonInput?: (e: { detail: { value: string } }) => void; 'aria-label'?: string; disabled?: boolean;
    }) => (
      <textarea aria-label={label ?? ariaLabel} value={value ?? ''} disabled={disabled} onChange={(e) => onIonInput?.({ detail: { value: e.target.value } })} />
    ),
  };
});
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({ setError: h.setError, isOnline: h.online }),
}));

import AbmeldungNachtragenModal from '../../../components/admin/modals/AbmeldungNachtragenModal';
import AnwesenheitNotizModal from '../../../components/admin/modals/AnwesenheitNotizModal';
import TerminAbsagenModal from '../../../components/admin/modals/TerminAbsagenModal';
import WebAbmeldungDialog from '../../../components/admin/web/termine/WebAbmeldungDialog';
import WebNotizDialog from '../../../components/admin/web/termine/WebNotizDialog';
import WebTerminAbsagenDialog from '../../../components/admin/web/termine/WebTerminAbsagenDialog';

type Fassung = 'app' | 'web';
const onSave = vi.fn();
const zu = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  h.online = true;
  onSave.mockResolvedValue(undefined);
});
afterEach(() => cleanup());

const feld = (name: string) => screen.getByRole('textbox', { name }) as HTMLTextAreaElement;
const tippe = (name: string, wert: string) => fireEvent.change(feld(name), { target: { value: wert } });
const klick = async (el: HTMLElement) => { await act(async () => { fireEvent.click(el); }); };

/** Der Knopf zum Speichern: in der App das Häkchen (aria-label), im Browser der Knopf im Fenster -- derselbe Name. */
const knopf = (name: string) => screen.getByRole('button', { name });

const erwarteMeldung = async (fassung: Fassung, text: string) => {
  if (fassung === 'app') {
    await waitFor(() => expect(h.setError).toHaveBeenLastCalledWith(text));
  } else {
    await waitFor(() => expect(within(screen.getByRole('dialog')).getByRole('alert')).toHaveTextContent(text));
    expect(h.setError).not.toHaveBeenCalled();
  }
};

// --- Abmeldung ---------------------------------------------------------------------------
const abmeldung = (fassung: Fassung, grund: string | null = null, notiz: string | null = null) => (fassung === 'app'
  ? render(<AbmeldungNachtragenModal teilnehmerName="Kim Konfi" grund={grund} notiz={notiz} onSave={onSave} dismiss={zu} />)
  : render(<WebAbmeldungDialog teilnehmerName="Kim Konfi" grund={grund} notiz={notiz} onSave={onSave} onSchliessen={zu} />));

describe.each<Fassung>(['app', 'web'])('Abmeldung eintragen (%s): dieselbe Logik in App und Browser', (fassung) => {
  it('zwei Felder, vorbelegt; Speichern gibt Grund und Notiz getrimmt an die Seite und schließt', async () => {
    abmeldung(fassung, 'krank', 'Attest liegt vor');
    expect(feld('Grund').value).toBe('krank');
    expect(feld('Notiz (optional)').value).toBe('Attest liegt vor');
    expect(document.body).toHaveTextContent('Keine Punkte. Die Konfi bekommt eine Mitteilung, dass die Abmeldung eingetragen wurde.');
    tippe('Grund', '  Fieber  ');
    tippe('Notiz (optional)', ' Mutter hat angerufen ');
    await klick(knopf('Abmeldung speichern'));
    expect(onSave.mock.calls).toEqual([['Fieber', 'Mutter hat angerufen']]);
    expect(zu).toHaveBeenCalledTimes(1);
  });

  it('lehnt die Seite ab, dieselbe Meldung -- das Fenster bleibt offen', async () => {
    onSave.mockRejectedValue(new Error('Netz weg'));
    abmeldung(fassung);
    tippe('Grund', 'krank');
    await klick(knopf('Abmeldung speichern'));
    await erwarteMeldung(fassung, 'Fehler beim Aktualisieren der Anwesenheit');
    expect(zu).not.toHaveBeenCalled();
  });

  it('offline: Speichern gesperrt', () => {
    h.online = false;
    abmeldung(fassung);
    expect(knopf('Abmeldung speichern')).toBeDisabled();
  });
});

// --- Notiz -------------------------------------------------------------------------------
const notizFenster = (fassung: Fassung, notiz: string | null = null) => (fassung === 'app'
  ? render(<AnwesenheitNotizModal teilnehmerName="Kim Konfi" notiz={notiz} onSave={onSave} dismiss={zu} />)
  : render(<WebNotizDialog teilnehmerName="Kim Konfi" notiz={notiz} onSave={onSave} onSchliessen={zu} />));
const notizFeld = (fassung: Fassung) => (fassung === 'app' ? 'Notiz zu Kim Konfi' : 'Notiz');

describe.each<Fassung>(['app', 'web'])('Notiz (%s): dieselbe Logik in App und Browser', (fassung) => {
  it('ohne Änderung kein Speichern; mit Text getrimmt an die Seite; kein Löschen ohne Notiz', async () => {
    notizFenster(fassung);
    expect(knopf('Notiz speichern')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Notiz löschen' })).toBe(null);
    tippe(notizFeld(fassung), '  ging um 14 Uhr ');
    expect(knopf('Notiz speichern')).not.toBeDisabled();
    await klick(knopf('Notiz speichern'));
    expect(onSave.mock.calls).toEqual([['ging um 14 Uhr']]);
    expect(zu).toHaveBeenCalledTimes(1);
  });

  it('mit Notiz: „Notiz löschen" schickt den leeren Text; ein geleertes Feld ebenso', async () => {
    notizFenster(fassung, 'ging früher');
    await klick(knopf('Notiz löschen'));
    expect(onSave.mock.calls).toEqual([['']]);
    cleanup();
    onSave.mockClear();
    notizFenster(fassung, 'ging früher');
    tippe(notizFeld(fassung), '');
    await klick(knopf('Notiz speichern'));
    expect(onSave.mock.calls).toEqual([['']]);
  });

  it('lehnt die Seite ab, dieselbe Meldung -- das Fenster bleibt offen', async () => {
    onSave.mockRejectedValue(new Error('Netz weg'));
    notizFenster(fassung);
    tippe(notizFeld(fassung), 'ging früher');
    await klick(knopf('Notiz speichern'));
    await erwarteMeldung(fassung, 'Fehler beim Aktualisieren der Anwesenheit');
    expect(zu).not.toHaveBeenCalled();
  });
});

// --- Absage ------------------------------------------------------------------------------
const absage = (fassung: Fassung, modus: 'absagen' | 'grund', grundVorgabe = '') => (fassung === 'app'
  ? render(<TerminAbsagenModal terminName="Konfi-Tag" terminDatum="Sa., 24.10.2026" konfiAnzahl={12} modus={modus} grundVorgabe={grundVorgabe} onSave={onSave} dismiss={zu} />)
  : render(<WebTerminAbsagenDialog terminName="Konfi-Tag" terminDatum="Sa., 24.10.2026" konfiAnzahl={12} modus={modus} grundVorgabe={grundVorgabe} onSave={onSave} onSchliessen={zu} />));
/** Der Knopf, der absagt bzw. den Grund speichert -- in App und Browser derselbe Name. */
const absageKnopf = (fassung: Fassung, modus: 'absagen' | 'grund') => {
  const name = modus === 'grund' ? 'Absagegrund speichern' : 'Event absagen';
  return fassung === 'app' ? knopf(name) : within(screen.getByRole('dialog')).getByRole('button', { name });
};

describe.each<Fassung>(['app', 'web'])('Event absagen (%s): dieselbe Logik in App und Browser', (fassung) => {
  it('Absagen: freiwilliger Grund, Eckdaten und Hinweis wie in der App; der Grund geht getrimmt an die Seite', async () => {
    absage(fassung, 'absagen');
    expect(document.body).toHaveTextContent('Sa., 24.10.2026 · 12 Konfis angemeldet');
    expect(document.body).toHaveTextContent('Alle Angemeldeten sehen den Grund am Event und bekommen ihn in der Mitteilung. Ohne Grund wird nur die Absage gemeldet.');
    tippe('Grund (optional)', '  Heizung defekt ');
    await klick(absageKnopf(fassung, 'absagen'));
    expect(onSave.mock.calls).toEqual([['Heizung defekt']]);
    expect(zu).toHaveBeenCalledTimes(1);
  });

  it('Grund ändern: vorbelegt, eigener Hinweis (keine neue Mitteilung); leer heißt kein Grund', async () => {
    absage(fassung, 'grund', 'Sturmwarnung');
    expect(feld('Grund').value).toBe('Sturmwarnung');
    expect(document.body).toHaveTextContent('· abgesagt');
    expect(document.body).toHaveTextContent('Es geht keine neue Mitteilung raus');
    tippe('Grund', '');
    await klick(absageKnopf(fassung, 'grund'));
    expect(onSave.mock.calls).toEqual([['']]);
  });

  it('lehnt der Server ab, steht seine Begründung da; ohne Begründung der feste Satz -- das Fenster bleibt offen', async () => {
    onSave.mockRejectedValueOnce({ response: { status: 403, data: { error: 'Keine Berechtigung für dieses Event' } } });
    absage(fassung, 'absagen');
    await klick(absageKnopf(fassung, 'absagen'));
    await erwarteMeldung(fassung, 'Keine Berechtigung für dieses Event');
    onSave.mockRejectedValueOnce(new Error('Netz weg'));
    await klick(absageKnopf(fassung, 'absagen'));
    await erwarteMeldung(fassung, 'Fehler beim Absagen des Events');
    expect(zu).not.toHaveBeenCalled();
  });

  it('Grund ändern scheitert: der Satz des Grund-Modus', async () => {
    onSave.mockRejectedValue(new Error('Netz weg'));
    absage(fassung, 'grund', 'Sturm');
    await klick(absageKnopf(fassung, 'grund'));
    await erwarteMeldung(fassung, 'Fehler beim Speichern des Absagegrundes');
  });
});

// --- Nur der Browser: Name des Fensters und Sperre beim Senden --------------------------------
describe('Fenster im Browser', () => {
  it('heißen nach der Person bzw. der Handlung', () => {
    abmeldung('web');
    expect(screen.getByRole('dialog', { name: 'Abmeldung von Kim Konfi' })).toBeInTheDocument();
    cleanup();
    notizFenster('web');
    expect(screen.getByRole('dialog', { name: 'Notiz zu Kim Konfi' })).toBeInTheDocument();
    cleanup();
    absage('web', 'absagen');
    expect(screen.getByRole('dialog', { name: 'Event absagen' })).toHaveAccessibleDescription('„Konfi-Tag“ · Sa., 24.10.2026 · 12 Konfis angemeldet');
    cleanup();
    absage('web', 'grund');
    expect(screen.getByRole('dialog', { name: 'Absagegrund bearbeiten' })).toBeInTheDocument();
  });

  it('solange gespeichert wird, schließt nichts die Absage (X, Abbrechen, Escape)', async () => {
    let fertig: () => void = () => undefined;
    onSave.mockReturnValue(new Promise<void>((ok) => { fertig = ok; }));
    absage('web', 'absagen');
    await klick(absageKnopf('web', 'absagen'));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Schließen' }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Abbrechen' }));
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(zu).not.toHaveBeenCalled();
    await act(async () => { fertig(); });
    expect(zu).toHaveBeenCalledTimes(1);
  });
});
