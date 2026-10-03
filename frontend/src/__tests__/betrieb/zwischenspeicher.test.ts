import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';

// Zwischenspeicher der Web-Version (frontend/nginx.conf, 03.10.2026, offene
// Befunde "Doku und Bilder ein Jahr im Zwischenspeicher").
//
// Bis dahin galt eine Regel fuer Dateiendungen (`location ~* \.(js|css|png|…)$`,
// ein Jahr, immutable) fuer ALLES mit diesen Endungen -- auch unter /docs/,
// denn in nginx gehen regulaere Ausdruecke einer Praefix-location vor. Lokal
// gegen den gebauten Stand gemessen: Swagger UI, Handbuch-Bilder, Bilder der
// Startseite, Symbole und Rueckblick-Bilder kamen mit `max-age=31536000` und
// `immutable`. Sie tragen keine Pruefsumme im Namen; nach einem Update sahen
// Nutzer:innen die alte Fassung.
//
// Der Test bildet die Auswahl der location nach, wie nginx sie trifft
// (https://nginx.org/en/docs/http/ngx_http_core_module.html#location):
//   1. `=` passt genau -> fertig;
//   2. sonst das laengste passende Praefix merken; traegt es `^~` -> fertig;
//   3. sonst die regulaeren Ausdruecke in Reihenfolge der Datei, der erste
//      Treffer gewinnt;
//   4. sonst das gemerkte Praefix.
// Gegengeprueft mit einem echten nginx 1.24 und curl gegen den Build vom
// 03.10.2026: fuer jeden Beispielpfad unten dieselbe location und derselbe
// Header.

const wurzel = resolve(__dirname, '../../../..');
const nginx = readFileSync(join(wurzel, 'frontend/nginx.conf'), 'utf-8');

type Art = '=' | '^~' | '~' | '~*' | '';
type Location = { kopf: string; art: Art; muster: string; rumpf: string };

/**
 * location-Bloecke mit Art und Muster. Ein Muster mit `{` oder `}` steht in
 * Anfuehrungszeichen (so verlangt es nginx); die Zeichen gehoeren nicht dazu.
 */
function locationsAus(text: string): Location[] {
  return [...text.matchAll(/^ {4}location ((?:"[^"]*"|[^{"])+)\{([\s\S]*?)^ {4}\}/gm)].map((m) => {
    const kopf = m[1].trim();
    const teile = kopf.match(/^(=|\^~|~\*|~)\s+(.+)$/);
    const muster = (teile ? teile[2] : kopf).replace(/^"(.*)"$/, '$1');
    return { kopf, art: (teile?.[1] ?? '') as Art, muster, rumpf: m[2] };
  });
}

/** Die location, die nginx fuer `pfad` waehlt. */
function greift(pfad: string, liste: Location[]): Location | undefined {
  const genau = liste.find((l) => l.art === '=' && l.muster === pfad);
  if (genau) return genau;
  const praefix = liste
    .filter((l) => (l.art === '' || l.art === '^~') && pfad.startsWith(l.muster))
    .sort((a, b) => b.muster.length - a.muster.length)[0];
  if (praefix?.art === '^~') return praefix;
  const regex = liste.find((l) => (l.art === '~' || l.art === '~*') && new RegExp(l.muster, l.art === '~*' ? 'i' : '').test(pfad));
  return regex ?? praefix;
}

const LOCATIONS = locationsAus(nginx);
const anweisungen = nginx.split('\n').filter((z) => !z.trim().startsWith('#')).join('\n');
const cacheControl = (l: Location | undefined) => l?.rumpf.match(/add_header Cache-Control "([^"]+)"/)?.[1];
const kopfFuer = (pfad: string) => greift(pfad, LOCATIONS)?.kopf;
const headerFuer = (pfad: string) => cacheControl(greift(pfad, LOCATIONS));

const EIN_JAHR = 'public, max-age=31536000, immutable';
const NACHFRAGEN = 'no-cache, must-revalidate';
const KURZ = 'public, max-age=3600';

