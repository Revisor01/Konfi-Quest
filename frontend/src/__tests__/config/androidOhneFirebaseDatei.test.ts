import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Android-Bau ohne google-services.json (03.10.2026, offene Befunde
// "Android-Build bricht ohne Firebase-Datei ab").
//
// app/build.gradle wendet google-services und Crashlytics nur an, wenn
// app/google-services.json da ist. Der Block `firebaseCrashlytics { … }` stand
// aber AUSSERHALB dieser Bedingung, am Dateiende. Ohne Datei gibt es die
// Methode nicht, und Gradle brach schon beim Konfigurieren ab -- lokal
// nachgestellt mit `./gradlew help`: "Could not find method
// firebaseCrashlytics() … on BuildType … name=release" (build.gradle Zeile 129).
// Seitdem haengt der Block an pluginManager.withPlugin: Er laeuft genau dann,
// wenn das Crashlytics-Plugin angewendet ist.
//
// Mit Datei (CI, Release) unveraendert, mit einem Gradle-Init-Skript vor und
// nach der Aenderung gemessen: google-services und Crashlytics angewendet,
// release mappingFileUploadEnabled=true, debug ohne Wert.

const bau = readFileSync(join(process.cwd(), 'android/app/build.gradle'), 'utf8');

/** Ohne Kommentare: ganze //-Zeilen und // nach Leerraum (Adressen in Zeichenketten bleiben). */
const code = bau
  .split('\n')
  .filter((z) => !z.trim().startsWith('//'))
  .map((z) => z.replace(/\s+\/\/.*$/, ''))
  .join('\n');

/** Bereich [Anfang, Ende) des Blocks, dessen `{` als erstes ab `ab` kommt. */
function block(text: string, ab: number): [number, number] {
  const auf = text.indexOf('{', ab);
  let tiefe = 0;
  for (let i = auf; i < text.length; i++) {
    if (text[i] === '{') tiefe++;
    if (text[i] === '}' && --tiefe === 0) return [auf, i + 1];
  }
  throw new Error(`Block ab ${ab} schliesst nicht`);
}

const stellen = (muster: RegExp) => [...code.matchAll(muster)].map((m) => m.index!);
const innerhalb = (i: number, [a, e]: [number, number]) => i > a && i < e;

const WITH_PLUGIN = /pluginManager\.withPlugin\(\s*'com\.google\.firebase\.crashlytics'\s*\)/g;

describe('Android: Bau ohne google-services.json', () => {
  it('die Plugins werden nur mit der Datei angewendet, Crashlytics nach google-services', () => {
    const wenn = stellen(/if \(servicesJSON\.text\)/g);
    expect(wenn).toHaveLength(1);
    const zweig = block(code, wenn[0]);
    const gms = code.indexOf("apply plugin: 'com.google.gms.google-services'");
    const crash = code.indexOf("apply plugin: 'com.google.firebase.crashlytics'");
    expect(innerhalb(gms, zweig)).toBe(true);
    expect(innerhalb(crash, zweig)).toBe(true);
    expect(crash).toBeGreaterThan(gms);
  });

  it('jeder firebaseCrashlytics-Block haengt am Crashlytics-Plugin -- ohne Plugin gibt es die Methode nicht', () => {
    const bloecke = stellen(/\bfirebaseCrashlytics\s*\{/g);
    expect(bloecke.length).toBeGreaterThan(0);
    const gebunden = stellen(WITH_PLUGIN).map((i) => block(code, i));
    expect(gebunden).toHaveLength(1);
    for (const b of bloecke) expect(innerhalb(b, gebunden[0]), `firebaseCrashlytics an Stelle ${b}`).toBe(true);
  });

  it('der gebundene Block steht nicht im try -- ein Fehler darin bliebe sonst still (catch schreibt nur logger.info)', () => {
    const versuch = block(code, code.indexOf('try {'));
    const [gebunden] = stellen(WITH_PLUGIN);
    expect(versuch[1]).toBeGreaterThan(0);
    expect(innerhalb(gebunden, versuch)).toBe(false);
    expect(gebunden).toBeGreaterThan(versuch[1]);
  });

  it('der Mapping-Upload gilt weiter fuer release, und nur dort', () => {
    const gebunden = block(code, stellen(WITH_PLUGIN)[0]);
    const rumpf = code.slice(...gebunden);
    expect(rumpf).toMatch(/buildTypes\s*\{\s*release\s*\{\s*firebaseCrashlytics\s*\{\s*mappingFileUploadEnabled true\s*\}\s*\}\s*\}/);
    expect(rumpf).not.toMatch(/\bdebug\s*\{/);
  });

  it('prepare-android.sh findet weiter, was es vor dem Store-Bau verlangt', () => {
    const skript = readFileSync(join(process.cwd(), 'scripts/prepare-android.sh'), 'utf8');
    const verlangt = [...skript.matchAll(/grep -q "([^"]+)" "\$FRONTEND_DIR\/android\/app\/build\.gradle"/g)].map((m) => m[1]);
    expect(verlangt).toEqual(['com.google.gms.google-services', 'com.google.firebase.crashlytics', 'minifyEnabled true', 'mappingFileUploadEnabled true']);
    for (const v of verlangt) expect(code, v).toContain(v);
  });
});
