// Die zwei gemeinsamen Bausteine der Web-Fassung (Simon, 06.10.2026):
// - WebDetailSeite: jede Detailseite gleich aufgebaut -- Kopf mit Titel,
//   Kennzeichen und allen Aktionen, darunter die Kennzahlen, dann links breit
//   das Eigentliche und rechts schmal die Angaben;
// - Umschalter Liste | Kacheln mit gemerkter Wahl je Seite; die Leitung
//   startet mit der Liste, Konfis und Team mit Kacheln.
import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, within, act, renderHook } from '@testing-library/react';

vi.mock('@ionic/react', async () => (await import('../support/ionicAttrappe')).ionicAttrappe({}));
vi.mock('../../../components/shared/AppKopfzeile', async () => (await import('../support/ionicAttrappe')).KopfzeileAttrappe);
vi.mock('../../../components/shared/WartungsHinweis', () => ({ default: () => null }));

import WebDetailSeite, { WebDetailInhalt } from '../../../components/web/WebDetailSeite';
import WebAnsichtUmschalter from '../../../components/web/WebAnsichtUmschalter';
import { ansichtSchluessel, ansichtVorgabe, useAnsicht } from '../../../components/web/useAnsicht';

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe('WebDetailSeite', () => {
  const seite = () => render(
    <WebDetailSeite
      bereich="Mitmachen"
      zurueck={{ href: '/admin/events', text: 'Alle Events' }}
      titel="Weihnachtsgottesdienst"
      kennzeichen={<span>Offen</span>}
      aktionen={<button type="button">Bearbeiten</button>}
      hinweis={<p>Abgesagt: Glatteis</p>}
      kennzahlen={[{ label: 'Teilnehmende', wert: '1 / 50' }, { label: 'Punkte', wert: '2' }]}
      haupt={<section>Teilnehmende-Tabelle</section>}
      seite={<section>Angaben-Liste</section>}
    />,
  );

  it('Kopf: Titel als Überschrift, Kennzeichen darunter, Aktionen im Kopf, Zurück-Link', () => {
    seite();
    const kopf = screen.getByRole('heading', { level: 1, name: 'Weihnachtsgottesdienst' }).closest('header')!;
    expect(within(kopf).getByText('Offen')).toBeTruthy();
    expect(within(kopf).getByRole('button', { name: 'Bearbeiten' })).toBeTruthy();
    expect(screen.getByRole('navigation', { name: 'Zurück' }).querySelector('a')!.getAttribute('href')).toBe('/admin/events');
  });

  it('Kennzahlen als Kacheln in der übergebenen Reihenfolge, nach dem Hinweis', () => {
    const { container } = seite();
    const kacheln = [...container.querySelectorAll('.web-detail__kennzahlen .web-kachel')].map((k) => k.getAttribute('aria-label'));
    expect(kacheln).toEqual(['Teilnehmende: 1 / 50', 'Punkte: 2']);
    const detail = container.querySelector('.web-detail')!;
    expect(detail.firstElementChild!.textContent).toBe('Abgesagt: Glatteis');
  });

  it('links das Eigentliche, rechts die Angaben -- auch im Dokument in dieser Reihenfolge', () => {
    const { container } = seite();
    const spalten = container.querySelector('.web-spalten')!;
    expect(spalten.classList.contains('web-spalten--links')).toBe(false);
    expect(spalten.children[0].textContent).toBe('Teilnehmende-Tabelle');
    expect(spalten.children[1].tagName).toBe('ASIDE');
    expect(screen.getByRole('complementary', { name: 'Angaben' }).textContent).toBe('Angaben-Liste');
  });

  it('ohne Kennzahlen keine leere Reihe', () => {
    const { container } = render(
      <WebDetailSeite bereich="Challenges" zurueck={{ href: '/x', text: 'Alle' }} titel="T" haupt={<p>a</p>} seite={<p>b</p>} />,
    );
    expect(container.querySelector('.web-detail__kennzahlen')).toBeNull();
  });
});

