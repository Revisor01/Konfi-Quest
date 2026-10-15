// Funktionsbeschreibung, Bibelübersetzung, Konto löschen und Benachrichtigungen
// -- das Modal der App und der Dialog der Web-Fassung im Vergleich (Simon,
// 15.10.2026: im Browser ab 992 px bekommt jedes Formular, das noch ein
// App-Modal öffnet, ein kompaktes Web-Fenster; in den Apps bleibt das Modal).
//
// Beide lesen dieselbe Logik (useFunktionsbeschreibung, BIBLE_TRANSLATIONS,
// useKontoLoeschen, usePushAuswahl). Jeder Ablauf läuft deshalb zweimal, einmal
// je Fassung, mit denselben Erwartungen: dieselben Felder und Einträge,
// dieselben Rümpfe an dieselben Routen, dieselben Texte bei Prüfung und
// Ablehnung. Was sich unterscheidet, steht ausdrücklich da: Meldungen stehen in
// der App am Rand (setError), im Browser im Dialog; das leere Passwort sperrt
// in der App den Knopf, der Browser sagt im Dialog, was fehlt.
//
// Ersetzt sind Netz, Kontexte und die Ionic-Bausteine der App (schlichte
// HTML-Nachbauten mit denselben Namen). Wie die Seiten die Fenster öffnen,
// prüft start/webProfilFenster.test.tsx.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, within, waitFor, cleanup, act } from '@testing-library/react';

const h = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
  setError: vi.fn(),
  setSuccess: vi.fn(),
  signOut: vi.fn(async () => undefined),
  pushAnfordern: vi.fn(async () => undefined),
  enqueue: vi.fn(),
  online: true,
  netz: true,
  pushErlaubnis: 'granted',
  user: { id: 9, type: 'teamer', role_name: 'teamer' } as Record<string, unknown>,
}));

vi.mock('@ionic/react', async () => {
  const basis = (await import('../support/ionicAttrappe')).ionicAttrappe({});
  return {
    ...basis,
    IonText: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
    // Die Attrappe der Support-Ansicht kennt kein gesperrtes IonToggle.
    IonToggle: ({ 'aria-label': label, checked, disabled, onIonChange }: {
      'aria-label'?: string; checked?: boolean; disabled?: boolean; onIonChange?: (e: { detail: { checked: boolean } }) => void;
    }) => (
      <input type="checkbox" aria-label={label} checked={!!checked} disabled={!!disabled}
        onChange={(e) => onIonChange?.({ detail: { checked: e.target.checked } })} />
    ),
  };
});
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({
    user: h.user,
    setError: h.setError,
    setSuccess: h.setSuccess,
    signOut: h.signOut,
    isOnline: h.online,
    pushNotificationsPermission: h.pushErlaubnis,
    requestPushPermissions: h.pushAnfordern,
  }),
}));
vi.mock('../../../services/api', () => ({
  default: {
    get: (u: string) => h.apiGet(u),
    post: (u: string, b?: unknown) => h.apiPost(u, b),
    put: (u: string, b?: unknown) => h.apiPut(u, b),
  },
}));
vi.mock('../../../services/networkMonitor', () => ({ networkMonitor: { get isOnline() { return h.netz; } } }));
vi.mock('../../../services/writeQueue', () => ({ writeQueue: { enqueue: (e: unknown) => h.enqueue(e) } }));

import ChangeRoleTitleModal from '../../../components/admin/modals/ChangeRoleTitleModal';
import WebFunktionDialog from '../../../components/shared/web/konto/WebFunktionDialog';
import BibleTranslationModal, { BIBLE_TRANSLATIONS } from '../../../components/shared/BibleTranslationModal';
import WebBibelUebersetzungDialog from '../../../components/shared/web/konto/WebBibelUebersetzungDialog';
import DeleteAccountModal from '../../../components/shared/DeleteAccountModal';
import WebKontoLoeschenDialog from '../../../components/shared/web/konto/WebKontoLoeschenDialog';
import { PushAuswahlModal } from '../../../components/shared/PushAuswahl';
import WebPushAuswahlDialog from '../../../components/shared/web/konto/WebPushAuswahlDialog';
import { eigenesKontoLoeschHinweis } from '../../../utils/kontoLoeschen';
import { OFFLINE_AKTION_MELDUNG } from '../../../utils/offlineAktion';

