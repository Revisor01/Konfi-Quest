import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dateien, cacheInhalt, blobText, objectUrlAttrappe } from '../medienAttrappen';

// Ein Medien-Cache für Chat UND Challenges (27.09.2026, Simon: "Wir brauchen
// bei den Bildern und Files in Challenges auch einen Geräte-Cache, sonst wird
// das alles immer wieder gelesen. [...] Das kann ja ein System sein. Und wir
// haben ja einen Medien-Cache!").
//
// Geprüft wird der ECHTE mediaCache gegen ein Dateisystem im Speicher und eine
// gezählte API. Die Zahl, um die es geht: Wie oft fragt die App den Server?

vi.mock('@capacitor/filesystem', async () => (await import('../medienAttrappen')).dateisystemModul);

const apiGet = vi.fn();
vi.mock('../../services/api', () => ({
  default: { get: (...args: unknown[]) => apiGet(...args) },
  DATEI_TIMEOUT_MS: 180000,
}));

import {
  getMediaBlob,
  getMediaObjectUrl,
  getCachedObjectUrl,
  istGecacht,
  clearMediaCache,
  getMediaCacheSize,
  medienVergessen,
  medienApiPfad,
  medienAusApiPfad,
  mimeAusDateiname,
  grenzeDurchsetzen,
} from '../../services/mediaCache';

// Der Server liefert je Route einen erkennbaren Inhalt — so zeigt sich, aus
// welcher Quelle ein Treffer stammt.
const serverAntwort = (route: string) => ({ data: new Blob([`inhalt:${route}`], { type: 'image/png' }) });

const aufrufeAn = (praefix: string) =>
  apiGet.mock.calls.filter(([route]) => String(route).startsWith(praefix)).length;

const NAME = '3a9616c3e76df800e7c1ac11bc3916802e09dd759f5be617675d8b4eeda1a3b3';

let urls: ReturnType<typeof objectUrlAttrappe>;

beforeEach(async () => {
  await clearMediaCache();
  dateien.clear();
  apiGet.mockReset();
  apiGet.mockImplementation(async (route: string) => serverAntwort(route));
  urls = objectUrlAttrappe();
});

describe('Chat: verhält sich wie vor der Verallgemeinerung', () => {
  it('lädt über /chat/files/ mit Datei-Zeitlimit und Blob-Antwort', async () => {
    await getMediaBlob(NAME);

    expect(apiGet).toHaveBeenCalledTimes(1);
    const [route, optionen] = apiGet.mock.calls[0];
    expect(route).toBe(`/chat/files/${NAME}`);
    expect(optionen).toMatchObject({ responseType: 'blob', timeout: 180000 });
  });

  it('das zweite Öffnen fragt den Server nicht mehr: 1 statt 2 Aufrufe', async () => {
    await getMediaBlob(NAME);
    const zweites = await getMediaBlob(NAME);

    expect(apiGet).toHaveBeenCalledTimes(1);
    expect(await blobText(zweites)).toBe(`inhalt:/chat/files/${NAME}`);
  });

  it('reicht den Fortschritt wie bisher als zweites Argument durch', async () => {
    const fortschritt = vi.fn();
    apiGet.mockImplementation(async (route: string, optionen: { onDownloadProgress?: (e: { loaded: number; total?: number }) => void }) => {
      optionen.onDownloadProgress?.({ loaded: 50, total: 200 });
      return serverAntwort(route);
    });

    await getMediaBlob(NAME, fortschritt);

    expect(fortschritt).toHaveBeenCalledWith(25);
  });

  it('istGecacht und die geteilte Object-URL ohne Quelle meinen den Chat', async () => {
    expect(await istGecacht(NAME)).toBe(false);
    const url = await getMediaObjectUrl(NAME);

    expect(await istGecacht(NAME)).toBe(true);
    expect(getCachedObjectUrl(NAME)).toBe(url);
    expect(aufrufeAn('/chat/files/')).toBe(1);
  });
});

describe('Challenges: dieselbe Datei wird nur einmal geladen', () => {
  it('lädt über /challenges/files/', async () => {
    await getMediaBlob(NAME, { quelle: 'challenges' });

    expect(apiGet.mock.calls[0][0]).toBe(`/challenges/files/${NAME}`);
  });

  it('zweites Öffnen derselben Challenge-Datei: 1 statt 2 Aufrufe', async () => {
    await getMediaObjectUrl(NAME, { quelle: 'challenges' });
    // Wie nach einem App-Neustart: Die Object-URLs im Speicher sind weg, die
    // Datei auf dem Gerät nicht.
    const vorher = cacheInhalt();
    const blob = await getMediaBlob(NAME, { quelle: 'challenges' });

    expect(aufrufeAn('/challenges/files/')).toBe(1);
    expect(vorher).toEqual([`challenges-${NAME}`]);
    expect(await blobText(blob)).toBe(`inhalt:/challenges/files/${NAME}`);
  });

  it('parallele Anfragen derselben Datei laufen als EIN Download', async () => {
    await Promise.all([
      getMediaBlob(NAME, { quelle: 'challenges' }),
      getMediaBlob(NAME, { quelle: 'challenges' }),
    ]);

    expect(aufrufeAn('/challenges/files/')).toBe(1);
  });
});

