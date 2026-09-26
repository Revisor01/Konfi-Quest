// App Links (Android, 24.09.2026): Ein Link auf konfi-quest.de oeffnet die
// App. Android liefert die Adresse ueber 'appUrlOpen'; die App leitet daraus
// ein In-App-Ziel ab und uebergibt es ueber denselben Merker wie ein
// Push-Ziel an den Router (pushZielMelden / PushZielNavigation).
//
// Bis hierhin gab es in der App KEINEN Lauscher fuer geoeffnete Links: Der
// Intent-Filter allein haette die App zwar geoeffnet, die Adresse waere aber
// verhallt -- die App stuende auf der zuletzt geoeffneten Seite, der
// Einladungscode aus dem QR-Code waere weg.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// vi.hoisted: vi.mock wird an den Dateianfang gehoben und liefe sonst vor
// diese Deklarationen ("Cannot access 'addListener' before initialization").
const { addListener, remove } = vi.hoisted(() => ({
  addListener: vi.fn(),
  remove: vi.fn(),
}));

vi.mock('@capacitor/app', () => ({
  App: { addListener },
}));

import { deepLinkZiel, deepLinksAnschliessen, APP_LINK_PFADE, APP_LINK_HOSTS } from '../../utils/deepLinks';
import { pushZielAbholen } from '../../utils/pushNavigation';

describe('deepLinkZiel: In-App-Ziel aus der geoeffneten Adresse', () => {
  it('Einladung aus dem QR-Code: Pfad UND Code bleiben erhalten', () => {
    // Genau die Adresse, die AdminInvitePage in den QR-Code schreibt.
    expect(deepLinkZiel('https://konfi-quest.de/register?code=A3F09C21'))
      .toBe('/register?code=A3F09C21');
  });

  it('Passwort-Reset aus der Mail: Token bleibt erhalten', () => {
    // Genau die Adresse, die backend/routes/auth.js verschickt.
    expect(deepLinkZiel('https://konfi-quest.de/reset-password?token=abc.def'))
      .toBe('/reset-password?token=abc.def');
  });

  it('Anmelde-Link der Werbeseite', () => {
    expect(deepLinkZiel('https://konfi-quest.de/login')).toBe('/login');
  });

  it('Anker bleibt erhalten', () => {
    expect(deepLinkZiel('https://konfi-quest.de/login#oben')).toBe('/login#oben');
  });

  it('Grossschreibung im Host stoert nicht', () => {
    expect(deepLinkZiel('https://Konfi-Quest.de/register?code=1')).toBe('/register?code=1');
  });

  it('Werbeseite, Datenschutz, Impressum, Handbuch, API-Doku: kein Ziel', () => {
    // Diese Seiten hat die App nicht; sie bleiben im Browser. Waere hier ein
    // Ziel, spraenge die App auf ihren Fallback -- Nutzer:innen wollten aber
    // den Datenschutztext lesen.
    for (const pfad of ['/', '/datenschutz', '/impressum', '/handbuch', '/docs/api', '/gottesbilder', '/konto-loeschen']) {
      expect(deepLinkZiel(`https://konfi-quest.de${pfad}`), pfad).toBe('');
    }
  });

  it('fremde Hosts: kein Ziel', () => {
    expect(deepLinkZiel('https://konfi-quest.de.boese.example/register?code=1')).toBe('');
    expect(deepLinkZiel('https://example.com/register?code=1')).toBe('');
    // Der Server leitet www per 301 um; Android reicht www-Adressen deshalb
    // gar nicht erst durch (kein android:host im Manifest). Hier gespiegelt.
    expect(deepLinkZiel('https://www.konfi-quest.de/register?code=1')).toBe('');
  });

  it('nur https: http und eigene Schemata fuehren nirgendwohin', () => {
    expect(deepLinkZiel('http://konfi-quest.de/register?code=1')).toBe('');
    expect(deepLinkZiel('capacitor://localhost/register?code=1')).toBe('');
    expect(deepLinkZiel('konfiquest://register?code=1')).toBe('');
  });

  it('Unsinn statt Adresse: kein Ziel, kein Absturz', () => {
    expect(deepLinkZiel('')).toBe('');
    expect(deepLinkZiel('kein link')).toBe('');
    expect(deepLinkZiel('/register?code=1')).toBe('');
  });

  it('die Pfadliste enthaelt genau die drei Seiten vor der Anmeldung', () => {
    expect([...APP_LINK_PFADE].sort()).toEqual(['/login', '/register', '/reset-password']);
    expect(APP_LINK_HOSTS).toEqual(['konfi-quest.de']);
  });
});

