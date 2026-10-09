// Konfis/Team und Benutzer:innen: App und Web-Fassung lesen Reiter, Filter und
// Leertexte aus EINER Beschreibung (seiten/konfisLeitung.ts, seiten/benutzer.ts;
// 09.10.2026). Gerendert werden die echten Ansichten beider Fassungen.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, within, act } from '@testing-library/react';
import type { LeitungTestStand } from '../components/leitung/leitungTestHilfe';
import type { AdminUser } from '../../types/user';

const h = vi.hoisted(() => ({
  apiGet: vi.fn(() => Promise.resolve({ data: [] })),
  setError: vi.fn(),
  setSuccess: vi.fn(),
  stand: { alert: null, fenster: [], push: vi.fn() } as unknown as LeitungTestStand,
  user: { id: 1, type: 'admin', role_name: 'org_admin', organization_id: 7 } as Record<string, unknown>,
  standort: { pathname: '/admin/konfis', search: '' },
}));

vi.mock('@ionic/react', async () => (await import('../components/leitung/leitungTestHilfe')).ionicFuerLeitung(h.stand));
vi.mock('../../components/shared/AppKopfzeile', async () => (await import('../components/support/ionicAttrappe')).KopfzeileAttrappe);
vi.mock('../../components/shared/WartungsHinweis', () => ({ default: () => null }));
vi.mock('../../services/api', () => ({ default: { get: h.apiGet } }));
vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({ user: h.user, setError: h.setError, setSuccess: h.setSuccess, isOnline: true }),
}));
vi.mock('../../navigation/useAppLocation', () => ({ useAppLocation: () => h.standort }));

import KonfisView from '../../components/admin/KonfisView';
import WebKonfis from '../../components/admin/web/leitung/WebKonfis';
import UsersView from '../../components/admin/UsersView';
import WebBenutzer from '../../components/admin/web/leitung/WebBenutzer';
import { inFassung } from '../../seiten/beschreibung';
import { KONFIS_ANSICHT, KONFIS_ANSICHT_BESCHRIFTUNG, KONFIS_LEER } from '../../seiten/konfisLeitung';
import { BENUTZER_FILTER, BENUTZER_FILTER_BESCHRIFTUNG, BENUTZER_LEER } from '../../seiten/benutzer';

const appReiter = (leiste: HTMLElement): string[] => within(leiste).getAllByRole('tab').map((t) => t.textContent ?? '');
const webChips = (gruppe: string): string[] =>
  within(screen.getByRole('group', { name: gruppe })).getAllByRole('button').map((b) => b.childNodes[0]?.textContent ?? '');

const JAHRGAENGE = [{ id: 11, name: 'Jahrgang 2025' }, { id: 12, name: 'Jahrgang 2026' }];
const KONFIS = [{ id: 1, name: 'Anna Müller', username: 'anna', jahrgang_name: 'Jahrgang 2026', gottesdienst_points: 1, gemeinde_points: 1 }];

const appKonfis = async () => {
  render(<KonfisView konfis={KONFIS as never} jahrgaenge={JAHRGAENGE as never} onSelectKonfi={vi.fn()} onDeleteKonfi={vi.fn()} onDeleteTeamer={vi.fn()} />);
  await act(async () => { await Promise.resolve(); });
};
const webKonfis = async () => {
  render(<WebKonfis konfis={KONFIS as never} jahrgaenge={JAHRGAENGE as never} laedt={false} ohneJahrgang={false}
    onKonfiAnlegen={vi.fn()} onTeamAnlegen={vi.fn()} onMatrix={vi.fn()} onKonfiLoeschen={vi.fn()} onTeamerLoeschen={vi.fn()} />);
  await act(async () => { await Promise.resolve(); });
};

beforeEach(() => {
  h.apiGet.mockClear();
  h.standort = { pathname: '/admin/konfis', search: '' };
});

