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
  it('holt den Termin über GET /events/:id und fragt den Cache nicht', async () => {
    await oeffne();
    expect(api.get).toHaveBeenCalledWith('/events/7');
    expect(cacheGet).not.toHaveBeenCalled();
    expect(screen.getByText('Kim Konfi')).toBeInTheDocument();
  });
});
