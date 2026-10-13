// Detailseite einer Konfi im Browser nach dem Seiten-Interview mit Simon
// (13.10.2026), gerendert mit der echten Seite (KonfiDetailView ->
// WebKonfiDetail -> WebKonfiKarten). Kopf und rechte Spalte bleiben, wie sie
// sind; links:
//
//   1. Aktivitaeten, Events und Bonuspunkte tragen vorn den Kreis ihrer
//      Punkteart -- dasselbe Symbol wie in der App, Gottesdienst blau,
//      Gemeinde gruen, Events rot, Bonus orange („color coded entsprechend
//      ihrer kategorien").
//   2. Eine verbuchte Aktivitaet mit Antrag oeffnet ihn („klick auf eine
//      aktivitaet sollte den antrag oeffnen") -- im Dialog der entschiedenen
//      Antraege (WebAntragPruefenDialog, „Aktivität ansehen"). Ohne Antrag
//      (von der Leitung eingetragen) kein Klick.
//   3. Die Events sind EINE Tabelle („das soll eine liste sein"): alle Termine
//      aus `alleTermine`, Offenes oben, Pflicht gekennzeichnet, Anwesend /
//      Nicht anwesend in der Zeile.
//   4. Ein Event fuehrt mit Rueckweg zur Person (?person=; die Eventseite
//      selbst: termineWeb/webTerminDetailRueckweg.test.tsx).
//
// Ionic ist wie in webKonfiDetail.test.tsx nachgestellt -- nur IonIcon
// zeigt hier sein Symbol (data-symbol), damit der Kreis pruefbar ist.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import fs from 'node:fs';
import path from 'node:path';
import { render, screen, fireEvent, within, act, waitFor } from '@testing-library/react';
import { konto, neuerStand, type LeitungTestStand } from './leitungTestHilfe';
import {
  ICON_ABZEICHEN_GEFUELLT,
  ICON_AKTION_GEFUELLT,
  ICON_BONUS_GEFUELLT,
  ICON_GOTTESDIENST_GEFUELLT,
  ICON_PODIUM,
} from '../../../components/shared/icons';

const h = vi.hoisted(() => ({
  online: true,
  user: {} as Record<string, unknown>,
  stand: { alert: null, fenster: [], push: vi.fn() } as unknown as LeitungTestStand,
  antworten: new Map<string, unknown>(),
  apiGet: vi.fn(),
  apiPut: vi.fn(),
  setError: vi.fn(),
  setSuccess: vi.fn(),
  triggerRefresh: vi.fn(),
}));

