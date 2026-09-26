import { describe, it, expect, vi } from 'vitest';
import type { KeyboardEvent } from 'react';
import { beiEnter, beiEnterOderLeertaste, tastaturKlick } from '../../utils/tastatur';

// Klickbare divs/spans mit role="button" brauchen das Tastaturverhalten eines
// Knopfs: Enter UND Leertaste, aber nur fuer das Element selbst -- ein Knopf im
// Inneren behandelt seine Tasten allein (Audit 26.09.2026, UI BF-03).

const knopfEreignis = (key: string, aufKind = false) => {
  const element = document.createElement('div');
  const kind = document.createElement('button');
  element.appendChild(kind);
  const preventDefault = vi.fn();
  return {
    element,
    preventDefault,
    e: {
      key, preventDefault, currentTarget: element, target: aufKind ? kind : element, nativeEvent: { isComposing: false },
    } as unknown as KeyboardEvent<HTMLElement>,
  };
};

describe('beiEnterOderLeertaste', () => {
  it('Enter und Leertaste loesen die Aktion aus und unterdruecken die Standardbehandlung', () => {
    for (const key of ['Enter', ' ']) {
      const aktion = vi.fn();
      const { e, preventDefault } = knopfEreignis(key);
      beiEnterOderLeertaste(aktion)(e);
      expect(aktion).toHaveBeenCalledTimes(1);
      expect(preventDefault).toHaveBeenCalledTimes(1);
    }
  });

  it('andere Tasten tun nichts', () => {
    const aktion = vi.fn();
    for (const key of ['a', 'Tab', 'Escape', 'ArrowDown', 'Spacebar']) {
      const { e, preventDefault } = knopfEreignis(key);
      beiEnterOderLeertaste(aktion)(e);
      expect(preventDefault).not.toHaveBeenCalled();
    }
    expect(aktion).not.toHaveBeenCalled();
  });

  it('Enter auf einem Knopf IM Element loest die Zeile nicht zusaetzlich aus', () => {
    const aktion = vi.fn();
    const { e, preventDefault } = knopfEreignis('Enter', true);
    beiEnterOderLeertaste(aktion)(e);
    expect(aktion).not.toHaveBeenCalled();
    expect(preventDefault).not.toHaveBeenCalled();
  });
});

describe('tastaturKlick', () => {
  it('Enter klickt das Element -- derselbe onClick wie bei Finger und Maus', () => {
    const { element, e } = knopfEreignis('Enter');
    const klick = vi.fn();
    element.addEventListener('click', klick);
    tastaturKlick(e);
    expect(klick).toHaveBeenCalledTimes(1);
    expect(klick.mock.calls[0][0]).toBeInstanceOf(MouseEvent);
  });

  it('Leertaste klickt ebenfalls, Tab nicht', () => {
    const { element, e } = knopfEreignis(' ');
    const klick = vi.fn();
    element.addEventListener('click', klick);
    tastaturKlick(e);
    tastaturKlick(knopfEreignis('Tab').e);
    expect(klick).toHaveBeenCalledTimes(1);
  });
});

// Enter in einem ion-input schickt nichts ab (das native <input> haengt an
// keinem <form>, ion-input behandelt Enter nicht). beiEnter reicht Enter an
// die Aktion der Seite weiter -- und nur Enter (Audit 26.09.2026, UI BF-02).

const ereignis = (key: string, isComposing = false) => {
  const preventDefault = vi.fn();
  return {
    e: { key, preventDefault, nativeEvent: { isComposing } } as unknown as KeyboardEvent<HTMLElement>,
    preventDefault,
  };
};

describe('beiEnter', () => {
  it('Enter loest die Aktion aus und unterdrueckt die Standardbehandlung', () => {
    const aktion = vi.fn();
    const { e, preventDefault } = ereignis('Enter');
    beiEnter(aktion)(e);
    expect(aktion).toHaveBeenCalledTimes(1);
    expect(preventDefault).toHaveBeenCalledTimes(1);
  });

  it('andere Tasten tun nichts', () => {
    const aktion = vi.fn();
    for (const key of ['a', 'Tab', ' ', 'Escape', 'NumpadEnter']) {
      const { e, preventDefault } = ereignis(key);
      beiEnter(aktion)(e);
      expect(preventDefault).not.toHaveBeenCalled();
    }
    expect(aktion).not.toHaveBeenCalled();
  });

  it('Enter waehrend einer IME-Komposition bestaetigt nur die Zeichenwahl', () => {
    const aktion = vi.fn();
    const { e, preventDefault } = ereignis('Enter', true);
    beiEnter(aktion)(e);
    expect(aktion).not.toHaveBeenCalled();
    expect(preventDefault).not.toHaveBeenCalled();
  });
});
