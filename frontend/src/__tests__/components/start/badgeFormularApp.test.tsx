// Das Badge-Formular der App (BadgeManagementModal), gerendert (11.10.2026).
// Haelt fest, wie die App sich verhaelt -- Felder, Vorbelegung, Zielgruppe
// wechseln, Speichern mit genau diesem Koerper an genau diese Route,
// Warteschlange ohne Netz --, damit sie sich nicht veraendert, wenn ihre Logik
// mit dem Dialog der Web-Fassung geteilt wird. Dazu zwei Fehler der App, die
// beim Bau des Web-Dialogs auffielen (nachgestellt im Browser gegen das
// Test-Backend):
//   - Beim Bearbeiten einer „Spezifischen Aktivität" stand die Auswahl leer
//     da: Der Ladeschritt las die Aktivitaeten aus einem veralteten Stand
//     (leere Liste), und Speichern scheiterte mit „Bitte eine Aktivität
//     auswählen".
//   - Ein neues zeitbasiertes Badge zeigte „4 Wochen", schickte aber keinen
//     Zeitraum mit; der Server lehnte mit „Bitte einen Zeitraum angeben" ab.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import './zeitrahmen';
import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
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

vi.mock('@ionic/react', async () => {
  const basis = (await import('../support/ionicAttrappe')).ionicAttrappe();
  const durch = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
  return {
    ...basis,
    IonAccordionGroup: durch,
    IonAccordion: durch,
    IonText: ({ children }: { children?: React.ReactNode }) => <span>{children}</span>,
    IonRange: ({ 'aria-label': label, value, min, max, disabled, onIonChange }: {
      'aria-label'?: string; value?: number; min?: number; max?: number; disabled?: boolean;
      onIonChange?: (e: { detail: { value: number } }) => void;
    }) => (
      <input type="range" aria-label={label} value={value} min={min} max={max} disabled={disabled}
        onChange={(e) => onIonChange?.({ detail: { value: Number(e.target.value) } })} />
    ),
  };
});
vi.mock('../../../services/api', () => ({ default: { get: h.apiGet, post: h.apiPost, put: h.apiPut } }));
vi.mock('../../../services/writeQueue', () => ({ writeQueue: { enqueue: h.enqueue } }));
vi.mock('../../../services/networkMonitor', () => ({ networkMonitor: { get isOnline() { return h.online; } } }));
vi.mock('../../../services/analytics', () => ({ trackHandlung: h.track }));
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({ user: h.user, setError: h.setError, setSuccess: h.setSuccess, isOnline: h.online }),
}));

import BadgeManagementModal from '../../../components/admin/modals/BadgeManagementModal';

const BADGES = [
  gespeichertesBadge({ id: 7 }),
  gespeichertesBadge({
    id: 8, name: 'Rundgang', icon: 'compass', description: '', criteria_type: 'activity_combination', criteria_value: 2,
    criteria_extra: JSON.stringify({ required_activities: ['Sonntagsgottesdienst', 'Kirchenchor'] }), color: '#7044ff',
  }),
  gespeichertesBadge({
    id: 9, name: 'Dranbleiben', icon: 'flame', description: '', criteria_type: 'time_based', criteria_value: 5,
    criteria_extra: JSON.stringify({ days: 42 }), color: '#8e8e93', is_hidden: true,
  }),
];

const props = { onClose: vi.fn(), onSuccess: vi.fn(), onDirtyChange: vi.fn(), onRefreshList: vi.fn() };

beforeEach(() => {
  vi.clearAllMocks();
  h.online = true;
  h.user = { id: 5, organization_id: 1, role_name: 'org_admin' };
  h.apiGet.mockImplementation(badgeServer(BADGES));
  h.apiPost.mockResolvedValue({ data: { id: 31 } });
  h.apiPut.mockResolvedValue({ data: {} });
  h.enqueue.mockResolvedValue(undefined);
});

const neu = async (rolle: 'konfi' | 'teamer' = 'konfi') => {
  render(<BadgeManagementModal targetRole={rolle} {...props} />);
  await screen.findByRole('textbox', { name: 'Name' });
};
const bearbeiten = async (id: number) => {
  render(<BadgeManagementModal badgeId={id} targetRole="konfi" {...props} />);
  await waitFor(() => expect((screen.getByRole('textbox', { name: 'Name' }) as HTMLInputElement).value).not.toBe(''));
};
const speichern = async () => {
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Badge speichern' })); });
};
const zeile = (titel: string) => screen.getByText(titel, { selector: '.app-list-item__title' }).closest('.app-list-item') as HTMLElement;

