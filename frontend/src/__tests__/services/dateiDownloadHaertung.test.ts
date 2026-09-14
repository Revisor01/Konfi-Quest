import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { resolve, join } from 'path';

// Haertung rund um Datei-Downloads und Aufraeumen (14.09.2026).
//
// Drei Befunde aus derselben Familie — asynchrone Arbeit, die weiterlaeuft,
// nachdem der Bildschirm weg ist, und ein Zeitlimit, das zu knapp war:
//
//  1. VideoPreview: Die Aufraeumfunktion las die Object-URL aus dem
//     Effekt-Scope. Lief sie, waehrend der Download noch lief, sah sie den
//     leeren Anfangswert — die danach erzeugte URL blieb bis zum App-Neustart
//     liegen. Ein Video wegzuscrollen genuegte.
//  2. QRDisplayModal: Das Abfrage-Intervall wurde erst NACH zwei await gesetzt.
//     Wer das Fenster vorher schloss, hinterliess eine Abfrage alle 10 s, die
//     nie wieder aufhoerte. Mehrfaches Oeffnen summierte sie.
//  3. api.ts: Das globale Zeitlimit von 20 s galt auch fuer Datei-Downloads.
//     20 MB brauchen darin durchgehend 8 Mbit/s — im Gemeindehaus unerreichbar.
//     axios-retry wiederholte den Abbruch dreimal von vorn.
//
// Geprueft wird der Quelltext, wie in den Schwestertests: Die Fehler haengen
// an Unmount-Zeitpunkten und axios-Ereignissen. Ein Laufzeittest muesste beide
// nachbauen und pruefte dann die Attrappe statt der Verdrahtung.

const lies = (pfad: string) => readFileSync(resolve(process.cwd(), pfad), 'utf8');

const video = lies('src/components/chat/VideoPreview.tsx');
const qr = lies('src/components/shared/QRDisplayModal.tsx');
const api = lies('src/services/api.ts');
const cache = lies('src/services/mediaCache.ts');

describe('VideoPreview raeumt auch bei Abbruch waehrend des Ladens auf', () => {
  it('fuehrt einen Abbruch-Merker', () => {
    expect(video).toContain('let cancelled = false;');
    expect(video).toContain('cancelled = true;');
  });

  it('gibt eine URL frei, die erst nach dem Abhaengen entstanden ist', () => {
    // Der Kern des Lecks: ohne diesen Zweig bleibt genau diese URL liegen.
    expect(video).toContain('if (cancelled) {');
    expect(video).toContain('URL.revokeObjectURL(blobUrl);');
  });

  it('meldet keinen Fehler mehr fuer eine weggescrollte Nachricht', () => {
    // Am Meldungstext verankert, nicht an der Reihenfolge: Die Datei hat
    // mehrere catch-Bloecke, gemeint ist der des Blob-Ladens.
    const ende = video.indexOf("onErrorRef.current('Fehler beim Laden des Videos')");
    expect(ende).toBeGreaterThan(-1);
    const zweig = video.slice(video.lastIndexOf('} catch (error) {', ende), ende);
    expect(zweig).toContain('if (cancelled) return;');
  });
});

describe('QRDisplayModal hoert nach dem Schliessen auf abzufragen', () => {
  it('fuehrt einen Abbruch-Merker ueber das Unmount', () => {
    expect(qr).toContain('const abgebrochenRef = useRef(false);');
    expect(qr).toContain('abgebrochenRef.current = true;');
  });

  it('startet das Intervall nicht mehr, wenn inzwischen geschlossen wurde', () => {
    // Genau die Luecke: pollRef.current war beim Aufraeumen noch null.
    expect(qr).toContain('if (abgebrochenRef.current) return;');
  });

  it('setzt die Intervall-Referenz beim Aufraeumen zurueck', () => {
    const aufraeumen = qr.slice(qr.indexOf('return () => {'));
    expect(aufraeumen.slice(0, 200)).toContain('clearInterval(pollRef.current);');
    expect(aufraeumen.slice(0, 200)).toContain('pollRef.current = null;');
  });
});

describe('Datei-Downloads haben ein eigenes, hoeheres Zeitlimit', () => {
  it('definiert es zentral', () => {
    expect(api).toContain('export const DATEI_TIMEOUT_MS = 180000;');
  });

  it('laesst das globale Limit unangetastet', () => {
    // Nur Dateien brauchen mehr Zeit; fuer normale Anfragen bleibt 20 s
    // richtig, damit ein totes Netz nicht ewig haengt.
    expect(api).toContain('timeout: 20000,');
  });

  it('nutzt es im Medien-Cache', () => {
    expect(cache).toContain('timeout: DATEI_TIMEOUT_MS,');
  });

  it('nutzt es an JEDER Stelle, die eine Datei laedt', () => {
    // Sonst bleibt genau die eine Stelle uebrig, die dann weiter scheitert.
    const wurzel = resolve(process.cwd(), 'src');
    const treffer: string[] = [];

    const gehe = (verzeichnis: string) => {
      for (const eintrag of readdirSync(verzeichnis)) {
        const pfad = join(verzeichnis, eintrag);
        if (statSync(pfad).isDirectory()) {
          if (eintrag !== '__tests__') gehe(pfad);
          continue;
        }
        if (!/\.(ts|tsx)$/.test(eintrag)) continue;
        const inhalt = readFileSync(pfad, 'utf8');
        if (!inhalt.includes("responseType: 'blob'")) continue;
        // Auf die VERWENDUNG pruefen, nicht auf das blosse Vorkommen: Der
        // Import allein genuegt nicht. Ohne diese Schaerfe blieb der Test
        // gruen, obwohl das Limit an der Abrufstelle fehlte (gegengeprobt
        // 14.09.2026, indem eine Stelle zurueckgebaut wurde).
        const abrufe = inhalt.match(/responseType: 'blob'[^}]*}/g) || [];
        const ohneLimit = abrufe.filter(a => !a.includes('DATEI_TIMEOUT_MS'));
        if (ohneLimit.length > 0) {
          treffer.push(pfad.slice(wurzel.length + 1));
        }
      }
    };
    gehe(wurzel);

    expect(treffer).toEqual([]);
  });
});
