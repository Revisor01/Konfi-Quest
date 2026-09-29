import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative, resolve, sep } from 'path';
import { builtinModules } from 'module';

// Jedes Paket, das die App lädt, steht in frontend/package.json (Release-Audit
// 26.09.2026, Toolchain BF-10).
//
// Anlass: `@ionic/core` (toastController, modalController) wurde in vier
// Dateien geladen, stand aber nirgends — es kam nur über `@ionic/react` mit.
// Dasselbe in Tests mit `lightningcss` (über vite) und `plist` (über
// @capacitor/cli). Umgekehrt stand `@types/qrcode`, ein reines Typpaket, in
// den Laufzeit-Abhängigkeiten.
//
// Zwei Regeln:
//   1. App-Code (src/ ohne Tests) lädt nur Pakete aus `dependencies`.
//   2. Tests, Build-Konfiguration und Skripte laden nur deklarierte Pakete.
//
// Dazu eine dritte, die das Deklarieren von @ionic/core erst sicher macht:
// Es darf nur EINE @ionic/core im Baum liegen. Zwei Kopien registrierten die
// Ionic-Elemente doppelt, und die Controller der einen sähen die Overlays der
// anderen nicht.

const frontend = resolve(__dirname, '../../..');
const pkg = JSON.parse(readFileSync(join(frontend, 'package.json'), 'utf-8'));
const PROD = new Set(Object.keys(pkg.dependencies ?? {}));
const DEV = new Set(Object.keys(pkg.devDependencies ?? {}));
const EINGEBAUT = new Set(builtinModules.flatMap((m) => [m, `node:${m}`]));

// Begründete Ausnahmen: Paket -> Datei, in der es ohne Deklaration geladen wird.
const AUSNAHMEN: Record<string, string[]> = {
  // Messskript für den Dunkelmodus, nur von Hand gestartet. Lädt Playwright
  // aus der Repo-Wurzel (dort deklariert) oder global und meldet sich
  // verständlich, wenn es fehlt — eine zweite Playwright-Installation im
  // Frontend wäre nur Gewicht für jeden CI-Lauf.
  // Dasselbe gilt fuer die Bildvergleiche im Dunkelmodus (29.09.2026).
  playwright: ['scripts/dunkelmodus-messen.mjs', 'scripts/dunkelmodus-bilder.mjs'],
};

function dateien(pfad: string): string[] {
  if (statSync(pfad).isFile()) return [pfad];
  const ergebnis: string[] = [];
  for (const name of readdirSync(pfad)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const voll = join(pfad, name);
    if (statSync(voll).isDirectory()) ergebnis.push(...dateien(voll));
    else if (/\.(c|m)?(j|t)sx?$/.test(name)) ergebnis.push(voll);
  }
  return ergebnis;
}

function paketName(spezifizierer: string): string | null {
  if (spezifizierer.startsWith('.') || spezifizierer.startsWith('/')) return null;
  if (EINGEBAUT.has(spezifizierer) || EINGEBAUT.has(spezifizierer.split('/')[0])) return null;
  const teile = spezifizierer.split('/');
  const name = spezifizierer.startsWith('@') ? teile.slice(0, 2).join('/') : teile[0];
  // Quelltext-Tests enthalten reguläre Ausdrücke wie /from '[.]…'/ — das sind
  // keine Paketnamen.
  return /^(@[a-z0-9][\w.-]*\/)?[a-z0-9][\w.-]*$/i.test(name) ? name : null;
}

// import ... from 'x', import 'x', import('x'), require('x') — ohne
// Kommentarzeilen. vi.mock('x') zählt nicht: ein Mock lädt das Paket nicht.
function geladenePakete(datei: string): Set<string> {
  const pakete = new Set<string>();
  const muster = /(?:\bfrom\s+|^\s*import\s+|\bimport\(\s*|\brequire\(\s*)['"]([^'"]+)['"]/g;
  for (const zeile of readFileSync(datei, 'utf-8').split('\n')) {
    const t = zeile.trim();
    if (t.startsWith('//') || t.startsWith('*') || t.startsWith('/*')) continue;
    for (const treffer of zeile.matchAll(muster)) {
      const name = paketName(treffer[1]);
      if (name) pakete.add(name);
    }
  }
  return pakete;
}

function verstoesse(liste: string[], erlaubt: (name: string) => boolean): string[] {
  const ergebnis: string[] = [];
  for (const datei of liste) {
    const rel = relative(frontend, datei).split(sep).join('/');
    for (const name of geladenePakete(datei)) {
      if (erlaubt(name) || AUSNAHMEN[name]?.includes(rel)) continue;
      ergebnis.push(`${rel}: ${name}`);
    }
  }
  return ergebnis.sort();
}

const istTest = (d: string) =>
  d.includes(`${sep}__tests__${sep}`) || /\.test\.(j|t)sx?$/.test(d) || d.endsWith(`${sep}setupTests.ts`);

const src = dateien(join(frontend, 'src'));
const appCode = src.filter((d) => !istTest(d));
const entwicklung = [
  ...src.filter(istTest),
  ...dateien(join(frontend, 'scripts')),
  ...['vite.config.ts', 'capacitor.config.ts', 'eslint.config.js'].map((f) => join(frontend, f)),
];

describe('Frontend: geladene Pakete stehen in package.json', () => {
  it('findet überhaupt App-Code und Tests (sonst prüft der Test nichts)', () => {
    expect(appCode.length).toBeGreaterThan(200);
    expect(entwicklung.length).toBeGreaterThan(200);
    expect(appCode.some((d) => d.endsWith(join('contexts', 'ModalContext.tsx')))).toBe(true);
  });

  it('App-Code lädt nur Pakete aus dependencies', () => {
    expect(verstoesse(appCode, (name) => PROD.has(name))).toEqual([]);
  });

  it('Tests, Build-Konfiguration und Skripte laden nur deklarierte Pakete', () => {
    expect(verstoesse(entwicklung, (name) => PROD.has(name) || DEV.has(name))).toEqual([]);
  });

  it('@types-Pakete stehen nicht in den Laufzeit-Abhängigkeiten', () => {
    expect([...PROD].filter((name) => name.startsWith('@types/'))).toEqual([]);
  });

  it('im Lockfile liegt genau eine @ionic/core, dieselbe, die @ionic/react verlangt', () => {
    const lock = JSON.parse(readFileSync(join(frontend, 'package-lock.json'), 'utf-8'));
    const kopien = Object.keys(lock.packages).filter((k) => k.endsWith('node_modules/@ionic/core'));
    expect(kopien).toEqual(['node_modules/@ionic/core']);
    const verlangt = lock.packages['node_modules/@ionic/react'].dependencies['@ionic/core'];
    expect(lock.packages['node_modules/@ionic/core'].version).toBe(verlangt);
  });
});
