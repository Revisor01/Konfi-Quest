// Dashboard, Konfis einladen und Jahresrueckblick in der Web-Fassung, gerendert
// (docs/planung/web-alle-bereiche.md, Entscheidung 6). Die Seiten halten Zustand
// und Aktionen; geprueft wird, dass die Web-Fassung dieselben Routen mit den
// richtigen Werten ruft, dieselben Rueckfragen stellt, die Rechte einhaelt
// (Team-Rueckblick nur die Gemeindeleitung) und dass die Darstellung der App
// bleibt -- schmal und, bei "Konfis einladen", als Fenster aus "Mehr".
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, within, act, waitFor } from '@testing-library/react';
import { konto, neuerStand, type LeitungTestStand } from './leitungTestHilfe';
import { verschiebeEintrag } from '../../../components/admin/web/leitung/dashboardReihenfolge';

const h = vi.hoisted(() => ({
  breit: true,
  online: true,
  laedt: false,
  daten: {} as Record<string, unknown>,
  stand: { alert: null, fenster: [], push: vi.fn() } as unknown as LeitungTestStand,
  user: {} as Record<string, unknown>,
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
  apiDelete: vi.fn(),
  refresh: vi.fn(),
  setError: vi.fn(),
  setSuccess: vi.fn(),
  qr: vi.fn(),
  teilen: vi.fn(),
}));

vi.mock('@ionic/react', async () => (await import('./leitungTestHilfe')).ionicFuerLeitung(h.stand));
vi.mock('../../../navigation/breitesLayout', () => ({ useBreitesLayout: () => h.breit }));
vi.mock('../../../components/shared/AppKopfzeile', async () => (await import('../support/ionicAttrappe')).KopfzeileAttrappe);
vi.mock('../../../components/shared/WartungsHinweis', () => ({ default: () => null }));
vi.mock('../../../components/common/LoadingSpinner', () => ({ default: () => null }));
vi.mock('../../../services/api', () => ({
  default: {
    get: (...a: unknown[]) => h.apiGet(...a),
    post: (...a: unknown[]) => h.apiPost(...a),
    put: (...a: unknown[]) => h.apiPut(...a),
    delete: (...a: unknown[]) => h.apiDelete(...a),
  },
}));
vi.mock('../../../services/networkMonitor', () => ({ networkMonitor: { isOnline: true } }));
vi.mock('../../../services/writeQueue', () => ({ writeQueue: { enqueue: vi.fn() } }));
vi.mock('../../../services/systemDialoge', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../services/systemDialoge')>()),
  teilenImBrowser: (...a: unknown[]) => h.teilen(...a),
}));
vi.mock('qrcode', () => ({ default: { toDataURL: (...a: unknown[]) => h.qr(...a) } }));
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({ user: h.user, setError: h.setError, setSuccess: h.setSuccess, isOnline: h.online }),
}));
vi.mock('../../../hooks/useOfflineQuery', async () => {
  const React = await import('react');
  return {
    // Der Schluessel beginnt mit "admin:<was>:" -- die Daten stehen unter <was>.
    useOfflineQuery: (schluessel: string, _lader: unknown, optionen?: { onSuccess?: (d: unknown) => void }) => {
      const daten = h.daten[schluessel.split(':')[1]];
      const beiErfolg = optionen?.onSuccess;
      React.useEffect(() => { if (beiErfolg && daten !== undefined) beiErfolg(daten); }, []); // eslint-disable-line react-hooks/exhaustive-deps
      return { data: daten ?? [], loading: h.laedt, refresh: h.refresh, refreshLive: vi.fn() };
    },
  };
});

import AdminDashboardSettingsPage from '../../../components/admin/pages/AdminDashboardSettingsPage';
import AdminInvitePage from '../../../components/admin/pages/AdminInvitePage';
import AdminWrappedPage from '../../../components/admin/pages/AdminWrappedPage';

