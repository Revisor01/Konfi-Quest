// Die Bausteine der Web-Fassung (components/web/): Diagramme in
// eigenem SVG (Tooltip, Tastatur, Tabelle fuer Vorleseprogramme), Chips,
// Akkordeon, Tabelle, Marken, Links. Formen, Breiten, Abstaende und Farben
// sind Layout und werden nicht festgeschrieben (Simon, 15.10.2026).
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';

const h = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock('@ionic/react', async () => (await import('./ionicAttrappe')).ionicAttrappe({
  router: { push: h.push, goBack: vi.fn(), canGoBack: () => false },
}));

import WebDiagramm from '../../../components/web/WebDiagramm';
import WebBalkenListe from '../../../components/web/WebBalkenListe';
import WebSpark from '../../../components/web/WebSpark';
import WebChips from '../../../components/web/WebChips';
import WebAkkordeon from '../../../components/web/WebAkkordeon';
import WebListe from '../../../components/web/WebListe';
import WebPill from '../../../components/web/WebPill';
import WebKachel from '../../../components/web/WebKachel';
import { monatKurz, monatLang } from '../../../utils/supportWeb';

const MONATE = ['2026-07', '2026-08', '2026-09', '2026-10'];
const reihen = [
  { schluessel: 'konfi', name: 'Konfis', farbe: 'var(--web-reihe-konfi)', werte: [10, 20, 30, 0] },
  { schluessel: 'team', name: 'Team', farbe: 'var(--web-reihe-team)', werte: [1, 2, 3, 4] },
];

const diagramm = (art: 'gestapelt' | 'gruppiert' | 'flaeche', r = reihen, extra: Partial<React.ComponentProps<typeof WebDiagramm>> = {}) => render(
  <WebDiagramm
    art={art}
    titel="Neue Konten"
    zusammenfassung="Juli bis Oktober"
    kategorien={MONATE}
    kurz={monatKurz}
    lang={monatLang}
    kategorieName="Monat"
    reihen={r}
    summe
    {...extra}
  />,
);
const bild = () => screen.getByRole('img', { name: 'Neue Konten: Juli bis Oktober' }) as unknown as SVGElement;
const treffer = () => [...bild().querySelectorAll('rect.web-diagramm__treffer')];