// Dateinamen aus dem Build vom 03.10.2026 (dist/assets/): Vite haengt eine
// Pruefsumme aus 8 Zeichen an, auch mit Bindestrich oder Unterstrich darin.
const MIT_PRUEFSUMME = [
  '/assets/index--CYSk7Xa.js',
  '/assets/index-Bb4yusOC.css',
  '/assets/index-65Eftz2j-Dk5Rsk5C.js',
  '/assets/AdminActivitiesPage-C_8nsui6.js',
  '/assets/pdf.worker.min-CBxdLblL.js',
  '/assets/openjpeg-MeY6OQBn.wasm',
];

const OHNE_PRUEFSUMME = [
  // Handbuch, Handbuch-Bilder, API-Referenz mit Swagger UI
  '/docs/',
  '/docs/index.html',
  '/docs/handbuch.html',
  '/docs/bilder/x.webp',
  '/docs/bilder/iphone/konfi-chat.webp',
  '/docs/api/swagger-ui.css',
  '/docs/api/swagger/swagger-ui.css',
  '/docs/api/swagger/swagger-ui-bundle.js',
  // Bilder der Startseite und Symbole aus public/
  '/hero-and-1.webp',
  '/favicon.png',
  '/og-image.png',
  // public/assets/ in Unterordnern: kein Vite-Asset, gleicher Ordnername
  '/assets/icon/logo-mark-512.png',
  '/assets/branding/bird.png',
  '/assets/wrapped/kerze.webp',
  // HTML und Web-App
  '/',
  '/index.html',
  '/landing.html',
  '/konfi/events',
  '/manifest.json',
];

