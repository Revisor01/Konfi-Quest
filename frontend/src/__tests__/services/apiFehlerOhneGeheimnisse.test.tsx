// Fehler der API-Instanz tragen keine Tokens und keine Anfragekoerper mehr
// (Audit Grundgeruest BF-08, Nebenbefund).
//
// Rund 100 Stellen in der App geben einen gefangenen Fehler roh an die Konsole
// (`console.error('…', err)`). Ein axios-Fehler traegt die gesendete Anfrage
// mit: `config.headers.Authorization` (Zugangs-Token), `config.data` (der
// Koerper -- Texte, Begruendungen, beim Refresh der Refresh-Token) und
// `request` (die Leitung samt Kopfzeilen). Nach einem gescheiterten Refresh
// bekamen die wartenden Anfragen sogar den Refresh-Fehler mit dem
// Refresh-Token im Koerper.
//
// Geloest ist das zentral in api.ts: Jeder Fehler wird entschaerft, BEVOR die
// Instanz ihn an den Aufrufer gibt -- und erst dann, damit die Wiederholung
// nach einem Refresh und die von axios-retry Kopfzeilen und Koerper noch
// haben. Geprueft wird mit der ECHTEN Instanz und echten AxiosError-Objekten;
// durchsucht wird jedes Feld jedes Konsolenaufrufs (protokollDurchsuchen).

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import React from 'react';
import { render, waitFor } from '@testing-library/react';
import axios, { AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios';
import { enthaeltText, konsoleMitschneiden } from '../protokollDurchsuchen';

const jwt = (marke: string): string => {
  const nutzlast = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600, marke }))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `kopf.${nutzlast}.signatur`;
};
const ZUGANG = jwt('zugang-geheim-7f3a');
const ZUGANG_NEU = jwt('zugang-neu-c1d2');
const REFRESH = 'refresh-geheim-91be04';
const PERSOENLICH = 'Oma ist gestorben, ich bin bei der Beerdigung';

let zugang = ZUGANG;
vi.mock('../../services/tokenStore', () => ({
  getToken: vi.fn(() => zugang),
  getRefreshToken: vi.fn(() => REFRESH),
  getActiveOrgId: vi.fn(() => null),
  getDeviceId: vi.fn(() => null),
  getUser: vi.fn(() => ({ id: 7 })),
  setToken: vi.fn(async (t: string) => { zugang = t; }),
  setRefreshToken: vi.fn(async () => undefined),
  setActiveOrgId: vi.fn(async () => undefined),
  clearAuth: vi.fn(async () => undefined),
  isLoggingOut: vi.fn(() => false),
}));
vi.mock('../../services/networkMonitor', () => ({
  networkMonitor: { isOnline: true, subscribe: vi.fn(() => () => undefined) },
}));
vi.mock('../../services/biometrics', () => ({
  rotationUebernehmen: vi.fn(async () => undefined),
  istBiometrieAktiv: vi.fn(async () => false),
}));

// Fuer die Warteschlange: Preferences als Map, kein Toast.
const prefs = new Map<string, string>();
vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: vi.fn(async ({ key }: { key: string }) => ({ value: prefs.get(key) ?? null })),
    set: vi.fn(async ({ key, value }: { key: string; value: string }) => { prefs.set(key, value); }),
    remove: vi.fn(async ({ key }: { key: string }) => { prefs.delete(key); }),
  },
}));
vi.mock('@ionic/core', async () => {
  const echt = await vi.importActual<typeof import('@ionic/core')>('@ionic/core');
  return { ...echt, toastController: { create: vi.fn(async () => ({ present: vi.fn() })) } };
});

import api from '../../services/api';
import { writeQueue } from '../../services/writeQueue';
import PointsHistoryModal from '../../components/konfi/modals/PointsHistoryModal';

interface Versuch { url: string; methode: string; authorization: unknown; daten: unknown }
let versuche: Versuch[] = [];

/**
 * Baut einen axios-Fehler wie ein echter Adapter: `config` ist die gesendete
 * Konfiguration (mit Kopfzeilen und Koerper), `request` die Leitung -- hier
 * wie beim Node-Adapter mit den rohen Kopfzeilen.
 */
function fehlerFuer(config: InternalAxiosRequestConfig, status?: number, antwort: Record<string, unknown> = {}) {
  const leitung = { _header: `${String(config.method).toUpperCase()} ${config.url}\r\nAuthorization: ${String(config.headers.Authorization)}\r\n`, body: config.data };
  if (status === undefined) {
    return new AxiosError('Network Error', AxiosError.ERR_NETWORK, config, leitung);
  }
  return new AxiosError(
    `Request failed with status code ${status}`,
    status >= 500 ? AxiosError.ERR_BAD_RESPONSE : AxiosError.ERR_BAD_REQUEST,
    config,
    leitung,
    { status, statusText: '', headers: {}, config, data: antwort, request: leitung }
  );
}

