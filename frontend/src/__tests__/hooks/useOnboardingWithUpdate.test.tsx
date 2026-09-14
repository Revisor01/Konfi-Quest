import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';

// In-Memory-Ersatz für Capacitor Preferences (geraetelokaler Flag-Speicher).
const store = new Map<string, string>();
// Wie lange ein Schreibvorgang dauert. Auf dem Geraet ist Preferences.set ein
// Brueckenaufruf nach nativ, keine Zuweisung -- er braucht Zeit. Wer hier 0
// stehen laesst, testet einen Speicher, den es auf keinem Handy gibt, und
// uebersieht genau die Luecke zwischen Wegklicken und Vermerken
// (siehe "erneut betreten, bevor der Merker steht").
const schreibDauerMs = { wert: 0 };
// Laufende Nummer des Testfalls. Ein verzoegerter Schreibvorgang aus dem
// VORIGEN Test darf nicht in den frisch geleerten Speicher des naechsten
// fallen -- sonst stehen dort Werte, die kein Test gesetzt hat, und ein
// anderer Fall schlaegt scheinbar grundlos fehl.
const testLauf = { nummer: 0 };
vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: vi.fn(async ({ key }: { key: string }) => ({ value: store.get(key) ?? null })),
    set: vi.fn(async ({ key, value }: { key: string; value: string }) => {
      const lauf = testLauf.nummer;
      if (schreibDauerMs.wert > 0) {
        await new Promise((r) => setTimeout(r, schreibDauerMs.wert));
      }
      if (lauf !== testLauf.nummer) return;
      store.set(key, value);
    }),
  },
}));

// useIonViewDidEnter feuert im echten Ionic bei JEDEM Betreten der Seite —
// im Test beim Mounten, und zusaetzlich auf Zuruf ueber `betreteSeiteErneut`
// (ein Tab-Wechsel hin und zurueck).
let seiteBetreten: (() => void) | null = null;
vi.mock('@ionic/react', () => ({
  useIonViewDidEnter: (cb: () => void) => {
    seiteBetreten = cb;
    React.useEffect(() => { cb(); }, []);
  },
}));

const betreteSeiteErneut = () => { act(() => { seiteBetreten?.(); }); };

// Die LAUFENDE App-Version. Auf dem Geraet kommt sie aus App.getInfo(),
// im Test wird sie je Fall gesetzt -- genau daran haengt die Entscheidung,
// ob sich die Aenderungsanzeige meldet.
const laufendeVersion = { wert: '2.2.0' as string | null };
vi.mock('../../utils/appVersion', () => ({
  ermittleAppVersion: vi.fn(async () => laufendeVersion.wert),
}));

import {
  useOnboardingWithUpdateOnce,
  UPDATE_WALKTHROUGH_KEY,
  NEUERUNGEN_GESEHEN_KEY,
} from '../../hooks/useOnboardingOnce';

const ONBOARDING_KEY = 'konfi_onboarding_seen_7';
const UPDATE_KEY = `${UPDATE_WALKTHROUGH_KEY}_7`;
const GESEHEN_KEY = `${NEUERUNGEN_GESEHEN_KEY}_7`;

const mounten = () => renderHook(() => useOnboardingWithUpdateOnce('konfi_onboarding_seen', 7));

// Die Anzeige oeffnet sich mit 400 ms Versatz (die Seite soll erst rendern).
const warteAufAnzeige = async (result: { current: { showNeuerungen: boolean } }) =>
  waitFor(() => expect(result.current.showNeuerungen).toBe(true), { timeout: 2000 });

// Lange genug warten, dass sich die Anzeige gemeldet HAETTE.
const warteVersatzAb = async () => {
  await act(async () => { await new Promise((r) => setTimeout(r, 700)); });
};

