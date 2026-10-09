// services/netzZuerst: Bei Netz entscheidet der Server; nur wenn gar keine
// Antwort kommt, zeigt die App den zuletzt geladenen Stand.
import { describe, it, expect, vi, beforeEach } from 'vitest';

const cache = vi.hoisted(() => ({
  set: vi.fn(async () => undefined),
  get: vi.fn(async (): Promise<{ data: unknown } | null> => null),
}));
vi.mock('../../services/offlineCache', () => ({ offlineCache: cache }));

import { netzZuerstLaden } from '../../services/netzZuerst';

const httpFehler = (status: number) => Object.assign(new Error(`HTTP ${status}`), { response: { status } });
const netzFehler = () => new Error('Network Error');

beforeEach(() => {
  cache.set.mockReset().mockResolvedValue(undefined);
  cache.get.mockReset().mockResolvedValue(null);
});

describe('netzZuerstLaden', () => {
  it('mit Netz: die Antwort des Servers, gemerkt fuer spaeter', async () => {
    const ergebnis = await netzZuerstLaden('beitraege-7', async () => ['neu'], 3600);
    expect(ergebnis).toEqual({ daten: ['neu'], ausSpeicher: false });
    expect(cache.set).toHaveBeenCalledWith('beitraege-7', ['neu'], 3600);
    expect(cache.get).not.toHaveBeenCalled();
  });

  it('der Server gewinnt gegen den Speicher: ein geloeschter Beitrag kommt nicht zurueck', async () => {
    cache.get.mockResolvedValue({ data: ['alt', 'geloescht'] });
    const ergebnis = await netzZuerstLaden('beitraege-7', async () => ['alt'], 60);
    expect(ergebnis.daten).toEqual(['alt']);
  });

  it('ein scheiterndes Merken stoert die Anzeige nicht', async () => {
    cache.set.mockRejectedValue(new Error('Speicher voll'));
    await expect(netzZuerstLaden('k', async () => 1, 60)).resolves.toEqual({ daten: 1, ausSpeicher: false });
  });

  it('ohne Netz: der zuletzt geladene Stand, als solcher gekennzeichnet', async () => {
    cache.get.mockResolvedValue({ data: ['gemerkt'] });
    const ergebnis = await netzZuerstLaden('beitraege-7', async () => { throw netzFehler(); }, 60);
    expect(ergebnis).toEqual({ daten: ['gemerkt'], ausSpeicher: true });
    expect(cache.get).toHaveBeenCalledWith('beitraege-7');
  });

  it('ohne Netz und ohne gemerkten Stand: der Netzfehler geht weiter', async () => {
    const fehler = netzFehler();
    await expect(netzZuerstLaden('k', async () => { throw fehler; }, 60)).rejects.toBe(fehler);
  });

  it('ohne Netz und kaputtem Speicher: der Netzfehler geht weiter, nicht der Speicherfehler', async () => {
    const fehler = netzFehler();
    cache.get.mockRejectedValue(new Error('IndexedDB weg'));
    await expect(netzZuerstLaden('k', async () => { throw fehler; }, 60)).rejects.toBe(fehler);
  });

  it.each([403, 404, 500])('VERBOTEN: Server antwortet %i -- kein Rueckgriff auf den Speicher', async (status) => {
    cache.get.mockResolvedValue({ data: ['nicht mehr sichtbar'] });
    const fehler = httpFehler(status);
    await expect(netzZuerstLaden('k', async () => { throw fehler; }, 60)).rejects.toBe(fehler);
    expect(cache.get).not.toHaveBeenCalled();
  });
});
