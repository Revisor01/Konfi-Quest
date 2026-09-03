import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Der eigene Hintergrund einer Seite darf das Foto nicht verdecken.
 *
 * SIMONS BEFUND, DREIMAL (03.09.2026): "bilder im bg sind immer noch nicht
 * zu sehen."
 *
 * DIE URSACHE, die ich zweimal verfehlt habe: Der Bild-Container
 * (.wrapped-bg) liegt auf z-index:-1, also HINTER dem Slide-Element. Jeder
 * Hintergrund auf dem Element selbst — Verlauf ODER Farbe — übermalt das
 * Foto vollständig.
 *
 * Meine ersten beiden Anläufe (Bild vergrößern, Schleier abstufen) haben an
 * Schichten gearbeitet, die gar nicht oben lagen. Beim dritten hatte ich
 * eine "Notfallfarbe" gesetzt und das Bild damit erneut zugedeckt.
 *
 * WARUM DOM-MESSUNGEN NICHT REICHTEN: getComputedStyle sagte die ganze Zeit
 * "Bild ist 1200x907, Deckkraft 1" — technisch wahr und trotzdem unsichtbar.
 * Erst ein Screenshot zeigte es. Dieser Test prüft deshalb die REGEL, die
 * das Übermalen verhindert.
 */

const css = readFileSync(
  resolve(process.cwd(), 'src/components/wrapped/WrappedModal.css'),
  'utf8'
);

describe('Hintergrundbild wird nicht vom Seiten-Hintergrund verdeckt', () => {
  it('es gibt eine Regel, die den Hintergrund bei vorhandenem Bild abschaltet', () => {
    expect(css).toMatch(/\.wrapped-slide:has\(\.wrapped-bg-form\)/);
  });

  it('die Regel setzt background auf none', () => {
    const stelle = css.slice(css.indexOf('.wrapped-slide:has(.wrapped-bg-form)'));
    const block = stelle.slice(0, stelle.indexOf('}') + 1);
    expect(block).toMatch(/background:\s*none/);
  });

  it('die Regel steht am ENDE der Datei', () => {
    // Sonst gewinnen die späteren Seiten-Regeln (.intro-slide,
    // .kategorie-seite-slide.k-*) bei gleicher Spezifität. Genau daran ist
    // der erste Versuch gescheitert: Die Intro-Seite zeigte ihr Foto, die
    // Kategorie-Seiten nicht.
    const pos = css.lastIndexOf('.wrapped-slide:has(.wrapped-bg-form)');
    const letzterSeitenVerlauf = Math.max(
      css.lastIndexOf('.intro-slide {'),
      css.lastIndexOf('.kategorie-seite-slide.k-'),
      css.lastIndexOf('.kategorie-seite-slide.d-')
    );
    expect(pos).toBeGreaterThan(letzterSeitenVerlauf);
  });

  it('die Regel setzt KEINE background-color', () => {
    // Eine Hintergrundfarbe übermalt das Foto genauso wie ein Verlauf --
    // der Container liegt dahinter.
    const stelle = css.slice(css.lastIndexOf('.wrapped-slide:has(.wrapped-bg-form)'));
    const block = stelle.slice(0, stelle.indexOf('}') + 1);
    expect(block).not.toMatch(/background-color:\s*#/);
  });

  it('der Verlauf steht als Variable bereit, nicht nur als background', () => {
    // SlideBase liest --seiten-verlauf. Stünde die Farbe nur im
    // background-image, käme nach dem Abschalten 'none' zurück und die
    // Seite hätte gar keine Farbe mehr.
    expect(css).toMatch(/--seiten-verlauf:\s*linear-gradient/);
    const anzahl = (css.match(/--seiten-verlauf:/g) || []).length;
    expect(anzahl).toBeGreaterThanOrEqual(15);
  });
});