describe('Änderungsanzeige nach einem Update', () => {
  beforeEach(() => {
    store.clear();
    laufendeVersion.wert = '2.2.0';
    testLauf.nummer++;
    schreibDauerMs.wert = 0;
  });

  it('2.1.1 -> 2.2.0: die Anzeige meldet sich von selbst', async () => {
    store.set(ONBOARDING_KEY, '1');
    store.set(GESEHEN_KEY, '2.1');
    const { result } = mounten();

    await warteAufAnzeige(result);
    // Nie zusammen mit der Tour -- und die Karte bleibt weg, solange die
    // Anzeige offen ist (sonst stuenden zwei Fenster auf dasselbe Thema).
    expect(result.current.showOnboarding).toBe(false);
    expect(result.current.showUpdateHinweis).toBe(false);
    // Vermerkt wird erst beim Schliessen: Bricht der Start vorher ab, soll
    // die Anzeige wiederkommen.
    expect(store.has(GESEHEN_KEY)).toBe(true);
    expect(store.get(GESEHEN_KEY)).toBe('2.1');
  });

  it('Neuinstallation: KEINE Anzeige, sondern die Tour — und 2.2 gilt still als gesehen', async () => {
    // Kein Onboarding-Flag = dieses Geraet hat die App noch nie benutzt.
    const { result } = mounten();

    await waitFor(() => expect(result.current.showOnboarding).toBe(true), { timeout: 2000 });
    // Wer zum ersten Mal oeffnet, will loslegen -- nicht lesen, was sich
    // gegenueber einer Version geaendert hat, die er nie hatte.
    expect(result.current.showNeuerungen).toBe(false);
    expect(store.get(ONBOARDING_KEY)).toBe('1');
    // Still vermerkt: Beim naechsten Start meldet sich nichts nach.
    await waitFor(() => expect(store.get(GESEHEN_KEY)).toBe('2.2'));
  });

  it('Neuinstallation: auch beim ZWEITEN Start bleibt die Anzeige weg', async () => {
    const erste = mounten();
    await waitFor(() => expect(erste.result.current.showOnboarding).toBe(true), { timeout: 2000 });
    await waitFor(() => expect(store.get(GESEHEN_KEY)).toBe('2.2'));
    erste.unmount();

    const zweite = mounten();
    await warteVersatzAb();
    expect(zweite.result.current.showNeuerungen).toBe(false);
    expect(zweite.result.current.showOnboarding).toBe(false);
  });

  it('2.2.0 Build 187 -> Build 188: die Anzeige bleibt weg', async () => {
    // Build-Nummern stehen nicht in der Version (CFBundleShortVersionString
    // bleibt 2.2.0). Verglichen wird auf Minor-Ebene -- sonst meldete sich
    // die Anzeige bei Beta-Tester:innen nach jedem TestFlight-Build.
    store.set(ONBOARDING_KEY, '1');
    store.set(GESEHEN_KEY, '2.2');
    const { result } = mounten();

    await warteVersatzAb();
    expect(result.current.showNeuerungen).toBe(false);
    expect(result.current.showOnboarding).toBe(false);
  });

  it('2.2.0 -> 2.2.1: die Anzeige bleibt weg (Patch ist keine Neuerung)', async () => {
    store.set(ONBOARDING_KEY, '1');
    store.set(GESEHEN_KEY, '2.2');
    laufendeVersion.wert = '2.2.1';
    const { result } = mounten();

    await warteVersatzAb();
    expect(result.current.showNeuerungen).toBe(false);
  });

  it('weggeklickt: kommt nicht wieder, auch nach einem App-Neustart', async () => {
    store.set(ONBOARDING_KEY, '1');
    store.set(GESEHEN_KEY, '2.1');
    const erste = mounten();
    await warteAufAnzeige(erste.result);

    act(() => { erste.result.current.schliesseNeuerungen(); });
    expect(erste.result.current.showNeuerungen).toBe(false);
    await waitFor(() => expect(store.get(GESEHEN_KEY)).toBe('2.2'));
    erste.unmount();

    // Zweiter "App-Start": weder Anzeige noch Karte.
    const zweite = mounten();
    await warteVersatzAb();
    expect(zweite.result.current.showNeuerungen).toBe(false);
    expect(zweite.result.current.showUpdateHinweis).toBe(false);
    expect(zweite.result.current.showOnboarding).toBe(false);
  });

  it('weggeklickt, dann Tab hin und zurueck: die Anzeige bleibt zu', async () => {
    // Der Fall, der die App unbedienbar machte: Die Anzeige liegt als
    // Vollbild ueber der Seite und faengt alle Klicks ab. Wer sie wegklickt
    // und sofort in einen anderen Tab und zurueck tippt, betritt die Seite
    // erneut -- und der Merker im Speicher steht noch nicht, weil er
    // asynchron geschrieben wird. Vor dem Fix ging die Anzeige wieder auf,
    // beliebig oft (gefunden ueber die E2E-Tests, 14.09.2026).
    schreibDauerMs.wert = 300;
    store.set(ONBOARDING_KEY, '1');
    store.set(GESEHEN_KEY, '2.1');
    const { result } = mounten();
    await warteAufAnzeige(result);

    act(() => { result.current.schliesseNeuerungen(); });
    expect(result.current.showNeuerungen).toBe(false);

    // Seite erneut betreten, BEVOR der Merker geschrieben ist.
    expect(store.get(GESEHEN_KEY)).toBe('2.1');
    betreteSeiteErneut();
    await warteVersatzAb();

    expect(result.current.showNeuerungen).toBe(false);
    // Und auch die Karte poppt nicht als Ersatz auf.
    expect(result.current.showUpdateHinweis).toBe(false);
  });

  it('erneut betreten, waehrend die Anzeige noch offen ist: kein zweites Oeffnen', async () => {
    // Dieselbe Luecke, nur ohne Wegklicken: Der Merker steht erst beim
    // Schliessen. Ein Tab-Wechsel bei offener Anzeige darf keine zweite
    // Anzeige hinter der ersten stapeln.
    schreibDauerMs.wert = 300;
    store.set(ONBOARDING_KEY, '1');
    const { result } = mounten();
    await warteAufAnzeige(result);

    betreteSeiteErneut();
    await warteVersatzAb();

    expect(result.current.showNeuerungen).toBe(true);
    act(() => { result.current.schliesseNeuerungen(); });
    // Ein einziges Schliessen genuegt -- es liegt nichts darunter.
    expect(result.current.showNeuerungen).toBe(false);
  });

  it('Bestandsgeraet aus 2.1.1: das alte Flag zaehlt als "2.1 gesehen"', async () => {
    // Bruecke: Vor 2.2.0 gab es keinen Merker, nur das alte Flag. Wer die
    // 2.1-Karte weggeklickt hatte, hat 2.1 gesehen -- und bekommt 2.2.
    store.set(ONBOARDING_KEY, '1');
    store.set(UPDATE_KEY, '1');
    const { result } = mounten();

    await warteAufAnzeige(result);
    act(() => { result.current.schliesseNeuerungen(); });
    await waitFor(() => expect(store.get(GESEHEN_KEY)).toBe('2.2'));
  });

  it('Bestandsgeraet ganz ohne Merker: die Anzeige meldet sich', async () => {
    // Onboarding-Flag steht, aber weder Merker noch altes Flag: ein Geraet,
    // das die App vor 2.2.0 benutzt hat. Genau dafuer ist die Anzeige da.
    store.set(ONBOARDING_KEY, '1');
    const { result } = mounten();

    await warteAufAnzeige(result);
    expect(result.current.showOnboarding).toBe(false);
  });

  it('ohne ermittelbare Version passiert nichts — und nichts wird vermerkt', async () => {
    // App.getInfo() kaputt: Lieber keine Anzeige als eine auf Datenmuell.
    store.set(ONBOARDING_KEY, '1');
    store.set(GESEHEN_KEY, '2.1');
    laufendeVersion.wert = null;
    const { result } = mounten();

    await warteVersatzAb();
    expect(result.current.showNeuerungen).toBe(false);
    expect(store.get(GESEHEN_KEY)).toBe('2.1');
  });
});

