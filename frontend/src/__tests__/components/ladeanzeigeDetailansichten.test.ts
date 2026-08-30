import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Befund 30.08.2026: Beide Leitungs-Detailansichten fuehrten einen
// loading-Zustand mit — gesetzt beim Start des Abrufs, zurueckgesetzt in
// jedem Rueckgabepfad — lasen ihn aber nie. Gerendert wurde deshalb sofort
// das Geruest: in der Terminansicht der Platzhaltertitel "Event Details" mit
// leeren Kacheln, in der Konfi-Ansicht die Ringe auf 0. Das sah aus wie ein
// leerer Termin bzw. ein Konfi ohne Punkte, nicht wie "wird noch geladen".
//
// Die Konfi-Terminansicht (das dritte Geschwister) machte es von Anfang an
// richtig und dient hier als Vorlage.

const lies = (pfad: string) =>
  readFileSync(resolve(process.cwd(), pfad), 'utf8');

const adminEventDetail = lies('src/components/admin/views/EventDetailView.tsx');
const adminKonfiDetail = lies('src/components/admin/views/KonfiDetailView.tsx');
const konfiEventDetail = lies('src/components/konfi/views/EventDetailView.tsx');

describe('Ladeanzeige in den Detailansichten', () => {
  it('die Leitungs-Terminansicht zeigt waehrend des Ladens den Spinner', () => {
    expect(adminEventDetail).toContain('if (loading) {');
    expect(adminEventDetail).toContain('<LoadingSpinner message="Event wird geladen..." />');
  });

  it('die Leitungs-Konfiansicht zeigt waehrend des Ladens den Spinner', () => {
    expect(adminKonfiDetail).toContain('if (loading) {');
    expect(adminKonfiDetail).toContain('<LoadingSpinner');
    expect(adminKonfiDetail).toContain("'Konfi wird geladen...'");
  });

  it('beide Ansichten binden den Spinner auch ein', () => {
    const importZeile = "import LoadingSpinner from '../../common/LoadingSpinner';";
    expect(adminEventDetail).toContain(importZeile);
    expect(adminKonfiDetail).toContain(importZeile);
  });

  it('der Ladezweig steht VOR dem Geruest, sonst greift er nie', () => {
    // Beide Dateien rendern das Geruest mit "return (\n    <IonPage".
    // Der Ladezweig muss davor stehen.
    for (const quelle of [adminEventDetail, adminKonfiDetail]) {
      const ladezweig = quelle.indexOf('if (loading) {');
      const geruest = quelle.lastIndexOf('  return (\n    <IonPage');
      expect(ladezweig).toBeGreaterThan(-1);
      expect(geruest).toBeGreaterThan(ladezweig);
    }
  });

  it('die Konfi-Terminansicht bleibt die Vorlage', () => {
    // Waechter: verschwindet der Spinner dort, ist die Vorlage weg und die
    // drei Ansichten laufen wieder auseinander.
    expect(konfiEventDetail).toContain('<LoadingSpinner message="Event wird geladen..." />');
  });
});
