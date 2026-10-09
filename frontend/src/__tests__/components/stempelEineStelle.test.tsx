// Stempel: EINE Komponente fuer Konfi, Leitung und Team (16.09.2026)
//
// DER BEFUND (Simon am Geraet, woertlich):
//   "aber die nicht erreichten sind nicht da, und bei klick gibt es keine
//    infos, obwohl wir das ja bei konfis und admins laengst haben, das darf
//    doch auch an nur einer stelle programmiert werden"
//
// Gemeint war der Challenges-Tab beim Team. Zwei Maengel und eine Ansage:
//   1. Noch nicht erreichte Stempel fehlten ganz (bei Konfis stehen sie grau).
//   2. Ein Tipp auf einen Stempel zeigte keine Infos, obwohl es das
//      Stempel-Popover bei Konfis und in der Leitungs-Detailansicht gibt.
//   3. Die Ansage: EINE Stelle, nicht drei Kopien.
//
// URSACHE: admin/views/ChallengesManageView.tsx baute die Stempelreihe von
// HAND mit einem rohen KachelRaster -- ohne offeneStempel, ohne
// onKachelClick. Leitung UND Team kommen beide ueber shared/ChallengesPage
// dorthin, also fehlte beiden dasselbe.
//
// GEPRUEFT WIRD (seit 09.10.2026 gerendert): die Challenge-Seite des Teams
// und der Leitung -- echte Seite, echte Liste, echte Stempel-Komponente; nur
// Server, Anmeldung und Zaehler sind nachgestellt. Graue Kacheln fuer das,
// was noch zu holen ist, ein Popover beim Antippen, und die Regel, dass nur
// laufende und vergangene Challenges ins Raster kommen.
//
// WAECHTER (bleibt Quelltext): die Ansage "eine Stelle". Eine vierte Kopie,
// die zufaellig dasselbe tut, saehe im DOM gleich aus -- nur der Quelltext
// zeigt, dass alle drei Ansichten DIESELBE Komponente aufrufen.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, fireEvent, cleanup, act } from '@testing-library/react';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const { praesentiere, popoverDaten, antworten, stabil } = vi.hoisted(() => ({
  praesentiere: vi.fn(),
  popoverDaten: { ref: null as { current: unknown } | null },
  antworten: new Map<string, unknown>(),
  stabil: {
    user: { id: 4, type: 'teamer', organization_id: 1 } as { id: number; type: string; organization_id: number },
    setError: () => {},
    setSuccess: () => {},
  },
}));

vi.mock('@ionic/react', async (original) => ({
  ...(await original<typeof import('@ionic/react')>()),
  useIonRouter: () => ({ push: vi.fn() }),
  // Das Popover selbst hat eigene Tests (stempelPopover.test.tsx). Hier
  // zaehlt: Die Kachel oeffnet es, und es bekommt den angetippten Stempel.
  useIonPopover: (_komponente: unknown, props: { dataRef: { current: unknown } }) => {
    popoverDaten.ref = props.dataRef;
    return [praesentiere, vi.fn()];
  },
}));
vi.mock('../../services/api', () => ({
  default: {
    get: async (pfad: string) => ({ data: antworten.get(pfad) ?? [], headers: {} }),
    post: vi.fn(), put: vi.fn(), delete: vi.fn(),
  },
}));
// Zwischenspeicher nachgestellt: Die Seite holt ihre Daten ueber die echte
// Abruf-Funktion -- so ist auch geprueft, WELCHE Route sie ruft.
vi.mock('../../hooks/useOfflineQuery', async () => {
  const R = await import('react');
  return {
    useOfflineQuery: (schluessel: string, holen: () => Promise<unknown>) => {
      const [data, setData] = R.useState<unknown>(null);
      R.useEffect(() => { void holen().then(setData); }, [schluessel]);
      return { data, loading: false, error: null, isStale: false, isOffline: false, refresh: vi.fn(), refreshLive: vi.fn() };
    },
  };
});
vi.mock('../../contexts/AppContext', () => ({ useApp: () => stabil }));
vi.mock('../../contexts/BadgeContext', () => ({
  useBadge: () => ({
    challengeUpdatesByChallenge: {},
    pendingChallengesByChallenge: {},
    challengeNeueBeitraegeByChallenge: {},
    challengeNeueWartendByChallenge: {},
  }),
}));
vi.mock('../../contexts/ModalContext', () => ({
  useModalPage: () => ({ pageRef: { current: null }, presentingElement: undefined }),
}));
vi.mock('../../contexts/LiveUpdateContext', () => ({ useLiveRefresh: () => {} }));
vi.mock('../../components/shared/AppKopfzeile', () => ({
  default: () => null,
  AppKopfzeileGross: () => null,
}));

