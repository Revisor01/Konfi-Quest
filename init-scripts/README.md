# init-scripts/ — das Schema einer NEUEN Instanz

## Wann diese Dateien laufen

`deploy/compose.konfi_quest.yml` haengt dieses Verzeichnis in den
Datenbank-Dienst ein:

```yaml
- /opt/Konfi-Quest/init-scripts:/docker-entrypoint-initdb.d
```

Das offizielle `postgres`-Image fuehrt alles in
`/docker-entrypoint-initdb.d` **genau einmal** aus: beim allerersten Start,
solange das Datenverzeichnis noch leer ist. Bei einer bestehenden Datenbank
laeuft hier nie wieder etwas — auch nicht nach einem Redeploy.

Daraus folgen zwei Dinge, die leicht zu uebersehen sind:

1. **Fuer die Produktion wirkt eine Aenderung hier nicht.** Wer eine Spalte
   braucht, schreibt eine Migration unter `backend/migrations/`. Eine
   Aenderung nur hier erreicht die laufende Datenbank nie.
2. **Fuer jede NEUE Instanz ist das hier der einzige Startpunkt.** Ein
   Fehler faellt deshalb nicht im Alltag auf, sondern erst bei der naechsten
   Neuinstallation — und dann sofort und vollstaendig.

Das Image bricht bei einem Fehler hart ab (`psql -v ON_ERROR_STOP=1`, das
Entrypoint-Skript laeuft mit `set -e`). Der Container endet mit Exit-Code 3,
und `restart: unless-stopped` startet ihn in eine Endlosschleife. Eine
kaputte Datei hier heisst also: die neue Instanz kommt gar nicht erst hoch.

## Warum das Schema ein Produktions-Dump ist

`01-create-schema.sql` ist ein `pg_dump --schema-only` der echten
Produktionsdatenbank — dieselbe Datei, aus der auch die Testsuite ihre
Datenbank aufbaut (`backend/tests/globalSetup.js`). Beide Seiten lesen
denselben Stand; es gibt keine zweite, handgepflegte Fassung mehr.

Ein handgeschriebenes Schema waere eine zweite Quelle neben den Migrationen,
und zwei Quellen laufen auseinander. Genau das war passiert: Die frueher hier
liegende Datei kannte 25 Tabellen, die Produktion hat 57. Sie legte drei
Tabellen an, die es in Produktion seit Migration 076/090 nicht mehr gibt
(`badges`, `konfi_activities`, `konfi_badges`), und verbot per
CHECK-Constraint Werte, die der Code laengst schreibt. Aufgefallen ist das
keinem Test, weil die Tests aus dem Dump bauen und diese Datei nie anfassten.

Die Migrationskette kann die Luecke nicht schliessen: Sie beginnt erst bei
`064`, und fuer mehrere Objekte (`daily_verses`, `activities.category`,
`konfi_profiles.password_plain`) existiert nirgends im Repo ein DDL — sie
wurden in Produktion von Hand angelegt. Das Repo kann die Produktion also
nicht aus Migrationen reproduzieren; der Dump ist der einzige ehrliche
Startpunkt.

## Ablauf bei einer Neuinstallation

1. Postgres startet mit leerem Datenverzeichnis und spielt
   `01-create-schema.sql` ein → der Stand der Produktion zum Zeitpunkt des
   Dumps.
2. `02-migrationsstand.sql` traegt die Migrationen ein, die in diesem Stand
   **bereits enthalten** sind. Ohne diesen Schritt wuerde der Migrationslauf
   sie erneut anwenden.
3. Das Backend startet und laesst ueber `backend/database.js` alle noch
   nicht vermerkten Migrationen laufen — derselbe Weg wie bei jedem Deploy.

Ergebnis: eine neue Instanz durchlaeuft exakt dieselben Migrationen wie die
Produktion und landet auf demselben Schema.

## Aktualisieren

Beide Dateien entstehen aus der Produktion und werden gemeinsam erneuert:

```bash
bash backend/tests/schema/refresh-schema.sh   # holt Dump + Migrationsstand
bash init-scripts/refresh.sh                  # spiegelt beides hierher
```

Nie einzeln anfassen: Ein Dump ohne den passenden Migrationsstand laesst den
naechsten Start Migrationen doppelt anwenden.

Der Waechter `backend/tests/schema/neuinstallation.test.js` baut bei jedem
Testlauf eine Wegwerf-Datenbank aus diesen Dateien auf, laesst die
Migrationen darauf laufen und vergleicht das Ergebnis mit dem
Produktionsschema. Laufen die beiden Seiten auseinander, faellt er.
