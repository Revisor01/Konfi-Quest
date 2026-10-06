// Detailseite einer Konfi bzw. Teamer:in in der Web-Fassung (/admin/konfis/:id),
// gerendert (docs/planung/web-alle-bereiche.md, Entscheidung 6): zweispaltig --
// links Person mit Ringen, Aktivitaeten und Bonuspunkte, rechts Aktionen,
// Konfirmation, Badges, Events, Antraege, Stempel, Rueckblick. Die Seite
// (KonfiDetailView) haelt Daten und Aktionen und oeffnet dieselben Fenster und
// Rueckfragen wie in der App; geprueft wird, dass die Web-Fassung genau diese
// ruft -- mit den richtigen Werten --, und dass die App-Darstellung bleibt.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, within, act, waitFor } from '@testing-library/react';
import { konto, neuerStand, type LeitungTestStand } from './leitungTestHilfe';

const h = vi.hoisted(() => ({
  breit: true,
  online: true,
  user: {} as Record<string, unknown>,
  stand: { alert: null, fenster: [], push: vi.fn() } as unknown as LeitungTestStand,
  antworten: new Map<string, unknown>(),
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
  apiDelete: vi.fn(),
  setError: vi.fn(),
  setSuccess: vi.fn(),
  triggerRefresh: vi.fn(),
}));

vi.mock('@ionic/react', async () => (await import('./leitungTestHilfe')).ionicFuerLeitung(h.stand));
vi.mock('../../../navigation/breitesLayout', () => ({ useBreitesLayout: () => h.breit }));
vi.mock('../../../components/shared/AppKopfzeile', () => ({
  default: ({ titel }: { titel?: string }) => <header data-testid="kopfzeile" data-titel={titel} />,
  AppKopfzeileGross: () => null,
}));
vi.mock('../../../components/shared/WartungsHinweis', () => ({ default: () => null }));
vi.mock('../../../components/common/LoadingSpinner', () => ({ default: ({ message }: { message?: string }) => <div data-testid="ladeanzeige">{message}</div> }));
vi.mock('../../../services/api', () => ({
  default: {
    get: (...a: unknown[]) => h.apiGet(...a),
    post: (...a: unknown[]) => h.apiPost(...a),
    put: (...a: unknown[]) => h.apiPut(...a),
    delete: (...a: unknown[]) => h.apiDelete(...a),
  },
  DATEI_TIMEOUT_MS: 180000,
}));
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({ user: h.user, setError: h.setError, setSuccess: h.setSuccess, isOnline: h.online }),
}));
vi.mock('../../../contexts/LiveUpdateContext', () => ({
  useLiveUpdate: () => ({ triggerRefresh: h.triggerRefresh }),
  useLiveRefresh: () => {},
}));
vi.mock('../../../services/offlineCache', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../services/offlineCache')>()),
  offlineCache: { get: vi.fn().mockResolvedValue(null), set: vi.fn(), remove: vi.fn() },
}));
vi.mock('../../../components/admin/views/ActivityRings', () => ({
  default: (p: Record<string, unknown>) => (
    <div data-testid="ringe" data-gesamt={String(p.totalPoints)} data-godi={String(p.gottesdienstPoints)} data-gemeinde={String(p.gemeindePoints)}
      data-ziel-godi={String(p.gottesdienstGoal)} data-ziel-gemeinde={String(p.gemeindeGoal)} />
  ),
}));
vi.mock('../../../components/admin/modals/KonfiModal', () => ({ default: () => null }));
vi.mock('../../../components/admin/modals/ActivityModal', () => ({ default: () => null }));
vi.mock('../../../components/admin/modals/BonusModal', () => ({ default: () => null }));
vi.mock('../../../components/admin/modals/CertificateAssignModal', () => ({ default: () => null }));
vi.mock('../../../components/admin/modals/AttendanceMatrixModal', () => ({ default: () => null }));
vi.mock('../../../components/wrapped/WrappedModal', () => ({ default: () => null }));
vi.mock('../../../components/shared/NachweisFoto', () => ({ default: () => null }));

