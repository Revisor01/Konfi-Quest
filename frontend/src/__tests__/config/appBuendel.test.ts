import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import capacitorConfig from '../../../capacitor.config';
import {
  APP_BUDGET_BYTES,
  APP_DATEIEN_AUS_PUBLIC,
  APP_VERZEICHNIS,
  alleDateien,
  appBuendelErzeugen,
  appBuendelPlugin,
  appBuendelPruefen,
  appDateien,
  istAppDateiAusPublic,
  istNurWeb,
} from '../../../scripts/app-buendel.mjs';

/**
 * Das App-Bündel (29.09.2026, Toolchain-Audit BF-02).
 *
 * Bis hierher nahm `cap sync` das ganze Web-Verzeichnis dist/ in die Apps:
 * 45.707.476 Bytes, davon 34.607.641 Handbuch und API-Referenz, dazu
 * Werbeseite und Rechtstexte — nichts davon zeigt die App an. Jetzt nimmt
 * Capacitor dist-app/, das der Build mit einer Positivliste daneben anlegt
 * (scripts/app-buendel.mjs). Gemessen nach der Umstellung: 9.448.148 Bytes,
 * nach dem Aufräumen der Bilder (unten) 9.228.301.
 *
 * Geprüft wird hier, dass
 *  - Capacitor wirklich dist-app/ nimmt und der Build es wirklich anlegt,
 *  - jede Datei aus public/, die der App-Quelltext lädt, mitkommt,
 *  - Handbuch, API-Referenz, Webseiten und Web-Bilder draußen bleiben,
 *  - die Prüfung selbst anschlägt (Web-Datei, Rückfall auf dist/, Grenze).
 */

const FRONTEND = process.cwd();
const PUBLIC = join(FRONTEND, 'public');

/** Alle Quelldateien der App (ohne Tests). */
function quelldateien(): string[] {
  const liste: string[] = [];
  const lauf = (ordner: string) => {
    for (const e of readdirSync(ordner, { withFileTypes: true })) {
      const voll = join(ordner, e.name);
      if (e.isDirectory()) {
        if (e.name === '__tests__' || e.name === '__mocks__') continue;
        lauf(voll);
      } else if (/\.(tsx?|css)$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) {
        liste.push(voll);
      }
    }
  };
  lauf(join(FRONTEND, 'src'));
  return liste;
}

/**
 * Pfade auf public/-Dateien, die der App-Quelltext wörtlich nennt:
 * "/assets/…" oder eine Datei mit Endung direkt unter "/".
 */
function geladenePublicPfade(): Map<string, string> {
  const muster = /["'`(]\/((?:assets\/[A-Za-z0-9._/-]+)|(?:[A-Za-z0-9._-]+\.(?:png|webp|jpe?g|svg|ico|json|html|txt|xml)))["'`)]/g;
  const gefunden = new Map<string, string>();
  for (const datei of quelldateien()) {
    const text = readFileSync(datei, 'utf8');
    for (const m of text.matchAll(muster)) {
      if (!gefunden.has(m[1])) gefunden.set(m[1], datei.slice(FRONTEND.length + 1));
    }
  }
  // Die Hülle: was index.html aus public/ einbindet.
  const html = readFileSync(join(FRONTEND, 'index.html'), 'utf8');
  for (const m of html.matchAll(/(?:href|src)="\/([^"]+)"/g)) {
    if (existsSync(join(PUBLIC, m[1]))) gefunden.set(m[1], 'index.html');
  }
  return gefunden;
}