describe('Badge-Formular der App: Aufbau wie bisher', () => {
  it('neues Badge: Titel, Zielgruppe, Felder und die Vorbelegung fuer Konfis', async () => {
    await neu();
    expect(screen.getByRole('heading', { level: 1, name: 'Neues Badge' })).toBeInTheDocument();
    expect(screen.getByText('Zielgruppe')).toBeInTheDocument();
    expect(zeile('Konfis').className).toContain('app-list-item--selected');
    expect(zeile('Team').className).not.toContain('app-list-item--selected');
    expect(screen.getByRole('textbox', { name: 'Beschreibung' })).toHaveValue('');
    expect(screen.getByText('Pokal (Erfolg)')).toBeInTheDocument();
    expect(screen.getByText('Gesamtpunkte', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'Punkte' })).toHaveValue('10');
    expect(screen.getByRole('checkbox', { name: 'Aktiv' })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Geheim' })).not.toBeChecked();
    // Ohne Namen ist Speichern gesperrt, wie bisher.
    expect(screen.getByRole('button', { name: 'Badge speichern' })).toBeDisabled();
    expect(screen.queryByText('Badge neu prüfen')).toBeNull();
  });

  it('Team: die Punkte-Kriterien fehlen, Teamer-Jahre stehen da', async () => {
    await neu('teamer');
    fireEvent.click(zeile('Team'));
    expect(screen.queryByText('Gesamtpunkte', { selector: '.app-list-item__title' })).toBeNull();
    expect(screen.queryByText('Pflicht-Anwesenheit', { selector: '.app-list-item__title' })).toBeNull();
    expect(screen.getByText('Teamer-Jahre', { selector: '.app-list-item__title' })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'Anzahl (Aktivitäten & Events)' })).toHaveValue('5');
  });

  it('Zielgruppe wechseln: Bedingung, Wert und Farbe springen auf die Vorgabe der Gruppe, der Koerper traegt sie', async () => {
    await neu();
    const farbfeld = () => document.querySelector('input[type="color"]') as HTMLInputElement;
    // Vorher eine andere Bedingung und Farbe: der Wechsel setzt beides zurueck.
    fireEvent.click(zeile('Serie'));
    fireEvent.change(farbfeld(), { target: { value: '#123456' } });

    fireEvent.click(zeile('Team'));
    expect(zeile('Team').className).toContain('app-list-item--selected');
    expect(zeile('Konfis').className).not.toContain('app-list-item--selected');
    expect(screen.queryByText('Gesamtpunkte', { selector: '.app-list-item__title' })).toBeNull();
    expect(screen.queryByText('Serie', { selector: '.app-list-item__title' })).toBeNull();
    expect(screen.getByText('Teamer-Jahre', { selector: '.app-list-item__title' })).toBeInTheDocument();
    expect(screen.getByText('Aktivitäten & Events', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByRole('slider', { name: 'Anzahl (Aktivitäten & Events)' })).toHaveValue('5');
    expect(farbfeld()).toHaveValue('#3880ff');

    fireEvent.click(zeile('Konfis'));
    expect(screen.getByText('Gesamtpunkte', { selector: 'p' })).toBeInTheDocument();
    expect(screen.queryByText('Teamer-Jahre', { selector: '.app-list-item__title' })).toBeNull();
    expect(screen.getByRole('slider', { name: 'Punkte' })).toHaveValue('10');
    expect(farbfeld()).toHaveValue('#ffd700');

    fireEvent.click(zeile('Team'));
    fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value: 'Mit dabei' } });
    await speichern();
    expect(h.apiPost).toHaveBeenCalledWith('/admin/badges', {
      name: 'Mit dabei', icon: 'trophy', description: '', criteria_type: 'activity_count', criteria_value: 5,
      criteria_extra: {}, is_active: true, is_hidden: false, color: '#3880ff', target_role: 'teamer',
    });
    expect(h.track).toHaveBeenCalledWith('badge-angelegt', { zielgruppe: 'teamer' });
  });
});

