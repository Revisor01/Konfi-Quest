# Sicherung und Wiederherstellung

Was gesichert wird, wie oft, wie lange es aufbewahrt wird, wie eine Sicherung
geprüft wird und wie sie **in eine leere Datenbank** zurückgespielt wird.
Adressen, Zugangsdaten und Ablageorte stehen absichtlich nicht hier — das
Repo ist öffentlich. Die Lücken am Ende füllt der Betrieb in seiner eigenen
Betriebsdoku aus.

Anlass: Audit 26.09.2026 (Datenbank BF-05 und BF-07, Betrieb BF-13,
Sammelbefund S-18). Bis dahin beschrieb nichts im Repo die Wiederherstellung;
der naheliegende Weg — neue Instanz per Compose hochfahren, Dump einspielen —
scheiterte im Versuch mit 2.825 Fehlerzeilen, weil `init-scripts/` beim
ersten Start bereits das Schema anlegt. Mit einer gemeinsamen Datenbank für
alle Gemeinden ist ein Datenverlust nicht mehr der Verlust einer Gemeinde,
sondern aller.

Am 29.09.2026 auf einer frisch aufgesetzten Instanz nachgestellt
(`postgres:15-alpine` wie die Referenz, Sicherung wie `deploy/sicherung.sh`,
20.000 Konten, 100.000 Buchungen). Drei Stellen scheiterten, alle drei sind
behoben:

- Die neue Instanz kam gar nicht erst hoch: Ein Hilfsskript in
  `init-scripts/` wurde vom Entrypoint des Images ausgeführt und brach ab.
  Es liegt jetzt anderswo; ein Test hält das Verzeichnis sauber.
- Einspielen in die Datenbank, die der erste Start angelegt hat: 477
  Fehlerzeilen, danach 0 Konten.
- Der hier beschriebene Weg selbst: `pg_restore -j 4` aus der
  Standardeingabe (`docker exec -i … < dump`) bricht sofort mit „parallel
  restore from standard input is not supported" ab; die Datenbank blieb leer.

Seitdem erledigt **`deploy/wiederherstellung.sh`** die Wiederherstellung:
leere Datenbank anlegen, Sicherung aus einer Datei parallel einspielen, beim
ersten Fehler abbrechen, zählen. Dieselbe Sicherung kam damit auf derselben
frischen Instanz in 5 s vollständig zurück, Schema Objekt für Objekt gleich.
Der Test `backend/tests/schema/wiederherstellung.test.js` spielt das bei
jedem Testlauf durch.

## Was gesichert wird

| Bestand | Wo er liegt (Referenz `deploy/compose.konfi_quest.yml`) | Womit | Ohne ihn |
|---|---|---|---|
| **Datenbank** `konfi_db` | Postgres-Container, Volume `/opt/Konfi-Quest/postgres` | `pg_dump -Fc` aus dem Container | alles weg: Konten, Punkte, Termine, Chats, Rückblicke |
| **Uploads** | Host-Verzeichnis `/opt/Konfi-Quest/uploads` (in alle drei Backends gemountet) | `tar` oder `rsync` | Fotos, Chat-Anhänge, Material fehlen; die Datenbank verweist ins Leere |
| **Geheimnisse der Stack-Umgebung** | Portainer-Stack (Umgebungsvariablen) | Export aus Portainer / Passwortverwaltung | `ACTIVITY_PHOTO_ENCRYPTION_KEY`: ohne ihn sind die verschlüsselten Aktivitätsfotos **unlesbar**; `JWT_SECRET`/`QR_SECRET`: alle Sitzungen und QR-Codes ungültig; `POSTGRES_PASSWORD`, `SMTP_PASS`, `LOSUNG_API_KEY`, `DOCS_PASSWORD` |
| **Firebase-Dienstkonto** | `/opt/Konfi-Quest/backend/push/firebase-service-account.json` | Kopie in die Geheimnis-Ablage | keine Push-Mitteilungen |
| **Stack-Definition** | Portainer-Stack 249 | `GET /api/stacks/249/file` (macht der Deploy-Job ohnehin) | Referenzkopie im Repo reicht als Vorlage, die echten Werte fehlen |

