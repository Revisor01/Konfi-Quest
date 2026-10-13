// „Konfi anlegen" und „Anwesenheit" von der Konfis-Liste im Browser, gerendert
// (Simon, 13.10.2026: „Das konfi anlegen modal ist noch nicht im neuen web modal
// look. anwesenheiten glaube ich auch nicht."). Im breiten Layout öffnen beide
// Knöpfe eigene Dialoge der Web-Fassung (WebKonfiDialog, WebAnwesenheitDialog)
// statt der Modale der App; schmal bleibt es bei den Modalen.
//
// Die Logik ist für App und Web dieselbe (useKonfiFormular, useAnwesenheitsMatrix).
// Geprüft wird mit echter Logik -- nur Server, Kontext, Breite und Ionic sind
// Attrappen --, dass der Dialog benannte Pflichtfelder zeigt, fehlende Angaben
// mit einem Satz meldet, exakt den Rumpf der App an exakt deren Route schickt,
// die Antworten des Servers (Limit, keine Antwort, Tarif-Grenze, vergebener
// Name, Fehler) im Fenster zeigt statt oben, nach dem Anlegen das
// Einmalpasswort zeigt und die Liste neu lädt. Die Anwesenheit zeigt dieselben
// Zellen und Summen wie die App, ihre Meldungen im Fenster.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, within, act, cleanup } from '@testing-library/react';
import { konto, neuerStand, type LeitungTestStand } from './leitungTestHilfe';

const h = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiDelete: vi.fn(),
  refresh: vi.fn(),
  setError: vi.fn(),
  setSuccess: vi.fn(),
  breit: true,
  online: true,
  zaehler: 0,
  stand: { alert: null, fenster: [], push: vi.fn() } as unknown as LeitungTestStand,
  user: {} as Record<string, unknown>,
  kopieren: vi.fn(),
}));

vi.mock('@ionic/react', async () => (await import('./leitungTestHilfe')).ionicFuerLeitung(h.stand));
vi.mock('../../../navigation/breitesLayout', () => ({ useBreitesLayout: () => h.breit }));
vi.mock('../../../navigation/useAppLocation', () => ({ useAppLocation: () => ({ pathname: '/admin/konfis', search: '' }) }));
vi.mock('../../../components/shared/AppKopfzeile', async () => (await import('../support/ionicAttrappe')).KopfzeileAttrappe);
vi.mock('../../../components/shared/WartungsHinweis', () => ({ default: () => null }));
vi.mock('../../../components/common/LoadingSpinner', () => ({ default: () => null }));
vi.mock('../../../services/api', () => ({ default: { get: h.apiGet, delete: h.apiDelete, post: h.apiPost } }));
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({ user: h.user, setError: h.setError, setSuccess: h.setSuccess, isOnline: h.online }),
}));
vi.mock('../../../contexts/ModalContext', () => ({ useModalPage: () => ({ pageRef: { current: null }, presentingElement: null }) }));
vi.mock('../../../contexts/LiveUpdateContext', () => ({
  useLiveRefresh: () => {},
  useLiveUpdate: () => ({ triggerRefresh: vi.fn() }),
}));
vi.mock('../../../hooks/useOfflineQuery', () => ({
  useOfflineQuery: (schluessel: string) => ({
    data: schluessel.startsWith('admin:konfis') ? KONFIS : schluessel.startsWith('admin:jahrgaenge') ? JAHRGAENGE : {},
    loading: false, error: null, isStale: false, isOffline: false,
    refresh: h.refresh, refreshLive: vi.fn(),
  }),
}));
vi.mock('../../../hooks/useOnboardingOnce', () => ({
  useOnboardingWithUpdateOnce: () => ({
    showOnboarding: false, closeOnboarding: vi.fn(),
    showNeuerungen: false, schliesseNeuerungen: vi.fn(),
    showUpdateHinweis: false, markUpdateHinweisGesehen: vi.fn(),
    showMitmachenHinweis: false, markMitmachenHinweisGesehen: vi.fn(),
  }),
}));
// Jede Kennung eine neue: So fällt auf, wenn ein zweiter Versuch eine andere schickte.
vi.mock('../../../utils/uuid', () => ({ safeUUID: () => { h.zaehler += 1; return `kennung-${h.zaehler}`; } }));
vi.mock('../../../components/shared/NeuerungenBanner', () => ({ default: () => null }));
vi.mock('../../../components/shared/MitmachenErklaerungModal', () => ({ default: () => null }));
vi.mock('../../../components/admin/modals/UserManagementModal', () => ({ default: () => null }));
vi.mock('../../../components/admin/modals/AdminOnboardingModal', () => ({ default: () => null }));
vi.mock('../../../components/admin/modals/AdminUpdate230WalkthroughModal', () => ({ default: () => null }));

