// Badge anlegen und bearbeiten im Browser (11.10.2026, Simon: „Web braucht
// eigene kompaktere Modale überall"): der Dialog der Web-Fassung
// (WebBadgeFormular), gerendert mit der echten Logik (useBadgeFormular) --
// nur Server, Kontext und Warteschlange sind Attrappen. Geprueft wird, was die
// Leitung sieht und was beim Server ankommt: Felder, Vorbelegung, Pruefung,
// genau dieser Koerper an genau diese Route, Abbrechen schickt nichts, ohne
// Netz die Warteschlange wie in der App.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import './zeitrahmen';
import React from 'react';
import { render, screen, fireEvent, act, within, waitFor } from '@testing-library/react';
import { badgeServer, gespeichertesBadge } from './badgeServer';

const h = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
  enqueue: vi.fn(),
  track: vi.fn(),
  setError: vi.fn(),
  setSuccess: vi.fn(),
  online: true,
  user: { id: 5, organization_id: 1, role_name: 'org_admin' } as Record<string, unknown>,
}));

vi.mock('@ionic/react', async () => (await import('../support/ionicAttrappe')).ionicAttrappe());
vi.mock('../../../services/api', () => ({ default: { get: h.apiGet, post: h.apiPost, put: h.apiPut } }));
vi.mock('../../../services/writeQueue', () => ({ writeQueue: { enqueue: h.enqueue } }));
vi.mock('../../../services/networkMonitor', () => ({ networkMonitor: { get isOnline() { return h.online; } } }));
vi.mock('../../../services/analytics', () => ({ trackHandlung: h.track }));
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({ user: h.user, setError: h.setError, setSuccess: h.setSuccess, isOnline: h.online }),
}));

import WebBadgeFormular from '../../../components/admin/web/start/WebBadgeFormular';
import { OFFLINE_AKTION_MELDUNG } from '../../../utils/offlineAktion';
import { erwarteWebRueckfrage } from '../web/webRueckfrageErwartung';

const BADGES = [
  gespeichertesBadge({ id: 7 }),
  gespeichertesBadge({
    id: 9, name: 'Dranbleiben', icon: 'flame', description: 'Sechs Wochen am Ball', criteria_type: 'time_based', criteria_value: 5,
    criteria_extra: JSON.stringify({ days: 42 }), color: '#8e8e93', is_hidden: true,
  }),
  // Gespeichert ueber der Grenze des Reglers (in Produktion gibt es 25, 26, 30).
  gespeichertesBadge({ id: 11, name: 'Dauerbrenner', icon: 'trophy', description: '', criteria_type: 'total_points', criteria_value: 30, criteria_extra: null, color: '#ffd700' }),
];

const props = { onSchliessen: vi.fn(), onGespeichert: vi.fn(), onListeNeuLaden: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  h.online = true;
  h.user = { id: 5, organization_id: 1, role_name: 'org_admin' };
  h.apiGet.mockImplementation(badgeServer(BADGES));
  h.apiPost.mockResolvedValue({ data: { id: 31 } });
  h.apiPut.mockResolvedValue({ data: {} });
  h.enqueue.mockResolvedValue(undefined);
});

/** Nach dem Laden zaehlen Aenderungen erst nach einem kurzen Moment (wie in der App: 100 ms). */
const eingeschwungen = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 150)); }); };

const oeffnen = async (badgeId: number | null, rolle: 'konfi' | 'teamer' = 'konfi') => {
  render(<WebBadgeFormular badgeId={badgeId} targetRole={rolle} {...props} />);
  const dialog = screen.getByRole('dialog', { name: badgeId ? 'Badge bearbeiten' : 'Neues Badge' });
  await within(dialog).findByRole('textbox', { name: 'Name' });
  await eingeschwungen();
  return dialog;
};
const im = (dialog: HTMLElement) => within(dialog);
const feld = (dialog: HTMLElement, name: string | RegExp) => im(dialog).getByRole('textbox', { name }) as HTMLInputElement;
const zahl = (dialog: HTMLElement, name: string | RegExp) => im(dialog).getByRole('spinbutton', { name }) as HTMLInputElement;
const auswahl = (dialog: HTMLElement, name: string) => im(dialog).getByRole('combobox', { name }) as HTMLSelectElement;
const optionen = (el: HTMLSelectElement) => [...el.options].map((o) => o.value);
const speichern = async (dialog: HTMLElement) => {
  await act(async () => { fireEvent.click(im(dialog).getByRole('button', { name: 'Speichern' })); });
};
const farbe = (dialog: HTMLElement) => im(dialog).getByLabelText('Farbe') as HTMLInputElement;

