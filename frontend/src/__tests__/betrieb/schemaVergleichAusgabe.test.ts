import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

// backend/scripts/schemaVergleich.js: Die Ausgabe muss vollstaendig ankommen,
// auch wenn sie in eine Pipe geht (01.10.2026, Auftrag 11, Abschnitt 3).
//
// Der Messweg im Auftrag ist `docker exec <backend> node /app/scripts/schemaVergleich.js
// erfassen > prod-schema.json`. In Produktion kam dabei eine Datei von genau
// 65.536 Byte an -- abgeschnitten mitten in einer Index-Zeile, kein gueltiges
// JSON. Ursache: Das Skript beendete sich mit process.exit(), waehrend Node den
// Rest der Ausgabe noch in die volle Pipe schreiben wollte; process.exit wirft
// ihn weg. Ein langsamer Leser (docker exec, ssh) fuellt die 64-KiB-Pipe.
//
// Geprueft ohne Datenbank ueber `vergleichen` zweier grosser Fingerabdruecke:
// dieselbe Ausgabe-Logik, mehrere hundert Kilobyte, und ein Leser, der erst
// nach einer Sekunde liest.

vi.setConfig({ testTimeout: 30_000 });

const wurzel = resolve(__dirname, '../../../..');
const SKRIPT = join(wurzel, 'backend/scripts/schemaVergleich.js');
const ZEILEN = 3000;

let ordner = '';

beforeAll(() => {
  ordner = mkdtempSync(join(tmpdir(), 'schemavergleich-ausgabe-'));
  const a = { tabellen: [] as string[], spalten: [] as string[] };
  const b = { tabellen: [] as string[], spalten: [] as string[] };
  for (let i = 0; i < ZEILEN; i++) {
    a.spalten.push(`tabelle_${i}.spalte_mit_langem_namen integer NOT NULL DEFAULT 0`);
    b.spalten.push(`tabelle_${i}.andere_spalte text`);
  }
  writeFileSync(join(ordner, 'a.json'), JSON.stringify(a));
  writeFileSync(join(ordner, 'b.json'), JSON.stringify(b));
});

afterAll(() => {
  rmSync(ordner, { recursive: true, force: true });
});

/**
 * Startet das Skript ohne Shell und liest seine Ausgabe erst nach einer
 * Sekunde -- bis dahin laeuft die Pipe voll wie hinter docker exec oder ssh.
 */
function langsamGelesen(args: string[]): Promise<{ stdout: string; status: number | null }> {
  return new Promise((fertig, fehler) => {
    const kind = spawn(process.execPath, [SKRIPT, ...args], { stdio: ['ignore', 'pipe', 'inherit'] });
    const teile: Buffer[] = [];
    kind.stdout.on('data', (teil: Buffer) => teile.push(teil));
    kind.stdout.pause();
    setTimeout(() => kind.stdout.resume(), 1000);
    let status: number | null = null;
    kind.on('error', fehler);
    kind.on('exit', (code) => { status = code; });
    kind.on('close', () => fertig({ stdout: Buffer.concat(teile).toString('utf-8'), status }));
  });
}

describe('schemaVergleich.js schreibt in eine Pipe vollstaendig', () => {
  it('vergleichen: alle Abweichungszeilen kommen beim langsamen Leser an, Exit 1 bleibt', async () => {
    const lauf = await langsamGelesen(['vergleichen', join(ordner, 'a.json'), join(ordner, 'b.json')]);

    const nurA = (lauf.stdout.match(/^- A: /gm) || []).length;
    const nurB = (lauf.stdout.match(/^\+ B: /gm) || []).length;
    expect(nurA).toBe(ZEILEN);
    expect(nurB).toBe(ZEILEN);
    expect(lauf.stdout).toContain(`+ B: tabelle_${ZEILEN - 1}.andere_spalte text\n`);
    expect(lauf.status).toBe(1);
  });

  it('vergleichen: gleicher Stand -> Exit 0 und die Zeile "Gleich"', async () => {
    const lauf = await langsamGelesen(['vergleichen', join(ordner, 'a.json'), join(ordner, 'a.json')]);
    expect(lauf.stdout).toBe(`Gleich: 0 tabellen, ${ZEILEN} spalten\n`);
    expect(lauf.status).toBe(0);
  });
});
