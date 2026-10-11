// Aktivität eintragen und Bonuspunkte vergeben im Browser, gerendert (Simon,
// 11.10.2026: „Web braucht eigene kompaktere Modale überall"). Auf der
// Detailseite einer Person (KonfiDetailView) öffnen die beiden Knöpfe im
// breiten Layout eigene Dialoge der Web-Fassung (WebAktivitaetDialog,
// WebBonusDialog) statt der Modale der App; schmal bleibt es beim Modal.
//
// Die Logik ist für App und Web dieselbe (useAktivitaetEintragen,
// useBonusVergeben): Geprüft wird mit echter Logik -- nur Server, Kontext,
// Breite, Netz, Warteschlange und Ionic sind Attrappen --, dass der Dialog
// benannte Felder mit der Vorbelegung zeigt, fehlende Angaben mit einem Satz
// meldet, exakt diesen Rumpf an exakt diese Route schickt (ohne Netz: in die
// Warteschlange, Handbuch: „Ohne Netz gehen nur das Eintragen von Aktivitäten
// und Bonuspunkten"), danach die Seite neu lädt und beim Abbrechen nichts
// schickt. Die App-Modale schicken weiter denselben Rumpf.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, within, act, waitFor } from '@testing-library/react';
import { konto, neuerStand, type LeitungTestStand } from './leitungTestHilfe';

const h = vi.hoisted(() => ({
  breit: true,
  online: true,
  netz: true,
  zaehler: 0,
  user: {} as Record<string, unknown>,
  stand: { alert: null, fenster: [], push: vi.fn() } as unknown as LeitungTestStand,
  antworten: new Map<string, unknown>(),
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
  apiDelete: vi.fn(),
  enqueue: vi.fn(),
  messen: vi.fn(),
  setError: vi.fn(),
  setSuccess: vi.fn(),
  triggerRefresh: vi.fn(),
}));

vi.mock('@ionic/react', async () => ({
  ...(await (await import('./leitungTestHilfe')).ionicFuerLeitung(h.stand)),
  // Der Schieberegler der Punkte im Modal der App, als natives Feld.
  IonRange: ({ 'aria-label': label, value, onIonChange }: { 'aria-label'?: string; value?: number; onIonChange?: (e: { detail: { value: number } }) => void }) => (
    <input type="range" aria-label={label} value={value} onChange={(e) => onIonChange?.({ detail: { value: Number(e.target.value) } })} />
  ),
}));
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
// Das Netz, nach dem die Formulare zwischen Senden und Einreihen entscheiden.
vi.mock('../../../services/networkMonitor', () => ({
  networkMonitor: { get isOnline() { return h.netz; }, subscribe: vi.fn(() => () => {}), init: vi.fn() },
}));
vi.mock('../../../services/writeQueue', async (importOriginal) => {
  const echt = await importOriginal<typeof import('../../../services/writeQueue')>();
  return { ...echt, writeQueue: { ...echt.writeQueue, enqueue: (...a: unknown[]) => h.enqueue(...a) } };
});
vi.mock('../../../services/analytics', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../services/analytics')>()),
  trackHandlung: (...a: unknown[]) => h.messen(...a),
}));
// Jede Kennung eine neue: So faellt auf, wenn ein zweites Speichern eine
// andere Kennung schickte als das erste.
vi.mock('../../../utils/uuid', () => ({ safeUUID: () => { h.zaehler += 1; return `kennung-${h.zaehler}`; } }));
vi.mock('../../../components/admin/views/ActivityRings', () => ({ default: () => null }));
vi.mock('../../../components/admin/modals/KonfiModal', () => ({ default: () => null }));
vi.mock('../../../components/admin/modals/CertificateAssignModal', () => ({ default: () => null }));
vi.mock('../../../components/admin/modals/AttendanceMatrixModal', () => ({ default: () => null }));
vi.mock('../../../components/wrapped/WrappedModal', () => ({ default: () => null }));
vi.mock('../../../components/shared/NachweisFoto', () => ({ default: () => null }));

import KonfiDetailView from '../../../components/admin/views/KonfiDetailView';
import ActivityModal from '../../../components/admin/modals/ActivityModal';
import BonusModal from '../../../components/admin/modals/BonusModal';