type Fassung = 'app' | 'web';

const zu = vi.fn();
const fertig = vi.fn();

const serverFehler = (status: number, error?: string) => Object.assign(new Error('Request failed'), {
  response: { status, data: error ? { error } : {} },
});

// Erfundener Wert für das Passwortfeld, zusammengesetzt, damit Geheimnis-Scanner
// ihn nicht als Passwort im öffentlichen Repo melden (wie webKontoDialoge).
const PASSWORT = ['Herbst', '2026', 'Wiese!'].join('-');

beforeEach(() => {
  vi.clearAllMocks();
  h.apiGet.mockReset();
  h.apiPost.mockReset();
  h.apiPut.mockReset();
  h.online = true;
  h.netz = true;
  h.pushErlaubnis = 'granted';
  h.user = { id: 9, type: 'teamer', role_name: 'teamer' };
});
afterEach(() => cleanup());

/** Die Meldung: in der App am Rand (setError), im Browser im Dialog -- derselbe Text. */
const erwarteMeldung = async (fassung: Fassung, text: string) => {
  if (fassung === 'app') {
    await waitFor(() => expect(h.setError).toHaveBeenLastCalledWith(text));
  } else {
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent(text));
    expect(h.setError).not.toHaveBeenCalled();
  }
};

const tippen = (el: HTMLElement, wert: string) => fireEvent.change(el, { target: { value: wert } });
const klick = async (el: HTMLElement) => { await act(async () => { fireEvent.click(el); }); };

// --- Funktionsbeschreibung -------------------------------------------------------------
describe.each<Fassung>(['app', 'web'])('Funktionsbeschreibung (%s): dieselbe Logik in App und Browser', (fassung) => {
  const oeffnen = (titel = 'Jugendleiterin') => {
    if (fassung === 'app') render(<ChangeRoleTitleModal onClose={zu} onSuccess={fertig} initialRoleTitle={titel} />);
    else render(<WebFunktionDialog initialRoleTitle={titel} onSchliessen={zu} onGespeichert={fertig} />);
  };
  const feld = () => screen.getByRole('textbox', { name: 'Funktionsbeschreibung' }) as HTMLInputElement;
  const speichernKnopf = () => screen.getByRole('button', { name: fassung === 'app' ? 'Rollentitel speichern' : 'Speichern' });

  it('beginnt mit der gespeicherten Beschreibung; Speichern schickt sie ohne Leerzeichen am Rand an POST /auth/update-role-title', async () => {
    h.apiPost.mockResolvedValue({ data: {} });
    oeffnen();
    if (fassung === 'web') expect(screen.getByRole('dialog', { name: 'Funktionsbeschreibung' })).toBeInTheDocument();
    expect(feld().value).toBe('Jugendleiterin');
    tippen(feld(), '  Diakonin  ');
    await klick(speichernKnopf());
    expect(h.apiPost.mock.calls).toEqual([['/auth/update-role-title', { role_title: 'Diakonin' }]]);
    expect(fertig).toHaveBeenCalledTimes(1);
    expect(h.setError).not.toHaveBeenCalled();
    expect(h.enqueue).not.toHaveBeenCalled();
  });

  it('leer gespeichert: role_title "" (dann gilt wieder die Rolle)', async () => {
    h.apiPost.mockResolvedValue({ data: {} });
    oeffnen();
    tippen(feld(), '   ');
    await klick(speichernKnopf());
    expect(h.apiPost.mock.calls).toEqual([['/auth/update-role-title', { role_title: '' }]]);
    expect(fertig).toHaveBeenCalledTimes(1);
  });

  it('lehnt der Server ab, steht seine Begründung da -- nichts schließt', async () => {
    h.apiPost.mockRejectedValue(serverFehler(400, 'Die Funktionsbeschreibung ist zu lang'));
    oeffnen();
    await klick(speichernKnopf());
    await erwarteMeldung(fassung, 'Die Funktionsbeschreibung ist zu lang');
    expect(fertig).not.toHaveBeenCalled();
    expect(zu).not.toHaveBeenCalled();
  });

  it('ohne Meldung des Servers steht der Ersatztext', async () => {
    h.apiPost.mockRejectedValue(serverFehler(500));
    oeffnen();
    await klick(speichernKnopf());
    await erwarteMeldung(fassung, 'Fehler beim Aktualisieren der Funktionsbeschreibung');
  });

  it('reißt das Netz ab, geht derselbe Aufruf in die Warteschlange und das Fenster schließt', async () => {
    h.netz = false;
    oeffnen();
    tippen(feld(), 'Pastor');
    await klick(speichernKnopf());
    expect(h.apiPost).not.toHaveBeenCalled();
    expect(h.enqueue).toHaveBeenCalledTimes(1);
    expect(h.enqueue.mock.calls[0][0]).toMatchObject({ method: 'POST', url: '/auth/update-role-title', body: { role_title: 'Pastor' } });
    expect(h.setSuccess).toHaveBeenCalledWith('Funktionsbeschreibung wird bei Verbindung aktualisiert');
    expect(fertig).toHaveBeenCalledTimes(1);
  });

  it('offline ist Speichern gesperrt', () => {
    h.online = false;
    oeffnen();
    expect(speichernKnopf()).toBeDisabled();
  });
});

