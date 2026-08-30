import { describe, it, expect } from 'vitest';
import {
  fehlerText,
  fehlerTextOderMessage,
  fehlerStatus,
  fehlerDaten,
  alsApiFehler,
} from '../../utils/fehlerText';

describe('fehlerText', () => {
  it('nimmt den Satz aus der Backend-Antwort', () => {
    const fehler = { response: { status: 409, data: { error: 'Dieser Termin ist schon voll' } } };
    expect(fehlerText(fehler, 'Fehler beim Anmelden')).toBe('Dieser Termin ist schon voll');
  });

  // Der Fall, der die Datei nötig gemacht hat: Bei einem Netzwerkfehler gibt
  // es gar keine `response`. Die alte Kette error.response.data.error warf
  // dort selbst einen TypeError, statt eine Meldung anzuzeigen.
  it('faellt ohne response auf den Ersatztext zurueck', () => {
    const netzwerkfehler = { message: 'Network Error', code: 'ERR_NETWORK' };
    expect(fehlerText(netzwerkfehler, 'Keine Verbindung')).toBe('Keine Verbindung');
  });

  it('faellt bei fehlendem error-Feld auf den Ersatztext zurueck', () => {
    expect(fehlerText({ response: { status: 500, data: {} } }, 'Serverfehler')).toBe('Serverfehler');
  });

  it('behandelt einen leeren error-Text wie keinen', () => {
    expect(fehlerText({ response: { data: { error: '   ' } } }, 'Ersatz')).toBe('Ersatz');
  });

  it('vertraegt geworfene Nicht-Objekte', () => {
    expect(fehlerText('kaputt', 'Ersatz')).toBe('Ersatz');
    expect(fehlerText(null, 'Ersatz')).toBe('Ersatz');
    expect(fehlerText(undefined, 'Ersatz')).toBe('Ersatz');
    expect(fehlerText(42, 'Ersatz')).toBe('Ersatz');
  });
});

describe('fehlerTextOderMessage', () => {
  it('bevorzugt die Backend-Antwort vor der message', () => {
    const fehler = {
      response: { data: { error: 'Kein Zugriff auf diesen Jahrgang' } },
      message: 'Request failed with status code 403',
    };
    expect(fehlerTextOderMessage(fehler, 'Ersatz')).toBe('Kein Zugriff auf diesen Jahrgang');
  });

  it('nimmt die message, wenn es keine Backend-Antwort gibt', () => {
    expect(fehlerTextOderMessage(new Error('Datei zu gross'), 'Ersatz')).toBe('Datei zu gross');
  });

  it('nimmt den Ersatztext, wenn beides fehlt', () => {
    expect(fehlerTextOderMessage({}, 'Unbekannter Fehler')).toBe('Unbekannter Fehler');
  });
});

describe('fehlerStatus und fehlerDaten', () => {
  it('liest den Status der Fehlerantwort', () => {
    expect(fehlerStatus({ response: { status: 409, data: {} } })).toBe(409);
  });

  it('liefert ohne response undefined statt zu werfen', () => {
    expect(fehlerStatus(new Error('Network Error'))).toBeUndefined();
    expect(fehlerDaten('kaputt')).toBeUndefined();
  });

  // Die 409-Antwort beim Loeschen eines Termins traegt die konkreten Zahlen,
  // die der Rueckfrage-Dialog nennt (siehe events/verwaltung.js).
  it('reicht die Zusatzfelder der Antwort durch', () => {
    const konflikt = {
      response: {
        status: 409,
        data: {
          error: 'Beim Löschen dieses Events geht verloren: 3 Anmeldung(en).',
          error_code: 'event_delete_confirm',
          booking_count: 3,
          message_count: 0,
          points_count: 0,
          points_total: 0,
        },
      },
    };
    expect(fehlerDaten(konflikt)?.booking_count).toBe(3);
    expect(fehlerDaten(konflikt)?.error_code).toBe('event_delete_confirm');
  });

  it('macht aus einem Nicht-Objekt ein leeres Fehlerobjekt', () => {
    expect(alsApiFehler('kaputt')).toEqual({});
    expect(alsApiFehler(null)).toEqual({});
  });
});