describe('Gleiche Dateinamen aus Chat und Challenge kollidieren nicht', () => {
  it('legt zwei Einträge an und liefert jedem seinen eigenen Inhalt', async () => {
    const ausChat = await getMediaBlob(NAME);
    const ausChallenge = await getMediaBlob(NAME, { quelle: 'challenges' });

    expect(apiGet).toHaveBeenCalledTimes(2);
    expect(cacheInhalt()).toEqual([`challenges-${NAME}`, `chat-${NAME}`]);
    expect(await blobText(ausChat)).toBe(`inhalt:/chat/files/${NAME}`);
    expect(await blobText(ausChallenge)).toBe(`inhalt:/challenges/files/${NAME}`);
  });

  it('auch die Object-URLs im Speicher sind je Quelle getrennt', async () => {
    const chatUrl = await getMediaObjectUrl(NAME);

    expect(getCachedObjectUrl(NAME, 'challenges')).toBeNull();
    const challengeUrl = await getMediaObjectUrl(NAME, { quelle: 'challenges' });
    expect(challengeUrl).not.toBe(chatUrl);
    expect(getCachedObjectUrl(NAME, 'chat')).toBe(chatUrl);
    expect(getCachedObjectUrl(NAME, 'challenges')).toBe(challengeUrl);
  });

  it('ein Treffer im Chat-Cache beantwortet keine Challenge-Anfrage', async () => {
    await getMediaBlob(NAME);
    await getMediaBlob(NAME, { quelle: 'challenges' });
    await getMediaBlob(NAME, { quelle: 'challenges' });

    expect(aufrufeAn('/chat/files/')).toBe(1);
    expect(aufrufeAn('/challenges/files/')).toBe(1);
  });
});

describe('Eine Grenze, eine Größe, ein "Cache leeren" für alle Quellen', () => {
  it('die Größe zählt Chat und Challenges zusammen', async () => {
    await getMediaBlob('aaa');
    await getMediaBlob('bbb', { quelle: 'challenges' });

    const erwartet = [...dateien.values()].reduce((s, d) => s + d.size, 0);
    expect(dateien.size).toBe(2);
    expect(await getMediaCacheSize()).toBe(erwartet);
  });

  it('"Cache leeren" leert beides — danach wird wieder geladen', async () => {
    const chatUrl = await getMediaObjectUrl('aaa');
    const challengeUrl = await getMediaObjectUrl('bbb', { quelle: 'challenges' });

    await clearMediaCache();

    expect(cacheInhalt()).toEqual([]);
    expect(getCachedObjectUrl('aaa')).toBeNull();
    expect(getCachedObjectUrl('bbb', 'challenges')).toBeNull();
    expect(urls.freigegeben).toEqual(expect.arrayContaining([chatUrl, challengeUrl]));

    await getMediaBlob('aaa');
    await getMediaBlob('bbb', { quelle: 'challenges' });
    expect(aufrufeAn('/chat/files/')).toBe(2);
    expect(aufrufeAn('/challenges/files/')).toBe(2);
  });

  it('die Grenze gibt die Object-URL einer verdrängten Datei frei', async () => {
    const url = await getMediaObjectUrl('bbb', { quelle: 'challenges' });
    // Den Eintrag künstlich über die Grenze von 500 MB heben.
    dateien.get('media-cache/challenges-bbb')!.size = 501 * 1024 * 1024;

    await grenzeDurchsetzen();

    expect(cacheInhalt()).toEqual([]);
    expect(getCachedObjectUrl('bbb', 'challenges')).toBeNull();
    expect(urls.freigegeben).toContain(url);
  });
});

describe('Eine einzelne Datei vergessen', () => {
  it('nimmt nur diese Datei der genannten Quelle heraus', async () => {
    await getMediaObjectUrl(NAME);
    const url = await getMediaObjectUrl(NAME, { quelle: 'challenges' });

    await medienVergessen(NAME, 'challenges');

    expect(cacheInhalt()).toEqual([`chat-${NAME}`]);
    expect(getCachedObjectUrl(NAME, 'challenges')).toBeNull();
    expect(urls.freigegeben).toEqual([url]);
  });
});

