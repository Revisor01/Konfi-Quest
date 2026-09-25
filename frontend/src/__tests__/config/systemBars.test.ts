import { join } from 'node:path';
import { readFileSync } from 'node:fs';
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
 * (getStyleForTheme: Nachtmodus -> DARK -> weisse Symbole). Solange die App
 * immer hell war, war das weiss auf hell -- unsichtbar; damals stand hier
 * deshalb fest LIGHT.
 *
 * Seit demselben Tag folgt die App dem Systemmodus (theme/variables.css,
 * @media prefers-color-scheme: dark). Damit ist DEFAULT richtig: Telefon
 * dunkel -> App dunkel -> weisse Symbole auf dunkler App. Die dritte
 * Pruefung koppelt beides weiterhin, nur andersherum: Wer den Dunkelmodus
 * wieder abschaltet, faellt hier und muss die Leisten auf LIGHT festnageln,
 * statt dass Malte sie wieder nicht sieht.
 */
describe('Systemleisten auf Android (SystemBars)', () => {
  it('die Symbole der Leisten folgen dem Telefon-Thema (style DEFAULT), wie die App selbst', () => {
    expect(config.plugins?.SystemBars?.style).toBe('DEFAULT');
  });

  it('die Insets bleiben als CSS-Variablen (Voreinstellung css, nicht abgeschaltet)', () => {
    expect(config.plugins?.SystemBars?.insetsHandling).not.toBe('disable');
    expect(config.plugins?.SystemBars?.hidden).not.toBe(true);
  });

  it('die App hat einen Dunkelmodus nach Systemeinstellung -- nur deshalb darf die Farbe dem Telefon folgen', () => {
    const css = readFileSync(join(process.cwd(), 'src/theme/variables.css'), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '');
    const aktiveDunkelBloecke = css.match(/@media \(prefers-color-scheme: dark\)/g) ?? [];
    expect(aktiveDunkelBloecke).toHaveLength(1);
    // Und Ionics Palette dazu -- die Variante muss "system" sein, sonst
    // schaltet die App nicht mit dem Telefon.
    const app = readFileSync(join(process.cwd(), 'src/App.tsx'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(app).toMatch(/^import '@ionic\/react\/css\/palettes\/dark\.system\.css';/m);
    expect(app).not.toMatch(/palettes\/dark\.(always|class)\.css/);
  });
});