/** Adapter: antwortet der Reihe nach mit den Ergebnissen (Zahl = Status, null = Netzfehler, 'ok' = 200). */
function adapterMit(...folge: Array<number | null | 'ok'>) {
  let i = 0;
  api.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
    versuche.push({ url: config.url || '', methode: String(config.method), authorization: config.headers.Authorization, daten: config.data });
    const schritt = folge[Math.min(i, folge.length - 1)];
    i += 1;
    if (schritt === 'ok') return { status: 200, statusText: 'OK', headers: {}, config, data: { ok: true } };
    throw fehlerFuer(config, schritt ?? undefined, schritt ? { error: 'Datenbankfehler' } : {});
  };
}

// Wartezeit von axios-retry auf 0 -- sonst dauern die wiederholenden Faelle.
const sofort: AxiosRequestConfig = { 'axios-retry': { retryDelay: () => 0 } };

/** Die typische Stelle in der App: Fehler fangen und roh ausgeben. */
async function typischeStelle(anfrage: () => Promise<unknown>) {
  try {
    await anfrage();
  } catch (err) {
    console.error('Fehler beim Speichern:', err);
    return err;
  }
  return undefined;
}

let konsole: ReturnType<typeof konsoleMitschneiden>;

beforeEach(() => {
  vi.clearAllMocks();
  zugang = ZUGANG;
  versuche = [];
  prefs.clear();
  konsole = konsoleMitschneiden();
});

afterEach(() => {
  konsole.beenden();
  vi.restoreAllMocks();
});

describe('endgueltige Fehler der Instanz', () => {
  it('POST mit 500: im Protokoll weder Zugangs-Token noch Anfragekoerper -- Status und Servertext schon', async () => {
    adapterMit(500);

    const fehler = await typischeStelle(() => api.post('/konfi/events/3/opt-out', { reason: PERSOENLICH }, sofort));

    // Voraussetzung: Die Anfrage ging MIT Token und Koerper hinaus.
    expect(versuche).toHaveLength(1);
    expect(versuche[0].authorization).toBe(`Bearer ${ZUGANG}`);
    expect(String(versuche[0].daten)).toContain(PERSOENLICH);

    expect(konsole.enthaelt(ZUGANG)).toBe(false);
    expect(konsole.enthaelt(PERSOENLICH)).toBe(false);
    expect(enthaeltText(fehler, ZUGANG)).toBe(false);
    // Erlaubt und gewollt: was die App fuer ihre Meldungen braucht.
    expect(fehler).toMatchObject({ response: { status: 500, data: { error: 'Datenbankfehler' } }, code: 'ERR_BAD_RESPONSE' });
    expect(konsole.enthaelt('Datenbankfehler')).toBe(true);
    expect(konsole.enthaelt('/konfi/events/3/opt-out')).toBe(true);
  });

  it('GET mit Netzfehler: axios-retry wiederholt dreimal MIT Token, der endgueltige Fehler traegt keines', async () => {
    adapterMit(null);

    const fehler = await typischeStelle(() => api.get('/konfi/events', sofort));

    expect(versuche).toHaveLength(4);
    expect(versuche.every(v => v.authorization === `Bearer ${ZUGANG}`)).toBe(true);
    expect(konsole.enthaelt(ZUGANG)).toBe(false);
    expect((fehler as AxiosError).code).toBe('ERR_NETWORK');
  });

  it('PUT mit 503: jede Wiederholung traegt Koerper und Token, der endgueltige Fehler nicht', async () => {
    adapterMit(503);

    const fehler = await typischeStelle(() => api.put('/konfi/bible-translation', { notiz: PERSOENLICH }, sofort));

    expect(versuche).toHaveLength(4);
    expect(versuche.every(v => String(v.daten).includes(PERSOENLICH))).toBe(true);
    expect(versuche.every(v => v.authorization === `Bearer ${ZUGANG}`)).toBe(true);
    expect(enthaeltText(fehler, PERSOENLICH)).toBe(false);
    expect(enthaeltText(fehler, ZUGANG)).toBe(false);
    expect(konsole.enthaelt(ZUGANG)).toBe(false);
  });

  it('scheitert der Refresh, tragen weder die ausloesende noch die wartende Anfrage den Refresh-Token ins Protokoll', async () => {
    adapterMit(401);
    let refreshAblehnen: (f: unknown) => void = () => undefined;
    vi.spyOn(axios, 'post').mockImplementation((url: string, koerper: unknown) => new Promise((_, ablehnen) => {
      refreshAblehnen = () => {
        const config = { url, method: 'post', data: JSON.stringify(koerper), headers: {} } as unknown as InternalAxiosRequestConfig;
        ablehnen(fehlerFuer(config, 401, { error: 'Ungültiger oder abgelaufener Refresh-Token' }));
      };
    }));

    const erste = typischeStelle(() => api.get('/a'));
    await vi.waitFor(() => expect(axios.post).toHaveBeenCalledTimes(1));
    const zweite = typischeStelle(() => api.get('/b'));
    await vi.waitFor(() => expect(versuche.map(v => v.url)).toContain('/b'));
    refreshAblehnen(undefined);
    const [f1, f2] = await Promise.all([erste, zweite]);

    // Voraussetzung: Der Refresh ging mit dem Refresh-Token im Koerper hinaus
    // (jsdom = Web-Version, dazu die Zusage fuer Konten ohne Gemeinde,
    // services/ohneGemeinde.ts).
    expect(vi.mocked(axios.post).mock.calls[0][1]).toEqual({ refresh_token: REFRESH, kann_ohne_gemeinde: true });
    expect(konsole.aufrufe()).toHaveLength(2);
    expect(konsole.enthaelt(REFRESH)).toBe(false);
    expect(konsole.enthaelt(ZUGANG)).toBe(false);
    expect(enthaeltText(f1, REFRESH)).toBe(false);
    expect(enthaeltText(f2, REFRESH)).toBe(false);
    expect(f1).toMatchObject({ response: { status: 401 } });
  });

  it('eine gerenderte Ansicht (Punkte-Verlauf) loggt ihren Ladefehler ohne Zugangs-Token', async () => {
    // 404 statt 500: GET-Fehler 5xx wiederholt axios-retry mit Wartezeit,
    // und die Ansicht setzt keine eigene -- fuer die Pruefung egal.
    adapterMit(404);

    render(<PointsHistoryModal onClose={() => undefined} />);

    await waitFor(() => expect(konsole.aufrufe().some(a => a[0] === 'Error loading points history:')).toBe(true));
    expect(versuche[0].authorization).toBe(`Bearer ${ZUGANG}`);
    expect(konsole.enthaelt(ZUGANG)).toBe(false);
  });
});

