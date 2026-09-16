// Stempel: EINE Komponente fuer Konfi, Leitung und Team (16.09.2026)
//
// DER BEFUND (Simon am Geraet, woertlich):
//   "aber die nicht erreichten sind nicht da, und bei klick gibt es keine
//    infos, obwohl wir das ja bei konfis und admins laengst haben, das darf
//    doch auch an nur einer stelle programmiert werden"
//
// Gemeint war der Challenges-Tab beim Team. Zwei Maengel und eine Ansage:
//   1. Noch nicht erreichte Stempel fehlten ganz (bei Konfis stehen sie grau).
//   2. Ein Tipp auf einen Stempel zeigte keine Infos, obwohl es das
//      Stempel-Popover bei Konfis und in der Leitungs-Detailansicht gibt.
//   3. Die Ansage: EINE Stelle, nicht drei Kopien.
//
// URSACHE: admin/views/ChallengesManageView.tsx baute die Stempelreihe von
// HAND mit einem rohen KachelRaster -- ohne offeneStempel, ohne
// onKachelClick. Leitung UND Team kommen beide ueber shared/ChallengesPage
// dorthin, also fehlte beiden dasselbe. Die Konfi-Ansicht
// (konfi/views/ChallengesView.tsx) und die Leitungs-Detailansicht
// (admin/views/KonfiDetailView.tsx) nutzten die gemeinsame Komponente
// ChallengeStempelSektion schon seit dem 14.09.2026.
//
// DIESER TEST prueft die ANSAGE, nicht nur das Ergebnis: dass alle drei
// Ansichten DIESELBE Komponente aufrufen. Eine vierte Kopie, die zufaellig
// dasselbe tut, waere wieder der Zustand, den Simon abgestellt haben wollte.
// Deshalb Quelltext und nicht Rendering -- im DOM saehe eine Kopie gleich aus.
//
// GEGENPROBE (durchgefuehrt 16.09.2026): Stellt man ChallengesManageView auf
// das alte, handgebaute KachelRaster zurueck, fallen die Tests 1, 2 und 4;
// nimmt man in ChallengesPage die Ableitung der offenen Stempel wieder
// heraus, faellt Test 3.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

const lies = (pfad: string) =>
  readFileSync(resolve(__dirname, '../../', pfad), 'utf-8');

/**
 * Kommentare weg, bevor irgendetwas gesucht wird. Diese Dateien sind dicht
 * kommentiert und nennen die Namen der Komponenten IM FLIESSTEXT -- eine
 * Suche ueber den Rohtext waere schon durch einen Kommentar gruen, der die
 * Loesung nur BESCHREIBT statt sie aufzurufen.
 */
const ohneKommentare = (quelle: string) =>
  quelle.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

describe('Stempel stehen an einer Stelle', () => {
  const manage = ohneKommentare(lies('components/admin/views/ChallengesManageView.tsx'));
  const seite = ohneKommentare(lies('components/shared/ChallengesPage.tsx'));
  const konfi = ohneKommentare(lies('components/konfi/views/ChallengesView.tsx'));
  const detail = ohneKommentare(lies('components/admin/views/KonfiDetailView.tsx'));

  // 1. DIESELBE Komponente wie bei Konfi und Leitungs-Detailansicht.
  it('alle drei Ansichten rufen ChallengeStempelSektion auf', () => {
    expect(manage).toMatch(/<ChallengeStempelSektion/);
    expect(konfi).toMatch(/<ChallengeStempelSektion/);
    expect(detail).toMatch(/<ChallengeStempelSektion/);
  });

  // 2. Und bauen sie nicht daneben noch einmal selbst.
  it('ChallengesManageView baut die Stempelreihe nicht mehr selbst', () => {
    expect(manage).not.toMatch(/<KachelRaster/);
    expect(manage).not.toMatch(/import KachelRaster/);
  });

  // 3. Die offenen Stempel werden abgeleitet und durchgereicht -- ohne sie
  //    bliebe die graue Reihe leer, egal welche Komponente rendert.
  it('ChallengesPage leitet die offenen Stempel ab und reicht sie durch', () => {
    // Aus derselben Liste, aus der auch die erhaltenen kommen: !has_badge
    // plus vorhandener badge_name -- dieselbe Rechnung wie im Backend
    // (GET /challenges/konfi).
    expect(seite).toMatch(/!c\.has_badge/);
    expect(seite).toMatch(/offeneStempel/);
    expect(seite).toMatch(/offeneStempel=\{offeneStempel\}/);
  });

  // 4. Die Komponente bekommt die offenen Stempel auch wirklich als Prop.
  it('ChallengesManageView reicht offeneStempel an die Komponente weiter', () => {
    expect(manage).toMatch(/<ChallengeStempelSektion[^>]*offeneStempel=\{offeneStempel\}/);
  });

  // 5. Die gemeinsame Komponente kann beides, was Simon vermisst hat:
  //    graue Kacheln UND ein Popover beim Antippen. Der Beleg steht hier,
  //    damit der Test nicht nur sagt "alle nutzen dieselbe Stelle", sondern
  //    auch "und diese Stelle kann es".
  it('ChallengeStempelSektion zeigt offene Stempel und oeffnet ein Popover', () => {
    const sektion = ohneKommentare(lies('components/shared/ChallengeStempelSektion.tsx'));
    expect(sektion).toMatch(/offeneStempel/);
    expect(sektion).toMatch(/StempelPopoverContent/);
    expect(sektion).toMatch(/presentStempelPopover/);
    // verdient: false ist das, was die Kachel grau macht (KachelRaster).
    expect(sektion).toMatch(/verdient:\s*false/);
  });
});