import TeamerChallengesPage from '../../components/teamer/pages/TeamerChallengesPage';
import AdminChallengesPage from '../../components/admin/pages/AdminChallengesPage';
import { gehoertInsStempelraster } from '../../components/shared/ChallengesPage';

const tag = 24 * 60 * 60 * 1000;
const challenge = (id: number, ueber: Record<string, unknown>) => ({
  id,
  title: `Challenge ${id}`,
  description: `Beschreibung ${id}`,
  visibility: 'public',
  audience: 'konfis_und_team',
  moderated: false,
  allow_multiple: false,
  allowed_media: ['text'],
  is_draft: false,
  starts_at: new Date(Date.now() - 7 * tag).toISOString(),
  ends_at: new Date(Date.now() + 7 * tag).toISOString(),
  badge_icon: 'leaf',
  has_badge: false,
  ...ueber,
});

const LISTE = [
  challenge(1, { badge_name: 'Gesammelt', has_badge: true, earned_at: '2026-09-01T10:00:00Z' }),
  challenge(2, { badge_name: 'Noch offen' }),
  challenge(3, { badge_name: null }),
  // Vergangen und nicht erreicht: bleibt grau stehen ("ob erreicht oder nicht").
  challenge(4, { badge_name: 'Verpasst', starts_at: new Date(Date.now() - 30 * tag).toISOString(), ends_at: new Date(Date.now() - 14 * tag).toISOString() }),
  // Entwurf -- selbst mit vergebenem Stempel (Altdaten) nicht im Raster.
  challenge(5, { badge_name: 'Entwurfsstempel', is_draft: true, has_badge: true }),
  // Geplant -- beginnt naechste Woche, gehoert nicht ins Raster.
  challenge(6, { badge_name: 'Geplanter Stempel', starts_at: new Date(Date.now() + 7 * tag).toISOString(), ends_at: new Date(Date.now() + 14 * tag).toISOString() }),
];

const kacheln = (container: HTMLElement) =>
  [...container.querySelectorAll('.app-kachel')].map((k) => ({
    name: k.querySelector('.app-kachel__name')?.getAttribute('title') ?? '',
    grau: k.classList.contains('app-kachel--gesperrt'),
    el: k as HTMLElement,
  }));

const oeffne = async (Seite: React.FC) => {
  const r = render(<Seite />);
  for (let i = 0; i < 4; i += 1) await act(async () => { await Promise.resolve(); });
  return r;
};

beforeEach(() => {
  praesentiere.mockReset();
  popoverDaten.ref = null;
  antworten.clear();
  antworten.set('/challenges/admin', LISTE);
  antworten.set('/challenges/bewahrte-stempel', []);
  stabil.user = { id: 4, type: 'teamer', organization_id: 1 };
});
afterEach(() => cleanup());

const ohneKommentare = (quelle: string) =>
  quelle.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
const lies = (pfad: string) => ohneKommentare(readFileSync(resolve(__dirname, '../../', pfad), 'utf-8'));

describe('Stempel stehen an einer Stelle (Waechter)', () => {
  const manage = lies('components/admin/views/ChallengesManageView.tsx');
  const konfi = lies('components/konfi/views/ChallengesView.tsx');
  const detail = lies('components/admin/views/KonfiDetailView.tsx');

  it('alle drei Ansichten rufen ChallengeStempelSektion auf', () => {
    expect(manage).toMatch(/<ChallengeStempelSektion/);
    expect(konfi).toMatch(/<ChallengeStempelSektion/);
    expect(detail).toMatch(/<ChallengeStempelSektion/);
  });

  it('ChallengesManageView baut die Stempelreihe nicht mehr selbst', () => {
    expect(manage).not.toMatch(/<KachelRaster/);
    expect(manage).not.toMatch(/import KachelRaster/);
  });
});

