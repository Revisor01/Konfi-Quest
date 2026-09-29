import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

// Play-Upload: gestaffelt in die Produktion, Tracks gegen eine feste Liste
// (29.09.2026, Audit CI BF-16).
//
// Vorher ging jedes Production-Release mit "completed" sofort an alle
// Android-Nutzer:innen, und ein Tippfehler in den Tracks ("internal, alpha"
// mit Leerzeichen) fiel erst nach Bau und Upload als 404 auf. Geprueft wird
// hier der Planungsteil des Skripts (--pruefen, ohne Netz und ohne Schluessel)
// -- derselbe Code baut beim echten Upload die Releases.

const wurzel = resolve(__dirname, '../../../..');
const SKRIPT = join(wurzel, '.github/scripts/upload-play.py');

type Release = { status: string; userFraction?: number; versionCodes: string[] };

function plane(tracks: string, anteil?: string) {
  const args = [SKRIPT, '--pruefen', tracks, ...(anteil === undefined ? [] : [anteil])];
  const lauf = spawnSync('python3', args, { encoding: 'utf-8' });
  return {
    code: lauf.status,
    plan: lauf.status === 0 ? (JSON.parse(lauf.stdout) as Record<string, Release>) : null,
    fehler: lauf.stderr,
  };
}

describe('Play-Upload: Staffelung', () => {
  it('die Testkanaele sind sofort fuer alle Testenden da', () => {
    const { code, plan } = plane('internal,alpha');
    expect(code).toBe(0);
    expect(Object.keys(plan!)).toEqual(['internal', 'alpha']);
    expect(plan!.internal.status).toBe('completed');
    expect(plan!.alpha.status).toBe('completed');
    expect(plan!.internal.userFraction).toBeUndefined();
  });

  it('production geht gestaffelt raus, Vorgabe 10 %', () => {
    const { code, plan } = plane('internal,alpha,production');
    expect(code).toBe(0);
    expect(plan!.production.status).toBe('inProgress');
    expect(plan!.production.userFraction).toBe(0.1);
    expect(plan!.internal.status).toBe('completed');
  });

  it('ein anderer Anteil wird uebernommen, auch mit Komma geschrieben', () => {
    expect(plane('production', '0.25').plan!.production.userFraction).toBe(0.25);
    expect(plane('production', '0,5').plan!.production.userFraction).toBe(0.5);
  });

  it('Anteil 1 heisst sofort an alle', () => {
    const { plan } = plane('production', '1');
    expect(plan!.production.status).toBe('completed');
    expect(plan!.production.userFraction).toBeUndefined();
  });

  it.each(['0', '1.5', '-0.1', 'zehn'])('Anteil %s wird abgelehnt', (anteil) => {
    const { code, fehler } = plane('production', anteil);
    expect(code).toBe(1);
    expect(fehler).toContain('FEHLER');
  });
});

describe('Play-Upload: Track-Namen', () => {
  it('Leerzeichen und doppelte Angaben stoeren nicht', () => {
    const { code, plan } = plane(' internal , alpha,internal ');
    expect(code).toBe(0);
    expect(Object.keys(plan!)).toEqual(['internal', 'alpha']);
  });

  it('ein unbekannter Track bricht ab, bevor irgendetwas gebaut wird', () => {
    const { code, fehler } = plane('internal,alhpa');
    expect(code).toBe(1);
    expect(fehler).toContain("Unbekannter Track 'alhpa'");
  });

  it('ohne Track kein Lauf', () => {
    expect(plane(' , ').code).toBe(1);
  });
});

describe('Android-Release-Workflow', () => {
  const wf = readFileSync(join(wurzel, '.github/workflows/android-release.yml'), 'utf-8');

  it('Vorgaben: nur die Testkanaele, Anteil 10 %', () => {
    expect(wf).toMatch(/tracks:\n(?: {8}.*\n)*? {8}default: "internal,alpha"/);
    expect(wf).toMatch(/production_anteil:\n(?: {8}.*\n)*? {8}default: "0\.1"/);
  });

  it('prueft Tracks und Anteil vor dem Warten auf die CI', () => {
    const pruefung = wf.indexOf('upload-play.py --pruefen "$TRACKS" "$ANTEIL"');
    const tor = wf.indexOf('run: python3 .github/scripts/release-gate.py');
    expect(pruefung).toBeGreaterThan(0);
    expect(pruefung).toBeLessThan(tor);
  });

  it('der Upload bekommt den Anteil mit', () => {
    expect(wf).toMatch(/"\$TRACKS" "\$MODUS" "\$ANTEIL"/);
  });
});
