// Textbausteine in der Web-Fassung (/admin/support/bausteine), gerendert
// (docs/planung/support-web.md, Phase 2): links die Liste, rechts der Editor
// mit Platzhaltern als Knoepfen und Vorschau mit Beispielwerten, darunter
// Absendername und Fusszeile mit Vorschau. Die Logik ist die der App
// (useTextbausteine). Im schmalen Fenster bleibt die Seite der App.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import type { AlertOptionen } from './ionicAttrappe';

const h = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
  apiDelete: vi.fn(),
  push: vi.fn(),
  setError: vi.fn(),
  setSuccess: vi.fn(),
  alert: null as null | AlertOptionen,
  breit: true,
  user: { id: 9, role_name: 'super_admin', is_super_admin: true } as Record<string, unknown>,
}));

vi.mock('@ionic/react', async () => (await import('./ionicAttrappe')).ionicAttrappe({
  presentAlert: (o) => { h.alert = o; },
  router: { push: h.push, goBack: vi.fn(), canGoBack: () => false },
}));
vi.mock('../../../components/shared/AppKopfzeile', async () => (await import('./ionicAttrappe')).KopfzeileAttrappe);
vi.mock('../../../components/shared/WartungsHinweis', () => ({ default: () => null }));
vi.mock('../../../components/common/LoadingSpinner', () => ({ default: ({ message }: { message: string }) => <p>{message}</p> }));
vi.mock('../../../services/api', () => ({ default: { get: h.apiGet, post: h.apiPost, put: h.apiPut, delete: h.apiDelete } }));
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({ user: h.user, setError: h.setError, setSuccess: h.setSuccess, isOnline: true }),
}));
vi.mock('../../../utils/haptics', () => ({ triggerPullHaptic: vi.fn() }));
vi.mock('../../../navigation/breitesLayout', () => ({ useBreitesLayout: () => h.breit }));

import SupportTextbausteinePage from '../../../components/support/SupportTextbausteinePage';

const BAUSTEINE = [
  { id: 2, titel: 'Absage', betreff: null, text: 'Leider nein.', postfach: 'moin', sortierung: 5 },
  { id: 1, titel: 'Eingang bestätigt', betreff: 'Eure Anfrage', text: 'Hallo {{name}},\ndanke für {{gemeinde}}!', postfach: null, sortierung: 1 },
];

let bausteine: unknown[] | Error;
let einstellungen: unknown;

beforeEach(() => {
  vi.clearAllMocks();
  h.apiGet.mockReset();
  h.alert = null;
  h.breit = true;
  h.user = { id: 9, role_name: 'super_admin', is_super_admin: true };
  bausteine = BAUSTEINE;
  einstellungen = { fusszeile: 'Konfi Quest\nmoin@konfi-quest.example', absendername: 'Support-Team' };
  h.apiGet.mockImplementation((pfad: string) => {
    if (pfad === '/support/mail/bausteine') return bausteine instanceof Error ? Promise.reject(bausteine) : Promise.resolve({ data: bausteine });
    if (pfad === '/support/mail/einstellungen') return Promise.resolve({ data: einstellungen });
    return Promise.reject(new Error(`unerwartet: ${pfad}`));
  });
  h.apiPost.mockResolvedValue({ data: { id: 9 } });
  h.apiPut.mockResolvedValue({ data: {} });
  h.apiDelete.mockResolvedValue({ data: {} });
});

const oeffnen = async () => {
  render(<SupportTextbausteinePage />);
  await screen.findByRole('heading', { level: 2, name: '2 Bausteine' });
};
const feld = (name: string) => screen.getByLabelText(name) as HTMLInputElement;
const liste = () => screen.getByRole('list', { name: 'Textbausteine' });
const textfeld = () => screen.getByLabelText('Text des Bausteins') as HTMLTextAreaElement;
const vorschau = () => screen.getByRole('region', { name: 'Vorschau des Bausteins' });