describe('Challenge-Seite von Team und Leitung: erhaltene und offene Stempel', () => {
  it('Team: erhaltene farbig, offene grau -- aus derselben Liste abgeleitet', async () => {
    const { container } = await oeffne(TeamerChallengesPage);
    const k = kacheln(container);
    expect(k.map(({ name, grau }) => [name, grau])).toEqual([
      ['Gesammelt', false],
      ['Noch offen', true],
      ['Verpasst', true],
    ]);
  });

  it('Leitung: dieselbe Seite, dieselben Kacheln', async () => {
    stabil.user = { id: 5, type: 'admin', organization_id: 1 };
    const { container } = await oeffne(AdminChallengesPage);
    expect(kacheln(container).map(({ name, grau }) => [name, grau])).toEqual([
      ['Gesammelt', false],
      ['Noch offen', true],
      ['Verpasst', true],
    ]);
  });

  it('eine Challenge ohne Stempelnamen bekommt keine Kachel', async () => {
    const { container } = await oeffne(TeamerChallengesPage);
    expect(kacheln(container).some((k) => k.name === '')).toBe(false);
    expect(kacheln(container)).toHaveLength(3);
  });

  it('nur offene Stempel: der Abschnitt steht trotzdem, statt "Noch keine Stempel" zu behaupten', async () => {
    antworten.set('/challenges/admin', [challenge(2, { badge_name: 'Noch offen' })]);
    const { container, queryByText } = await oeffne(TeamerChallengesPage);
    expect(kacheln(container).map(({ name, grau }) => [name, grau])).toEqual([['Noch offen', true]]);
    expect(queryByText('Deine Stempel')).not.toBeNull();
  });
});

// Bewahrte Stempel (28.09.2026, utils/bewahrteStempel.ts): Loescht die
// Leitung einen Jahrgang, gehen Challenges mit, die nur an ihm hingen. Ihre
// Stempel liefert der Server aus einer eigenen Route; die Seite haengt sie an
// die abgeleiteten an. Die Funktion selbst und die Detailansicht der Leitung
// prueft utils/bewahrteStempel.test.tsx.
describe('Challenge-Seite ("Deine Stempel"): bewahrte Stempel stehen neben den lebenden', () => {
  it('holt sie ueber die eigene Route und zeigt sie farbig hinter den erhaltenen', async () => {
    antworten.set('/challenges/bewahrte-stempel', [
      { challenge_id: 77, badge_icon: 'leaf', badge_name: 'Aus altem Jahrgang', title: 'Geloeschte Challenge', bewahrt: true },
    ]);
    const { container } = await oeffne(TeamerChallengesPage);
    expect(kacheln(container).map(({ name, grau }) => [name, grau])).toEqual([
      ['Gesammelt', false],
      ['Aus altem Jahrgang', false],
      ['Noch offen', true],
      ['Verpasst', true],
    ]);
  });

  it('derselbe Stempel steht nie doppelt -- die lebende Fassung gewinnt', async () => {
    antworten.set('/challenges/bewahrte-stempel', [
      { challenge_id: 1, badge_icon: 'leaf', badge_name: 'Alte Fassung', title: 'Challenge 1', bewahrt: true },
    ]);
    const { container } = await oeffne(TeamerChallengesPage);
    const namen = kacheln(container).map((k) => k.name);
    expect(namen).toEqual(['Gesammelt', 'Noch offen', 'Verpasst']);
  });
});

