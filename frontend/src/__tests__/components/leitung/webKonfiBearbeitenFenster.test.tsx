// „Konfi bearbeiten" auf der Detailseite einer Konfi im Browser, gerendert
// (Simon, 13.10.2026: „Konfi bearbeiten hat noch kein eigenes web modal").
// Im breiten Layout öffnet der Knopf einen eigenen Dialog der Web-Fassung
// (WebKonfiDialog) statt des Modals der App; schmal bleibt es beim Modal.
//
// Dieselbe Logik wie in der App (useKonfiFormular): dieselben Felder und
// Warnungen beim Jahrgangswechsel, derselbe Rumpf an dieselbe Route
// (PUT /admin/konfis/:id), danach dieselben Folgen (Meldung, Seite neu laden,
// Liste der Konfis auffrischen). Ein Fehler des Servers bleibt im Fenster.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, within, act, cleanup } from '@testing-library/react';
import { konto, neuerStand, type LeitungTestStand } from './leitungTestHilfe';

const h = vi.hoisted(() => ({
  breit: true,
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
// Die Kopfzeile der App mit ihren Knöpfen (rechts): dort sitzt „Konfi bearbeiten" in der App.
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
  DATEI_TIMEOUT_MS: 180000,
}));
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({ user: h.user, setError: h.setError, setSuccess: h.setSuccess, isOnline: true }),
}));
vi.mock('../../../contexts/LiveUpdateContext', () => ({
  useLiveUpdate: () => ({ triggerRefresh: h.triggerRefresh }),
  useLiveRefresh: () => {},
}));
vi.mock('../../../services/offlineCache', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../services/offlineCache')>()),
  offlineCache: { get: vi.fn().mockResolvedValue(null), set: vi.fn().mockResolvedValue(undefined), remove: vi.fn() },
}));
vi.mock('../../../components/admin/views/ActivityRings', () => ({ default: () => null }));
vi.mock('../../../components/admin/modals/ActivityModal', () => ({ default: () => null }));
vi.mock('../../../components/admin/modals/BonusModal', () => ({ default: () => null }));
vi.mock('../../../components/admin/modals/CertificateAssignModal', () => ({ default: () => null }));
vi.mock('../../../components/admin/modals/AttendanceMatrixModal', () => ({ default: () => null }));
vi.mock('../../../components/wrapped/WrappedModal', () => ({ default: () => null }));
vi.mock('../../../components/shared/NachweisFoto', () => ({ default: () => null }));

import KonfiDetailView from '../../../components/admin/views/KonfiDetailView';
import KonfiModal from '../../../components/admin/modals/KonfiModal';

const ID = 9;
const KONFI = {
  id: ID, name: 'Anna Müller', display_name: 'Anna Müller', username: 'anna.mueller', role_name: 'konfi',
  jahrgang_id: 12, jahrgang_name: 'Jahrgang 2026', badgeCount: 0,
  gottesdienst_points: 7, gemeinde_points: 5, target_gottesdienst: 10, target_gemeinde: 10,
  activities: [], bonusPoints: [],
};
const JAHRGAENGE = [
  { id: 12, name: 'Jahrgang 2026', gottesdienst_enabled: true, gemeinde_enabled: true },
  // Gottesdienstpunkte abgeschaltet: Die 7 der Konfi waeren dort nicht mehr zu sehen.
  { id: 13, name: 'Jahrgang 2027', gottesdienst_enabled: false, gemeinde_enabled: true },
];
const antwortFehler = (status: number, data: Record<string, unknown>) =>
  Object.assign(new Error(`Request failed with status code ${status}`), { response: { status, data } });

const warten = async () => { for (let i = 0; i < 8; i += 1) await act(async () => { await Promise.resolve(); }); };
const oeffnen = async () => {
  render(<KonfiDetailView konfiId={ID} onBack={vi.fn()} />);
  await warten();
};
const detailAbrufe = () => h.apiGet.mock.calls.filter(([pfad]) => pfad === `/admin/konfis/${ID}`).length;
const fenster = (komponente: unknown) => h.stand.fenster.filter((f) => f.komponente === komponente);
const tippen = (feld: HTMLElement, wert: string) => fireEvent.change(feld, { target: { value: wert } });
const bearbeitenOeffnen = async () => {
  await oeffnen();
  fireEvent.click(screen.getByRole('button', { name: 'Konfi bearbeiten' }));
  return screen.getByRole('dialog', { name: 'Konfi bearbeiten' });
};
const speichern = async (dialog: HTMLElement) => {
  await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Speichern' })); });
  await warten();
};

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(h.stand, neuerStand());
  h.breit = true;
  h.user = konto('org_admin');
  h.antworten = new Map<string, unknown>([
    [`/admin/konfis/${ID}`, KONFI],
    ['/admin/jahrgaenge', JAHRGAENGE],
  ]);
  for (const f of [h.apiGet, h.apiPost, h.apiPut, h.apiDelete]) f.mockReset();
  h.apiGet.mockImplementation(async (pfad: string) => ({ data: h.antworten.has(pfad) ? h.antworten.get(pfad) : [] }));
  h.apiPut.mockResolvedValue({ data: {} });
});