Nicht zu sichern: das Backend-Image (liegt auf ghcr unter dem Commit-SHA),
`socket_io_attachments` und `rate_limit_zaehler` (Laufzeitdaten, dürfen leer
sein), `apm_snapshots` (Kennzahlen, entbehrlich — landen aber ohnehin im
Dump).

## Rhythmus und Aufbewahrung

Stand (01.10.2026, vom lokalen Agenten gemessen): ein nächtlicher Dump um
2:30 per Cron am Host, seit dem 01.10.2026 im Format `-Fc` mit
Lesbarkeitsprüfung (`pg_restore --list`, mindestens 50 Tabellen), dazu
Vorabprüfung der Datenbank, `pipefail`, Größenprüfung und Löschen
unbrauchbarer Dateien. Laufzeit 1–2 s. Am Host bleiben die letzten 14 Dumps;
das tägliche Datei-Backup des Hosts nimmt Dumps **und** Uploads mit, ein
zweites Ziel wöchentlich. Eine tägliche Prüfung meldet per Push, wenn kein
Dump jünger als 36 h ist, ein frischer Dump unter 2 kB liegt oder das
Datei-Backup zu alt ist. Das Skript liegt außerhalb des Repos. Offen sind
die Wochen- und Jahresstände des Solls unten
([docs/offene-befunde.md](../offene-befunde.md), „Aufbewahrung der
Sicherungen").

Soll (Vorschlag, bis der Betrieb es anders festlegt):

- **Datenbank täglich** nachts, außerhalb der Auto-Löschung (02:00) und des
  Lizenz-Crons (03:00) — also **nicht** zwischen 02:00 und 03:30, sondern
  davor (01:00) oder danach (04:00). Ein Dump während der Auto-Löschung ist
  konsistent (eine Transaktion), aber langsam und hält Sperren mit ihr.
- **Uploads täglich** als Vollarchiv oder inkrementell (`rsync --link-dest`);
  sie wachsen nur, Änderungen an bestehenden Dateien gibt es nicht.
- **Aufbewahrung:** 14 tägliche Stände, dazu 12 wöchentliche (Sonntag) und
  der Stand zum Jahresende — die Auto-Löschung entfernt Jahrgänge nach
  Frist, eine Wiederherstellung „von vor drei Wochen" muss möglich bleiben,
  ohne die Fristen zu unterlaufen.
- **Zweiter Ort:** mindestens eine Kopie außerhalb des Servers. Der Ausfall
  vom 09./10.09.2026 traf Server und Sicherung auf derselben Maschine.
- **Geheimnisse** bei jeder Änderung neu ablegen, nicht nachts.

Als Referenz liegt `deploy/sicherung.sh` im Repo: Vorabprüfung, `pg_dump -Fc`
aus dem Container, Größen- und Lesbarkeitsprüfung, Upload-Archiv,
Aufbewahrung nach Tagen. Alles Instanzspezifische kommt über die Umgebung.

## Eine Sicherung prüfen

Nach jedem Lauf, automatisch (das macht das Referenzskript) oder von Hand:

```bash
# 1. Jung genug und groß genug? (kleinster echter Dump bisher: 236 kB)
ls -la --time-style=long-iso "$ZIEL" | tail -5

# 2. Liest sich das Archiv? Listet den Inhalt, spielt nichts ein.
docker exec -i <postgres-container> pg_restore --list < konfi_db_<stempel>.dump | head

# 3. Enthält es die Kerntabellen mit Daten? (Zeilenzahlen gegen die laufende
#    Datenbank vergleichen; grobe Abweichung = Alarm)
docker exec -i <postgres-container> pg_restore --list < konfi_db_<stempel>.dump \
  | grep -cE 'TABLE DATA public (users|konfi_profiles|events|chat_messages) '
```

Erwartet bei 3: `4`. Fehlt eine Tabelle, ist der Dump unvollständig.

Die Überwachung (Uptime Kuma oder was der Betrieb nutzt) prüft **Alter und
Größe** der jüngsten Datei — nicht nur, ob eine Datei da ist. Genau daran
scheiterte die Prüfung am 10.09.2026: „OK, 2 frische Dateien", eine davon
20 Byte.

## Der leere Dump vom 10.09.2026

In der Nacht des Ausfalls vom 09./10.09.2026 lief der nächtliche Dump, während
die Container fehlten. Er hinterließ 20 Byte — den leeren gzip-Rahmen — und
meldete trotzdem „Backup ok". Zwei Fehler verdeckten sich gegenseitig:

1. **Ohne `pipefail`** bestimmt in `pg_dump | gzip` der letzte Befehl den
   Rückgabewert: `gzip` gelingt, auch wenn `pg_dump` gar nicht startet.
2. **Die Überwachung prüfte am Fall vorbei:** Für Konfi Quest sah sie nur, ob
   eine Datei jung genug ist, nicht ob Inhalt darin steht — „OK, 2 frische
   Dateien", eine davon leer.

Seitdem gilt, und `deploy/sicherung.sh` setzt es um: vorher prüfen, ob die
Datenbank antwortet; `set -o pipefail`; das Ergebnis auf Größe und
Lesbarkeit prüfen und eine unbrauchbare Datei löschen statt liegen lassen;
Exit 1 bei jedem Fehler. Die Überwachung prüft **Alter und Größe**. Gegenprobe
am 10.09.2026: Datenbank läuft → Dump, Exit 0; Container fehlt → keine Datei,
Exit 1; `pg_dump` liefert nichts → Datei gelöscht, Exit 1; leere Datei im
Verzeichnis → die Überwachung schlägt an.

## Wiederherstellung in eine leere Datenbank

**Grundregel:** Der Dump kommt in eine Datenbank, in der **noch kein Schema**
liegt. Nicht in eine, in der `init-scripts/` gelaufen ist (477 bzw. 2.825
Fehlerzeilen, `users` danach leer), und nicht mit `--clean` in eine
vorinitialisierte (141 Zeilen Schema-Reste, die kein Migrationslauf mehr
repariert). `deploy/wiederherstellung.sh` sorgt dafür: Es löscht die
Zieldatenbank und legt sie leer neu an.

Das Skript nimmt alles Instanzspezifische aus der Umgebung:

| Variable | Bedeutung |
|---|---|
| `DUMP` | Pfad zur Sicherung (`konfi_db_<stempel>.dump`), Pflicht |
| `PG_CONTAINER` | Name des Postgres-Containers; ohne ihn laufen `psql`/`pg_restore` direkt über `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD` |
| `PG_DB`, `PG_USER` | Zieldatenbank und Eigentümer (Standard `konfi_db`, `konfi_user`) |
| `JOBS` | parallele Prozesse beim Einspielen (Standard 2; der Dienst hat 2 CPU) |
| `BESTAETIGT` | `ja`, wenn die Zieldatenbank schon Konten enthält — sie wird ersetzt |

Es bricht ab, **bevor** es etwas anfasst, wenn die Sicherung nicht lesbar ist
oder eine der Kerntabellen fehlt, wenn die Zieldatenbank Konten enthält und
`BESTAETIGT=ja` fehlt, und wenn noch ein Backend mit ihr verbunden ist.

### Fall A: Datenbank kaputt, Server und Stack stehen noch

```bash
# 1. Backends anhalten -- sie würden sonst beim Start Migrationen gegen eine
#    halbe Datenbank fahren. In Portainer: backend, backend2, backend-test
#    stoppen. (Das Skript prüft das und bricht sonst ab.)

# 2. Wiederherstellen: leere Datenbank, Sicherung einspielen, zählen.
PG_CONTAINER=<postgres-container> DUMP=<ablage>/konfi_db_<stempel>.dump \
  BESTAETIGT=ja bash deploy/wiederherstellung.sh

# 3. Die Zählungen am Ende gegen die Zahlen der letzten Prüfung oder aus dem
#    Log vergleichen.

# 4. Uploads zurückspielen (erst leeren, dann entpacken -- kein Mischbestand).
tar -xzf uploads_<stempel>.tar.gz -C /opt/Konfi-Quest/

# 5. Backends starten. Der Migrationslauf (backend/utils/migrationslauf.js)
#    zieht alles nach, was jünger ist als die Sicherung -- ohne Zeitgrenze,
#    unter dem Advisory-Lock, eine Replica nach der anderen. Das Skript nennt
#    am Ende die jüngste Migration der Sicherung.
```

Nachziehen kann der Migrationslauf nur, was als Datei in `backend/migrations/`
liegt — ab Stand 174. **Eine Sicherung älter als Stand 173** holt er nicht
mehr auf; die Dateien davor stehen nur noch in der Git-Historie. Was dann zu
tun ist, steht in
[`init-scripts/README.md`](../../init-scripts/README.md#was-in-backendmigrations-liegt--und-was-nicht).

Danach `GET /api/status` prüfen: `checks.database: ok`,
`checks.migrations: ok` (nicht `fehler`), `checks.cron_leader: ok`
(eine Replica fährt die Hintergrund-Jobs). Dann ein Login in der App, ein
Chat-Raum, ein Foto — die Fotos beweisen, dass der Verschlüsselungsschlüssel
der richtige ist.

### Fall B: neuer Server, alles von null

1. Stack aus der Referenzkopie anlegen, **alle** Geheimnisse aus der
   Geheimnis-Ablage eintragen — insbesondere `ACTIVITY_PHOTO_ENCRYPTION_KEY`
   identisch zum alten Wert, sonst sind die Fotos verloren.
2. Nur den Postgres-Dienst starten. Beim ersten Start spielt das Image
   `init-scripts/` ein (Schema ohne Daten); das stört nicht, das Skript
   ersetzt die Datenbank ohnehin.
3. Fall A ab Schritt 2. `BESTAETIGT` ist hier nicht nötig: Die frische
   Datenbank hat noch keine Konten.
4. Uploads und Firebase-Datei an ihre Pfade, Backends und Frontend starten.

### Fall C: einzelne Gemeinde oder einzelne Tabelle

`pg_restore` kann mit `-t <tabelle>` einzelne Tabellen in eine **Probe-**
Datenbank zurückholen; von dort lassen sich Zeilen per SQL in die laufende
Datenbank übertragen. Nie direkt in die laufende Datenbank restaurieren —
Fremdschlüssel und Sequenzen laufen sonst auseinander. Die Probe-Datenbank
entsteht wie bei der Rückspielprobe unten.

## Rückspielprobe

Eine Sicherung, die nie zurückgespielt wurde, ist eine Vermutung. Die Probe
kostet zwei Minuten und läuft neben der Produktion, ohne sie zu berühren —
in eine eigene Datenbank `konfi_probe` auf derselben Instanz (oder lokal in
einem `postgres:15-alpine`-Container):

```bash
PG_CONTAINER=<postgres-container> PG_DB=konfi_probe \
  DUMP=<ablage>/konfi_db_<stempel>.dump bash deploy/wiederherstellung.sh
# Zählungen mit der Produktion vergleichen, dann wegräumen:
docker exec -i <postgres-container> psql -U konfi_user -d postgres -c "DROP DATABASE konfi_probe"
```

Erwartet: kein `FEHLER`, am Ende `OK: konfi_probe wiederhergestellt.`,
Zählungen wie in der Produktion. Wer zusätzlich das Schema vergleichen will:
`node backend/scripts/schemaVergleich.js vergleichen <url-produktion> <url-probe>`
(nur Lese-Abfragen). Rhythmus: **vor jedem Release** und nach jeder Änderung
an Postgres-Version oder Sicherungsskript; das Datum der letzten Probe steht
in der Prüfliste.

**Gemessen mit der Produktion (01.10.2026)**, in einem Wegwerf-Container
`postgres:15-alpine` neben dem Stack, 169 Konten, 62 Tabellen:

| Schritt | Größe | Dauer |
|---|---|---|
| Sicherung mit `deploy/sicherung.sh` (Datenbank `-Fc` + Uploads) | 0,9 MB + 248 MB | 10,9 s |
| Einspielen mit `deploy/wiederherstellung.sh` | 0,9 MB | 1 s (2,2 s mit Prüfen und Zählen) |
| Einspielen des nächtlichen SQL-Dumps (unten) | 0,7 MB gepackt, 3,3 MB SQL | 1,25 s |
| Uploads aus dem Archiv entpacken | 411 Dateien | 2,4 s |

Ergebnis: alle 62 Tabellen zeilengleich mit der Quelle, Schema Objekt für
Objekt gleich (`schemaVergleich.js`), ein Backend gegen die Kopie startet
ohne `Migration FAILED`, Anmeldung mit Testkonten klappt, alle 408
verschlüsselten Dateien lassen sich mit dem Schlüssel der Stack-Umgebung
öffnen. Die Dauer wächst mit dem Bestand; bei der EKD-weiten Ausrollung
neu messen.

**Ältere Sicherungen als reines SQL.** Bis zum 30.09.2026 schrieb die
nächtliche Sicherung `pg_dump --clean --if-exists | gzip`, also SQL statt
`-Fc`; `deploy/wiederherstellung.sh` liest nur `-Fc`. Für so einen Dump ist
der Weg: leere Datenbank wie im Skript anlegen (Schritt 3),
dann

```bash
set -o pipefail
zcat konfi_db_<stempel>.sql.gz \
  | docker exec -i <postgres-container> psql -U konfi_user -d <zieldatenbank> -X -q -v ON_ERROR_STOP=1
```

`ON_ERROR_STOP` bricht beim ersten Fehler ab, `pipefail` macht einen
kaputten Dump zum Fehlschlag. Danach die Zählungen wie am Ende des Skripts.

Die Postgres-Version des Zielsystems muss mindestens der des Dumps
entsprechen (`pg_restore` ist abwärts-, nicht aufwärtskompatibel). Der Stack
läuft auf `postgres:15-alpine`; ein Test mit einer 16er-Instanz spielt einen
15er-Dump ein, umgekehrt nicht.

## Prüfliste für den Betrieb (Lücken füllen)

Was das Repo nicht wissen kann und der Betrieb in seiner Betriebsdoku
festhält:

- [x] Das produktive Sicherungsskript stimmt mit `deploy/sicherung.sh` in
      Vorabprüfung, `pipefail`, Größen- und Lesbarkeitsprüfung überein
      (01.10.2026); wo es liegt, steht in der Betriebsdoku.
- [x] Zweiter Ort: das tägliche Datei-Backup des Hosts und ein wöchentliches
      zweites Ziel (01.10.2026); Ablageorte in der Betriebsdoku.
- [ ] Uhrzeit 02:30 liegt im Fenster 02:00–03:30 — bei 1–2 s Laufzeit
      folgenlos gemessen; Aufbewahrung 14 Tage am Host, Wochen- und
      Jahresstände fehlen ([offene Befunde](../offene-befunde.md),
      „Aufbewahrung der Sicherungen").
- [x] Die **Uploads** sichert das tägliche Datei-Backup des Hosts, nicht das
      nächtliche Skript.
- [x] Geheimnisse und Firebase-Datei liegen in der Geheimnis-Ablage des
      Betriebs, per Prüfsumme mit dem Stack abgeglichen; Simon hat sie
      zusätzlich gesichert (01.10.2026).
- [x] Überwachung: tägliche Prüfung am Host, Push an Simon bei fehlendem oder
      zu kleinem Dump und bei zu altem Datei-Backup.
- [x] Datum der letzten Rückspielprobe: 01.10.2026 · Ergebnis: fehlerfrei,
      zeilen- und schemagleich (Tabelle oben)
- [x] Größe des jüngsten Dumps: 686.954 Byte (nächtlich, SQL gepackt,
      30.09.2026); `-Fc` 931.258 Byte (Vergleichswert für die nächste Prüfung)

Verwandt: `init-scripts/README.md` (Neuinstallation ohne Daten),
[routinen.md](routinen.md) (Rückspielprobe vor jedem Release, Notfall-Deploy),
`deploy/compose.konfi_quest.yml` (Ressourcen und Variablen des Stacks).
