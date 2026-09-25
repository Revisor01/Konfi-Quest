import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { QueueItem, FailedAction } from '../../services/writeQueue';
import type { PostfachAntwort, PostfachEintrag } from '../../utils/postfach';

// Das Postfach (25.09.2026): zwei Bereiche -- die Offline-Warteschlange und
// die empfangenen Mitteilungen aus GET /notifications/postfach. Antippen
// markiert als gelesen und fuehrt zum Ziel, ueber denselben Weg wie ein
// angetippter Push (utils/pushNavigation).

type StubProps = { children?: ReactNode };

vi.mock('@ionic/react', () => ({
  // presentingElement wird als Attribut sichtbar gemacht: Der Test prueft,
  // dass das Postfach auf iOS ein Element hat, hinter das es als Karte geht.
  IonModal: (props: StubProps & { isOpen?: boolean; presentingElement?: HTMLElement }) =>
    (props.isOpen
      ? <div data-testid="modal" data-presenting={props.presentingElement?.tagName?.toLowerCase() ?? ''}>{props.children}</div>
      : null),
  IonHeader: (props: StubProps) => <div>{props.children}</div>,
  IonToolbar: (props: StubProps) => <div>{props.children}</div>,
  IonTitle: (props: StubProps) => <div>{props.children}</div>,
  IonButtons: (props: StubProps) => <div>{props.children}</div>,
  IonButton: (props: StubProps & { onClick?: () => void; disabled?: boolean; className?: string; 'aria-label'?: string }) =>
    <button type="button" onClick={props.onClick} disabled={props.disabled} className={props.className} aria-label={props['aria-label']}>{props.children}</button>,
  IonContent: (props: StubProps) => <div>{props.children}</div>,
  IonList: (props: StubProps) => <div>{props.children}</div>,
  IonListHeader: (props: StubProps) => <div>{props.children}</div>,
  IonItem: (props: StubProps & { onClick?: () => void; className?: string; 'data-ungelesen'?: string }) => (
    <div role="button" onClick={props.onClick} className={props.className} data-ungelesen={props['data-ungelesen']}>
      {props.children}
    </div>
  ),
  IonLabel: (props: StubProps) => <div>{props.children}</div>,
  IonSpinner: () => <span data-testid="spinner" />,
  IonCard: (props: StubProps) => <div>{props.children}</div>,
  IonCardContent: (props: StubProps) => <div>{props.children}</div>,
  IonIcon: (props: { icon?: string }) => <span data-testid="icon" data-icon={props.icon} />,
}));

const mockGet = vi.fn();
const mockPut = vi.fn();
vi.mock('../../services/api', () => ({
  default: { get: (...a: unknown[]) => mockGet(...a), put: (...a: unknown[]) => mockPut(...a) },
}));

const mockSwitchOrg = vi.fn();
let mockOrganizations: Array<{ id: number; name: string; role_name: string }> = [];
vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({
    user: { id: 7, type: 'konfi', organization_id: 1 },
    activeOrgId: null,
    organizations: mockOrganizations,
    switchOrg: mockSwitchOrg,
  }),
}));

const mockRefresh = vi.fn();
vi.mock('../../contexts/BadgeContext', () => ({
  useBadge: () => ({ postfachUngelesen: 0, refreshAllCounts: mockRefresh }),
}));

let mockWartend: QueueItem[] = [];
let mockGescheitert: FailedAction[] = [];
vi.mock('../../hooks/useWartendeVorgaenge', () => ({
  useWartendeVorgaenge: () => ({
    wartend: mockWartend,
    gescheitert: mockGescheitert,
    vergessen: vi.fn(),
    alleVergessen: vi.fn(),
  }),
}));

vi.mock('../../utils/pushNavigation', async (original) => {
  const echt = await original<typeof import('../../utils/pushNavigation')>();
  return { ...echt, pushZielMelden: vi.fn() };
});

import PostfachModal, { POSTFACH_SEITENGROESSE } from '../../components/common/PostfachModal';
import { mitteilungsTitel, oeffnePostfach, postfachBereich } from '../../utils/postfach';
import { pushZielMelden } from '../../utils/pushNavigation';
import { getIconFromIoniconsName } from '../../utils/badgeIcons';
import {
  ICON_ABZEICHEN_GEFUELLT,
  ICON_ORGANISATION_GEFUELLT,
  ICON_SCHLIESSEN,
  ICON_TERMIN_GEFUELLT,
} from '../../components/shared/icons';