describe('App-Bündel: Capacitor und Build greifen ineinander', () => {
  it('Capacitor nimmt dist-app/, nicht das Web-Verzeichnis dist/', () => {
    expect(APP_VERZEICHNIS).toBe('dist-app');
    expect(capacitorConfig.webDir).toBe(APP_VERZEICHNIS);
  });

  it('der Produktions-Build legt es an (Vite-Plugin eingetragen, nur beim Bauen)', () => {
    // vite.config.ts laesst sich unter jsdom nicht importieren (import.meta.url
    // ist dort keine file:-Adresse) -- deshalb der Blick in die Datei. Dass
    // das Plugin tut, was es soll, pruefen die Faelle unten am Verhalten.
    const vite = readFileSync(join(FRONTEND, 'vite.config.ts'), 'utf8');
    expect(vite).toMatch(/^import \{ appBuendelPlugin \} from '\.\/scripts\/app-buendel\.mjs'$/m);
    const plugins = vite.match(/plugins:\s*\[([\s\S]*?)\n\s*\],/)?.[1] ?? '';
    expect(plugins.split('\n').filter((z) => !z.trim().startsWith('//')).join('\n')).toMatch(/\bappBuendelPlugin\(\)/);
    const plugin = appBuendelPlugin();
    expect(plugin.name).toBe('konfi-app-buendel');
    expect(plugin.apply).toBe('build');
  });

  it('dist-app/ ist nicht versioniert, nicht im Docker-Kontext und nicht im Lint', () => {
    expect(readFileSync(join(FRONTEND, '.gitignore'), 'utf8')).toMatch(/^\/dist-app$/m);
    expect(readFileSync(join(FRONTEND, '.dockerignore'), 'utf8')).toMatch(/^dist-app$/m);
    expect(readFileSync(join(FRONTEND, 'eslint.config.js'), 'utf8')).toContain("'dist-app'");
  });
});

describe('App-Bündel: was hinein muss', () => {
  const geladen = geladenePublicPfade();

  it('der Quelltext lädt die erwarteten Dateien aus public/ (Suche greift)', () => {
    // Ohne diese Stichprobe wäre eine kaputte Suche (0 Treffer) grün.
    expect([...geladen.keys()]).toEqual(expect.arrayContaining([
      'assets/icon/logo-mark.png',
      'assets/icon/icon-192x192.png',
      'assets/branding/bird.png',
      'assets/wrapped/nordsee.webp',
      'manifest.json',
      'apple-touch-icon.png',
    ]));
  });

  it('umgekehrt: jede Datei der Positivliste lädt die App auch (kein totes Gewicht)', () => {
    const ungenutzt = alleDateien(PUBLIC).filter((p) => istAppDateiAusPublic(p) && !geladen.has(p));
    expect(ungenutzt).toEqual([]);
  });

  it('jede Datei, die die App aus public/ lädt, liegt dort und kommt ins Bündel', () => {
    const fehlt = [...geladen].filter(([pfad]) => !existsSync(join(PUBLIC, pfad))).map(([p, q]) => `${p} (${q})`);
    const draussen = [...geladen].filter(([pfad]) => !istAppDateiAusPublic(pfad)).map(([p, q]) => `${p} (${q})`);
    expect(fehlt).toEqual([]);
    expect(draussen).toEqual([]);
  });

  it('jeder Eintrag der Positivliste existiert in public/', () => {
    const vorhanden = new Set(alleDateien(PUBLIC));
    const tot = APP_DATEIEN_AUS_PUBLIC.filter((e) =>
      e.endsWith('/') ? ![...vorhanden].some((p) => p.startsWith(e)) : !vorhanden.has(e));
    expect(tot).toEqual([]);
  });
});

describe('App-Bündel: was draußen bleibt', () => {
  it('die Positivliste nennt nichts, was nur ins Web gehört', () => {
    expect(APP_DATEIEN_AUS_PUBLIC.filter((e) => istNurWeb(e) || istNurWeb(e.replace(/\/$/, '')))).toEqual([]);
  });

  it.each([
    'docs/index.html',
    'docs/bilder/iphone/konfi-startseite.png',
    'docs/api/swagger/swagger-ui-bundle.js',
    'landing.html',
    'datenschutz.html',
    'impressum.html',
    'konto-loeschen.html',
    'hero-ios-1.webp',
    'og-image.png',
    'sitemap.xml',
    'robots.txt',
    '.well-known/assetlinks.json',
    'assets/icon/icon-512x512.png',
    'assets/icon/logo-mark-512.png',
    'assets/branding/simon-luthe.webp',
  ])('%s kommt nicht ins App-Bündel', (pfad) => {
    expect(istAppDateiAusPublic(pfad)).toBe(false);
  });
});