describe('erlaubt: Wiederholungen brauchen Kopfzeilen und Koerper noch', () => {
  it('nach einem Refresh geht die Anfrage mit DEMSELBEN Koerper und dem neuen Token erneut hinaus', async () => {
    adapterMit(401, 'ok');
    vi.spyOn(axios, 'post').mockResolvedValue({ data: { token: ZUGANG_NEU, refresh_token: 'refresh-2' } });

    const antwort = await api.post('/konfi/events/3/opt-out', { reason: PERSOENLICH });

    expect(antwort.data).toEqual({ ok: true });
    expect(versuche).toHaveLength(2);
    expect(versuche[1].daten).toBe(versuche[0].daten);
    expect(String(versuche[1].daten)).toContain(PERSOENLICH);
    expect(versuche[1].authorization).toBe(`Bearer ${ZUGANG_NEU}`);
  });

  it('die Warteschlange: 503 behaelt den Eintrag samt Koerper, der naechste Lauf mit Refresh stellt zu', async () => {
    const { enqueue, flush, getAll } = writeQueue;
    await enqueue({
      method: 'POST',
      url: '/konfi/events/3/opt-out',
      body: { reason: PERSOENLICH, client_id: '6f1c2b1e-8a0d-4b43-9d6c-2f1f8b7e4a11' },
      maxRetries: 5,
      hasFileUpload: false,
      metadata: { type: 'opt-out', clientId: '6f1c2b1e-8a0d-4b43-9d6c-2f1f8b7e4a11', label: 'Abmeldung' },
    });

    adapterMit(503);
    const erster = await flush();
    expect(erster).toEqual({ succeeded: [], failed: [] });
    const [wartend] = await getAll();
    expect(wartend.retryCount).toBe(1);
    expect(wartend.body?.reason).toBe(PERSOENLICH);

    versuche = [];
    adapterMit(401, 'ok');
    vi.spyOn(axios, 'post').mockResolvedValue({ data: { token: ZUGANG_NEU, refresh_token: 'refresh-2' } });
    const zweiter = await flush();

    expect(zweiter.succeeded).toHaveLength(1);
    expect(await getAll()).toEqual([]);
    expect(versuche).toHaveLength(2);
    expect(String(versuche[1].daten)).toContain(PERSOENLICH);
    expect(versuche[1].authorization).toBe(`Bearer ${ZUGANG_NEU}`);
  });
});
