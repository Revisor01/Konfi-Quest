import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, cleanup, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Der Gemeinde-Umschalter unten in der Leiste der Web-Version (Simon,
// 03.10.2026: „unten in der Navi links darf der schon gestylt sein"): eine
// Flaeche mit Symbol, vollem Namen, Rolle dort und Pfeil; die Liste klappt
// nach oben auf, wird per Tastatur bedient und traegt die rote Zahl je
// Gemeinde. Gerendert wird die echte Komponente samt echtem Hook; ersetzt sind
// nur das Konto (AppContext), die Antwort des Servers und die Navigation.

const h = vi.hoisted(() => ({
  push: vi.fn(),
  switchOrg: vi.fn(),
  apiGet: vi.fn(),
  app: {
    organizations: [] as Array<{ id: number; name: string; role_name: string; display_name?: string }>,
    activeOrgId: null as number | null,
    user: { organization_id: 1 } as { organization_id?: number } | null,
  },
}));

vi.mock('@ionic/react', async (importOriginal) => {
  const echt = await importOriginal<typeof import('@ionic/react')>();
  return { ...echt, useIonRouter: () => ({ push: h.push, goBack: vi.fn(), canGoBack: () => false }) };
});
vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({ ...h.app, switchOrg: h.switchOrg }),
}));
vi.mock('../../services/api', () => ({ default: { get: h.apiGet } }));

import LeistenGemeinde from '../../components/layout/LeistenGemeinde';

const lies = (relativ: string) => readFileSync(join(process.cwd(), relativ), 'utf8');

const LANGER_NAME = 'Evangelisch-Lutherische Kirchengemeinde Musterdorf-Beispielstadt am See';

const GEMEINDEN = [
  { id: 1, name: 'kirchspiel-west', display_name: 'Kirchspiel West', role_name: 'org_admin' },
  { id: 2, name: 'Kirchengemeinde Heide', role_name: 'teamer' },
  { id: 3, name: 'musterdorf', display_name: LANGER_NAME, role_name: 'konfi' },
  { id: 4, name: 'Kirchengemeinde Beispielstadt', role_name: 'admin' },
];

const knopf = () => screen.getByRole('button', { name: /^Gemeinde wechseln/ });
const eintraege = () => screen.queryAllByRole('menuitemradio');
const oeffnen = () => { fireEvent.click(knopf()); };
const zeigeLeiste = (eingeklappt = false) => render(<LeistenGemeinde eingeklappt={eingeklappt} />);

beforeEach(() => {
  h.push.mockReset();
  h.switchOrg.mockReset();
  h.switchOrg.mockResolvedValue({ ok: true });
  h.apiGet.mockReset();
  h.apiGet.mockResolvedValue({ data: { jeOrganisation: {} } });
  h.app.organizations = GEMEINDEN;
  h.app.activeOrgId = null;
  h.app.user = { organization_id: 1 };
});

afterEach(() => {
  cleanup();
});

