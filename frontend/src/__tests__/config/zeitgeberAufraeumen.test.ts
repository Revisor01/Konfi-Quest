import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative, resolve } from 'path';
import ts from 'typescript';

// LEITPLANKE: Zeitgeber und Horcher enden mit der Seite (08.10.2026).
//
// Ein setTimeout, das nach dem Schliessen einer Seite noch Zustand setzt,
// trifft in der CI das schon abgebaute Testfenster: alle Tests gruen, der
// Lauf rot ("window is not defined", zweimal am 06.10.2026). In der App heisst
// es: eine Meldung, ein Abruf, ein Dialog an einer Seite, die es nicht mehr
// gibt. Gezaehlt am 08.10.2026 mit diesem Pruefer: 49 Zeitgeber ohne
// festgehaltene ID in 26 Dateien, dazu 3 nie abgemeldete Horcher. 41 davon
// laufen jetzt ueber useZeitgeber oder ein Aufraeumen im Effekt; die 8
// uebrigen stehen unten mit Grund.
//
// Geprueft wird der Quellbaum, den React traegt (components/, hooks/,
// contexts/, navigation/, utils/, App.tsx), am Syntaxbaum, nicht am Text:
//
//   1. Jeder Aufruf von setTimeout, setInterval und requestAnimationFrame
//      haelt seine ID fest (Zuweisung oder return) -- ein Zeitgeber ohne
//      ID laesst sich nie loeschen. Fuer Klick-Handler und async-Ketten ist
//      hooks/useZeitgeber.ts da (zeitgeber.nach, zeitgeber.imNaechstenBild).
//   2. Wer eine ID festhaelt, loescht sie auch: Die Datei ruft fuer jede
//      Art das passende clearTimeout / clearInterval / cancelAnimationFrame.
//   3. Jedes addEventListener hat ein removeEventListener (Anzahl je Datei).
//
// services/ und main.tsx liegen ausserhalb: Sie leben so lange wie die App
// und haengen an keiner Seite.

const SRC = resolve(__dirname, '../..');
const BEREICHE = ['components', 'hooks', 'contexts', 'navigation', 'utils', 'App.tsx'];

/** Bewusste Ausnahmen von Regel 1: Datei -> Anzahl, mit Grund. Nur schrumpfen lassen. */
const OHNE_ID: Record<string, { anzahl: number; grund: string }> = {
  'contexts/AppContext.tsx': {
    anzahl: 5,
    grund: 'Push-Anmeldung der ganzen App (Wiederholungen beim Token-Versand, Nachfassen bei APNs); '
      + 'der Provider lebt so lange wie die App und setzt keinen Zustand einer Seite.',
  },
  'components/shared/EinladungenKarte.tsx': {
    anzahl: 1,
    grund: 'Neuladen der App nach dem Annehmen einer Einladung -- soll auch laufen, wenn die Seite vorher verlassen wurde.',
  },
  'navigation/rollenBaeume.ts': {
    anzahl: 1,
    grund: 'Wartezeit vor dem zweiten Ladeversuch eines Seitenbuendels; Modulebene, keine Seite.',
  },
  'utils/segmentGlas.ts': {
    anzahl: 1,
    grund: 'Ein Bildaufbau bis zur Glas-Linse; der Rueckruf prueft selbst, ob das Element noch im Dokument haengt.',
  },
};

/** Bewusste Ausnahmen von Regel 3: Datei -> Anzahl Horcher ohne Gegenstueck. */
const HORCHER_OHNE_ENDE: Record<string, { anzahl: number; grund: string }> = {};

const ZEITGEBER = { setTimeout: 'clearTimeout', setInterval: 'clearInterval', requestAnimationFrame: 'cancelAnimationFrame' } as const;
type Art = keyof typeof ZEITGEBER;

export interface Befund {
  ohneId: number;
  /** Arten, deren ID festgehalten, aber nie geloescht wird. */
  nieGeloescht: Art[];
  horcherAn: number;
  horcherAb: number;
}

/** Name der aufgerufenen Funktion: setTimeout(...), window.setTimeout(...), globalThis.setTimeout(...). */
const aufrufName = (aufruf: ts.CallExpression): string | null => {
  const ziel = aufruf.expression;
  if (ts.isIdentifier(ziel)) return ziel.text;
  if (ts.isPropertyAccessExpression(ziel)) return ziel.name.text;
  return null;
};

/** Haelt der Aufruf seine ID fest? Zuweisung, Variable, return, oder als Wert weitergereicht in eine Klammer. */
const idFestgehalten = (aufruf: ts.CallExpression): boolean => {
  let p: ts.Node = aufruf.parent;
  while (ts.isParenthesizedExpression(p) || ts.isAsExpression(p) || ts.isNonNullExpression(p)) p = p.parent;
  if (ts.isVariableDeclaration(p) && p.initializer) return true;
  if (ts.isBinaryExpression(p) && p.operatorToken.kind === ts.SyntaxKind.EqualsToken && p.right) return true;
  if (ts.isReturnStatement(p)) return true;
  return false;
};

