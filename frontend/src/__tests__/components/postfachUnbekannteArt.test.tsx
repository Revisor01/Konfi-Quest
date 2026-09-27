import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { PostfachAntwort, PostfachEintrag } from '../../utils/postfach';

// NEUE POSTFACH-ARTEN UND APPS, DIE SIE NICHT KENNEN (27.09.2026)
//
// Der Server schreibt seit dem 27.09.2026 zwei weitere Arten ins Postfach:
// event_removed (die Leitung hat dich ausgetragen) und event_waitlisted (sie
// hat dich auf die Warteliste zurueckgesetzt), Befund BF-14 / Frage F-06.
//
// Eine App-Fassung, die eine Art noch nicht kennt, darf daran nicht
// scheitern -- sie liest ja dieselbe Liste GET /notifications/postfach. Das
// Postfach behandelt jede Zeile gleich (Titel, Text, Zeitpunkt aus der
// Zeile), nur Farbe und Sprungziel haengen an der Art. Geprueft wird hier:
//   1. die beiden neuen Arten: Terminfarbe und Sprung an den Termin;
//   2. eine Art, die die App nicht kennt: Zeile steht mit Titel und Text da,
//      neutrale Farbe, Antippen markiert als gelesen, schliesst, springt
//      nirgendwohin -- und wirft nichts. Genau so verhaelt sich eine
//      Fassung ohne die beiden neuen Arten (buildPushTargetUrl, default).
//
// Die Store-Fassungen 2.2.x haben gar kein Postfach; dort erscheint nur der
// Push (vom Betriebssystem angezeigt), und das Antippen landet im selben
// default-Zweig von buildPushTargetUrl wie in Fall 2.

type StubProps = { children?: ReactNode };

vi.mock('@ionic/react', () => ({
  IonModal: (props: StubProps & { isOpen?: boolean }) =>
    (props.isOpen ? <div data-testid="modal">{props.children}</div> : null),
  IonHeader: (props: StubProps) => <div>{props.children}</div>,
  IonToolbar: (props: StubProps) => <div>{props.children}</div>,
  IonTitle: (props: StubProps) => <div>{props.children}</div>,
  IonButtons: (props: StubProps) => <div>{props.children}</div>,
  IonButton: (props: StubProps & { onClick?: () => void; disabled?: boolean; 'aria-label'?: string }) =>
    <button type="button" onClick={props.onClick} disabled={props.disabled} aria-label={props['aria-label']}>{props.children}</button>,
  IonContent: (props: StubProps) => <div>{props.children}</div>,
  IonList: (props: StubProps) => <div>{props.children}</div>,
  IonListHeader: (props: StubProps) => <div>{props.children}</div>,
  IonLabel: (props: StubProps) => <div>{props.children}</div>,
  IonSpinner: () => <span data-testid="spinner" />,
  IonCard: (props: StubProps) => <div>{props.children}</div>,
  IonCardContent: (props: StubProps) => <div>{props.children}</div>,
  IonIcon: (props: { icon?: string }) => <span data-testid="icon" data-icon={props.icon} />,
}));

const mockGet = vi.fn();
const mockPut = vi.fn();
vi.mock('../../services/api', () => ({
  default: { get: (...a: unknown[]) => mockGet(...a), put: (...a: unknown[]) => mockPut(...a) },
}));

let mockUserType: 'konfi' | 'teamer' | 'admin' = 'konfi';
vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({
    user: { id: 7, type: mockUserType, organization_id: 1 },
    activeOrgId: null,
    organizations: [{ id: 1, name: 'Test-Gemeinde', role_name: mockUserType }],
    switchOrg: vi.fn(),
  }),
}));

vi.mock('../../contexts/BadgeContext', () => ({
  useBadge: () => ({ postfachUngelesen: 0, refreshAllCounts: vi.fn().mockResolvedValue(undefined) }),
}));

vi.mock('../../hooks/useWartendeVorgaenge', () => ({
  useWartendeVorgaenge: () => ({ wartend: [], gescheitert: [], vergessen: vi.fn(), alleVergessen: vi.fn() }),
}));

vi.mock('../../utils/pushNavigation', async (original) => {
  const echt = await original<typeof import('../../utils/pushNavigation')>();
  return { ...echt, pushZielMelden: vi.fn() };
});

import PostfachModal from '../../components/common/PostfachModal';
import { oeffnePostfach, postfachBereich } from '../../utils/postfach';
import { buildPushTargetUrl, pushZielMelden } from '../../utils/pushNavigation';
import { ICON_INFO_GEFUELLT, ICON_TERMIN_GEFUELLT } from '../../components/shared/icons';

const eintrag = (id: number, teil: Partial<PostfachEintrag>): PostfachEintrag => ({
  id,
  title: `Mitteilung ${id}`,
  message: `Text ${id}`,
  type: 'event_removed',
  data: {},
  read_at: null,
  created_at: '2026-09-27T08:00:00.000Z',
  organization_id: 1,
  organization_name: 'Test-Gemeinde',
  ...teil,
});

const antwort = (eintraege: PostfachEintrag[]): { data: PostfachAntwort } => ({
  data: { eintraege, ungelesen: eintraege.filter(e => !e.read_at).length, weitere: false },
});

const oeffnen = async () => {
  await act(async () => { oeffnePostfach(); });
  await screen.findByTestId('modal');
};

