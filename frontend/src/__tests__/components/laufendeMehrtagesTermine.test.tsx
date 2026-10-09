import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { istVergangen, eventEnde } from '../../components/shared/eventFormatting';
import type { Event } from '../../types/event';

// Befund H5 (Zeitzonen-Pruefung 01.09.2026): Laufende mehrtaegige Termine
// verschwanden aus der Konfi-Liste.
//
// Die Zaehler und der Listenfilter in konfi/views/EventsView.tsx rechneten
// ueber `new Date(e.event_date) >= new Date()`, also allein ueber den START.
// Am 12. einer Freizeit vom 10.-14. sagte das Abzeichen der Kachel "laeuft"
// und die Kachel "Vergangen" zaehlte sie mit -- im Reiter "Alle" war die
// laufende Freizeit aber gar nicht mehr zu finden. Ausgerechnet die
// Veranstaltung, an der man gerade teilnimmt, war nicht auffindbar.
//
// Bitter daran: `istVergangen` war in derselben Datei bereits importiert und
// acht Zeilen weiter fuer die Abzeichen in Gebrauch. Der Fehler war ein
// Rueckfall in einen Bug, der am 27.08.2026 schon einmal behoben worden war
// (Befund N6, dokumentiert in eventFormatting.ts).

// Seit 09.10.2026 gerendert (Audit Tests BF-02): Die drei Konfi-Ansichten
// -- Terminliste, Startseite (Seite und Ansicht) -- bekommen eine laufende
// Freizeit und einen gestern beendeten Eintagestermin. Bis dahin stand hier,
// dass im Quelltext kein `new Date(e.event_date) >= new Date()` steht; ein
// anders geschriebener Vergleich auf den Start waere durchgerutscht.

// --- Attrappen fuer die gerenderten Ansichten --------------------------------

const apiAntworten: Record<string, unknown> = {};
vi.mock('../../services/api', () => ({
  default: {
    get: vi.fn(async (pfad: string) => ({ data: apiAntworten[pfad] ?? {} })),
    post: vi.fn().mockResolvedValue({ data: {} }),
    put: vi.fn().mockResolvedValue({ data: {} }),
  },
}));
vi.mock('../../contexts/AppContext', () => ({ useApp: () => ({ user: { id: 7, type: 'konfi' }, setError: vi.fn() }) }));
vi.mock('../../contexts/LiveUpdateContext', () => ({ useLiveRefresh: () => undefined }));
vi.mock('../../contexts/BadgeContext', () => ({ useBadge: () => ({ refreshAllCounts: vi.fn(), newBadgesCount: 0 }) }));
vi.mock('../../contexts/ModalContext', () => ({ useModalPage: () => ({ pageRef: { current: null } }) }));
vi.mock('../../services/networkMonitor', () => ({ networkMonitor: { isOnline: true, subscribe: () => () => undefined } }));
vi.mock('../../services/analytics', async (original) => ({ ...(await original<object>()), track: vi.fn() }));
vi.mock('../../services/writeQueue', () => ({ writeQueue: { enqueue: vi.fn() } }));
// Die Termine der Startseite kommen ueber useOfflineQuery -- samt select, in
// dem die Seite die vergangenen aussortiert. Die Attrappe wendet select an
// wie der echte Hook.
type Optionen = { select?: (d: never) => unknown };
vi.mock('../../hooks/useOfflineQuery', () => ({
  useOfflineQuery: (schluessel: string, _f: unknown, optionen?: Optionen) => {
    const pfad = schluessel.startsWith('konfi:events:') ? '/konfi/events'
      : schluessel.startsWith('konfi:dashboard:') ? '/konfi/dashboard' : null;
    const roh = pfad ? apiAntworten[pfad] : undefined;
    const data = roh !== undefined && optionen?.select ? optionen.select(roh as never) : (roh ?? null);
    return { data, loading: false, error: null, isStale: false, isOffline: false, refresh: vi.fn(), refreshLive: vi.fn() };
  },
}));
// Die Startseiten-Ansicht wird echt gerendert; mitgeschrieben wird, welche
// Termine die Seite ihr reicht.
const startAnsichtProps: Array<{ upcomingEvents: Array<{ name: string }> }> = [];
vi.mock('../../components/konfi/views/DashboardView', async () => {
  const echt = await vi.importActual<typeof import('../../components/konfi/views/DashboardView')>('../../components/konfi/views/DashboardView');
  const Echt = echt.default;
  return {
    default: (p: React.ComponentProps<typeof Echt>) => {
      startAnsichtProps.push(p as never);
      return <Echt {...p} />;
    },
  };
});
vi.mock('../../components/shared/AppKopfzeile', () => ({ default: () => null, AppKopfzeileGross: () => null }));
vi.mock('../../components/admin/views/ActivityRings', () => ({ default: () => null }));
vi.mock('../../components/shared/BibleTranslationModal', () => ({ default: () => null, getTranslationName: (c: string) => c }));
vi.mock('../../components/konfi/modals/PointsHistoryModal', () => ({ default: () => null }));
vi.mock('../../components/konfi/modals/KonfispruchSelectModal', () => ({ default: () => null }));
vi.mock('../../components/konfi/modals/KonfiOnboardingModal', () => ({ default: () => null }));
vi.mock('../../components/wrapped/WrappedModal', () => ({ default: () => null }));
vi.mock('../../components/shared/NeuerungenBanner', () => ({ default: () => null }));
vi.mock('../../components/shared/MitmachenErklaerungModal', () => ({ default: () => null }));
vi.mock('../../components/common/LoadingSpinner', () => ({ default: () => null }));
vi.mock('../../hooks/useOnboardingOnce', () => ({
  useOnboardingWithUpdateOnce: () => ({
    showOnboarding: false, closeOnboarding: vi.fn(), showUpdateHinweis: false, markUpdateHinweisGesehen: vi.fn(),
    showMitmachenHinweis: false, markMitmachenHinweisGesehen: vi.fn(),
  }),
}));
vi.mock('@ionic/react', () => {
  const durch = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    IonPage: durch, IonHeader: durch, IonToolbar: durch, IonTitle: durch, IonContent: durch,
    IonRefresher: () => null, IonRefresherContent: () => null, IonButtons: durch, IonButton: durch,
    IonIcon: () => null, IonSegment: durch, IonSegmentButton: durch, IonLabel: durch, IonList: durch,
    IonListHeader: durch, IonItemGroup: durch, IonInput: () => null, IonCard: durch, IonCardContent: durch,
    IonItem: ({ children, onClick }: { children?: React.ReactNode; onClick?: () => void }) => <div data-testid="zeile" onClick={onClick}>{children}</div>,
    useIonModal: () => [vi.fn(), vi.fn()], useIonPopover: () => [vi.fn(), vi.fn()], useIonAlert: () => [vi.fn()],
    useIonRouter: () => ({ push: vi.fn() }), useIonViewWillEnter: () => undefined,
  };
});

