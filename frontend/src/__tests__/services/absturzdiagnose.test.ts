import { describe, it, expect, vi, beforeEach } from 'vitest';

/*
 * Tests fuer die Absturzdiagnose (Firebase Crashlytics).
 *
 * WAS HIER ABGESICHERT WIRD, und warum genau das:
 *
 *  1. IM WEB EIN NO-OP. Der Web-Zweig des Plugins WIRFT (`unimplemented()`).
 *     Ein Aufruf ohne die Native-Sperre wuerde also im Browser jeden
 *     Renderpfad abbrechen, in dem er steht — u.a. die ErrorBoundary, also
 *     genau die Stelle, die einen Fehler abfangen soll.
 *  2. KEINE PERSONENBEZOGENEN DATEN. Die App wird ueberwiegend von
 *     Jugendlichen genutzt. Die Tests pruefen, dass `setUserId` NIE gerufen
 *     wird und dass keine der uebergebenen Angaben als Klartext-Kennung
 *     durchgeht.
 *  3. DROSSELUNG. Bei vielen tausend Nutzenden darf ein Fehler, der bei jedem
 *     Render erneut auftritt, nicht tausendfach gemeldet werden.
 */

// --- Mocks ---
let isNative = true;
let plattform = 'android';
vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => isNative,
    getPlatform: () => plattform,
  },
}));

const setCustomKey = vi.fn();
const setUserId = vi.fn();
const log = vi.fn();
const setEnabled = vi.fn();
const recordException = vi.fn();
const didCrashOnPreviousExecution = vi.fn();
vi.mock('@capacitor-firebase/crashlytics', () => ({
  FirebaseCrashlytics: {
    setCustomKey: (...a: unknown[]) => setCustomKey(...a),
    setUserId: (...a: unknown[]) => setUserId(...a),
    log: (...a: unknown[]) => log(...a),
    setEnabled: (...a: unknown[]) => setEnabled(...a),
    recordException: (...a: unknown[]) => recordException(...a),
    didCrashOnPreviousExecution: (...a: unknown[]) => didCrashOnPreviousExecution(...a),
  },
}));

import {
  diagnoseMerkmaleSetzen,
  fehlerMelden,
  wegmarke,
  diagnoseSchalten,
  istVorigerStartAbgestuerzt,
  globaleFehlerkanaeleAnhaengen,
  drosselungZuruecksetzen,
} from '../../services/absturzdiagnose';

beforeEach(() => {
  isNative = true;
  plattform = 'android';
  setCustomKey.mockReset().mockResolvedValue(undefined);
  setUserId.mockReset().mockResolvedValue(undefined);
  log.mockReset().mockResolvedValue(undefined);
  setEnabled.mockReset().mockResolvedValue(undefined);
  recordException.mockReset().mockResolvedValue(undefined);
  didCrashOnPreviousExecution.mockReset();
  drosselungZuruecksetzen();
});

/** Alle an setCustomKey uebergebenen Schluessel-Wert-Paare flach einsammeln. */
const gesetzteMerkmale = (): Record<string, unknown> => {
  const merkmale: Record<string, unknown> = {};
  for (const aufruf of setCustomKey.mock.calls) {
    const arg = aufruf[0] as { key: string; value: unknown };
    merkmale[arg.key] = arg.value;
  }
  return merkmale;
};

describe('im Web ist alles ein no-op', () => {
  /*
   * DER FEHLERFALL, DEN DAS ABSICHERT: Der Web-Zweig des Plugins wirft
   * `unimplemented()`. Ohne die Native-Sperre wuerde ein Aufruf aus der
   * ErrorBoundary im Browser den Fehler-Fallback selbst zum Absturz bringen.
   */
  beforeEach(() => { isNative = false; });

  it('diagnoseMerkmaleSetzen ruft das Plugin nicht', async () => {
    await diagnoseMerkmaleSetzen({ rolle: 'konfi', organisationId: 4 });
    expect(setCustomKey).not.toHaveBeenCalled();
  });

  it('fehlerMelden ruft das Plugin nicht und meldet false', async () => {
    const gemeldet = await fehlerMelden('error-boundary', new Error('kaputt'));
    expect(gemeldet).toBe(false);
    expect(recordException).not.toHaveBeenCalled();
  });

  it('wegmarke ruft das Plugin nicht', async () => {
    await wegmarke('irgendwas');
    expect(log).not.toHaveBeenCalled();
  });

  it('diagnoseSchalten ruft das Plugin nicht', async () => {
    await diagnoseSchalten(true);
    expect(setEnabled).not.toHaveBeenCalled();
  });

  it('istVorigerStartAbgestuerzt meldet false ohne Plugin-Aufruf', async () => {
    expect(await istVorigerStartAbgestuerzt()).toBe(false);
    expect(didCrashOnPreviousExecution).not.toHaveBeenCalled();
  });
});

