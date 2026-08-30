import { describe, it, expect } from 'vitest';
import {
  fehlerText,
  fehlerTextOderMessage,
  fehlerStatus,
  istNetzwerkfehler,
} from '../../utils/fehler';

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
