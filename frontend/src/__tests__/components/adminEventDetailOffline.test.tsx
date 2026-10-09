// Leitungs-Terminansicht ohne Verbindung -- gerendert (Audit Tests
// 26.09.2026, BF-02; vorher Quelltext-Test, 30.09.2026 umgestellt).
//
// Nutzerhinweis 29.08.2026: "das event ist rot hat nichtmal einen titel,
// zumindest beim admin". Die Leitungs-Detailansicht lud ausschließlich über
// GET /events/:id. Ohne Verbindung schlug der Abruf fehl, eventData blieb
// null und die Seite zeigte nur "Fehler beim Laden der Event-Daten" -- obwohl
// der Termin in der Liste davor sichtbar war, denn die Liste hält ihn im
// Cache (admin:events:<Gemeinde>).
//
// Dieselbe Klasse Fehler war in der KONFI-Ansicht am 25.08.2026 behoben
// worden. Deren Offline-Verhalten (derselbe Schlüssel wie ihre Liste, keine
// Abrufe ohne Netz) prüft konfiTerminOffline gerendert. Dass die LISTE der
// Leitung unter demselben Schlüssel speichert, prüft terminListeRechteGerendert.
import { describe, it, expect, beforeEach } from 'vitest';
import { screen, act } from '@testing-library/react';
import {
  zustand, zuruecksetzen, termin, teilnahme, oeffne, api, cacheGet, setError, statusText,
} from './gerueste/leitungTerminDetail';

beforeEach(zuruecksetzen);

const AUS_DER_LISTE = termin({ name: 'Gemeindefest', participants: undefined, registration_status: 'open' });

describe('Leitungs-Terminansicht ohne Verbindung', () => {
  beforeEach(() => { zustand.online = false; });

  it('fragt offline gar nicht erst ab', async () => {
    zustand.cache.set('admin:events:1', [AUS_DER_LISTE]);
    await oeffne();
    expect(api.get).not.toHaveBeenCalled();
  });

  it('zeigt stattdessen den Grundstand aus dem Listen-Cache der Gemeinde: Titel und Status', async () => {
    zustand.cache.set('admin:events:1', [AUS_DER_LISTE]);
    await oeffne();
    expect(cacheGet).toHaveBeenCalledWith('admin:events:1');
    expect(screen.getByTestId('kopfzeile').getAttribute('data-titel')).toBe('Gemeindefest');
    expect(statusText()).toBe('Offen');
    expect(setError).not.toHaveBeenCalledWith(expect.stringMatching(/Fehler beim Laden/), expect.anything());
  });

  it('sagt, dass die Teilnehmerliste offline fehlt, statt eine leere Liste zu zeigen', async () => {
    zustand.cache.set('admin:events:1', [AUS_DER_LISTE]);
    await oeffne();
    expect(screen.getByText('Die Teilnehmerliste ist offline nicht verfügbar.')).toBeInTheDocument();
  });

  it('meldet ehrlich, wenn der Termin nie geladen wurde', async () => {
    zustand.cache.set('admin:events:1', [termin({ id: 8 })]);
    await oeffne(7);
    expect(setError).toHaveBeenCalledWith('Dieses Event wurde noch nicht geladen — dafür brauchst du eine Verbindung.');
  });

  it('... auch ohne jeden Cache', async () => {
    await oeffne(7);
    expect(setError).toHaveBeenCalledWith('Dieses Event wurde noch nicht geladen — dafür brauchst du eine Verbindung.');
  });

  it('lädt nach, sobald die Verbindung zurück ist: dann mit Teilnehmerliste', async () => {
    zustand.cache.set('admin:events:1', [AUS_DER_LISTE]);
    zustand.detail = termin({ name: 'Gemeindefest', participants: [teilnahme(1, 'Kim Konfi')] });
    const { rerender, onBack } = await oeffne();
    expect(screen.queryByText('Kim Konfi')).toBeNull();

    zustand.online = true;
    const EventDetailView = (await import('../../components/admin/views/EventDetailView')).default;
    rerender(<EventDetailView eventId={7} onBack={onBack} />);
    for (let i = 0; i < 4; i += 1) await act(async () => { await Promise.resolve(); });

    expect(api.get).toHaveBeenCalledWith('/events/7');
    expect(screen.getByText('Kim Konfi')).toBeInTheDocument();
    expect(screen.queryByText('Die Teilnehmerliste ist offline nicht verfügbar.')).toBeNull();
  });
});