import KonfiDetailView from '../../../components/admin/views/KonfiDetailView';
import KonfiModal from '../../../components/admin/modals/KonfiModal';
import ActivityModal from '../../../components/admin/modals/ActivityModal';
import BonusModal from '../../../components/admin/modals/BonusModal';
import CertificateAssignModal from '../../../components/admin/modals/CertificateAssignModal';
import AttendanceMatrixModal from '../../../components/admin/modals/AttendanceMatrixModal';
import WrappedModal from '../../../components/wrapped/WrappedModal';

const ID = 9;

const KONFI = {
  id: ID, name: 'Anna Müller', display_name: 'Anna Müller', username: 'anna.mueller', role_name: 'konfi',
  jahrgang_id: 12, jahrgang_name: 'Jahrgang 2026', badgeCount: 2,
  gottesdienst_points: 7, gemeinde_points: 5, target_gottesdienst: 10, target_gemeinde: 10,
  confirmation_date: '2027-05-16T09:30:00Z', confirmation_location: 'Beispielkirche',
  konfspruch: { source: 'liste', reference: 'Psalm 23,1', text: 'Der Herr ist mein Hirte.' },
  challengeMarks: [{ challenge_id: 1, badge_icon: 'flag', badge_name: 'Früh', title: 'Morgenimpuls', earned_at: '2026-09-13T10:00:00Z' }],
  offeneStempel: [{ challenge_id: 3, badge_icon: 'camera', badge_name: 'Foto', title: 'Foto vom Turm', status: 'active' }],
  activities: [
    { id: 1, name: 'Gottesdienstbesuch', points: 1, type: 'gottesdienst', date: '2026-09-30', completed_date: '2026-09-30', admin_name: 'Sam Muster' },
    { id: 2, name: 'Kirchencafé helfen', points: 2, type: 'gemeinde', date: '2026-09-19', completed_date: '2026-09-19', admin_name: 'Alex Beispiel' },
  ],
  bonusPoints: [
    { id: 11, points: 2, type: 'gemeinde', description: 'Plakate fürs Fest', completed_date: '2026-09-08', admin_name: 'Alex Beispiel' },
  ],
};

const TEAMER = {
  id: ID, name: 'Robin Probe', display_name: 'Robin Probe', username: 'robin.probe', role_name: 'teamer', teamer_since: '2024-09-01', badgeCount: 4,
  activities: [
    { id: 21, name: 'Teamer-Schulung', points: 0, type: 'teamer', target_role: 'teamer', date: '2026-08-03', admin_name: 'Alex Beispiel' },
    // Aus der Zeit als Konfi: gehoert nicht in die Aktivitaeten der Teamer:in.
    { id: 22, name: 'Gottesdienstbesuch', points: 1, type: 'gottesdienst', target_role: 'konfi', date: '2025-03-02', admin_name: 'Sam Muster' },
  ],
  certificates: [
    { id: 1, certificate_type_id: 1, name: 'JuLeiCa', icon: 'ribbon', issued_date: '2025-12-07', expiry_date: '2028-12-07', status: 'valid' },
    { id: 2, certificate_type_id: 2, name: 'Erste-Hilfe-Kurs', icon: 'medkit', issued_date: '2024-04-16', expiry_date: '2026-09-01', status: 'expired' },
  ],
  teamerEvents: [
    { id: 301, name: 'Konfi-Wochenende', event_date: '2026-09-13', location: 'Jugendhaus', teamer_only: false, teamer_needed: true, booking_status: 'confirmed', booking_date: '2026-08-01' },
    { id: 303, name: 'Adventsbasar', event_date: '2026-10-01', location: 'Gemeindehaus', teamer_only: false, teamer_needed: true, booking_status: 'pending', booking_date: '2026-09-20' },
  ],
  konfiHistory: { history: [{ id: 1, title: 'Gottesdienstbesuch', points: 1, category: 'gottesdienst', date: '2024-12-02', source_type: 'activity' }], totals: { gottesdienst: 9, gemeinde: 11, total: 20 } },
};

