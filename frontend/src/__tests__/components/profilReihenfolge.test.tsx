// Reihenfolge der Abschnitte in der Personenansicht der Leitung --
// gerendert (Audit Tests 26.09.2026, BF-02; vorher Quelltext-Test, der die
// Stellen der Kommentare im Quelltext verglich; 30.09.2026 umgestellt).
//
// Simons Reihenfolge für die beiden Profile im Admin (03.09.2026):
//
//   Konfi:  Konfirmation, Rückblick (wenn vorhanden), Bonus, Events,
//           Aktivitäten, Badges, Rolle
//   Teamer: Konfirmation/Konfispruch (sofern übernommen oder eingetragen)
//           samt "Teamer:in seit", Rückblick (wenn vorhanden), Zertifikate,
//           Events, Aktivitäten, Badges
//
// Beide Rollen teilen sich KonfiDetailView; hier werden beide gerendert und
// die Abschnitte in der Reihenfolge gelesen, in der sie auf der Seite stehen.
import { describe, it, expect, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { zustand, zuruecksetzen, konfi, oeffne, KONFI_ID } from './gerueste/leitungKonfiDetail';

beforeEach(zuruecksetzen);

/** Die Marken der Seite in Dokument-Reihenfolge. */
const reihenfolge = (marken: Record<string, () => Element | null>) => {
  const gefunden = Object.entries(marken).map(([name, finde]) => {
    const el = finde();
    if (!el) throw new Error(`Abschnitt fehlt: ${name}`);
    return { name, el };
  });
  return gefunden
    .sort((a, b) => (a.el.compareDocumentPosition(b.el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1))
    .map((g) => g.name);
};
const text = (muster: string | RegExp) => () => screen.queryAllByText(muster)[0] ?? null;
/** Die Überschrift eines Abschnitts (nicht dasselbe Wort an anderer Stelle). */
const kopf = (muster: string | RegExp) => () =>
  [...document.querySelectorAll('section > div > span')].find((s) => (
    typeof muster === 'string' ? s.textContent === muster : muster.test(s.textContent ?? '')
  )) ?? null;

const RUECKBLICK = [{ id: 1, wrapped_type: 'konfi', year: 2026, titel: 'Zwischenstand', data: {} }];

describe('Konfi-Profil: Reihenfolge der Abschnitte', () => {
  it('Konfirmation, Rückblick, Bonus, Events, Aktivitäten, Badges, Rolle', async () => {
    zustand.antworten.set(`/wrapped/history/${KONFI_ID}`, RUECKBLICK);
    await oeffne();
    expect(reihenfolge({
      Konfirmation: kopf('Konfirmation'),
      Rueckblick: text('Zwischenstand'),
      Bonus: kopf(/^Bonus \(/),
      Events: kopf(/^Events \(/),
      Aktivitaeten: kopf(/^Aktivitäten/),
      Badges: () => screen.queryByTestId('abzeichen'),
      Rolle: kopf('Rolle ändern'),
    })).toEqual(['Konfirmation', 'Rueckblick', 'Bonus', 'Events', 'Aktivitaeten', 'Badges', 'Rolle']);
  });

  it('ohne Rückblick fehlt nur dieser Abschnitt, die übrigen stehen wie gehabt', async () => {
    await oeffne();
    expect(screen.queryByText(/Rückblick, den diese/)).toBeNull();
    expect(reihenfolge({
      Konfirmation: kopf('Konfirmation'), Bonus: kopf(/^Bonus \(/), Rolle: kopf('Rolle ändern'),
    })).toEqual(['Konfirmation', 'Bonus', 'Rolle']);
  });
});

const TEAMER = konfi({
  role_name: 'teamer', name: 'Tom Teamer', display_name: 'Tom Teamer',
  konfspruch: 'Seid fröhlich in Hoffnung', confirmation_date: '2024-05-12',
  certificates: [{ id: 1, certificate_type_id: 1, name: 'Juleica', icon: 'ribbon', issued_date: '2026-01-01', expiry_date: null, status: 'aktiv' }],
  konfiHistory: { history: [], totals: { gottesdienst: 3, gemeinde: 2, total: 5 } },
  teamerEvents: [],
});

describe('Teamer-Profil: Reihenfolge der Abschnitte', () => {
  it('Konfirmation, Teamer:in seit, Konfi-Historie, Rückblick, Zertifikate, Events, Aktivitäten, Badges', async () => {
    zustand.antworten.set(`/admin/konfis/${KONFI_ID}`, TEAMER);
    zustand.antworten.set(`/wrapped/history/${KONFI_ID}`, [{ ...RUECKBLICK[0], wrapped_type: 'teamer', titel: 'Team-Jahr' }]);
    await oeffne();
    expect(reihenfolge({
      Konfirmation: kopf('Konfirmation'),
      TeamerSeit: kopf('Teamer:in seit'),
      Historie: kopf(/^Konfi-Historie/),
      Rueckblick: text('Team-Jahr'),
      Zertifikate: kopf('Zertifikate'),
      Events: kopf(/^Events \(/),
      Aktivitaeten: kopf(/^Aktivitäten/),
      Badges: () => screen.queryByTestId('abzeichen'),
    })).toEqual(['Konfirmation', 'TeamerSeit', 'Historie', 'Rueckblick', 'Zertifikate', 'Events', 'Aktivitaeten', 'Badges']);
    expect(screen.getByTestId('abzeichen').getAttribute('data-rolle')).toBe('teamer');
    // Die Rolle ändern gibt es nur bei Konfis.
    expect(screen.queryByText('Rolle ändern')).toBeNull();
  });
});

describe('Konfirmation erscheint auch bei übernommenen Teamer:innen', () => {
  it('mit Spruch oder Termin: die Karte steht da', async () => {
    zustand.antworten.set(`/admin/konfis/${KONFI_ID}`, konfi({ ...TEAMER, confirmation_date: null }));
    await oeffne();
    expect(kopf('Konfirmation')()).not.toBeNull();
  });

  it('ohne Eintrag bleibt die Karte weg, statt leer dazustehen', async () => {
    zustand.antworten.set(`/admin/konfis/${KONFI_ID}`, konfi({ ...TEAMER, konfspruch: null, confirmation_date: null }));
    await oeffne();
    expect(kopf('Konfirmation')()).toBeNull();
    expect(kopf('Teamer:in seit')()).not.toBeNull();
  });
});
