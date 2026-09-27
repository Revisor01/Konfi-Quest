import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, resolve } from 'path';
import { datumKurz, datumLang, uhrzeit, datumUhrzeit } from '../../utils/dateUtils';
import { formatEventDate, formatEventDateLong, formatEventTime, zeitraumText } from '../../components/shared/eventFormatting';

// ---------------------------------------------------------------------------
// Audit 26.09.2026, UI-Bericht BF-14: Datumsformate uneinheitlich. Gezaehlt am
// 27.09.2026 (Skript wie unten): 88 Aufrufe von toLocaleDateString/
// -TimeString/-String auf Datumswerten mit 17 verschiedenen Optionssaetzen --
// derselbe Tag als „14.09.2026", „8. Sept. 2026", „8.9.2026", „Mo., 14. Sept.".
//
// Seitdem drei Formate an EINER Stelle (utils/dateUtils.ts): datumKurz
// (14.09.2026, ohne Jahr 14.09.), datumLang (Montag, 14. September 2026),
// uhrzeit (18:00); datumUhrzeit verbindet kurz und Uhrzeit.
//
// Die Zeitzone ist die des Geraets (wie vorher). Die Tests stellen sie auf
// Europe/Berlin -- ein Handy in Deutschland -- und pruefen Sommer- und
// Winterzeit, Mitternacht und beide Umstellungstage.
// ---------------------------------------------------------------------------

let vorherTZ: string | undefined;
beforeAll(() => {
  vorherTZ = process.env.TZ;
  process.env.TZ = 'Europe/Berlin';
});
afterAll(() => {
  if (vorherTZ === undefined) delete process.env.TZ;
  else process.env.TZ = vorherTZ;
});

describe('Die drei Datumsformate (UI BF-14)', () => {
  it('Sommerzeit: 14.09.2026, 16:00 UTC ist 18:00 in Berlin', () => {
    const iso = '2026-09-14T16:00:00.000Z';
    expect(datumKurz(iso)).toBe('14.09.2026');
    expect(datumKurz(iso, { ohneJahr: true })).toBe('14.09.');
    // Event-Karten der Startseite mit Wochentag (Simon, 27.09.2026).
    expect(datumKurz(iso, { mitWochentag: true })).toBe('Mo., 14.09.2026');
    expect(datumLang(iso)).toBe('Montag, 14. September 2026');
    expect(uhrzeit(iso)).toBe('18:00');
    expect(datumUhrzeit(iso)).toBe('14.09.2026, 18:00');
    expect(datumUhrzeit(iso, { ohneJahr: true })).toBe('14.09., 18:00');
  });

  it('Winterzeit: 24.12.2026, 16:30 UTC ist 17:30 in Berlin', () => {
    const iso = '2026-12-24T16:30:00Z';
    expect(datumKurz(iso)).toBe('24.12.2026');
    expect(datumLang(iso)).toBe('Donnerstag, 24. Dezember 2026');
    expect(uhrzeit(iso)).toBe('17:30');
  });

  it('einstellige Tage: kurz mit fuehrender Null, lang ohne', () => {
    const iso = '2026-06-07T08:00:00Z';
    expect(datumKurz(iso)).toBe('07.06.2026');
    expect(datumLang(iso)).toBe('Sonntag, 7. Juni 2026');
    expect(uhrzeit(iso)).toBe('10:00');
  });

  it('nach Mitternacht in Berlin ist schon der naechste Tag, obwohl es in UTC noch der alte ist', () => {
    expect(datumKurz('2026-09-13T22:30:00Z')).toBe('14.09.2026');
    expect(uhrzeit('2026-09-13T22:30:00Z')).toBe('00:30');
    expect(datumKurz('2026-01-31T23:15:00Z')).toBe('01.02.2026');
    expect(uhrzeit('2026-01-31T23:15:00Z')).toBe('00:15');
  });

  it('Umstellungstage: 29.03.2026 (vor/nach 02:00) und 25.10.2026 (die doppelte Stunde)', () => {
    expect(uhrzeit('2026-03-29T00:30:00Z')).toBe('01:30');
    expect(uhrzeit('2026-03-29T01:30:00Z')).toBe('03:30');
    expect(uhrzeit('2026-10-25T00:30:00Z')).toBe('02:30');
    expect(uhrzeit('2026-10-25T01:30:00Z')).toBe('02:30');
    expect(datumLang('2026-10-25T01:30:00Z')).toBe('Sonntag, 25. Oktober 2026');
  });

  it('nimmt Date-Objekte und Zeitstempel ebenso', () => {
    const d = new Date('2026-09-14T16:00:00Z');
    expect(datumKurz(d)).toBe('14.09.2026');
    expect(uhrzeit(d.getTime())).toBe('18:00');
  });

  it('leer oder ungueltig ergibt einen leeren Text statt „Invalid Date"', () => {
    for (const wert of ['', null, undefined, 'kein-datum']) {
      expect(datumKurz(wert)).toBe('');
      expect(datumLang(wert)).toBe('');
      expect(uhrzeit(wert)).toBe('');
      expect(datumUhrzeit(wert)).toBe('');
    }
  });

  it('die Termin-Formatierer (shared/eventFormatting) sind dieselben Formate', () => {
    const iso = '2026-06-07T08:00:00Z';
    expect(formatEventDate(iso)).toBe(datumKurz(iso));
    expect(formatEventTime(iso)).toBe(uhrzeit(iso));
    expect(formatEventDateLong(iso)).toBe(datumLang(iso));
    expect(zeitraumText({ event_date: '2026-11-20T15:30:00Z', event_end_time: '2026-11-22T11:30:00Z' }))
      .toBe('Freitag, 20. November 2026, 16:30 – Sonntag, 22. November 2026, 12:30');
  });
});