describe('online: der volle Stand vom Server', () => {
  it('online und wirklich ohne Teilnehmende: kein Offline-Platzhalter (offlinePlatzhalter)', async () => {
    zustand.detail = termin({ participants: [] });
    await oeffne();
    expect(screen.queryByText('Die Teilnehmerliste ist offline nicht verfügbar.')).toBeNull();
  });

  it('holt den Termin über GET /events/:id und liest keinen gespeicherten Stand', async () => {
    await oeffne();
    expect(api.get).toHaveBeenCalledWith('/events/7');
    // Gelesen wird online höchstens das Verzeichnis der gemerkten
    // Detailseiten (beim Merken) -- weder die Liste noch der Termin selbst.
    expect(cacheGet).not.toHaveBeenCalledWith('admin:events:1');
    expect(cacheGet).not.toHaveBeenCalledWith('admin:termin-detail:1:7');
    expect(screen.getByText('Kim Konfi')).toBeInTheDocument();
  });
});

// Besuchte Detailseiten bewahren ihre Antwort auf (09.10.2026, Simon:
// „Details aus Cache ist gut."): War der Termin schon einmal mit Netz offen,
// geht er ohne Netz so auf wie zuletzt -- mit Teilnehmerliste und Material.
describe('ohne Verbindung nach einem Besuch mit Netz', () => {
  const PLATZHALTER = 'Die Teilnehmerliste ist offline nicht verfügbar.';
  const nachlaufen = async () => {
    for (let i = 0; i < 10; i += 1) await act(async () => { await Promise.resolve(); });
  };
  const einmalMitNetzOeffnen = async () => {
    const r = await oeffne();
    await nachlaufen();
    r.unmount();
    api.get.mockClear();
    cacheGet.mockClear();
  };

  it('merkt online genau die Antworten, die es ohnehin gibt: GET /events/7 und das Material, je einmal', async () => {
    await oeffne();
    await nachlaufen();
    const pfade = api.get.mock.calls.map((c) => c[0]);
    expect(pfade.filter((p) => p === '/events/7')).toHaveLength(1);
    expect(pfade.filter((p) => p === '/material/by-event/7')).toHaveLength(1);
    const stand = zustand.cache.get('admin:termin-detail:1:7') as { termin: { name: string }; material: unknown[] };
    expect(stand.termin.name).toBe('Konfi-Freizeit');
    expect(stand.material).toEqual([]);
  });

  it('zeigt offline die Teilnehmerliste aus dem gemerkten Stand -- ohne Anfrage, ohne Platzhalter', async () => {
    await einmalMitNetzOeffnen();
    zustand.online = false;
    await oeffne();
    expect(api.get).not.toHaveBeenCalled();
    expect(screen.getByText('Kim Konfi')).toBeInTheDocument();
    expect(screen.queryByText(PLATZHALTER)).toBeNull();
    expect(screen.getByTestId('kopfzeile').getAttribute('data-titel')).toBe('Konfi-Freizeit');
  });

  it('eine gemerkte LEERE Teilnehmerliste ist bekannt: kein Platzhalter', async () => {
    zustand.detail = termin({ participants: [] });
    await einmalMitNetzOeffnen();
    zustand.online = false;
    await oeffne();
    expect(screen.queryByText(PLATZHALTER)).toBeNull();
  });

  it('ohne gemerkten Stand: Grundstand aus der Liste und Platzhalter', async () => {
    zustand.online = false;
    zustand.cache.set('admin:events:1', [AUS_DER_LISTE]);
    await oeffne();
    expect(screen.getByText(PLATZHALTER)).toBeInTheDocument();
    expect(screen.queryByText('Kim Konfi')).toBeNull();
  });

  it('der gemerkte Stand eines anderen Termins gilt nicht', async () => {
    await einmalMitNetzOeffnen();
    zustand.online = false;
    zustand.cache.set('admin:events:1', [termin({ id: 8, name: 'Anderer Termin', participants: undefined })]);
    await oeffne(8);
    expect(screen.queryByText('Kim Konfi')).toBeNull();
    expect(screen.getByText(PLATZHALTER)).toBeInTheDocument();
  });

  it('sagt der Server 403 (Jahrgang nicht zugewiesen), ist der gemerkte Stand weg', async () => {
    await einmalMitNetzOeffnen();
    api.get.mockImplementation(() => Promise.reject(Object.assign(new Error('403'), {
      response: { status: 403, data: { error_code: 'jahrgang_nicht_zugewiesen' } },
    })));
    await oeffne();
    await nachlaufen();
    expect(zustand.cache.has('admin:termin-detail:1:7')).toBe(false);
  });
});
