import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Medien-Cache fuer ALLE Dateitypen, Groessengrenze, temp-Aufraeumen
// (13.09.2026, Simon: "Sonst muss man ja immer laden. Die moeglichst alle
// Dateien.").
//
// Vorher: MessageBubble teilte nach Dateiendung in drei Zweige — Bilder und
// Videos liefen ueber den Cache, ALLES andere (PDF, Office, Audio, ZIP) ueber
// einen direkten api.get in useChatDateien. Jedes Antippen einer PDF war ein
// voller Download.
//
// Geprueft wird der Quelltext, wie in chatDateiFortschritt.test.ts und aus
// demselben Grund: Der Cache haengt an Capacitor-Filesystem und axios-
// Ereignissen. Ein Laufzeittest muesste beide nachbauen und pruefte dann die
// Attrappe, nicht die Verdrahtung.

const lies = (pfad: string) => readFileSync(resolve(process.cwd(), pfad), 'utf8');

const cache = lies('src/services/mediaCache.ts');
const dateien = lies('src/components/chat/useChatDateien.ts');
const viewer = lies('src/utils/nativeFileViewer.ts');
const main = lies('src/main.tsx');

describe('Der Cache kennt auch Dokumente, Audio und Archive', () => {
  it('fuehrt PDF als eigenen MIME-Typ', () => {
    // Der springende Punkt: Ohne Eintrag kaeme eine PDF als
    // application/octet-stream zurueck und der native Betrachter oeffnete
    // sie nicht.
    expect(cache).toContain("pdf: 'application/pdf'");
  });

  it('fuehrt die uebrigen Dokumenttypen', () => {
    expect(cache).toContain("docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'");
    expect(cache).toContain("xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'");
    expect(cache).toContain("txt: 'text/plain'");
  });

  it('fuehrt Audio', () => {
    expect(cache).toContain("mp3: 'audio/mpeg'");
    expect(cache).toContain("m4a: 'audio/mp4'");
  });

  it('faellt fuer Unbekanntes weiterhin auf octet-stream zurueck', () => {
    // Kein Eintrag darf zum Fehler fuehren — die Datei kommt dann eben
    // generisch zurueck, statt gar nicht.
    expect(cache).toContain("return map[ext] || 'application/octet-stream';");
  });
});

describe('Das Oeffnen einer Datei laeuft ueber den Cache', () => {
  it('ruft getMediaBlob statt direkt api.get', () => {
    expect(dateien).toContain('getMediaBlob(filePath,');
  });

  it('laedt Dateien nicht mehr direkt vom Server', () => {
    // Die Gegenprobe zum vorigen Test: Bliebe der alte Aufruf stehen, liefe
    // weiterhin jeder Tipp am Cache vorbei.
    expect(dateien).not.toContain("api.get(`/chat/files/");
  });

  it('importiert den Cache', () => {
    expect(dateien).toContain("from '../../services/mediaCache'");
  });
});

describe('Der Cache waechst nicht unbegrenzt', () => {
  it('hat eine Obergrenze', () => {
    expect(cache).toContain('const MAX_CACHE_BYTES = 500 * 1024 * 1024;');
  });

  it('wirft das am laengsten nicht Benutzte zuerst raus', () => {
    // Aufsteigend nach letzter Nutzung sortiert -> der aelteste Zugriff steht
    // vorn und faellt als Erstes.
    expect(cache).toContain('eintraege.sort((a, b) => letzteNutzung(a) - letzteNutzung(b));');
  });

  it('zaehlt das LESEN als Nutzung, nicht nur das Schreiben', () => {
    // Ohne das Beruehren beim Lesen waere es "aeltestes geschrieben": Eine
    // woechentlich geoeffnete PDF floege raus, ein einmal geladenes Video von
    // gestern bliebe. Genau falsch herum.
    const lesen = cache.slice(cache.indexOf('async function readFromCache'), cache.indexOf('const letzterZugriff'));
    expect(lesen).toContain('beruehren(key);');
  });

  it('raeumt nach dem Schreiben auf, nicht davor', () => {
    // Davor koennte die eben geladene Datei selbst wieder rausfliegen.
    const schreiben = cache.slice(cache.indexOf('async function writeToCache'));
    // Bis zum Ende der Funktion: der erste Aufruf-Block danach gehoert schon
    // nicht mehr dazu. Ab 1 suchen, sonst findet indexOf die eigene Zeile.
    const rumpf = schreiben.slice(0, schreiben.indexOf('\nasync function', 1));
    expect(rumpf).toContain('void grenzeDurchsetzen();');
    // Und zwar NACH dem Schreiben, nicht davor.
    expect(rumpf.indexOf('Filesystem.writeFile')).toBeLessThan(rumpf.indexOf('void grenzeDurchsetzen();'));
  });

  it('laesst nur einen Aufraeumlauf gleichzeitig zu', () => {
    // writeToCache stoesst das nach JEDEM Schreiben an; mehrere Laeufe wuerden
    // sich gegenseitig Dateien wegloeschen, die der andere eingerechnet hat.
    expect(cache).toContain('if (laufendesAufraeumen) return laufendesAufraeumen;');
  });

  it('gibt die Object-URL einer weggeworfenen Datei frei', () => {
    // Sonst zeigte die App weiter auf einen Blob, den der Cache nicht mehr hat.
    const aufraeumen = cache.slice(cache.indexOf('export async function grenzeDurchsetzen'));
    expect(aufraeumen).toContain('URL.revokeObjectURL(url);');
    expect(aufraeumen).toContain('objectUrlCache.delete(pfad);');
  });
});

describe('Temporaere Kopien in Documents/temp verschwinden wieder', () => {
  it('raeumt sie beim App-Start auf', () => {
    expect(main).toContain('void tempDateienAufraeumen();');
  });

  it('wartet beim Start NICHT darauf', () => {
    // Der Start darf an nichts haengenbleiben (Befund 04.09.2026: weisse
    // Seite). Deshalb void statt await, und nach dem render().
    expect(main).not.toContain('await tempDateienAufraeumen()');
    const nachRender = main.slice(main.indexOf('root.render('));
    expect(nachRender).toContain('void tempDateienAufraeumen();');
  });

  it('loescht nur alte Kopien, nicht die gerade geoeffnete', () => {
    // Die native Anzeige liest die Datei noch, waehrend openFileNatively
    // laengst zurueck ist — sofortiges Loeschen zeigte ein leeres Dokument.
    expect(viewer).toContain('const TEMP_MAX_ALTER_MS = 60 * 60 * 1000;');
    expect(viewer).toContain('if (erzeugt === null || erzeugt >= grenze) continue;');
  });

  it('liest das Alter aus dem Dateinamen', () => {
    // Verlaesslicher als die mtime, die beim Sichern neu gesetzt werden kann.
    expect(viewer).toContain('const ausName = name.match(/^native_(\\d+)\\./);');
  });

  it('schreibt den Zeitstempel weiterhin in den Namen', () => {
    // Die Gegenprobe: Ohne ihn faende das Aufraeumen nichts wieder.
    expect(viewer).toContain('const tempPath = `${TEMP_DIR}/native_${Date.now()}.${ext}`;');
  });

  it('fasst auf Web gar nichts an', () => {
    // Directory.Documents gibt es dort so nicht.
    const funktion = viewer.slice(viewer.indexOf('export async function tempDateienAufraeumen'));
    expect(funktion).toContain('if (!Capacitor.isNativePlatform()) return;');
  });
});
