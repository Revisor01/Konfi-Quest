// Das Postfach hinter der Glocke -- das Modal der App (common/PostfachModal)
// und der Dialog der Web-Fassung (common/web/WebPostfachDialog) im Vergleich
// (Simon, 15.10.2026: im Browser ab 992 px bekommt jedes Fenster, das noch ein
// App-Modal oeffnet, ein kompaktes Web-Fenster; in den Apps bleibt das Modal).
//
// Beide lesen denselben Hook (usePostfach). Jeder Ablauf laeuft hier deshalb
// zweimal, einmal je Fassung, mit denselben Erwartungen: dieselben Eintraege,
// dieselben Routen beim Lesen und Gelesen-Markieren, dasselbe Ziel beim Klick
// (wie ein angetippter Push, bei Bedarf erst in die Gemeinde der Mitteilung),
// dieselben Meldungen an die Zaehler der Glocke, dasselbe Wegwischen in der
// Warteschlange. Was sich unterscheidet, steht ausdruecklich da: Nur der
// Dialog des Browsers sperrt sich, solange nach einem Klick noch die Gemeinde
// gewechselt wird.
//
// Geoeffnet wird jedes Mal wie in der App: <PostfachModal /> haengt auf
// App-Ebene, die Glocke sagt "auf" (oeffnePostfach). Ersetzt sind Netz,
// Kontexte, die Warteschlange und die Ionic-Bausteine der App (schlichte
// HTML-Nachbauten); welches Layout gilt, sagt h.breit.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, within, waitFor, cleanup, act } from '@testing-library/react';
import type { QueueItem, FailedAction } from '../../services/writeQueue';
import type { PostfachAntwort, PostfachEintrag } from '../../utils/postfach';

const h = vi.hoisted(() => ({
  breit: false,
  apiGet: vi.fn(),
  apiPut: vi.fn(),
  switchOrg: vi.fn(),
  refreshAllCounts: vi.fn(),
  postfachGelesen: vi.fn(),
  vergessen: vi.fn(),
  alleVergessen: vi.fn(),
  wartend: [] as unknown[],
  gescheitert: [] as unknown[],
  organizations: [] as Array<{ id: number; name: string; role_name: string }>,
}));

type Kinder = { children?: React.ReactNode };

vi.mock('@ionic/react', () => {
  const durch = ({ children }: Kinder) => <div>{children}</div>;
  return {
    // Das Modal der App: sichtbar als data-testid, ohne eigene Rolle -- so
    // ist ein role="dialog" im Baum immer der Dialog des Browsers.
    IonModal: ({ children, isOpen }: Kinder & { isOpen?: boolean }) => (isOpen ? <div data-testid="ion-modal">{children}</div> : null),
    IonHeader: durch, IonToolbar: durch, IonButtons: durch, IonContent: durch,
    IonList: durch, IonListHeader: durch, IonCard: durch, IonCardContent: durch,
    IonTitle: ({ children, id }: Kinder & { id?: string }) => <h1 id={id}>{children}</h1>,
    IonLabel: ({ children }: Kinder) => <span>{children}</span>,
    IonIcon: () => null,
    IonSpinner: () => <span role="progressbar" />,
    IonButton: ({ children, onClick, disabled, 'aria-label': name }: Kinder & { onClick?: () => void; disabled?: boolean; 'aria-label'?: string }) => (
      <button type="button" aria-label={name} onClick={onClick} disabled={disabled}>{children}</button>
    ),
  };
});
vi.mock('../../navigation/breitesLayout', () => ({ useBreitesLayout: () => h.breit }));
vi.mock('../../services/api', () => ({
  default: { get: (...a: unknown[]) => h.apiGet(...a), put: (...a: unknown[]) => h.apiPut(...a) },
}));
vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({
    user: { id: 7, type: 'konfi', organization_id: 1 },
    activeOrgId: null,
    organizations: h.organizations,
    switchOrg: h.switchOrg,
  }),
}));
vi.mock('../../contexts/BadgeContext', () => ({
  useBadge: () => ({ postfachUngelesen: 0, refreshAllCounts: h.refreshAllCounts, postfachGelesen: h.postfachGelesen }),
}));
vi.mock('../../hooks/useWartendeVorgaenge', () => ({
  useWartendeVorgaenge: () => ({ wartend: h.wartend, gescheitert: h.gescheitert, vergessen: h.vergessen, alleVergessen: h.alleVergessen }),
}));
vi.mock('../../utils/pushNavigation', async (original) => {
  const echt = await original<typeof import('../../utils/pushNavigation')>();
  return { ...echt, pushZielMelden: vi.fn() };
});