describe('WebDetailInhalt: derselbe Inhalt ohne eigene Seite (Challenges halten eine IonPage fuer alle Zustaende)', () => {
  it('Hinweis, Kennzahlen, links der Inhalt, rechts "Angaben" -- ohne Kopf, den setzt der Rahmen der Seite', () => {
    const { container } = render(
      <WebDetailInhalt
        hinweis={<p>Seit deinem letzten Besuch</p>}
        kennzahlen={[{ label: 'Beiträge', wert: '3' }]}
        haupt={<section>Beiträge-Raster</section>}
        seite={<section>Angaben-Liste</section>}
      />,
    );
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
    expect(container.querySelector('header')).toBeNull();
    const detail = container.querySelector('.web-detail')!;
    expect([...detail.children].map((k) => k.className)).toEqual(['', 'web-raster web-raster--kacheln web-detail__kennzahlen', 'web-spalten']);
    expect(screen.getByRole('group', { name: 'Beiträge: 3' })).toBeTruthy();
    expect(container.querySelector('.web-spalten')!.children[0].textContent).toBe('Beiträge-Raster');
    expect(screen.getByRole('complementary', { name: 'Angaben' }).textContent).toBe('Angaben-Liste');
  });
});

describe('Umschalter Liste | Kacheln', () => {
  it('zwei Knöpfe, der gewählte ist gedrückt, ein Klick meldet die Wahl', () => {
    const onWert = vi.fn();
    render(<WebAnsichtUmschalter wert="liste" onWert={onWert} />);
    const gruppe = screen.getByRole('group', { name: 'Ansicht' });
    const liste = within(gruppe).getByRole('button', { name: 'Liste' });
    const kacheln = within(gruppe).getByRole('button', { name: 'Kacheln' });
    expect(liste.getAttribute('aria-pressed')).toBe('true');
    expect(kacheln.getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(kacheln);
    expect(onWert).toHaveBeenCalledWith('kacheln');
  });

  it.each([
    ['org_admin', 'liste'],
    ['admin', 'liste'],
    ['super_admin', 'liste'],
    ['teamer', 'kacheln'],
    ['konfi', 'kacheln'],
    [null, 'kacheln'],
  ])('Vorgabe für %s: %s', (rolle, erwartet) => {
    expect(ansichtVorgabe(rolle)).toBe(erwartet);
  });

  it('ohne gemerkte Wahl gilt die Vorgabe; die Wahl wird je Seite gemerkt', () => {
    const { result, unmount } = renderHook(() => useAnsicht('events-leitung', 'liste'));
    expect(result.current[0]).toBe('liste');
    act(() => result.current[1]('kacheln'));
    expect(result.current[0]).toBe('kacheln');
    expect(window.localStorage.getItem(ansichtSchluessel('events-leitung'))).toBe('kacheln');
    unmount();

    // Beim nächsten Öffnen steht die gemerkte Wahl -- auf dieser Seite, nicht auf einer anderen.
    expect(renderHook(() => useAnsicht('events-leitung', 'liste')).result.current[0]).toBe('kacheln');
    expect(renderHook(() => useAnsicht('konfis', 'liste')).result.current[0]).toBe('liste');
  });

  it('ein unbekannter gemerkter Wert zählt nicht', () => {
    window.localStorage.setItem(ansichtSchluessel('konfis'), 'tabelle');
    expect(renderHook(() => useAnsicht('konfis', 'liste')).result.current[0]).toBe('liste');
  });

  it('ohne Speicher (privates Fenster): Vorgabe, und der Umschalter wirkt trotzdem', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('gesperrt'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('gesperrt'); });
    const { result } = renderHook(() => useAnsicht('challenges-mitglied', 'kacheln'));
    expect(result.current[0]).toBe('kacheln');
    act(() => result.current[1]('liste'));
    expect(result.current[0]).toBe('liste');
  });
});
