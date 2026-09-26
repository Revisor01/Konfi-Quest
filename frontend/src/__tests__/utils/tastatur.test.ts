import { describe, it, expect, vi } from 'vitest';
import type { KeyboardEvent } from 'react';
import { beiEnter } from '../../utils/tastatur';

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