describe('Badge-Formular (Web): neues Badge', () => {
  it('ein Dialog mit benannten Feldern und der Vorbelegung fuer Konfis', async () => {
    const dialog = await oeffnen(null);
    expect(dialog).toHaveClass('web-dialog--breit');
    expect(feld(dialog, 'Name')).toHaveValue('');
    expect(feld(dialog, 'Name')).toHaveAttribute('aria-required', 'true');
    expect(feld(dialog, 'Beschreibung')).toHaveValue('');
    expect(auswahl(dialog, 'Zielgruppe').value).toBe('konfi');
    expect(farbe(dialog)).toHaveValue('#ffd700');
    expect(im(dialog).getByRole('button', { name: 'Pokal' })).toHaveAttribute('aria-pressed', 'true');
    expect(im(dialog).getByRole('button', { name: 'Stern' })).toHaveAttribute('aria-pressed', 'false');
    expect(auswahl(dialog, 'Bedingung').value).toBe('total_points');
    // Fuer Konfis: alles ausser den Teamer-Jahren, in der Reihenfolge des Servers.
    expect(optionen(auswahl(dialog, 'Bedingung'))).toEqual([
      'total_points', 'gottesdienst_points', 'activity_count', 'mandatory_event_count', 'specific_activity',
      'category_activities', 'activity_combination', 'category_combination', 'time_based', 'streak',
    ]);
    expect(zahl(dialog, 'Punkte')).toHaveValue(10);
    expect(im(dialog).getByRole('switch', { name: 'Aktiv' })).toBeChecked();
    expect(im(dialog).getByRole('switch', { name: 'Geheim' })).not.toBeChecked();
    expect(im(dialog).queryByRole('button', { name: 'Badge neu prüfen' })).toBeNull();
    // Die Vorschau zeigt Symbol, Namen und Bedingung.
    expect(im(dialog).getByRole('group', { name: 'Vorschau' })).toHaveTextContent('Neues BadgeGesamtpunkte · Wert 10');
  });

  it('Zielgruppe Team: Kriterien ohne Punkte, Vorgabe „Aktivitäten & Events" mit 5 und ihrer Farbe', async () => {
    const dialog = await oeffnen(null, 'teamer');
    expect(auswahl(dialog, 'Zielgruppe').value).toBe('teamer');
    expect(auswahl(dialog, 'Bedingung').value).toBe('activity_count');
    expect(optionen(auswahl(dialog, 'Bedingung'))).toEqual([
      'activity_count', 'specific_activity', 'category_activities', 'activity_combination', 'category_combination', 'teamer_year',
    ]);
    expect(zahl(dialog, 'Anzahl (Aktivitäten & Events)')).toHaveValue(5);
    expect(farbe(dialog)).toHaveValue('#3880ff');
    // Die Aktivitaeten kommen aus der Zielgruppe der Liste.
    expect(h.apiGet).toHaveBeenCalledWith('/admin/activities?target_role=teamer');
  });

  it('Zielgruppe wechseln: Bedingung, Wert und Farbe springen auf die Vorgabe der Gruppe, der Koerper traegt sie', async () => {
    const dialog = await oeffnen(null);
    const KONFI_KRITERIEN = [
      'total_points', 'gottesdienst_points', 'activity_count', 'mandatory_event_count', 'specific_activity',
      'category_activities', 'activity_combination', 'category_combination', 'time_based', 'streak',
    ];
    // Vorher eine andere Bedingung, ein eigener Wert und eine eigene Farbe: der Wechsel setzt alles zurueck.
    fireEvent.change(auswahl(dialog, 'Bedingung'), { target: { value: 'streak' } });
    fireEvent.change(zahl(dialog, 'Anzahl (Aufeinanderfolgende Wochen)'), { target: { value: '7' } });
    fireEvent.change(farbe(dialog), { target: { value: '#123456' } });

    fireEvent.change(auswahl(dialog, 'Zielgruppe'), { target: { value: 'teamer' } });
    expect(auswahl(dialog, 'Zielgruppe').value).toBe('teamer');
    expect(optionen(auswahl(dialog, 'Bedingung'))).toEqual([
      'activity_count', 'specific_activity', 'category_activities', 'activity_combination', 'category_combination', 'teamer_year',
    ]);
    expect(auswahl(dialog, 'Bedingung').value).toBe('activity_count');
    expect(zahl(dialog, 'Anzahl (Aktivitäten & Events)')).toHaveValue(5);
    expect(farbe(dialog)).toHaveValue('#3880ff');
    expect(im(dialog).getByRole('group', { name: 'Vorschau' })).toHaveTextContent('Neues BadgeAktivitäten & Events · Wert 5');

    fireEvent.change(auswahl(dialog, 'Zielgruppe'), { target: { value: 'konfi' } });
    expect(optionen(auswahl(dialog, 'Bedingung'))).toEqual(KONFI_KRITERIEN);
    expect(auswahl(dialog, 'Bedingung').value).toBe('total_points');
    expect(zahl(dialog, 'Punkte')).toHaveValue(10);
    expect(farbe(dialog)).toHaveValue('#ffd700');

    fireEvent.change(auswahl(dialog, 'Zielgruppe'), { target: { value: 'teamer' } });
    fireEvent.change(feld(dialog, 'Name'), { target: { value: 'Mit dabei' } });
    await speichern(dialog);
    expect(h.apiPost).toHaveBeenCalledTimes(1);
    expect(h.apiPost).toHaveBeenCalledWith('/admin/badges', {
      name: 'Mit dabei', icon: 'trophy', description: '', criteria_type: 'activity_count', criteria_value: 5,
      criteria_extra: {}, is_active: true, is_hidden: false, color: '#3880ff', target_role: 'teamer',
    });
    expect(h.track).toHaveBeenCalledWith('badge-angelegt', { zielgruppe: 'teamer' });
  });

  it('Speichern schickt genau diesen Koerper an POST /admin/badges, misst und meldet „gespeichert"', async () => {
    const dialog = await oeffnen(null);
    fireEvent.change(feld(dialog, 'Name'), { target: { value: 'Fleißig' } });
    fireEvent.change(feld(dialog, 'Beschreibung'), { target: { value: 'Viele Punkte gesammelt' } });
    fireEvent.click(im(dialog).getByRole('button', { name: 'Stern' }));
    fireEvent.change(zahl(dialog, 'Punkte'), { target: { value: '12' } });
    fireEvent.click(im(dialog).getByRole('switch', { name: 'Geheim' }));
    await speichern(dialog);
    expect(h.apiPost).toHaveBeenCalledTimes(1);
    expect(h.apiPost).toHaveBeenCalledWith('/admin/badges', {
      name: 'Fleißig', icon: 'star', description: 'Viele Punkte gesammelt', criteria_type: 'total_points', criteria_value: 12,
      criteria_extra: {}, is_active: true, is_hidden: true, color: '#ffd700', target_role: 'konfi',
    });
    expect(h.track).toHaveBeenCalledWith('badge-angelegt', { zielgruppe: 'konfi' });
    expect(props.onGespeichert).toHaveBeenCalledTimes(1);
    expect(h.enqueue).not.toHaveBeenCalled();
    expect(h.setError).not.toHaveBeenCalled();
  });

  it('Kategorie-Kombination: Ankreuzfelder, der Wert zieht mit, Namen gehen mit', async () => {
    const dialog = await oeffnen(null);
    fireEvent.change(feld(dialog, 'Name'), { target: { value: 'Vielseitig' } });
    fireEvent.change(auswahl(dialog, 'Bedingung'), { target: { value: 'category_combination' } });
    expect(zahl(dialog, 'Aus wie vielen der angekreuzten Kategorien?')).toHaveValue(3);
    const kategorien = im(dialog).getByRole('group', { name: 'Kategorien' });
    fireEvent.click(within(kategorien).getByRole('checkbox', { name: 'Gottesdienst' }));
    // „3 aus 1" kann niemand erreichen: der Wert sinkt auf 1.
    expect(zahl(dialog, 'Aus wie vielen der angekreuzten Kategorien?')).toHaveValue(1);
    fireEvent.click(within(kategorien).getByRole('checkbox', { name: 'Freizeit' }));
    fireEvent.change(zahl(dialog, 'Aus wie vielen der angekreuzten Kategorien?'), { target: { value: '2' } });
    expect(farbe(dialog)).toHaveValue('#0891b2');
    await speichern(dialog);
    expect(h.apiPost).toHaveBeenCalledWith('/admin/badges', {
      name: 'Vielseitig', icon: 'trophy', description: '', criteria_type: 'category_combination', criteria_value: 2,
      criteria_extra: { required_categories: ['Gottesdienst', 'Freizeit'] }, is_active: true, is_hidden: false, color: '#0891b2', target_role: 'konfi',
    });
  });

  it('Zeitbasiert: die angezeigten 4 Wochen gehen als 28 Tage mit', async () => {
    const dialog = await oeffnen(null);
    fireEvent.change(feld(dialog, 'Name'), { target: { value: 'Am Ball' } });
    fireEvent.change(auswahl(dialog, 'Bedingung'), { target: { value: 'time_based' } });
    expect(zahl(dialog, 'Zeitraum (Wochen)')).toHaveValue(4);
    await speichern(dialog);
    expect(h.apiPost).toHaveBeenCalledWith('/admin/badges', expect.objectContaining({
      criteria_type: 'time_based', criteria_value: 10, criteria_extra: { days: 28 }, color: '#8e8e93',
    }));
  });

  it('die Farbe folgt der Bedingung, eine eigene bleibt, „Standard" holt die Vorgabe zurueck', async () => {
    const dialog = await oeffnen(null);
    fireEvent.change(auswahl(dialog, 'Bedingung'), { target: { value: 'streak' } });
    expect(farbe(dialog)).toHaveValue('#eb445a');
    expect(im(dialog).queryByRole('button', { name: 'Standard' })).toBeNull();
    fireEvent.change(farbe(dialog), { target: { value: '#123456' } });
    fireEvent.change(auswahl(dialog, 'Bedingung'), { target: { value: 'activity_count' } });
    expect(farbe(dialog)).toHaveValue('#123456');
    fireEvent.click(im(dialog).getByRole('button', { name: 'Standard' }));
    expect(farbe(dialog)).toHaveValue('#3880ff');
  });
});

