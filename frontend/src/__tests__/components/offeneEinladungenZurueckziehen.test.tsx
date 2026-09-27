// Offene Einladungen in "Mehr > Benutzer:innen" -- einsehen und zurückziehen
// (Simon, 27.09.2026).
//
// Handbuch und Changelog versprachen "lässt sich zurückziehen", die App hatte
// dafür keine Stelle; GET und DELETE /einladungen gab es nur auf dem Server.
// Jetzt steht unter der Benutzerliste der Abschnitt "Offene Einladungen" --
// nur für Org-Admins, dieselbe Bedingung wie beim Einladen (requireOrgAdmin).
//
// Geprüft wird Verhalten, nicht Quelltext: Die Seite wird mit den echten
// Ionic-Bausteinen gerendert; ersetzt sind nur die Benutzerliste (eigene
// Tests), die Modale und der Alert. Der Alert-Nachbau hält fest, was Ionic
// anzeigen würde, und drückt seine Knöpfe.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act, cleanup, waitFor } from '@testing-library/react';

// --- Alert-Nachbau ----------------------------------------------------------

interface AlertKnopf { text: string; role?: string; handler?: () => unknown | Promise<unknown> }
interface AlertOptionen { header?: string; message?: string; buttons: AlertKnopf[] }

let offenerAlert: AlertOptionen | null = null;
const presentAlert = (optionen: AlertOptionen) => { offenerAlert = optionen; };

const tippeAlertKnopf = async (text: string) => {
  const knopf = offenerAlert?.buttons.find(b => b.text === text);
  if (!knopf) throw new Error(`Knopf "${text}" fehlt im Alert "${offenerAlert?.header}"`);
  await act(async () => { await knopf.handler?.(); });
};

// --- Mocks ------------------------------------------------------------------

interface Einladung {
  id: number; user_id: number; display_name: string; username: string;
  role_name: string; role_display_name: string | null;
  created_at: string; expires_at: string; eingeladen_von_name: string | null;
}

let offeneEinladungen: Einladung[] = [];
const apiGet = vi.fn();
const apiDelete = vi.fn();
const setError = vi.fn();
const setSuccess = vi.fn();
let rolle = 'org_admin';
let isOnline = true;

vi.mock('../../services/api', () => ({
  default: {
    get: (...args: unknown[]) => apiGet(...args),
    delete: (...args: unknown[]) => apiDelete(...args),
  },
}));

vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({
    user: { id: 9, organization_id: 2, role_name: rolle },
    setError,
    setSuccess,
    isOnline,
  }),
}));

vi.mock('../../contexts/ModalContext', () => ({
  useModalPage: () => ({ pageRef: { current: null }, presentingElement: null }),
}));

// Der Horcher auf Live-Signale -- der Test löst 'users' selbst aus.
const liveHorcher = new Map<string, () => void>();
vi.mock('../../contexts/LiveUpdateContext', () => ({
  useLiveRefresh: (typ: string, rueckruf: () => void) => { liveHorcher.set(typ, rueckruf); },
}));

vi.mock('../../hooks/useOfflineQuery', () => ({
  useOfflineQuery: () => ({
    data: [],
    loading: false,
    error: null,
    isStale: false,
    isOffline: false,
    refresh: vi.fn().mockResolvedValue(undefined),
    refreshLive: vi.fn(),
  }),
}));

vi.mock('../../components/admin/UsersView', () => ({
  default: () => React.createElement('div', null, 'benutzerliste'),
}));

// Das Einladen-Modal: Der Test braucht nur seinen onSuccess-Rückruf. Die
// Attrappe muss vor den (nach oben gezogenen) vi.mock-Fabriken stehen.
const { EinladungModalAttrappe } = vi.hoisted(() => ({ EinladungModalAttrappe: () => null }));
vi.mock('../../components/admin/modals/EinladungModal', () => ({ default: EinladungModalAttrappe }));
vi.mock('../../components/admin/modals/UserManagementModal', () => ({ default: () => null }));
vi.mock('../../components/common/LoadingSpinner', () => ({ default: () => null }));
vi.mock('../../components/shared/AppKopfzeile', () => ({
  default: () => null,
  AppKopfzeileGross: () => null,
}));
vi.mock('../../utils/haptics', () => ({ triggerPullHaptic: vi.fn() }));

