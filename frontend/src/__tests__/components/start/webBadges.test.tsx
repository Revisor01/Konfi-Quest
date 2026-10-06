// Badge-Seiten in der Web-Fassung, gerendert (03.10.2026,
// docs/planung/web-alle-bereiche.md, Entscheidung 6): Kennzahlen, Suche und
// Filter (erhalten, offen, in Arbeit, Kategorie), je Kategorie ein Raster aus
// Karten, Einzelheiten im Dialog -- fuer Konfis und fuers Team. Im schmalen
// Fenster bleibt die Darstellung der App mit ihren Filtern.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import './zeitrahmen';
import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';

const h = vi.hoisted(() => ({
  breit: true,
  laedt: false,
  apiPost: vi.fn(),
  push: vi.fn(),
  modale: [] as Array<{ name: string; props: Record<string, unknown>; optionen: Record<string, unknown> | undefined }>,
  alerts: [] as unknown[],
  user: { id: 7, type: 'konfi' } as Record<string, unknown>,
  konfiBadges: null as unknown,
  teamerBadges: null as unknown,
}));

vi.mock('@ionic/react', async () => (await import('./ionicStart')).ionicStart(h as never));
vi.mock('../../../components/shared/AppKopfzeile', async () => (await import('../support/ionicAttrappe')).KopfzeileAttrappe);
vi.mock('../../../components/shared/WartungsHinweis', () => ({ default: () => null }));
vi.mock('../../../components/common/LoadingSpinner', () => ({ default: ({ message }: { message: string }) => <p>{message}</p> }));
vi.mock('../../../services/api', () => ({ default: { get: vi.fn(), post: h.apiPost } }));
vi.mock('../../../services/writeQueue', () => ({ writeQueue: { enqueue: vi.fn() } }));
vi.mock('../../../services/networkMonitor', () => ({ networkMonitor: { isOnline: true } }));
vi.mock('../../../contexts/AppContext', () => ({ useApp: () => ({ user: h.user }) }));
vi.mock('../../../contexts/BadgeContext', () => ({ useBadge: () => ({ refreshAllCounts: vi.fn() }) }));
vi.mock('../../../contexts/ModalContext', () => ({ useModalPage: () => ({ pageRef: { current: null }, presentingElement: undefined }) }));
vi.mock('../../../contexts/LiveUpdateContext', () => ({ useLiveRefresh: vi.fn() }));
vi.mock('../../../utils/haptics', () => ({ triggerPullHaptic: vi.fn() }));
vi.mock('../../../navigation/breitesLayout', () => ({ useBreitesLayout: () => h.breit }));
vi.mock('../../../hooks/useOfflineQuery', () => ({
  useOfflineQuery: (schluessel: string) => {
    const daten = schluessel.startsWith('konfi:badges') ? h.konfiBadges
      : schluessel.startsWith('teamer:badges') ? h.teamerBadges
        : null;
    return { data: h.laedt ? null : daten, loading: h.laedt, refresh: vi.fn(), refreshLive: vi.fn() };
  },
}));

import KonfiBadgesPage from '../../../components/konfi/pages/KonfiBadgesPage';
import TeamerBadgesPage from '../../../components/teamer/pages/TeamerBadgesPage';

const badge = (id: number, name: string, typ: string, wert: number, extra: Record<string, unknown> = {}) => ({
  id, name, description: `${name} beschrieben`, icon: 'trophy', criteria_type: typ, criteria_value: wert, criteria_extra: null,
  is_hidden: false, is_active: true, sort_order: id, color: '#c0c0c0', earned: false, earned_at: null, seen: true, ...extra,
});
const fortschritt = (aktuell: number, ziel: number) => ({ progress: { current: aktuell, target: ziel, percentage: Math.round((aktuell / ziel) * 100) } });

const KONFI = {
  earned: [
    badge(1, 'Erster Schritt', 'total_points', 5, { earned: true, earned_at: '2026-06-05T10:00:00Z' }),
    badge(2, 'Punkte-Sammler', 'total_points', 15, { earned: true, earned_at: '2026-09-19T10:00:00Z', seen: false }),
    badge(4, 'Gottesdienst-Held', 'gottesdienst_points', 8, { earned: true, earned_at: '2026-09-03T10:00:00Z' }),
    badge(6, 'Event-Champion', 'event_count', 3, { earned: true, earned_at: '2026-08-19T10:00:00Z' }),
    badge(8, 'Nachtwanderer', 'specific_activity', 1, { earned: true, earned_at: '2026-07-15T10:00:00Z', is_hidden: true }),
  ],
  available: [
    badge(3, 'Punkte-Meister', 'total_points', 30, fortschritt(19, 30)),
    badge(5, 'Gottesdienst-Profi', 'gottesdienst_points', 15, fortschritt(8, 15)),
    badge(7, 'Bonus-Jäger', 'bonus_points', 5, fortschritt(0, 5)),
  ],
  stats: { totalVisible: 7, totalSecret: 2 },
};