describe('Ein Tipp auf einen Stempel oeffnet sein Popover', () => {
  it('ein grauer Stempel: Popover mit dem offenen Stempel, als nicht erhalten', async () => {
    const { container } = await oeffne(TeamerChallengesPage);
    const offen = kacheln(container).find((k) => k.name === 'Noch offen')!;
    fireEvent.click(offen.el);
    expect(praesentiere).toHaveBeenCalledTimes(1);
    expect(popoverDaten.ref?.current).toEqual({
      erhalten: false,
      stempel: expect.objectContaining({ challenge_id: 2, badge_name: 'Noch offen', title: 'Challenge 2', description: 'Beschreibung 2' }),
    });
  });

  it('ein erhaltener Stempel: Popover als erhalten, mit Datum', async () => {
    const { container } = await oeffne(TeamerChallengesPage);
    fireEvent.click(kacheln(container).find((k) => k.name === 'Gesammelt')!.el);
    expect(praesentiere).toHaveBeenCalledTimes(1);
    expect(popoverDaten.ref?.current).toEqual({
      erhalten: true,
      stempel: expect.objectContaining({ challenge_id: 1, badge_name: 'Gesammelt', earned_at: '2026-09-01T10:00:00Z' }),
    });
  });
});

// Stempel nur fuer laufende oder vergangene Challenges (Befund Simon, 18.09.2026)
//
//   "er zeigt mir, zumindest im admin, challenge stempel an, die noch auf
//    entwurf oder geplant stehen. dass man die erreichen koennte. stempel
//    duerfen nur fuer laufende oder vergangene angezeigt werden. ob erreicht
//    oder nicht."
//
// WARUM NUR IM ADMIN: Die Konfi-Ansicht bekommt ihre Liste aus
// GET /challenges/konfi, und das SQL filtert dort `is_draft = false AND
// starts_at <= NOW()`. Die Leitungs- und Team-Ansicht leitet die Stempel
// dagegen im Frontend aus GET /challenges/admin ab -- und das liefert
// absichtlich JEDE Challenge, damit sich Entwuerfe bearbeiten lassen.
describe('Stempelraster zeigt nur laufende und vergangene Challenges', () => {
  // Fester Bezugspunkt: 18.09.2026, 12:00.
  const JETZT = new Date(2026, 8, 18, 12, 0).getTime();
  const tage = (n: number) => new Date(JETZT + n * 24 * 60 * 60 * 1000).toISOString();

  const fall = (ueber: Record<string, unknown>) =>
    ({ is_draft: false, starts_at: tage(-7), ends_at: tage(7), ...ueber }) as never;

  it('VERBOTEN: ein Entwurf gehoert nicht ins Raster', () => {
    expect(gehoertInsStempelraster(fall({ is_draft: true }), JETZT)).toBe(false);
  });

  it('VERBOTEN: eine geplante Challenge, die erst naechste Woche beginnt', () => {
    expect(gehoertInsStempelraster(fall({ starts_at: tage(7), ends_at: tage(14) }), JETZT)).toBe(false);
  });

  it('VERBOTEN: ein Entwurf bleibt es auch, wenn sein Zeitraum laeuft', () => {
    // is_draft schlaegt das Datum -- so rechnet auch deriveStatus im Backend.
    expect(gehoertInsStempelraster(fall({ is_draft: true, starts_at: tage(-1), ends_at: tage(1) }), JETZT)).toBe(false);
  });

  it('ERLAUBT: eine laufende Challenge', () => {
    expect(gehoertInsStempelraster(fall({}), JETZT)).toBe(true);
  });

  it('ERLAUBT: eine vergangene Challenge', () => {
    // Auch abgelaufene Stempel bleiben sichtbar -- "ob erreicht oder nicht".
    expect(gehoertInsStempelraster(fall({ starts_at: tage(-30), ends_at: tage(-14) }), JETZT)).toBe(true);
  });

  it('ERLAUBT: eine Challenge, die gerade eben begonnen hat', () => {
    expect(gehoertInsStempelraster(fall({ starts_at: new Date(JETZT - 1000).toISOString() }), JETZT)).toBe(true);
  });

  it('die Regel gilt auf der Seite fuer ERHALTENE Stempel genauso wie fuer offene', async () => {
    // Sonst verschwaende ein Entwurf zwar aus der grauen Reihe, ein
    // versehentlich schon vergebener Stempel bliebe aber farbig stehen.
    const { container } = await oeffne(TeamerChallengesPage);
    const namen = kacheln(container).map((k) => k.name);
    expect(namen).not.toContain('Entwurfsstempel');
    expect(namen).not.toContain('Geplanter Stempel');
  });
});
