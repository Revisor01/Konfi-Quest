// Posteingang: App und Web-Fassung lesen Filter, Leertitel und -texte aus
// EINER Beschreibung (seiten/supportPosteingang.ts), gerendert. Dazu die
// Abweichungen, die bis 09.10.2026 bestanden: Die App sagte bei jedem leeren
// Filter „Nichts einzusortieren", der Browser zeigte zum leeren Archiv das
// Mail-Symbol und verschwieg, dass einem Postfach die Zugangsdaten fehlen.
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { mail, vorgaengeServer } from '../components/support/vorgaengeServer';
import { inFassung, leerVon } from '../../seiten/beschreibung';
import { POSTEINGANG_FILTER, POSTEINGANG_LEER_TITEL, ZUGANGSDATEN_FEHLEN } from '../../seiten/supportPosteingang';
import { POSTFACH_INFO } from '../../utils/supportMail';
import { ICON_ARCHIV, ICON_MAIL } from '../../components/shared/icons';

const h = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  apiDelete: vi.fn(),
  breit: true,
  user: { id: 9, role_name: 'super_admin', is_super_admin: true } as Record<string, unknown>,
  standort: { pathname: '/admin/support/post', search: '', state: null } as { pathname: string; search: string; state: null },
}));

vi.mock('@ionic/react', async () => ({
  ...(await import('../components/support/ionicAttrappe')).ionicAttrappe({
    presentAlert: () => undefined,
    router: { push: vi.fn(), goBack: vi.fn(), canGoBack: () => false },
  }),
  // Das Symbol sichtbar machen: Der Leerzustand nennt seins im Attribut.
  IonIcon: ({ icon, className }: { icon?: string; className?: string }) => <span data-icon={icon} className={className} />,
}));
vi.mock('../../components/shared/AppKopfzeile', async () => (await import('../components/support/ionicAttrappe')).KopfzeileAttrappe);
vi.mock('../../components/shared/WartungsHinweis', () => ({ default: () => null }));
vi.mock('../../components/common/LoadingSpinner', () => ({ default: ({ message }: { message: string }) => <p>{message}</p> }));
vi.mock('../../services/api', () => ({ default: { get: h.apiGet, post: h.apiPost, patch: h.apiPatch, delete: h.apiDelete } }));
vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({ user: h.user, signOut: vi.fn(), setError: vi.fn(), setSuccess: vi.fn(), isOnline: true }),
}));
vi.mock('../../utils/haptics', () => ({ triggerPullHaptic: vi.fn() }));
vi.mock('../../navigation/breitesLayout', () => ({ useBreitesLayout: () => h.breit }));
vi.mock('../../navigation/useAppLocation', () => ({ useAppLocation: () => h.standort }));
// Das Symbol des Leerzustands ist in beiden Fassungen ein IonIcon -- die Attrappe zeigt seinen Namen.
vi.mock('../../components/shared/EmptyState', () => ({
  default: ({ icon, title, message }: { icon: string; title: string; message: string }) => (
    <div role="status" data-symbol={icon}><h3>{title}</h3><p>{message}</p></div>
  ),
}));

import SupportPosteingangPage from '../../components/support/SupportPosteingangPage';
import { supportMailZaehlerZuruecksetzen } from '../../navigation/supportMailZaehler';

let vorherTZ: string | undefined;
beforeAll(() => { vorherTZ = process.env.TZ; process.env.TZ = 'Europe/Berlin'; });
afterAll(() => { if (vorherTZ === undefined) delete process.env.TZ; else process.env.TZ = vorherTZ; });

let server: ReturnType<typeof vorgaengeServer>;

beforeEach(() => {
  vi.clearAllMocks();
  h.breit = true;
  supportMailZaehlerZuruecksetzen();
  // Nur gelesene Mails an moin@: „Ungelesen" und „support@" sind leer.
  server = vorgaengeServer({
    mails: [mail(301, null, { postfach: 'moin', betreff: 'Rückfrage zur Lizenz', gelesen_am: '2026-10-03T09:00:00Z' })],
  });
  server.installieren({ get: h.apiGet, post: h.apiPost, patch: h.apiPatch, delete: h.apiDelete });
});

/** support@ ohne Zugangsdaten, auf diesem Server eingeschaltet. */
const supportOhneZugang = () => {
  const echt = h.apiGet.getMockImplementation()!;
  h.apiGet.mockImplementation((pfad: string, ...rest: unknown[]) => (pfad === '/support/mail/status'
    ? Promise.resolve({ data: { postfaecher: [
      { postfach: 'moin', adresse: 'moin@konfi-quest.example', eingerichtet: true, abgeholt_am: '2026-10-03T08:29:00Z', fehler: null, fehler_am: null, auf_diesem_server: true },
      { postfach: 'support', adresse: 'support@konfi-quest.example', eingerichtet: false, abgeholt_am: null, fehler: null, fehler_am: null, auf_diesem_server: true },
    ] } })
    : echt(pfad, ...rest)));
};

const zeigen = async (breit: boolean) => {
  h.breit = breit;
  render(<SupportPosteingangPage />);
  if (breit) await screen.findByRole('table', { name: 'Mails im Posteingang' });
  else await screen.findByText('Rückfrage zur Lizenz');
};

