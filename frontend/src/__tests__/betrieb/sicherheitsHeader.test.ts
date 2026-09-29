import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

// Sicherheits-Header der Web-Version (frontend/nginx.conf, 29.09.2026, Audit
// CI BF-14).
//
// nginx ersetzt in jeder location mit eigenem add_header ALLE Header des
// server-Blocks -- ein Header, der in einer location fehlt, fehlt dort ganz.
// Deshalb prueft der Test jede location einzeln.
//
// Die Content-Security-Policy der Web-App steht als Report-Only: Sie meldet
// Verstoesse, blockiert nichts. Lokal gegen das gebaute Image und ein
// Test-Backend in Chromium an 21 Stationen geprueft (Anmeldung, Reiter von
// Konfi, Org-Admin und Team, Chat mit Bild, PDF-Ansicht): 0 Meldungen, auch
// mit scharf geschalteter Policy. Zwei Luecken fand erst dieser Lauf:
// Ionicons laden ihre SVGs per fetch aus data:-Adressen, die PDF-Ansicht
// liest die Datei per fetch aus einer blob:-Adresse -- beides braucht
// connect-src.

const wurzel = resolve(__dirname, '../../../..');
const nginx = readFileSync(join(wurzel, 'frontend/nginx.conf'), 'utf-8');

/** location-Bloecke: Kopf und Rumpf. */
function locations(): Array<{ kopf: string; rumpf: string }> {
  return [...nginx.matchAll(/^ {4}location ([^{]+)\{([\s\S]*?)^ {4}\}/gm)].map((m) => ({ kopf: m[1].trim(), rumpf: m[2] }));
}

const cspApp = nginx.match(/set \$csp_app "([^"]+)";/)?.[1] ?? '';
const direktive = (name: string): string[] =>
  (cspApp.split(';').map((d) => d.trim()).find((d) => d.startsWith(`${name} `)) ?? '').split(/\s+/).slice(1);

// Dokumente, also alles, was HTML ausliefert. Nicht dazu: Assets (Regex auf
// Dateiendungen), robots.txt, sitemap.xml, apple-app-site-association.
const istDokument = (kopf: string) =>
  !kopf.startsWith('~*') && !['= /robots.txt', '= /sitemap.xml', '= /.well-known/apple-app-site-association'].includes(kopf);

describe('nginx: Sicherheits-Header in jeder Dokument-location', () => {
  const doks = locations().filter((l) => istDokument(l.kopf));

  it('die Dokument-locations werden gefunden', () => {
    expect(doks.map((l) => l.kopf)).toEqual([
      '= /', '= /datenschutz', '= /impressum', '= /konto-loeschen', '= /account-deletion',
      '~ ^/(landing|datenschutz|impressum|konto-loeschen)\\.html$', '/docs/', '/',
    ]);
  });

  it.each([
    'add_header X-Frame-Options "SAMEORIGIN" always;',
    'add_header X-Content-Type-Options "nosniff" always;',
    'add_header Referrer-Policy "strict-origin-when-cross-origin" always;',
    'add_header Permissions-Policy $permissions always;',
  ])('%s', (zeile) => {
    for (const l of doks) expect(l.rumpf, l.kopf).toContain(zeile);
  });

  it('X-XSS-Protection ist ueberall weg (alte Browser liessen sich darueber zu Fehlverhalten bringen)', () => {
    expect(nginx).not.toMatch(/add_header X-XSS-Protection/);
  });

  it('Permissions-Policy: Kamera und Mikrofon nur fuer die eigene Seite, Standort und Zahlung fuer niemanden', () => {
    expect(nginx).toContain('set $permissions "camera=(self), microphone=(self), geolocation=(), payment=(), usb=()";');
  });

  it('der Rueckfall auf server-Ebene traegt dieselben Header', () => {
    const serverEbene = nginx.slice(nginx.lastIndexOf('    # Security headers'));
    expect(serverEbene).toContain('add_header Referrer-Policy "strict-origin-when-cross-origin" always;');
    expect(serverEbene).toContain('add_header Permissions-Policy $permissions always;');
  });
});

describe('nginx: Content-Security-Policy der Web-App', () => {
  const app = locations().find((l) => l.kopf === '/')!;

  it('gilt fuer die Web-App (SPA-Rueckfall), vorerst als Report-Only', () => {
    expect(app.rumpf).toContain('add_header Content-Security-Policy-Report-Only $csp_app always;');
  });

  it('nicht fuer statische Seiten mit eigenen Inline-Skripten (Handbuch, Rechtstexte)', () => {
    for (const l of locations().filter((x) => x.kopf !== '/')) {
      expect(l.rumpf, l.kopf).not.toMatch(/Content-Security-Policy/);
    }
  });

  it('Skripte nur von der eigenen Adresse -- kein unsafe-inline, kein unsafe-eval', () => {
    expect(direktive('script-src')).toEqual(["'self'"]);
    expect(cspApp).not.toMatch(/'unsafe-eval'/);
  });

  it('keine Plugins, kein fremdes <base>, keine Einbettung in fremde Seiten', () => {
    expect(direktive('object-src')).toEqual(["'none'"]);
    expect(direktive('base-uri')).toEqual(["'self'"]);
    expect(direktive('frame-ancestors')).toEqual(["'self'"]);
  });

  it('API und Socket auch ueber die volle Adresse (so ruft der Store-Build sie auf)', () => {
    for (const q of ["'self'", 'https://konfi-quest.de', 'wss://konfi-quest.de']) expect(direktive('connect-src')).toContain(q);
  });

  it('data: und blob: fuer fetch -- Ionicons und die PDF-Ansicht (lokal gemessen)', () => {
    expect(direktive('connect-src')).toContain('data:');
    expect(direktive('connect-src')).toContain('blob:');
    expect(direktive('worker-src')).toContain('blob:');
    expect(direktive('frame-src')).toContain('blob:');
  });

  it('jede fremde Adresse, die die App laedt, steht in der passenden Direktive', () => {
    const index = readFileSync(join(wurzel, 'frontend/index.html'), 'utf-8');
    const variablen = readFileSync(join(wurzel, 'frontend/src/theme/variables.css'), 'utf-8');
    const analytics = readFileSync(join(wurzel, 'frontend/src/services/analytics.ts'), 'utf-8');
    const herkunft = (url: string) => new URL(url).origin;

    // Stylesheets aus index.html und @import in den Themes
    const stile = [
      ...[...index.matchAll(/<link[^>]+rel="stylesheet"[^>]+href="(https:[^"]+)"/g)].map((m) => m[1]),
      ...[...variablen.matchAll(/@import url\(['"]?(https:[^'")]+)/g)].map((m) => m[1]),
    ];
    expect(stile.length).toBeGreaterThan(0);
    for (const s of stile) expect(direktive('style-src'), s).toContain(herkunft(s));

    // Skripte von fremden Adressen gibt es in der App keine
    expect(index).not.toMatch(/<script[^>]+src="https?:/);

    // Nutzungsmessung
    const umami = analytics.match(/UMAMI_URL = '([^']+)'/)?.[1] ?? '';
    expect(direktive('connect-src')).toContain(herkunft(umami));
  });
});
