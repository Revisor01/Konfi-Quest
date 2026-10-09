import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, cleanup } from '@testing-library/react';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { hintergrundFuer, verteileMotive } from '../../components/wrapped/hintergrundbilder';

/**
 * Die Sonderseite zur Sommerfreizeit 2026 nach Stavanger.
 *
 * SIMONS VORGABE (07.09.2026): "kannst du bitte eine seite bauen fuer
 * sommerfreizeit 2026 stavanger norwegen. das sehen dann nur die teamer und
 * konfis die dabei waren." Und der Text dazu: "Norwegen 2026 - du warst
 * dabei. 14 unvergessliche Tage in Himmel og Hav."
 *
 * Gerendert: die Seite selbst und der ECHTE Rueckblick (WrappedModal) fuer
 * Konfis und Team mit `kacheln: ['stavanger-2026']` -- dann steht die Seite
 * aktiv auf dem Bildschirm und die Teilen-Karte daneben traegt ihren Inhalt.
 * wrappedDramaturgieHatRenderer und wrappedTeilenAlleSeiten halten die Listen
 * gegeneinander; hier geht es darum, WAS auf der Seite steht.
 */

vi.mock('../../services/api', () => ({ default: { get: vi.fn(async () => ({ data: {} })) } }));
vi.mock('../../services/analytics', () => ({ trackHandlung: vi.fn() }));

import Stavanger2026Slide from '../../components/wrapped/slides/Stavanger2026Slide';
import WrappedModal from '../../components/wrapped/WrappedModal';
import type { KonfiWrappedData, TeamerWrappedData } from '../../types/wrapped';

afterEach(() => cleanup());

const KONFI = {
  version: 3,
  highlight_type: 'events_held',
  formulierung_seed: 0,
  kacheln: ['stavanger-2026'],
  slides: {
    punkte: { total: 137, gottesdienst: 81, gemeinde: 56 },
    events: { total_attended: 23 },
    badges: { total_earned: 0, total_available: 0, badges: [] },
    aktivster_monat: { monat: 5, monat_name: 'Mai', aktivitaeten: 11 },
    endspurt: { aktiv: false, aktuell_total: 137, ziel_total: 100, fehlende_punkte: 0 },
    zeitraum: { start: '2025-09-01', ende: '2026-05-10', konfirmation: null },
    kategorie: { top_kategorie: null, verteilung: [] },
  },
} as unknown as KonfiWrappedData;

const TEAMER = {
  version: 3,
  kacheln: ['stavanger-2026'],
  slides: { engagement: { teamer_seit: null } },
} as unknown as TeamerWrappedData;

const seite = (c: HTMLElement) => c.querySelector('.wrapped-slide.stavanger-slide') as HTMLElement | null;
const text = (el: Element | null, sel: string) => el?.querySelector(sel)?.textContent?.trim() ?? null;

