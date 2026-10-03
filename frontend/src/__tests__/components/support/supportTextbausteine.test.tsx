// Textbausteine der Support-Ansicht (/admin/support/bausteine), gerendert
// (Support-Mail, 03.10.2026): Liste, Anlegen, Bearbeiten, Loeschen mit
// Rueckfrage, Platzhalter-Hilfe mit allen sechs Platzhaltern, Absendername
// und Fusszeile mit Vorschau -- und nur fuer Super-Admin.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act, within } from '@testing-library/react';
import type { AlertOptionen } from './ionicAttrappe';

const h = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
  apiDelete: vi.fn(),
  setError: vi.fn(),
  setSuccess: vi.fn(),
  alert: null as null | AlertOptionen,
  user: { id: 9, role_name: 'super_admin', is_super_admin: true } as Record<string, unknown>,
}));

vi.mock('@ionic/react', async () => (await import('./ionicAttrappe')).ionicAttrappe({
  presentAlert: (o) => { h.alert = o; },
}));
vi.mock('../../../components/shared/AppKopfzeile', async () => (await import('./ionicAttrappe')).KopfzeileAttrappe);
vi.mock('../../../components/common/LoadingSpinner', () => ({ default: ({ message }: { message: string }) => <p>{message}</p> }));
vi.mock('../../../services/api', () => ({ default: { get: h.apiGet, post: h.apiPost, put: h.apiPut, delete: h.apiDelete } }));
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({ user: h.user, setError: h.setError, setSuccess: h.setSuccess, isOnline: true }),
}));
vi.mock('../../../utils/haptics', () => ({ triggerPullHaptic: vi.fn() }));

import SupportTextbausteinePage from '../../../components/support/SupportTextbausteinePage';

const BAUSTEINE = [
  { id: 2, titel: 'Absage', betreff: null, text: 'Leider nein.', postfach: 'moin', sortierung: 5 },
  { id: 1, titel: 'Eingang bestätigt', betreff: 'Eure Anfrage', text: 'Hallo {{name}},\ndanke!', postfach: null, sortierung: 1 },
];

let bausteine: unknown[] | Error;
let einstellungen: unknown;

