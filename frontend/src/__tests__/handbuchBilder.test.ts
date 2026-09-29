// Handbuch: Bildschirmfotos (29.09.2026, Doku-Audit BF-18).
//
// Bis hierher spiegelte der Generator alle 42 PNGs aus docs/screenshots/
// nach public/docs/bilder/ (30.931.765 Bytes), obwohl das Handbuch nur 15
// davon zeigt; die Play-Bilder und sechs iPhone-Bilder dienen dem Store.
// Jetzt liegt dort genau, was ein Kapitel einbindet, als WebP (zusammen
// 1.397.014 Bytes) — Einzelheiten in scripts/build-handbuch.mjs
// (bilderBereitstellen).
//
// Geprüft wird das ERZEUGTE Ergebnis unter public/docs, also was
// ausgeliefert wird. Dass es zum Generator passt, prüft die CI getrennt
// (Generator laufen lassen, git diff muss leer sein).
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync, statSync } from 'fs';
import { createHash } from 'crypto';
import { join, resolve, relative, sep } from 'path';

const DOCS = resolve(process.cwd(), 'public/docs');
const BILDER = join(DOCS, 'bilder');
const QUELLEN = resolve(process.cwd(), '../docs/screenshots');
const summe = (daten: Buffer) => createHash('sha256').update(daten).digest('hex');

const alleDateien = (ordner: string): string[] =>
  readdirSync(ordner, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? alleDateien(join(ordner, e.name)) : [relative(BILDER, join(ordner, e.name)).split(sep).join('/')]);

/** Alle <img> unter /docs/bilder/ in den Handbuchseiten. */
const eingebunden = readdirSync(DOCS)
  .filter((d) => d.endsWith('.html'))
  .flatMap((seite) => [...readFileSync(join(DOCS, seite), 'utf8').matchAll(/<img src="(\/docs\/bilder\/[^"]+)"([^>]*)>/g)]
    .map((m) => ({ seite, src: m[1], rest: m[2] })));

/** Maße aus dem Kopf einer WebP-Datei (VP8, VP8L oder VP8X). */
function webpMasse(d: Buffer): { breite: number; hoehe: number } {
  expect(d.subarray(0, 4).toString('latin1')).toBe('RIFF');
  expect(d.subarray(8, 12).toString('latin1')).toBe('WEBP');
  const art = d.subarray(12, 16).toString('latin1');
  if (art === 'VP8 ') return { breite: d.readUInt16LE(26) & 0x3fff, hoehe: d.readUInt16LE(28) & 0x3fff };
  if (art === 'VP8X') return { breite: 1 + d.readUIntLE(24, 3), hoehe: 1 + d.readUIntLE(27, 3) };
  if (art === 'VP8L') {
    const b = d.readUInt32LE(21);
    return { breite: 1 + (b & 0x3fff), hoehe: 1 + ((b >> 14) & 0x3fff) };
  }
  throw new Error(`unbekannte WebP-Art ${art}`);
}

const pngMasse = (d: Buffer) => ({ breite: d.readUInt32BE(16), hoehe: d.readUInt32BE(20) });

describe('Handbuch-Bilder', () => {
  it('die Kapitel binden Bildschirmfotos ein (Suche greift)', () => {
    expect(eingebunden.length).toBe(15);
    expect(new Set(eingebunden.map((b) => b.seite))).toEqual(new Set(['konfis.html', 'teamer.html', 'leitung.html']));
  });

  it('jedes Bild ist WebP, liegt unter bilder/ und trägt seine Prüfsumme in der Adresse', () => {
    for (const { src } of eingebunden) {
      const m = src.match(/^\/docs\/bilder\/([a-z0-9-]+\/[a-z0-9-]+\.webp)\?v=([0-9a-f]{10})$/);
      expect(m, src).not.toBeNull();
      const datei = join(BILDER, m![1]);
      expect(existsSync(datei), src).toBe(true);
      expect(summe(readFileSync(datei)).slice(0, 10)).toBe(m![2]);
    }
  });

  it('Maße im HTML = Maße des WebP = Maße des Quell-PNG (volle Auflösung)', () => {
    for (const { src, rest } of eingebunden) {
      const name = src.replace(/^\/docs\/bilder\//, '').replace(/\.webp\?.*$/, '');
      const webp = webpMasse(readFileSync(join(BILDER, `${name}.webp`)));
      const png = pngMasse(readFileSync(join(QUELLEN, `${name}.png`)));
      expect(webp).toEqual(png);
      expect(rest).toContain(` width="${png.breite}" height="${png.hoehe}"`);
    }
  });

  it('unter bilder/ liegt genau, was eingebunden ist — keine PNGs, keine Store-Bilder', () => {
    const erwartet = [...new Set(eingebunden.map((b) => b.src.replace(/^\/docs\/bilder\//, '').replace(/\?.*$/, '')))];
    expect(alleDateien(BILDER).sort()).toEqual([...erwartet, 'stand.json'].sort());
  });

  it('stand.json passt zu den Quellen: kein Bild ist seit dem letzten Lauf geändert', () => {
    const stand = JSON.parse(readFileSync(join(BILDER, 'stand.json'), 'utf8'));
    expect(stand.qualitaet).toBe(0.85);
    const schluessel = Object.keys(stand.bilder).sort();
    expect(schluessel.length).toBe(15);
    for (const k of schluessel) {
      expect(stand.bilder[k].quelle, k).toBe(summe(readFileSync(join(QUELLEN, `${k}.png`))));
      expect(stand.bilder[k].webp, k).toBe(summe(readFileSync(join(BILDER, `${k}.webp`))));
    }
  });

  it('alle Handbuch-Bilder zusammen unter 2 MB (vorher 30,9 MB)', () => {
    const bytes = alleDateien(BILDER).reduce((s, p) => s + statSync(join(BILDER, p)).size, 0);
    expect(bytes).toBeLessThan(2_000_000);
  });
});
