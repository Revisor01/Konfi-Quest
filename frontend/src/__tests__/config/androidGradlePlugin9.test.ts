import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// Android-Gradle-Plugin 9 (08.10.2026, Auftrag 18, Release 2.4.0).
//
// Anlass: Die Play Console bemaengelte zu 2.3.0 zwei R8-Punkte, die es erst
// mit AGP 9 gibt -- "Optimierte Entfernung von Ressourcen" und "Klassen neu
// buendeln". Beides kommt NICHT aus einer Zeile im Repo, sondern aus den
// Voreinstellungen von AGP 9 (android.r8.optimizedResourceShrinking, seit 9.1
// das Neu-Buendeln). Ein Schalter in gradle.properties, der sie zurueckdreht,
// nimmt den Gewinn still wieder weg -- der Bau bleibt gruen.
//
// Gemessen am unsignierten Release-Bau, AGP 8.13.1 gegen 9.2.1, sonst gleich:
//   DEX 4.133.636 -> 4.029.648 Bytes, resources.pb 1.389.262 -> 1.024.302,
//   umbenannte Klassen noch in Paketen 2.305 -> 92 (Neu-Buendeln greift).
//   In den Namensraeumen, die Capacitor per Reflection sucht (Bruecke,
//   Plugins, App, Firebase, ShortcutBadger, Cordova), entfernt R8 unter AGP 9
//   nichts zusaetzlich; Firebase- und Crashlytics-Kennungen stehen in beiden
//   Bundles.
//
// Strenger Vollmodus (android.r8.strictFullModeForKeepRules, unter AGP 9 an):
// "-keep class A" haelt den Standardkonstruktor NICHT mehr mit. Capacitor legt
// Plugins per Reflection an -- ohne Konstruktor tut ein Plugin dann nichts,
// und zwar erst auf dem Geraet. Deshalb traegt jede -keep-Regel einen Rumpf.

const android = join(process.cwd(), 'android');
const lies = (pfad: string) => readFileSync(join(android, pfad), 'utf8');

/** Ohne Kommentarzeilen (//, #). */
const ohneKommentare = (text: string, zeichen: '//' | '#') =>
  text
    .split('\n')
    .filter((z) => !z.trim().startsWith(zeichen))
    .join('\n');

describe('Android: Gradle-Plugin 9', () => {
  it('baut mit AGP 9 und einem Gradle 9 im Wrapper (AGP 9 verlangt mindestens Gradle 9.1)', () => {
    const agp = ohneKommentare(lies('build.gradle'), '//').match(/com\.android\.tools\.build:gradle:(\d+)\.(\d+)\.(\d+)/);
    expect(agp).not.toBeNull();
    expect(Number(agp![1])).toBe(9);

    const wrapper = lies('gradle/wrapper/gradle-wrapper.properties').match(/gradle-(\d+)\.(\d+)(?:\.\d+)?-(?:bin|all)\.zip/);
    expect(wrapper).not.toBeNull();
    const [haupt, neben] = [Number(wrapper![1]), Number(wrapper![2])];
    expect(haupt).toBe(9);
    expect(neben).toBeGreaterThanOrEqual(1);
  });

  it('gradle.properties dreht keine AGP-9-Voreinstellung zurueck', () => {
    const props = ohneKommentare(lies('gradle.properties'), '#');
    for (const schalter of [
      'android.newDsl',
      'android.builtInKotlin',
      'android.r8.optimizedResourceShrinking',
      'android.r8.strictFullModeForKeepRules',
      'android.r8.proguardAndroidTxt.disallowed',
    ]) {
      const maskiert = schalter.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      expect(props, schalter).not.toMatch(new RegExp(`^\\s*${maskiert}\\s*=`, 'm'));
    }
  });

  it('weder die App noch ein Plugin verweist auf proguard-android.txt (unter AGP 9 bricht der Bau daran)', () => {
    const paket = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8'));
    const plugins = Object.keys(paket.dependencies).filter((n) => existsSync(join(process.cwd(), 'node_modules', n, 'android', 'build.gradle')));
    // Ohne node_modules gaebe es nichts zu pruefen -- dann soll der Test fallen, nicht still gruen sein.
    expect(plugins.length).toBeGreaterThanOrEqual(15);

    const dateien = [
      join(android, 'app/build.gradle'),
      join(process.cwd(), 'node_modules/@capacitor/android/capacitor/build.gradle'),
      ...plugins.map((n) => join(process.cwd(), 'node_modules', n, 'android', 'build.gradle')),
    ];
    for (const datei of dateien) {
      expect(readFileSync(datei, 'utf8'), datei).not.toMatch(/['"]proguard-android\.txt['"]/);
    }
  });

  it('jede -keep-Regel der App traegt einen Rumpf -- sonst verliert die Klasse im strengen Vollmodus ihren Konstruktor', () => {
    const regeln = ohneKommentare(lies('app/proguard-rules.pro'), '#')
      .split('\n')
      .map((z) => z.trim())
      .filter((z) => /^-keep\s/.test(z));
    expect(regeln.length).toBeGreaterThanOrEqual(10);
    for (const regel of regeln) expect(regel, regel).toContain('{');
  });
});
