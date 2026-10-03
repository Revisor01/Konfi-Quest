// Eine Anfrage der Support-Ansicht (/admin/support/anfragen/:id), gerendert:
// Angaben, Status und Notiz, "Gemeinde anlegen" vorbelegt aus der Anfrage,
// Pruefung vor dem Absenden, Rueckfrage, Koerper an den Server, Hinweis mit
// Weg zur neuen Gemeinde -- und nur fuer Super-Admin.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import type { AlertOptionen } from './ionicAttrappe';

const h = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  push: vi.fn(),
  setError: vi.fn(),
  setSuccess: vi.fn(),
  alert: null as null | AlertOptionen,
  user: { id: 9, role_name: 'super_admin', is_super_admin: true } as Record<string, unknown>,
}));

vi.mock('@ionic/react', async () => (await import('./ionicAttrappe')).ionicAttrappe({
  presentAlert: (o) => { h.alert = o; },
  router: { push: h.push, goBack: vi.fn(), canGoBack: () => false },
}));
vi.mock('../../../components/shared/AppKopfzeile', async () => (await import('./ionicAttrappe')).KopfzeileAttrappe);
vi.mock('../../../components/common/LoadingSpinner', () => ({ default: ({ message }: { message: string }) => <p>{message}</p> }));
vi.mock('../../../services/api', () => ({ default: { get: h.apiGet, post: h.apiPost, patch: h.apiPatch } }));
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({ user: h.user, setError: h.setError, setSuccess: h.setSuccess, isOnline: true }),
}));

import SupportAnfrageDetailPage from '../../../components/support/SupportAnfrageDetailPage';

// Erfundener Wert fuer das Passwortfeld. Zusammengesetzt statt als
// Zeichenkette, damit Geheimnis-Scanner (GitGuardian, PR #220) einen
// Testwert nicht als Passwort im oeffentlichen Repo melden.
const BEISPIELWERT = ['Beispiel', '2026', 'Wert!'].join('-');

const ANFRAGE = {
  id: 4, gemeinde: 'Kirchengemeinde Heide', kirchenkreis: 'Dithmarschen', landeskirche: 'Nordkirche',
  kontakt_name: 'Anna Beispiel', funktion: 'Pastorin', email: 'anna@example.org', mobil: '0170 1234567',
  anzahl_konfis: 25, anzahl_teamer: 6, nachricht: 'Wir starten im November.', status: 'neu', notiz: null,
  organization_id: null, created_at: '2026-10-02T08:00:00Z', updated_at: '2026-10-02T08:00:00Z',
};
const KREISE = [
  { id: 11, name: 'Kirchenkreis Dithmarschen', landeskirche_id: 1, landeskirche: 'Nordkirche' },
  { id: 12, name: 'Kirchenkreis Plön-Segeberg', landeskirche_id: 1, landeskirche: 'Nordkirche' },
];
const LANDESKIRCHEN = [{ id: 1, name: 'Nordkirche', kirchenkreise: [] }];

let anfragen: unknown[] = [ANFRAGE];
let kreise: unknown[] = KREISE;

beforeEach(() => {
  vi.clearAllMocks();
  h.apiGet.mockReset();
  h.apiPost.mockReset();
  h.apiPatch.mockReset();
  h.alert = null;
  h.user = { id: 9, role_name: 'super_admin', is_super_admin: true };
  anfragen = [ANFRAGE];
  kreise = KREISE;
  h.apiGet.mockImplementation((pfad: string) => {
    if (pfad === '/support/anfragen') return Promise.resolve({ data: anfragen });
    if (pfad === '/support/kirchenkreise') return Promise.resolve({ data: kreise });
    if (pfad === '/support/landeskirchen') return Promise.resolve({ data: LANDESKIRCHEN });
    return Promise.reject(new Error(`unerwartet: ${pfad}`));
  });
});

const oeffnen = async () => {
  render(<SupportAnfrageDetailPage anfrageId={4} />);
  await screen.findByText('Wir starten im November.');
};

