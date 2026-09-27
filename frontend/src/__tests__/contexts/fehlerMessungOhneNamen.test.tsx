/**
 * Befund B1 (docs/messung/umami.md, 27.09.2026): Die anonyme Fehlermessung
 * übertrug den ANGEZEIGTEN Meldungstext als `stelle`. Viele Stellen zeigen
 * den Text des Servers (`fehlerText(err, 'Ersatz')`), und einige davon
 * tragen Namen: „Emilia Mustermann gehört zu keinem Jahrgang dieses
 * Events", „Für … steht bereits eine Einladung offen", den Dateinamen eines
 * Uploads oder den Namen eines Konfirmationstermins. Entschärft wurden nur
 * Ziffern; 80 Zeichen reichen für jeden Namen.
 *
 * Diese Datei prüft am ECHTEN AppContext und an der ECHTEN Nutzlast, die
 * `fetch` an Umami schickt:
 *   - verboten: kein Name, kein Dateiname, kein Event-Name verlässt das Gerät
 *     — weder zu Umami noch als Wegmarke ins Absturzprotokoll;
 *   - erlaubt: Texte der App kommen im Wortlaut an (Ziffern → #), damit die
 *     Frage „wo klemmt es" beantwortbar bleibt.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
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

// Das Absturzprotokoll (Crashlytics) laeuft nur nativ; hier wird die Zeile
// abgefangen, die AppContext als Wegmarke schreiben WUERDE.
const mockWegmarke = vi.fn();
vi.mock('../../services/absturzdiagnose', async () => {
  const echt = await vi.importActual<typeof import('../../services/absturzdiagnose')>(
    '../../services/absturzdiagnose'
  );
  return {
    ...echt,
    wegmarke: async (text: string) => { mockWegmarke(text); },
  };
});

type AppModul = typeof import('../../contexts/AppContext');
type FehlerModul = typeof import('../../utils/fehler');
type AnalyticsModul = typeof import('../../services/analytics');

let app: AppModul;
let fehler: FehlerModul;
let analytics: AnalyticsModul;
let setError: ReturnType<AppModul['useApp']>['setError'];
let fetchMock: ReturnType<typeof vi.fn>;

/**
 * Frisch laden, mit eingeschalteter Messung. `AKTIV` in analytics.ts wird beim
 * Import aus `import.meta.env.PROD` gelesen — deshalb erst stubben, dann laden.
 * AppContext, fehler.ts und analytics.ts kommen aus DERSELBEN Ladung, damit
 * sie denselben Modulzustand teilen.
 */
const aufbauen = async () => {
  vi.resetModules();
  vi.stubEnv('PROD', true);
  app = await import('../../contexts/AppContext');
  fehler = await import('../../utils/fehler');
  analytics = await import('../../services/analytics');

  const Verbraucher: React.FC = () => {
    const ctx = app.useApp();
    React.useEffect(() => {
      setError = ctx.setError;
    });
    return null;
  };

  await act(async () => {
    render(
      <app.AppProvider>
        <Verbraucher />
      </app.AppProvider>
    );
  });
};

const melde = async (...args: Parameters<typeof setError>) => {
  await act(async () => {
    setError(...args);
  });
};

/** Alle an Umami gesendeten `fehler`-Ereignisse als geparste Nutzlast. */
const fehlerEreignisse = () =>
  fetchMock.mock.calls
    .map((c) => JSON.parse((c[1] as { body: string }).body) as { payload: { name?: string; data?: Record<string, unknown> } })
    .filter((r) => r.payload.name === 'fehler')
    .map((r) => r.payload);

/** Der komplette gesendete Rumpf als Text — fuer die Suche nach Namen. */
const allesGesendete = () =>
  fetchMock.mock.calls.map((c) => (c[1] as { body: string }).body).join('\n');

/** So kommt eine Fehlerantwort von axios an. */
const serverFehler = (status: number, error: string) => ({
  message: `Request failed with status code ${status}`,
  response: { status, data: { error } },
});

beforeEach(async () => {
  fetchMock = vi.fn().mockResolvedValue({ ok: true });
  vi.stubGlobal('fetch', fetchMock);
  mockWegmarke.mockClear();
  await aufbauen();
  fetchMock.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.resetModules();
});

