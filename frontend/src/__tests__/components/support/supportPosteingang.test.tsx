// Posteingang der Support-Ansicht (/admin/support/post), gerendert: Zustand
// der Postfaecher (eingerichtet, zuletzt abgeholt, Fehler, auf diesem
// Server aus), Filter nach Postfach, nicht zugeordnete Mails mit
// hervorgehobenen ungelesenen, Weg zum Schriftwechsel einer Gemeinde -- und
// nur fuer Super-Admin (Support-Mail, 03.10.2026).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act, within } from '@testing-library/react';

const h = vi.hoisted(() => ({
  apiGet: vi.fn(),
  push: vi.fn(),
  user: { id: 9, role_name: 'super_admin', is_super_admin: true } as Record<string, unknown>,
}));

vi.mock('@ionic/react', async () => (await import('./ionicAttrappe')).ionicAttrappe({
  router: { push: h.push, goBack: vi.fn(), canGoBack: () => false },
}));
vi.mock('../../../components/shared/AppKopfzeile', async () => (await import('./ionicAttrappe')).KopfzeileAttrappe);
vi.mock('../../../components/common/LoadingSpinner', () => ({ default: ({ message }: { message: string }) => <p>{message}</p> }));
vi.mock('../../../services/api', () => ({ default: { get: h.apiGet } }));
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({ user: h.user, setError: vi.fn(), setSuccess: vi.fn(), isOnline: true }),
}));
vi.mock('../../../utils/haptics', () => ({ triggerPullHaptic: vi.fn() }));

import SupportPosteingangPage from '../../../components/support/SupportPosteingangPage';
import { supportMailZaehlerZuruecksetzen } from '../../../navigation/supportMailZaehler';

const STATUS = {
  postfaecher: [
    { postfach: 'moin', adresse: 'moin@konfi-quest.de', eingerichtet: true, abgeholt_am: '2026-10-03T10:00:00Z', fehler: null, fehler_am: null, auf_diesem_server: true },
    { postfach: 'support', adresse: 'support@konfi-quest.de', eingerichtet: true, abgeholt_am: '2026-10-03T09:58:00Z', fehler: 'Anmeldung fehlgeschlagen', fehler_am: '2026-10-03T10:02:00Z', auf_diesem_server: true },
  ],
};
const EINGANG = [
  { id: 31, postfach: 'moin', von_adresse: 'anna@example.org', von_name: 'Anna Beispiel', betreff: 'Frage zum Zugang',
    auszug: 'Wie melde ich mich an?', gesendet_am: '2026-10-03T09:00:00Z', gelesen_am: null, anhaenge: [{ name: 'plan.pdf' }] },
  { id: 30, postfach: 'support', von_adresse: 'bob@example.org', von_name: null, betreff: null,
    auszug: null, gesendet_am: '2026-10-02T09:00:00Z', gelesen_am: '2026-10-02T10:00:00Z', anhaenge: [] },
];
const GEMEINDEN = [
  { id: 8, name: 'buesum', display_name: 'Büsum' },
  { id: 7, name: 'heide', display_name: 'Kirchengemeinde Heide' },
];

let antworten: Record<string, unknown>;

beforeEach(() => {
  vi.clearAllMocks();
  h.apiGet.mockReset();
  h.user = { id: 9, role_name: 'super_admin', is_super_admin: true };
  supportMailZaehlerZuruecksetzen();
  antworten = {
    '/support/mail/status': STATUS,
    '/support/mail/eingang': EINGANG,
    '/organizations': GEMEINDEN,
    '/support/mail/zaehler': { anfragen: 0, gemeinden: 2, eingang: 1, je_anfrage: {}, je_gemeinde: { 7: 2 } },
  };
  h.apiGet.mockImplementation((pfad: string) => {
    const wert = antworten[pfad];
    if (wert === undefined) return Promise.reject(new Error(`unerwartet: ${pfad}`));
    return wert instanceof Error ? Promise.reject(wert) : Promise.resolve({ data: wert });
  });
});

