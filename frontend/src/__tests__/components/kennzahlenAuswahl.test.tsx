// Kennzahlen-Wahl der Leitung (09.10.2026, docs/planung/darf-freigeben.md):
// je Bereich -- Anträge, Events verbuchen, Challenge-Beiträge -- an oder aus,
// persönlich und je Gemeinde. Aus heißt: keine rote Zahl am Reiter, nichts in
// der Zahl am App-Symbol, kein Push. Der SERVER rechnet (badge-counts liefert
// 0); die App wählt nur und holt danach die Zähler neu.
//
// Geprüft wird: das Fenster lädt (GET) und speichert je Umschalten (PUT) mit
// genau dem einen Bereich, zeigt den Stand der Antwort, holt danach die Zähler
// neu, meldet Fehler über den Fehlerweg der App -- und der Eintrag unter
// "Mehr" steht nur für Leitung und Gemeindeleitung, nicht für Teamer:innen.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';

const h = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPut: vi.fn(),
  setError: vi.fn(),
  refreshAllCounts: vi.fn(async () => undefined),
  zeigeModal: vi.fn(),
  user: null as null | Record<string, unknown>,
}));

vi.mock('@ionic/react', async () => ({
  ...(await import('./support/ionicAttrappe')).ionicAttrappe(),
  useIonModal: () => [h.zeigeModal, vi.fn()],
}));
vi.mock('../../services/api', () => ({ default: { get: h.apiGet, put: h.apiPut } }));
vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({ user: h.user, setError: h.setError, signOut: vi.fn() }),
}));
vi.mock('../../contexts/BadgeContext', () => ({ useBadge: () => ({ refreshAllCounts: h.refreshAllCounts }) }));
// Fuer die Seite "Mehr": alles ausser dem Konto-Abschnitt als Attrappe.
vi.mock('../../components/shared/AppKopfzeile', async () => (await import('./support/ionicAttrappe')).KopfzeileAttrappe);
vi.mock('../../contexts/ModalContext', () => ({ useModalPage: () => ({ pageRef: { current: null }, presentingElement: null }) }));
vi.mock('../../components/admin/pages/AdminInvitePage', () => ({ default: () => null }));
vi.mock('../../components/shared/InfoModal', () => ({ default: () => null }));
vi.mock('../../components/admin/modals/AdminOnboardingModal', () => ({ default: () => null }));
vi.mock('../../components/admin/modals/AdminUpdate230WalkthroughModal', () => ({ default: () => null }));
vi.mock('../../components/shared/SpiritFooter', () => ({ default: () => null }));
vi.mock('../../components/shared/PushAuswahl', () => ({ default: () => null }));
vi.mock('../../components/shared/NeuerungenBanner', () => ({ default: () => null }));
vi.mock('../../components/shared/MitmachenErklaerungModal', () => ({ default: () => null }));

import { KennzahlenModal } from '../../components/shared/KennzahlenAuswahl';
import AdminSettingsPage from '../../components/admin/pages/AdminSettingsPage';

const ERKLAERUNG = 'Aus heißt: keine rote Zahl am Reiter, nichts davon in der Zahl am App-Symbol und kein Push dafür. Gilt für diese Gemeinde.';
const schalter = (name: string) => screen.getByRole('checkbox', { name }) as HTMLInputElement;

beforeEach(() => {
  vi.clearAllMocks();
  h.user = { id: 3, type: 'admin', role_name: 'admin' };
  h.apiGet.mockImplementation(async (url: string) => {
    if (url === '/notifications/kennzahlen') return { data: { antraege: true, verbuchen: false, challenges: true } };
    throw new Error(`nicht vorgesehen: ${url}`);
  });
});

