import { join } from 'node:path';
import { readFileSync, readdirSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import config from '../../../capacitor.config';

/**
 * Systemleisten auf Android: Status- und Navigationsleiste (Zurueck, Start,
 * Uebersicht) liegen seit Capacitor 8 durchsichtig ueber der App.
 *
 * Malte (Android, Telefon im Dunkelmodus, 25.09.2026): "unten das Android
 * Menue ist im Handy Darkmode unsichtbar. In einem Chat lustigerweise leicht
 * sichtbar."
 *
 * Gelesen in der Capacitor-8-Quelle (SystemBars.java): Mit style DEFAULT
 * richtet das eingebaute Plugin die Symbolfarbe nach dem THEMA DES TELEFONS
 * (getStyleForTheme: Nachtmodus -> DARK -> weisse Symbole). Die App ist aber
 * immer hell -- weiss auf hell ist unsichtbar. LIGHT heisst "helle Leiste",
 * also dunkle Symbole, unabhaengig vom Telefon.
 *
 * Die zweite Pruefung koppelt beides: Solange die App keinen Dunkelmodus
 * hat, ist LIGHT richtig. Wer einen einbaut, faellt hier -- und muss die
 * Leisten dann mit dem Thema mitfuehren (SystemBars.setStyle zur Laufzeit),
 * statt dass Malte sie wieder nicht sieht.
 */
describe('Systemleisten auf Android (SystemBars)', () => {
  it('die Symbole der Leisten sind fest dunkel (style LIGHT), nicht nach dem Telefon-Thema', () => {
    expect(config.plugins?.SystemBars?.style).toBe('LIGHT');
  });

  it('die Insets bleiben als CSS-Variablen (Voreinstellung css, nicht abgeschaltet)', () => {
    expect(config.plugins?.SystemBars?.insetsHandling).not.toBe('disable');
    expect(config.plugins?.SystemBars?.hidden).not.toBe(true);
  });

  it('die App hat keinen Dunkelmodus -- deshalb darf die Farbe fest sein', () => {
    const ordner = join(process.cwd(), 'src/theme');
    const aktiveDunkelRegeln = readdirSync(ordner)
      .filter((f) => f.endsWith('.css'))
      .flatMap((f) => {
        const ohneKommentare = readFileSync(join(ordner, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
        return ohneKommentare.match(/prefers-color-scheme:\s*dark/g)?.map(() => f) ?? [];
      });
    expect(aktiveDunkelRegeln).toEqual([]);
    expect(readFileSync(join(ordner, 'variables.css'), 'utf8')).toMatch(/Dark Mode Support - DISABLED/);
  });
});
