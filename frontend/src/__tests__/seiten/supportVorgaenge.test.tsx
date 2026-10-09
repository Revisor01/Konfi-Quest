// Vorgänge: App und Web-Fassung lesen Stände, Leertitel und -texte aus EINER
// Beschreibung (seiten/supportVorgaenge.ts), gerendert. Dazu die Abweichung,
// die bis 09.10.2026 bestand: Grenzten Art, Gemeinde oder Suche die Liste
// leer, meldete die App den leeren Stand („Alle Vorgänge sind schon in
// Arbeit.") statt „Keine Treffer".
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { vorgang, vorgaengeServer } from '../components/support/vorgaengeServer';
import { inFassung, leerVon } from '../../seiten/beschreibung';
import { VORGANG_LEER_TITEL, VORGANG_STAENDE } from '../../seiten/supportVorgaenge';
import { VORGANG_FILTER } from '../../utils/supportVorgaenge';

const h = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  apiDelete: vi.fn(),
  breit: true,
  user: { id: 9, role_name: 'super_admin', is_super_admin: true } as Record<string, unknown>,
  standort: { pathname: '/admin/support/vorgaenge', search: '', state: null } as { pathname: string; search: string; state: null },
}));

vi.mock('@ionic/react', async () => (await import('../components/support/ionicAttrappe')).ionicAttrappe({
  presentAlert: () => undefined,
  router: { push: vi.fn(), goBack: vi.fn(), canGoBack: () => false },
}));
vi.mock('../../components/shared/AppKopfzeile', async () => (await import('../components/support/ionicAttrappe')).KopfzeileAttrappe);
vi.mock('../../components/shared/WartungsHinweis', () => ({ default: () => null }));
vi.mock('../../components/common/LoadingSpinner', () => ({ default: ({ message }: { message: string }) => <p>{message}</p> }));
vi.mock('../../services/api', () => ({ default: { get: h.apiGet, post: h.apiPost, patch: h.apiPatch, delete: h.apiDelete } }));
vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({ user: h.user, setError: vi.fn(), setSuccess: vi.fn(), isOnline: true }),
}));
vi.mock('../../utils/haptics', () => ({ triggerPullHaptic: vi.fn() }));
vi.mock('../../navigation/breitesLayout', () => ({ useBreitesLayout: () => h.breit }));
vi.mock('../../navigation/useAppLocation', () => ({ useAppLocation: () => h.standort }));

import SupportVorgaengePage from '../../components/support/SupportVorgaengePage';
import { supportMailZaehlerZuruecksetzen } from '../../navigation/supportMailZaehler';

let vorherTZ: string | undefined;
beforeAll(() => { vorherTZ = process.env.TZ; process.env.TZ = 'Europe/Berlin'; });
afterAll(() => { if (vorherTZ === undefined) delete process.env.TZ; else process.env.TZ = vorherTZ; });

beforeEach(() => {
  vi.clearAllMocks();
  h.breit = true;
  supportMailZaehlerZuruecksetzen();
  // Zwei neue, einer in Arbeit, keiner wartet.
  const server = vorgaengeServer({
    vorgaenge: [
      vorgang(1, { status: 'neu', art: 'fehler', betreff: 'Chat zeigt nichts Neues', organization_id: 7 }),
      vorgang(2, { status: 'neu', art: 'frage', betreff: 'Passwort zurücksetzen', organization_id: 8 }),
      vorgang(3, { status: 'in_arbeit', art: 'frage', betreff: 'Jahrgang anlegen' }),
    ],
  });
  server.installieren({ get: h.apiGet, post: h.apiPost, patch: h.apiPatch, delete: h.apiDelete });
});

const zeigen = async (breit: boolean) => {
  h.breit = breit;
  render(<SupportVorgaengePage />);
  await screen.findByText('Chat zeigt nichts Neues');
};

