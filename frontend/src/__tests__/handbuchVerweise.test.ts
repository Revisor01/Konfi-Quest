import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'fs';
import { join, relative } from 'path';
import { FRONTEND, REPO, quelldateien } from './sichtbareTexte';

// ---------------------------------------------------------------------------
// Jeder Verweis aufs Handbuch trifft einen Anker, den es gibt.
//
// Anker entstehen aus Überschriften (scripts/build-handbuch.mjs, slug): Aus
// „Einen Termin anlegen" wurde #einen-termin-anlegen, aus „Ein Event anlegen"
// wird #ein-event-anlegen. Ändert sich eine Überschrift, ändert sich der
// Anker — und jeder Verweis darauf führt ins Leere, ohne dass es jemand
// merkt: Der Browser landet oben auf der Seite statt beim Abschnitt.
//
// Der Generator bricht bei toten Verweisen innerhalb des Handbuchs ab. Das
// fällt aber erst auf, wenn ihn jemand laufen lässt, und Verweise von
// außerhalb (App, Webseite, Backend) prüft er gar nicht — die beginnen mit
// „/" und gelten ihm als fremd. Dieser Test prüft beides im normalen Lauf,
// und zwar gegen die ERZEUGTEN Seiten (frontend/public/docs/*.html): Steht
// eine Überschrift in der Quelle, der Generator lief aber nicht, fällt auch
// das hier auf.
//
// Anlass: Die Umstellung auf Events und Badges (27.09.2026) benannte 25
// Überschriften um; 17 Verweise im Handbuch mussten mit.
// ---------------------------------------------------------------------------

const HANDBUCH = join(REPO, 'docs/handbuch');
const ERZEUGT = join(FRONTEND, 'public/docs');

/** Seite, die der Generator aus einer Quelldatei macht: 70-termine.md -> termine.html. */
const seiteZu = (md: string) => `${md.replace(/^\d+-/, '').replace(/\.md$/, '')}.html`;

/** Alle id="…" einer erzeugten Seite. */
const ankerDerSeite = (html: string): Set<string> =>
  new Set([...readFileSync(join(ERZEUGT, html), 'utf8').matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));

/**
 * Anker so, wie der Generator sie aus Überschriften bildet (slug in
 * build-handbuch.mjs, samt Zählung bei doppeltem Text). Hier nachgebaut, weil
 * das Skript beim Import sofort schreibt — der Vergleich mit den erzeugten
 * Seiten unten stellt sicher, dass beide dasselbe ergeben.
 */
const slug = (text: string) => text.toLowerCase()
  .replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

const ankerDerQuelle = (md: string): string[] => {
  const vergeben = new Set<string>();
  const raus: string[] = [];
  for (const [, text] of readFileSync(join(HANDBUCH, md), 'utf8').matchAll(/^#{2,4}\s+(.*)$/gm)) {
    let id = slug(text);
    for (let n = 2; vergeben.has(id); n++) id = `${slug(text)}-${n}`;
    vergeben.add(id);
    raus.push(id);
  }
  return raus;
};

const KAPITEL = readdirSync(HANDBUCH).filter((d) => d.endsWith('.md')).sort();

/** Verweisziele im Markdown: [Text](ziel). Bilder (![…](…)) zählen nicht. */
const verweiseIm = (md: string) =>
  [...readFileSync(join(HANDBUCH, md), 'utf8').matchAll(/(?<!!)\[[^\]]+\]\(([^()\s]+)\)/g)].map((m) => m[1]);

/**
 * Handbuch-Verweise außerhalb des Handbuchs: /docs/termine.html#anker, auch
 * mit Domain davor. /docs/ allein (Übersicht) und /docs/api/ gehören nicht dazu.
 */
