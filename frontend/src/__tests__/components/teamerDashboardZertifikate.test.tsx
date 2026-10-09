import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, cleanup, act } from '@testing-library/react';

// Simon, 05.09.2026: "bei lasse im dashboard sehe ich noch das dash für
// zertifikate. aber er hat gar keine zertifikate. es soll bei allen teamern
// diesen block ausblenden wenn sie 0 haben und ansonsten auch nur eins
// zeigen wenn es nur eins gibt. sonst nimmt der block so viel platz weg."
//
// URSACHE: GET /teamer/dashboard liefert per LEFT JOIN ALLE aktiven
// Zertifikatstypen der Gemeinde, auch die nicht erworbenen ('not_earned').
// `certificates.length > 0` war deshalb nie falsch, sobald die Gemeinde
// ueberhaupt Typen fuehrt — der Block stand mit lauter Platzhaltern da.
//
// Auf Produktion nachgemessen (05.09.2026): 15 von 17 Teamer:innen haben
// null Zertifikate, genau eine Person hat eins. Beide Lasse haben 0 eigene
// bei 4 Typen in ihrer Gemeinde — also vier leere Platzhalter.
//
// Gefiltert wird im FRONTEND, nicht in der Route: Die Antwortform bleibt
// unveraendert, ausgelieferte App-Versionen zeigen ihre gewohnte Ansicht
// weiter (Regel "Ausgelieferte Apps nie brechen").
//
// Seit 09.10.2026 gerendert: die echte Startseite mit einer Antwort, wie die
// Route sie liefert (alle Typen, auch nicht erworbene). Der fruehere dritte
// Teil dieser Datei (Zurueck-Knopf der Material-Seite) steht gerendert in
// teamerMaterialZurueck.test.tsx.

vi.mock('@capacitor/preferences', () => ({
  Preferences: { get: vi.fn(async () => ({ value: null })), set: vi.fn(async () => undefined) },
}));
vi.mock('../../services/api', () => ({ default: { get: vi.fn(async () => ({ data: {} })) } }));
vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({ user: { id: 3, type: 'teamer' }, setError: vi.fn() }),
}));
vi.mock('../../contexts/LiveUpdateContext', () => ({ useLiveRefresh: vi.fn() }));

// Eine feste Antwort je Test: Die Seite haengt Effekte an die Daten; ein bei
// jedem Rendern neues Objekt liesse sie endlos laufen.
const { stand } = vi.hoisted(() => ({ stand: { antwort: null as unknown } }));
const leer = { data: null, loading: false, error: null, refresh: vi.fn(), refreshLive: vi.fn() };
vi.mock('../../hooks/useOfflineQuery', () => ({
  useOfflineQuery: (key: string) => (key.startsWith('teamer:dashboard:') ? stand.antwort : leer),
}));
vi.mock('../../services/offlineCache', () => ({ CACHE_TTL: { DASHBOARD: 1, BADGES: 1, TAGESLOSUNG: 1 } }));
vi.mock('../../components/common/LoadingSpinner', () => ({ default: () => null }));
vi.mock('../../components/wrapped/WrappedModal', () => ({ default: () => null }));
vi.mock('../../components/shared', () => ({
  ProfileHeaderButton: () => null,
  TrialBanner: () => null,
  StoreUpdateBanner: () => null,
}));
vi.mock('../../components/shared/BibleTranslationModal', () => ({
  default: () => null,
  getTranslationName: (code: string) => code,
}));
vi.mock('../../components/shared/NeuerungenBanner', () => ({ default: () => null }));
vi.mock('../../components/shared/MitmachenErklaerungModal', () => ({ default: () => null }));
vi.mock('../../components/konfi/modals/KonfispruchSelectModal', () => ({ default: () => null }));
vi.mock('../../components/teamer/modals/TeamerOnboardingModal', () => ({ default: () => null }));
vi.mock('../../hooks/useOnboardingOnce', () => ({
  useOnboardingWithUpdateOnce: () => ({
    showOnboarding: false, closeOnboarding: vi.fn(),
    showUpdateHinweis: false, markUpdateHinweisGesehen: vi.fn(),
    showMitmachenHinweis: false, markMitmachenHinweisGesehen: vi.fn(),
  }),
}));
vi.mock('../../utils/haptics', () => ({ triggerPullHaptic: vi.fn() }));
vi.mock('../../utils/badgeIcons', () => ({ getIconFromString: () => 'icon' }));
vi.mock('../../components/shared/AppKopfzeile', () => ({ default: () => null, AppKopfzeileGross: () => null }));
vi.mock('@ionic/react', () => {
  const durch = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    IonPage: durch, IonHeader: durch, IonToolbar: durch, IonTitle: durch, IonContent: durch, IonButton: durch,
    IonIcon: () => null, IonRefresher: () => null, IonRefresherContent: () => null,
    useIonPopover: () => [vi.fn(), vi.fn()],
    useIonModal: () => [vi.fn(), vi.fn()],
    useIonRouter: () => ({ push: vi.fn() }),
  };
});

import TeamerDashboardPage from '../../components/teamer/pages/TeamerDashboardPage';

