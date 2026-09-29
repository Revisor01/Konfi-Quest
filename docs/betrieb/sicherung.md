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

Stand laut `docs/offene-befunde.md` Nr. 3: ein nächtlicher Dump um 2:30 mit
`pg_dump | gzip`, seit dem 10.09.2026 mit `pipefail`, Vorabprüfung der
Datenbank, Größenprüfung (unter 1 kB gilt als Fehlschlag) und Löschen
unbrauchbarer Dateien. Das Skript liegt außerhalb des Repos.

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

Die Postgres-Version des Zielsystems muss mindestens der des Dumps
entsprechen (`pg_restore` ist abwärts-, nicht aufwärtskompatibel). Der Stack
läuft auf `postgres:15-alpine`; ein Test mit einer 16er-Instanz spielt einen
15er-Dump ein, umgekehrt nicht.

## Prüfliste für den Betrieb (Lücken füllen)

Was das Repo nicht wissen kann und der Betrieb in seiner Betriebsdoku
festhält:

- [ ] Wo liegt das produktive Sicherungsskript, und stimmt es mit
      `deploy/sicherung.sh` in Vorabprüfung, `pipefail`, Größen- und
      Lesbarkeitsprüfung überein?
- [ ] Ablageordner der Dumps und der Upload-Archive; zweiter Ort (extern);
      wie die Kopie dorthin kommt.
- [ ] Uhrzeit des Laufs (nicht 02:00–03:30) und tatsächliche Aufbewahrung
      (Tage / Wochen / Jahresende).
- [ ] Werden die **Uploads** überhaupt gesichert? Wie oft, wohin?
- [ ] Wo liegen die Geheimnisse (alle sieben Variablen aus der Tabelle) und
      die Firebase-Datei — und wer kommt im Notfall daran?
- [ ] Welche Überwachung prüft Alter **und** Größe der jüngsten Sicherung,
      und wen benachrichtigt sie?
- [ ] Datum der letzten Rückspielprobe: ____________ · Ergebnis: __________
- [ ] Größe des jüngsten Dumps: ______ (Vergleichswert für die nächste Prüfung)

Verwandt: `init-scripts/README.md` (Neuinstallation ohne Daten),
`docs/offene-befunde.md` Nr. 3 (leerer Dump am 10.09.2026),
`deploy/compose.konfi_quest.yml` (Ressourcen und Variablen des Stacks).
