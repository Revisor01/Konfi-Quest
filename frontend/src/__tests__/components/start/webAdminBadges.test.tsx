// „Badges verwalten" der Leitung in der Web-Fassung, gerendert (03.10.2026,
// docs/planung/web-alle-bereiche.md, Entscheidung 6): Kennzahlen, Wechsel
// zwischen Konfis und Team, Suche, Status-Filter und Sortierung, darunter eine
// Tabelle. „Bearbeiten" und „Neues Badge" oeffnen das Formular der App
// (BadgeManagementModal), „Loeschen" fragt wie in der App nach. Im schmalen
// Fenster bleibt die Darstellung der App.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import './zeitrahmen';
import React from 'react';
import { render, screen, fireEvent, within, act, waitFor } from '@testing-library/react';
import type { ModalAufruf } from './ionicStart';

const h = vi.hoisted(() => ({
  breit: true,
  laedt: false,
  online: true,
  apiGet: vi.fn(),
  apiDelete: vi.fn(),
  push: vi.fn(),
  modale: [] as Array<{ name: string; props: Record<string, unknown>; optionen: Record<string, unknown> | undefined }>,
  alerts: [] as unknown[],
  zuletzt: {} as Record<string, Record<string, unknown>>,
  seite: document.createElement('div'),
  user: { id: 3, organization_id: 1, role_name: 'admin', display_name: 'Lena Leitung' } as Record<string, unknown>,
  konfiBadges: [] as unknown[],
  teamBadges: [] as unknown[],
  refresh: vi.fn(),
  setError: vi.fn(),
  schluessel: [] as string[],
}));

vi.mock('@ionic/react', async () => (await import('./ionicStart')).ionicStart(h as never));
vi.mock('../../../components/shared/AppKopfzeile', async () => (await import('../support/ionicAttrappe')).KopfzeileAttrappe);
vi.mock('../../../components/shared/WartungsHinweis', () => ({ default: () => null }));
vi.mock('../../../components/common/LoadingSpinner', () => ({ default: ({ message }: { message: string }) => <p>{message}</p> }));
vi.mock('../../../components/admin/modals/BadgeManagementModal', async () => ({ default: (await import('./ionicStart')).modalAttrappe('BadgeManagementModal') }));
vi.mock('../../../services/api', () => ({ default: { get: h.apiGet, delete: h.apiDelete } }));
vi.mock('../../../contexts/LiveUpdateContext', () => ({ useLiveRefresh: vi.fn() }));
vi.mock('../../../contexts/ModalContext', () => ({ useModalPage: () => ({ pageRef: { current: h.seite }, presentingElement: h.seite }) }));
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({ user: h.user, setError: h.setError, isOnline: h.online }),
}));
vi.mock('../../../utils/haptics', () => ({ triggerPullHaptic: vi.fn() }));
vi.mock('../../../navigation/breitesLayout', () => ({ useBreitesLayout: () => h.breit }));
vi.mock('../../../hooks/useOfflineQuery', () => ({
  useOfflineQuery: (schluessel: string) => {
    h.schluessel.push(schluessel);
    const daten = schluessel.endsWith(':teamer') ? h.teamBadges : h.konfiBadges;
    return { data: h.laedt ? null : daten, loading: h.laedt, refresh: h.refresh, refreshLive: vi.fn() };
  },
}));

import AdminBadgesPage from '../../../components/admin/pages/AdminBadgesPage';

const badge = (id: number, name: string, typ: string, wert: number, extra: Record<string, unknown> = {}) => ({
  id, name, description: `${name} beschrieben`, icon: 'trophy', criteria_type: typ, criteria_value: wert, criteria_extra: null,
  is_active: true, is_hidden: false, earned_count: 0, color: '#c0c0c0', ...extra,
});

const KONFI = [
  badge(1, 'Erster Schritt', 'total_points', 5, { earned_count: 24 }),
  badge(2, 'Punkte-Sammler', 'total_points', 15, { earned_count: 12 }),
  badge(3, 'Gottesdienst-Held', 'gottesdienst_points', 8, { earned_count: 7 }),
  badge(4, 'Nachtwanderer', 'specific_activity', 1, {
    is_hidden: true, earned_count: 3, description: 'Nur im Dunkeln unterwegs', criteria_extra: JSON.stringify({ required_activity_name: 'Nachtwanderung' }),
  }),
  badge(5, 'Event-Champion', 'event_count', 3, { is_active: false }),
  badge(6, 'Zeitreisender', 'time_based', 5, { earned_count: 2, criteria_extra: JSON.stringify({ days: 28 }) }),
];

const TEAM = [
  badge(11, 'Erstes Jahr', 'teamer_year', 1, { earned_count: 4 }),
  badge(12, 'Zweites Jahr', 'teamer_year', 2, { earned_count: 1 }),
];

