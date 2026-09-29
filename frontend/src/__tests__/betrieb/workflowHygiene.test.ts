import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

// Hygiene der Workflows (29.09.2026, Audit CI BF-15).

const wurzel = resolve(__dirname, '../../../..');
const verz = join(wurzel, '.github/workflows');
const workflows = readdirSync(verz)
  .filter((d) => d.endsWith('.yml'))
  .map((datei) => ({ datei, text: readFileSync(join(verz, datei), 'utf-8') }));

/** Die Jobs eines Workflows: Name und Text bis zum naechsten Job. */
function jobs(text: string): Array<{ name: string; rumpf: string }> {
  const ab = text.indexOf('\njobs:\n');
  const teil = text.slice(ab + '\njobs:\n'.length);
  const koepfe = [...teil.matchAll(/^ {2}([A-Za-z0-9_-]+):\s*$/gm)];
  return koepfe.map((k, i) => ({
    name: k[1],
    rumpf: teil.slice(k.index!, i + 1 < koepfe.length ? koepfe[i + 1].index : undefined),
  }));
}

describe('Workflows: Hygiene', () => {
  it('die Workflows werden gefunden', () => {
    expect(workflows.map((w) => w.datei).sort()).toEqual([
      'android-release.yml', 'ci.yml', 'ios-release.yml', 'notfall-deploy.yml', 'test-backend.yml',
    ]);
  });

  it('nur der gepruefte CI-Deploy und der Notfall-Deploy fassen Produktion an', () => {
    // frontend.yml ist geloescht (29.09.2026): Es baute aus JEDEM Branch
    // ohne Tests, ueberschrieb dabei das :latest-Image des Frontends und
    // rollte es aus. Der letzte Lauf war am 03.08.2026; schnelles Ausrollen
    // eines fertigen Stands deckt der Notfall-Deploy ab.
    const mitPortainer = workflows.filter((w) => w.text.includes('secrets.PORTAINER_API_KEY')).map((w) => w.datei).sort();
    expect(mitPortainer).toEqual(['ci.yml', 'notfall-deploy.yml']);
  });

  it('jeder Job hat eine Zeitgrenze (sonst gilt GitHubs Vorgabe von sechs Stunden)', () => {
    const ohne: string[] = [];
    for (const w of workflows) {
      const js = jobs(w.text);
      expect(js.length, w.datei).toBeGreaterThan(0);
      for (const j of js) if (!/^ {4}timeout-minutes: \d+/m.test(j.rumpf)) ohne.push(`${w.datei}:${j.name}`);
    }
    expect(ohne).toEqual([]);
  });

  it('test-backend.yml baut nur einen ausdruecklich genannten Branch', () => {
    // Die Vorgabe stand auf 'feat/ionic-9', seit dem 01.09.2026 gemergt.
    const tb = workflows.find((w) => w.datei === 'test-backend.yml')!.text;
    const eingabe = tb.slice(tb.indexOf('      branch:'), tb.indexOf('\npermissions:'));
    expect(eingabe).toMatch(/required: true/);
    expect(eingabe).not.toMatch(/default:/);
  });

  it('jede Action ist auf einen Commit festgenagelt, mit Fassung als Kommentar', () => {
    // Ein Tag wie @v7 laesst sich auf der Gegenseite verschieben; der Commit
    // nicht (29.09.2026, Audit CI BF-15). Dependabot (github-actions)
    // aktualisiert Commit und Kommentar gemeinsam. Neue Schritte mit uses:
    // brauchen dieselbe Form: owner/repo@<40 Zeichen> # vX.Y.Z
    const ungepinnt: string[] = [];
    let anzahl = 0;
    for (const w of workflows) {
      for (const m of w.text.matchAll(/^\s*(?:- )?uses:\s*(.+)$/gm)) {
        anzahl++;
        if (!/^[\w.-]+\/[\w.-]+@[0-9a-f]{40} # v\d+\.\d+\.\d+$/.test(m[1].trim())) ungepinnt.push(`${w.datei}: ${m[1].trim()}`);
      }
    }
    expect(anzahl).toBeGreaterThanOrEqual(20);
    expect(ungepinnt).toEqual([]);
  });
});
