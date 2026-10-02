// backend/tests/schema/dumpAktualitaet.test.js
//
// Auffrisch-Rhythmus fuer den Schema-Dump (Audit Datenbank BF-17 /
// Tests BF-14, 29.09.2026) und die Grenze zwischen Dump und Migrationen
// (02.10.2026).
//
// Testsuite, Neuinstallation und E2E bauen ihr Schema aus
// tests/schema/prod-schema.sql und lassen darauf die Migrationen laufen, die
// prod-migrations.txt noch nicht nennt. Am 26.09.2026 war der Dump fuenf
// Wochen alt, 36 Migrationen liefen obendrauf -- und niemand hatte
// festgelegt, wann er erneuert wird. Jede offene Migration ist ein Schritt,
// den die Tests auf einem Stand pruefen, den es so in der Produktion nur
// kurz gab; und je laenger die Kette, desto weniger zeigt der Dump, wie die
// Produktion heute aussieht.
//
// Rhythmus: mit jedem Release `bash backend/tests/schema/schema-erneuern.sh
// <letzte Migration der Produktion>`. Dieser Test schlaegt an, wenn es
// vergessen wurde -- bei mehr als HOECHSTENS_OFFEN offenen Migrationen. Er
// zaehlt Dateien, keine Tage: Ein Datum wuerde ohne jede Aenderung am Code
// eines Morgens rot und den Deploy blockieren.
//
// GRENZE ZWISCHEN DUMP UND MIGRATIONEN (seit 02.10.2026): Was der Dump
// enthaelt, liegt nicht mehr als Datei in backend/migrations/ -- dort steht
// nur, was NACH dem Dump kam (bis 02.10.2026 lagen die 102 Dateien 064 bis
// 173 doppelt da, als Datei und im Dump). Zwei Regeln halten die Grenze:
//   1. Jede Datei ist juenger als der juengste Eintrag des Dumps. Liegt ein
//      Name aus dem Dump noch da, laeuft er nirgends mehr -- eine Aenderung
//      daran wirkte weder in der Produktion noch auf einer neuen Instanz.
//      Eine neue Datei mit aelterer Nummer liefe nicht an ihrer Stelle,
//      sondern nach dem ganzen Dump-Stand.
//   2. Jede Nummer kommt nur einmal vor. Der Migrationslauf sortiert nach dem
//      Dateinamen; bei gleicher Nummer entscheidet der Rest des Namens ueber
//      die Reihenfolge -- so lief 064_add_missing_indexes VOR
//      064_consolidate_inline_schemas, das die Tabellen erst anlegte.
const fs = require('fs');
const path = require('path');

const SCHEMA_DIR = __dirname;
const MIGRATIONS_DIR = path.join(__dirname, '..', '..', 'migrations');
const INIT_DIR = path.join(__dirname, '..', '..', '..', 'init-scripts');

// Ein Release bringt bisher bis zu 13 Migrationen (2.3.0: 160 bis 173);
// 20 laesst Luft fuer einen Release plus Nachzuegler, nicht fuer zwei.
const HOECHSTENS_OFFEN = 20;

const vermerkt = fs.readFileSync(path.join(SCHEMA_DIR, 'prod-migrations.txt'), 'utf8')
  .split('\n').map((z) => z.trim()).filter(Boolean);
const dateien = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();

// Dreistellige Nummer, Unterstrich, Name. Vierstellige Nummern sortierten als
// Text falsch ("1000_" vor "174_") -- auch das soll hier auffallen.
const NAMENSFORM = /^(\d{3})_[a-z0-9_]+\.sql$/;

/** Hoechste Nummer unter den Namen, null ohne Nummer. */
function juengsteNummer(namen) {
  const nummern = namen.map((n) => parseInt(n, 10)).filter(Number.isFinite);
  return nummern.length ? Math.max(...nummern) : null;
}

/**
 * Verstoesse gegen die Grenze zwischen Dump und Migrationsdateien.
 *
 * @param {string[]} migrationsDateien  Dateinamen in backend/migrations/
 * @param {string[]} imDump             Namen aus prod-migrations.txt
 * @returns {string[]} je Verstoss eine lesbare Zeile, leer = in Ordnung
 */
