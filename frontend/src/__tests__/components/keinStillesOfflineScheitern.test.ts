import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative } from 'path';

// Stilles Scheitern (Audit 25.08.2026): `if (!isOnline) return;` ohne jede
// Rückmeldung stand 30+ Mal in den Komponenten — der Tipp auf "Löschen",
// "Absagen" usw. verpuffte offline stumm. Dieser Test verhindert, dass das
// Muster zurückkehrt: Wer offline blockieren will, nutzt offlineBlockiert()
// (Meldung) oder legt die Aktion in die writeQueue.

const componentsDir = join(__dirname, '..', '..', 'components');

// Diese Dateien werden parallel separat repariert (25.08.2026) und sind hier
// solange erlaubt; der Eintrag kann nach deren Fix ersatzlos entfallen.
const erlaubt = new Set([
  'admin/views/EventDetailView.tsx',
  'konfi/views/EventDetailView.tsx',
]);

const alleDateien = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return alleDateien(p);
    return /\.(tsx|ts)$/.test(name) ? [p] : [];
  });

describe('Kein stilles Offline-Scheitern in Komponenten', () => {
  it('keine Komponente enthält mehr `if (!isOnline) return` ohne Meldung', () => {
    const verstoesse: string[] = [];

    for (const datei of alleDateien(componentsDir)) {
      const rel = relative(componentsDir, datei);
      if (erlaubt.has(rel)) continue;

      const inhalt = readFileSync(datei, 'utf8');
      // Trifft `if (!isOnline) return;` und `if (!isOnline) return Promise.resolve();`
      if (/if\s*\(\s*!isOnline\s*\)\s*return\b/.test(inhalt)) {
        verstoesse.push(rel);
      }
    }

    expect(verstoesse).toEqual([]);
  });
});