describe('Badge-Formular (Web): Pruefung', () => {
  it('ohne Namen: die Meldung steht im Dialog, nichts geht hinaus', async () => {
    const dialog = await oeffnen(null);
    await speichern(dialog);
    expect(im(dialog).getByRole('alert')).toHaveTextContent('Name ist erforderlich');
    expect(h.apiPost).not.toHaveBeenCalled();
    expect(h.setError).not.toHaveBeenCalled();
    // Tippen nimmt die Meldung weg.
    fireEvent.change(feld(dialog, 'Name'), { target: { value: 'X' } });
    expect(im(dialog).queryByRole('alert')).toBeNull();
  });

  it('ein leerer Wert: konkrete Meldung mit den Grenzen, nichts geht hinaus', async () => {
    const dialog = await oeffnen(null);
    fireEvent.change(feld(dialog, 'Name'), { target: { value: 'Leer' } });
    fireEvent.change(zahl(dialog, 'Punkte'), { target: { value: '' } });
    expect(zahl(dialog, 'Punkte')).toHaveValue(null);
    await speichern(dialog);
    expect(im(dialog).getByRole('alert')).toHaveTextContent('Bitte bei „Punkte“ eine ganze Zahl von 1 bis 20 eintragen.');
    expect(h.apiPost).not.toHaveBeenCalled();
  });

  it('ein Wert ueber der Grenze wird nicht uebernommen', async () => {
    const dialog = await oeffnen(null);
    fireEvent.change(feld(dialog, 'Name'), { target: { value: 'Zu viel' } });
    fireEvent.change(zahl(dialog, 'Punkte'), { target: { value: '21' } });
    expect(zahl(dialog, 'Punkte')).toHaveAttribute('max', '20');
    // Die Vorschau zeigt weiter den gueltigen Wert.
    expect(im(dialog).getByRole('group', { name: 'Vorschau' })).toHaveTextContent('Wert 10');
    // Das Feld traegt min/max: der Browser haelt das Formular selbst an und
    // zeigt seine Meldung am Feld; hinaus geht nichts.
    expect(zahl(dialog, 'Punkte').validity.rangeOverflow).toBe(true);
    await speichern(dialog);
    expect(h.apiPost).not.toHaveBeenCalled();
  });

  it('ein gespeicherter Wert ueber 20 bleibt und ist die Grenze (wie der Regler der App)', async () => {
    const dialog = await oeffnen(11);
    expect(zahl(dialog, 'Punkte')).toHaveValue(30);
    expect(zahl(dialog, 'Punkte')).toHaveAttribute('max', '30');
    await speichern(dialog);
    expect(h.apiPut).toHaveBeenCalledWith('/admin/badges/11', expect.objectContaining({ criteria_value: 30 }));
  });

  it('lehnt der Server ab, steht sein Satz zur Pruefung im Dialog, der Dialog bleibt offen', async () => {
    h.apiPost.mockRejectedValue({ response: { status: 400, data: { error: 'Validierungsfehler', details: [{ field: 'criteria_extra', message: 'Bitte eine Aktivität auswählen' }] } } });
    const dialog = await oeffnen(null);
    fireEvent.change(feld(dialog, 'Name'), { target: { value: 'Ohne Wahl' } });
    fireEvent.change(auswahl(dialog, 'Bedingung'), { target: { value: 'specific_activity' } });
    await speichern(dialog);
    expect(h.apiPost).toHaveBeenCalledWith('/admin/badges', expect.objectContaining({ criteria_type: 'specific_activity', criteria_extra: {} }));
    expect(im(dialog).getByRole('alert')).toHaveTextContent('Bitte eine Aktivität auswählen');
    expect(props.onGespeichert).not.toHaveBeenCalled();
    expect(h.setError).not.toHaveBeenCalled();
  });
});

