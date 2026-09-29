import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Simons Befund 04.09.2026: "Material kann nicht hochgeladen werden, im
// Browser geht nichts." Sein Netz-Mitschnitt zeigte den PUT auf
// /material/:id, aber KEINEN POST auf /material/:id/files -- die Datei kam
// nie im State an.
//
// Ursache: Array.from(e.target.files) stand INNERHALB des
// setNewFiles(prev => ...)-Updaters. React ruft den verzoegert auf; bis
// dahin hatte die Zeile darunter (fileInputRef.current.value = '') den
// Input geleert. Im Browser gemessen: files.length 1 -> 1 -> 0 ueber das
// change-Event hinweg.
//
// Seit dem 29.09.2026 oeffnet das Modal die Auswahl ueber die Huelle
// dateiAuswaehlen (services/systemDialoge, wegen der App-Sperre). Die liest
// das Feld aus, BEVOR sie es leert, und legt je Auswahl ein frisches an --
// beides ist dort im Ablauf geprueft (dateiAuswahl.test.ts: "das Feld wird
// erst ausgelesen, dann geleert", "dieselbe Datei laesst sich gleich noch
// einmal waehlen"). Hier bleibt zu pruefen, dass das Modal die fertige Liste
// weiterreicht und sie nie aus einem State-Updater heraus liest.

const quelle = readFileSync(
  resolve(process.cwd(), 'src/components/admin/modals/MaterialFormModal.tsx'),
  'utf8'
);

const waehlen = quelle.slice(
  quelle.indexOf('const dateienWaehlen'),
  quelle.indexOf('const removeNewFile')
);

// dateienVorbereiten bereitet die gewaehlten Dateien vor (verkleinern,
// Grenze des Servers) und haengt sie danach an — mit der Liste aus der Huelle.
const vorbereiten = quelle.slice(
  quelle.indexOf('const dateienVorbereiten'),
  quelle.indexOf('const dateienWaehlen')
);

describe('Datei-Auswahl im Material-Modal', () => {
  it('holt die Liste aus der Hülle und reicht sie fertig weiter', () => {
    expect(waehlen, 'dateienWaehlen nicht gefunden').toContain('await dateiAuswaehlen(');
    expect(waehlen).toContain('multiple: true');
    expect(waehlen).toContain('dateienVorbereiten(gewaehlt)');
  });

  it('liest NICHT innerhalb des State-Updaters aus', () => {
    // Genau das war der Fehler: der Updater laeuft verzoegert. Geprueft
    // wird die Updater-ZEILE selbst -- sie darf nur die vorher vorbereitete
    // Liste verwenden (`fertig`), nie ein Datei-Feld.
    const zeile = vorbereiten.split('\n')
      .filter(z => !z.trim().startsWith('//'))
      .find(z => z.includes('setNewFiles(prev'));
    expect(zeile, 'setNewFiles-Zeile nicht gefunden').toBeTruthy();
    expect(zeile!).not.toContain('target.files');
    expect(zeile!).toContain('fertig');
    expect(vorbereiten).not.toContain('target.files');
    expect(vorbereiten).toMatch(/for \(const datei of gewaehlt\)/);
  });

  it('hält kein eigenes Datei-Feld mehr', () => {
    expect(quelle).not.toContain('fileInputRef');
    expect(quelle).not.toContain('target.files');
  });

  it('nimmt nur auf, wenn wirklich etwas gewaehlt wurde', () => {
    expect(waehlen).toMatch(/gewaehlt && gewaehlt\.length > 0/);
  });
});

describe('Andere Upload-Stellen lesen die Datei sofort aus', () => {
  // Gegenprobe: Dieselbe Falle darf anderswo nicht schlummern.
  const dateien = [
    'src/components/konfi/modals/ChallengeSubmitModal.tsx',
    'src/components/konfi/modals/ActivityRequestModal.tsx',
    'src/components/teamer/modals/TeamerActivityRequestModal.tsx',
    'src/components/chat/useChatDateien.ts',
  ];

  it.each(dateien)('%s greift nicht verzoegert auf target.files zu', (pfad) => {
    const q = readFileSync(resolve(process.cwd(), pfad), 'utf8');
    // Kein target.files INNERHALB eines Updater-Callbacks (prev => ...).
    const treffer = [...q.matchAll(/set\w+\(\s*\w+\s*=>[\s\S]{0,200}?target\.files/g)];
    expect(treffer.length).toBe(0);
  });
});