vi.mock('@ionic/react', async () => ({
  ...(await (await import('./leitungTestHilfe')).ionicFuerLeitung(h.stand)),
  IonIcon: ({ icon }: { icon?: string }) => <span data-symbol={icon} />,
}));
vi.mock('../../../navigation/breitesLayout', () => ({ useBreitesLayout: () => true }));
vi.mock('../../../components/shared/AppKopfzeile', () => ({ default: () => null, AppKopfzeileGross: () => null }));
vi.mock('../../../components/shared/WartungsHinweis', () => ({ default: () => null }));
vi.mock('../../../services/api', () => ({
  default: {
    get: (...a: unknown[]) => h.apiGet(...a),
    post: vi.fn().mockResolvedValue({ data: {} }),
    put: (...a: unknown[]) => h.apiPut(...a),
    delete: vi.fn().mockResolvedValue({ data: {} }),
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
  offlineCache: { get: vi.fn().mockResolvedValue(null), set: vi.fn().mockResolvedValue(undefined), remove: vi.fn() },
}));
vi.mock('../../../components/admin/modals/KonfiModal', () => ({ default: () => null }));
vi.mock('../../../components/admin/modals/ActivityModal', () => ({ default: () => null }));
vi.mock('../../../components/admin/modals/BonusModal', () => ({ default: () => null }));
vi.mock('../../../components/admin/modals/CertificateAssignModal', () => ({ default: () => null }));
vi.mock('../../../components/admin/modals/AttendanceMatrixModal', () => ({ default: () => null }));
vi.mock('../../../components/wrapped/WrappedModal', () => ({ default: () => null }));
vi.mock('../../../components/shared/NachweisFoto', () => ({
  default: ({ antragId }: { antragId: number }) => <img alt="Foto zur Aktivität" data-antrag={antragId} />,
}));

import KonfiDetailView from '../../../components/admin/views/KonfiDetailView';

const ID = 9;

const KONFI = {
  id: ID, name: 'Anna Müller', display_name: 'Anna Müller', username: 'anna.mueller', role_name: 'konfi',
  jahrgang_id: 12, jahrgang_name: 'Jahrgang 2026', badgeCount: 0,
  gottesdienst_points: 3, gemeinde_points: 2, target_gottesdienst: 10, target_gemeinde: 10,
  challengeMarks: [], offeneStempel: [],
  activities: [
    // Aus dem Antrag 71 entstanden (Migration 214).
    { id: 1, name: 'Gottesdienstbesuch', points: 1, type: 'gottesdienst', date: '2026-09-30', completed_date: '2026-09-30', admin_name: 'Sam Muster', request_id: 71 },
    // Von der Leitung eingetragen: kein Antrag.
    { id: 2, name: 'Kirchencafé helfen', points: 2, type: 'gemeinde', date: '2026-09-19', completed_date: '2026-09-19', admin_name: 'Alex Beispiel', request_id: null },
  ],
  bonusPoints: [
    { id: 11, points: 2, type: 'gemeinde', description: 'Plakate fürs Fest', completed_date: '2026-09-08', admin_name: 'Alex Beispiel' },
  ],
};

const TAG = 24 * 60 * 60 * 1000;
const tage = (n: number) => new Date(Date.now() + n * TAG).toISOString();

/** Ein Eintrag aus `alleTermine` (GET /admin/konfis/:id, seit 13.10.2026). */
const termin = (zusatz: Record<string, unknown>) => ({
  booking_id: null, event_id: 0, event_name: '', event_date: tage(-1), location: null,
  mandatory: false, is_konfirmation: false, cancelled: false,
  booking_status: 'confirmed', attendance_status: null, art: 'erledigt', darf_verbuchen: true,
  darf_oeffnen: true, points: 0, point_type: null, points_von: null,
  ...zusatz,
});

// Bewusst NICHT in Anzeige-Reihenfolge: Ordnen ist Sache der Seite.
const ALLE_TERMINE = [
  termin({ booking_id: 510, event_id: 50, event_name: 'Pflicht-Gottesdienst', event_date: tage(-20), mandatory: true, attendance_status: 'present' }),
  termin({ booking_id: 502, event_id: 42, event_name: 'Laternenumzug', event_date: tage(30), booking_status: 'waitlist', art: 'anstehend' }),
  termin({ booking_id: 511, event_id: 51, event_name: 'Konfi-Wochenende', event_date: tage(-10), attendance_status: 'present', points: 2, point_type: 'gemeinde', points_von: 'Alex Beispiel' }),
  termin({ booking_id: 501, event_id: 41, event_name: 'Konfisamstag', event_date: tage(-2), mandatory: true, art: 'verbuchen' }),
  termin({ booking_id: 512, event_id: 52, event_name: 'Jugendabend', event_date: tage(-12), attendance_status: 'absent' }),
  termin({ booking_id: 513, event_id: 53, event_name: 'Gemeindefest', event_date: tage(-15), mandatory: true, attendance_status: 'excused' }),
  termin({ booking_id: 514, event_id: 54, event_name: 'Pflicht-Treffen', event_date: tage(-25), mandatory: true, booking_status: 'opted_out' }),
  termin({ booking_id: 515, event_id: 55, event_name: 'Ausflug', event_date: tage(-5), cancelled: true, attendance_status: 'excused' }),
  termin({ booking_id: 503, event_id: 43, event_name: 'Konfirmation', event_date: tage(200), is_konfirmation: true, art: 'anstehend' }),
  termin({ booking_id: null, event_id: 56, event_name: 'Taizé-Abend', event_date: tage(-40), booking_status: null, points: 1, point_type: 'gottesdienst' }),
];

const ANTRAG_71 = {
  id: 71, konfi_id: ID, konfi_name: 'Anna Müller', jahrgang_name: 'Jahrgang 2026', activity_id: 4, activity_name: 'Gottesdienstbesuch',
  activity_type: 'gottesdienst', activity_points: 1, activity_target_role: 'konfi', requested_date: '2026-09-30',
  comment: 'Predigt über die Arbeiter im Weinberg', status: 'approved', approved_by_name: 'Sam Muster',
  created_at: '2026-09-30T18:00:00Z', updated_at: '2026-10-01T08:00:00Z', darf_entscheiden: true,
};

const antworten = () => new Map<string, unknown>([
  [`/admin/konfis/${ID}`, { ...KONFI, alleTermine: ALLE_TERMINE }],
  // Die Punkte-Route liefert weiter dasselbe; die Liste kommt aus alleTermine und zeigt nichts doppelt.
  [`/admin/konfis/${ID}/event-points`, [
    { id: 1, event_id: 51, points: 2, point_type: 'gemeinde', event_name: 'Konfi-Wochenende', event_date: tage(-10), admin_name: 'Alex Beispiel' },
  ]],
  ['/admin/activities/requests', [{ id: 72, user_id: ID, status: 'pending', activity_name: 'Gemeindebrief austragen', activity_points: 2, requested_date: '2026-10-02' }]],
  ['/admin/activities/requests/71', ANTRAG_71],
]);

const oeffnen = async () => {
  const r = render(<KonfiDetailView konfiId={ID} onBack={vi.fn()} />);
  for (let i = 0; i < 8; i += 1) await act(async () => { await Promise.resolve(); });
  return r;
};
const karte = (name: string) => screen.getByRole('region', { name });
const zeilen = (name: string) => within(screen.getByRole('table', { name })).getAllByRole('row').slice(1);
const zelle = (z: HTMLElement, i: number) => within(z).getAllByRole('cell')[i];
/** Der Kreis vor dem Namen einer Zeile: Farbe (Klasse) und Symbol. */
const kreis = (z: HTMLElement) => {
  const k = zelle(z, 0).querySelector('.web-symbol') as HTMLElement | null;
  return k ? { klasse: k.className, symbol: k.querySelector('[data-symbol]')?.getAttribute('data-symbol') } : null;
};

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(h.stand, neuerStand());
  h.online = true;
  h.user = konto('org_admin');
  h.antworten = antworten();
  h.apiGet.mockReset();
  h.apiGet.mockImplementation(async (pfad: string) => (h.antworten.has(pfad) ? { data: h.antworten.get(pfad) } : { data: [] }));
  h.apiPut.mockReset();
  h.apiPut.mockResolvedValue({ data: {} });
});