describe('Badge-Formular der App: Speichern', () => {
  it('neues Badge schickt genau diesen Koerper an POST /admin/badges und misst das Anlegen', async () => {
    await neu();
    fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value: 'Fleißig' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Beschreibung' }), { target: { value: 'Viele Punkte' } });
    await speichern();
    expect(h.apiPost).toHaveBeenCalledTimes(1);
    expect(h.apiPost).toHaveBeenCalledWith('/admin/badges', {
      name: 'Fleißig', icon: 'trophy', description: 'Viele Punkte', criteria_type: 'total_points', criteria_value: 10,
      criteria_extra: {}, is_active: true, is_hidden: false, color: '#ffd700', target_role: 'konfi',
    });
    expect(h.track).toHaveBeenCalledWith('badge-angelegt', { zielgruppe: 'konfi' });
    expect(props.onSuccess).toHaveBeenCalledTimes(1);
    expect(h.enqueue).not.toHaveBeenCalled();
  });

  it('ohne Netz landet das neue Badge in der Warteschlange, mit Meldung', async () => {
    h.online = false;
    await neu();
    fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value: 'Offline' } });
    await speichern();
    expect(h.apiPost).not.toHaveBeenCalled();
    expect(h.enqueue).toHaveBeenCalledWith(expect.objectContaining({
      method: 'POST', url: '/admin/badges',
      body: {
        name: 'Offline', icon: 'trophy', description: '', criteria_type: 'total_points', criteria_value: 10,
        criteria_extra: {}, is_active: true, is_hidden: false, color: '#ffd700', target_role: 'konfi',
      },
    }));
    expect(h.setSuccess).toHaveBeenCalledWith('Badge wird erstellt sobald du wieder online bist');
    expect(h.track).not.toHaveBeenCalled();
  });

  it('der Server lehnt ab: seine Meldung steht oben, das Formular bleibt offen', async () => {
    h.apiPost.mockRejectedValue({ response: { status: 409, data: { error: 'Ein Badge mit diesem Namen gibt es schon' } } });
    await neu();
    fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value: 'Doppelt' } });
    await speichern();
    expect(h.setError).toHaveBeenCalledWith('Ein Badge mit diesem Namen gibt es schon');
    expect(props.onSuccess).not.toHaveBeenCalled();
  });
});

describe('Badge-Formular der App: Bearbeiten', () => {
  it('„Spezifische Aktivität": die gespeicherte Aktivitaet ist gewaehlt und geht beim Speichern mit', async () => {
    await bearbeiten(7);
    expect(screen.getByRole('heading', { level: 1, name: 'Badge bearbeiten' })).toBeInTheDocument();
    expect(screen.getByText('Kirchenchor (Gemeinde)')).toBeInTheDocument();
    expect(zeile('Kirchenchor').className).toContain('app-list-item--selected');
    expect(zeile('Gemeindefest').className).not.toContain('app-list-item--selected');
    await speichern();
    expect(h.apiPut).toHaveBeenCalledWith('/admin/badges/7', {
      name: 'Chorprobe', icon: 'musicalNote', description: 'Dreimal beim Kirchenchor', criteria_type: 'specific_activity', criteria_value: 3,
      criteria_extra: { required_activity_name: 'Kirchenchor' }, is_active: true, is_hidden: false, color: '#ffce00', target_role: 'konfi',
    });
  });

  it('„Aktivitäts-Kombination": die gespeicherten Aktivitaeten sind gewaehlt', async () => {
    await bearbeiten(8);
    expect(screen.getByText('Sonntagsgottesdienst, Kirchenchor')).toBeInTheDocument();
    await speichern();
    expect(h.apiPut).toHaveBeenCalledWith('/admin/badges/8', expect.objectContaining({
      criteria_type: 'activity_combination', criteria_extra: { required_activities: ['Sonntagsgottesdienst', 'Kirchenchor'] },
    }));
  });

  it('„Zeitbasiert": 42 Tage stehen als 6 Wochen da und gehen als 42 Tage zurueck', async () => {
    await bearbeiten(9);
    expect(screen.getByRole('slider', { name: 'Zeitraum (Wochen)' })).toHaveValue('6');
    expect(screen.getByRole('checkbox', { name: 'Geheim' })).toBeChecked();
    await speichern();
    expect(h.apiPut).toHaveBeenCalledWith('/admin/badges/9', expect.objectContaining({ criteria_extra: { days: 42 }, is_hidden: true }));
  });

  it('„Badge neu prüfen" fuer die Gemeindeleitung: meldet die Zahl und laedt die Liste', async () => {
    h.apiPost.mockResolvedValue({ data: { neu_vergeben: 2 } });
    await bearbeiten(7);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Badge neu prüfen' })); });
    expect(h.apiPost).toHaveBeenCalledWith('/admin/badges/7/pruefen');
    expect(h.setSuccess).toHaveBeenCalledWith('2 Badges neu vergeben');
    expect(props.onRefreshList).toHaveBeenCalledTimes(1);
  });
});

describe('Badge-Formular der App: neues zeitbasiertes Badge', () => {
  it('schickt die angezeigten 4 Wochen als 28 Tage mit, auch ohne den Regler anzufassen', async () => {
    await neu();
    fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), { target: { value: 'Am Ball' } });
    fireEvent.click(zeile('Zeitbasiert'));
    expect(screen.getByRole('slider', { name: 'Zeitraum (Wochen)' })).toHaveValue('4');
    await speichern();
    expect(h.apiPost).toHaveBeenCalledWith('/admin/badges', expect.objectContaining({
      criteria_type: 'time_based', criteria_value: 10, criteria_extra: { days: 28 }, color: '#8e8e93',
    }));
  });
});