const TEAM = {
  earned: [badge(101, 'Erstes Jahr', 'teamer_year', 1, { earned: true, earned_at: '2026-09-03T10:00:00Z' })],
  available: [badge(105, 'Zweites Jahr', 'teamer_year', 2, fortschritt(1, 2))],
  stats: { totalVisible: 2, totalSecret: 0 },
};

/** Namen der Kategorien (h2) in der Reihenfolge der Seite. */
const kategorien = (): string[] => screen.getAllByRole('heading', { level: 2 }).map((e) => e.textContent ?? '');
const karten = (): string[] => screen.getAllByRole('button', { name: /Einzelheiten ansehen/ })
  .map((b) => (b.getAttribute('aria-label') ?? '').split(',')[0]);
const status = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name}`) });

beforeEach(() => {
  vi.clearAllMocks();
  h.breit = true;
  h.laedt = false;
  h.modale.length = 0;
  h.user = { id: 7, type: 'konfi' };
  h.konfiBadges = KONFI;
  h.teamerBadges = TEAM;
  h.apiPost.mockResolvedValue({});
});

describe('Badges der Konfis (Web): Kennzahlen und Raster', () => {
  it('Seitenkopf und Kennzahlen mit konkreten Werten', () => {
    render(<KonfiBadgesPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Deine Badges' })).toBeInTheDocument();
    expect(screen.getByText('Sammle alle Erfolge!')).toBeInTheDocument();
    const erreicht = screen.getByRole('group', { name: 'Erreicht: 4' });
    expect(erreicht).toHaveTextContent('von 7 sichtbaren');
    expect(screen.getByRole('group', { name: 'Geheim: 1' })).toHaveTextContent('von 2 geheimen');
    expect(screen.getByRole('group', { name: 'In Arbeit: 2' })).toBeInTheDocument();
    // 5 erreichte von 7 + 2 = 9 Badges: 56 Prozent.
    expect(screen.getByRole('group', { name: 'Geschafft: 56 %' })).toHaveTextContent('5 von 9 Badges');
  });

  it('gruppiert nach Kategorie, mit „x von y erreicht" und Fortschrittsbalken', () => {
    render(<KonfiBadgesPage />);
    expect(kategorien()).toEqual(['Punkte-Sammler', 'Gottesdienst-Held', 'Bonus-Jäger', 'Spezialist', 'Event-Champion']);
    const punkte = screen.getByRole('heading', { name: 'Punkte-Sammler' }).closest('section') as HTMLElement;
    expect(within(punkte).getByText('2 von 3 erreicht')).toBeInTheDocument();
    expect(within(punkte).getByRole('progressbar', { name: 'Punkte-Sammler: erreicht' })).toHaveAttribute('aria-valuenow', '67');
    // Innerhalb der Kategorie nach Schwelle sortiert.
    expect(within(punkte).getAllByRole('button').map((b) => (b.getAttribute('aria-label') ?? '').split(',')[0])).toEqual([
      'Erster Schritt', 'Punkte-Sammler', 'Punkte-Meister',
    ]);
  });

  it('eine Karte nennt Stand und Fortschritt: erreicht mit Datum, in Arbeit mit Zahl, sonst „Noch nicht erreicht"', () => {
    render(<KonfiBadgesPage />);
    const sammler = screen.getByRole('button', { name: 'Punkte-Sammler, erreicht: Einzelheiten ansehen' });
    expect(sammler).toHaveTextContent('Erreicht am 19.09.2026');
    const meister = screen.getByRole('button', { name: 'Punkte-Meister, in Arbeit, 63 Prozent: Einzelheiten ansehen' });
    expect(meister).toHaveTextContent('19 / 30');
    const jaeger = screen.getByRole('button', { name: 'Bonus-Jäger, noch nicht erreicht: Einzelheiten ansehen' });
    expect(jaeger).toHaveTextContent('Noch nicht erreicht');
    // Ein erreichtes Geheim-Badge ist als solches gekennzeichnet.
    expect(screen.getByRole('button', { name: 'Nachtwanderer, erreicht: Einzelheiten ansehen' })).toHaveTextContent('Geheimes Badge');
  });

  it('zeigt waehrend des Ladens Platzhalter', () => {
    h.laedt = true;
    render(<KonfiBadgesPage />);
    expect(screen.getByRole('status')).toHaveTextContent('Badges werden geladen.');
    expect(screen.queryByRole('button', { name: /Einzelheiten ansehen/ })).toBeNull();
  });
});

describe('Badges der Konfis (Web): Filter', () => {
  it('die Chips tragen die Zahlen', () => {
    render(<KonfiBadgesPage />);
    expect(status('Alle')).toHaveTextContent('Alle8');
    expect(status('Erhalten')).toHaveTextContent('Erhalten5');
    expect(status('Offen')).toHaveTextContent('Offen3');
    expect(status('In Arbeit')).toHaveTextContent('In Arbeit2');
    expect(status('Alle')).toHaveAttribute('aria-pressed', 'true');
  });

  it('„Erhalten", „Offen" und „In Arbeit" zeigen genau ihre Badges', () => {
    render(<KonfiBadgesPage />);
    fireEvent.click(status('Erhalten'));
    expect(karten()).toEqual(['Erster Schritt', 'Punkte-Sammler', 'Gottesdienst-Held', 'Nachtwanderer', 'Event-Champion']);
    fireEvent.click(status('Offen'));
    expect(karten()).toEqual(['Punkte-Meister', 'Gottesdienst-Profi', 'Bonus-Jäger']);
    fireEvent.click(status('In Arbeit'));
    expect(karten()).toEqual(['Punkte-Meister', 'Gottesdienst-Profi']);
    expect(status('In Arbeit')).toHaveAttribute('aria-pressed', 'true');
    expect(status('Offen')).toHaveAttribute('aria-pressed', 'false');
  });

  it('die Suche findet nach Name und Beschreibung, ohne auf Gross- und Kleinschreibung zu achten', () => {
    render(<KonfiBadgesPage />);
    const suche = screen.getByRole('searchbox', { name: 'Badges durchsuchen' });
    fireEvent.change(suche, { target: { value: 'EVENT' } });
    expect(karten()).toEqual(['Event-Champion']);
    fireEvent.change(suche, { target: { value: 'held' } });
    expect(karten()).toEqual(['Gottesdienst-Held']);
  });

  it('die Suche liest auch die Beschreibung', () => {
    h.konfiBadges = { ...KONFI, earned: KONFI.earned.map((b) => (b.id === 8 ? { ...b, description: 'Nur im Dunkeln unterwegs' } : b)) };
    render(<KonfiBadgesPage />);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Badges durchsuchen' }), { target: { value: 'DUNKELN' } });
    expect(karten()).toEqual(['Nachtwanderer']);
  });

  it('die Kategorie schraenkt auf eine Gruppe ein', () => {
    render(<KonfiBadgesPage />);
    fireEvent.change(screen.getByLabelText('Kategorie'), { target: { value: 'gottesdienst_points' } });
    expect(kategorien()).toEqual(['Gottesdienst-Held']);
    expect(karten()).toEqual(['Gottesdienst-Held', 'Gottesdienst-Profi']);
  });

  it('Filter wirken zusammen: „Offen" in einer Kategorie', () => {
    render(<KonfiBadgesPage />);
    fireEvent.click(status('Offen'));
    fireEvent.change(screen.getByLabelText('Kategorie'), { target: { value: 'total_points' } });
    expect(karten()).toEqual(['Punkte-Meister']);
  });

  it('ohne Treffer sagt die Seite es -- je nach Filter mit eigenem Text', () => {
    render(<KonfiBadgesPage />);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Badges durchsuchen' }), { target: { value: 'gibt es nicht' } });
    expect(screen.getByText('Keine Badges gefunden')).toBeInTheDocument();
    expect(screen.getByText('Zu diesem Suchbegriff gibt es kein Badge. Versuch es mit einem anderen Wort.')).toBeInTheDocument();
  });

  it('sind alle erreicht, steht unter „Offen" die Gratulation', () => {
    h.konfiBadges = { ...KONFI, available: [] };
    render(<KonfiBadgesPage />);
    fireEvent.click(status('Offen'));
    expect(screen.getByText('Alle Badges erreicht!')).toBeInTheDocument();
  });
});

describe('Badges (Web): Dialog', () => {
  it('ein erreichtes Badge: Beschreibung, Status und Datum', () => {
    render(<KonfiBadgesPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Punkte-Sammler, erreicht: Einzelheiten ansehen' }));
    const dialog = screen.getByRole('dialog', { name: 'Punkte-Sammler' });
    expect(within(dialog).getByText('Punkte-Sammler beschrieben')).toBeInTheDocument();
    expect(within(dialog).getByText('Erreicht')).toBeInTheDocument();
    expect(within(dialog).getByText('19.09.2026')).toBeInTheDocument();
    // Schliessen steht oben rechts und unten bei den Knoepfen.
    const schliessen = within(dialog).getAllByRole('button', { name: 'Schließen' });
    expect(schliessen).toHaveLength(2);
    fireEvent.click(schliessen[1]);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('ein Badge in Arbeit: Status und Fortschritt als Zahl und Balken', () => {
    render(<KonfiBadgesPage />);
    fireEvent.click(screen.getByRole('button', { name: /Gottesdienst-Profi, in Arbeit/ }));
    const dialog = screen.getByRole('dialog', { name: 'Gottesdienst-Profi' });
    expect(within(dialog).getByText('In Arbeit')).toBeInTheDocument();
    expect(within(dialog).getByText('8 / 15')).toBeInTheDocument();
    expect(within(dialog).getByRole('progressbar', { name: 'Fortschritt' })).toHaveAttribute('aria-valuenow', '53');
  });

  it('ein zeitbasiertes Badge nennt den Zeitraum, der zaehlt', () => {
    h.konfiBadges = {
      ...KONFI,
      available: [badge(16, 'Zeitreisender', 'time_based', 5, { ...fortschritt(2, 5), criteria_extra: JSON.stringify({ days: 28 }) })],
    };
    render(<KonfiBadgesPage />);
    fireEvent.click(screen.getByRole('button', { name: /Zeitreisender, in Arbeit/ }));
    const dialog = screen.getByRole('dialog', { name: 'Zeitreisender' });
    expect(within(dialog).getByText(/Zählt die letzten 28 Tage/)).toBeInTheDocument();
  });

  it('Escape schliesst den Dialog', () => {
    render(<KonfiBadgesPage />);
    fireEvent.click(screen.getByRole('button', { name: /Erster Schritt, erreicht/ }));
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('Badges (Web): Verhalten der Seite bleibt', () => {
  it('ungesehene Badges werden beim Oeffnen als gesehen gemeldet -- wie in der App', () => {
    render(<KonfiBadgesPage />);
    expect(h.apiPost).toHaveBeenCalledTimes(1);
    expect(h.apiPost).toHaveBeenCalledWith('/konfi/badges/mark-seen');
  });

  it('im schmalen Fenster bleibt die App-Darstellung mit ihren Filtern', () => {
    h.breit = false;
    const { container } = render(<KonfiBadgesPage />);
    expect(container.querySelector('.web-seite')).toBeNull();
    expect(screen.getByRole('textbox', { name: 'Badges durchsuchen' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Offen' })).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: 'Status' })).toBeNull();
  });
});

describe('Badges des Teams (Web)', () => {
  beforeEach(() => { h.user = { id: 11, type: 'teamer' }; });

  it('Seitenkopf mit Weg zurueck ins Profil, Kennzahlen und Raster', () => {
    render(<TeamerBadgesPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Teamer-Badges' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Profil' })).toHaveAttribute('href', '/teamer/profile');
    expect(screen.getByRole('group', { name: 'Erreicht: 1' })).toHaveTextContent('von 2 sichtbaren');
    expect(screen.queryByRole('group', { name: /Geheim/ })).toBeNull();
    expect(karten()).toEqual(['Erstes Jahr', 'Zweites Jahr']);
  });

  it('traegt die Team-Farbe und meldet die Badges als gesehen -- ueber die Team-Route', () => {
    const { container } = render(<TeamerBadgesPage />);
    expect(container.querySelector('.web-rolle--team')).not.toBeNull();
    expect(h.apiPost).toHaveBeenCalledWith('/teamer/badges/mark-seen');
  });

  it('dieselben Filter wie bei den Konfis', () => {
    render(<TeamerBadgesPage />);
    fireEvent.click(status('Offen'));
    expect(karten()).toEqual(['Zweites Jahr']);
  });

  it('im schmalen Fenster bleibt die App-Darstellung', () => {
    h.breit = false;
    const { container } = render(<TeamerBadgesPage />);
    expect(container.querySelector('.web-seite')).toBeNull();
    expect(screen.getByRole('tab', { name: 'In Arbeit' })).toBeInTheDocument();
  });
});
