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

**Hier liegen nur die beiden `.sql`-Dateien und diese Beschreibung.** Das
Entrypoint spielt jede `*.sql` ein und fuehrt jede `*.sh` aus; nur andere
Endungen ignoriert es. Bis zum 29.09.2026 lag hier das Hilfsskript
`refresh.sh` — das Entrypoint fuehrte es aus, es fand im Container seine
Quelle nicht, und die neue Instanz endete beim ersten Start (nachgestellt mit
`postgres:15-alpine`). Es heisst jetzt
`backend/tests/schema/init-scripts-spiegeln.sh`; der Waechter
`backend/tests/schema/initScriptsInhalt.test.js` faellt, sobald hier wieder
etwas anderes liegt.

## Warum das Schema ein Produktions-Dump ist

`01-create-schema.sql` ist ein `pg_dump --schema-only` der
Produktionsdatenbank, fortgeschrieben um die Migrationen, die dort seitdem
gelaufen sind — dieselbe Datei, aus der auch die Testsuite ihre Datenbank
aufbaut (`backend/tests/globalSetup.js`). Beide Seiten lesen denselben Stand;
es gibt keine zweite, handgepflegte Fassung mehr.

Ein handgeschriebenes Schema waere eine zweite Quelle neben den Migrationen,
und zwei Quellen laufen auseinander. Genau das war passiert: Die frueher hier
liegende Datei kannte 25 Tabellen, die Produktion hat 57. Sie legte drei
Tabellen an, die es in Produktion seit Migration 076/090 nicht mehr gibt
(`badges`, `konfi_activities`, `konfi_badges`), und verbot per
CHECK-Constraint Werte, die der Code laengst schreibt. Aufgefallen ist das
keinem Test, weil die Tests aus dem Dump bauen und diese Datei nie anfassten.

Die Migrationen konnten die Luecke nie schliessen: Die Kette begann erst bei
`064`, und manches entstand in Produktion von Hand (etwa
`konfi_profiles.password_plain`, seit Migration 187 entfernt). Das Repo kann
die Produktion nicht allein aus Migrationen reproduzieren; der Dump ist der
einzige ehrliche Startpunkt.

## Was in `backend/migrations/` liegt — und was nicht

Der Dump steht auf **Stand 173** (`173_einladungscode_ohne_urheber.sql`) und
ist die **einzige Quelle** fuer eine neue Datenbank. `backend/migrations/`
haelt nur die Aenderungen **danach** (ab `174`); was der Dump enthaelt, liegt
dort nicht noch einmal als Datei.

- **Die alten Dateien** `064` bis `173` (102 Stueck) sind am 02.10.2026
  entfernt worden. Sie stehen in der Git-Historie, zuletzt im Commit
  `d99346fecee40122d0e3c1f4673bc21be428653b`
  (`git show d99346fe:backend/migrations/<datei>`). Fuer eine Datenbank, die
  alle 102 in `schema_migrations` vermerkt hat, aendert das nichts: Der
  Migrationslauf (`backend/utils/migrationslauf.js`) fuehrt nur Dateien aus,
  die dort noch nicht stehen, und fragt nach keiner Datei, die fehlt.
  Pruefen (die Ausgabe nennt, was fehlt, und muss leer sein):

  ```bash
  psql -At -c "SELECT name FROM schema_migrations" | LC_ALL=C sort \
    | LC_ALL=C comm -13 - backend/tests/schema/prod-migrations.txt
  ```
- **Eine Datenbank aelter als Stand 173** laesst sich mit diesem Repo nicht
  mehr hochziehen — es gibt keinen Weg mehr von einem aelteren Stand. Sie
  wird aus einer Sicherung ab Stand 173 wiederhergestellt
  (`deploy/wiederherstellung.sh`; die juengste Migration einer Sicherung
  nennt das Skript). Wer doch einmal einen aelteren Stand nachziehen muss,
  holt die fehlenden Dateien aus dem Commit oben und spielt sie von Hand in
  ihrer Reihenfolge ein.
- **Stammdaten** sind nicht Teil des Dumps (`--schema-only`). Die 32
  Konfisprueche samt Luther- und Gute-Nachricht-Texten, die die Migrationen
  093 und 134 in die Produktion brachten, hat eine neue Instanz deshalb nicht
  — das war schon so, seit sie aus dem Dump entsteht. Die Quelle steht im
  Commit oben.
- **Die Grenze haelt ein Waechter:** `backend/tests/schema/dumpAktualitaet.test.js`
  faellt, wenn eine Datei in `backend/migrations/` nicht juenger ist als der
  juengste Eintrag des Dumps oder wenn eine Nummer doppelt vorkommt.

## Ablauf bei einer Neuinstallation

