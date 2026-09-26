/**
 * Was kommt bei einem Fehler tatsaechlich bei der Messung an?
 *
 * Bis 14.09.2026 nur der gekuerzte Meldungstext — der `art`-Parameter von
 * `trackFehler` war seit seiner Einfuehrung toter Code, es gab genau einen
 * Aufrufer und der uebergab ihn nie. Damit stand bei jedem Fehler das WO
 * grob fest und das WARUM gar nicht, und die vier Stellen mit dem Text
 * "Fehler beim Öffnen der Datei" kamen als EIN Eintrag an.
 *
 * Diese Datei prueft am echten AppContext, dass jetzt drei Angaben ankommen
 * (Meldung, Ursache, Ort) — und dass trotzdem nichts Personenbezogenes
 * durchgeht.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import React from 'react';

vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => false, getPlatform: () => 'web' },
  registerPlugin: () => ({ forceAPNSRegistration: vi.fn(), forceTokenRetrieval: vi.fn() }),
}));
vi.mock('@capacitor/device', () => ({
  Device: { getId: vi.fn().mockResolvedValue({ identifier: 'test-device-id' }) },
}));
vi.mock('@capacitor/app', () => ({
  App: { addListener: vi.fn().mockResolvedValue({ remove: vi.fn() }), fireRestoredResult: vi.fn() },
}));
vi.mock('@capacitor/push-notifications', () => ({
  PushNotifications: {
    checkPermissions: vi.fn().mockResolvedValue({ receive: 'denied' }),
    requestPermissions: vi.fn().mockResolvedValue({ receive: 'denied' }),
    register: vi.fn().mockResolvedValue(undefined),
    addListener: vi.fn().mockResolvedValue({ remove: vi.fn() }),
    removeAllListeners: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock('@capawesome/capacitor-background-task', () => ({
  BackgroundTask: { beforeExit: vi.fn(), finish: vi.fn() },
}));
vi.mock('../../services/tokenStore', () => ({
  getUser: vi.fn().mockReturnValue(null),
  getDeviceId: vi.fn().mockReturnValue(null),
  setDeviceId: vi.fn().mockResolvedValue(undefined),
  getPushTokenTimestamp: vi.fn().mockReturnValue(0),
  setPushTokenTimestamp: vi.fn().mockResolvedValue(undefined),
  getToken: vi.fn().mockReturnValue(null),
  getRefreshToken: vi.fn().mockReturnValue(null),
  getActiveOrgId: vi.fn().mockReturnValue(null),
  setActiveOrgId: vi.fn(),
  setUser: vi.fn(),
  setToken: vi.fn(),
  setRefreshToken: vi.fn(),
  clearAuth: vi.fn(),
}));
vi.mock('../../services/networkMonitor', () => ({
  networkMonitor: { get isOnline() { return true; }, subscribe: vi.fn(() => () => {}), init: vi.fn() },
}));
vi.mock('../../services/writeQueue', () => ({
  writeQueue: {
    flush: vi.fn().mockResolvedValue({ succeeded: [], failed: [] }),
    flushTextOnly: vi.fn().mockResolvedValue({ succeeded: [], failed: [] }),
    clear: vi.fn().mockResolvedValue(undefined),
    getAll: vi.fn().mockResolvedValue([]),
  },
}));
vi.mock('../../services/offlineCache', () => ({
  offlineCache: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
    isStale: vi.fn().mockReturnValue(false),
    invalidateAll: vi.fn().mockResolvedValue(undefined),
    clearAll: vi.fn().mockResolvedValue(undefined),
  },
}));
vi.mock('../../services/api', () => ({
  default: {
    post: vi.fn().mockResolvedValue({ data: {} }),
    get: vi.fn().mockResolvedValue({ data: {} }),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  },
}));

// Der Kern dieser Datei: trackFehler wird abgefangen, die uebrigen
// Analytics-Funktionen bleiben stumme Attrappen. istGueltigeArt/istGueltigerOrt
// sind die ECHTEN — sie sind Teil dessen, was geprueft wird.
const mockTrackFehler = vi.fn();
vi.mock('../../services/analytics', async () => {
  const echt = await vi.importActual<typeof import('../../services/analytics')>(
    '../../services/analytics'
  );
  return {
    ...echt,
    trackFehler: (...args: unknown[]) => mockTrackFehler(...args),
    setAnalyticsRole: vi.fn(),
    trackSitzungsstart: vi.fn(),
    track: vi.fn(),
    trackBereich: vi.fn(),
  };
});

import { AppProvider, useApp, FehlerDiagnose } from '../../contexts/AppContext';

let letzterContext: ReturnType<typeof useApp>;
const Consumer: React.FC = () => {
  const ctx = useApp();
  // Im Effect nach aussen reichen, nicht waehrend des Renderns
  // (react-hooks/globals). Nach render() im act() steht der Wert.
  React.useEffect(() => {
    letzterContext = ctx;
  });
  return <span data-testid="error">{ctx.error || 'no-error'}</span>;
};

const melde = async (meldung: string, diagnose?: FehlerDiagnose) => {
  await act(async () => {
    letzterContext.setError(meldung, diagnose);
  });
};

const aufbauen = async () => {
  await act(async () => {
    render(
      <AppProvider>
        <Consumer />
      </AppProvider>
    );
  });
};

describe('trackFehler bekommt die Ursache mitgeliefert', () => {
  beforeEach(() => {
    mockTrackFehler.mockClear();
  });

  it('meldet bei einem 403 die Meldung, die Art http-### und den Ort', async () => {
    await aufbauen();
    await melde('Fehler beim Öffnen der Datei', {
      ort: 'chat-datei',
      fehler: { response: { status: 403, data: { error: 'Kein Zugriff' } } },
    });

    expect(mockTrackFehler).toHaveBeenCalledTimes(1);
    expect(mockTrackFehler).toHaveBeenCalledWith(
      'Fehler beim Öffnen der Datei',
      'http-403',
      'chat-datei'
    );
  });

  it('meldet einen Timeout als timeout, nicht als netz', async () => {
    await aufbauen();
    await melde('Fehler beim Öffnen der Datei', {
      ort: 'material-teamer-liste',
      fehler: { code: 'ECONNABORTED', message: 'timeout of 60000ms exceeded' },
    });

    expect(mockTrackFehler).toHaveBeenCalledWith(
      'Fehler beim Öffnen der Datei',
      'timeout',
      'material-teamer-liste'
    );
  });

  it('meldet einen abgerissenen Transport als netz', async () => {
    await aufbauen();
    await melde('Fehler beim Laden der Daten', {
      ort: 'benutzer-verwaltung-laden',
      fehler: { code: 'ERR_NETWORK', message: 'Network Error' },
    });

    expect(mockTrackFehler).toHaveBeenCalledWith(
      'Fehler beim Laden der Daten',
      'netz',
      'benutzer-verwaltung-laden'
    );
  });

  it('meldet einen 500 als http-500', async () => {
    await aufbauen();
    await melde('Fehler beim Löschen der Aktivität', {
      ort: 'aktivitaet-loeschen-verwaltung',
      fehler: { response: { status: 500 } },
    });

    expect(mockTrackFehler).toHaveBeenCalledWith(
      'Fehler beim Löschen der Aktivität',
      'http-500',
      'aktivitaet-loeschen-verwaltung'
    );
  });

  it('laesst Aufrufe ohne Diagnose weiterhin zu (258 alte Aufrufstellen)', async () => {
    await aufbauen();
    await melde('Irgendein alter Fehler');

    expect(mockTrackFehler).toHaveBeenCalledWith('Irgendein alter Fehler', undefined, undefined);
  });

  it('ersetzt Zahlen im Meldungstext weiterhin, auch mit Diagnose', async () => {
    await aufbauen();
    await melde('Konfi 4711 wurde nicht gefunden', {
      ort: 'event-detail-laden',
      fehler: { response: { status: 404 } },
    });

    // Eine ganze Ziffernfolge wird zu EINEM #, nicht zu einem # je Ziffer —
    // sonst verriete schon die Laenge des Platzhalters die Groessenordnung
    // einer Kennung.
    expect(mockTrackFehler).toHaveBeenCalledWith(
      'Konfi # wurde nicht gefunden',
      'http-404',
      'event-detail-laden'
    );
  });

  it('meldet gar nichts bei leerer Meldung', async () => {
    await aufbauen();
    await melde('', { ort: 'chat-datei', fehler: { response: { status: 500 } } });

    expect(mockTrackFehler).not.toHaveBeenCalled();
  });
});

describe('Kein Personenbezug in der Messung', () => {
  beforeEach(() => {
    mockTrackFehler.mockClear();
  });

  it('uebertraegt aus einem Fehler mit Name, E-Mail und Dateiname NICHTS davon', async () => {
    await aufbauen();
    await melde('Fehler beim Öffnen der Datei', {
      ort: 'material-teamer-detail',
      fehler: {
        message: 'Request failed for emilia.mustermann@example.com',
        config: { url: '/api/material/files/Taufurkunde_Emilia.pdf?token=geheim' },
        response: {
          status: 403,
          data: {
            error: 'Emilia Mustermann darf Taufurkunde.pdf nicht öffnen',
            user_id: 4711,
            email: 'emilia.mustermann@example.com',
          },
        },
      },
    });

    expect(mockTrackFehler).toHaveBeenCalledTimes(1);
    const uebertragen = JSON.stringify(mockTrackFehler.mock.calls[0]);

    for (const fragment of [
      'Emilia',
      'Mustermann',
      'emilia.mustermann@example.com',
      'Taufurkunde',
      '.pdf',
      '4711',
      'geheim',
      '/api/material',
      'Request failed',
    ]) {
      expect(uebertragen).not.toContain(fragment);
    }

    // Und was ANKOMMT, ist genau das Gewuenschte.
    expect(mockTrackFehler).toHaveBeenCalledWith(
      'Fehler beim Öffnen der Datei',
      'http-403',
      'material-teamer-detail'
    );
  });

  it('verwirft einen Ort, der wie durchgereichte Daten aussieht', async () => {
    await aufbauen();
    // So DARF es im Code nicht stehen — falls es doch jemand tut, faellt es
    // hier raus statt bei Umami zu landen.
    await melde('Fehler beim Öffnen der Datei', {
      ort: 'Taufurkunde_Emilia_Mustermann.pdf',
      fehler: { response: { status: 404 } },
    });

    expect(mockTrackFehler).toHaveBeenCalledWith(
      'Fehler beim Öffnen der Datei',
      'http-404',
      undefined
    );
  });
});

describe('Die vier Stellen mit "Fehler beim Öffnen der Datei" sind unterscheidbar', () => {
  beforeEach(() => {
    mockTrackFehler.mockClear();
  });

  it('liefert fuer denselben Meldungstext vier verschiedene Orte', async () => {
    await aufbauen();

    const stellen = [
      'chat-datei',
      'material-teamer-liste',
      'material-teamer-detail',
      'material-admin-formular',
    ];

    for (const ort of stellen) {
      await melde('Fehler beim Öffnen der Datei', {
        ort,
        fehler: { response: { status: 500 } },
      });
    }

    expect(mockTrackFehler).toHaveBeenCalledTimes(4);

    const gemeldeteOrte = mockTrackFehler.mock.calls.map((c) => c[2]);
    expect(gemeldeteOrte).toEqual(stellen);
    // Vier Aufrufe, vier verschiedene Orte — kein Zusammenfallen mehr.
    expect(new Set(gemeldeteOrte).size).toBe(4);

    // Der angezeigte Text bleibt bei allen vieren derselbe — die Trennung
    // passiert NUR in der Messung, nicht vor Nutzeraugen.
    const gemeldeteTexte = mockTrackFehler.mock.calls.map((c) => c[0]);
    expect(new Set(gemeldeteTexte)).toEqual(new Set(['Fehler beim Öffnen der Datei']));
    expect(screen.getByTestId('error')).toHaveTextContent('Fehler beim Öffnen der Datei');
  });
});
