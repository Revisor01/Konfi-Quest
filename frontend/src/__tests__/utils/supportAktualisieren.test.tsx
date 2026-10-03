import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, renderHook } from '@testing-library/react';

// „Support-Daten geändert" (utils/supportAktualisieren.ts, docs/planung/
// support-vorgaenge.md, Entscheidung 8): EINE Stelle, die jede Änderung meldet
// und bei der jede Ansicht -- Liste, Detail, Übersicht, rote Zahlen -- sich
// anmeldet. Hier steht der Mechanismus; dass die Seiten ihn nutzen, zeigen die
// Tests der Seiten (supportAktuell.test.tsx).

vi.mock('@ionic/react', async () => (await import('../components/support/ionicAttrappe')).ionicAttrappe());

import { seiteBetreten } from '../components/support/ionicAttrappe';
import {
  abonniereSupportGeaendert,
  meldeSupportGeaendert,
  useSupportGeaendert,
  useSupportQuelle,
} from '../../utils/supportAktualisieren';

/** Die Mikroaufgabe abwarten, in der die gesammelten Meldungen ausgeliefert werden. */
const warten = () => act(async () => { await Promise.resolve(); });

const sichtbarkeit = (zustand: 'visible' | 'hidden') => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => zustand });
  document.dispatchEvent(new Event('visibilitychange'));
};

afterEach(() => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
});

describe('meldeSupportGeaendert und abonniereSupportGeaendert', () => {
  it('jede Meldung erreicht jeden, der sich angemeldet hat -- erst nach dem Augenblick, nicht mitten in der Änderung', async () => {
    const a = vi.fn();
    const b = vi.fn();
    const abmelden = [abonniereSupportGeaendert(a), abonniereSupportGeaendert(b)];
    meldeSupportGeaendert();
    expect(a).not.toHaveBeenCalled();
    await warten();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    abmelden.forEach((f) => f());
  });

  it('mehrere Meldungen im selben Augenblick ergeben EINE Benachrichtigung (Status setzen und Mails als gelesen melden)', async () => {
    const horcher = vi.fn();
    const abmelden = abonniereSupportGeaendert(horcher);
    meldeSupportGeaendert();
    meldeSupportGeaendert();
    meldeSupportGeaendert('irgendwer');
    await warten();
    expect(horcher).toHaveBeenCalledTimes(1);
    // Die nächste Änderung ist eine neue Meldung.
    meldeSupportGeaendert();
    await warten();
    expect(horcher).toHaveBeenCalledTimes(2);
    abmelden();
  });

  it('wer sich abgemeldet hat, hört nichts mehr', async () => {
    const horcher = vi.fn();
    abonniereSupportGeaendert(horcher)();
    meldeSupportGeaendert();
    await warten();
    expect(horcher).not.toHaveBeenCalled();
  });

  it('die eigene Quelle weckt sich nicht selbst; jede andere Meldung -- auch eine ohne Quelle -- schon', async () => {
    const eigene = {};
    const horcher = vi.fn();
    const abmelden = abonniereSupportGeaendert(horcher, eigene);
    meldeSupportGeaendert(eigene);
    await warten();
    expect(horcher).not.toHaveBeenCalled();

    meldeSupportGeaendert({});
    await warten();
    expect(horcher).toHaveBeenCalledTimes(1);

    meldeSupportGeaendert();
    await warten();
    expect(horcher).toHaveBeenCalledTimes(2);
    abmelden();
  });

  it('kommt im selben Augenblick eine fremde Meldung dazu, wird auch die Quelle geweckt', async () => {
    const eigene = {};
    const horcher = vi.fn();
    const abmelden = abonniereSupportGeaendert(horcher, eigene);
    meldeSupportGeaendert(eigene);
    meldeSupportGeaendert();
    await warten();
    expect(horcher).toHaveBeenCalledTimes(1);
    abmelden();
  });

  it('ein Horcher, der selbst meldet (Gelesen nach dem Laden), bildet keine Schleife, solange er sich als Quelle einträgt', async () => {
    const quelle = {};
    let aufrufe = 0;
    const abmelden = abonniereSupportGeaendert(() => {
      aufrufe += 1;
      // Laden, dann die Mails als gelesen melden -- mit der eigenen Quelle.
      if (aufrufe < 50) meldeSupportGeaendert(quelle);
    }, quelle);
    meldeSupportGeaendert();
    await warten();
    await warten();
    expect(aufrufe).toBe(1);
    abmelden();
  });
});

describe('useSupportGeaendert', () => {
  it('lädt bei jeder Meldung -- und zwar mit der neuesten Fassung der Ladefunktion', async () => {
    const erste = vi.fn();
    const zweite = vi.fn();
    const { rerender, unmount } = renderHook(({ laden }) => useSupportGeaendert(laden), { initialProps: { laden: erste } });
    rerender({ laden: zweite });
    meldeSupportGeaendert();
    await warten();
    expect(erste).not.toHaveBeenCalled();
    expect(zweite).toHaveBeenCalledTimes(1);
    unmount();
    meldeSupportGeaendert();
    await warten();
    expect(zweite).toHaveBeenCalledTimes(1);
  });

  it('die eigene Quelle: eigene Meldungen laden nicht, fremde schon', async () => {
    const laden = vi.fn();
    const { result } = renderHook(() => {
      const quelle = useSupportQuelle();
      useSupportGeaendert(laden, { quelle });
      return quelle;
    });
    meldeSupportGeaendert(result.current);
    await warten();
    expect(laden).not.toHaveBeenCalled();
    meldeSupportGeaendert();
    await warten();
    expect(laden).toHaveBeenCalledTimes(1);
  });

  it('useSupportQuelle: dieselbe Kennung über alle Renderings einer Stelle, eine andere je Stelle', () => {
    const a = renderHook(() => useSupportQuelle());
    const erste = a.result.current;
    a.rerender();
    expect(a.result.current).toBe(erste);
    const b = renderHook(() => useSupportQuelle());
    expect(b.result.current).not.toBe(erste);
  });

  it('lädt, wenn das Fenster wieder sichtbar wird -- nicht, wenn es verschwindet', () => {
    const laden = vi.fn();
    const { unmount } = renderHook(() => useSupportGeaendert(laden));
    sichtbarkeit('hidden');
    expect(laden).not.toHaveBeenCalled();
    sichtbarkeit('visible');
    expect(laden).toHaveBeenCalledTimes(1);
    unmount();
    sichtbarkeit('visible');
    expect(laden).toHaveBeenCalledTimes(1);
  });

  it('lädt beim erneuten Betreten der Seite (Ionic hält Seiten im Speicher), beim ersten Betreten nicht', () => {
    const laden = vi.fn();
    renderHook(() => useSupportGeaendert(laden));
    seiteBetreten();
    expect(laden).not.toHaveBeenCalled();
    seiteBetreten();
    expect(laden).toHaveBeenCalledTimes(1);
    seiteBetreten();
    expect(laden).toHaveBeenCalledTimes(2);
  });

  it('beimBetreten: false lässt das Betreten aus (die Seite lädt es schon selbst, useWebDaten)', () => {
    const laden = vi.fn();
    renderHook(() => useSupportGeaendert(laden, { beimBetreten: false }));
    seiteBetreten();
    seiteBetreten();
    expect(laden).not.toHaveBeenCalled();
  });
});