describe('WebDiagramm', () => {
  it('gestapelt: eine Saeule je Monat, Segmente nur fuer Werte ueber 0, die Achse in runden Zehnern', () => {
    diagramm('gestapelt');
    expect(bild().querySelectorAll('.web-saeule')).toHaveLength(4);
    expect([...bild().querySelectorAll('.web-saeule')].map((s) => s.querySelectorAll('path.web-balken').length)).toEqual([2, 2, 2, 1]);
    // Der hoechste Stapel ist 33 (September): die Achse laeuft in runden Zehnern bis 40.
    expect([...bild().querySelectorAll('text.web-diagramm__text--rechts')].map((t) => t.textContent)).toEqual(['0', '10', '20', '30', '40']);
    expect([...bild().querySelectorAll('text.web-diagramm__text--mitte')].map((t) => t.textContent)).toEqual(['Jul', 'Aug', 'Sep', 'Okt']);
  });

  it('gruppiert: die Reihen stehen nebeneinander; ein Wert 0 hat keine Saeule', () => {
    diagramm('gruppiert');
    expect([...bild().querySelectorAll('.web-saeule')].map((s) => s.querySelectorAll('path.web-balken').length)).toEqual([2, 2, 2, 1]);
  });

  it('flaeche mit einer Reihe: eine Linie, Wert am Ende, keine Legende', () => {
    diagramm('flaeche', [reihen[0]]);
    expect(bild().querySelectorAll('path.web-diagramm__linie')).toHaveLength(1);
    expect(bild().querySelector('text.web-diagramm__text--stark')?.textContent).toBe('0');
    expect(screen.queryByRole('list', { name: 'Legende' })).toBeNull();
  });

  it('flaeche mit mehreren Reihen: je Reihe eine Linie, keine Endwerte (sie laegen uebereinander), Legende da', () => {
    diagramm('flaeche');
    expect(bild().querySelectorAll('path.web-diagramm__linie')).toHaveLength(2);
    expect(bild().querySelectorAll('text.web-diagramm__text--stark')).toHaveLength(0);
    expect(within(screen.getByRole('list', { name: 'Legende' })).getAllByRole('listitem').map((l) => l.textContent)).toEqual(['Konfis', 'Team']);
  });

  it('ohne Zeitachse (xAchse false) fehlen die Monatsnamen', () => {
    diagramm('gruppiert', [reihen[1]], { xAchse: false, hoehe: 90, ziel: 2 });
    expect(bild().querySelectorAll('text.web-diagramm__text--mitte')).toHaveLength(0);
    expect(bild().querySelectorAll('.web-saeule')).toHaveLength(4);
  });

  it('die Werte stehen als Tabelle fuer Vorleseprogramme da -- ein Zeile je Monat', () => {
    diagramm('gestapelt');
    const tabelle = screen.getByRole('table', { name: 'Neue Konten' });
    expect(within(tabelle).getAllByRole('columnheader').map((c) => c.textContent)).toEqual(['Monat', 'Konfis', 'Team']);
    const zeilen = within(tabelle).getAllByRole('row').slice(1);
    expect(zeilen.map((z) => within(z).getByRole('rowheader').textContent)).toEqual(['Juli 2026', 'August 2026', 'September 2026', 'Oktober 2026']);
    expect(zeilen.map((z) => within(z).getAllByRole('cell').map((c) => c.textContent))).toEqual([['10', '1'], ['20', '2'], ['30', '3'], ['0', '4']]);
    expect(tabelle.className).toContain('web-nur-vorlesen');
  });

  it('Maus: der Tooltip zeigt Monat, Reihen und Summe -- und verschwindet beim Verlassen', () => {
    diagramm('gestapelt');
    expect(document.querySelector('.web-diagramm__tooltip')).toBeNull();
    fireEvent.mouseEnter(treffer()[2]);
    const tip = document.querySelector('.web-diagramm__tooltip') as HTMLElement;
    expect(tip).toHaveTextContent('September 2026');
    expect([...tip.querySelectorAll('.web-diagramm__tooltip-zeile')].map((z) => z.textContent)).toEqual(['Konfis30', 'Team3', 'Gesamt33']);
    expect(tip.getAttribute('aria-hidden')).toBe('true');
    fireEvent.mouseLeave(bild());
    expect(document.querySelector('.web-diagramm__tooltip')).toBeNull();
  });

  it('Tastatur: Pfeiltasten gehen durch die Werte, Pos1/Ende springen, Escape und Verlassen schliessen', () => {
    diagramm('gestapelt');
    const flaeche = screen.getByRole('group', { name: 'Neue Konten. Mit den Pfeiltasten durch die Werte gehen.' });
    expect(flaeche).toHaveAttribute('tabindex', '0');
    const monat = () => document.querySelector('.web-diagramm__tooltip-kopf')?.textContent ?? null;
    expect(monat()).toBeNull();
    fireEvent.keyDown(flaeche, { key: 'ArrowLeft' });
    expect(monat()).toBe('Oktober 2026');
    fireEvent.keyDown(flaeche, { key: 'ArrowLeft' });
    expect(monat()).toBe('September 2026');
    fireEvent.keyDown(flaeche, { key: 'ArrowRight' });
    expect(monat()).toBe('Oktober 2026');
    fireEvent.keyDown(flaeche, { key: 'ArrowRight' });
    expect(monat()).toBe('Oktober 2026'); // am Ende bleibt es
    fireEvent.keyDown(flaeche, { key: 'Home' });
    expect(monat()).toBe('Juli 2026');
    fireEvent.keyDown(flaeche, { key: 'End' });
    expect(monat()).toBe('Oktober 2026');
    fireEvent.keyDown(flaeche, { key: 'Escape' });
    expect(monat()).toBeNull();
    fireEvent.keyDown(flaeche, { key: 'ArrowRight' });
    expect(monat()).toBe('Juli 2026');
    fireEvent.blur(flaeche);
    expect(monat()).toBeNull();
  });

  it('Teilstriche mit Tausenderpunkt', () => {
    diagramm('flaeche', [{ schluessel: 'g', name: 'Gesamt', farbe: 'var(--web-reihe-gesamt)', werte: [650, 900, 1200, 1501] }]);
    expect([...bild().querySelectorAll('text.web-diagramm__text--rechts:not(.web-diagramm__text--stark)')].map((t) => t.textContent)).toEqual(['0', '500', '1.000', '1.500', '2.000']);
    expect(bild().querySelector('text.web-diagramm__text--stark')?.textContent).toBe('1.501');
  });
});