describe('Funktionsbeschreibung (web): Enter speichert, während des Sendens schließt nichts', () => {
  it('Absenden aus dem Feld geht an dieselbe Route; solange gesendet wird, sind X und Abbrechen gesperrt und Escape schließt nicht', async () => {
    let ok: (v: unknown) => void = () => undefined;
    h.apiPost.mockReturnValue(new Promise((a) => { ok = a; }));
    render(<WebFunktionDialog initialRoleTitle="" onSchliessen={zu} onGespeichert={fertig} />);
    const dialog = screen.getByRole('dialog', { name: 'Funktionsbeschreibung' });
    const feld = within(dialog).getByRole('textbox', { name: 'Funktionsbeschreibung' }) as HTMLInputElement;
    tippen(feld, 'Gemeindediakon');
    await act(async () => { fireEvent.submit(feld.form as HTMLFormElement); });
    expect(h.apiPost.mock.calls).toEqual([['/auth/update-role-title', { role_title: 'Gemeindediakon' }]]);
    expect(within(dialog).getByRole('button', { name: 'Schließen' })).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: 'Abbrechen' })).toBeDisabled();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(zu).not.toHaveBeenCalled();
    await act(async () => { ok({ data: {} }); });
    expect(fertig).toHaveBeenCalledTimes(1);
  });
});

// --- Bibelübersetzung -------------------------------------------------------------------
describe.each<Fassung>(['app', 'web'])('Bibelübersetzung (%s): dieselbe Auswahl in App und Browser', (fassung) => {
  const waehle = vi.fn();
  const oeffnen = (aktuell = 'GNB') => {
    if (fassung === 'app') render(<BibleTranslationModal onClose={zu} currentTranslation={aktuell} onSelect={waehle} />);
    else render(<WebBibelUebersetzungDialog currentTranslation={aktuell} onSelect={waehle} onSchliessen={zu} />);
  };
  /** Die wählbaren Übersetzungen: alles, was gedrückt sein kann. */
  const eintraege = () => screen.getAllByRole('button').filter((b) => b.hasAttribute('aria-pressed'));

  it('alle Übersetzungen in derselben Reihenfolge, die aktuelle ist gedrückt', () => {
    oeffnen();
    if (fassung === 'web') expect(screen.getByRole('dialog', { name: 'Bibelübersetzung' })).toBeInTheDocument();
    const liste = eintraege();
    expect(liste).toHaveLength(BIBLE_TRANSLATIONS.length);
    liste.forEach((el, i) => {
      expect(el).toHaveTextContent(BIBLE_TRANSLATIONS[i].name);
      expect(el).toHaveTextContent(BIBLE_TRANSLATIONS[i].description);
    });
    expect(liste.filter((el) => el.getAttribute('aria-pressed') === 'true').map((el) => el.textContent?.startsWith('Gute Nachricht Bibel'))).toEqual([true]);
  });

  it('ein Klick wählt die Übersetzung mit ihrem Kürzel -- die Seite speichert', () => {
    oeffnen();
    fireEvent.click(eintraege().find((el) => el.textContent?.startsWith('Elberfelder Bibel')) as HTMLElement);
    expect(waehle.mock.calls).toEqual([['ELB']]);
  });
});

