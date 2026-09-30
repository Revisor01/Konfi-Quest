// Ende vor Beginn wird im Termin-Formular abgewiesen (Audit 26.09.2026,
// Leitung BF-03) -- gerendert (Audit Tests 26.09.2026, BF-02; vorher
// Quelltext-Test, 30.09.2026 umgestellt).
//
// DER BEFUND: Das Formular prüfte Name, Datum und Pflicht-ohne-Jahrgang, aber
// nie, ob das Ende nach dem Beginn liegt. Der Ende-Picker hatte kein `min`.
// Wer beim Ende versehentlich einen früheren Tag wählte, speicherte ohne
// Warnung; die Leitungsliste sortierte den Termin sofort unter "Vergangen".
//
// Geprüft wird die Regel selbst (endeVorBeginn, dieselbe wie im Backend) und
// das gerenderte Formular: der Ende-Picker beginnt beim Beginn, und Speichern
// bricht mit der Meldung ab, bevor etwas gesendet wird.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';

const api = { get: vi.fn(), post: vi.fn(), put: vi.fn() };
vi.mock('../../services/api', () => ({
  default: {
    get: (...a: unknown[]) => api.get(...a),
    post: (...a: unknown[]) => api.post(...a),
    put: (...a: unknown[]) => api.put(...a),
    delete: vi.fn(),
  },
}));
const setError = vi.fn();
vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({ user: { id: 5, organization_id: 1, role_name: 'org_admin' }, setError, setSuccess: vi.fn(), isOnline: true }),
}));
const enqueue = vi.fn();
vi.mock('../../services/writeQueue', () => ({ writeQueue: { enqueue: (...a: unknown[]) => enqueue(...a) } }));
vi.mock('../../services/networkMonitor', () => ({ networkMonitor: { isOnline: true, subscribe: () => () => {} } }));
vi.mock('../../services/analytics', async (original) => ({
  ...(await original<typeof import('../../services/analytics')>()),
  trackHandlung: vi.fn(),
}));

type K = { children?: React.ReactNode };
type Aenderung = (e: { detail: { value: string | boolean } }) => void;
vi.mock('@ionic/react', () => {
  const durch = ({ children }: K) => <>{children}</>;
  return {
    IonPage: durch, IonHeader: durch, IonToolbar: durch, IonTitle: durch, IonContent: durch, IonButtons: durch,
    IonList: durch, IonListHeader: durch, IonLabel: durch, IonCard: durch, IonCardContent: durch, IonItem: durch,
    IonAccordion: durch, IonAccordionGroup: durch, IonModal: durch,
    IonIcon: () => null, IonSpinner: () => null, IonDatetimeButton: () => null, IonRange: () => null,
    IonSelect: () => null, IonSelectOption: () => null, IonTextarea: () => null,
    IonToggle: () => null,
    IonButton: ({ children, onClick, disabled, 'aria-label': label }: K & { onClick?: () => void; disabled?: boolean; 'aria-label'?: string }) =>
      <button type="button" onClick={onClick} disabled={disabled} aria-label={label}>{children}</button>,
    IonInput: ({ value, onIonInput, 'aria-label': label }: { value?: string; onIonInput?: Aenderung; 'aria-label'?: string }) =>
      <input aria-label={label} value={value ?? ''} onChange={(e) => onIonInput?.({ detail: { value: e.target.value } })} />,
    // Der Picker als Eingabefeld: Wert, Untergrenze (min) und Änderung.
    IonDatetime: ({ id, value, min, onIonChange, 'aria-label': label }: {
      id?: string; value?: string; min?: string; onIonChange?: Aenderung; 'aria-label'?: string;
    }) => (
      <input aria-label={label} data-id={id} data-min={min ?? ''} value={value ?? ''}
        onChange={(e) => onIonChange?.({ detail: { value: e.target.value } })} />
    ),
  };
});

import EventModal from '../../components/admin/modals/EventModal';
import { endeVorBeginn, ENDE_VOR_BEGINN } from '../../utils/terminVorbelegung';
import type { Event } from '../../types/event';

beforeEach(() => {
  vi.clearAllMocks();
  api.get.mockResolvedValue({ data: [] });
  api.post.mockResolvedValue({ data: {} });
  api.put.mockResolvedValue({ data: {} });
});

