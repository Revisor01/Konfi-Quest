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

describe('online: kein Offline-Platzhalter bei echter Leere (offlinePlatzhalter)', () => {
  it('eine Konfi ohne Aktivitäten zeigt online keinen Platzhalter', async () => {
    zustand.antworten.set(`/admin/konfis/${KONFI_ID}`, konfi({ activities: [] }));
    await oeffne();
    expect(screen.queryByText('Die Aktivitäten- und Punkte-Historie ist offline nicht verfügbar.')).toBeNull();
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

// Besuchte Detailseiten bewahren ihre Antwort auf (09.10.2026, Simon:
// „Details aus Cache ist gut."): War die Person schon einmal mit Netz offen,
// geht sie ohne Netz so auf wie zuletzt -- mit Historie, ohne Anfrage.
describe('ohne Verbindung nach einem Besuch mit Netz', () => {
  const MIT_HISTORIE = konfi({
    name: 'Emilia Test',
    activities: [{ id: 1, name: 'Kirchenputz', points: 2, type: 'gemeinde', date: '2026-09-01', admin: 'Pastor' }],
  });
  const PLATZHALTER = 'Die Aktivitäten- und Punkte-Historie ist offline nicht verfügbar.';

  /** Das Merken laeuft im Hintergrund -- bis es durch ist. */
  const nachlaufen = async () => {
    for (let i = 0; i < 10; i += 1) await act(async () => { await Promise.resolve(); });
  };

  const einmalMitNetzOeffnen = async (antwort: unknown = MIT_HISTORIE) => {
    zustand.antworten.set(`/admin/konfis/${KONFI_ID}`, antwort);
    const r = await oeffne();
    await nachlaufen();
    r.unmount();
    api.get.mockClear();
  };

  it('merkt die Antwort unter Gemeinde und Person', async () => {
    await einmalMitNetzOeffnen();
    const stand = zustand.cache.get('admin:person-detail:1:9') as { konfi: { name: string } } | undefined;
    expect(stand?.konfi.name).toBe('Emilia Test');
  });

  it('zeigt offline die Historie aus dem gemerkten Stand, ohne Platzhalter und ohne Anfrage', async () => {
    await einmalMitNetzOeffnen();
    zustand.online = false;
    await oeffne();
    // Keine der Detail-Routen (Rückblicke und Jahrgänge fragt die Seite seit
    // jeher unabhängig vom Netz und liest sie nicht aus dem Stand).
    const pfade = api.get.mock.calls.map((c) => c[0]);
    for (const pfad of [`/admin/konfis/${KONFI_ID}`, '/admin/activities/requests', `/admin/konfis/${KONFI_ID}/event-points`, `/admin/konfis/${KONFI_ID}/attendance-stats`]) {
      expect(pfade).not.toContain(pfad);
    }
    expect(pfade.filter((p) => !['/admin/jahrgaenge', `/wrapped/history/${KONFI_ID}`].includes(p))).toEqual([]);
    expect(screen.getByText('Kirchenputz')).toBeInTheDocument();
    expect(screen.queryByText(PLATZHALTER)).toBeNull();
    expect(setError).not.toHaveBeenCalledWith('Diese Person wurde noch nicht geladen — dafür brauchst du eine Verbindung.');
  });

  it('auch eine gemerkte LEERE Historie ist bekannt: kein Platzhalter', async () => {
    await einmalMitNetzOeffnen(konfi({ activities: [] }));
    zustand.online = false;
    await oeffne();
    expect(screen.queryByText(PLATZHALTER)).toBeNull();
  });

  it('ohne gemerkten Stand bleibt es beim Grundstand aus der Liste samt Platzhalter', async () => {
    zustand.online = false;
    zustand.cache.set('admin:konfis:1', [AUS_DER_LISTE]);
    await oeffne();
    expect(screen.getByText(PLATZHALTER)).toBeInTheDocument();
  });

  it('der Stand einer anderen Gemeinde gilt nicht (Schlüssel je Gemeinde)', async () => {
    zustand.cache.set('admin:person-detail:2:9', {
      konfi: MIT_HISTORIE, antraege: [], bewahrteStempel: [], konfiZeit: null,
      certificateTypes: null, eventPoints: [], attendanceStats: null,
    });
    zustand.cache.set('admin:konfis:1', [AUS_DER_LISTE]);
    zustand.online = false;
    await oeffne();
    expect(screen.queryByText('Kirchenputz')).toBeNull();
    expect(screen.getByText(PLATZHALTER)).toBeInTheDocument();
  });

  it('sagt der Server 403, ist der gemerkte Stand weg', async () => {
    await einmalMitNetzOeffnen();
    zustand.antworten.set(`/admin/konfis/${KONFI_ID}`, Object.assign(new Error('403'), { response: { status: 403 } }));
    await oeffne();
    await nachlaufen();
    expect(zustand.cache.has('admin:person-detail:1:9')).toBe(false);
  });

  it('Aktionen bleiben offline gesperrt, auch mit gemerktem Stand', async () => {
    await einmalMitNetzOeffnen();
    zustand.online = false;
    await oeffne();
    expect(screen.getByRole('button', { name: 'Passwort zurücksetzen' })).toBeDisabled();
  });
});