import AdminKonfisPage from '../../../components/admin/pages/AdminKonfisPage';
import KonfiModal from '../../../components/admin/modals/KonfiModal';
import AttendanceMatrixModal from '../../../components/admin/modals/AttendanceMatrixModal';

const JAHRGAENGE = [{ id: 12, name: 'Jahrgang 2026' }, { id: 13, name: 'Jahrgang 2027' }];
const KONFIS = [
  { id: 1, name: 'Anna Müller', username: 'anna.mueller', jahrgang_name: 'Jahrgang 2026', gottesdienst_points: 7, gemeinde_points: 5 },
];
// Erfundenes Einmalpasswort, zusammengesetzt, damit Geheimnis-Scanner es nicht als Passwort melden.
const EINMAL = ['Psalm', '23', 'Hirte'].join('-');
const ANGELEGT = { data: { id: 42, username: 'kim.test', temporaryPassword: EINMAL, message: 'Konfi erfolgreich erstellt' } };
const antwortFehler = (status: number, data: Record<string, unknown>) =>
  Object.assign(new Error(`Request failed with status code ${status}`), { response: { status, data } });
const KEIN_NETZ = Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' });

const MATRIX_12 = {
  jahrgang: { id: 12, name: 'Jahrgang 2026' },
  konfis: [
    { user_id: 1, display_name: 'Anna Müller', username: 'anna.mueller' },
    { user_id: 2, display_name: 'Ben Schmidt', username: 'ben.schmidt' },
  ],
  events: [
    { id: 101, name: 'Gottesdienst Erntedank', event_date: '2026-10-04T10:00:00Z' },
    { id: 102, name: 'Konfi-Samstag', event_date: '2026-10-10T09:00:00Z' },
  ],
  bookings: [
    { event_id: 101, user_id: 1, status: 'confirmed', attendance_status: 'present' },
    { event_id: 102, user_id: 1, status: 'confirmed', attendance_status: 'excused', excuse_reason: 'krank' },
    { event_id: 101, user_id: 2, status: 'confirmed', attendance_status: 'absent' },
  ],
};
const MATRIX_13 = {
  jahrgang: { id: 13, name: 'Jahrgang 2027' },
  konfis: [{ user_id: 3, display_name: 'Cleo Neu', username: 'cleo.neu' }],
  events: [{ id: 201, name: 'Kennenlernen', event_date: '2026-11-07T10:00:00Z' }],
  bookings: [],
};
const SPRUECHE_12 = [
  { user_id: 1, display_name: 'Anna Müller', konfirmation_date: '2027-05-16T09:30:00Z', konfspruch: { source: 'liste', reference: 'Psalm 23,1', text: 'Der Herr ist mein Hirte.' } },
  { user_id: 2, display_name: 'Ben Schmidt', konfirmation_date: null, konfspruch: null },
];

const warten = async () => { for (let i = 0; i < 8; i += 1) await act(async () => { await Promise.resolve(); }); };
const tippen = (feld: HTMLElement, wert: string) => fireEvent.change(feld, { target: { value: wert } });
const absenden = async (dialog: HTMLElement, knopf: string) => {
  await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: knopf })); });
  await warten();
};
const fenster = (komponente: unknown) => h.stand.fenster.filter((f) => f.komponente === komponente);