1. Postgres startet mit leerem Datenverzeichnis und spielt
   `01-create-schema.sql` ein → der Stand der Produktion zum Zeitpunkt des
   Dumps.
2. `02-migrationsstand.sql` traegt die Migrationen ein, die in diesem Stand
   **bereits enthalten** sind — dieselben Eintraege wie in der Produktion.
   Daran sieht man der Datenbank ihren Stand an (etwa
   `deploy/wiederherstellung.sh`).
3. Das Backend startet und laesst ueber `backend/database.js` alle noch
   nicht vermerkten Migrationen laufen — derselbe Weg wie bei jedem Deploy.
4. **Der erste Zugang.** Das Schema ist jetzt vollstaendig, aber leer: keine
   Gemeinde, kein Konto. Gemeinden legt nur ein Super-Admin an, Konten nur
   eine Leitung — ohne diesen Schritt kommt niemand hinein. Im
   Backend-Container:

   ```bash
   docker exec -e ERST_BENUTZERNAME=<name> -e ERST_ANZEIGENAME=<anzeige> \
     -e ERST_PASSWORT=<passwort> [-e ERST_EMAIL=<adresse>] [-e ERST_GEMEINDE=Betrieb] \
     <backend-container> node scripts/ersteinrichtung.js
   ```

   Das legt eine Gemeinde fuer den Betrieb an, ihre vier Standardrollen und
   ein Konto mit Super-Admin-Recht (Rolle Gemeindeleitung plus
   `is_super_admin`); es laeuft nur auf einer leeren Datenbank und bricht
   sonst ohne Aenderung ab. Das Passwort muss die Regeln der App erfuellen.
   Danach in der App anmelden, das Passwort aendern und die eigentlichen
   Gemeinden anlegen — jede bekommt dabei ihre Rollen, Abzeichen,
   Zertifikatstypen und Stufen. Test: `backend/tests/schema/ersteinrichtung.test.js`.

Ergebnis: eine neue Instanz startet auf dem Stand des Dumps, durchlaeuft
danach dieselben Migrationen wie die Produktion und landet auf demselben
Schema.

Die Vorlage `deploy/compose.konfi_quest.yml` setzt die Server-Zeitzone fest
auf UTC wie die Produktion; ohne das uebernaehme das Image beim ersten Start
`TZ` in `postgresql.conf` (Berliner Zeit), und Zeitspalten ohne Zone
landeten zwei Stunden versetzt.

## Aktualisieren

Beide Dateien werden gemeinsam erneuert, **mit jedem Release** — aus dem
Migrationsstand des Repos, reproduzierbar und ohne Zugang zur Produktion:

```bash
# Dump + Migrationsstand fortschreiben (Docker, postgres:15-alpine), hierher
# spiegeln und die nun enthaltenen Dateien aus backend/migrations/ entfernen.
# BIS (Pflicht) = letzte Migration, die in der Produktion gelaufen ist.
bash backend/tests/schema/schema-erneuern.sh <NNN_name.sql>
```

Danach Dump, `init-scripts/` und die entfernten Dateien in einem Commit
festhalten und den Stand in diesem Text nachziehen. Nur Migrationen nehmen,
die in der Produktion schon gelaufen sind: Was aus `backend/migrations/`
verschwindet, laeuft dort nie mehr.

Vergessen faellt auf: `backend/tests/schema/dumpAktualitaet.test.js`
schlaegt an, sobald mehr als 20 Migrationen ueber dem Dump laufen, wenn
dieses Verzeichnis nicht mehr zum Dump passt und wenn nach einem Erneuern
noch Dateien liegen, die der Dump schon enthaelt. Ob die Produktion dem
fortgeschriebenen Stand wirklich entspricht (Handaenderungen dort sieht kein
Migrationsstand), misst der Betrieb mit `backend/scripts/schemaVergleich.js`.
Direkt aus der Produktion geht es weiterhin:

```bash
bash backend/tests/schema/refresh-schema.sh         # holt Dump + Migrationsstand
bash backend/tests/schema/init-scripts-spiegeln.sh  # spiegelt beides hierher
```

Auf diesem Weg die Dateien, die der neue Migrationsstand nennt, von Hand aus
`backend/migrations/` entfernen.

Nie einzeln anfassen: Ein Dump ohne den passenden Migrationsstand laesst den
naechsten Start Migrationen doppelt anwenden.

Der Waechter `backend/tests/schema/neuinstallation.test.js` baut bei jedem
Testlauf eine Wegwerf-Datenbank aus diesen Dateien auf, laesst die
Migrationen darauf laufen und vergleicht das Ergebnis mit dem
Produktionsschema. Laufen die beiden Seiten auseinander, faellt er.