const zelle = (z: HTMLElement, i: number) => within(z).getAllByRole('cell')[i];
const zeilen = (name: string) => within(screen.getByRole('table', { name })).getAllByRole('row').slice(1);
const spaltenkoepfe = (name: string) => within(screen.getByRole('table', { name })).getAllByRole('columnheader').map((c) => c.textContent);
const bestaetigen = async (text: string, wert?: unknown) => {
  await act(async () => {
    const handler = h.stand.alert?.buttons?.find((b) => b.text === text)?.handler as ((w?: unknown) => unknown) | undefined;
    await handler?.(wert);
  });
};
const warten = async () => { for (let i = 0; i < 6; i += 1) await act(async () => { await Promise.resolve(); }); };

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(h.stand, neuerStand());
  h.breit = true;
  h.online = true;
  h.laedt = false;
  h.daten = {};
  h.user = konto('org_admin');
  h.apiGet.mockResolvedValue({ data: [], headers: {} });
  h.apiPost.mockResolvedValue({ data: {} });
  h.apiPut.mockResolvedValue({ data: {} });
  h.apiDelete.mockResolvedValue({ data: {} });
  h.qr.mockImplementation(async (url: string) => `data:image/png;base64,${url.split('code=')[1]}`);
});

// ---------------------------------------------------------------------------
describe('verschiebeEintrag', () => {
  it('rueckt um eine Stelle nach oben oder unten; am Rand bleibt alles, wie es ist', () => {
    expect(verschiebeEintrag(['a', 'b', 'c'], 1, 'hoch')).toEqual(['b', 'a', 'c']);
    expect(verschiebeEintrag(['a', 'b', 'c'], 1, 'runter')).toEqual(['a', 'c', 'b']);
    expect(verschiebeEintrag(['a', 'b', 'c'], 0, 'hoch')).toEqual(['a', 'b', 'c']);
    expect(verschiebeEintrag(['a', 'b', 'c'], 2, 'runter')).toEqual(['a', 'b', 'c']);
    expect(verschiebeEintrag(['a', 'b', 'c'], 5, 'hoch')).toEqual(['a', 'b', 'c']);
  });

  it('veraendert die uebergebene Liste nicht', () => {
    const vorher = ['a', 'b'];
    verschiebeEintrag(vorher, 0, 'runter');
    expect(vorher).toEqual(['a', 'b']);
  });
});