describe('Die Neuigkeiten-Karten daneben', () => {
  beforeEach(() => {
    store.clear();
    laufendeVersion.wert = '2.2.0';
    testLauf.nummer++;
    schreibDauerMs.wert = 0;
  });

  it('nichts Neues: die Update-Karte steht, ihr Flag bleibt UNGESETZT', async () => {
    // Gleiche Version wie zuletzt gesehen, aber die Karte wurde nie
    // weggeklickt -- sie bleibt der dauerhafte Weg zu den Erklaerungen.
    store.set(ONBOARDING_KEY, '1');
    store.set(GESEHEN_KEY, '2.2');
    const { result } = mounten();

    await waitFor(() => expect(result.current.showUpdateHinweis).toBe(true));
    expect(result.current.showNeuerungen).toBe(false);
    // Erst eine bewusste Aktion (X oder Öffnen) setzt das Flag.
    expect(store.has(UPDATE_KEY)).toBe(false);
  });

  it('markUpdateHinweisGesehen blendet die Karte dauerhaft aus', async () => {
    store.set(ONBOARDING_KEY, '1');
    store.set(GESEHEN_KEY, '2.2');
    const erste = mounten();
    await waitFor(() => expect(erste.result.current.showUpdateHinweis).toBe(true));

    act(() => { erste.result.current.markUpdateHinweisGesehen(); });
    expect(erste.result.current.showUpdateHinweis).toBe(false);
    await waitFor(() => expect(store.get(UPDATE_KEY)).toBe('1'));
    erste.unmount();

    const zweite = mounten();
    await warteVersatzAb();
    expect(zweite.result.current.showUpdateHinweis).toBe(false);
  });

  it('die Mitmachen-Karte haengt NICHT an der Version', async () => {
    // Sie wurde weggeklickt und darf durch ein Update nicht zurueckkehren --
    // am Mitmachen-Tab hat sich zu 2.2.0 nichts geaendert.
    store.set(ONBOARDING_KEY, '1');
    store.set(GESEHEN_KEY, '2.1');
    store.set('mitmachen_hinweis_2_1_gesehen_7', '1');
    const { result } = mounten();

    await warteAufAnzeige(result);
    expect(result.current.showMitmachenHinweis).toBe(false);
  });
});
