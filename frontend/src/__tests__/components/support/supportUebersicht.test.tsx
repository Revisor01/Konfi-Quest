// Uebersicht der Support-Ansicht (/admin/support), gerendert.
//
// Startseite eines Support-Kontos ohne Gemeinde: Kennzahlen gesamt, je
// Landeskirche, je Kirchenkreis und je Gemeinde (aufklappbar), neue
// Anfragen, der Weg zu allen Bereichen und das Abmelden -- der Baum
// super_admin hatte bis 03.10.2026 kein Abmelden. Fuer Konten ohne
// Super-Admin-Recht zeigt die Seite nur einen Hinweis und ruft nichts ab.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import type { AlertOptionen } from './ionicAttrappe';

const h = vi.hoisted(() => ({
  apiGet: vi.fn(),
  push: vi.fn(),
  goBack: vi.fn(),
  signOut: vi.fn(),
  alert: null as null | AlertOptionen,
  user: { id: 9, display_name: 'Support Eins', username: 'support1', role_name: 'super_admin', is_super_admin: true } as Record<string, unknown>,
}));

vi.mock('@ionic/react', async () => (await import('./ionicAttrappe')).ionicAttrappe({
  presentAlert: (o) => { h.alert = o; },
  router: { push: h.push, goBack: h.goBack, canGoBack: () => false },
}));
vi.mock('../../../components/shared/AppKopfzeile', async () => (await import('./ionicAttrappe')).KopfzeileAttrappe);
vi.mock('../../../components/shared/WartungsHinweis', () => ({ default: () => null }));
vi.mock('../../../components/common/LoadingSpinner', () => ({ default: ({ message }: { message: string }) => <p>{message}</p> }));
vi.mock('../../../services/api', () => ({ default: { get: h.apiGet } }));
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({ user: h.user, signOut: h.signOut, setError: vi.fn(), setSuccess: vi.fn(), isOnline: true }),
}));
vi.mock('../../../utils/haptics', () => ({ triggerPullHaptic: vi.fn() }));

import SupportUebersichtPage from '../../../components/support/SupportUebersichtPage';

const gemeinde = (id: number, name: string, kk: [number, string] | null, lk: [number, string] | null, konten: [number, number, number, number], aktiv = 0, jahrgaenge = 1, is_active = true) => ({
  id, name, is_active,
  kirchenkreis_id: kk ? kk[0] : null, kirchenkreis: kk ? kk[1] : null,
  landeskirche_id: lk ? lk[0] : null, landeskirche: lk ? lk[1] : null,
  konten: { konfi: konten[0], teamer: konten[1], admin: konten[2], org_admin: konten[3] },
  aktiv_30_tage: aktiv, jahrgaenge,
});

const STATISTIK = {
  stand: '2026-10-03T10:15:00Z',
  gemeinden: [
    gemeinde(1, 'Wesselburen', [11, 'Dithmarschen'], [1, 'Nordkirche'], [30, 8, 2, 1], 25, 2),
    gemeinde(2, 'Büsum', [11, 'Dithmarschen'], [1, 'Nordkirche'], [20, 4, 1, 1], 10, 1),
    gemeinde(3, 'Dom Schwerin', null, null, [12, 3, 0, 1], 5, 1, false),
  ],
};

const antworten = (statistik: unknown, neue: unknown[] | Error = []) => {
  h.apiGet.mockImplementation((pfad: string) => {
    if (pfad === '/support/statistik') return statistik instanceof Error ? Promise.reject(statistik) : Promise.resolve({ data: statistik });
    if (pfad === '/support/anfragen') return neue instanceof Error ? Promise.reject(neue) : Promise.resolve({ data: neue });
    return Promise.reject(new Error(`unerwartet: ${pfad}`));
  });
};

beforeEach(() => {
  vi.clearAllMocks();
  h.apiGet.mockReset();
  h.alert = null;
  h.user = { id: 9, display_name: 'Support Eins', username: 'support1', role_name: 'super_admin', is_super_admin: true };
});

describe('Support-Uebersicht: Laden, Fehler, leer', () => {
  it('zeigt erst den Ladezustand, dann die Kennzahlen; fragt Statistik und neue Anfragen ab', async () => {
    antworten(STATISTIK, [{ id: 1 }, { id: 2 }]);
    render(<SupportUebersichtPage />);
    expect(screen.getByText('Kennzahlen werden geladen...')).toBeInTheDocument();
    expect(await screen.findByRole('group', { name: 'Konfis: 62' })).toBeInTheDocument();
    expect(h.apiGet).toHaveBeenCalledWith('/support/statistik');
    expect(h.apiGet).toHaveBeenCalledWith('/support/anfragen', { params: { status: 'neu' } });
  });

  it('Fehler beim Laden: Hinweis mit erneutem Versuch, der wirklich neu laedt', async () => {
    antworten(new Error('Netz weg'));
    render(<SupportUebersichtPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Die Kennzahlen konnten nicht geladen werden.');
    antworten(STATISTIK);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Erneut versuchen/ })); });
    expect(await screen.findByRole('group', { name: 'Konfis: 62' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('ohne Gemeinden: eigener Hinweis statt leerer Zahlen', async () => {
    antworten({ stand: '2026-10-03T10:15:00Z', gemeinden: [] });
    render(<SupportUebersichtPage />);
    expect(await screen.findByText('Noch keine Gemeinden')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: /Konfis/ })).toBeNull();
  });
});

