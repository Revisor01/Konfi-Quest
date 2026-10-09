// Die Konfi-Zeit einer befoerderten Person bleibt sichtbar (28.09.2026).
//
// Simon: "Loeschen bei Befoerderung ist gewollt damit der Jahrgang spaeter
// weg kann. Wir legen eine persistent kopie der Konfi history fuer den
// Teamer." Die Kopie kommt aus GET /teamer/konfi-zeit (eigene) bzw.
// GET /teamer/:userId/konfi-zeit (Leitung) und steht dort, wo die
// Konfi-Historie heute schon steht: in der Konfi-Historie der Teamer:in und in
// der Detailansicht der Leitung.
// Das Geruest der Personenansicht zuerst: Es registriert die Attrappen
// (Server, Anmeldung, Ionic), die auch die Konfi-Historie der Teamer:in nutzt.
import { zustand, api, oeffne, zuruecksetzen, konfi, KONFI_ID } from '../components/gerueste/leitungKonfiDetail';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { alsKonfiZeit, konfiZeitTerminStatus } from '../../utils/konfiZeit';

describe('konfiZeitTerminStatus', () => {
  it('die verbuchte Anwesenheit geht vor dem Buchungsstatus', () => {
    expect(konfiZeitTerminStatus({ status: 'confirmed', anwesenheit: 'present' })).toBe('Dabei');
    expect(konfiZeitTerminStatus({ status: 'confirmed', anwesenheit: 'absent' })).toBe('Nicht da');
    expect(konfiZeitTerminStatus({ status: 'excused', anwesenheit: 'excused' })).toBe('Abgemeldet');
  });

  it('ohne Anwesenheit sagt der Buchungsstatus, wie es stand', () => {
    expect(konfiZeitTerminStatus({ status: 'opted_out', anwesenheit: null })).toBe('Abgemeldet');
    expect(konfiZeitTerminStatus({ status: 'waitlist', anwesenheit: null })).toBe('Warteliste');
    expect(konfiZeitTerminStatus({ status: 'confirmed', anwesenheit: null })).toBe('Angemeldet');
    expect(konfiZeitTerminStatus({ status: 'confirmed', anwesenheit: null, abgesagt: true })).toBe('Abgesagt');
  });

  it('ein Termin nur mit Punkten (Buchung schon frueher geloescht)', () => {
    expect(konfiZeitTerminStatus({ status: null, anwesenheit: null })).toBe('Punkte erhalten');
  });
});

describe('alsKonfiZeit', () => {
  it('nimmt die Kopie aus der Antwort', () => {
    const kopie = { jahrgang_name: '2023/2024', anlass: 'befoerderung', erstellt_am: null, termine: [] };
    expect(alsKonfiZeit({ konfi_zeit: kopie })).toBe(kopie);
  });

  it('keine Kopie, halbe Antwort oder aelterer Server ergeben null', () => {
    expect(alsKonfiZeit({ konfi_zeit: null })).toBeNull();
    expect(alsKonfiZeit({ konfi_zeit: { termine: 'x' } })).toBeNull();
    expect(alsKonfiZeit({ error: 'Not found' })).toBeNull();
    expect(alsKonfiZeit(null)).toBeNull();
  });
});

// Gerendert: die Konfi-Historie der Teamer:in (TeamerKonfiStatsPage) und die
// Personenansicht der Leitung (KonfiDetailView) mit der Kopie aus dem Server.
const abfragen = vi.hoisted(() => ({
  antworten: new Map<string, unknown>(),
  lader: new Map<string, () => Promise<unknown>>(),
}));
vi.mock('../../hooks/useOfflineQuery', () => ({
  useOfflineQuery: (schluessel: string, lader: () => Promise<unknown>) => {
    const art = schluessel.split(':').slice(0, 2).join(':');
    abfragen.lader.set(art, lader);
    return {
      data: abfragen.antworten.get(art) ?? null,
      loading: false, error: null, isStale: false, isOffline: false,
      refresh: vi.fn(async () => undefined), refreshLive: vi.fn(),
    };
  },
}));
vi.mock('../../contexts/ModalContext', () => ({
  useModalPage: () => ({ pageRef: { current: null }, presentingElement: null }),
}));

