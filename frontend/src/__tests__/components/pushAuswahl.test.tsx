import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// ---------------------------------------------------------------------------
// Auswahl der Push-Gruppen in der App (25.09.2026). Simon: "waere doch super,
// wenn das quasi wie in Android auch auf iOS auswaehlbar macht welche pushes
// man bekommt."
//
// Geprueft wird die gemeinsame Komponente aller drei Rollen:
//   - Das Modal zeigt genau die Gruppen, die der Server fuer die Rolle
//     liefert -- keine eigene Liste in der App.
//   - Ein Schalter schickt sofort PUT mit der vollstaendigen Abwahl-Liste.
//   - Der Hauptschalter schickt push_enabled; aus heisst: Gruppen gesperrt.
//   - Der Eintrag fordert die Geraete-Berechtigung an, solange sie fehlt.
//   - Alle drei Profil-Seiten binden den Eintrag ein.
// ---------------------------------------------------------------------------

const apiGet = vi.fn();
const apiPut = vi.fn();
vi.mock('../../services/api', () => ({
  default: {
    get: (...args: unknown[]) => apiGet(...args),
    put: (...args: unknown[]) => apiPut(...args),
    post: vi.fn().mockResolvedValue({ data: {} }),
    delete: vi.fn().mockResolvedValue({ data: {} })
  }
}));

const mockRequestPush = vi.fn().mockResolvedValue(undefined);
const mockSetError = vi.fn();
let berechtigung = 'granted';
vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({
    setError: mockSetError,
    pushNotificationsPermission: berechtigung,
    requestPushPermissions: mockRequestPush
  })
}));

const mockZeigeModal = vi.fn();
// JSDOM reicht das ionChange-Ereignis der Web-Komponenten nicht an React
// durch (siehe teamerSegmentLadezustand.test.tsx). Schalter und Knopf werden
// deshalb durch schlichte Elemente ersetzt, die dieselben Props bedienen --
// geprueft wird die Logik der Komponente, nicht Ionics Ereignisweg.
vi.mock('@ionic/react', async () => {
  const echt = await vi.importActual<typeof import('@ionic/react')>('@ionic/react');
  const ReactEcht = await vi.importActual<typeof import('react')>('react');
  const IonToggle = (p: { checked?: boolean; disabled?: boolean; 'aria-label'?: string; onIonChange?: (e: { detail: { checked: boolean } }) => void }) =>
    ReactEcht.createElement('input', {
      type: 'checkbox',
      'aria-label': p['aria-label'],
      checked: !!p.checked,
      disabled: !!p.disabled,
      onChange: (e: React.ChangeEvent<HTMLInputElement>) => p.onIonChange?.({ detail: { checked: e.target.checked } })
    });
  const IonButton = (p: { children?: React.ReactNode; onClick?: () => void; 'aria-label'?: string }) =>
    ReactEcht.createElement('button', { onClick: p.onClick, 'aria-label': p['aria-label'] }, p.children);
  return { ...echt, IonToggle, IonButton, useIonModal: () => [mockZeigeModal, vi.fn()] };
});

import PushAuswahlEintrag, { PushAuswahlModal, pushZusammenfassung } from '../../components/shared/PushAuswahl';

const KONFI_ANTWORT = {
  push_enabled: true,
  stumm: [],
  gruppen: [
    { id: 'konfi_chat', name: 'Nachrichten', beschreibung: 'Neue Nachrichten in deinen Chats', aktiv: true },
    { id: 'konfi_termine', name: 'Termine', beschreibung: 'Anmeldungen, Änderungen, Absagen und Erinnerungen', aktiv: true },
    { id: 'konfi_fortschritt', name: 'Punkte und Abzeichen', beschreibung: 'Punkte, Abzeichen, Level, Challenges und der Rückblick', aktiv: true }
  ]
};

beforeEach(() => {
  vi.clearAllMocks();
  berechtigung = 'granted';
  apiGet.mockResolvedValue({ data: KONFI_ANTWORT });
  apiPut.mockImplementation((_url: string, body: { stumm?: string[]; push_enabled?: boolean }) =>
    Promise.resolve({ data: { success: true, push_enabled: body.push_enabled ?? true, stumm: body.stumm ?? [] } })
  );
});

