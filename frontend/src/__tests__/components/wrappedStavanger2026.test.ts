import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { hintergrundFuer, verteileMotive } from '../../components/wrapped/hintergrundbilder';

/**
 * Die Sonderseite zur Sommerfreizeit 2026 nach Stavanger.
 *
 * SIMONS VORGABE (07.09.2026): "kannst du bitte eine seite bauen fuer
 * sommerfreizeit 2026 stavanger norwegen. das sehen dann nur die teamer und
 * konfis die dabei waren." Und der Text dazu: "Norwegen 2026 - du warst
 * dabei. 14 unvergessliche Tage in Himmel og Hav."
 *
 * WAS HIER GEPRUEFT WIRD und warum es nicht die Waechter-Tests daneben
 * schon tun:
 *
 *   wrappedDramaturgieHatRenderer prueft, DASS die Seite einen Renderer
 *   hat; wrappedTeilenAlleSeiten, dass sie einen Teilen-Zweig hat. Beide
 *   sagen nichts darueber, WAS auf ihr steht. Genau daran haengt hier aber
 *   alles: Der Schluessel darf kein Praefix tragen (sonst leere Seite in
 *   der ausgelieferten App), und es darf KEINE gerechnete Zahl geben
 *   (Simons ausdrueckliche Vorgabe -- die 14 Tage sind fester Text).
 */

const wrapped = resolve(process.cwd(), 'src/components/wrapped');
const quelle = (pfad: string) => readFileSync(resolve(wrapped, pfad), 'utf8');

const slide = quelle('slides/Stavanger2026Slide.tsx');

/**
 * Der Quelltext OHNE Kommentare.
 *
 * Noetig, weil die Kommentare dieser Seite genau die Begriffe erklaeren, die
 * hier verboten sein sollen ("kein .kat-zahl", "keine gerechnete Zahl").
 * Eine Suche im Rohtext faende sie in der Begruendung wieder und meldete
 * einen Fehler, den es nicht gibt -- schlimmer noch: Sie zwaenge dazu, die
 * Begruendung zu loeschen, um den Test gruen zu bekommen.
 */
const slideCode = slide
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/^\s*\/\/.*$/gm, '');
const modal = quelle('WrappedModal.tsx');
const shareCard = quelle('share/ShareCard.tsx');
const modalCss = quelle('WrappedModal.css');