describe('Badge-Formular (Web): bearbeiten', () => {
  it('vorbelegt mit dem gespeicherten Badge, die Aktivitaet gewaehlt; PUT mit genau diesem Koerper', async () => {
    const dialog = await oeffnen(7);
    expect(h.apiGet).toHaveBeenCalledWith('/admin/badges/7');
    // Die Zielgruppe laesst sich nicht mehr aendern -- das Feld fehlt.
    expect(im(dialog).queryByRole('combobox', { name: 'Zielgruppe' })).toBeNull();
    expect(feld(dialog, 'Name')).toHaveValue('Chorprobe');
    expect(feld(dialog, 'Beschreibung')).toHaveValue('Dreimal beim Kirchenchor');
    expect(im(dialog).getByRole('button', { name: 'Musik' })).toHaveAttribute('aria-pressed', 'true');
    expect(farbe(dialog)).toHaveValue('#ffce00');
    expect(auswahl(dialog, 'Bedingung').value).toBe('specific_activity');
    expect(zahl(dialog, 'Anzahl (Spezifische Aktivität)')).toHaveValue(3);
    const aktivitaet = im(dialog).getByRole('group', { name: 'Aktivität' });
    expect(within(aktivitaet).getByRole('radio', { name: /Kirchenchor/ })).toBeChecked();
    expect(within(aktivitaet).getByRole('radio', { name: /Gemeindefest/ })).not.toBeChecked();
    fireEvent.change(zahl(dialog, 'Anzahl (Spezifische Aktivität)'), { target: { value: '4' } });
    fireEvent.click(within(aktivitaet).getByRole('radio', { name: /Sonntagsgottesdienst/ }));
    await speichern(dialog);
    expect(h.apiPut).toHaveBeenCalledTimes(1);
    expect(h.apiPut).toHaveBeenCalledWith('/admin/badges/7', {
      name: 'Chorprobe', icon: 'musicalNote', description: 'Dreimal beim Kirchenchor', criteria_type: 'specific_activity', criteria_value: 4,
      criteria_extra: { required_activity_name: 'Sonntagsgottesdienst' }, is_active: true, is_hidden: false, color: '#ffce00', target_role: 'konfi',
    });
    expect(h.track).not.toHaveBeenCalled();
    expect(props.onGespeichert).toHaveBeenCalledTimes(1);
  });

  it('zeitbasiert: 42 Tage stehen als 6 Wochen da, 8 Wochen gehen als 56 Tage zurueck', async () => {
    const dialog = await oeffnen(9);
    expect(zahl(dialog, 'Zeitraum (Wochen)')).toHaveValue(6);
    expect(im(dialog).getByRole('switch', { name: 'Geheim' })).toBeChecked();
    fireEvent.change(zahl(dialog, 'Zeitraum (Wochen)'), { target: { value: '8' } });
    await speichern(dialog);
    expect(h.apiPut).toHaveBeenCalledWith('/admin/badges/9', expect.objectContaining({ criteria_type: 'time_based', criteria_extra: { days: 56 }, is_hidden: true }));
  });

  it('„Badge neu prüfen": die Zahl steht im Dialog (nicht als Toast darunter), die Liste laedt, der Dialog bleibt', async () => {
    h.apiPost.mockResolvedValue({ data: { neu_vergeben: 2 } });
    const dialog = await oeffnen(7);
    expect(im(dialog).queryByRole('status')).toBeNull();
    await act(async () => { fireEvent.click(im(dialog).getByRole('button', { name: 'Badge neu prüfen' })); });
    expect(h.apiPost).toHaveBeenCalledTimes(1);
    expect(h.apiPost).toHaveBeenCalledWith('/admin/badges/7/pruefen');
    expect(im(dialog).getByRole('status')).toHaveTextContent('2 Badges neu vergeben');
    // Der Toast der App haengt in ion-app und laege unter dem Dialog.
    expect(h.setSuccess).not.toHaveBeenCalled();
    expect(props.onListeNeuLaden).toHaveBeenCalledTimes(1);
    expect(props.onSchliessen).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Badge bearbeiten' })).toBeInTheDocument();
    // Eine Aenderung am Formular nimmt die Meldung weg.
    fireEvent.change(feld(dialog, 'Name'), { target: { value: 'Chorprobe neu' } });
    expect(im(dialog).queryByRole('status')).toBeNull();
  });

  it('„Badge neu prüfen" ohne neue Vergabe: „Alle Badges sind aktuell" im Dialog, die Liste bleibt', async () => {
    h.apiPost.mockResolvedValue({ data: { neu_vergeben: 0 } });
    const dialog = await oeffnen(7);
    await act(async () => { fireEvent.click(im(dialog).getByRole('button', { name: 'Badge neu prüfen' })); });
    expect(im(dialog).getByRole('status')).toHaveTextContent('Alle Badges sind aktuell');
    expect(h.setSuccess).not.toHaveBeenCalled();
    expect(props.onListeNeuLaden).not.toHaveBeenCalled();
  });

  it('„Badge neu prüfen" gibt es nur fuer die Leitung (nicht fuer Teamer:innen)', async () => {
    h.user = { id: 3, organization_id: 1, role_name: 'teamer' };
    const dialog = await oeffnen(7);
    expect(im(dialog).queryByRole('button', { name: 'Badge neu prüfen' })).toBeNull();
  });

  it('laesst sich das Badge nicht laden, steht das im Dialog statt eines leeren Formulars', async () => {
    render(<WebBadgeFormular badgeId={404} targetRole="konfi" {...props} />);
    const dialog = screen.getByRole('dialog', { name: 'Badge bearbeiten' });
    expect(await im(dialog).findByRole('alert')).toHaveTextContent('Fehler beim Laden des Badges');
    expect(im(dialog).queryByRole('textbox', { name: 'Name' })).toBeNull();
    expect(im(dialog).getByRole('button', { name: 'Speichern' })).toBeDisabled();
  });
});