// Die Freizeit aus dem Befund: 10.-14., betrachtet am 12.
const freizeit = {
  event_date: '2026-08-10T09:00:00+02:00',
  event_end_time: '2026-08-14T16:00:00+02:00'
};
const amZwoelften = new Date('2026-08-12T12:00:00+02:00');

describe('Laufende Mehrtagestermine gelten nicht als vergangen', () => {
  it('zaehlt eine Freizeit am mittleren Tag NICHT als vergangen', () => {
    expect(istVergangen(freizeit, amZwoelften)).toBe(false);
  });

  it('haelt sie am letzten Tag vor dem Ende noch fuer laufend', () => {
    expect(istVergangen(freizeit, new Date('2026-08-14T15:59:00+02:00'))).toBe(false);
  });

  it('erklaert sie erst nach dem Ende fuer vergangen', () => {
    expect(istVergangen(freizeit, new Date('2026-08-14T16:01:00+02:00'))).toBe(true);
  });

  it('zaehlt sie am Tag davor ebenfalls nicht als vergangen', () => {
    expect(istVergangen(freizeit, new Date('2026-08-09T12:00:00+02:00'))).toBe(false);
  });

  it('nimmt bei mehrtaegigen Terminen das Ende als Stichzeit', () => {
    expect(eventEnde(freizeit).toISOString()).toBe('2026-08-14T14:00:00.000Z');
  });

  it('nimmt bei eintaegigen Terminen den Start als Stichzeit', () => {
    const eintaegig = { event_date: '2026-08-10T09:00:00+02:00', event_end_time: null };
    expect(eventEnde(eintaegig).toISOString()).toBe('2026-08-10T07:00:00.000Z');
    expect(istVergangen(eintaegig, amZwoelften)).toBe(true);
  });

  it('rechnet ueber die Sommerzeitumstellung am 25.10.2026 richtig', () => {
    // Ein Termin, der ueber die Rueckstellung laeuft: Start 24.10. (MESZ,
    // UTC+2), Ende 26.10. (MEZ, UTC+1). Am 25.10. mitten in der Doppelstunde
    // betrachtet muss er laufen -- eine feste Verschiebung um 24 Stunden je
    // Tag traefe hier daneben.
    const ueberDieUmstellung = {
      event_date: '2026-10-24T18:00:00+02:00',
      event_end_time: '2026-10-26T12:00:00+01:00'
    };
    expect(istVergangen(ueberDieUmstellung, new Date('2026-10-25T02:30:00+01:00'))).toBe(false);
    expect(istVergangen(ueberDieUmstellung, new Date('2026-10-26T11:00:00+01:00'))).toBe(false);
    expect(istVergangen(ueberDieUmstellung, new Date('2026-10-26T13:00:00+01:00'))).toBe(true);
  });
});

