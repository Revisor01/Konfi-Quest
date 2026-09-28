import { describe, it, expect, vi } from 'vitest';
import { AxiosError, AxiosHeaders } from 'axios';
import {
  sendenOderEinreihen,
  istVerbindungsabbruch,
  darfNachAbbruchEinreihen,
} from '../../utils/sendenOderEinreihen';

// Senden -- und bei abgerissener Verbindung in die Warteschlange (Audit
// Grundgeruest BF-01, Teil 2). Die Regel steht an EINER Stelle; die
// Formulare rufen sie auf (repraesentativ geprueft in
// components/formularNetzabbruchWarteschlange.test.tsx).

const config = { url: '/x', method: 'post', headers: new AxiosHeaders() };
const netzfehler = () => new AxiosError('Network Error', 'ERR_NETWORK', config as never, {});
const zeitlimit = () => new AxiosError('timeout of 20000ms exceeded', 'ECONNABORTED', config as never, {});
const antwort = (status: number) => new AxiosError(`Request failed with status code ${status}`,
  status >= 500 ? 'ERR_BAD_RESPONSE' : 'ERR_BAD_REQUEST', config as never, {},
  { status, statusText: '', headers: {}, config, data: { error: 'Nein' } } as never);

describe('istVerbindungsabbruch', () => {
  it('Netzfehler und Zeitlimit ohne Antwort: ja', () => {
    expect(istVerbindungsabbruch(netzfehler())).toBe(true);
    expect(istVerbindungsabbruch(zeitlimit())).toBe(true);
    expect(istVerbindungsabbruch({ code: 'ETIMEDOUT' })).toBe(true);
  });

  it('eine Antwort des Servers, ein Abbruch oder ein eigener Fehler: nein', () => {
    expect(istVerbindungsabbruch(antwort(500))).toBe(false);
    expect(istVerbindungsabbruch(antwort(400))).toBe(false);
    expect(istVerbindungsabbruch(new AxiosError('canceled', 'ERR_CANCELED', config as never))).toBe(false);
    expect(istVerbindungsabbruch(new TypeError('x is undefined'))).toBe(false);
    expect(istVerbindungsabbruch(null)).toBe(false);
    expect(istVerbindungsabbruch('ERR_NETWORK')).toBe(false);
  });
});

describe('darfNachAbbruchEinreihen', () => {
  it('PUT und DELETE ja, POST nur mit Zusicherung', () => {
    expect(darfNachAbbruchEinreihen('PUT')).toBe(true);
    expect(darfNachAbbruchEinreihen('DELETE')).toBe(true);
    expect(darfNachAbbruchEinreihen('POST')).toBe(false);
    expect(darfNachAbbruchEinreihen('POST', true)).toBe(true);
  });
});

describe('sendenOderEinreihen', () => {
  const lauf = (online: boolean, methode: 'POST' | 'PUT' | 'DELETE', senden: () => Promise<unknown>, idempotent?: boolean) => {
    const einreihen = vi.fn(async () => undefined);
    const ergebnis = sendenOderEinreihen({ online, methode, idempotent, senden, einreihen });
    return { ergebnis, einreihen };
  };

  it('offline: reiht ein, ohne zu senden -- jede Methode, auch POST ohne Zusicherung (wie bisher)', async () => {
    const senden = vi.fn(async () => 'antwort');
    const { ergebnis, einreihen } = lauf(false, 'POST', senden);
    expect(await ergebnis).toEqual({ weg: 'eingereiht' });
    expect(senden).not.toHaveBeenCalled();
    expect(einreihen).toHaveBeenCalledTimes(1);
  });

  it('online und erfolgreich: sendet, reiht nicht ein', async () => {
    const { ergebnis, einreihen } = lauf(true, 'POST', async () => 'antwort', true);
    expect(await ergebnis).toEqual({ weg: 'gesendet', ergebnis: 'antwort' });
    expect(einreihen).not.toHaveBeenCalled();
  });

  it('online, Netz reisst ab: idempotenter POST, PUT und DELETE landen in der Warteschlange', async () => {
    for (const [methode, idempotent] of [['POST', true], ['PUT', false], ['DELETE', false]] as const) {
      const { ergebnis, einreihen } = lauf(true, methode, async () => { throw netzfehler(); }, idempotent);
      expect(await ergebnis).toEqual({ weg: 'eingereiht' });
      expect(einreihen).toHaveBeenCalledTimes(1);
    }
    const { ergebnis, einreihen } = lauf(true, 'PUT', async () => { throw zeitlimit(); });
    expect(await ergebnis).toEqual({ weg: 'eingereiht' });
    expect(einreihen).toHaveBeenCalledTimes(1);
  });

  it('verboten: ein POST ohne Zusicherung wird nach einem Abbruch NICHT eingereiht -- er koennte doppelt ankommen', async () => {
    const fehler = netzfehler();
    const { ergebnis, einreihen } = lauf(true, 'POST', async () => { throw fehler; });
    await expect(ergebnis).rejects.toBe(fehler);
    expect(einreihen).not.toHaveBeenCalled();
  });

  it('verboten: antwortet der Server mit einem Fehler, bleibt es beim Fehler', async () => {
    for (const status of [400, 403, 409, 500, 503]) {
      const fehler = antwort(status);
      const { ergebnis, einreihen } = lauf(true, 'PUT', async () => { throw fehler; });
      await expect(ergebnis).rejects.toBe(fehler);
      expect(einreihen).not.toHaveBeenCalled();
    }
  });

  it('scheitert das Einreihen selbst, kommt dieser Fehler beim Aufrufer an', async () => {
    const einreihen = vi.fn(async () => { throw new Error('Foto konnte nicht lokal gespeichert werden'); });
    await expect(sendenOderEinreihen({
      online: true, methode: 'DELETE', senden: async () => { throw netzfehler(); }, einreihen,
    })).rejects.toThrow('Foto konnte nicht lokal gespeichert werden');
  });
});