describe('App-Bündel: Anlegen und Prüfen', () => {
  let wurzel: string;
  const schreibe = (basis: string, pfad: string, bytes = 10) => {
    mkdirSync(dirname(join(basis, pfad)), { recursive: true });
    writeFileSync(join(basis, pfad), Buffer.alloc(bytes, 1));
  };

  beforeEach(() => {
    wurzel = mkdtempSync(join(tmpdir(), 'app-buendel-'));
    // public/ wie im Repo, jede Datei als Platzhalter; dist/ = public/ plus
    // was Vite erzeugt.
    for (const pfad of alleDateien(PUBLIC)) {
      schreibe(join(wurzel, 'public'), pfad);
      schreibe(join(wurzel, 'dist'), pfad);
    }
    schreibe(join(wurzel, 'dist'), 'index.html');
    schreibe(join(wurzel, 'dist'), 'assets/index-AbC123.js');
    schreibe(join(wurzel, 'dist'), 'assets/index-AbC123.css');
    schreibe(join(wurzel, 'dist'), 'assets/openjpeg-XyZ.wasm');
  });
  afterEach(() => rmSync(wurzel, { recursive: true, force: true }));

  it('nimmt Vite-Erzeugnisse und die freigegebenen public/-Dateien, sonst nichts', () => {
    const dateien = appDateien(join(wurzel, 'dist'), join(wurzel, 'public'));
    expect(dateien).toEqual(expect.arrayContaining([
      'index.html',
      'assets/index-AbC123.js',
      'assets/index-AbC123.css',
      'assets/openjpeg-XyZ.wasm',
      'assets/icon/logo-mark.png',
      'assets/wrapped/nordsee.webp',
    ]));
    expect(dateien.filter((p) => p.startsWith('docs/'))).toEqual([]);
    expect(dateien.filter((p) => p.endsWith('.html') && p !== 'index.html')).toEqual([]);
    expect(dateien.filter((p) => existsSync(join(PUBLIC, p)) && !istAppDateiAusPublic(p))).toEqual([]);
  });

  it('legt dist-app/ neben dist/ an und räumt einen alten Stand vorher ab', () => {
    schreibe(join(wurzel, 'dist-app'), 'docs/alt.png');
    const { ziel, bytes } = appBuendelErzeugen(join(wurzel, 'dist'), join(wurzel, 'public'));
    expect(ziel).toBe(join(wurzel, 'dist-app'));
    expect(existsSync(join(ziel, 'index.html'))).toBe(true);
    expect(existsSync(join(ziel, 'docs'))).toBe(false);
    expect(existsSync(join(ziel, 'landing.html'))).toBe(false);
    const summe = alleDateien(ziel).reduce((s, p) => s + statSync(join(ziel, p)).size, 0);
    expect(bytes).toBe(summe);
  });

  it('ein sauberes Bündel hat keinen Befund', () => {
    const { ziel } = appBuendelErzeugen(join(wurzel, 'dist'), join(wurzel, 'public'));
    expect(appBuendelPruefen(ziel, { publicVerzeichnis: join(wurzel, 'public') })).toEqual([]);
  });

  it('Rückfall auf dist/ (webDir: dist) fällt auf: Handbuch, Webseiten, Web-Bilder', () => {
    const fehler = appBuendelPruefen(join(wurzel, 'dist'), { publicVerzeichnis: join(wurzel, 'public') });
    expect(fehler).toEqual(expect.arrayContaining([
      'docs/index.html: gehört nur ins Web, nicht in die App',
      'landing.html: gehört nur ins Web, nicht in die App',
      'og-image.png: Web-Datei aus public/, steht nicht auf der Liste der App-Dateien',
    ]));
  });

  it('das Handbuch bleibt draußen, auch ohne Abgleich mit public/', () => {
    const { ziel } = appBuendelErzeugen(join(wurzel, 'dist'), join(wurzel, 'public'));
    schreibe(ziel, 'docs/bilder/iphone/x.png');
    expect(appBuendelPruefen(ziel)).toEqual(['docs/bilder/iphone/x.png: gehört nur ins Web, nicht in die App']);
  });

  it('über der Grenze ist ein Befund, und der Build bricht ab', () => {
    const { ziel, bytes } = appBuendelErzeugen(join(wurzel, 'dist'), join(wurzel, 'public'));
    expect(appBuendelPruefen(ziel, { budget: bytes - 1 })).toEqual([
      `App-Bündel ist ${bytes} Bytes groß, erlaubt sind ${bytes - 1} (APP_BUDGET_BYTES in scripts/app-buendel.mjs)`,
    ]);
    // Eine Datei über der echten Grenze: appBuendelErzeugen wirft.
    schreibe(join(wurzel, 'dist'), 'assets/riesig-000.js', APP_BUDGET_BYTES + 1);
    expect(() => appBuendelErzeugen(join(wurzel, 'dist'), join(wurzel, 'public'))).toThrow(/erlaubt sind 11000000/);
  });

  it('ohne index.html ist es kein App-Bündel', () => {
    mkdirSync(join(wurzel, 'leer'));
    expect(appBuendelPruefen(join(wurzel, 'leer'))[0]).toMatch(/index\.html fehlt/);
  });
});

