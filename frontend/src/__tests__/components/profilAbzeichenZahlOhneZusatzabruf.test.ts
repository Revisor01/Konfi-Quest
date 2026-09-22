import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Die Zahl in der Kachel "BADGES" im Konfi-Profil (22.09.2026).
//
// Sie kam aus einem eigenen Abruf von GET /konfi/badges/v2 — an der
// Zwischenspeicherung vorbei, mit rohem api.get. Die Route fuehrt elf
// Datenbankabfragen aus und liefert die vollstaendige Abzeichenuebersicht;
// gebraucht wurde davon EINE Zahl.
//
// Dieselbe Zahl steht laengst im Profil, das die Ansicht ohnehin schon hat:
// profile.badge_count, im Backend ein einzelnes COUNT(*) ueber user_badges
// (routes/konfi.js). Gegen Produktion gemessen sind beide Wege deckungsgleich
// (24 gegen 24, demo.emilia, 22.09.2026).
//
// Geprueft wird der Quelltext, weil der Fehler eine ueberfluessige Anfrage
// ist — er zeigt sich nicht im gerenderten Ergebnis, sondern daran, WELCHE
// Route die Ansicht ruft.

const quelle = readFileSync(
  resolve(process.cwd(), 'src/components/konfi/views/ProfileView.tsx'),
  'utf8'
);

describe('Konfi-Profil: Abzeichenzahl ohne Zusatzabruf', () => {
  it('ruft badges/v2 nicht fuer die Zahl in der Kachel', () => {
    // Geprueft wird der AUFRUF, nicht die Erwaehnung: Der Kommentar an der
    // Stelle nennt die Route absichtlich, damit niemand den Abruf
    // wiederherstellt, ohne den Grund zu kennen.
    const ohneKommentare = quelle
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    expect(ohneKommentare).not.toMatch(/api\.(get|post)\(\s*['"`][^'"`]*badges\/v2/);
  });

  it('nimmt die Zahl aus dem Profil, das die Ansicht schon hat', () => {
    // Die Kachel liest profile.badge_count statt eines eigenen Zustands.
    expect(quelle).toMatch(/value:\s*profile\.badge_count/);
  });

  it('haelt keinen eigenen Zustand mehr fuer die Abzeichenzahl', () => {
    // Blieb der useState stehen, zeigte die Kachel wieder 0, sobald jemand
    // den Abruf entfernt, aber den Zustand weiterliest.
    expect(quelle).not.toContain('earnedBadgesCount');
  });

  // Gegenprobe zur Abgrenzung: Der schlanke Challenge-Abruf bleibt. Er holt
  // Daten, die im Profil NICHT stehen — anders als die Abzeichenzahl.
  it('laesst den Challenge-Abruf unangetastet', () => {
    expect(quelle).toContain('/challenges/konfi');
  });
});
