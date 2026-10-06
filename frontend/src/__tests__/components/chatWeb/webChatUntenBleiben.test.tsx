// Wer unten liest, bleibt unten, wenn der Verlauf nachwaechst
// (components/chat/web/useUntenBleiben.ts).
//
// Anlass (im Browser gemessen): Bilder laden erst in der Naehe des sichtbaren
// Bereichs und wachsen dabei von der Platzhalterhoehe auf ihre Hoehe. Springt
// jemand mit dem Knopf "Zu den neuesten Nachrichten" ans Ende, laden die Bilder
// auf dem Weg nach -- der Verlauf stand danach 214 px zu weit oben, die letzte
// Nachricht halb unter der Eingabe, der Knopf war schon weg.
//
// Hier steht der Hook allein in einer kleinen Huelle: Der Beobachter der
// Groesse ist nachgebaut (jsdom hat keinen), der Verlauf ist ein Element mit den
// Aufrufen von ion-content und veraenderbaren Massen.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react';
import { useUntenBleiben } from '../../../components/chat/web/useUntenBleiben';

class BeobachterNachbau {
  static alle: BeobachterNachbau[] = [];
  beobachtet: Element[] = [];
  getrennt = false;
  constructor(public rueckruf: () => void) { BeobachterNachbau.alle.push(this); }
  observe(el: Element) { this.beobachtet.push(el); }
  unobserve() {}
  disconnect() { this.getrennt = true; }
}

const masse = { hoehe: 2000, oben: 1310, sichtbar: 690 };
const zumEnde = vi.fn();
let contentRef: React.RefObject<HTMLIonContentElement | null>;

const neuerVerlauf = () => {
  const el = Object.assign(document.createElement('div'), {
    getScrollElement: async () => ({ scrollHeight: masse.hoehe, scrollTop: masse.oben, clientHeight: masse.sichtbar }),
    scrollToBottom: (ms?: number) => { zumEnde(ms); },
  });
  return { current: el as unknown as HTMLIonContentElement };
};

const Huelle: React.FC = () => {
  const r = useUntenBleiben(contentRef);
  return (
    <>
      <div ref={r.listeRef} data-testid="liste" />
      <button type="button" onClick={r.sprungBeginnt}>Sprung</button>
    </>
  );
};
/** Der Knopf "Zu den neuesten Nachrichten springen" wird gedrueckt. */
const sprungBeginnt = () => fireEvent.click(screen.getByRole('button', { name: 'Sprung' }));

const beobachter = () => BeobachterNachbau.alle[BeobachterNachbau.alle.length - 1];
/** Der Verlauf meldet eine neue Groesse. */
const meldet = async (hoehe: number, oben?: number) => {
  masse.hoehe = hoehe;
  if (oben !== undefined) masse.oben = oben;
  beobachter().rueckruf();
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
};
const zeit = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

/** Ein Raum, der geoeffnet ist und ganz unten steht: 2000 px hoch, 690 sichtbar, ganz unten. */
const oeffnenUnten = async () => {
  render(<Huelle />);
  await meldet(2000, 1310);
  zumEnde.mockClear();
};