// --- Zaehlung: keine Sonderformate neben utils/dateUtils.ts ---------------

const src = resolve(process.cwd(), 'src');

const alleDateien = (ordner: string): string[] =>
  readdirSync(ordner).flatMap((name) => {
    const pfad = join(ordner, name);
    if (statSync(pfad).isDirectory()) return name === '__tests__' ? [] : alleDateien(pfad);
    return /\.(ts|tsx)$/.test(name) ? [pfad] : [];
  });

const argumente = (quelle: string, klammer: number): string => {
  let tiefe = 0;
  for (let i = klammer; i < quelle.length; i++) {
    if (quelle[i] === '(') tiefe++;
    else if (quelle[i] === ')' && --tiefe === 0) return quelle.slice(klammer + 1, i);
  }
  return '';
};

interface Aufruf { ort: string; datei: string; art: string; args: string }

// Datumsformatierung: toLocaleDateString/-TimeString immer; toLocaleString nur
// mit Datumsoptionen oder direkt auf new Date(...) -- Zahlen formatiert die
// App ebenfalls mit toLocaleString('de-DE') (Kennzahlen), das ist kein Datum.
const datumsAufrufe = (): Aufruf[] =>
  alleDateien(src).flatMap((pfad) => {
    const quelle = readFileSync(pfad, 'utf8');
    const funde: Aufruf[] = [];
    for (const m of quelle.matchAll(/(\bnew Date\([^)]*\))?\s*\.(toLocaleDateString|toLocaleTimeString|toLocaleString)\s*\(/g)) {
      const args = argumente(quelle, m.index! + m[0].length - 1);
      const istDatum = m[2] !== 'toLocaleString' || !!m[1] || /\b(day|month|year|weekday|hour|minute)\s*:/.test(args);
      if (!istDatum) continue;
      funde.push({ ort: `${relative(src, pfad)}:${quelle.slice(0, m.index).split('\n').length}`, datei: relative(src, pfad), art: m[2], args: args.replace(/\s+/g, ' ').trim() });
    }
    for (const m of quelle.matchAll(/\bIntl\.DateTimeFormat\s*\(/g)) {
      funde.push({ ort: `${relative(src, pfad)}:${quelle.slice(0, m.index).split('\n').length}`, datei: relative(src, pfad), art: 'Intl.DateTimeFormat', args: '' });
    }
    return funde;
  });

// Ausnahmen, abschliessend: Der Rueckblick (Wrapped) ist eine erzaehlende
// Folienfolge in fester Pixelgestaltung und ein Teilen-Bild. Dort steht der
// Tag bewusst ohne Wochentag und teils ohne Jahr („14. September" -- „die
// Konfi-Zeit ist keine Jahresrechnung", LangerAtemSlide; auf dem Teilen-Bild
// steht das Jahr als eigene grosse Zeile). Das ist Gestaltung, keine Anzeige
// eines Datenfelds.
const AUSNAHMEN = [
  'components/wrapped/share/ShareCard.tsx',
  'components/wrapped/slides/AbschlussSlide.tsx',
  'components/wrapped/slides/KonfirmationsSlide.tsx',
  'components/wrapped/slides/LangerAtemSlide.tsx',
  'components/wrapped/slides/teamer/TeamerAnfangSlide.tsx',
];

describe('Keine Sonderformate neben utils/dateUtils.ts (UI BF-14)', () => {
  const aufrufe = datumsAufrufe();

  it('findet die Formatierung in dateUtils.ts selbst (Plausibilitaet der Zaehlung)', () => {
    expect(aufrufe.filter((a) => a.datei === 'utils/dateUtils.ts').map((a) => a.art).sort())
      .toEqual(['toLocaleDateString', 'toLocaleDateString', 'toLocaleTimeString']);
  });

  it('ausserhalb von dateUtils.ts formatiert nur der Rueckblick selbst', () => {
    const fremd = aufrufe
      .filter((a) => a.datei !== 'utils/dateUtils.ts' && !AUSNAHMEN.includes(a.datei))
      .map((a) => `${a.ort} ${a.art}(${a.args})`);
    expect(fremd).toEqual([]);
  });

  it('die Ausnahmen sind genau die sechs Stellen im Rueckblick', () => {
    const ausnahmen = aufrufe.filter((a) => AUSNAHMEN.includes(a.datei));
    expect(ausnahmen.length).toBe(6);
    expect(new Set(ausnahmen.map((a) => a.datei)).size).toBe(AUSNAHMEN.length);
  });

  it('dateUtils.ts kennt genau drei Formate (kurz, lang, Uhrzeit)', () => {
    const quelle = readFileSync(join(src, 'utils/dateUtils.ts'), 'utf8');
    const optionen = [...quelle.matchAll(/^const ([A-Z_]+): Intl\.DateTimeFormatOptions = (\{[^}]*\});/gm)].map((m) => `${m[1]} ${m[2]}`);
    expect(optionen).toEqual([
      "KURZ { day: '2-digit', month: '2-digit', year: 'numeric' }",
      "KURZ_OHNE_JAHR { day: '2-digit', month: '2-digit' }",
      "KURZ_MIT_WOCHENTAG { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' }",
      "LANG { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }",
      "UHRZEIT { hour: '2-digit', minute: '2-digit' }",
    ]);
  });
});
