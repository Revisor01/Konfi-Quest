// LEITPLANKE: keine neue Datei in utils/, hooks/ oder services/ ohne Test
// (Audit Tests 26.09.2026, BF-10).
//
// Am 30.09.2026 kamen 3 Utils, 2 Hooks und 1 Service in keinem Test vor; am
// 09.10.2026 waren es 6 von 83 Utils, 4 von 19 Hooks und 2 von 29 Services
// (konfiListe, pdfDokument, punkteDatum, sectionOrder, slidingItems,
// superAdmin, useBetriebsstatus, useCountUp, useJetztMitGrenzen,
// useScrollTiefeMessung, netzZuerst, warteschlangenDatei). Jede hat seitdem
// einen eigenen Verhaltenstest (je mit Gegenprobe): 12 -> 0.
//
// Gezaehlt wie im Audit: Der Dateiname steht in keiner Testdatei als Pfad --
// also hinter ' " oder / und vor ' " / oder einer Endung, wie in einem Import
// ('../../utils/punkteDatum') oder einem vi.mock. Ein Wort im Kommentar zaehlt
// nicht. Wer eine neue Datei anlegt, schreibt den Test dazu. Laesst sich eine
// Datei wirklich nicht pruefen, gehoert sie mit Begruendung in AUSNAHMEN --
// die Liste darf nur schrumpfen.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative, resolve, basename } from 'path';

const SRC = resolve(__dirname, '..');
const DIESE_DATEI = relative(SRC, __filename).split('\\').join('/');
const ORDNER = ['utils', 'hooks', 'services'];

/** Stand 09.10.2026: leer. Eintrag nur mit Begruendung im Kommentar daneben. */
const AUSNAHMEN: string[] = [];

function dateien(ordner: string): string[] {
  return readdirSync(ordner).flatMap((name) => {
    const pfad = join(ordner, name);
    if (statSync(pfad).isDirectory()) return name === 'node_modules' ? [] : dateien(pfad);
    return [pfad];
  });
}

const alle = dateien(SRC).map((p) => relative(SRC, p).split('\\').join('/'));
const quellen = alle.filter((p) => ORDNER.some((o) => p.startsWith(`${o}/`)) && !p.includes('__tests__/') && /\.tsx?$/.test(p) && !/\.d\.ts$|\.test\.tsx?$/.test(p));
const testInhalte = alle
  .filter((p) => /\.test\.tsx?$/.test(p) && p !== DIESE_DATEI)
  .map((p) => readFileSync(join(SRC, p), 'utf8'));

const kommtImTestVor = (datei: string, tests: string[]): boolean => {
  const name = basename(datei).replace(/\.tsx?$/, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const muster = new RegExp(`['"/]${name}(?:['"/.]|$)`, 'm');
  return tests.some((t) => muster.test(t));
};

describe('Leitplanke: utils, hooks und services haben einen Test', () => {
  it('findet die Dateien ueberhaupt (Plausibilitaet der Zaehlung)', () => {
    for (const o of ORDNER) expect(quellen.filter((p) => p.startsWith(`${o}/`)).length, o).toBeGreaterThan(10);
    expect(testInhalte.length).toBeGreaterThan(300);
  });

  it('keine Datei ohne Test -- Test schreiben, nicht die Ausnahme erweitern', () => {
    const ohne = quellen.filter((p) => !AUSNAHMEN.includes(p) && !kommtImTestVor(p, testInhalte));
    expect(ohne, 'Neue Datei ohne Test (siehe Kopf dieser Datei)').toEqual([]);
  });

  it('jede Ausnahme gibt es noch und hat noch keinen Test -- sonst streichen', () => {
    const tot = AUSNAHMEN.filter((p) => !quellen.includes(p) || kommtImTestVor(p, testInhalte));
    expect(tot).toEqual([]);
  });

  it('Gegenprobe: das Muster erkennt Import und Mock, aber kein Wort im Text', () => {
    expect(kommtImTestVor('utils/punkteDatum.ts', ["import { x } from '../../utils/punkteDatum';"])).toBe(true);
    expect(kommtImTestVor('services/netzZuerst.ts', ["vi.mock('../../services/netzZuerst', () => ({}));"])).toBe(true);
    expect(kommtImTestVor('hooks/useCountUp.ts', ['// die Zahl zaehlt hoch (useCountUp)'])).toBe(false);
    expect(kommtImTestVor('utils/superAdmin.ts', ["import '../../utils/superAdminAlt';"])).toBe(false);
  });
});
