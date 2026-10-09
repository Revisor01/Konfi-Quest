// Abmeldung nachtragen, Notiz und Anwesenheitsmatrix -- die Modale gerendert
// (Audit Tests 26.09.2026, BF-02; bis 09.10.2026 am Quelltext geprueft in
// abmeldungUndNotiz.test.ts).
//
// Die Termin-Detailansicht, die diese Modale oeffnet, und was sie mit deren
// Ergebnis an den Server schickt, prueft abmeldungUndNotiz.test.tsx. Hier
// geht es um das Innenleben: welche Felder es gibt, was "Speichern" und
// "Loeschen" an die Ansicht zurueckgeben, welcher Hinweis dasteht -- und wie
// die Matrix eine Abmeldung zeichnet.
//
// Simon, 13.09.2026: Die Notiz wurde zum Modal, die Abmeldung blieb ein Alert
// stehen -- inkonsequent, denn dieselbe Begruendung traegt bei beiden. Und:
// "Den Hinweis bei Notiz nicht ins Sheet sondern ins Handbuch." "Außerdem
// Vermerk löschen." "Der löschen Button hat keine ordentliche Stil."
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ICON_ENTFERNEN_GEFUELLT, ICON_KREIS_LEER } from '../../components/shared/icons';

const api = { get: vi.fn(), post: vi.fn() };
vi.mock('../../services/api', () => ({
  default: { get: (...a: unknown[]) => api.get(...a), post: (...a: unknown[]) => api.post(...a) },
}));
vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({ isOnline: true, setError: vi.fn(), setSuccess: vi.fn() }),
}));

type K = { children?: React.ReactNode; className?: string };
vi.mock('@ionic/react', () => {
  const durch = ({ children }: K) => <>{children}</>;
  const mitKlasse = (tag: string) => ({ children, className }: K) => React.createElement(tag, { className }, children);
  return {
    IonPage: mitKlasse('main'), IonHeader: durch, IonToolbar: durch, IonButtons: durch, IonContent: durch,
    IonTitle: ({ children }: K) => <h1>{children}</h1>,
    IonList: mitKlasse('section'), IonListHeader: mitKlasse('header'), IonItemGroup: durch, IonItem: durch,
    IonLabel: ({ children }: K) => <span>{children}</span>,
    IonCard: mitKlasse('div'), IonCardContent: mitKlasse('div'),
    IonNote: ({ children, className }: K) => <p className={className}>{children}</p>,
    IonSpinner: () => <span data-testid="laedt" />,
    IonIcon: ({ icon }: { icon?: string }) => <i data-icon={icon} />,
    IonPopover: () => null, IonInput: () => null,
    IonSelect: durch, IonSelectOption: () => null, IonSegment: durch, IonSegmentButton: durch,
    IonButton: ({ children, onClick, disabled, className, fill, color, 'aria-label': label }: K & {
      onClick?: () => void; disabled?: boolean; fill?: string; color?: string; 'aria-label'?: string;
    }) => (
      <button type="button" onClick={onClick} disabled={disabled} aria-label={label} className={className} data-fill={fill} data-color={color}>
        {children}
      </button>
    ),
    IonTextarea: ({ label, value, onIonInput, 'aria-label': ariaLabel }: {
      label?: string; value?: string; onIonInput?: (e: { detail: { value: string } }) => void; 'aria-label'?: string;
    }) => (
      <textarea aria-label={label ?? ariaLabel} value={value ?? ''} onChange={(e) => onIonInput?.({ detail: { value: e.target.value } })} />
    ),
  };
});

import AbmeldungNachtragenModal from '../../components/admin/modals/AbmeldungNachtragenModal';
import AnwesenheitNotizModal from '../../components/admin/modals/AnwesenheitNotizModal';
import AttendanceMatrixModal from '../../components/admin/modals/AttendanceMatrixModal';

const tippe = (feld: string, text: string) => fireEvent.change(screen.getByRole('textbox', { name: feld }), { target: { value: text } });
const warte = () => act(async () => { await Promise.resolve(); await Promise.resolve(); });

