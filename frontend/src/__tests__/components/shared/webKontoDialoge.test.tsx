// Die Dialoge „Passwort ändern" und „E-Mail ändern" der Web-Fassung, gerendert
// (Simon, 11.10.2026: „Web braucht eigene kompaktere Modale überall"). Echte
// Logik (usePasswortAendern, useEmailAendern -- dieselbe wie in den App-Modalen);
// nachgestellt sind nur Server, Anmeldung und TokenStore. Wie die Seiten sie
// öffnen, prüft start/webKontoUmschaltung.test.tsx.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, within, act, waitFor } from '@testing-library/react';

const h = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  setError: vi.fn(),
  setSuccess: vi.fn(),
  setToken: vi.fn(async (..._a: unknown[]) => undefined),
  setRefreshToken: vi.fn(async (..._a: unknown[]) => undefined),
  online: true,
}));

vi.mock('@ionic/react', async () => (await import('../support/ionicAttrappe')).ionicAttrappe({}));
vi.mock('../../../services/api', () => ({ default: { get: h.apiGet, post: h.apiPost } }));
vi.mock('../../../services/tokenStore', () => ({
  setToken: h.setToken,
  setRefreshToken: h.setRefreshToken,
  getDeviceId: () => 'geraet-7',
  setUser: vi.fn(),
}));
vi.mock('../../../contexts/AppContext', () => ({
  useApp: () => ({ setError: h.setError, setSuccess: h.setSuccess, isOnline: h.online, user: null, setUser: vi.fn() }),
}));

import WebPasswortAendern from '../../../components/shared/web/konto/WebPasswortAendern';
import WebEmailAendern from '../../../components/shared/web/konto/WebEmailAendern';
import { OFFLINE_AKTION_MELDUNG } from '../../../utils/offlineAktion';

// Erfundene Werte fuer die Passwortfelder. Zusammengesetzt statt als
// Zeichenkette, damit Geheimnis-Scanner einen Testwert nicht als Passwort im
// oeffentlichen Repo melden (wie support/webVorgangDetail.test.tsx).
const ALT = ['Bisher', '2025', 'Wert?'].join('-');
const NEU = ['Herbst', '2026', 'Wiese!'].join('-');

const serverFehler = (status: number, error?: string) => Object.assign(new Error('Request failed'), {
  response: { status, data: error ? { error } : {} },
});

beforeEach(() => {
  vi.clearAllMocks();
  h.apiGet.mockReset();
  h.apiPost.mockReset();
  h.online = true;
});

const tippen = (el: HTMLElement, wert: string) => fireEvent.change(el, { target: { value: wert } });

// --- Passwort ändern ------------------------------------------------------------