const schalter = (name: string) => screen.getByLabelText(name) as HTMLInputElement;
const umschalten = async (name: string, an: boolean) => {
  fireEvent.click(schalter(name));
  await waitFor(() => expect(schalter(name).checked).toBe(an));
};

describe('PushAuswahlModal', () => {
  it('zeigt genau die Gruppen des Servers -- bei Konfis drei, ohne Verwaltung', async () => {
    render(<PushAuswahlModal onClose={() => {}} variante="purple" />);
    expect(await screen.findByText('Nachrichten')).toBeInTheDocument();
    expect(screen.getByText('Termine')).toBeInTheDocument();
    expect(screen.getByText('Punkte und Abzeichen')).toBeInTheDocument();
    expect(screen.queryByText('Anfragen und Freigaben')).toBeNull();
    expect(apiGet).toHaveBeenCalledWith('/notifications/preferences');
  });

  // SIMONS BEFUND (26.09.2026): "Die Hinweistexte bei Benachrichtigungen sind
  // voellig random doppelt, nicht so wie sonst die Hinweise."
  // Vorher stand dieselbe Aussage zweimal -- im Untertitel des Hauptschalters
  // ("Aus heisst: nichts aufs Handy, alles bleibt im Postfach") UND als
  // Fliesstext darunter. Der Fliesstext war ausserdem ein <p> mit eigenem
  // Rand AUSSERHALB der Karte, waehrend die App sonst IonNote INNERHALB nutzt.
  it('sagt genau EINMAL, dass das Postfach bleibt', async () => {
    render(<PushAuswahlModal onClose={() => {}} variante="purple" />);
    await screen.findByText('Nachrichten');
    const treffer = screen.queryAllByText(/im Postfach/i);
    expect(treffer, `"im Postfach" steht ${treffer.length}x statt 1x`).toHaveLength(1);
  });

  it('stellt den Hinweis wie ueberall sonst dar: IonNote in der Karte', async () => {
    const { container } = render(<PushAuswahlModal onClose={() => {}} variante="purple" />);
    await screen.findByText('Nachrichten');
    const hinweis = container.querySelector('.app-hinweis-text');
    expect(hinweis, 'kein Hinweis mit der ueblichen Klasse').toBeTruthy();
    expect(hinweis!.tagName.toLowerCase()).toBe('ion-note');
    // Innerhalb der Karte, nicht als loser Absatz daneben.
    expect(hinweis!.closest('ion-card'), 'Hinweis steht ausserhalb der Karte').toBeTruthy();
  });

  it('zeigt eine vierte Gruppe, sobald der Server sie liefert (Team und Leitung)', async () => {
    apiGet.mockResolvedValue({ data: {
      ...KONFI_ANTWORT,
      gruppen: [...KONFI_ANTWORT.gruppen, { id: 'konfi_verwaltung', name: 'Anfragen und Freigaben', beschreibung: 'Was auf deine Entscheidung wartet', aktiv: true }]
    } });
    render(<PushAuswahlModal onClose={() => {}} variante="users" />);
    expect(await screen.findByText('Anfragen und Freigaben')).toBeInTheDocument();
  });

  it('Gruppe abwaehlen schickt PUT mit der vollstaendigen Abwahl-Liste; wieder anwaehlen leert sie', async () => {
    render(<PushAuswahlModal onClose={() => {}} variante="purple" />);
    await screen.findByText('Termine');

    await umschalten('Termine', false);
    await waitFor(() => expect(apiPut).toHaveBeenLastCalledWith('/notifications/preferences', { stumm: ['konfi_termine'] }));

    await umschalten('Nachrichten', false);
    await waitFor(() => expect(apiPut).toHaveBeenLastCalledWith('/notifications/preferences', { stumm: ['konfi_termine', 'konfi_chat'] }));

    await umschalten('Termine', true);
    await waitFor(() => expect(apiPut).toHaveBeenLastCalledWith('/notifications/preferences', { stumm: ['konfi_chat'] }));
    expect(apiPut).toHaveBeenCalledTimes(3);
  });

  it('Hauptschalter aus schickt push_enabled=false und sperrt die Gruppen-Schalter', async () => {
    render(<PushAuswahlModal onClose={() => {}} variante="teamer" />);
    await screen.findByText('Termine');

    await umschalten('Mitteilungen aufs Handy', false);
    expect(apiPut).toHaveBeenLastCalledWith('/notifications/preferences', { push_enabled: false });
    await waitFor(() => expect(schalter('Termine').disabled).toBe(true));
    expect(schalter('Mitteilungen aufs Handy').disabled).toBe(false);
  });

  it('ohne Geraete-Berechtigung steht ein Hinweis mit Knopf, der sie anfordert', async () => {
    berechtigung = 'prompt';
    render(<PushAuswahlModal onClose={() => {}} variante="purple" />);
    const knopf = await screen.findByText('Mitteilungen erlauben');
    fireEvent.click(knopf);
    await waitFor(() => expect(mockRequestPush).toHaveBeenCalledTimes(1));
  });

  it('mit Berechtigung gibt es den Hinweis nicht', async () => {
    render(<PushAuswahlModal onClose={() => {}} variante="purple" />);
    await screen.findByText('Termine');
    expect(screen.queryByText('Mitteilungen erlauben')).toBeNull();
  });
});

