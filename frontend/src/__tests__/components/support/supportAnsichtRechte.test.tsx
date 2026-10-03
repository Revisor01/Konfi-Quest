// Wer die Support-Ansicht erreicht (Web-Version, 03.10.2026).
//
// Simons Konto ist eine Gemeindeleitung mit Super-Admin-Merkmal und lebt im
// Baum der Leitung. Den Weg zur Support-Ansicht findet es unter "Mehr", wo
// bis dahin "Gemeinden verwalten" stand. Alle anderen Konten -- Gemeindeleitung
// ohne Merkmal, Leitung, Team -- sehen den Knopf nicht. Gerendert wird die
// echte Seite "Mehr"; ihre Modale und Banner sind Attrappen.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

const h = vi.hoisted(() => ({
  push: vi.fn(),
  user: null as null | Record<string, unknown>,
}));

vi.mock('@ionic/react', async () => (await import('./ionicAttrappe')).ionicAttrappe({
  router: { push: h.push, goBack: vi.fn(), canGoBack: () => false },
}));
vi.mock('../../../components/shared/AppKopfzeile', async () => (await import('./ionicAttrappe')).KopfzeileAttrappe);
vi.mock('../../../contexts/AppContext', () => ({ useApp: () => ({ user: h.user, signOut: vi.fn() }) }));
vi.mock('../../../contexts/ModalContext', () => ({ useModalPage: () => ({ pageRef: { current: null }, presentingElement: null }) }));
vi.mock('../../../components/admin/pages/AdminInvitePage', () => ({ default: () => null }));
vi.mock('../../../components/shared/InfoModal', () => ({ default: () => null }));
vi.mock('../../../components/admin/modals/AdminOnboardingModal', () => ({ default: () => null }));
vi.mock('../../../components/admin/modals/AdminUpdate230WalkthroughModal', () => ({ default: () => null }));
vi.mock('../../../components/shared/SpiritFooter', () => ({ default: () => null }));
vi.mock('../../../components/shared/PushAuswahl', () => ({ default: () => null }));
vi.mock('../../../components/shared/NeuerungenBanner', () => ({ default: () => null }));
vi.mock('../../../components/shared/MitmachenErklaerungModal', () => ({ default: () => null }));

import AdminSettingsPage from '../../../components/admin/pages/AdminSettingsPage';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('"Mehr": der Weg zur Support-Ansicht', () => {
  it('Gemeindeleitung mit Super-Admin-Merkmal (Simons Konto): Knopf da, fuehrt nach /admin/support', () => {
    h.user = { id: 1, type: 'admin', role_name: 'org_admin', is_super_admin: true };
    render(<AdminSettingsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Support-Ansicht öffnen' }));
    expect(h.push).toHaveBeenCalledWith('/admin/support');
    // Der Betriebs-Ueberblick bleibt daneben erreichbar.
    expect(screen.getByRole('button', { name: 'Performance anzeigen' })).toBeInTheDocument();
  });

  it.each([
    ['Gemeindeleitung ohne Merkmal', { id: 2, type: 'admin', role_name: 'org_admin', is_super_admin: false }],
    ['Leitung', { id: 3, type: 'admin', role_name: 'admin' }],
    ['Teamer:in als Leitung gefuehrt', { id: 4, type: 'admin', role_name: 'teamer', is_super_admin: false }],
  ])('%s: kein Knopf zur Support-Ansicht, keiner zum Betrieb', (_name, user) => {
    h.user = user;
    render(<AdminSettingsPage />);
    expect(screen.queryByRole('button', { name: 'Support-Ansicht öffnen' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Performance anzeigen' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Gemeinden verwalten' })).toBeNull();
  });
});