const eintrag = (id: number, teil: Partial<PostfachEintrag> = {}): PostfachEintrag => ({
  id,
  title: `Mitteilung ${id}`,
  message: `Text ${id}`,
  type: 'badge_earned',
  data: { badge_id: id },
  read_at: null,
  created_at: '2026-09-25T08:00:00.000Z',
  organization_id: 1,
  organization_name: 'Test-Gemeinde',
  ...teil,
});

const antwort = (eintraege: PostfachEintrag[], weitere = false): { data: PostfachAntwort } => ({
  data: { eintraege, ungelesen: eintraege.filter(e => !e.read_at).length, weitere },
});

const oeffnen = async () => {
  await act(async () => { oeffnePostfach(); });
  await screen.findByTestId('modal');
};

describe('PostfachModal', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPut.mockReset().mockResolvedValue({ data: { success: true } });
    mockSwitchOrg.mockReset().mockResolvedValue({ ok: true, type: 'konfi' });
    mockRefresh.mockReset().mockResolvedValue(undefined);
    vi.mocked(pushZielMelden).mockReset();
    mockWartend = [];
    mockGescheitert = [];
    mockOrganizations = [{ id: 1, name: 'Test-Gemeinde', role_name: 'konfi' }];
  });

  it('ist zu, bis jemand die Glocke tippt -- und laedt erst dann', async () => {
    mockGet.mockResolvedValue(antwort([]));
    render(<PostfachModal />);
    expect(screen.queryByTestId('modal')).toBeNull();
    expect(mockGet).not.toHaveBeenCalled();

    await oeffnen();
    expect(mockGet).toHaveBeenCalledTimes(1);
    expect(mockGet).toHaveBeenCalledWith('/notifications/postfach', { params: { limit: POSTFACH_SEITENGROESSE } });
  });

  it('zeigt beide Bereiche: Warteschlange und Mitteilungen', async () => {
    mockWartend = [{
      id: 'q1', method: 'POST', url: '/x', maxRetries: 3, retryCount: 0, createdAt: 0, hasFileUpload: false,
      metadata: { type: 'konfi', clientId: 'q1', label: 'Aktivität melden: Gottesdienst' },
    }];
    mockGet.mockResolvedValue(antwort([eintrag(12), eintrag(11, { read_at: '2026-09-24T10:00:00.000Z' })]));
    render(<PostfachModal />);
    await oeffnen();

    expect(screen.getByTestId('postfach-warteschlange')).toBeTruthy();
    expect(screen.getByText('Aktivität melden: Gottesdienst')).toBeTruthy();
    expect(await screen.findByText('Mitteilung 12')).toBeTruthy();
    expect(screen.getByText('Mitteilung 11')).toBeTruthy();
  });

  it('ohne Warteschlange fehlt der Bereich -- kein leerer Kasten', async () => {
    mockGet.mockResolvedValue(antwort([eintrag(1)]));
    render(<PostfachModal />);
    await oeffnen();
    await screen.findByText('Mitteilung 1');
    expect(screen.queryByTestId('postfach-warteschlange')).toBeNull();
  });

  it('ungelesene Mitteilungen sind erkennbar, gelesene nicht', async () => {
    mockGet.mockResolvedValue(antwort([eintrag(12), eintrag(11, { read_at: '2026-09-24T10:00:00.000Z' })]));
    const { container } = render(<PostfachModal />);
    await oeffnen();
    await screen.findByText('Mitteilung 12');

    const zeilen = container.querySelectorAll('.app-postfach-eintrag');
    expect(zeilen.length).toBe(2);
    expect(container.querySelectorAll('.app-postfach-eintrag--ungelesen').length).toBe(1);
    expect(zeilen[0].getAttribute('data-ungelesen')).toBe('true');
    expect(zeilen[1].getAttribute('data-ungelesen')).toBe('false');
  });

  it('Antippen markiert als gelesen und fuehrt zum Ziel der Rolle', async () => {
    mockGet.mockResolvedValue(antwort([eintrag(12)]));
    render(<PostfachModal />);
    await oeffnen();
    fireEvent.click(await screen.findByText('Mitteilung 12'));

    await waitFor(() => expect(mockPut).toHaveBeenCalledWith('/notifications/postfach/12/gelesen'));
    await waitFor(() => expect(pushZielMelden).toHaveBeenCalledWith('/konfi/badges'));
    // Kein Gemeinde-Wechsel: Mitteilung und Konto gehoeren zu Gemeinde 1.
    expect(mockSwitchOrg).not.toHaveBeenCalled();
    // Danach ist das Postfach zu.
    await waitFor(() => expect(screen.queryByTestId('modal')).toBeNull());
  });

  it('eine bereits gelesene Mitteilung wird nicht noch einmal gemeldet, fuehrt aber zum Ziel', async () => {
    mockGet.mockResolvedValue(antwort([eintrag(5, { type: 'activity_request_decision', read_at: '2026-09-24T10:00:00.000Z' })]));
    render(<PostfachModal />);
    await oeffnen();
    fireEvent.click(await screen.findByText('Mitteilung 5'));

    await waitFor(() => expect(pushZielMelden).toHaveBeenCalledWith('/konfi/requests'));
    expect(mockPut).not.toHaveBeenCalled();
  });

  it('eine Mitteilung aus einer anderen Gemeinde wechselt erst dorthin -- wie ein Push', async () => {
    mockOrganizations = [
      { id: 1, name: 'Test-Gemeinde', role_name: 'konfi' },
      { id: 2, name: 'Andere Gemeinde', role_name: 'teamer' },
    ];
    mockSwitchOrg.mockResolvedValue({ ok: true, type: 'teamer' });
    mockGet.mockResolvedValue(antwort([eintrag(20, { organization_id: 2, organization_name: 'Andere Gemeinde' })]));
    render(<PostfachModal />);
    await oeffnen();
    // Bei mehreren Gemeinden steht der Name an der Mitteilung.
    expect(await screen.findByText(/Andere Gemeinde/)).toBeTruthy();

    fireEvent.click(screen.getByText('Mitteilung 20'));
    await waitFor(() => expect(mockSwitchOrg).toHaveBeenCalledWith(2));
    // Die Route wird mit der Rolle in der ZIEL-Gemeinde gebaut.
    await waitFor(() => expect(pushZielMelden).toHaveBeenCalledWith('/teamer/badges'));
  });

  it('bei nur einer Gemeinde steht kein Gemeindename an der Mitteilung', async () => {
    mockGet.mockResolvedValue(antwort([eintrag(1)]));
    render(<PostfachModal />);
    await oeffnen();
    await screen.findByText('Mitteilung 1');
    expect(screen.queryByText(/Test-Gemeinde/)).toBeNull();
  });

  it('"Alle gelesen" meldet einmal an den Server und laesst die Zaehler nachladen', async () => {
    mockGet.mockResolvedValue(antwort([eintrag(1), eintrag(2)]));
    const { container } = render(<PostfachModal />);
    await oeffnen();
    await screen.findByText('Mitteilung 1');
    expect(container.querySelectorAll('.app-postfach-eintrag--ungelesen').length).toBe(2);

    fireEvent.click(screen.getByText('Alle gelesen'));
    await waitFor(() => expect(mockPut).toHaveBeenCalledWith('/notifications/postfach/gelesen'));
    await waitFor(() => expect(mockRefresh).toHaveBeenCalledTimes(1));
    expect(container.querySelectorAll('.app-postfach-eintrag--ungelesen').length).toBe(0);
    // Ohne Ungelesene verschwindet der Knopf.
    expect(screen.queryByText('Alle gelesen')).toBeNull();
  });

  it('"Ältere laden" fragt mit der kleinsten bekannten Kennung als Cursor nach', async () => {
    mockGet
      .mockResolvedValueOnce(antwort([eintrag(30), eintrag(29)], true))
      .mockResolvedValueOnce(antwort([eintrag(28)], false));
    render(<PostfachModal />);
    await oeffnen();
    await screen.findByText('Mitteilung 29');

    fireEvent.click(screen.getByText('Ältere Mitteilungen laden'));
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2));
    expect(mockGet).toHaveBeenLastCalledWith('/notifications/postfach', { params: { limit: POSTFACH_SEITENGROESSE, vor: 29 } });
    expect(await screen.findByText('Mitteilung 28')).toBeTruthy();
    // Die ersten bleiben stehen -- es wird angehaengt, nicht ersetzt.
    expect(screen.getByText('Mitteilung 30')).toBeTruthy();
    // Nichts Aelteres mehr: Knopf weg.
    await waitFor(() => expect(screen.queryByText('Ältere Mitteilungen laden')).toBeNull());
  });

  it('ohne Mitteilungen steht ein Leerzustand, kein leerer Kasten', async () => {
    mockGet.mockResolvedValue(antwort([]));
    render(<PostfachModal />);
    await oeffnen();
    expect(await screen.findByText('Nichts Neues')).toBeTruthy();
  });

  it('offline sagt die Liste, was fehlt -- die Warteschlange bleibt sichtbar', async () => {
    mockGescheitert = [{
      id: 'f1', label: 'Abmeldung Sommerfest', type: 'opt-out', createdAt: 0, failedAt: 0,
      error: { status: 409, message: 'Konflikt' },
    }];
    mockGet.mockRejectedValue(new Error('Network Error'));
    render(<PostfachModal />);
    await oeffnen();
    expect(await screen.findByText(/Deine Mitteilungen/)).toBeTruthy();
    expect(screen.getByText('Abmeldung Sommerfest')).toBeTruthy();
  });
  // Simon (25.09.2026, am Geraet): "Dann sollte es die Listen so aussehen
  // wie alle unsere Listen ... Aktivitaeten mit der klassischen
  // Aktivitaetenfarbe." Die Farbe haengt an denselben Klassen wie in jeder
  // anderen Liste (.app-list-item--<bereich>, .app-icon-circle--<bereich>).
  describe('Listenform wie alle Listen der App', () => {
    it('jede Mitteilung ist ein app-list-item in einer Karte, mit Farbrand und Farbkreis je Bereich', async () => {
      mockGet.mockResolvedValue(antwort([
        eintrag(3, { type: 'badge_earned' }),
        eintrag(2, { type: 'new_activity_request', data: { request_id: 9 } }),
        eintrag(1, { type: 'activity_request_decision', data: { request_id: 8, status: 'approved' } }),
      ]));
      const { container } = render(<PostfachModal />);
      await oeffnen();
      await screen.findByText('Mitteilung 3');

      const zeilen = container.querySelectorAll('.app-postfach-eintrag');
      expect(zeilen.length).toBe(3);
      zeilen.forEach(z => expect(z.classList.contains('app-list-item')).toBe(true));

      // Abzeichen in der Abzeichenfarbe, Antraege in der Aktivitaetenfarbe.
      expect(zeilen[0].classList.contains('app-list-item--badges')).toBe(true);
      expect(zeilen[0].querySelector('.app-icon-circle--badges')).not.toBeNull();
      expect(zeilen[1].classList.contains('app-list-item--activities')).toBe(true);
      expect(zeilen[1].querySelector('.app-icon-circle--activities')).not.toBeNull();
      expect(zeilen[2].classList.contains('app-list-item--activities')).toBe(true);
      // Keine Zeile traegt eine geratene zweite Farbe.
      zeilen.forEach(z => {
        const farben = [...z.classList].filter(k => k.startsWith('app-list-item--'));
        expect(farben.length).toBe(1);
      });
      // Titel, Text und Meta in den Feldern der Listenzeile.
      expect(zeilen[0].querySelector('.app-list-item__title')?.textContent).toBe('Mitteilung 3');
      expect(zeilen[0].querySelector('.app-list-item__subtitle')?.textContent).toBe('Text 3');
    });

    it('ungelesen traegt "Neu" im Eselsohr, gelesen nicht', async () => {
      mockGet.mockResolvedValue(antwort([eintrag(12), eintrag(11, { read_at: '2026-09-24T10:00:00.000Z' })]));
      const { container } = render(<PostfachModal />);
      await oeffnen();
      await screen.findByText('Mitteilung 12');
      const zeilen = container.querySelectorAll('.app-postfach-eintrag');
      expect(zeilen[0].querySelector('.app-corner-badge')?.textContent).toBe('Neu');
      expect(zeilen[1].querySelector('.app-corner-badge')).toBeNull();
    });

    it('die Zeile ist ein Knopf: Enter fuehrt zum Ziel wie ein Tipp', async () => {
      mockGet.mockResolvedValue(antwort([eintrag(12)]));
      const { container } = render(<PostfachModal />);
      await oeffnen();
      await screen.findByText('Mitteilung 12');
      const zeile = container.querySelector('.app-postfach-eintrag') as HTMLElement;
      expect(zeile.getAttribute('role')).toBe('button');
      fireEvent.keyDown(zeile, { key: 'Enter' });
      await waitFor(() => expect(pushZielMelden).toHaveBeenCalledWith('/konfi/badges'));
    });
  });

  // Simons Befunde am iPhone (25.09.2026): Vollbild ohne Abdunklung, ein
  // Text-Knopf "Fertig", Datum und Gemeinde ohne Symbol, alle Abzeichen mit
  // demselben Band -- und "sunny-outline" im Titel.
  describe('Befunde vom Geraet (25.09.2026)', () => {
    it('geht auf iOS als Karte vor dem Router-Outlet auf (presentingElement), nicht als Vollbild', async () => {
      const outlet = document.createElement('ion-router-outlet');
      document.body.appendChild(outlet);
      try {
        mockGet.mockResolvedValue(antwort([]));
        render(<PostfachModal />);
        await oeffnen();
        expect(screen.getByTestId('modal').getAttribute('data-presenting')).toBe('ion-router-outlet');
      } finally {
        outlet.remove();
      }
    });

    it('vor der Anmeldung gibt es keinen Outlet -- dann ohne presentingElement, ohne Absturz', async () => {
      mockGet.mockResolvedValue(antwort([]));
      render(<PostfachModal />);
      await oeffnen();
      expect(screen.getByTestId('modal').getAttribute('data-presenting')).toBe('');
    });

    it('schliesst ueber das Symbol wie jedes andere Modal -- kein "Fertig"', async () => {
      mockGet.mockResolvedValue(antwort([]));
      render(<PostfachModal />);
      await oeffnen();
      expect(screen.queryByText('Fertig')).toBeNull();
      const knopf = screen.getByLabelText('Schließen');
      expect(knopf.classList.contains('app-modal-close-btn')).toBe(true);
      expect(knopf.querySelector('[data-icon]')?.getAttribute('data-icon')).toBe(ICON_SCHLIESSEN);
      fireEvent.click(knopf);
      await waitFor(() => expect(screen.queryByTestId('modal')).toBeNull());
    });

    it('Datum und Gemeinde tragen ein Symbol, wie Datum und Ort in der Terminliste', async () => {
      mockOrganizations = [
        { id: 1, name: 'Test-Gemeinde', role_name: 'konfi' },
        { id: 2, name: 'Andere Gemeinde', role_name: 'teamer' },
      ];
      // Weit genug zurueck, dass zeitpunktText das Datum nennt und nicht "vor n Std.".
      mockGet.mockResolvedValue(antwort([eintrag(1, {
        organization_id: 2, organization_name: 'Andere Gemeinde', created_at: '2026-01-05T08:00:00.000Z',
      })]));
      render(<PostfachModal />);
      await oeffnen();
      await screen.findByText('Mitteilung 1');
      const zeit = screen.getByTestId('postfach-zeitpunkt');
      expect(zeit.querySelector('[data-icon]')?.getAttribute('data-icon')).toBe(ICON_TERMIN_GEFUELLT);
      expect(zeit.textContent).toBe('05.01.2026');
      const gemeinde = screen.getByTestId('postfach-gemeinde');
      expect(gemeinde.querySelector('[data-icon]')?.getAttribute('data-icon')).toBe(ICON_ORGANISATION_GEFUELLT);
      expect(gemeinde.textContent).toBe('Andere Gemeinde');
    });

    it('bei einer Gemeinde bleibt das Datum mit Symbol, die Gemeinde-Zeile fehlt', async () => {
      mockGet.mockResolvedValue(antwort([eintrag(1)]));
      render(<PostfachModal />);
      await oeffnen();
      await screen.findByText('Mitteilung 1');
      expect(screen.getByTestId('postfach-zeitpunkt')).toBeTruthy();
      expect(screen.queryByTestId('postfach-gemeinde')).toBeNull();
    });

    it('ein Abzeichen zeigt SEIN Symbol aus data.badge_icon -- aufgeloest wie ueberall (utils/badgeIcons)', async () => {
      mockGet.mockResolvedValue(antwort([
        eintrag(3, { data: { badge_id: 3, badge_icon: 'sunny-outline' } }),
        eintrag(2, { data: { badge_id: 2, badge_icon: 'trophy' } }),
      ]));
      const { container } = render(<PostfachModal />);
      await oeffnen();
      await screen.findByText('Mitteilung 3');
      const kreise = container.querySelectorAll('.app-icon-circle--badges');
      expect(kreise.length).toBe(2);
      expect(kreise[0].querySelector('[data-icon]')?.getAttribute('data-icon')).toBe(getIconFromIoniconsName('sunny-outline'));
      expect(kreise[1].querySelector('[data-icon]')?.getAttribute('data-icon')).toBe(getIconFromIoniconsName('trophy'));
      // Zwei verschiedene Abzeichen, zwei verschiedene Symbole -- nicht zweimal das Band.
      expect(kreise[0].querySelector('[data-icon]')?.getAttribute('data-icon'))
        .not.toBe(kreise[1].querySelector('[data-icon]')?.getAttribute('data-icon'));
      expect(kreise[0].querySelector('[data-icon]')?.getAttribute('data-icon')).not.toBe(ICON_ABZEICHEN_GEFUELLT);
    });

    it('ein Emoji-Abzeichen (⛪, 54 von 629 in Produktion) steht als Text im Kreis', async () => {
      mockGet.mockResolvedValue(antwort([eintrag(1, { data: { badge_id: 1, badge_icon: '⛪' } })]));
      const { container } = render(<PostfachModal />);
      await oeffnen();
      await screen.findByText('Mitteilung 1');
      const kreis = container.querySelector('.app-icon-circle--badges') as HTMLElement;
      expect(kreis.querySelector('[data-testid="postfach-emoji"]')?.textContent).toBe('⛪');
      expect(kreis.querySelector('[data-icon]')).toBeNull();
    });

    it('ohne badge_icon bleibt das Band', async () => {
      mockGet.mockResolvedValue(antwort([eintrag(1, { data: { badge_id: 1 } })]));
      const { container } = render(<PostfachModal />);
      await oeffnen();
      await screen.findByText('Mitteilung 1');
      expect(container.querySelector('.app-icon-circle--badges [data-icon]')?.getAttribute('data-icon')).toBe(ICON_ABZEICHEN_GEFUELLT);
    });

    it('der technische Icon-Name aus aelteren Titeln ("... sunny-outline") wird nicht gezeigt', async () => {
      mockGet.mockResolvedValue(antwort([
        eintrag(1, { title: 'Neues Badge erhalten! sunny-outline', data: { badge_id: 1, badge_icon: 'sunny-outline' } }),
      ]));
      const { container } = render(<PostfachModal />);
      await oeffnen();
      await waitFor(() => expect(container.querySelector('.app-list-item__title')?.textContent).toBe('Neues Badge erhalten!'));
      expect(screen.queryByText(/sunny-outline/)).toBeNull();
    });
  });

  describe('mitteilungsTitel -- der Anhang faellt nur, wenn er das gespeicherte Symbol ist', () => {
    it('schneidet genau den badge_icon-Anhang ab, auch ein Emoji', () => {
      expect(mitteilungsTitel({ title: 'Neues Badge erhalten! sunny-outline', data: { badge_icon: 'sunny-outline' } })).toBe('Neues Badge erhalten!');
      expect(mitteilungsTitel({ title: 'Neues Badge erhalten! ⛪', data: { badge_icon: '⛪' } })).toBe('Neues Badge erhalten!');
    });

    it('laesst jeden anderen Titel unangetastet', () => {
      expect(mitteilungsTitel({ title: 'Neues Badge erhalten!', data: { badge_icon: 'star' } })).toBe('Neues Badge erhalten!');
      expect(mitteilungsTitel({ title: 'Antrag genehmigt!', data: { request_id: 4 } })).toBe('Antrag genehmigt!');
      expect(mitteilungsTitel({ title: 'Neues Badge erhalten! star', data: {} })).toBe('Neues Badge erhalten! star');
      // Ein Titel, der nur zufaellig so endet wie ein anderes Symbol, bleibt.
      expect(mitteilungsTitel({ title: 'Neues Badge erhalten! star', data: { badge_icon: 'trophy' } })).toBe('Neues Badge erhalten! star');
    });
  });

  describe('postfachBereich -- die Farbregel, ohne Rendern', () => {
    it('ordnet die vier Arten aus Produktion zu', () => {
      expect(postfachBereich('badge_earned')).toBe('badges');
      expect(postfachBereich('new_activity_request')).toBe('activities');
      expect(postfachBereich('activity_request_submitted')).toBe('activities');
      expect(postfachBereich('activity_request_decision')).toBe('activities');
    });

    it('kennt die Push-Arten fuer Termine, Chat und Challenges', () => {
      expect(postfachBereich('event_reminder')).toBe('events');
      expect(postfachBereich('new_event')).toBe('events');
      expect(postfachBereich('waitlist_promotion')).toBe('events');
      expect(postfachBereich('chat')).toBe('chat');
      expect(postfachBereich('challenge_new')).toBe('challenges');
    });

    it('eine unbekannte Art bekommt die neutrale Hinweisfarbe -- nie eine geratene', () => {
      expect(postfachBereich('irgendwas')).toBe('info');
      expect(postfachBereich(undefined)).toBe('info');
      expect(postfachBereich(null)).toBe('info');
    });
  });
});
