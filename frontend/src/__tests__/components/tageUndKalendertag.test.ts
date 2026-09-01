import { describe, it, expect } from 'vitest';
import { kalendertag, tageBis, formatTimeUntil } from '../../components/shared/eventFormatting';

// Zwei Fehler mit derselben Wurzel: gerechnet wurde in Millisekunden, nicht
// in Kalendertagen.
//
// 1. Die Cache-Schluessel der Tageslosung bildeten "heute" als
//    `toISOString().split('T')[0]` -- immer der UTC-Tag. Zwischen Mitternacht
//    und 02:00 Berliner Sommerzeit ist das noch der Vortag, die Losung
//    wechselte also erst um zwei. Im Backend war dieselbe Falle an neun
//    Stellen behoben; die Anzeige zog nicht nach.
//
// 2. `formatTimeUntil` rundete Millisekunden mit Math.ceil auf 24-Stunden-
//    Bloecke. Ein Termin in einer Stunde ergab 1 und wurde als "Morgen"
//    angezeigt. Der Zweig fuer "Heute" traf nur, wenn der Termin exakt jetzt
//    begann -- praktisch toter Code.

describe('kalendertag', () => {
  it('nimmt den Tag der Geraetezone, nicht den UTC-Tag', () => {
    // 01.09.2026, 00:30 Berliner Sommerzeit = 31.08. 22:30 UTC.
    // toISOString() haette hier den 31.08. geliefert -- den Vortag.
    const kurzNachMitternacht = new Date(2026, 8, 1, 0, 30);
    expect(kalendertag(kurzNachMitternacht)).toBe('2026-09-01');
  });

  it('fuellt Monat und Tag auf zwei Stellen auf', () => {
    expect(kalendertag(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('wechselt zur Mitternacht, nicht zwei Stunden spaeter', () => {
    const kurzVor = new Date(2026, 8, 1, 23, 59);
    const kurzNach = new Date(2026, 8, 2, 0, 1);
    expect(kalendertag(kurzVor)).toBe('2026-09-01');
    expect(kalendertag(kurzNach)).toBe('2026-09-02');
  });
});

describe('tageBis', () => {
  it('zaehlt einen Termin heute Abend als heute', () => {
    // Der urspruengliche Fehler: 20:00 minus 19:00 ergab aufgerundet 1 Tag.
    const jetzt = new Date(2026, 8, 1, 19, 0);
    const heuteAbend = new Date(2026, 8, 1, 20, 0);
    expect(tageBis(heuteAbend, jetzt)).toBe(0);
  });

  it('zaehlt morgen frueh als einen Tag, auch wenn es nur Stunden sind', () => {
    const jetzt = new Date(2026, 8, 1, 23, 0);
    const morgenFrueh = new Date(2026, 8, 2, 1, 0);
    expect(tageBis(morgenFrueh, jetzt)).toBe(1);
  });

  it('zaehlt gestern negativ', () => {
    const jetzt = new Date(2026, 8, 2, 8, 0);
    expect(tageBis(new Date(2026, 8, 1, 20, 0), jetzt)).toBe(-1);
  });

  it('verrechnet sich nicht an der Umstellung auf Winterzeit', () => {
    // Nacht vom 24. auf den 25.10.2026: Der Kalendertag hat 25 Stunden.
    // In 24-Stunden-Bloecken gerechnet ergab das einen Tag zu wenig.
    const vorher = new Date(2026, 9, 24, 12, 0);
    const nachher = new Date(2026, 9, 25, 12, 0);
    expect(tageBis(nachher, vorher)).toBe(1);
  });

  it('verrechnet sich nicht an der Umstellung auf Sommerzeit', () => {
    // Nacht vom 28. auf den 29.03.2026: 23 Stunden.
    const vorher = new Date(2026, 2, 28, 12, 0);
    const nachher = new Date(2026, 2, 29, 12, 0);
    expect(tageBis(nachher, vorher)).toBe(1);
  });

  it('zaehlt ueber einen Monatswechsel richtig', () => {
    expect(tageBis(new Date(2026, 9, 1), new Date(2026, 8, 29))).toBe(2);
  });
});

describe('formatTimeUntil', () => {
  it('sagt Heute statt Morgen fuer einen Termin in einer Stunde', () => {
    // Genau der gemeldete Fehler. Ohne feste Zeit gemessen: Der Termin liegt
    // eine Stunde in der Zukunft, aber am selben Kalendertag.
    const gleich = new Date();
    gleich.setHours(gleich.getHours() + 1);
    // Nur pruefbar, solange die Stunde nicht ueber Mitternacht rutscht.
    if (gleich.getDate() === new Date().getDate()) {
      expect(formatTimeUntil(gleich.toISOString())).toBe('Heute');
    }
  });

  it('sagt Vorbei fuer einen vergangenen Termin', () => {
    const gestern = new Date();
    gestern.setDate(gestern.getDate() - 1);
    expect(formatTimeUntil(gestern.toISOString())).toBe('Vorbei');
  });

  it('sagt Morgen fuer den naechsten Tag', () => {
    const morgen = new Date();
    morgen.setDate(morgen.getDate() + 1);
    expect(formatTimeUntil(morgen.toISOString())).toBe('Morgen');
  });

  it('zaehlt Tage bis zur Woche', () => {
    const inDreiTagen = new Date();
    inDreiTagen.setDate(inDreiTagen.getDate() + 3);
    expect(formatTimeUntil(inDreiTagen.toISOString())).toBe('3 Tage');
  });

  it('fasst ab einer Woche zusammen', () => {
    const inAchtTagen = new Date();
    inAchtTagen.setDate(inAchtTagen.getDate() + 8);
    expect(formatTimeUntil(inAchtTagen.toISOString())).toBe('1 Woche');
  });

  it('gibt bei leerer oder ungueltiger Eingabe nichts zurueck', () => {
    expect(formatTimeUntil(undefined)).toBe('');
    expect(formatTimeUntil('')).toBe('');
    expect(formatTimeUntil('kein Datum')).toBe('');
  });
});

describe('Keine zweite Fassung der Rechnung mehr', () => {
  it('rechnet nirgends mehr in 24-Stunden-Bloecken', async () => {
    const { readFileSync } = await import('fs');
    const { resolve } = await import('path');
    const dateien = [
      'src/components/konfi/views/DashboardSections.tsx',
      'src/components/teamer/pages/TeamerDashboardPage.tsx',
      'src/components/wrapped/slides/KonfirmationsSlide.tsx',
    ];
    for (const d of dateien) {
      const inhalt = readFileSync(resolve(process.cwd(), d), 'utf8');
      expect(inhalt).not.toContain('1000 * 60 * 60 * 24');
    }
  });

  it('bildet den Losungs-Schluessel nicht mehr als UTC-Tag', () => {
    const { readFileSync } = require('fs');
    const { resolve } = require('path');
    for (const d of [
      'src/components/konfi/views/DashboardView.tsx',
      'src/components/teamer/pages/TeamerDashboardPage.tsx',
    ]) {
      const inhalt = readFileSync(resolve(process.cwd(), d), 'utf8');
      expect(inhalt).not.toContain("toISOString().split('T')[0]");
      expect(inhalt).toContain('kalendertag()');
    }
  });
});