const oeffnen = async () => {
  render(<SupportPosteingangPage />);
  await screen.findByRole('button', { name: 'Mail von Anna Beispiel: Frage zum Zugang, ungelesen' });
};

describe('Posteingang: Zustand der Postfaecher', () => {
  it('zeigt je Postfach Adresse, eingerichtet, zuletzt abgeholt und einen Fehler beim Abholen', async () => {
    await oeffnen();
    expect(screen.getByText('moin@konfi-quest.de')).toBeInTheDocument();
    expect(screen.getByText('support@konfi-quest.de')).toBeInTheDocument();
    expect(screen.getAllByText('Eingerichtet')).toHaveLength(2);
    expect(screen.getByText('Anfragen und Erstkontakt · zuletzt abgeholt 03.10.2026, 12:00')).toBeInTheDocument();
    const fehler = screen.getAllByRole('status').find((s) => s.textContent?.includes('Fehler beim Abholen'));
    expect(fehler?.textContent).toBe('Fehler beim AbholenAnmeldung fehlgeschlagen (03.10.2026, 12:02)');
  });

  it('nicht eingerichtet und auf diesem Server aus: je ein Hinweis', async () => {
    antworten['/support/mail/status'] = {
      postfaecher: [
        { ...STATUS.postfaecher[0], eingerichtet: false, abgeholt_am: null },
        { ...STATUS.postfaecher[1], fehler: null, auf_diesem_server: false },
      ],
    };
    await oeffnen();
    expect(screen.getByText('Nicht eingerichtet')).toBeInTheDocument();
    expect(screen.getByText('Anfragen und Erstkontakt · noch nicht abgeholt')).toBeInTheDocument();
    expect(screen.getByText('Zugangsdaten fehlen')).toBeInTheDocument();
    expect(screen.getByText('Auf diesem Server aus – Versand und Abholen laufen auf dem Hauptserver')).toBeInTheDocument();
  });

  it('ohne das Feld auf_diesem_server (aelterer Server): kein Hinweis „aus"', async () => {
    antworten['/support/mail/status'] = {
      postfaecher: STATUS.postfaecher.map(({ auf_diesem_server: _weg, ...p }) => p),
    };
    await oeffnen();
    expect(screen.getAllByText('Eingerichtet')).toHaveLength(2);
    expect(screen.queryByText(/Auf diesem Server aus/)).toBeNull();
  });

  it('Zustand nicht ladbar: Hinweis, die Liste steht trotzdem', async () => {
    antworten['/support/mail/status'] = new Error('Netz weg');
    await oeffnen();
    expect(screen.getByText('Der Zustand der Postfächer konnte nicht geladen werden.')).toBeInTheDocument();
  });
});

