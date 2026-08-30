import { describe, it, expect } from 'vitest';
import { fehlerText, fehlerTextOderMessage, fehlerStatus } from '../../utils/fehlerText';

describe('fehlerText', () => {
  it('liest die Meldung aus der API-Antwort', () => {
    const fehler = { response: { data: { error: 'Anmeldung fehlgeschlagen' } } };
    expect(fehlerText(fehler, 'Fallback')).toBe('Anmeldung fehlgeschlagen');
  });

  it('nimmt den Fallback, wenn die API keine Meldung schickt', () => {
    expect(fehlerText({ response: { data: {} } }, 'Fallback')).toBe('Fallback');
    expect(fehlerText({ response: {} }, 'Fallback')).toBe('Fallback');
    expect(fehlerText({}, 'Fallback')).toBe('Fallback');
  });

  it('nimmt den Fallback bei leerer Meldung', () => {
    expect(fehlerText({ response: { data: { error: '' } } }, 'Fallback')).toBe('Fallback');
  });

  it('nimmt den Fallback, wenn die Meldung kein String ist', () => {
    expect(fehlerText({ response: { data: { error: { code: 7 } } } }, 'Fallback')).toBe('Fallback');
    expect(fehlerText({ response: { data: { error: 42 } } }, 'Fallback')).toBe('Fallback');
  });

  it('kommt mit nicht-Objekten als Fehler zurecht', () => {
    expect(fehlerText(null, 'Fallback')).toBe('Fallback');
    expect(fehlerText(undefined, 'Fallback')).toBe('Fallback');
    expect(fehlerText('kaputt', 'Fallback')).toBe('Fallback');
    expect(fehlerText(new Error('boom'), 'Fallback')).toBe('Fallback');
  });
});

describe('fehlerTextOderMessage', () => {
  it('bevorzugt die API-Meldung vor error.message', () => {
    const fehler = Object.assign(new Error('Request failed with status code 400'), {
      response: { data: { error: 'Foto zu gross' } },
    });
    expect(fehlerTextOderMessage(fehler, 'Fallback')).toBe('Foto zu gross');
  });

  it('faellt auf error.message zurueck', () => {
    expect(fehlerTextOderMessage(new Error('Network Error'), 'Fallback')).toBe('Network Error');
  });

  it('nimmt den Fallback, wenn beides fehlt', () => {
    expect(fehlerTextOderMessage({}, 'Fallback')).toBe('Fallback');
    expect(fehlerTextOderMessage(null, 'Fallback')).toBe('Fallback');
  });
});

describe('fehlerStatus', () => {
  it('liest den HTTP-Status', () => {
    expect(fehlerStatus({ response: { status: 429 } })).toBe(429);
  });

  it('gibt undefined ohne Status zurueck', () => {
    expect(fehlerStatus({ response: {} })).toBeUndefined();
    expect(fehlerStatus(new Error('offline'))).toBeUndefined();
    expect(fehlerStatus(null)).toBeUndefined();
  });

  it('ignoriert einen Status, der kein number ist', () => {
    expect(fehlerStatus({ response: { status: '429' } })).toBeUndefined();
  });
});