const feld = (name: string) => screen.getByLabelText(name) as HTMLInputElement;
const tarif = () => screen.getByLabelText('Tarif') as HTMLSelectElement;

describe('Anfrage: Angaben und Vorbelegung', () => {
  it('zeigt alle Angaben; Mail und Telefon sind Verweise', async () => {
    await oeffnen();
    expect(h.apiGet).toHaveBeenCalledWith('/support/anfragen');
    expect(screen.getByRole('link', { name: 'anna@example.org' })).toHaveAttribute('href', 'mailto:anna@example.org');
    expect(screen.getByRole('link', { name: '0170 1234567' })).toHaveAttribute('href', 'tel:01701234567');
    expect(screen.getByText('Anna Beispiel (Pastorin)')).toBeInTheDocument();
    expect(screen.getByText('25 Konfis · 6 Teamer:innen')).toBeInTheDocument();
  });

  it('belegt "Gemeinde anlegen" aus der Anfrage vor -- Kirchenkreis aus der Struktur, Benutzername als Vorschlag', async () => {
    await oeffnen();
    expect(feld('Name der Gemeinde').value).toBe('Kirchengemeinde Heide');
    expect((screen.getByLabelText('Kirchenkreis') as HTMLSelectElement).value).toBe('11');
    expect(screen.getByText('Landeskirche: Nordkirche')).toBeInTheDocument();
    expect(feld('Ansprechperson').value).toBe('Anna Beispiel');
    expect(feld('E-Mail der Gemeinde').value).toBe('anna@example.org');
    expect(feld('Telefon').value).toBe('0170 1234567');
    expect(tarif().value).toBe('5');
    expect((screen.getByLabelText('Testphase (30 Tage)') as HTMLInputElement).checked).toBe(true);
    expect(feld('Benutzername').value).toBe('anna.beispiel');
    expect(feld('Anzeigename').value).toBe('Anna Beispiel');
    expect(feld('E-Mail der Gemeindeleitung').value).toBe('anna@example.org');
    expect(feld('Passwort').value).toBe('');
  });

  it('nicht gefunden: eigener Hinweis', async () => {
    anfragen = [];
    render(<SupportAnfrageDetailPage anfrageId={4} />);
    expect(await screen.findByText('Anfrage nicht gefunden')).toBeInTheDocument();
  });

  it('Fehler beim Laden: Hinweis mit erneutem Versuch', async () => {
    h.apiGet.mockImplementationOnce(() => Promise.reject(new Error('Netz weg')));
    render(<SupportAnfrageDetailPage anfrageId={4} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Die Anfrage konnte nicht geladen werden.');
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Erneut versuchen/ })); });
    expect(await screen.findByText('Wir starten im November.')).toBeInTheDocument();
  });
});

describe('Anfrage: Status und Notiz', () => {
  it('Speichern erst nach einer Aenderung; schickt Status und Notiz', async () => {
    await oeffnen();
    const speichern = screen.getByRole('button', { name: 'Speichern' });
    expect(speichern).toBeDisabled();
    expect(Array.from((screen.getByLabelText('Status') as HTMLSelectElement).options).map((o) => o.textContent))
      .toEqual(['Neu', 'In Arbeit', 'Abgelehnt']);

    fireEvent.change(screen.getByLabelText('Status'), { target: { value: 'in_arbeit' } });
    fireEvent.change(screen.getByLabelText('Notiz'), { target: { value: 'Rückruf am Montag' } });
    h.apiPatch.mockResolvedValue({ data: { ...ANFRAGE, status: 'in_arbeit', notiz: 'Rückruf am Montag' } });
    await act(async () => { fireEvent.click(speichern); });

    expect(h.apiPatch).toHaveBeenCalledWith('/support/anfragen/4', { status: 'in_arbeit', notiz: 'Rückruf am Montag' });
    expect(h.setSuccess).toHaveBeenCalledWith('Anfrage gespeichert');
    expect(screen.getByRole('button', { name: 'Speichern' })).toBeDisabled();
  });

  it('nur die Notiz: ohne Status im Koerper', async () => {
    await oeffnen();
    fireEvent.change(screen.getByLabelText('Notiz'), { target: { value: 'Mail geschickt' } });
    h.apiPatch.mockResolvedValue({ data: { ...ANFRAGE, notiz: 'Mail geschickt' } });
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Speichern' })); });
    expect(h.apiPatch).toHaveBeenCalledWith('/support/anfragen/4', { notiz: 'Mail geschickt' });
  });
});

