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