describe('Posteingang: Liste und Filter', () => {
  it('nicht zugeordnete Mails in der Reihenfolge des Servers; ungelesene hervorgehoben und so benannt', async () => {
    await oeffnen();
    const eintraege = screen.getAllByRole('button', { name: /^Mail von / });
    expect(eintraege.map((e) => e.getAttribute('aria-label'))).toEqual([
      'Mail von Anna Beispiel: Frage zum Zugang, ungelesen',
      'Mail von bob@example.org: (ohne Betreff)',
    ]);
    expect(eintraege[0]).toHaveTextContent('1 Anhang');
    expect(eintraege[0]).toHaveTextContent('Wie melde ich mich an?');
    expect(eintraege[0].querySelector('.app-ungelesen-punkt')).not.toBeNull();
    expect(eintraege[1].querySelector('.app-ungelesen-punkt')).toBeNull();
    expect((eintraege[0].querySelector('.app-list-item__title') as HTMLElement).style.fontWeight).toBe('var(--app-schrift-fett)');
    expect(screen.getByText('2 nicht zugeordnete Mails')).toBeInTheDocument();
    expect(h.apiGet).toHaveBeenCalledWith('/support/mail/eingang', undefined);
  });

  it('ein Antippen oeffnet die Mail', async () => {
    await oeffnen();
    fireEvent.click(screen.getByRole('button', { name: 'Mail von Anna Beispiel: Frage zum Zugang, ungelesen' }));
    expect(h.push).toHaveBeenCalledWith('/admin/support/post/31');
  });

  it('der Filter fragt das Postfach ab; „Alle" ohne Parameter', async () => {
    await oeffnen();
    expect(screen.getByRole('tab', { name: 'Alle' })).toHaveAttribute('aria-selected', 'true');
    antworten['/support/mail/eingang'] = [];
    await act(async () => { fireEvent.click(screen.getByRole('tab', { name: 'moin@' })); });
    expect(h.apiGet).toHaveBeenLastCalledWith('/support/mail/eingang', { params: { postfach: 'moin' } });
    expect(await screen.findByText('Keine nicht zugeordneten Mails an moin@.')).toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByRole('tab', { name: 'support@' })); });
    expect(h.apiGet).toHaveBeenLastCalledWith('/support/mail/eingang', { params: { postfach: 'support' } });
  });

  it('leer: alles ist zugeordnet', async () => {
    antworten['/support/mail/eingang'] = [];
    render(<SupportPosteingangPage />);
    expect(await screen.findByText('Jede Mail ist einer Anfrage oder Gemeinde zugeordnet.')).toBeInTheDocument();
  });

  it('Fehler: Hinweis mit erneutem Versuch', async () => {
    antworten['/support/mail/eingang'] = new Error('Netz weg');
    render(<SupportPosteingangPage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Der Posteingang konnte nicht geladen werden.');
    antworten['/support/mail/eingang'] = EINGANG;
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Erneut versuchen/ })); });
    expect(await screen.findByRole('button', { name: 'Mail von Anna Beispiel: Frage zum Zugang, ungelesen' })).toBeInTheDocument();
  });
});

describe('Posteingang: Schriftwechsel mit Gemeinden', () => {
  it('Gemeinden mit ungelesenen Mails stehen mit roter Zahl da und oeffnen ihren Schriftwechsel', async () => {
    await oeffnen();
    const heide = await screen.findByRole('button', { name: 'Schriftwechsel Kirchengemeinde Heide, 2 ungelesen' });
    expect(within(heide).getByText('2')).toHaveClass('app-zaehler-kugel');
    fireEvent.click(heide);
    expect(h.push).toHaveBeenCalledWith('/admin/support/post/gemeinde/7');
    expect(h.apiGet).toHaveBeenCalledWith('/support/mail/zaehler');
  });

  it('jede Gemeinde laesst sich waehlen; ohne Wahl ist „Schriftwechsel öffnen" aus', async () => {
    await oeffnen();
    const oeffnenKnopf = screen.getByRole('button', { name: 'Schriftwechsel öffnen' });
    expect(oeffnenKnopf).toBeDisabled();
    const auswahl = screen.getByLabelText('Schriftwechsel einer Gemeinde') as HTMLSelectElement;
    expect([...auswahl.options].map((o) => o.textContent)).toEqual(['Gemeinde wählen', 'Büsum', 'Kirchengemeinde Heide']);
    fireEvent.change(auswahl, { target: { value: '8' } });
    fireEvent.click(screen.getByRole('button', { name: 'Schriftwechsel öffnen' }));
    expect(h.push).toHaveBeenCalledWith('/admin/support/post/gemeinde/8');
  });

  it('ohne ungelesene Mails von Gemeinden: ein Satz statt der Liste', async () => {
    antworten['/support/mail/zaehler'] = { anfragen: 0, gemeinden: 0, eingang: 1, je_anfrage: {}, je_gemeinde: {} };
    await oeffnen();
    expect(await screen.findByText('Keine ungelesenen Mails von Gemeinden.')).toBeInTheDocument();
  });
});

describe('Posteingang: nur fuer Super-Admin', () => {
  it('eine Gemeindeleitung ohne Merkmal sieht den Hinweis, ohne Abruf', () => {
    h.user = { id: 5, role_name: 'org_admin', is_super_admin: false };
    render(<SupportPosteingangPage />);
    expect(screen.getByText('Nur für den Support')).toBeInTheDocument();
    expect(h.apiGet).not.toHaveBeenCalled();
  });
});
