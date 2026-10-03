import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act, cleanup, within } from '@testing-library/react';
import { MemoryRouter, Route } from 'react-router-dom';
import { IonApp, IonPage, IonRouterOutlet } from '@ionic/react';
import { IonReactMemoryRouter } from '@ionic/react-router';

// Web-Version mit der Leiste links (Simon, 02.10.2026; planung/web-version.md,
// Entscheidungen 1 und 9): im Browser ab 992 px eine ein- und ausklappbare
// Leiste statt der Reiterleiste unten. Die Apps auf iPhone und Android und
// das schmale Browserfenster bleiben, wie sie sind -- das ist der wichtigste
// Pruefpunkt dieser Datei.
//
// Gerendert mit den echten Bausteinen (Rahmen, Leiste, MainTabs); ersetzt
// sind nur die Plattform (Capacitor), die Fensterbreite (matchMedia), die
// Kontexte (Konto, Zahlen), der Alert und die Navigation von Ionic sowie die
// Seiten der Rollenbaeume (schlichte Attrappen statt der lazy-Seiten, die
// beim Rendern Daten laden wuerden). Reiter, `menue` und Profil der Baeume
// sind die echten.

// --- Plattform und Fensterbreite --------------------------------------------

const halter = vi.hoisted(() => ({ nativ: false, breit: false }));

vi.mock('@capacitor/core', async (importOriginal) => {
  const echt = await importOriginal<typeof import('@capacitor/core')>();
  return {
    ...echt,
    Capacitor: { ...echt.Capacitor, isNativePlatform: () => halter.nativ, getPlatform: () => (halter.nativ ? 'ios' : 'web') },
  };
});

// Wer auf die Fensterbreite hoert: unsere Leiste und Ionics Split-Pane
// (die bekommt wie im Browser ein Ereignis mit `matches`).
type Horcher = (ereignis: { matches: boolean }) => void;
const horcher = new Set<Horcher>();
const setzeBreite = (breit: boolean) => {
  halter.breit = breit;
  act(() => { horcher.forEach((h) => h({ matches: breit })); });
};

// --- Konto, Zahlen, Alert, Navigation ---------------------------------------

type Konto = { id: number; type: string; role_name: string; organization_id: number | null };
const KONTEN: Record<string, Konto> = {
  admin: { id: 4, type: 'admin', role_name: 'org_admin', organization_id: 1 },
  teamer: { id: 3, type: 'teamer', role_name: 'teamer', organization_id: 1 },
  konfi: { id: 7, type: 'konfi', role_name: 'konfi', organization_id: 1 },
  super_admin: { id: 99, type: 'admin', role_name: 'super_admin', organization_id: null },
};

const zustand = vi.hoisted(() => ({
  konto: null as unknown,
  organizations: [] as Array<{ id: number; name: string; display_name?: string; slug?: string; role_name?: string }>,
  zahlen: {
    chatUnreadTotal: 0, pendingRequestsCount: 0, pendingEventsCount: 0,
    pendingChallengesCount: 0, challengeUpdatesTotal: 0, newBadgesCount: 0,
  },
}));
const signOut = vi.fn(async () => undefined);
const push = vi.fn();

vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({
    user: zustand.konto,
    signOut,
    organizations: zustand.organizations,
    activeOrgId: null,
    switchOrg: vi.fn(),
  }),
}));

vi.mock('../../contexts/BadgeContext', () => ({ useBadge: () => zustand.zahlen }));
vi.mock('../../services/analytics', () => ({ bereichAusPfad: () => null, trackBereich: vi.fn() }));
vi.mock('../../services/api', () => ({ default: { get: vi.fn(async () => ({ data: {} })) } }));

interface AlertKnopf { text: string; role?: string; handler?: () => unknown }
let offenerAlert: { header?: string; buttons: AlertKnopf[] } | null = null;
const tippeAlertKnopf = async (text: string) => {
  const knopf = offenerAlert?.buttons.find((b) => b.text === text);
  if (!knopf) throw new Error(`Knopf "${text}" fehlt im Alert`);
  await act(async () => { await knopf.handler?.(); });
};

