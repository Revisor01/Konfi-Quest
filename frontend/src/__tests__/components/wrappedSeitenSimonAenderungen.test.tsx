// Simons vier Aenderungen am Rueckblick vom 07.09.2026 -- an den Seiten
// selbst geprueft, nicht nur an der Teilen-Karte.
//
// Er hatte den Rueckblick auf dem Geraet gesehen und woertlich gesagt:
//
//   "Dein Leiter Termin kann weg. Und die Uebersicht die geteilt wird sollte
//    die Kirchengemeinde enthalten. Die Punkte und das Konfi Datum. Mit dem
//    Slogan deine Weg deine Zeit dein Glaube. Das soll auch die letzte Folie
//    sein. Die Teamer Folie als vorletztes. Sprich jemanden an kommt der
//    Pfeil weg. Schreib einfach jemandem aus dem Team. Und gestalte mit. Die
//    Kirche und den Glauben von morgen."
//
// Die Reihenfolge (Punkt 3) prueft der Backend-Test (wrappedKacheln), weil
// dort die Dramaturgie liegt. Hier stehen die drei Aenderungen am Aussehen.
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';

vi.mock('@ionic/react', () => ({
  IonIcon: (props: { icon?: unknown }) => <span data-icon={String(props.icon)} />,
}));

import EventsSlide from '../../components/wrapped/slides/EventsSlide';
import AbschlussSlide from '../../components/wrapped/slides/AbschlussSlide';
import WerdeTeamerSlide from '../../components/wrapped/slides/WerdeTeamerSlide';
import type { KonfiWrappedData, KonfiEventsSlide } from '../../types/wrapped';

const EVENTS = {
  total_attended: 23,
  total_available: 30,
  // Das Feld BLEIBT im Snapshot -- ausgelieferte App-Versionen lesen es,
  // und die Antwortform ist ein Vertrag. Nur die Anzeige faellt weg.
  lieblings_event: { name: 'Konfi-Freizeit Ratzeburg', date: '2026-05-01' },
  abgesagt: 0,
} as KonfiEventsSlide;

const KONFI = {
  version: 3,
  highlight_type: 'events_held',
  formulierung_seed: 0,
  slides: {
    gemeinde: 'Kirchspiel Westerdeich',
    punkte: { gottesdienst: 81, gemeinde: 56, total: 137, bonus: 0 },
    events: EVENTS,
    badges: { total_earned: 9, total_available: 20, badges: [] },
    aktivster_monat: { monat: 5, monat_name: 'Mai', aktivitaeten: 11 },
    endspurt: { aktiv: false, fehlende_punkte: 0, ziel_total: 100, aktuell_total: 137 },
    zeitraum: { start: '2025-09-01', ende: '2026-05-10', konfirmation: '2026-05-10' },
    kategorie: { verteilung: [], top_kategorie: null },
  },
} as unknown as KonfiWrappedData;

const text = (el: HTMLElement) => (el.textContent || '').trim();

describe('1. "Dein letzter Termin" ist von der Termin-Seite verschwunden', () => {
  it('der Name des letzten Termins steht nicht mehr auf der Seite', () => {
    const { container } = render(<EventsSlide isActive events={EVENTS} />);
    expect(text(container)).not.toContain('Konfi-Freizeit Ratzeburg');
    expect(text(container)).not.toContain('Dein letzter Termin');
  });

  it('der Merkzettel-Kasten ist ganz weg, nicht nur leer', () => {
    // Ein leerer Kasten haette einen sichtbaren Abstand hinterlassen.
    const { container } = render(<EventsSlide isActive events={EVENTS} />);
    expect(container.querySelector('.w-merkzettel')).toBeNull();
  });

  it('die Seite selbst bleibt vollstaendig', () => {
    // Gegenprobe: Es faellt NUR die eine Zeile weg. Auge, Zahlkasten und
    // Spruch stehen weiterhin da.
    //
    // Die Zahl selbst wird animiert hochgezaehlt (useCountUp) und steht im
    // ersten Bild noch auf 0 -- geprueft wird deshalb, dass der Kasten
    // ueberhaupt da ist, und der Spruch fuer 23 Termine (Stufe "20 und
    // mehr"), der ohne die richtige Zahl gar nicht erst gewaehlt wuerde.
    const { container } = render(<EventsSlide isActive events={EVENTS} />);
    expect(container.querySelector('.kat-zahl')).not.toBeNull();
    const t = text(container);
    expect(t).toContain('Deine Termine');
    expect(t).toContain('Du warstöfter daals mancheMöbel.');
    expect(t).toContain('Du hast kaum etwas ausgelassen.');
  });
});