describe('Badge-Formular (Web): schliessen und abbrechen', () => {
  it('ohne Aenderung schliesst „Abbrechen" sofort und schickt nichts', async () => {
    const dialog = await oeffnen(7);
    fireEvent.click(im(dialog).getByRole('button', { name: 'Abbrechen' }));
    expect(props.onSchliessen).toHaveBeenCalledTimes(1);
    expect(h.apiPut).not.toHaveBeenCalled();
    expect(h.apiPost).not.toHaveBeenCalled();
  });

  it('mit Aenderung fragt es wie die App nach; erst „Verwerfen" schliesst, gesendet wird nichts', async () => {
    const dialog = await oeffnen(7);
    fireEvent.change(feld(dialog, 'Name'), { target: { value: 'Chorprobe neu' } });
    // Escape fragt wie „Abbrechen" und das X.
    fireEvent.keyDown(dialog, { key: 'Escape' });
    const frage = screen.getByRole('dialog', { name: 'Ungespeicherte Änderungen' });
    expect(frage).toHaveAccessibleDescription('Möchtest du die Änderungen verwerfen?');
    // Wie die Rückfragen der App im Browser: Warndreieck, „Verwerfen" rot gefüllt.
    erwarteWebRueckfrage(frage, 'warnung', 'Verwerfen');
    expect(props.onSchliessen).not.toHaveBeenCalled();
    fireEvent.click(within(frage).getByRole('button', { name: 'Abbrechen' }));
    expect(screen.queryByRole('dialog', { name: 'Ungespeicherte Änderungen' })).toBeNull();
    expect(feld(dialog, 'Name')).toHaveValue('Chorprobe neu');
    fireEvent.click(im(dialog).getByRole('button', { name: 'Abbrechen' }));
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Ungespeicherte Änderungen' })).getByRole('button', { name: 'Verwerfen' }));
    expect(props.onSchliessen).toHaveBeenCalledTimes(1);
    expect(h.apiPut).not.toHaveBeenCalled();
    expect(h.apiPost).not.toHaveBeenCalled();
  });

  it('auch eine andere Aktivitaet zaehlt als Aenderung', async () => {
    const dialog = await oeffnen(7);
    fireEvent.click(im(dialog).getByRole('radio', { name: /Gemeindefest/ }));
    fireEvent.click(im(dialog).getByRole('button', { name: 'Schließen' }));
    expect(screen.getByRole('dialog', { name: 'Ungespeicherte Änderungen' })).toBeInTheDocument();
    expect(props.onSchliessen).not.toHaveBeenCalled();
  });

  // Wie das X der App-Modale (`disabled={isSubmitting}`): Sonst ginge ein
  // Fehler des Servers ins Leere, und nach erneutem Öffnen ließe sich dasselbe
  // Badge sofort ein zweites Mal abschicken.
  it('während des Speicherns bleibt der Dialog offen: Abbrechen und X gesperrt, Escape und Klick daneben fragen nicht; lehnt der Server ab, ist er wieder frei', async () => {
    let ablehnen: (grund: unknown) => void = () => {};
    h.apiPut.mockReturnValue(new Promise((_, nein) => { ablehnen = nein; }));
    const dialog = await oeffnen(7);
    fireEvent.change(feld(dialog, 'Name'), { target: { value: 'Chorprobe neu' } });
    await speichern(dialog);
    expect(h.apiPut).toHaveBeenCalledTimes(1);
    const abbrechen = im(dialog).getByRole('button', { name: 'Abbrechen' });
    const x = im(dialog).getByRole('button', { name: 'Schließen' });
    expect(abbrechen).toBeDisabled();
    expect(x).toBeDisabled();
    fireEvent.click(abbrechen);
    fireEvent.click(x);
    fireEvent.keyDown(dialog, { key: 'Escape' });
    // Der abgedunkelte Grund um das Fenster.
    fireEvent.mouseDown(dialog.parentElement!);
    expect(screen.queryByRole('dialog', { name: 'Ungespeicherte Änderungen' })).toBeNull();
    expect(props.onSchliessen).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Badge bearbeiten' })).toBe(dialog);

    await act(async () => { ablehnen({ response: { status: 409, data: { error: 'Ein Badge mit diesem Namen gibt es schon' } } }); });
    expect(im(dialog).getByRole('alert')).toHaveTextContent('Ein Badge mit diesem Namen gibt es schon');
    expect(props.onGespeichert).not.toHaveBeenCalled();
    // Fertig gesendet: Abbrechen und X wieder frei, Escape fragt wie sonst nach.
    expect(abbrechen).toBeEnabled();
    expect(x).toBeEnabled();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.getByRole('dialog', { name: 'Ungespeicherte Änderungen' })).toBeInTheDocument();
    expect(props.onSchliessen).not.toHaveBeenCalled();
  });
});