import TeamerKonfiStatsPage from '../../components/teamer/pages/TeamerKonfiStatsPage';

const KOPIE = {
  jahrgang_name: '2023/2024', anlass: 'befoerderung', erstellt_am: '2026-09-28T10:00:00Z',
  termine: [
    { event_id: 1, name: 'Konfi-Freizeit', datum: '2024-05-04T10:00:00Z', status: 'confirmed', anwesenheit: 'present', punkte: 2 },
    { event_id: 2, name: 'Jugendgottesdienst', datum: '2024-06-01T10:00:00Z', status: 'opted_out', anwesenheit: null },
  ],
};

const terminZeilen = () =>
  Array.from(document.querySelectorAll('.app-list-item--events .app-list-item__title')).map((t) => t.textContent);

describe('die Kopie steht, wo die Konfi-Historie steht', () => {
  beforeEach(() => {
    zuruecksetzen();
    abfragen.antworten.clear();
    abfragen.lader.clear();
    abfragen.antworten.set('teamer:profile', {
      konfi_data: { gottesdienst_points: 7, gemeinde_points: 4, jahrgang_name: '', badges: [] },
    });
  });

  it('Konfi-Historie der Teamer:in: eigene Route und Terminliste', async () => {
    abfragen.antworten.set('teamer:konfi-zeit', { konfi_zeit: KOPIE });
    render(<TeamerKonfiStatsPage />);
    expect(screen.getByText('Events der Konfi-Zeit (2)')).toBeInTheDocument();
    expect(terminZeilen()).toEqual(['Konfi-Freizeit', 'Jugendgottesdienst']);
    expect(screen.getByText('Dabei')).toBeInTheDocument();
    expect(screen.getByText('Abgemeldet')).toBeInTheDocument();

    // Geholt wird die EIGENE Kopie, nicht die einer anderen Person.
    api.get.mockResolvedValueOnce({ data: { konfi_zeit: KOPIE } });
    await abfragen.lader.get('teamer:konfi-zeit')!();
    expect(api.get).toHaveBeenLastCalledWith('/teamer/konfi-zeit');
  });

  it('Konfi-Historie: ohne Kopie (aelterer Server) faellt nur der Abschnitt weg', () => {
    abfragen.antworten.set('teamer:konfi-zeit', { error: 'Not found' });
    render(<TeamerKonfiStatsPage />);
    expect(screen.queryByText(/Events der Konfi-Zeit/)).toBeNull();
    expect(terminZeilen()).toEqual([]);
  });

  it('Detailansicht der Leitung: Route der Person und dieselbe Terminliste', async () => {
    zustand.antworten.set(`/admin/konfis/${KONFI_ID}`, konfi({ role_name: 'teamer' }));
    zustand.antworten.set(`/teamer/${KONFI_ID}/konfi-zeit`, { konfi_zeit: KOPIE });
    await oeffne();
    await act(async () => { await Promise.resolve(); });
    expect(api.get).toHaveBeenCalledWith(`/teamer/${KONFI_ID}/konfi-zeit`);
    expect(screen.getByText('Events der Konfi-Zeit (2)')).toBeInTheDocument();
    expect(terminZeilen()).toEqual(['Konfi-Freizeit', 'Jugendgottesdienst']);
  });

  it('Detailansicht der Leitung: bei Konfis wird keine Kopie geholt und keine gezeigt', async () => {
    zustand.antworten.set(`/teamer/${KONFI_ID}/konfi-zeit`, { konfi_zeit: KOPIE });
    await oeffne();
    expect(api.get.mock.calls.map((c) => c[0])).not.toContain(`/teamer/${KONFI_ID}/konfi-zeit`);
    expect(screen.queryByText(/Events der Konfi-Zeit/)).toBeNull();
  });
});
