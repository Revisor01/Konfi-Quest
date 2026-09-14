import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const lies = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
const mainTabs = lies('src/components/layout/MainTabs.tsx');
const app = lies('src/App.tsx');

// Befund aus Simons Geraetetests mit Build 153 und 154 (31.08.2026):
// "Erster Aufruf weiss, zweiter dann da. Bei jeder Seite, auch Detailseiten
// und Chatraeumen."
//
// Ursache: IonRouterOutlet verwaltet seine Kinder als Seiten-Stack und
// registriert die IonPage beim Einhaengen. Wird sie danach gegen eine andere
// getauscht, bekommt Ionic das NICHT mit — die neue Seite bleibt unsichtbar.
//
// Der Tausch kam erst von <Suspense>, danach (erster Fix-Versuch) von einem
// eigenen Ladezustand in der Route. Beide Male dasselbe Bild. Richtig ist:
// Die Chunks werden geladen, BEVOR das Outlet rendert — im Outlet steht dann
// nie ein Platzhalter.
//
// Dieser Test haelt genau das fest. Er ist bewusst eine Quelltext-Pruefung:
// Der Fehler zeigt sich nur im echten Ionic-Outlet auf einem Geraet, nicht
// in jsdom — ein Render-Test wuerde ihn nicht finden.

describe('IonRouterOutlet: kein Platzhalter zwischen Outlet und Seite', () => {
  it('verwendet KEIN Suspense im Routen-Element', () => {
    // Nur echter Code, Kommentare zaehlen nicht.
    const ohneKommentare = mainTabs
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    expect(ohneKommentare).not.toMatch(/<Suspense/);
  });

  it('rendert die Seite direkt, ohne eigenen Ladezustand', () => {
    // SeiteMitChunk darf keinen Zustand halten und keinen Platzhalter
    // zurueckgeben — sonst ist es derselbe Tausch unter anderem Namen.
    const block = mainTabs.slice(
      mainTabs.indexOf('const SeiteMitChunk'),
      mainTabs.indexOf('// Uebergeordnete Seite einer Parameter-Route')
    );
    expect(block.length).toBeGreaterThan(0);
    expect(block).not.toMatch(/useState/);
    expect(block).not.toMatch(/<SeiteLaedt/);
  });

  it('laedt die Rollen-Seiten VOR dem ersten Rendern des Outlets', () => {
    // ladeRolleVor darf nicht mehr in einem setTimeout haengen: Genau das
    // Zeitfenster war die Luecke, in der Seiten weiss blieben.
    // Das Vorladen selbst liegt seit dem 14.09.2026 in
    // navigation/useSeitenBereit und wird in App.tsx OBERHALB des Routers
    // ausgewertet. Es darf weiterhin NICHT in einem setTimeout haengen --
    // genau dieses Zeitfenster war die urspruengliche Luecke.
    const hook = lies('src/navigation/useSeitenBereit.ts');
    expect(hook).toMatch(/ladeRolleVor\(rolle\)/);
    expect(hook).not.toMatch(/setTimeout\(\(\)\s*=>\s*\{\s*void ladeRolleVor/);
    // Und der Router wartet, bis sie da sind.
    expect(app).toMatch(/if\s*\(\s*!seitenBereit\s*\)/);
  });
});

describe('MainTabs rendert nie null (weisse Seite beim Kaltstart)', () => {
  // Simons Befund 04.09.2026: "Anmeldeseite kommt immer. Nach dem
  // Ausschalten und wieder Starten ist es weiss, wenn man eingeloggt ist."
  //
  // MainTabs gab `null` zurueck, solange user noch nicht geladen war. Beim
  // KALTSTART mit gespeicherter Sitzung ist das ein Moment lang der Fall --
  // und ein null haengt eine LEERE Seite in den IonRouterOutlet. Ionic
  // registriert sie beim Einhaengen und bemerkt den spaeteren Tausch nicht
  // (dasselbe Muster wie beim Platzhalter oben). Ohne gespeicherte Sitzung
  // greift der Login-Zweig in App.tsx -- deshalb kam die Anmeldeseite immer
  // und weiss wurde es nur im angemeldeten Fall.
  //
  // NACHTRAG 14.09.2026: Der Ladezustand steht nicht mehr IN MainTabs,
  // sondern in App.tsx oberhalb des Routers -- er lag hier selbst innerhalb
  // des Outlets und loeste denselben Tausch aus, den er verhindern sollte
  // (siehe keinTauschImOutlet.test.ts). Die Aussage bleibt unveraendert:
  // bei fehlendem Seitenbaum wird NIE null gerendert.
  it('rendert bei fehlendem Seitenbaum einen Ladezustand statt null', () => {
    const block = app.slice(
      app.indexOf('if (!seitenBereit)'),
      app.indexOf('return (', app.indexOf('if (!seitenBereit)'))
    );
    expect(block).not.toMatch(/return null/);
    expect(app).toContain('<AppLaedt />');
  });

  it('MainTabs selbst steigt nicht mehr mit einem Ladezustand aus', () => {
    // Gegenprobe zur Verschiebung: Kaeme der Ausstieg hierher zurueck,
    // waere der Fehler wieder da.
    expect(mainTabs).not.toMatch(/return\s*<SeiteLaedt\s*\/>/);
  });
});