describe('Badge-Formular (Web): ohne Netz', () => {
  it('ein Hinweis; Speichern legt das Badge in die Warteschlange wie in der App', async () => {
    h.online = false;
    const dialog = await oeffnen(null);
    expect(im(dialog).getByRole('status')).toHaveTextContent('Ohne Internetverbindung: Das Badge wird gespeichert, sobald du wieder online bist.');
    fireEvent.change(feld(dialog, 'Name'), { target: { value: 'Unterwegs' } });
    await speichern(dialog);
    expect(h.apiPost).not.toHaveBeenCalled();
    expect(h.enqueue).toHaveBeenCalledTimes(1);
    expect(h.enqueue).toHaveBeenCalledWith(expect.objectContaining({
      method: 'POST', url: '/admin/badges',
      body: {
        name: 'Unterwegs', icon: 'trophy', description: '', criteria_type: 'total_points', criteria_value: 10,
        criteria_extra: {}, is_active: true, is_hidden: false, color: '#ffd700', target_role: 'konfi',
      },
    }));
    expect(h.setSuccess).toHaveBeenCalledWith('Badge wird erstellt sobald du wieder online bist');
    expect(h.track).not.toHaveBeenCalled();
    expect(props.onGespeichert).toHaveBeenCalledTimes(1);
  });

  it('Bearbeiten ohne Netz: PUT in die Warteschlange', async () => {
    h.online = false;
    const dialog = await oeffnen(7);
    await speichern(dialog);
    expect(h.apiPut).not.toHaveBeenCalled();
    expect(h.enqueue).toHaveBeenCalledWith(expect.objectContaining({ method: 'PUT', url: '/admin/badges/7' }));
    expect(h.setSuccess).toHaveBeenCalledWith('Badge wird aktualisiert sobald du wieder online bist');
  });

  it('„Badge neu prüfen" ohne Netz: Meldung im Dialog statt eines stillen Fehlschlags', async () => {
    h.online = false;
    const dialog = await oeffnen(7);
    fireEvent.click(im(dialog).getByRole('button', { name: 'Badge neu prüfen' }));
    expect(im(dialog).getByRole('alert')).toHaveTextContent(OFFLINE_AKTION_MELDUNG);
    expect(h.apiPost).not.toHaveBeenCalled();
  });
});

describe('Badge-Formular (Web): Symbole per Tastatur', () => {
  it('ein Tabulator-Halt (das gewaehlte), die Pfeiltasten wandern, Enter/Klick waehlt', async () => {
    const dialog = await oeffnen(null);
    const pokal = im(dialog).getByRole('button', { name: 'Pokal' });
    const medaille = im(dialog).getByRole('button', { name: 'Medaille' });
    expect(pokal).toHaveAttribute('tabindex', '0');
    expect(medaille).toHaveAttribute('tabindex', '-1');
    pokal.focus();
    fireEvent.keyDown(pokal, { key: 'ArrowRight' });
    expect(medaille).toHaveFocus();
    fireEvent.keyDown(medaille, { key: 'ArrowLeft' });
    expect(pokal).toHaveFocus();
    fireEvent.click(medaille);
    expect(medaille).toHaveAttribute('aria-pressed', 'true');
    expect(pokal).toHaveAttribute('aria-pressed', 'false');
    expect(im(dialog).getByText('Gewählt: Medaille (Erfolg)')).toBeInTheDocument();
    await waitFor(() => expect(medaille).toHaveAttribute('tabindex', '0'));
  });
});