describe('Konfis und Team: eine Beschreibung', () => {
  it('die App zeigt die Reiter der Beschreibung', async () => {
    await appKonfis();
    expect(appReiter(screen.getByRole('tablist'))).toEqual(inFassung(KONFIS_ANSICHT, 'app').map((a) => a.label));
    expect(appReiter(screen.getByRole('tablist'))).toEqual(['Konfis', 'Team']);
  });

  it('der Browser zeigt dieselben Reiter als Chips', async () => {
    await webKonfis();
    expect(webChips(KONFIS_ANSICHT_BESCHRIFTUNG)).toEqual(inFassung(KONFIS_ANSICHT, 'web').map((a) => a.label));
  });

  it('App: ein leerer Jahrgang sagt das -- nicht „Noch keine Konfis angelegt."', async () => {
    await appKonfis();
    fireEvent.change(screen.getByRole('combobox', { name: 'Jahrgang' }), { target: { value: 'Jahrgang 2025' } });
    expect(screen.getByText(KONFIS_LEER.jahrgangLeer)).toBeInTheDocument();
    expect(screen.queryByText(KONFIS_LEER.keineKonfis)).toBeNull();
  });

  it('Browser: derselbe Satz beim leeren Jahrgang', async () => {
    await webKonfis();
    fireEvent.change(screen.getByRole('combobox', { name: 'Jahrgang' }), { target: { value: 'Jahrgang 2025' } });
    expect(screen.getByText(KONFIS_LEER.jahrgangLeer)).toBeInTheDocument();
  });

  it('App: ohne Konfis und ohne Filter bleibt „Noch keine Konfis angelegt."', async () => {
    render(<KonfisView konfis={[]} jahrgaenge={JAHRGAENGE as never} onSelectKonfi={vi.fn()} onDeleteKonfi={vi.fn()} onDeleteTeamer={vi.fn()} />);
    await act(async () => { await Promise.resolve(); });
    expect(screen.getByText(KONFIS_LEER.keineKonfis)).toBeInTheDocument();
  });
});

const person = (id: number, name: string, zusatz: Partial<AdminUser> = {}): AdminUser => ({
  id, username: name.toLowerCase().replace(/\s+/g, '.'), display_name: name, is_active: true,
  created_at: '2026-01-01T10:00:00Z', updated_at: '2026-09-01T10:00:00Z',
  role_name: 'teamer', role_display_name: 'Teamer', assigned_jahrgaenge_count: 1, can_edit: true,
  mitgliedschaft: 'stamm', weitere_gemeinden: 0, ...zusatz,
});
const NUR_TEAM = [person(1, 'Robin Probe'), person(2, 'Lou Exempel')];

const appBenutzer = (users: AdminUser[]) =>
  render(<UsersView users={users} onUpdate={vi.fn()} onSelectUser={vi.fn()} darfVerwalten={false} onDeleteUser={vi.fn()} />);
const webBenutzer = (users: AdminUser[]) =>
  render(<WebBenutzer users={users} laedt={false} darfVerwalten={false} einladungenStand={0}
    onBearbeiten={vi.fn()} onLoeschen={vi.fn()} onAnlegen={vi.fn()} onEinladen={vi.fn()} />);

describe('Benutzer:innen: eine Beschreibung', () => {
  it('die App zeigt die Reiter der Beschreibung', () => {
    appBenutzer(NUR_TEAM);
    expect(appReiter(screen.getByRole('tablist'))).toEqual(inFassung(BENUTZER_FILTER, 'app').map((w) => w.label));
    expect(appReiter(screen.getByRole('tablist'))).toEqual(['Alle', 'Aktiv', 'Leitung', 'Team']);
  });

  it('der Browser zeigt dieselben Reiter als Chips', () => {
    webBenutzer(NUR_TEAM);
    expect(webChips(BENUTZER_FILTER_BESCHRIFTUNG)).toEqual(inFassung(BENUTZER_FILTER, 'web').map((w) => w.label));
  });

  it('App: leert der Filter die Liste, sagt das der Leertext -- nicht „Noch keine Teammitglieder angelegt"', () => {
    appBenutzer(NUR_TEAM);
    fireEvent.click(screen.getByRole('tab', { name: 'Leitung' }));
    expect(screen.getByText(BENUTZER_LEER.keineTreffer)).toBeInTheDocument();
    expect(screen.queryByText(BENUTZER_LEER.niemand)).toBeNull();
  });

  it('App: ohne Konten und ohne Filter bleibt die Aufforderung', () => {
    appBenutzer([]);
    expect(screen.getByText(BENUTZER_LEER.niemand)).toBeInTheDocument();
  });

  it('Browser: derselbe Satz beim leeren Filter', () => {
    webBenutzer(NUR_TEAM);
    fireEvent.click(within(screen.getByRole('group', { name: BENUTZER_FILTER_BESCHRIFTUNG })).getByRole('button', { name: /^Leitung/ }));
    expect(screen.getByText(BENUTZER_LEER.keineTreffer)).toBeInTheDocument();
  });
});
