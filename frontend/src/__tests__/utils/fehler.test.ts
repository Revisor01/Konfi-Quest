import { describe, it, expect, vi, afterEach } from 'vitest';
import { AxiosError, AxiosHeaders } from 'axios';
import { alsApiFehler, fehlerDaten, fehlerFuersProtokoll, fehlerStatus, fehlerText, fehlerTextOderMessage, herkunftDesFehlertexts, istNetzwerkfehler } from '../../utils/fehler';
import { enthaeltText } from '../protokollDurchsuchen';

/** Nachbau eines axios-Fehlers, wie ihn die Catch-Blöcke bisher gesehen haben. */
const axiosFehler = (data: unknown, status = 400) => ({
  isAxiosError: true,
  message: 'Request failed with status code ' + status,
  response: { status, data },
});

describe('fehlerText', () => {
  it('zeigt die Server-Meldung aus response.data.error', () => {
    const err = axiosFehler({ error: 'Name bereits vergeben' });
    expect(fehlerText(err, 'Fallback')).toBe('Name bereits vergeben');
  });

  it('faellt ohne data.error auf den Fallback zurueck', () => {
    const err = axiosFehler({ message: 'anders benannt' }, 500);
    expect(fehlerText(err, 'Fehler beim Speichern')).toBe('Fehler beim Speichern');
  });

  it('faellt bei leerem String auf den Fallback zurueck (wie || bisher)', () => {
    const err = axiosFehler({ error: '' });
    expect(fehlerText(err, 'Fallback')).toBe('Fallback');
  });

  it('faellt bei Nicht-String in data.error auf den Fallback zurueck', () => {
    const err = axiosFehler({ error: { code: 42 } });
    expect(fehlerText(err, 'Fallback')).toBe('Fallback');
  });

  it('zeigt bei plain Error den Fallback, nicht err.message', () => {
    expect(fehlerText(new Error('Netzwerk kaputt'), 'Fehler beim Laden')).toBe(
      'Fehler beim Laden'
    );
  });

  it('uebersteht voellig fremde Werte (string, null, undefined, Zahl)', () => {
    expect(fehlerText('kaputt', 'Fallback')).toBe('Fallback');
    expect(fehlerText(null, 'Fallback')).toBe('Fallback');
    expect(fehlerText(undefined, 'Fallback')).toBe('Fallback');
    expect(fehlerText(42, 'Fallback')).toBe('Fallback');
  });
});

describe('fehlerTextOderMessage', () => {
  it('bevorzugt die Server-Meldung', () => {
    const err = axiosFehler({ error: 'Datei zu groß' }, 413);
    expect(fehlerTextOderMessage(err, 'Fallback')).toBe('Datei zu groß');
  });

  it('nimmt ohne Server-Meldung err.message', () => {
    const err = axiosFehler({}, 500);
    expect(fehlerTextOderMessage(err, 'Fallback')).toBe(
      'Request failed with status code 500'
    );
    expect(fehlerTextOderMessage(new Error('kaputt'), 'Fallback')).toBe('kaputt');
  });

  it('faellt ohne beides auf den Fallback zurueck', () => {
    expect(fehlerTextOderMessage({}, 'Unbekannter Fehler')).toBe('Unbekannter Fehler');
    expect(fehlerTextOderMessage(null, 'Unbekannter Fehler')).toBe('Unbekannter Fehler');
    expect(fehlerTextOderMessage(new Error(''), 'Unbekannter Fehler')).toBe(
      'Unbekannter Fehler'
    );
  });
});

describe('fehlerStatus', () => {
  it('liefert den HTTP-Status eines axios-Fehlers', () => {
    expect(fehlerStatus(axiosFehler({ error: 'weg' }, 404))).toBe(404);
  });

  it('liefert undefined ohne Response (Netzwerkfehler, plain Error)', () => {
    expect(fehlerStatus(new Error('offline'))).toBeUndefined();
    expect(fehlerStatus({ code: 'ERR_NETWORK' })).toBeUndefined();
    expect(fehlerStatus(null)).toBeUndefined();
  });
});

