import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

/**
 * Jede Seite, die der Rueckblick zeigen kann, laesst sich auch teilen.
 *
 * WAS SCHIEFGING (gemeldet 06.09.2026): Das Teilen einer Seite brachte ein
 * schwarzes Bild mit Wasserzeichen. Die Teilen-Karte war einmal gebaut und
 * dann vier Umbauten lang nicht nachgezogen worden -- sie kannte rund die
 * Haelfte der Seiten nicht. Fuer eine unbekannte Seite gab sie schlicht
 * `null` zurueck: kein Absturz, keine Meldung, ein leeres Bild.
 *
 * WARUM ES VIER UMBAUTEN LANG NIEMANDEM AUFFIEL: Es gab keinen Test, der
 * die beiden Listen gegeneinander haelt. Genau das tut dieser hier.
 *
 * ER LIEST DEN QUELLTEXT statt die Bauteile zu rendern: Die Seitenliste
 * entsteht in WrappedModal aus Daten eines Rueckblicks, die Teilen-Karte
 * verzweigt ueber `switch`. Beide Listen stehen aber woertlich im Code --
 * und nur die Frage "kennt die eine, was die andere erzeugt?" ist hier
 * wichtig, nicht das Aussehen.
 *
 * DYNAMISCHE SEITEN (`kategorie:*`, `datum:*`) werden als MUSTER geprueft,
 * nicht aufgezaehlt: Neue Kategorien kommen aus der Gemeinde-Verwaltung
 * dazu, eine Aufzaehlung waere schon beim naechsten Eintrag veraltet.
 */

const wrappedVerzeichnis = resolve(process.cwd(), 'src/components/wrapped');

const quelle = (pfad: string) => readFileSync(resolve(wrappedVerzeichnis, pfad), 'utf8');

const modal = quelle('WrappedModal.tsx');
const shareCard = quelle('share/ShareCard.tsx');
const shareCss = quelle('share/ShareCard.css');

/**
 * Die Seiten-Schluessel aus der Renderer-Registry in WrappedModal --
 * `'schluessel': (a) => <...Slide ... />`. Das ist die Liste dessen, was
 * ein Konfi-Rueckblick ueberhaupt anzeigen kann.
 */