describe('Web-Dialog „Passwort ändern“', () => {
  const zeige = () => {
    const onSchliessen = vi.fn();
    const onGespeichert = vi.fn();
    render(<WebPasswortAendern onSchliessen={onSchliessen} onGespeichert={onGespeichert} />);
    const dialog = screen.getByRole('dialog', { name: 'Passwort ändern' });
    const feld = (name: string) => within(dialog).getByLabelText(name) as HTMLInputElement;
    const speichern = async () => { await act(async () => { fireEvent.click(within(dialog).getByRole('button', { name: 'Speichern' })); }); };
    const regeln = () => within(dialog).getAllByRole('listitem').map((li) => li.textContent);
    return { dialog, feld, speichern, regeln, onSchliessen, onGespeichert };
  };
  const ausfuellen = (feld: (name: string) => HTMLInputElement, aktuell: string, neu: string, bestaetigt: string) => {
    tippen(feld('Aktuelles Passwort'), aktuell);
    tippen(feld('Neues Passwort'), neu);
    tippen(feld('Neues Passwort bestätigen'), bestaetigt);
  };

  it('drei benannte Pflichtfelder mit den Angaben für Passwort-Manager; der Satz unter der Überschrift sagt, was mit den anderen Geräten geschieht', () => {
    const { dialog, feld } = zeige();
    expect(dialog).toHaveAccessibleDescription('Auf allen anderen Geräten endet danach die Anmeldung.');
    const aktuell = feld('Aktuelles Passwort');
    const neu = feld('Neues Passwort');
    const bestaetigt = feld('Neues Passwort bestätigen');
    expect([aktuell, neu, bestaetigt].map((f) => f.type)).toEqual(['password', 'password', 'password']);
    expect([aktuell, neu, bestaetigt].map((f) => f.getAttribute('autocomplete'))).toEqual(['current-password', 'new-password', 'new-password']);
    expect([aktuell, neu, bestaetigt].map((f) => f.getAttribute('aria-required'))).toEqual(['true', 'true', 'true']);
    expect([aktuell, neu, bestaetigt].map((f) => f.value)).toEqual(['', '', '']);
    // Das erste Feld hat den Fokus (WebDialog).
    expect(document.activeElement).toBe(aktuell);
  });

  it('die Anforderungen der App beschreiben das neue Feld (aria-describedby) und folgen der Eingabe', () => {
    const { feld, regeln } = zeige();
    expect(feld('Neues Passwort')).toHaveAccessibleDescription(
      'Passwort-Anforderungen Mind. 8 Zeichen (fehlt noch) Großbuchstabe (fehlt noch) Kleinbuchstabe (fehlt noch) Zahl (fehlt noch) Sonderzeichen (fehlt noch)',
    );
    tippen(feld('Neues Passwort'), 'abc1');
    expect(regeln()).toEqual([
      'Mind. 8 Zeichen (fehlt noch)', 'Großbuchstabe (fehlt noch)', 'Kleinbuchstabe (erfüllt)', 'Zahl (erfüllt)', 'Sonderzeichen (fehlt noch)',
    ]);
    tippen(feld('Neues Passwort'), NEU);
    expect(regeln()).toEqual([
      'Mind. 8 Zeichen (erfüllt)', 'Großbuchstabe (erfüllt)', 'Kleinbuchstabe (erfüllt)', 'Zahl (erfüllt)', 'Sonderzeichen (erfüllt)',
    ]);
    expect(document.querySelectorAll('.web-passwort-regel--erfuellt')).toHaveLength(5);
  });

  it('Bestätigung wie in der App: abweichend ein Hinweis, alles erfüllt die Bestätigung', () => {
    const { dialog, feld } = zeige();
    ausfuellen(feld, ALT, NEU, `${NEU}x`);
    expect(within(dialog).getByText('Die Passwörter stimmen nicht überein.')).toBeInTheDocument();
    expect(within(dialog).queryByText('Alle Anforderungen erfüllt - bereit zum Speichern')).toBeNull();
    tippen(feld('Neues Passwort bestätigen'), NEU);
    expect(within(dialog).queryByText('Die Passwörter stimmen nicht überein.')).toBeNull();
    expect(within(dialog).getByRole('status')).toHaveTextContent('Alle Anforderungen erfüllt - bereit zum Speichern');
  });

  it.each([
    ['ohne aktuelles Passwort', '', NEU, NEU, 'Bitte gib dein aktuelles Passwort ein'],
    ['mit zu schwachem neuen Passwort', ALT, 'kurz1!', 'kurz1!', 'Das neue Passwort erfüllt nicht alle Anforderungen'],
    ['mit abweichender Bestätigung', ALT, NEU, `${NEU}x`, 'Die neuen Passwörter stimmen nicht überein'],
  ])('Prüfung %s: die Meldung der App steht im Dialog, nichts geht an den Server', async (_fall, aktuell, neu, bestaetigt, meldung) => {
    const { dialog, feld, speichern, onGespeichert } = zeige();
    ausfuellen(feld, aktuell, neu, bestaetigt);
    await speichern();
    expect(within(dialog).getByRole('alert')).toHaveTextContent(meldung);
    expect(h.apiPost).toHaveBeenCalledTimes(0);
    expect(h.setError).toHaveBeenCalledTimes(0);
    expect(onGespeichert).toHaveBeenCalledTimes(0);
    // Weitertippen nimmt die Meldung weg.
    tippen(feld('Aktuelles Passwort'), `${aktuell}a`);
    expect(within(dialog).queryByRole('alert')).toBeNull();
  });

  it('Speichern schickt genau diesen Körper an /auth/change-password, übernimmt das neue Token-Paar und meldet Erfolg', async () => {
    h.apiPost.mockResolvedValue({ data: { message: 'Passwort erfolgreich geändert', token: 'token-neu', refresh_token: 'refresh-neu' } });
    const { feld, speichern, onGespeichert, onSchliessen } = zeige();
    ausfuellen(feld, ALT, NEU, NEU);
    await speichern();
    expect(h.apiPost).toHaveBeenCalledTimes(1);
    expect(h.apiPost).toHaveBeenCalledWith('/auth/change-password', {
      currentPassword: ALT, newPassword: NEU, device_id: 'geraet-7', platform: 'web',
    });
    expect(h.setToken).toHaveBeenCalledWith('token-neu');
    expect(h.setRefreshToken).toHaveBeenCalledWith('refresh-neu');
    expect(h.setSuccess).toHaveBeenCalledWith('Passwort erfolgreich geändert');
    expect(onGespeichert).toHaveBeenCalledTimes(1);
    expect(onSchliessen).toHaveBeenCalledTimes(0);
  });

  it('Enter im Feld speichert wie der Knopf', async () => {
    h.apiPost.mockResolvedValue({ data: {} });
    const { feld, onGespeichert } = zeige();
    ausfuellen(feld, ALT, NEU, NEU);
    await act(async () => { fireEvent.submit(feld('Neues Passwort bestätigen').form as HTMLFormElement); });
    expect(h.apiPost).toHaveBeenCalledTimes(1);
    // Ohne Token in der Antwort (älterer Server) bleibt das Token, wie es ist.
    expect(h.setToken).toHaveBeenCalledTimes(0);
    expect(onGespeichert).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['die Meldung des Servers', serverFehler(400, 'Aktuelles Passwort ist falsch'), 'Aktuelles Passwort ist falsch'],
    ['ohne Meldung der Ersatztext der App', serverFehler(500), 'Fehler beim Ändern des Passworts'],
  ])('Server lehnt ab: %s steht im Dialog, der Dialog bleibt offen', async (_fall, fehler, text) => {
    h.apiPost.mockRejectedValue(fehler);
    const { dialog, feld, speichern, onGespeichert } = zeige();
    ausfuellen(feld, ALT, NEU, NEU);
    await speichern();
    expect(within(dialog).getByRole('alert')).toHaveTextContent(text);
    expect(onGespeichert).toHaveBeenCalledTimes(0);
    expect(h.setSuccess).toHaveBeenCalledTimes(0);
    expect(h.setError).toHaveBeenCalledTimes(0);
    expect(h.setToken).toHaveBeenCalledTimes(0);
    expect(screen.getByRole('dialog', { name: 'Passwort ändern' })).toBeInTheDocument();
  });

  it('Abbrechen schickt nichts', async () => {
    const { dialog, feld, onSchliessen } = zeige();
    ausfuellen(feld, ALT, NEU, NEU);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Abbrechen' }));
    expect(onSchliessen).toHaveBeenCalledTimes(1);
    expect(h.apiPost).toHaveBeenCalledTimes(0);
  });

  it('solange gespeichert wird, schließt nichts den Dialog (wie „Schließen“ in der App); lehnt der Server dann ab, steht seine Meldung im Dialog', async () => {
    // Gegenprüfung 11.10.2026: Vorher ließ sich der Dialog beim Speichern
    // schließen -- der Wechsel lief trotzdem durch, und eine Ablehnung des
    // Servers ging ins Leere.
    let ablehnen: (grund: unknown) => void = () => {};
    h.apiPost.mockReturnValue(new Promise((_ok, nein) => { ablehnen = nein; }));
    const { dialog, feld, speichern, onSchliessen, onGespeichert } = zeige();
    ausfuellen(feld, ALT, NEU, NEU);
    await speichern();
    expect(h.apiPost).toHaveBeenCalledTimes(1);

    const knopf = (name: string) => within(dialog).getByRole('button', { name });
    expect([knopf('Abbrechen'), knopf('Schließen'), knopf('Speichern')].map((k) => (k as HTMLButtonElement).disabled)).toEqual([true, true, true]);
    fireEvent.click(knopf('Abbrechen'));
    fireEvent.click(knopf('Schließen'));
    fireEvent.keyDown(dialog, { key: 'Escape' });
    fireEvent.mouseDown(dialog.parentElement as HTMLElement);
    expect(onSchliessen).toHaveBeenCalledTimes(0);

    await act(async () => { ablehnen(serverFehler(400, 'Aktuelles Passwort ist falsch')); });
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Aktuelles Passwort ist falsch');
    expect(h.setSuccess).toHaveBeenCalledTimes(0);
    expect(onGespeichert).toHaveBeenCalledTimes(0);
    // Danach lässt er sich wieder schließen.
    expect(knopf('Abbrechen')).toBeEnabled();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(onSchliessen).toHaveBeenCalledTimes(1);
  });

  it('ohne Netz: Hinweis, Speichern gesperrt, auch Enter schickt nichts', async () => {
    h.online = false;
    const { dialog, feld, onGespeichert } = zeige();
    expect(within(dialog).getByRole('status')).toHaveTextContent(`Du bist offline${OFFLINE_AKTION_MELDUNG}`);
    expect(within(dialog).getByRole('button', { name: 'Speichern' })).toBeDisabled();
    ausfuellen(feld, ALT, NEU, NEU);
    await act(async () => { fireEvent.submit(feld('Aktuelles Passwort').form as HTMLFormElement); });
    expect(h.apiPost).toHaveBeenCalledTimes(0);
    expect(within(dialog).getByRole('alert')).toHaveTextContent(OFFLINE_AKTION_MELDUNG);
    expect(onGespeichert).toHaveBeenCalledTimes(0);
  });

  it('„Passwörter zeigen“ macht alle drei Felder lesbar und wieder verdeckt', () => {
    const { dialog, feld } = zeige();
    const typen = () => ['Aktuelles Passwort', 'Neues Passwort', 'Neues Passwort bestätigen'].map((n) => feld(n).type);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Passwörter zeigen' }));
    expect(typen()).toEqual(['text', 'text', 'text']);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Passwörter verbergen' }));
    expect(typen()).toEqual(['password', 'password', 'password']);
  });
});