const anlegenOeffnen = () => {
  render(<AdminKonfisPage />);
  fireEvent.click(screen.getByRole('button', { name: 'Konfi anlegen' }));
  return screen.getByRole('dialog', { name: 'Konfi anlegen' });
};
const ausfuellen = (dialog: HTMLElement, name = 'Kim Test', jahrgang = '12') => {
  tippen(within(dialog).getByLabelText('Name'), name);
  tippen(within(dialog).getByRole('combobox', { name: 'Jahrgang' }), jahrgang);
};

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(h.stand, neuerStand());
  h.breit = true;
  h.online = true;
  h.zaehler = 0;
  h.user = konto('org_admin');
  // Auch die vorgemerkten Einmal-Antworten weg: Eine nicht verbrauchte darf
  // keinen späteren Test treffen.
  for (const f of [h.apiGet, h.apiPost, h.apiDelete, h.refresh, h.kopieren]) f.mockReset();
  h.apiGet.mockImplementation(async (url: string) => {
    if (url === '/admin/jahrgaenge/12/attendance-matrix') return { data: MATRIX_12 };
    if (url === '/admin/jahrgaenge/13/attendance-matrix') return { data: MATRIX_13 };
    if (url === '/admin/jahrgaenge/12/sprueche') return { data: SPRUECHE_12 };
    return { data: [], headers: {} };
  });
  h.apiPost.mockResolvedValue(ANGELEGT);
  h.refresh.mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: h.kopieren }, configurable: true });
  h.kopieren.mockResolvedValue(undefined);
});

afterEach(() => {
  Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
});