let einladungModalProps: { onSuccess?: () => void } = {};
vi.mock('@ionic/react', async (importOriginal) => {
  const echt = await importOriginal<typeof import('@ionic/react')>();
  return {
    ...echt,
    useIonAlert: () => [presentAlert, vi.fn()],
    useIonModal: (komponente: unknown, props: { onSuccess?: () => void }) => {
      if (komponente === EinladungModalAttrappe) einladungModalProps = props;
      return [vi.fn(), vi.fn()];
    },
  };
});

import AdminUsersPage from '../../components/admin/pages/AdminUsersPage';

// --- Testdaten --------------------------------------------------------------

// Mittags UTC, damit das Datum in jeder Zeitzone des Testrechners gleich ist.
const anna: Einladung = {
  id: 12, user_id: 3, display_name: 'Test Teamer 1', username: 'teamer1',
  role_name: 'teamer', role_display_name: 'Teamer:in',
  created_at: '2026-09-25T12:00:00Z', expires_at: '2026-10-09T12:00:00Z',
  eingeladen_von_name: 'Test Org-Admin 2',
};
const ben: Einladung = {
  id: 13, user_id: 4, display_name: 'Test Admin 1', username: 'admin1',
  role_name: 'admin', role_display_name: 'Admin',
  created_at: '2026-09-26T12:00:00Z', expires_at: '2026-10-10T12:00:00Z',
  eingeladen_von_name: 'Test Org-Admin 2',
};

/**
 * Zugänglicher Name eines ion-button: Ionic reicht aria-label vom Host an den
 * nativen <button> im Shadow-DOM weiter und nimmt es am Host weg -- dort liest
 * ihn auch das Vorleseprogramm.
 */
const knopfName = (el: Element): string | null =>
  el.getAttribute('aria-label')
  ?? el.shadowRoot?.querySelector('button')?.getAttribute('aria-label')
  ?? null;

/** Alle ion-button, deren Name passt. */
const knoepfe = (name: string | RegExp) =>
  [...document.body.querySelectorAll<HTMLElement>('ion-button')].filter((el) => {
    const n = knopfName(el);
    return n !== null && (typeof name === 'string' ? n === name : name.test(n));
  });

/** Genau der eine ion-button mit diesem Namen (wirft sonst). */
const knopf = (name: string): HTMLElement => {
  const treffer = knoepfe(name);
  if (treffer.length !== 1) throw new Error(`Knopf „${name}": ${treffer.length} Treffer`);
  return treffer[0];
};

const einladungsAbrufe = () => apiGet.mock.calls.filter(([pfad]) => pfad === '/einladungen').length;

/** Rendert die Seite und wartet, bis die Einladungen geladen sind. */
const zeigeSeite = async () => {
  render(<AdminUsersPage />);
  await screen.findByText('benutzerliste');
  if (rolle === 'org_admin' && offeneEinladungen.length > 0) {
    await screen.findByText('Offene Einladungen (' + offeneEinladungen.length + ')');
  }
};

beforeEach(() => {
  offenerAlert = null;
  einladungModalProps = {};
  liveHorcher.clear();
  rolle = 'org_admin';
  isOnline = true;
  offeneEinladungen = [anna, ben];
  apiGet.mockReset().mockImplementation(async (pfad: string) => {
    if (pfad === '/einladungen') return { data: offeneEinladungen.map(e => ({ ...e })) };
    return { data: [] };
  });
  apiDelete.mockReset();
  setError.mockReset();
  setSuccess.mockReset();
});

afterEach(cleanup);

// --- Sichtbarkeit -----------------------------------------------------------