/**
 * Die vier Fundstellen aus B1, jeweils mit dem Ersatztext, den die
 * Aufrufstelle an `fehlerText` gibt, und den Bruchstuecken, die nie
 * ankommen duerfen.
 */
const FUNDSTELLEN = [
  {
    fall: 'Konfi gehört zu keinem Jahrgang (events/teilnehmer.js, ParticipantManagementModal)',
    status: 403,
    server: 'Emilia Mustermann gehört zu keinem Jahrgang dieses Events',
    ersatz: 'Fehler beim Hinzufügen der Teilnehmer:innen',
    verboten: ['Emilia', 'Mustermann'],
  },
  {
    fall: 'Person arbeitet bereits in der Gemeinde (einladungen.js, EinladungModal)',
    status: 409,
    server: 'Emilia Mustermann arbeitet bereits in dieser Gemeinde.',
    ersatz: 'Die Einladung konnte nicht gesendet werden',
    verboten: ['Emilia', 'Mustermann'],
  },
  {
    fall: 'Einladung für Person steht offen (einladungen.js, EinladungModal)',
    status: 409,
    server: 'Für Emilia Mustermann steht bereits eine Einladung offen.',
    ersatz: 'Die Einladung konnte nicht gesendet werden',
    verboten: ['Emilia', 'Mustermann'],
  },
  {
    fall: 'Dateiname beim Upload (material.js, MaterialFormModal)',
    status: 415,
    server: 'Dateityp nicht verifizierbar: Taufurkunde_Emilia_Mustermann.pdf',
    ersatz: 'Fehler beim Speichern',
    verboten: ['Taufurkunde', 'Emilia', 'Mustermann', '.pdf'],
  },
  {
    fall: 'Name des Konfirmationstermins (bookingUtils.js, EventDetailView)',
    status: 409,
    server:
      'Du bist bereits zu einem Konfirmationstermin angemeldet ("Konfirmation Kirchdorf Emilia"). '
      + 'Melde dich dort zuerst ab, um einen anderen Termin zu wählen.',
    ersatz: 'Fehler bei der Anmeldung',
    verboten: ['Kirchdorf', 'Emilia', 'Konfirmationstermin angemeldet'],
  },
];

describe('Verboten: Server-Texte mit Namen verlassen das Gerät nicht', () => {
  it.each(FUNDSTELLEN)('$fall — direkt angezeigt: Platzhalter statt Text', async ({ server, verboten }) => {
    // So zeigt z.B. ParticipantManagementModal die Meldung bis heute:
    // `setError(meldung || 'Ersatz')`, ohne Diagnose.
    await melde(server);

    const ereignisse = fehlerEreignisse();
    expect(ereignisse).toHaveLength(1);
    expect(ereignisse[0].data).toEqual({ stelle: 'andere-meldung' });

    const gesendet = allesGesendete();
    for (const bruchstueck of verboten) expect(gesendet).not.toContain(bruchstueck);

    expect(mockWegmarke).toHaveBeenCalledTimes(1);
    expect(mockWegmarke).toHaveBeenCalledWith('fehler ohne-ort ohne-art: andere-meldung');
  });

  it.each(FUNDSTELLEN)('$fall — über fehlerText: Ersatztext der Aufrufstelle statt Server-Text', async ({ status, server, ersatz, verboten }) => {
    // Der gewoehnliche Weg: `setError(fehlerText(err, 'Ersatz'))`. Angezeigt
    // wird weiter der Text des Servers — gemessen wird der Ersatztext der
    // Aufrufstelle (ein Text der App) und die Art aus der Antwort.
    const err = serverFehler(status, server);
    const angezeigt = fehler.fehlerText(err, ersatz);
    expect(angezeigt).toBe(server);
    await melde(angezeigt);

    const ereignisse = fehlerEreignisse();
    expect(ereignisse).toHaveLength(1);
    expect(ereignisse[0].data).toEqual({ stelle: ersatz, art: `http-${status}` });

    const gesendet = allesGesendete();
    for (const bruchstueck of verboten) expect(gesendet).not.toContain(bruchstueck);

    expect(mockWegmarke).toHaveBeenCalledWith(`fehler ohne-ort http-${status}: ${ersatz}`);
    for (const bruchstueck of verboten) {
      expect(mockWegmarke.mock.calls[0][0]).not.toContain(bruchstueck);
    }
  });

  it('ein bekannter Text mit angehängtem Namen ist KEIN bekannter Text', async () => {
    await melde('Fehler bei der Anmeldung: Emilia Mustermann');

    expect(fehlerEreignisse()[0].data).toEqual({ stelle: 'andere-meldung' });
    expect(allesGesendete()).not.toContain('Emilia');
  });

  it('Diagnose mit Ort und Fehlerobjekt: Ort und Art bleiben, der Name nicht', async () => {
    await melde('Emilia Mustermann gehört zu keinem Jahrgang dieses Events', {
      ort: 'teilnehmer-hinzufuegen',
      fehler: serverFehler(403, 'Emilia Mustermann gehört zu keinem Jahrgang dieses Events'),
    });

    expect(fehlerEreignisse()[0].data).toEqual({
      stelle: 'andere-meldung',
      art: 'http-403',
      ort: 'teilnehmer-hinzufuegen',
    });
    expect(allesGesendete()).not.toContain('Emilia');
    expect(mockWegmarke).toHaveBeenCalledWith('fehler teilnehmer-hinzufuegen http-403: andere-meldung');
  });

  it('die zweite Sperre: trackFehler selbst lässt einen Namen nicht durch', () => {
    // Falls kuenftig jemand trackFehler an AppContext vorbei aufruft.
    analytics.trackFehler('Emilia Mustermann gehört zu keinem Jahrgang dieses Events', 'http-403');

    expect(fehlerEreignisse()[0].data).toEqual({ stelle: 'andere-meldung', art: 'http-403' });
    expect(allesGesendete()).not.toContain('Emilia');
  });
});

