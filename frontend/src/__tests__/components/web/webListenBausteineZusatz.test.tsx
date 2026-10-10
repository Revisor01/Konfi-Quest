// Die Zusaetze der Listen-Bausteine fuer die Seiten der Verwaltung und des
// Supports (10.10.2026), je mit erlaubtem und verbotenem Fall:
// - WebAktion `zeigen` und `deaktiviert`: Rechte je Zeile (Bearbeiten nur bei
//   can_edit, das eigene Konto nicht loeschen) in Liste und Kacheln;
// - WebListe `weitere` und `aktionenBreite`: weitere Knoepfe in derselben
//   Spalte vor Bearbeiten und Loeschen (Passwort, Schreiben, Zurueckziehen);
// - WebListenSeite ohne `kacheln`: nur Liste, kein Umschalter, nichts gemerkt;
//   Suche ohne `felder` (die Seite filtert selbst); Reiter mit roter Zahl;
//   `vorInhalt` zwischen Werkzeugzeile und Liste; ohne Werkzeuge keine Zeile.
import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, within, renderHook, act } from '@testing-library/react';

vi.mock('@ionic/react', async () => (await import('../support/ionicAttrappe')).ionicAttrappe({}));
vi.mock('../../../components/shared/AppKopfzeile', async () => (await import('../support/ionicAttrappe')).KopfzeileAttrappe);
vi.mock('../../../components/shared/WartungsHinweis', () => ({ default: () => null }));

import WebListe, { type WebAktion, type WebSpalte } from '../../../components/web/WebListe';
import WebKacheln from '../../../components/web/WebKacheln';
import WebListenSeite, { type WebListenSeiteProps } from '../../../components/web/WebListenSeite';
import { WebBildKarteSymbol } from '../../../components/web/WebBildKarte';
import { ansichtSchluessel, useAnsicht } from '../../../components/web/useAnsicht';
import { wahlen } from '../../../seiten/beschreibung';
import { ICON_GRUPPE } from '../../../components/shared/icons';

afterEach(() => {
  window.localStorage.clear();
});

interface Person { id: number; name: string; darf: boolean }
const LEUTE: Person[] = [
  { id: 1, name: 'Bea', darf: true },
  { id: 2, name: 'Carl', darf: false },
];
const SPALTEN: Array<WebSpalte<Person>> = [{ schluessel: 'name', kopf: 'Name', sortWert: (p) => p.name, zelle: (p) => p.name }];
const zeile = (name: string) => screen.getByRole('cell', { name }).closest('tr') as HTMLElement;

const bearbeiten = (onKlick = vi.fn()): WebAktion<Person> => ({
  onKlick, beschriftung: (p) => `${p.name} bearbeiten`, zeigen: (p) => p.darf,
});
const loeschen = (onKlick = vi.fn(), gesperrt = false): WebAktion<Person> => ({
  onKlick, beschriftung: (p) => `${p.name} löschen`, deaktiviert: () => gesperrt,
});

describe('WebAktion: zeigen und deaktiviert', () => {
  it('Liste: der Knopf steht nur bei den Zeilen, die es duerfen', () => {
    const klick = vi.fn();
    render(<WebListe beschriftung="Leute" spalten={SPALTEN} zeilen={LEUTE} zeileSchluessel={(p) => p.id} bearbeiten={bearbeiten(klick)} />);
    // erlaubt
    fireEvent.click(within(zeile('Bea')).getByRole('button', { name: 'Bea bearbeiten' }));
    expect(klick).toHaveBeenCalledTimes(1);
    expect(klick.mock.calls[0][0].id).toBe(1);
    // verboten
    expect(within(zeile('Carl')).queryByRole('button')).toBeNull();
  });

  it('Liste: gesperrt steht der Knopf da, reagiert aber nicht; ungesperrt reagiert er', () => {
    const klick = vi.fn();
    const { unmount } = render(<WebListe beschriftung="Leute" spalten={SPALTEN} zeilen={LEUTE} zeileSchluessel={(p) => p.id} loeschen={loeschen(klick, true)} />);
    const knopf = screen.getByRole('button', { name: 'Bea löschen' });
    expect(knopf).toBeDisabled();
    fireEvent.click(knopf);
    expect(klick).not.toHaveBeenCalled();
    unmount();
    render(<WebListe beschriftung="Leute" spalten={SPALTEN} zeilen={LEUTE} zeileSchluessel={(p) => p.id} loeschen={loeschen(klick, false)} />);
    expect(screen.getByRole('button', { name: 'Bea löschen' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'Bea löschen' }));
    expect(klick).toHaveBeenCalledTimes(1);
  });

  it('Kacheln: dieselben Regeln im Fuss der Karte', () => {
    render(
      <WebKacheln<Person>
        beschriftung="Leute"
        eintraege={LEUTE}
        schluessel={(p) => p.id}
        karte={(p) => ({ akzent: 'var(--app-color-konfis)', symbol: <WebBildKarteSymbol text="AB" />, label: 'Person', titel: p.name })}
        bearbeiten={bearbeiten()}
        loeschen={loeschen(vi.fn(), true)}
      />,
    );
    const [bea, carl] = within(screen.getByRole('list', { name: 'Leute' })).getAllByRole('listitem');
    expect(within(bea).getByRole('button', { name: 'Bea bearbeiten' })).toBeEnabled();
    expect(within(carl).queryByRole('button', { name: 'Carl bearbeiten' })).toBeNull();
    expect(within(carl).getByRole('button', { name: 'Carl löschen' })).toBeDisabled();
  });

  it('Kacheln: ohne sichtbare Aktion und ohne `fuss` gibt es keinen Fuss', () => {
    const { container } = render(
      <WebKacheln<Person>
        beschriftung="Leute"
        eintraege={[LEUTE[1]]}
        schluessel={(p) => p.id}
        karte={(p) => ({ akzent: 'var(--app-color-konfis)', symbol: <WebBildKarteSymbol text="AB" />, label: 'Person', titel: p.name })}
        bearbeiten={bearbeiten()}
      />,
    );
    expect(container.querySelector('.web-bildkarte__fuss')).toBeNull();
  });
});