describe('WebBalkenListe', () => {
  it('eine Zeile je Eintrag mit Wert am Balken; der volle Name als Titel', () => {
    render(
      <WebBalkenListe
        titel="Gemeinden je Landeskirche"
        zusammenfassung="drei Landeskirchen"
        farbe="var(--web-reihe-gemeinden)"
        einheit="Gemeinden"
        eintraege={[
          { schluessel: 'a', name: 'Evangelische Kirche mit sehr langem Namen im Süden', wert: 4 },
          { schluessel: 'b', name: 'Kurz', wert: 0 },
        ]}
      />,
    );
    const bildListe = screen.getByRole('img', { name: 'Gemeinden je Landeskirche: drei Landeskirchen' });
    const zeilen = bildListe.querySelectorAll('.web-balkenzeile');
    expect(zeilen).toHaveLength(2);
    const name = zeilen[0].querySelector('text.web-balkenliste__name') as SVGTextElement;
    // Das <title> traegt den vollen Namen (wie weit der sichtbare Text gekuerzt wird, ist Layout).
    expect(name.querySelector('title')?.textContent).toBe('Evangelische Kirche mit sehr langem Namen im Süden');
    expect(zeilen[1].querySelector('text.web-balkenliste__name')?.textContent).toBe('Kurz');
    expect(zeilen[1].querySelector('path.web-balken')?.getAttribute('d')).toBe(''); // Wert 0: kein Balken
    expect([...bildListe.querySelectorAll('text.web-diagramm__text--stark')].map((t) => t.textContent)).toEqual(['4', '0']);
    const tabelle = screen.getByRole('table', { name: 'Gemeinden je Landeskirche' });
    expect(within(tabelle).getAllByRole('row').slice(1).map((r) => [...r.children].map((c) => c.textContent))).toEqual([
      ['Evangelische Kirche mit sehr langem Namen im Süden', '4'], ['Kurz', '0'],
    ]);
  });
});

describe('WebSpark', () => {
  it('eine kleine Linie, fuer Vorleseprogramme verborgen; unter zwei Werten nichts', () => {
    const { container, rerender } = render(<WebSpark werte={[1, 3, 2, 5]} farbe="var(--web-reihe-konfi)" />);
    const svg = container.querySelector('svg')!;
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    rerender(<WebSpark werte={[3]} farbe="var(--web-reihe-konfi)" />);
    expect(container.querySelector('svg')).toBeNull();
  });
});