const HANDBUCH_LINK = /(?:https:\/\/konfi-quest\.de)?\/docs\/([a-z-]+\.html)(?:#([a-z0-9-]+))?/g;
const handbuchLinks = (text: string) => [...text.matchAll(HANDBUCH_LINK)].map((m) => ({ seite: m[1], anker: m[2] }));

describe('Handbuch-Anker: die erzeugten Seiten passen zur Quelle', () => {
  it('jedes Kapitel ist erzeugt', () => {
    expect(KAPITEL.length).toBe(14);
    const fehlt = KAPITEL.map(seiteZu).filter((html) => !existsSync(join(ERZEUGT, html)));
    expect(fehlt).toEqual([]);
  });

  it.each(KAPITEL)('%s: jede Überschrift hat ihren Anker in der erzeugten Seite', (md) => {
    // Fällt, wenn eine Überschrift geändert und der Generator nicht
    // gelaufen ist: npm --prefix frontend run docs:handbuch
    const vorhanden = ankerDerSeite(seiteZu(md));
    expect(ankerDerQuelle(md).filter((a) => !vorhanden.has(a))).toEqual([]);
  });
});

describe('Handbuch-Anker: jeder Verweis im Handbuch trifft', () => {
  it.each(KAPITEL)('%s', (md) => {
    const tot: string[] = [];
    for (const ziel of verweiseIm(md)) {
      if (/^(https?:|mailto:|\/)/.test(ziel)) continue;
      const m = ziel.match(/^(?:\.\/)?(\d+-[a-z0-9-]+\.md)?(?:#([a-z0-9-]+))?$/);
      if (!m) { tot.push(`${ziel} (unbekannte Form)`); continue; }
      const datei = m[1] ?? md;
      if (!existsSync(join(HANDBUCH, datei))) { tot.push(`${ziel} (Kapitel fehlt)`); continue; }
      if (m[2] && !ankerDerSeite(seiteZu(datei)).has(m[2])) tot.push(`${ziel} (Anker fehlt)`);
    }
    expect(tot).toEqual([]);
  });

  it('findet die Verweise überhaupt', () => {
    // Gezählt 27.09.2026: 223 Verweise mit Anker. Ohne diese
    // Zusicherung wäre ein kaputtes Suchmuster ein grüner Test.
    const alle = KAPITEL.flatMap(verweiseIm).filter((z) => /\.md#|^#/.test(z));
    expect(alle.length).toBeGreaterThan(150);
  });
});

describe('Handbuch-Anker: Verweise aus App, Webseite und Backend treffen', () => {
  const quellen = [
    ...quelldateien(join(FRONTEND, 'src'), /\.tsx?$/, /__tests__|__mocks__|\.test\.tsx?$/),
    ...readdirSync(join(FRONTEND, 'public')).filter((d) => d.endsWith('.html')).map((d) => join(FRONTEND, 'public', d)),
    ...['routes', 'services', 'utils'].flatMap((o) => quelldateien(join(REPO, 'backend', o), /\.js$/)),
  ];

  it('das Suchmuster erkennt Handbuch-Links (Gegenprobe)', () => {
    expect(handbuchLinks('siehe https://konfi-quest.de/docs/termine.html#ein-event-anlegen'))
      .toEqual([{ seite: 'termine.html', anker: 'ein-event-anlegen' }]);
    expect(handbuchLinks("href='/docs/badges.html'")).toEqual([{ seite: 'badges.html', anker: undefined }]);
    expect(handbuchLinks('/docs/ und /docs/api/')).toEqual([]);
  });

  it('jeder Link zeigt auf eine erzeugte Seite und einen vorhandenen Anker', () => {
    // Stand 27.09.2026: Die App und das Backend verlinken kein Kapitel, die
    // Website nur die Übersicht (/docs). Kommt ein Kapitel-Link dazu, prüft
    // ihn dieser Test.
    expect(quellen.length).toBeGreaterThan(300);
    const tot: string[] = [];
    for (const pfad of quellen) {
      for (const { seite, anker } of handbuchLinks(readFileSync(pfad, 'utf8'))) {
        const ort = `${relative(REPO, pfad)}: /docs/${seite}${anker ? `#${anker}` : ''}`;
        if (!existsSync(join(ERZEUGT, seite))) tot.push(`${ort} (Seite fehlt)`);
        else if (anker && !ankerDerSeite(seite).has(anker)) tot.push(`${ort} (Anker fehlt)`);
      }
    }
    expect(tot).toEqual([]);
  });
});