describe('Sonderseite Stavanger 2026', () => {
  it('zeigt Simons Text in drei Teilen', () => {
    // Auge klein oben, Slogan gross, Nachsatz darunter -- so entschieden
    // am 07.09.2026.
    const { container } = render(<Stavanger2026Slide isActive />);
    const s = seite(container);
    expect(text(s, '.kat-auge')).toBe('Stavanger 2026');
    expect(Array.from(s!.querySelectorAll('.kat-slogan span')).map((x) => x.textContent)).toEqual(['Du warst', 'dabei.']);
    expect(text(s, '.kat-nachsatz')).toBe('14 unvergessliche Tage in Himmel og Hav.');
  });

  it('laesst "Himmel og Hav" unuebersetzt stehen', () => {
    // Es ist das Fahrtmotto und bleibt norwegisch (Simons Entscheidung).
    const { container } = render(<Stavanger2026Slide isActive />);
    expect(container.textContent).not.toMatch(/Himmel und Meer|Himmel og Hav \(/);
  });

  it('rechnet KEINE Zahl aus und zeigt keine gross an', () => {
    // DER KERN DER SEITE. Die Fahrt dauerte 14 Tage, unabhaengig davon, wie
    // oft jemand angehakt wurde. '.kat-zahl' ist das grosse Zahlenfeld aller
    // Kategorie-Seiten -- es darf hier nicht vorkommen. Die einzige Ziffer
    // ist die woertliche 14 im Nachsatz (und die Jahreszahl im Auge).
    const { container } = render(<Stavanger2026Slide isActive />);
    expect(container.querySelectorAll('.kat-zahl')).toHaveLength(0);
    expect(container.textContent!.match(/\d+/g)).toEqual(['2026', '14']);
  });

  it('ist eine EIGENE Komponente, keine Kategorie-Seite', () => {
    // KategorieSeiteSlide traegt fest eine Zahl und waehlt den Slogan ueber
    // stufeFuer(n). Die Sonderseite traegt ihre eigene Klasse statt
    // kategorie-seite.
    const { container } = render(<Stavanger2026Slide isActive />);
    const s = seite(container)!;
    expect(s.className).toBe('wrapped-slide wrapped-slide--active stavanger-slide');
  });

  it('steht in BEIDEN Rueckblicken -- Konfi und Team', () => {
    // Simon: "das sehen dann nur die teamer und konfis die dabei waren."
    const konfi = render(
      <WrappedModal onClose={vi.fn()} displayName="Kim" wrappedType="konfi" initialData={KONFI} initialYear={2026} />,
    );
    expect(text(seite(konfi.container), '.kat-nachsatz')).toBe('14 unvergessliche Tage in Himmel og Hav.');
    expect(konfi.container.querySelectorAll('.wrapped-slide')).toHaveLength(1);
    cleanup();

    const team = render(
      <WrappedModal onClose={vi.fn()} displayName="Tom" wrappedType="teamer" initialData={TEAMER} initialYear={2026} />,
    );
    expect(text(seite(team.container), '.kat-nachsatz')).toBe('14 unvergessliche Tage in Himmel og Hav.');
    expect(team.container.querySelectorAll('.wrapped-slide')).toHaveLength(1);
  });

  it('traegt einen Schluessel OHNE kategorie:- oder datum:-Praefix', () => {
    // DER VERTRAG MIT DEN AUSGELIEFERTEN APPS (Build 176): Dort werden beide
    // Praefixe als MUSTER behandelt -- ein unbekannter so beginnender
    // Schluessel wuerde zur leeren weissen Seite. Ohne Praefix faellt er dort
    // durch `if (renderers[kachel])` und verschwindet. Der Schluessel, unter
    // dem der Rueckblick die Seite zeigt, ist genau 'stavanger-2026' -- das
    // beweist der gerenderte Rueckblick oben mit kacheln: ['stavanger-2026'].
    // Hier: dasselbe Motiv haengt an diesem Schluessel (SlideBase kachel).
    expect('stavanger-2026'.startsWith('kategorie:')).toBe(false);
    expect('stavanger-2026'.startsWith('datum:')).toBe(false);
    expect(hintergrundFuer('stavanger-2026')).toBe('/assets/wrapped/preikestolen.webp');
  });

  it('die Teilen-Karte sagt dasselbe wie die Seite -- ohne Zahl', () => {
    // Was jemand auf dem Bildschirm sieht, soll auch auf dem geteilten Bild
    // stehen -- und dort ebenfalls ohne grosse Zahl.
    for (const [art, daten] of [['konfi', KONFI], ['teamer', TEAMER]] as const) {
      const { container } = render(
        <WrappedModal onClose={vi.fn()} displayName="Kim" wrappedType={art} initialData={daten} initialYear={2026} />,
      );
      const karte = container.querySelector('.share-card--stavanger-2026');
      expect(karte, `Teilen-Karte fehlt (${art})`).not.toBeNull();
      expect(text(karte, '.share-auge')).toBe('Stavanger 2026');
      expect(Array.from(karte!.querySelectorAll('.share-slogan span')).map((x) => x.textContent)).toEqual(['Du warst', 'dabei.']);
      expect(text(karte, '.share-nachsatz')).toBe('14 unvergessliche Tage in Himmel og Hav.');
      expect(karte!.querySelectorAll('.share-zahl')).toHaveLength(0);
      cleanup();
    }
  });

  // WAECHTER (Stylesheet): jsdom rechnet kein CSS -- ob die Klasse einen
  // eigenen Verlauf bekommt, steht nur im Stylesheet.
  it('hat einen eigenen Farbverlauf', () => {
    const modalCss = readFileSync(resolve(process.cwd(), 'src/components/wrapped/WrappedModal.css'), 'utf8');
    expect(modalCss).toMatch(/\.stavanger-slide\s*\{[^}]*--seiten-verlauf/);
  });

  it('zeigt den Preikestolen, und die Datei liegt da', () => {
    const pfad = hintergrundFuer('stavanger-2026');
    expect(pfad).toBe('/assets/wrapped/preikestolen.webp');
    expect(
      readFileSync(resolve(process.cwd(), 'public' + pfad)).length,
      'preikestolen.webp fehlt oder ist leer'
    ).toBeGreaterThan(1000);
  });

  it('behaelt ihr Motiv auch in einem vollen Rueckblick', () => {
    // verteileMotive vergibt Motive ohne Wiederholung. Der Preikestolen ist
    // das einzige Bild, das NUR diese Seite will: Er ist der Ort, von dem
    // sie erzaehlt.
    const voll = [
      'intro', 'events', 'stavanger-2026', 'kategorie:gottesdienst',
      'challenges', 'challenge-momente', 'punkte', 'badges', 'seltenstes',
      'konfirmation', 'abschluss', 'werde-teamer',
    ];
    const verteilung = verteileMotive(voll);
    expect(verteilung['stavanger-2026'].haupt).toBe('/assets/wrapped/preikestolen.webp');
  });
});
