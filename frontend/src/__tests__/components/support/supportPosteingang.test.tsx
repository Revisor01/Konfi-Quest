// Posteingang der Support-Ansicht in der App-Fassung (/admin/support/post),
// gerendert (docs/planung/support-vorgaenge.md, Entscheidung 7): Zustand der
// Postfächer (eine Zeile im Betrieb, sonst je gestörtem Postfach eine Zeile
// mit dem Grund: Fehler, nicht eingerichtet, auf diesem Server aus),
// nur die Mails ohne Vorgang und nicht archiviert, ungelesene hervorgehoben,
// Filter Alle, Ungelesen, moin@, support@ und Archiv -- und nur für den
// Support. Einsortieren, Archivieren und Löschen liegen auf der Seite der Mail
// (supportPostDetail.test.tsx); die Tabelle der Web-Fassung steht in
// webPosteingang.test.tsx.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act, waitFor, within } from '@testing-library/react';
import { mail, vorgang, vorgaengeServer } from './vorgaengeServer';

const h = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  apiDelete: vi.fn(),
  push: vi.fn(),
  user: { id: 9, role_name: 'super_admin', is_super_admin: true } as Record<string, unknown>,
}));

vi.mock('@ionic/react', async () => (await import('./ionicAttrappe')).ionicAttrappe({
  router: { push: h.push, goBack: vi.fn(), canGoBack: () => false },
}));
vi.mock('../../../components/shared/AppKopfzeile', async () => (await import('./ionicAttrappe')).KopfzeileAttrappe);
vi.mock('../../../components/common/LoadingSpinner', () => ({ default: ({ message }: { message: string }) => <p>{message}</p> }));
vi.mock('../../../services/api', () => ({ default: { get: h.apiGet, post: h.apiPost, patch: h.apiPatch, delete: h.apiDelete } }));
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({ user: h.user, setError: vi.fn(), setSuccess: vi.fn(), isOnline: true }),
}));
vi.mock('../../../utils/haptics', () => ({ triggerPullHaptic: vi.fn() }));
vi.mock('../../../navigation/breitesLayout', () => ({ useBreitesLayout: () => false }));

import SupportPosteingangPage from '../../../components/support/SupportPosteingangPage';
import { supportMailZaehlerZuruecksetzen } from '../../../navigation/supportMailZaehler';

let server: ReturnType<typeof vorgaengeServer>;

const STATUS = {
  postfaecher: [
    { postfach: 'moin', adresse: 'moin@konfi-quest.de', eingerichtet: true, abgeholt_am: '2026-10-03T10:00:00Z', fehler: null, fehler_am: null, auf_diesem_server: true },
    { postfach: 'support', adresse: 'support@konfi-quest.de', eingerichtet: true, abgeholt_am: '2026-10-03T09:58:00Z', fehler: 'Anmeldung fehlgeschlagen', fehler_am: '2026-10-03T10:02:00Z', auf_diesem_server: true },
  ],
};

let status: unknown;

beforeEach(() => {
  vi.clearAllMocks();
  h.user = { id: 9, role_name: 'super_admin', is_super_admin: true };
  supportMailZaehlerZuruecksetzen();
  status = STATUS;
  server = vorgaengeServer({
    vorgaenge: [vorgang(1, { betreff: 'Chat zeigt nichts Neues' })],
    mails: [
      mail(31, null, { postfach: 'moin', von_name: 'Anna Beispiel', von_adresse: 'anna@example.org', betreff: 'Frage zum Zugang', text: 'Wie melde ich mich an?', gesendet_am: '2026-10-03T09:00:00Z', anhaenge: [{ name: 'plan.pdf' }] }),
      mail(30, null, { postfach: 'support', von_name: null, von_adresse: 'bob@example.org', betreff: null, text: null, gesendet_am: '2026-10-02T09:00:00Z', gelesen_am: '2026-10-02T10:00:00Z' }),
      mail(29, null, { postfach: 'moin', von_name: 'Presse', von_adresse: 'presse@example.org', betreff: 'Pressemitteilung', text: 'Sehr geehrte Damen und Herren', gesendet_am: '2026-09-28T09:00:00Z', gelesen_am: '2026-09-28T10:00:00Z', archiviert_am: '2026-09-29T09:00:00Z' }),
      mail(11, 1, { betreff: 'Gehört zu Vorgang 1' }),
    ],
  });
  server.installieren({ get: h.apiGet, post: h.apiPost, patch: h.apiPatch, delete: h.apiDelete });
  const vorher = h.apiGet.getMockImplementation()!;
  h.apiGet.mockImplementation((pfad: string, o?: unknown) => {
    if (pfad === '/support/mail/status') return status instanceof Error ? Promise.reject(status) : Promise.resolve({ data: status });
    return vorher(pfad, o as never);
  });
});

