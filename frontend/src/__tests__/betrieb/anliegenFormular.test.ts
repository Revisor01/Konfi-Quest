import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { ARTEN, BEREICHE, DRINGLICHKEITEN } from '../../utils/supportVorgaenge';
import { SUPPORT_FORMULAR_URL } from '../../utils/supportFormular';

// Support-Formular der Homepage (docs/planung/support-vorgaenge.md,
// Entscheidung 4; Simon, 03.10.2026: „Support kommt auf die HP"). Es steht auf
// konfi-quest.de neben dem Anfrageformular, offen für alle, und ist gebaut wie
// dieses -- Einwilligung, Honigtopf gegen Spam, Fehler am Feld, Dank statt
// Formular. Aus dem Anliegen wird ein Vorgang in der Support-Ansicht.
//
// Die Startseite ist statisch (frontend/public/landing.html, ausgeliefert vom
// nginx ohne die CSP der Web-App). Der Test nimmt GENAU die ausgelieferte
// Datei: Er setzt den Abschnitt #support in ein jsdom-Dokument, führt das
// Skript #anliegen-skript aus und bedient das Formular wie eine Person --
// fetch ist eine Attrappe, die die Antworten des Servers (201, 400, 429,
// Netzfehler) nachstellt. Der Vertrag: POST /api/anliegen mit
// { gemeinde, name, email, funktion?, art, bereich?, dringlichkeit, betreff,
//   beschreibung, einwilligung: true, website: "" } -> 201 { ok: true }.

const wurzel = resolve(__dirname, '../../../..');
const lies = (pfad: string) => readFileSync(join(wurzel, pfad), 'utf8');
const landing = new DOMParser().parseFromString(lies('frontend/public/landing.html'), 'text/html');
const skript = landing.getElementById('anliegen-skript')?.textContent ?? '';

const fetchAttrappe = vi.fn();

function aufbauen() {
  const abschnitt = landing.getElementById('support');
  if (!abschnitt) throw new Error('Abschnitt #support fehlt');
  document.body.innerHTML = abschnitt.outerHTML;
  new Function(skript)();
}

const antwort = (status: number, daten: unknown = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  json: () => Promise.resolve(daten),
});

