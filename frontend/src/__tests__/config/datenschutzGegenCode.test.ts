import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Die Datenschutzerklaerung beschreibt, was der Code tut (Paket F, 29.09.2026).
 *
 * Anlass (Audit 26.09.2026, Grundgeruest BF-13): 9b versprach, ein
 * Absturzbericht entstehe "ausschliesslich dann, wenn die App abstuerzt oder
 * einen Fehler abfaengt, der die Bedienung unterbricht -- nicht im laufenden
 * Betrieb". Der Code meldet aber jede unbehandelte Promise-Ablehnung und jeden
 * window-Fehler, auch im Hintergrund, bis zu 20 je Sitzung.
 *
 * Diese Tests binden die Zahlen im Text an die Stellen im Code, aus denen sie
 * stammen. Wer die Grenze im Code aendert, muss den Text mitziehen -- und
 * umgekehrt.
 */
const lies = (pfad: string) => readFileSync(join(process.cwd(), pfad), 'utf8');

/** Sichtbarer Text der Seite: ohne Tags, Entitaeten aufgeloest, Leerraum vereinheitlicht. */
const text = lies('public/datenschutz.html')
  .replace(/<script[\s\S]*?<\/script>/g, '')
  .replace(/<style[\s\S]*?<\/style>/g, '')
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ')
  .replace(/&#8222;/g, '„')
  .replace(/&#8220;/g, '“')
  .replace(/\s+/g, ' ');

/** Numerische Konstante aus einer Quelldatei lesen. */
function konstante(datei: string, name: string): number {
  const m = lies(datei).match(new RegExp(`const ${name} = (\\d+);`));
  if (!m) throw new Error(`${name} fehlt in ${datei}`);
  return Number(m[1]);
}

describe('9b Absturzberichte: der Text folgt dem Code', () => {
  const DIAGNOSE = 'src/services/absturzdiagnose.ts';

  it('verspricht nicht mehr "nur bei Absturz, nicht im laufenden Betrieb"', () => {
    expect(text).not.toContain('nicht im laufenden Betrieb');
    expect(text).not.toContain('ausschließlich dann erzeugt');
  });

  it('nennt die abgefangenen Fehler im Hintergrund', () => {
    // globaleFehlerkanaeleAnhaengen meldet unhandledrejection und window-error
    expect(lies(DIAGNOSE)).toMatch(/addEventListener\('unhandledrejection'/);
    expect(text).toContain('auch einen, der im Hintergrund auftritt und die Bedienung nicht unterbricht');
  });

  it('nennt die Obergrenze je App-Lauf aus dem Code', () => {
    const max = konstante(DIAGNOSE, 'MELDUNGEN_JE_SITZUNG_MAX');
    expect(max).toBe(20);
    expect(text).toContain(`insgesamt höchstens ${max} Berichte, bis sie neu gestartet wird`);
  });

  it('nennt die Kuerzung der Fehlermeldung aus dem Code', () => {
    const zeichen = konstante(DIAGNOSE, 'MELDUNG_MAX_ZEICHEN');
    expect(zeichen).toBe(200);
    expect(text).toContain(`die Fehlermeldung (auf ${zeichen} Zeichen gekürzt)`);
  });

  it('nennt den Schalter unter dem Namen, den die App zeigt (Sicherheit BF-22)', () => {
    const titel = lies('src/components/shared/AbsturzberichteSchalter.tsx')
      .match(/app-list-item__title">([^<]+)</)?.[1];
    expect(titel).toBe('Absturzberichte senden');
    expect(text).toContain(`der Schalter „${titel}“`);
    // und das Handbuch unter demselben Namen
    expect(readFileSync(join(process.cwd(), '../docs/handbuch/03-bedienung.md'), 'utf8'))
      .toContain(`**„${titel}"**`);
  });

  it('sagt, dass das Abschalten nativ erst mit dem naechsten Start ganz greift', () => {
    // absturzdiagnose.ts: setEnabled wirkt erst beim naechsten Start; bis
    // dahin verwirft deleteUnsentReports / diagnoseStarten. Der Text darf
    // nicht "sofort, vollstaendig" versprechen.
    expect(lies(DIAGNOSE)).toMatch(/deleteUnsentReports\(\)/);
    expect(text).toContain('Das Sammeln durch den Dienst selbst endet mit dem nächsten Start der App');
  });
});