const zeigeSeite = async () => {
  const ergebnis = render(<AdminBadgesPage />);
  await screen.findByRole('heading', { level: 1, name: 'Badges' });
  await act(async () => { await Promise.resolve(); });
  return ergebnis;
};

const tabelle = () => screen.getByRole('table', { name: 'Badges' });
/** Die Namen der Zeilen in der Reihenfolge der Tabelle. */
const namen = (): string[] => Array.from(tabelle().querySelectorAll('.web-badge-zelle__name')).map((e) => e.textContent ?? '');
const zeile = (name: string): HTMLElement => within(tabelle()).getByRole('button', { name: `${name} bearbeiten`, description: '' }).closest('tr') as HTMLElement;
const status = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name}`) });
const modal = (name: string): ModalAufruf | undefined => h.modale.find((m) => m.name === name);

beforeEach(() => {
  vi.clearAllMocks();
  h.apiGet.mockReset();
  h.apiDelete.mockReset();
  h.breit = true;
  h.laedt = false;
  h.online = true;
  h.modale.length = 0;
  h.alerts.length = 0;
  h.schluessel.length = 0;
  for (const k of Object.keys(h.zuletzt)) delete h.zuletzt[k];
  h.konfiBadges = KONFI;
  h.teamBadges = TEAM;
  h.refresh.mockResolvedValue(undefined);
  h.apiGet.mockImplementation((url: string) => Promise.resolve({ data: url.includes('target_role=teamer') ? [{ id: 90, name: 'Gruppenstunde' }] : [{ id: 58, name: 'Nachtwanderung' }] }));
  h.apiDelete.mockResolvedValue({ data: {} });
});

describe('Badges verwalten (Web): Kopf und Kennzahlen', () => {
  it('Seitenkopf mit Weg zurueck, Knopf „Neues Badge" und der Farbe der Leitung', async () => {
    const { container } = await zeigeSeite();
    expect(screen.getByText('Auszeichnungen und Erfolge')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Mehr' })).toHaveAttribute('href', '/admin/settings');
    expect(screen.getByRole('button', { name: 'Neues Badge' })).toBeInTheDocument();
    expect(container.querySelector('.web-rolle--leitung')).not.toBeNull();
  });

  it('zeigt erst Platzhalter', () => {
    h.laedt = true;
    render(<AdminBadgesPage />);
    expect(screen.getByRole('status')).toHaveTextContent('Badges werden geladen.');
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('die Kacheln zaehlen Badges, aktive, geheime und verliehene', async () => {
    await zeigeSeite();
    expect(screen.getByRole('group', { name: 'Badges: 6' })).toHaveTextContent('für Konfis');
    // Aktiv heisst: eingeschaltet UND nicht geheim (1, 2, 3 und 6).
    expect(screen.getByRole('group', { name: 'Aktiv: 4' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Geheim: 1' })).toBeInTheDocument();
    // 24 + 12 + 7 + 3 + 0 + 2
    expect(screen.getByRole('group', { name: 'Verliehen: 48' })).toBeInTheDocument();
  });

  it('die Chips tragen die Zahlen', async () => {
    await zeigeSeite();
    expect(status('Alle')).toHaveTextContent('Alle6');
    expect(status('Aktiv')).toHaveTextContent('Aktiv4');
    expect(status('Geheim')).toHaveTextContent('Geheim1');
    expect(status('Inaktiv')).toHaveTextContent('Inaktiv1');
    expect(status('Alle')).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('Badges verwalten (Web): Tabelle', () => {
  it('Standardordnung: nach Kriterium, darin nach Schwelle', async () => {
    await zeigeSeite();
    expect(namen()).toEqual(['Event-Champion', 'Erster Schritt', 'Punkte-Sammler', 'Gottesdienst-Held', 'Nachtwanderer', 'Zeitreisender']);
  });

  it('eine Zeile nennt Kriterium samt Angabe, Status und Zahl der Verleihungen', async () => {
    await zeigeSeite();
    const erster = zeile('Erster Schritt');
    expect(erster).toHaveTextContent('Gesamtpunkte');
    expect(erster).toHaveTextContent('5 Punkte');
    expect(erster).toHaveTextContent('Aktiv');
    expect(erster).toHaveTextContent('Sichtbar');
    expect(erster).toHaveTextContent('24×');
    const nacht = zeile('Nachtwanderer');
    expect(nacht).toHaveTextContent('Spezielle Aktivität');
    expect(nacht).toHaveTextContent('1x Nachtwanderung');
    expect(nacht).toHaveTextContent('Geheim');
    expect(nacht).toHaveTextContent('3×');
    expect(zeile('Zeitreisender')).toHaveTextContent('5 in 4 Wochen');
    const champion = zeile('Event-Champion');
    expect(champion).toHaveTextContent('Inaktiv');
    expect(champion).toHaveTextContent('0×');
    expect(champion.className).toContain('web-zeile--gesperrt');
    expect(erster.className).not.toContain('web-zeile--gesperrt');
  });

  it('die Beschreibung steht unter dem Namen', async () => {
    await zeigeSeite();
    expect(zeile('Nachtwanderer')).toHaveTextContent('Nur im Dunkeln unterwegs');
  });

  it('Sortierung nach Name und nach Verliehen', async () => {
    await zeigeSeite();
    fireEvent.change(screen.getByLabelText('Sortierung'), { target: { value: 'name' } });
    expect(namen()).toEqual(['Erster Schritt', 'Event-Champion', 'Gottesdienst-Held', 'Nachtwanderer', 'Punkte-Sammler', 'Zeitreisender']);
    fireEvent.change(screen.getByLabelText('Sortierung'), { target: { value: 'verliehen' } });
    expect(namen()).toEqual(['Erster Schritt', 'Punkte-Sammler', 'Gottesdienst-Held', 'Nachtwanderer', 'Zeitreisender', 'Event-Champion']);
    fireEvent.change(screen.getByLabelText('Sortierung'), { target: { value: 'kriterium' } });
    expect(namen()[0]).toBe('Event-Champion');
  });
});

describe('Badges verwalten (Web): Suche und Filter', () => {
  it('„Aktiv", „Geheim" und „Inaktiv" zeigen genau ihre Badges', async () => {
    await zeigeSeite();
    fireEvent.click(status('Aktiv'));
    expect(namen()).toEqual(['Erster Schritt', 'Punkte-Sammler', 'Gottesdienst-Held', 'Zeitreisender']);
    fireEvent.click(status('Geheim'));
    expect(namen()).toEqual(['Nachtwanderer']);
    fireEvent.click(status('Inaktiv'));
    expect(namen()).toEqual(['Event-Champion']);
    expect(status('Inaktiv')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(status('Alle'));
    expect(namen()).toHaveLength(6);
  });

  it('die Suche liest Namen und Beschreibung und hebt den Treffer im Namen hervor', async () => {
    await zeigeSeite();
    const suche = screen.getByRole('searchbox', { name: 'Badges durchsuchen' });
    fireEvent.change(suche, { target: { value: 'SAMMLER' } });
    expect(namen()).toEqual(['Punkte-Sammler']);
    expect(tabelle().querySelector('mark')?.textContent).toBe('Sammler');
    fireEvent.change(suche, { target: { value: 'dunkeln' } });
    expect(namen()).toEqual(['Nachtwanderer']);
  });

  it('Suche und Status wirken zusammen', async () => {
    await zeigeSeite();
    fireEvent.change(screen.getByRole('searchbox', { name: 'Badges durchsuchen' }), { target: { value: 'beschrieben' } });
    expect(namen()).toHaveLength(5);
    fireEvent.click(status('Inaktiv'));
    expect(namen()).toEqual(['Event-Champion']);
    fireEvent.click(status('Geheim'));
    // Nachtwanderer ist geheim, hat aber eine eigene Beschreibung ohne das Wort.
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.getByText('Keine Badges gefunden')).toBeInTheDocument();
    expect(screen.getByText('Zu Suche und Filter gibt es kein Badge.')).toBeInTheDocument();
  });

  it('ganz ohne Badges steht die Aufforderung, das erste anzulegen', async () => {
    h.konfiBadges = [];
    await zeigeSeite();
    expect(screen.getByText('Keine Badges gefunden')).toBeInTheDocument();
    expect(screen.getByText('Lege das erste Badge an.')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Badges: 0' })).toBeInTheDocument();
  });
});

describe('Badges verwalten (Web): Konfis und Team', () => {
  it('der Wechsel laedt die Badges des Teams und die Aktivitaeten des Teams', async () => {
    await zeigeSeite();
    expect(h.apiGet).toHaveBeenCalledWith('/admin/activities?target_role=konfi');
    expect(screen.getByRole('button', { name: 'Konfis' })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Team' }));
    await waitFor(() => expect(namen()).toEqual(['Erstes Jahr', 'Zweites Jahr']));
    expect(h.schluessel).toContain('admin:badges:1:teamer');
    expect(screen.getByRole('group', { name: 'Badges: 2' })).toHaveTextContent('fürs Team');
    expect(zeile('Erstes Jahr')).toHaveTextContent('Teamer-Jahre');
    expect(zeile('Erstes Jahr')).toHaveTextContent('1 Jahr als Teamer:in');
    expect(zeile('Zweites Jahr')).toHaveTextContent('2 Jahre als Teamer:in');
    expect(h.apiGet).toHaveBeenCalledWith('/admin/activities?target_role=teamer');
  });
});

describe('Badges verwalten (Web): Bearbeiten, Anlegen und Loeschen -- wie in der App', () => {
  it('der Name und der Stift oeffnen das Formular der App fuer genau dieses Badge', async () => {
    await zeigeSeite();
    fireEvent.click(within(zeile('Punkte-Sammler')).getAllByRole('button', { name: 'Punkte-Sammler bearbeiten' })[0]);
    expect(h.modale.map((m) => m.name)).toEqual(['BadgeManagementModal']);
    expect(h.zuletzt.BadgeManagementModal.badgeId).toBe(2);
    expect(h.zuletzt.BadgeManagementModal.targetRole).toBe('konfi');
    expect(modal('BadgeManagementModal')?.optionen).toMatchObject({ presentingElement: h.seite, backdropDismiss: false });

    h.modale.length = 0;
    fireEvent.click(within(zeile('Gottesdienst-Held')).getByRole('button', { name: 'Gottesdienst-Held bearbeiten', description: 'Bearbeiten' }));
    expect(h.modale).toHaveLength(1);
    expect(h.zuletzt.BadgeManagementModal.badgeId).toBe(3);
  });

  it('„Neues Badge" oeffnet das Formular ohne Badge', async () => {
    await zeigeSeite();
    fireEvent.click(screen.getByRole('button', { name: 'Neues Badge' }));
    expect(h.modale).toHaveLength(1);
    expect(h.zuletzt.BadgeManagementModal.badgeId).toBeNull();
    expect(h.zuletzt.BadgeManagementModal.targetRole).toBe('konfi');
  });

  it('im Team-Reiter gilt das Formular fuers Team', async () => {
    await zeigeSeite();
    fireEvent.click(screen.getByRole('button', { name: 'Team' }));
    await waitFor(() => expect(namen()).toEqual(['Erstes Jahr', 'Zweites Jahr']));
    fireEvent.click(screen.getByRole('button', { name: 'Neues Badge' }));
    expect(h.zuletzt.BadgeManagementModal.targetRole).toBe('teamer');
  });

  it('Loeschen fragt nach; erst die Bestaetigung loescht und laedt die Liste neu', async () => {
    await zeigeSeite();
    fireEvent.click(screen.getByRole('button', { name: 'Event-Champion löschen' }));
    expect(h.alerts).toHaveLength(1);
    const alert = h.alerts[0] as { header: string; message: string; buttons: Array<{ text: string; role?: string; handler?: () => unknown }> };
    expect(alert.header).toBe('Badge löschen');
    expect(alert.message).toBe('Badge "Event-Champion" wirklich löschen?');
    expect(h.apiDelete).not.toHaveBeenCalled();
    await act(async () => { await alert.buttons.find((b) => b.role === 'cancel')?.handler?.(); });
    expect(h.apiDelete).not.toHaveBeenCalled();
    await act(async () => { await alert.buttons.find((b) => b.role === 'destructive')?.handler?.(); });
    expect(h.apiDelete).toHaveBeenCalledWith('/admin/badges/5');
    expect(h.refresh).toHaveBeenCalledTimes(1);
    expect(h.setError).not.toHaveBeenCalled();
  });

  it('scheitert das Loeschen, steht die Meldung des Servers da', async () => {
    h.apiDelete.mockRejectedValue({ response: { status: 409, data: { error: 'Das Badge ist noch vergeben' } } });
    await zeigeSeite();
    fireEvent.click(screen.getByRole('button', { name: 'Erster Schritt löschen' }));
    const alert = h.alerts[0] as { buttons: Array<{ role?: string; handler?: () => unknown }> };
    await act(async () => { await alert.buttons.find((b) => b.role === 'destructive')?.handler?.(); });
    expect(h.setError).toHaveBeenCalledWith('Das Badge ist noch vergeben');
    expect(h.refresh).not.toHaveBeenCalled();
  });

  it('offline fragt das Loeschen gar nicht erst, sondern nennt den Grund', async () => {
    h.online = false;
    await zeigeSeite();
    fireEvent.click(screen.getByRole('button', { name: 'Event-Champion löschen' }));
    expect(h.alerts).toHaveLength(0);
    expect(h.setError).toHaveBeenCalledWith('Das geht nur mit Internetverbindung. Bitte versuche es später noch einmal.');
  });
});

describe('Badges verwalten: schmales Fenster', () => {
  it('bleibt die Darstellung der App, ohne Tabelle', async () => {
    h.breit = false;
    const { container } = render(<AdminBadgesPage />);
    await act(async () => { await Promise.resolve(); });
    expect(container.querySelector('.web-seite')).toBeNull();
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.queryByRole('group', { name: 'Badges: 6' })).toBeNull();
  });
});
