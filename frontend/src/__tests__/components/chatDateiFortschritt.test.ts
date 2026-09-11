import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Fortschrittsanzeige beim Senden und Laden von Dateien (11.09.2026).
//
// Vorher gab es beim Senden nur einen Spinner im Senden-Knopf und beim Laden
// gar keine Rueckmeldung: Wer eine PDF antippte, sah nichts passieren und
// tippte weiter — was mehrere Downloads parallel anstiess (Simon, 11.09.2026).
//
// Geprueft wird der Quelltext, weil die Anzeige an axios-Ereignissen haengt
// (onUploadProgress / onDownloadProgress). Ein Rendering-Test muesste die
// Ereignisse nachbauen und pruefte dann die Attrappe, nicht die Verdrahtung.

const lies = (pfad: string) =>
  readFileSync(resolve(process.cwd(), pfad), 'utf8');

const raum = lies('src/components/chat/ChatRoom.tsx');
const sektionen = lies('src/components/chat/ChatRoomSections.tsx');
const dateien = lies('src/components/chat/useChatDateien.ts');
const blase = lies('src/components/chat/MessageBubble.tsx');

describe('Senden: der Fortschritt kommt von axios, nicht aus einer Schaetzung', () => {
  it('haengt den Fortschritt an onUploadProgress', () => {
    expect(raum).toContain('onUploadProgress');
    // Aus geladenen und gesamten Bytes gerechnet — keine Attrappe, die
    // unabhaengig vom echten Upload hochzaehlt.
    expect(raum).toContain('ereignis.loaded / ereignis.total');
  });

  it('zeigt keinen Balken, wenn der Server keine Groesse meldet', () => {
    // Ohne `total` gibt es nichts zu rechnen; eine geratene Zahl waere
    // schlimmer als keine.
    expect(raum).toContain('if (!ereignis.total) return;');
  });

  it('setzt den Fortschritt nur bei einer Datei', () => {
    // Reiner Text ist sofort durch; ein Balken wuerde nur aufblitzen.
    expect(raum).toContain('setUploadFortschritt(file ? { localId, prozent: 0 } : null)');
    expect(raum).toContain('onUploadProgress: file ?');
  });

  it('haengt den Fortschritt an die Nachricht, nicht an die Datei-Vorschau', () => {
    // Gemessen am Geraet (11.09.2026): clearSelectedFile() laeuft VOR dem
    // Upload, damit das Eingabefeld sofort wieder frei ist. Ein Balken in der
    // Vorschauzeile waere deshalb nie zu sehen. Die localId ordnet den
    // Fortschritt der optimistischen Nachricht zu, die noch keine Server-ID hat.
    expect(raum).toContain('{ localId: string; prozent: number }');
    expect(sektionen).not.toContain('uploadFortschritt');
  });

  it('raeumt den Fortschritt im finally weg', () => {
    // Auch im Fehlerfall — sonst bliebe der Balken nach einem
    // fehlgeschlagenen Upload stehen. Ab dem Upload-Aufruf suchen: ChatRoom
    // hat mehrere finally-Bloecke, der erste gehoert zum Nachladen.
    const abUpload = raum.slice(raum.indexOf('onUploadProgress'));
    const block = abUpload.slice(abUpload.indexOf('} finally {'), abUpload.indexOf('} finally {') + 200);
    expect(block).toContain('setUploading(false)');
    expect(block).toContain('setUploadFortschritt(null)');
  });

  it('reicht den Fortschritt bis zur Nachrichtenliste durch', () => {
    expect(raum).toContain('uploadFortschritt={uploadFortschritt}');
  });

  it('ordnet den Fortschritt genau einer Nachricht zu', () => {
    // Ohne den Vergleich zeigten ALLE eigenen Nachrichten den Balken.
    expect(blase).toContain('uploadFortschritt.localId === message.localId');
  });

  it('ersetzt waehrend des Sendens das Uhr-Symbol', () => {
    // Sonst staenden Uhr und Prozentzahl nebeneinander und meinten dasselbe.
    expect(blase).toContain("message.queueStatus === 'pending' && !sendetGerade");
  });

  it('sagt bei 100 Prozent, dass noch verarbeitet wird', () => {
    // Der Server rechnet danach noch (Bild umrechnen, verschluesseln). Ein
    // Balken, der bei 100 stehenbleibt, sieht sonst aus wie ein Haenger.
    expect(blase).toContain('Wird verarbeitet…');
  });
});

