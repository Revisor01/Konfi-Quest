// App-Symbol auf Android (adaptive icon).
//
// Simon, 29.09.2026, interner Testbuild 2.3.0: "das Icon wird auf Android
// scheiße beschnitten".
//
// URSACHE (gemessen an den Dateien): Der Vordergrund war das iOS-Symbol samt
// dunklem Grund, einfach auf 108 dp verkleinert. Das Motiv reichte damit bis
// 42,5 dp vom Mittelpunkt. Android zeigt vom 108-dp-Vordergrund aber nur die
// mittleren 72 dp und schneidet die mit der Maske des Launchers zu (Kreis,
// Squircle, Tropfen ...). Sicher sichtbar ist nur der Kreis mit 66 dp
// Durchmesser (Radius 33 dp) -- alles darueber hinaus schneidet der Launcher
// je nach Form ab. Die Bluetenblaetter lagen 9,5 dp darueber.
//
// Dazu stand der Hintergrund auf Weiss. Solange der Vordergrund deckend war,
// fiel das nicht auf; beim Verschieben der Ebenen (Parallaxe, Startanimation)
// blitzte er am Rand durch.
//
// Diese Tests lesen die PNGs selbst und pruefen die Geometrie. Ein
// Screenshot-Vergleich braeuchte ein Android-SDK, das es hier nicht gibt.
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { inflateSync } from 'zlib';

const RES = join(process.cwd(), 'android/app/src/main/res');
const IOS_SYMBOL = join(process.cwd(), 'ios/App/App/Assets.xcassets/AppIcon.appiconset/kq.png');

const DICHTEN: Record<string, number> = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

/** Die sichere Zone des adaptive icon: Kreis mit 66 dp Durchmesser auf 108 dp. */
const SICHERER_RADIUS_DP = 33;
/** Sichtbarer Ausschnitt: die mittleren 72 dp. */
const SICHTBAR_DP = 72;

interface Bild {
  breite: number;
  hoehe: number;
  /** RGBA, 8 bit je Kanal, zeilenweise. */
  pixel: Uint8Array;
}

/**
 * Minimaler PNG-Leser (8 bit, RGB oder RGBA, ohne Interlacing) -- genau das,
 * was die Icons im Repo sind. Bewusst ohne Zusatzpaket: pngjs liegt nur als
 * Abhaengigkeit einer Abhaengigkeit in node_modules.
 */