describe('Die Flaeche am Fuss der Leiste', () => {
  it('zeigt Symbol, vollen Namen der aktiven Gemeinde und die Rolle dort', () => {
    zeigeLeiste();
    const k = knopf();
    expect(k.querySelector('.app-leistengemeinde__symbol')?.textContent).toBe('W');
    expect(k.querySelector('.app-leistengemeinde__name')?.textContent).toBe('Kirchspiel West');
    expect(k.querySelector('.app-leistengemeinde__rolle')?.textContent).toBe('Gemeindeleitung');
    expect(k.getAttribute('aria-label')).toBe('Gemeinde wechseln, gerade Kirchspiel West, Gemeindeleitung');
    expect(k.getAttribute('aria-haspopup')).toBe('menu');
    expect(k.getAttribute('aria-expanded')).toBe('false');
  });

  it('der volle Name steht auch bei Ueberlaenge im Text und als title -- die Ellipse kuerzt nur die Darstellung', () => {
    h.app.activeOrgId = 3;
    zeigeLeiste();
    const k = knopf();
    expect(k.querySelector('.app-leistengemeinde__name')?.textContent).toBe(LANGER_NAME);
    expect(k.getAttribute('title')).toBe(LANGER_NAME);
    expect(k.querySelector('.app-leistengemeinde__rolle')?.textContent).toBe('Konfi');
    // Das Symbol traegt den Ort, nicht das Vorwort.
    expect(k.querySelector('.app-leistengemeinde__symbol')?.textContent).toBe('M');
  });

  it.each([
    [1, 'Gemeindeleitung'],
    [2, 'Teamer:in'],
    [3, 'Konfi'],
    [4, 'Leitung'],
  ])('Gemeinde %i: die Rolle dort heisst %s', (id, rolle) => {
    h.app.activeOrgId = id;
    zeigeLeiste();
    expect(knopf().querySelector('.app-leistengemeinde__rolle')?.textContent).toBe(rolle);
  });

  it('das Symbol traegt die Farbe der Rolle dort -- aus den Tokens, nicht aus Farbwerten', () => {
    h.app.activeOrgId = 2;
    zeigeLeiste();
    const symbol = knopf().querySelector('.app-leistengemeinde__symbol') as HTMLElement;
    expect(symbol.style.getPropertyValue('--app-leistengemeinde-farbe')).toBe('var(--app-color-teamer)');
    expect(symbol.getAttribute('aria-hidden')).toBe('true');
  });

  it('bei nur einer Gemeinde und ohne Gemeinden gibt es nichts zu zeigen', () => {
    h.app.organizations = [GEMEINDEN[0]];
    const { container, unmount } = zeigeLeiste();
    expect(container.firstChild).toBeNull();
    unmount();
    h.app.organizations = [];
    const leer = zeigeLeiste();
    expect(leer.container.firstChild).toBeNull();
    expect(h.apiGet).not.toHaveBeenCalled();
  });

  it('der Aufbau steht in der Leiste: Pfeil nach oben, die Liste klappt nach oben auf', () => {
    // jsdom rechnet kein Layout: Die Regeln stehen im Stylesheet, hier die Verdrahtung.
    const css = lies('src/components/layout/Seitenleiste.css');
    expect(css).toMatch(/\.app-leistengemeinde__liste\s*\{[^}]*position:\s*fixed/);
    expect(css).toMatch(/\.app-leistengemeinde__knopf\[aria-expanded='true'\] \.app-leistengemeinde__pfeil\s*\{[^}]*rotate\(180deg\)/);
    expect(lies('src/components/layout/LeistenGemeinde.tsx')).toContain('ICON_ZUKLAPPEN');
  });
});

describe('Die Liste', () => {
  it('klappt auf Klick auf und mit zweitem Klick wieder zu', () => {
    zeigeLeiste();
    expect(eintraege()).toHaveLength(0);
    oeffnen();
    expect(eintraege()).toHaveLength(4);
    expect(knopf().getAttribute('aria-expanded')).toBe('true');
    expect(screen.getByRole('menu', { name: 'Gemeinde wechseln' })).toBeInTheDocument();
    oeffnen();
    expect(eintraege()).toHaveLength(0);
    expect(knopf().getAttribute('aria-expanded')).toBe('false');
  });

  it('zeigt jede Gemeinde mit vollem Namen und Rolle; die aktive ist markiert, genau eine', () => {
    h.app.activeOrgId = 2;
    zeigeLeiste();
    oeffnen();
    const liste = eintraege();
    expect(liste.map((e) => e.querySelector('.app-leistengemeinde__name')?.textContent))
      .toEqual(['Kirchspiel West', 'Kirchengemeinde Heide', LANGER_NAME, 'Kirchengemeinde Beispielstadt']);
    expect(liste.map((e) => e.querySelector('.app-leistengemeinde__rolle')?.textContent))
      .toEqual(['Gemeindeleitung', 'Teamer:in', 'Konfi', 'Leitung']);
    expect(liste.map((e) => e.getAttribute('aria-checked'))).toEqual(['false', 'true', 'false', 'false']);
    expect(liste.map((e) => e.classList.contains('app-leistengemeinde__eintrag--aktiv'))).toEqual([false, true, false, false]);
    // Der volle Name auch hier als title.
    expect(liste[2].getAttribute('title')).toBe(LANGER_NAME);
  });

  it('fragt beim Oeffnen genau einmal die Zahlen je Gemeinde ab -- nicht vorher, nicht beim Schliessen', async () => {
    zeigeLeiste();
    await act(async () => {});
    expect(h.apiGet).not.toHaveBeenCalled();
    oeffnen();
    await waitFor(() => expect(h.apiGet).toHaveBeenCalledTimes(1));
    expect(h.apiGet).toHaveBeenCalledWith('/notifications/badge-counts/je-organisation');
    oeffnen();
    await act(async () => {});
    expect(h.apiGet).toHaveBeenCalledTimes(1);
  });

  it('rote Zahl je Gemeinde: 4 an West, 99+ an Musterdorf, nichts bei 0 -- auch am aktiven Eintrag', async () => {
    h.apiGet.mockResolvedValue({ data: { jeOrganisation: { 1: { offen: 4 }, 2: { offen: 0 }, 3: { offen: 250 } } } });
    zeigeLeiste();
    oeffnen();
    await waitFor(() => expect(document.querySelectorAll('.app-leistengemeinde__offen')).toHaveLength(2));
    const [west, heide, muster, beispiel] = eintraege();
    expect(west.querySelector('.app-leistengemeinde__offen')?.textContent).toBe('4');
    expect(heide.querySelector('.app-leistengemeinde__offen')).toBeNull();
    expect(muster.querySelector('.app-leistengemeinde__offen')?.textContent).toBe('99+');
    expect(beispiel.querySelector('.app-leistengemeinde__offen')).toBeNull();
    // Vorlesen: Name, Rolle und die Zahl als Wort -- die Kugel selbst bleibt stumm.
    expect(screen.getByRole('menuitemradio', { name: 'Kirchspiel West, Gemeindeleitung, 4 offen' })).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: `${LANGER_NAME}, Konfi, 250 offen` })).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', { name: 'Kirchengemeinde Heide, Teamer:in' })).toBeInTheDocument();
    expect(west.querySelector('.app-leistengemeinde__offen')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('schlaegt die Abfrage fehl, bleibt die Liste benutzbar -- ohne Zahlen, ohne Hinweis', async () => {
    h.apiGet.mockRejectedValue(new Error('404'));
    zeigeLeiste();
    oeffnen();
    await waitFor(() => expect(h.apiGet).toHaveBeenCalledTimes(1));
    expect(eintraege()).toHaveLength(4);
    expect(document.querySelectorAll('.app-leistengemeinde__offen')).toHaveLength(0);
  });
});