describe('Bibelübersetzung (web): Abbrechen und Escape wählen nichts', () => {
  it('schließt ohne Wahl', () => {
    const waehle = vi.fn();
    render(<WebBibelUebersetzungDialog currentTranslation="LUT" onSelect={waehle} onSchliessen={zu} />);
    const dialog = screen.getByRole('dialog', { name: 'Bibelübersetzung' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Abbrechen' }));
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(zu).toHaveBeenCalledTimes(2);
    expect(waehle).not.toHaveBeenCalled();
  });
});

// --- Konto löschen -----------------------------------------------------------------------
describe.each<Fassung>(['app', 'web'])('Konto löschen (%s): dieselbe Sicherung in App und Browser', (fassung) => {
  const oeffnen = () => {
    if (fassung === 'app') render(<DeleteAccountModal onClose={zu} />);
    else render(<WebKontoLoeschenDialog onSchliessen={zu} />);
  };
  const passwort = () => screen.getByLabelText('Dein Passwort') as HTMLInputElement;
  const loeschenKnopf = () => screen.getByRole('button', { name: 'Konto endgültig löschen' });

  it('nennt, was mit dem Konto verschwindet -- im Team auch, was der Gemeinde bleibt; bei Konfis ohne diesen Satz', () => {
    oeffnen();
    const team = eigenesKontoLoeschHinweis(false);
    if (fassung === 'app') expect(screen.getByText(team)).toBeInTheDocument();
    else expect(screen.getByRole('dialog', { name: 'Konto löschen' })).toHaveAccessibleDescription(team);
    cleanup();
    h.user = { id: 7, type: 'konfi', role_name: 'konfi' };
    oeffnen();
    const konfi = eigenesKontoLoeschHinweis(true);
    if (fassung === 'app') expect(screen.getByText(konfi)).toBeInTheDocument();
    else expect(screen.getByRole('dialog', { name: 'Konto löschen' })).toHaveAccessibleDescription(konfi);
  });

  it('mit Passwort: POST /auth/delete-account mit genau diesem Körper, dann schließt das Fenster und die Anmeldung endet', async () => {
    h.apiPost.mockResolvedValue({ data: {} });
    oeffnen();
    expect(passwort().type).toBe('password');
    tippen(passwort(), PASSWORT);
    await klick(loeschenKnopf());
    expect(h.apiPost.mock.calls).toEqual([['/auth/delete-account', { password: PASSWORT }]]);
    expect(zu).toHaveBeenCalledTimes(1);
    expect(h.signOut).toHaveBeenCalledTimes(1);
    expect(h.setError).not.toHaveBeenCalled();
  });

  it('falsches Passwort (400): „Passwort ist falsch" am Feld, keine Abmeldung -- Tippen räumt es weg', async () => {
    h.apiPost.mockRejectedValue(serverFehler(400, 'Ungültiges Passwort'));
    oeffnen();
    tippen(passwort(), PASSWORT);
    await klick(loeschenKnopf());
    expect(await screen.findByText('Passwort ist falsch')).toBeInTheDocument();
    expect(h.setError).not.toHaveBeenCalled();
    expect(h.signOut).not.toHaveBeenCalled();
    expect(zu).not.toHaveBeenCalled();
    tippen(passwort(), `${PASSWORT}x`);
    expect(screen.queryByText('Passwort ist falsch')).toBeNull();
  });

  it('anderer Fehler: die Meldung des Servers, sonst der Ersatztext', async () => {
    h.apiPost.mockRejectedValueOnce(serverFehler(500, 'Datenbank nicht erreichbar'));
    oeffnen();
    tippen(passwort(), PASSWORT);
    await klick(loeschenKnopf());
    await erwarteMeldung(fassung, 'Datenbank nicht erreichbar');
    h.apiPost.mockRejectedValueOnce(serverFehler(500));
    await klick(loeschenKnopf());
    await erwarteMeldung(fassung, 'Fehler beim Löschen des Accounts');
    expect(h.signOut).not.toHaveBeenCalled();
  });

  it('ohne Passwort geht nichts an den Server', async () => {
    oeffnen();
    if (fassung === 'app') {
      // Die App sperrt den Knopf, bis ein Passwort da ist.
      expect(loeschenKnopf()).toBeDisabled();
    } else {
      // Der Browser lässt klicken und sagt im Dialog, was fehlt -- mit dem Text des Hooks.
      expect(loeschenKnopf()).not.toBeDisabled();
      await klick(loeschenKnopf());
      expect(screen.getByRole('alert')).toHaveTextContent('Bitte gib dein Passwort zur Bestätigung ein');
    }
    expect(h.apiPost).not.toHaveBeenCalled();
  });

  it('offline ist Löschen gesperrt', () => {
    h.online = false;
    oeffnen();
    tippen(passwort(), PASSWORT);
    const knopf = fassung === 'app'
      ? screen.getByRole('button', { name: 'Du bist offline' })
      : loeschenKnopf();
    expect(knopf).toBeDisabled();
    if (fassung === 'web') expect(screen.getByText(OFFLINE_AKTION_MELDUNG)).toBeInTheDocument();
  });
});

describe('Konto löschen (web): Optik der Rückfrage, Enter löscht, während des Löschens schließt nichts', () => {
  it('Enter im Passwortfeld löscht; solange gesendet wird, schließen weder X noch Abbrechen noch Escape', async () => {
    let ok: (v: unknown) => void = () => undefined;
    h.apiPost.mockReturnValue(new Promise((a) => { ok = a; }));
    render(<WebKontoLoeschenDialog onSchliessen={zu} />);
    const dialog = screen.getByRole('dialog', { name: 'Konto löschen' });
    const feld = within(dialog).getByLabelText('Dein Passwort') as HTMLInputElement;
    tippen(feld, PASSWORT);
    await act(async () => { fireEvent.submit(feld.form as HTMLFormElement); });
    expect(h.apiPost.mock.calls).toEqual([['/auth/delete-account', { password: PASSWORT }]]);
    expect(within(dialog).getByRole('button', { name: 'Schließen' })).toBeDisabled();
    expect(within(dialog).getByRole('button', { name: 'Abbrechen' })).toBeDisabled();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(zu).not.toHaveBeenCalled();
    await act(async () => { ok({ data: {} }); });
    expect(zu).toHaveBeenCalledTimes(1);
    expect(h.signOut).toHaveBeenCalledTimes(1);
  });

  it('„Passwort zeigen" macht das Feld lesbar', () => {
    render(<WebKontoLoeschenDialog onSchliessen={zu} />);
    fireEvent.click(screen.getByRole('button', { name: 'Passwort zeigen' }));
    expect((screen.getByLabelText('Dein Passwort') as HTMLInputElement).type).toBe('text');
  });
});

// --- Benachrichtigungen ----------------------------------------------------------------------
const GRUPPEN = {
  push_enabled: true,
  stumm: [],
  gruppen: [
    { id: 'konfi_chat', name: 'Nachrichten', beschreibung: 'Neue Nachrichten in deinen Chats', aktiv: true },
    { id: 'konfi_termine', name: 'Events', beschreibung: 'Anmeldungen, Änderungen, Absagen und Erinnerungen', aktiv: true },
  ],
};

describe.each<Fassung>(['app', 'web'])('Benachrichtigungen (%s): dieselbe Auswahl in App und Browser', (fassung) => {
  const geaendert = vi.fn();
  const oeffnen = async () => {
    if (fassung === 'app') render(<PushAuswahlModal onClose={zu} variante="users" onGeaendert={geaendert} />);
    else render(<WebPushAuswahlDialog onSchliessen={zu} onGeaendert={geaendert} />);
    await waitFor(() => expect(h.apiGet).toHaveBeenCalledWith('/notifications/preferences'));
    await act(async () => { await Promise.resolve(); });
  };
  const rolle = fassung === 'app' ? 'checkbox' : 'switch';
  const haupt = () => screen.getByRole(rolle, { name: fassung === 'app' ? 'Mitteilungen aufs Handy' : 'Alle Mitteilungen' }) as HTMLInputElement;
  const gruppe = (name: string) => screen.getByRole(rolle, { name }) as HTMLInputElement;

  beforeEach(() => {
    h.apiGet.mockResolvedValue({ data: GRUPPEN });
    h.apiPut.mockImplementation(async (_u: string, b: Record<string, unknown>) => ({ data: { push_enabled: true, stumm: [], ...b } }));
  });

  it('zeigt genau die Gruppen des Servers, alle an', async () => {
    await oeffnen();
    if (fassung === 'web') expect(screen.getByRole('dialog', { name: 'Benachrichtigungen' })).toBeInTheDocument();
    expect(screen.getAllByRole(rolle).length).toBe(3);
    expect([haupt(), gruppe('Nachrichten'), gruppe('Events')].map((s) => s.checked)).toEqual([true, true, true]);
  });

  it('eine Gruppe ab: PUT mit der vollständigen Abwahl-Liste (die schon stummen bleiben drin); wieder an nimmt nur sie heraus', async () => {
    // „Nachrichten" ist schon stumm.
    h.apiGet.mockResolvedValue({ data: { ...GRUPPEN, stumm: ['konfi_chat'], gruppen: GRUPPEN.gruppen.map((g) => ({ ...g, aktiv: g.id !== 'konfi_chat' })) } });
    h.apiPut.mockImplementation(async (_u: string, b: Record<string, unknown>) => ({ data: { push_enabled: true, ...b } }));
    await oeffnen();
    expect(gruppe('Nachrichten').checked).toBe(false);
    await klick(gruppe('Events'));
    expect(h.apiPut.mock.calls).toEqual([['/notifications/preferences', { stumm: ['konfi_chat', 'konfi_termine'] }]]);
    await waitFor(() => expect(gruppe('Events').checked).toBe(false));
    expect(geaendert).toHaveBeenLastCalledWith(expect.objectContaining({ stumm: ['konfi_chat', 'konfi_termine'] }));
    await klick(gruppe('Nachrichten'));
    expect(h.apiPut.mock.calls[1]).toEqual(['/notifications/preferences', { stumm: ['konfi_termine'] }]);
    await waitFor(() => expect(gruppe('Nachrichten').checked).toBe(true));
  });

  it('der Hauptschalter aus schickt push_enabled=false und sperrt die Gruppen', async () => {
    await oeffnen();
    await klick(haupt());
    expect(h.apiPut.mock.calls).toEqual([['/notifications/preferences', { push_enabled: false }]]);
    await waitFor(() => expect(haupt().checked).toBe(false));
    expect(gruppe('Nachrichten')).toBeDisabled();
    expect(gruppe('Events')).toBeDisabled();
  });

  it('scheitert das Speichern, steht dieselbe Meldung da', async () => {
    h.apiPut.mockRejectedValue(serverFehler(500));
    await oeffnen();
    await klick(gruppe('Nachrichten'));
    await erwarteMeldung(fassung, 'Einstellung konnte nicht gespeichert werden');
  });

  it('scheitert das Laden, steht dieselbe Meldung da', async () => {
    h.apiGet.mockRejectedValue(serverFehler(500));
    await oeffnen();
    await erwarteMeldung(fassung, 'Einstellungen konnten nicht geladen werden');
  });

  it('ohne Erlaubnis des Geräts: der Hinweis und „Mitteilungen erlauben", das sie anfordert', async () => {
    h.pushErlaubnis = 'prompt';
    await oeffnen();
    expect(screen.getByText(/Das Handy erlaubt Konfi Quest noch keine Mitteilungen/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Mitteilungen erlauben' }));
    expect(h.pushAnfordern).toHaveBeenCalledTimes(1);
  });
});

// Nur im Browser: sofort speichernde Schalter und die Tastatur (Befund
// 15.10.2026). Solange ein Wechsel zum Server geht, ist das Fenster gesperrt.
// Wurde der umgelegte Schalter dafür `disabled`, holte das Fenster den Fokus
// zu sich, und nach dem Speichern gab ihn niemand zurück: Wer mehrere Gruppen
// umlegte, musste jedes Mal neu vom X aus hinlaufen.
describe('Benachrichtigungen im Browser: der Fokus bleibt am umgelegten Schalter', () => {
  beforeEach(() => {
    h.apiGet.mockResolvedValue({ data: GRUPPEN });
  });

  it('Fokus am Schalter, Wechsel, Antwort: der Fokus steht danach am selben Schalter; währenddessen geht kein zweiter Wechsel los', async () => {
    let antworten: (v: unknown) => void = () => undefined;
    h.apiPut.mockImplementation(() => new Promise((r) => { antworten = r; }));
    render(<WebPushAuswahlDialog onSchliessen={zu} />);
    const events = await screen.findByRole('switch', { name: 'Events' }) as HTMLInputElement;
    const nachrichten = screen.getByRole('switch', { name: 'Nachrichten' }) as HTMLInputElement;

    events.focus();
    await klick(events);
    expect(h.apiPut.mock.calls).toEqual([['/notifications/preferences', { stumm: ['konfi_termine'] }]]);

    // Während gespeichert wird: Fenster gesperrt, der Schalter meldet sich als
    // nicht verfügbar, behält aber den Fokus.
    expect(screen.getByRole('button', { name: 'Schließen' })).toBeDisabled();
    expect(events).toHaveAttribute('aria-disabled', 'true');
    expect(document.activeElement).toBe(events);
    // Ein zweiter Wechsel in dieser Zeit wird nicht angenommen.
    await klick(nachrichten);
    expect(h.apiPut).toHaveBeenCalledTimes(1);
    expect(nachrichten.checked).toBe(true);

    await act(async () => { antworten({ data: { push_enabled: true, stumm: ['konfi_termine'] } }); });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Schließen' })).toBeEnabled());
    expect(events.checked).toBe(false);
    expect(events).not.toHaveAttribute('aria-disabled');
    expect(document.activeElement).toBe(events);

    // Gleich weiter per Tastatur: der nächste Wechsel geht vom selben Schalter aus.
    await klick(events);
    expect(h.apiPut.mock.calls[1]).toEqual(['/notifications/preferences', { stumm: [] }]);
    expect(document.activeElement).toBe(events);
  });

  it('auch der Hauptschalter behält beim Speichern den Fokus', async () => {
    let antworten: (v: unknown) => void = () => undefined;
    h.apiPut.mockImplementation(() => new Promise((r) => { antworten = r; }));
    render(<WebPushAuswahlDialog onSchliessen={zu} />);
    const haupt = await screen.findByRole('switch', { name: 'Alle Mitteilungen' }) as HTMLInputElement;
    haupt.focus();
    await klick(haupt);
    expect(h.apiPut.mock.calls).toEqual([['/notifications/preferences', { push_enabled: false }]]);
    expect(document.activeElement).toBe(haupt);
    await act(async () => { antworten({ data: { push_enabled: false, stumm: [] } }); });
    await waitFor(() => expect(haupt.checked).toBe(false));
    expect(document.activeElement).toBe(haupt);
    // Die Gruppen sind jetzt echt gesperrt: ohne Hauptschalter gibt es nichts zu wählen.
    expect(screen.getByRole('switch', { name: 'Events' })).toBeDisabled();
  });
});
