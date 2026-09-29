// Android: Symbol und Farbe der Mitteilungen (29.09.2026).
//
// Simon am Geraet (Build 128): "die notification ist nicht korrekt
// gestyled". Das Manifest nannte weder default_notification_icon noch
// default_notification_color, und der Server schickt im android-Block weder
// icon noch color. Das FCM-SDK nahm deshalb das App-Symbol als kleines
// Symbol; Android wertet davon nur die Deckkraft aus -- aus dem vollen
// Quadrat des Launcher-Symbols wurde ein weisser bzw. grauer Fleck, ohne
// Akzentfarbe.
//
// Jetzt: ic_stat_konfi (Lutherrose aus der Monochrom-Ebene, weiss auf
// durchsichtig, 20 dp Motiv auf 24 dp) in allen fuenf Dichten und eine
// Akzentfarbe je Hell- und Dunkelmodus. Beide Anzeige-Wege lesen dieselben
// Metadaten: das FCM-SDK bei geschlossener App und @capacitor/push-
// notifications bei offener App (CommonNotificationBuilder).
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { inflateSync } from 'zlib';
import { join } from 'path';

const RES = join(process.cwd(), 'android/app/src/main/res');
const ANDROID_NS = 'http://schemas.android.com/apk/res/android';
const xml = (pfad: string) => new DOMParser().parseFromString(readFileSync(pfad, 'utf8'), 'application/xml');
const manifest = xml(join(process.cwd(), 'android/app/src/main/AndroidManifest.xml'));

/** Wert einer <meta-data> unter <application>. */
const metaDaten = (name: string) =>
  [...manifest.getElementsByTagName('meta-data')]
    .find((m) => m.getAttributeNS(ANDROID_NS, 'name') === name)
    ?.getAttributeNS(ANDROID_NS, 'resource');

/** Minimaler PNG-Leser: 8 Bit RGBA, ohne Interlace (so schreibt es der Erzeuger). */
function pngLesen(datei: string): { breite: number; hoehe: number; pixel: Buffer } {
  const d = readFileSync(datei);
  expect(d.subarray(1, 4).toString('latin1')).toBe('PNG');
  const breite = d.readUInt32BE(16);
  const hoehe = d.readUInt32BE(20);
  expect([d[24], d[25], d[28]]).toEqual([8, 6, 0]); // 8 Bit, RGBA, kein Interlace
  const idat: Buffer[] = [];
  for (let i = 8; i < d.length;) {
    const laenge = d.readUInt32BE(i);
    if (d.toString('latin1', i + 4, i + 8) === 'IDAT') idat.push(d.subarray(i + 8, i + 8 + laenge));
    i += 12 + laenge;
  }
  const roh = inflateSync(Buffer.concat(idat));
  const zeile = breite * 4;
  const pixel = Buffer.alloc(zeile * hoehe);
  for (let y = 0; y < hoehe; y++) {
    const filter = roh[y * (zeile + 1)];
    for (let x = 0; x < zeile; x++) {
      const w = roh[y * (zeile + 1) + 1 + x];
      const a = x >= 4 ? pixel[y * zeile + x - 4] : 0;
      const b = y > 0 ? pixel[(y - 1) * zeile + x] : 0;
      const c = x >= 4 && y > 0 ? pixel[(y - 1) * zeile + x - 4] : 0;
      const p = a + b - c;
      const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
      const paeth = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      const vor = [0, a, b, (a + b) >> 1, paeth][filter];
      pixel[y * zeile + x] = (w + vor) & 0xff;
    }
  }
  return { breite, hoehe, pixel };
}

/** Farbe aus einer values-Datei. */
const farbe = (ordner: string) => {
  const doc = xml(join(RES, ordner, 'benachrichtigung.xml'));
  return [...doc.getElementsByTagName('color')].find((c) => c.getAttribute('name') === 'benachrichtigung_farbe')?.textContent?.trim();
};

/** Kontrast nach WCAG. */
const kontrast = (a: string, b: string) => {
  const l = (h: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
      .map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [l(a), l(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

const DICHTEN: Array<[string, number]> = [['mdpi', 1], ['hdpi', 1.5], ['xhdpi', 2], ['xxhdpi', 3], ['xxxhdpi', 4]];

describe('Android: Mitteilungssymbol', () => {
  it('das Manifest nennt Symbol und Farbe für FCM', () => {
    expect(manifest.getElementsByTagName('parsererror').length).toBe(0);
    expect(metaDaten('com.google.firebase.messaging.default_notification_icon')).toBe('@drawable/ic_stat_konfi');
    expect(metaDaten('com.google.firebase.messaging.default_notification_color')).toBe('@color/benachrichtigung_farbe');
  });

  it.each(DICHTEN)('drawable-%s: 24 dp, weiß auf durchsichtig, Motiv mit 2 dp Rand', (dichte, faktor) => {
    const datei = join(RES, `drawable-${dichte}`, 'ic_stat_konfi.png');
    expect(existsSync(datei)).toBe(true);
    const { breite, hoehe, pixel } = pngLesen(datei);
    expect([breite, hoehe]).toEqual([24 * faktor, 24 * faktor]);
    const rand = 2 * faktor;
    let deckend = 0;
    for (let y = 0; y < hoehe; y++) {
      for (let x = 0; x < breite; x++) {
        const i = (y * breite + x) * 4;
        const alpha = pixel[i + 3];
        if (alpha === 0) continue;
        // Android liest nur die Deckkraft; die Farbe ist trotzdem weiß, damit
        // das Symbol auch dort stimmt, wo es ungefärbt erscheint.
        expect([pixel[i], pixel[i + 1], pixel[i + 2]]).toEqual([255, 255, 255]);
        expect(x >= rand && x < breite - rand && y >= rand && y < hoehe - rand).toBe(true);
        if (alpha > 128) deckend++;
      }
    }
    // Ein Motiv, kein leeres und kein volles Quadrat (das war der Fehler).
    const anteil = deckend / (breite * hoehe);
    expect(anteil).toBeGreaterThan(0.15);
    expect(anteil).toBeLessThan(0.6);
  });

  it('das Motiv hat Löcher: Die Mitte des Herzens ist durchsichtig', () => {
    const { breite, pixel } = pngLesen(join(RES, 'drawable-xxxhdpi', 'ic_stat_konfi.png'));
    // Zwischen Rosenrand und Herz (links der Mitte) und die Rosenfläche
    // außerhalb des Herzens sind frei — ein Umriss, keine Scheibe.
    const alphaBei = (x: number, y: number) => pixel[(y * breite + x) * 4 + 3];
    expect(alphaBei(48, 48)).toBe(0);
    expect(alphaBei(25, 48)).toBe(0);
  });

  it('die Akzentfarbe ist im Hell- und im Dunkelmodus lesbar', () => {
    const hell = farbe('values');
    const dunkel = farbe('values-night');
    expect(hell).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(dunkel).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(kontrast(hell!, '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
    expect(kontrast(dunkel!, '#202124')).toBeGreaterThanOrEqual(4.5);
  });

  it('der Server setzt kein icon — alte App-Fassungen ohne das Symbol bleiben unberührt', () => {
    // Ein icon im android-Block zeigte bei Store-Apps ohne ic_stat_konfi ins
    // Leere; eine color überschriebe die Hell/Dunkel-Farbe der App.
    const server = readFileSync(join(process.cwd(), '../backend/push/firebase.js'), 'utf8');
    expect(server).not.toMatch(/\bicon\s*:/);
    expect(server).not.toMatch(/\bcolor\s*:/);
  });
});