// Was der Rahmen der Split-Pane uebergibt. In jsdom kommen `when` und
// `contentId` nicht im Stencil-Element an (es behaelt seine Vorgabe) --
// deshalb wird hier mitgeschrieben, was React ihr reicht.
let splitPaneProps: Record<string, unknown> | null = null;

vi.mock('@ionic/react', async (importOriginal) => {
  const echt = await importOriginal<typeof import('@ionic/react')>();
  const EchteSplitPane = echt.IonSplitPane;
  return {
    ...echt,
    IonSplitPane: (props: React.ComponentProps<typeof EchteSplitPane>) => {
      splitPaneProps = props as Record<string, unknown>;
      return <EchteSplitPane {...props} />;
    },
    useIonAlert: () => [(o: { header?: string; buttons: AlertKnopf[] }) => { offenerAlert = o; }, vi.fn()],
    useIonRouter: () => ({ push, goBack: vi.fn(), canGoBack: () => false }),
  };
});

// Die Seiten der Baeume: eine schlichte IonPage je Route statt der lazy-Seite.
vi.mock('../../navigation/rollenBaeume', async (importOriginal) => {
  const echt = await importOriginal<typeof import('../../navigation/rollenBaeume')>();
  const Attrappe: React.FC = () => <IonPage><div data-testid="seite">Seite</div></IonPage>;
  const baeume = Object.fromEntries(
    Object.entries(echt.BAEUME).map(([rolle, baum]) => [
      rolle,
      { ...baum, routes: baum.routes.map((r) => ({ path: r.path, page: Attrappe })) },
    ])
  );
  return { ...echt, BAEUME: baeume };
});

import { BAEUME } from '../../navigation/rollenBaeume';
import type { Rolle } from '../../navigation/routes';
import SeitenleistenRahmen, { INHALT_ID } from '../../components/layout/SeitenleistenRahmen';
import Seitenleiste, { SCHLUESSEL_EINGEKLAPPT } from '../../components/layout/Seitenleiste';
import { aktiverPfad } from '../../navigation/routes';
import MainTabs from '../../components/layout/MainTabs';
import { BREITE_SEITENLEISTE, useBreitesLayout } from '../../navigation/breitesLayout';

const ROLLEN = Object.keys(BAEUME) as Rolle[];