describe('WebChips', () => {
  type W = 'a' | 'b';
  it('genau einer ist gewaehlt (aria-pressed); die Zahl traegt ihren Vorlesetext', () => {
    const onWert = vi.fn();
    const { rerender } = render(
      <WebChips<W> beschriftung="Filter" wert="a" onWert={onWert} chips={[
        { wert: 'a', label: 'Alle', zahl: 5 },
        { wert: 'b', label: 'Offen', zahl: 3, rot: true, zahlText: 'ungelesen' },
      ]} />,
    );
    expect(screen.getByRole('group', { name: 'Filter' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Alle/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: /^Offen/ })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', { name: /^Offen/ }).querySelector('.web-chip__zahl')).toHaveTextContent('3 ungelesen');
    fireEvent.click(screen.getByRole('button', { name: /^Offen/ }));
    expect(onWert).toHaveBeenCalledWith('b');
    rerender(
      <WebChips<W> beschriftung="Filter" wert="b" onWert={onWert} chips={[
        { wert: 'a', label: 'Alle', zahl: 5 },
        { wert: 'b', label: 'Offen', zahl: 0, rot: true },
      ]} />,
    );
    expect(screen.getByRole('button', { name: /^Offen/ })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('WebAkkordeon', () => {
  it('aria-expanded am Knopf, aria-controls zeigt auf den Bereich; zu: Bereich versteckt und leer', () => {
    const onUmschalten = vi.fn();
    const { rerender } = render(
      <WebAkkordeon id="x" titel="Nordlandkirche" meta="3 Gemeinden" offen={false} onUmschalten={onUmschalten}>
        <p>Inhalt</p>
      </WebAkkordeon>,
    );
    const knopf = screen.getByRole('button', { name: /Nordlandkirche/ });
    expect(knopf).toHaveAttribute('aria-expanded', 'false');
    const bereich = document.getElementById(knopf.getAttribute('aria-controls')!)!;
    expect(bereich.hidden).toBe(true);
    expect(screen.queryByText('Inhalt')).toBeNull();
    fireEvent.click(knopf);
    expect(onUmschalten).toHaveBeenCalledTimes(1);
    rerender(
      <WebAkkordeon id="x" titel="Nordlandkirche" meta="3 Gemeinden" offen onUmschalten={onUmschalten}>
        <p>Inhalt</p>
      </WebAkkordeon>,
    );
    expect(screen.getByRole('button', { name: /Nordlandkirche/ })).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Inhalt')).toBeVisible();
    // Der Knopf steckt in einer Ueberschrift.
    expect(screen.getByRole('heading', { level: 2, name: /Nordlandkirche/ })).toBeInTheDocument();
  });

  it('die zweite Ebene ist eine Ueberschrift der Stufe 3', () => {
    render(<WebAkkordeon id="y" titel="Kirchenkreis" offen onUmschalten={() => {}} innen ebene={3}>x</WebAkkordeon>);
    expect(screen.getByRole('heading', { level: 3, name: 'Kirchenkreis' })).toBeInTheDocument();
  });
});

describe('WebListe', () => {
  it('Kopfzeile mit scope, verborgener Kopf nur fuer Vorleseprogramme', () => {
    render(
      <WebListe<{ id: number; name: string; n: number }>
        beschriftung="Beispiel"
        zeileSchluessel={(z) => z.id}
        zeileKlasse={(z) => (z.n > 5 ? 'web-zeile--ungelesen' : undefined)}
        fest
        spalten={[
          { schluessel: 'name', kopf: 'Name', zelle: (z) => z.name },
          { schluessel: 'n', kopf: 'Anzahl', zahl: true, optional: true, breite: '80px', zelle: (z) => z.n },
          { schluessel: 'a', kopf: 'Aktionen', kopfVersteckt: true, zelle: () => <button type="button">Los</button> },
        ]}
        zeilen={[{ id: 1, name: 'A', n: 3 }, { id: 2, name: 'B', n: 9 }]}
      />,
    );
    const tabelle = screen.getByRole('table', { name: 'Beispiel' });
    const koepfe = within(tabelle).getAllByRole('columnheader');
    expect(koepfe.map((k) => k.getAttribute('scope'))).toEqual(['col', 'col', 'col']);
    expect(koepfe[2].querySelector('.web-nur-vorlesen')?.textContent).toBe('Aktionen');
  });
});

describe('WebPill und WebKachel', () => {
  it('WebPill: der Punkt ist fuer Vorleseprogramme verborgen', () => {
    const { container } = render(<WebPill ton="erfolg" punkt>ok</WebPill>);
    expect(container.querySelector('.web-pill__punkt')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('die Kachel: Etikett, Zahl, Zeilen darunter; mit Link ein <a> mit Namen "Etikett: Zahl"', () => {
    render(
      <>
        <WebKachel label="Konfis" wert="1.265" zusatz={['74 neu im Oktober', '', 'zweite Zeile']} />
        <WebKachel label="Offene Anfragen" wert="5" href="/admin/support/anfragen" achtung zusatz={['Neu oder in Arbeit']} />
      </>,
    );
    const g = screen.getByRole('group', { name: 'Konfis: 1.265' });
    expect(g).toHaveTextContent('74 neu im Oktober');
    expect(g.querySelectorAll('.web-kachel__zusatz > span')).toHaveLength(2); // leere Zeilen fallen weg
    const a = screen.getByRole('link', { name: 'Offene Anfragen: 5' });
    expect(a).toHaveAttribute('href', '/admin/support/anfragen');
    fireEvent.click(a);
    expect(h.push).toHaveBeenCalledWith('/admin/support/anfragen', 'none', 'push');
  });
});