describe('Sonderseite Stavanger 2026', () => {
  it('zeigt Simons Text in drei Teilen', () => {
    // Auge klein oben, Slogan gross, Nachsatz darunter -- so entschieden
    // am 07.09.2026.
    expect(slide).toContain('Stavanger 2026');
    expect(slide).toContain('Du warst');
    expect(slide).toContain('dabei.');
    expect(slide).toContain('14 unvergessliche Tage in Himmel og Hav.');
  });

  it('laesst "Himmel og Hav" unuebersetzt stehen', () => {
    // Es ist das Fahrtmotto und bleibt norwegisch (Simons Entscheidung).
    // Eine Uebersetzung in Klammern daneben waere genau das, was er nicht
    // wollte.
    expect(slideCode).not.toMatch(/Himmel und Meer|Himmel og Hav \(/);
  });

  it('rechnet KEINE Zahl aus und zeigt keine gross an', () => {
    // DER KERN DER SEITE. Die Fahrt dauerte 14 Tage, unabhaengig davon, wie
    // oft jemand angehakt wurde. Eine gerechnete Zahl haette bei den
    // meisten "1" ergeben und aus zwei Wochen Norwegen einen Haken gemacht.
    //
    // '.kat-zahl' ist das grosse Zahlenfeld aller Kategorie-Seiten -- es
    // darf hier nicht vorkommen. Und es gibt keine Prop, aus der eine Zahl
    // kaeme: Die Seite nimmt nur `isActive`.
    expect(slideCode).not.toContain('kat-zahl');
    expect(slideCode).not.toContain('anzahl');
    // Die Seite nimmt NUR isActive -- es gibt keine Prop, aus der eine Zahl
    // kommen koennte.
    expect(slideCode).toContain('({ isActive })');
    // Und keine eingesetzte Groesse im Text: Die 14 steht woertlich da.
    expect(slideCode).toContain('14 unvergessliche Tage in Himmel og Hav.');
    expect(slideCode).not.toMatch(/\{\s*tage\s*\}|\{\s*anzahl\s*\}|\{\s*n\s*\}/);
  });

  it('ist eine EIGENE Komponente, keine Kategorie-Seite', () => {
    // KategorieSeiteSlide traegt fest eine Zahl (.kat-zahl) und waehlt
    // seinen Slogan ueber stufeFuer(n) -- beides passt auf eine Seite ohne
    // Zahl nicht. Deshalb eine eigene Komponente.
    expect(slideCode).not.toContain('KategorieSeiteSlide');
    expect(slideCode).not.toContain('stufeFuer');
    expect(modal).toContain('Stavanger2026Slide');
  });

  it('traegt einen Schluessel OHNE kategorie:- oder datum:-Praefix', () => {
    // DER VERTRAG MIT DEN AUSGELIEFERTEN APPS (Build 176, Commit 51cf1362):
    // Dort werden beide Praefixe als MUSTER behandelt -- jeder so
    // beginnende Schluessel landet in der Seitenliste, auch ein unbekannter.
    // KategorieSeiteSlide findet dann keinen Text, gibt null zurueck, und
    // der Rueckblick zeigt eine leere weisse Seite. Ohne Praefix faellt der
    // Schluessel dort durch `if (renderers[kachel])` und verschwindet.
    expect(slide).toContain('kachel="stavanger-2026"');
    expect('stavanger-2026'.startsWith('kategorie:')).toBe(false);
    expect('stavanger-2026'.startsWith('datum:')).toBe(false);
  });

  it('steht in BEIDEN Rueckblicken -- Konfi und Team', () => {
    // Simon: "das sehen dann nur die teamer und konfis die dabei waren."
    const konfiRegistry = modal.match(
      /const renderers: Record<string, \(isActive: boolean\) => React\.ReactNode> = \{([\s\S]*?)\n {4}\};/
    );
    expect(konfiRegistry).toBeTruthy();
    expect(konfiRegistry![1]).toContain("'stavanger-2026':");

    const teamerTeil = modal.slice(modal.indexOf('const buildTeamerSlides'));
    const teamerRegistry = teamerTeil.match(
      /const renderers: Record<string, \(isActive: boolean\) => React\.ReactNode> = \{([\s\S]*?)\n {4}\};/
    );
    expect(teamerRegistry).toBeTruthy();
    expect(teamerRegistry![1]).toContain("'stavanger-2026':");
  });

  it('die Teilen-Karte sagt dasselbe wie die Seite', () => {
    // Was jemand auf dem Bildschirm sieht, soll auch auf dem geteilten Bild
    // stehen -- und dort ebenfalls ohne Zahl.
    const zweig = shareCard.match(/case 'stavanger-2026':([\s\S]*?)\n\n/);
    expect(zweig, 'kein Teilen-Zweig fuer stavanger-2026').toBeTruthy();
    expect(zweig![1]).toContain('Stavanger 2026');
    expect(zweig![1]).toContain('Du warst');
    expect(zweig![1]).toContain('14 unvergessliche Tage in Himmel og Hav.');
    expect(zweig![1]).not.toContain('share-zahl');
  });

  it('hat einen eigenen Farbverlauf', () => {
    // Ohne eigene Klasse liefe die Seite im Standard-Verlauf -- sie saehe
    // aus wie jede andere, obwohl sie die eine besondere ist.
    expect(modalCss).toContain('.stavanger-slide');
    expect(modalCss).toMatch(/\.stavanger-slide\s*\{[^}]*--seiten-verlauf/);
  });

  it('zeigt den Preikestolen, und die Datei liegt da', () => {
    const pfad = hintergrundFuer('stavanger-2026');
    expect(pfad).toBe('/assets/wrapped/preikestolen.webp');
    expect(
      readFileSync(resolve(process.cwd(), 'public' + pfad)).length,
      'preikestolen.webp fehlt oder ist leer'
    ).toBeGreaterThan(1000);
  });

  it('behaelt ihr Motiv auch in einem vollen Rueckblick', () => {
    // verteileMotive vergibt Motive ohne Wiederholung -- ein Wunschmotiv
    // kann dabei an eine frueher stehende Seite fallen. Der Preikestolen
    // ist aber das einzige Bild, das NUR diese Seite will: Er ist der Ort,
    // von dem sie erzaehlt. Ein Deich statt des Felsens waere hier schlicht
    // das falsche Bild.
    const voll = [
      'intro', 'events', 'stavanger-2026', 'kategorie:gottesdienst',
      'challenges', 'challenge-momente', 'punkte', 'badges', 'seltenstes',
      'konfirmation', 'abschluss', 'werde-teamer',
    ];
    const verteilung = verteileMotive(voll);
    expect(verteilung['stavanger-2026'].haupt).toBe('/assets/wrapped/preikestolen.webp');
  });
});
