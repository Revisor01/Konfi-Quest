// Die Huelle jeder Detailseite der Web-Fassung (components/web/WebDetailSeite.tsx,
// ausgebaut 10.10.2026): Kopf mit Kreis, Angaben-Karte, die drei Zustaende
// unter demselben Kopf, Fenster der Seite -- und WebDetailListe, die Karte mit
// Tabelle fuer Detailseiten (Leerzustand, Offenes oben, "Alle anzeigen" mit
// Sortieren der ganzen Liste).
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';

vi.mock('@ionic/react', async () => (await import('../support/ionicAttrappe')).ionicAttrappe({}));
vi.mock('../../../components/shared/AppKopfzeile', async () => (await import('../support/ionicAttrappe')).KopfzeileAttrappe);
vi.mock('../../../components/shared/WartungsHinweis', () => ({ default: () => null }));

import WebDetailSeite, { WebDetailListe } from '../../../components/web/WebDetailSeite';
import WebKreis from '../../../components/web/WebKreis';
import type { WebSpalte } from '../../../components/web/WebListe';

const ZURUECK = { href: '/admin/konfis', text: 'Alle Konfis' };
const titelKopf = () => screen.getByRole('heading', { level: 1, name: 'Anna Muster' }).closest('header') as HTMLElement;