describe('1. Kreis der Punkteart vor Aktivitäten, Events und Bonuspunkten', () => {
  it('Gottesdienst blau, Gemeinde grün, Events rot, Bonus orange -- mit den Symbolen der App', async () => {
    await oeffnen();
    const [godi, gemeinde] = zeilen('Aktivitäten');
    expect(kreis(godi)).toEqual({ klasse: 'web-symbol web-symbol--gottesdienst', symbol: ICON_GOTTESDIENST_GEFUELLT });
    expect(kreis(gemeinde)).toEqual({ klasse: 'web-symbol web-symbol--gemeinde', symbol: ICON_AKTION_GEFUELLT });
    for (const z of zeilen('Events')) {
      expect(kreis(z)).toEqual({ klasse: 'web-symbol web-symbol--events', symbol: ICON_PODIUM });
    }
    expect(kreis(zeilen('Bonuspunkte')[0])).toEqual({ klasse: 'web-symbol web-symbol--bonus', symbol: ICON_BONUS_GEFUELLT });
    // Der Name steht weiter als Text in der Zelle, der Kreis ist Zierde.
    expect(zelle(godi, 0)).toHaveTextContent('Gottesdienstbesuch');
    expect(zelle(godi, 0).querySelector('.web-symbol')).toHaveAttribute('aria-hidden', 'true');
  });

  it('die vier Farben kommen aus den Tokens der App', () => {
    const css = fs.readFileSync(path.join(__dirname, '../../../theme/web-ansicht.css'), 'utf8');
    for (const [ton, token] of [['gottesdienst', 'gottesdienst'], ['gemeinde', 'gemeinde'], ['events', 'events'], ['bonus', 'bonus']]) {
      expect(css).toContain(`.web-symbol--${ton} { background: var(--app-color-${token}); }`);
    }
  });

  it('Teamer:in: ihre Aktivitäten im Kreis der Teamer-Farbe mit dem Abzeichen', async () => {
    h.antworten.set(`/admin/konfis/${ID}`, {
      ...KONFI, role_name: 'teamer', bonusPoints: [],
      activities: [{ id: 21, name: 'Teamer-Schulung', points: 0, type: 'teamer', target_role: 'teamer', date: '2026-08-03', admin_name: 'Alex Beispiel' }],
      teamerEvents: [],
    });
    await oeffnen();
    expect(kreis(zeilen('Aktivitäten')[0])).toEqual({ klasse: 'web-symbol web-symbol--teamer', symbol: ICON_ABZEICHEN_GEFUELLT });
  });

  it('offene Anträge oben behalten ihr Verhalten: Zeile über der Tabelle mit „Prüfen", ohne Kreis', async () => {
    await oeffnen();
    const offen = within(karte('Aktivitäten')).getByRole('list', { name: 'Offene Anträge' });
    expect(within(offen).getByRole('button', { name: 'Aktivität Gemeindebrief austragen prüfen' })).toBeInTheDocument();
    expect(offen.querySelector('.web-symbol')).toBeNull();
  });
});

