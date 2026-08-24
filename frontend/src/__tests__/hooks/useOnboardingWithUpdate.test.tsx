import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';

// In-Memory-Ersatz für Capacitor Preferences (geraetelokaler Flag-Speicher).
const store = new Map<string, string>();
vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: vi.fn(async ({ key }: { key: string }) => ({ value: store.get(key) ?? null })),
    set: vi.fn(async ({ key, value }: { key: string; value: string }) => { store.set(key, value); }),
  },
}));

// useIonViewDidEnter feuert im echten Ionic beim Betreten der Seite —
// im Test genügt ein Effekt beim Mounten.
vi.mock('@ionic/react', () => ({
  useIonViewDidEnter: (cb: () => void) => { React.useEffect(() => { cb(); }, []); },
}));

import { useOnboardingWithUpdateOnce, UPDATE_WALKTHROUGH_KEY } from '../../hooks/useOnboardingOnce';

const ONBOARDING_KEY = 'konfi_onboarding_seen_7';
const UPDATE_KEY = `${UPDATE_WALKTHROUGH_KEY}_7`;

const mounten = () => renderHook(() => useOnboardingWithUpdateOnce('konfi_onboarding_seen', 7));

describe('useOnboardingWithUpdateOnce', () => {
  beforeEach(() => {
    store.clear();
  });

  it('Bestandsnutzer ohne Update-Flag: Karte erscheint, Flag bleibt UNGESETZT', async () => {
    store.set(ONBOARDING_KEY, '1');
    const { result } = mounten();

    await waitFor(() => expect(result.current.showUpdateHinweis).toBe(true));
    expect(result.current.showOnboarding).toBe(false);
    // Das Flag wird erst durch eine bewusste Aktion gesetzt — die Karte
    // muss nach einem App-Neustart wiederkommen, solange niemand sie wegklickt.
    expect(store.has(UPDATE_KEY)).toBe(false);
  });

  it('markUpdateHinweisGesehen blendet die Karte aus und setzt das Flag — beim nächsten Mount bleibt sie weg', async () => {
    store.set(ONBOARDING_KEY, '1');
    const erste = mounten();
    await waitFor(() => expect(erste.result.current.showUpdateHinweis).toBe(true));

    act(() => { erste.result.current.markUpdateHinweisGesehen(); });
    expect(erste.result.current.showUpdateHinweis).toBe(false);
    await waitFor(() => expect(store.get(UPDATE_KEY)).toBe('1'));
    erste.unmount();

    // Zweiter "App-Start": Karte darf nicht wiederkommen.
    const zweite = mounten();
    // Kurz warten, bis die Preferences-Promises durch sind.
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(zweite.result.current.showUpdateHinweis).toBe(false);
    expect(zweite.result.current.showOnboarding).toBe(false);
  });

  it('frischer Account: Onboarding-Tour statt Karte, beide Flags gesetzt', async () => {
    const { result } = mounten();

    await waitFor(() => expect(result.current.showOnboarding).toBe(true), { timeout: 2000 });
    expect(result.current.showUpdateHinweis).toBe(false);
    expect(store.get(ONBOARDING_KEY)).toBe('1');
    // Frische Accounts lernen die Neuerungen in der Tour — kein Update-Hinweis.
    expect(store.get(UPDATE_KEY)).toBe('1');
  });

  it('beide Flags gesetzt: weder Tour noch Karte', async () => {
    store.set(ONBOARDING_KEY, '1');
    store.set(UPDATE_KEY, '1');
    const { result } = mounten();

    await act(async () => { await new Promise((r) => setTimeout(r, 600)); });
    expect(result.current.showOnboarding).toBe(false);
    expect(result.current.showUpdateHinweis).toBe(false);
  });
});
