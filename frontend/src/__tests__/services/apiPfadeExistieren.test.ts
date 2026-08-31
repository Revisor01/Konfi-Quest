import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { resolve, join } from 'path';

// Gemessen am 31.08.2026: `GET /api/jahrgaenge` antwortete auf Produktion mit
// HTTP 404 — die Route ist ausschliesslich unter /api/admin/jahrgaenge
// eingehaengt. Aufgerufen wurde der falsche Pfad in der Konfi-Detailansicht.
// Der Abruf lief in den .catch()-Zweig, die Liste blieb leer, und das
// Bearbeiten-Modal zeigte "Keine Jahrgänge verfügbar" — obwohl es einen gab.
//
// Nichts hat das gemeldet: kein Test, keine Meldung in der Oberflaeche. Ein
// Tippfehler in einem Pfad ist im laufenden Betrieb unsichtbar, solange der
// Aufrufer den Fehler wegfaengt.
//
// Dieser Test zaehlt deshalb ALLE im Frontend fest verdrahteten API-Pfade
// gegen die tatsaechlichen Mountpunkte des Servers. Er faellt beim naechsten
// solchen Tippfehler, egal in welcher Ansicht.

const wurzel = process.cwd();

const dateienSammeln = (verzeichnis: string, treffer: string[] = []): string[] => {
  for (const eintrag of readdirSync(verzeichnis)) {
    const pfad = join(verzeichnis, eintrag);
    if (statSync(pfad).isDirectory()) {
      // Tests selbst nicht mitzaehlen: Dort stehen Pfade als Zeichenkette in
      // Erwartungen ("dieser Pfad darf NICHT mehr vorkommen"), nicht als
      // Aufruf. Sonst meldete der Test genau die Zeile, die ihn absichert.
      if (eintrag === '__tests__') continue;
      dateienSammeln(pfad, treffer);
    } else if (/\.tsx?$/.test(eintrag) && !/\.test\.tsx?$/.test(eintrag)) {
      treffer.push(pfad);
    }
  }
  return treffer;
};

// Die Mountpunkte aus createApp.js — die einzige Wahrheit darueber, welche
// Pfade es gibt. Bewusst aus der Datei gelesen statt abgeschrieben: eine
// abgeschriebene Liste laeuft irgendwann auseinander.
const backend = readFileSync(resolve(wurzel, '../backend/createApp.js'), 'utf8');
const mountpunkte = [...backend.matchAll(/app\.use\('\/api(\/[a-zA-Z0-9_/-]+)'/g)]
  .map((m) => m[1]);

// Nur Aufrufe mit fest verdrahtetem, absolutem Pfad. Zusammengebaute Pfade
// (`${basis}/...`) laesst der Test aus — die kann er nicht aufloesen.
const aufrufe = new Set<string>();
for (const datei of dateienSammeln(resolve(wurzel, 'src'))) {
  const inhalt = readFileSync(datei, 'utf8');
  for (const treffer of inhalt.matchAll(
    /\bapi\.(?:get|post|put|patch|delete)\(\s*['"`](\/[a-zA-Z0-9_/-]*)/g
  )) {
    aufrufe.add(treffer[1]);
  }
}

const passtZuMount = (pfad: string) =>
  mountpunkte.some((mount) => pfad === mount || pfad.startsWith(mount + '/'));

describe('API-Pfade des Frontends', () => {
  it('der Server haengt Routen unter erkennbaren Mountpunkten ein', () => {
    // Faengt den Fall ab, dass sich die Schreibweise in createApp.js aendert
    // und der Test dann gegen eine leere Liste "gruen" waere.
    expect(mountpunkte.length).toBeGreaterThanOrEqual(20);
    expect(mountpunkte).toContain('/admin/jahrgaenge');
  });

  it('es werden ueberhaupt Aufrufe gefunden', () => {
    expect(aufrufe.size).toBeGreaterThanOrEqual(50);
  });

  it('jeder fest verdrahtete Pfad hat einen Mountpunkt im Server', () => {
    const verwaist = [...aufrufe].filter((pfad) => !passtZuMount(pfad)).sort();
    expect(verwaist).toEqual([]);
  });

  it('die Jahrgangsliste wird unter ihrem echten Pfad geholt', () => {
    // Der konkrete Befund vom 31.08.2026. /jahrgaenge gibt es nicht.
    expect(aufrufe.has('/jahrgaenge')).toBe(false);
    expect(aufrufe.has('/admin/jahrgaenge')).toBe(true);
  });
});
