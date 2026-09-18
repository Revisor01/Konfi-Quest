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

// Stempel nur fuer laufende oder vergangene Challenges (Befund Simon, 18.09.2026)
//
//   "er zeigt mir, zumindest im admin, challenge stempel an, die noch auf
//    entwurf oder geplant stehen. dass man die erreichen koennte. stempel
//    duerfen nur fuer laufende oder vergangene angezeigt werden. ob erreicht
//    oder nicht."
//
// WARUM NUR IM ADMIN: Die Konfi-Ansicht bekommt ihre Liste aus
// GET /challenges/konfi, und das SQL filtert dort `is_draft = false AND
// starts_at <= NOW()`. Die Leitungs- und Team-Ansicht leitet die Stempel
// dagegen im Frontend aus GET /challenges/admin ab -- und das liefert
// absichtlich JEDE Challenge, damit sich Entwuerfe bearbeiten lassen. Die
// Ableitung hatte die Rechnung uebernommen, aber nicht die Vorbedingung.
//
// Geprueft wird die Regel selbst, mit fester Zeit statt Date.now().
import { gehoertInsStempelraster } from '../../components/shared/ChallengesPage';

describe('Stempelraster zeigt nur laufende und vergangene Challenges', () => {
  // Fester Bezugspunkt: 18.09.2026, 12:00.
  const JETZT = new Date(2026, 8, 18, 12, 0).getTime();
  const tage = (n: number) => new Date(JETZT + n * 24 * 60 * 60 * 1000).toISOString();

  const challenge = (ueber: Record<string, unknown>) =>
    ({ is_draft: false, starts_at: tage(-7), ends_at: tage(7), ...ueber }) as never;

  it('VERBOTEN: ein Entwurf gehoert nicht ins Raster', () => {
    expect(gehoertInsStempelraster(challenge({ is_draft: true }), JETZT)).toBe(false);
  });

  it('VERBOTEN: eine geplante Challenge, die erst naechste Woche beginnt', () => {
    expect(gehoertInsStempelraster(
      challenge({ starts_at: tage(7), ends_at: tage(14) }), JETZT
    )).toBe(false);
  });

  it('VERBOTEN: ein Entwurf bleibt es auch, wenn sein Zeitraum laeuft', () => {
    // is_draft schlaegt das Datum -- so rechnet auch deriveStatus im Backend.
    expect(gehoertInsStempelraster(
      challenge({ is_draft: true, starts_at: tage(-1), ends_at: tage(1) }), JETZT
    )).toBe(false);
  });

  it('ERLAUBT: eine laufende Challenge', () => {
    expect(gehoertInsStempelraster(challenge({}), JETZT)).toBe(true);
  });

  it('ERLAUBT: eine vergangene Challenge', () => {
    // Auch abgelaufene Stempel bleiben sichtbar -- "ob erreicht oder nicht".
    expect(gehoertInsStempelraster(
      challenge({ starts_at: tage(-30), ends_at: tage(-14) }), JETZT
    )).toBe(true);
  });

  it('ERLAUBT: eine Challenge, die gerade eben begonnen hat', () => {
    expect(gehoertInsStempelraster(
      challenge({ starts_at: new Date(JETZT - 1000).toISOString() }), JETZT
    )).toBe(true);
  });

  it('die Regel gilt fuer ERHALTENE Stempel genauso wie fuer offene', () => {
    // Beide Ableitungen in ChallengesPage muessen sie anwenden. Sonst
    // verschwaende ein Entwurf zwar aus der grauen Reihe, ein
    // versehentlich schon vergebener Stempel bliebe aber farbig stehen.
    const quelle = readFileSync(
      resolve(process.cwd(), 'src/components/shared/ChallengesPage.tsx'),
      'utf8'
    ).replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    expect(quelle).toMatch(/c\.has_badge && gehoertInsStempelraster\(c\)/);
    expect(quelle).toMatch(/!c\.has_badge && !!c\.badge_name && gehoertInsStempelraster\(c\)/);
  });
});
