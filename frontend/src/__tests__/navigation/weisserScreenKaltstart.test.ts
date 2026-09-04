import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const lies = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
const mainTabs = lies('src/components/layout/MainTabs.tsx');
const app = lies('src/App.tsx');

// Simons Befund 04.09.2026: "Bin als Konfi eingeloggt. App zu. Ich oeffne,
// weisser Screen. Ich wechsle hin und her, alles da. Wenn App im Hintergrund
// kein Problem."
//
// NICHT zu verwechseln mit dem Befund aus Build 153/154 (siehe
// keinPlatzhalterImOutlet.test.ts): Dort war JEDER erste Seitenaufruf weiss,
// Ursache war ein Platzhalter im IonRouterOutlet. Hier geht es um den
// KALTSTART: Das WebView stellt die zuletzt besuchte URL wieder her. Passt
// die zu keiner Route der aktuellen Rolle -- eine Adresse aus einer frueheren
// Version, eine Detailseite mit geaenderter Eltern-Route, oder eine Route
// einer anderen Rolle -- matcht im Outlet nichts, und es wird gar nichts
// gerendert. Ein Tab-Antippen navigiert auf eine gueltige Route, darum war
// danach "alles wieder da". Aus dem Hintergrund bleibt die URL gueltig,
// deshalb trat es dort nie auf.
//
// Der AUSGELOGGTE Zweig in App.tsx hatte diesen Fallback laengst, mit
// derselben Begruendung im Kommentar. Im angemeldeten Zweig fehlte er.

describe('Kaltstart auf einer unbekannten Route bleibt nicht weiss', () => {
  it('MainTabs hat einen Catch-all fuer angemeldete Nutzer:innen', () => {
    expect(mainTabs).toContain('path="*"');
  });

  it('der Catch-all leitet auf die Startseite der Rolle', () => {
    const zeile = mainTabs.split('\n').find(z => z.includes('path="*"'));
    expect(zeile, 'Catch-all-Zeile nicht gefunden').toBeTruthy();
    expect(zeile!).toContain('baum.home');
    expect(zeile!).toContain('replace');
  });

  it('er steht nach den echten Routen', () => {
    const routen = mainTabs.indexOf('baum.routes.map');
    const catchAll = mainTabs.indexOf('path="*"');
    expect(routen).toBeGreaterThan(-1);
    expect(catchAll).toBeGreaterThan(routen);
  });

  it('der ausgeloggte Zweig behaelt seinen eigenen Catch-all', () => {
    // Gegenprobe: Der neue Fallback ersetzt den vorhandenen nicht.
    const zeile = app.split('\n').find(z => z.includes('path="*"'));
    expect(zeile, 'Catch-all in App.tsx fehlt').toBeTruthy();
    expect(zeile!).toContain('/login');
  });

  it('beide Zweige leiten um, statt nichts zu rendern', () => {
    for (const quelle of [mainTabs, app]) {
      const zeile = quelle.split('\n').find(z => z.includes('path="*"'));
      expect(zeile!).toContain('Navigate');
    }
  });
});

describe('Rollenwechsel baut das Outlet neu auf', () => {
  // Simons Befund 04.09.2026: "Mein Admin Login zeigt einmal kurz alles.
  // Die Tab-Leiste zeigt aber Konfi."
  //
  // Erster Versuch war die Benutzer-ID im key des IonReactRouter -- das
  // erzeugte einen ZWEITEN Fehler: Jede Anmeldung montierte den ganzen
  // Baum neu, MainTabs setzte seitenBereit zurueck und das Outlet bekam
  // beim ersten Rendern einen Platzhalter statt einer fertigen Seite
  // (Muster aus Build 153/154, siehe keinPlatzhalterImOutlet.test.ts) --
  // weisse Seite auf Konfi- und Teamer-Dashboard.
  //
  // Richtig ist der Schluessel an der ROLLE, am Outlet: Er wechselt nur,
  // wenn sich der Routen-Satz wirklich aendert.
  it('das Outlet haengt an der Rolle', () => {
    const zeile = mainTabs.split('\n')
      .filter(z => !z.trim().startsWith('//'))
      .find(z => z.includes('<IonRouterOutlet'));
    expect(zeile, 'IonRouterOutlet nicht gefunden').toBeTruthy();
    expect(zeile!).toContain('key={rolle}');
  });

  it('der Router haengt NICHT an der Benutzer-ID', () => {
    // Sonst montiert jede Anmeldung neu -> Platzhalter im Outlet -> weiss.
    const zeile = app.split('\n')
      .filter(z => !z.trim().startsWith('{/*') && !z.trim().startsWith('*'))
      .find(z => z.includes('<IonReactRouter key='));
    expect(zeile, 'IonReactRouter nicht gefunden').toBeTruthy();
    expect(zeile!).not.toContain('user?.id');
    expect(zeile!).toContain('orgVersion');
  });
});