beforeEach(() => {
  vi.clearAllMocks();
  h.apiGet.mockReset();
  h.alert = null;
  h.user = { id: 9, role_name: 'super_admin', is_super_admin: true };
  bausteine = BAUSTEINE;
  einstellungen = { fusszeile: 'Konfi Quest\nmoin@konfi-quest.de', absendername: 'Support-Team' };
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
  await screen.findByText('2 Bausteine');
};
const feld = (name: string) => screen.getByLabelText(name) as HTMLInputElement;

describe('Textbausteine: Liste', () => {
  it('nach Sortierung, mit Postfach, Betreff und Auszug', async () => {
    await oeffnen();
    const liste = screen.getByRole('list', { name: 'Textbausteine' });
    const eintraege = within(liste).getAllByRole('listitem');
    expect(eintraege.map((e) => e.querySelector('.app-list-item__title')?.textContent)).toEqual(['Eingang bestätigt', 'Absage']);
    expect(eintraege[0]).toHaveTextContent('Beide Postfächer');
    expect(eintraege[0]).toHaveTextContent('Betreff: Eure Anfrage');
    expect(eintraege[0]).toHaveTextContent('Hallo {{name}}, danke!');
    expect(eintraege[1]).toHaveTextContent('moin@');
  });

  it('leer und Fehler', async () => {
    bausteine = [];
    const { unmount } = render(<SupportTextbausteinePage />);
    expect(await screen.findByText('Noch keine Bausteine')).toBeInTheDocument();
    unmount();
    bausteine = new Error('Netz weg');
    render(<SupportTextbausteinePage />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Die Textbausteine konnten nicht geladen werden.');
  });
});

describe('Textbausteine: anlegen, bearbeiten, loeschen', () => {
  it('anlegen: Koerper an den Server, danach neu geladen und Formular leer', async () => {
    await oeffnen();
    fireEvent.change(feld('Titel'), { target: { value: ' Zugangsdaten unterwegs ' } });
    fireEvent.change(screen.getByLabelText('Postfach'), { target: { value: 'support' } });
    fireEvent.change(feld('Betreff'), { target: { value: 'Zugang für {{gemeinde}}' } });
    fireEvent.change(screen.getByLabelText('Text des Bausteins'), { target: { value: 'Hallo {{name}},\ndein Benutzername ist {{benutzername}}.\n' } });
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
    fireEvent.change(screen.getByLabelText('Text des Bausteins'), { target: { value: 'Hallo' } });
    fireEvent.click(screen.getByRole('button', { name: 'Baustein anlegen' }));
    expect(h.setError).toHaveBeenCalledWith('Titel und Text sind erforderlich');
    expect(h.apiPost).not.toHaveBeenCalled();
  });

  it('bearbeiten: Formular vorbelegt; „Beide Postfächer" geht als null, leerer Betreff als null', async () => {
    await oeffnen();
    fireEvent.click(screen.getByRole('button', { name: 'Absage bearbeiten' }));
    expect(screen.getByText('Baustein bearbeiten')).toBeInTheDocument();
    expect(feld('Titel').value).toBe('Absage');
    expect((screen.getByLabelText('Postfach') as HTMLSelectElement).value).toBe('moin');
    fireEvent.change(screen.getByLabelText('Postfach'), { target: { value: 'beide' } });
    fireEvent.change(screen.getByLabelText('Text des Bausteins'), { target: { value: 'Leider nicht.' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Speichern' })); });
    expect(h.apiPut).toHaveBeenCalledWith('/support/mail/bausteine/2', { titel: 'Absage', betreff: null, text: 'Leider nicht.', postfach: null });
    expect(h.setSuccess).toHaveBeenCalledWith('Baustein gespeichert');
    expect(screen.getByText('Neuer Baustein')).toBeInTheDocument();
  });

  it('Abbrechen leert das Formular ohne Aufruf', async () => {
    await oeffnen();
    fireEvent.click(screen.getByRole('button', { name: 'Absage bearbeiten' }));
    fireEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    expect(feld('Titel').value).toBe('');
    expect(h.apiPut).not.toHaveBeenCalled();
  });

  it('loeschen erst nach Rueckfrage', async () => {
    await oeffnen();
    fireEvent.click(screen.getByRole('button', { name: 'Absage löschen' }));
    expect(h.alert?.header).toBe('Baustein löschen');
    expect(h.alert?.message).toBe('„Absage“ löschen? Das lässt sich nicht rückgängig machen.');
    expect(h.apiDelete).not.toHaveBeenCalled();
    await act(async () => { h.alert?.buttons?.find((b) => b.text === 'Löschen')?.handler?.(); });
    expect(h.apiDelete).toHaveBeenCalledWith('/support/mail/bausteine/2');
    expect(h.setSuccess).toHaveBeenCalledWith('Baustein gelöscht');
  });
});

describe('Textbausteine: Platzhalter-Hilfe', () => {
  it('nennt alle sechs Platzhalter mit Bedeutung; „Einfügen" haengt ihn an den Text', async () => {
    await oeffnen();
    const hilfe = within(screen.getByRole('list', { name: 'Platzhalter' })).getAllByRole('listitem');
    expect(hilfe.map((e) => e.querySelector('code')?.textContent)).toEqual([
      '{{name}}', '{{gemeinde}}', '{{lizenz}}', '{{testphase_bis}}', '{{benutzername}}', '{{absender}}',
    ]);
    expect(hilfe[3]).toHaveTextContent('Ende der Testphase');
    fireEvent.change(screen.getByLabelText('Text des Bausteins'), { target: { value: 'Hallo' } });
    fireEvent.click(screen.getByRole('button', { name: '{{name}} in den Text einfügen' }));
    expect((screen.getByLabelText('Text des Bausteins') as HTMLTextAreaElement).value).toBe('Hallo {{name}}');
  });
});

describe('Textbausteine: Absender und Fusszeile', () => {
  it('geladen, mit Vorschau; Speichern erst nach einer Aenderung', async () => {
    await oeffnen();
    expect(feld('Absendername').value).toBe('Support-Team');
    expect((screen.getByLabelText('Fußzeile') as HTMLTextAreaElement).value).toBe('Konfi Quest\nmoin@konfi-quest.de');
    expect(screen.getByRole('region', { name: 'Vorschau mit Fußzeile' }).textContent)
      .toBe('Hallo,\n\nhier steht der Text der Antwort.\n\n-- \nKonfi Quest\nmoin@konfi-quest.de');
    const speichern = screen.getByRole('button', { name: 'Absender und Fußzeile speichern' });
    expect(speichern).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Fußzeile'), { target: { value: 'Konfi Quest\nsupport@konfi-quest.de\n\n' } });
    fireEvent.change(feld('Absendername'), { target: { value: ' Konfi Quest Support ' } });
    expect(screen.getByRole('region', { name: 'Vorschau mit Fußzeile' }).textContent)
      .toBe('Hallo,\n\nhier steht der Text der Antwort.\n\n-- \nKonfi Quest\nsupport@konfi-quest.de');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Absender und Fußzeile speichern' })); });
    expect(h.apiPut).toHaveBeenCalledWith('/support/mail/einstellungen', {
      fusszeile: 'Konfi Quest\nsupport@konfi-quest.de',
      absendername: 'Konfi Quest Support',
    });
    expect(h.setSuccess).toHaveBeenCalledWith('Absender und Fußzeile gespeichert');
    expect(screen.getByRole('button', { name: 'Absender und Fußzeile speichern' })).toBeDisabled();
  });

  it('ohne Fusszeile: die Vorschau zeigt nur den Text, ohne Trenner', async () => {
    einstellungen = { fusszeile: '', absendername: '' };
    await oeffnen();
    expect(screen.getByRole('region', { name: 'Vorschau mit Fußzeile' }).textContent).toBe('Hallo,\n\nhier steht der Text der Antwort.');
  });
});

describe('Textbausteine: nur fuer Super-Admin', () => {
  it('eine Gemeindeleitung ohne Merkmal sieht den Hinweis, ohne Abruf', () => {
    h.user = { id: 5, role_name: 'org_admin', is_super_admin: false };
    render(<SupportTextbausteinePage />);
    expect(screen.getByText('Nur für den Support')).toBeInTheDocument();
    expect(h.apiGet).not.toHaveBeenCalled();
  });
});
