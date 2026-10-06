// "Mehr" der Leitung in der Web-Fassung (/admin/settings), gerendert
// (docs/planung/web-alle-bereiche.md, Entscheidung 6): ein Raster gruppierter
// Kacheln, jede ein echter Link. Welche Kacheln es gibt, entscheidet die Rolle
// -- dieselben Bedingungen wie in der Liste der App. "Hilfe und Support" ist ein
// Link nach draussen auf das Support-Formular der Homepage und laeuft ueber
// linkOeffnen (Leitplanke "Links nach draussen"); Support und Betrieb gibt es
// nur fuer Konten mit Super-Admin-Recht.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { konto, neuerStand, type LeitungTestStand } from './leitungTestHilfe';
import { mehrGruppen, SUPPORT_FORMULAR_URL } from '../../../components/admin/web/leitung/mehrKacheln';

const h = vi.hoisted(() => ({
  breit: true,
  stand: { alert: null, fenster: [], push: vi.fn() } as unknown as LeitungTestStand,
  user: {} as Record<string, unknown>,
}));

vi.mock('@ionic/react', async () => (await import('./leitungTestHilfe')).ionicFuerLeitung(h.stand));
vi.mock('../../../navigation/breitesLayout', () => ({ useBreitesLayout: () => h.breit }));
vi.mock('../../../components/shared/AppKopfzeile', async () => (await import('../support/ionicAttrappe')).KopfzeileAttrappe);
vi.mock('../../../components/shared/WartungsHinweis', () => ({ default: () => null }));
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({ user: h.user, signOut: vi.fn(), setError: vi.fn(), setSuccess: vi.fn(), isOnline: true }),
}));
vi.mock('../../../contexts/ModalContext', () => ({ useModalPage: () => ({ pageRef: { current: null }, presentingElement: null }) }));
vi.mock('./../../../components/admin/pages/AdminInvitePage', () => ({ default: () => null }));
vi.mock('../../../components/shared/PushAuswahl', () => ({ default: () => null }));
vi.mock('../../../components/shared/SpiritFooter', () => ({ default: () => null }));
vi.mock('../../../components/shared/InfoModal', () => ({ default: () => null }));
vi.mock('../../../components/shared/NeuerungenBanner', () => ({ default: () => null }));
vi.mock('../../../components/admin/modals/AdminOnboardingModal', () => ({ default: () => <p>Die Tour ist offen</p> }));
vi.mock('../../../components/admin/modals/AdminUpdate230WalkthroughModal', () => ({ default: () => <p>Die Neuerungen sind offen</p> }));
vi.mock('../../../components/shared/MitmachenErklaerungModal', () => ({ default: ({ rolle }: { rolle: string }) => <p>Die Erklaerung ist offen ({rolle})</p> }));

import AdminSettingsPage from '../../../components/admin/pages/AdminSettingsPage';

const titel = (rolle: Parameters<typeof konto>[0], zusatz: Record<string, unknown> = {}) => ({ ...konto(rolle), ...zusatz });
const kachelTitel = () => screen.getAllByRole('listitem').map((li) => li.querySelector('.web-mehr-kachel__titel')?.textContent);
const gruppen = () => screen.getAllByRole('heading', { level: 2 }).map((g) => g.textContent);

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(h.stand, neuerStand());
  h.breit = true;
  h.user = titel('org_admin');
});

afterEach(() => { vi.unstubAllGlobals(); });