describe('Wechseln', () => {
  it.each([
    ['Kirchengemeinde Heide', 2, '/teamer/dashboard'],
    [LANGER_NAME, 3, '/konfi/dashboard'],
    ['Kirchengemeinde Beispielstadt', 4, '/admin/konfis'],
  ])('%s: wechseln, Startseite der Rolle dort, Liste zu', async (name, id, start) => {
    zeigeLeiste();
    oeffnen();
    const eintrag = eintraege().find((e) => e.querySelector('.app-leistengemeinde__name')?.textContent === name)!;
    await act(async () => { fireEvent.click(eintrag); });
    expect(h.switchOrg).toHaveBeenCalledWith(id);
    expect(h.push).toHaveBeenCalledWith(start, 'root', 'replace');
    expect(eintraege()).toHaveLength(0);
  });

  it('die aktive Gemeinde noch einmal gewaehlt: Liste zu, kein Wechsel, keine Navigation', async () => {
    zeigeLeiste();
    oeffnen();
    await act(async () => { fireEvent.click(eintraege()[0]); });
    expect(h.switchOrg).not.toHaveBeenCalled();
    expect(h.push).not.toHaveBeenCalled();
    expect(eintraege()).toHaveLength(0);
  });

  it('der Fokus kommt nach dem Wechsel an den Knopf zurueck', async () => {
    zeigeLeiste();
    oeffnen();
    await act(async () => { fireEvent.click(eintraege()[1]); });
    expect(document.activeElement).toBe(knopf());
  });
});

