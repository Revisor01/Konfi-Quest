// backend/tests/schema/dumpAktualitaet.test.js
//
// Auffrisch-Rhythmus fuer den Schema-Dump (Audit Datenbank BF-17 /
// Tests BF-14, 29.09.2026).
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

describe('Schema-Dump: Auffrisch-Rhythmus', () => {
  it(`hoechstens ${HOECHSTENS_OFFEN} Migrationen laufen ueber dem Dump`, () => {
    const offen = dateien.filter((f) => !vermerkt.includes(f));
    // Bei Rot: bash backend/tests/schema/schema-erneuern.sh <letzte Migration,
    // die in der Produktion gelaufen ist> -- und das Ergebnis mitcommitten.
    expect(offen.length).toBeLessThanOrEqual(HOECHSTENS_OFFEN);
  });

  it('jede vermerkte Migration gibt es als Datei (kein umbenannter oder geloeschter Name)', () => {
    // Ein Name, den es nicht mehr gibt, hiesse: Die Datei wurde umbenannt
    // und liefe unter neuem Namen noch einmal -- in der Produktion auch.
    expect(vermerkt.filter((name) => !dateien.includes(name))).toEqual([]);
  });

  it('die vermerkten Migrationen sind ein lueckenloser Anfang der Kette', () => {
    // Der Dump enthaelt alle Migrationen bis zu einer Stelle, keine spaetere
    // ohne ihre Vorgaenger -- sonst liefe eine aeltere NACH einer juengeren.
    const letzte = [...vermerkt].sort().pop();
    const bisDahin = dateien.filter((f) => f <= letzte);
    expect([...vermerkt].sort()).toEqual(bisDahin);
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
