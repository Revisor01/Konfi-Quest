// Konfi-Terminansicht: offline und beim Laden -- gerendert (Audit Tests
// 26.09.2026, BF-02, 30.09.2026).
//
// Übernommen aus zwei Quelltext-Tests, die neben der Leitungsansicht auch
// diese Ansicht am Quelltext prüften:
//   - adminEventDetailOffline, "Die Konfi-Ansicht bleibt repariert": Sie
//     teilt den Cache-Schlüssel mit ihrer Liste und fragt Zeitfenster und
//     Teilnehmerliste offline nicht ab (Nutzerhinweis 25.08.2026: "ich sehe
//     die Liste der Events, aber wenn ich in ein Event klicke ist alles 0 und
//     rot").
//   - ladeanzeigeDetailansichten, "die Konfi-Terminansicht bleibt die
//     Vorlage": Beim Laden steht die Ladeanzeige, nicht ein leeres Gerüst.
import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { zustand, zuruecksetzen, termin, oeffne, api, querySchluessel } from './gerueste/konfiTerminDetail';

beforeEach(zuruecksetzen);

describe('Die Konfi-Ansicht offline', () => {
  it('liest ihren Termin aus der Terminliste der Konfi -- derselbe Schlüssel wie die Liste', async () => {
    await oeffne(termin({ has_timeslots: true }));
    expect(new Set(querySchluessel)).toEqual(new Set(['konfi:events:7']));
    expect(screen.getAllByText('Sommerfest').length).toBeGreaterThan(0);
  });

  it('fragt offline weder Zeitfenster noch Teilnehmerliste ab', async () => {
    zustand.online = false;
    await oeffne(termin({ has_timeslots: true }));
    expect(api.get).not.toHaveBeenCalled();
  });

  it('online werden Zeitfenster und Teilnehmerliste nachgeladen', async () => {
    await oeffne(termin({ has_timeslots: true }));
    const pfade = api.get.mock.calls.map((c) => c[0]);
    expect(pfade).toContain('/konfi/events/5/timeslots');
    expect(pfade).toContain('/konfi/events/5/participants');
  });

  it('offline sagt die Ansicht, dass die Teilnehmerliste fehlt', async () => {
    zustand.online = false;
    await oeffne(termin());
    expect(screen.getByText('Die Teilnehmerliste ist offline nicht verfügbar.')).toBeInTheDocument();
  });
});

describe('Die Konfi-Ansicht beim Laden', () => {
  it('zeigt die Ladeanzeige "Event wird geladen..." statt eines leeren Gerüsts', async () => {
    zustand.laedt = true;
    zustand.events = [termin()];
    await oeffne();
    expect(screen.getByTestId('ladeanzeige').textContent).toBe('Event wird geladen...');
    expect(screen.queryByText('Bist du dabei?')).toBeNull();
  });

  it('ist geladen, verschwindet die Ladeanzeige', async () => {
    await oeffne(termin());
    expect(screen.queryByTestId('ladeanzeige')).toBeNull();
    expect(screen.getAllByText('Bist du dabei?').length).toBeGreaterThan(0);
  });
});