/** Die Beschriftungen der Filter, wie die Fassung sie zeigt -- ohne die Zahl dahinter. */
const appFilter = () => within(screen.getByRole('tablist', { name: 'Mails filtern' })).getAllByRole('tab')
  .map((t) => t.textContent!.replace(/ \d+$/, ''));
const webChip = (name: RegExp) => within(screen.getByRole('group', { name: 'Mails filtern' })).getByRole('button', { name });
const webFilter = () => within(screen.getByRole('group', { name: 'Mails filtern' })).getAllByRole('button')
  .map((b) => b.childNodes[0].textContent);

describe('Posteingang: eine Beschreibung für App und Browser', () => {
  it('die App zeigt genau die Filter der Beschreibung, in ihrer Reihenfolge', async () => {
    await zeigen(false);
    expect(appFilter()).toEqual(['Alle', 'Ungelesen', 'moin@', 'support@', 'Archiv']);
    expect(appFilter()).toEqual(inFassung(POSTEINGANG_FILTER, 'app').map((f) => f.kurz ?? f.label));
  });

  it('der Browser zeigt dieselben Filter mit denselben Beschriftungen', async () => {
    await zeigen(true);
    expect(webFilter()).toEqual(['Alle', 'Ungelesen', 'moin@', 'support@', 'Archiv']);
    expect(webFilter()).toEqual(inFassung(POSTEINGANG_FILTER, 'web').map((f) => f.label));
  });

  it('die Filter der Beschreibung zählen wie die Liste: Alle 1, Ungelesen 0, moin@ 1, support@ 0', async () => {
    await zeigen(false);
    const zahlen = within(screen.getByRole('tablist', { name: 'Mails filtern' })).getAllByRole('tab').map((t) => t.textContent);
    expect(zahlen).toEqual(['Alle 1', 'Ungelesen 0', 'moin@ 1', 'support@ 0', 'Archiv']);
  });
});

describe('Posteingang: Leerzustand je Filter in beiden Fassungen gleich', () => {
  it.each([false, true])('Ungelesen leer (breit=%s): „Nichts Ungelesenes" -- in der App bis 09.10.2026 „Nichts einzusortieren"', async (breit) => {
    await zeigen(breit);
    fireEvent.click(breit ? webChip(/^Ungelesen/) : screen.getByRole('tab', { name: /^Ungelesen/ }));
    expect(await screen.findByText(POSTEINGANG_LEER_TITEL.ungelesen)).toBeInTheDocument();
    expect(screen.getByText('Nichts Ungelesenes')).toBeInTheDocument();
    expect(screen.getByText(leerVon(POSTEINGANG_FILTER, 'ungelesen'))).toBeInTheDocument();
    expect(screen.queryByText('Nichts einzusortieren')).toBeNull();
  });

  it.each([false, true])('support@ leer (breit=%s): „Keine Mails" mit dem Satz zum Postfach', async (breit) => {
    await zeigen(breit);
    fireEvent.click(breit ? webChip(/^support@/) : screen.getByRole('tab', { name: /^support@/ }));
    expect(await screen.findByText('Keine Mails')).toBeInTheDocument();
    expect(screen.getByText(`Keine Mails an ${POSTFACH_INFO.support.kurz}, die noch einsortiert werden müssen.`)).toBeInTheDocument();
  });

  it('das leere Archiv zeigt im Browser das Archiv-Symbol wie in der App, nicht das Mail-Symbol', async () => {
    await zeigen(true);
    fireEvent.click(webChip(/^Archiv/));
    const titel = await screen.findByText('Das Archiv ist leer');
    const symbol = (titel.closest('.web-leer') as HTMLElement).querySelector('.web-leer__symbol');
    expect(symbol?.getAttribute('data-icon')).toBe(ICON_ARCHIV);
    expect(ICON_ARCHIV).not.toBe(ICON_MAIL);
  });

  it('die App zeigt beim leeren Archiv ebenfalls das Archiv-Symbol', async () => {
    await zeigen(false);
    fireEvent.click(screen.getByRole('tab', { name: /^Archiv/ }));
    const titel = await screen.findByText('Das Archiv ist leer');
    expect(titel.closest('[data-symbol]')?.getAttribute('data-symbol')).toBe(ICON_ARCHIV);
  });
});

describe('Posteingang: fehlende Zugangsdaten', () => {
  it.each([false, true])('ein Postfach ohne Zugangsdaten nennt den Grund (breit=%s) -- im Browser bis 09.10.2026 nur die Marke', async (breit) => {
    supportOhneZugang();
    await zeigen(breit);
    expect(await screen.findByText(new RegExp(ZUGANGSDATEN_FEHLEN.text.replace(/[.]/g, '\\.')))).toBeInTheDocument();
  });

  it.each([false, true])('ein eingerichtetes Postfach bekommt den Hinweis nicht (breit=%s)', async (breit) => {
    await zeigen(breit);
    expect(screen.queryByText(new RegExp(ZUGANGSDATEN_FEHLEN.text.replace(/[.]/g, '\\.')))).toBeNull();
  });
});