describe('Tastatur', () => {
  const taste = (ziel: Element, key: string) => fireEvent.keyDown(ziel, { key });

  it('beim Oeffnen springt der Fokus auf die aktive Gemeinde', () => {
    h.app.activeOrgId = 3;
    zeigeLeiste();
    oeffnen();
    expect(document.activeElement).toBe(eintraege()[2]);
  });

  it('Pfeil ab oeffnet vom Knopf aus; Pfeil auf ebenso', () => {
    zeigeLeiste();
    taste(knopf(), 'ArrowDown');
    expect(eintraege()).toHaveLength(4);
    expect(document.activeElement).toBe(eintraege()[0]);
    cleanup();

    zeigeLeiste();
    taste(knopf(), 'ArrowUp');
    expect(eintraege()).toHaveLength(4);
  });

  it('Pfeiltasten laufen durch die Liste und im Kreis; Pos1 und Ende springen', () => {
    zeigeLeiste();
    oeffnen();
    const liste = eintraege();
    expect(document.activeElement).toBe(liste[0]);

    taste(document.activeElement!, 'ArrowDown');
    expect(document.activeElement).toBe(liste[1]);
    taste(document.activeElement!, 'ArrowDown');
    taste(document.activeElement!, 'ArrowDown');
    expect(document.activeElement).toBe(liste[3]);
    // Am Ende geht es von vorn weiter ...
    taste(document.activeElement!, 'ArrowDown');
    expect(document.activeElement).toBe(liste[0]);
    // ... und vom Anfang nach hinten zurueck.
    taste(document.activeElement!, 'ArrowUp');
    expect(document.activeElement).toBe(liste[3]);

    taste(document.activeElement!, 'Home');
    expect(document.activeElement).toBe(liste[0]);
    taste(document.activeElement!, 'End');
    expect(document.activeElement).toBe(liste[3]);
  });

  it('Enter waehlt die Gemeinde (der Eintrag ist ein Knopf: Enter und Leertaste klicken ihn)', async () => {
    zeigeLeiste();
    oeffnen();
    taste(document.activeElement!, 'ArrowDown');
    const fokussiert = document.activeElement as HTMLElement;
    expect(fokussiert).toBe(eintraege()[1]);
    // Der Browser macht aus Enter auf einem Knopf einen Klick.
    await act(async () => { fokussiert.click(); });
    expect(h.switchOrg).toHaveBeenCalledWith(2);
    expect(h.push).toHaveBeenCalledWith('/teamer/dashboard', 'root', 'replace');
  });

  it('Escape schliesst und gibt den Fokus an den Knopf zurueck', () => {
    zeigeLeiste();
    oeffnen();
    expect(document.activeElement).toBe(eintraege()[0]);
    taste(document.activeElement!, 'Escape');
    expect(eintraege()).toHaveLength(0);
    expect(document.activeElement).toBe(knopf());
    expect(knopf().getAttribute('aria-expanded')).toBe('false');
    expect(h.switchOrg).not.toHaveBeenCalled();
  });

  it('Tab schliesst, der Fokus bleibt am Knopf, von dem er weiterlaeuft', () => {
    zeigeLeiste();
    oeffnen();
    taste(document.activeElement!, 'Tab');
    expect(eintraege()).toHaveLength(0);
    expect(document.activeElement).toBe(knopf());
  });

  it('Escape ohne geoeffnete Liste tut nichts', () => {
    zeigeLeiste();
    const ereignis = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    knopf().dispatchEvent(ereignis);
    expect(ereignis.defaultPrevented).toBe(false);
  });
});

describe('Klick daneben und Fokus weg', () => {
  it('ein Klick irgendwo ausserhalb schliesst die Liste', () => {
    render(<div><LeistenGemeinde eingeklappt={false} /><p data-testid="woanders">Inhalt</p></div>);
    oeffnen();
    expect(eintraege()).toHaveLength(4);
    fireEvent.pointerDown(screen.getByTestId('woanders'));
    expect(eintraege()).toHaveLength(0);
  });

  it('ein Klick in die Liste oder auf den Knopf schliesst sie nicht von selbst', () => {
    zeigeLeiste();
    oeffnen();
    fireEvent.pointerDown(screen.getByRole('menu'));
    fireEvent.pointerDown(knopf());
    expect(eintraege()).toHaveLength(4);
  });

  it('wandert der Fokus aus dem Umschalter hinaus, schliesst die Liste', () => {
    render(<div><LeistenGemeinde eingeklappt={false} /><button type="button">Daneben</button></div>);
    oeffnen();
    act(() => { screen.getByRole('button', { name: 'Daneben' }).focus(); });
    expect(eintraege()).toHaveLength(0);
  });
});

describe('Lage der Liste', () => {
  /** jsdom rechnet kein Layout -- der Knopf bekommt ein Rechteck. */
  const mitRechteck = (r: { left: number; right: number; top: number; bottom: number; width: number }) => {
    vi.spyOn(HTMLButtonElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      return (this.classList.contains('app-leistengemeinde__knopf')
        ? { ...r, x: r.left, y: r.top, height: r.bottom - r.top, toJSON: () => ({}) }
        : { left: 0, right: 0, top: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) }) as DOMRect;
    });
  };
  const liste = () => document.querySelector('.app-leistengemeinde__liste') as HTMLElement;

  beforeEach(() => {
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 900 });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 768 });
  });

  it('ausgeklappt: ueber dem Knopf, links buendig, mindestens so breit wie er', () => {
    mitRechteck({ left: 8, right: 248, top: 820, bottom: 872, width: 240 });
    zeigeLeiste(false);
    oeffnen();
    // 900 - 820 + 8 Luecke: die Unterkante der Liste liegt 8 px ueber dem Knopf.
    expect(liste().style.left).toBe('8px');
    expect(liste().style.bottom).toBe('88px');
    expect(liste().style.minWidth).toBe('240px');
  });

  it('eingeklappt: neben dem Symbol, unten buendig mit ihm', () => {
    mitRechteck({ left: 8, right: 64, top: 820, bottom: 872, width: 56 });
    zeigeLeiste(true);
    oeffnen();
    expect(liste().style.left).toBe('72px');
    expect(liste().style.bottom).toBe('28px');
    expect(liste().style.minWidth).toBe('');
  });

  it('wird das Fenster veraendert, wird neu gemessen', () => {
    mitRechteck({ left: 8, right: 248, top: 820, bottom: 872, width: 240 });
    zeigeLeiste(false);
    oeffnen();
    expect(liste().style.bottom).toBe('88px');
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 700 });
    act(() => { window.dispatchEvent(new Event('resize')); });
    expect(liste().style.bottom).toBe('-112px');
  });
});