type Status = 'valid' | 'expired' | 'not_earned';
const zertifikat = (id: number, name: string, status: Status) => ({
  id, name, icon: 'ribbon', status,
  issued_date: status === 'not_earned' ? null : '2026-03-01T10:00:00Z',
  expiry_date: status === 'expired' ? '2026-09-01T10:00:00Z' : null,
});
// So liefert die Route es fuer Lasse: vier Typen der Gemeinde, keiner erworben.
const VIER_TYPEN: Array<[number, string]> = [[1, 'Juleica'], [2, 'Erste Hilfe'], [3, 'Kinderschutz'], [4, 'Rettungsschwimmen']];

const zeige = async (certificates: unknown[], config: Record<string, unknown> = {}) => {
  stand.antwort = {
    data: {
      greeting: { display_name: 'Lasse Test', hour: 9 },
      certificates,
      events: [],
      badges: { recent: [], earned_count: 0, total_count: 0 },
      config: { show_challenges: false, show_losung: false, ...config },
      has_wrapped: false,
      konfspruch: null,
    },
    loading: false, error: null, refresh: vi.fn(), refreshLive: vi.fn(),
  };
  const r = render(<TeamerDashboardPage />);
  await act(async () => { await Promise.resolve(); });
  return r;
};

const block = (c: HTMLElement) => c.querySelector('.app-dashboard-section--zertifikate') as HTMLElement | null;
const karten = (c: HTMLElement) => [...c.querySelectorAll('.app-cert-card')].map((k) => k.querySelector('span')?.textContent);
const raster = (c: HTMLElement) => (block(c)?.querySelector('.app-dashboard-section__content > div') as HTMLElement | null)?.style.gridTemplateColumns;
const chip = (c: HTMLElement) => block(c)?.querySelector('.app-dashboard-glass-chip')?.textContent;

beforeEach(() => cleanup());

describe('Teamer-Dashboard: Zertifikate', () => {
  it('zaehlt nur die tatsaechlich erhaltenen', async () => {
    const { container } = await zeige([
      zertifikat(1, 'Juleica', 'valid'),
      zertifikat(2, 'Erste Hilfe', 'not_earned'),
      zertifikat(3, 'Kinderschutz', 'valid'),
      zertifikat(4, 'Rettungsschwimmen', 'not_earned'),
    ]);
    expect(chip(container)).toBe('2 ERHALTEN');
  });

  it('blendet den Block aus, wenn keins erhalten wurde', async () => {
    // Vorher hing die Bedingung an der Rohliste, die die nicht erworbenen
    // mitzaehlte: vier leere Platzhalter.
    const { container } = await zeige(VIER_TYPEN.map(([id, name]) => zertifikat(id, name, 'not_earned')));
    expect(block(container)).toBeNull();
    expect(container.querySelectorAll('.app-cert-card')).toHaveLength(0);
  });

  it('blendet ihn auch aus, wenn die Gemeinde ihn abgeschaltet hat', async () => {
    const { container } = await zeige([zertifikat(1, 'Juleica', 'valid')], { show_zertifikate: false });
    expect(block(container)).toBeNull();
  });

  it('nutzt eine Spalte, wenn es genau eins gibt', async () => {
    // Sonst stand die einzelne Karte auf halber Breite neben einer leeren Haelfte.
    const { container } = await zeige([
      zertifikat(1, 'Juleica', 'valid'),
      ...VIER_TYPEN.slice(1).map(([id, name]) => zertifikat(id, name, 'not_earned')),
    ]);
    expect(raster(container)).toBe('1fr');
  });

  it('und zwei, sobald es mehrere gibt', async () => {
    const { container } = await zeige([zertifikat(1, 'Juleica', 'valid'), zertifikat(2, 'Erste Hilfe', 'valid')]);
    expect(raster(container)).toBe('repeat(2, 1fr)');
  });

  it('rendert nur die erhaltenen, nicht die Rohliste', async () => {
    const { container } = await zeige([
      zertifikat(1, 'Juleica', 'valid'),
      zertifikat(2, 'Erste Hilfe', 'not_earned'),
      zertifikat(3, 'Kinderschutz', 'expired'),
    ]);
    expect(karten(container)).toEqual(['Juleica', 'Kinderschutz']);
  });

  it('zeigt keinen sinnlosen Bruch wie "1/1"', async () => {
    // Ohne die nicht erworbenen ist der Nenner gleich dem Zaehler, solange
    // nichts abgelaufen ist.
    const nurGueltig = await zeige([zertifikat(1, 'Juleica', 'valid'), zertifikat(2, 'Erste Hilfe', 'not_earned')]);
    expect(chip(nurGueltig.container)).toBe('1 ERHALTEN');
    cleanup();
    // Der Bruch bleibt nur fuer den Fall, in dem er etwas aussagt.
    const mitAbgelaufenem = await zeige([zertifikat(1, 'Juleica', 'valid'), zertifikat(3, 'Kinderschutz', 'expired')]);
    expect(chip(mitAbgelaufenem.container)).toBe('1/2 GÜLTIG');
  });
});

describe('Teamer-Dashboard: Kopfbereich', () => {
  it('nutzt den gemeinsamen Teamer-Verlauf', async () => {
    // Dritte Stelle mit eigenem, hellerem Rot (#e11d48) — nach Profil und
    // Wrapped-Kachel. Jetzt ziehen alle drei aus derselben Variablen.
    const { container } = await zeige([]);
    const kopf = container.querySelector('.app-dashboard-header') as HTMLElement | null;
    expect(kopf?.style.background).toBe('var(--app-gradient-teamer)');
  });
});
