// Ladeanzeige in der Termin-Detailansicht der Leitung -- gerendert (Audit
// Tests 26.09.2026, BF-02; vorher Quelltext-Test, 30.09.2026 umgestellt).
//
// Befund 30.08.2026: Die Leitungs-Detailansichten führten einen
// loading-Zustand mit, lasen ihn aber nie. Gerendert wurde sofort das
// Gerüst: in der Terminansicht der Platzhaltertitel "Event-Details" mit
// leeren Kacheln. Das sah aus wie ein leerer Termin, nicht wie "wird noch
// geladen".
//
// Die beiden Geschwister prüfen ihre Ladeanzeige ebenfalls gerendert:
// konfiTerminOffline (Konfi-Terminansicht, die Vorlage) und
// adminKonfiDetailOffline (Leitungs-Konfiansicht).
import { describe, it, expect, beforeEach } from 'vitest';
import { screen, act } from '@testing-library/react';
import { zuruecksetzen, termin, oeffne, api, statusText } from './gerueste/leitungTerminDetail';

beforeEach(zuruecksetzen);

describe('Ladeanzeige in der Termin-Detailansicht der Leitung', () => {
  it('solange geladen wird: "Event wird geladen..." und KEIN Gerüst mit Platzhaltern', async () => {
    // Jeder Abruf bleibt offen, bis der Test ihn beantwortet.
    const offen = new Map<string, (wert: unknown) => void>();
    api.get.mockImplementation((pfad: string) => new Promise((resolve) => { offen.set(pfad, resolve); }));
    await oeffne();

    expect(screen.getByTestId('ladeanzeige').textContent).toBe('Event wird geladen...');
    expect(statusText()).toBeNull();
    expect(screen.queryByText('Event absagen')).toBeNull();

    // Die Ansicht lädt Termin und Material, dann ist sie fertig.
    await act(async () => { offen.get('/events/7')!({ data: termin() }); });
    await act(async () => { offen.get('/material/by-event/7')!({ data: [] }); });
    for (let i = 0; i < 3; i += 1) await act(async () => { await Promise.resolve(); });
    expect(screen.queryByText('Event wird geladen...')).toBeNull();
    expect(screen.getByTestId('kopfzeile').getAttribute('data-titel')).toBe('Konfi-Freizeit');
    expect(statusText()).toBe('Offen');
  });

  it('auch ein Fehler beim Laden beendet die Ladeanzeige', async () => {
    api.get.mockRejectedValue(new Error('Netz weg'));
    await oeffne();
    expect(screen.queryByText('Event wird geladen...')).toBeNull();
  });
});