beforeEach(() => {
  api.get.mockReset();
  api.post.mockReset();
});

describe('Die Abmeldung nachtragen ist ein Modal', () => {
  const oeffne = (props: Partial<React.ComponentProps<typeof AbmeldungNachtragenModal>> = {}) => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const dismiss = vi.fn();
    render(<AbmeldungNachtragenModal teilnehmerName="Kim Konfi" onSave={onSave} dismiss={dismiss} {...props} />);
    return { onSave, dismiss };
  };

  it('das Modal folgt dem Muster der anderen Modals: Kopf, Schliessen, Speichern', () => {
    const { dismiss } = oeffne();
    expect(screen.getByRole('heading').textContent).toBe('Abmeldung');
    expect(screen.getByText('Abmeldung von Kim Konfi')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Schließen' }).className).toBe('app-modal-close-btn');
    expect(screen.getByRole('button', { name: 'Abmeldung speichern' }).className).toContain('app-modal-submit-btn');
    fireEvent.click(screen.getByRole('button', { name: 'Schließen' }));
    expect(dismiss).toHaveBeenCalledTimes(1);
  });

  it('es hat BEIDE Felder: Grund und Notiz -- genau zwei Textfelder', () => {
    oeffne();
    expect(screen.getAllByRole('textbox').map((f) => f.getAttribute('aria-label'))).toEqual(['Grund', 'Notiz (optional)']);
  });

  it('beide Felder gehen zusammen an den Handler, getrimmt -- danach schliesst das Modal', async () => {
    const { onSave, dismiss } = oeffne();
    tippe('Grund', '  krank, Mutter hat angerufen ');
    tippe('Notiz (optional)', ' Attest folgt  ');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Abmeldung speichern' })); });
    expect(onSave).toHaveBeenCalledWith('krank, Mutter hat angerufen', 'Attest folgt');
    expect(dismiss).toHaveBeenCalledTimes(1);
  });

  it('waehrend des Speicherns ist der Knopf gesperrt -- ein zweiter Tipp schickt nichts doppelt', async () => {
    let fertig: () => void = () => undefined;
    const onSave = vi.fn(() => new Promise<void>((r) => { fertig = r; }));
    render(<AbmeldungNachtragenModal teilnehmerName="Kim Konfi" onSave={onSave} dismiss={vi.fn()} />);
    const knopf = screen.getByRole('button', { name: 'Abmeldung speichern' }) as HTMLButtonElement;
    await act(async () => { fireEvent.click(knopf); });
    expect((screen.getByRole('button', { name: 'Abmeldung speichern' }) as HTMLButtonElement).disabled).toBe(true);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Abmeldung speichern' })); });
    expect(onSave).toHaveBeenCalledTimes(1);
    await act(async () => { fertig(); });
  });

  it('beim Bearbeiten stehen Grund und Notiz schon drin', () => {
    oeffne({ grund: 'krank', notiz: 'Attest' });
    expect((screen.getByRole('textbox', { name: 'Grund' }) as HTMLTextAreaElement).value).toBe('krank');
    expect((screen.getByRole('textbox', { name: 'Notiz (optional)' }) as HTMLTextAreaElement).value).toBe('Attest');
  });

  it('der Hinweis ist kurz und richtig: die tatsaechliche Folge, nicht "erfährt davon nichts"', () => {
    oeffne();
    expect(screen.getByText('Keine Punkte. Die Konfi bekommt eine Mitteilung, dass die Abmeldung eingetragen wurde.')).toBeTruthy();
    expect(document.body.textContent).not.toContain('erfährt davon nichts');
  });

  it('der Erklaertext bleibt im Handbuch, nicht in der Oberflaeche', () => {
    // Ein Satz zur Folge darf stehen, der Vergleich mit der Selbstabmeldung
    // gehoert ins Handbuch.
    oeffne();
    expect(document.body.textContent).not.toContain('Abgemeldet (nachgetragen)');
  });
});