describe('Eingeklappte Leiste', () => {
  it('der Knopf behaelt Namen und Tooltip, auch wenn nur das Symbol zu sehen ist', () => {
    zeigeLeiste(true);
    const k = knopf();
    expect(k.getAttribute('title')).toBe('Kirchspiel West');
    expect(k.getAttribute('aria-label')).toBe('Gemeinde wechseln, gerade Kirchspiel West, Gemeindeleitung');
  });

  it('nur das Symbol: Text und Pfeil blendet das Stylesheet aus, die Liste bleibt sichtbar', () => {
    const css = lies('src/components/layout/Seitenleiste.css');
    // Nur am Knopf -- die Liste liegt im selben Baum und darf nicht mitverschwinden.
    expect(css).toMatch(
      /\.app-seitenleiste--eingeklappt \.app-leistengemeinde__knopf \.app-leistengemeinde__texte,\s*\.app-seitenleiste--eingeklappt \.app-leistengemeinde__knopf \.app-leistengemeinde__pfeil\s*\{\s*display:\s*none;/,
    );
    expect(css).not.toMatch(/\.app-seitenleiste--eingeklappt \.app-leistengemeinde__(?:liste|eintrag)/);
  });
});

describe('Gestaltung nur aus Tokens', () => {
  const css = lies('src/components/layout/Seitenleiste.css');
  const abschnitt = css.slice(css.indexOf('Gemeinde-Umschalter unten in der Leiste'));

  it('keine rohe Farbe in der Leiste -- Hell und Dunkel kommen aus den Tokens', () => {
    expect(abschnitt.length).toBeGreaterThan(1000);
    const ohneKommentare = css.replace(/\/\*[\s\S]*?\*\//g, '');
    expect(ohneKommentare).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(ohneKommentare).not.toMatch(/\brgba?\(\s*\d/);
    expect(ohneKommentare).not.toMatch(/(?<![\w-])(?:white|black)(?![\w-])/);
    expect(ohneKommentare).toContain('var(--app-surface-card)');
    expect(ohneKommentare).toContain('var(--app-border)');
  });

  it('Hover und sichtbarer Fokus sind da; Uebergaenge haengen an app-Klassen (Bewegung reduzieren)', () => {
    expect(abschnitt).toContain('.app-leistengemeinde__knopf:hover');
    expect(abschnitt).toContain('.app-leistengemeinde__eintrag:hover');
    expect(abschnitt).toMatch(/\.app-leistengemeinde__knopf:focus-visible[^{]*\{[^}]*outline:\s*2px solid var\(--ion-color-primary\)/);
    expect(abschnitt).toMatch(/\.app-leistengemeinde__eintrag:focus-visible[^{]*\{[^}]*outline-offset:\s*-2px/);
    for (const m of abschnitt.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      if (/transition\s*:/.test(m[2])) expect(m[1], m[1].trim()).toContain('app-');
    }
  });
});

describe('Lange Namen', () => {
  const css = lies('src/components/layout/Seitenleiste.css');

  it('der Name steht auf bis zu zwei Zeilen -- „Kirchengemeinde Musterdorf" endet nicht als „Kirchengemeinde …"', () => {
    expect(css).toMatch(/\.app-leistengemeinde__name\s*\{[^}]*-webkit-line-clamp:\s*2;[^}]*line-clamp:\s*2;/);
    // Die Rolle bleibt eine Zeile mit Ellipse.
    expect(css).toMatch(/\.app-leistengemeinde__rolle\s*\{[^}]*text-overflow:\s*ellipsis;[^}]*white-space:\s*nowrap;/);
  });
});
