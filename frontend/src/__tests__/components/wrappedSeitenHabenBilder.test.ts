import { describe, it, expect } from 'vitest';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { alleMotive } from '../../components/wrapped/hintergrundbilder';

/**
 * Jede Bilddatei, auf die der Rueckblick verweist, liegt wirklich da.
 *
 * Ein toter Pfad faellt sonst niemandem auf: Der Browser zeigt nichts und
 * meldet nichts. Welche Seite welches Motiv traegt, ist Gestaltung und bleibt
 * frei aenderbar (Simon, 15.10.2026); dass kein Verweis ins Leere geht, nicht.
 */

const oeffentlich = (pfad: string) => resolve(process.cwd(), 'public' + pfad);

describe('Hintergrundbilder der Rueckblick-Seiten', () => {
  it('jede ausgelieferte Bilddatei existiert', () => {
    for (const pfad of alleMotive()) {
      expect(existsSync(oeffentlich(pfad)), `${pfad} fehlt`).toBe(true);
    }
  });
});