describe('Die Notiz-Eingabe ist ein Modal', () => {
  const oeffne = (notiz?: string | null) => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const dismiss = vi.fn();
    render(<AnwesenheitNotizModal teilnehmerName="Kim Konfi" notiz={notiz} onSave={onSave} dismiss={dismiss} />);
    return { onSave, dismiss };
  };
  const speichern = () => screen.getByRole('button', { name: 'Notiz speichern' }) as HTMLButtonElement;

  it('das Modal folgt dem Muster der anderen Modals: Kopf, Schliessen, Speichern, ein Textfeld', () => {
    oeffne();
    expect(screen.getByRole('heading').textContent).toBe('Notiz');
    expect(screen.getByRole('button', { name: 'Schließen' }).className).toBe('app-modal-close-btn');
    expect(speichern().className).toContain('app-modal-submit-btn');
    expect(screen.getAllByRole('textbox').map((f) => f.getAttribute('aria-label'))).toEqual(['Notiz zu Kim Konfi']);
  });

  it('der erklaerende Hinweistext steht NICHT mehr in der Oberflaeche', () => {
    // Simon: "Den Hinweis bei Notiz nicht ins Sheet sondern ins Handbuch."
    oeffne('ging um 14 Uhr');
    expect(document.body.textContent).not.toContain('Am Status ändert er nichts');
    expect(document.body.textContent).not.toContain('Ein freier Vermerk zur Anwesenheit');
  });

  it('speichert den getrimmten Text', async () => {
    const { onSave, dismiss } = oeffne();
    tippe('Notiz zu Kim Konfi', '  ging um 14 Uhr ');
    await act(async () => { fireEvent.click(speichern()); });
    expect(onSave).toHaveBeenCalledWith('ging um 14 Uhr');
    expect(dismiss).toHaveBeenCalledTimes(1);
  });
});

describe('Eine Notiz laesst sich loeschen', () => {
  const oeffne = (notiz?: string | null) => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(<AnwesenheitNotizModal teilnehmerName="Kim Konfi" notiz={notiz} onSave={onSave} dismiss={vi.fn()} />);
    return onSave;
  };
  const loeschen = () => screen.queryByRole('button', { name: /Notiz löschen/ });

  it('das Modal hat einen roten Loeschen-Knopf im globalen Gefahren-Stil', () => {
    oeffne('ging um 14 Uhr');
    const knopf = loeschen()!;
    expect(knopf.getAttribute('data-color')).toBe('danger');
    expect(knopf.className).toBe('app-gefahr-knopf');
    // Der blasse Textknopf war genau das Problem.
    expect(knopf.getAttribute('data-fill')).toBe('outline');
  });

  it('der Knopf erscheint nur, wenn es etwas zu loeschen gibt', () => {
    oeffne(null);
    expect(loeschen()).toBeNull();
    document.body.innerHTML = '';
    oeffne('   ');
    expect(loeschen()).toBeNull();
  });

  it('geloescht wird mit einem leeren String, nicht mit einem zweiten Feld', async () => {
    const onSave = oeffne('ging um 14 Uhr');
    await act(async () => { fireEvent.click(loeschen()!); });
    expect(onSave).toHaveBeenCalledWith('');
    expect(onSave.mock.calls[0]).toHaveLength(1);
  });

  it('ein leeres Feld wird beim Speichern ebenfalls als Loeschen gewertet -- aber nur, wenn es eine Notiz gab', async () => {
    const onSave = oeffne('ging um 14 Uhr');
    tippe('Notiz zu Kim Konfi', '   ');
    const speichern = screen.getByRole('button', { name: 'Notiz speichern' }) as HTMLButtonElement;
    expect(speichern.disabled).toBe(false);
    await act(async () => { fireEvent.click(speichern); });
    expect(onSave).toHaveBeenCalledWith('');
    document.body.innerHTML = '';
    // Ohne bestehende Notiz gibt es nichts zu speichern.
    oeffne(null);
    expect((screen.getByRole('button', { name: 'Notiz speichern' }) as HTMLButtonElement).disabled).toBe(true);
    tippe('Notiz zu Kim Konfi', '   ');
    expect((screen.getByRole('button', { name: 'Notiz speichern' }) as HTMLButtonElement).disabled).toBe(true);
  });
});