const ID = 9;
const KONFI = {
  id: ID, name: 'Anna Müller', display_name: 'Anna Müller', username: 'anna.mueller', role_name: 'konfi',
  jahrgang_id: 12, jahrgang_name: 'Jahrgang 2026', badgeCount: 0,
  gottesdienst_points: 7, gemeinde_points: 5, target_gottesdienst: 10, target_gemeinde: 10,
  activities: [], bonusPoints: [],
};
const TEAMER = { id: ID, name: 'Robin Probe', display_name: 'Robin Probe', username: 'robin.probe', role_name: 'teamer', activities: [] };
const AKTIVITAETEN = [
  { id: 31, name: 'Gottesdienstbesuch', points: 1, type: 'gottesdienst', categories: [{ id: 1, name: 'Sonntag' }] },
  { id: 32, name: 'Kirchencafé helfen', points: 2, type: 'gemeinde', categories: [] },
  { id: 33, name: 'Adventsbasar', points: 3, type: 'gemeinde', categories: [{ id: 2, name: 'Feste' }, { id: 3, name: 'Basar' }] },
];
const TEAMER_AKTIVITAETEN = [{ id: 41, name: 'Konfi-Wochenende begleitet', points: 0, type: null, categories: [{ id: 4, name: 'Freizeit' }] }];
/** Der Server lehnt eine abgeschaltete Punkteart so ab (backend/utils/pointTypeGuard.js). */
const ABGELEHNT = Object.assign(new Error('Request failed with status code 400'), {
  response: { status: 400, data: { error: 'Gottesdienst-Punkte sind für diesen Jahrgang deaktiviert' } },
});

const antworten = () => new Map<string, unknown>([
  [`/admin/konfis/${ID}`, KONFI],
  ['/admin/activities?target_role=konfi', AKTIVITAETEN],
  ['/admin/activities?target_role=teamer', TEAMER_AKTIVITAETEN],
]);

const warten = async () => { for (let i = 0; i < 8; i += 1) await act(async () => { await Promise.resolve(); }); };
const oeffnen = async () => {
  const r = render(<KonfiDetailView konfiId={ID} onBack={vi.fn()} />);
  await warten();
  return r;
};
const kopf = () => within(screen.getByRole('heading', { level: 1 }).closest('header') as HTMLElement);
const fenster = (komponente: unknown) => h.stand.fenster.filter((f) => f.komponente === komponente);
const detailAbrufe = () => h.apiGet.mock.calls.filter(([pfad]) => pfad === `/admin/konfis/${ID}`).length;
const absenden = async (dialog: HTMLElement, knopf: string) => {
  await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: knopf })); });
  await warten();
};
const tippen = (feld: HTMLElement, wert: string) => fireEvent.change(feld, { target: { value: wert } });

const aktivitaetDialog = async () => {
  fireEvent.click(kopf().getByRole('button', { name: 'Aktivität eintragen' }));
  const dialog = screen.getByRole('dialog', { name: 'Aktivität eintragen' });
  await waitFor(() => expect(within(dialog).getAllByRole('radio').length).toBeGreaterThan(0));
  return dialog;
};
/** Die Einträge der Auswahl: Titel und zweite Zeile, in der angezeigten Reihenfolge. */
const eintraege = (dialog: HTMLElement) => within(dialog).getAllByRole('radio').map((r) => {
  const zeile = r.closest('label') as HTMLElement;
  return [zeile.querySelector('.web-wahl__titel')?.textContent, zeile.querySelector('.web-wahl__beschreibung')?.textContent ?? null];
});
const bonusDialog = () => {
  fireEvent.click(kopf().getByRole('button', { name: 'Bonuspunkte vergeben' }));
  return screen.getByRole('dialog', { name: 'Bonuspunkte vergeben' });
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-11T10:00:00Z'));
  Object.assign(h.stand, neuerStand());
  h.breit = true;
  h.online = true;
  h.netz = true;
  h.zaehler = 0;
  h.user = konto('org_admin');
  h.antworten = antworten();
  for (const f of [h.apiGet, h.apiPost, h.apiPut, h.apiDelete, h.enqueue]) f.mockReset();
  h.apiGet.mockImplementation(async (pfad: string) => {
    if (!h.antworten.has(pfad)) return { data: [] };
    return { data: h.antworten.get(pfad) };
  });
  h.apiPost.mockResolvedValue({ data: {} });
  h.enqueue.mockImplementation(async (eintrag: Record<string, unknown>) => ({ ...eintrag, id: 'q1', retryCount: 0, createdAt: 0 }));
});

