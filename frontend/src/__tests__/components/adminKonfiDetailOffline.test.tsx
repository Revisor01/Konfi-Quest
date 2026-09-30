// Leitungs-Personenansicht ohne Verbindung -- gerendert (Audit Tests
// 26.09.2026, BF-02; vorher Quelltext-Test, 30.09.2026 umgestellt).
//
// Gefunden bei der Offline-Prüfung am 30.08.2026: Die Leitungs-Detailansicht
// einer Person lud ausschließlich über GET /admin/konfis/:id. Ohne
// Verbindung schlug der Abruf fehl und die Seite zeigte nur "Fehler beim
// Laden der Konfi-Daten" -- obwohl die Person in der Liste davor sichtbar
// war, denn AdminKonfisPage hält sie unter admin:konfis:<Gemeinde> im Cache
// (dass die Liste genau dort ablegt, prüft konfiListeTitel gerendert).
//
// DRITTE Ansicht mit demselben Muster. Die beiden anderen prüfen
// adminEventDetailOffline und konfiTerminOffline gerendert.
//
// Dazu die Ladeanzeige dieser Ansicht (bis 30.09.2026 in
// ladeanzeigeDetailansichten am Quelltext geprüft).
import { describe, it, expect, beforeEach } from 'vitest';
import { screen, act } from '@testing-library/react';
import {
  zustand, zuruecksetzen, konfi, oeffne, api, cacheGet, setError, KONFI_ID,
} from './gerueste/leitungKonfiDetail';

beforeEach(zuruecksetzen);

const AUS_DER_LISTE = { id: KONFI_ID, name: 'Emilia Test', display_name: 'Emilia Test', jahrgang_id: 3, jahrgang_name: 'Jahrgang 2026' };

describe('Leitungs-Personenansicht ohne Verbindung', () => {
  beforeEach(() => { zustand.online = false; });

  it('fragt offline die Person gar nicht erst ab', async () => {
    zustand.cache.set('admin:konfis:1', [AUS_DER_LISTE]);
    await oeffne();
    expect(api.get.mock.calls.map((c) => c[0])).not.toContain(`/admin/konfis/${KONFI_ID}`);
  });

  it('zeigt stattdessen den Grundstand aus dem Listen-Cache der Gemeinde', async () => {
    zustand.cache.set('admin:konfis:1', [AUS_DER_LISTE]);
    await oeffne();
    expect(cacheGet).toHaveBeenCalledWith('admin:konfis:1');
    expect(screen.getByTestId('kopfzeile').getAttribute('data-titel')).toBe('Emilia Test');
    expect(setError).not.toHaveBeenCalledWith(expect.stringMatching(/Fehler beim Laden/));
  });

  it('sagt, dass die Punkte-Historie offline fehlt', async () => {
    zustand.cache.set('admin:konfis:1', [AUS_DER_LISTE]);
    await oeffne();
    expect(screen.getByText('Die Aktivitäten- und Punkte-Historie ist offline nicht verfügbar.')).toBeInTheDocument();
  });

  it('meldet ehrlich, wenn die Person nie geladen wurde', async () => {
    zustand.cache.set('admin:konfis:1', [{ ...AUS_DER_LISTE, id: 99 }]);
    await oeffne();
    expect(setError).toHaveBeenCalledWith('Diese Person wurde noch nicht geladen — dafür brauchst du eine Verbindung.');
  });

  it('lädt nach, sobald die Verbindung zurück ist', async () => {
    zustand.cache.set('admin:konfis:1', [AUS_DER_LISTE]);
    zustand.antworten.set(`/admin/konfis/${KONFI_ID}`, konfi({ name: 'Emilia Test (frisch)' }));
    const { rerender, KonfiDetailView, onBack } = await oeffne();
    expect(api.get.mock.calls.map((c) => c[0])).not.toContain(`/admin/konfis/${KONFI_ID}`);

    zustand.online = true;
    rerender(<KonfiDetailView konfiId={KONFI_ID} onBack={onBack} />);
    for (let i = 0; i < 6; i += 1) await act(async () => { await Promise.resolve(); });

    expect(api.get).toHaveBeenCalledWith(`/admin/konfis/${KONFI_ID}`);
    expect(screen.getByTestId('kopfzeile').getAttribute('data-titel')).toBe('Emilia Test (frisch)');
  });
});

describe('Ladeanzeige der Personenansicht', () => {
  it('solange geladen wird: "Konfi wird geladen..." statt Ringen auf 0', async () => {
    let antworten: (wert: unknown) => void = () => undefined;
    api.get.mockImplementation((pfad: string) => (
      pfad === `/admin/konfis/${KONFI_ID}` ? new Promise((resolve) => { antworten = resolve; }) : Promise.resolve({ data: [] })
    ));
    await oeffne();
    expect(screen.getByTestId('ladeanzeige').textContent).toBe('Konfi wird geladen...');
    expect(screen.queryByText(/^Bonus \(/)).toBeNull();

    await act(async () => { antworten({ data: konfi() }); });
    for (let i = 0; i < 6; i += 1) await act(async () => { await Promise.resolve(); });
    expect(screen.queryByText('Konfi wird geladen...')).toBeNull();
    expect(screen.getByText(/^Bonus \(/)).toBeInTheDocument();
  });
});
