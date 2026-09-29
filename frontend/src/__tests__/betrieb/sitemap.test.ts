import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// Die Sitemap ist eine Funktion des Repo-Inhalts (29.09.2026, Audit CI BF-13,
// Doku BF-13).
//
// Bis dahin kam `lastmod` aus der Aenderungszeit der Quelldatei. In einem
// frischen Checkout ist das der Zeitpunkt des Auscheckens: Jeder Lauf auf
// einer anderen Maschine schrieb zehn andere Daten, die CI pruefte die Datei
// deshalb nicht, und alle setzten sie nach dem Generatorlauf zurueck. Jetzt
// gilt: Aendert sich eine erzeugte Seite, traegt sie den heutigen Tag, sonst
// bleibt ihr Datum. Geprueft an einer Kopie des Repos -- der Test fasst die
// eingecheckten Dateien nicht an.

const wurzel = resolve(__dirname, '../../../..');
let kopie = '';

const heute = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(new Date());

function generator(...args: string[]) {
  execFileSync(process.execPath, [join(kopie, 'scripts/build-handbuch.mjs'), ...args], { cwd: kopie, stdio: 'pipe' });
}

/** loc -> lastmod aus einer Sitemap. */
function daten(text: string): Map<string, string> {
  return new Map([...text.matchAll(/<loc>([^<]+)<\/loc>\s*<lastmod>([^<]+)<\/lastmod>/g)].map((m) => [m[1], m[2]]));
}

beforeAll(() => {
  kopie = mkdtempSync(join(tmpdir(), 'sitemap-'));
  for (const teil of ['scripts', 'docs/handbuch', 'docs/screenshots', 'frontend/public/docs', 'frontend/public/sitemap.xml']) {
    cpSync(join(wurzel, teil), join(kopie, teil), { recursive: true });
  }
  // Die Aenderungszeiten der Kopie sind "jetzt" -- genau der Fall, der
  // frueher jedes Datum auf heute setzte.
});

afterAll(() => {
  rmSync(kopie, { recursive: true, force: true });
});

describe('Sitemap aus dem Inhalt', () => {
  it('ein Lauf auf dem eingecheckten Stand aendert die Sitemap nicht', () => {
    const vorher = readFileSync(join(kopie, 'frontend/public/sitemap.xml'), 'utf-8');
    generator();
    expect(readFileSync(join(kopie, 'frontend/public/sitemap.xml'), 'utf-8')).toBe(vorher);
  });

  it('eine geaenderte Seite bekommt den heutigen Tag, die anderen behalten ihr Datum', () => {
    const vorher = daten(readFileSync(join(kopie, 'frontend/public/sitemap.xml'), 'utf-8'));
    const kapitel = readdirSync(join(kopie, 'docs/handbuch')).filter((d) => /^\d+-.+\.md$/.test(d)).sort();
    const quelle = join(kopie, 'docs/handbuch', kapitel[1]);
    writeFileSync(quelle, `${readFileSync(quelle, 'utf-8')}\nEin zusätzlicher Absatz für den Test.\n`);
    generator();
    const nachher = daten(readFileSync(join(kopie, 'frontend/public/sitemap.xml'), 'utf-8'));

    const neu = [...nachher].filter(([loc, datum]) => vorher.get(loc) !== datum).map(([loc]) => loc);
    // Die Seite selbst -- und alle, die sich mitaendern (Kapitelnavigation
    // vor/zurueck nennt nur Titel, die bleiben gleich).
    const geaenderteSeite = neu.find((loc) => loc.startsWith('https://konfi-quest.de/docs/') && loc !== 'https://konfi-quest.de/docs/');
    expect(geaenderteSeite).toBeTruthy();
    for (const loc of neu) expect(nachher.get(loc), loc).toBe(heute());
    // Die festen Seiten erzeugt der Generator nicht; ihr Datum bleibt.
    for (const fest of ['https://konfi-quest.de/', 'https://konfi-quest.de/impressum', 'https://konfi-quest.de/datenschutz']) {
      expect(nachher.get(fest)).toBe(vorher.get(fest));
    }
    // Nicht alles auf heute -- genau das war der Fehler.
    expect(neu.length).toBeLessThan(nachher.size);
  });

  it('ein zweiter Lauf ohne Aenderung laesst die Sitemap stehen', () => {
    const vorher = readFileSync(join(kopie, 'frontend/public/sitemap.xml'), 'utf-8');
    generator();
    expect(readFileSync(join(kopie, 'frontend/public/sitemap.xml'), 'utf-8')).toBe(vorher);
  });

  it('ein Lauf in ein anderes Verzeichnis schreibt keine Sitemap', () => {
    const vorher = readFileSync(join(kopie, 'frontend/public/sitemap.xml'), 'utf-8');
    const anderswo = join(kopie, 'anderswo');
    mkdirSync(anderswo);
    generator(anderswo);
    expect(readFileSync(join(kopie, 'frontend/public/sitemap.xml'), 'utf-8')).toBe(vorher);
  });
});

describe('Frische-Pruefung der CI', () => {
  it('der Handbuch-Schritt vergleicht auch die Sitemap', () => {
    const ci = readFileSync(join(wurzel, '.github/workflows/ci.yml'), 'utf-8');
    const schritt = ci.slice(ci.indexOf('- name: Handbuch aktuell?'), ci.indexOf('- name: Security audit', ci.indexOf('- name: Handbuch aktuell?')));
    expect(schritt).toMatch(/git diff --quiet -- frontend\/public\/docs\/ ':!frontend\/public\/docs\/api' frontend\/public\/sitemap\.xml/);
  });
});