describe('Konfi anlegen im Browser: eigener Dialog', () => {
  it('öffnet einen Dialog mit Name und Jahrgang als Pflichtfeldern, der Fokus steht im Namen; kein App-Fenster', () => {
    const dialog = anlegenOeffnen();
    const name = within(dialog).getByLabelText('Name');
    expect(name).toHaveAttribute('aria-required', 'true');
    expect(document.activeElement).toBe(name);
    const jahrgang = within(dialog).getByRole('combobox', { name: 'Jahrgang' }) as HTMLSelectElement;
    expect(jahrgang).toHaveAttribute('aria-required', 'true');
    expect([...jahrgang.options].map((o) => o.textContent)).toEqual(['Bitte wählen', 'Jahrgang 2026', 'Jahrgang 2027']);
    expect(within(dialog).getByText(/Benutzername und Passwort werden automatisch generiert\./)).toBeInTheDocument();
    expect(fenster(KonfiModal)).toHaveLength(0);
  });

  it('ohne Name oder Jahrgang: ein Satz, was fehlt -- nichts geht an den Server', async () => {
    const dialog = anlegenOeffnen();
    await absenden(dialog, 'Anlegen');
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Bitte einen Namen eingeben.');
    tippen(within(dialog).getByLabelText('Name'), 'Kim Test');
    expect(within(dialog).queryByRole('alert')).toBeNull();
    await absenden(dialog, 'Anlegen');
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Bitte einen Jahrgang wählen.');
    expect(h.apiPost).not.toHaveBeenCalled();
  });

  it('Anlegen schickt denselben Rumpf an dieselbe Route wie das Modal der App', async () => {
    const dialog = anlegenOeffnen();
    ausfuellen(dialog, '  Kim Test  ');
    await absenden(dialog, 'Anlegen');
    const web = h.apiPost.mock.calls[0];
    expect(web).toEqual(['/admin/konfis', { name: 'Kim Test', jahrgang_id: 12, client_id: 'kennung-1' }]);
    cleanup();

    // Dieselben Eingaben im echten Modal der App (schmal).
    h.breit = false;
    render(<AdminKonfisPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Neuen Konfi anlegen' }));
    const app = fenster(KonfiModal)[0];
    render(React.createElement(app.komponente as React.FC<Record<string, unknown>>, app.props));
    tippen(screen.getByRole('textbox', { name: 'Name' }), '  Kim Test  ');
    fireEvent.click(screen.getAllByText('Jahrgang 2026').map((t) => t.closest('[role="button"]')).find(Boolean)!);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Konfi speichern' })); });
    await warten();
    const [url, koerper] = h.apiPost.mock.calls[1];
    expect(url).toBe(web[0]);
    // Dieselben Felder; die Kennung ist je Fenster eine eigene.
    expect({ ...koerper, client_id: undefined }).toEqual({ ...web[1], client_id: undefined });
    expect(koerper.client_id).toMatch(/^kennung-\d+$/);
  });

  it('nach dem Anlegen: Einmalpasswort mit Benutzername im Fenster, Kopieren, Liste neu geladen, Fertig schließt', async () => {
    const dialog = anlegenOeffnen();
    ausfuellen(dialog);
    await absenden(dialog, 'Anlegen');
    const ergebnis = screen.getByRole('dialog', { name: 'Einmalpasswort' });
    expect(ergebnis).toHaveAccessibleDescription('Konfi "Kim Test" erstellt. Kopiere das Passwort und gib es dem Konfi weiter.');
    expect(within(ergebnis).getByText('kim.test')).toBeInTheDocument();
    expect(within(ergebnis).getByText(EINMAL)).toBeInTheDocument();
    expect(h.refresh).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(within(ergebnis).getByRole('button', { name: 'Passwort kopieren' }));

    await act(async () => { fireEvent.click(within(ergebnis).getByRole('button', { name: 'Passwort kopieren' })); });
    expect(h.kopieren).toHaveBeenCalledWith(EINMAL);
    expect(within(ergebnis).getByText('Passwort kopiert.').closest('[role="status"]')).not.toBeNull();

    fireEvent.click(within(ergebnis).getByRole('button', { name: 'Fertig' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    // Die App-Rückfrage mit dem Passwort kommt im Browser nicht.
    expect(h.stand.alert).toBeNull();
    expect(h.setError).not.toHaveBeenCalled();
  });

  it('Name vergeben (409): die Meldung steht im Fenster, der Dialog bleibt offen, oben erscheint nichts', async () => {
    h.apiPost.mockRejectedValueOnce(antwortFehler(409, { error: 'Benutzername existiert bereits' }));
    const dialog = anlegenOeffnen();
    ausfuellen(dialog);
    await absenden(dialog, 'Anlegen');
    expect(screen.getByRole('dialog', { name: 'Konfi anlegen' })).toBe(dialog);
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Ein Konfi mit diesem Namen existiert bereits.');
    expect(within(dialog).getByLabelText('Name')).toBeEnabled();
    expect(h.setError).not.toHaveBeenCalled();
    expect(h.stand.alert).toBeNull();
    expect(h.refresh).not.toHaveBeenCalled();
  });

  it('abgelehnt (400): der Text des Servers im Fenster', async () => {
    h.apiPost.mockRejectedValueOnce(antwortFehler(400, { error: 'Name und Jahrgang sind erforderlich' }));
    const dialog = anlegenOeffnen();
    ausfuellen(dialog);
    await absenden(dialog, 'Anlegen');
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Name und Jahrgang sind erforderlich');
    expect(within(dialog).getByRole('button', { name: 'Anlegen' })).toBeEnabled();
    expect(h.setError).not.toHaveBeenCalled();
  });

  it('Konfi-Limit (409 limit_grace): Rückfrage im Fenster, Felder gesperrt; „Trotzdem anlegen" schickt confirm mit derselben Kennung', async () => {
    h.apiPost.mockRejectedValueOnce(antwortFehler(409, { error: 'Tarif ausgeschöpft', error_code: 'limit_grace', count: 10, limit: 10, next_tier: 30 }));
    const dialog = anlegenOeffnen();
    ausfuellen(dialog);
    await absenden(dialog, 'Anlegen');
    const meldung = within(dialog).getByRole('alert');
    expect(meldung).toHaveTextContent('Konfi-Limit erreicht');
    expect(meldung).toHaveTextContent('Du hast 10 von 10 Konfis angelegt. Du kannst noch bis zu 5 weitere Konfis anlegen, danach ist ein Tarif-Upgrade nötig. Der nächste Tarif gibt dir Platz für bis zu 30 Konfis.');
    expect(within(dialog).getByLabelText('Name')).toBeDisabled();
    expect(within(dialog).getByRole('combobox', { name: 'Jahrgang' })).toBeDisabled();
    expect(within(dialog).queryByRole('button', { name: 'Anlegen' })).toBeNull();

    await absenden(dialog, 'Trotzdem anlegen');
    expect(h.apiPost.mock.calls).toEqual([
      ['/admin/konfis', { name: 'Kim Test', jahrgang_id: 12, client_id: 'kennung-1' }],
      ['/admin/konfis', { name: 'Kim Test', jahrgang_id: 12, client_id: 'kennung-1', confirm: true }],
    ]);
    expect(screen.getByRole('dialog', { name: 'Einmalpasswort' })).toBeInTheDocument();
  });

  it('keine Antwort: „Erneut versuchen" im Fenster mit derselben Kennung -- auch nach „Trotzdem anlegen" mit confirm', async () => {
    h.apiPost
      .mockRejectedValueOnce(antwortFehler(409, { error_code: 'limit_grace', count: 10, limit: 10 }))
      .mockRejectedValueOnce(KEIN_NETZ);
    const dialog = anlegenOeffnen();
    ausfuellen(dialog);
    await absenden(dialog, 'Anlegen');
    await absenden(dialog, 'Trotzdem anlegen');
    const meldung = within(dialog).getByRole('alert');
    expect(meldung).toHaveTextContent('Keine Antwort vom Server');
    expect(meldung).toHaveTextContent('Ob "Kim Test" angelegt wurde, ist unklar. Ein neuer Versuch legt kein zweites Konto an.');
    expect(within(dialog).getByLabelText('Name')).toBeDisabled();

    await absenden(dialog, 'Erneut versuchen');
    expect(h.apiPost.mock.calls.map(([, k]) => k)).toEqual([
      { name: 'Kim Test', jahrgang_id: 12, client_id: 'kennung-1' },
      { name: 'Kim Test', jahrgang_id: 12, client_id: 'kennung-1', confirm: true },
      { name: 'Kim Test', jahrgang_id: 12, client_id: 'kennung-1', confirm: true },
    ]);
    expect(screen.getByRole('dialog', { name: 'Einmalpasswort' })).toBeInTheDocument();
    expect(h.stand.alert).toBeNull();
  });

  it('Tarif-Grenze (403 limit_exceeded): Hinweis im Fenster, kein „Trotzdem"', async () => {
    h.apiPost.mockRejectedValueOnce(antwortFehler(403, { error_code: 'limit_exceeded', count: 15, limit: 10 }));
    const dialog = anlegenOeffnen();
    ausfuellen(dialog);
    await absenden(dialog, 'Anlegen');
    const meldung = within(dialog).getByRole('alert');
    expect(meldung).toHaveTextContent('Tarif-Upgrade nötig');
    expect(meldung).toHaveTextContent('Das Konfi-Limit ist ausgeschöpft. Um weitere Konfis anzulegen, ist ein Tarif-Upgrade nötig. Bitte wende dich an den Support für ein passendes Angebot.');
    expect(within(dialog).queryByRole('button', { name: 'Trotzdem anlegen' })).toBeNull();
    expect(within(dialog).getByLabelText('Name')).toBeEnabled();
  });

  it('während des Anlegens schließt nichts den Dialog', async () => {
    let antworten: (v: unknown) => void = () => undefined;
    h.apiPost.mockImplementationOnce(() => new Promise((ja) => { antworten = ja; }));
    const dialog = anlegenOeffnen();
    ausfuellen(dialog);
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Anlegen' })); });
    expect(within(dialog).getByRole('button', { name: 'Schließen' })).toBeDisabled();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.getByRole('dialog', { name: 'Konfi anlegen' })).toBeInTheDocument();
    await act(async () => { antworten(ANGELEGT); });
    await warten();
    expect(screen.getByRole('dialog', { name: 'Einmalpasswort' })).toBeInTheDocument();
  });

  it('offline: Hinweis im Fenster, Anlegen gesperrt', () => {
    h.online = false;
    const dialog = anlegenOeffnen();
    expect(within(dialog).getByText('Du bist offline. Speichern geht erst wieder mit Internetverbindung.')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Anlegen' })).toBeDisabled();
  });

  it('Abbrechen und Escape schließen ohne Anfrage', () => {
    let dialog = anlegenOeffnen();
    ausfuellen(dialog);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Abbrechen' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Konfi anlegen' }));
    dialog = screen.getByRole('dialog', { name: 'Konfi anlegen' });
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(h.apiPost).not.toHaveBeenCalled();
  });

  it('schmal: das Plus öffnet weiter das Modal der App, kein Dialog', () => {
    h.breit = false;
    render(<AdminKonfisPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Neuen Konfi anlegen' }));
    expect(fenster(KonfiModal)).toHaveLength(1);
    expect(fenster(KonfiModal)[0].props).toEqual(expect.objectContaining({ jahrgaenge: JAHRGAENGE }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('Anwesenheit im Browser: eigener, breiter Dialog', () => {
  const oeffnen = async () => {
    render(<AdminKonfisPage />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Anwesenheit' })); });
    await warten();
    return screen.getByRole('dialog', { name: 'Anwesenheit' });
  };
  const tabelle = (dialog: HTMLElement) => within(dialog).getByRole('table');
  /** Name, Zellen in Worten, Summe -- je Zeile. */
  const zeilen = (dialog: HTMLElement) => within(tabelle(dialog)).getAllByRole('row').slice(1).map((z) => [
    within(z).getByRole('rowheader').textContent,
    ...within(z).getAllByRole('cell').map((c) => c.textContent),
  ]);

  it('breites Fenster, erster Jahrgang geladen, Fokus in der Suche; kein App-Fenster', async () => {
    const dialog = await oeffnen();
    expect(dialog).toHaveClass('web-dialog--weit');
    expect(h.apiGet).toHaveBeenCalledWith('/admin/jahrgaenge/12/attendance-matrix');
    expect(document.activeElement).toBe(within(dialog).getByRole('searchbox', { name: 'Konfi suchen' }));
    expect((within(dialog).getByRole('combobox', { name: 'Jahrgang' }) as HTMLSelectElement).value).toBe('12');
    expect(fenster(AttendanceMatrixModal)).toHaveLength(0);
  });

  it('die Matrix: Datum und Event im Kopf, je Zelle der Stand in Worten (mit Grund), Summe ohne Abmeldungen wie in der App', async () => {
    const dialog = await oeffnen();
    expect(within(dialog).getByText('2 Pflicht-Events · 2 Konfis')).toBeInTheDocument();
    expect(within(tabelle(dialog)).getAllByRole('columnheader').map((c) => c.textContent)).toEqual([
      'Konfi', '04.10.Gottesdienst Erntedank', '10.10.Konfi-Samstag', 'ΣAnwesend von den Pflicht-Events ohne Abmeldungen',
    ]);
    expect(zeilen(dialog)).toEqual([
      ['Anna Müller', 'Anwesend', 'Abgemeldet (nachgetragen): krank', '1/1'],
      ['Ben Schmidt', 'Fehlt', 'Offen', '0/2'],
    ]);
    // Die Tabelle rollt im Fenster und ist dafür mit der Tastatur erreichbar.
    const huelle = within(dialog).getByRole('region', { name: 'Anwesenheit Jahrgang 2026' });
    expect(huelle).toHaveAttribute('tabindex', '0');
    expect(within(dialog).getByRole('list', { name: 'Legende' })).toHaveTextContent('AnwesendFehltAbgemeldetAbgemeldet (nachgetragen)Offen');
  });

  it('Suche filtert die Zeilen; ohne Treffer ein Satz statt einer leeren Tabelle', async () => {
    const dialog = await oeffnen();
    tippen(within(dialog).getByRole('searchbox', { name: 'Konfi suchen' }), 'ben.sch');
    expect(zeilen(dialog).map(([name]) => name)).toEqual(['Ben Schmidt']);
    tippen(within(dialog).getByRole('searchbox', { name: 'Konfi suchen' }), 'Zora');
    expect(within(dialog).queryByRole('table')).toBeNull();
    expect(within(dialog).getByText('Keine Konfi passt zu „Zora“.')).toBeInTheDocument();
  });

  it('ein anderer Jahrgang lädt dessen Matrix', async () => {
    const dialog = await oeffnen();
    await act(async () => { tippen(within(dialog).getByRole('combobox', { name: 'Jahrgang' }), '13'); });
    await warten();
    expect(h.apiGet).toHaveBeenCalledWith('/admin/jahrgaenge/13/attendance-matrix');
    expect(zeilen(dialog)).toEqual([['Cleo Neu', 'Offen', '0/1']]);
  });

  it('Konfispruch: lädt die Sprüche, Titel und Tabelle wechseln', async () => {
    const dialog = await oeffnen();
    await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Konfispruch' })); });
    await warten();
    expect(h.apiGet).toHaveBeenCalledWith('/admin/jahrgaenge/12/sprueche');
    const sprueche = screen.getByRole('dialog', { name: 'Konfisprüche' });
    expect(within(sprueche).getByRole('button', { name: 'Konfispruch' })).toHaveAttribute('aria-pressed', 'true');
    expect(zeilen(sprueche)).toEqual([
      ['Anna Müller', '16.05.2027, 11:30 Uhr', 'Psalm 23,1', 'Der Herr ist mein Hirte.'],
      ['Ben Schmidt', 'nicht gebucht', '–', 'noch keiner'],
    ]);
  });

  it('per E-Mail: dieselbe Route wie die App, die Bestätigung steht im Fenster', async () => {
    h.apiPost.mockResolvedValueOnce({ data: {} });
    const dialog = await oeffnen();
    await absenden(dialog, 'Per E-Mail an dich senden');
    expect(h.apiPost).toHaveBeenCalledWith('/admin/jahrgaenge/12/matrix-email', { type: 'anwesenheit' });
    expect(within(dialog).getByText('E-Mail an deine Adresse gesendet').closest('[role="status"]')).not.toBeNull();
    expect(h.setSuccess).not.toHaveBeenCalled();
  });

  it('Fehler beim Laden und beim Senden stehen im Fenster, nicht oben', async () => {
    h.apiGet.mockImplementation(async () => { throw antwortFehler(500, {}); });
    const dialog = await oeffnen();
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Fehler beim Laden der Anwesenheit');
    expect(within(dialog).getByText('Keine Daten')).toBeInTheDocument();
    h.apiPost.mockRejectedValueOnce(antwortFehler(500, { error: 'Mailserver nicht erreichbar' }));
    await absenden(dialog, 'Per E-Mail an dich senden');
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Mailserver nicht erreichbar');
    expect(h.setError).not.toHaveBeenCalled();
  });

  // Gegenprüfung 13.10.2026: Escape im gefüllten Suchfeld leert nur das Feld
  // (WebSuche). Das Ereignis lief weiter bis zum Fenster und schloss es samt
  // gewähltem Jahrgang und Ansicht.
  it('Escape in der gefüllten Suche leert nur das Feld; erst das nächste Escape schließt das Fenster', async () => {
    const dialog = await oeffnen();
    const suche = within(dialog).getByRole('searchbox', { name: 'Konfi suchen' });
    tippen(suche, 'ben');
    expect(zeilen(dialog).map(([name]) => name)).toEqual(['Ben Schmidt']);
    fireEvent.keyDown(suche, { key: 'Escape' });
    expect(screen.getByRole('dialog', { name: 'Anwesenheit' })).toBe(dialog);
    expect(suche).toHaveValue('');
    expect(zeilen(dialog).map(([name]) => name)).toEqual(['Anna Müller', 'Ben Schmidt']);
    fireEvent.keyDown(suche, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Tastatur wie bei den anderen Dialogen: Tab bleibt im Fenster, Escape schließt', async () => {
    const dialog = await oeffnen();
    const schliessen = within(dialog).getAllByRole('button', { name: 'Schließen' });
    // Der letzte Knopf ist „Schließen" unten; Tab springt von dort an den Anfang.
    const letzter = schliessen[schliessen.length - 1];
    letzter.focus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(document.activeElement).toBe(within(dialog).getAllByRole('button', { name: 'Schließen' })[0]);
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('schmal: der Knopf öffnet weiter das Modal der App, kein Dialog', () => {
    h.breit = false;
    render(<AdminKonfisPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Anwesenheit und Konfisprüche anzeigen' }));
    expect(fenster(AttendanceMatrixModal)).toHaveLength(1);
    expect(fenster(AttendanceMatrixModal)[0].props).toEqual(expect.objectContaining({ jahrgaenge: JAHRGAENGE }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
