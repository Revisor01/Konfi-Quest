import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// Ionic-Overlays rendern in jsdom nur <template>. Stubs, um die Verdrahtung
// zu pruefen — hier geht es um den Text der Leiste und darum, wann sie
// ueberhaupt erscheint.
vi.mock('@ionic/react', () => ({
  IonIcon: (props: any) => <span data-testid="icon" data-icon={props.icon} aria-hidden={props['aria-hidden']} />,
  IonModal: (props: any) => (props.isOpen ? <div data-testid="modal">{props.children}</div> : null),
  IonHeader: (props: any) => <div>{props.children}</div>,
  IonToolbar: (props: any) => <div>{props.children}</div>,
  IonTitle: (props: any) => <div>{props.children}</div>,
  IonButtons: (props: any) => <div>{props.children}</div>,
  IonButton: (props: any) => <button onClick={props.onClick}>{props.children}</button>,
  IonContent: (props: any) => <div>{props.children}</div>,
  IonList: (props: any) => <div>{props.children}</div>,
  IonListHeader: (props: any) => <div>{props.children}</div>,
  IonCard: (props: any) => <div>{props.children}</div>,
  IonCardContent: (props: any) => <div>{props.children}</div>,
  IonLabel: (props: any) => <div>{props.children}</div>,
}));

let mockWartend: any[] = [];
let mockGescheitert: any[] = [];

vi.mock('../../hooks/useWartendeVorgaenge', () => ({
  useWartendeVorgaenge: () => ({
    wartend: mockWartend,
    gescheitert: mockGescheitert,
    vergessen: vi.fn(),
    alleVergessen: vi.fn(),
  }),
}));

import WartendeVorgaengeLeiste from '../../components/common/WartendeVorgaengeLeiste';

const item = (id: string, label: string) => ({
  id, method: 'POST', url: '/x', maxRetries: 3, retryCount: 0,
  createdAt: 0, hasFileUpload: false,
  metadata: { type: 'admin', clientId: id, label },
});

describe('WartendeVorgaengeLeiste', () => {
  beforeEach(() => {
    mockWartend = [];
    mockGescheitert = [];
  });

  it('bleibt unsichtbar, solange nichts aussteht', () => {
    const { container } = render(<WartendeVorgaengeLeiste />);
    expect(container.querySelector('.app-wartende-leiste')).toBeNull();
  });

  it('zeigt einen wartenden Vorgang im Singular', () => {
    mockWartend = [item('a', 'Kategorie erstellen')];
    render(<WartendeVorgaengeLeiste />);
    expect(screen.getByLabelText(/1 Vorgang wird gesendet/)).toBeTruthy();
  });

  it('zeigt mehrere wartende Vorgaenge im Plural', () => {
    mockWartend = [item('a', 'Kategorie erstellen'), item('b', 'Jahrgang bearbeiten')];
    render(<WartendeVorgaengeLeiste />);
    expect(screen.getByLabelText(/2 Vorgänge werden gesendet/)).toBeTruthy();
  });

  it('faerbt sich rot, wenn nur noch Fehlschlaege uebrig sind', () => {
    mockGescheitert = [
      { id: 'f1', label: 'Abmeldung', type: 'opt-out', createdAt: 0, failedAt: 0,
        error: { status: 409, message: 'Konflikt' } },
    ];
    const { container } = render(<WartendeVorgaengeLeiste />);

    const leiste = container.querySelector('.app-wartende-leiste');
    expect(leiste?.getAttribute('data-variante')).toBe('danger');
    expect(screen.getByLabelText(/1 Vorgang wurde nicht gesendet/)).toBeTruthy();
  });

  it('zeigt Wartendes an, auch wenn zusaetzlich etwas gescheitert ist', () => {
    mockWartend = [item('a', 'Kategorie erstellen')];
    mockGescheitert = [
      { id: 'f1', label: 'Abmeldung', type: 'opt-out', createdAt: 0, failedAt: 0,
        error: { status: 409, message: 'Konflikt' } },
    ];
    const { container } = render(<WartendeVorgaengeLeiste />);

    const leiste = container.querySelector('.app-wartende-leiste');
    expect(leiste?.getAttribute('data-variante')).toBe('warning');
    expect(screen.getByLabelText(/1 Vorgang wird gesendet/)).toBeTruthy();
  });
});

// --- Umbau 30.08.2026: vollbreite Leiste -> kompakter Knopf mit Zaehler ---
// Simons Einwand: "fast ein bisschen doll" — fuer drei Vorgangsarten
// (Abmeldung, Aktivitaet melden, Chat) ein Dauerbalken ueber der ganzen App.
// Anmelden und Warteliste sind offline GESPERRT, nicht eingereiht; die Leiste
// versprach mehr, als die Warteschlange traegt.
describe('Kompakter Knopf statt Leiste', () => {
  beforeEach(() => {
    mockWartend = [];
    mockGescheitert = [];
  });

  it('zeigt die Anzahl als Zahl, nicht als Satz', () => {
    mockWartend = [item('a', 'Eins'), item('b', 'Zwei'), item('c', 'Drei')];
    const { container } = render(<WartendeVorgaengeLeiste />);
    expect(container.querySelector('.app-wartende-leiste__zahl')?.textContent).toBe('3');
  });

  it('zaehlt Wartende und Gescheiterte zusammen', () => {
    mockWartend = [item('a', 'Eins')];
    mockGescheitert = [item('b', 'Zwei')];
    const { container } = render(<WartendeVorgaengeLeiste />);
    expect(container.querySelector('.app-wartende-leiste__zahl')?.textContent).toBe('2');
  });

  it('der volle Satz bleibt fuer Screenreader erhalten', () => {
    // Der Text ist aus der Flaeche verschwunden, nicht aus der App.
    mockWartend = [item('a', 'Eins')];
    const { container } = render(<WartendeVorgaengeLeiste />);
    const knopf = container.querySelector('.app-wartende-leiste');
    expect(knopf?.getAttribute('aria-label')).toContain('1 Vorgang wird gesendet');
  });

  it('Icon und Zahl sind fuer Screenreader ausgeblendet — der Knopf spricht', () => {
    // Sonst laese der Screenreader "Uhr 1 1 Vorgang wird gesendet".
    mockWartend = [item('a', 'Eins')];
    const { container } = render(<WartendeVorgaengeLeiste />);
    expect(container.querySelector('.app-wartende-leiste__zahl')?.getAttribute('aria-hidden')).toBe('true');
    expect(container.querySelector('[data-testid="icon"]')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('der lange Fliesstext steht nicht mehr in der Flaeche', () => {
    mockWartend = [item('a', 'Eins')];
    render(<WartendeVorgaengeLeiste />);
    expect(screen.queryByText('1 Vorgang wird gesendet')).toBeNull();
  });

  it('ein Fehlschlag faerbt weiterhin rot — das ist eine Aufgabe, kein Hinweis', () => {
    mockGescheitert = [item('a', 'Eins')];
    const { container } = render(<WartendeVorgaengeLeiste />);
    expect(container.querySelector('.app-wartende-leiste')?.getAttribute('data-variante')).toBe('danger');
  });
});