describe('Laden: eine angetippte Datei zeigt, dass sie laedt', () => {
  it('haengt den Fortschritt an onDownloadProgress', () => {
    expect(dateien).toContain('onDownloadProgress');
    expect(dateien).toContain('ereignis.loaded / gesamt');
  });

  it('laesst den Fortschritt bei unbekannter Groesse offen', () => {
    // prozent bleibt null -> die Anzeige laeuft unbestimmt ("Wird geladen…")
    // statt auf einer geratenen Zahl zu stehen.
    expect(dateien).toContain('gesamt ? Math.min(Math.round((ereignis.loaded / gesamt) * 100), 100) : null');
  });

  it('ignoriert einen zweiten Tipp, solange geladen wird', () => {
    // Genau der gemeldete Fall: mehrfaches Tippen stiess mehrere Downloads an.
    const klick = dateien.slice(
      dateien.indexOf('const handleFileClick'),
      dateien.indexOf('const handleFileClick') + 300
    );
    expect(klick).toContain('if (ladendeDatei) return;');
  });

  it('raeumt die Anzeige im finally weg', () => {
    // Wichtig wegen des fruehen return, wenn die Datei nativ geoeffnet wurde:
    // ohne finally bliebe die Anzeige dort haengen.
    const block = dateien.slice(dateien.indexOf('} finally {'), dateien.indexOf('} finally {') + 300);
    expect(block).toContain('setLadendeDatei(null)');
  });

  it('gibt den Ladezustand nach aussen', () => {
    expect(dateien).toContain('ladendeDatei,');
    expect(raum).toContain('ladendeDatei={ladendeDatei}');
  });
});

describe('Laden: nur die angetippte Datei zeigt den Fortschritt', () => {
  it('vergleicht ueber den Dateipfad', () => {
    // Ohne den Vergleich zeigten ALLE Dateien im Raum gleichzeitig einen
    // Fortschritt, sobald eine geladen wird.
    expect(blase).toContain("ladendeDatei.pfad === message.file_path");
  });

  it('ersetzt den Pfeil waehrend des Ladens durch einen Spinner', () => {
    expect(blase).toContain('laedtGerade ? (');
    expect(blase).toContain('IonSpinner');
  });

  it('nennt beim Laden die Prozentzahl, sonst die Dateigroesse', () => {
    expect(blase).toContain('`Wird geladen… ${ladendeDatei.prozent} %`');
    expect(blase).toContain('formatFileSize(message.file_size)');
  });
});

describe('Barrierefreiheit: beide Balken sind als Fortschritt ausgezeichnet', () => {
  it('setzt role und Werte beim Senden', () => {
    // Beide Balken liegen in MessageBubble: der Sende-Balken am Ende der
    // Blase, der Lade-Balken beim Dateianhang.
    expect(blase).toContain('aria-valuenow={uploadFortschritt!.prozent}');
    const stellen = blase.split('role="progressbar"').length - 1;
    expect(stellen).toBe(2);
  });

  it('setzt role und Werte beim Laden', () => {
    const balken = blase.slice(
      blase.indexOf('role="progressbar"'),
      blase.indexOf('role="progressbar"') + 400
    );
    expect(balken).toContain('aria-valuenow={ladendeDatei.prozent}');
    expect(balken).toContain('aria-valuemin={0}');
    expect(balken).toContain('aria-valuemax={100}');
    expect(balken).toContain('aria-label=');
  });
});

describe('Senden-Icon: waagerecht statt schraeg', () => {
  const icons = lies('src/components/shared/icons.ts');

  it('nutzt send fuer den Chat-Knopf', () => {
    // paperPlane ist im SVG diagonal gezeichnet und sah im runden Knopf
    // schief aus (Simon, 11.09.2026).
    expect(icons).toContain('send as ICON_SENDEN_GEFUELLT');
    expect(icons).not.toContain('paperPlane as ICON_SENDEN_GEFUELLT');
  });

  it('laesst die Outline-Variante beim Papierflieger', () => {
    // ICON_SENDEN steht bei den Challenges fuer "eingereicht", nicht fuer
    // einen Senden-Knopf — die Form passt dort weiterhin.
    expect(icons).toContain('paperPlaneOutline as ICON_SENDEN');
  });
});
