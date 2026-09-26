import { describe, it, expect, vi, afterEach } from 'vitest';
import React from 'react';
import { render, screen, cleanup } from '@testing-library/react';

// ---------------------------------------------------------------------------
// Audit 26.09.2026, UI-Bericht BF-13 -- gerenderte Gegenprobe zum
// Quelltext-Scan (beruehrungsziele.test.ts): Zwei der kleinen Knoepfe werden
// gerendert; sie muessen echte <button> sein UND die Klasse tragen, die die
// 44-px-Trefffläche liefert. Die Groesse selbst misst Playwright (siehe
// beruehrungsziele.test.ts); jsdom kennt kein Layout.
// ---------------------------------------------------------------------------

vi.mock('@ionic/react', async (importOriginal) => {
  const echt = await importOriginal<typeof import('@ionic/react')>();
  return { ...echt, useIonRouter: () => ({ push: vi.fn(), goBack: vi.fn(), canGoBack: () => false, routeInfo: undefined }) };
});
vi.mock('../../services/auth', () => ({ loginWithAutoDetection: vi.fn(), mitBiometrieAnmelden: vi.fn(), sitzungUebernehmen: vi.fn() }));
vi.mock('../../services/biometrics', () => ({
  biometrieVerfuegbar: async () => ({ verfuegbar: false, art: 'keine', bezeichnung: null, sinnbild: 'schloss' }),
  istBiometrieAktiv: async () => false,
}));
vi.mock('../../services/tokenStore', () => ({ setToken: vi.fn(), setUser: vi.fn(), setRefreshToken: vi.fn() }));
vi.mock('../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() } }));
const standort = { pathname: '/', search: '', state: null };
vi.mock('../../navigation/useAppLocation', () => ({ useAppLocation: () => standort }));
vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({ setUser: vi.fn(), setSuccess: vi.fn(), setError: vi.fn(), isOnline: true }),
}));

import LoginView from '../../components/auth/LoginView';
import UpdateHinweisKarte from '../../components/shared/UpdateHinweisKarte';

afterEach(cleanup);

describe('Kleine Knoepfe mit 44-px-Trefffläche (UI BF-13)', () => {
  it('Auge am Passwortfeld: ein <button> mit app-beruehrungsziel', () => {
    render(<LoginView />);
    const auge = screen.getByRole('button', { name: 'Passwort anzeigen' });
    expect(auge.tagName).toBe('BUTTON');
    expect(auge.classList.contains('app-auth-input__toggle')).toBe(true);
    expect(auge.classList.contains('app-beruehrungsziel')).toBe(true);
  });

  it('X der Neuigkeiten-Karte: ein <button> mit app-beruehrungsziel, die Karte selbst nicht', () => {
    render(<UpdateHinweisKarte onOpen={() => {}} onDismiss={() => {}} />);
    const x = screen.getByRole('button', { name: 'Hinweis ausblenden' });
    expect(x.tagName).toBe('BUTTON');
    expect(x.classList.contains('app-whatsnew__close')).toBe(true);
    expect(x.classList.contains('app-beruehrungsziel')).toBe(true);
    // Die Karte ist ohnehin gross genug; sie bekommt kein Pseudo-Element, das ueber den Rand ragt.
    const karte = x.closest('.app-whatsnew')!;
    expect(karte.classList.contains('app-beruehrungsziel')).toBe(false);
  });
});