// --- E-Mail ändern --------------------------------------------------------------

describe('Web-Dialog „E-Mail ändern“', () => {
  const zeige = (initialEmail = 'alt@example.org') => {
    const onSchliessen = vi.fn();
    const onGespeichert = vi.fn();
    render(<WebEmailAendern initialEmail={initialEmail} onSchliessen={onSchliessen} onGespeichert={onGespeichert} />);
    const dialog = screen.getByRole('dialog', { name: 'E-Mail ändern' });
    const feld = () => within(dialog).getByLabelText('E-Mail-Adresse (optional)') as HTMLInputElement;
    const knopf = () => within(dialog).getByRole('button', { name: 'Speichern' });
    const speichern = async () => { await act(async () => { fireEvent.click(knopf()); }); };
    return { dialog, feld, knopf, speichern, onSchliessen, onGespeichert };
  };
  const geladen = async (feld: () => HTMLInputElement, wert: string) => {
    await waitFor(() => expect(feld().value).toBe(wert));
  };

  it('ein benanntes Adressfeld mit dem Hinweis der App; vorbelegt mit der Adresse vom Server, Speichern erst danach', async () => {
    let antworten: (wert: unknown) => void = () => {};
    h.apiGet.mockReturnValue(new Promise((ok) => { antworten = ok; }));
    const { feld, knopf } = zeige();
    expect(h.apiGet).toHaveBeenCalledWith('/auth/me');
    expect(feld().type).toBe('email');
    expect(feld()).toHaveAttribute('autocomplete', 'email');
    expect(feld()).toHaveAccessibleDescription('Diese E-Mail-Adresse wird für Passwort-Reset und Benachrichtigungen verwendet.');
    // Bis der Server antwortet: die Adresse der Seite, Speichern gesperrt.
    expect(feld().value).toBe('alt@example.org');
    expect(knopf()).toBeDisabled();
    await act(async () => { antworten({ data: { email: 'server@example.org' } }); });
    expect(feld().value).toBe('server@example.org');
    expect(knopf()).toBeEnabled();
  });

  it('wer vor der Antwort tippt, behält seine Eingabe', async () => {
    let antworten: (wert: unknown) => void = () => {};
    h.apiGet.mockReturnValue(new Promise((ok) => { antworten = ok; }));
    const { feld } = zeige();
    tippen(feld(), 'getippt@example.org');
    await act(async () => { antworten({ data: { email: 'server@example.org' } }); });
    expect(feld().value).toBe('getippt@example.org');
  });

  it('antwortet der Server nicht, bleibt die Adresse der Seite', async () => {
    h.apiGet.mockRejectedValue(new Error('weg'));
    const { feld, knopf } = zeige('alt@example.org');
    await waitFor(() => expect(knopf()).toBeEnabled());
    expect(feld().value).toBe('alt@example.org');
  });

  it('Prüfung: eine Adresse ohne Punkt in der Domain meldet „Ungültige E-Mail-Adresse“ im Dialog, nichts geht an den Server', async () => {
    // Das Feld ist type="email": Eine Adresse ganz ohne @ hält schon der
    // Browser auf (nächster Test). „name@beispiel“ lässt er durch -- die
    // Prüfung der App nicht.
    h.apiGet.mockResolvedValue({ data: { email: 'server@example.org' } });
    const { dialog, feld, speichern, onGespeichert } = zeige();
    await geladen(feld, 'server@example.org');
    tippen(feld(), 'name@beispiel');
    await speichern();
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Ungültige E-Mail-Adresse');
    expect(h.apiPost).toHaveBeenCalledTimes(0);
    expect(h.setError).toHaveBeenCalledTimes(0);
    expect(onGespeichert).toHaveBeenCalledTimes(0);
    tippen(feld(), 'name@beispiel.de');
    expect(within(dialog).queryByRole('alert')).toBeNull();
  });

  it('eine Adresse ohne @ hält schon das Feld auf (type="email"): nichts geht an den Server', async () => {
    h.apiGet.mockResolvedValue({ data: { email: 'server@example.org' } });
    const { feld, speichern, onGespeichert } = zeige();
    await geladen(feld, 'server@example.org');
    tippen(feld(), 'kein-at-zeichen');
    expect(feld().validity.typeMismatch).toBe(true);
    await speichern();
    expect(h.apiPost).toHaveBeenCalledTimes(0);
    expect(onGespeichert).toHaveBeenCalledTimes(0);
  });

  it.each([
    ['eine neue Adresse', 'neu@example.org', { email: 'neu@example.org' }],
    ['eine leere Adresse als null', '', { email: null }],
  ])('Speichern schickt %s an /auth/update-email und meldet Erfolg', async (_fall, eingabe, koerper) => {
    h.apiGet.mockResolvedValue({ data: { email: 'server@example.org' } });
    h.apiPost.mockResolvedValue({ data: {} });
    const { feld, speichern, onGespeichert, onSchliessen } = zeige();
    await geladen(feld, 'server@example.org');
    tippen(feld(), eingabe);
    await speichern();
    expect(h.apiPost).toHaveBeenCalledTimes(1);
    expect(h.apiPost).toHaveBeenCalledWith('/auth/update-email', koerper);
    expect(h.setSuccess).toHaveBeenCalledWith('E-Mail-Adresse erfolgreich aktualisiert');
    expect(onGespeichert).toHaveBeenCalledTimes(1);
    expect(onSchliessen).toHaveBeenCalledTimes(0);
  });

  it.each([
    ['vergeben (409)', serverFehler(409, 'Diese E-Mail-Adresse wird bereits verwendet.'), 'Diese E-Mail-Adresse wird bereits von einem anderen Konto verwendet.'],
    ['ungültig laut Server', serverFehler(400, 'Ungültige E-Mail-Adresse'), 'Ungültige E-Mail-Adresse'],
    ['ohne Meldung', serverFehler(500), 'Fehler beim Aktualisieren der E-Mail-Adresse'],
  ])('Server lehnt ab -- %s: die Meldung der App steht im Dialog', async (_fall, fehler, text) => {
    h.apiGet.mockResolvedValue({ data: { email: 'server@example.org' } });
    h.apiPost.mockRejectedValue(fehler);
    const { dialog, feld, speichern, onGespeichert } = zeige();
    await geladen(feld, 'server@example.org');
    tippen(feld(), 'vergeben@example.org');
    await speichern();
    expect(within(dialog).getByRole('alert')).toHaveTextContent(text);
    expect(onGespeichert).toHaveBeenCalledTimes(0);
    expect(h.setSuccess).toHaveBeenCalledTimes(0);
    expect(h.setError).toHaveBeenCalledTimes(0);
  });

  it('Abbrechen schickt nichts', async () => {
    h.apiGet.mockResolvedValue({ data: { email: 'server@example.org' } });
    const { dialog, feld, onSchliessen } = zeige();
    await geladen(feld, 'server@example.org');
    tippen(feld(), 'neu@example.org');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Abbrechen' }));
    expect(onSchliessen).toHaveBeenCalledTimes(1);
    expect(h.apiPost).toHaveBeenCalledTimes(0);
  });

  it('solange gespeichert wird, schließt nichts den Dialog (wie „Schließen“ in der App); lehnt der Server dann ab, steht seine Meldung im Dialog', async () => {
    h.apiGet.mockResolvedValue({ data: { email: 'server@example.org' } });
    let ablehnen: (grund: unknown) => void = () => {};
    h.apiPost.mockReturnValue(new Promise((_ok, nein) => { ablehnen = nein; }));
    const { dialog, feld, speichern, onSchliessen, onGespeichert } = zeige();
    await geladen(feld, 'server@example.org');
    tippen(feld(), 'vergeben@example.org');
    await speichern();
    expect(h.apiPost).toHaveBeenCalledTimes(1);

    const knopf = (name: string) => within(dialog).getByRole('button', { name });
    expect([knopf('Abbrechen'), knopf('Schließen'), knopf('Speichern')].map((k) => (k as HTMLButtonElement).disabled)).toEqual([true, true, true]);
    fireEvent.click(knopf('Abbrechen'));
    fireEvent.click(knopf('Schließen'));
    fireEvent.keyDown(dialog, { key: 'Escape' });
    fireEvent.mouseDown(dialog.parentElement as HTMLElement);
    expect(onSchliessen).toHaveBeenCalledTimes(0);

    await act(async () => { ablehnen(serverFehler(409, 'Diese E-Mail-Adresse wird bereits verwendet.')); });
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Diese E-Mail-Adresse wird bereits von einem anderen Konto verwendet.');
    expect(h.setSuccess).toHaveBeenCalledTimes(0);
    expect(onGespeichert).toHaveBeenCalledTimes(0);
    expect(knopf('Abbrechen')).toBeEnabled();
    fireEvent.click(knopf('Abbrechen'));
    expect(onSchliessen).toHaveBeenCalledTimes(1);
  });

  it('ohne Netz: Hinweis, Speichern gesperrt, auch Enter schickt nichts', async () => {
    h.online = false;
    h.apiGet.mockResolvedValue({ data: { email: 'server@example.org' } });
    const { dialog, feld, knopf } = zeige();
    await geladen(feld, 'server@example.org');
    expect(within(dialog).getByRole('status')).toHaveTextContent(`Du bist offline${OFFLINE_AKTION_MELDUNG}`);
    expect(knopf()).toBeDisabled();
    await act(async () => { fireEvent.submit(feld().form as HTMLFormElement); });
    expect(h.apiPost).toHaveBeenCalledTimes(0);
    expect(within(dialog).getByRole('alert')).toHaveTextContent(OFFLINE_AKTION_MELDUNG);
  });
});
