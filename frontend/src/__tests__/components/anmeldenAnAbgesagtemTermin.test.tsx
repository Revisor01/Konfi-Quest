// KEIN ANMELDE-KNOPF AN EINEM ABGESAGTEN TERMIN (16.09.2026) -- gerendert
// (Audit Tests 26.09.2026, BF-02; vorher Quelltext-Test, 30.09.2026
// umgestellt).
//
// Simons Befund, live am Gerät reproduziert:
//   "Ich habe [Termin] Pflicht-Nachruecken abgemeldet. Also als Konfi. Habe
//    mich selbst abgemeldet. Dann wurde das Event abgesagt. 'Wieder anmelden'
//    steht jetzt aber immer noch da, obwohl es abgesagt ist."
//
// Und auf die Rückfrage zur Leitung: "Nein, gar nicht." Auch sie trägt an
// einem abgesagten Termin niemanden mehr ein.
//
// Das Backend lehnt beides ab (tests/routes/anmeldungAnAbgesagtemTermin.test.js).
// Dieser Test hält die andere Hälfte fest: Die Knöpfe dürfen erst gar nicht
// dastehen. Die Konfi-Ansicht wird hier gerendert; die Leitungsansicht
// (kein "hinzufügen" am abgesagten Termin, entfernen bleibt) prüft
// terminRechteGerendert, "Abgesagter Termin (Leitung)".
import { describe, it, expect, beforeEach } from 'vitest';
import { within, fireEvent, act } from '@testing-library/react';
import { zuruecksetzen, termin, inTagen, oeffne, dabeiKarte, knopf, zuletztGeoeffnet } from './gerueste/konfiTerminDetail';
import type { Event } from '../../types/event';

beforeEach(zuruecksetzen);

const ABGESAGT: Partial<Event> = { cancelled: true, registration_status: 'cancelled' };
const ANMELDEN = /^(Anmelden|Wieder anmelden|Warteliste offen)/;

const karte = () => {
  const k = dabeiKarte();
  return {
    hinweis: within(k).queryByText('Dieses Event ist abgesagt'),
    knoepfe: within(k).queryAllByRole('button').map((b) => b.textContent ?? ''),
  };
};

describe('Konfi-Detailansicht: kein Anmelde-Knopf am abgesagten Termin', () => {
  it('Simons Fall: Pflichttermin, selbst abgemeldet, dann abgesagt -- kein "Wieder anmelden"', async () => {
    await oeffne(termin({ ...ABGESAGT, mandatory: true, booking_status: 'opted_out', is_opted_out: true }));
    const { hinweis, knoepfe } = karte();
    expect(hinweis).not.toBeNull();
    expect(knoepfe).toEqual([]);
  });

  it('Pflichttermin, von der Leitung abgemeldet, dann abgesagt -- ebenfalls kein Knopf', async () => {
    await oeffne(termin({ ...ABGESAGT, mandatory: true, booking_status: 'excused' }));
    expect(karte().knoepfe).toEqual([]);
    expect(karte().hinweis).not.toBeNull();
  });

  it('abgesagt schlägt auch "vergangen": der Hinweis sagt "abgesagt", nicht "Pflicht-Event (vergangen)"', async () => {
    const { container } = await oeffne(termin({ ...ABGESAGT, mandatory: true, event_date: inTagen(-2) }));
    expect(karte().hinweis).not.toBeNull();
    expect(container.textContent).not.toContain('Pflicht-Event (vergangen)');
  });

  it('freiwilliger Termin: kein Anmelden und keine Warteliste, auch wenn Plätze frei wären', async () => {
    await oeffne(termin({ ...ABGESAGT, can_register: true }));
    expect(karte().knoepfe.filter((t) => ANMELDEN.test(t))).toEqual([]);
    expect(karte().hinweis).not.toBeNull();
  });

  it('freiwilliger Termin, voll mit offener Warteliste: kein "Warteliste offen"', async () => {
    await oeffne(termin({ ...ABGESAGT, max_participants: 2, registered_count: 2, waitlist_enabled: true, max_waitlist_size: 3 }));
    expect(karte().knoepfe.filter((t) => ANMELDEN.test(t))).toEqual([]);
  });

  it('erkennt die Absage an beiden Feldern: nur registration_status "cancelled" ...', async () => {
    await oeffne(termin({ registration_status: 'cancelled', cancelled: false }));
    expect(karte().hinweis).not.toBeNull();
    expect(karte().knoepfe.filter((t) => ANMELDEN.test(t))).toEqual([]);
  });

  it('... oder nur das Flag cancelled', async () => {
    await oeffne(termin({ cancelled: true, registration_status: 'open' }));
    expect(karte().hinweis).not.toBeNull();
    expect(karte().knoepfe.filter((t) => ANMELDEN.test(t))).toEqual([]);
  });

  it('das ABMELDEN bleibt: wer angemeldet ist, kommt auch vom abgesagten Termin weg', async () => {
    await oeffne(termin({ ...ABGESAGT, is_registered: true, booking_status: 'confirmed' }));
    await act(async () => { fireEvent.click(knopf('Abmelden')!); });
    expect(zuletztGeoeffnet('UnregisterModal')).toBeDefined();
  });

  it('Gegenprobe: am nicht abgesagten Pflichttermin steht nach eigener Abmeldung "Wieder anmelden"', async () => {
    await oeffne(termin({ mandatory: true, booking_status: 'opted_out', is_opted_out: true }));
    expect(karte().knoepfe).toEqual(['Wieder anmelden']);
    expect(karte().hinweis).toBeNull();
  });
});
