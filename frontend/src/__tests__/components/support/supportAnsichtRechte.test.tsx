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
  linkOeffnen: vi.fn(),
  user: null as null | Record<string, unknown>,
}));

vi.mock('@ionic/react', async () => (await import('./ionicAttrappe')).ionicAttrappe({
  router: { push: h.push, goBack: vi.fn(), canGoBack: () => false },
}));
vi.mock('../../../components/shared/AppKopfzeile', async () => (await import('./ionicAttrappe')).KopfzeileAttrappe);
vi.mock('../../../contexts/AppContext', () => ({ useApp: () => ({ user: h.user, signOut: vi.fn() }) }));
// Links nach draussen laufen durch die Huelle (services/systemDialoge.ts); hier
// zaehlt, WOHIN der Eintrag fuehrt, nicht das Oeffnen des Fensters.
vi.mock('../../../services/systemDialoge', async (original) => ({
  ...(await original<typeof import('../../../services/systemDialoge')>()),
  linkOeffnen: h.linkOeffnen,
}));
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

// Hilfe und Support (Simon, 03.10.2026: „Support kommt auf die HP"): Das Formular
// steht auf der Startseite von konfi-quest.de, in der App gibt es nur den Weg
// dorthin -- ein einziger Eintrag unter „Mehr", als Link nach draussen. Zu sehen
// fuer Gemeindeleitung und Leitung (docs/planung/support-vorgaenge.md,
// Entscheidung 4); verbotener UND erlaubter Fall.
describe('"Mehr": Hilfe und Support', () => {
  const eintrag = () => screen.queryByRole('button', { name: /^Hilfe und Support/ });

  it.each([
    ['Gemeindeleitung', { id: 1, type: 'admin', role_name: 'org_admin', is_super_admin: false }],
    ['Leitung', { id: 3, type: 'admin', role_name: 'admin' }],
    ['Gemeindeleitung mit Super-Admin-Merkmal (Simons Konto)', { id: 1, type: 'admin', role_name: 'org_admin', is_super_admin: true }],
  ])('erlaubt: %s sieht den Eintrag -- ein Antippen öffnet das Formular auf der Startseite', (_name, user) => {
    h.user = user;
    render(<AdminSettingsPage />);
    expect(screen.getAllByRole('button', { name: /^Hilfe und Support/ })).toHaveLength(1);
    expect(eintrag()).toHaveTextContent('öffnet konfi-quest.de');
    fireEvent.click(eintrag()!);
    expect(h.linkOeffnen).toHaveBeenCalledTimes(1);
    expect(h.linkOeffnen).toHaveBeenCalledWith('https://konfi-quest.de/#support');
    // Kein Formular in der App und keine eigene Seite dafuer.
    expect(h.push).not.toHaveBeenCalled();
  });

  it.each([
    ['Teamer:in als Leitung gefuehrt', { id: 4, type: 'admin', role_name: 'teamer', is_super_admin: false }],
    ['Support-Konto ohne Gemeinde', { id: 5, type: 'admin', role_name: 'super_admin', is_super_admin: true }],
    ['ohne Konto', null],
  ])('verboten: %s -- kein Eintrag, kein Aufruf', (_name, user) => {
    h.user = user;
    render(<AdminSettingsPage />);
    expect(eintrag()).toBeNull();
    expect(h.linkOeffnen).not.toHaveBeenCalled();
  });
});