describe('Konfi bearbeiten im Browser: eigener Dialog', () => {
  it('vorbelegt mit Name und Jahrgang der Konfi, Pflichtfelder, Hinweis zum Benutzernamen; kein App-Fenster', async () => {
    const dialog = await bearbeitenOeffnen();
    const name = within(dialog).getByLabelText('Name');
    expect(name).toHaveValue('Anna Müller');
    expect(name).toHaveAttribute('aria-required', 'true');
    expect(document.activeElement).toBe(name);
    const jahrgang = within(dialog).getByRole('combobox', { name: 'Jahrgang' }) as HTMLSelectElement;
    expect(jahrgang.value).toBe('12');
    expect(jahrgang).toHaveAttribute('aria-required', 'true');
    expect(within(dialog).getByText('Der Benutzername zum Anmelden ändert sich nicht — auch dann nicht, wenn du den Namen korrigierst.')).toBeInTheDocument();
    expect(within(dialog).queryByText('Was der Wechsel bewirkt')).toBeNull();
    expect(fenster(KonfiModal)).toHaveLength(0);
  });

  it('Speichern schickt denselben Rumpf an dieselbe Route wie das Modal der App', async () => {
    const dialog = await bearbeitenOeffnen();
    tippen(within(dialog).getByLabelText('Name'), ' Anna Meyer ');
    await speichern(dialog);
    const web = h.apiPut.mock.calls[0];
    expect(web).toEqual([`/admin/konfis/${ID}`, { name: 'Anna Meyer', jahrgang_id: 12 }]);
    cleanup();

    // Dieselbe Änderung im echten Modal der App (schmal).
    h.breit = false;
    await oeffnen();
    fireEvent.click(screen.getByRole('button', { name: 'Konfi bearbeiten' }));
    const app = fenster(KonfiModal)[0];
    render(React.createElement(app.komponente as React.FC<Record<string, unknown>>, app.props));
    tippen(screen.getByRole('textbox', { name: 'Name' }), ' Anna Meyer ');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Änderungen speichern' })); });
    await warten();
    expect(h.apiPut.mock.calls[1]).toEqual(web);
  });

  it('nach dem Speichern: Meldung, Seite und Konfi-Liste laden neu, der Dialog schließt', async () => {
    const dialog = await bearbeitenOeffnen();
    const vorher = detailAbrufe();
    tippen(within(dialog).getByLabelText('Name'), 'Anna Meyer');
    await speichern(dialog);
    expect(h.setSuccess).toHaveBeenCalledWith('Änderungen gespeichert');
    expect(detailAbrufe()).toBe(vorher + 1);
    expect(h.triggerRefresh).toHaveBeenCalledWith('konfis');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Jahrgang wechseln: dieselben Warnungen wie in der App, gespeichert wird der neue Jahrgang', async () => {
    const dialog = await bearbeitenOeffnen();
    tippen(within(dialog).getByRole('combobox', { name: 'Jahrgang' }), '13');
    const warnung = within(dialog).getByText('Was der Wechsel bewirkt').closest('.web-hinweis') as HTMLElement;
    expect(within(warnung).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
      'Anmeldungen zu künftigen Events des alten Jahrgangs fallen weg.',
      'Pflicht-Events des neuen Jahrgangs kommen dazu.',
      'Der Jahrgangs-Chat wechselt mit.',
      'Der Jahresrückblick erscheint erst wieder, wenn der neue Jahrgang freigegeben ist.',
    ]);
    expect(within(warnung).getByText('Bereits erfasste Anwesenheiten und vergangene Events bleiben unberührt.')).toBeInTheDocument();
    expect(within(warnung).getByText('Achtung: In Jahrgang 2027 ist diese Punkteart abgeschaltet — 7 Gottesdienstpunkte werden dort nicht mehr angezeigt.')).toBeInTheDocument();
    await speichern(dialog);
    expect(h.apiPut).toHaveBeenCalledWith(`/admin/konfis/${ID}`, { name: 'Anna Müller', jahrgang_id: 13 });
  });

  it('ein Fehler des Servers bleibt im Fenster: Text des Servers, Dialog offen, keine Meldung oben', async () => {
    h.apiPut.mockRejectedValueOnce(antwortFehler(400, { error: 'Jahrgang nicht gefunden' }));
    const dialog = await bearbeitenOeffnen();
    tippen(within(dialog).getByLabelText('Name'), 'Anna Meyer');
    await speichern(dialog);
    expect(screen.getByRole('dialog', { name: 'Konfi bearbeiten' })).toBe(dialog);
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Jahrgang nicht gefunden');
    expect(within(dialog).getByRole('button', { name: 'Speichern' })).toBeEnabled();
    expect(h.setSuccess).not.toHaveBeenCalled();
    expect(h.setError).not.toHaveBeenCalled();
    expect(h.triggerRefresh).not.toHaveBeenCalled();
  });

  it('ohne Antwort-Text: „Fehler beim Speichern" im Fenster', async () => {
    h.apiPut.mockRejectedValueOnce(antwortFehler(500, {}));
    const dialog = await bearbeitenOeffnen();
    await speichern(dialog);
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Fehler beim Speichern');
  });

  it('Name leer: ein Satz, was fehlt -- nichts geht an den Server', async () => {
    const dialog = await bearbeitenOeffnen();
    tippen(within(dialog).getByLabelText('Name'), '   ');
    await speichern(dialog);
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Bitte einen Namen eingeben.');
    expect(h.apiPut).not.toHaveBeenCalled();
  });

  it('schmal: der Stift öffnet weiter das Modal der App, kein Dialog', async () => {
    h.breit = false;
    await oeffnen();
    fireEvent.click(screen.getByRole('button', { name: 'Konfi bearbeiten' }));
    expect(fenster(KonfiModal)).toHaveLength(1);
    expect(fenster(KonfiModal)[0].props.konfi).toEqual({
      id: ID, display_name: 'Anna Müller', jahrgang_id: 12, gottesdienst_points: 7, gemeinde_points: 5,
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
