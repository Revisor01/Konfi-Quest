import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'fs';
import { resolve, join } from 'path';
import { NEUERUNGEN_VERSION } from '../../hooks/useOnboardingOnce';

/**
 * Alle "Was ist neu"-Einbindungen zeigen DIESELBE Version.
 *
 * SIMONS BEFUND (03.09.2026): "Im Profil sehe ich zwar 2.1, aber sehe dann
 * den Whats-new-Walkthrough von 2.0."
 *
 * Ursache: Beim Update auf 2.1.1 entstanden neue Modale
 * (AdminUpdate211WalkthroughModal, ...), und fuenf der sechs Einbindungen
 * wurden umgestellt. AdminSettingsPage.tsx blieb auf der 2.0-Fassung
 * stehen -- ohne Fehler, ohne roten Test, nur mit falschem Inhalt.
 *
 * Das ist die Fehlerklasse, vor der CLAUDE.md warnt: Jede Rolle hat einen
 * eigenen Komponentenbaum, und beim Nachziehen wird eine Stelle vergessen.
 * Ein Test, der alle Einbindungen zaehlt, faellt darauf nicht herein.
 *
 * WENN DIESER TEST ROT WIRD: Wahrscheinlich gibt es eine neue Version der
 * Walkthrough-Modale und eine Seite bindet noch die alte ein. Alle
 * Einbindungen auf die neue umstellen -- nicht diesen Test aufweichen.
 */

const wurzel = resolve(process.cwd(), 'src/components');

function sammleDateien(verzeichnis: string): string[] {
  const gefunden: string[] = [];
  for (const eintrag of readdirSync(verzeichnis, { withFileTypes: true })) {
    const pfad = join(verzeichnis, eintrag.name);
    if (eintrag.isDirectory()) gefunden.push(...sammleDateien(pfad));
    else if (eintrag.name.endsWith('.tsx')) gefunden.push(pfad);
  }
  return gefunden;
}

// Aus '2_1' wird '211' im Dateinamen (KonfiUpdate211WalkthroughModal).
// Die Modale tragen die Patch-Version, der Schluessel nur Major/Minor.
const alleDateien = sammleDateien(wurzel);
const modalDateien = alleDateien.filter(p => /Update\d*WalkthroughModal\.tsx$/.test(p));

// Einbindungen = Dateien, die ein Walkthrough-Modal importieren, ohne selbst
// eines zu sein.
const einbindungen = alleDateien
  .filter(p => !/WalkthroughModal\.tsx$/.test(p))
  .map(p => ({ pfad: p, inhalt: readFileSync(p, 'utf8') }))
  .filter(d => /import \w*Update\w*WalkthroughModal from/.test(d.inhalt));

describe('Was-ist-neu-Walkthrough', () => {
  it('es gibt ueberhaupt Einbindungen (sonst prueft der Test nichts)', () => {
    expect(einbindungen.length).toBeGreaterThanOrEqual(5);
  });

  it('jede Einbindung nutzt die AKTUELLE Fassung, keine aeltere', () => {
    // Die hoechste Versionsnummer unter den Modal-Dateien ist die aktuelle.
    const versionen = modalDateien
      .map(p => (p.match(/Update(\d+)Walkthrough/) || [])[1])
      .filter(Boolean)
      .map(Number);
    const aktuell = Math.max(...versionen);

    const veraltet: string[] = [];
    for (const { pfad, inhalt } of einbindungen) {
      const importe = [...inhalt.matchAll(/import (\w*Update(\d*)Walkthrough\w*) from/g)];
      for (const [, name, version] of importe) {
        const v = version ? Number(version) : 0;
        if (v < aktuell) veraltet.push(`${pfad.replace(process.cwd(), '')} -> ${name}`);
      }
    }
    expect(veraltet).toEqual([]);
  });

  it('die Versionsmarke passt zu den eingebundenen Modalen', () => {
    // NEUERUNGEN_VERSION steuert, WANN der Hinweis erscheint. Zeigt sie 2_1,
    // duerfen die Modale nicht die 2.0-Inhalte tragen -- genau diese Luecke
    // hat Simon gesehen.
    const majorMinor = NEUERUNGEN_VERSION.replace('_', '');
    const passendeModale = modalDateien.filter(p => p.includes(`Update${majorMinor}`));
    expect(passendeModale.length).toBeGreaterThan(0);
  });
});
