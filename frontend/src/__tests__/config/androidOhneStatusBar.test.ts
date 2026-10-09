// Android: randlose Anzeige und keine eingestellten Farb-APIs (09.10.2026).
//
// Play Console zu Release 2.3.0: "randlose Anzeige ab Android 15" und
// "eingestellte APIs Window.get/setStatusBarColor, setNavigationBarColor".
// Aufgerufen wurden sie aus @capacitor/status-bar: Sein Konstruktor ruft bei
// jedem Start getStatusBarColor() und setStatusBarColor() -- ohne
// Versionspruefung, auch in 8.0.4. Die App ruft das Plugin nirgends auf; auf
// iOS bleibt es (Tippen auf die Statusleiste scrollt nach oben), auf Android
// wird es nicht mehr eingebunden. Randlos macht die App MainActivity mit
// EdgeToEdge.enable, die Insets traegt das eingebaute SystemBars-Plugin.
//
// Pruefbar ohne Geraet ist nur die Verdrahtung: Konfiguration, die von
// `cap sync` erzeugten Gradle-Dateien und die Activity. Wie es aussieht,
// prueft der Geraetetest (Malte, Android).
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import config from '../../../capacitor.config';

const lies = (pfad: string) => readFileSync(join(process.cwd(), pfad), 'utf8');
const ohneKommentare = (code: string) =>
  code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const STATUS_BAR = '@capacitor/status-bar';
// Gradle-Name eines Plugins, wie `cap sync` ihn bildet:
// '@capgo/capacitor-native-biometric' -> 'capgo-capacitor-native-biometric'.
const gradleName = (paket: string) => paket.replace(/^@/, '').replace('/', '-');

const javaDateien = (ordner: string): string[] =>
  readdirSync(ordner).flatMap((name) => {
    const pfad = join(ordner, name);
    if (statSync(pfad).isDirectory()) return javaDateien(pfad);
    return /\.(java|kt)$/.test(name) ? [pfad] : [];
  });

describe('Android ohne @capacitor/status-bar', () => {
  const allgemein = config.includePlugins ?? [];
  const android = config.android?.includePlugins ?? [];

  it('iOS behaelt das Plugin, Android bindet es nicht ein', () => {
    expect(allgemein).toContain(STATUS_BAR);
    expect(android).not.toContain(STATUS_BAR);
  });

  it('die Android-Liste ist die allgemeine ohne status-bar -- sie ERSETZT sie, ein neues Plugin muss in beide', () => {
    expect([...android].sort()).toEqual(allgemein.filter((p) => p !== STATUS_BAR).sort());
  });

  it('die von cap sync erzeugten Gradle-Dateien stimmen mit der Android-Liste ueberein', () => {
    const settings = lies('android/capacitor.settings.gradle');
    const build = lies('android/app/capacitor.build.gradle');
    const eingebunden = [...settings.matchAll(/^include ':([^']+)'/gm)]
      .map((m) => m[1])
      .filter((n) => n !== 'capacitor-android');
    expect(eingebunden.sort()).toEqual(android.map(gradleName).sort());
    const abhaengig = [...build.matchAll(/implementation project\(':([^']+)'\)/g)].map((m) => m[1]);
    expect(abhaengig.sort()).toEqual(android.map(gradleName).sort());
    expect(settings).not.toContain('capacitor-status-bar');
  });

  it('kein Code der App laedt das Plugin -- auf Android gaebe es "not implemented"', () => {
    const quellen = (ordner: string): string[] =>
      readdirSync(ordner).flatMap((name) => {
        const pfad = join(ordner, name);
        if (statSync(pfad).isDirectory()) return name === '__tests__' ? [] : quellen(pfad);
        return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [pfad] : [];
      });
    const mitImport = quellen(join(process.cwd(), 'src'))
      .filter((pfad) => ohneKommentare(readFileSync(pfad, 'utf8')).includes(STATUS_BAR));
    expect(mitImport).toEqual([]);
  });

  it('eigener nativer Code ruft die eingestellten Farb-APIs nicht', () => {
    const dateien = javaDateien(join(process.cwd(), 'android/app/src/main/java'));
    expect(dateien.length).toBeGreaterThan(0);
    const treffer = dateien.filter((pfad) =>
      /\b(set|get)(StatusBar|NavigationBar)Color\s*\(|\.(statusBarColor|navigationBarColor)\s*=/
        .test(ohneKommentare(readFileSync(pfad, 'utf8'))));
    expect(treffer).toEqual([]);
  });
});

describe('Android randlos (EdgeToEdge)', () => {
  const activity = ohneKommentare(lies('android/app/src/main/java/de/godsapp/konfiquest/MainActivity.java'));

  it('MainActivity schaltet randlos NACH super.onCreate -- vorher gaebe es die DecorView nur mit dem Start-Thema', () => {
    const aufbau = activity.indexOf('super.onCreate(savedInstanceState);');
    const randlos = activity.indexOf('EdgeToEdge.enable(this);');
    expect(aufbau).toBeGreaterThan(-1);
    expect(randlos).toBeGreaterThan(aufbau);
    expect(randlos).toBeLessThan(activity.indexOf('public void onResume()'));
    expect(activity).toContain('import androidx.activity.EdgeToEdge;');
  });

  it('androidx.activity ist ausdruecklich eingetragen, mit der Fassung aus variables.gradle', () => {
    const build = ohneKommentare(lies('android/app/build.gradle'));
    expect(build).toContain('implementation "androidx.activity:activity:$androidxActivityVersion"');
    expect(lies('android/variables.gradle')).toMatch(/androidxActivityVersion = '1\.(9|10|11)\.\d+'/);
  });

  it('die Insets kommen weiter als CSS-Variablen (SystemBars nicht abgeschaltet)', () => {
    expect(config.plugins?.SystemBars?.insetsHandling ?? 'css').toBe('css');
    expect(lies('index.html')).toMatch(/viewport-fit=cover/);
  });
});