describe('nginx: ein Jahr nur fuer Dateien mit Pruefsumme im Namen', () => {
  it.each(MIT_PRUEFSUMME)('%s -> ein Jahr, immutable', (pfad) => {
    expect(headerFuer(pfad)).toBe(EIN_JAHR);
  });

  it.each(OHNE_PRUEFSUMME)('%s -> jedes Mal nachfragen, nicht immutable', (pfad) => {
    expect(headerFuer(pfad)).toBe(NACHFRAGEN);
  });

  it('alles unter /docs/ landet in der /docs/-location, kein regulaerer Ausdruck greift dort ein', () => {
    const docs = LOCATIONS.find((l) => l.muster === '/docs/');
    expect(docs?.art).toBe('^~');
    for (const pfad of OHNE_PRUEFSUMME.filter((p) => p.startsWith('/docs/'))) expect(kopfFuer(pfad), pfad).toBe('^~ /docs/');
  });

  it('HTML der Web-App kommt aus dem SPA-Rueckfall (mit CSP), nicht aus einer Asset-Regel', () => {
    expect(kopfFuer('/index.html')).toBe('/');
    expect(kopfFuer('/konfi/events')).toBe('/');
  });

  it('robots.txt, sitemap.xml und die Universal-Links-Datei bleiben eine Stunde', () => {
    for (const pfad of ['/robots.txt', '/sitemap.xml', '/.well-known/apple-app-site-association']) {
      expect(headerFuer(pfad), pfad).toBe(KURZ);
    }
  });

  it('assetlinks.json (Android-App-Links) kommt weiter aus dem SPA-Rueckfall, als Datei mit dem Typ aus mime.types', () => {
    const l = greift('/.well-known/assetlinks.json', LOCATIONS);
    expect(l?.kopf).toBe('/');
    expect(l?.rumpf).toContain('try_files $uri $uri/ /index.html;');
    expect(l?.rumpf).not.toMatch(/default_type|types\s*\{/);
  });

  it('kein expires -- es setzte einen zweiten Cache-Control-Header neben dem eigenen', () => {
    expect(anweisungen).not.toMatch(/\bexpires\s/);
  });

  it('ETag und Last-Modified bleiben an (nginx-Voreinstellung), sonst kann der Browser nicht billig nachfragen', () => {
    expect(anweisungen).not.toMatch(/\betag\s+off/);
    expect(anweisungen).not.toMatch(/\bif_modified_since\s+off/);
    expect(anweisungen).not.toMatch(/Last-Modified|ETag/i);
  });

  it('jede location setzt genau einen Cache-Control-Header, die server-Ebene keinen', () => {
    for (const l of LOCATIONS) expect(l.rumpf.match(/add_header Cache-Control/g)?.length ?? 0, l.kopf).toBe(1);
    const serverEbene = nginx.slice(nginx.lastIndexOf('    # Security headers'));
    expect(serverEbene).not.toContain('Cache-Control');
  });

  it('ein Muster mit geschweifter Klammer steht in Anfuehrungszeichen -- sonst bricht nginx beim Start ab', () => {
    // Lokal gemessen: ohne Anfuehrungszeichen meldet `nginx -t` fuer
    // `[A-Za-z0-9_-]{8}` "unknown directive 8}\.(js|…" und startet nicht.
    const koepfe = nginx.split('\n').filter((z) => /^\s*location\s/.test(z)).map((z) => z.trim().replace(/\s*\{$/, ''));
    expect(koepfe.length).toBe(LOCATIONS.length);
    for (const kopf of koepfe) {
      const muster = kopf.replace(/^location\s+(=|\^~|~\*|~)?\s*/, '');
      if (/[{}]/.test(muster)) expect(muster, kopf).toMatch(/^"[^"]+"$/);
    }
  });

  it('immutable gibt es genau an einer Stelle', () => {
    expect(LOCATIONS.filter((l) => cacheControl(l)?.includes('immutable')).map((l) => l.kopf)).toHaveLength(1);
  });
});

describe('Zwischenspeicher: was der Build wirklich ausliefert', () => {
  const PUBLIC = join(wurzel, 'frontend/public');
  const dateien = (ordner: string): string[] =>
    readdirSync(ordner).flatMap((name) => {
      const pfad = join(ordner, name);
      return statSync(pfad).isDirectory() ? dateien(pfad) : [pfad];
    });

  it('keine Datei aus public/ faellt unter die Regel fuer ein Jahr -- sie behalten ihren Namen ueber Updates hinweg', () => {
    const pfade = dateien(PUBLIC).map((p) => `/${relative(PUBLIC, p).split('\\').join('/')}`);
    expect(pfade.length).toBeGreaterThan(50);
    const ewig = pfade.filter((p) => headerFuer(p)?.includes('immutable'));
    expect(ewig).toEqual([]);
  });

  it('Vite benennt die Dateien nach seiner Voreinstellung (assets/<name>-<pruefsumme>), nichts ueberschreibt sie', () => {
    const vite = readFileSync(join(wurzel, 'frontend/vite.config.ts'), 'utf-8');
    expect(vite).not.toMatch(/\b(assetFileNames|chunkFileNames|entryFileNames|assetsDir|hashCharacters)\b/);
  });
});

describe('Gegenprobe: die nachgebildete Auswahl trifft, was nginx trifft', () => {
  const probe = locationsAus(
    [
      '    location = /a {\n    }',
      '    location /docs/ {\n    }',
      '    location ^~ /fest/ {\n    }',
      '    location ~* \\.(png)$ {\n    }',
      '    location ~ ^/x {\n    }',
      '    location / {\n    }',
    ].join('\n'),
  );
  const kopf = (pfad: string) => greift(pfad, probe)?.kopf;

  it('genaue Treffer gehen vor', () => expect(kopf('/a')).toBe('= /a'));
  it('ein regulaerer Ausdruck geht einem Praefix ohne ^~ vor -- das war der Fehler unter /docs/', () =>
    expect(kopf('/docs/bild.PNG')).toBe('~* \\.(png)$'));
  it('^~ haelt die regulaeren Ausdruecke fern', () => expect(kopf('/fest/bild.png')).toBe('^~ /fest/'));
  it('der erste passende regulaere Ausdruck gewinnt', () => expect(kopf('/x.png')).toBe('~* \\.(png)$'));
  it('ohne regulaeren Treffer das laengste Praefix', () => expect(kopf('/docs/seite.html')).toBe('/docs/'));
});