const ERSTE = 'Mail von Anna Beispiel: Frage zum Zugang, ungelesen';
const oeffnen = async () => {
  render(<SupportPosteingangPage />);
  await screen.findByRole('button', { name: ERSTE });
};

/** Die Zeilen der gestörten Postfächer, wie sie dastehen (eine je Postfach). */
const stoerungen = () => within(screen.getByRole('status', { name: 'Postfächer' })).getAllByRole('listitem').map((z) => z.textContent);

describe('Posteingang: Zustand der Postfächer', () => {
  // Seit 12.10.2026 je gestörtem Postfach eine Zeile statt eines Abschnitts
  // „Postfächer“ mit Kasten, Marke, Aufgabe und Hinweis-Kasten -- der Grund
  // bleibt sichtbar, in denselben Sätzen wie im Browser.
  it('stört ein Postfach, steht nur seine Zeile da: Postfach und Grund mit Zeit', async () => {
    await oeffnen();
    expect(stoerungen()).toEqual(['support@ · Fehler beim Abholen: Anmeldung fehlgeschlagen (03.10.2026, 12:02)']);
    // Keine Kästen mehr: kein Abschnitt, keine Marke, keine Aufgabe.
    expect(screen.queryByText('Postfächer')).toBeNull();
    expect(screen.queryByText('Eingerichtet')).toBeNull();
    expect(screen.queryByText(/Hilfe für Gemeinden/)).toBeNull();
    // Der Fehler ist als Fehler gekennzeichnet.
    expect(within(screen.getByRole('status', { name: 'Postfächer' })).getByRole('listitem')).toHaveClass('support-postfach-stoerung--fehler');
  });

  it('laufen beide Postfächer, steht nur eine Zeile da -- keine Störung', async () => {
    status = { postfaecher: STATUS.postfaecher.map((p) => ({ ...p, fehler: null, fehler_am: null })) };
    await oeffnen();
    expect(screen.getByText('moin@ und support@ eingerichtet · zuletzt abgeholt 03.10.2026, 12:00')).toBeInTheDocument();
    expect(screen.queryByRole('status', { name: 'Postfächer' })).toBeNull();
    expect(screen.queryByText('Eingerichtet')).toBeNull();
  });

  it('nicht eingerichtet und auf diesem Server aus: je eine Zeile mit dem Grund', async () => {
    status = {
      postfaecher: [
        { ...STATUS.postfaecher[0], eingerichtet: false, abgeholt_am: null },
        { ...STATUS.postfaecher[1], fehler: null, auf_diesem_server: false },
      ],
    };
    await oeffnen();
    expect(stoerungen()).toEqual([
      'moin@ · Zugangsdaten fehlen: Ohne Benutzer, Passwort und IMAP-Server auf dem Server wird dieses Postfach nicht gelesen.',
      'support@ · Auf diesem Server aus – Versand und Abholen laufen auf dem Hauptserver',
    ]);
    const zeilen = within(screen.getByRole('status', { name: 'Postfächer' })).getAllByRole('listitem');
    expect(zeilen.map((z) => [...z.classList].find((k) => k.startsWith('support-postfach-stoerung--')))).toEqual([
      'support-postfach-stoerung--hinweis',
      'support-postfach-stoerung--warnung',
    ]);
  });

  it('haben beide Postfächer denselben Grund, steht er einmal da: eine Zeile für beide', async () => {
    status = { postfaecher: STATUS.postfaecher.map((p) => ({ ...p, eingerichtet: false, fehler: null, fehler_am: null, abgeholt_am: null })) };
    await oeffnen();
    expect(stoerungen()).toEqual([
      'moin@ und support@ · Zugangsdaten fehlen: Ohne Benutzer, Passwort und IMAP-Server auf dem Server wird dieses Postfach nicht gelesen.',
    ]);
    expect(within(screen.getByRole('status', { name: 'Postfächer' })).getByRole('listitem')).toHaveClass('support-postfach-stoerung--hinweis');
  });

  it('zwei Gründe an einem Postfach stehen in seiner einen Zeile', async () => {
    status = {
      postfaecher: [
        STATUS.postfaecher[0],
        { ...STATUS.postfaecher[1], auf_diesem_server: false },
      ],
    };
    await oeffnen();
    expect(stoerungen()).toEqual([
      'support@ · Auf diesem Server aus – Versand und Abholen laufen auf dem Hauptserver · Fehler beim Abholen: Anmeldung fehlgeschlagen (03.10.2026, 12:02)',
    ]);
  });

  it('ohne das Feld auf_diesem_server (älterer Server): kein Hinweis „aus“', async () => {
    status = { postfaecher: STATUS.postfaecher.map(({ auf_diesem_server: _weg, ...p }) => p) };
    await oeffnen();
    // Nur support@ stört (Fehler beim Abholen); moin@ gilt ohne das Feld als hier bedient.
    expect(stoerungen()).toEqual(['support@ · Fehler beim Abholen: Anmeldung fehlgeschlagen (03.10.2026, 12:02)']);
    expect(screen.queryByText(/Auf diesem Server aus/)).toBeNull();
  });

  it('Zustand nicht ladbar: Hinweis, die Liste steht trotzdem', async () => {
    status = new Error('Netz weg');
    await oeffnen();
    expect(screen.getByText('Der Zustand der Postfächer konnte nicht geladen werden.')).toHaveAttribute('role', 'status');
    expect(screen.getAllByRole('button', { name: /^Mail von / })).toHaveLength(2);
  });

  it('der Server meldet keine Postfächer: eine Zeile', async () => {
    status = { postfaecher: [] };
    await oeffnen();
    expect(screen.getByText('Der Server meldet keine Postfächer.')).toHaveAttribute('role', 'status');
    expect(screen.queryByRole('status', { name: 'Postfächer' })).toBeNull();
  });
});