function konfiSeitenAusModal(): string[] {
  const registry = modal.match(/const renderers: Record<string, \(isActive: boolean\) => React\.ReactNode> = \{([\s\S]*?)\n {4}\};/);
  if (!registry) throw new Error('Renderer-Registry in WrappedModal.tsx nicht gefunden');
  return [...registry[1].matchAll(/^\s*'([a-z0-9-]+)':\s*\(/gm)].map(m => m[1]);
}

/** Die Teamer-Seiten -- `key: 'teamer-...'` in buildTeamerSlides. */
function teamerSeitenAusModal(): string[] {
  const bau = modal.slice(modal.indexOf('const buildTeamerSlides'));
  return [...new Set([...bau.matchAll(/key:\s*'(teamer-[a-z-]+)'/g)].map(m => m[1]))];
}

/** Die `case`-Zweige der Teilen-Karte. */
function faelleDerTeilenKarte(): string[] {
  return [...shareCard.matchAll(/^\s*case '([a-z0-9:*-]+)':/gm)].map(m => m[1]);
}

const KONFI_SEITEN = konfiSeitenAusModal();
const TEAMER_SEITEN = teamerSeitenAusModal();
const FAELLE = faelleDerTeilenKarte();

// Die dynamischen Seiten. Sie kommen nicht aus der Registry, sondern
// entstehen in WrappedModal aus `kacheln` des Snapshots -- der Praefix ist
// dort woertlich verdrahtet.
const DYNAMISCHE_PRAEFIXE = ['kategorie:', 'datum:'];

describe('Teilen-Karte kennt jede Seite des Rueckblicks', () => {
  it('die Renderer-Registry liefert die erwarteten Konfi-Seiten', () => {
    // Gegenprobe fuer den Auslesevorgang selbst: Findet die Regel nichts
    // mehr (weil jemand die Registry umbaut), waeren alle Pruefungen
    // darunter still gruen.
    expect(KONFI_SEITEN.length).toBeGreaterThanOrEqual(14);
    expect(KONFI_SEITEN).toContain('intro');
    expect(KONFI_SEITEN).toContain('werde-teamer');
    expect(KONFI_SEITEN).toContain('seltenstes');
  });

  it('die Teamer-Seiten werden gefunden', () => {
    expect(TEAMER_SEITEN).toHaveLength(7);
    expect(TEAMER_SEITEN).toContain('teamer-intro');
    expect(TEAMER_SEITEN).toContain('teamer-abschluss');
  });

  it('jede Konfi-Seite hat einen Zweig in der Teilen-Karte', () => {
    const fehlend = KONFI_SEITEN.filter(k => !FAELLE.includes(k));
    expect(fehlend, `ohne Zweig in ShareCard.tsx: ${fehlend.join(', ')}`).toEqual([]);
  });

  it('jede Teamer-Seite hat einen Zweig in der Teilen-Karte', () => {
    const fehlend = TEAMER_SEITEN.filter(k => !FAELLE.includes(k));
    expect(fehlend, `ohne Zweig in ShareCard.tsx: ${fehlend.join(', ')}`).toEqual([]);
  });

  it('die dynamischen Seiten werden als Muster behandelt, nicht aufgezaehlt', () => {
    // `kategorie:fest`, `datum:advent` und alles, was die Gemeinden noch
    // anlegen: Die Teilen-Karte muss den Praefix abfangen, bevor der
    // switch laeuft -- eine Aufzaehlung waere beim naechsten neuen
    // Eintrag schon wieder unvollstaendig.
    for (const praefix of DYNAMISCHE_PRAEFIXE) {
      expect(
        shareCard.includes(`startsWith('${praefix}')`),
        `ShareCard.tsx faengt '${praefix}' nicht ab`
      ).toBe(true);
    }
  });

  it('jede Seite hat einen eigenen Hintergrund in ShareCard.css', () => {
    // Ohne `.share-card--<seite>` bleibt die Flaeche schwarz -- genau das
    // schwarze Bild, das gemeldet wurde.
    const ohneKlasse = [...KONFI_SEITEN, ...TEAMER_SEITEN]
      .filter(k => !shareCss.includes(`.share-card--${k}`));
    expect(ohneKlasse, `ohne Klasse in ShareCard.css: ${ohneKlasse.join(', ')}`).toEqual([]);
  });

  it('jede Seite bringt die Farbe ihrer Seite als Schleier mit', () => {
    // Ueber dem Foto liegt der Farbverlauf der Seite (--karten-schleier).
    // Fehlt er bei einer Karte, greift der Standardwert -- das geteilte
    // Bild haette dann eine andere Farbe als die Seite, von der es stammt.
    const ohneSchleier = [...KONFI_SEITEN, ...TEAMER_SEITEN].filter(k => {
      const block = shareCss.match(
        new RegExp(`\\.share-card--${k.replace(/[-]/g, '\\-')}\\s*\\{[^}]*\\}`, 'g')
      );
      return !block || !block.some(b => b.includes('--karten-schleier'));
    });
    expect(ohneSchleier, `ohne --karten-schleier: ${ohneSchleier.join(', ')}`).toEqual([]);
  });

  it('die Slogan-Seiten stehen linksbuendig unten', () => {
    // Diese vier Seiten leben vom Slogan, nicht von einer Zahl -- im
    // Rueckblick steht er linksbuendig am unteren Rand. Faellt die Regel
    // weg, rutscht der Text in die Mitte und das geteilte Bild sieht aus
    // wie eine Statistikkachel statt wie die Seite.
    //
    // Genau das ist am 06.09.2026 beim Umbau der Farben passiert: Eine
    // Ersetzung traf den Mehrfach-Auswahlblock und ueberschrieb seinen
    // Inhalt. Aufgefallen ist es nur am fertigen Bild.
    const block = shareCss.match(
      /\.share-card--kategorie-seite,\s*\.share-card--datums-seite,\s*\.share-card--konfirmation,\s*\.share-card--werde-teamer\s*\{([^}]*)\}/
    );
    expect(block, 'der Block fuer die Slogan-Seiten fehlt').toBeTruthy();
    const regeln = block![1];
    expect(regeln).toContain('justify-content: flex-end');
    expect(regeln).toContain('align-items: flex-start');
    expect(regeln).toContain('text-align: left');
  });

  it('die dynamischen Seiten haben einen Hintergrund', () => {
    // Eine Klasse je Praefix reicht: `.share-card--kategorie` faengt
    // alle Kategorie-Seiten, weil die Karte den Praefix als Klasse setzt.
    expect(shareCss.includes('.share-card--kategorie-seite')).toBe(true);
    expect(shareCss.includes('.share-card--datums-seite')).toBe(true);
  });
});