describe('2. Die Abschluss-Seite nennt die Kirchengemeinde', () => {
  it('Gemeinde, Punkte, Konfirmationstermin und Slogan stehen darauf', () => {
    const { container } = render(<AbschlussSlide isActive data={KONFI} year={2026} />);
    const t = text(container);
    expect(container.querySelector('.kat-gemeinde')?.textContent).toBe('Kirchspiel Westerdeich');
    expect(t).toContain('137');
    expect(t).toContain('Konfirmation am 10. Mai 2026');
    expect(t).toContain('Dein Weg.Deine Zeit.Dein Glaube.');
  });

  it('ein Alt-Snapshot ohne Gemeindenamen bleibt heil', () => {
    // Snapshots von vor dem 07.09.2026 kennen `slides.gemeinde` nicht.
    const alt = JSON.parse(JSON.stringify(KONFI)) as KonfiWrappedData;
    delete (alt.slides as { gemeinde?: string | null }).gemeinde;
    const { container } = render(<AbschlussSlide isActive data={alt} year={2026} />);
    expect(container.querySelector('.kat-gemeinde')).toBeNull();
    expect(text(container)).not.toContain('undefined');
    // Alles andere steht unveraendert da.
    expect(text(container)).toContain('Dein Weg.Deine Zeit.Dein Glaube.');
    expect(text(container)).toContain('137');
  });

  it('ein leerer Gemeindename erzeugt keine leere Zeile', () => {
    const leer = JSON.parse(JSON.stringify(KONFI)) as KonfiWrappedData;
    (leer.slides as { gemeinde?: string | null }).gemeinde = '   ';
    const { container } = render(<AbschlussSlide isActive data={leer} year={2026} />);
    expect(container.querySelector('.kat-gemeinde')).toBeNull();
  });
});

describe('4a. Die Einladung steht nicht mehr doppelt', () => {
  it('die Abschluss-Seite laedt nicht mehr selbst ins Team ein', () => {
    // Sie stuende sonst zweimal hintereinander: Seit dem Tausch kommt die
    // eigene Team-Seite direkt VOR dem Abschluss.
    const { container } = render(<AbschlussSlide isActive data={KONFI} year={2026} />);
    expect(text(container)).not.toContain('Werde Teamer:in und gestalte das nächste Jahr mit');
    expect(container.querySelector('.w-einladung')).toBeNull();
  });
});

describe('4b. Die Team-Seite laedt zum Schreiben ein, ohne Pfeil', () => {
  it('der neue Text steht auf der Seite', () => {
    // Simons gewaehlte Fassung, woertlich -- mit Gedankenstrich (Halbgeviert),
    // nicht mit Doppelpunkt und nicht mit Bindestrich. Er hatte sie aus drei
    // Vorschlaegen ausgesucht; der Wortlaut ist damit gesetzt.
    const { container } = render(<WerdeTeamerSlide isActive />);
    const t = text(container);
    expect(t).toContain(
      'Schreib einfach jemandem aus dem Team. Und gestalte mit — die Kirche und den Glauben von morgen.'
    );
  });

  it('der alte Werbetext ist weg', () => {
    const { container } = render(<WerdeTeamerSlide isActive />);
    expect(text(container)).not.toContain('Als Teamer:in gestaltest du das nächste Konfi-Jahr mit');
    expect(text(container)).not.toContain('Sprich einfach jemanden aus dem Team an');
  });

  it('der Pfeil ist weg', () => {
    // Simon: "Sprich jemanden an kommt der Pfeil weg."
    const { container } = render(<WerdeTeamerSlide isActive />);
    expect(container.querySelector('.teamer-pfeil')).toBeNull();
  });

  it('der Slogan der Seite bleibt', () => {
    const { container } = render(<WerdeTeamerSlide isActive />);
    expect(text(container)).toContain('Und jetzt?');
    expect(text(container)).toContain('Bleibdabei.');
  });
});
