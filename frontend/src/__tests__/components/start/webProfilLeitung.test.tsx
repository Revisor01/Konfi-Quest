// Profil der Leitung in der Web-Fassung, gerendert (03.10.2026,
// docs/planung/web-alle-bereiche.md, Entscheidung 6): zweispaltig -- links die
// Person mit ihren Angaben, rechts Einladungen, Einstellungen und das Loeschen
// des Kontos. Abmelden steht, wie in der App, nicht im Profil. Die Handgriffe
// sind die der App: dieselben Modale mit denselben Eigenschaften. Die Farbe
// folgt der Rolle: Gemeindeleitung indigo, Leitung petrol.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import './zeitrahmen';
import React from 'react';
import { render, screen, fireEvent, within, waitFor, act } from '@testing-library/react';
import type { ModalAufruf } from './ionicStart';

const h = vi.hoisted(() => ({
  breit: true,
  apiGet: vi.fn(),
  push: vi.fn(),
  modale: [] as Array<{ name: string; props: Record<string, unknown>; optionen: Record<string, unknown> | undefined }>,
  alerts: [] as unknown[],
  seite: document.createElement('div'),
  user: {} as Record<string, unknown>,
  ich: null as unknown,
  cacheLeeren: vi.fn(),
  antworten: {} as Record<string, unknown>,
}));

vi.mock('@ionic/react', async () => (await import('./ionicStart')).ionicStart(h as never));
vi.mock('../../../components/shared/AppKopfzeile', async () => (await import('../support/ionicAttrappe')).KopfzeileAttrappe);
vi.mock('../../../components/shared/WartungsHinweis', () => ({ default: () => null }));
vi.mock('../../../components/shared/ChangeEmailModal', async () => ({ default: (await import('./ionicStart')).modalAttrappe('ChangeEmailModal') }));
vi.mock('../../../components/shared/ChangePasswordModal', async () => ({ default: (await import('./ionicStart')).modalAttrappe('ChangePasswordModal') }));
vi.mock('../../../components/shared/DeleteAccountModal', async () => ({ default: (await import('./ionicStart')).modalAttrappe('DeleteAccountModal') }));
vi.mock('../../../components/admin/modals/ChangeRoleTitleModal', async () => ({ default: (await import('./ionicStart')).modalAttrappe('ChangeRoleTitleModal') }));
vi.mock('../../../components/shared/AppSperreSchalter', () => ({ default: () => null }));
vi.mock('../../../components/shared/AbsturzberichteSchalter', () => ({ default: () => null }));
vi.mock('../../../hooks/useMediaCacheControl', () => ({ useMediaCacheControl: () => ({ cacheLabel: '8,0 MB belegt', clearMediaCache: h.cacheLeeren }) }));
vi.mock('../../../services/api', () => ({ default: { get: h.apiGet, post: vi.fn(), put: vi.fn() } }));
vi.mock('../../../services/tokenStore', () => ({ setUser: vi.fn() }));
vi.mock('../../../contexts/LiveUpdateContext', () => ({ useLiveRefresh: vi.fn() }));
vi.mock('../../../contexts/ModalContext', () => ({ useModalPage: () => ({ pageRef: { current: h.seite }, presentingElement: h.seite }) }));
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({
    user: h.user,
    setUser: vi.fn(),
    setError: vi.fn(),
    setSuccess: vi.fn(),
    signOut: vi.fn(),
    isOnline: true,
    pushNotificationsPermission: 'granted',
    requestPushPermissions: vi.fn(),
  }),
}));
vi.mock('../../../utils/haptics', () => ({ triggerPullHaptic: vi.fn() }));
vi.mock('../../../navigation/breitesLayout', () => ({ useBreitesLayout: () => h.breit }));
vi.mock('../../../hooks/useOfflineQuery', () => ({
  useOfflineQuery: () => ({ data: h.ich, loading: false, refresh: vi.fn(), refreshLive: vi.fn() }),
}));

import AdminProfilePage from '../../../components/admin/pages/AdminProfilePage';

const LEITUNG = { id: 3, role_name: 'admin', display_name: 'Lena Leitung', username: 'lena.leitung', email: 'lena@example.org', organization: 'Testgemeinde' };
const ORG_LEITUNG = { ...LEITUNG, id: 2, role_name: 'org_admin', display_name: 'Olaf Orgleitung', username: 'olaf.orgleitung', email: 'olaf@example.org' };

const knopfInZeile = (titel: string, knopf: string) => screen.getByRole('button', { name: `${titel}: ${knopf}` });
const modal = (name: string): ModalAufruf | undefined => h.modale.find((m) => m.name === name);