import PostfachModal, { POSTFACH_SEITENGROESSE } from '../../components/common/PostfachModal';
import { POSTFACH_LEER, POSTFACH_UNGELESEN_TEXT } from '../../components/common/usePostfach';
import { oeffnePostfach } from '../../utils/postfach';
import { pushZielMelden } from '../../utils/pushNavigation';

// --- Daten (Antwortform wie GET /notifications/postfach) -------------------------------
const eintrag = (id: number, teil: Partial<PostfachEintrag> = {}): PostfachEintrag => ({
  id,
  title: `Mitteilung ${id}`,
  message: `Text ${id}`,
  type: 'badge_earned',
  data: { badge_id: id },
  read_at: null,
  created_at: '2026-01-05T08:00:00.000Z',
  organization_id: 1,
  organization_name: 'Test-Gemeinde',
  ...teil,
});

const antwort = (eintraege: PostfachEintrag[], weitere = false): { data: PostfachAntwort } => ({
  data: { eintraege, ungelesen: eintraege.filter((e) => !e.read_at).length, weitere },
});

const GELESEN = '2026-01-04T10:00:00.000Z';

beforeEach(() => {
  vi.clearAllMocks();
  h.breit = false;
  h.wartend = [];
  h.gescheitert = [];
  h.organizations = [{ id: 1, name: 'Test-Gemeinde', role_name: 'konfi' }];
  h.apiPut.mockResolvedValue({ data: { success: true } });
  h.switchOrg.mockResolvedValue({ ok: true, type: 'konfi' });
  h.refreshAllCounts.mockResolvedValue(undefined);
  h.vergessen.mockResolvedValue(undefined);
  h.alleVergessen.mockResolvedValue(undefined);
});
afterEach(() => cleanup());

// --- Bedienung je Fassung ----------------------------------------------------------------
type Fassung = 'app' | 'web';

/** Das offene Postfach: in der App das Modal, im Browser der Dialog „Postfach". */
const postfach = (fassung: Fassung): HTMLElement | null => (fassung === 'app'
  ? screen.queryByTestId('ion-modal')
  : screen.queryByRole('dialog', { name: 'Postfach' }));

const oeffnen = async (fassung: Fassung) => {
  h.breit = fassung === 'web';
  render(<PostfachModal />);
  await act(async () => { oeffnePostfach(); });
  await waitFor(() => expect(postfach(fassung)).not.toBeNull());
  await waitFor(() => expect(h.apiGet).toHaveBeenCalled());
};

/** Die Zeile einer Mitteilung -- in beiden Fassungen ein Knopf. */
const zeile = (titel: string): HTMLElement => {
  const ziel = screen.getByText(titel).closest('button, [role="button"]');
  expect(ziel, titel).not.toBeNull();
  return ziel as HTMLElement;
};

/** Titel der Mitteilungen in Anzeigereihenfolge. */
const titel = (): string[] => screen.queryAllByText(/^Mitteilung \d+$/).map((el) => el.textContent ?? '');

const ungelesen = (titelText: string): boolean =>
  within(zeile(titelText)).queryByRole('img', { name: POSTFACH_UNGELESEN_TEXT }) !== null;

const wartendEintrag = (label: string): QueueItem => ({
  id: `q-${label}`, method: 'POST', url: '/x', maxRetries: 3, retryCount: 0, createdAt: 0, hasFileUpload: false,
  metadata: { type: 'request', clientId: `q-${label}`, label },
});
const gescheitertEintrag = (id: string, label: string, message = 'Konflikt'): FailedAction => ({
  id, label, type: 'opt-out', createdAt: 0, failedAt: 0, error: { status: 409, message },
});

