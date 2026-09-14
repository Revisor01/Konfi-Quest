/**
 * Fehlerdiagnose: Beantwortet der Messwert das WARUM — und nur das?
 *
 * Bis 14.09.2026 kam jeder Fehler als blosser Meldungstext an ("Fehler beim
 * Öffnen der Datei"). Man wusste das WO ungefaehr, nie das WARUM, und vier
 * verschiedene Stellen fielen in einen Topf. Hier wird geprueft:
 *  1. `fehlerArt` liefert fuer jede Ursache genau einen festen, groben Wert.
 *  2. Aus einem Fehlerobjekt voller Personendaten kommt NICHTS davon heraus.
 *  3. Die Muster fuer `art` und `ort` sperren alles, was nicht in die feste
 *     Liste gehoert.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fehlerArt } from '../../utils/fehler';
import { istGueltigeArt, istGueltigerOrt } from '../../services/analytics';

describe('fehlerArt: grobe Ursache statt Ratespiel', () => {
  it('liest den HTTP-Status als eigene Kategorie', () => {
    expect(fehlerArt({ response: { status: 404 } })).toBe('http-404');
    expect(fehlerArt({ response: { status: 403 } })).toBe('http-403');
    expect(fehlerArt({ response: { status: 500 } })).toBe('http-500');
    expect(fehlerArt({ response: { status: 413 } })).toBe('http-413');
  });

  it('erkennt eine ueberschrittene Zeitgrenze als timeout, nicht als Netzfehler', () => {
    // Wichtig: axios liefert beim Timeout ebenfalls KEINE response. Wuerde die
    // Netz-Pruefung zuerst greifen, waere jeder Timeout als "netz" verbucht —
    // und der Unterschied zwischen "Server zu langsam" und "kein Empfang"
    // waere genau der, den man sehen will.
    expect(fehlerArt({ code: 'ECONNABORTED', message: 'timeout of 30000ms exceeded' })).toBe('timeout');
    expect(fehlerArt({ code: 'ETIMEDOUT' })).toBe('timeout');
    expect(fehlerArt({ name: 'TimeoutError' })).toBe('timeout');
  });

  it('erkennt einen abgebrochenen Aufruf als abbruch', () => {
    expect(fehlerArt({ code: 'ERR_CANCELED' })).toBe('abbruch');
    expect(fehlerArt({ name: 'CanceledError' })).toBe('abbruch');
    expect(fehlerArt({ name: 'AbortError' })).toBe('abbruch');
  });

  it('erkennt einen abgerissenen Transport als netz', () => {
    expect(fehlerArt({ code: 'ERR_NETWORK', message: 'Network Error' })).toBe('netz');
  });

  it('meldet netz, wenn das Geraet offline ist', () => {
    // jsdom hat onLine nur auf dem Prototyp (Wert true), keine eigene
    // Eigenschaft auf `navigator`. Wer hier mit defineProperty ueberschreibt,
    // muss die eigene Eigenschaft anschliessend LOESCHEN — ein Zurueckschreiben
    // des alten Deskriptors gibt es nicht, und ohne delete steht `false`
    // fuer alle folgenden Tests der Datei fest.
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    try {
      expect(fehlerArt(new Error('irgendwas'))).toBe('netz');
    } finally {
      delete (navigator as unknown as Record<string, unknown>).onLine;
    }
    expect(navigator.onLine).toBe(true);
  });

  it('meldet intern, wenn kein Aufruf im Spiel war', () => {
    // Z.B. ein fehlgeschlagenes natives Plugin beim Oeffnen einer Datei.
    expect(fehlerArt(new TypeError('FileOpener nicht verfuegbar'))).toBe('intern');
    expect(fehlerArt('kaputt')).toBe('intern');
    expect(fehlerArt(undefined)).toBe('intern');
    expect(fehlerArt(null)).toBe('intern');
  });

  it('gibt IMMER einen Wert aus der erlaubten Liste zurueck', () => {
    const faelle: unknown[] = [
      { response: { status: 404 } },
      { response: { status: 500 } },
      { code: 'ECONNABORTED' },
      { code: 'ERR_NETWORK' },
      { code: 'ERR_CANCELED' },
      new Error('x'),
      null,
      42,
    ];
    for (const fall of faelle) {
      expect(istGueltigeArt(fehlerArt(fall))).toBe(true);
    }
  });
});

describe('Datenschutz: was NICHT herauskommen darf', () => {
  // Ein realistisch "verseuchtes" Fehlerobjekt: alles drin, was es in dieser
  // App geben kann — Name eines minderjaehrigen Konfis, E-Mail, Kennung,
  // Dateiname, Freitext, eine URL mit Parametern.
  const verseuchterFehler = {
    message: 'Request failed for emilia.mustermann@example.com',
    config: {
      url: '/api/material/files/Taufurkunde_Emilia_Mustermann.pdf?token=geheim123',
      headers: { Authorization: 'Bearer abcdef' },
    },
    response: {
      status: 403,
      data: {
        error: 'Emilia Mustermann darf die Datei Taufurkunde.pdf nicht öffnen',
        user_id: 4711,
        email: 'emilia.mustermann@example.com',
        jahrgang: '2026/27',
      },
    },
  };

  const verbotenesTextfragment = [
    'Emilia',
    'Mustermann',
    'emilia.mustermann@example.com',
    'Taufurkunde',
    '.pdf',
    '4711',
    '2026/27',
    'Bearer',
    'abcdef',
    'token=geheim123',
    '/api/material',
  ];

  it('gibt aus einem Fehler voller Personendaten NUR den Status zurueck', () => {
    const art = fehlerArt(verseuchterFehler);

    expect(art).toBe('http-403');
    // Und zwar buchstaeblich: kein Fragment aus dem Objekt taucht auf.
    for (const fragment of verbotenesTextfragment) {
      expect(art).not.toContain(fragment);
    }
  });

  it('laesst kein Fragment durch, egal welcher Fehler hereinkommt', () => {
    const faelle: unknown[] = [
      verseuchterFehler,
      new Error('Konfi Emilia Mustermann (ID 4711) konnte Taufurkunde.pdf nicht laden'),
      { code: 'ERR_NETWORK', config: { url: '/api/chat/files/Gruppenfoto_Konfis_2026.jpg' } },
    ];
    for (const fall of faelle) {
      const art = fehlerArt(fall);
      for (const fragment of verbotenesTextfragment) {
        expect(art).not.toContain(fragment);
      }
    }
  });

  it('sperrt jeden Ort, der nicht wie ein fest vergebenes Kuerzel aussieht', () => {
    // Erlaubt: die Kuerzel, die im Code stehen.
    expect(istGueltigerOrt('material-teamer-liste')).toBe(true);
    expect(istGueltigerOrt('chat-datei')).toBe(true);
    expect(istGueltigerOrt('event-detail-laden')).toBe(true);

    // Verboten: alles, was nach durchgereichten Daten aussieht.
    expect(istGueltigerOrt('Taufurkunde_Emilia.pdf')).toBe(false);
    expect(istGueltigerOrt('emilia.mustermann@example.com')).toBe(false);
    expect(istGueltigerOrt('/api/material/files/4711')).toBe(false);
    expect(istGueltigerOrt('Emilia Mustermann')).toBe(false);
    expect(istGueltigerOrt('konfi_4711')).toBe(false);
    expect(istGueltigerOrt('')).toBe(false);
    // Zu lang — ein Kuerzel ist kurz, ein Freitext nicht.
    expect(istGueltigerOrt('a'.repeat(41))).toBe(false);
  });

  it('sperrt jede Art, die nicht in der festen Liste steht', () => {
    expect(istGueltigeArt('http-404')).toBe(true);
    expect(istGueltigeArt('netz')).toBe(true);
    expect(istGueltigeArt('timeout')).toBe(true);
    expect(istGueltigeArt('abbruch')).toBe(true);
    expect(istGueltigeArt('intern')).toBe(true);

    expect(istGueltigeArt('http-403: Emilia darf nicht')).toBe(false);
    expect(istGueltigeArt('Network Error')).toBe(false);
    expect(istGueltigeArt('emilia@example.com')).toBe(false);
    expect(istGueltigeArt('http-99')).toBe(false);
    expect(istGueltigeArt('')).toBe(false);
  });
});

/**
 * Der Sendeweg selbst: kommt `art` und `ort` wirklich in der Nutzlast an?
 *
 * Ohne diesen Block beweisen die uebrigen Tests nur, dass AppContext die Werte
 * ueberreicht. Wuerde `trackFehler` sie danach wegwerfen — genau der Zustand
 * bis 14.09.2026 —, blieben sie trotzdem gruen. Hier wird deshalb die echte
 * Funktion gegen ein abgefangenes `fetch` gefahren.
 */
