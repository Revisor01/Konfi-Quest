// Befund N6 (Drei-Ansichten-Bericht), Teil Konfi -- gerendert.
//
// Das Termin-Detail gibt es dreimal, und die drei Fassungen waren
// auseinandergelaufen. Simons Entscheidungen vom 27.08.2026 stehen in ALLEN
// drei Ansichten: Check-in-Fenster, Serien-Kennzeichnung, Anmeldezeitraum,
// Einstieg in den Event-Chat. Bis 09.10.2026 prüfte das ein einziger
// Quelltext-Test über drei Dateien (terminDetailDreiAnsichten.test.ts) -- der
// "Anmeldezeitraum" stand dort nur noch in einem Kommentar, die Zeile heißt
// längst "Anmeldung". Jetzt rendert je Ansicht eine Datei die echte Seite:
// diese die der Konfis, die Schwestern ...Leitung und ...Team.
import { describe, it, expect, beforeEach } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import { zustand, zuruecksetzen, termin, oeffne, knopf, api } from './gerueste/konfiTerminDetail';
import {
  kopfzeileMitschreiben, ionicNachtragen, nachtragZuruecksetzen, kopfzeilen, routerZiele,
} from './gerueste/nachtragKopfzeileIonic';

kopfzeileMitschreiben();
await ionicNachtragen();

beforeEach(() => {
  zuruecksetzen();
  nachtragZuruecksetzen();
});

/** Der Wert einer Info-Zeile über ihre Beschriftung -- null, wenn es sie nicht gibt. */
const zeile = (beschriftung: string) => {
  const label = [...document.querySelectorAll('.app-info-row__label')].find((el) => el.textContent === beschriftung);
  if (!label) return null;
  return [...label.parentElement!.querySelectorAll('.app-info-row__value')].map((el) => el.textContent).join(' | ');
};

describe('N6 Konfi: Check-in-Fenster', () => {
  it('zeigt das Zeitfenster des Termins', async () => {
    await oeffne(termin({ checkin_window: 45 }));
    expect(zeile('Check-in-Fenster')).toBe('QR-Code 45 Min. (vor/nach Beginn)');
  });

  it('der Wert kommt aus checkin_window, nicht aus einer festen Zahl', async () => {
    await oeffne(termin({ checkin_window: 20 }));
    expect(zeile('Check-in-Fenster')).toBe('QR-Code 20 Min. (vor/nach Beginn)');
  });

  it('ohne Zeitfenster entfällt die Zeile', async () => {
    await oeffne(termin({ checkin_window: undefined }));
    expect(zeile('Check-in-Fenster')).toBeNull();
  });
});

describe('N6 Konfi: Serien-Kennzeichnung', () => {
  it('ein Serientermin sagt, dass er Teil einer Serie ist', async () => {
    await oeffne(termin({ is_series: true }));
    expect(zeile('Event-Serie')).toBe('Teil einer Serie');
  });

  it('ein Einzeltermin sagt nichts dazu', async () => {
    await oeffne(termin({ is_series: false }));
    expect(zeile('Event-Serie')).toBeNull();
  });
});

describe('N6 Konfi: Anmeldezeitraum', () => {
  it('ohne gesetzten Beginn: "Sofort möglich"', async () => {
    await oeffne(termin({ registration_opens_at: undefined }));
    expect(zeile('Anmeldung')).toMatch(/^Sofort möglich/);
  });

  it('mit Beginn und Schluss: beide stehen da', async () => {
    await oeffne(termin({
      registration_opens_at: '2026-09-01T08:00:00+02:00',
      registration_closes_at: '2026-09-20T18:00:00+02:00',
    }));
    expect(zeile('Anmeldung')).toMatch(/^von 01\.09\.2026 – 08:00 \| bis 20\.09\.2026 – 18:00/);
  });

  it('entfällt bei Pflichtterminen', async () => {
    await oeffne(termin({ mandatory: true, registration_status: 'mandatory' }));
    expect(zeile('Anmeldung')).toBeNull();
  });
});

describe('N6 Konfi: Einstieg in den Event-Chat', () => {
  it('mit Raum: der Knopf führt in den Raum der Konfi-Ansicht', async () => {
    await oeffne(termin({ chat_room_id: 12 }));
    await act(async () => { fireEvent.click(knopf('Event-Chat öffnen')!); });
    expect(routerZiele).toHaveBeenCalledWith('/konfi/chat/room/12', 'root');
  });

  it('ohne Raum gibt es den Knopf nicht (er liefe ins 403)', async () => {
    await oeffne(termin({ chat_room_id: null }));
    expect(knopf('Event-Chat öffnen')).toBeNull();
  });

  it('er öffnet nur und erstellt nie einen Raum', async () => {
    await oeffne(termin({ chat_room_id: 12 }));
    await act(async () => { fireEvent.click(knopf('Event-Chat öffnen')!); });
    expect(api.post.mock.calls.map((c) => c[0])).toEqual([]);
  });
});

// Aus umschalterInDetailansichten (26.09.2026, Simon: "In Events Details kein
// org switcher zeigen."): Der Termin gehört zu genau einer Gemeinde.
describe('Konfi-Termindetail: kein Gemeinde-Umschalter', () => {
  it('weder im geladenen Termin ...', async () => {
    await oeffne(termin());
    expect(kopfzeilen.length).toBeGreaterThan(0);
    expect(kopfzeilen.map((k) => k.gemeindeUmschalter)).toEqual(kopfzeilen.map(() => false));
  });

  it('... noch beim Laden ...', async () => {
    zustand.laedt = true;
    await oeffne(termin());
    expect(kopfzeilen.map((k) => [k.titel, k.gemeindeUmschalter])).toContainEqual(['Event-Details', false]);
    expect(kopfzeilen.filter((k) => k.gemeindeUmschalter !== false)).toEqual([]);
  });

  it('... noch wenn der Termin nicht (mehr) in der Liste steht', async () => {
    zustand.events = [termin({ id: 1 })];
    const EventDetailView = (await import('../../components/konfi/views/EventDetailView')).default;
    render(<EventDetailView eventId={999} onBack={() => undefined} />);
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(kopfzeilen.map((k) => [k.titel, k.gemeindeUmschalter])).toContainEqual(['Event nicht gefunden', false]);
    expect(kopfzeilen.filter((k) => k.gemeindeUmschalter !== false)).toEqual([]);
  });
});