// --- Welches Fenster ---------------------------------------------------------------------
describe('Postfach: Browser ab 992 px ein Web-Dialog, sonst das Modal der App', () => {
  it('breites Layout: die Glocke oeffnet den Dialog „Postfach", nicht das Ionic-Modal', async () => {
    h.apiGet.mockResolvedValue(antwort([eintrag(1)]));
    await oeffnen('web');
    expect(screen.getByRole('dialog', { name: 'Postfach' })).toBeInTheDocument();
    expect(screen.queryByTestId('ion-modal')).not.toBeInTheDocument();
    expect(await screen.findByText('Mitteilung 1')).toBeInTheDocument();
  });

  it('App und schmales Fenster: die Glocke oeffnet das Modal der App, keinen Web-Dialog', async () => {
    h.apiGet.mockResolvedValue(antwort([eintrag(1)]));
    await oeffnen('app');
    expect(screen.getByTestId('ion-modal')).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(await screen.findByText('Mitteilung 1')).toBeInTheDocument();
  });

  it('vor dem Klick auf die Glocke steht kein Fenster und nichts wird geladen -- in beiden Layouts', () => {
    h.apiGet.mockResolvedValue(antwort([]));
    h.breit = true;
    const { unmount } = render(<PostfachModal />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    unmount();
    h.breit = false;
    render(<PostfachModal />);
    expect(screen.queryByTestId('ion-modal')).not.toBeInTheDocument();
    expect(h.apiGet).not.toHaveBeenCalled();
  });
});

// --- Ablaeufe, je Fassung -----------------------------------------------------------------
describe.each<Fassung>(['app', 'web'])('Postfach (%s): dieselbe Logik in App und Browser', (fassung) => {
  it('laedt beim Oeffnen GET /notifications/postfach mit der Seitengroesse und zeigt die Eintraege in Serverreihenfolge', async () => {
    h.apiGet.mockResolvedValue(antwort([eintrag(12), eintrag(11, { read_at: GELESEN }), eintrag(10)]));
    await oeffnen(fassung);
    await screen.findByText('Mitteilung 12');
    expect(h.apiGet.mock.calls).toEqual([['/notifications/postfach', { params: { limit: POSTFACH_SEITENGROESSE } }]]);
    expect(titel()).toEqual(['Mitteilung 12', 'Mitteilung 11', 'Mitteilung 10']);
    expect(screen.getByText('Text 12')).toBeInTheDocument();
    expect(ungelesen('Mitteilung 12')).toBe(true);
    expect(ungelesen('Mitteilung 11')).toBe(false);
    expect(ungelesen('Mitteilung 10')).toBe(true);
    // Eine Gemeinde: kein Gemeindename an der Mitteilung, das Datum steht da.
    expect(screen.queryByText('Test-Gemeinde')).not.toBeInTheDocument();
    expect(within(zeile('Mitteilung 12')).getByText('05.01.2026')).toBeInTheDocument();
  });

  it('Klick auf eine ungelesene Mitteilung: PUT …/:id/gelesen, Glocke sofort -1, Zaehler neu, Ziel wie beim Push, Fenster zu', async () => {
    h.apiGet.mockResolvedValue(antwort([eintrag(12), eintrag(11)]));
    await oeffnen(fassung);
    await act(async () => { fireEvent.click(zeile('Mitteilung 12')); });

    await waitFor(() => expect(pushZielMelden).toHaveBeenCalledWith('/konfi/badges', 'inApp'));
    expect(h.apiPut.mock.calls).toEqual([['/notifications/postfach/12/gelesen']]);
    expect(h.postfachGelesen.mock.calls).toEqual([[1]]);
    await waitFor(() => expect(h.refreshAllCounts).toHaveBeenCalledTimes(1));
    expect(h.switchOrg).not.toHaveBeenCalled();
    expect(postfach(fassung)).toBeNull();
  });

  it('eine gelesene Mitteilung meldet nichts an Server und Glocke, fuehrt aber zum Ziel (Antrag -> Antragsliste)', async () => {
    h.apiGet.mockResolvedValue(antwort([eintrag(5, { type: 'activity_request_decision', data: { request_id: 8, status: 'approved' }, read_at: GELESEN })]));
    await oeffnen(fassung);
    await act(async () => { fireEvent.click(zeile('Mitteilung 5')); });
    await waitFor(() => expect(pushZielMelden).toHaveBeenCalledWith('/konfi/requests', 'inApp'));
    expect(h.apiPut).not.toHaveBeenCalled();
    expect(h.postfachGelesen).not.toHaveBeenCalled();
  });

  it('eine Mitteilung aus einer anderen Gemeinde: erst switchOrg, dann das Ziel mit der Rolle DORT; der Gemeindename steht an der Mitteilung', async () => {
    h.organizations = [
      { id: 1, name: 'Test-Gemeinde', role_name: 'konfi' },
      { id: 2, name: 'Andere Gemeinde', role_name: 'teamer' },
    ];
    h.switchOrg.mockResolvedValue({ ok: true, type: 'teamer' });
    h.apiGet.mockResolvedValue(antwort([eintrag(20, { organization_id: 2, organization_name: 'Andere Gemeinde' })]));
    await oeffnen(fassung);
    expect(within(zeile('Mitteilung 20')).getByText('Andere Gemeinde')).toBeInTheDocument();
    await act(async () => { fireEvent.click(zeile('Mitteilung 20')); });
    await waitFor(() => expect(pushZielMelden).toHaveBeenCalledWith('/teamer/badges', 'inApp'));
    expect(h.switchOrg.mock.calls).toEqual([[2]]);
  });

  it('eine unbekannte Art: als gelesen markiert, Fenster zu, kein Sprung', async () => {
    const warnung = vi.spyOn(console, 'warn').mockImplementation(() => {});
    h.apiGet.mockResolvedValue(antwort([eintrag(3, { type: 'gibt_es_noch_nicht', data: {} })]));
    await oeffnen(fassung);
    await act(async () => { fireEvent.click(zeile('Mitteilung 3')); });
    await waitFor(() => expect(postfach(fassung)).toBeNull());
    expect(h.apiPut.mock.calls).toEqual([['/notifications/postfach/3/gelesen']]);
    expect(pushZielMelden).not.toHaveBeenCalled();
    expect(warnung).toHaveBeenCalledWith('Unbekannter Notification-Typ:', 'gibt_es_noch_nicht');
    warnung.mockRestore();
  });

  it('„Alle gelesen": einmal PUT /notifications/postfach/gelesen, Glocke auf 0, Zaehler neu, kein Punkt mehr, Knopf weg', async () => {
    h.apiGet.mockResolvedValue(antwort([eintrag(2), eintrag(1)]));
    await oeffnen(fassung);
    await screen.findByText('Mitteilung 2');
    expect(ungelesen('Mitteilung 2')).toBe(true);

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Alle gelesen' })); });
    expect(h.apiPut.mock.calls).toEqual([['/notifications/postfach/gelesen']]);
    expect(h.postfachGelesen.mock.calls).toEqual([['alle']]);
    await waitFor(() => expect(h.refreshAllCounts).toHaveBeenCalledTimes(1));
    expect(ungelesen('Mitteilung 2')).toBe(false);
    expect(ungelesen('Mitteilung 1')).toBe(false);
    expect(screen.queryByRole('button', { name: 'Alle gelesen' })).not.toBeInTheDocument();
    // Das Fenster bleibt offen.
    expect(postfach(fassung)).not.toBeNull();
  });

  it('ohne Ungelesenes steht kein „Alle gelesen"', async () => {
    h.apiGet.mockResolvedValue(antwort([eintrag(1, { read_at: GELESEN })]));
    await oeffnen(fassung);
    await screen.findByText('Mitteilung 1');
    expect(screen.queryByRole('button', { name: 'Alle gelesen' })).not.toBeInTheDocument();
  });

  it('„Ältere Mitteilungen laden" fragt mit der kleinsten bekannten Kennung als Cursor und haengt an', async () => {
    h.apiGet
      .mockResolvedValueOnce(antwort([eintrag(30), eintrag(29)], true))
      .mockResolvedValueOnce(antwort([eintrag(28)], false));
    await oeffnen(fassung);
    await screen.findByText('Mitteilung 29');

    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Ältere Mitteilungen laden' })); });
    await screen.findByText('Mitteilung 28');
    expect(h.apiGet.mock.calls).toEqual([
      ['/notifications/postfach', { params: { limit: POSTFACH_SEITENGROESSE } }],
      ['/notifications/postfach', { params: { limit: POSTFACH_SEITENGROESSE, vor: 29 } }],
    ]);
    expect(titel()).toEqual(['Mitteilung 30', 'Mitteilung 29', 'Mitteilung 28']);
    // Nichts Aelteres mehr: Knopf weg.
    expect(screen.queryByRole('button', { name: 'Ältere Mitteilungen laden' })).not.toBeInTheDocument();
  });

  it('ohne Mitteilungen derselbe Leerzustand', async () => {
    h.apiGet.mockResolvedValue(antwort([]));
    await oeffnen(fassung);
    expect(await screen.findByText(POSTFACH_LEER.titel)).toBeInTheDocument();
    expect(screen.getByText(POSTFACH_LEER.text)).toBeInTheDocument();
  });

  it('kommt die Liste nicht (offline), sagt das Fenster, was fehlt -- die Warteschlange bleibt sichtbar', async () => {
    h.gescheitert = [gescheitertEintrag('f1', 'Abmeldung Sommerfest')];
    h.apiGet.mockRejectedValue(new Error('Network Error'));
    await oeffnen(fassung);
    const hinweis = await screen.findByText('Deine Mitteilungen ist offline nicht verfügbar.');
    if (fassung === 'web') expect(screen.getByRole('alert')).toHaveTextContent('Deine Mitteilungen ist offline nicht verfügbar.');
    else expect(hinweis).toBeInTheDocument();
    expect(screen.getByText('Abmeldung Sommerfest')).toBeInTheDocument();
    expect(screen.queryByText(POSTFACH_LEER.titel)).not.toBeInTheDocument();
  });

  it('Warteschlange: Wartendes und Gescheitertes stehen da; Wegwischen einzeln und alle auf einmal', async () => {
    h.wartend = [wartendEintrag('Aktivität melden: Gottesdienst')];
    h.gescheitert = [
      gescheitertEintrag('f1', 'Abmeldung Sommerfest', 'Konflikt'),
      gescheitertEintrag('f2', 'Buchung Freizeit', 'Ausgebucht'),
    ];
    h.apiGet.mockResolvedValue(antwort([]));
    await oeffnen(fassung);
    const schlange = screen.getByRole('region', { name: 'Warteschlange' });
    expect(within(schlange).getByText('Aktivität melden: Gottesdienst')).toBeInTheDocument();
    expect(within(schlange).getByText('Ausgebucht')).toBeInTheDocument();

    fireEvent.click(within(schlange).getByRole('button', { name: 'Buchung Freizeit wegwischen' }));
    expect(h.vergessen.mock.calls).toEqual([['f2']]);
    fireEvent.click(within(schlange).getByRole('button', { name: 'Alle Fehlschläge wegwischen' }));
    expect(h.alleVergessen).toHaveBeenCalledTimes(1);
    // Wegwischen ist eine Sache des Geraets: nichts geht an den Server.
    expect(h.apiPut).not.toHaveBeenCalled();
  });

  it('ohne Warteschlange kein leerer Bereich; mit nur einem Fehlschlag kein „Alle wegwischen"', async () => {
    h.apiGet.mockResolvedValue(antwort([eintrag(1)]));
    await oeffnen(fassung);
    await screen.findByText('Mitteilung 1');
    expect(screen.queryByRole('region', { name: 'Warteschlange' })).not.toBeInTheDocument();
    cleanup();

    h.gescheitert = [gescheitertEintrag('f1', 'Abmeldung Sommerfest')];
    await oeffnen(fassung);
    expect(screen.getByRole('region', { name: 'Warteschlange' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Alle Fehlschläge wegwischen' })).not.toBeInTheDocument();
  });

  it('das Kreuz schliesst das Postfach, ohne etwas zu senden', async () => {
    h.apiGet.mockResolvedValue(antwort([eintrag(1)]));
    await oeffnen(fassung);
    await screen.findByText('Mitteilung 1');
    fireEvent.click(screen.getAllByRole('button', { name: 'Schließen' })[0]);
    await waitFor(() => expect(postfach(fassung)).toBeNull());
    expect(h.apiPut).not.toHaveBeenCalled();
    expect(pushZielMelden).not.toHaveBeenCalled();
  });
});

describe('Postfach: App und Browser schicken dasselbe', () => {
  /** Ein voller Durchgang: oeffnen, aeltere laden, eine Mitteilung lesen (andere Gemeinde). */
  const durchgang = async (fassung: Fassung) => {
    h.organizations = [
      { id: 1, name: 'Test-Gemeinde', role_name: 'konfi' },
      { id: 2, name: 'Andere Gemeinde', role_name: 'admin' },
    ];
    h.switchOrg.mockResolvedValue({ ok: true, type: 'admin' });
    h.apiGet
      .mockResolvedValueOnce(antwort([eintrag(9), eintrag(8, { read_at: GELESEN })], true))
      .mockResolvedValueOnce(antwort([eintrag(7, { type: 'new_activity_request', data: { request_id: 4 }, organization_id: 2, organization_name: 'Andere Gemeinde' })]));
    await oeffnen(fassung);
    await screen.findByText('Mitteilung 8');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Ältere Mitteilungen laden' })); });
    await screen.findByText('Mitteilung 7');
    await act(async () => { fireEvent.click(zeile('Mitteilung 7')); });
    await waitFor(() => expect(pushZielMelden).toHaveBeenCalledTimes(1));
    const gesendet = {
      get: [...h.apiGet.mock.calls],
      put: [...h.apiPut.mock.calls],
      org: [...h.switchOrg.mock.calls],
      glocke: [...h.postfachGelesen.mock.calls],
      ziel: [...vi.mocked(pushZielMelden).mock.calls],
    };
    cleanup();
    vi.clearAllMocks();
    h.apiPut.mockResolvedValue({ data: { success: true } });
    h.refreshAllCounts.mockResolvedValue(undefined);
    return gesendet;
  };

  it('derselbe Durchgang ergibt in beiden Fassungen dieselben Aufrufe und dasselbe Ziel', async () => {
    const app = await durchgang('app');
    const web = await durchgang('web');
    expect(app).toEqual({
      get: [
        ['/notifications/postfach', { params: { limit: POSTFACH_SEITENGROESSE } }],
        ['/notifications/postfach', { params: { limit: POSTFACH_SEITENGROESSE, vor: 8 } }],
      ],
      put: [['/notifications/postfach/7/gelesen']],
      org: [[2]],
      glocke: [[1]],
      ziel: [['/admin/requests', 'inApp']],
    });
    expect(web).toEqual(app);
  });
});

// --- Nur der Browser: solange nach einem Klick die Gemeinde gewechselt wird, bleibt der Dialog --
describe('Postfach (web): waehrend des Gemeinde-Wechsels ist der Dialog gesperrt', () => {
  it('X, Schließen, Escape und Klick daneben schliessen nicht; danach Ziel und Fenster zu', async () => {
    h.organizations = [
      { id: 1, name: 'Test-Gemeinde', role_name: 'konfi' },
      { id: 2, name: 'Andere Gemeinde', role_name: 'teamer' },
    ];
    const wechsel: { fertig: (wert: unknown) => void } = { fertig: () => undefined };
    h.switchOrg.mockReturnValue(new Promise((ok) => { wechsel.fertig = ok; }));
    h.apiGet.mockResolvedValue(antwort([eintrag(20, { organization_id: 2, organization_name: 'Andere Gemeinde' }), eintrag(19)]));
    await oeffnen('web');
    await act(async () => { fireEvent.click(zeile('Mitteilung 20')); });
    expect(h.switchOrg).toHaveBeenCalledWith(2);

    const dialog = screen.getByRole('dialog', { name: 'Postfach' });
    const knoepfe = within(dialog).getAllByRole('button', { name: 'Schließen' });
    for (const knopf of knoepfe) expect(knopf).toBeDisabled();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    fireEvent.mouseDown(dialog.parentElement as HTMLElement);
    // Kein zweiter Klick auf eine andere Mitteilung.
    expect(zeile('Mitteilung 19')).toBeDisabled();
    expect(screen.getByRole('dialog', { name: 'Postfach' })).toBeInTheDocument();
    expect(pushZielMelden).not.toHaveBeenCalled();

    await act(async () => { wechsel.fertig({ ok: true, type: 'teamer' }); });
    await waitFor(() => expect(pushZielMelden).toHaveBeenCalledWith('/teamer/badges', 'inApp'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('ohne laufenden Wechsel schliessen Escape und ein Klick daneben den Dialog', async () => {
    h.apiGet.mockResolvedValue(antwort([eintrag(1)]));
    await oeffnen('web');
    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Postfach' }), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    await act(async () => { oeffnePostfach(); });
    const dialog = await screen.findByRole('dialog', { name: 'Postfach' });
    fireEvent.mouseDown(dialog.parentElement as HTMLElement);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