afterEach(() => {
  vi.useRealTimers();
});

describe('Aktivität eintragen im Browser: eigener Dialog', () => {
  it('benannte Felder mit Vorbelegung: Aktivität (nach Art und Name, mit Art, Punkten, Kategorien), Datum heute, Kommentar leer', async () => {
    await oeffnen();
    const dialog = await aktivitaetDialog();
    expect(dialog).toHaveAccessibleDescription('Für Anna Müller');
    expect(h.apiGet).toHaveBeenCalledWith('/admin/activities?target_role=konfi');
    expect(within(dialog).getByRole('group', { name: 'Aktivität' })).toBeInTheDocument();
    expect(within(dialog).getByRole('searchbox', { name: 'Aktivität suchen' })).toHaveValue('');
    expect(eintraege(dialog)).toEqual([
      ['Adventsbasar', 'Gemeinde · 3 Punkte · Feste, Basar'],
      ['Kirchencafé helfen', 'Gemeinde · 2 Punkte'],
      ['Gottesdienstbesuch', 'Gottesdienst · 1 Punkt · Sonntag'],
    ]);
    expect(within(dialog).getAllByRole('radio').filter((r) => (r as HTMLInputElement).checked)).toHaveLength(0);
    expect(within(dialog).getByLabelText('Datum')).toHaveValue('2026-10-11');
    expect(within(dialog).getByLabelText('Datum')).toHaveAttribute('type', 'date');
    expect(within(dialog).getByRole('textbox', { name: 'Kommentar' })).toHaveValue('');
    expect(within(dialog).getByRole('textbox', { name: 'Kommentar' })).toHaveAttribute('placeholder', 'Zusätzliche Informationen...');
    // Ohne ein Fenster der App.
    expect(fenster(ActivityModal)).toHaveLength(0);
  });

  it('die Suche findet ohne Umlaute; abgeschaltete Punkteart des Jahrgangs fehlt in der Liste', async () => {
    h.antworten.set(`/admin/konfis/${ID}`, { ...KONFI, gottesdienst_enabled: false });
    await oeffnen();
    const dialog = await aktivitaetDialog();
    expect(eintraege(dialog).map(([titel]) => titel)).toEqual(['Adventsbasar', 'Kirchencafé helfen']);
    tippen(within(dialog).getByRole('searchbox', { name: 'Aktivität suchen' }), 'kirchencafe');
    expect(eintraege(dialog).map(([titel]) => titel)).toEqual(['Kirchencafé helfen']);
  });

  it('eine Teamer:in bekommt die Teamer-Aktivitäten, ohne Art und Punkte', async () => {
    h.antworten.set(`/admin/konfis/${ID}`, TEAMER);
    await oeffnen();
    const dialog = await aktivitaetDialog();
    expect(h.apiGet).toHaveBeenCalledWith('/admin/activities?target_role=teamer');
    expect(dialog).toHaveAccessibleDescription('Für Robin Probe');
    expect(eintraege(dialog)).toEqual([['Konfi-Wochenende begleitet', 'Freizeit']]);
  });

  it('ohne gewählte Aktivität: konkrete Meldung im Dialog, nichts wird geschickt', async () => {
    await oeffnen();
    const dialog = await aktivitaetDialog();
    await absenden(dialog, 'Eintragen');
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Bitte eine Aktivität wählen.');
    expect(h.apiPost).not.toHaveBeenCalled();
    expect(h.enqueue).not.toHaveBeenCalled();
    // Die Meldung geht weg, sobald gewählt ist.
    fireEvent.click(within(dialog).getByRole('radio', { name: /Kirchencafé helfen/ }));
    expect(within(dialog).queryByRole('alert')).toBeNull();
  });

  it('ohne Datum: konkrete Meldung, nichts wird geschickt', async () => {
    await oeffnen();
    const dialog = await aktivitaetDialog();
    fireEvent.click(within(dialog).getByRole('radio', { name: /Kirchencafé helfen/ }));
    tippen(within(dialog).getByLabelText('Datum'), '');
    await absenden(dialog, 'Eintragen');
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Bitte ein Datum wählen.');
    expect(h.apiPost).not.toHaveBeenCalled();
  });

  it('Eintragen schickt genau diesen Rumpf an die Route der Person, misst danach, lädt die Seite neu und schließt', async () => {
    await oeffnen();
    const vorher = detailAbrufe();
    const dialog = await aktivitaetDialog();
    fireEvent.click(within(dialog).getByRole('radio', { name: /Kirchencafé helfen/ }));
    tippen(within(dialog).getByLabelText('Datum'), '2026-10-04');
    tippen(within(dialog).getByRole('textbox', { name: 'Kommentar' }), 'Mit Kuchen');
    await absenden(dialog, 'Eintragen');
    expect(h.apiPost).toHaveBeenCalledTimes(1);
    expect(h.apiPost).toHaveBeenCalledWith(`/admin/konfis/${ID}/activities`, { activity_id: 32, completed_date: '2026-10-04', comment: 'Mit Kuchen' });
    expect(h.messen).toHaveBeenCalledWith('punkte-vergeben', { weg: 'aktivitaet', punkteart: 'gemeinde' });
    expect(h.enqueue).not.toHaveBeenCalled();
    expect(detailAbrufe()).toBe(vorher + 1);
    expect(h.triggerRefresh).toHaveBeenCalledWith('konfis');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('lehnt der Server ab: die Meldung steht im Dialog, er bleibt offen, nichts wird gemessen', async () => {
    h.apiPost.mockRejectedValueOnce(ABGELEHNT);
    await oeffnen();
    const dialog = await aktivitaetDialog();
    fireEvent.click(within(dialog).getByRole('radio', { name: /Gottesdienstbesuch/ }));
    await absenden(dialog, 'Eintragen');
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Gottesdienst-Punkte sind für diesen Jahrgang deaktiviert');
    expect(screen.getByRole('dialog', { name: 'Aktivität eintragen' })).toBe(dialog);
    expect(h.setError).not.toHaveBeenCalled();
    expect(h.messen).not.toHaveBeenCalled();
    expect(h.triggerRefresh).not.toHaveBeenCalled();
  });

  it('Abbrechen schließt und schickt nichts', async () => {
    await oeffnen();
    const dialog = await aktivitaetDialog();
    fireEvent.click(within(dialog).getByRole('radio', { name: /Kirchencafé helfen/ }));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Abbrechen' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    await warten();
    expect(h.apiPost).not.toHaveBeenCalled();
    expect(h.enqueue).not.toHaveBeenCalled();
    expect(h.triggerRefresh).not.toHaveBeenCalled();
  });

  it('ohne Netz: Hinweis im Dialog, der Eintrag geht in die Warteschlange statt an den Server', async () => {
    await oeffnen();
    h.online = false;
    h.netz = false;
    const dialog = await aktivitaetDialog();
    expect(within(dialog).getByText('Ohne Verbindung wird die Aktivität eingetragen, sobald du wieder online bist.')).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('radio', { name: /Adventsbasar/ }));
    await absenden(dialog, 'Eintragen');
    expect(h.apiPost).not.toHaveBeenCalled();
    expect(h.enqueue).toHaveBeenCalledTimes(1);
    expect(h.enqueue).toHaveBeenCalledWith({
      method: 'POST',
      url: `/admin/konfis/${ID}/activities`,
      body: { activity_id: 33, completed_date: '2026-10-11', comment: '' },
      maxRetries: 5,
      hasFileUpload: false,
      metadata: { type: 'admin', clientId: expect.stringMatching(/^kennung-\d+$/), label: 'Aktivität zuweisen' },
    });
    expect(h.triggerRefresh).toHaveBeenCalledWith('konfis');
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('Bonuspunkte vergeben im Browser: eigener Dialog', () => {
  it('benannte Felder mit Vorbelegung: Bezeichnung leer, 1 Punkt, Typ Gemeinde, Datum heute, Begründung leer', async () => {
    await oeffnen();
    const dialog = bonusDialog();
    expect(dialog).toHaveAccessibleDescription('Für Anna Müller');
    const bezeichnung = within(dialog).getByRole('textbox', { name: 'Bezeichnung' });
    expect(bezeichnung).toHaveValue('');
    expect(bezeichnung).toHaveAttribute('aria-required', 'true');
    expect(bezeichnung).toHaveAttribute('placeholder', 'z.B. Hilfe beim Aufräumen');
    const punkte = within(dialog).getByRole('spinbutton', { name: 'Punkte' });
    expect(punkte).toHaveValue(1);
    expect(punkte).toHaveAttribute('min', '1');
    expect(punkte).toHaveAttribute('max', '10');
    const typ = within(dialog).getByRole('combobox', { name: 'Typ' }) as HTMLSelectElement;
    expect([...typ.options].map((o) => o.textContent)).toEqual(['Gottesdienst', 'Gemeinde']);
    expect(typ).toHaveValue('gemeinde');
    expect(within(dialog).getByLabelText('Datum')).toHaveValue('2026-10-11');
    expect(within(dialog).getByRole('textbox', { name: 'Begründung' })).toHaveValue('');
    // Punkte und Typ stehen nebeneinander.
    expect(punkte.closest('.web-feldpaar')).toBe(typ.closest('.web-feldpaar'));
    expect(punkte.closest('.web-feldpaar')).not.toBeNull();
    expect(fenster(BonusModal)).toHaveLength(0);
  });

  it('ohne Bezeichnung und ohne Punkte: je eine konkrete Meldung, nichts wird geschickt', async () => {
    await oeffnen();
    const dialog = bonusDialog();
    await absenden(dialog, 'Vergeben');
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Bitte eine Bezeichnung eingeben.');
    tippen(within(dialog).getByRole('textbox', { name: 'Bezeichnung' }), 'Plakate fürs Fest');
    expect(within(dialog).queryByRole('alert')).toBeNull();
    tippen(within(dialog).getByRole('spinbutton', { name: 'Punkte' }), '');
    await absenden(dialog, 'Vergeben');
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Bitte 1 bis 10 Punkte vergeben.');
    expect(h.apiPost).not.toHaveBeenCalled();
    expect(h.enqueue).not.toHaveBeenCalled();
  });

  it('Vergeben schickt genau diesen Rumpf an die Route der Konfi, lädt die Seite neu und schließt', async () => {
    await oeffnen();
    const vorher = detailAbrufe();
    const dialog = bonusDialog();
    tippen(within(dialog).getByRole('textbox', { name: 'Bezeichnung' }), '  Plakate fürs Fest ');
    tippen(within(dialog).getByRole('spinbutton', { name: 'Punkte' }), '3');
    tippen(within(dialog).getByRole('combobox', { name: 'Typ' }), 'gottesdienst');
    tippen(within(dialog).getByLabelText('Datum'), '2026-10-04');
    tippen(within(dialog).getByRole('textbox', { name: 'Begründung' }), 'Für den Basar ');
    await absenden(dialog, 'Vergeben');
    expect(h.apiPost).toHaveBeenCalledTimes(1);
    expect(h.apiPost).toHaveBeenCalledWith(`/admin/konfis/${ID}/bonus-points`, {
      points: 3,
      type: 'gottesdienst',
      description: 'Plakate fürs Fest: Für den Basar',
      completed_date: '2026-10-04',
      client_id: expect.stringMatching(/^kennung-\d+$/),
    });
    expect(h.messen).toHaveBeenCalledWith('punkte-vergeben', { weg: 'bonus', punkteart: 'gottesdienst' });
    expect(h.enqueue).not.toHaveBeenCalled();
    expect(detailAbrufe()).toBe(vorher + 1);
    expect(h.triggerRefresh).toHaveBeenCalledWith('konfis');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('lehnt der Server ab: Meldung im Dialog; das zweite Speichern ist derselbe Vorgang (dieselbe Kennung)', async () => {
    h.apiPost.mockRejectedValueOnce(ABGELEHNT);
    await oeffnen();
    const dialog = bonusDialog();
    tippen(within(dialog).getByRole('textbox', { name: 'Bezeichnung' }), 'Kollekte gezählt');
    await absenden(dialog, 'Vergeben');
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Gottesdienst-Punkte sind für diesen Jahrgang deaktiviert');
    expect(h.setError).not.toHaveBeenCalled();
    expect(h.triggerRefresh).not.toHaveBeenCalled();
    await absenden(dialog, 'Vergeben');
    expect(h.apiPost).toHaveBeenCalledTimes(2);
    const [erster, zweiter] = h.apiPost.mock.calls.map(([, rumpf]) => (rumpf as { client_id: string }).client_id);
    expect(erster).toMatch(/^kennung-\d+$/);
    expect(zweiter).toBe(erster);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Abbrechen schließt und schickt nichts', async () => {
    await oeffnen();
    const dialog = bonusDialog();
    tippen(within(dialog).getByRole('textbox', { name: 'Bezeichnung' }), 'Plakate fürs Fest');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Abbrechen' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    await warten();
    expect(h.apiPost).not.toHaveBeenCalled();
    expect(h.enqueue).not.toHaveBeenCalled();
  });

  it('abgeschaltete Punkteart: nur die aktive zur Wahl, mit Hinweis; sie wird geschickt', async () => {
    h.antworten.set(`/admin/konfis/${ID}`, { ...KONFI, gemeinde_enabled: false });
    await oeffnen();
    const dialog = bonusDialog();
    const typ = within(dialog).getByRole('combobox', { name: 'Typ' }) as HTMLSelectElement;
    expect([...typ.options].map((o) => o.textContent)).toEqual(['Gottesdienst']);
    expect(typ).toHaveValue('gottesdienst');
    expect(typ).toHaveAccessibleDescription('Gemeinde ist im Jahrgang abgeschaltet.');
    tippen(within(dialog).getByRole('textbox', { name: 'Bezeichnung' }), 'Lesung');
    await absenden(dialog, 'Vergeben');
    expect(h.apiPost).toHaveBeenCalledWith(`/admin/konfis/${ID}/bonus-points`, expect.objectContaining({ type: 'gottesdienst', points: 1, description: 'Lesung' }));
  });

  it('ohne Netz: Hinweis im Dialog, die Vergabe geht mit ihrer Kennung in die Warteschlange', async () => {
    await oeffnen();
    h.online = false;
    h.netz = false;
    const dialog = bonusDialog();
    expect(within(dialog).getByText('Ohne Verbindung werden die Bonuspunkte vergeben, sobald du wieder online bist.')).toBeInTheDocument();
    tippen(within(dialog).getByRole('textbox', { name: 'Bezeichnung' }), 'Plakate fürs Fest');
    tippen(within(dialog).getByRole('spinbutton', { name: 'Punkte' }), '2');
    await absenden(dialog, 'Vergeben');
    expect(h.apiPost).not.toHaveBeenCalled();
    expect(h.enqueue).toHaveBeenCalledTimes(1);
    const eintrag = h.enqueue.mock.calls[0][0] as { body: { client_id: string }; metadata: { clientId: string } };
    expect(eintrag).toEqual({
      method: 'POST',
      url: `/admin/konfis/${ID}/bonus-points`,
      body: { points: 2, type: 'gemeinde', description: 'Plakate fürs Fest', completed_date: '2026-10-11', client_id: expect.stringMatching(/^kennung-\d+$/) },
      maxRetries: 5,
      hasFileUpload: false,
      metadata: { type: 'admin', clientId: eintrag.body.client_id, label: 'Bonus-Punkte vergeben' },
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('Schmal und in den Apps: weiter die Modale der App', () => {
  it('Aktivität hinzufügen und Bonuspunkte hinzufügen öffnen die Fenster der App, keinen Dialog der Web-Fassung', async () => {
    h.breit = false;
    h.antworten.set(`/admin/konfis/${ID}`, { ...KONFI, gottesdienst_enabled: false });
    await oeffnen();
    fireEvent.click(screen.getByRole('button', { name: 'Aktivität hinzufügen' }));
    expect(fenster(ActivityModal)).toHaveLength(1);
    expect(fenster(ActivityModal)[0].props).toEqual(expect.objectContaining({
      konfiId: ID, targetRole: 'konfi', punkteartFlags: { gottesdienst_enabled: false, gemeinde_enabled: undefined },
    }));
    fireEvent.click(screen.getByRole('button', { name: 'Bonuspunkte hinzufügen' }));
    expect(fenster(BonusModal)).toHaveLength(1);
    expect(fenster(BonusModal)[0].props).toEqual(expect.objectContaining({ konfiId: ID, punkteartFlags: { gottesdienst_enabled: false, gemeinde_enabled: undefined } }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});

describe('Die Modale der App schicken weiter denselben Rumpf (gemeinsame Logik)', () => {
  it('Aktivität: der Haken schickt Aktivität, Datum und Kommentar; danach onSave und Schließen', async () => {
    const onSave = vi.fn(async () => {});
    const onClose = vi.fn();
    render(<ActivityModal konfiId={ID} targetRole="konfi" onClose={onClose} onSave={onSave} />);
    await warten();
    expect(screen.getByRole('button', { name: 'Aktivität speichern' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: /Kirchencafé helfen/ }));
    fireEvent.change(screen.getByRole('textbox', { name: 'Zusätzliche Informationen' }), { target: { value: 'Mit Kuchen' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Aktivität speichern' })); });
    await warten();
    expect(h.apiPost).toHaveBeenCalledWith(`/admin/konfis/${ID}/activities`, { activity_id: 32, completed_date: '2026-10-11', comment: 'Mit Kuchen' });
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Aktivität: eine Ablehnung des Servers meldet die App wie bisher über setError', async () => {
    h.apiPost.mockRejectedValueOnce(ABGELEHNT);
    const onClose = vi.fn();
    render(<ActivityModal konfiId={ID} targetRole="konfi" onClose={onClose} onSave={vi.fn(async () => {})} />);
    await warten();
    fireEvent.click(screen.getByRole('button', { name: /Gottesdienstbesuch/ }));
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Aktivität speichern' })); });
    await warten();
    expect(h.setError).toHaveBeenCalledWith('Gottesdienst-Punkte sind für diesen Jahrgang deaktiviert');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('Bonus: der Haken schickt denselben Rumpf; ohne Netz dieselbe Warteschlange mit derselben Kennung', async () => {
    const onSave = vi.fn(async () => {});
    const onClose = vi.fn();
    const { unmount } = render(<BonusModal konfiId={ID} onClose={onClose} onSave={onSave} />);
    expect(screen.getByRole('button', { name: 'Bonuspunkte speichern' })).toBeDisabled();
    fireEvent.change(screen.getByRole('textbox', { name: 'Bezeichnung' }), { target: { value: 'Plakate fürs Fest' } });
    fireEvent.change(screen.getByRole('slider', { name: 'Punkte' }), { target: { value: '4' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Begründung' }), { target: { value: 'Für den Basar' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Bonuspunkte speichern' })); });
    await warten();
    expect(h.apiPost).toHaveBeenCalledWith(`/admin/konfis/${ID}/bonus-points`, {
      points: 4, type: 'gemeinde', description: 'Plakate fürs Fest: Für den Basar', completed_date: '2026-10-11', client_id: expect.stringMatching(/^kennung-\d+$/),
    });
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    unmount();

    h.netz = false;
    render(<BonusModal konfiId={ID} onClose={vi.fn()} onSave={vi.fn(async () => {})} />);
    fireEvent.change(screen.getByRole('textbox', { name: 'Bezeichnung' }), { target: { value: 'Kollekte gezählt' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Bonuspunkte speichern' })); });
    await warten();
    expect(h.apiPost).toHaveBeenCalledTimes(1);
    const eintrag = h.enqueue.mock.calls[0][0] as { body: { client_id: string }; metadata: { clientId: string; label: string }; url: string };
    expect(eintrag.url).toBe(`/admin/konfis/${ID}/bonus-points`);
    expect(eintrag.metadata).toEqual({ type: 'admin', clientId: eintrag.body.client_id, label: 'Bonus-Punkte vergeben' });
  });
});
