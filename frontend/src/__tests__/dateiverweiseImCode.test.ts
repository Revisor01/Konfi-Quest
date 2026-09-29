import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

/**
 * Dateiverweise in Kommentaren zeigen auf Dateien, die es gibt
 * (Audit 26.09.2026, Doku BF-15; Pruefung seit 29.09.2026).
 *
 * Kommentare verweisen gern auf die Stelle, an der etwas erklaert oder
 * gerechnet wird. Wird die Datei verschoben, aufgeteilt oder umbenannt,
 * bleibt der Verweis stehen und schickt Lesende ins Leere -- so standen
 * `scripts/apply-version.sh` (liegt unter frontend/scripts/),
 * `routes/events.js` (am 28.08.2026 aufgeteilt) und `openapi.js` (heisst
 * build-openapi.mjs) in Kommentaren, als es sie laengst nicht mehr gab.
 *
 * Geprueft werden Pfade, die an der Repo-Wurzel beginnen
 * (docs/, backend/, frontend/, scripts/, e2e/, deploy/, init-scripts/).
 * Sie sind eindeutig und billig zu pruefen. Ein Pfad gilt auch, wenn er
 * innerhalb von frontend/ bzw. backend/ existiert (Kommentare in
 * frontend/scripts nennen "scripts/..." relativ zu frontend/).
 *
 * Erlaubt bleibt ein toter Pfad, wenn die Zeile ihn ausdruecklich als
 * Geschichte kennzeichnet ("damals", "frueher"/"früher", "ehemals") --
 * die Historie zu erzaehlen ist oft genau der Zweck des Kommentars.
 * Dazu wenige Dateien, die absichtlich NICHT im Repo liegen (Geheimnisse).
 */

const WURZEL = resolve(process.cwd(), '..');
const ORDNER = ['backend', 'frontend/src', 'frontend/scripts', 'scripts', 'e2e', 'deploy'];
const ENDUNG = /\.(js|mjs|cjs|ts|tsx|css|sh|yml|yaml)$/;
const AUSSEN_VOR = new Set(['node_modules', 'dist', 'build', 'coverage', 'uploads', 'android', 'ios']);

/** Dateien, die es absichtlich nur auf dem Server gibt -- mit Grund. */
const BEWUSST_NICHT_IM_REPO: Record<string, string> = {
  'backend/push/firebase-service-account.json': 'Geheimnis des Push-Dienstes, in .gitignore',
};

const HISTORISCH = /\b(damals|frueher\w*|früher\w*|ehemal\w*)\b/i;
const PFAD = /(?<![\w./-])((?:docs|backend|frontend|scripts|e2e|deploy|init-scripts)\/[\w.\-/]*[\w-]\.(?:md|js|mjs|cjs|ts|tsx|sql|yaml|yml|json|css|sh|html|txt))(?![\w.])/g;

function dateienUnter(ordner: string): string[] {
  const voll = join(WURZEL, ordner);
  if (!existsSync(voll)) return [];
  const raus: string[] = [];
  for (const eintrag of readdirSync(voll)) {
    if (AUSSEN_VOR.has(eintrag) || eintrag.startsWith('.')) continue;
    const pfad = join(ordner, eintrag);
    if (statSync(join(WURZEL, pfad)).isDirectory()) raus.push(...dateienUnter(pfad));
    else if (ENDUNG.test(eintrag)) raus.push(pfad);
  }
  return raus;
}

function gibtEs(pfad: string, datei: string): boolean {
  if (existsSync(join(WURZEL, pfad))) return true;
  const paket = datei.split('/')[0];
  if ((paket === 'frontend' || paket === 'backend') && existsSync(join(WURZEL, paket, pfad))) return true;
  // Im Frontend meint "docs/..." oft die Web-Wurzel (frontend/public bzw.
  // dist), etwa in den Tests des App-Buendels (29.09.2026).
  return paket === 'frontend' && existsSync(join(WURZEL, 'frontend', 'public', pfad));
}

describe('Dateiverweise im Code', () => {
  const dateien = ORDNER.flatMap(dateienUnter);

  it('findet ueberhaupt Dateien und Verweise (sonst prueft der Test nichts)', () => {
    let verweise = 0;
    for (const datei of dateien) {
      verweise += (readFileSync(join(WURZEL, datei), 'utf8').match(PFAD) ?? []).length;
    }
    // Gezaehlt am 29.09.2026: 1.141 Dateien, 325 Verweise. Faellt die Zahl
    // drastisch, stimmt der Suchweg nicht mehr.
    expect(dateien.length).toBeGreaterThan(900);
    expect(verweise).toBeGreaterThan(250);
  });

  it('jeder Pfad ab der Repo-Wurzel zeigt auf eine vorhandene Datei', () => {
    const tot: string[] = [];
    for (const datei of dateien) {
      readFileSync(join(WURZEL, datei), 'utf8').split('\n').forEach((zeile, i) => {
        for (const m of zeile.matchAll(PFAD)) {
          const pfad = m[1];
          if (gibtEs(pfad, datei)) continue;
          if (pfad in BEWUSST_NICHT_IM_REPO) continue;
          if (HISTORISCH.test(zeile)) continue;
          tot.push(`${datei}:${i + 1} ${pfad}`);
        }
      });
    }
    expect(tot).toEqual([]);
  });

  it('die Ausnahmen stehen in .gitignore (sonst gehoeren sie gestrichen)', () => {
    // Nicht "existiert nicht" pruefen: Auf dem Rechner des Betriebs liegt die
    // Datei womoeglich, nur eben nicht im Repo.
    const ignoriert = readFileSync(join(WURZEL, '.gitignore'), 'utf8').split('\n').map((z) => z.trim());
    for (const pfad of Object.keys(BEWUSST_NICHT_IM_REPO)) {
      expect(ignoriert, pfad).toContain(pfad);
    }
  });
});
