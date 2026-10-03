import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';

// Anfrageformular der Homepage und Vorlage zur Einwilligung der Eltern
// (Web-Version, Entscheidungen 4 und 8; 03.10.2026).
//
// Die Startseite ist statisch (frontend/public/landing.html, ausgeliefert vom
// nginx ohne die CSP der Web-App). Der Test nimmt GENAU die ausgelieferte
// Datei: Er setzt den Abschnitt #kontakt in ein jsdom-Dokument, fuehrt das
// Skript #anfrage-skript aus und bedient das Formular wie eine Person --
// fetch ist eine Attrappe, die die Antworten des Servers (201, 400, 429,
// Netzfehler) nachstellt. Der Vertrag: POST /api/anfragen mit
// { gemeinde, kirchenkreis?, landeskirche?, kontakt_name, funktion?, email,
//   mobil?, anzahl_konfis?, anzahl_teamer?, nachricht?, einwilligung: true,
//   website: "" }.

const wurzel = resolve(__dirname, '../../../..');
const lies = (pfad: string) => readFileSync(join(wurzel, pfad), 'utf8');
const landing = new DOMParser().parseFromString(lies('frontend/public/landing.html'), 'text/html');
const skript = landing.getElementById('anfrage-skript')?.textContent ?? '';

const fetchAttrappe = vi.fn();

function aufbauen() {
  const abschnitt = landing.getElementById('kontakt');
  if (!abschnitt) throw new Error('Abschnitt #kontakt fehlt');
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
  { selector: 'input, textarea' }
) as HTMLInputElement;
const formular = () => document.getElementById('anfrage-formular') as HTMLFormElement;
const meldung = () => document.getElementById('anfrage-meldung') as HTMLElement;
const absenden = () => fireEvent.submit(formular());

