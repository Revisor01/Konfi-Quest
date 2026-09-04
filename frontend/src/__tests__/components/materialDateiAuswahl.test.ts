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
// Das Leeren bleibt richtig -- ohne Wertwechsel feuert change beim zweiten
// Mal derselben Datei nicht. Es muss nur NACH dem Auslesen passieren.

const quelle = readFileSync(
  resolve(process.cwd(), 'src/components/admin/modals/MaterialFormModal.tsx'),
  'utf8'
);

const handler = quelle.slice(
  quelle.indexOf('const handleFileSelect'),
  quelle.indexOf('const removeNewFile')
);

describe('Datei-Auswahl im Material-Modal', () => {
  it('liest die Dateiliste aus, bevor der Input geleert wird', () => {
    const auslesen = handler.indexOf('Array.from(e.target.files)');
    const leeren = handler.indexOf("fileInputRef.current.value = ''");
    expect(auslesen, 'Array.from nicht gefunden').toBeGreaterThan(-1);
    expect(leeren, 'Leeren nicht gefunden').toBeGreaterThan(-1);
    expect(auslesen).toBeLessThan(leeren);
  });

  it('liest NICHT innerhalb des State-Updaters aus', () => {
    // Genau das war der Fehler: der Updater laeuft verzoegert. Geprueft
    // wird die Updater-ZEILE selbst -- sie darf nur die vorher ausgelesene
    // Variable verwenden, nie erneut e.target.files.
    const zeile = handler.split('\n')
      .filter(z => !z.trim().startsWith('//'))
      .find(z => z.includes('setNewFiles(prev'));
    expect(zeile, 'setNewFiles-Zeile nicht gefunden').toBeTruthy();
    expect(zeile!).not.toContain('target.files');
    expect(zeile!).toContain('gewaehlt');
  });

  it('leert den Input weiterhin — dieselbe Datei muss erneut waehlbar sein', () => {
    expect(handler).toContain("fileInputRef.current.value = ''");
  });

  it('nimmt nur auf, wenn wirklich etwas gewaehlt wurde', () => {
    expect(handler).toMatch(/gewaehlt\.length > 0/);
  });
});

describe('Andere Upload-Stellen lesen die Datei sofort aus', () => {
  // Gegenprobe: Dieselbe Falle darf anderswo nicht schlummern.
  const dateien = [
    'src/components/konfi/modals/ChallengeSubmitModal.tsx',
    'src/components/konfi/modals/ActivityRequestModal.tsx',
    'src/components/teamer/modals/TeamerActivityRequestModal.tsx',
  ];

  it.each(dateien)('%s greift nicht verzoegert auf target.files zu', (pfad) => {
    const q = readFileSync(resolve(process.cwd(), pfad), 'utf8');
    // Kein target.files INNERHALB eines Updater-Callbacks (prev => ...).
    const treffer = [...q.matchAll(/set\w+\(\s*\w+\s*=>[\s\S]{0,200}?target\.files/g)];
    expect(treffer.length).toBe(0);
  });
});