/**
 * Bilder aus public/ (29.09.2026, Paket App-Größe, Punkt 3). Gefunden:
 * `assets/icon/logo-mark-white.png` war byte-gleich mit `logo-mark.png` —
 * trotz des Namens nicht weißer, die Rose ist in beiden weiß — und lag als
 * zweite Kopie (99.936 Bytes) in jeder App; `assets/icon/icon.png` war eine
 * Kopie von `icon-512x512.png` (460.159 Bytes) und `assets/icon/favicon.png`
 * eine von `/favicon.png`, beide von nichts geladen.
 */
describe('Bilder aus public/: keine Kopien, nichts Verwaistes', () => {
  const bilder = alleDateien(PUBLIC).filter((p) => !p.startsWith('docs/') && /\.(png|webp|jpe?g|svg|ico)$/.test(p));

  /** Wo ein Bild aus public/ genannt sein darf, damit es als benutzt gilt. */
  const verweisTexte = (() => {
    const texte: string[] = quelldateien().map((d) => readFileSync(d, 'utf8'));
    texte.push(readFileSync(join(FRONTEND, 'index.html'), 'utf8'));
    for (const p of alleDateien(PUBLIC)) {
      if (/\.(html|json|xml|txt)$/.test(p)) texte.push(readFileSync(join(PUBLIC, p), 'utf8'));
    }
    // Die Mails des Servers binden das App-Symbol per Adresse ein.
    texte.push(readFileSync(join(FRONTEND, '../backend/services/emailService.js'), 'utf8'));
    return texte.join('\n');
  })();

  it('findet die Bilder (Suche greift)', () => {
    expect(bilder).toEqual(expect.arrayContaining(['assets/icon/logo-mark.png', 'hero-ios-1.webp', 'og-image.png']));
  });

  it('keine zwei Dateien der App sind byte-gleich', () => {
    const hash = (p: string) => createHash('sha256').update(readFileSync(join(PUBLIC, p))).digest('hex');
    const nachHash = new Map<string, string[]>();
    for (const p of alleDateien(PUBLIC).filter(istAppDateiAusPublic)) {
      nachHash.set(hash(p), [...(nachHash.get(hash(p)) ?? []), p]);
    }
    expect([...nachHash.values()].filter((l) => l.length > 1)).toEqual([]);
  });

  it('jedes Bild in public/ wird von App, Webseiten, Manifest oder Server-Mails benutzt', () => {
    const verwaist = bilder.filter((p) => !verweisTexte.includes(`/${p}`) && !verweisTexte.includes(`"${p}"`));
    expect(verwaist).toEqual([]);
  });
});
