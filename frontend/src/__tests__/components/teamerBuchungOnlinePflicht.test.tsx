// Befund H2 (Offline-Bericht 27.08.2026): Die Teamer-Buchung braucht eine
// Verbindung -- gerendert (Audit Tests 26.09.2026, BF-02; vorher
// Quelltext-Test, 30.09.2026 umgestellt).
//
// Die Teamer-Buchung legte sich offline in die Warteschlange und verwarf die
// Server-Antwort. Genau darin steckt aber, ob der Platz sicher ist oder nur
// die Warteliste -- der Online-Zweig liest `status === 'waitlist'` aus und
// sagt es. Nachgereicht erfuhr das niemand.
//
// Die Konfi-Anmeldung löst das seit jeher über einen offline deaktivierten
// Knopf. Die Teamer-Seite macht es genauso. Die ABSAGE darf offline in die
// Warteschlange -- dort gibt es keinen Platz zu verlieren. Beide Richtungen
// laufen über POST /teamer/events/:id/zusage, nie über /events/:id/book.
import { describe, it, expect, beforeEach } from 'vitest';
import { fireEvent, act } from '@testing-library/react';
import {
  zustand, zuruecksetzen, termin, oeffneTermin, knopf, zuletztGeoeffnet, api, enqueue, setSuccess,
} from './gerueste/teamerTerminSeite';

beforeEach(zuruecksetzen);

const alleAufrufe = () => [
  ...api.post.mock.calls.map((c) => `POST ${c[0]}`),
  ...api.delete.mock.calls.map((c) => `DELETE ${c[0]}`),
  ...enqueue.mock.calls.map((c) => `${(c[0] as { method: string }).method} ${(c[0] as { url: string }).url} (Warteschlange)`),
];

describe('H2: Die Teamer-Buchung braucht eine Verbindung', () => {
  it('offline ist der Zusage-Knopf gesperrt und sagt, warum', async () => {
    zustand.online = false;
    zustand.events = [termin()];
    await oeffneTermin();
    const zusage = knopf('Du bist offline') as HTMLButtonElement;
    expect(zusage.disabled).toBe(true);
    expect(knopf('Dabei')).toBeNull();
  });

  it('legt die Buchung NICHT in die Warteschlange: Tippen auf den gesperrten Knopf sendet nichts', async () => {
    zustand.online = false;
    zustand.events = [termin()];
    await oeffneTermin();
    await act(async () => { fireEvent.click(knopf('Du bist offline')!); });
    expect(enqueue).not.toHaveBeenCalled();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('die Absage bleibt offline möglich und geht über die Zusage-Route in die Warteschlange', async () => {
    zustand.online = false;
    zustand.events = [termin({ is_registered: true, booking_status: 'confirmed' })];
    await oeffneTermin();
    const absage = knopf('Nicht mehr dabei') as HTMLButtonElement;
    expect(absage.disabled).toBe(false);
    await act(async () => { fireEvent.click(absage); });
    await act(async () => { (zuletztGeoeffnet('TeamerAbsageModal')!.props.onAbsage as (g: string) => void)('Krank'); });
    expect(alleAufrufe()).toEqual(['POST /teamer/events/77/zusage (Warteschlange)']);
    expect(setSuccess).toHaveBeenCalledWith('Wird gesendet, sobald du wieder online bist');
  });

  it('online: Zusage und Absage laufen über die Zusage-Route, nie über /events/:id/book', async () => {
    zustand.events = [termin()];
    await oeffneTermin();
    await act(async () => { fireEvent.click(knopf('Dabei')!); });
    await act(async () => { fireEvent.click(knopf('Nicht dabei')!); });
    await act(async () => { (zuletztGeoeffnet('TeamerAbsageModal')!.props.onAbsage as (g: string) => void)(''); });
    expect(alleAufrufe()).toEqual(['POST /teamer/events/77/zusage', 'POST /teamer/events/77/zusage']);
    expect(api.post.mock.calls.map((c) => c[1])).toEqual([{ dabei: true }, { dabei: false }]);
  });

  it('die Wartelisten-Rückmeldung im Online-Zweig bleibt erhalten', async () => {
    zustand.events = [termin()];
    zustand.zusageAntwort = { status: 'waitlist' };
    await oeffneTermin();
    await act(async () => { fireEvent.click(knopf('Dabei')!); });
    expect(setSuccess).toHaveBeenCalledWith('Du stehst auf der Warteliste. Wird ein Platz frei, rückst du automatisch nach.');
  });

  it('ein bestätigter Platz wird als solcher gemeldet, nicht als Warteliste', async () => {
    zustand.events = [termin()];
    await oeffneTermin();
    await act(async () => { fireEvent.click(knopf('Dabei')!); });
    expect(setSuccess).toHaveBeenCalledWith('Du bist dabei');
  });
});