describe('Textbausteine (Web): Aufbau und Liste', () => {
  it('zweiteilig: links die Liste, rechts der Editor; darunter Absender und Fusszeile', async () => {
    await oeffnen();
    expect(screen.getByRole('heading', { level: 1, name: 'Textbausteine' })).toBeInTheDocument();
    const spalten = document.querySelector('.web-spalten--links') as HTMLElement;
    expect([...spalten.children].map((k) => k.tagName)).toEqual(['ASIDE', 'DIV']);
    expect(within(spalten.children[0] as HTMLElement).getByRole('list', { name: 'Textbausteine' })).toBeInTheDocument();
    expect(within(spalten.children[1] as HTMLElement).getByRole('heading', { level: 2, name: 'Neuer Baustein' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Absender und Fußzeile' })).toBeInTheDocument();
  });

  it('die Liste: nach Sortierung, mit Postfach, Betreff und Auszug', async () => {
    await oeffnen();
    const eintraege = within(liste()).getAllByRole('listitem');
    expect(eintraege.map((e) => e.querySelector('.web-liste__titel')?.textContent)).toEqual(['Eingang bestätigt', 'Absage']);
    expect(eintraege[0]).toHaveTextContent('Beide Postfächer');
    expect(eintraege[0]).toHaveTextContent('Betreff: Eure Anfrage');
    expect(eintraege[0]).toHaveTextContent('Hallo {{name}}, danke für {{gemeinde}}!');
    expect(eintraege[1]).toHaveTextContent('moin@');
    expect(eintraege[1]).not.toHaveTextContent('Betreff:');
  });

  it('leer und Fehler', async () => {
    bausteine = [];
    const { unmount } = render(<SupportTextbausteinePage />);
    expect(await screen.findByText('Noch keine Bausteine')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: '0 Bausteine' })).toBeInTheDocument();
    unmount();
    bausteine = new Error('Netz weg');
    render(<SupportTextbausteinePage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Die Textbausteine konnten nicht geladen werden.');
  });

  it('ein einzelner Baustein steht in der Einzahl', async () => {
    bausteine = [BAUSTEINE[0]];
    render(<SupportTextbausteinePage />);
    expect(await screen.findByRole('heading', { level: 2, name: '1 Baustein' })).toBeInTheDocument();
  });
});

describe('Textbausteine (Web): anlegen, bearbeiten, loeschen', () => {
  it('anlegen: Koerper an den Server, danach neu geladen und Formular leer', async () => {
    await oeffnen();
    fireEvent.change(feld('Titel'), { target: { value: ' Zugangsdaten unterwegs ' } });
    fireEvent.change(screen.getByLabelText('Postfach'), { target: { value: 'support' } });
    fireEvent.change(feld('Betreff'), { target: { value: 'Zugang für {{gemeinde}}' } });
    fireEvent.change(textfeld(), { target: { value: 'Hallo {{name}},\ndein Benutzername ist {{benutzername}}.\n' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Baustein anlegen' })); });
    expect(h.apiPost).toHaveBeenCalledWith('/support/mail/bausteine', {
      titel: 'Zugangsdaten unterwegs',
      betreff: 'Zugang für {{gemeinde}}',
      text: 'Hallo {{name}},\ndein Benutzername ist {{benutzername}}.',
      postfach: 'support',
    });
    expect(h.setSuccess).toHaveBeenCalledWith('Baustein angelegt');
    expect(h.apiGet.mock.calls.filter(([p]) => p === '/support/mail/bausteine')).toHaveLength(2);
    expect(feld('Titel').value).toBe('');
  });

  it('ohne Titel oder Text: Meldung, kein Aufruf', async () => {
    await oeffnen();
    fireEvent.change(textfeld(), { target: { value: 'Hallo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Baustein anlegen' }));
    expect(h.setError).toHaveBeenCalledWith('Titel und Text sind erforderlich');
    expect(h.apiPost).not.toHaveBeenCalled();
  });

  it('ein Klick auf den Eintrag der Liste oeffnet ihn im Editor; "Beide Postfaecher" geht als null, leerer Betreff als null', async () => {
    await oeffnen();
    const eintrag = screen.getByRole('button', { name: 'Absage bearbeiten' });
    expect(eintrag).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(eintrag);
    expect(screen.getByRole('button', { name: 'Absage bearbeiten' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('heading', { level: 2, name: 'Baustein bearbeiten' })).toBeInTheDocument();
    expect(feld('Titel').value).toBe('Absage');
    expect((screen.getByLabelText('Postfach') as HTMLSelectElement).value).toBe('moin');
    fireEvent.change(screen.getByLabelText('Postfach'), { target: { value: 'beide' } });
    fireEvent.change(textfeld(), { target: { value: 'Leider nicht.' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Speichern' })); });
    expect(h.apiPut).toHaveBeenCalledWith('/support/mail/bausteine/2', { titel: 'Absage', betreff: null, text: 'Leider nicht.', postfach: null });
    expect(h.setSuccess).toHaveBeenCalledWith('Baustein gespeichert');
    expect(screen.getByRole('heading', { level: 2, name: 'Neuer Baustein' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Absage bearbeiten' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('"Neuer Baustein" und Abbrechen leeren das Formular ohne Aufruf', async () => {
    await oeffnen();
    fireEvent.click(screen.getByRole('button', { name: 'Absage bearbeiten' }));
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    expect(feld('Titel').value).toBe('');
    fireEvent.click(screen.getByRole('button', { name: 'Eingang bestätigt bearbeiten' }));
    expect(feld('Titel').value).toBe('Eingang bestätigt');
    fireEvent.click(screen.getByRole('button', { name: 'Neuer Baustein' }));
    expect(feld('Titel').value).toBe('');
    expect(screen.getByRole('heading', { level: 2, name: 'Neuer Baustein' })).toBeInTheDocument();
    expect(h.apiPut).not.toHaveBeenCalled();
  });

  it('loeschen gibt es nur an einem geoeffneten Baustein, und erst nach Rueckfrage', async () => {
    await oeffnen();
    expect(screen.queryByRole('button', { name: /löschen/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Absage bearbeiten' }));
    fireEvent.click(screen.getByRole('button', { name: 'Absage löschen' }));
    expect(h.alert?.header).toBe('Baustein löschen');
    expect(h.alert?.message).toBe('„Absage“ löschen? Das lässt sich nicht rückgängig machen.');
    expect(h.apiDelete).not.toHaveBeenCalled();
    await act(async () => { h.alert?.buttons?.find((b) => b.text === 'Löschen')?.handler?.(); });
    expect(h.apiDelete).toHaveBeenCalledWith('/support/mail/bausteine/2');
    expect(h.setSuccess).toHaveBeenCalledWith('Baustein gelöscht');
    // Der geloeschte war offen: der Editor ist wieder leer.
    expect(screen.getByRole('heading', { level: 2, name: 'Neuer Baustein' })).toBeInTheDocument();
  });

  it('ein Fehler beim Speichern: Meldung des Servers, die Eingabe bleibt', async () => {
    await oeffnen();
    fireEvent.change(feld('Titel'), { target: { value: 'Neu' } });
    fireEvent.change(textfeld(), { target: { value: 'Text' } });
    h.apiPost.mockRejectedValueOnce({ response: { status: 400, data: { error: 'Titel schon vergeben' } } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Baustein anlegen' })); });
    expect(h.setError).toHaveBeenCalledWith('Titel schon vergeben');
    expect(feld('Titel').value).toBe('Neu');
  });
});

describe('Textbausteine (Web): Platzhalter und Vorschau', () => {
  it('alle sechs Platzhalter als Knoepfe mit Bedeutung; ein Klick haengt ihn an den Text', async () => {
    await oeffnen();
    const knoepfe = within(screen.getByRole('list', { name: 'Platzhalter' })).getAllByRole('button');
    expect(knoepfe.map((k) => k.textContent)).toEqual(['{{name}}', '{{gemeinde}}', '{{lizenz}}', '{{testphase_bis}}', '{{benutzername}}', '{{absender}}']);
    expect(knoepfe[3]).toHaveAttribute('title', 'Ende der Testphase');
    expect(knoepfe[3]).toHaveAccessibleName('{{testphase_bis}} in den Text einfügen: Ende der Testphase');
    fireEvent.change(textfeld(), { target: { value: 'Hallo' } });
    fireEvent.click(screen.getByRole('button', { name: /^\{\{name\}\} in den Text einfügen/ }));
    expect(textfeld().value).toBe('Hallo {{name}}');
    fireEvent.click(screen.getByRole('button', { name: /^\{\{gemeinde\}\} in den Text einfügen/ }));
    expect(textfeld().value).toBe('Hallo {{name}} {{gemeinde}}');
  });

  it('die Vorschau fuellt die Platzhalter mit erfundenen Beispielwerten und haengt die Fusszeile an', async () => {
    await oeffnen();
    fireEvent.click(screen.getByRole('button', { name: 'Eingang bestätigt bearbeiten' }));
    expect(vorschau().textContent).toBe('Betreff: Eure AnfrageHallo Anna Beispiel,\ndanke für Kirchengemeinde Musterdorf!\n\n-- \nKonfi Quest\nmoin@konfi-quest.example');
  });

  it('{{absender}} nimmt den Absendernamen aus dem Feld darunter; ohne Namen bleibt der Platzhalter stehen', async () => {
    await oeffnen();
    fireEvent.change(textfeld(), { target: { value: 'Viele Grüße\n{{absender}}' } });
    expect(vorschau().textContent).toContain('Viele Grüße\nSupport-Team');
    fireEvent.change(feld('Absendername'), { target: { value: '' } });
    expect(vorschau().textContent).toContain('Viele Grüße\n{{absender}}');
    fireEvent.change(feld('Absendername'), { target: { value: 'Konfi Quest Support' } });
    expect(vorschau().textContent).toContain('Viele Grüße\nKonfi Quest Support');
  });

  it('der Testphasen-Platzhalter steht als Datum da; Unbekanntes bleibt stehen, damit es vor dem Senden auffaellt', async () => {
    await oeffnen();
    fireEvent.change(textfeld(), { target: { value: 'Bis {{testphase_bis}} -- {{unbekannt}}' } });
    expect(vorschau().textContent).toContain('Bis 02.11.2026 -- {{unbekannt}}');
  });

  it('ohne Text sagt die Vorschau es', async () => {
    await oeffnen();
    expect(vorschau().textContent).toBe('Noch kein Text.');
  });
});

describe('Textbausteine (Web): Absender und Fusszeile', () => {
  const vorschauFuss = () => screen.getByRole('region', { name: 'Vorschau mit Fußzeile' });

  it('geladen, mit Vorschau; Speichern erst nach einer Aenderung', async () => {
    await oeffnen();
    expect(feld('Absendername').value).toBe('Support-Team');
    expect((screen.getByLabelText('Fußzeile') as HTMLTextAreaElement).value).toBe('Konfi Quest\nmoin@konfi-quest.example');
    expect(vorschauFuss().textContent).toBe('Hallo,\n\nhier steht der Text der Antwort.\n\n-- \nKonfi Quest\nmoin@konfi-quest.example');
    const speichern = screen.getByRole('button', { name: 'Absender und Fußzeile speichern' });
    expect(speichern).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Fußzeile'), { target: { value: 'Konfi Quest\nsupport@konfi-quest.example\n\n' } });
    fireEvent.change(feld('Absendername'), { target: { value: ' Konfi Quest Support ' } });
    expect(vorschauFuss().textContent).toBe('Hallo,\n\nhier steht der Text der Antwort.\n\n-- \nKonfi Quest\nsupport@konfi-quest.example');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Absender und Fußzeile speichern' })); });
    expect(h.apiPut).toHaveBeenCalledWith('/support/mail/einstellungen', {
      fusszeile: 'Konfi Quest\nsupport@konfi-quest.example',
      absendername: 'Konfi Quest Support',
    });
    expect(h.setSuccess).toHaveBeenCalledWith('Absender und Fußzeile gespeichert');
    expect(screen.getByRole('button', { name: 'Absender und Fußzeile speichern' })).toBeDisabled();
  });

  it('ohne Fusszeile: die Vorschau zeigt nur den Text, ohne Trenner', async () => {
    einstellungen = { fusszeile: '', absendername: '' };
    await oeffnen();
    expect(vorschauFuss().textContent).toBe('Hallo,\n\nhier steht der Text der Antwort.');
  });

  it('Einstellungen nicht ladbar: Hinweis, die Felder sind gesperrt, die Bausteine gehen', async () => {
    h.apiGet.mockImplementation((pfad: string) => {
      if (pfad === '/support/mail/bausteine') return Promise.resolve({ data: BAUSTEINE });
      return Promise.reject(new Error('kaputt'));
    });
    render(<SupportTextbausteinePage />);
    expect(await screen.findByText('Absender und Fußzeile konnten nicht geladen werden.')).toBeInTheDocument();
    expect(feld('Absendername')).toBeDisabled();
    expect(screen.getByLabelText('Fußzeile')).toBeDisabled();
    expect(feld('Titel')).toBeEnabled();
  });
});

describe('Textbausteine: zwei Gesichter, eine Seite', () => {
  it('im schmalen Fenster bleibt die App-Darstellung -- mit derselben Logik', async () => {
    h.breit = false;
    render(<SupportTextbausteinePage />);
    await screen.findByText('2 Bausteine');
    expect(document.querySelector('.web-seite')).toBeNull();
    expect(screen.getByRole('button', { name: '{{name}} in den Text einfügen' })).toBeInTheDocument();
  });

  it('ohne Super-Admin-Recht: Hinweis, kein Abruf', () => {
    h.user = { id: 5, role_name: 'org_admin', is_super_admin: false };
    render(<SupportTextbausteinePage />);
    expect(screen.getByText('Nur für den Support')).toBeInTheDocument();
    expect(h.apiGet).not.toHaveBeenCalled();
  });
});