describe('Support-Uebersicht: Kennzahlen', () => {
  it('Gesamt: Gemeinden mit aktiven und ohne Zuordnung, Konten je Rolle, aktiv, Jahrgaenge', async () => {
    antworten(STATISTIK, [{ id: 1 }]);
    render(<SupportUebersichtPage />);
    const gemeinden = await screen.findByRole('group', { name: 'Gemeinden: 3' });
    expect(gemeinden).toHaveTextContent('2 aktiv · 1 ohne Zuordnung');
    expect(screen.getByRole('group', { name: 'Teamer:innen: 15' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Leitung: 6' })).toHaveTextContent('davon 3 Gemeindeleitung');
    expect(screen.getByRole('group', { name: 'Aktiv (30 Tage): 40' })).toHaveTextContent('von 83 Konten');
    expect(screen.getByRole('group', { name: 'Jahrgänge: 4' })).toBeInTheDocument();
  });

  it('der Baum klappt Landeskirche -> Kirchenkreis -> Gemeinde auf; "Ohne Landeskirche" steht hinten', async () => {
    antworten(STATISTIK);
    render(<SupportUebersichtPage />);
    const nordkirche = await screen.findByRole('button', { name: /^Nordkirche/ });
    const ohne = screen.getByRole('button', { name: /^Ohne Landeskirche/ });
    expect(nordkirche.compareDocumentPosition(ohne) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(nordkirche).toHaveAttribute('aria-expanded', 'false');
    expect(nordkirche).toHaveTextContent('2 Gemeinden · 50 Konfis · 12 Team · 5 Leitung · 35 aktiv');
    expect(screen.queryByRole('button', { name: /^Dithmarschen/ })).toBeNull();

    fireEvent.click(nordkirche);
    expect(nordkirche).toHaveAttribute('aria-expanded', 'true');
    const dithmarschen = screen.getByRole('button', { name: /^Dithmarschen/ });
    expect(screen.queryByText('Wesselburen')).toBeNull();
    fireEvent.click(dithmarschen);
    expect(screen.getByText('Büsum')).toBeInTheDocument();
    expect(screen.getByText('Wesselburen')).toBeInTheDocument();

    fireEvent.click(ohne);
    fireEvent.click(screen.getByRole('button', { name: /^Ohne Kirchenkreis/ }));
    expect(screen.getByText('Dom Schwerin (gesperrt)')).toBeInTheDocument();
  });

  it('eine Gemeinde im Baum oeffnet sie unter Gemeinden', async () => {
    antworten(STATISTIK);
    render(<SupportUebersichtPage />);
    fireEvent.click(await screen.findByRole('button', { name: /^Nordkirche/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Dithmarschen/ }));
    fireEvent.click(screen.getByText('Büsum'));
    expect(h.push).toHaveBeenCalledWith('/admin/organizations?gemeinde=2');
  });
});

describe('Support-Uebersicht: Bereiche, neue Anfragen und Abmelden', () => {
  it('fuehrt zu allen Bereichen der Support-Ansicht', async () => {
    antworten(STATISTIK, [{ id: 1 }, { id: 2 }]);
    render(<SupportUebersichtPage />);
    await screen.findByRole('group', { name: 'Konfis: 62' });
    const ziele: Array<[string, string]> = [
      ['Anfragen', '/admin/support/anfragen'],
      ['Gemeinden', '/admin/organizations'],
      ['Struktur', '/admin/support/struktur'],
      ['Support-Konten', '/admin/support/konten'],
      ['Betrieb', '/admin/metrics'],
    ];
    for (const [label, pfad] of ziele) {
      h.push.mockClear();
      fireEvent.click(screen.getByText(label, { selector: '.app-list-item__title' }));
      expect(h.push, label).toHaveBeenCalledWith(pfad);
    }
    // Die Zahl der neuen Anfragen steht am Eintrag "Anfragen".
    const anfragen = screen.getByText('Anfragen', { selector: '.app-list-item__title' }).closest('[role="button"]') as HTMLElement;
    expect(within(anfragen).getByText('2 neu')).toBeInTheDocument();
  });

  it('Abmelden: erst die Rueckfrage, dann signOut', async () => {
    antworten(STATISTIK);
    render(<SupportUebersichtPage />);
    await screen.findByRole('group', { name: 'Konfis: 62' });
    fireEvent.click(screen.getByRole('button', { name: 'Abmelden' }));
    expect(h.signOut).not.toHaveBeenCalled();
    expect(h.alert?.header).toBe('Abmelden');
    const knopf = h.alert?.buttons?.find((b) => b.text === 'Abmelden');
    await act(async () => { knopf?.handler?.(); });
    expect(h.signOut).toHaveBeenCalledTimes(1);
  });

  it('als Startseite (Konto ohne Gemeinde) ohne Zurueck; ueber "Mehr" (Gemeindeleitung mit Merkmal) mit Zurueck', async () => {
    antworten(STATISTIK);
    const { unmount } = render(<SupportUebersichtPage />);
    await screen.findByRole('group', { name: 'Konfis: 62' });
    expect(screen.queryByRole('button', { name: 'Zurück' })).toBeNull();
    unmount();

    h.user = { id: 1, display_name: 'Simon', role_name: 'org_admin', is_super_admin: true };
    render(<SupportUebersichtPage />);
    await screen.findByRole('group', { name: 'Konfis: 62' });
    fireEvent.click(screen.getByRole('button', { name: 'Zurück' }));
    expect(h.push).toHaveBeenCalledWith('/admin/settings', 'back', 'replace');
  });
});

describe('Support-Uebersicht: nur fuer Super-Admin', () => {
  it('eine Gemeindeleitung ohne Merkmal sieht den Hinweis, und nichts wird abgerufen', () => {
    h.user = { id: 5, display_name: 'Anna', role_name: 'org_admin', is_super_admin: false };
    render(<SupportUebersichtPage />);
    expect(screen.getByText('Nur für den Support')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Abmelden' })).toBeNull();
    expect(h.apiGet).not.toHaveBeenCalled();
  });
});