describe('diagnoseMerkmaleSetzen (nativ)', () => {
  it('setzt genau vier Merkmale: Rolle, Organisation, Plattform, Fassung', async () => {
    await diagnoseMerkmaleSetzen({
      rolle: 'teamer',
      organisationId: 4,
      appFassung: '2.3.0',
    });

    expect(setCustomKey).toHaveBeenCalledTimes(4);
    expect(gesetzteMerkmale()).toEqual({
      rolle: 'teamer',
      organisation: 4,
      plattform: 'android',
      app_fassung: '2.3.0',
    });
  });

  it('uebertraegt NIEMALS eine Nutzerkennung (setUserId wird nie gerufen)', async () => {
    await diagnoseMerkmaleSetzen({
      rolle: 'konfi',
      organisationId: 4,
      appFassung: '2.3.0',
    });
    // Die zentrale Datenschutz-Zusage dieses Moduls. Auch nicht mit der
    // device_id — die liegt serverseitig neben der Nutzer-ID.
    expect(setUserId).not.toHaveBeenCalled();
  });

  it('normalisiert org_admin auf admin', async () => {
    await diagnoseMerkmaleSetzen({ rolle: 'org_admin', organisationId: 1 });
    expect(gesetzteMerkmale().rolle).toBe('admin');
  });

  it('ersetzt einen selbst vergebenen Rollentitel durch "sonstige"', async () => {
    /*
     * Gemeinden vergeben eigene Rollentitel. Ein durchgereichtes
     * "Jugendreferentin Nord" waere in Crashlytics ein Merkmal, das auf eine
     * Person zeigt — dieselbe Regel wie in analytics.ts.
     */
    await diagnoseMerkmaleSetzen({ rolle: 'Jugendreferentin Nord', organisationId: 1 });
    expect(gesetzteMerkmale().rolle).toBe('sonstige');
  });

  it('setzt die Rolle auf leer, wenn niemand angemeldet ist', async () => {
    // Sonst haengt die Rolle der VORIGEN Sitzung weiter an jedem Bericht.
    await diagnoseMerkmaleSetzen({ rolle: null, organisationId: null });
    expect(gesetzteMerkmale().rolle).toBe('');
    expect(gesetzteMerkmale().organisation).toBe(0);
  });

  it('laesst die Fassung weg, wenn sie unbekannt ist', async () => {
    await diagnoseMerkmaleSetzen({ rolle: 'konfi', organisationId: 4, appFassung: null });
    expect(setCustomKey).toHaveBeenCalledTimes(3);
    expect(gesetzteMerkmale()).not.toHaveProperty('app_fassung');
  });

  it('uebergibt die Organisation als Zahl mit type int, nicht als Text', async () => {
    await diagnoseMerkmaleSetzen({ rolle: 'admin', organisationId: 4 });
    const aufruf = setCustomKey.mock.calls
      .map((a) => a[0] as { key: string; value: unknown; type: string })
      .find((a) => a.key === 'organisation');
    expect(aufruf).toEqual({ key: 'organisation', value: 4, type: 'int' });
  });

  it('wirft nicht, wenn das Plugin scheitert', async () => {
    setCustomKey.mockRejectedValue(new Error('kein Plugin'));
    await expect(
      diagnoseMerkmaleSetzen({ rolle: 'konfi', organisationId: 4 }),
    ).resolves.toBeUndefined();
  });
});