// --- Gerendert: die Konfi-Ansichten -------------------------------------------

const STUNDE = 60 * 60 * 1000;
const um = (stunden: number) => new Date(Date.now() + stunden * STUNDE).toISOString();

/** Freizeit seit vorgestern, bis uebermorgen -- sie laeuft gerade. */
const laufend = (zusatz: Partial<Event> = {}) => ({
  id: 1, name: 'Freizeit Büsum', event_date: um(-48), event_end_time: um(48), points: 2, type: 'event',
  max_participants: 20, registered_count: 5, registration_status: 'closed', cancelled: false,
  mandatory: false, is_konfirmation: false, categories: [], is_registered: true, booking_status: 'confirmed',
  ...zusatz,
}) as Event;
/** Eintagestermin von gestern -- vorbei. */
const gestern = (zusatz: Partial<Event> = {}) => laufend({
  id: 2, name: 'Elternabend', event_date: um(-26), event_end_time: um(-24), ...zusatz,
});

const kacheln = () => Object.fromEntries([...document.querySelectorAll('.app-stats-row__item')].map((k) => [
  k.querySelector('.app-stats-row__label')?.textContent, Number(k.querySelector('.app-stats-row__value')?.textContent),
]));

beforeEach(() => {
  for (const k of Object.keys(apiAntworten)) delete apiAntworten[k];
  startAnsichtProps.length = 0;
});

describe('Konfi-Terminliste: die laufende Freizeit bleibt unter "Alle"', () => {
  const zeige = async (reiter: 'alle' | 'meine') => {
    const EventsView = (await import('../../components/konfi/views/EventsView')).default;
    render(<EventsView events={[laufend(), gestern()]} activeTab={reiter} onTabChange={() => undefined} onSelectEvent={() => undefined} />);
  };

  it('"Alle" zeigt sie, den vergangenen Termin nicht', async () => {
    await zeige('alle');
    expect(screen.queryByText('Freizeit Büsum')).not.toBeNull();
    expect(screen.queryByText('Elternabend')).toBeNull();
  });

  it('die Kachel "Gesamt" unter "Alle" zaehlt sie mit', async () => {
    await zeige('alle');
    expect(kacheln()).toMatchObject({ Gesamt: 1 });
  });

  it('unter "Meine" zaehlt sie als anstehend, nicht als vergangen', async () => {
    await zeige('meine');
    expect(kacheln()).toMatchObject({ Gebucht: 2, Anstehend: 1, Vergangen: 1 });
  });
});

describe('Konfi-Startseite: die laufende Freizeit steht unter "Deine Events"', () => {
  const dashboard = {
    konfi: { id: 7, display_name: 'Emilia Test', jahrgang_name: '2026', gottesdienst_points: 3, gemeinde_points: 2 },
    total_points: 5, recent_badges: [], badge_count: 0, recent_events: [], event_count: 0, ranking: [],
  };

  it('die Seite reicht die laufende Freizeit weiter, den vergangenen Termin nicht', async () => {
    apiAntworten['/konfi/dashboard'] = dashboard;
    apiAntworten['/konfi/events'] = [laufend(), gestern()];
    const KonfiDashboardPage = (await import('../../components/konfi/pages/KonfiDashboardPage')).default;
    render(<KonfiDashboardPage />);
    await act(async () => { await Promise.resolve(); });
    expect(startAnsichtProps.at(-1)?.upcomingEvents.map((e) => e.name)).toEqual(['Freizeit Büsum']);
  });

  it('die Ansicht zeigt sie, auch wenn ihr ein vergangener Termin mitgegeben wird', async () => {
    const DashboardView = (await import('../../components/konfi/views/DashboardView')).default;
    render(
      <DashboardView
        dashboardData={dashboard as never}
        badgeStats={{ totalAvailable: 0, totalEarned: 0, secretAvailable: 0, secretEarned: 0 }}
        allBadges={{ available: [], earned: [] }}
        upcomingEvents={[laufend(), gestern()] as never}
        targetGottesdienst={10}
        targetGemeinde={10}
        onOpenPointsHistory={vi.fn()}
        onOpenKonfispruch={vi.fn()}
        dashboardConfig={{ show_konfirmation: true, show_events: true, show_badges: true, show_ranking: true, show_losung: false } as never}
        sectionOrder={undefined}
      />
    );
    expect(screen.queryByText('Freizeit Büsum')).not.toBeNull();
    expect(screen.queryByText('Elternabend')).toBeNull();
  });
});