describe('endeVorBeginn: die Regel', () => {
  it('Ende einen Tag vor dem Beginn ist ein Widerspruch', () => {
    expect(endeVorBeginn('2026-10-10T18:00:00', '2026-10-09T20:00:00')).toBe(true);
  });
  it('auch eine Viertelstunde zu früh', () => {
    expect(endeVorBeginn('2026-10-10T18:00:00', '2026-10-10T17:45:00')).toBe(true);
  });
  it('Ende nach dem Beginn ist in Ordnung', () => {
    expect(endeVorBeginn('2026-10-10T18:00:00', '2026-10-10T20:00:00')).toBe(false);
  });
  it('Ende genau auf dem Beginn ist erlaubt', () => {
    expect(endeVorBeginn('2026-10-10T18:00:00', '2026-10-10T18:00:00')).toBe(false);
  });
  it('kein Ende ist erlaubt', () => {
    expect(endeVorBeginn('2026-10-10T18:00:00', '')).toBe(false);
  });
  it('ein unlesbarer Wert ist nicht Sache dieser Prüfung', () => {
    expect(endeVorBeginn('2026-10-10T18:00:00', 'kein Datum')).toBe(false);
  });
  it('die Meldung ist wortgleich mit dem Backend', () => {
    expect(ENDE_VOR_BEGINN).toBe('Das Ende liegt vor dem Beginn');
  });
});

const TERMIN = {
  id: 7, name: 'Konfi-Freizeit', description: '', event_date: '2026-10-10T16:00:00.000Z', event_end_time: '2026-10-10T18:00:00.000Z',
  location: '', points: 2, point_type: 'gemeinde', type: 'event', max_participants: 20, registered_count: 0,
  categories: [], jahrgaenge: [], has_timeslots: false,
} as unknown as Event;

const oeffne = async (event?: Event) => {
  render(<EventModal event={event ?? null} onClose={vi.fn()} onSuccess={vi.fn()} />);
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
};
const picker = (id: string) => document.querySelector(`[data-id="${id}"]`) as HTMLInputElement;
const setze = (id: string, wert: string) => fireEvent.change(picker(id), { target: { value: wert } });
const speichern = async () => { await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Event speichern' })); }); };

describe('Das Termin-Formular benutzt die Regel', () => {
  it('der Ende-Picker beginnt beim Beginn (min) -- und wandert mit, wenn der Beginn sich ändert', async () => {
    await oeffne(TERMIN);
    expect(picker('end-time-picker').dataset.min).toBe(picker('event-date-picker').value);
    expect(picker('end-time-picker').dataset.min).not.toBe('');

    setze('event-date-picker', '2026-10-12T09:00:00');
    expect(picker('end-time-picker').dataset.min).toBe('2026-10-12T09:00:00');
  });

  it('Bearbeiten: Ende vor Beginn -> Meldung, und es wird nichts gesendet', async () => {
    await oeffne(TERMIN);
    setze('end-time-picker', '2026-10-09T20:00:00');
    await speichern();
    expect(setError).toHaveBeenCalledWith('Das Ende liegt vor dem Beginn');
    expect(api.put).not.toHaveBeenCalled();
    expect(api.post).not.toHaveBeenCalled();
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('Neu anlegen: Ende vor Beginn -> Meldung, kein POST', async () => {
    await oeffne();
    fireEvent.change(screen.getByRole('textbox', { name: 'Event-Name' }), { target: { value: 'Gemeindefest' } });
    const beginn = picker('event-date-picker').value;
    const frueher = new Date(new Date(beginn).getTime() - 15 * 60 * 1000);
    const pad = (n: number) => String(n).padStart(2, '0');
    setze('end-time-picker', `${frueher.getFullYear()}-${pad(frueher.getMonth() + 1)}-${pad(frueher.getDate())}T${pad(frueher.getHours())}:${pad(frueher.getMinutes())}:00`);
    await speichern();
    expect(setError).toHaveBeenCalledWith('Das Ende liegt vor dem Beginn');
    expect(api.post).not.toHaveBeenCalled();
  });

  it('Gegenprobe: Ende nach dem Beginn wird gespeichert', async () => {
    await oeffne(TERMIN);
    setze('end-time-picker', '2026-10-10T22:00:00');
    await speichern();
    expect(setError).not.toHaveBeenCalledWith('Das Ende liegt vor dem Beginn');
    expect(api.put).toHaveBeenCalledTimes(1);
    expect(api.put.mock.calls[0][0]).toBe('/events/7');
  });
});
