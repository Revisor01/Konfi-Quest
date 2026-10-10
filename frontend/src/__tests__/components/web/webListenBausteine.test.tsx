// Die Bausteine der Listen-Seiten der Web-Fassung (10.10.2026; Simon: „web
// soll eine kachel-, liste-, details-logik haben für alle seiten"):
// - WebKreis: Initialen oder Symbol im Kreis;
// - WebListe: die EINE sortierbare Tabelle (WebTabelle und WebSortTabelle
//   reichen hierher durch) mit Namenszelle, Aktionen und Leerzustand;
// - WebKacheln: Raster und Karte mit Bearbeiten/Loeschen im Fuss;
// - WebListenSeite: Kennzahlen, Werkzeugzeile aus der Seitenbeschreibung,
//   Suche, Umschalter Liste | Kacheln, Laden, Fehler, leer.
import { describe, it, expect, vi, afterEach } from 'vitest';
import React, { useState } from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';

vi.mock('@ionic/react', async () => ({
  ...(await import('../support/ionicAttrappe')).ionicAttrappe({}),
  // Sichtbar statt null: geprueft wird das Symbol im Kreis und an der Kennzahl.
  IonIcon: ({ icon, className, style }: { icon?: string; className?: string; style?: React.CSSProperties }) => (
    <i data-testid="symbol" data-icon={icon} className={className} style={style} />
  ),
}));
vi.mock('../../../components/shared/AppKopfzeile', async () => (await import('../support/ionicAttrappe')).KopfzeileAttrappe);
vi.mock('../../../components/shared/WartungsHinweis', () => ({ default: () => null }));

import WebKreis from '../../../components/web/WebKreis';
import WebListe, { WebNameZelle, type WebSpalte } from '../../../components/web/WebListe';
import WebTabelle from '../../../components/web/WebTabelle';
import WebSortTabelle from '../../../components/admin/web/leitung/WebSortTabelle';
import WebKacheln from '../../../components/web/WebKacheln';
import WebListenSeite, { type WebListenSeiteProps } from '../../../components/web/WebListenSeite';
import { WebBildKarteSymbol } from '../../../components/web/WebBildKarte';
import { KENNZAHL_SYMBOL } from '../../../components/web/kennzahlSymbole';
import { ansichtSchluessel } from '../../../components/web/useAnsicht';
import { wahlen } from '../../../seiten/beschreibung';
import { ICON_ABZEICHEN, ICON_GRUPPE } from '../../../components/shared/icons';

afterEach(() => {
  window.localStorage.clear();
});

interface Person { id: number; name: string; punkte: number | null; gruppe: 'rot' | 'blau' }
const LEUTE: Person[] = [
  { id: 1, name: 'Bea', punkte: 5, gruppe: 'rot' },
  { id: 2, name: 'Änne', punkte: 12, gruppe: 'blau' },
  { id: 3, name: 'Carl', punkte: null, gruppe: 'rot' },
];

const SPALTEN: Array<WebSpalte<Person>> = [
  { schluessel: 'name', kopf: 'Name', sortWert: (p) => p.name, zelle: (p) => <WebNameZelle titel={p.name} href={`/p/${p.id}`} /> },
  { schluessel: 'punkte', kopf: 'Punkte', zahl: true, sortWert: (p) => p.punkte, zelle: (p) => p.punkte ?? '–' },
  { schluessel: 'gruppe', kopf: 'Gruppe', zelle: (p) => p.gruppe },
];

const tabelle = (name = 'Leute') => screen.getByRole('table', { name });
const namen = (name = 'Leute') => within(tabelle(name)).getAllByRole('row').slice(1).map((z) => within(z).getAllByRole('cell')[0].textContent);
const kopf = (name: string, t = 'Leute') => within(tabelle(t)).getByRole('columnheader', { name });