describe('WebDetailSeite: Kopf und Inhalt', () => {
  const seite = (extra: Partial<React.ComponentProps<typeof WebDetailSeite>> = {}) => render(
    <WebDetailSeite
      bereich="Verwaltung"
      zurueck={ZURUECK}
      titel="Anna Muster"
      kreis={<WebKreis text="AM" ton="konfis" gross />}
      kennzeichen={<span>Jahrgang 2026</span>}
      aktionen={<button type="button">Konfi bearbeiten</button>}
      angaben={[{ label: 'Jahrgang', wert: '2026' }, { label: 'Benutzername', wert: '@anna' }]}
      angabenBeschriftung="Angaben zur Konfi"
      angabenVorspann={<p>Offline nicht aktuell</p>}
      haupt={<section>Aktivitäten-Tabelle</section>}
      seite={<section>Stempel-Karte</section>}
      {...extra}
    />,
  );

  it('der Kreis steht im Kopf vor dem Titel, Kennzeichen und Aktionen daneben', () => {
    seite();
    const kopf = titelKopf();
    const kreis = kopf.querySelector('.web-initialen--gross')!;
    expect(kreis.textContent).toBe('AM');
    expect(kreis.compareDocumentPosition(screen.getByRole('heading', { level: 1, name: 'Anna Muster' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(kopf).getByText('Jahrgang 2026')).toBeTruthy();
    expect(within(kopf).getByRole('button', { name: 'Konfi bearbeiten' })).toBeTruthy();
  });

  it('die Angaben sind die erste Karte der schmalen Spalte, Vorspann darin, danach die übrige Seite', () => {
    seite();
    const spalte = screen.getByRole('complementary', { name: 'Angaben' });
    const [erste, zweite] = [...spalte.children] as HTMLElement[];
    expect(within(erste).getByRole('heading', { level: 2 }).textContent).toBe('Angaben');
    expect(erste.textContent).toContain('Offline nicht aktuell');
    const liste = within(erste).getByLabelText('Angaben zur Konfi');
    expect([...liste.querySelectorAll('dt')].map((d) => d.textContent)).toEqual(['Jahrgang', 'Benutzername']);
    expect([...liste.querySelectorAll('dd')].map((d) => d.textContent)).toEqual(['2026', '@anna']);
    expect(zweite.textContent).toBe('Stempel-Karte');
    expect(spalte.children).toHaveLength(2);
  });

  it('ohne Angaben steht nur die übrige Seite in der schmalen Spalte', () => {
    seite({ angaben: undefined });
    expect(screen.getByRole('complementary', { name: 'Angaben' }).textContent).toBe('Stempel-Karte');
  });

  it('Laden: Platzhalter mit Satz, Titel und Zurück bleiben, kein Inhalt, keine Kennzeichen, Aktionen, Kreis', () => {
    const { container } = seite({ laden: 'Die Konfi wird geladen.' });
    expect(screen.getByRole('status').textContent).toBe('Die Konfi wird geladen.');
    expect(container.querySelectorAll('.web-skelett--karte')).toHaveLength(2);
    expect(screen.getByRole('link', { name: 'Alle Konfis' }).getAttribute('href')).toBe('/admin/konfis');
    expect(container.querySelector('.web-detail')).toBeNull();
    expect(screen.queryByText('Jahrgang 2026')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Konfi bearbeiten' })).toBeNull();
    expect(container.querySelector('.web-initialen')).toBeNull();
  });

  it('Fehler: Meldung mit "Erneut versuchen", das lädt neu', () => {
    const onErneut = vi.fn();
    const { container } = seite({ fehler: { text: 'Diese Person konnte nicht geladen werden.', onErneut } });
    expect(screen.getByRole('alert').textContent).toContain('Diese Person konnte nicht geladen werden.');
    fireEvent.click(screen.getByRole('button', { name: 'Erneut versuchen' }));
    expect(onErneut).toHaveBeenCalledTimes(1);
    expect(container.querySelector('.web-detail')).toBeNull();
  });

  it('Leer (nicht gefunden): Symbol, Titel, Satz und Aktion in einer Karte', () => {
    const zurueck = vi.fn();
    const { container } = seite({
      leer: { icon: 'x', titel: 'Gibt es nicht mehr', text: 'Diese Challenge wurde gelöscht.', aktion: <button type="button" onClick={zurueck}>Zu den Challenges</button> },
    });
    const karte = container.querySelector('.web-karte > .web-leer') as HTMLElement;
    expect(within(karte).getByRole('heading', { level: 3 }).textContent).toBe('Gibt es nicht mehr');
    expect(karte.textContent).toContain('Diese Challenge wurde gelöscht.');
    fireEvent.click(within(karte).getByRole('button', { name: 'Zu den Challenges' }));
    expect(zurueck).toHaveBeenCalledTimes(1);
  });

  it('Reihenfolge der Zustände: eigener Zustand vor Laden vor Fehler vor Leer', () => {
    const fehler = { text: 'Fehler', onErneut: () => {} };
    const leer = { icon: 'x', titel: 'Leer', text: 'leer' };
    const { rerender } = seite({ zustand: <p>Eigener Zustand</p>, laden: 'Laedt', fehler, leer });
    expect(screen.getByText('Eigener Zustand')).toBeTruthy();
    expect(screen.queryByRole('status')).toBeNull();
    rerender(<WebDetailSeite bereich="V" zurueck={ZURUECK} titel="Anna Muster" laden="Laedt" fehler={fehler} leer={leer} />);
    expect(screen.getByRole('status').textContent).toBe('Laedt');
    expect(screen.queryByRole('alert')).toBeNull();
    rerender(<WebDetailSeite bereich="V" zurueck={ZURUECK} titel="Anna Muster" fehler={fehler} leer={leer} />);
    expect(screen.getByRole('alert').textContent).toContain('Fehler');
    expect(screen.queryByText('leer')).toBeNull();
  });

  it('Fenster der Seite (children) stehen in jedem Zustand nach dem Inhalt', () => {
    const { container, rerender } = seite({ children: <div role="dialog" aria-label="Beitrag ausblenden" /> });
    const dialog = screen.getByRole('dialog', { name: 'Beitrag ausblenden' });
    expect(container.querySelector('.web-detail')!.compareDocumentPosition(dialog) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    rerender(<WebDetailSeite bereich="V" zurueck={ZURUECK} titel="Anna Muster" laden="Laedt"><div role="dialog" aria-label="Beitrag ausblenden" /></WebDetailSeite>);
    expect(screen.getByRole('dialog', { name: 'Beitrag ausblenden' })).toBeTruthy();
  });
});

describe('WebSeite: ohne eigene IonPage (Challenges halten eine IonPage für alle Zustände)', () => {
  it('ohneIonPage rendert keine IonPage, mit Vorgabe schon', async () => {
    vi.resetModules();
    vi.doMock('@ionic/react', async () => ({
      ...(await import('../support/ionicAttrappe')).ionicAttrappe({}),
      IonPage: ({ children }: { children?: React.ReactNode }) => <div data-testid="ion-page">{children}</div>,
    }));
    const { default: Seite } = await import('../../../components/web/WebDetailSeite');
    const { unmount } = render(<Seite bereich="Challenges" zurueck={ZURUECK} titel="Fotochallenge" ohneIonPage haupt={<p>a</p>} />);
    expect(screen.queryByTestId('ion-page')).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'Fotochallenge' })).toBeTruthy();
    unmount();
    render(<Seite bereich="Challenges" zurueck={ZURUECK} titel="Fotochallenge" haupt={<p>a</p>} />);
    expect(screen.getByTestId('ion-page')).toBeTruthy();
    vi.doUnmock('@ionic/react');
  });
});

interface Zeile { id: number; name: string; punkte: number }
const SPALTEN: Array<WebSpalte<Zeile>> = [
  { schluessel: 'name', kopf: 'Name', sortWert: (z) => z.name, zelle: (z) => <span className="web-zelle-titel">{z.name}</span> },
  { schluessel: 'punkte', kopf: 'Punkte', zahl: true, sortWert: (z) => z.punkte, zelle: (z) => z.punkte },
];
const namenIn = (tabelle: HTMLElement) => [...tabelle.querySelectorAll('tbody .web-zelle-titel')].map((n) => n.textContent);

describe('WebDetailListe: Tabellen in Detailseiten', () => {
  it('Karte mit Titel, Aktion und Tabelle (Name der Tabelle = Titel), bis an die Kanten', () => {
    render(
      <WebDetailListe titel="Bonuspunkte" aktion={<button type="button">Bonuspunkte vergeben</button>} spalten={SPALTEN}
        zeilen={[{ id: 1, name: 'Ben', punkte: 2 }]} zeileSchluessel={(z) => z.id} />,
    );
    const karte = screen.getByRole('region', { name: 'Bonuspunkte' });
    expect(within(karte).getByRole('button', { name: 'Bonuspunkte vergeben' })).toBeTruthy();
    expect(within(karte).getByRole('table', { name: 'Bonuspunkte' })).toBeTruthy();
    expect(karte.querySelector('.web-karte__inhalt--bund')).not.toBeNull();
  });

  it('leer als Satz: leise Zeile, nicht bis an die Kanten; leer als Zustand: WebLeer, bis an die Kanten', () => {
    const { unmount } = render(<WebDetailListe titel="Team (0)" leer="Noch niemand vom Team angemeldet." spalten={SPALTEN} zeilen={[]} zeileSchluessel={(z) => z.id} />);
    const karte = screen.getByRole('region', { name: 'Team (0)' });
    expect(within(karte).getByRole('status').textContent).toBe('Noch niemand vom Team angemeldet.');
    expect(within(karte).queryByRole('table')).toBeNull();
    expect(karte.querySelector('.web-karte__inhalt--bund')).toBeNull();
    unmount();
    render(<WebDetailListe titel="Bonuspunkte" leer={{ icon: 'x', titel: 'Keine Bonuspunkte', text: 'Noch keine Bonuspunkte erhalten.' }} spalten={SPALTEN} zeilen={[]} zeileSchluessel={(z) => z.id} />);
    const zwei = screen.getByRole('region', { name: 'Bonuspunkte' });
    expect(within(zwei).getByRole('heading', { level: 3 }).textContent).toBe('Keine Bonuspunkte');
    expect(zwei.querySelector('.web-karte__inhalt--bund')).not.toBeNull();
  });

  it('Offenes oben ersetzt den Leerzustand und steht vor der Tabelle', () => {
    render(
      <WebDetailListe titel="Aktivitäten" oben={<ul aria-label="Offene Anträge"><li>Kirchenputz</li></ul>}
        leer={{ icon: 'x', titel: 'Keine Aktivitäten', text: 'Noch keine.' }} spalten={SPALTEN} zeilen={[]} zeileSchluessel={(z) => z.id} />,
    );
    const karte = screen.getByRole('region', { name: 'Aktivitäten' });
    expect(within(karte).getByRole('list', { name: 'Offene Anträge' }).textContent).toBe('Kirchenputz');
    expect(within(karte).queryByText('Keine Aktivitäten')).toBeNull();
  });

  it('kurz: nur die ersten Zeilen, "Alle 12 anzeigen" klappt auf und zu', () => {
    const zeilen = Array.from({ length: 12 }, (_, i) => ({ id: i, name: `P${String(i).padStart(2, '0')}`, punkte: i }));
    render(<WebDetailListe titel="Events" kurz={10} spalten={SPALTEN} zeilen={zeilen} zeileSchluessel={(z) => z.id} />);
    const tabelle = screen.getByRole('table', { name: 'Events' });
    expect(namenIn(tabelle)).toHaveLength(10);
    fireEvent.click(screen.getByRole('button', { name: 'Alle 12 anzeigen' }));
    expect(namenIn(screen.getByRole('table', { name: 'Events' }))).toHaveLength(12);
    fireEvent.click(screen.getByRole('button', { name: 'Weniger anzeigen' }));
    expect(namenIn(screen.getByRole('table', { name: 'Events' }))).toHaveLength(10);
  });

  it('kurz: der Klick auf den Spaltenkopf sortiert die GANZE Liste, bevor gekürzt wird', () => {
    const zeilen = Array.from({ length: 12 }, (_, i) => ({ id: i, name: `P${String(i).padStart(2, '0')}`, punkte: i }));
    render(<WebDetailListe titel="Events" kurz={10} spalten={SPALTEN} zeilen={zeilen} zeileSchluessel={(z) => z.id} />);
    const kopf = screen.getByRole('columnheader', { name: /^Punkte/ });
    fireEvent.click(within(kopf).getByRole('button')); // aufsteigend
    fireEvent.click(within(kopf).getByRole('button')); // absteigend
    expect(kopf.getAttribute('aria-sort')).toBe('descending');
    // Die beiden groessten stehen oben -- obwohl sie vorher hinter der Grenze lagen.
    expect(namenIn(screen.getByRole('table', { name: 'Events' })).slice(0, 2)).toEqual(['P11', 'P10']);
  });

  it('ohne kurz: kein "Alle anzeigen", alle Zeilen', () => {
    const zeilen = Array.from({ length: 12 }, (_, i) => ({ id: i, name: `P${i}`, punkte: i }));
    render(<WebDetailListe titel="Zertifikate" spalten={SPALTEN} zeilen={zeilen} zeileSchluessel={(z) => z.id} />);
    expect(namenIn(screen.getByRole('table', { name: 'Zertifikate' }))).toHaveLength(12);
    expect(screen.queryByRole('button', { name: /anzeigen/ })).toBeNull();
  });
});
