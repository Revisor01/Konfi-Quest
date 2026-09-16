import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

const lies = (p: string) => readFileSync(join(process.cwd(), p), 'utf8');
const mainTabs = lies('src/components/layout/MainTabs.tsx');
const app = lies('src/App.tsx');

// Simons Befund 14.09.2026, Build 192: "App zeigt blank Screen beim Oeffnen.
// Erst wenn irgendwohin navigiert wird und zurueck, ist das Dashboard da."
//
// WAS DIE BESTEHENDEN TESTS NICHT ERWISCHT HABEN — und warum es diesen
// Test zusaetzlich braucht:
//
//   keinPlatzhalterImOutlet.test.ts prueft die KINDER des Outlets, also die
//   Komponenten hinter den einzelnen <Route>-Eintraegen. Es verbietet dort
//   einen Ladezustand. Das galt und gilt.
//
//   Der Fehler lag aber eine Ebene HOEHER: MainTabs SELBST ist das Kind des
//   IonRouterOutlet aus App.tsx. Es gab bei fehlendem Seitenbaum ein
//   <SeiteLaedt/> (eine IonPage) zurueck und tauschte das spaeter gegen
//   <IonTabs>. Fuer Ionic ist das derselbe Tausch: Es registriert die zuerst
//   eingehaengte IonPage als Seite des Outlets und bemerkt den Austausch
//   nicht. Ergebnis: leerer Bildschirm, bis eine echte Navigation stattfand.
//
//   Dass der Tausch IMMER passierte, ist nachgesehen: ladeRolleVor() wartet
//   auf dynamische Importe (`await Promise.allSettled` in rollenBaeume.ts)
//   und kommt fruehestens einen Microtask spaeter zurueck. Der erste
//   Durchgang war also zwangslaeufig der Ladezustand.
//
// Behoben, indem die Entscheidung "warten oder rendern" VOR den Router
// gewandert ist (navigation/useSeitenBereit, ausgewertet in App.tsx).

describe('MainTabs tauscht seinen Baum nicht innerhalb des Outlets', () => {
  /** Der Rumpf der MainTabs-Komponente, ohne Kommentare. */
  const rumpf = (() => {
    const start = mainTabs.indexOf('const MainTabs: React.FC = () => {');
    expect(start, 'MainTabs-Komponente nicht gefunden').toBeGreaterThan(-1);
    return mainTabs.slice(start).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  })();

  it('gibt keinen Ladezustand als eigenes Ergebnis zurueck', () => {
    // Genau das war der Fehler: `return <SeiteLaedt />` als frueher Ausstieg.
    // Ein solcher Ausstieg haengt eine IonPage ins Outlet, die spaeter gegen
    // die Tabs getauscht wird.
    expect(rumpf).not.toMatch(/return\s*<SeiteLaedt\s*\/>/);
  });

  it('haelt keinen eigenen Bereitschafts-Zustand mehr', () => {
    // Ein State, der nach dem Mount von false auf true springt, erzeugt
    // genau den zweiten Render, der den Tausch ausloest.
    expect(rumpf).not.toContain('setSeitenBereit');
    expect(rumpf).not.toMatch(/useState\(false\)[^\n]*seitenBereit/);
  });
});

describe('Der Ladezustand liegt oberhalb des Routers', () => {
  const ohneKommentare = app.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

  // Der Ausstieg haengt seit dem 15.09.2026 an ZWEI Bedingungen: am
  // Seitenbaum und daran, ob die App-Sperre schon geklaert ist (Simons
  // Flacker-Befund, siehe components/appAbdeckung.test.ts). Geprueft wird
  // deshalb, dass `!seitenBereit` die Bedingung anfuehrt — nicht mehr, dass
  // es allein darin steht. Die Regel dieses Tests ist die REIHENFOLGE
  // (Ausstieg vor dem Router), nicht die genaue Schreibweise der Zeile.
  const AUSSTIEG = /if\s*\(\s*!seitenBereit\b/;

  it('App.tsx entscheidet vor dem Router, ob der Baum bereit ist', () => {
    expect(ohneKommentare).toContain('useSeitenBereit');
    expect(ohneKommentare).toMatch(AUSSTIEG);
  });

  it('der frueh gerenderte Ladebildschirm steht VOR dem IonReactRouter', () => {
    // Die Reihenfolge im Quelltext ist hier die Aussage: Der Ausstieg muss
    // vor der Stelle stehen, an der der angemeldete Router montiert wird.
    const ausstieg = ohneKommentare.search(AUSSTIEG);
    const router = ohneKommentare.indexOf('<IonReactRouter key={orgVersion}>');
    expect(ausstieg, 'Ausstieg fehlt').toBeGreaterThan(-1);
    expect(router, 'angemeldeter Router fehlt').toBeGreaterThan(-1);
    expect(ausstieg).toBeLessThan(router);
  });

  it('der Ladebildschirm ist KEINE IonPage', () => {
    // Eine IonPage waere wieder eine Seite und koennte in einem Outlet
    // denselben Tausch ausloesen. Der Ladebildschirm ist bewusst nacktes
    // Markup.
    const start = app.indexOf('const AppLaedt');
    expect(start, 'AppLaedt fehlt').toBeGreaterThan(-1);
    const block = app.slice(start, start + 600);
    expect(block).not.toContain('IonPage');
  });

  it('der Ladebildschirm steht ausserhalb jedes IonRouterOutlet', () => {
    const start = app.indexOf('const AppLaedt');
    const block = app.slice(start, start + 600);
    expect(block).not.toContain('IonRouterOutlet');
  });
});