describe('WebKreis', () => {
  it('Initialen: Klasse in der Farbe der Rolle, gross auf Wunsch, fuer Vorleseprogramme versteckt', () => {
    const { container } = render(<><WebKreis text="AM" /><WebKreis text="BS" ton="erreicht" gross /></>);
    const [a, b] = [...container.querySelectorAll('span')];
    expect(a.className).toBe('web-initialen web-initialen--konfis');
    expect(a.textContent).toBe('AM');
    expect(a).toHaveAttribute('aria-hidden', 'true');
    expect(b.className).toBe('web-initialen web-initialen--erreicht web-initialen--gross');
  });

  it('Symbol: Ton als Klasse, Datenfarbe als Hintergrund; ohne Ton neutral', () => {
    const { container } = render(<><WebKreis icon={ICON_GRUPPE} ton="jahrgang" /><WebKreis icon={ICON_ABZEICHEN} farbe="rgb(1, 2, 3)" /></>);
    const [a, b] = [...container.querySelectorAll<HTMLElement>('span.web-symbol')];
    expect(a.className).toBe('web-symbol web-symbol--jahrgang');
    expect(within(a).getByTestId('symbol')).toHaveAttribute('data-icon', ICON_GRUPPE);
    expect(b.className).toBe('web-symbol web-symbol--neutral');
    expect(b.style.background).toBe('rgb(1, 2, 3)');
  });
});

describe('WebListe: Sortieren', () => {
  it('bis zum Klick die Reihenfolge der Seite; Klick ordnet auf-, zweiter Klick absteigend; leere Werte unten', () => {
    render(<WebListe beschriftung="Leute" spalten={SPALTEN} zeilen={LEUTE} zeileSchluessel={(p) => p.id} />);
    expect(namen()).toEqual(['Bea', 'Änne', 'Carl']);
    fireEvent.click(within(kopf('Punkte')).getByRole('button'));
    expect(kopf('Punkte')).toHaveAttribute('aria-sort', 'ascending');
    expect(namen()).toEqual(['Bea', 'Änne', 'Carl']);
    fireEvent.click(within(kopf('Punkte')).getByRole('button'));
    expect(kopf('Punkte')).toHaveAttribute('aria-sort', 'descending');
    expect(namen()).toEqual(['Änne', 'Bea', 'Carl']);
    // Deutsche Ordnung: Ä steht bei A.
    fireEvent.click(within(kopf('Name')).getByRole('button'));
    expect(namen()).toEqual(['Änne', 'Bea', 'Carl']);
    expect(kopf('Punkte')).toHaveAttribute('aria-sort', 'none');
  });

  it('ohne sortWert kein Knopf und kein aria-sort', () => {
    render(<WebListe beschriftung="Leute" spalten={SPALTEN} zeilen={LEUTE} zeileSchluessel={(p) => p.id} />);
    expect(within(kopf('Gruppe')).queryByRole('button')).toBeNull();
    expect(kopf('Gruppe')).not.toHaveAttribute('aria-sort');
  });

  it('die Seite haelt die Ordnung: Klick meldet nur den Schluessel, die Zeilen bleiben, aria-sort folgt der Seite', () => {
    const onSortieren = vi.fn();
    const spalten = SPALTEN.map((s) => (s.schluessel === 'gruppe' ? { ...s, sortierbar: true } : s));
    render(
      <WebListe beschriftung="Leute" spalten={spalten} zeilen={LEUTE} zeileSchluessel={(p) => p.id}
        sortierung={{ schluessel: 'gruppe', richtung: 'ab' }} onSortieren={onSortieren} />,
    );
    expect(kopf('Gruppe')).toHaveAttribute('aria-sort', 'descending');
    fireEvent.click(within(kopf('Punkte')).getByRole('button'));
    expect(onSortieren).toHaveBeenCalledTimes(1);
    expect(onSortieren).toHaveBeenCalledWith('punkte');
    expect(namen()).toEqual(['Bea', 'Änne', 'Carl']);
  });

  it('WebTabelle und WebSortTabelle sind dieselbe Tabelle (sie reichen nur durch)', () => {
    expect(WebTabelle).toBe(WebListe);
    expect(WebSortTabelle).toBe(WebListe);
  });
});