// ---------------------------------------------------------------------------
describe('Dashboard einrichten (Web)', () => {
  const EINSTELLUNGEN = {
    dashboard_section_order: ['events', 'konfirmation', 'challenges', 'konfispruch', 'losung', 'badges', 'ranking'],
    dashboard_show_ranking: false,
    dashboard_show_losung: false,
    teamer_dashboard_show_badges: false,
  };

  beforeEach(() => { h.daten = { settings: EINSTELLUNGEN }; });

  const liste = (name: string) => within(screen.getByRole('list', { name }));
  const bereiche = (name: string) => [...screen.getByRole('list', { name }).querySelectorAll('li')].map((li) => li.querySelector('.web-schalter__text')!.textContent);

  it('Titel, Weg zurueck nach "Mehr", Kennzahlen und die Bereiche in der gespeicherten Reihenfolge', () => {
    render(<AdminDashboardSettingsPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Mehr' })).toHaveAttribute('href', '/admin/settings');
    expect(screen.getByRole('group', { name: 'Konfis: 5' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Team: 5' })).toBeInTheDocument();
    expect(bereiche('Konfi-Dashboard')).toEqual(['Events', 'Countdown', 'Challenges', 'Konfispruch', 'Tageslosung', 'Badges', 'Ranking']);
    expect(bereiche('Team-Dashboard')).toEqual(['Zertifikate', 'Challenges', 'Konfispruch', 'Events', 'Badges', 'Tageslosung']);
    expect(screen.getByText('5 von 7 Bereichen sichtbar')).toBeInTheDocument();
  });

  it('die Schalter zeigen, was eingestellt ist: ausgeschaltet ist nur, was die Einstellungen ausschalten', () => {
    render(<AdminDashboardSettingsPage />);
    expect(liste('Konfi-Dashboard').getByRole('switch', { name: 'Ranking' })).not.toBeChecked();
    expect(liste('Konfi-Dashboard').getByRole('switch', { name: 'Tageslosung' })).not.toBeChecked();
    expect(liste('Konfi-Dashboard').getByRole('switch', { name: 'Events' })).toBeChecked();
    // Fuers Team gilt die Einstellung des Teams, nicht die der Konfis: Dort ist die Tageslosung an.
    expect(liste('Team-Dashboard').getByRole('switch', { name: 'Tageslosung' })).toBeChecked();
    expect(liste('Team-Dashboard').getByRole('switch', { name: 'Badges' })).not.toBeChecked();
    expect(liste('Team-Dashboard').getByRole('switch', { name: 'Zertifikate' })).toBeChecked();
  });

  it('ein Schalter speichert sofort: Konfi mit "dashboard_", Team mit "teamer_dashboard_"', async () => {
    render(<AdminDashboardSettingsPage />);
    fireEvent.click(within(screen.getByRole('list', { name: 'Konfi-Dashboard' })).getByRole('switch', { name: 'Events' }));
    await warten();
    expect(h.apiPut).toHaveBeenCalledWith('/settings', { dashboard_show_events: false });
    fireEvent.click(within(screen.getByRole('list', { name: 'Team-Dashboard' })).getByRole('switch', { name: 'Zertifikate' }));
    await warten();
    expect(h.apiPut).toHaveBeenLastCalledWith('/settings', { teamer_dashboard_show_zertifikate: false });
    expect(h.apiPut).toHaveBeenCalledTimes(2);
  });

  it('scheitert das Speichern, springt der Schalter zurueck und die Meldung steht da', async () => {
    h.apiPut.mockRejectedValue(new Error('Netz weg'));
    render(<AdminDashboardSettingsPage />);
    const events = within(screen.getByRole('list', { name: 'Konfi-Dashboard' })).getByRole('switch', { name: 'Events' });
    fireEvent.click(events);
    await warten();
    expect(h.setError).toHaveBeenCalledWith('Fehler beim Speichern');
    expect(events).toBeChecked();
  });

  it('die Pfeile verschieben einen Bereich und speichern die neue Reihenfolge; am Rand sind sie gesperrt', async () => {
    render(<AdminDashboardSettingsPage />);
    expect(liste('Konfi-Dashboard').getByRole('button', { name: 'Events nach oben' })).toBeDisabled();
    expect(liste('Konfi-Dashboard').getByRole('button', { name: 'Ranking nach unten' })).toBeDisabled();
    fireEvent.click(liste('Konfi-Dashboard').getByRole('button', { name: 'Events nach unten' }));
    await warten();
    expect(bereiche('Konfi-Dashboard').slice(0, 3)).toEqual(['Countdown', 'Events', 'Challenges']);
    expect(h.apiPut).toHaveBeenCalledWith('/settings', {
      dashboard_section_order: JSON.stringify(['konfirmation', 'events', 'challenges', 'konfispruch', 'losung', 'badges', 'ranking']),
    });
    expect(liste('Konfi-Dashboard').getByRole('button', { name: 'Countdown nach oben' })).toBeDisabled();
    // Das Team hat eine eigene Reihenfolge, gespeichert unter eigenem Schluessel.
    fireEvent.click(liste('Team-Dashboard').getByRole('button', { name: 'Zertifikate nach unten' }));
    await warten();
    expect(h.apiPut).toHaveBeenLastCalledWith('/settings', {
      teamer_dashboard_section_order: JSON.stringify(['challenges', 'zertifikate', 'konfispruch', 'events', 'badges', 'losung']),
    });
  });

  it('schmal bleibt die Darstellung der App', () => {
    h.breit = false;
    const { container } = render(<AdminDashboardSettingsPage />);
    expect(container.querySelector('.web-seite')).toBeNull();
    expect(screen.queryByRole('list', { name: 'Konfi-Dashboard' })).toBeNull();
    expect(screen.getAllByRole('heading', { level: 1, name: 'Dashboard' }).length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
describe('Konfis einladen (Web)', () => {
  const TAG = 24 * 60 * 60 * 1000;
  const mittags = (tageVonHeute: number) => {
    const jetzt = new Date();
    return new Date(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate() + tageVonHeute, 12).toISOString();
  };
  const CODES = [
    { id: 1, invite_code: 'ABC123', jahrgang_id: 12, jahrgang_name: 'Jahrgang 2027', expires_at: mittags(5), used_count: 4 },
    { id: 2, invite_code: 'XYZ789', jahrgang_id: 11, jahrgang_name: 'Jahrgang 2026', expires_at: mittags(0), used_count: 0 },
    { id: 3, invite_code: 'OLD000', jahrgang_id: 11, jahrgang_name: 'Jahrgang 2026', expires_at: mittags(-2), used_count: 9 },
  ];

  beforeEach(() => {
    void TAG;
    h.daten = { jahrgaenge: [{ id: 12, name: 'Jahrgang 2027' }, { id: 11, name: 'Jahrgang 2026' }], 'invite-codes': CODES };
  });

  it('Titel, Weg zurueck, Tabelle der aktiven Codes mit Gueltigkeit; der erste gueltige Code steht im QR-Feld', async () => {
    render(<AdminInvitePage onClose={vi.fn()} />);
    await warten();
    expect(screen.getByRole('heading', { level: 1, name: 'Konfis einladen' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Mehr' })).toHaveAttribute('href', '/admin/settings');
    expect(spaltenkoepfe('Aktive Einladungscodes')).toEqual(['Jahrgang', 'Code', 'Verwendet', 'Gültigkeit', 'Aktionen']);
    const z = zeilen('Aktive Einladungscodes');
    expect(z).toHaveLength(3);
    expect(zelle(z[0], 0)).toHaveTextContent('Jahrgang 2027');
    expect(zelle(z[0], 1)).toHaveTextContent('ABC123');
    expect(zelle(z[0], 2)).toHaveTextContent('4');
    expect(zelle(z[0], 3)).toHaveTextContent('Noch 5 Tage gültig');
    expect(zelle(z[1], 3)).toHaveTextContent('Läuft heute ab');
    expect(zelle(z[2], 3)).toHaveTextContent('Abgelaufen');
    expect(h.qr).toHaveBeenCalledWith('https://konfi-quest.de/register?code=ABC123', expect.anything());
    expect(await screen.findByAltText('QR-Code für die Registrierung')).toHaveAttribute('src', 'data:image/png;base64,ABC123');
    expect(within(screen.getByRole('complementary', { name: 'QR-Code und Hinweise' })).getByText('ABC123')).toBeInTheDocument();
    expect(z[0].className).toContain('web-zeile--gewaehlt');
  });

  it('einen neuen Code erzeugen: Jahrgang und Gueltigkeit gehen an die Route, der neue Code steht im QR-Feld', async () => {
    h.apiPost.mockResolvedValue({ data: { invite_code: 'NEU456' } });
    render(<AdminInvitePage onClose={vi.fn()} />);
    await warten();
    fireEvent.change(screen.getByLabelText('Jahrgang'), { target: { value: '11' } });
    fireEvent.change(screen.getByLabelText('Gültigkeit'), { target: { value: '30' } });
    fireEvent.click(screen.getByRole('button', { name: 'Einladungslink generieren' }));
    await warten();
    expect(h.apiPost).toHaveBeenCalledWith('/auth/invite-code', { jahrgang_id: 11, gueltig_tage: 30 });
    expect(h.qr).toHaveBeenLastCalledWith('https://konfi-quest.de/register?code=NEU456', expect.anything());
    expect(await screen.findByAltText('QR-Code für die Registrierung')).toHaveAttribute('src', 'data:image/png;base64,NEU456');
    expect(h.refresh).toHaveBeenCalled();
  });

  it('ohne Jahrgang oder ohne Netz ist der Knopf gesperrt', async () => {
    h.daten['invite-codes'] = [];
    const { unmount } = render(<AdminInvitePage onClose={vi.fn()} />);
    await warten();
    fireEvent.change(screen.getByLabelText('Jahrgang'), { target: { value: '' } });
    expect(screen.getByRole('button', { name: 'Einladungslink generieren' })).toBeDisabled();
    unmount();
    h.online = false;
    render(<AdminInvitePage onClose={vi.fn()} />);
    await warten();
    expect(screen.getByRole('button', { name: 'Du bist offline' })).toBeDisabled();
  });

  it('"QR-Code" in der Zeile zeigt den Code dieser Zeile und waehlt ihren Jahrgang', async () => {
    render(<AdminInvitePage onClose={vi.fn()} />);
    await warten();
    fireEvent.click(screen.getByRole('button', { name: 'QR-Code von XYZ789 anzeigen' }));
    await warten();
    expect(h.qr).toHaveBeenLastCalledWith('https://konfi-quest.de/register?code=XYZ789', expect.anything());
    expect(await screen.findByAltText('QR-Code für die Registrierung')).toHaveAttribute('src', 'data:image/png;base64,XYZ789');
    expect(screen.getByLabelText('Jahrgang')).toHaveValue('11');
  });

  it('Verlaengern fragt wie in der App nach den Tagen und ruft erst danach die Route', async () => {
    h.apiPost.mockResolvedValue({ data: { expires_at: mittags(19) } });
    render(<AdminInvitePage onClose={vi.fn()} />);
    await warten();
    fireEvent.click(screen.getByRole('button', { name: 'Einladung ABC123 verlängern' }));
    expect(h.stand.alert?.header).toBe('Einladung verlängern');
    const optionen = (h.stand.alert as unknown as { inputs: Array<{ value: number; label: string }> }).inputs;
    expect(optionen.map((o) => o.value)).toEqual([7, 14, 30, 60, 90]);
    expect(optionen[4].label).toMatch(/^Bis .* — länger als 90 Tage geht nicht$/);
    expect(h.apiPost).not.toHaveBeenCalledWith('/auth/invite-codes/1/extend', expect.anything());
    await bestaetigen('Verlängern', 14);
    expect(h.apiPost).toHaveBeenCalledWith('/auth/invite-codes/1/extend', { tage: 14 });
    expect(h.setSuccess).toHaveBeenCalledWith(expect.stringMatching(/^Einladung gilt bis \d{2}\.\d{2}\.\d{4}$/));
  });

  it('Loeschen fragt nach dem Code; der gezeigte QR-Code verschwindet, wenn es sein Code war', async () => {
    render(<AdminInvitePage onClose={vi.fn()} />);
    await warten();
    await screen.findByAltText('QR-Code für die Registrierung');
    fireEvent.click(screen.getByRole('button', { name: 'Einladung ABC123 löschen' }));
    expect(h.stand.alert?.header).toBe('Code löschen');
    expect(h.stand.alert?.message).toBe('Einladungscode "ABC123" wirklich löschen?');
    await bestaetigen('Löschen');
    expect(h.apiDelete).toHaveBeenCalledWith('/auth/invite-codes/1');
    await waitFor(() => expect(screen.queryByAltText('QR-Code für die Registrierung')).toBeNull());
  });

  it('"Link kopieren" legt die Registrierungsadresse in die Zwischenablage; "Teilen" nutzt die Teilen-Funktion des Browsers', async () => {
    const schreiben = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: schreiben }, configurable: true });
    Object.defineProperty(navigator, 'share', { value: vi.fn(), configurable: true });
    h.teilen.mockResolvedValue(undefined);
    render(<AdminInvitePage onClose={vi.fn()} />);
    await warten();
    await screen.findByAltText('QR-Code für die Registrierung');
    fireEvent.click(screen.getByRole('button', { name: 'Link kopieren' }));
    await warten();
    expect(schreiben).toHaveBeenCalledWith('https://konfi-quest.de/register?code=ABC123');
    expect(h.setSuccess).toHaveBeenCalledWith('Link kopiert');
    fireEvent.click(screen.getByRole('button', { name: 'Teilen' }));
    await warten();
    expect(h.teilen).toHaveBeenCalledWith({
      title: 'Konfi Quest - Einladung',
      text: 'Registriere dich für Jahrgang 2027 bei Konfi Quest!',
      url: 'https://konfi-quest.de/register?code=ABC123',
    });
  });

  it('als Fenster aus "Mehr" bleibt die Darstellung der App, auch im breiten Layout', async () => {
    const { container } = render(<AdminInvitePage onClose={vi.fn()} dismiss={vi.fn()} />);
    await warten();
    expect(container.querySelector('.web-seite')).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'Konfis einladen' })).toBeInTheDocument();
  });

  it('schmal bleibt die Darstellung der App', async () => {
    h.breit = false;
    const { container } = render(<AdminInvitePage onClose={vi.fn()} />);
    await warten();
    expect(container.querySelector('.web-seite')).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
  });
});

// ---------------------------------------------------------------------------
describe('Jahresrueckblick (Web)', () => {
  const JAHR = new Date().getFullYear();
  const AUSGABEN = [
    { id: 1, typ: 'konfi', jahrgang_id: 12, jahrgang_name: 'Jahrgang 2027', titel: 'Zwischenstand', zeitraum_start: '2025-09-01T00:00:00Z', zeitraum_ende: '2026-09-12T00:00:00Z', freigegeben: true, freigegeben_at: '2026-09-12T10:00:00Z', snapshots: 18, created_at: '2026-09-12T10:00:00Z' },
    { id: 2, typ: 'konfi', jahrgang_id: 11, jahrgang_name: 'Jahrgang 2026', titel: 'Abschluss', zeitraum_start: '2024-09-01T00:00:00Z', zeitraum_ende: '2026-05-01T00:00:00Z', freigegeben: false, freigegeben_at: null, snapshots: 21, created_at: '2026-05-01T10:00:00Z' },
    { id: 3, typ: 'teamer', jahrgang_id: null, jahrgang_name: null, titel: `Teamerjahr ${JAHR - 1}`, zeitraum_start: `${JAHR - 1}-01-01T00:00:00Z`, zeitraum_ende: `${JAHR - 1}-12-31T00:00:00Z`, freigegeben: true, freigegeben_at: `${JAHR}-01-06T10:00:00Z`, snapshots: 7, created_at: `${JAHR}-01-06T10:00:00Z` },
  ];
  const TEAM_JAHRE = [{ jahr: JAHR - 2, gesperrt: false }, { jahr: JAHR - 1, gesperrt: false }, { jahr: JAHR, gesperrt: true }];

  let kopf: Record<string, string> = {};
  beforeEach(() => {
    kopf = {};
    h.apiGet.mockImplementation(async (url: string) => {
      if (url === '/wrapped/ausgaben') return { data: AUSGABEN, headers: kopf };
      if (url === '/admin/jahrgaenge') return { data: [{ id: 12, name: 'Jahrgang 2027' }, { id: 11, name: 'Jahrgang 2026' }], headers: {} };
      if (url === '/wrapped/team-jahre') return { data: TEAM_JAHRE, headers: {} };
      return { data: [], headers: {} };
    });
  });

  const oeffnen = async () => {
    const r = render(<AdminWrappedPage />);
    await warten();
    return r;
  };

  it('Konfis: Kennzahlen, Spalten und Zeilen mit Jahrgang, Zeitraum, Rueckblicken und Status', async () => {
    await oeffnen();
    expect(screen.getByRole('heading', { level: 1, name: 'Jahresrückblick' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Mehr' })).toHaveAttribute('href', '/admin/settings');
    expect(screen.getByRole('group', { name: 'Ausgaben: 2' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Freigegeben: 1' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Rückblicke: 39' })).toBeInTheDocument();
    expect(spaltenkoepfe('Ausgaben für Konfis')).toEqual(['Name', 'Jahrgang', 'Zeitraum', 'Rückblicke', 'Status', 'Aktionen']);
    const z = zeilen('Ausgaben für Konfis');
    expect(z).toHaveLength(2);
    expect(zelle(z[0], 0)).toHaveTextContent('Zwischenstand');
    expect(zelle(z[0], 1)).toHaveTextContent('Jahrgang 2027');
    expect(zelle(z[0], 2)).toHaveTextContent('01.09.2025 – 12.09.2026');
    expect(zelle(z[0], 3)).toHaveTextContent('18');
    expect(zelle(z[0], 4)).toHaveTextContent('Freigegeben 12.09.2026');
    expect(zelle(z[1], 4)).toHaveTextContent('Nicht freigegeben');
  });

  it('Team gibt es nur fuer die Gemeindeleitung: die Leitung sieht den Reiter nicht', async () => {
    h.user = konto('admin', [12]);
    await oeffnen();
    expect(screen.getByRole('button', { name: /^Konfis/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Team/ })).toBeNull();
  });

  it('Team (Gemeindeleitung): die Ausgaben ohne Jahrgang-Spalte', async () => {
    await oeffnen();
    fireEvent.click(screen.getByRole('button', { name: /^Team/ }));
    expect(spaltenkoepfe('Ausgaben fürs Team')).toEqual(['Name', 'Zeitraum', 'Rückblicke', 'Status', 'Aktionen']);
    const z = zeilen('Ausgaben fürs Team');
    expect(z).toHaveLength(1);
    expect(zelle(z[0], 0)).toHaveTextContent(`Teamerjahr ${JAHR - 1}`);
    expect(zelle(z[0], 2)).toHaveTextContent('7');
  });

  it('neuer Konfi-Rueckblick: Jahrgang waehlen, ohne Namen gilt der Vorschlag -- die Route bekommt Jahrgang und Titel', async () => {
    h.apiPost.mockResolvedValue({ data: {} });
    await oeffnen();
    fireEvent.click(screen.getByRole('button', { name: 'Neuer Rückblick' }));
    const dialog = screen.getByRole('dialog', { name: 'Neuer Rückblick' });
    fireEvent.change(within(dialog).getByLabelText('Jahrgang'), { target: { value: '12' } });
    // Fuer Jahrgang 2027 gibt es schon eine Ausgabe: der Vorschlag zaehlt weiter.
    expect(within(dialog).getByText(/Ohne Eingabe heißt die Ausgabe „Zwischenstand 2“/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Rückblick erstellen und freigeben' }));
    await warten();
    expect(h.apiPost).toHaveBeenCalledWith('/wrapped/generate/12', { titel: 'Zwischenstand 2' });
    expect(h.setSuccess).toHaveBeenCalledWith('Rückblick erstellt und freigegeben');
    expect(screen.queryByRole('dialog')).toBeNull();
    // Danach wird die Liste neu geladen.
    expect(h.apiGet.mock.calls.filter(([u]) => u === '/wrapped/ausgaben')).toHaveLength(2);
  });

  it('ein eigener Name geht als Titel mit; ohne Jahrgang kein Aufruf, sondern die Meldung', async () => {
    await oeffnen();
    fireEvent.click(screen.getByRole('button', { name: 'Neuer Rückblick' }));
    let dialog = screen.getByRole('dialog', { name: 'Neuer Rückblick' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Rückblick erstellen und freigeben' }));
    await warten();
    expect(h.apiPost).not.toHaveBeenCalled();
    expect(h.setError).toHaveBeenCalledWith('Bitte einen Jahrgang wählen');
    dialog = screen.getByRole('dialog', { name: 'Neuer Rückblick' });
    fireEvent.change(within(dialog).getByLabelText('Jahrgang'), { target: { value: '11' } });
    fireEvent.change(within(dialog).getByLabelText('Name'), { target: { value: 'Rückblick nach der Freizeit' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Rückblick erstellen und freigeben' }));
    await warten();
    expect(h.apiPost).toHaveBeenCalledWith('/wrapped/generate/11', { titel: 'Rückblick nach der Freizeit' });
  });

  it('Abbrechen und Escape schliessen den Dialog ohne Aufruf', async () => {
    await oeffnen();
    fireEvent.click(screen.getByRole('button', { name: 'Neuer Rückblick' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Abbrechen' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Neuer Rückblick' }));
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(h.apiPost).not.toHaveBeenCalled();
  });

  it('neuer Team-Rueckblick: nur abgeschlossene Jahre zur Wahl, das laufende steht mit Datum als Hinweis; die Route bekommt das Jahr', async () => {
    h.apiPost.mockResolvedValue({ data: { benachrichtigt: true } });
    await oeffnen();
    fireEvent.click(screen.getByRole('button', { name: /^Team/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Neuer Rückblick' }));
    const dialog = screen.getByRole('dialog', { name: 'Neuer Rückblick' });
    const jahr = within(dialog).getByLabelText('Jahr') as HTMLSelectElement;
    expect([...jahr.options].map((o) => o.value)).toEqual([String(JAHR - 2), String(JAHR - 1)]);
    expect(jahr.value).toBe(String(JAHR - 1));
    expect(within(dialog).getByText(`${JAHR} — verfügbar ab 1.1.${JAHR + 1}`)).toBeInTheDocument();
    fireEvent.change(jahr, { target: { value: String(JAHR - 2) } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Rückblick erstellen und freigeben' }));
    await warten();
    expect(h.apiPost).toHaveBeenCalledWith('/wrapped/generate-teamer', { jahr: JAHR - 2 });
    expect(h.setSuccess).toHaveBeenCalledWith(`Teamerjahr ${JAHR - 2} erstellt und freigegeben`);
  });

  it('bestand das Team-Jahr schon, sagt die Meldung, dass nichts geaendert wurde', async () => {
    h.apiPost.mockResolvedValue({ data: { benachrichtigt: false } });
    await oeffnen();
    fireEvent.click(screen.getByRole('button', { name: /^Team/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Neuer Rückblick' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Rückblick erstellen und freigeben' }));
    await warten();
    expect(h.apiPost).toHaveBeenCalledWith('/wrapped/generate-teamer', { jahr: JAHR - 1 });
    expect(h.setSuccess).toHaveBeenCalledWith(`Teamerjahr ${JAHR - 1} bestand schon — es wurde nichts geändert`);
  });

  it('Loeschen fragt mit dem Namen und der Zahl der Rueckblicke nach und ruft erst danach die Route', async () => {
    await oeffnen();
    fireEvent.click(screen.getByRole('button', { name: 'Zwischenstand löschen' }));
    expect(h.stand.alert?.header).toBe('Ausgabe löschen?');
    expect(h.stand.alert?.message).toBe('„Zwischenstand" und die 18 Rückblicke darin werden gelöscht. Andere Ausgaben bleiben bestehen.');
    expect(h.apiDelete).not.toHaveBeenCalled();
    await bestaetigen('Löschen');
    expect(h.apiDelete).toHaveBeenCalledWith('/wrapped/ausgabe/1');
    expect(h.setSuccess).toHaveBeenCalledWith('Ausgabe gelöscht');
  });

  it('ohne Jahrgang-Zuweisung sagt der Leerzustand den Grund', async () => {
    kopf = { 'x-kein-jahrgang-zugewiesen': 'true' };
    h.apiGet.mockImplementation(async (url: string) => (url === '/wrapped/ausgaben' ? { data: [], headers: kopf } : { data: [], headers: {} }));
    h.user = konto('admin', []);
    await oeffnen();
    expect(screen.getByText('Kein Jahrgang zugewiesen')).toBeInTheDocument();
    expect(screen.getByText('Dir ist noch kein Jahrgang zugewiesen. Die Gemeindeleitung kann das in den Einstellungen ändern.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('schmal bleibt die Darstellung der App', async () => {
    h.breit = false;
    const { container } = await oeffnen();
    expect(container.querySelector('.web-seite')).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
  });
});