beforeEach(() => {
  halter.nativ = false;
  halter.breit = false;
  horcher.clear();
  zustand.konto = KONTEN.admin;
  zustand.organizations = [];
  zustand.zahlen = {
    chatUnreadTotal: 0, pendingRequestsCount: 0, pendingEventsCount: 0,
    pendingChallengesCount: 0, challengeUpdatesTotal: 0, newBadgesCount: 0,
  };
  offenerAlert = null;
  splitPaneProps = null;
  signOut.mockClear();
  push.mockClear();
  localStorage.clear();
  window.matchMedia = vi.fn((abfrage: string) => ({
    get matches() { return abfrage === `(min-width: ${BREITE_SEITENLEISTE}px)` && halter.breit; },
    media: abfrage,
    onchange: null,
    addEventListener: (_: string, h: Horcher) => horcher.add(h),
    removeEventListener: (_: string, h: Horcher) => horcher.delete(h),
    addListener: (h: Horcher) => horcher.add(h),
    removeListener: (h: Horcher) => horcher.delete(h),
    dispatchEvent: () => true,
  })) as unknown as typeof window.matchMedia;
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// --- Helfer ------------------------------------------------------------------

/** Der Rahmen mit einem Platzhalter an der Stelle des Outlets. */
const zeigeRahmen = (pfad = '/admin/konfis') =>
  render(
    <MemoryRouter initialEntries={[pfad]}>
      <SeitenleistenRahmen>
        <div data-testid="outlet" />
      </SeitenleistenRahmen>
    </MemoryRouter>
  );

/** Die Leiste allein, auf einer Adresse. */
const zeigeLeiste = (pfad: string) =>
  render(
    <MemoryRouter initialEntries={[pfad]}>
      <Seitenleiste />
    </MemoryRouter>
  );

/**
 * Aufbau wie in App.tsx: Rahmen, Outlet, MainTabs. Wartet, bis die Seite
 * im inneren Outlet steht -- Ionic haengt sie asynchron ein.
 */
const zeigeApp = async (pfad: string) => {
  const ergebnis = render(
    <IonApp>
      <IonReactMemoryRouter initialEntries={[pfad]}>
        <SeitenleistenRahmen>
          <IonRouterOutlet>
            <Route path="/*" element={<MainTabs />} />
          </IonRouterOutlet>
        </SeitenleistenRahmen>
      </IonReactMemoryRouter>
    </IonApp>
  );
  await screen.findAllByTestId('seite');
  return ergebnis;
};

const leiste = () => screen.queryByRole('navigation', { name: 'Hauptnavigation' });
const linkNamen = (nav: HTMLElement) =>
  [...nav.querySelectorAll('a')].map((a) => a.querySelector('.app-seitenleiste__text')?.textContent);

// ---------------------------------------------------------------------------

describe('Die Leiste erscheint nur in der Web-Version im breiten Fenster', () => {
  it('Web, 992 px und breiter: Leiste links, das Outlet ist der Hauptbereich der Split-Pane', () => {
    halter.breit = true;
    const { container } = zeigeRahmen();
    expect(leiste()).not.toBeNull();
    const rahmen = container.querySelector('ion-split-pane') as HTMLElement;
    expect(rahmen).not.toBeNull();
    // Was der Rahmen Ionic uebergibt (jsdom reicht es nicht bis ins Element).
    expect(splitPaneProps).toMatchObject({ when: true, contentId: INHALT_ID });
    expect(screen.getByTestId('outlet').id).toBe(INHALT_ID);
    // Die Leiste steht vor dem Hauptbereich (links).
    expect(rahmen.firstElementChild?.tagName).toBe('NAV');
  });

  it('Web, schmales Fenster: keine Leiste; die Split-Pane steht trotzdem (zeigt aber nichts daneben)', () => {
    const { container } = zeigeRahmen();
    expect(leiste()).toBeNull();
    const rahmen = container.querySelector('ion-split-pane') as HTMLElement;
    expect(splitPaneProps).toMatchObject({ when: false, contentId: INHALT_ID });
    expect([...rahmen.children]).toEqual([screen.getByTestId('outlet')]);
  });

  it('App auf dem Geraet, auch breit (iPad quer): kein Rahmen, keine Leiste, das Outlet unveraendert', () => {
    halter.nativ = true;
    halter.breit = true;
    const { container } = zeigeRahmen();
    expect(leiste()).toBeNull();
    expect(container.querySelector('ion-split-pane')).toBeNull();
    // Derselbe Baum wie vor der Web-Version: das Outlet direkt, ohne Kennung.
    expect(container.firstElementChild).toBe(screen.getByTestId('outlet'));
    expect(screen.getByTestId('outlet').hasAttribute('id')).toBe(false);
  });

  it('Fenster ueber 992 px gezogen: die Leiste kommt, das Outlet bleibt dasselbe Element (kein Neumontieren)', () => {
    zeigeRahmen();
    const vorher = screen.getByTestId('outlet');
    expect(leiste()).toBeNull();

    setzeBreite(true);
    expect(leiste()).not.toBeNull();
    expect(screen.getByTestId('outlet')).toBe(vorher);

    setzeBreite(false);
    expect(leiste()).toBeNull();
    expect(screen.getByTestId('outlet')).toBe(vorher);
  });

  it('useBreitesLayout: nur Web und breit ergibt true', () => {
    const Anzeige: React.FC = () => <span data-testid="breit">{String(useBreitesLayout())}</span>;
    const faelle: Array<[boolean, boolean, string]> = [
      [false, true, 'true'], [false, false, 'false'], [true, true, 'false'], [true, false, 'false'],
    ];
    for (const [nativ, breit, erwartet] of faelle) {
      halter.nativ = nativ;
      halter.breit = breit;
      const { unmount } = render(<Anzeige />);
      expect(screen.getByTestId('breit').textContent, `nativ=${nativ} breit=${breit}`).toBe(erwartet);
      unmount();
    }
  });
});

describe('Reiterleiste oder Leiste -- nie beide, nie keine (Aufbau wie App.tsx)', () => {
  const reiterleiste = (container: HTMLElement) => container.querySelector('ion-tab-bar');

  it('Web, schmal: Reiterleiste unten wie bisher, keine Leiste', async () => {
    const { container } = await zeigeApp('/admin/konfis');
    expect(reiterleiste(container)).not.toBeNull();
    expect([...container.querySelectorAll('ion-tab-button')].map((b) => b.getAttribute('tab')))
      .toEqual(BAEUME.admin.tabs.map((t) => t.tab));
    expect(leiste()).toBeNull();
  });

  it('App auf dem Geraet, breit: Reiterleiste wie bisher, keine Leiste, kein Rahmen', async () => {
    halter.nativ = true;
    halter.breit = true;
    zustand.konto = KONTEN.teamer;
    const { container } = await zeigeApp('/teamer/dashboard');
    expect([...container.querySelectorAll('ion-tab-button')].map((b) => b.getAttribute('tab')))
      .toEqual(BAEUME.teamer.tabs.map((t) => t.tab));
    expect(leiste()).toBeNull();
    expect(container.querySelector('ion-split-pane')).toBeNull();
    // Das Outlet der App haengt wie vor der Web-Version direkt in ion-app.
    expect(container.querySelector('ion-app > ion-router-outlet')).not.toBeNull();
  });

  it('Web, breit: Leiste links, keine Reiterleiste', async () => {
    halter.breit = true;
    const { container } = await zeigeApp('/admin/konfis');
    expect(leiste()).not.toBeNull();
    expect(reiterleiste(container)).toBeNull();
  });

  it('Fenster wird schmal und wieder breit: Reiterleiste und Leiste wechseln, die Seite bleibt dieselbe', async () => {
    halter.breit = true;
    const { container } = await zeigeApp('/admin/konfis');
    const seite = screen.getByTestId('seite');

    setzeBreite(false);
    expect(reiterleiste(container)).not.toBeNull();
    expect(leiste()).toBeNull();

    setzeBreite(true);
    expect(reiterleiste(container)).toBeNull();
    expect(leiste()).not.toBeNull();
    // Kein Neumontieren der Seite beim Ziehen des Fensters.
    expect(screen.getByTestId('seite')).toBe(seite);
  });
});

describe('Eintraege je Rolle aus den Rollenbaeumen', () => {
  it.each(ROLLEN)('%s: Reiter, dann menue, unten Profil -- in dieser Reihenfolge', (rolle) => {
    zustand.konto = KONTEN[rolle];
    zeigeLeiste(BAEUME[rolle].home);
    const baum = BAEUME[rolle];
    const erwartet = [
      ...baum.tabs.map((t) => t.label),
      ...(baum.menue ?? []).map((m) => m.label),
      ...(baum.profil ? [baum.profil.label] : []),
    ];
    expect(erwartet.length).toBeGreaterThan(0);
    expect(linkNamen(leiste()!)).toEqual(erwartet);
    // Jeder Link fuehrt dorthin, wo der Baum es sagt -- echte Adressen.
    const ziele = [...leiste()!.querySelectorAll('a')].map((a) => a.getAttribute('href'));
    expect(ziele).toEqual([
      ...baum.tabs.map((t) => t.href),
      ...(baum.menue ?? []).map((m) => m.path),
      ...(baum.profil ? [baum.profil.path] : []),
    ]);
  });

  it('super_admin (ohne Reiter): die Bereiche der Support-Ansicht, kein Profil', () => {
    // Nach dem Zusammenfuehren mit der Support-Ansicht (Paket C, 03.10.2026)
    // traegt der Baum super_admin die sechs Bereiche aus supportMenue.ts.
    zustand.konto = KONTEN.super_admin;
    zeigeLeiste('/admin/support');
    expect(linkNamen(leiste()!)).toEqual(['Übersicht', 'Anfragen', 'Gemeinden', 'Struktur', 'Support-Konten', 'Betrieb']);
  });

  it('Eintraege mit Gruppe stehen unter ihrer Ueberschrift, ohne Gruppe direkt unter den Reitern', () => {
    const vorher = BAEUME.super_admin.menue;
    BAEUME.super_admin.menue = [
      { path: '/admin/organizations', label: 'Gemeinden', icon: 'x' },
      { path: '/admin/metrics', label: 'Betrieb', icon: 'x', gruppe: 'Support' },
    ];
    try {
      zustand.konto = KONTEN.super_admin;
      zeigeLeiste('/admin/organizations');
      const ueberschrift = screen.getByRole('heading', { name: 'Support' });
      const gruppe = ueberschrift.parentElement as HTMLElement;
      expect(within(gruppe).getAllByRole('link').map((a) => a.getAttribute('href'))).toEqual(['/admin/metrics']);
      expect(linkNamen(leiste()!)).toEqual(['Gemeinden', 'Betrieb']);
    } finally {
      BAEUME.super_admin.menue = vorher;
    }
  });

  it('der aktive Eintrag traegt aria-current, genau einer -- beim Team Material, nicht Profil', () => {
    zustand.konto = KONTEN.teamer;
    zeigeLeiste('/teamer/profile/material');
    const aktiv = leiste()!.querySelectorAll('[aria-current="page"]');
    expect(aktiv).toHaveLength(1);
    expect(aktiv[0].getAttribute('href')).toBe('/teamer/profile/material');
    expect(aktiv[0].classList.contains('app-seitenleiste__link--aktiv')).toBe(true);
  });

  it('auf einer Detailseite ist ihr Bereich aktiv; auf einer Seite ohne Eintrag keiner', () => {
    expect(aktiverPfad('/admin/konfis/42', ['/admin/konfis', '/admin/chat'])).toBe('/admin/konfis');
    expect(aktiverPfad('/teamer/profile/badges', ['/teamer/profile/material', '/teamer/profile'])).toBe('/teamer/profile');
    expect(aktiverPfad('/admin/users', ['/admin/konfis', '/admin/settings'])).toBeNull();
    // Kein Treffer ueber ein halbes Wort: /admin/konfis2 gehoert nicht zu /admin/konfis.
    expect(aktiverPfad('/admin/konfis2', ['/admin/konfis'])).toBeNull();
  });
});

describe('Klick, Tastatur und neuer Tab', () => {
  it('ein Klick bleibt in der App: Wechsel ohne Neuladen, ohne Animation', () => {
    zeigeLeiste('/admin/konfis');
    const chat = screen.getByRole('link', { name: 'Chat' });
    const ereignis = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
    act(() => { chat.dispatchEvent(ereignis); });
    expect(ereignis.defaultPrevented).toBe(true);
    expect(push).toHaveBeenCalledWith('/admin/chat', 'none', 'push');
  });

  it('Strg-, Cmd- und Mittelklick ueberlaesst die App dem Browser (neuer Tab)', () => {
    zeigeLeiste('/admin/konfis');
    const chat = screen.getByRole('link', { name: 'Chat' });
    for (const art of [{ ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { button: 1 }]) {
      const ereignis = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ...art });
      act(() => { chat.dispatchEvent(ereignis); });
      expect(ereignis.defaultPrevented, JSON.stringify(art)).toBe(false);
    }
    expect(push).not.toHaveBeenCalled();
  });

  it('der aktuelle Eintrag selbst navigiert nicht noch einmal', () => {
    zeigeLeiste('/admin/konfis');
    fireEvent.click(screen.getByRole('link', { name: 'Konfis' }));
    expect(push).not.toHaveBeenCalled();
  });

  it('alles ist per Tab erreichbar: echte Links und Knoepfe, nichts mit tabIndex -1', () => {
    zeigeLeiste('/admin/konfis');
    const nav = leiste()!;
    const bedienbar = [...nav.querySelectorAll('a, button')];
    expect(bedienbar.length).toBe(BAEUME.admin.tabs.length + 1 /* Profil */ + 2 /* Umschalter, Abmelden */);
    for (const el of bedienbar) {
      expect(el.getAttribute('tabindex')).not.toBe('-1');
      if (el.tagName === 'A') expect(el.getAttribute('href')).toMatch(/^\//);
    }
  });
});

describe('Zahlen an den Eintraegen: dieselbe Quelle wie die Reiterleiste', () => {
  const zahlen = {
    chatUnreadTotal: 3, pendingRequestsCount: 1, pendingEventsCount: 2,
    pendingChallengesCount: 12, challengeUpdatesTotal: 0, newBadgesCount: 5,
  };

  /** Beschriftung -> Zahl, wie sie an Reiter bzw. Eintrag steht. */
  const zahlenDerReiter = (container: HTMLElement) =>
    Object.fromEntries([...container.querySelectorAll('ion-tab-button')]
      .filter((b) => b.querySelector('ion-badge'))
      .map((b) => [b.querySelector('ion-label')?.textContent, b.querySelector('ion-badge')?.textContent]));
  const zahlenDerLeiste = (nav: HTMLElement) =>
    Object.fromEntries([...nav.querySelectorAll('a')]
      .filter((a) => a.querySelector('ion-badge'))
      .map((a) => [a.querySelector('.app-seitenleiste__text')?.textContent, a.querySelector('ion-badge')?.textContent]));

  // Je Rolle: was die Reiterleiste im schmalen Fenster zeigt, zeigt die
  // Leiste im breiten -- Eintrag fuer Eintrag.
  const ERWARTET: Record<string, Record<string, string>> = {
    // Mitmachen = Events (2) + Antraege (1); Challenges 12 -> "9+".
    admin: { Chat: '3', Mitmachen: '3', Challenges: '9+' },
    // Beim Team traegt Mitmachen keinen Zaehler (rollenBaeume.ts).
    teamer: { Chat: '3', Challenges: '9+' },
    konfi: { Chat: '3', Challenges: '9+', Badges: '5' },
  };

  it.each(['admin', 'teamer', 'konfi'] as const)('%s: an Reitern und Leiste dieselben Zahlen', async (rolle) => {
    zustand.zahlen = zahlen;
    zustand.konto = KONTEN[rolle];
    const schmal = await zeigeApp(BAEUME[rolle].home);
    const reiter = zahlenDerReiter(schmal.container);
    cleanup();

    halter.breit = true;
    await zeigeApp(BAEUME[rolle].home);
    const inLeiste = zahlenDerLeiste(leiste()!);

    expect(reiter).toEqual(ERWARTET[rolle]);
    expect(inLeiste).toEqual(reiter);
  });

  it('die Zahl steht fuer Vorleseprogramme als Wort im Link', () => {
    zustand.zahlen = zahlen;
    zeigeLeiste('/admin/konfis');
    const chat = screen.getByRole('link', { name: 'Chat, 3 offen' });
    expect(chat.getAttribute('href')).toBe('/admin/chat');
    // Ohne Zahl kein Zusatz.
    expect(screen.getByRole('link', { name: 'Konfis' })).not.toBeNull();
  });

  it('ohne offene Vorgaenge keine rote Zahl', () => {
    zeigeLeiste('/admin/konfis');
    expect(leiste()!.querySelectorAll('ion-badge')).toHaveLength(0);
  });
});

describe('Ein- und Ausklappen, je Browser gemerkt', () => {
  const umschalter = () => screen.getByRole('button', { name: /Leiste (ein|aus)klappen/ });

  it('eingeklappt: nur Symbole, Namen als Tooltip; der Zustand steht im Speicher des Browsers', () => {
    zeigeLeiste('/admin/konfis');
    expect(umschalter().getAttribute('aria-expanded')).toBe('true');
    expect(leiste()!.classList.contains('app-seitenleiste--eingeklappt')).toBe(false);
    expect(screen.getByRole('link', { name: 'Chat' }).getAttribute('title')).toBeNull();

    fireEvent.click(umschalter());
    expect(leiste()!.classList.contains('app-seitenleiste--eingeklappt')).toBe(true);
    expect(umschalter().getAttribute('aria-expanded')).toBe('false');
    expect(umschalter().getAttribute('aria-label')).toBe('Leiste ausklappen');
    // Name bleibt fuer Vorleseprogramme im Link, sichtbar als Tooltip.
    expect(screen.getByRole('link', { name: 'Chat' }).getAttribute('title')).toBe('Chat');
    expect(screen.getByRole('button', { name: 'Abmelden' }).getAttribute('title')).toBe('Abmelden');
    expect(localStorage.getItem(SCHLUESSEL_EINGEKLAPPT)).toBe('1');
  });

  it('nach dem Neuladen bleibt sie eingeklappt; Ausklappen merkt sich ebenfalls', () => {
    localStorage.setItem(SCHLUESSEL_EINGEKLAPPT, '1');
    const { unmount } = zeigeLeiste('/admin/konfis');
    expect(leiste()!.classList.contains('app-seitenleiste--eingeklappt')).toBe(true);
    fireEvent.click(umschalter());
    expect(localStorage.getItem(SCHLUESSEL_EINGEKLAPPT)).toBe('0');
    unmount();
    zeigeLeiste('/admin/konfis');
    expect(leiste()!.classList.contains('app-seitenleiste--eingeklappt')).toBe(false);
  });

  it('ohne nutzbaren Speicher (privates Fenster): ausgeklappt, Umschalten geht trotzdem', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('SecurityError'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('SecurityError'); });
    zeigeLeiste('/admin/konfis');
    expect(leiste()!.classList.contains('app-seitenleiste--eingeklappt')).toBe(false);
    fireEvent.click(umschalter());
    expect(leiste()!.classList.contains('app-seitenleiste--eingeklappt')).toBe(true);
  });
});