const lesePng = (pfad: string): Bild => {
  const daten = readFileSync(pfad);
  expect(daten.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
  let pos = 8;
  let breite = 0;
  let hoehe = 0;
  let farbtyp = 0;
  const idat: Buffer[] = [];
  while (pos < daten.length) {
    const laenge = daten.readUInt32BE(pos);
    const typ = daten.subarray(pos + 4, pos + 8).toString('ascii');
    const inhalt = daten.subarray(pos + 8, pos + 8 + laenge);
    if (typ === 'IHDR') {
      breite = inhalt.readUInt32BE(0);
      hoehe = inhalt.readUInt32BE(4);
      expect(inhalt[8], `${pfad}: Bittiefe`).toBe(8);
      farbtyp = inhalt[9];
      expect([2, 6], `${pfad}: Farbtyp`).toContain(farbtyp);
      expect(inhalt[12], `${pfad}: Interlacing`).toBe(0);
    } else if (typ === 'IDAT') {
      idat.push(inhalt);
    }
    pos += 12 + laenge;
  }
  const kanaele = farbtyp === 6 ? 4 : 3;
  const roh = inflateSync(Buffer.concat(idat));
  const zeile = breite * kanaele;
  const aus = new Uint8Array(breite * hoehe * kanaele);
  for (let y = 0; y < hoehe; y++) {
    const filter = roh[y * (zeile + 1)];
    for (let x = 0; x < zeile; x++) {
      const r = roh[y * (zeile + 1) + 1 + x];
      const a = x >= kanaele ? aus[y * zeile + x - kanaele] : 0;
      const b = y > 0 ? aus[(y - 1) * zeile + x] : 0;
      const c = x >= kanaele && y > 0 ? aus[(y - 1) * zeile + x - kanaele] : 0;
      let wert: number;
      if (filter === 0) wert = r;
      else if (filter === 1) wert = r + a;
      else if (filter === 2) wert = r + b;
      else if (filter === 3) wert = r + ((a + b) >> 1);
      else {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        wert = r + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
      }
      aus[y * zeile + x] = wert & 0xff;
    }
  }
  if (kanaele === 4) return { breite, hoehe, pixel: aus };
  const rgba = new Uint8Array(breite * hoehe * 4);
  for (let i = 0; i < breite * hoehe; i++) {
    rgba.set(aus.subarray(i * 3, i * 3 + 3), i * 4);
    rgba[i * 4 + 3] = 255;
  }
  return { breite, hoehe, pixel: rgba };
};

/** Groesster Abstand eines sichtbaren Pixels (Alpha > 0) vom Mittelpunkt, in Pixeln. */
const motivRadius = (bild: Bild): number => {
  const mx = bild.breite / 2;
  const my = bild.hoehe / 2;
  let max = 0;
  for (let y = 0; y < bild.hoehe; y++) {
    for (let x = 0; x < bild.breite; x++) {
      if (bild.pixel[(y * bild.breite + x) * 4 + 3] === 0) continue;
      // Entfernteste Ecke des Pixels, nicht seine Mitte
      const dx = Math.max(Math.abs(x - mx), Math.abs(x + 1 - mx));
      const dy = Math.max(Math.abs(y - my), Math.abs(y + 1 - my));
      max = Math.max(max, Math.hypot(dx, dy));
    }
  }
  return max;
};

const xml = (pfad: string): Document => {
  const dom = new DOMParser().parseFromString(readFileSync(pfad, 'utf8'), 'application/xml');
  expect(dom.getElementsByTagName('parsererror'), pfad).toHaveLength(0);
  return dom;
};

const ANDROID_NS = 'http://schemas.android.com/apk/res/android';

describe('Android-App-Symbol: adaptive icon verweist nur auf vorhandene Ressourcen', () => {
  for (const datei of ['ic_launcher.xml', 'ic_launcher_round.xml']) {
    it(`${datei}: Hintergrund, Vordergrund und Monochrom-Ebene`, () => {
      const dom = xml(join(RES, 'mipmap-anydpi-v26', datei));
      const wurzel = dom.documentElement;
      expect(wurzel.tagName).toBe('adaptive-icon');
      const ebene = (name: string) =>
        wurzel.getElementsByTagName(name)[0]?.getAttributeNS(ANDROID_NS, 'drawable');
      expect(ebene('background')).toBe('@color/ic_launcher_background');
      expect(ebene('foreground')).toBe('@mipmap/ic_launcher_foreground');
      // Android 13+: Themen-Symbole. Ohne diese Ebene zeigt das System bei
      // eingeschalteten Themen-Symbolen das bunte Symbol zwischen lauter
      // einfarbigen.
      expect(ebene('monochrome')).toBe('@mipmap/ic_launcher_monochrome');
    });
  }

  it('jede Dichte hat Vordergrund und Monochrom-Ebene', () => {
    for (const dichte of Object.keys(DICHTEN)) {
      for (const name of ['ic_launcher_foreground', 'ic_launcher_monochrome']) {
        expect(existsSync(join(RES, `mipmap-${dichte}`, `${name}.png`)), `${dichte}/${name}`).toBe(true);
      }
    }
  });

  it('die Hintergrundfarbe ist genau einmal definiert', () => {
    const dom = xml(join(RES, 'values/ic_launcher_background.xml'));
    const farben = [...dom.getElementsByTagName('color')].filter(
      (f) => f.getAttribute('name') === 'ic_launcher_background',
    );
    expect(farben).toHaveLength(1);
    expect(farben[0].textContent?.trim()).toMatch(/^#[0-9A-F]{6}$/);
  });
});

describe('Android-App-Symbol: das Motiv liegt in der sicheren Zone', () => {
  for (const [dichte, faktor] of Object.entries(DICHTEN)) {
    it(`Vordergrund ${dichte}: 108 dp gross, Motiv innerhalb des 66-dp-Kreises`, () => {
      const bild = lesePng(join(RES, `mipmap-${dichte}`, 'ic_launcher_foreground.png'));
      const kante = Math.round(108 * faktor);
      expect(bild.breite).toBe(kante);
      expect(bild.hoehe).toBe(kante);
      // Die Ecke oben links muss durchsichtig sein -- dort gehoert nur der
      // Hintergrund hin. Deckend war sie, solange das iOS-Symbol mit Grund
      // als Vordergrund diente.
      expect(bild.pixel[3]).toBe(0);
      expect(motivRadius(bild) / faktor).toBeLessThanOrEqual(SICHERER_RADIUS_DP);
    });

    it(`Monochrom ${dichte}: gleiche Groesse, ebenfalls in der sicheren Zone`, () => {
      const bild = lesePng(join(RES, `mipmap-${dichte}`, 'ic_launcher_monochrome.png'));
      const kante = Math.round(108 * faktor);
      expect(bild.breite).toBe(kante);
      expect(motivRadius(bild) / faktor).toBeLessThanOrEqual(SICHERER_RADIUS_DP);
    });
  }

  it('das Motiv fuellt die sichtbare Flaeche wie auf iOS die Kachel (nicht zu klein geraten)', () => {
    // Auf iOS reicht das Motiv bis 79 % der halben Kachelbreite. Auf Android
    // soll es im sichtbaren Ausschnitt (72 dp) aehnlich gross wirken, also
    // nicht aus Vorsicht zur Briefmarke schrumpfen.
    const ios = lesePng(IOS_SYMBOL);
    const grund = [...ios.pixel.subarray(0, 3)];
    let iosMax = 0;
    for (let y = 0; y < ios.hoehe; y++) {
      for (let x = 0; x < ios.breite; x++) {
        const i = (y * ios.breite + x) * 4;
        const abstand = Math.hypot(ios.pixel[i] - grund[0], ios.pixel[i + 1] - grund[1], ios.pixel[i + 2] - grund[2]);
        if (abstand > 60) iosMax = Math.max(iosMax, Math.hypot(x + 0.5 - ios.breite / 2, y + 0.5 - ios.hoehe / 2));
      }
    }
    const iosAnteil = iosMax / (ios.breite / 2);
    const android = lesePng(join(RES, 'mipmap-xxxhdpi', 'ic_launcher_foreground.png'));
    const androidAnteil = motivRadius(android) / 4 / (SICHTBAR_DP / 2);
    expect(iosAnteil).toBeGreaterThan(0.75);
    expect(Math.abs(androidAnteil - iosAnteil)).toBeLessThan(0.05);
  });
});

describe('Android-App-Symbol: Hintergrund in der Grundfarbe des Symbols', () => {
  it('die Hintergrundfarbe entspricht dem Grund des iOS-Symbols', () => {
    // Weiss (#FFFFFF) stand hier aus der Capacitor-Vorlage. Mit durchsichtigem
    // Vordergrund waere das Symbol dann weiss mit hellblauer Bluete.
    const dom = xml(join(RES, 'values/ic_launcher_background.xml'));
    const hex = [...dom.getElementsByTagName('color')]
      .find((f) => f.getAttribute('name') === 'ic_launcher_background')!
      .textContent!.trim();
    const farbe = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    const ios = lesePng(IOS_SYMBOL);
    // Mittel ueber die vier Ecken (je 40 x 40 px): der Grund hat eine feine
    // Koernung von etwa +-1,5.
    const summe = [0, 0, 0];
    let anzahl = 0;
    for (const [ox, oy] of [[0, 0], [ios.breite - 40, 0], [0, ios.hoehe - 40], [ios.breite - 40, ios.hoehe - 40]]) {
      for (let y = oy; y < oy + 40; y++) {
        for (let x = ox; x < ox + 40; x++) {
          const i = (y * ios.breite + x) * 4;
          summe[0] += ios.pixel[i];
          summe[1] += ios.pixel[i + 1];
          summe[2] += ios.pixel[i + 2];
          anzahl++;
        }
      }
    }
    const grund = summe.map((s) => s / anzahl);
    for (let k = 0; k < 3; k++) {
      expect(Math.abs(farbe[k] - grund[k]), `Kanal ${k}: ${hex} gegen ${grund.map(Math.round)}`).toBeLessThanOrEqual(2);
    }
  });
});

describe('Android-App-Symbol: Legacy-Symbole (Android 7)', () => {
  for (const [dichte, faktor] of Object.entries(DICHTEN)) {
    it(`rundes Symbol ${dichte} ist rund (Ecken durchsichtig)`, () => {
      // android:roundIcon zieht auf Android 7.1 dieses PNG. Es war quadratisch.
      const bild = lesePng(join(RES, `mipmap-${dichte}`, 'ic_launcher_round.png'));
      const kante = Math.round(48 * faktor);
      expect(bild.breite).toBe(kante);
      expect(bild.hoehe).toBe(kante);
      const ecken = [0, kante - 1, (kante - 1) * kante, kante * kante - 1];
      for (const e of ecken) expect(bild.pixel[e * 4 + 3], `Ecke ${e}`).toBe(0);
      // Mitte deckend
      const mitte = (Math.floor(kante / 2) * kante + Math.floor(kante / 2)) * 4;
      expect(bild.pixel[mitte + 3]).toBe(255);
    });
  }
});