describe('fehlerMelden', () => {
  it('meldet einen Fehler als nicht-fatalen Bericht mit Herkunft im Text', async () => {
    const gemeldet = await fehlerMelden('error-boundary', new Error('null ist kein Objekt'));

    expect(gemeldet).toBe(true);
    expect(recordException).toHaveBeenCalledTimes(1);
    expect(recordException).toHaveBeenCalledWith({
      message: '[error-boundary] Error: null ist kein Objekt',
    });
  });

  it('haengt die Komponente als Merkmal an', async () => {
    await fehlerMelden('error-boundary', new Error('kaputt'), { komponente: 'at BadgesView' });
    expect(recordException).toHaveBeenCalledWith({
      message: '[error-boundary] Error: kaputt',
      keysAndValues: [{ key: 'komponente', value: 'at BadgesView', type: 'string' }],
    });
  });

  it('kuerzt lange Meldungen auf 200 Zeichen', async () => {
    /*
     * Lange Texte enthalten erfahrungsgemaess Nutzdaten: Antworten,
     * Dateinamen, Eingaben. Gekuerzt wird deshalb hart.
     */
    await fehlerMelden('x', new Error('a'.repeat(500)));
    const meldung = (recordException.mock.calls[0][0] as { message: string }).message;
    expect(meldung).toHaveLength(200);
  });

  it('verarbeitet auch einen Wert, der kein Error ist', async () => {
    // Eine abgelehnte Promise kann alles tragen — auch einen String.
    await fehlerMelden('promise-unbehandelt', 'Netzwerk weg');
    expect(recordException).toHaveBeenCalledWith({
      message: '[promise-unbehandelt] Netzwerk weg',
    });
  });

  describe('Drosselung', () => {
    /*
     * DER FALL, DEN DAS VERHINDERT: Ein Renderfehler wiederholt sich bei jedem
     * Render. Ein Geraet kann so in Minuten hunderte Berichte erzeugen; bei
     * vielen tausend Nutzenden verwirft Crashlytics dann serverseitig — und
     * zwar unvorhersehbar, sodass gerade die SELTENEN Berichte fehlen.
     */
    it('meldet dieselbe Ursache nur einmal je Sitzung', async () => {
      const fehler = new Error('immer derselbe');
      expect(await fehlerMelden('error-boundary', fehler)).toBe(true);
      expect(await fehlerMelden('error-boundary', fehler)).toBe(false);
      expect(await fehlerMelden('error-boundary', fehler)).toBe(false);

      expect(recordException).toHaveBeenCalledTimes(1);
    });

    it('meldet verschiedene Ursachen einzeln', async () => {
      await fehlerMelden('error-boundary', new Error('erster'));
      await fehlerMelden('error-boundary', new Error('zweiter'));
      expect(recordException).toHaveBeenCalledTimes(2);
    });

    it('meldet hoechstens 20 Berichte je Sitzung', async () => {
      // Harte Kappe gegen eine Fehlerschleife mit staendig neuen Texten.
      for (let i = 0; i < 40; i++) {
        await fehlerMelden('schleife', new Error(`fehler ${i}`));
      }
      expect(recordException).toHaveBeenCalledTimes(20);
    });

    it('meldet nach einem Neustart wieder (Zaehler nur im Speicher)', async () => {
      const fehler = new Error('beim Start');
      await fehlerMelden('start', fehler);
      expect(recordException).toHaveBeenCalledTimes(1);

      // Entspricht einem App-Neustart: sonst faellt ein Fehler, der genau beim
      // Start auftritt, nach dem ersten Mal dauerhaft aus der Messung.
      drosselungZuruecksetzen();
      await fehlerMelden('start', fehler);
      expect(recordException).toHaveBeenCalledTimes(2);
    });
  });

  it('wirft nicht und meldet false, wenn das Plugin scheitert', async () => {
    recordException.mockRejectedValue(new Error('kein Plugin'));
    await expect(fehlerMelden('x', new Error('y'))).resolves.toBe(false);
  });
});