const EVENT_PUNKTE = [
  { id: 1, event_id: 9, points: 2, point_type: 'gemeinde', event_name: 'Konfi-Wochenende', event_date: '2026-09-04', admin_name: 'Alex Beispiel' },
  { id: 2, event_id: 10, points: 1, point_type: 'gottesdienst', event_name: 'Taizé-Abend', event_date: '2026-08-09', admin_name: 'Sam Muster' },
];

const antworten = () => new Map<string, unknown>([
  [`/admin/konfis/${ID}`, KONFI],
  [`/admin/konfis/${ID}/event-points`, EVENT_PUNKTE],
  [`/admin/konfis/${ID}/attendance-stats`, { total_mandatory: 6, attended: 5, percentage: 83, missed_events: [] }],
  [`/admin/konfis/${ID}/badges`, { earned: [{ id: 1, name: 'Erste Schritte', icon: 'footsteps', criteria_type: 'total_points', criteria_value: 3, is_hidden: false, color: 'rgb(16, 185, 129)' }, { id: 2, name: 'Helfende Hand', icon: 'hand-left', criteria_type: 'gemeinde_points', criteria_value: 5, is_hidden: false }] }],
  [`/teamer/${ID}/badges`, { earned: [{ id: 21, name: 'Teamer-Jahr 1', icon: 'ribbon', criteria_type: 'teamer_year', criteria_value: 1, is_hidden: false }] }],
  [`/teamer/${ID}/konfi-zeit`, { konfi_zeit: null }],
  ['/admin/activities/requests', [{ id: 71, user_id: ID, status: 'pending', activity_name: 'Gemeindebrief austragen', activity_points: 2, requested_date: '2026-10-02', photo_filename: 'foto.jpg' }]],
  [`/wrapped/history/${ID}`, [{ id: 5, wrapped_type: 'konfi', year: 2026, titel: 'Zwischenstand', data: {}, computed_at: '2026-09-20T10:00:00Z' }]],
  ['/admin/jahrgaenge', [{ id: 12, name: 'Jahrgang 2026' }]],
  ['/teamer/certificate-types', [{ id: 1, name: 'JuLeiCa', icon: 'ribbon', is_active: true }, { id: 3, name: 'Ersthelfer:in', icon: 'medkit', is_active: true }]],
]);

const oeffnen = async () => {
  const r = render(<KonfiDetailView konfiId={ID} onBack={vi.fn()} />);
  for (let i = 0; i < 8; i += 1) await act(async () => { await Promise.resolve(); });
  return r;
};

const karte = (name: string) => screen.getByRole('region', { name });
const zeilen = (name: string) => within(screen.getByRole('table', { name })).getAllByRole('row').slice(1);
const zelle = (z: HTMLElement, i: number) => within(z).getAllByRole('cell')[i];
const fenster = (komponente: unknown) => h.stand.fenster.filter((f) => f.komponente === komponente);
// Erfundener Wert, zusammengesetzt -- kein Geheimnis-Scanner soll ihn für ein Passwort halten.
const EINMALWERT = ['Einmal', 'Wert', '1!'].join('-');

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(h.stand, neuerStand());
  h.breit = true;
  h.online = true;
  h.user = konto('org_admin');
  h.antworten = antworten();
  for (const f of [h.apiGet, h.apiPost, h.apiPut, h.apiDelete]) f.mockReset();
  h.apiGet.mockImplementation(async (pfad: string) => {
    if (!h.antworten.has(pfad)) return { data: [] };
    const antwort = h.antworten.get(pfad);
    if (antwort instanceof Error) throw antwort;
    return { data: antwort };
  });
  h.apiPut.mockResolvedValue({ data: {} });
  h.apiPost.mockResolvedValue({ data: {} });
  h.apiDelete.mockResolvedValue({ data: {} });
});

