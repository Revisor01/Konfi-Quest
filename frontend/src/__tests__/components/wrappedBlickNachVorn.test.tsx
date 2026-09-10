// Der Blick nach vorn im Konfi-Rueckblick (11.09.2026).
//
// Simons Vorgabe, woertlich:
//
//   "Wenn es ein bis jetzt Rueckblick ist, kein Verweis auf 'was jetzt, werde
//    Teamer'. Sondern was Motivierendes fuer die noch ausstehende Zeit.
//    Vielleicht je nach Punkten die noch fehlen."
//
// WELCHE der beiden Seiten erscheint, entscheidet das Backend (geprueft in
// backend/tests/utils/wrappedKacheln.test.js). Hier steht, WAS auf der neuen
// Seite steht -- die drei Stufen nach den fehlenden Punkten.
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';

vi.mock('@ionic/react', () => ({
  IonIcon: (props: { icon?: unknown }) => <span data-icon={String(props.icon)} />,
}));

import WeiterSoSlide from '../../components/wrapped/slides/WeiterSoSlide';
import type { KonfiEndspurtSlide } from '../../types/wrapped';

// Die Slogan-Zeilen stehen in eigenen <span>-Bloecken; textContent klebt sie
// ohne Trennzeichen aneinander ("Du hastdein Ziel."). Deshalb wird hier an
// den Blockgrenzen ein Leerzeichen eingesetzt, damit die Erwartungen den
// Satz so pruefen koennen, wie er auf dem Bildschirm steht.
const text = (c: HTMLElement) =>
  Array.from(c.querySelectorAll('span, div'))
    .map((e) => (e.childElementCount === 0 ? e.textContent || '' : ''))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

const endspurt = (ziel: number, aktuell: number): KonfiEndspurtSlide => ({
  aktiv: aktuell < ziel,
  fehlende_punkte: Math.max(0, ziel - aktuell),
  ziel_total: ziel,
  aktuell_total: aktuell,
});

describe('Der Blick nach vorn: Ziel erreicht', () => {
  it('spricht Anerkennung aus, statt weiter anzutreiben', () => {
    const { container } = render(<WeiterSoSlide isActive endspurt={endspurt(20, 20)} />);
    const t = text(container);
    expect(t).toContain('Du hast dein Ziel.');
    expect(t).toContain('weil du willst');
  });

  it('nennt keine fehlenden Punkte', () => {
    const { container } = render(<WeiterSoSlide isActive endspurt={endspurt(20, 25)} />);
    expect(text(container)).not.toMatch(/\d+ Punkte? fehl|Noch \d+ Punkt/);
  });
});

describe('Der Blick nach vorn: kurz davor', () => {
  it('nennt die konkrete Zahl', () => {
    const { container } = render(<WeiterSoSlide isActive endspurt={endspurt(20, 18)} />);
    const t = text(container);
    expect(t).toContain('Noch 2 Punkte');
    expect(t).toContain('Katzensprung');
  });

  it('setzt den Singular bei genau einem Punkt', () => {
    const { container } = render(<WeiterSoSlide isActive endspurt={endspurt(20, 19)} />);
    const t = text(container);
    expect(t).toContain('Noch 1 Punkt.');
    expect(t).not.toContain('Noch 1 Punkte');
  });

  it('gilt bis einschliesslich fuenf fehlender Punkte', () => {
    const { container } = render(<WeiterSoSlide isActive endspurt={endspurt(20, 15)} />);
    expect(text(container)).toContain('Noch 5 Punkte');
  });
});

describe('Der Blick nach vorn: noch ein Stueck', () => {
  it('ermutigt OHNE Zahl -- eine grosse Zahl entmutigt', () => {
    const { container } = render(<WeiterSoSlide isActive endspurt={endspurt(20, 3)} />);
    const t = text(container);
    expect(t).toContain('Deine Zeit geht weiter.');
    expect(t).toContain('Es ist noch Zeit.');
    // 17 fehlende Punkte stehen bewusst NICHT auf der Seite.
    expect(t).not.toContain('17');
  });

  it('kommt auch ohne Zielvorgabe zurecht', () => {
    // Jahrgang ohne Ziele oder beide Punktarten abgeschaltet: Dann gibt es
    // nichts zu rechnen -- die Seite darf trotzdem nicht leer sein.
    for (const e of [null, undefined, endspurt(0, 0)]) {
      const { container } = render(<WeiterSoSlide isActive endspurt={e} />);
      const t = text(container);
      expect(t).toContain('Deine Zeit geht weiter.');
      expect(t.length).toBeGreaterThan(40);
    }
  });
});

describe('Der Blick nach vorn: was NICHT draufsteht', () => {
  it('lädt in keiner Stufe ins Team ein', () => {
    // Der Kern von Simons Vorgabe: Waehrend der Konfizeit kein "werde
    // Teamer:in".
    for (const e of [endspurt(20, 20), endspurt(20, 18), endspurt(20, 3), null]) {
      const { container } = render(<WeiterSoSlide isActive endspurt={e} />);
      const t = text(container);
      expect(t).not.toMatch(/Teamer/i);
      expect(t).not.toContain('Bleib dabei.');
    }
  });

  it('macht keinen Druck mit Ausrufezeichen im Zuspruch', () => {
    for (const e of [endspurt(20, 20), endspurt(20, 3)]) {
      const { container } = render(<WeiterSoSlide isActive endspurt={e} />);
      expect(text(container)).not.toContain('!');
    }
  });
});