describe('2. Klick auf eine verbuchte Aktivität öffnet ihren Antrag', () => {
  it('mit Antrag: „Aktivität ansehen" mit Datum, Kommentar und wer entschieden hat -- nichts zu entscheiden', async () => {
    await oeffnen();
    const [godi] = zeilen('Aktivitäten');
    await act(async () => { fireEvent.click(within(godi).getByRole('button', { name: 'Antrag zu Gottesdienstbesuch ansehen' })); });
    const dialog = await screen.findByRole('dialog', { name: 'Aktivität ansehen' });
    expect(h.apiGet).toHaveBeenCalledWith('/admin/activities/requests/71');
    await waitFor(() => expect(within(dialog).getByText('Predigt über die Arbeiter im Weinberg')).toBeInTheDocument());
    expect(within(dialog).getByText('Teilnahmedatum').nextElementSibling).toHaveTextContent('30.09.2026');
    expect(within(dialog).getByRole('status')).toHaveTextContent(/^Verbucht von Sam Muster am/);
    expect(within(dialog).queryByRole('button', { name: 'Genehmigen' })).toBeNull();
    expect(within(dialog).queryByRole('button', { name: 'Ablehnen' })).toBeNull();
    // Das X oben und der Knopf unten heißen beide „Schließen".
    fireEvent.click(within(dialog).getAllByRole('button', { name: 'Schließen' }).at(-1) as HTMLElement);
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(h.apiPut).not.toHaveBeenCalled();
  });

  it('ohne Antrag (von der Leitung eingetragen): kein Klick, kein Abruf', async () => {
    await oeffnen();
    const [, gemeinde] = zeilen('Aktivitäten');
    expect(within(gemeinde).queryByRole('button', { name: /Antrag zu/ })).toBeNull();
    fireEvent.click(zelle(gemeinde, 0));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(h.apiGet.mock.calls.filter(([pfad]) => /^\/admin\/activities\/requests\/\d+$/.test(String(pfad)))).toEqual([]);
  });
});

describe('3. Events: eine Liste mit allen Terminen, Pflicht gekennzeichnet', () => {
  it('Offenes oben, Anstehendes (nächstes zuerst), dann der Rest nach Datum -- mit Stand, Art und Punkten', async () => {
    await oeffnen();
    expect(within(karte('Events')).queryByRole('list', { name: 'Offene und anstehende Events' })).toBeNull();
    const e = zeilen('Events');
    expect(e.map((z) => [
      within(zelle(z, 0)).getByRole('link').textContent,
      zelle(z, 2).textContent,
      zelle(z, 3).textContent,
      zelle(z, 4).textContent,
    ])).toEqual([
      // Woerter der App (personTerminStand) fuer Offenes und Anstehendes,
      // der Teilnehmerliste (teilnahmeDarstellung) fuer den Rest -- seit der
      // Pruefung vom 13.10.2026 statt eigener Woerter ("Ausstehend",
      // "Gebucht" fuer Anstehendes, "Entschuldigt").
      ['Konfisamstag', '–', '–', 'Anwesenheit ausstehend'],
      ['Laternenumzug', '–', '–', 'Warteliste'],
      ['Konfirmation', '–', '–', 'Angemeldet'],
      ['Ausflug', '–', '–', 'Abgesagt'],
      ['Konfi-Wochenende', 'Gemeinde', '+2', 'Anwesend'],
      ['Jugendabend', '–', '–', 'Abwesend'],
      ['Gemeindefest', '–', '–', 'Abgemeldet (nachgetragen)'],
      ['Pflicht-Gottesdienst', '–', '–', 'Anwesend'],
      ['Pflicht-Treffen', '–', '–', 'Abgemeldet'],
      ['Taizé-Abend', 'Gottesdienst', '+1', 'Anwesend'],
    ]);
    // Wer die Punkte vergeben hat, steht am Punktwert.
    expect(within(zelle(e[4], 3)).getByText('+2')).toHaveAttribute('title', 'vergeben von Alex Beispiel');
    expect(karte('Events')).toHaveTextContent('10 Events · 3 Punkte');
  });

  it('Pflicht-Events tragen die Marke „Pflicht", die Konfirmation ihre eigene, alle anderen keine', async () => {
    await oeffnen();
    const marken = zeilen('Events').map((z) => [
      within(zelle(z, 0)).getByRole('link').textContent,
      [...zelle(z, 0).querySelectorAll('.web-pill')].map((p) => p.textContent),
    ]);
    expect(marken).toEqual([
      ['Konfisamstag', ['Pflicht']],
      ['Laternenumzug', []],
      ['Konfirmation', ['Konfirmation']],
      ['Ausflug', []],
      ['Konfi-Wochenende', []],
      ['Jugendabend', []],
      ['Gemeindefest', ['Pflicht']],
      ['Pflicht-Gottesdienst', ['Pflicht']],
      ['Pflicht-Treffen', ['Pflicht']],
      ['Taizé-Abend', []],
    ]);
  });

  it('Anwesend / Nicht anwesend nur am zu verbuchenden Termin; "Nicht anwesend" ruft die Route des Termins', async () => {
    await oeffnen();
    const e = zeilen('Events');
    expect(e.map((z) => within(z).queryAllByRole('button').map((b) => b.getAttribute('aria-label'))))
      .toEqual([['Konfisamstag: anwesend', 'Konfisamstag: nicht anwesend'], [], [], [], [], [], [], [], [], []]);
    await act(async () => { fireEvent.click(within(e[0]).getByRole('button', { name: 'Konfisamstag: nicht anwesend' })); });
    expect(h.apiPut).toHaveBeenCalledWith('/events/41/participants/501/attendance', { attendance_status: 'absent' });
    await waitFor(() => expect(h.triggerRefresh).toHaveBeenCalledWith('events'));
  });

  it('ein Klick auf „Stand" ordnet nach der Reihe aus statusReihenfolge.ts, Offenes zuerst', async () => {
    await oeffnen();
    const tabelle = screen.getByRole('table', { name: 'Events' });
    await act(async () => { fireEvent.click(within(within(tabelle).getByRole('columnheader', { name: /Stand/ })).getByRole('button')); });
    expect(zeilen('Events').map((z) => zelle(z, 4).textContent)).toEqual([
      'Anwesenheit ausstehend', 'Angemeldet', 'Warteliste', 'Anwesend', 'Anwesend', 'Anwesend',
      'Abwesend', 'Abgemeldet (nachgetragen)', 'Abgemeldet', 'Abgesagt',
    ]);
  });

  it('ohne Recht am Termin: der Stand steht da, die Knöpfe nicht', async () => {
    h.antworten.set(`/admin/konfis/${ID}`, {
      ...KONFI,
      alleTermine: ALLE_TERMINE.map((t) => (t.event_id === 41 ? { ...t, darf_verbuchen: false } : t)),
    });
    await oeffnen();
    const [erste] = zeilen('Events');
    expect(zelle(erste, 4)).toHaveTextContent('Anwesenheit ausstehend');
    expect(within(erste).queryAllByRole('button')).toEqual([]);
  });
});

