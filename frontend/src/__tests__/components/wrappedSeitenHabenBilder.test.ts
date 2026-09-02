import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { hintergrundFuer, zweitbildFuer, alleMotive } from '../../components/wrapped/hintergrundbilder';

/**
 * Jede Rueckblick-Seite hat ein Hintergrundbild -- und die Datei existiert.
 *
 * SIMONS VORGABE (03.09.2026): "Und wehe du nutzt nicht das neue Design und
 * Bilder im BG!" / "Und Bilder im Hintergrund! Hatten wir schon geladen."
 *
 * WARUM DIESER TEST NOETIG IST: Fehlt ein Eintrag in KACHEL_MOTIV, gibt
 * hintergrundFuer() einfach null zurueck. Die Seite rendert dann ohne Bild --
 * ohne Fehler, ohne roten Test, ohne dass es jemandem auffaellt ausser dem,
 * der die App ansieht. Genau diese stille Luecke faengt dieser Test.
 *
 * Er prueft ZWEI Dinge, die einzeln nicht reichen:
 *   1. Es gibt einen Eintrag (sonst kein Bild).
 *   2. Die Datei liegt wirklich da (sonst ein toter Pfad -- der Browser
 *      zeigt nichts und meldet nichts).
 */

// Die Seiten, die das Backend erzeugen kann (utils/wrappedKacheln.js
// zusammen mit den 14 Standardkategorien aus wrappedKategorien.js).
const KATEGORIE_SEITEN = [
  'fest', 'senioren', 'jugend', 'oeffentlichkeit', 'freizeit', 'weihnachten',
  'konzert', 'kinder', 'kreativ', 'seelsorge', 'kasualien', 'gottesdienst',
  'gemeinde'
].map(k => `kategorie:${k}`);

const DATUMS_SEITEN = [
  'weihnachten', 'advent', 'jahreswechsel', 'ostern', 'erntedank', 'sommer'
].map(k => `datum:${k}`);

const ALLE_SEITEN = [...KATEGORIE_SEITEN, ...DATUMS_SEITEN, 'kategorie-allgemein'];

const oeffentlich = (pfad: string) => resolve(process.cwd(), 'public' + pfad);

describe('Hintergrundbilder der Rueckblick-Seiten', () => {
  it.each(ALLE_SEITEN)('%s hat ein Hauptmotiv, und die Datei existiert', (seite) => {
    const pfad = hintergrundFuer(seite);
    expect(pfad, `${seite} hat keinen Eintrag in KACHEL_MOTIV`).toBeTruthy();
    expect(existsSync(oeffentlich(pfad as string)), `${pfad} fehlt auf der Platte`).toBe(true);
  });

  it.each(ALLE_SEITEN)('%s hat ein Zweitmotiv, und die Datei existiert', (seite) => {
    const pfad = zweitbildFuer(seite);
    expect(pfad, `${seite} hat keinen Eintrag in KACHEL_ZWEITMOTIV`).toBeTruthy();
    expect(existsSync(oeffentlich(pfad as string)), `${pfad} fehlt auf der Platte`).toBe(true);
  });

  it('Haupt- und Zweitmotiv sind verschieden', () => {
    // Zweimal dasselbe Bild wirkt wie ein Fehler, nicht wie Absicht.
    for (const seite of ALLE_SEITEN) {
      expect(hintergrundFuer(seite), `${seite} zeigt zweimal dasselbe Motiv`)
        .not.toBe(zweitbildFuer(seite));
    }
  });

  it('jede ausgelieferte Bilddatei existiert', () => {
    for (const pfad of alleMotive()) {
      expect(existsSync(oeffentlich(pfad)), `${pfad} fehlt`).toBe(true);
    }
  });

  it('jede Kategorie-Seite hat einen eigenen Farbverlauf', () => {
    // Ohne eigene Klasse liefen alle Seiten im Standard-Verlauf -- der
    // Rueckblick saehe monoton aus, obwohl die Bilder wechseln.
    const css = readFileSync(
      resolve(process.cwd(), 'src/components/wrapped/WrappedModal.css'), 'utf8'
    );
    const ohneFarbe: string[] = [];
    for (const seite of [...KATEGORIE_SEITEN, ...DATUMS_SEITEN]) {
      const klasse = seite.startsWith('datum:')
        ? `d-${seite.slice('datum:'.length)}`
        : `k-${seite.slice('kategorie:'.length)}`;
      if (!css.includes(`.kategorie-seite-slide.${klasse}`)) ohneFarbe.push(seite);
    }
    expect(ohneFarbe).toEqual([]);
  });
});