describe('WebListe: weitere Knoepfe', () => {
  it('stehen in der Spalte der Aktionen vor Bearbeiten und Loeschen; die Breite kommt von der Seite', () => {
    render(
      <WebListe beschriftung="Leute" spalten={SPALTEN} zeilen={LEUTE} zeileSchluessel={(p) => p.id}
        weitere={(p) => <button type="button">{`${p.name} schreiben`}</button>}
        bearbeiten={{ onKlick: vi.fn(), beschriftung: (p) => `${p.name} bearbeiten` }}
        loeschen={{ onKlick: vi.fn(), beschriftung: (p) => `${p.name} löschen` }}
        aktionenBreite="300px" />,
    );
    const kopfzeile = within(screen.getByRole('table', { name: 'Leute' })).getAllByRole('columnheader');
    expect(kopfzeile.map((c) => c.textContent)).toEqual(['Name', 'Aktionen']);
    expect(kopfzeile[1]).toHaveStyle({ width: '300px' });
    const knoepfe = within(zeile('Bea')).getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? b.textContent);
    expect(knoepfe).toEqual(['Bea schreiben', 'Bea bearbeiten', 'Bea löschen']);
  });

  it('auch allein ergeben sie die Spalte der Aktionen (ohne Bearbeiten und Loeschen)', () => {
    render(<WebListe beschriftung="Leute" spalten={SPALTEN} zeilen={LEUTE} zeileSchluessel={(p) => p.id}
      weitere={(p) => <button type="button">{`${p.name} zurückziehen`}</button>} />);
    expect(within(screen.getByRole('table', { name: 'Leute' })).getAllByRole('columnheader').map((c) => c.textContent)).toEqual(['Name', 'Aktionen']);
    expect(within(zeile('Carl')).getByRole('button', { name: 'Carl zurückziehen' })).toBeInTheDocument();
  });
});

const STAENDE = wahlen([
  { schluessel: 'offen', label: 'Offen' },
  { schluessel: 'neu', label: 'Neu', zahlText: () => 'neu' },
]);

type SeiteProps = Partial<WebListenSeiteProps<Person, 'offen' | 'neu'>>;
const Seite: React.FC<SeiteProps> = (p) => (
  <WebListenSeite<Person, 'offen' | 'neu'>
    bereich="Support"
    titel="Vorgänge"
    eintraege={LEUTE}
    liste={{ beschriftung: 'Leute', spalten: SPALTEN, zeileSchluessel: (x) => x.id }}
    leer={{ icon: ICON_GRUPPE, titel: 'Nichts da', text: 'Leer.' }}
    {...p}
  />
);