describe('4. Ein Event führt mit Rückweg zur Person', () => {
  it('jeder Eventname ist ein Link in den Termin mit ?person=<Konfi>', async () => {
    await oeffnen();
    const links = zeilen('Events').map((z) => within(zelle(z, 0)).getByRole('link').getAttribute('href'));
    expect(links).toEqual([41, 42, 43, 55, 51, 52, 53, 50, 54, 56].map((id) => `/admin/events/${id}?person=${ID}`));
  });

  // Pruefung 13.10.2026: Event-Punkte an einem Termin, den die Leitung nicht
  // sieht (fremder Jahrgang, darf_oeffnen false), stehen in der Liste -- ein
  // Link fuehrte dort nur auf die 403-Seite des Events.
  it('Punkte an einem Termin außerhalb der eigenen Sicht: der Name steht ohne Link da', async () => {
    h.antworten.set(`/admin/konfis/${ID}`, {
      ...KONFI,
      alleTermine: [
        ALLE_TERMINE.find((t) => t.event_id === 51),
        termin({ booking_id: null, event_id: 57, event_name: 'Alter Jahrgang', event_date: tage(-60), booking_status: null, points: 2, point_type: 'gemeinde', darf_oeffnen: false }),
      ],
    });
    await oeffnen();
    const [eigener, fremder] = zeilen('Events');
    expect(within(zelle(eigener, 0)).getByRole('link', { name: 'Konfi-Wochenende' })).toHaveAttribute('href', `/admin/events/51?person=${ID}`);
    expect(zelle(fremder, 0)).toHaveTextContent('Alter Jahrgang');
    expect(within(zelle(fremder, 0)).queryByRole('link')).toBeNull();
    expect(zelle(fremder, 3)).toHaveTextContent('+2');
  });

  it('die Seite merkt sich den Namen, damit die Eventseite ihn schon beim Laden zeigt', async () => {
    const { gemerkterPersonName } = await import('../../../utils/rueckweg');
    await oeffnen();
    expect(gemerkterPersonName(ID)).toBe('Anna Müller');
  });
});
