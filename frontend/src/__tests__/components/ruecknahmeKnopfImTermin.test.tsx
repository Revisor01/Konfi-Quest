// Der Knopf ganz unten im Termin (Simon, 16.09.2026) -- gerendert (Audit
// Tests 26.09.2026, BF-02; vorher Quelltext-Test, 30.09.2026 umgestellt).
//
// Simons Wunsch, wörtlich: "Ganz unten bei einem Event haben wir als Admin
// immer den Button 'Event absagen'. Könnten wir diesen Button genau so bauen,
// ganz unten bei einem Event mit 'Event wieder findet doch statt' oder so,
// sodass man da unten auf den Button hat, sodass wir da eine Symmetrie
// haben?"
//
// Entschieden: am aktiven Termin "Event absagen", am abgesagten stattdessen
// "Absage zurücknehmen". Der Wisch in der Terminliste bleibt zusätzlich
// bestehen und führt in DIESELBE Rückfrage (terminListeRechteGerendert).
// Die Team-Ansicht hat keinen von beiden Knöpfen (teamerTerminAbsagen).
import { describe, it, expect, beforeEach } from 'vitest';
import { fireEvent, act } from '@testing-library/react';
import {
  zustand, zuruecksetzen, termin, oeffne, knopf, api, setSuccess, zuletztGeoeffnet, presentAlert, letzteRueckfrage, knopfIn,
} from './gerueste/leitungTerminDetail';

beforeEach(zuruecksetzen);

const ABGESAGT = { registration_status: 'cancelled', cancelled: true, cancelled_reason: 'Sturm' };
const aussehen = (k: HTMLElement) => ({ farbe: k.getAttribute('data-color'), fill: k.getAttribute('data-fill'), gesperrt: (k as HTMLButtonElement).disabled });

describe('am AKTIVEN Termin steht unten "Event absagen"', () => {
  it('der Absage-Knopf ist da, rot und als Outline -- die Rücknahme steht nicht daneben', async () => {
    await oeffne();
    expect(aussehen(knopf('Event absagen')!)).toEqual({ farbe: 'danger', fill: 'outline', gesperrt: false });
    expect(knopf('Absage zurücknehmen')).toBeNull();
  });

  it('er öffnet den Absage-Dialog der Leitung', async () => {
    await oeffne();
    await act(async () => { fireEvent.click(knopf('Event absagen')!); });
    expect(zuletztGeoeffnet('TerminAbsagenModal')).toBeDefined();
  });
});

describe('am ABGESAGTEN Termin steht unten die Rücknahme', () => {
  it('der Knopf heißt "Absage zurücknehmen", ist grün und sieht aus wie der Absage-Knopf', async () => {
    zustand.detail = termin(ABGESAGT);
    await oeffne();
    expect(aussehen(knopf('Absage zurücknehmen')!)).toEqual({ farbe: 'success', fill: 'outline', gesperrt: false });
    expect(knopf('Event absagen')).toBeNull();
  });

  it('er stellt die gemeinsame Rückfrage mit der Zahl der Leute, die zurückkommen', async () => {
    zustand.detail = termin({ ...ABGESAGT, durch_absage_abgemeldet_count: 3 });
    await oeffne();
    await act(async () => { fireEvent.click(knopf('Absage zurücknehmen')!); });
    const frage = letzteRueckfrage();
    expect(frage.header).toBe('Absage zurücknehmen?');
    expect(frage.message).toContain('3 Personen werden wieder angemeldet und bekommen eine Mitteilung.');
    expect(api.put).not.toHaveBeenCalled();
  });

  it('bei genau einer Person in der Einzahl, ohne Zahl mit dem Hinweis, dass keine Mitteilung rausgeht', async () => {
    zustand.detail = termin({ ...ABGESAGT, durch_absage_abgemeldet_count: 1 });
    const erste = await oeffne();
    await act(async () => { fireEvent.click(knopf('Absage zurücknehmen')!); });
    expect(letzteRueckfrage().message).toContain('1 Person wird wieder angemeldet und bekommt eine Mitteilung.');
    erste.unmount();

    zuruecksetzen();
    zustand.detail = termin(ABGESAGT);
    await oeffne();
    await act(async () => { fireEvent.click(knopf('Absage zurücknehmen')!); });
    expect(letzteRueckfrage().message).toContain('Es ist niemand wieder anzumelden, also geht auch keine Mitteilung raus.');
  });

  it('"Zurücknehmen" ruft /reaktivieren, meldet Erfolg und lädt den Termin neu', async () => {
    zustand.detail = termin({ ...ABGESAGT, durch_absage_abgemeldet_count: 2 });
    await oeffne();
    const vorher = api.get.mock.calls.filter((c) => c[0] === '/events/7').length;
    await act(async () => { fireEvent.click(knopf('Absage zurücknehmen')!); });
    await act(async () => { await knopfIn(letzteRueckfrage(), 'Zurücknehmen')!.handler!(); });
    expect(api.put).toHaveBeenCalledWith('/events/7/reaktivieren');
    expect(setSuccess).toHaveBeenCalledWith('"Konfi-Freizeit" findet wieder statt');
    expect(api.get.mock.calls.filter((c) => c[0] === '/events/7').length).toBe(vorher + 1);
  });
});

describe('offline geht gar nichts los', () => {
  beforeEach(() => { zustand.online = false; });

  it('am aktiven Termin: gesperrt, "Du bist offline"', async () => {
    zustand.cache.set('admin:events:1', [termin()]);
    await oeffne();
    const k = knopf('Du bist offline')!;
    expect(aussehen(k)).toEqual({ farbe: 'danger', fill: 'outline', gesperrt: true });
    await act(async () => { fireEvent.click(k); });
    expect(zuletztGeoeffnet('TerminAbsagenModal')).toBeUndefined();
  });

  it('am abgesagten Termin: gesperrt, keine Rückfrage', async () => {
    zustand.cache.set('admin:events:1', [termin(ABGESAGT)]);
    await oeffne();
    const k = knopf('Du bist offline')!;
    expect(aussehen(k)).toEqual({ farbe: 'success', fill: 'outline', gesperrt: true });
    await act(async () => { fireEvent.click(k); });
    expect(presentAlert).not.toHaveBeenCalled();
  });
});

describe('Teamer:innen in der Leitungsansicht', () => {
  it('sehen weder "Event absagen" noch "Absage zurücknehmen"', async () => {
    zustand.rolle = 'teamer';
    const erste = await oeffne();
    expect(knopf('Event absagen')).toBeNull();
    erste.unmount();
    zustand.detail = termin(ABGESAGT);
    await oeffne();
    expect(knopf('Absage zurücknehmen')).toBeNull();
  });
});