describe('Abschnitt "Offene Einladungen" in "Benutzer:innen"', () => {
  it('Org-Admin: zeigt jede offene Einladung mit Name, Benutzername, Rolle, eingeladen am und gültig bis', async () => {
    await zeigeSeite();

    expect(apiGet).toHaveBeenCalledWith('/einladungen');
    expect(screen.getByText('Offene Einladungen (2)')).toBeTruthy();

    expect(screen.getByText('Test Teamer 1')).toBeTruthy();
    expect(screen.getByText('teamer1')).toBeTruthy();
    expect(screen.getByText('als Teamer:in')).toBeTruthy();
    expect(screen.getByText('eingeladen am 25.09.2026')).toBeTruthy();
    expect(screen.getByText('gültig bis 09.10.2026')).toBeTruthy();

    expect(screen.getByText('Test Admin 1')).toBeTruthy();
    expect(screen.getByText('als Admin')).toBeTruthy();
    expect(screen.getByText('gültig bis 10.10.2026')).toBeTruthy();

    // Jeder Knopf trägt den Namen der Person -- ein Screenreader liest
    // nicht zweimal nur "Zurückziehen".
    expect(knopf('Einladung an Test Teamer 1 zurückziehen').textContent).toContain('Zurückziehen');
    expect(knopf('Einladung an Test Admin 1 zurückziehen').textContent).toContain('Zurückziehen');
  });

  it('Org-Admin ohne offene Einladungen: kein leerer Abschnitt', async () => {
    offeneEinladungen = [];
    await zeigeSeite();
    await waitFor(() => expect(einladungsAbrufe()).toBe(1));

    expect(screen.queryByText(/Offene Einladungen/)).toBeNull();
  });

  it.each(['admin', 'teamer'])('%s: kein Abschnitt und kein Abruf von GET /einladungen', async (andereRolle) => {
    rolle = andereRolle;
    await zeigeSeite();

    expect(screen.queryByText(/Offene Einladungen/)).toBeNull();
    expect(screen.queryByText('Test Teamer 1')).toBeNull();
    expect(knoepfe(/zurückziehen/)).toHaveLength(0);
    expect(einladungsAbrufe()).toBe(0);
  });
});

// --- Zurückziehen -----------------------------------------------------------

