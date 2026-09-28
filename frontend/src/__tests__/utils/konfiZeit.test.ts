// Die Konfi-Zeit einer befoerderten Person bleibt sichtbar (28.09.2026).
//
// Simon: "Loeschen bei Befoerderung ist gewollt damit der Jahrgang spaeter
// weg kann. Wir legen eine persistent kopie der Konfi history fuer den
// Teamer." Die Kopie kommt aus GET /teamer/konfi-zeit (eigene) bzw.
// GET /teamer/:userId/konfi-zeit (Leitung) und steht dort, wo die
// Konfi-Historie heute schon steht: in der Konfi-Historie der Teamer:in und in
// der Detailansicht der Leitung.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
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

describe('die Kopie steht, wo die Konfi-Historie steht', () => {
  const ohneKommentare = (pfad: string) => readFileSync(resolve(__dirname, '../../', pfad), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

  it('Konfi-Historie der Teamer:in: eigene Route und Terminliste', () => {
    const seite = ohneKommentare('components/teamer/pages/TeamerKonfiStatsPage.tsx');
    expect(seite).toContain("api.get('/teamer/konfi-zeit')");
    expect(seite).toMatch(/<KonfiZeitTermine termine=\{konfiZeit\.termine\} \/>/);
  });

  it('Detailansicht der Leitung: Route der Person und dieselbe Terminliste', () => {
    const detail = ohneKommentare('components/admin/views/KonfiDetailView.tsx');
    expect(detail).toContain('/teamer/${konfiId}/konfi-zeit');
    expect(detail).toMatch(/isTeamer && konfiZeit && \(\s*<KonfiZeitTermine termine=\{konfiZeit\.termine\} \/>/);
  });
});