describe('Abmelden ist in jedem Baum erreichbar', () => {
  it.each(ROLLEN)('%s: Abmelden fragt nach und meldet ab', async (rolle) => {
    zustand.konto = KONTEN[rolle];
    zeigeLeiste(BAEUME[rolle].home);
    fireEvent.click(within(leiste()!).getByRole('button', { name: 'Abmelden' }));
    expect(offenerAlert?.header).toBe('Abmelden');
    expect(signOut).not.toHaveBeenCalled();
    await tippeAlertKnopf('Abbrechen');
    expect(signOut).not.toHaveBeenCalled();
    await tippeAlertKnopf('Abmelden');
    expect(signOut).toHaveBeenCalledTimes(1);
  });
});

describe('Gemeinde-Umschalter in der Leiste', () => {
  it('erscheint bei mehreren Gemeinden (derselbe Knopf wie in der Kopfzeile)', () => {
    zustand.organizations = [
      { id: 1, name: 'Kirchspiel West', slug: 'kirchspiel-west', role_name: 'org_admin' },
      { id: 2, name: 'Kirchengemeinde Heide', slug: 'kirchengemeinde-heide', role_name: 'admin' },
    ];
    zeigeLeiste('/admin/konfis');
    expect(leiste()!.querySelector('.app-org-switcher-btn')).not.toBeNull();
  });

  it('fehlt bei nur einer Gemeinde', () => {
    zustand.organizations = [{ id: 1, name: 'Kirchspiel West', slug: 'kirchspiel-west' }];
    zeigeLeiste('/admin/konfis');
    expect(leiste()!.querySelector('.app-org-switcher-btn')).toBeNull();
  });
});