describe('WebListe: Namenszelle, Aktionen, Leerzustand', () => {
  it('Namenszelle mit Kreis: Link einzeilig, Unterzeile leise; ohne Ziel ein Titel ohne Link', () => {
    render(
      <WebListe<Person>
        beschriftung="Leute"
        zeilen={LEUTE.slice(0, 2)}
        zeileSchluessel={(p) => p.id}
        spalten={[{
          schluessel: 'name',
          kopf: 'Name',
          zelle: (p) => (p.id === 1
            ? <WebNameZelle kreis={<WebKreis text="BE" />} titel={p.name} href="/p/1" unterzeile="bea.b" />
            : <WebNameZelle titel={p.name} unterzeile="ohne Ziel" unterzeileTitel="ganzer Text" />),
        }]}
      />,
    );
    const [bea, aenne] = within(tabelle()).getAllByRole('row').slice(1);
    expect(within(bea).getByRole('link', { name: 'Bea' })).toHaveAttribute('href', '/p/1');
    expect(within(bea).getByRole('link')).toHaveClass('web-link--zeile', 'web-einzeilig');
    expect(bea.querySelector('.web-person-zelle .web-initialen')).toHaveTextContent('BE');
    expect(bea.querySelector('.web-zelle-leise')).toHaveTextContent('bea.b');
    expect(within(aenne).queryByRole('link')).toBeNull();
    expect(aenne.querySelector('.web-zelle-titel')).toHaveTextContent('Änne');
    expect(aenne.querySelector('.web-zelle-leise')).toHaveAttribute('title', 'ganzer Text');
  });

  it('Namenszelle als Knopf: oeffnet genau diese Zeile', () => {
    const oeffnen = vi.fn();
    render(<WebListe<Person> beschriftung="Leute" zeilen={LEUTE} zeileSchluessel={(p) => p.id}
      spalten={[{ schluessel: 'name', kopf: 'Name', zelle: (p) => <WebNameZelle titel={p.name} onKlick={() => oeffnen(p.id)} beschriftung={`${p.name} öffnen`} /> }]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Änne öffnen' }));
    expect(oeffnen).toHaveBeenCalledTimes(1);
    expect(oeffnen).toHaveBeenCalledWith(2);
  });

  it('Bearbeiten und Loeschen: eigene Spalte am Ende, Knopf je Zeile mit deren Namen, Klick reicht die Zeile weiter', () => {
    const bearbeiten = vi.fn();
    const loeschen = vi.fn();
    render(
      <WebListe beschriftung="Leute" spalten={SPALTEN} zeilen={LEUTE} zeileSchluessel={(p) => p.id}
        bearbeiten={{ onKlick: bearbeiten, beschriftung: (p) => `${p.name} bearbeiten` }}
        loeschen={{ onKlick: loeschen, beschriftung: (p) => `${p.name} löschen`, titel: () => 'Person löschen' }} />,
    );
    expect(within(tabelle()).getAllByRole('columnheader').map((c) => c.textContent)).toEqual(['Name', 'Punkte', 'Gruppe', 'Aktionen']);
    expect(kopf('Aktionen')).toHaveStyle({ width: '112px' });
    fireEvent.click(screen.getByRole('button', { name: 'Carl löschen' }));
    expect(loeschen).toHaveBeenCalledTimes(1);
    expect(loeschen.mock.calls[0][0].id).toBe(3);
    expect(screen.getByRole('button', { name: 'Carl löschen' })).toHaveAttribute('title', 'Person löschen');
    fireEvent.click(screen.getByRole('button', { name: 'Bea bearbeiten' }));
    expect(bearbeiten.mock.calls[0][0].id).toBe(1);
    expect(screen.getByRole('button', { name: 'Bea bearbeiten' })).toHaveAttribute('title', 'Bea bearbeiten');
  });

  it('nur Loeschen: schmale Spalte; ohne Aktionen keine Spalte', () => {
    const { unmount } = render(<WebListe beschriftung="Leute" spalten={SPALTEN} zeilen={LEUTE} zeileSchluessel={(p) => p.id}
      loeschen={{ onKlick: vi.fn(), beschriftung: (p) => `${p.name} löschen` }} />);
    expect(kopf('Aktionen')).toHaveClass('web-spalte-aktionen-schmal');
    expect(screen.queryByRole('button', { name: /bearbeiten/ })).toBeNull();
    unmount();
    render(<WebListe beschriftung="Leute" spalten={SPALTEN} zeilen={LEUTE} zeileSchluessel={(p) => p.id} />);
    expect(within(tabelle()).queryByRole('columnheader', { name: 'Aktionen' })).toBeNull();
  });

  it('Leerzustand statt einer Tabelle ohne Zeilen; ohne `leer` bleibt die leere Tabelle', () => {
    const { unmount } = render(<WebListe beschriftung="Leute" spalten={SPALTEN} zeilen={[]} zeileSchluessel={(p) => p.id}
      leer={{ icon: ICON_GRUPPE, titel: 'Niemand da', text: 'Noch niemand angelegt.' }} />);
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Niemand da' })).toBeInTheDocument();
    expect(screen.getByText('Noch niemand angelegt.')).toBeInTheDocument();
    unmount();
    render(<WebListe beschriftung="Leute" spalten={SPALTEN} zeilen={[]} zeileSchluessel={(p) => p.id} />);
    expect(within(tabelle()).getAllByRole('row')).toHaveLength(1);
  });
});

describe('WebKacheln', () => {
  const karte = (p: Person) => ({
    akzent: 'var(--app-color-konfis)',
    symbol: <WebBildKarteSymbol text={p.name.slice(0, 2)} />,
    label: p.gruppe,
    titelImKopf: true,
    titel: p.name,
    href: `/p/${p.id}`,
  });

  it('ein Raster, je Eintrag eine Karte in derselben Reihenfolge, Titel als Link', () => {
    render(<WebKacheln beschriftung="Leute" eintraege={LEUTE} schluessel={(p) => p.id} karte={karte} />);
    const liste = screen.getByRole('list', { name: 'Leute' });
    expect(liste).toHaveClass('web-bildkarten');
    const eintraege = [...liste.children] as HTMLElement[];
    expect(eintraege.map((e) => e.className)).toEqual(['web-bildkarten__eintrag', 'web-bildkarten__eintrag', 'web-bildkarten__eintrag']);
    expect(eintraege.map((e) => within(e).getByRole('link').textContent)).toEqual(['Bea', 'Änne', 'Carl']);
    expect(eintraege.map((e) => within(e).getByRole('link').getAttribute('href'))).toEqual(['/p/1', '/p/2', '/p/3']);
    // Ohne Aktionen kein Fuss.
    expect(liste.querySelector('footer')).toBeNull();
  });

  it('Bearbeiten und Loeschen stehen fest im Fuss, mit Wort, und treffen genau diese Karte; `fuss` steht davor', () => {
    const bearbeiten = vi.fn();
    const loeschen = vi.fn();
    render(
      <WebKacheln beschriftung="Leute" eintraege={LEUTE} schluessel={(p) => p.id} karte={karte}
        fuss={(p) => <button type="button">{`${p.name} teilen`}</button>}
        bearbeiten={{ onKlick: bearbeiten, beschriftung: () => 'Person bearbeiten' }}
        loeschen={{ onKlick: loeschen, beschriftung: (p) => `${p.name} löschen` }} />,
    );
    const zweite = screen.getByRole('list', { name: 'Leute' }).children[1] as HTMLElement;
    const fuss = zweite.querySelector('footer') as HTMLElement;
    expect(within(fuss).getAllByRole('button').map((b) => b.textContent)).toEqual(['Änne teilen', 'Bearbeiten', 'Löschen']);
    fireEvent.click(within(fuss).getByRole('button', { name: 'Person bearbeiten' }));
    fireEvent.click(within(fuss).getByRole('button', { name: 'Änne löschen' }));
    expect(bearbeiten).toHaveBeenCalledTimes(1);
    expect(bearbeiten.mock.calls[0][0].id).toBe(2);
    expect(loeschen).toHaveBeenCalledTimes(1);
    expect(loeschen.mock.calls[0][0].id).toBe(2);
  });
});

// --- WebListenSeite ---------------------------------------------------------------------

const GRUPPE = wahlen([
  { schluessel: 'alle', label: 'Alle', passt: () => true },
  { schluessel: 'rot', label: 'Rot', passt: (p: Person) => p.gruppe === 'rot' },
  { schluessel: 'blau', label: 'Blau', passt: (p: Person) => p.gruppe === 'blau' },
  { schluessel: 'gruen', label: 'Grün', nurIn: 'app', warum: 'gibt es im Browser nicht (Test)', passt: () => false },
]);
const REITER = wahlen([
  { schluessel: 'leute', label: 'Leute' },
  { schluessel: 'team', label: 'Team' },
]);

type SeitenProps = Partial<WebListenSeiteProps<Person, 'leute' | 'team'>>;

/** Eine Seite mit dem Zustand, den sonst die Seite haelt (Reiter, Filter, Suche). */
const Seite: React.FC<SeitenProps & { filterArt?: 'chips' | 'auswahl' }> = ({ filterArt = 'chips', ...props }) => {
  const [reiter, setReiter] = useState<'leute' | 'team'>('leute');
  const [gruppe, setGruppe] = useState('alle');
  const [suche, setSuche] = useState('');
  return (
    <WebListenSeite<Person, 'leute' | 'team'>
      bereich="Verwaltung"
      titel="Leute"
      kennzahlen={[{ label: 'Leute', wert: '3', symbol: KENNZAHL_SYMBOL.konfis }, { label: 'Punkte', wert: '17' }]}
      reiter={{ beschriftung: 'Leute oder Team', wahlen: REITER, wert: reiter, onWert: (r) => { setReiter(r); setSuche(''); }, zahlen: { leute: 3 } }}
      filter={[{ beschriftung: 'Gruppe', darstellung: filterArt, wahlen: GRUPPE, wert: gruppe, onWert: setGruppe, zahlen: true }]}
      suche={{ beschriftung: 'Person suchen', wert: suche, onWert: setSuche, felder: (p) => [p.name] }}
      zaehlzeile={(n, gesamt) => `${n} von ${gesamt} Leuten`}
      ansicht={{ seite: 'konfis', vorgabe: 'liste' }}
      eintraege={LEUTE}
      liste={{ beschriftung: 'Leute', spalten: SPALTEN, zeileSchluessel: (p) => p.id }}
      kacheln={{
        beschriftung: 'Leute',
        schluessel: (p) => p.id,
        karte: (p) => ({ akzent: 'var(--app-color-konfis)', symbol: null, label: p.gruppe, titel: p.name, href: `/p/${p.id}` }),
      }}
      leer={{ icon: ICON_GRUPPE, titel: 'Niemand gefunden', text: suche ? 'Andere Suchbegriffe versuchen.' : 'Noch niemand.' }}
      {...props}
    />
  );
};

const umschalter = () => screen.getByRole('group', { name: 'Ansicht' });
const waehle = (a: 'Liste' | 'Kacheln') => fireEvent.click(within(umschalter()).getByRole('button', { name: a }));
const kartenNamen = () => [...screen.getByRole('list', { name: 'Leute' }).children].map((k) => within(k as HTMLElement).getByRole('link').textContent);

describe('WebListenSeite: Kopf und Kennzahlen', () => {
  it('Titel, Kennzahlen als Kacheln mit Symbol in der Bereichsfarbe, Reiter mit Zahl', () => {
    render(<Seite />);
    expect(screen.getByRole('heading', { level: 1, name: 'Leute' })).toBeInTheDocument();
    const kachel = screen.getByRole('group', { name: 'Leute: 3' });
    expect(within(kachel).getByTestId('symbol')).toHaveAttribute('data-icon', KENNZAHL_SYMBOL.konfis.icon);
    expect(within(kachel).getByTestId('symbol').style.color).toBe('var(--app-color-konfis)');
    expect(screen.getByRole('group', { name: 'Punkte: 17' })).toBeInTheDocument();
    const reiter = screen.getByRole('group', { name: 'Leute oder Team' });
    expect(within(reiter).getAllByRole('button').map((b) => b.textContent)).toEqual(['Leute3', 'Team']);
  });
});

describe('WebListenSeite: Filter aus der Seitenbeschreibung', () => {
  it('Chips: nur die Wahlen der Web-Fassung, mit Zahl je Wahl; Klick filtert und zeigt die Zaehlzeile', () => {
    render(<Seite />);
    const gruppe = screen.getByRole('group', { name: 'Gruppe' });
    expect(within(gruppe).getAllByRole('button').map((b) => b.textContent)).toEqual(['Alle3', 'Rot2', 'Blau1']);
    expect(screen.queryByRole('status')).toBeNull();
    fireEvent.click(within(gruppe).getByRole('button', { name: /^Rot/ }));
    expect(within(gruppe).getByRole('button', { name: /^Rot/ })).toHaveAttribute('aria-pressed', 'true');
    expect(namen()).toEqual(['Bea', 'Carl']);
    expect(screen.getByRole('status')).toHaveTextContent('2 von 3 Leuten');
    fireEvent.click(within(gruppe).getByRole('button', { name: /^Alle/ }));
    expect(namen()).toEqual(['Bea', 'Änne', 'Carl']);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('Auswahl: ein <select> mit denselben Wahlen, filtert genauso', () => {
    render(<Seite filterArt="auswahl" />);
    const auswahl = screen.getByRole('combobox', { name: 'Gruppe' });
    expect(within(auswahl).getAllByRole('option').map((o) => o.textContent)).toEqual(['Alle', 'Rot', 'Blau']);
    fireEvent.change(auswahl, { target: { value: 'blau' } });
    expect(namen()).toEqual(['Änne']);
    expect(screen.getByText('1 von 3 Leuten')).toBeInTheDocument();
  });

  it('Suche kennt Umlaute und gilt zusammen mit dem Filter', () => {
    render(<Seite />);
    fireEvent.change(screen.getByRole('searchbox', { name: 'Person suchen' }), { target: { value: 'aenne' } });
    expect(namen()).toEqual(['Änne']);
    fireEvent.click(within(screen.getByRole('group', { name: 'Gruppe' })).getByRole('button', { name: /^Rot/ }));
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByText('Niemand gefunden')).toBeInTheDocument();
    expect(screen.getByText('Andere Suchbegriffe versuchen.')).toBeInTheDocument();
  });

  it('Reihenfolge der Werkzeugzeile: Reiter, Filter-Chips, Suche, rechts Zaehlzeile, eigene Knoepfe und ganz rechts der Umschalter', () => {
    render(<Seite werkzeuge={<button type="button">Neu</button>} />);
    const zeile = umschalter().closest('.web-werkzeuge')!;
    expect([...zeile.children].map((c) => c.className.split(' ')[0])).toEqual(['web-chips', 'web-chips', 'web-suche', 'web-werkzeuge__rechts']);
    expect(zeile.lastElementChild!.lastElementChild).toBe(umschalter());
    expect(within(zeile.lastElementChild as HTMLElement).getByRole('button', { name: 'Neu' })).toBeInTheDocument();
  });
});

describe('WebListenSeite: Liste oder Kacheln', () => {
  it('Vorgabe aus `ansicht`, Wechsel zeigt dieselben Eintraege als Karten, die Wahl wird je Seite gemerkt', () => {
    const { unmount } = render(<Seite />);
    expect(namen()).toEqual(['Bea', 'Änne', 'Carl']);
    expect(tabelle().closest('.web-karte')).not.toBeNull();
    waehle('Kacheln');
    expect(screen.queryByRole('table')).toBeNull();
    expect(kartenNamen()).toEqual(['Bea', 'Änne', 'Carl']);
    // Kacheln stehen frei im Raster, nicht in einer Karte.
    expect(screen.getByRole('list', { name: 'Leute' }).closest('.web-karte')).toBeNull();
    expect(window.localStorage.getItem(ansichtSchluessel('konfis'))).toBe('kacheln');
    unmount();
    render(<Seite />);
    expect(kartenNamen()).toEqual(['Bea', 'Änne', 'Carl']);
  });

  it('die Huelle haelt die Ordnung: Kopf der Liste und Auswahl "Sortieren" der Kacheln stellen dasselbe ein', () => {
    const sortiere = (liste: readonly Person[], s: { schluessel: string; richtung: 'auf' | 'ab' }) =>
      [...liste].sort((a, b) => {
        const v = s.schluessel === 'punkte' ? (a.punkte ?? -1) - (b.punkte ?? -1) : a.name.localeCompare(b.name, 'de');
        return s.richtung === 'auf' ? v : -v;
      });
    const spalten = SPALTEN.map((s) => ({ ...s, sortWert: undefined, sortierbar: s.schluessel !== 'gruppe' }));
    render(
      <Seite
        liste={{ beschriftung: 'Leute', spalten, zeileSchluessel: (p) => p.id }}
        sortierung={{
          start: { schluessel: 'name', richtung: 'auf' },
          sortiere,
          ersteRichtung: (k) => (k === 'punkte' ? 'ab' : 'auf'),
          auswahl: [
            { schluessel: 'name', richtung: 'auf', label: 'Name A–Z' },
            { schluessel: 'punkte', richtung: 'ab', label: 'Meiste Punkte' },
            { schluessel: 'punkte', richtung: 'auf', label: 'Wenigste Punkte' },
          ],
        }}
      />,
    );
    expect(namen()).toEqual(['Änne', 'Bea', 'Carl']);
    expect(kopf('Name')).toHaveAttribute('aria-sort', 'ascending');
    // In der Liste gibt es keine Auswahl "Sortieren" -- dort sind es die Koepfe.
    expect(screen.queryByRole('combobox', { name: 'Sortieren' })).toBeNull();
    fireEvent.click(within(kopf('Punkte')).getByRole('button'));
    expect(kopf('Punkte')).toHaveAttribute('aria-sort', 'descending');
    expect(namen()).toEqual(['Änne', 'Bea', 'Carl']);
    fireEvent.click(within(kopf('Punkte')).getByRole('button'));
    expect(namen()).toEqual(['Carl', 'Bea', 'Änne']);
    waehle('Kacheln');
    const auswahl = screen.getByRole('combobox', { name: 'Sortieren' });
    expect(auswahl).toHaveValue('punkte:auf');
    expect(kartenNamen()).toEqual(['Carl', 'Bea', 'Änne']);
    expect(umschalter().closest('.web-werkzeuge')).toHaveClass('web-werkzeuge--kacheln');
    fireEvent.change(auswahl, { target: { value: 'name:auf' } });
    expect(kartenNamen()).toEqual(['Änne', 'Bea', 'Carl']);
    waehle('Liste');
    expect(kopf('Name')).toHaveAttribute('aria-sort', 'ascending');
    expect(namen()).toEqual(['Änne', 'Bea', 'Carl']);
  });
});

describe('WebListenSeite: Laden, Fehler, leer', () => {
  it('die ganze Seite laedt: nur Platzhalter, keine Kennzahlen, keine Werkzeugzeile', () => {
    render(<Seite laden={{ text: 'Die Leute werden geladen.', kacheln: 4 }} />);
    expect(screen.getByRole('status')).toHaveTextContent('Die Leute werden geladen.');
    expect(screen.queryByRole('group', { name: 'Leute: 3' })).toBeNull();
    expect(screen.queryByRole('searchbox')).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('die ganze Seite scheitert: Meldung mit erneutem Versuch', () => {
    const erneut = vi.fn();
    render(<Seite fehler={{ text: 'Die Leute konnten nicht geladen werden.', onErneut: erneut }} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Die Leute konnten nicht geladen werden.');
    expect(screen.queryByRole('searchbox')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));
    expect(erneut).toHaveBeenCalledTimes(1);
  });

  it('nur der Inhalt laedt oder scheitert: Kennzahlen und Werkzeugzeile bleiben, der Hinweis steht in der Karte', () => {
    const { unmount } = render(<Seite inhaltLaden="Das Team wird geladen." />);
    expect(screen.getByRole('status')).toHaveTextContent('Das Team wird geladen.');
    expect(screen.getByRole('searchbox', { name: 'Person suchen' })).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
    unmount();
    render(<Seite inhaltFehler={{ text: 'Das Team konnte nicht geladen werden.', onErneut: vi.fn() }} />);
    expect(screen.getByRole('alert').closest('.web-karte')).not.toBeNull();
    expect(screen.getByRole('group', { name: 'Leute: 3' })).toBeInTheDocument();
  });

  it('keine Eintraege: Leerzustand in der Karte -- in beiden Ansichten, ohne Auswahl "Sortieren"', () => {
    render(<Seite eintraege={[]} sortierung={{ start: { schluessel: 'name', richtung: 'auf' }, sortiere: (l) => [...l], auswahl: [{ schluessel: 'name', richtung: 'auf', label: 'Name A–Z' }] }} />);
    expect(screen.getByText('Noch niemand.').closest('.web-karte')).not.toBeNull();
    waehle('Kacheln');
    expect(screen.getByText('Noch niemand.')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Leute' })).toBeNull();
    expect(screen.queryByRole('combobox', { name: 'Sortieren' })).toBeNull();
  });
});