describe('trackFehler traegt art und ort bis in die Nutzlast', () => {
  const ladeMitProd = async () => {
    vi.resetModules();
    vi.stubEnv('PROD', true);
    return await import('../../services/analytics');
  };

  const nutzlast = (aufruf: unknown[]): Record<string, unknown> => {
    const init = aufruf[1] as { body: string };
    return (JSON.parse(init.body) as { payload: Record<string, unknown> }).payload;
  };

  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('sendet art und ort als eigene Felder mit', async () => {
    const analytics = await ladeMitProd();
    analytics.trackFehler('Fehler beim Öffnen der Datei', 'http-403', 'chat-datei');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const daten = nutzlast(fetchMock.mock.calls[0]).data as Record<string, unknown>;
    expect(daten.stelle).toBe('Fehler beim Öffnen der Datei');
    expect(daten.art).toBe('http-403');
    expect(daten.ort).toBe('chat-datei');
  });

  it('laesst art und ort weg, wenn nichts uebergeben wurde', async () => {
    const analytics = await ladeMitProd();
    analytics.trackFehler('Irgendein Fehler');

    const daten = nutzlast(fetchMock.mock.calls[0]).data as Record<string, unknown>;
    expect(daten.stelle).toBe('Irgendein Fehler');
    expect('art' in daten).toBe(false);
    expect('ort' in daten).toBe(false);
  });

  it('haengt die Rolle an, aber sonst nichts ueber die Person', async () => {
    const analytics = await ladeMitProd();
    analytics.setAnalyticsRole('konfi');
    analytics.trackFehler('Fehler beim Öffnen der Datei', 'timeout', 'material-teamer-liste');

    const daten = nutzlast(fetchMock.mock.calls[0]).data as Record<string, unknown>;
    // Genau diese vier Felder — kein Name, keine Kennung, keine Organisation.
    expect(Object.keys(daten).sort()).toEqual(['art', 'ort', 'rolle', 'stelle']);
    expect(daten.rolle).toBe('konfi');
  });

  it('normalisiert eine selbst vergebene Rollenbezeichnung auf "sonstige"', async () => {
    // Sonst sickerte der Rollentitel einer Gemeinde durch — bei kleinen
    // Gemeinden waere das faktisch personenbezogen.
    const analytics = await ladeMitProd();
    analytics.setAnalyticsRole('Jugendreferentin Emilia');
    analytics.trackFehler('Fehler beim Laden der Daten', 'http-500', 'event-detail-laden');

    const daten = nutzlast(fetchMock.mock.calls[0]).data as Record<string, unknown>;
    expect(daten.rolle).toBe('sonstige');
    expect(JSON.stringify(daten)).not.toContain('Emilia');
  });
});