describe('Erlaubt: Texte der App kommen im Wortlaut an', () => {
  it('ein bekannter Text mit Ziffer: Ziffern werden zu #', async () => {
    await melde('Bitte gib einen Grund für die Abmeldung an (mind. 5 Zeichen)');

    expect(fehlerEreignisse()[0].data).toEqual({
      stelle: 'Bitte gib einen Grund für die Abmeldung an (mind. # Zeichen)',
    });
    expect(mockWegmarke).toHaveBeenCalledWith(
      'fehler ohne-ort ohne-art: Bitte gib einen Grund für die Abmeldung an (mind. # Zeichen)'
    );
  });

  it('die Offline-Meldung aus offlineBlockiert', async () => {
    const { OFFLINE_AKTION_MELDUNG } = await import('../../utils/offlineAktion');
    await melde(OFFLINE_AKTION_MELDUNG);

    expect(fehlerEreignisse()[0].data).toEqual({
      stelle: 'Das geht nur mit Internetverbindung. Bitte versuche es später noch einmal.',
    });
  });

  it('mit Ort und Fehlerobjekt: alle drei Angaben', async () => {
    await melde('Fehler beim Öffnen der Datei', {
      ort: 'material-teamer-detail',
      fehler: serverFehler(403, 'Kein Zugriff'),
    });

    expect(fehlerEreignisse()[0].data).toEqual({
      stelle: 'Fehler beim Öffnen der Datei',
      art: 'http-403',
      ort: 'material-teamer-detail',
    });
  });

  it('der Ersatztext, wenn der Server keinen Text schickt', async () => {
    const angezeigt = fehler.fehlerText({ code: 'ERR_NETWORK', message: 'Network Error' }, 'Fehler bei der Anmeldung');
    await melde(angezeigt);

    expect(fehlerEreignisse()[0].data).toEqual({ stelle: 'Fehler bei der Anmeldung' });
  });

  it('ein zugelassener, namensfreier Server-Text der Event-Anmeldung', async () => {
    const angezeigt = fehler.fehlerText(serverFehler(400, 'Anmeldung bereits geschlossen'), 'Fehler bei der Anmeldung');
    await melde(angezeigt);

    expect(fehlerEreignisse()[0].data).toEqual({
      stelle: 'Anmeldung bereits geschlossen',
      art: 'http-400',
    });
  });
});