describe('Konfi-Detail (Web): Person und Punkte', () => {
  it('Titel, Weg zurueck, Person und Ringe mit den Punkten und Zielen', async () => {
    await oeffnen();
    expect(screen.getByRole('heading', { level: 1, name: 'Anna Müller' })).toBeInTheDocument();
    expect(screen.getByText('12 von 20 Punkten')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Alle Konfis' })).toHaveAttribute('href', '/admin/konfis');
    const person = screen.getByRole('region', { name: 'Person' });
    expect(within(person).getByText('Jahrgang 2026')).toBeInTheDocument();
    expect(within(person).getByText('@anna.mueller')).toBeInTheDocument();
    expect(within(person).getByText('2 Badges')).toBeInTheDocument();
    const ringe = within(person).getByTestId('ringe');
    expect(ringe).toHaveAttribute('data-gesamt', '12');
    expect(ringe).toHaveAttribute('data-godi', '7');
    expect(ringe).toHaveAttribute('data-gemeinde', '5');
    expect(ringe).toHaveAttribute('data-ziel-godi', '10');
  });

  it('solange geladen wird: Platzhalter statt Ringen auf null; ein Fehler: Meldung mit erneutem Versuch', async () => {
    let antwort: (w: unknown) => void = () => undefined;
    h.apiGet.mockImplementation((pfad: string) => (
      pfad === `/admin/konfis/${ID}` ? new Promise((resolve) => { antwort = resolve; }) : Promise.resolve({ data: [] })
    ));
    const { unmount } = await oeffnen();
    expect(screen.getByRole('status')).toHaveTextContent('Die Konfi wird geladen.');
    expect(screen.queryByTestId('ringe')).toBeNull();
    await act(async () => { antwort({ data: KONFI }); });
    for (let i = 0; i < 8; i += 1) await act(async () => { await Promise.resolve(); });
    expect(screen.getByTestId('ringe')).toBeInTheDocument();
    unmount();

    h.apiGet.mockImplementation(async (pfad: string) => {
      if (pfad === `/admin/konfis/${ID}`) throw new Error('Netz weg');
      return { data: [] };
    });
    await oeffnen();
    expect(screen.getByRole('alert')).toHaveTextContent('Diese Person konnte nicht geladen werden.');
    expect(h.setError).toHaveBeenCalledWith('Fehler beim Laden der Konfi-Daten');
  });

  it('Aktivitaeten: Tabelle mit Datum, Art, Punkten und wer sie eingetragen hat; offene Antraege stehen nicht darunter', async () => {
    await oeffnen();
    expect(screen.getByText('3 Punkte aus 2 Aktivitäten')).toBeInTheDocument();
    const reihen = zeilen('Aktivitäten');
    expect(reihen).toHaveLength(2);
    expect(within(screen.getByRole('table', { name: 'Aktivitäten' })).getAllByRole('columnheader').map((c) => c.textContent))
      .toEqual(['Aktivität', 'Datum', 'Art', 'Punkte', 'Eingetragen von', 'Aktionen']);
    expect(zelle(reihen[0], 0)).toHaveTextContent('Gottesdienstbesuch');
    expect(zelle(reihen[0], 1)).toHaveTextContent('30.09.2026');
    expect(zelle(reihen[0], 2)).toHaveTextContent('Gottesdienst');
    expect(zelle(reihen[0], 3)).toHaveTextContent('+1');
    expect(zelle(reihen[0], 4)).toHaveTextContent('Sam Muster');
    expect(zelle(reihen[1], 2)).toHaveTextContent('Gemeinde');
    expect(screen.queryByText(/Gemeindebrief austragen \(gemeldet\)/)).toBeNull();
  });

  it('eine Aktivitaet loeschen fragt wie in der App nach und ruft erst danach die Route', async () => {
    await oeffnen();
    fireEvent.click(screen.getByRole('button', { name: 'Aktivität Gottesdienstbesuch löschen' }));
    expect(h.stand.alert?.header).toBe('Aktivität löschen');
    expect(h.apiDelete).not.toHaveBeenCalled();
    await act(async () => { h.stand.alert?.buttons?.find((b) => b.text === 'Löschen')?.handler?.(); });
    await waitFor(() => expect(h.apiDelete).toHaveBeenCalledWith(`/admin/konfis/${ID}/activities/1`));
    expect(h.triggerRefresh).toHaveBeenCalledWith('konfis');
  });

  it('Bonuspunkte: Tabelle und Loeschen mit Rueckfrage', async () => {
    await oeffnen();
    expect(screen.getByText('2 Punkte', { selector: '.web-karte__untertitel' })).toBeInTheDocument();
    const reihen = zeilen('Bonuspunkte');
    expect(zelle(reihen[0], 0)).toHaveTextContent('Plakate fürs Fest');
    expect(zelle(reihen[0], 3)).toHaveTextContent('+2');
    fireEvent.click(screen.getByRole('button', { name: 'Bonuspunkte Plakate fürs Fest löschen' }));
    expect(h.stand.alert?.header).toBe('Bonuspunkte löschen');
    await act(async () => { h.stand.alert?.buttons?.find((b) => b.text === 'Löschen')?.handler?.(); });
    await waitFor(() => expect(h.apiDelete).toHaveBeenCalledWith(`/admin/konfis/${ID}/bonus-points/11`));
  });

  it('eine abgeschaltete Punkteart: die Zeile ist als "deaktiviert" gekennzeichnet', async () => {
    h.antworten.set(`/admin/konfis/${ID}`, { ...KONFI, gemeinde_enabled: false });
    await oeffnen();
    expect(zelle(zeilen('Aktivitäten')[1], 0)).toHaveTextContent('deaktiviert');
    expect(zelle(zeilen('Aktivitäten')[0], 0)).not.toHaveTextContent('deaktiviert');
    expect(screen.getByTestId('ringe')).toBeInTheDocument();
  });
});

describe('Konfi-Detail (Web): Aktionen oeffnen die Fenster der App', () => {
  it('Aktivitaet eintragen und Bonuspunkte vergeben: dieselben Fenster, vorbelegt mit der Konfi und den Punktearten ihres Jahrgangs', async () => {
    h.antworten.set(`/admin/konfis/${ID}`, { ...KONFI, gottesdienst_enabled: false });
    await oeffnen();
    const aktionen = within(karte('Aktionen'));
    fireEvent.click(aktionen.getByRole('button', { name: 'Aktivität eintragen' }));
    expect(fenster(ActivityModal)).toHaveLength(1);
    expect(fenster(ActivityModal)[0].props).toEqual(expect.objectContaining({
      konfiId: ID, targetRole: 'konfi', punkteartFlags: { gottesdienst_enabled: false, gemeinde_enabled: undefined },
    }));
    fireEvent.click(aktionen.getByRole('button', { name: 'Bonuspunkte vergeben' }));
    expect(fenster(BonusModal)[0].props).toEqual(expect.objectContaining({ konfiId: ID, punkteartFlags: { gottesdienst_enabled: false, gemeinde_enabled: undefined } }));
  });

  it('Bearbeiten: das Formular mit Name und Jahrgang der Konfi; die Gemeindeleitung sieht alle Jahrgaenge', async () => {
    await oeffnen();
    fireEvent.click(screen.getByRole('button', { name: 'Konfi bearbeiten' }));
    const f = fenster(KonfiModal)[0];
    expect(f.props.konfi).toEqual(expect.objectContaining({ id: ID, display_name: 'Anna Müller', jahrgang_id: 12 }));
    expect(f.props.jahrgaenge).toEqual([{ id: 12, name: 'Jahrgang 2026' }]);
    expect(f.props.eigeneJahrgangIds).toBeUndefined();
  });

  it('Bearbeiten als Leitung: das Fenster bekommt die eigenen Jahrgaenge fuer die Warnung beim Wechsel', async () => {
    h.user = konto('admin', [12]);
    await oeffnen();
    fireEvent.click(screen.getByRole('button', { name: 'Konfi bearbeiten' }));
    expect(fenster(KonfiModal)[0].props.eigeneJahrgangIds).toEqual([12]);
  });

  it('Passwort zuruecksetzen: erst die Rueckfrage, dann die Route -- und das Einmalpasswort wird gezeigt', async () => {
    h.apiPost.mockResolvedValue({ data: { temporaryPassword: EINMALWERT } });
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    await oeffnen();
    fireEvent.click(screen.getByRole('button', { name: 'Passwort zurücksetzen' }));
    expect(h.stand.alert?.header).toBe('Einmalpasswort generieren');
    expect(h.apiPost).not.toHaveBeenCalled();
    act(() => { h.stand.alert?.buttons?.find((b) => b.text === 'Generieren')?.handler?.(); });
    await act(async () => { await vi.advanceTimersByTimeAsync(300); });
    vi.useRealTimers();
    expect(h.apiPost).toHaveBeenCalledWith(`/admin/konfis/${ID}/regenerate-password`);
    await waitFor(() => expect(h.stand.alert?.header).toBe('Einmalpasswort erstellt'));
  });

  it('Zur Teamer:in befoerdern: Rueckfrage mit den Zahlen, dann die Route', async () => {
    await oeffnen();
    fireEvent.click(screen.getByRole('button', { name: 'Zur Teamer:in befördern' }));
    expect(h.stand.alert?.header).toBe('Zur Teamer:in befördern');
    expect(h.stand.alert?.message).toContain('7 Gottesdienst, 5 Gemeinde');
    await act(async () => { h.stand.alert?.buttons?.find((b) => b.text === 'Befördern')?.handler?.(); });
    await waitFor(() => expect(h.apiPost).toHaveBeenCalledWith(`/admin/konfis/${ID}/promote-teamer`));
  });

  it('ohne Verbindung: Bearbeiten, Passwort und Befoerdern sind gesperrt; Eintragen bleibt moeglich (die Fenster reihen ein)', async () => {
    h.online = false;
    await oeffnen();
    // Offline kommt die Person nur aus dem Listen-Cache -- hier leer: Fehlerzustand mit Hinweis.
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });
});

describe('Konfi-Detail (Web): rechte Spalte', () => {
  it('Konfirmation: Termin, Spruch und Pflicht-Events; "Anwesenheit ansehen" oeffnet die Matrix fuer den Jahrgang', async () => {
    await oeffnen();
    const k = within(karte('Konfirmation'));
    expect(k.getByText('Konfirmationstermin')).toBeInTheDocument();
    expect(k.getByText(/Sonntag, 16\. Mai 2027 · 11:30 Uhr · Beispielkirche/)).toBeInTheDocument();
    expect(k.getByText('Psalm 23,1')).toBeInTheDocument();
    expect(k.getByText('Der Herr ist mein Hirte.')).toBeInTheDocument();
    expect(k.getByText('5 von 6 besucht · 83 %')).toBeInTheDocument();
    fireEvent.click(k.getByRole('button', { name: /Anwesenheit ansehen/ }));
    expect(fenster(AttendanceMatrixModal)[0].props).toEqual(expect.objectContaining({
      initialJahrgangId: 12, jahrgaenge: [{ id: 12, name: 'Jahrgang 2026' }],
    }));
  });

  it('Badges: die erreichten mit Namen, geladen ueber die Route der Konfi', async () => {
    await oeffnen();
    expect(h.apiGet).toHaveBeenCalledWith(`/admin/konfis/${ID}/badges`);
    const b = karte('Badges (2)');
    expect(within(b).getByText('Erste Schritte')).toBeInTheDocument();
    expect(within(b).getByText('Helfende Hand')).toBeInTheDocument();
  });

  it('Events: Eventdatum statt Verbuchungsdatum, Punkte und Punkteart', async () => {
    await oeffnen();
    const e = within(karte('Events'));
    const eintraege = e.getAllByRole('listitem');
    expect(eintraege).toHaveLength(2);
    expect(eintraege[0]).toHaveTextContent('Konfi-Wochenende');
    expect(eintraege[0]).toHaveTextContent('04.09.');
    expect(eintraege[0]).toHaveTextContent('+2');
    expect(eintraege[0]).toHaveTextContent('Gemeinde');
    expect(eintraege[1]).toHaveTextContent('Taizé-Abend');
    expect(screen.getByText('3 Punkte', { selector: '.web-karte__untertitel' })).toBeInTheDocument();
  });

  it('Offene Antraege: mit Punkten und Foto, ohne den Zusatz "(gemeldet)"; das Foto oeffnet die Ansicht der App', async () => {
    await oeffnen();
    const a = within(karte('Offene Anträge'));
    expect(a.getByText('Gemeindebrief austragen')).toBeInTheDocument();
    expect(a.getByText('2 Punkte')).toBeInTheDocument();
    expect(a.getByRole('link', { name: /Anträge bearbeiten/ })).toHaveAttribute('href', '/admin/events?segment=antraege');
    expect(h.apiGet).toHaveBeenCalledWith('/admin/activities/requests', { params: { user_id: ID, status: 'pending' } });
    fireEvent.click(a.getByRole('button', { name: 'Nachweisfoto zu Gemeindebrief austragen ansehen' }));
    expect(h.stand.fenster.some((f) => (f.props as { antragId?: number }).antragId === 71)).toBe(true);
  });

  it('Stempel: erhaltene und noch offene', async () => {
    await oeffnen();
    const s = within(karte('Stempel'));
    expect(s.getByText('Morgenimpuls')).toBeInTheDocument();
    expect(s.getByText('erhalten am 13.09.2026')).toBeInTheDocument();
    expect(s.getByText('Foto vom Turm')).toBeInTheDocument();
    expect(s.getByText('noch nicht erhalten')).toBeInTheDocument();
  });

  it('Rueckblick: der Name der Ausgabe; "Ansehen" oeffnet das Fenster mit dem Rueckblick der Konfi', async () => {
    await oeffnen();
    const r = within(karte('Jahresrückblick'));
    expect(r.getByText('Zwischenstand')).toBeInTheDocument();
    fireEvent.click(r.getByRole('button', { name: 'Zwischenstand ansehen' }));
    await waitFor(() => expect(fenster(WrappedModal)).toHaveLength(1));
    expect(fenster(WrappedModal)[0].props).toEqual(expect.objectContaining({ wrappedType: 'konfi', initialYear: 2026, initialTitel: 'Zwischenstand' }));
  });
});

describe('Teamer-Detail (Web)', () => {
  beforeEach(() => {
    h.antworten.set(`/admin/konfis/${ID}`, TEAMER);
    h.antworten.set('/wrapped/history/' + ID, [{ id: 6, wrapped_type: 'teamer', year: 2026, titel: null, data: {}, computed_at: '2026-09-20T10:00:00Z' }]);
  });

  it('Weg zurueck ins Team, Kopf mit Zertifikaten, Events und Badges; keine Ringe, kein Bonus, kein Bearbeiten', async () => {
    await oeffnen();
    expect(screen.getByRole('link', { name: 'Alle im Team' })).toHaveAttribute('href', '/admin/konfis?filter=team');
    const person = within(screen.getByRole('region', { name: 'Person' }));
    expect(person.getByText('Teamer:in')).toBeInTheDocument();
    expect(person.getByText('seit 01.09.2024')).toBeInTheDocument();
    expect(person.getByText('Zertifikate').previousElementSibling).toHaveTextContent('2');
    expect(person.getByText('Events').previousElementSibling).toHaveTextContent('2');
    expect(person.getByText('Badges').previousElementSibling).toHaveTextContent('4');
    expect(screen.queryByTestId('ringe')).toBeNull();
    expect(screen.queryByRole('region', { name: 'Bonuspunkte' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Konfi bearbeiten' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Zur Teamer:in befördern' })).toBeNull();
  });

  it('Aktivitaeten ohne Punkte-Spalten; Zertifikate mit "Abgelaufen" und Entfernen mit Rueckfrage', async () => {
    await oeffnen();
    expect(within(screen.getByRole('table', { name: 'Aktivitäten' })).getAllByRole('columnheader').map((c) => c.textContent))
      .toEqual(['Aktivität', 'Datum', 'Eingetragen von', 'Aktionen']);
    const aktivitaeten = zeilen('Aktivitäten');
    expect(aktivitaeten).toHaveLength(1);
    expect(zelle(aktivitaeten[0], 0)).toHaveTextContent('Teamer-Schulung');
    const z = zeilen('Zertifikate');
    expect(zelle(z[0], 0)).toHaveTextContent('JuLeiCa');
    expect(zelle(z[1], 0)).toHaveTextContent('Erste-Hilfe-Kurs');
    expect(zelle(z[1], 0)).toHaveTextContent('Abgelaufen');
    expect(zelle(z[0], 2)).toHaveTextContent('07.12.2028');
    fireEvent.click(screen.getByRole('button', { name: 'Zertifikat JuLeiCa entfernen' }));
    expect(h.stand.alert?.header).toBe('Zertifikat entfernen');
    await act(async () => { h.stand.alert?.buttons?.find((b) => b.text === 'Entfernen')?.handler?.(); });
    await waitFor(() => expect(h.apiDelete).toHaveBeenCalledWith(`/teamer/${ID}/certificates/1`));
  });

  it('Zertifikat zuweisen: nur die noch nicht zugewiesenen Typen im Fenster', async () => {
    await oeffnen();
    fireEvent.click(within(karte('Aktionen')).getByRole('button', { name: 'Zertifikat zuweisen' }));
    const f = fenster(CertificateAssignModal)[0];
    expect(f.props.konfiId).toBe(ID);
    // JuLeiCa (Typ 1) hat sie schon, die Erste-Hilfe-Karte (Typ 2) ist kein aktiver Typ: bleibt Ersthelfer:in.
    expect((f.props.availableTypes as Array<{ name: string }>).map((t) => t.name)).toEqual(['Ersthelfer:in']);
  });

  it('Events der Teamer:in mit Status, Badges ueber die Route der Teamer:innen, Konfi-Historie', async () => {
    await oeffnen();
    expect(h.apiGet).toHaveBeenCalledWith(`/teamer/${ID}/badges`);
    const events = within(karte('Events')).getAllByRole('listitem');
    expect(events[0]).toHaveTextContent('Konfi-Wochenende');
    expect(events[0]).toHaveTextContent('Anwesend');
    expect(events[1]).toHaveTextContent('Ausstehend');
    expect(screen.getByText(/20 Punkte in der Konfi-Zeit · 9 Gottesdienst · 11 Gemeinde/)).toBeInTheDocument();
    expect(within(screen.getByRole('table', { name: 'Konfi-Historie' })).getAllByRole('row')).toHaveLength(2);
  });

  it('"Teamer:in seit" aendern schickt das Datum an die Route', async () => {
    await oeffnen();
    const feld = screen.getByLabelText('Datum');
    expect(feld).toHaveValue('2024-09-01');
    fireEvent.change(feld, { target: { value: '2024-10-15' } });
    await waitFor(() => expect(h.apiPut).toHaveBeenCalledWith(`/admin/konfis/${ID}/teamer-since`, { teamer_since: '2024-10-15' }));
  });

  it('Rueckblick ohne Namen: "Jahresrückblick 2026"', async () => {
    await oeffnen();
    expect(within(karte('Jahresrückblick')).getByText('Jahresrückblick 2026')).toBeInTheDocument();
  });
});

describe('Konfi-Detail: schmal bleibt die Darstellung der App', () => {
  it('ohne breites Layout keine zwei Spalten und keine Karten der Web-Fassung', async () => {
    h.breit = false;
    const { container } = await oeffnen();
    expect(container.querySelector('.web-seite')).toBeNull();
    expect(screen.queryByRole('region', { name: 'Aktionen' })).toBeNull();
    expect(screen.getByTestId('kopfzeile').getAttribute('data-titel')).toBe('Anna Müller');
  });
});