describe('PushAuswahlEintrag', () => {
  it('oeffnet das Modal und fordert die Berechtigung NICHT erneut an, wenn sie erteilt ist', async () => {
    render(<PushAuswahlEintrag variante="users" />);
    await screen.findByText('Alle Mitteilungen aufs Handy');
    await act(async () => { fireEvent.click(screen.getByText('Benachrichtigungen')); });
    expect(mockZeigeModal).toHaveBeenCalledTimes(1);
    expect(mockRequestPush).not.toHaveBeenCalled();
  });

  it('fordert die Berechtigung an, solange sie fehlt -- und oeffnet trotzdem die Auswahl', async () => {
    berechtigung = 'prompt';
    render(<PushAuswahlEintrag variante="purple" />);
    expect(await screen.findByText('Noch nicht erlaubt – antippen zum Erlauben')).toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByText('Benachrichtigungen')); });
    expect(mockRequestPush).toHaveBeenCalledTimes(1);
    expect(mockZeigeModal).toHaveBeenCalledTimes(1);
  });
});

describe('pushZusammenfassung', () => {
  const basis = KONFI_ANTWORT;
  it('benennt den Stand in einer Zeile', () => {
    expect(pushZusammenfassung(basis, 'granted')).toBe('Alle Mitteilungen aufs Handy');
    expect(pushZusammenfassung({ ...basis, push_enabled: false }, 'granted')).toBe('Aus – nur im Postfach');
    const zwei = { ...basis, gruppen: basis.gruppen.map((g, i) => ({ ...g, aktiv: i !== 0 })) };
    expect(pushZusammenfassung(zwei, 'granted')).toBe('2 von 3 Gruppen aufs Handy');
    const keine = { ...basis, gruppen: basis.gruppen.map((g) => ({ ...g, aktiv: false })) };
    expect(pushZusammenfassung(keine, 'granted')).toBe('Keine Gruppe ausgewählt – nur im Postfach');
    expect(pushZusammenfassung(basis, 'denied')).toBe('Noch nicht erlaubt – antippen zum Erlauben');
  });
});

describe('Alle drei Rollen binden den Eintrag ein', () => {
  const quelle = (rel: string) => readFileSync(resolve(__dirname, '../../components', rel), 'utf8');
  it.each([
    ['admin/pages/AdminSettingsPage.tsx', 'users'],
    ['teamer/pages/TeamerProfilePage.tsx', 'teamer'],
    ['konfi/views/ProfileView.tsx', 'purple']
  ])('%s zeigt PushAuswahlEintrag in der Variante %s', (datei, variante) => {
    const s = quelle(datei);
    expect(s).toMatch(new RegExp(`<PushAuswahlEintrag variante="${variante}"`));
  });

  it('die Leitung fordert die Berechtigung nicht mehr an einer zweiten Stelle an', () => {
    const s = quelle('admin/pages/AdminSettingsPage.tsx');
    expect(s).not.toMatch(/onClick=\{\(\) => pushNotificationsPermission !== 'granted' && requestPushPermissions\(\)\}/);
  });
});