function grenzVerstoesse(migrationsDateien, imDump) {
  const verstoesse = [];
  const juengsteImDump = juengsteNummer(imDump) ?? -1;
  const jeNummer = new Map();

  for (const datei of migrationsDateien) {
    const treffer = datei.match(NAMENSFORM);
    if (!treffer) {
      verstoesse.push(`${datei}: Name nicht in der Form NNN_name.sql`);
      continue;
    }
    const nummer = parseInt(treffer[1], 10);
    if (nummer <= juengsteImDump) {
      verstoesse.push(`${datei}: nicht juenger als der Dump (Stand ${juengsteImDump})`);
    }
    jeNummer.set(nummer, [...(jeNummer.get(nummer) || []), datei]);
  }
  for (const [nummer, gleiche] of jeNummer) {
    if (gleiche.length > 1) {
      verstoesse.push(`Nummer ${String(nummer).padStart(3, '0')} mehrfach: ${gleiche.join(', ')}`);
    }
  }
  return verstoesse;
}

describe('Schema-Dump: Auffrisch-Rhythmus', () => {
  it(`hoechstens ${HOECHSTENS_OFFEN} Migrationen laufen ueber dem Dump`, () => {
    const offen = dateien.filter((f) => !vermerkt.includes(f));
    // Bei Rot: bash backend/tests/schema/schema-erneuern.sh <letzte Migration,
    // die in der Produktion gelaufen ist> -- und das Ergebnis mitcommitten.
    expect(offen.length).toBeLessThanOrEqual(HOECHSTENS_OFFEN);
  });
});

describe('Schema-Dump: Grenze zu backend/migrations/', () => {
  it('der Dump steht mindestens auf Stand 173 (aeltere Dateien gibt es nicht mehr)', () => {
    // Faellt er dahinter zurueck (etwa ein alter Dump aus der Produktion),
    // fehlten einer neuen Instanz die Schritte bis 173 -- die Dateien dafuer
    // liegen nur noch in der Git-Historie (init-scripts/README.md).
    expect(vermerkt.length).toBeGreaterThan(0);
    expect(juengsteNummer(vermerkt)).toBeGreaterThanOrEqual(173);
  });

  it('jede Datei ist juenger als der Dump, keine Nummer kommt doppelt vor', () => {
    // Bei Rot nach refresh-schema.sh: Die Dateien, die jetzt im Dump stehen,
    // gehoeren aus backend/migrations/ entfernt (schema-erneuern.sh tut das
    // selbst).
    expect(dateien.length).toBeGreaterThan(0);
    expect(grenzVerstoesse(dateien, vermerkt)).toEqual([]);
  });

  // Gegenprobe: Die Regel erkennt genau die Faelle, die sie fangen soll, und
  // laesst den erlaubten durch.
  const DUMP = ['064_a.sql', '064_b.sql', '172_x.sql', '173_y.sql'];
  it.each([
    ['erlaubt: nur Dateien nach dem Dump', ['174_a.sql', '175_b.sql', '189_c.sql'], []],
    ['verboten: eine Datei aus dem Dump liegt noch da', ['173_y.sql', '174_a.sql'],
      ['173_y.sql: nicht juenger als der Dump (Stand 173)']],
    ['verboten: eine aeltere Nummer unter neuem Namen', ['170_nachzuegler.sql', '174_a.sql'],
      ['170_nachzuegler.sql: nicht juenger als der Dump (Stand 173)']],
    ['verboten: dieselbe Nummer wie der juengste Eintrag', ['173_anders.sql'],
      ['173_anders.sql: nicht juenger als der Dump (Stand 173)']],
    ['verboten: zwei Dateien mit derselben Nummer', ['174_a.sql', '174_b.sql', '175_c.sql'],
      ['Nummer 174 mehrfach: 174_a.sql, 174_b.sql']],
    ['verboten: vierstellige Nummer', ['1000_a.sql'],
      ['1000_a.sql: Name nicht in der Form NNN_name.sql']],
  ])('%s', (_fall, liste, erwartet) => {
    expect(grenzVerstoesse(liste, DUMP)).toEqual(erwartet);
  });
});

describe('Schema-Dump: init-scripts/ ist gespiegelt', () => {
  // Neuinstallation und Testsuite lesen dieselbe Quelle; wer den Dump
  // erneuert und das Spiegeln vergisst, baut neue Instanzen aus dem alten.
  it('01-create-schema.sql enthaelt prod-schema.sql unveraendert', () => {
    const quelle = fs.readFileSync(path.join(SCHEMA_DIR, 'prod-schema.sql'), 'utf8');
    const init = fs.readFileSync(path.join(INIT_DIR, '01-create-schema.sql'), 'utf8');
    expect(init.endsWith(quelle)).toBe(true);
  });

  it('02-migrationsstand.sql traegt genau die vermerkten Migrationen ein', () => {
    const init = fs.readFileSync(path.join(INIT_DIR, '02-migrationsstand.sql'), 'utf8');
    const eingetragen = [...init.matchAll(/^ {4}\('([^']+)'\)/gm)].map((m) => m[1]);
    expect(eingetragen).toEqual(vermerkt);
  });
});