/** Feld nach dem Anfang seiner Beschriftung ("Gemeinde *" -> "Gemeinde"). */
const feld = (name: string) => screen.getByLabelText(
  new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`),
  { selector: 'input, textarea, select' }
) as HTMLInputElement;
const formular = () => document.getElementById('anliegen-formular') as HTMLFormElement;
const meldung = () => document.getElementById('anliegen-meldung') as HTMLElement;
const absenden = () => fireEvent.submit(formular());
const fehlerzeile = (name: string) => document.getElementById(`anliegen-fehler-${name}`) as HTMLElement;

function ausfuellen() {
  fireEvent.input(feld('Gemeinde'), { target: { value: '  Kirchengemeinde Heide ' } });
  fireEvent.input(feld('Name'), { target: { value: 'Anna Beispiel' } });
  fireEvent.input(feld('E-Mail'), { target: { value: 'anna@example.org' } });
  fireEvent.change(feld('Art'), { target: { value: 'fehler' } });
  fireEvent.change(feld('Bereich'), { target: { value: 'chat' } });
  fireEvent.input(feld('Betreff'), { target: { value: 'Nachrichten kommen nicht an' } });
  fireEvent.input(feld('Beschreibung'), { target: { value: 'Seit gestern erscheint im Chat nichts Neues.' } });
  fireEvent.click(feld('Ich bin einverstanden'));
}

beforeEach(() => {
  fetchAttrappe.mockReset();
  vi.stubGlobal('fetch', fetchAttrappe);
  aufbauen();
});

afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('Support-Formular: Aufbau und Barrierefreiheit', () => {
  it('das Skript steht in der ausgelieferten Seite und sendet an /api/anliegen', () => {
    expect(skript).toContain("fetch('/api/anliegen'");
  });

  it('der Abschnitt hat die Sprungmarke #support -- dorthin führt „Hilfe und Support“ unter „Mehr“', () => {
    expect(landing.getElementById('support')?.tagName).toBe('SECTION');
    expect(landing.querySelectorAll('#support').length).toBe(1);
    // Die Fußzeile verlinkt ebenfalls dorthin.
    expect(landing.querySelector('footer a[href="#support"]')?.textContent).toBe('Hilfe und Support');
    // Der Link der App trifft genau diese Marke auf der Startseite.
    const ziel = new URL(SUPPORT_FORMULAR_URL);
    expect(ziel.hash).toBe('#support');
    expect(ziel.origin).toBe('https://konfi-quest.de');
    expect(ziel.pathname).toBe('/');
    expect(landing.getElementById(ziel.hash.slice(1))).not.toBeNull();
  });

  it('das Anfrageformular bleibt daneben unberührt: eigener Abschnitt, eigene Kennungen', () => {
    expect(landing.getElementById('kontakt')?.querySelector('#anfrage-formular')).not.toBeNull();
    expect(landing.getElementById('kontakt')?.querySelector('#anliegen-formular')).toBeNull();
    expect(landing.getElementById('support')?.querySelector('#anfrage-formular')).toBeNull();
  });

  it('jedes Feld des Vertrags hat eine sichtbare Beschriftung', () => {
    const felder: Array<[string, string]> = [
      ['Gemeinde', 'gemeinde'], ['Name', 'name'], ['Funktion', 'funktion'], ['E-Mail', 'email'],
      ['Art', 'art'], ['Bereich', 'bereich'], ['Dringlichkeit', 'dringlichkeit'], ['Betreff', 'betreff'],
      ['Beschreibung', 'beschreibung'], ['Ich bin einverstanden', 'einwilligung'],
    ];
    for (const [label, name] of felder) expect(feld(label).name, label).toBe(name);
  });

  it('Art, Bereich und Dringlichkeit sind Auswahlfelder mit den Werten und Namen der Support-Ansicht', () => {
    for (const name of ['Art', 'Bereich', 'Dringlichkeit']) expect(feld(name).tagName, name).toBe('SELECT');
    const optionen = (name: string) => [...(feld(name) as unknown as HTMLSelectElement).options].map((o) => [o.value, o.textContent]);
    // „Neue Gemeinde“ gibt es nur über die Anfrage -- wer hier schreibt, hat eine Gemeinde.
    expect(optionen('Art')).toEqual([
      ['', 'Bitte wählen'],
      ...ARTEN.filter((a) => a.wert !== 'neue_gemeinde').map((a) => [a.wert, a.label]),
    ]);
    expect(optionen('Bereich')).toEqual([['', 'Bitte wählen'], ...BEREICHE.map((b) => [b.wert, b.label])]);
    expect(optionen('Dringlichkeit')).toEqual(DRINGLICHKEITEN.map((d) => [d.wert, d.hinweis ? `${d.label} – ${d.hinweis}` : d.label]));
  });

  it('die Dringlichkeit steht auf „Normal“', () => {
    expect(feld('Dringlichkeit').value).toBe('normal');
  });

  it('Pflichtfelder tragen aria-required; Fehlerzeilen hängen per aria-describedby am Feld', () => {
    for (const label of ['Gemeinde', 'Name', 'E-Mail', 'Art', 'Dringlichkeit', 'Betreff', 'Beschreibung', 'Ich bin einverstanden']) {
      const f = feld(label);
      expect(f.getAttribute('aria-required'), label).toBe('true');
      expect(f.getAttribute('aria-describedby'), label).toContain(fehlerzeile(f.name).id);
    }
    expect(meldung().getAttribute('role')).toBe('alert');
  });

  it('der Bereich ist erst bei Frage, Fehler und Wunsch Pflicht: Stern und aria-required folgen der Art', () => {
    const stern = document.getElementById('anliegen-stern-bereich') as HTMLElement;
    expect(feld('Bereich').hasAttribute('aria-required')).toBe(false);
    expect(stern.hidden).toBe(true);
    for (const art of ['frage', 'fehler', 'wunsch']) {
      fireEvent.change(feld('Art'), { target: { value: art } });
      expect(feld('Bereich').getAttribute('aria-required'), art).toBe('true');
      expect(stern.hidden, art).toBe(false);
    }
    for (const art of ['zugang', 'lizenz', 'datenschutz', 'sonstiges']) {
      fireEvent.change(feld('Art'), { target: { value: art } });
      expect(feld('Bereich').hasAttribute('aria-required'), art).toBe(false);
      expect(stern.hidden, art).toBe(true);
    }
  });

  it('der Honigtopf ist für Menschen unsichtbar und nicht erreichbar', () => {
    const honig = formular().elements.namedItem('website') as HTMLInputElement;
    expect(honig.tabIndex).toBe(-1);
    expect(honig.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(honig.closest('.anfrage-honig')).not.toBeNull();
  });

  it('die Einwilligung verweist auf die Datenschutzerklärung', () => {
    const label = feld('Ich bin einverstanden').labels?.[0] as HTMLElement;
    expect(within(label).getByRole('link', { name: 'Datenschutzerklärung' })).toHaveAttribute('href', '/datenschutz');
  });

  it('Längen wie der Server: Gemeinde, Name und Funktion 200, Betreff 120, E-Mail 254, Beschreibung 5000', () => {
    // Die Grenzen stehen in FELDER (backend/routes/anliegen.js). Ein längeres
    // Feld hier endete erst beim Absenden mit „Höchstens … Zeichen“.
    for (const label of ['Gemeinde', 'Name', 'Funktion']) expect(feld(label).maxLength, label).toBe(200);
    expect(feld('Betreff').maxLength).toBe(120);
    expect(feld('E-Mail').maxLength).toBe(254);
    expect((feld('Beschreibung') as unknown as HTMLTextAreaElement).maxLength).toBe(5000);
  });

  it('wer noch keine Gemeinde bei Konfi Quest hat, findet den Weg zum Anfrageformular', () => {
    expect(within(formular()).getByRole('link', { name: 'Anfrageformular' })).toHaveAttribute('href', '#kontakt');
  });
});

describe('Support-Formular: Prüfung vor dem Senden', () => {
  it('leer: nichts geht raus, sieben Felder markiert, Fokus auf dem ersten', () => {
    absenden();
    expect(fetchAttrappe).not.toHaveBeenCalled();
    expect(meldung().hidden).toBe(false);
    expect(meldung().textContent).toBe('Bitte prüft die 7 markierten Felder.');
    for (const label of ['Gemeinde', 'Name', 'E-Mail', 'Art', 'Betreff', 'Beschreibung', 'Ich bin einverstanden']) {
      expect(feld(label).getAttribute('aria-invalid'), label).toBe('true');
    }
    expect(feld('Dringlichkeit').hasAttribute('aria-invalid')).toBe(false);
    expect(fehlerzeile('email').textContent).toBe('Bitte gebt eine gültige E-Mail-Adresse an.');
    expect(fehlerzeile('art').textContent).toBe('Bitte wählt eine Art.');
    expect(document.activeElement).toBe(feld('Gemeinde'));
  });

  it('nur die E-Mail falsch: ein Feld, Fokus dort', () => {
    ausfuellen();
    fireEvent.input(feld('E-Mail'), { target: { value: 'anna@' } });
    absenden();
    expect(fetchAttrappe).not.toHaveBeenCalled();
    expect(meldung().textContent).toBe('Bitte prüft das markierte Feld.');
    expect(document.activeElement).toBe(feld('E-Mail'));
  });

  it('bei Frage, Fehler und Wunsch fehlt der Bereich -- bei den anderen Arten nicht', () => {
    ausfuellen();
    fireEvent.change(feld('Bereich'), { target: { value: '' } });
    absenden();
    expect(fetchAttrappe).not.toHaveBeenCalled();
    expect(fehlerzeile('bereich').textContent).toBe('Bei Frage, Fehler und Wunsch bitte einen Bereich wählen.');
    expect(feld('Bereich').getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(feld('Bereich'));

    fetchAttrappe.mockReturnValue(new Promise(() => {}));
    fireEvent.change(feld('Art'), { target: { value: 'lizenz' } });
    // Die Art zu ändern räumt den Bereichsfehler weg.
    expect(feld('Bereich').hasAttribute('aria-invalid')).toBe(false);
    absenden();
    expect(fetchAttrappe).toHaveBeenCalledTimes(1);
  });

  it('Betreff und Beschreibung dürfen nicht nur aus Leerzeichen bestehen', () => {
    ausfuellen();
    fireEvent.input(feld('Betreff'), { target: { value: '   ' } });
    fireEvent.input(feld('Beschreibung'), { target: { value: ' \n ' } });
    absenden();
    expect(fetchAttrappe).not.toHaveBeenCalled();
    expect(fehlerzeile('betreff').textContent).toBe('Bitte gebt einen Betreff an.');
    expect(fehlerzeile('beschreibung').textContent).toBe('Bitte beschreibt euer Anliegen.');
  });

  it('ein korrigiertes Feld verliert seinen Fehler sofort', () => {
    absenden();
    fireEvent.input(feld('Gemeinde'), { target: { value: 'Heide' } });
    expect(feld('Gemeinde').hasAttribute('aria-invalid')).toBe(false);
    expect(fehlerzeile('gemeinde').hidden).toBe(true);
  });
});

describe('Support-Formular: Senden und Antworten des Servers', () => {
  it('schickt genau den Vertrag; Leeres fehlt, der Text ist getrimmt; danach der Dank', async () => {
    let fertig: (wert: unknown) => void = () => {};
    fetchAttrappe.mockReturnValue(new Promise((r) => { fertig = r; }));
    ausfuellen();
    absenden();

    expect(fetchAttrappe).toHaveBeenCalledTimes(1);
    const [adresse, optionen] = fetchAttrappe.mock.calls[0];
    expect(adresse).toBe('/api/anliegen');
    expect(optionen.method).toBe('POST');
    expect(optionen.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(optionen.body)).toEqual({
      gemeinde: 'Kirchengemeinde Heide',
      name: 'Anna Beispiel',
      email: 'anna@example.org',
      art: 'fehler',
      bereich: 'chat',
      dringlichkeit: 'normal',
      betreff: 'Nachrichten kommen nicht an',
      beschreibung: 'Seit gestern erscheint im Chat nichts Neues.',
      einwilligung: true,
      website: '',
    });
    // Während des Sendens: Knopf gesperrt, Formular beschäftigt.
    const knopf = within(formular()).getByRole('button', { name: 'Wird gesendet …' });
    expect(knopf).toBeDisabled();
    expect(formular().getAttribute('aria-busy')).toBe('true');

    fertig(antwort(201, { ok: true }));
    await waitFor(() => expect(formular().hidden).toBe(true));
    const danke = document.getElementById('anliegen-danke') as HTMLElement;
    expect(danke.hidden).toBe(false);
    expect(document.activeElement).toBe(danke);
    expect(danke.textContent).toContain('Danke, euer Anliegen ist angekommen.');
    expect(danke.textContent).toContain('Nummer eures Vorgangs');
  });

  it('Funktion und die Dringlichkeit „dringend“ gehen mit; ohne Bereich (Art Lizenz) fehlt er im Körper', () => {
    fetchAttrappe.mockReturnValue(new Promise(() => {}));
    ausfuellen();
    fireEvent.input(feld('Funktion'), { target: { value: 'Pastorin' } });
    fireEvent.change(feld('Dringlichkeit'), { target: { value: 'dringend' } });
    fireEvent.change(feld('Art'), { target: { value: 'lizenz' } });
    fireEvent.change(feld('Bereich'), { target: { value: '' } });
    absenden();
    const koerper = JSON.parse(fetchAttrappe.mock.calls[0][1].body);
    expect(koerper.funktion).toBe('Pastorin');
    expect(koerper.dringlichkeit).toBe('dringend');
    expect(koerper.art).toBe('lizenz');
    expect('bereich' in koerper).toBe(false);
  });

  it('429: zu viele Anliegen -- verständlich, mit Mail als Ausweg; Formular bleibt', async () => {
    fetchAttrappe.mockResolvedValue(antwort(429, { error: 'Zu viele Anfragen' }));
    ausfuellen();
    absenden();
    await waitFor(() => expect(meldung().hidden).toBe(false));
    expect(meldung().textContent).toBe('Von diesem Anschluss kamen gerade zu viele Anliegen. Bitte versucht es in einer Stunde noch einmal. Oder schreibt uns an support@konfi-quest.de.');
    expect(formular().hidden).toBe(false);
    await waitFor(() => expect(within(formular()).getByRole('button', { name: 'Anliegen senden' })).toBeEnabled());
  });

  it('400 mit Feldern: die Meldung des Servers steht am Feld', async () => {
    fetchAttrappe.mockResolvedValue(antwort(400, {
      error: 'Validierungsfehler',
      details: [{ field: 'email', message: 'Gültige E-Mail-Adresse erforderlich' }, { field: 'unbekannt', message: 'x' }],
    }));
    ausfuellen();
    absenden();
    await waitFor(() => expect(meldung().textContent).toBe('Bitte prüft eure Angaben.'));
    expect(fehlerzeile('email').textContent).toBe('Gültige E-Mail-Adresse erforderlich');
    expect(feld('E-Mail').getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(feld('E-Mail'));
  });

  it('400 zum Bereich: die Meldung steht an der Auswahl', async () => {
    fetchAttrappe.mockResolvedValue(antwort(400, {
      error: 'Validierungsfehler',
      details: [{ field: 'bereich', message: 'Bitte einen Bereich wählen' }],
    }));
    ausfuellen();
    absenden();
    await waitFor(() => expect(fehlerzeile('bereich').hidden).toBe(false));
    expect(fehlerzeile('bereich').textContent).toBe('Bitte einen Bereich wählen');
    expect(document.activeElement).toBe(feld('Bereich'));
  });

  it('400 mit eigenem Satz: der Satz des Servers', async () => {
    fetchAttrappe.mockResolvedValue(antwort(400, { error: 'Die Beschreibung ist zu lang.' }));
    ausfuellen();
    absenden();
    await waitFor(() => expect(meldung().textContent).toBe('Die Beschreibung ist zu lang.'));
  });

  it('kein Netz oder Serverfehler: später noch einmal oder per Mail', async () => {
    fetchAttrappe.mockRejectedValue(new TypeError('Failed to fetch'));
    ausfuellen();
    absenden();
    await waitFor(() => expect(meldung().textContent).toBe('Das Anliegen ließ sich gerade nicht senden. Bitte versucht es später noch einmal. Oder schreibt uns an support@konfi-quest.de.'));

    fetchAttrappe.mockResolvedValue(antwort(500, { error: 'Datenbankfehler' }));
    absenden();
    await waitFor(() => expect(fetchAttrappe).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(within(formular()).getByRole('button', { name: 'Anliegen senden' })).toBeEnabled());
    expect(meldung().textContent).toContain('ließ sich gerade nicht senden');
  });

  it('ein gefüllter Honigtopf geht unverändert mit -- der Server entscheidet', () => {
    fetchAttrappe.mockReturnValue(new Promise(() => {}));
    ausfuellen();
    (formular().elements.namedItem('website') as HTMLInputElement).value = 'http://spam.example';
    absenden();
    expect(JSON.parse(fetchAttrappe.mock.calls[0][1].body).website).toBe('http://spam.example');
  });
});
