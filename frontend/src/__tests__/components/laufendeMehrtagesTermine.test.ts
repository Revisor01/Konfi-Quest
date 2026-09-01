import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { istVergangen, eventEnde } from '../../components/shared/eventFormatting';

// Befund H5 (Zeitzonen-Pruefung 01.09.2026): Laufende mehrtaegige Termine
// verschwanden aus der Konfi-Liste.
//
// Die Zaehler und der Listenfilter in konfi/views/EventsView.tsx rechneten
// ueber `new Date(e.event_date) >= new Date()`, also allein ueber den START.
// Am 12. einer Freizeit vom 10.-14. sagte das Abzeichen der Kachel "laeuft"
// und die Kachel "Vergangen" zaehlte sie mit -- im Reiter "Alle" war die
// laufende Freizeit aber gar nicht mehr zu finden. Ausgerechnet die
// Veranstaltung, an der man gerade teilnimmt, war nicht auffindbar.
//
// Bitter daran: `istVergangen` war in derselben Datei bereits importiert und
// acht Zeilen weiter fuer die Abzeichen in Gebrauch. Der Fehler war ein
// Rueckfall in einen Bug, der am 27.08.2026 schon einmal behoben worden war
// (Befund N6, dokumentiert in eventFormatting.ts).

const lies = (pfad: string) => readFileSync(resolve(process.cwd(), pfad), 'utf8');

// Die Freizeit aus dem Befund: 10.-14., betrachtet am 12.
const freizeit = {
  event_date: '2026-08-10T09:00:00+02:00',
  event_end_time: '2026-08-14T16:00:00+02:00'
};
const amZwoelften = new Date('2026-08-12T12:00:00+02:00');

describe('Laufende Mehrtagestermine gelten nicht als vergangen', () => {
  it('zaehlt eine Freizeit am mittleren Tag NICHT als vergangen', () => {
    expect(istVergangen(freizeit, amZwoelften)).toBe(false);
  });

  it('haelt sie am letzten Tag vor dem Ende noch fuer laufend', () => {
    expect(istVergangen(freizeit, new Date('2026-08-14T15:59:00+02:00'))).toBe(false);
  });

  it('erklaert sie erst nach dem Ende fuer vergangen', () => {
    expect(istVergangen(freizeit, new Date('2026-08-14T16:01:00+02:00'))).toBe(true);
  });

  it('zaehlt sie am Tag davor ebenfalls nicht als vergangen', () => {
    expect(istVergangen(freizeit, new Date('2026-08-09T12:00:00+02:00'))).toBe(false);
  });

  it('nimmt bei mehrtaegigen Terminen das Ende als Stichzeit', () => {
    expect(eventEnde(freizeit).toISOString()).toBe('2026-08-14T14:00:00.000Z');
  });

  it('nimmt bei eintaegigen Terminen den Start als Stichzeit', () => {
    const eintaegig = { event_date: '2026-08-10T09:00:00+02:00', event_end_time: null };
    expect(eventEnde(eintaegig).toISOString()).toBe('2026-08-10T07:00:00.000Z');
    expect(istVergangen(eintaegig, amZwoelften)).toBe(true);
  });

  it('rechnet ueber die Sommerzeitumstellung am 25.10.2026 richtig', () => {
    // Ein Termin, der ueber die Rueckstellung laeuft: Start 24.10. (MESZ,
    // UTC+2), Ende 26.10. (MEZ, UTC+1). Am 25.10. mitten in der Doppelstunde
    // betrachtet muss er laufen -- eine feste Verschiebung um 24 Stunden je
    // Tag traefe hier daneben.
    const ueberDieUmstellung = {
      event_date: '2026-10-24T18:00:00+02:00',
      event_end_time: '2026-10-26T12:00:00+01:00'
    };
    expect(istVergangen(ueberDieUmstellung, new Date('2026-10-25T02:30:00+01:00'))).toBe(false);
    expect(istVergangen(ueberDieUmstellung, new Date('2026-10-26T11:00:00+01:00'))).toBe(false);
    expect(istVergangen(ueberDieUmstellung, new Date('2026-10-26T13:00:00+01:00'))).toBe(true);
  });
});

describe('Die Konfi-Ansichten rechnen ueber istVergangen, nicht ueber event_date', () => {
  const dateien = {
    'konfi/views/EventsView.tsx': lies('src/components/konfi/views/EventsView.tsx'),
    'konfi/pages/KonfiDashboardPage.tsx': lies('src/components/konfi/pages/KonfiDashboardPage.tsx'),
    'konfi/views/DashboardView.tsx': lies('src/components/konfi/views/DashboardView.tsx'),
  };

  // Genau das Muster, das den Fehler ausmachte: ein Vergleich von event_date
  // gegen die aktuelle Zeit, ohne event_end_time zu beachten.
  const inlineRechnung = /new Date\(\s*e(?:vent)?\.event_date[^)]*\)\s*[<>]=?\s*new Date\(\)/;

  for (const [name, inhalt] of Object.entries(dateien)) {
    it(`${name} vergleicht event_date nicht direkt gegen new Date()`, () => {
      expect(inlineRechnung.test(inhalt)).toBe(false);
    });

    it(`${name} benutzt istVergangen`, () => {
      expect(inhalt.includes('istVergangen')).toBe(true);
    });
  }
});