describe('istNetzwerkfehler', () => {
  it('erkennt ERR_NETWORK', () => {
    expect(istNetzwerkfehler({ code: 'ERR_NETWORK' })).toBe(true);
  });

  it('erkennt fehlende Response als Netzwerkfehler (wie !err.response bisher)', () => {
    expect(istNetzwerkfehler(new Error('timeout'))).toBe(true);
    expect(istNetzwerkfehler(null)).toBe(true);
  });

  it('ist falsch, wenn der Server geantwortet hat', () => {
    expect(istNetzwerkfehler(axiosFehler({ error: 'nope' }, 500))).toBe(false);
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

/**
 * Herkunft eines Server-Textes fuer die Fehlermessung (Befund B1,
 * docs/messung/umami.md): Die Messung ersetzt einen Server-Text durch den
 * Ersatztext der Aufrufstelle. Dafuer merkt sich fehlerText kurz, welcher
 * Ersatztext zu welchem gelieferten Text gehoerte.
 */
describe('herkunftDesFehlertexts', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('liefert Ersatztext und Art, wenn fehlerText den Server-Text geliefert hat', () => {
    const text = fehlerText(axiosFehler({ error: 'Anna Beispiel gehört zu keinem Jahrgang' }, 403), 'Fehler beim Hinzufügen');
    expect(herkunftDesFehlertexts(text)).toEqual({ ersatz: 'Fehler beim Hinzufügen', art: 'http-403' });
  });

  it('wird beim Abruf verbraucht', () => {
    const text = fehlerText(axiosFehler({ error: 'Einmal-Text' }, 409), 'Ersatz A');
    expect(herkunftDesFehlertexts(text)).toEqual({ ersatz: 'Ersatz A', art: 'http-409' });
    expect(herkunftDesFehlertexts(text)).toBeUndefined();
  });

  it('merkt sich nichts, wenn der Ersatztext selbst geliefert wurde', () => {
    const text = fehlerText(new Error('Netzwerk kaputt'), 'Fehler beim Laden X');
    expect(text).toBe('Fehler beim Laden X');
    expect(herkunftDesFehlertexts(text)).toBeUndefined();
  });

  it('fehlerTextOderMessage merkt sich Server-Text und err.message', () => {
    const server = fehlerTextOderMessage(axiosFehler({ error: 'Server sagt nein' }, 400), 'Ersatz B');
    expect(herkunftDesFehlertexts(server)).toEqual({ ersatz: 'Ersatz B', art: 'http-400' });

    const message = fehlerTextOderMessage({ message: 'Datei Taufurkunde.pdf zu groß' }, 'Ersatz C');
    expect(message).toBe('Datei Taufurkunde.pdf zu groß');
    expect(herkunftDesFehlertexts(message)?.ersatz).toBe('Ersatz C');
  });

  it('verfällt nach zehn Sekunden', () => {
    vi.useFakeTimers();
    const text = fehlerText(axiosFehler({ error: 'Später abgerufen' }, 400), 'Ersatz D');
    vi.advanceTimersByTime(10_001);
    expect(herkunftDesFehlertexts(text)).toBeUndefined();
  });

  it('hält höchstens zehn Einträge, der älteste fällt zuerst', () => {
    for (let i = 0; i < 11; i++) {
      fehlerText(axiosFehler({ error: `Text ${i}` }, 400), `Ersatz ${i}`);
    }
    expect(herkunftDesFehlertexts('Text 0')).toBeUndefined();
    expect(herkunftDesFehlertexts('Text 1')).toEqual({ ersatz: 'Ersatz 1', art: 'http-400' });
    expect(herkunftDesFehlertexts('Text 10')).toEqual({ ersatz: 'Ersatz 10', art: 'http-400' });
  });
});

// Audit Grundgeruest BF-08: Ein axios-Fehler traegt die gesendete Anfrage mit
// (config.data, config.headers, request, response.config). Ins Protokoll darf
// davon nichts.
describe('fehlerFuersProtokoll', () => {
  const PASSWORT = 'Passwort-geheim-31';
  const TOKEN = 'token-geheim-9c';

  const echterAxiosFehler = (status?: number, data: unknown = {}) => {
    const config = {
      url: '/auth/login',
      method: 'post',
      data: JSON.stringify({ username: 'konfi1', password: PASSWORT }),
      headers: new AxiosHeaders({ Authorization: `Bearer ${TOKEN}` }),
    };
    const response = status ? { status, statusText: 'x', data, headers: {}, config, request: {} } : undefined;
    return new AxiosError(
      status ? `Request failed with status code ${status}` : 'Network Error',
      status ? 'ERR_BAD_REQUEST' : 'ERR_NETWORK',
      config as never, { gesendet: config.data }, response as never
    );
  };

  it('behält Status, Code, Server-Fehlertext und Meldung', () => {
    expect(fehlerFuersProtokoll(echterAxiosFehler(401, { error: 'Ungültige Anmeldedaten' }))).toEqual({
      status: 401,
      code: 'ERR_BAD_REQUEST',
      fehler: 'Ungültige Anmeldedaten',
      meldung: 'Request failed with status code 401',
    });
  });

  it('lässt Passwort und Token aus der gesendeten Anfrage weg', () => {
    const fehler = echterAxiosFehler(401, { error: 'Ungültige Anmeldedaten' });
    // Voraussetzung: das Fehlerobjekt selbst traegt beides.
    expect(enthaeltText(fehler, PASSWORT)).toBe(true);
    expect(enthaeltText(fehler, TOKEN)).toBe(true);

    const protokoll = fehlerFuersProtokoll(fehler);
    expect(enthaeltText(protokoll, PASSWORT)).toBe(false);
    expect(enthaeltText(protokoll, TOKEN)).toBe(false);
  });

  it('ohne Antwort: nur Code und Meldung', () => {
    expect(fehlerFuersProtokoll(echterAxiosFehler())).toEqual({ code: 'ERR_NETWORK', meldung: 'Network Error' });
  });

  it('nimmt aus der Antwort nur den Fehlertext, keine weiteren Felder', () => {
    const protokoll = fehlerFuersProtokoll(echterAxiosFehler(400, { error: 'Kaputt', username: 'konfi1', details: { a: 1 } }));
    expect(protokoll).toEqual({ status: 400, code: 'ERR_BAD_REQUEST', fehler: 'Kaputt', meldung: 'Request failed with status code 400' });
  });

  it('übersteht Fehler ohne axios-Form und fremde Werte', () => {
    expect(fehlerFuersProtokoll(new Error('Preferences kaputt'))).toEqual({ meldung: 'Preferences kaputt' });
    expect(fehlerFuersProtokoll({ code: 'UNAVAILABLE', message: 'Plugin fehlt' })).toEqual({ code: 'UNAVAILABLE', meldung: 'Plugin fehlt' });
    expect(fehlerFuersProtokoll(null)).toEqual({});
    expect(fehlerFuersProtokoll(undefined)).toEqual({});
    expect(fehlerFuersProtokoll('kaputt')).toEqual({});
  });
});
