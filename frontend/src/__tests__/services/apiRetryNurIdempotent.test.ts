// axios-retry wiederholt keine schreibenden POST/PATCH mehr
// (Audit 26.09.2026, App-Grundgeruest BF-02)
//
// axios-retry schliesst POST in isNetworkOrIdempotentRequestError bewusst
// aus. Die eigene Bedingung in api.ts hob das auf: `status >= 500` und die
// Zeitueberschreitungs-Klausel galten fuer jede Methode. Ein POST, dessen
// Antwort nach 20 s nicht da war, obwohl der Server laengst geschrieben
// hatte, wurde bis zu dreimal neu gesendet -- 3 Bonuspunkte wurden 6, 9
// oder 12, ein Termin entstand mehrfach, eine Anmeldung endete als Fehler
// "bereits angemeldet", obwohl sie stand.
//
// Regel jetzt: POST und PATCH werden nur wiederholt, wenn der Aufrufer einen
// Idempotency-Key-Header setzt (dann darf der Server den zweiten Versuch
// erkennen -- die Server-Seite ist ein eigener Schritt, hier geht es um die
// Client-Regel). GET/HEAD/OPTIONS/PUT/DELETE bleiben wie bisher; 429 wird
// weiterhin nie wiederholt.
//
// Gemessen wird mit der ECHTEN api-Instanz und dem echten axios-retry: Der
// Adapter zaehlt, wie oft ein Request den Draht erreicht. Die Wartezeit
// zwischen Versuchen wird je Aufruf auf 0 gesetzt (per-Request-Option von
// axios-retry); Anzahl und Bedingung kommen aus api.ts.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AxiosError, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios';

vi.mock('../../services/tokenStore', () => ({
  getToken: vi.fn(() => null),
  getRefreshToken: vi.fn(() => null),
  getActiveOrgId: vi.fn(() => null),
  setToken: vi.fn(),
  setRefreshToken: vi.fn(),
  setActiveOrgId: vi.fn(),
  clearAuth: vi.fn(),
  isLoggingOut: vi.fn(() => false),
}));
vi.mock('../../services/networkMonitor', () => ({
  networkMonitor: { isOnline: true },
}));
vi.mock('../../services/biometrics', () => ({
  rotationUebernehmen: vi.fn(),
}));

import api from '../../services/api';

type Fehlerart = 503 | 500 | 429 | 'ECONNABORTED' | 'ERR_NETWORK';

let versuche = 0;

/** Adapter, der jeden Versuch zaehlt und immer auf dieselbe Art scheitert. */
function scheitereMit(art: Fehlerart) {
  versuche = 0;
  api.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
    versuche += 1;
    if (typeof art === 'number') {
      throw new AxiosError(
        `Request failed with status code ${art}`,
        art >= 500 ? AxiosError.ERR_BAD_RESPONSE : AxiosError.ERR_BAD_REQUEST,
        config,
        {},
        { status: art, statusText: '', headers: {}, config, data: {} }
      );
    }
    throw new AxiosError(art === 'ECONNABORTED' ? 'timeout of 20000ms exceeded' : 'Network Error', art, config, {});
  };
}

// Wartezeit 0 -- sonst dauert jeder wiederholende Fall ueber eine Sekunde.
const sofort: AxiosRequestConfig = { 'axios-retry': { retryDelay: () => 0 } };

async function anfrage(methode: 'get' | 'post' | 'put' | 'patch' | 'delete', extra: AxiosRequestConfig = {}) {
  const config = { ...sofort, ...extra, headers: { ...(extra.headers || {}) } };
  try {
    if (methode === 'get' || methode === 'delete') {
      await api[methode]('/probe', config);
    } else {
      await api[methode]('/probe', { wert: 1 }, config);
    }
  } catch {
    // Jeder Fall scheitert absichtlich -- gezaehlt wird, wie oft.
  }
  return versuche;
}

beforeEach(() => {
  versuche = 0;
});

describe('Lesende Anfragen werden bei 5xx und Netzfehlern wiederholt (wie bisher)', () => {
  it('GET bei 503: 4 Versuche (1 + 3 Wiederholungen)', async () => {
    scheitereMit(503);
    expect(await anfrage('get')).toBe(4);
  });

  it('GET bei Zeitueberschreitung (ECONNABORTED): 4 Versuche', async () => {
    scheitereMit('ECONNABORTED');
    expect(await anfrage('get')).toBe(4);
  });

  it('PUT bei 500: 4 Versuche -- PUT ist idempotent', async () => {
    scheitereMit(500);
    expect(await anfrage('put')).toBe(4);
  });

  it('DELETE bei 503: 4 Versuche -- DELETE ist idempotent', async () => {
    scheitereMit(503);
    expect(await anfrage('delete')).toBe(4);
  });

  it('Gegenprobe: GET bei 429 wird nie wiederholt (Retry-Lawine)', async () => {
    scheitereMit(429);
    expect(await anfrage('get')).toBe(1);
  });
});

describe('Schreibende POST/PATCH ohne Idempotenzschluessel werden NICHT wiederholt', () => {
  it('POST bei 503: genau 1 Versuch', async () => {
    scheitereMit(503);
    expect(await anfrage('post')).toBe(1);
  });

  it('POST bei 500: genau 1 Versuch', async () => {
    scheitereMit(500);
    expect(await anfrage('post')).toBe(1);
  });

  it('POST bei Zeitueberschreitung (ECONNABORTED): genau 1 Versuch -- der Server kann laengst geschrieben haben', async () => {
    scheitereMit('ECONNABORTED');
    expect(await anfrage('post')).toBe(1);
  });

  it('POST bei Netzfehler (ERR_NETWORK): genau 1 Versuch', async () => {
    scheitereMit('ERR_NETWORK');
    expect(await anfrage('post')).toBe(1);
  });

  it('PATCH bei 503: genau 1 Versuch', async () => {
    scheitereMit(503);
    expect(await anfrage('patch')).toBe(1);
  });
});

describe('Mit Idempotency-Key darf auch ein POST wiederholt werden', () => {
  it('POST mit Idempotency-Key bei 503: 4 Versuche', async () => {
    scheitereMit(503);
    expect(await anfrage('post', { headers: { 'Idempotency-Key': 'a1b2c3' } })).toBe(4);
  });

  it('POST mit Idempotency-Key bei Zeitueberschreitung: 4 Versuche', async () => {
    scheitereMit('ECONNABORTED');
    expect(await anfrage('post', { headers: { 'Idempotency-Key': 'a1b2c3' } })).toBe(4);
  });

  it('der Schluessel wird bei jedem Versuch unveraendert mitgesendet', async () => {
    versuche = 0;
    const gesehen: string[] = [];
    api.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
      versuche += 1;
      gesehen.push(String(config.headers['Idempotency-Key']));
      throw new AxiosError('503', AxiosError.ERR_BAD_RESPONSE, config, {}, { status: 503, statusText: '', headers: {}, config, data: {} });
    };
    await anfrage('post', { headers: { 'Idempotency-Key': 'gleich-bleibend' } });
    expect(gesehen).toEqual(['gleich-bleibend', 'gleich-bleibend', 'gleich-bleibend', 'gleich-bleibend']);
  });

  it('Gegenprobe: POST mit Idempotency-Key bei 429 bleibt bei 1 Versuch', async () => {
    scheitereMit(429);
    expect(await anfrage('post', { headers: { 'Idempotency-Key': 'a1b2c3' } })).toBe(1);
  });
});