const appStaende = () => within(screen.getByRole('tablist', { name: 'Vorgänge nach Stand' })).getAllByRole('tab')
  .map((t) => t.textContent!.replace(/ \d+$/, ''));
const webStaende = () => within(screen.getByRole('group', { name: 'Vorgänge nach Stand' })).getAllByRole('button')
  .map((b) => b.childNodes[0].textContent);
const stand = (breit: boolean, name: RegExp) => (breit
  ? within(screen.getByRole('group', { name: 'Vorgänge nach Stand' })).getByRole('button', { name })
  : within(screen.getByRole('tablist', { name: 'Vorgänge nach Stand' })).getByRole('tab', { name }));

describe('Vorgänge: eine Beschreibung für App und Browser', () => {
  it('die App zeigt genau die Stände der Beschreibung, in ihrer Reihenfolge', async () => {
    await zeigen(false);
    expect(appStaende()).toEqual(['Offen', 'Neu', 'In Arbeit', 'Wartet', 'Archiv']);
    expect(appStaende()).toEqual(inFassung(VORGANG_STAENDE, 'app').map((f) => f.kurz ?? f.label));
  });

  it('der Browser zeigt dieselben Stände mit denselben Beschriftungen', async () => {
    await zeigen(true);
    expect(webStaende()).toEqual(['Offen', 'Neu', 'In Arbeit', 'Wartet', 'Archiv']);
    expect(webStaende()).toEqual(inFassung(VORGANG_STAENDE, 'web').map((f) => f.label));
  });

  it('die Werte von ?filter= sind die Schlüssel der Beschreibung', () => {
    expect([...VORGANG_FILTER]).toEqual(['offen', 'neu', 'in_arbeit', 'wartet', 'archiv']);
  });

  it('die Prädikate der Beschreibung zählen: Offen 3, Neu 2, In Arbeit 1, Wartet 0', async () => {
    await zeigen(false);
    const texte = within(screen.getByRole('tablist', { name: 'Vorgänge nach Stand' })).getAllByRole('tab').map((t) => t.textContent);
    expect(texte).toEqual(['Offen 3', 'Neu 2', 'In Arbeit 1', 'Wartet 0', 'Archiv']);
  });
});

describe('Vorgänge: Leerzustand in beiden Fassungen gleich', () => {
  it.each([false, true])('leerer Stand „Wartet" (breit=%s): eigener Titel und Satz aus der Beschreibung', async (breit) => {
    await zeigen(breit);
    fireEvent.click(stand(breit, /^Wartet/));
    expect(await screen.findByText(VORGANG_LEER_TITEL.wartet)).toBeInTheDocument();
    expect(screen.getByText('Nichts wartet')).toBeInTheDocument();
    expect(screen.getByText(leerVon(VORGANG_STAENDE, 'wartet'))).toBeInTheDocument();
  });

  it.each([false, true])('leer durch die Suche (breit=%s): „Keine Treffer" statt des Satzes zum Stand', async (breit) => {
    await zeigen(breit);
    fireEvent.click(stand(breit, /^Neu/));
    const suche = breit ? screen.getByRole('searchbox', { name: 'Vorgänge durchsuchen' }) : screen.getByLabelText('Suche');
    fireEvent.change(suche, { target: { value: 'Jahrgang' } });
    expect(await screen.findByText('Keine Treffer')).toBeInTheDocument();
    expect(screen.getByText('In dieser Auswahl gibt es keinen Vorgang zu „Jahrgang“.')).toBeInTheDocument();
    expect(screen.queryByText('Alle Vorgänge sind schon in Arbeit.')).toBeNull();
    // Der Weg zurück: Suche leeren, der Stand bleibt.
    fireEvent.click(screen.getByRole('button', { name: 'Auswahl zurücksetzen' }));
    expect(await screen.findByText('Chat zeigt nichts Neues')).toBeInTheDocument();
    expect(screen.queryByText('Jahrgang anlegen')).toBeNull();
  });
});
