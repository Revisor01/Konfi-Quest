// Mail einsortieren: App (Abschnitt der Mail) und Web (Dialog) lesen den
// Umschalter, die Zeile je Vorgang und die Suche aus EINER Beschreibung
// (seiten/supportEinsortieren.ts), gerendert. Bis 09.10.2026 suchte die App
// nur in Nummer, Betreff und Gemeinde -- der Browser auch in Art und Stand,
// die beide in der Zeile stehen.
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { mail, vorgang, vorgaengeServer } from '../components/support/vorgaengeServer';
import { inFassung } from '../../seiten/beschreibung';
import { EINSORTIEREN_IN, vorgangPasstZurSuche } from '../../seiten/supportEinsortieren';

const h = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  apiDelete: vi.fn(),
  breit: false,
  user: { id: 9, role_name: 'super_admin', is_super_admin: true } as Record<string, unknown>,
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
vi.mock('../../navigation/breitesLayout', () => ({ useBreitesLayout: () => h.breit }));

import SupportPostDetailPage from '../../components/support/SupportPostDetailPage';
import { supportMailZaehlerZuruecksetzen } from '../../navigation/supportMailZaehler';

let vorherTZ: string | undefined;
beforeAll(() => { vorherTZ = process.env.TZ; process.env.TZ = 'Europe/Berlin'; });
afterAll(() => { if (vorherTZ === undefined) delete process.env.TZ; else process.env.TZ = vorherTZ; });

const VORGAENGE = () => [
  vorgang(1, { status: 'neu', art: 'fehler', bereich: 'chat', betreff: 'Chat zeigt nichts Neues', organization_id: 7, created_at: '2026-10-03T07:00:00Z' }),
  vorgang(2, { status: 'in_arbeit', art: 'frage', bereich: 'konten', betreff: 'Wie lege ich einen Jahrgang an?', created_at: '2026-10-02T09:00:00Z' }),
];

beforeEach(() => {
  vi.clearAllMocks();
  h.breit = false;
  supportMailZaehlerZuruecksetzen();
  const server = vorgaengeServer({
    vorgaenge: VORGAENGE(),
    mails: [mail(31, null, { postfach: 'moin', von_adresse: 'anna@example.org', betreff: 'Frage zum Zugang', gesendet_am: '2026-10-03T09:00:00Z' })],
  });
  server.installieren({ get: h.apiGet, post: h.apiPost, patch: h.apiPatch, delete: h.apiDelete });
});

/** App: der Abschnitt der Mail, sobald die offenen Vorgänge geladen sind. */
const appOeffnen = async () => {
  h.breit = false;
  render(<SupportPostDetailPage nachrichtId={31} />);
  await waitFor(() => expect((screen.getByLabelText('Vorgang') as HTMLSelectElement).options.length).toBe(3));
};
const appZeilen = () => [...(screen.getByLabelText('Vorgang') as HTMLSelectElement).options].slice(1).map((o) => o.textContent);

/** Web: der Dialog „Mail einsortieren". */
const webOeffnen = async () => {
  h.breit = true;
  render(<SupportPostDetailPage nachrichtId={31} />);
  const seite = await screen.findByRole('complementary', { name: 'Einsortieren' });
  fireEvent.click(within(seite).getByRole('button', { name: 'Einsortieren' }));
  const dialog = await screen.findByRole('dialog', { name: 'Mail einsortieren' });
  await waitFor(() => expect(within(dialog).queryAllByRole('radio').length).toBe(2));
  return dialog;
};

describe('Einsortieren: eine Beschreibung für App und Browser', () => {
  it('die App zeigt genau die Wahl der Beschreibung: Bestehender Vorgang, Neuer Vorgang', async () => {
    await appOeffnen();
    const tabs = within(screen.getByRole('tablist', { name: 'Einsortieren in' })).getAllByRole('tab').map((t) => t.textContent);
    expect(tabs).toEqual(['Bestehender Vorgang', 'Neuer Vorgang']);
    expect(tabs).toEqual(inFassung(EINSORTIEREN_IN, 'app').map((m) => m.kurz ?? m.label));
  });

  it('der Browser zeigt dieselbe Wahl mit denselben Beschriftungen', async () => {
    const dialog = await webOeffnen();
    const chips = within(within(dialog).getByRole('group', { name: 'Einsortieren in' })).getAllByRole('button').map((b) => b.textContent);
    expect(chips).toEqual(['Bestehender Vorgang', 'Neuer Vorgang']);
    expect(chips).toEqual(inFassung(EINSORTIEREN_IN, 'web').map((m) => m.label));
  });

  it('beide Fassungen zeigen je Vorgang dieselben Angaben: Nummer, Betreff, Gemeinde, Art, Stand', async () => {
    await appOeffnen();
    expect(appZeilen()).toEqual([
      'Nr. 1 · Chat zeigt nichts Neues · Kirchengemeinde Musterdorf · Fehler · Neu',
      'Nr. 2 · Wie lege ich einen Jahrgang an? · Keine Gemeinde · Frage · In Arbeit',
    ]);
  });
});

describe('Einsortieren: dieselbe Suche', () => {
  it('die App findet einen Vorgang auch über seine Art -- wie der Browser (bis 09.10.2026 nicht)', async () => {
    await appOeffnen();
    fireEvent.change(screen.getByLabelText('Vorgang suchen'), { target: { value: 'fehler' } });
    expect(appZeilen()).toEqual(['Nr. 1 · Chat zeigt nichts Neues · Kirchengemeinde Musterdorf · Fehler · Neu']);
  });

  it('der Browser findet mit demselben Wort denselben Vorgang', async () => {
    const dialog = await webOeffnen();
    fireEvent.change(within(dialog).getByRole('searchbox', { name: 'Vorgang suchen' }), { target: { value: 'fehler' } });
    expect(within(dialog).getAllByRole('radio').map((r) => r.closest('label')!.textContent)).toEqual([
      expect.stringContaining('Nr. 1 · Chat zeigt nichts Neues'),
    ]);
  });

  it('das Prädikat: über den Stand, Umlaute gefaltet, Leerzeichen allein grenzen nicht ein', () => {
    // Die Testdaten tragen Art und Stand als Text; die Zeile braucht die Werte der Auswahl.
    const [eins, zwei] = VORGAENGE() as unknown as Array<Parameters<typeof vorgangPasstZurSuche>[0]>;
    expect(vorgangPasstZurSuche(zwei, 'in arbeit')).toBe(true);
    expect(vorgangPasstZurSuche(eins, 'in arbeit')).toBe(false);
    expect(vorgangPasstZurSuche(eins, '   ')).toBe(true);
    expect(vorgangPasstZurSuche(zwei, 'Jahrgaenge')).toBe(false);
    expect(vorgangPasstZurSuche(zwei, 'jahrgang')).toBe(true);
  });
});