describe('Mehr (Web): Kacheln je Rolle', () => {
  it('Gemeindeleitung: alle Inhalte, die Verwaltung der Gemeinde, Konto und Hilfe -- kein Support', () => {
    render(<AdminSettingsPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Mehr' })).toBeInTheDocument();
    expect(gruppen()).toEqual(['Punkte und Inhalte', 'Gemeinde', 'Konto und Hilfe']);
    expect(kachelTitel()).toEqual([
      'Aktivitäten', 'Punkte und Level', 'Kategorien', 'Badges', 'Material', 'Jahresrückblick',
      'Benutzer:innen', 'Jahrgänge', 'Einladungen', 'Dashboard', 'Zertifikate',
      'Profil', 'App-Tour', 'Was ist neu?', 'Events und Aktivitäten', 'Hilfe und Support',
    ]);
  });

  it('Leitung (Admin): die Inhalte, Jahrgaenge und Zertifikate -- aber weder Benutzer:innen noch Einladungen noch Dashboard', () => {
    h.user = titel('admin');
    render(<AdminSettingsPage />);
    expect(gruppen()).toEqual(['Punkte und Inhalte', 'Gemeinde', 'Konto und Hilfe']);
    const titelListe = kachelTitel();
    expect(titelListe).toContain('Jahrgänge');
    expect(titelListe).toContain('Zertifikate');
    expect(titelListe).toContain('Hilfe und Support');
    for (const verboten of ['Benutzer:innen', 'Einladungen', 'Dashboard', 'Support-Ansicht', 'Betrieb']) {
      expect(titelListe, verboten).not.toContain(verboten);
    }
  });

  it('Super-Admin (Gemeindeleitung mit dem Merkmal): zusaetzlich die Gruppe "Support und Betrieb"', () => {
    h.user = titel('org_admin', { is_super_admin: true });
    render(<AdminSettingsPage />);
    expect(gruppen()).toEqual(['Punkte und Inhalte', 'Gemeinde', 'Konto und Hilfe', 'Support und Betrieb']);
    const support = screen.getByRole('region', { name: 'Support und Betrieb' });
    expect(within(support).getByRole('link', { name: /Support-Ansicht/ })).toHaveAttribute('href', '/admin/support');
    expect(within(support).getByRole('link', { name: /Betrieb/ })).toHaveAttribute('href', '/admin/metrics');
  });

  it('die Regeln als Daten: Support nur mit Recht, Hilfe nur fuer Gemeindeleitung und Leitung', () => {
    const ids = (k: Parameters<typeof mehrGruppen>[0]) => mehrGruppen(k).flatMap((g) => g.kacheln.map((x) => x.id));
    expect(ids({ role_name: 'org_admin' })).not.toContain('support');
    expect(ids({ role_name: 'org_admin', is_super_admin: true })).toEqual(expect.arrayContaining(['support', 'betrieb']));
    expect(ids({ role_name: 'admin' })).not.toContain('benutzer');
    expect(ids({ role_name: 'admin' })).toContain('hilfe');
    expect(ids({ role_name: 'teamer' })).not.toContain('hilfe');
    expect(ids(null)).not.toContain('hilfe');
  });
});

describe('Mehr (Web): Links', () => {
  it('jede Kachel einer Seite ist ein echter Link mit der Adresse der Seite', () => {
    render(<AdminSettingsPage />);
    const ziel = (name: RegExp) => screen.getByRole('link', { name }).getAttribute('href');
    expect(ziel(/^Aktivitäten/)).toBe('/admin/activities');
    expect(ziel(/^Punkte und Level/)).toBe('/admin/settings/levels');
    expect(ziel(/^Kategorien/)).toBe('/admin/settings/categories');
    expect(ziel(/^Badges/)).toBe('/admin/badges');
    expect(ziel(/^Material/)).toBe('/admin/material');
    expect(ziel(/^Jahresrückblick/)).toBe('/admin/wrapped');
    expect(ziel(/^Benutzer:innen/)).toBe('/admin/users');
    expect(ziel(/^Jahrgänge/)).toBe('/admin/settings/jahrgaenge');
    expect(ziel(/^Einladungen/)).toBe('/admin/settings/invite');
    expect(ziel(/^Dashboard/)).toBe('/admin/settings/dashboard');
    expect(ziel(/^Zertifikate/)).toBe('/admin/settings/certificates');
    expect(ziel(/^Profil/)).toBe('/admin/profile');
  });

  it('"Hilfe und Support" fuehrt nach draussen auf das Support-Formular der Homepage, in einem neuen Tab', () => {
    render(<AdminSettingsPage />);
    const link = screen.getByRole('link', { name: 'Hilfe und Support (öffnet in einem neuen Tab)' });
    expect(link).toHaveAttribute('href', 'https://konfi-quest.de/#support');
    expect(SUPPORT_FORMULAR_URL).toBe('https://konfi-quest.de/#support');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    // Nicht auf eine Seite der App.
    expect(screen.queryByRole('link', { name: /\/admin\/hilfe/ })).toBeNull();
    expect(document.querySelector('a[href="/admin/hilfe"]')).toBeNull();
  });

  it('ein Klick oeffnet ueber linkOeffnen (Huelle der App-Sperre) ein neues Fenster und laedt die App nicht neu', () => {
    const offen = vi.fn();
    vi.stubGlobal('open', offen);
    vi.useFakeTimers();
    render(<AdminSettingsPage />);
    const weiter = fireEvent.click(screen.getByRole('link', { name: /^Hilfe und Support/ }));
    // false: preventDefault wurde gerufen, der Browser navigiert nicht selbst.
    expect(weiter).toBe(false);
    expect(offen).toHaveBeenCalledTimes(1);
    expect(offen).toHaveBeenCalledWith('https://konfi-quest.de/#support', '_blank');
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('Strg-Klick und Mittelklick gehoeren dem Browser (kein eigenes Fenster, kein preventDefault)', () => {
    const offen = vi.fn();
    vi.stubGlobal('open', offen);
    render(<AdminSettingsPage />);
    const link = screen.getByRole('link', { name: /^Hilfe und Support/ });
    expect(fireEvent.click(link, { ctrlKey: true })).toBe(true);
    expect(fireEvent.click(link, { button: 1 })).toBe(true);
    expect(offen).not.toHaveBeenCalled();
  });
});

describe('Mehr (Web): Erklaerungen und Fenster', () => {
  it('das "i" an einer Kachel oeffnet dieselbe Erklaerung wie in der App', () => {
    render(<AdminSettingsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Info zu Badges' }));
    const dialog = screen.getByRole('dialog', { name: 'Badges' });
    expect(within(dialog).getByText(/Badges sind Auszeichnungen, die deine Konfis automatisch erhalten/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Verstanden' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('die Kachel "Dashboard" erklaert sich mit dem Text des Dashboards', () => {
    render(<AdminSettingsPage />);
    fireEvent.click(screen.getByRole('button', { name: 'Info zu Dashboard' }));
    expect(within(screen.getByRole('dialog', { name: 'Dashboard' })).getByText(/Lege fest, welche Bereiche auf den Startseiten von Konfis und Team angezeigt werden/)).toBeInTheDocument();
  });

  it('App-Tour, Neuerungen und Erklaerung der Mitmachen-Seite oeffnen die Fenster der Seite', () => {
    render(<AdminSettingsPage />);
    expect(screen.queryByText('Die Tour ist offen')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /^App-Tour/ }));
    expect(screen.getByText('Die Tour ist offen')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Was ist neu\?/ }));
    expect(screen.getByText('Die Neuerungen sind offen')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Events und Aktivitäten/ }));
    expect(screen.getByText('Die Erklaerung ist offen (admin)')).toBeInTheDocument();
  });
});

describe('Mehr: schmal bleibt die Liste der App', () => {
  it('ohne breites Layout keine Kacheln und keine Gruppenueberschriften', () => {
    h.breit = false;
    const { container } = render(<AdminSettingsPage />);
    expect(container.querySelector('.web-mehr-raster')).toBeNull();
    expect(screen.queryByRole('heading', { level: 2, name: 'Punkte und Inhalte' })).toBeNull();
    expect(screen.getByText('Benutzer:innen')).toBeInTheDocument();
    expect(screen.getByText('Jahresrückblick')).toBeInTheDocument();
  });
});
