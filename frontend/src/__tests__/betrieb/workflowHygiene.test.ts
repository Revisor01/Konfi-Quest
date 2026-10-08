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
      'android-release.yml', 'ci-meldung.yml', 'ci.yml', 'ios-release.yml', 'notfall-deploy.yml',
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

  describe('kein Test-Backend mehr: jede App spricht mit der Produktion (Simon, 08.10.2026)', () => {
    // Bis zum 08.10.2026 gab es einen eigenen Dienst an DERSELBEN Datenbank
    // mit eigenem Hostnamen, ein eigenes Image (test-backend.yml) und im
    // iOS-Release die Eingabe api_url, ueber die ein Testbuild dorthin zeigen
    // konnte. Fuenf TestFlight-Builds (153-158, 31.08.-02.09.2026) waren so
    // gebaut; sie wurden vor dem Abbau abgelaufen gelassen. Seither gibt es
    // keinen anderen Weg als die Produktion -- auch nicht "fuer Testflights".
    const release = workflows.filter((w) => /^(ios|android)-release\.yml$/.test(w.datei));

    it('beide Release-Workflows werden geprueft', () => {
      expect(release.map((w) => w.datei).sort()).toEqual(['android-release.yml', 'ios-release.yml']);
    });

    it('kein Release-Workflow nimmt eine API-Adresse entgegen oder setzt VITE_API_URL', () => {
      for (const w of release) {
        expect(w.text, w.datei).not.toMatch(/^\s+api_url:/m);
        expect(w.text, w.datei).not.toMatch(/inputs\.api_url/);
        expect(w.text, w.datei).not.toMatch(/VITE_API_URL\s*:/);
      }
    });

    it('der Build ohne VITE_API_URL landet bei der Produktion', () => {
      const basis = readFileSync(join(wurzel, 'frontend/src/services/apiBasis.ts'), 'utf-8');
      expect(basis).toMatch(/import\.meta\.env\.VITE_API_URL \|\| 'https:\/\/konfi-quest\.de\/api'/);
    });

    it('kein Workflow baut oder nennt das Test-Backend', () => {
      for (const w of workflows) {
        expect(w.text, w.datei).not.toMatch(/test-latest|test-api\./);
      }
    });
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