/** Die Zeile zu einem Titel -- das Element mit Rolle "button" um ihn herum. */
const zeileZu = (titel: string): HTMLElement => {
  const zeile = screen.getByText(titel).closest('[role="button"]');
  if (!zeile) throw new Error(`Keine Zeile fuer "${titel}"`);
  return zeile as HTMLElement;
};

describe('Postfach: neue Termin-Arten und unbekannte Arten', () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPut.mockReset().mockResolvedValue({ data: { success: true } });
    vi.mocked(pushZielMelden).mockReset();
    mockUserType = 'konfi';
  });

  it('"Vom Event ausgetragen" steht in der Event-Farbe und fuehrt an das Event', async () => {
    mockGet.mockResolvedValue(antwort([
      eintrag(41, {
        type: 'event_removed',
        title: 'Vom Event ausgetragen',
        message: 'Die Leitung hat dich aus "Konfistunde" am Samstag, 10. Oktober ausgetragen.',
        data: { type: 'event_removed', event_id: '7', event_name: 'Konfistunde' },
      }),
    ]));
    render(<PostfachModal />);
    await oeffnen();

    await screen.findByText('Vom Event ausgetragen');
    const zeile = zeileZu('Vom Event ausgetragen');
    expect(zeile.getAttribute('data-bereich')).toBe('events');
    expect(zeile.querySelector('.app-icon-circle [data-icon]')?.getAttribute('data-icon')).toBe(ICON_TERMIN_GEFUELLT);
    expect(screen.getByText('Die Leitung hat dich aus "Konfistunde" am Samstag, 10. Oktober ausgetragen.')).toBeTruthy();

    fireEvent.click(zeile);
    await waitFor(() => expect(pushZielMelden).toHaveBeenCalledWith('/konfi/events/7', 'inApp'));
    expect(mockPut).toHaveBeenCalledWith('/notifications/postfach/41/gelesen');
  });

  it('"Auf die Warteliste gesetzt" fuehrt die Teamer:in an ihr Event', async () => {
    mockUserType = 'teamer';
    mockGet.mockResolvedValue(antwort([
      eintrag(42, {
        type: 'event_waitlisted',
        title: 'Auf die Warteliste gesetzt',
        data: { type: 'event_waitlisted', event_id: '9' },
      }),
    ]));
    render(<PostfachModal />);
    await oeffnen();

    await screen.findByText('Auf die Warteliste gesetzt');
    expect(zeileZu('Auf die Warteliste gesetzt').getAttribute('data-bereich')).toBe('events');
    fireEvent.click(zeileZu('Auf die Warteliste gesetzt'));
    await waitFor(() => expect(pushZielMelden).toHaveBeenCalledWith('/teamer/events/9', 'inApp'));
  });

  it('eine Art, die die App nicht kennt: Zeile steht da, neutrale Farbe, Antippen springt nirgendwohin -- ohne Fehler', async () => {
    mockGet.mockResolvedValue(antwort([
      eintrag(50, {
        type: 'art_aus_der_zukunft',
        title: 'Etwas Neues',
        message: 'Eine Mitteilung, die diese Fassung nicht kennt.',
        data: { type: 'art_aus_der_zukunft', irgendwas: 1 },
      }),
      eintrag(49, { type: 'event_removed', title: 'Vom Event ausgetragen', data: { event_id: '7' } }),
    ]));
    const warnung = vi.spyOn(console, 'warn').mockImplementation(() => {});
    render(<PostfachModal />);
    await oeffnen();

    await screen.findByText('Etwas Neues');
    // Beide Zeilen stehen da -- die unbekannte verdraengt nichts.
    expect(screen.getByText('Vom Event ausgetragen')).toBeTruthy();
    const zeile = zeileZu('Etwas Neues');
    expect(zeile.getAttribute('data-bereich')).toBe('info');
    expect(zeile.querySelector('.app-icon-circle [data-icon]')?.getAttribute('data-icon')).toBe(ICON_INFO_GEFUELLT);
    expect(screen.getByText('Eine Mitteilung, die diese Fassung nicht kennt.')).toBeTruthy();

    fireEvent.click(zeile);
    await waitFor(() => expect(mockPut).toHaveBeenCalledWith('/notifications/postfach/50/gelesen'));
    await waitFor(() => expect(screen.queryByTestId('modal')).toBeNull());
    expect(pushZielMelden).not.toHaveBeenCalled();
    expect(warnung).toHaveBeenCalledWith('Unbekannter Notification-Typ:', 'art_aus_der_zukunft');
    warnung.mockRestore();
  });

  it('Farbregel und Sprungziel der neuen Arten, ohne Rendern', () => {
    expect(postfachBereich('event_removed')).toBe('events');
    expect(postfachBereich('event_waitlisted')).toBe('events');
    expect(buildPushTargetUrl('event_removed', { event_id: 7 }, 'konfi')).toBe('/konfi/events/7');
    expect(buildPushTargetUrl('event_removed', { event_id: 7 }, 'admin')).toBe('/admin/events/7');
    expect(buildPushTargetUrl('event_waitlisted', { event_id: 7 }, 'teamer')).toBe('/teamer/events/7');
    // Ohne Kennung: die Terminliste der Rolle, wie bei der Anmeldung.
    expect(buildPushTargetUrl('event_waitlisted', {}, 'konfi')).toBe('/konfi/events');
  });
});