describe('WebListenSeite: nur Liste', () => {
  it('ohne `kacheln`: kein Umschalter, immer die Liste, nichts wird gemerkt -- auch wenn der Browser Kacheln gemerkt hat', () => {
    window.localStorage.setItem(ansichtSchluessel('benutzer'), 'kacheln');
    render(<Seite ansicht={{ seite: 'benutzer', vorgabe: 'kacheln' }} suche={{ beschriftung: 'Suchen', wert: '', onWert: vi.fn() }} />);
    expect(screen.queryByRole('group', { name: 'Ansicht' })).toBeNull();
    expect(screen.getByRole('table', { name: 'Leute' })).toBeInTheDocument();
    expect(window.localStorage.length).toBe(1);
  });

  it('mit `kacheln` bleibt der Umschalter (Gegenprobe)', () => {
    render(<Seite ansicht={{ seite: 'benutzer', vorgabe: 'liste' }}
      kacheln={{ beschriftung: 'Leute', schluessel: (x) => x.id, karte: (x) => ({ akzent: 'red', symbol: null, label: 'P', titel: x.name }) }} />);
    expect(screen.getByRole('group', { name: 'Ansicht' })).toBeInTheDocument();
  });

  it('ohne Reiter, Filter, Suche, Knoepfe und Kacheln steht keine Werkzeugzeile da; mit Suche schon', () => {
    const { container, unmount } = render(<Seite />);
    expect(container.querySelector('.web-werkzeuge')).toBeNull();
    unmount();
    const zweite = render(<Seite suche={{ beschriftung: 'Suchen', wert: '', onWert: vi.fn() }} />);
    expect(zweite.container.querySelector('.web-werkzeuge')).not.toBeNull();
  });
});

describe('WebListenSeite: die Seite filtert selbst', () => {
  it('Suche ohne `felder`: die Eintraege bleiben, wie sie kommen; die Zaehlzeile steht trotzdem', () => {
    render(<Seite suche={{ beschriftung: 'Suchen', wert: 'zzz', onWert: vi.fn() }} zaehlzeile={(n, g) => `${n} von ${g}`} />);
    expect(within(screen.getByRole('table', { name: 'Leute' })).getAllByRole('row')).toHaveLength(3);
    expect(screen.getByRole('status')).toHaveTextContent('2 von 2');
  });

  it('Suche mit `felder` filtert weiter in der Huelle (Gegenprobe)', () => {
    render(<Seite suche={{ beschriftung: 'Suchen', wert: 'zzz', onWert: vi.fn(), felder: (x) => [x.name] }} />);
    expect(screen.getByText('Nichts da')).toBeInTheDocument();
  });

  it('Filter-Wahlen ohne `passt` lassen alles durch und melden nur den Wechsel', () => {
    const onWert = vi.fn();
    render(<Seite filter={[{ beschriftung: 'Art', darstellung: 'auswahl', wahlen: [{ schluessel: 'alle', label: 'Alle' }, { schluessel: 'mail', label: 'Mail' }], wert: 'mail', onWert }]} />);
    expect(within(screen.getByRole('table', { name: 'Leute' })).getAllByRole('row')).toHaveLength(3);
    fireEvent.change(screen.getByRole('combobox', { name: 'Art' }), { target: { value: 'alle' } });
    expect(onWert).toHaveBeenCalledWith('alle');
  });
});

describe('WebListenSeite: Reiter mit roter Zahl und Inhalt vor der Liste', () => {
  it('rot nur beim Reiter, den die Seite nennt, und nur ueber null', () => {
    render(<Seite reiter={{ beschriftung: 'Stand', wahlen: STAENDE, wert: 'offen', onWert: vi.fn(), zahlen: { offen: 4, neu: 2 }, rot: (w) => w === 'neu' }} />);
    const gruppe = screen.getByRole('group', { name: 'Stand' });
    const zahl = (name: RegExp) => within(gruppe).getByRole('button', { name }).querySelector('.web-chip__zahl') as HTMLElement;
    expect(zahl(/^Neu/)).toHaveClass('web-chip__zahl--rot');
    expect(zahl(/^Offen/)).not.toHaveClass('web-chip__zahl--rot');
  });

  it('`vorInhalt` steht zwischen Werkzeugzeile und Liste', () => {
    render(<Seite suche={{ beschriftung: 'Suchen', wert: '', onWert: vi.fn() }} vorInhalt={<div data-testid="leiste">Auswahl</div>} />);
    const leiste = screen.getByTestId('leiste');
    expect(leiste.previousElementSibling).toHaveClass('web-werkzeuge');
    expect(leiste.nextElementSibling).toHaveClass('web-karte');
    expect(within(leiste.nextElementSibling as HTMLElement).getByRole('table', { name: 'Leute' })).toBeInTheDocument();
  });
});

describe('useAnsicht ohne Seite', () => {
  it('liest und merkt nichts, wechselt aber bis zum Neuladen', () => {
    window.localStorage.setItem(ansichtSchluessel('levels'), 'kacheln');
    const { result } = renderHook(() => useAnsicht(null, 'liste'));
    expect(result.current[0]).toBe('liste');
    act(() => result.current[1]('kacheln'));
    expect(result.current[0]).toBe('kacheln');
    expect(window.localStorage.length).toBe(1);
  });
});