function ausfuellen() {
  fireEvent.input(feld('Gemeinde'), { target: { value: '  Kirchengemeinde Heide ' } });
  fireEvent.input(feld('Kirchenkreis'), { target: { value: 'Dithmarschen' } });
  fireEvent.input(feld('Name'), { target: { value: 'Anna Beispiel' } });
  fireEvent.input(feld('E-Mail'), { target: { value: 'anna@example.org' } });
  fireEvent.input(feld('Konfis (ungefähr)'), { target: { value: '25' } });
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

describe('Anfrageformular: Aufbau und Barrierefreiheit', () => {
  it('das Skript steht in der ausgelieferten Seite', () => {
    expect(skript).toContain("fetch('/api/anfragen'");
  });

  it('jedes Feld des Vertrags hat eine sichtbare Beschriftung', () => {
    const felder: Array<[string, string]> = [
      ['Gemeinde', 'gemeinde'], ['Kirchenkreis', 'kirchenkreis'], ['Landeskirche', 'landeskirche'],
      ['Name', 'kontakt_name'], ['Funktion', 'funktion'], ['E-Mail', 'email'], ['Mobilnummer', 'mobil'],
      ['Konfis (ungefähr)', 'anzahl_konfis'], ['Teamer:innen (ungefähr)', 'anzahl_teamer'],
      ['Nachricht', 'nachricht'], ['Ich bin einverstanden', 'einwilligung'],
    ];
    for (const [label, name] of felder) expect(feld(label).name, label).toBe(name);
  });

  it('Pflichtfelder tragen aria-required; Fehlerzeilen haengen per aria-describedby am Feld', () => {
    for (const label of ['Gemeinde', 'Name', 'E-Mail', 'Ich bin einverstanden']) {
      const f = feld(label);
      expect(f.getAttribute('aria-required'), label).toBe('true');
      const zeile = document.getElementById(`anfrage-fehler-${f.name}`);
      expect(zeile, label).not.toBeNull();
      expect(f.getAttribute('aria-describedby'), label).toContain(zeile!.id);
    }
    expect(meldung().getAttribute('role')).toBe('alert');
  });

  it('der Honigtopf ist fuer Menschen unsichtbar und nicht erreichbar', () => {
    const honig = formular().elements.namedItem('website') as HTMLInputElement;
    expect(honig.tabIndex).toBe(-1);
    expect(honig.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(honig.closest('.anfrage-honig')).not.toBeNull();
  });

  it('die Einwilligung verweist auf die Datenschutzerklaerung', () => {
    const label = feld('Ich bin einverstanden').labels?.[0] as HTMLElement;
    expect(within(label).getByRole('link', { name: 'Datenschutzerklärung' })).toHaveAttribute('href', '/datenschutz');
  });

  it('Laengen und Zahlen wie der Server: Mobilnummer 40, Nachricht 5000, Zahlen bis 100.000', () => {
    expect(feld('Mobilnummer').maxLength).toBe(40);
    expect((feld('Nachricht') as unknown as HTMLTextAreaElement).maxLength).toBe(5000);
    expect(feld('Konfis (ungefähr)').max).toBe('100000');
    expect(feld('Teamer:innen (ungefähr)').max).toBe('100000');
  });
});

describe('Anfrageformular: Pruefung vor dem Senden', () => {
  it('leer: nichts geht raus, vier Felder markiert, Fokus auf dem ersten', () => {
    absenden();
    expect(fetchAttrappe).not.toHaveBeenCalled();
    expect(meldung().hidden).toBe(false);
    expect(meldung().textContent).toBe('Bitte prüft die 4 markierten Felder.');
    for (const label of ['Gemeinde', 'Name', 'E-Mail', 'Ich bin einverstanden']) {
      expect(feld(label).getAttribute('aria-invalid'), label).toBe('true');
    }
    expect(document.getElementById('anfrage-fehler-email')?.textContent).toBe('Bitte gebt eine gültige E-Mail-Adresse an.');
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

  it('eine Anzahl muss eine ganze Zahl von 0 bis 100.000 sein', () => {
    ausfuellen();
    fireEvent.input(feld('Teamer:innen (ungefähr)'), { target: { value: '3.5' } });
    absenden();
    expect(fetchAttrappe).not.toHaveBeenCalled();
    expect(document.getElementById('anfrage-fehler-anzahl_teamer')?.textContent).toBe('Bitte eine ganze Zahl von 0 bis 100.000 – oder leer lassen.');
  });

  it('die Mobilnummer nur aus Ziffern, Leerzeichen und + ( ) / -', () => {
    ausfuellen();
    fireEvent.input(feld('Mobilnummer'), { target: { value: '0170 abc' } });
    absenden();
    expect(fetchAttrappe).not.toHaveBeenCalled();
    expect(document.getElementById('anfrage-fehler-mobil')?.textContent).toBe('Bitte nur Ziffern, Leerzeichen und + ( ) / -.');
    expect(document.activeElement).toBe(feld('Mobilnummer'));

    fetchAttrappe.mockReturnValue(new Promise(() => {}));
    fireEvent.input(feld('Mobilnummer'), { target: { value: '+49 (170) 123/45-6' } });
    absenden();
    expect(JSON.parse(fetchAttrappe.mock.calls[0][1].body).mobil).toBe('+49 (170) 123/45-6');
  });

  it('ein korrigiertes Feld verliert seinen Fehler sofort', () => {
    absenden();
    fireEvent.input(feld('Gemeinde'), { target: { value: 'Heide' } });
    expect(feld('Gemeinde').hasAttribute('aria-invalid')).toBe(false);
    expect(document.getElementById('anfrage-fehler-gemeinde')?.hidden).toBe(true);
  });
});

describe('Anfrageformular: Senden und Antworten des Servers', () => {
  it('schickt genau den Vertrag; leere Angaben fehlen, Zahlen sind Zahlen; danach der Dank', async () => {
    let fertig: (wert: unknown) => void = () => {};
    fetchAttrappe.mockReturnValue(new Promise((r) => { fertig = r; }));
    ausfuellen();
    absenden();

    expect(fetchAttrappe).toHaveBeenCalledTimes(1);
    const [adresse, optionen] = fetchAttrappe.mock.calls[0];
    expect(adresse).toBe('/api/anfragen');
    expect(optionen.method).toBe('POST');
    expect(optionen.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(optionen.body)).toEqual({
      gemeinde: 'Kirchengemeinde Heide',
      kirchenkreis: 'Dithmarschen',
      kontakt_name: 'Anna Beispiel',
      email: 'anna@example.org',
      anzahl_konfis: 25,
      einwilligung: true,
      website: '',
    });
    // Waehrend des Sendens: Knopf gesperrt, Formular beschaeftigt.
    const knopf = within(formular()).getByRole('button', { name: 'Wird gesendet …' });
    expect(knopf).toBeDisabled();
    expect(formular().getAttribute('aria-busy')).toBe('true');

    fertig(antwort(201, { ok: true }));
    await waitFor(() => expect(formular().hidden).toBe(true));
    const danke = document.getElementById('anfrage-danke') as HTMLElement;
    expect(danke.hidden).toBe(false);
    expect(document.activeElement).toBe(danke);
    expect(within(danke).getByRole('link', { name: 'Vorlage zum Ausdrucken' })).toHaveAttribute('href', '/einwilligung');
  });

  it('429: zu viele Anfragen -- verstaendlich, mit Mail als Ausweg; Formular bleibt', async () => {
    fetchAttrappe.mockResolvedValue(antwort(429, { error: 'Zu viele Anfragen' }));
    ausfuellen();
    absenden();
    await waitFor(() => expect(meldung().hidden).toBe(false));
    expect(meldung().textContent).toBe('Von diesem Anschluss kamen gerade zu viele Anfragen. Bitte versucht es in einer Stunde noch einmal. Oder schreibt uns an moin@konfi-quest.de.');
    expect(formular().hidden).toBe(false);
    await waitFor(() => expect(within(formular()).getByRole('button', { name: 'Anfrage senden' })).toBeEnabled());
  });

  it('400 mit Feldern: die Meldung des Servers steht am Feld', async () => {
    fetchAttrappe.mockResolvedValue(antwort(400, {
      error: 'Validierungsfehler',
      details: [{ field: 'email', message: 'Gültige E-Mail-Adresse erforderlich' }, { field: 'unbekannt', message: 'x' }],
    }));
    ausfuellen();
    absenden();
    await waitFor(() => expect(meldung().textContent).toBe('Bitte prüft eure Angaben.'));
    expect(document.getElementById('anfrage-fehler-email')?.textContent).toBe('Gültige E-Mail-Adresse erforderlich');
    expect(feld('E-Mail').getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(feld('E-Mail'));
  });

  it('400 mit eigenem Satz: der Satz des Servers', async () => {
    fetchAttrappe.mockResolvedValue(antwort(400, { error: 'Die Nachricht ist zu lang.' }));
    ausfuellen();
    absenden();
    await waitFor(() => expect(meldung().textContent).toBe('Die Nachricht ist zu lang.'));
  });

  it('kein Netz oder Serverfehler: spaeter noch einmal oder per Mail', async () => {
    fetchAttrappe.mockRejectedValue(new TypeError('Failed to fetch'));
    ausfuellen();
    absenden();
    await waitFor(() => expect(meldung().textContent).toBe('Die Anfrage ließ sich gerade nicht senden. Bitte versucht es später noch einmal. Oder schreibt uns an moin@konfi-quest.de.'));

    fetchAttrappe.mockResolvedValue(antwort(500, { error: 'Datenbankfehler' }));
    absenden();
    await waitFor(() => expect(fetchAttrappe).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(within(formular()).getByRole('button', { name: 'Anfrage senden' })).toBeEnabled());
    expect(meldung().textContent).toContain('ließ sich gerade nicht senden');
  });

  it('ein gefuellter Honigtopf geht unveraendert mit -- der Server entscheidet', () => {
    fetchAttrappe.mockReturnValue(new Promise(() => {}));
    ausfuellen();
    (formular().elements.namedItem('website') as HTMLInputElement).value = 'http://spam.example';
    absenden();
    expect(JSON.parse(fetchAttrappe.mock.calls[0][1].body).website).toBe('http://spam.example');
  });
});

describe('Vorlage zur Einwilligung der Eltern', () => {
  const seite = new DOMParser().parseFromString(lies('frontend/public/einwilligung.html'), 'text/html');
  const text = (seite.body.textContent ?? '').replace(/\s+/g, ' ');

  it('ist eine Vorlage mit Luecken fuer Gemeinde und Konfi, ohne Rechtsberatung zu versprechen', () => {
    expect(seite.querySelector('h1')?.textContent).toBe('Einwilligung zur Nutzung der App „Konfi Quest“');
    const luecken = Array.from(seite.querySelectorAll('.luecke')).map((l) => l.textContent);
    expect(luecken).toEqual(expect.arrayContaining(['Name der Gemeinde', 'Vor- und Nachname', 'Jahrgang', 'Ansprechperson und Kontakt der Gemeinde']));
    expect(text).toContain('Eine Rechtsberatung ersetzt er nicht.');
    expect(text).toContain('Unterschrift der Erziehungsberechtigten');
  });

  it('der Hinweis fuer die Gemeinde und der Druckknopf erscheinen nicht auf dem Papier', () => {
    const hinweis = seite.querySelector('.hinweis');
    expect(hinweis?.classList.contains('nicht-drucken')).toBe(true);
    expect(seite.querySelector('#drucken')?.closest('.nicht-drucken')).not.toBeNull();
    expect(seite.querySelector('style')?.textContent).toMatch(/@media print[\s\S]*\.nicht-drucken \{ display: none !important; \}/);
  });

  it('der Druckknopf druckt', () => {
    document.body.innerHTML = seite.body.innerHTML;
    const drucken = vi.fn();
    vi.stubGlobal('print', drucken);
    new Function(seite.querySelector('body > script')?.textContent ?? '')();
    fireEvent.click(document.getElementById('drucken') as HTMLElement);
    expect(drucken).toHaveBeenCalledTimes(1);
  });

  it('die Startseite verweist darauf (Fusszeile, Datenschutz-Frage, Dank nach der Anfrage)', () => {
    const verweise = Array.from(landing.querySelectorAll('a[href="/einwilligung"]'));
    expect(verweise.length).toBe(3);
  });

  it('nginx liefert /einwilligung als statische Seite aus, nicht als Web-App', () => {
    const nginx = lies('frontend/nginx.conf');
    expect(nginx).toMatch(/location = \/einwilligung \{\s*try_files \/einwilligung\.html =404;/);
    expect(nginx).toContain('location ~ ^/(landing|datenschutz|impressum|konto-loeschen|einwilligung)\\.html$');
  });

  it('Suchmaschinen duerfen sie finden: robots.txt und Sitemap', () => {
    expect(lies('frontend/public/robots.txt')).toContain('Allow: /einwilligung\n');
    expect(lies('frontend/public/sitemap.xml')).toContain('<loc>https://konfi-quest.de/einwilligung</loc>');
  });
});
