import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, cleanup, act, fireEvent } from '@testing-library/react';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/*
 * Schalter "Absturzberichte senden" im Profil (Audit 26.09.2026,
 * Sicherheit BF-22). Bis hierher gingen Absturzberichte ohne jede
 * Abschaltmoeglichkeit an Crashlytics.
 *
 * Geprueft wird: (1) der Schalter steht in allen drei Rollen, (2) er
 * erscheint nur in der App, (3) er zeigt die gemerkte Wahl, (4) Umschalten
 * ruft den Dienst mit genau diesem Wert. Dass "aus" wirklich nichts sendet,
 * prueft services/absturzdiagnose.test.ts.
 */

let isNative = true;
vi.mock('@capacitor/core', async () => {
  const echt = await vi.importActual<typeof import('@capacitor/core')>('@capacitor/core');
  return { ...echt, Capacitor: { ...echt.Capacitor, isNativePlatform: () => isNative, getPlatform: () => (isNative ? 'ios' : 'web') } };
});

const mockErlaubt = vi.fn();
const mockSchalten = vi.fn(async () => undefined);
vi.mock('../../services/absturzdiagnose', () => ({
  diagnoseErlaubt: (...a: unknown[]) => mockErlaubt(...(a as [])),
  diagnoseSchalten: (...a: unknown[]) => mockSchalten(...(a as [])),
}));

// JSDOM reicht ionChange nicht an React durch (siehe pushAuswahl.test.tsx):
// der Schalter wird durch ein schlichtes Kontrollkaestchen mit denselben
// Props ersetzt.
vi.mock('@ionic/react', async () => {
  const echt = await vi.importActual<typeof import('@ionic/react')>('@ionic/react');
  const ReactEcht = await vi.importActual<typeof import('react')>('react');
  const IonToggle = (p: { checked?: boolean; 'aria-label'?: string; onIonChange?: (e: { detail: { checked: boolean } }) => void }) =>
    ReactEcht.createElement('input', {
      type: 'checkbox',
      'aria-label': p['aria-label'],
      checked: !!p.checked,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => p.onIonChange?.({ detail: { checked: e.target.checked } })
    });
  return { ...echt, IonToggle };
});

import AbsturzberichteSchalter from '../../components/shared/AbsturzberichteSchalter';

beforeEach(() => {
  vi.clearAllMocks();
  isNative = true;
  mockErlaubt.mockResolvedValue(true);
});
afterEach(cleanup);

/** Der Schalter (im Test ein Kontrollkaestchen mit dem Label des IonToggle). */
const schalter = () => screen.getByLabelText('Absturzberichte senden') as HTMLInputElement;

describe('AbsturzberichteSchalter', () => {
  it('erscheint im Browser nicht', async () => {
    isNative = false;
    const { container } = render(<AbsturzberichteSchalter variante="purple" />);
    // kurz warten, falls doch etwas nachlaedt
    await act(async () => { await Promise.resolve(); });
    expect(container.querySelector('.app-list-item')).toBeNull();
    expect(mockErlaubt).not.toHaveBeenCalled();
  });

  it('steht ohne gemerkte Wahl auf AN', async () => {
    render(<AbsturzberichteSchalter variante="purple" />);
    expect(await screen.findByText('Absturzberichte senden')).toBeInTheDocument();
    expect(screen.getByText('Hilft, Fehler zu finden – ohne Namen und Inhalte')).toBeInTheDocument();
    expect(schalter().checked).toBe(true);
  });

  it('zeigt die gemerkte Wahl AUS', async () => {
    mockErlaubt.mockResolvedValue(false);
    render(<AbsturzberichteSchalter variante="users" />);
    expect(await screen.findByText('Aus – die App sendet keine Absturzberichte')).toBeInTheDocument();
    expect(schalter().checked).toBe(false);
  });

  it('Ausschalten ruft den Dienst mit false und aendert den Text', async () => {
    render(<AbsturzberichteSchalter variante="teamer" />);
    await screen.findByText('Absturzberichte senden');
    fireEvent.click(schalter());
    await waitFor(() => expect(mockSchalten).toHaveBeenCalledWith(false));
    expect(mockSchalten).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Aus – die App sendet keine Absturzberichte')).toBeInTheDocument();
  });

  it('Einschalten ruft den Dienst mit true', async () => {
    mockErlaubt.mockResolvedValue(false);
    render(<AbsturzberichteSchalter variante="teamer" />);
    await screen.findByText('Absturzberichte senden');
    fireEvent.click(schalter());
    await waitFor(() => expect(mockSchalten).toHaveBeenCalledWith(true));
    expect(mockSchalten).toHaveBeenCalledTimes(1);
  });

  it('uebernimmt die Farbvariante der Rolle', async () => {
    const { container } = render(<AbsturzberichteSchalter variante="teamer" />);
    await screen.findByText('Absturzberichte senden');
    expect(container.querySelector('.app-list-item--teamer')).not.toBeNull();
  });
});

describe('der Schalter steht in allen drei Rollen', () => {
  const lies = (p: string) => readFileSync(resolve(__dirname, '../..', p), 'utf-8');
  it.each([
    ['components/konfi/views/ProfileView.tsx', 'purple'],
    ['components/teamer/pages/TeamerProfilePage.tsx', 'teamer'],
    ['components/admin/pages/AdminProfilePage.tsx', 'users'],
  ])('%s bindet ihn in der Variante %s ein', (datei, variante) => {
    expect(lies(datei)).toContain(`<AbsturzberichteSchalter variante="${variante}" />`);
  });
});