describe('Anfrage: Gemeinde anlegen', () => {
  it('ohne Passwort: Meldung, keine Rueckfrage, kein Aufruf', async () => {
    await oeffnen();
    fireEvent.click(screen.getByRole('button', { name: 'Gemeinde anlegen' }));
    expect(h.setError).toHaveBeenCalledWith('Alle Felder der Gemeindeleitung sind erforderlich');
    expect(h.alert).toBeNull();
    expect(h.apiPost).not.toHaveBeenCalled();
  });

  it('Passwort nach der Regel des Servers: ohne Sonderzeichen keine Anlage', async () => {
    await oeffnen();
    fireEvent.change(feld('Passwort'), { target: { value: 'Heide2026' } });
    fireEvent.click(screen.getByRole('button', { name: 'Gemeinde anlegen' }));
    expect(h.setError).toHaveBeenCalledWith('Das Passwort muss ein Sonderzeichen enthalten');
    expect(h.apiPost).not.toHaveBeenCalled();
  });

  it('fragt nach, legt an und zeigt den Weg zur neuen Gemeinde', async () => {
    await oeffnen();
    fireEvent.change(feld('Passwort'), { target: { value: BEISPIELWERT } });
    fireEvent.change(screen.getByLabelText('Kirchenkreis'), { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: 'Gemeinde anlegen' }));

    expect(h.alert?.header).toBe('Gemeinde anlegen');
    expect(h.alert?.message).toBe('„Kirchengemeinde Heide“ mit der Gemeindeleitung „Anna Beispiel“ (anna.beispiel) anlegen?');
    expect(h.apiPost).not.toHaveBeenCalled();

    h.apiPost.mockResolvedValue({ data: { organization_id: 77, admin_id: 301 } });
    const vorher = Date.now();
    await act(async () => { h.alert?.buttons?.find((b) => b.text === 'Anlegen')?.handler?.(); });
    await waitFor(() => expect(h.apiPost).toHaveBeenCalledTimes(1));

    const [pfad, koerper] = h.apiPost.mock.calls[0];
    expect(pfad).toBe('/support/anfragen/4/anlegen');
    const { trial_ends_at: ende, ...rest } = koerper;
    expect(rest).toEqual({
      name: 'kirchengemeinde-heide',
      display_name: 'Kirchengemeinde Heide',
      kirchenkreis_id: 12,
      contact_name: 'Anna Beispiel',
      contact_email: 'anna@example.org',
      contact_phone: '0170 1234567',
      max_konfis: 5,
      is_trial: true,
      admin_username: 'anna.beispiel',
      admin_display_name: 'Anna Beispiel',
      admin_email: 'anna@example.org',
      admin_password: BEISPIELWERT,
    });
    const tage = (new Date(ende).getTime() - vorher) / (24 * 60 * 60 * 1000);
    expect(Math.round(tage)).toBe(30);

    expect(await screen.findByText('Die Gemeinde ist angelegt.')).toBeInTheDocument();
    expect(screen.getByText('anna.beispiel')).toBeInTheDocument();
    expect(h.setSuccess).toHaveBeenCalledWith('Gemeinde angelegt');
    expect(screen.queryByRole('button', { name: 'Gemeinde anlegen' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Gemeinde öffnen' }));
    expect(h.push).toHaveBeenCalledWith('/admin/organizations?gemeinde=77');
  });

  it('ohne Testphase und ohne Limit: unbegrenzt, keine Testphase', async () => {
    await oeffnen();
    fireEvent.change(feld('Passwort'), { target: { value: BEISPIELWERT } });
    fireEvent.click(screen.getByLabelText('Testphase (30 Tage)'));
    fireEvent.change(tarif(), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Gemeinde anlegen' }));
    h.apiPost.mockResolvedValue({ data: { organization_id: 77, admin_id: 301 } });
    await act(async () => { h.alert?.buttons?.find((b) => b.text === 'Anlegen')?.handler?.(); });
    await waitFor(() => expect(h.apiPost).toHaveBeenCalledTimes(1));
    expect(h.apiPost.mock.calls[0][1]).toMatchObject({ trial_ends_at: null, is_trial: false, max_konfis: null });
  });

  // Wunschlizenz (Simon, 03.10.2026): Die Gemeinde waehlt sie im Formular;
  // die Testphase laeuft mit 5 Konfis, danach steht das Limit auf der Lizenz.
  it('zeigt die Wunschlizenz; Testphase aus stellt das Limit auf ihre Konfi-Zahl, wieder an auf 5', async () => {
    anfragen = [{ ...ANFRAGE, wunsch_lizenz: 'standard' }];
    await oeffnen();
    expect(screen.getByText('Standard — bis 50 Konfis, 99 € pro Jahr')).toBeInTheDocument();
    expect(tarif().value).toBe('5');
    fireEvent.click(screen.getByLabelText('Testphase (30 Tage)'));
    expect(tarif().value).toBe('50');
    fireEvent.click(screen.getByLabelText('Testphase (30 Tage)'));
    expect(tarif().value).toBe('5');
  });

  it('ohne Wunschlizenz: „Noch offen“; Testphase aus stellt das Limit auf unbegrenzt', async () => {
    await oeffnen();
    expect(screen.getByText('Noch offen')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Testphase (30 Tage)'));
    expect(tarif().value).toBe('');
  });

  it('Verbund: keine feste Konfi-Zahl, Testphase aus stellt das Limit auf unbegrenzt', async () => {
    anfragen = [{ ...ANFRAGE, wunsch_lizenz: 'verbund' }];
    await oeffnen();
    expect(screen.getByText('Verbund — bis 4 Gemeinden, 390 € pro Jahr')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Testphase (30 Tage)'));
    expect(tarif().value).toBe('');
  });

  // Simon, 03.10.2026: "Unbegrenzt will ich aber setzen können" und "bei
  // der Auswahl muss auch der Preis mit stehen".
  it('der Tarif ist eine Auswahl mit Preis; Unbegrenzt und eigenes Limit sind dabei', async () => {
    await oeffnen();
    expect([...tarif().options].map((o) => o.textContent)).toEqual([
      'Testphase — bis 5 Konfis · kostenlos, 30 Tage',
      'Klein — bis 15 Konfis · 49 € pro Jahr',
      'Standard — bis 50 Konfis · 99 € pro Jahr',
      'Plus — bis 75 Konfis · 139 € pro Jahr',
      'Groß — bis 100 Konfis · 179 € pro Jahr',
      'Unbegrenzt — ohne Konfi-Grenze',
      'Eigenes Limit…',
    ]);
  });

  it('Unbegrenzt auch in der Testphase: geht als null an den Server', async () => {
    await oeffnen();
    fireEvent.change(feld('Passwort'), { target: { value: BEISPIELWERT } });
    fireEvent.change(tarif(), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Gemeinde anlegen' }));
    h.apiPost.mockResolvedValue({ data: { organization_id: 77, admin_id: 301 } });
    await act(async () => { h.alert?.buttons?.find((b) => b.text === 'Anlegen')?.handler?.(); });
    await waitFor(() => expect(h.apiPost).toHaveBeenCalledTimes(1));
    expect(h.apiPost.mock.calls[0][1]).toMatchObject({ is_trial: true, max_konfis: null });
  });

  it('Eigenes Limit: ein Zahlenfeld, die Zahl geht an den Server', async () => {
    await oeffnen();
    expect(screen.queryByLabelText('Eigenes Limit')).toBeNull();
    fireEvent.change(tarif(), { target: { value: '__eigen__' } });
    fireEvent.change(feld('Eigenes Limit'), { target: { value: '30' } });
    fireEvent.change(feld('Passwort'), { target: { value: BEISPIELWERT } });
    fireEvent.click(screen.getByRole('button', { name: 'Gemeinde anlegen' }));
    h.apiPost.mockResolvedValue({ data: { organization_id: 77, admin_id: 301 } });
    await act(async () => { h.alert?.buttons?.find((b) => b.text === 'Anlegen')?.handler?.(); });
    await waitFor(() => expect(h.apiPost).toHaveBeenCalledTimes(1));
    expect(h.apiPost.mock.calls[0][1]).toMatchObject({ max_konfis: 30 });
  });

  it('Benutzername vergeben (409): die Meldung des Servers, das Formular bleibt', async () => {
    await oeffnen();
    fireEvent.change(feld('Passwort'), { target: { value: BEISPIELWERT } });
    fireEvent.click(screen.getByRole('button', { name: 'Gemeinde anlegen' }));
    h.apiPost.mockRejectedValue({ response: { status: 409, data: { error: 'Benutzername existiert bereits (muss systemweit eindeutig sein)' } } });
    await act(async () => { h.alert?.buttons?.find((b) => b.text === 'Anlegen')?.handler?.(); });
    await waitFor(() => expect(h.setError).toHaveBeenCalledWith('Benutzername existiert bereits (muss systemweit eindeutig sein)'));
    expect(screen.getByRole('button', { name: 'Gemeinde anlegen' })).toBeInTheDocument();
    expect(screen.queryByText('Die Gemeinde ist angelegt.')).toBeNull();
  });

  it('Kirchenkreis noch nicht in der Struktur: ein Schritt legt ihn an und waehlt ihn', async () => {
    anfragen = [{ ...ANFRAGE, kirchenkreis: 'Steinburg' }];
    await oeffnen();
    expect((screen.getByLabelText('Kirchenkreis') as HTMLSelectElement).value).toBe('ohne');
    expect(screen.getByText('„Steinburg“ steht noch nicht in der Struktur.')).toBeInTheDocument();

    h.apiPost.mockResolvedValue({ data: { id: 13 } });
    kreise = [...KREISE, { id: 13, name: 'Steinburg', landeskirche_id: 1, landeskirche: 'Nordkirche' }];
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Als Kirchenkreis anlegen' })); });

    expect(h.apiPost).toHaveBeenCalledWith('/support/kirchenkreise', { name: 'Steinburg', landeskirche_id: 1 });
    await waitFor(() => expect((screen.getByLabelText('Kirchenkreis') as HTMLSelectElement).value).toBe('13'));
    expect(screen.queryByText('„Steinburg“ steht noch nicht in der Struktur.')).toBeNull();
  });

  it('eine schon angelegte Anfrage zeigt den Weg zur Gemeinde statt des Formulars', async () => {
    anfragen = [{ ...ANFRAGE, status: 'angelegt', organization_id: 55 }];
    await oeffnen();
    expect(screen.getByText('Die Gemeinde ist angelegt.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Gemeinde anlegen' })).toBeNull();
    expect(screen.queryByLabelText('Status')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Gemeinde öffnen' }));
    expect(h.push).toHaveBeenCalledWith('/admin/organizations?gemeinde=55');
  });
});

describe('Anfrage: nur fuer Super-Admin', () => {
  it('eine Gemeindeleitung ohne Merkmal sieht den Hinweis, ohne Abruf', () => {
    h.user = { id: 5, role_name: 'org_admin', is_super_admin: false };
    render(<SupportAnfrageDetailPage anfrageId={4} />);
    expect(screen.getByText('Nur für den Support')).toBeInTheDocument();
    expect(h.apiGet).not.toHaveBeenCalled();
  });
});
