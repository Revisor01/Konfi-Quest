// Tests fuer utils/storeVersion.js — die Quelle des Update-Hinweises.
//
// Der Lookup laeuft mit injiziertem fetch (nie echtes Netz im Test, Muster
// wie musikLinks.test.js). Geprueft werden die drei Verhaltensgarantien:
// 1. Ein gelungener Lookup liefert Version + Store-URL und wird gecacht.
// 2. Fehler werfen NIE, sondern liefern den letzten bekannten Wert oder null.
// 3. Nach einem Fehlschlag wird 5 Minuten nicht erneut angefragt (Sperre).
const {
  holeStoreVersion,
  _nurFuerTests_reset,
  APP_STORE_URL_FALLBACK,
  PLAY_STORE_URL,
  LOOKUP_URL,
} = require('../../utils/storeVersion');

// Nachbau der iTunes-Lookup-Antwort (Form am 01.09.2026 live verifiziert:
// resultCount + results[0].version/trackViewUrl).
function lookupAntwort(version, trackViewUrl = 'https://apps.apple.com/de/app/konfi-quest/id6748016619?uo=4') {
  return {
    ok: true,
    json: async () => ({ resultCount: 1, results: [{ version, trackViewUrl }] }),
  };
}

describe('holeStoreVersion', () => {
  beforeEach(() => {
    _nurFuerTests_reset();
  });

  it('liefert Version und iOS-URL aus dem iTunes-Lookup', async () => {
    const fetchImpl = vi.fn(async () => lookupAntwort('2.1.1'));
    const ergebnis = await holeStoreVersion({ fetchImpl });
    expect(ergebnis).toEqual({
      version: '2.1.1',
      iosUrl: 'https://apps.apple.com/de/app/konfi-quest/id6748016619?uo=4',
    });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][0]).toBe(LOOKUP_URL);
  });

  it('cacht das Ergebnis: zweiter Aufruf innerhalb der TTL fragt nicht erneut', async () => {
    const fetchImpl = vi.fn(async () => lookupAntwort('2.1.1'));
    let zeit = 1_000_000;
    const jetzt = () => zeit;
    await holeStoreVersion({ fetchImpl, jetzt });
    zeit += 5 * 60 * 60 * 1000; // 5h spaeter, TTL ist 6h
    const zweiter = await holeStoreVersion({ fetchImpl, jetzt });
    expect(zweiter.version).toBe('2.1.1');
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it('fragt nach Ablauf der TTL erneut und uebernimmt die neue Version', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(lookupAntwort('2.1.1'))
      .mockResolvedValueOnce(lookupAntwort('2.2.0'));
    let zeit = 1_000_000;
    const jetzt = () => zeit;
    const erster = await holeStoreVersion({ fetchImpl, jetzt });
    expect(erster.version).toBe('2.1.1');
    zeit += 7 * 60 * 60 * 1000; // 7h spaeter, TTL abgelaufen
    const zweiter = await holeStoreVersion({ fetchImpl, jetzt });
    expect(zweiter.version).toBe('2.2.0');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('liefert null (und wirft nicht), wenn der Lookup fehlschlaegt', async () => {
    const fetchImpl = vi.fn(async () => { throw new Error('Netz tot'); });
    const ergebnis = await holeStoreVersion({ fetchImpl });
    expect(ergebnis).toBeNull();
  });

  it('liefert null bei HTTP-Fehlerstatus', async () => {
    const fetchImpl = vi.fn(async () => ({ ok: false, json: async () => ({}) }));
    expect(await holeStoreVersion({ fetchImpl })).toBeNull();
  });

  it('liefert null bei leerem Lookup (App nicht gefunden)', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({ resultCount: 0, results: [] }),
    }));
    expect(await holeStoreVersion({ fetchImpl })).toBeNull();
  });

  it('verwirft unplausible Versionsstrings statt sie weiterzureichen', async () => {
    const fetchImpl = vi.fn(async () => lookupAntwort('Varies with device'));
    expect(await holeStoreVersion({ fetchImpl })).toBeNull();
  });

  it('faellt bei fehlender trackViewUrl auf die feste App-Store-URL zurueck', async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({ resultCount: 1, results: [{ version: '2.1.1' }] }),
    }));
    const ergebnis = await holeStoreVersion({ fetchImpl });
    expect(ergebnis).toEqual({ version: '2.1.1', iosUrl: APP_STORE_URL_FALLBACK });
  });

  it('behaelt nach TTL-Ablauf den alten Wert, wenn der neue Lookup scheitert (stale-on-error)', async () => {
    const fetchImpl = vi.fn()
      .mockResolvedValueOnce(lookupAntwort('2.1.1'))
      .mockRejectedValueOnce(new Error('Netz tot'));
    let zeit = 1_000_000;
    const jetzt = () => zeit;
    await holeStoreVersion({ fetchImpl, jetzt });
    zeit += 7 * 60 * 60 * 1000;
    const stale = await holeStoreVersion({ fetchImpl, jetzt });
    expect(stale.version).toBe('2.1.1');
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('fragt nach einem Fehlschlag 5 Minuten lang nicht erneut an', async () => {
    const fetchImpl = vi.fn(async () => { throw new Error('Netz tot'); });
    let zeit = 1_000_000;
    const jetzt = () => zeit;
    expect(await holeStoreVersion({ fetchImpl, jetzt })).toBeNull();
    zeit += 60 * 1000; // 1 Minute spaeter: noch gesperrt
    expect(await holeStoreVersion({ fetchImpl, jetzt })).toBeNull();
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    zeit += 5 * 60 * 1000; // Sperre abgelaufen: neuer Versuch
    await holeStoreVersion({ fetchImpl, jetzt });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it('Play-Store-URL zeigt auf das richtige Paket', () => {
    expect(PLAY_STORE_URL).toBe('https://play.google.com/store/apps/details?id=de.godsapp.konfiquest');
  });
});