describe('Einladung zurückziehen', () => {
  it('fragt nach, ruft DELETE und nimmt den Eintrag aus der Liste', async () => {
    apiDelete.mockResolvedValue({ data: { message: 'Einladung zurückgezogen' } });
    await zeigeSeite();

    fireEvent.click(knopf('Einladung an Test Teamer 1 zurückziehen'));

    // Erst die Rückfrage, noch kein Aufruf.
    expect(offenerAlert?.header).toBe('Einladung zurückziehen');
    expect(offenerAlert?.message).toBe('Die Einladung an "Test Teamer 1" (@teamer1) zurückziehen? Die Person kann sie danach nicht mehr annehmen. Einladen lässt sie sich jederzeit neu.');
    expect(offenerAlert?.buttons.map(b => [b.text, b.role])).toEqual([['Abbrechen', 'cancel'], ['Zurückziehen', 'destructive']]);
    expect(apiDelete).not.toHaveBeenCalled();

    await tippeAlertKnopf('Zurückziehen');

    expect(apiDelete).toHaveBeenCalledTimes(1);
    expect(apiDelete).toHaveBeenCalledWith('/einladungen/12');
    expect(setSuccess).toHaveBeenCalledWith('Die Einladung an Test Teamer 1 ist zurückgezogen.');
    expect(setError).not.toHaveBeenCalled();

    // Der Eintrag ist weg, die andere Einladung bleibt.
    expect(screen.queryByText('Test Teamer 1')).toBeNull();
    expect(knoepfe('Einladung an Test Teamer 1 zurückziehen')).toHaveLength(0);
    expect(screen.getByText('Test Admin 1')).toBeTruthy();
    expect(screen.getByText('Offene Einladungen (1)')).toBeTruthy();
  });

  it('die letzte offene Einladung zurückgezogen: der Abschnitt verschwindet', async () => {
    offeneEinladungen = [anna];
    apiDelete.mockResolvedValue({ data: { message: 'Einladung zurückgezogen' } });
    await zeigeSeite();

    fireEvent.click(knopf('Einladung an Test Teamer 1 zurückziehen'));
    await tippeAlertKnopf('Zurückziehen');

    expect(screen.queryByText(/Offene Einladungen/)).toBeNull();
  });

  it('"Abbrechen" ruft nichts und lässt den Eintrag stehen', async () => {
    await zeigeSeite();

    fireEvent.click(knopf('Einladung an Test Teamer 1 zurückziehen'));
    await tippeAlertKnopf('Abbrechen');

    expect(apiDelete).not.toHaveBeenCalled();
    expect(screen.getByText('Test Teamer 1')).toBeTruthy();
  });

  it('inzwischen beantwortet (404): Meldung und die Liste lädt den echten Stand', async () => {
    apiDelete.mockRejectedValue({ response: { status: 404, data: { error: 'Einladung nicht gefunden' } } });
    await zeigeSeite();
    // Die Person hat in der Zwischenzeit angenommen -- der Server kennt die
    // Einladung nicht mehr als offen.
    offeneEinladungen = [ben];

    fireEvent.click(knopf('Einladung an Test Teamer 1 zurückziehen'));
    await tippeAlertKnopf('Zurückziehen');

    expect(setError).toHaveBeenCalledWith('Diese Einladung ist nicht mehr offen. Sie wurde inzwischen beantwortet oder zurückgezogen.');
    expect(setSuccess).not.toHaveBeenCalled();
    await waitFor(() => expect(screen.queryByText('Test Teamer 1')).toBeNull());
    expect(screen.getByText('Test Admin 1')).toBeTruthy();
  });

  it('anderer Fehler: der Grund des Servers, der Eintrag bleibt', async () => {
    apiDelete.mockRejectedValue({ response: { status: 500, data: { error: 'Datenbankfehler' } } });
    await zeigeSeite();

    fireEvent.click(knopf('Einladung an Test Teamer 1 zurückziehen'));
    await tippeAlertKnopf('Zurückziehen');

    expect(setError).toHaveBeenCalledWith('Datenbankfehler');
    expect(screen.getByText('Test Teamer 1')).toBeTruthy();
  });

  it('offline: Meldung statt Rückfrage, kein Aufruf', async () => {
    isOnline = false;
    await zeigeSeite();

    fireEvent.click(knopf('Einladung an Test Teamer 1 zurückziehen'));

    expect(offenerAlert).toBeNull();
    expect(apiDelete).not.toHaveBeenCalled();
    expect(setError).toHaveBeenCalledWith('Das geht nur mit Internetverbindung. Bitte versuche es später noch einmal.');
  });
});

// --- Neu laden ----------------------------------------------------------------

describe('Die Liste folgt neuen Einladungen und Zusagen', () => {
  it('nach einer neuen Einladung erscheint sie im Abschnitt', async () => {
    offeneEinladungen = [ben];
    await zeigeSeite();
    expect(screen.queryByText('Test Teamer 1')).toBeNull();

    offeneEinladungen = [anna, ben];
    await act(async () => { einladungModalProps.onSuccess?.(); });

    expect(await screen.findByText('Test Teamer 1')).toBeTruthy();
    expect(screen.getByText('Offene Einladungen (2)')).toBeTruthy();
  });

  it('Live-Signal "users" (etwa eine Zusage): der Eintrag verschwindet', async () => {
    await zeigeSeite();

    offeneEinladungen = [ben];
    await act(async () => { liveHorcher.get('users')?.(); });

    await waitFor(() => expect(screen.queryByText('Test Teamer 1')).toBeNull());
    expect(screen.getByText('Test Admin 1')).toBeTruthy();
  });
});