describe('Netz zuerst: der Server entscheidet, der Cache hilft nur ohne Netz', () => {
  it('fragt online jedes Mal den Server', async () => {
    await getMediaBlob(NAME, { quelle: 'challenges', netzZuerst: true });
    await getMediaBlob(NAME, { quelle: 'challenges', netzZuerst: true });

    expect(aufrufeAn('/challenges/files/')).toBe(2);
  });

  it('meldet der Server die Datei als gelöscht (404), fliegt sie aus dem Cache', async () => {
    await getMediaBlob(NAME, { quelle: 'challenges', netzZuerst: true });
    apiGet.mockRejectedValueOnce(Object.assign(new Error('404'), { response: { status: 404 } }));

    await expect(getMediaBlob(NAME, { quelle: 'challenges', netzZuerst: true })).rejects.toThrow('404');
    expect(cacheInhalt()).toEqual([]);
  });

  it('kein Zugriff mehr (403) wirkt genauso', async () => {
    await getMediaBlob(NAME, { quelle: 'challenges', netzZuerst: true });
    apiGet.mockRejectedValueOnce(Object.assign(new Error('403'), { response: { status: 403 } }));

    await expect(getMediaBlob(NAME, { quelle: 'challenges', netzZuerst: true })).rejects.toThrow('403');
    expect(cacheInhalt()).toEqual([]);
  });

  it('ohne Netz kommt die Datei aus dem Cache', async () => {
    await getMediaBlob(NAME, { quelle: 'challenges', netzZuerst: true });
    apiGet.mockRejectedValueOnce(Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' }));

    const blob = await getMediaBlob(NAME, { quelle: 'challenges', netzZuerst: true });

    expect(await blobText(blob)).toBe(`inhalt:/challenges/files/${NAME}`);
    expect(cacheInhalt()).toEqual([`challenges-${NAME}`]);
  });
});

// Material und Nachweisfotos (27.09.2026, Simon: „Fotos Anträge und Material
// ja bitte."). Material bleibt wie Chat und Challenges auf dem Gerät; die
// Nachweisfotos laufen über denselben Lader, landen aber nie im Cache
// (Begründung in mediaCache.ts, NUR_ANZEIGEN).
describe('Material: eigene Quelle, eine Datei wird nur einmal geladen', () => {
  it('lädt über /material/files/ mit Datei-Zeitlimit und Blob-Antwort', async () => {
    await getMediaBlob(NAME, { quelle: 'material' });

    const [route, optionen] = apiGet.mock.calls[0];
    expect(route).toBe(`/material/files/${NAME}`);
    expect(optionen).toMatchObject({ responseType: 'blob', timeout: 180000 });
    expect(cacheInhalt()).toEqual([`material-${NAME}`]);
  });

  it('zweites Öffnen derselben Material-Datei: 1 statt 2 Aufrufe', async () => {
    await getMediaBlob(NAME, { quelle: 'material' });
    const zweites = await getMediaBlob(NAME, { quelle: 'material' });

    expect(aufrufeAn('/material/files/')).toBe(1);
    expect(await blobText(zweites)).toBe(`inhalt:/material/files/${NAME}`);
  });

  it('gleicher Name in Chat, Challenges und Material: drei Einträge, jeder mit seinem Inhalt', async () => {
    const ausChat = await getMediaBlob(NAME);
    const ausChallenge = await getMediaBlob(NAME, { quelle: 'challenges' });
    const ausMaterial = await getMediaBlob(NAME, { quelle: 'material' });
    // Jede Quelle ein zweites Mal: kein Treffer der einen beantwortet die andere.
    await getMediaBlob(NAME);
    await getMediaBlob(NAME, { quelle: 'challenges' });
    await getMediaBlob(NAME, { quelle: 'material' });

    expect(apiGet).toHaveBeenCalledTimes(3);
    expect(cacheInhalt()).toEqual([`challenges-${NAME}`, `chat-${NAME}`, `material-${NAME}`]);
    expect(await blobText(ausChat)).toBe(`inhalt:/chat/files/${NAME}`);
    expect(await blobText(ausChallenge)).toBe(`inhalt:/challenges/files/${NAME}`);
    expect(await blobText(ausMaterial)).toBe(`inhalt:/material/files/${NAME}`);
  });

  it('"Cache leeren" nimmt Material mit', async () => {
    const url = await getMediaObjectUrl(NAME, { quelle: 'material' });
    await getMediaBlob(NAME);

    await clearMediaCache();

    expect(cacheInhalt()).toEqual([]);
    expect(getCachedObjectUrl(NAME, 'material')).toBeNull();
    expect(urls.freigegeben).toContain(url);
  });
});

describe('Nachweisfotos: laden ja, auf dem Gerät ablegen nie', () => {
  it('Konfi und Team laden über die eigene Route — mit Zeitlimit, ohne Spur auf dem Gerät', async () => {
    const blob = await getMediaBlob('41', { quelle: 'nachweisfoto' });

    const [route, optionen] = apiGet.mock.calls[0];
    expect(route).toBe('/konfi/activity-requests/41/photo');
    expect(optionen).toMatchObject({ responseType: 'blob', timeout: 180000 });
    expect(await blobText(blob)).toBe('inhalt:/konfi/activity-requests/41/photo');
    expect(dateien.size).toBe(0);
  });

  it('die Leitung lädt über ihre Route, ebenfalls ohne Spur', async () => {
    await getMediaBlob('41', { quelle: 'nachweisfotoLeitung' });

    expect(apiGet.mock.calls[0][0]).toBe('/admin/activities/requests/41/photo');
    expect(dateien.size).toBe(0);
  });

  it('jedes Öffnen fragt den Server: 2 Öffnungen, 2 Aufrufe — bewusst', async () => {
    await getMediaBlob('41', { quelle: 'nachweisfotoLeitung' });
    await getMediaBlob('41', { quelle: 'nachweisfotoLeitung' });

    expect(aufrufeAn('/admin/activities/requests/')).toBe(2);
    expect(await istGecacht('41', 'nachweisfotoLeitung')).toBe(false);
  });

  it('der Fortschritt kommt trotzdem an', async () => {
    const fortschritt = vi.fn();
    apiGet.mockImplementation(async (route: string, optionen: { onDownloadProgress?: (e: { loaded: number; total?: number }) => void }) => {
      optionen.onDownloadProgress?.({ loaded: 30, total: 100 });
      return serverAntwort(route);
    });

    await getMediaBlob('41', { quelle: 'nachweisfoto', onFortschritt: fortschritt });

    expect(fortschritt).toHaveBeenCalledWith(30);
  });

  it('eine geteilte Object-URL gibt es dafür nicht', async () => {
    await expect(getMediaObjectUrl('41', { quelle: 'nachweisfoto' })).rejects.toThrow('wird nicht geteilt');
    expect(getCachedObjectUrl('41', 'nachweisfoto')).toBeNull();
    expect(apiGet).not.toHaveBeenCalled();
  });
});

describe('Pfade und Typen', () => {
  it('baut die Route je Quelle', () => {
    expect(medienApiPfad('ab12')).toBe('/chat/files/ab12');
    expect(medienApiPfad('ab12', 'challenges')).toBe('/challenges/files/ab12');
  });

  it('erkennt eine Medien-Route in einem API-Pfad, mit und ohne /api', () => {
    expect(medienAusApiPfad('/api/chat/files/ab12')).toEqual({ quelle: 'chat', datei: 'ab12' });
    expect(medienAusApiPfad('/challenges/files/ab12')).toEqual({ quelle: 'challenges', datei: 'ab12' });
    // Seit dem 27.09.2026 läuft auch Material über den Cache — bis dahin
    // stand hier null ("Material weiter direkt").
    expect(medienAusApiPfad('/api/material/files/ab12')).toEqual({ quelle: 'material', datei: 'ab12' });
    expect(medienAusApiPfad('/api/chat/files/')).toBeNull();
  });

  it('Nachweisfotos hängen am Antrag und werden nie als Cache-Datei erkannt', () => {
    expect(medienApiPfad('41', 'nachweisfoto')).toBe('/konfi/activity-requests/41/photo');
    expect(medienApiPfad('41', 'nachweisfotoLeitung')).toBe('/admin/activities/requests/41/photo');
    expect(medienAusApiPfad('/api/konfi/activity-requests/41/photo')).toBeNull();
    expect(medienAusApiPfad('/api/admin/activities/requests/41/photo')).toBeNull();
  });

  it('leitet den MIME-Typ aus dem Originalnamen ab', () => {
    expect(mimeAusDateiname('foto.PNG')).toBe('image/png');
    expect(mimeAusDateiname('clip.mov')).toBe('video/quicktime');
    expect(mimeAusDateiname('stimme.m4a')).toBe('audio/mp4');
    expect(mimeAusDateiname('ohne-endung')).toBe('application/octet-stream');
    expect(mimeAusDateiname(null)).toBe('application/octet-stream');
  });
});