describe('Anwesenheitsmatrix zeigt die Abmeldung', () => {
  const MATRIX = {
    jahrgang: { id: 3, name: '2026/27' },
    konfis: [{ user_id: 11, display_name: 'Kim Konfi' }, { user_id: 12, display_name: 'Lea Konfi' }],
    events: [{ id: 1, name: 'Gottesdienst', event_date: '2026-09-06T08:00:00Z' }],
    bookings: [
      { event_id: 1, user_id: 11, status: 'excused', attendance_status: 'excused', excuse_reason: 'krank', attendance_note: 'Attest folgt' },
      { event_id: 1, user_id: 12, status: 'opted_out', attendance_status: null },
    ],
  };
  const oeffne = async () => {
    api.get.mockResolvedValue({ data: MATRIX });
    render(<AttendanceMatrixModal jahrgaenge={[{ id: 3, name: '2026/27' }]} onClose={() => undefined} />);
    await warte();
  };
  const zelleVon = (name: string) => screen.getByText(name).closest('tr')!.querySelector('.attendance-matrix__td-cell') as HTMLElement;

  it('das Modal kennt den Zellstatus und zeichnet beide Abmeldungen mit dem Abmelde-Zeichen', async () => {
    await oeffne();
    expect(api.get).toHaveBeenCalledWith('/admin/jahrgaenge/3/attendance-matrix');
    const nachgetragen = zelleVon('Kim Konfi').querySelector('.attendance-matrix__dot')!;
    const selbst = zelleVon('Lea Konfi').querySelector('.attendance-matrix__dot')!;
    expect(nachgetragen.className).toBe('attendance-matrix__dot attendance-matrix__dot--excused');
    expect(selbst.className).toBe('attendance-matrix__dot attendance-matrix__dot--opted_out');
    for (const punkt of [nachgetragen, selbst]) {
      expect(punkt.querySelector('i')!.getAttribute('data-icon')).toBe(ICON_ENTFERNEN_GEFUELLT);
      expect(punkt.querySelector('i')!.getAttribute('data-icon')).not.toBe(ICON_KREIS_LEER);
    }
  });

  it('die graue Farbe der nachgetragenen Abmeldung steht im Stylesheet (Stil-Waechter)', async () => {
    const { readFileSync } = await import('fs');
    const { resolve } = await import('path');
    expect(readFileSync(resolve(process.cwd(), 'src/theme/variables.css'), 'utf8')).toContain('.attendance-matrix__dot--excused {');
  });

  it('die Legende benennt beide Abmelde-Wege getrennt', async () => {
    await oeffne();
    const legende = [...document.querySelectorAll('.attendance-matrix__legend-item')].map((e) => e.textContent);
    expect(legende).toEqual(['Anwesend', 'Fehlt', 'Abgemeldet', 'Abgemeldet (nachgetragen)', 'Offen']);
  });

  it('Grund und Notiz haengen als Hinweis an der Zelle -- ohne beides kein Hinweis', async () => {
    await oeffne();
    expect(zelleVon('Kim Konfi').getAttribute('title')).toBe('krank · Attest folgt');
    expect(zelleVon('Lea Konfi').hasAttribute('title')).toBe(false);
  });

  it('die Summe zaehlt Abmeldungen nicht in den Nenner', async () => {
    // Beide sind abgemeldet: 0 von 0, nicht 0 von 1.
    await oeffne();
    const summe = (name: string) => screen.getByText(name).closest('tr')!.querySelector('.attendance-matrix__summary-text')!.textContent;
    expect(summe('Kim Konfi')).toBe('0/0');
    expect(summe('Lea Konfi')).toBe('0/0');
  });
});