describe('Posteingang: Liste und Filter', () => {
  it('nur Mails ohne Vorgang, nicht archiviert, neueste zuerst; ungelesene hervorgehoben und so benannt', async () => {
    await oeffnen();
    const eintraege = screen.getAllByRole('button', { name: /^Mail von / });
    expect(eintraege.map((e) => e.getAttribute('aria-label'))).toEqual([
      ERSTE,
      'Mail von bob@example.org: (ohne Betreff)',
    ]);
    expect(eintraege[0]).toHaveTextContent('1 Anhang');
    expect(eintraege[0]).toHaveTextContent('Wie melde ich mich an?');
    // Wie die Zeile eines Vorgangs (12.10.2026): Betreff über die volle
    // Breite, darunter Absender und Zeit, der Auszug und die Marke des Postfachs.
    const inhalt = eintraege[0].querySelector('.app-list-item__content') as HTMLElement;
    expect([...inhalt.children].map((k) => [k.className, k.textContent])).toEqual([
      ['app-list-item__title', 'Frage zum Zugang'],
      ['app-list-item__meta support-listenzeile__meta', 'Anna Beispiel · 03.10.2026, 11:00 · 1 Anhang'],
      ['support-listenzeile__auszug', 'Wie melde ich mich an?'],
      ['support-listenzeile__marken', 'moin@'],
    ]);
    expect((inhalt.children[0] as HTMLElement).style.hyphens).toBe('');
    // Rechts neben dem Inhalt nur noch Punkt und Pfeil; ohne Auszug fällt seine Zeile weg.
    expect([...(eintraege[0].querySelector('.app-list-item__row') as HTMLElement).children].map((k) => k.className))
      .toEqual(['app-list-item__main', 'app-ungelesen-punkt support-listenzeile__punkt']);
    expect([...(eintraege[1].querySelector('.app-list-item__content') as HTMLElement).children].map((k) => k.textContent))
      .toEqual(['(ohne Betreff)', 'bob@example.org · 02.10.2026, 11:00', 'support@']);
    expect(eintraege[0].querySelector('.app-ungelesen-punkt')).not.toBeNull();
    expect(eintraege[1].querySelector('.app-ungelesen-punkt')).toBeNull();
    expect((eintraege[0].querySelector('.app-list-item__title') as HTMLElement).style.fontWeight).toBe('var(--app-schrift-fett)');
    expect(screen.getByText('2 Mails zum Einsortieren')).toBeInTheDocument();
    expect(server.aufrufe('get', '/support/mail/eingang').map((a) => a.optionen)).toEqual([undefined]);
  });

  it('ein Antippen öffnet die Mail', async () => {
    await oeffnen();
    fireEvent.click(screen.getByRole('button', { name: ERSTE }));
    expect(h.push).toHaveBeenCalledWith('/admin/support/post/31');
  });

  it('die Filter zählen aus einer Antwort und wechseln ohne neuen Abruf', async () => {
    await oeffnen();
    expect(screen.getByRole('tab', { name: 'Alle 2' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Ungelesen 1' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'moin@ 1' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'support@ 1' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'support@ 1' }));
    expect(screen.getAllByRole('button', { name: /^Mail von / }).map((e) => e.getAttribute('aria-label'))).toEqual(['Mail von bob@example.org: (ohne Betreff)']);
    fireEvent.click(screen.getByRole('tab', { name: 'Ungelesen 1' }));
    expect(screen.getAllByRole('button', { name: /^Mail von / }).map((e) => e.getAttribute('aria-label'))).toEqual([ERSTE]);
    expect(server.aufrufe('get', '/support/mail/eingang')).toHaveLength(1);
  });

  it('Archiv lädt erst beim Wählen (archiv=1) und zeigt die archivierten Mails', async () => {
    await oeffnen();
    await act(async () => { fireEvent.click(screen.getByRole('tab', { name: 'Archiv' })); });
    expect(await screen.findByText('1 Mail im Archiv')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Mail von Presse: Pressemitteilung' })).toBeInTheDocument();
    expect(server.aufrufe('get', '/support/mail/eingang').map((a) => a.optionen)).toEqual([undefined, { params: { archiv: 1 } }]);
  });

  it('leer: alles ist einsortiert; ein leeres Archiv sagt es', async () => {
    server.stand.mails = server.stand.mails.filter((m) => m.vorgang_id !== null);
    render(<SupportPosteingangPage />);
    expect(await screen.findByText('Nichts einzusortieren')).toBeInTheDocument();
    expect(screen.getByText('Alles ist einsortiert. Neue Mails, die zu keinem Vorgang passen, erscheinen hier.')).toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByRole('tab', { name: 'Archiv' })); });
    expect(await screen.findByText('Das Archiv ist leer')).toBeInTheDocument();
  });

  it('Fehler: Hinweis mit erneutem Versuch, der wirklich neu lädt', async () => {
    server.stand.fehler.set('GET /support/mail/eingang', new Error('Netz weg'));
    render(<SupportPosteingangPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Der Posteingang konnte nicht geladen werden.');
    server.stand.fehler.delete('GET /support/mail/eingang');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Erneut versuchen/ })); });
    expect(await screen.findByRole('button', { name: ERSTE })).toBeInTheDocument();
  });

  it('„Zu den Vorgängen“ führt in die Liste der Vorgänge', async () => {
    await oeffnen();
    fireEvent.click(screen.getByRole('button', { name: 'Zu den Vorgängen' }));
    expect(h.push).toHaveBeenCalledWith('/admin/support/vorgaenge');
  });

  it('eine Mail, die an anderer Stelle einsortiert wird, verlässt die Liste beim nächsten Laden', async () => {
    await oeffnen();
    server.stand.mails.find((m) => m.id === 30)!.vorgang_id = 1;
    const { meldeSupportGeaendert } = await import('../../../utils/supportAktualisieren');
    await act(async () => { meldeSupportGeaendert(); });
    await waitFor(() => expect(screen.getAllByRole('button', { name: /^Mail von / })).toHaveLength(1));
  });
});

describe('Posteingang: nur für Super-Admin', () => {
  it('eine Gemeindeleitung ohne Merkmal sieht den Hinweis, ohne Abruf', () => {
    h.user = { id: 5, role_name: 'org_admin', is_super_admin: false };
    render(<SupportPosteingangPage />);
    expect(screen.getByText('Nur für den Support')).toBeInTheDocument();
    expect(server.aufrufe('get', '/support/mail/eingang')).toHaveLength(0);
  });
});
