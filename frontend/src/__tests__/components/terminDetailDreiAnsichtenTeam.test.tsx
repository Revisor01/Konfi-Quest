// Befund N6 (Drei-Ansichten-Bericht), Teil Team -- gerendert.
//
// Das Termin-Detail gibt es dreimal (Konfi, Team, Leitung); Simons
// Entscheidungen vom 27.08.2026 stehen in allen drei. Bis 09.10.2026 prüfte
// das ein Quelltext-Test über drei Dateien (terminDetailDreiAnsichten.test.ts).
// Jetzt rendert je Ansicht eine Datei die echte Seite: diese die Team-Seite
// (die Detailansicht lebt inline in TeamerEventsPage), die Schwestern
// ...Konfi und ...Leitung.
import { describe, it, expect, beforeEach } from 'vitest';
import { fireEvent, act } from '@testing-library/react';
import { zustand, zuruecksetzen, termin, oeffneTermin, knopf, api, routerPush } from './gerueste/teamerTerminSeite';
import type { Event } from '../../types/event';

beforeEach(zuruecksetzen);

const zeige = async (zusatz: Partial<Event>) => {
  zustand.events = [termin(zusatz)];
  return oeffneTermin();
};

/** Der Wert einer Info-Zeile über ihre Beschriftung -- null, wenn es sie nicht gibt. */
const zeile = (beschriftung: string) => {
  const label = [...document.querySelectorAll('.app-info-row__label')].find((el) => el.textContent === beschriftung);
  if (!label) return null;
  return [...label.parentElement!.querySelectorAll('.app-info-row__value')].map((el) => el.textContent).join(' | ');
};

describe('N6 Team: Check-in-Fenster', () => {
  it('zeigt das Zeitfenster des Termins', async () => {
    await zeige({ checkin_window: 45 });
    expect(zeile('Check-in-Fenster')).toBe('QR-Code 45 Min. (vor/nach Beginn)');
  });

  it('der Wert kommt aus checkin_window, nicht aus einer festen Zahl', async () => {
    await zeige({ checkin_window: 20 });
    expect(zeile('Check-in-Fenster')).toBe('QR-Code 20 Min. (vor/nach Beginn)');
  });

  it('ohne Zeitfenster entfällt die Zeile', async () => {
    await zeige({ checkin_window: undefined });
    expect(zeile('Check-in-Fenster')).toBeNull();
  });
});

describe('N6 Team: Serien-Kennzeichnung', () => {
  it('ein Serientermin sagt, dass er Teil einer Serie ist', async () => {
    await zeige({ is_series: true });
    expect(zeile('Event-Serie')).toBe('Teil einer Serie');
  });

  it('ein Einzeltermin sagt nichts dazu', async () => {
    await zeige({ is_series: false });
    expect(zeile('Event-Serie')).toBeNull();
  });
});

describe('N6 Team: Anmeldezeitraum', () => {
  it('ohne gesetzten Beginn: "Sofort möglich"', async () => {
    await zeige({ registration_opens_at: undefined });
    expect(zeile('Anmeldung')).toMatch(/^Sofort möglich/);
  });

  it('mit Beginn und Schluss: beide stehen da', async () => {
    await zeige({ registration_opens_at: '2026-09-01T08:00:00+02:00', registration_closes_at: '2026-09-20T18:00:00+02:00' });
    expect(zeile('Anmeldung')).toMatch(/^von 01\.09\.2026 – 08:00 \| bis 20\.09\.2026 – 18:00/);
  });

  it('entfällt bei Pflichtterminen', async () => {
    await zeige({ mandatory: true, registration_status: 'mandatory' });
    expect(zeile('Anmeldung')).toBeNull();
  });
});

describe('N6 Team: Einstieg in den Event-Chat', () => {
  it('mit Raum: der Knopf führt in den Raum der Team-Ansicht', async () => {
    await zeige({ chat_room_id: 12 });
    await act(async () => { fireEvent.click(knopf('Event-Chat öffnen')!); });
    expect(routerPush).toHaveBeenCalledWith('/teamer/chat/room/12', 'root');
  });

  it('ohne Raum gibt es den Knopf nicht (er liefe ins 403)', async () => {
    await zeige({ chat_room_id: null });
    expect(knopf('Event-Chat öffnen')).toBeNull();
  });

  it('er öffnet nur und erstellt nie einen Raum', async () => {
    await zeige({ chat_room_id: 12 });
    await act(async () => { fireEvent.click(knopf('Event-Chat öffnen')!); });
    expect(api.post.mock.calls.map((c) => c[0])).toEqual([]);
  });
});