beforeEach(() => {
  vi.clearAllMocks();
  h.apiGet.mockReset();
  h.breit = true;
  h.modale.length = 0;
  h.alerts.length = 0;
  h.user = LEITUNG;
  h.ich = { role_title: 'Gemeindepädagogin', email: 'lena@example.org', created_at: '2025-08-01T10:00:00.000Z' };
  h.antworten = { '/einladungen/meine': [] };
  h.apiGet.mockImplementation((url: string) => (url in h.antworten
    ? Promise.resolve({ data: h.antworten[url] })
    : Promise.reject(new Error(`nicht vorgesehen: ${url}`))));
});

const zeige = async () => {
  const ergebnis = render(<AdminProfilePage />);
  await screen.findByRole('heading', { level: 1, name: 'Mein Profil' });
  await waitFor(() => expect(h.apiGet).toHaveBeenCalledWith('/einladungen/meine'));
  await act(async () => { await Promise.resolve(); });
  return ergebnis;
};

describe('Profil der Leitung (Web): Person', () => {
  it('Seitenkopf, Name, Rolle mit Selbstbezeichnung und alle Angaben', async () => {
    await zeige();
    expect(screen.getByText('Konto und Einstellungen')).toBeInTheDocument();
    const person = screen.getByRole('region', { name: 'Person' });
    expect(within(person).getByRole('heading', { level: 2, name: 'Lena Leitung' })).toBeInTheDocument();
    expect(person).toHaveTextContent('Leitung · Gemeindepädagogin');
    expect(within(person).getByText('@lena.leitung')).toBeInTheDocument();
    expect(within(person).getByText('lena@example.org')).toBeInTheDocument();
    expect(within(person).getByText('Testgemeinde')).toBeInTheDocument();
    expect(within(person).getByText('01.08.2025')).toBeInTheDocument();
    // Die Rolle steht auch als Angabe, ohne die Selbstbezeichnung.
    expect(within(person).getByText('Leitung', { selector: 'dd, dd *' })).toBeInTheDocument();
  });

  it('ohne Selbstbezeichnung steht nur die Rolle; Leerzeichen zaehlen nicht', async () => {
    h.ich = { role_title: '   ', email: 'lena@example.org', created_at: '2025-08-01T10:00:00.000Z' };
    await zeige();
    expect(screen.getByRole('region', { name: 'Person' })).not.toHaveTextContent('·');
    expect(screen.getByRole('list', { name: 'Konto-Einstellungen' })).toHaveTextContent('Funktionsbeschreibungz.B. Pastor, Diakonin');
  });

  it('die Gemeindeleitung heisst so und traegt Indigo, die Leitung Petrol', async () => {
    const leitung = await zeige();
    expect(leitung.container.querySelector('.web-rolle--leitung')).not.toBeNull();
    expect(leitung.container.querySelector('.web-rolle--gemeindeleitung')).toBeNull();
    leitung.unmount();
    h.user = ORG_LEITUNG;
    const org = await zeige();
    expect(org.container.querySelector('.web-rolle--gemeindeleitung')).not.toBeNull();
    expect(org.container.querySelector('.web-rolle--leitung')).toBeNull();
    expect(screen.getByRole('region', { name: 'Person' })).toHaveTextContent('Gemeindeleitung · Gemeindepädagogin');
  });
});

