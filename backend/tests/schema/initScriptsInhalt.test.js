// backend/tests/schema/initScriptsInhalt.test.js
//
// Waechter fuer den INHALT von init-scripts/.
//
// deploy/compose.konfi_quest.yml haengt das ganze Verzeichnis nach
// /docker-entrypoint-initdb.d. Das Entrypoint-Skript des postgres-Images
// arbeitet dort beim ersten Start JEDE Datei ab, nach der Endung:
//   *.sh             -> ausgefuehrt (ausfuehrbar) oder in die eigene Shell
//                       geladen (nicht ausfuehrbar)
//   *.sql, *.sql.gz, *.sql.xz, *.sql.zst -> per psql eingespielt
//   alles andere     -> ignoriert
// und bricht bei jedem Fehler ab (set -e). Der Container endet dann, und
// restart: unless-stopped startet ihn in eine Schleife.
//
// Vorgeschichte (29.09.2026, Audit Datenbank BF-05 / "Erst-Einrichtung"):
// Seit dem 16.09.2026 lag hier das Hilfsskript refresh.sh, ausfuehrbar. Es
// spiegelt Dump und Migrationsstand aus backend/tests/schema/ hierher -- im
// Container gibt es dieses Verzeichnis nicht. Nachgestellt mit
// postgres:15-alpine und dem Verzeichnis aus dem Repo:
//   running /docker-entrypoint-initdb.d/refresh.sh
//   FEHLER: /docker-entrypoint-initdb.d/../backend/tests/schema/prod-schema.sql fehlt.
// und der Container war beendet. Eine neue Instanz nach der Referenz kam also
// gar nicht erst hoch. neuinstallation.test.js konnte das nicht sehen: Er
// spielt nur die .sql-Dateien ein.
const fs = require('fs');
const path = require('path');

const INIT_DIR = path.join(__dirname, '..', '..', '..', 'init-scripts');

// Endungen, die das Entrypoint als SQL einspielt, und die, die es ignoriert
// und die hier erlaubt sind (Beschreibung).
const ALS_SQL = /\.sql$/;
const ERLAUBT_IGNORIERT = /\.md$/;

describe('init-scripts/: nur, was das postgres-Entrypoint einspielen soll', () => {
  const dateien = fs.readdirSync(INIT_DIR).sort();

  it('enthaelt die beiden SQL-Dateien der Neuinstallation', () => {
    expect(dateien.filter((f) => ALS_SQL.test(f))).toEqual([
      '01-create-schema.sql',
      '02-migrationsstand.sql',
    ]);
  });

  it('enthaelt kein Skript und nichts, was das Entrypoint sonst ausfuehren wuerde', () => {
    // Alles ausser .sql und .md: .sh wuerde ausgefuehrt oder geladen, .sql.gz
    // und Co. eingespielt -- beides gehoert nicht unbemerkt hierher.
    const fremd = dateien.filter((f) => !ALS_SQL.test(f) && !ERLAUBT_IGNORIERT.test(f));
    expect(fremd).toEqual([]);
  });

  it('keine Unterverzeichnisse (das Entrypoint liest nur die oberste Ebene)', () => {
    const verzeichnisse = dateien.filter((f) => fs.statSync(path.join(INIT_DIR, f)).isDirectory());
    expect(verzeichnisse).toEqual([]);
  });
});