describe('Das Fenster "Kennzahlen"', () => {
  it('lädt die Wahl und zeigt sie an drei Schaltern, dazu die Erklärung', async () => {
    render(<KennzahlenModal onClose={vi.fn()} />);
    await screen.findByRole('checkbox', { name: 'Anträge' });
    expect(h.apiGet).toHaveBeenCalledWith('/notifications/kennzahlen');
    expect(schalter('Anträge').checked).toBe(true);
    expect(schalter('Events verbuchen').checked).toBe(false);
    expect(schalter('Challenge-Beiträge').checked).toBe(true);
    expect(screen.getByText(ERKLAERUNG)).toBeInTheDocument();
  });

  it('Umschalten speichert genau diesen Bereich, zeigt die Antwort und holt die Zähler neu', async () => {
    h.apiPut.mockResolvedValue({ data: { antraege: false, verbuchen: false, challenges: true } });
    const geaendert = vi.fn();
    render(<KennzahlenModal onClose={vi.fn()} onGeaendert={geaendert} />);
    await screen.findByRole('checkbox', { name: 'Anträge' });
    await act(async () => { fireEvent.click(schalter('Anträge')); });
    expect(h.apiPut).toHaveBeenCalledTimes(1);
    expect(h.apiPut).toHaveBeenCalledWith('/notifications/kennzahlen', { antraege: false });
    expect(schalter('Anträge').checked).toBe(false);
    expect(geaendert).toHaveBeenCalledWith({ antraege: false, verbuchen: false, challenges: true });
    expect(h.refreshAllCounts).toHaveBeenCalledTimes(1);
  });

  it('scheitert das Speichern: Meldung über den Fehlerweg, Stand bleibt, keine Zähler neu', async () => {
    h.apiPut.mockRejectedValue(Object.assign(new Error('403'), { response: { status: 403, data: { error: 'Die Kennzahlen-Wahl gibt es für die Leitung.' } } }));
    render(<KennzahlenModal onClose={vi.fn()} />);
    await screen.findByRole('checkbox', { name: 'Anträge' });
    await act(async () => { fireEvent.click(schalter('Events verbuchen')); });
    expect(h.setError).toHaveBeenCalledWith('Die Kennzahlen-Wahl gibt es für die Leitung.');
    expect(schalter('Events verbuchen').checked).toBe(false);
    expect(h.refreshAllCounts).not.toHaveBeenCalled();
  });

  it('scheitert das Laden: Meldung, keine Schalter', async () => {
    h.apiGet.mockRejectedValue(new Error('Netz weg'));
    render(<KennzahlenModal onClose={vi.fn()} />);
    await waitFor(() => expect(h.setError).toHaveBeenCalledWith('Die Kennzahlen konnten nicht geladen werden.'));
    expect(screen.queryAllByRole('checkbox')).toEqual([]);
  });
});

describe('Der Eintrag unter "Mehr" (App)', () => {
  const eintrag = () => screen.queryByRole('button', { name: /^Kennzahlen/ });

  it.each([
    ['Leitung', { id: 3, type: 'admin', role_name: 'admin' }],
    ['Gemeindeleitung', { id: 2, type: 'admin', role_name: 'org_admin' }],
  ])('erlaubt: %s sieht den Eintrag mit dem Stand -- ein Antippen öffnet das Fenster', async (_name, user) => {
    h.user = user;
    render(<AdminSettingsPage />);
    await waitFor(() => expect(eintrag()).toHaveTextContent('Kennzahlen2 von 3 Bereichen mit roter Zahl'));
    fireEvent.click(eintrag()!);
    expect(h.zeigeModal).toHaveBeenCalledTimes(1);
  });

  it('verboten: Teamer:innen haben diese Zahlen nicht -- kein Eintrag, keine Anfrage (der Server sagte 403)', async () => {
    h.user = { id: 4, type: 'admin', role_name: 'teamer' };
    render(<AdminSettingsPage />);
    await act(async () => { await Promise.resolve(); });
    expect(eintrag()).toBeNull();
    expect(h.apiGet).not.toHaveBeenCalledWith('/notifications/kennzahlen');
  });
});