export function pruefe(datei: string, quelle: string): Befund {
  const baum = ts.createSourceFile(datei, quelle, ts.ScriptTarget.Latest, true, datei.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const befund: Befund = { ohneId: 0, nieGeloescht: [], horcherAn: 0, horcherAb: 0 };
  const festgehalten = new Set<Art>();
  const geloescht = new Set<string>();
  const besuche = (knoten: ts.Node) => {
    if (ts.isCallExpression(knoten)) {
      const name = aufrufName(knoten);
      if (name && Object.hasOwn(ZEITGEBER, name)) {
        if (idFestgehalten(knoten)) festgehalten.add(name as Art);
        else befund.ohneId += 1;
      }
      if (name && (Object.values(ZEITGEBER) as string[]).includes(name)) geloescht.add(name);
      if (name === 'addEventListener') befund.horcherAn += 1;
      if (name === 'removeEventListener') befund.horcherAb += 1;
    }
    ts.forEachChild(knoten, besuche);
  };
  besuche(baum);
  befund.nieGeloescht = [...festgehalten].filter((art) => !geloescht.has(ZEITGEBER[art]));
  return befund;
}

const quelldateien = (): string[] => {
  const alle: string[] = [];
  const gehe = (pfad: string) => {
    if (statSync(pfad).isDirectory()) {
      for (const n of readdirSync(pfad)) gehe(join(pfad, n));
      return;
    }
    const rel = relative(SRC, pfad).split('\\').join('/');
    if (!/\.(ts|tsx)$/.test(rel) || rel.endsWith('.d.ts') || /\.test\.tsx?$/.test(rel) || rel.includes('__tests__/')) return;
    alle.push(rel);
  };
  for (const b of BEREICHE) gehe(join(SRC, b));
  return alle.sort();
};

const dateien = quelldateien();
const befunde = new Map(dateien.map((d) => [d, pruefe(d, readFileSync(join(SRC, d), 'utf8'))]));

describe('Leitplanke Zeitgeber: der Pruefer selbst (Gegenprobe)', () => {
  it('erkennt einen Zeitgeber ohne ID, auch als window.setTimeout und im Promise', () => {
    const b = pruefe('a.tsx', `
      const f = () => { setTimeout(() => setX(1), 300); };
      const g = () => window.setTimeout(() => {}, 0);
      const h = () => new Promise((r) => setTimeout(r, 10));
      requestAnimationFrame(() => requestAnimationFrame(go));
    `);
    expect(b.ohneId).toBe(5);
  });

  it('laesst festgehaltene und geloeschte Zeitgeber in Ruhe', () => {
    const b = pruefe('b.ts', `
      useEffect(() => { const t = setTimeout(go, 1); return () => clearTimeout(t); }, []);
      ref.current = setInterval(go, 5); clearInterval(ref.current);
      let raf = 0; raf = requestAnimationFrame(tick); cancelAnimationFrame(raf);
      function warte() { return setTimeout(go, 1); }
      zeitgeber.nach(300, () => setX(1));
    `);
    expect(b).toEqual({ ohneId: 0, nieGeloescht: [], horcherAn: 0, horcherAb: 0 });
  });

  it('erkennt eine festgehaltene ID, die nie geloescht wird', () => {
    const b = pruefe('c.ts', 'const t = setTimeout(go, 1); const i = setInterval(go, 2); clearTimeout(t);');
    expect(b.nieGeloescht).toEqual(['setInterval']);
  });

  it('zaehlt Horcher und ihr Gegenstueck, Kommentare und Text zaehlen nicht', () => {
    const b = pruefe('d.ts', `
      // window.addEventListener('x', f)
      const s = 'removeEventListener';
      window.addEventListener('a', f); document.addEventListener('b', g);
      window.removeEventListener('a', f);
    `);
    expect(b.horcherAn).toBe(2);
    expect(b.horcherAb).toBe(1);
  });

  it('liest den Quellbaum (nicht leer gelaufen)', () => {
    expect(dateien.length).toBeGreaterThan(300);
    expect(dateien).toContain('components/konfi/modals/QRScannerModal.tsx');
    expect(dateien).toContain('hooks/useZeitgeber.ts');
    expect(dateien).not.toContain('services/networkMonitor.ts');
    const mitZeitgebern = [...befunde.values()].filter((b) => b.ohneId > 0 || b.horcherAn > 0).length;
    expect(mitZeitgebern).toBeGreaterThan(20);
  });
});

describe('Leitplanke Zeitgeber: der Quellbaum', () => {
  it('1. jeder Zeitgeber haelt seine ID fest (sonst useZeitgeber)', () => {
    const verstoesse = [...befunde]
      .filter(([d, b]) => b.ohneId > (OHNE_ID[d]?.anzahl ?? 0))
      .map(([d, b]) => `${d}: ${b.ohneId} ohne ID`);
    expect(verstoesse).toEqual([]);
  });

  it('die Ausnahmeliste ist aktuell (ein behobener Eintrag wird gestrichen)', () => {
    const veraltet = Object.entries(OHNE_ID)
      .filter(([d, a]) => (befunde.get(d)?.ohneId ?? 0) !== a.anzahl)
      .map(([d, a]) => `${d}: erwartet ${a.anzahl}, gefunden ${befunde.get(d)?.ohneId ?? 'Datei fehlt'}`);
    expect(veraltet).toEqual([]);
    for (const a of Object.values(OHNE_ID)) expect(a.grund.length).toBeGreaterThan(20);
  });

  it('2. wer eine ID festhaelt, loescht sie auch', () => {
    const verstoesse = [...befunde]
      .filter(([, b]) => b.nieGeloescht.length > 0)
      .map(([d, b]) => `${d}: ${b.nieGeloescht.join(', ')} nie geloescht`);
    expect(verstoesse).toEqual([]);
  });

  it('3. jeder Horcher wird wieder abgemeldet', () => {
    const verstoesse = [...befunde]
      .filter(([d, b]) => b.horcherAn - b.horcherAb > (HORCHER_OHNE_ENDE[d]?.anzahl ?? 0))
      .map(([d, b]) => `${d}: ${b.horcherAn} an, ${b.horcherAb} ab`);
    expect(verstoesse).toEqual([]);
  });
});