describe('deepLinksAnschliessen: Lauscher am Capacitor-App-Plugin', () => {
  beforeEach(() => {
    addListener.mockReset();
    remove.mockReset();
    addListener.mockResolvedValue({ remove });
    pushZielAbholen(); // Merker leeren
  });

  it('lauscht auf appUrlOpen -- nicht auf etwas anderes', async () => {
    await deepLinksAnschliessen();
    expect(addListener).toHaveBeenCalledTimes(1);
    expect(addListener.mock.calls[0][0]).toBe('appUrlOpen');
  });

  it('ein geoeffneter Einladungslink landet als Ziel im Merker', async () => {
    await deepLinksAnschliessen();
    const lauscher = addListener.mock.calls[0][1] as (e: { url: string }) => void;

    lauscher({ url: 'https://konfi-quest.de/register?code=A3F09C21' });

    expect(pushZielAbholen()).toEqual({ ziel: '/register?code=A3F09C21', herkunft: 'push' });
  });

  it('ein Link ohne Ziel legt NICHTS ab', async () => {
    await deepLinksAnschliessen();
    const lauscher = addListener.mock.calls[0][1] as (e: { url: string }) => void;

    lauscher({ url: 'https://konfi-quest.de/datenschutz' });

    expect(pushZielAbholen()).toBeNull();
  });

  it('die Abbau-Funktion entfernt den Lauscher', async () => {
    const abbauen = await deepLinksAnschliessen();
    expect(remove).toHaveBeenCalledTimes(0);
    abbauen();
    expect(remove).toHaveBeenCalledTimes(1);
  });
});

describe('Der Lauscher ist auch wirklich angeschlossen (Quelltext-Zusicherung)', () => {
  // Am Quelltext, weil AppContext im Test nicht nativ laeuft
  // (Capacitor.isNativePlatform() ist in jsdom false) und der Effekt dort
  // bewusst frueh aussteigt.
  const ohneKommentare = (quelle: string) =>
    quelle.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '');

  it('AppContext schliesst die App-Links an -- unabhaengig von der Anmeldung', () => {
    const quelle = ohneKommentare(
      readFileSync(join(process.cwd(), 'src/contexts/AppContext.tsx'), 'utf8')
    );
    expect(quelle).toContain('deepLinksAnschliessen()');
    // Der Effekt darf NICHT an [user] haengen: Die Einladung tippen die an,
    // die noch nicht angemeldet sind.
    const effekt = quelle.slice(quelle.indexOf('deepLinksAnschliessen()'));
    const ende = effekt.indexOf('}, [');
    expect(effekt.slice(ende, ende + 7)).toBe('}, []);');
  });

  it('der Login-Router hat die Ziel-Navigation, sonst holte dort niemand das Ziel ab', () => {
    const quelle = ohneKommentare(readFileSync(join(process.cwd(), 'src/App.tsx'), 'utf8'));
    const loginZweig = quelle.slice(quelle.indexOf('if (!user) {'), quelle.indexOf('if (!seitenBereit'));
    expect(loginZweig).toContain('<PushZielNavigation />');
    // ... und der angemeldete Zweig hat sie weiterhin.
    const restZweig = quelle.slice(quelle.indexOf('if (!seitenBereit'));
    expect(restZweig).toContain('<PushZielNavigation />');
  });
});
