// Abmelden geht offline, Anmelden nicht -- gerendert (Audit Tests
// 26.09.2026, BF-02; vorher Quelltext-Test, 30.09.2026 umgestellt).
//
// Simons Einwand vom 30.08.2026: "wie soll opt out gehen, wenn die event
// details nie geladen werden?"
//
// Der Widerspruch war größer als gedacht: handleOptOut hatte einen
// vollständigen Warteschlangen-Pfad (Typ 'opt-out'), der Knopf darüber war
// aber `disabled={!isOnline}` -- der Offline-Pfad wurde nie erreicht.
// handleUnregister hatte gar keinen Offline-Pfad.
//
// Beide gehen jetzt offline in die Warteschlange. Das ist auch sachlich
// richtig: Eine Abmeldung gibt einen Platz FREI, da ist offline nichts zu
// prüfen. Das Anmelden bleibt gesperrt, weil die Plätze begrenzt sind und
// die App offline nicht weiß, ob noch einer frei ist.
//
// Gerendert wird die Konfi-Detailansicht ohne Netz; der Abmelde-Dialog wird
// über seine Requisiten bestätigt (sein Innenleben prüft
// abmeldeDialogGerendert).
import { describe, it, expect, beforeEach } from 'vitest';
import { fireEvent, act } from '@testing-library/react';
import {
  zustand, zuruecksetzen, termin, oeffne, knopf, zuletztGeoeffnet, api, enqueue, setSuccess,
} from './gerueste/konfiTerminDetail';
import type { Event } from '../../types/event';

beforeEach(zuruecksetzen);

/** Knopf tippen, den Abmelde-Dialog mit einem Grund bestätigen. */
const abmelden = async (knopfName: string, grund: string) => {
  await act(async () => { fireEvent.click(knopf(knopfName)!); });
  const dialog = zuletztGeoeffnet('UnregisterModal')!;
  await act(async () => { await (dialog.props.onUnregister as (g: string) => Promise<void>)(grund); });
  return dialog;
};

const eingereiht = () => enqueue.mock.calls.map((c) => c[0] as { method: string; url: string; body: unknown; metadata: { type: string } });

describe('Abmelden geht offline', () => {
  beforeEach(() => { zustand.online = false; });

  it('freiwilliger Termin: der Knopf ist nicht gesperrt und sagt, dass gesendet wird', async () => {
    await oeffne(termin({ is_registered: true, booking_status: 'confirmed' }));
    const k = knopf('Abmelden (wird gesendet)') as HTMLButtonElement;
    expect(k.disabled).toBe(false);
  });

  it('freiwilliger Termin: die Abmeldung (DELETE) landet mit Grund in der Warteschlange, Typ opt-out', async () => {
    await oeffne(termin({ is_registered: true, booking_status: 'confirmed' }));
    await abmelden('Abmelden (wird gesendet)', ' Krank ');
    expect(eingereiht()).toEqual([expect.objectContaining({
      method: 'DELETE', url: '/konfi/events/5/register', body: { reason: 'Krank', client_id: 'uuid-1' },
      metadata: expect.objectContaining({ type: 'opt-out', label: 'Abmeldung von "Sommerfest"' }),
    })]);
    expect(api.delete).not.toHaveBeenCalled();
    expect(setSuccess).toHaveBeenCalledWith('Abmeldung wird gesendet sobald du wieder online bist');
  });

  it('Pflichttermin: der Opt-out (POST) landet ebenfalls in der Warteschlange, Typ opt-out', async () => {
    await oeffne(termin({ mandatory: true, is_registered: true, booking_status: 'confirmed' }));
    const dialog = await abmelden('Abmelden (wird gesendet)', 'Bin auf Klassenfahrt');
    expect(dialog.props.mandatory).toBe(true);
    expect(eingereiht()).toEqual([expect.objectContaining({
      method: 'POST', url: '/konfi/events/5/opt-out', body: { reason: 'Bin auf Klassenfahrt', client_id: 'uuid-1' },
      metadata: expect.objectContaining({ type: 'opt-out' }),
    })]);
    expect(api.post).not.toHaveBeenCalled();
  });

  it('von der Warteliste abmelden geht offline genauso', async () => {
    await oeffne(termin({ booking_status: 'waitlist', waitlist_position: 2 } as Partial<Event>));
    await abmelden('Von der Warteliste abmelden (wird gesendet)', 'Doch keine Zeit');
    expect(eingereiht().map((e) => `${e.method} ${e.url}`)).toEqual(['DELETE /konfi/events/5/register']);
  });

  it('online heißt der Knopf schlicht "Abmelden" und sendet sofort', async () => {
    zustand.online = true;
    await oeffne(termin({ is_registered: true, booking_status: 'confirmed' }));
    expect(knopf('Abmelden (wird gesendet)')).toBeNull();
    await abmelden('Abmelden', 'Krank');
    expect(api.delete).toHaveBeenCalledWith('/konfi/events/5/register', { data: { reason: 'Krank', client_id: 'uuid-1' } });
    expect(enqueue).not.toHaveBeenCalled();
  });
});

describe('Anmelden bleibt offline gesperrt -- mit Grund', () => {
  beforeEach(() => { zustand.online = false; });

  it('offener Termin: "Du bist offline" statt "Anmelden", gesperrt, und ein Tipp sendet nichts', async () => {
    await oeffne(termin());
    const k = knopf('Du bist offline') as HTMLButtonElement;
    expect(k.disabled).toBe(true);
    expect(knopf(/^Anmelden/)).toBeNull();
    await act(async () => { fireEvent.click(k); });
    expect(api.post).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('volle Warteliste-Anmeldung ebenfalls gesperrt', async () => {
    await oeffne(termin({ max_participants: 2, registered_count: 2, waitlist_enabled: true, max_waitlist_size: 5 }));
    expect((knopf('Du bist offline') as HTMLButtonElement).disabled).toBe(true);
    expect(knopf(/^Warteliste offen/)).toBeNull();
  });

  it('online ist derselbe Knopf "Anmelden (2/10)" und frei', async () => {
    zustand.online = true;
    await oeffne(termin());
    expect((knopf('Anmelden (2/10)') as HTMLButtonElement).disabled).toBe(false);
  });
});
