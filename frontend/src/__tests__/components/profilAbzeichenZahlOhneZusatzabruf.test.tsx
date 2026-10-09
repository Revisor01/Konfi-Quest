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
// Seit 09.10.2026 gerendert (Geruest gerueste/profilSeiten.tsx): Der Fehler
// ist eine ueberfluessige Anfrage -- geprueft wird deshalb, WELCHE Routen das
// gerenderte Profil ruft, und welche Zahl in der Kachel steht.
import { zustand, api, konfiProfil, zuruecksetzen, zeigeKonfiProfil, kacheln } from './gerueste/profilSeiten';
import { describe, it, expect, beforeEach } from 'vitest';
import { cleanup } from '@testing-library/react';

const gerufen = () => api.get.mock.calls.map(([pfad]) => pfad);

beforeEach(() => {
  cleanup();
  zuruecksetzen();
});

describe('Konfi-Profil: Abzeichenzahl ohne Zusatzabruf', () => {
  it('ruft badges/v2 nicht fuer die Zahl in der Kachel', async () => {
    await zeigeKonfiProfil();
    expect(gerufen().filter((p) => p.includes('badges'))).toEqual([]);
  });

  it('nimmt die Zahl aus dem Profil, das die Ansicht schon hat', async () => {
    const { container } = await zeigeKonfiProfil(konfiProfil({ badge_count: 24 }));
    expect(kacheln(container)).toContainEqual(['BADGES', '24']);
  });

  it('haelt keinen eigenen Zustand mehr fuer die Abzeichenzahl', async () => {
    // Blieb ein eigener Zustand stehen, zeigte die Kachel 0, sobald der
    // Abruf fehlt. Antwortet badges/v2 trotzdem mit einer anderen Zahl,
    // bleibt die Kachel beim Profil.
    zustand.antworten.set('/konfi/badges/v2', { available: [], earned: [{ id: 1 }, { id: 2 }], stats: { totalVisible: 2, totalSecret: 0 } });
    const { container } = await zeigeKonfiProfil(konfiProfil({ badge_count: 5 }));
    expect(kacheln(container)).toContainEqual(['BADGES', '5']);
  });

  // Gegenprobe zur Abgrenzung: Der schlanke Challenge-Abruf bleibt. Er holt
  // Daten, die im Profil NICHT stehen -- anders als die Abzeichenzahl.
  it('laesst den Challenge-Abruf unangetastet', async () => {
    zustand.antworten.set('/challenges/konfi', {
      active: [], archive: [],
      marks: [{ challenge_id: 1, badge_name: 'A' }, { challenge_id: 2, badge_name: 'B' }, { challenge_id: 3, badge_name: 'C' }],
    });
    const { container } = await zeigeKonfiProfil();
    expect(gerufen()).toContain('/challenges/konfi');
    expect(kacheln(container)).toEqual([['PUNKTE', '12'], ['BADGES', '24'], ['CHALLENGES', '3']]);
  });
});