describe('wegmarke', () => {
  it('schreibt den Text ins Absturzprotokoll', async () => {
    await wegmarke('fehler chat-datei http-404: Datei nicht gefunden');
    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith({
      message: 'fehler chat-datei http-404: Datei nicht gefunden',
    });
  });

  it('kuerzt lange Wegmarken auf 200 Zeichen', async () => {
    await wegmarke('b'.repeat(400));
    const meldung = (log.mock.calls[0][0] as { message: string }).message;
    expect(meldung).toHaveLength(200);
  });

  it('wird NICHT gedrosselt — Wegmarken sind billig und sollen vollstaendig sein', async () => {
    for (let i = 0; i < 30; i++) await wegmarke('immer dasselbe');
    expect(log).toHaveBeenCalledTimes(30);
  });
});

describe('diagnoseSchalten', () => {
  it('schaltet die Diagnose aus', async () => {
    await diagnoseSchalten(false);
    expect(setEnabled).toHaveBeenCalledTimes(1);
    expect(setEnabled).toHaveBeenCalledWith({ enabled: false });
  });

  it('schaltet die Diagnose ein', async () => {
    await diagnoseSchalten(true);
    expect(setEnabled).toHaveBeenCalledWith({ enabled: true });
  });
});

describe('istVorigerStartAbgestuerzt', () => {
  it('meldet true, wenn die App zuvor abgestuerzt ist', async () => {
    didCrashOnPreviousExecution.mockResolvedValue({ crashed: true });
    expect(await istVorigerStartAbgestuerzt()).toBe(true);
  });

  it('meldet false, wenn nicht', async () => {
    didCrashOnPreviousExecution.mockResolvedValue({ crashed: false });
    expect(await istVorigerStartAbgestuerzt()).toBe(false);
  });

  it('meldet false, wenn das Plugin scheitert', async () => {
    didCrashOnPreviousExecution.mockRejectedValue(new Error('kein Plugin'));
    expect(await istVorigerStartAbgestuerzt()).toBe(false);
  });
});

describe('globaleFehlerkanaeleAnhaengen', () => {
  /*
   * DIE LUECKE, DIE DAS SCHLIESST: Das Projekt hatte WEDER einen
   * `unhandledrejection`- noch einen `window.onerror`-Handler (an mehreren
   * Stellen im Code als bekannt vermerkt). Eine abgelehnte Promise ohne catch
   * verschwand damit vollstaendig.
   */
  it('meldet eine unbehandelte Promise-Ablehnung', async () => {
    const abmelden = globaleFehlerkanaeleAnhaengen();

    const ereignis = new Event('unhandledrejection') as Event & { reason: unknown };
    ereignis.reason = new Error('niemand hat gefangen');
    window.dispatchEvent(ereignis);
    // Der Handler meldet ohne await; ein Mikrotask-Durchlauf genuegt.
    await Promise.resolve();

    expect(recordException).toHaveBeenCalledTimes(1);
    expect(recordException).toHaveBeenCalledWith({
      message: '[promise-unbehandelt] Error: niemand hat gefangen',
    });

    abmelden();
  });

  it('meldet einen window-Fehler', async () => {
    const abmelden = globaleFehlerkanaeleAnhaengen();

    const ereignis = new Event('error') as Event & { error: unknown; message: string };
    ereignis.error = new TypeError('x ist kein Objekt');
    window.dispatchEvent(ereignis);
    await Promise.resolve();

    expect(recordException).toHaveBeenCalledWith({
      message: '[window-onerror] TypeError: x ist kein Objekt',
    });

    abmelden();
  });

  it('meldet nach dem Abmelden nichts mehr', async () => {
    const abmelden = globaleFehlerkanaeleAnhaengen();
    abmelden();

    const ereignis = new Event('unhandledrejection') as Event & { reason: unknown };
    ereignis.reason = new Error('nach dem Abmelden');
    window.dispatchEvent(ereignis);
    await Promise.resolve();

    expect(recordException).not.toHaveBeenCalled();
  });

  it('ist im Web still — Handler haengen, melden aber nichts', async () => {
    isNative = false;
    const abmelden = globaleFehlerkanaeleAnhaengen();

    const ereignis = new Event('unhandledrejection') as Event & { reason: unknown };
    ereignis.reason = new Error('im Browser');
    window.dispatchEvent(ereignis);
    await Promise.resolve();

    expect(recordException).not.toHaveBeenCalled();
    abmelden();
  });
});