beforeEach(() => {
  vi.useFakeTimers();
  BeobachterNachbau.alle = [];
  vi.stubGlobal('ResizeObserver', BeobachterNachbau);
  Object.assign(masse, { hoehe: 2000, oben: 1310, sichtbar: 690 });
  zumEnde.mockClear();
  contentRef = neuerVerlauf();
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('Verlauf bleibt unten, wenn er nachwaechst', () => {
  it('beobachtet die Liste der Nachrichten', () => {
    render(<Huelle />);
    expect(BeobachterNachbau.alle).toHaveLength(1);
    expect(beobachter().beobachtet).toEqual([screen.getByTestId('liste')]);
  });

  it('wer ganz unten steht, wird nach einem nachgeladenen Bild wieder ganz nach unten gesetzt', async () => {
    await oeffnenUnten();
    await meldet(2214); // das Bild ist 214 px gewachsen
    expect(zumEnde).toHaveBeenCalledTimes(1);
    expect(zumEnde).toHaveBeenCalledWith(0);
  });

  it('auch knapp ueber dem Ende: bei 79 px Abstand zaehlt es noch als unten', async () => {
    await oeffnenUnten();
    await meldet(2214, 2000 - 690 - 79);
    expect(zumEnde).toHaveBeenCalledTimes(1);
  });

  it('ab 80 px Abstand liest man weiter oben und bleibt stehen', async () => {
    await oeffnenUnten();
    await meldet(2214, 2000 - 690 - 80);
    expect(zumEnde).not.toHaveBeenCalled();
  });

  it('wer weiter oben liest, bleibt stehen', async () => {
    await oeffnenUnten();
    await meldet(2214, 500); // 810 px vom Ende
    expect(zumEnde).not.toHaveBeenCalled();
  });

  it('schrumpft der Verlauf oder bleibt gleich, passiert nichts', async () => {
    await oeffnenUnten();
    await meldet(1900);
    await meldet(1900);
    expect(zumEnde).not.toHaveBeenCalled();
  });

  it('der erste Block (leerer Verlauf -> Nachrichten) gehoert useChatScroll: kein Griff ans Ende', async () => {
    render(<Huelle />);
    await meldet(40, 0); // nur die Zeile "Anfang des Chats"
    await meldet(2000, 0); // die Nachrichten sind da, useChatScroll scrollt zum neuen-Trenner
    expect(zumEnde).not.toHaveBeenCalled();
  });

  it('aeltere Nachrichten, die oben dazukommen, ziehen die Leserin nicht ans Ende', async () => {
    await oeffnenUnten();
    await meldet(2000, 0); // oben angekommen, der Verlauf laedt nach
    await meldet(2800, 0);
    expect(zumEnde).not.toHaveBeenCalled();
  });
});

describe('Sprung mit dem Knopf "Zu den neuesten Nachrichten"', () => {
  it('waehrend des Sprungs setzt ein nachladendes Bild ans Ende -- und noch einmal, wenn das sanfte Scrollen durch ist', async () => {
    await oeffnenUnten();
    masse.oben = 600; // weit oben, der Knopf ist sichtbar
    sprungBeginnt();
    await meldet(2214, 700); // auf dem Weg waechst das Bild
    expect(zumEnde).toHaveBeenCalledTimes(1);
    expect(zumEnde).toHaveBeenLastCalledWith(0);
    // Das sanfte Scrollen lief zum alten Ziel weiter und hat den Sprung ueberschrieben.
    await zeit(349);
    expect(zumEnde).toHaveBeenCalledTimes(1);
    await zeit(1);
    expect(zumEnde).toHaveBeenCalledTimes(2);
  });

  it('ohne Sprung bleibt dieselbe Lage (weit oben, Bild waechst) unberuehrt', async () => {
    await oeffnenUnten();
    await meldet(2214, 700);
    await zeit(1000);
    expect(zumEnde).not.toHaveBeenCalled();
  });

  it('wer unterwegs selbst scrollt (Mausrad), beendet die Reise: das Bild zieht ihn nicht mehr nach unten', async () => {
    await oeffnenUnten();
    sprungBeginnt();
    fireEvent.wheel(contentRef.current as unknown as Element);
    await meldet(2214, 700);
    expect(zumEnde).not.toHaveBeenCalled();
  });

  it.each(['touchstart', 'keydown', 'pointerdown'])('%s beendet die Reise ebenso', async (ereignis) => {
    await oeffnenUnten();
    sprungBeginnt();
    fireEvent(contentRef.current as unknown as Element, new Event(ereignis, { bubbles: true }));
    await meldet(2214, 700);
    expect(zumEnde).not.toHaveBeenCalled();
  });

  it('der Griff nach dem Ende laeuft nicht mehr, wenn die Leserin nach dem ersten Bild selbst scrollt', async () => {
    await oeffnenUnten();
    sprungBeginnt();
    await meldet(2214, 700);
    zumEnde.mockClear();
    fireEvent.wheel(contentRef.current as unknown as Element);
    await zeit(1000);
    expect(zumEnde).not.toHaveBeenCalled();
  });

  it('nach einer Sekunde gilt der Sprung als vorbei', async () => {
    await oeffnenUnten();
    sprungBeginnt();
    await zeit(1001);
    await meldet(2214, 700);
    expect(zumEnde).not.toHaveBeenCalled();
  });
});

describe('Aufraeumen', () => {
  it('beim Abbau wird der Beobachter getrennt und ein offener Nachgriff laeuft nicht mehr', async () => {
    await oeffnenUnten();
    sprungBeginnt();
    await meldet(2214, 700);
    zumEnde.mockClear();
    cleanup();
    expect(beobachter().getrennt).toBe(true);
    await zeit(1000);
    expect(zumEnde).not.toHaveBeenCalled();
  });

  it('ohne Beobachter der Groesse (alter Browser) bricht nichts', () => {
    vi.stubGlobal('ResizeObserver', undefined);
    expect(() => render(<Huelle />)).not.toThrow();
  });
});