describe('Profil der Leitung (Web): Einstellungen -- dieselben Handgriffe wie in der App', () => {
  it('Funktionsbeschreibung oeffnet das Modal mit der aktuellen Bezeichnung', async () => {
    await zeige();
    expect(screen.getByRole('list', { name: 'Konto-Einstellungen' })).toHaveTextContent('FunktionsbeschreibungAktuell: Gemeindepädagogin');
    fireEvent.click(knopfInZeile('Funktionsbeschreibung', 'Ändern'));
    expect(modal('ChangeRoleTitleModal')?.props.initialRoleTitle).toBe('Gemeindepädagogin');
    expect(modal('ChangeRoleTitleModal')?.optionen?.presentingElement).toBe(h.seite);
  });

  it('E-Mail, Passwort und Konto loeschen oeffnen die Modale in der Farbe der Leitung', async () => {
    await zeige();
    expect(screen.getByRole('list', { name: 'Konto-Einstellungen' })).toHaveTextContent('E-Mail-AdresseAktuell: lena@example.org');
    fireEvent.click(knopfInZeile('E-Mail-Adresse', 'Ändern'));
    expect(modal('ChangeEmailModal')?.props.variante).toBe('users');
    fireEvent.click(knopfInZeile('Passwort', 'Ändern'));
    expect(modal('ChangePasswordModal')?.props.variante).toBe('users');
    fireEvent.click(screen.getByRole('button', { name: 'Konto löschen' }));
    expect(modal('DeleteAccountModal')?.optionen?.presentingElement).toBe(h.seite);
  });

  it('Medien-Cache zeigt seinen Stand und leert ihn', async () => {
    await zeige();
    expect(screen.getByRole('list', { name: 'Konto-Einstellungen' })).toHaveTextContent('Medien-Cache8,0 MB belegt');
    fireEvent.click(knopfInZeile('Medien-Cache', 'Leeren'));
    expect(h.cacheLeeren).toHaveBeenCalledTimes(1);
  });

  it('wie in der App: kein Abmelden im Profil', async () => {
    await zeige();
    expect(screen.queryByRole('button', { name: 'Abmelden' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Konto löschen' })).toBeInTheDocument();
  });

  it('Benachrichtigungen wie bei Konfis und Team: die Auswahl der App in der Farbe der Leitung (Simon, 06.10.2026)', async () => {
    // In der App steht die Zeile unter Mehr › Konto; im Browser fehlte sie der
    // Leitung ganz -- „nicht gewollt".
    h.antworten['/notifications/preferences'] = {
      push_enabled: true, stumm: [],
      gruppen: [
        { id: 'chat', name: 'Chat', beschreibung: '', aktiv: true },
        { id: 'antraege', name: 'Anträge', beschreibung: '', aktiv: false },
      ],
    };
    await zeige();
    expect(await screen.findByText('1 von 2 Gruppen aufs Handy')).toBeInTheDocument();
    fireEvent.click(knopfInZeile('Benachrichtigungen', 'Auswählen'));
    expect(modal('PushAuswahlModal')?.props.variante).toBe('users');
    expect(modal('PushAuswahlModal')?.optionen?.presentingElement).toBe(h.seite);
  });

  it('Kennzahlen wie in der App (Mehr › Konto): Leitung und Gemeindeleitung haben die Zeile, sie öffnet dasselbe Fenster', async () => {
    // docs/planung/darf-freigeben.md, 09.10.2026: persönliche Wahl je Gemeinde.
    h.antworten['/notifications/kennzahlen'] = { antraege: true, verbuchen: true, challenges: false };
    const leitung = await zeige();
    expect(await screen.findByText('2 von 3 Bereichen mit roter Zahl')).toBeInTheDocument();
    fireEvent.click(knopfInZeile('Kennzahlen', 'Auswählen'));
    expect(modal('KennzahlenModal')?.optionen?.presentingElement).toBe(h.seite);
    leitung.unmount();
    h.user = ORG_LEITUNG;
    await zeige();
    expect(knopfInZeile('Kennzahlen', 'Auswählen')).toBeInTheDocument();
  });

  it('ohne Rolle mit Kennzahlen (Konfi-Rolle im Baum der Leitung): keine Zeile, keine Anfrage', async () => {
    h.user = { ...LEITUNG, role_name: 'konfi' };
    await zeige();
    expect(screen.queryByRole('button', { name: 'Kennzahlen: Auswählen' })).toBeNull();
    expect(h.apiGet).not.toHaveBeenCalledWith('/notifications/kennzahlen');
  });

  it('Einladungen stehen nur da, wenn eine offen ist', async () => {
    await zeige();
    expect(screen.queryByRole('heading', { name: /Einladung/ })).toBeNull();
  });

  it('eine offene Einladung nennt Gemeinde und Rolle mit den Wegen Annehmen und Ablehnen', async () => {
    h.antworten['/einladungen/meine'] = [{
      id: 8, organization_display_name: 'St. Marien', organization_name: 'st-marien', role_display_name: 'Hauptamt', role_name: 'admin',
      eingeladen_von_name: 'Olaf Orgleitung', expires_at: '2026-10-20T10:00:00Z',
    }];
    await zeige();
    const k = await waitFor(() => screen.getByRole('heading', { name: 'Einladung' }).closest('section') as HTMLElement);
    // Die Rolle heisst nach dem technischen Namen „Leitung", nicht nach dem Wert der Datenbank („Hauptamt").
    expect(k).toHaveTextContent('St. Marien');
    expect(k).toHaveTextContent('als Leitung · von Olaf Orgleitung');
    expect(within(k).getByRole('button', { name: 'Annehmen' })).toBeEnabled();
    expect(within(k).getByRole('button', { name: 'Ablehnen' })).toBeEnabled();
  });
});

describe('Profil der Leitung: schmales Fenster', () => {
  it('bleibt die Darstellung der App, ohne Web-Seite', async () => {
    h.breit = false;
    const { container } = render(<AdminProfilePage />);
    await act(async () => { await Promise.resolve(); });
    expect(container.querySelector('.web-seite')).toBeNull();
    expect(screen.queryByRole('region', { name: 'Person' })).toBeNull();
  });
});
