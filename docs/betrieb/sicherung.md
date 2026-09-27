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
liegt. Nicht in eine, in der `init-scripts/` gelaufen ist (2.825 Fehler,
`users` danach leer), und nicht mit `--clean` in eine vorinitialisierte
(141 Zeilen Schema-Reste, die kein Migrationslauf mehr repariert). Gemessen
am 26.09.2026 mit 20.000 Nutzer:innen und 490.400 Nachrichten: **leere
Datenbank → fehlerfrei in 4 s**, alle Zählungen gleich.

### Fall A: Datenbank kaputt, Server und Stack stehen noch

```bash
# 1. Backends anhalten -- sie würden sonst beim Start Migrationen gegen eine
#    halbe Datenbank fahren. In Portainer: backend, backend2, backend-test stoppen.

# 2. Datenbank leer neu anlegen (Postgres läuft weiter).
docker exec -i <postgres-container> psql -U konfi_user -d postgres <<'SQL'
DROP DATABASE IF EXISTS konfi_db;
CREATE DATABASE konfi_db OWNER konfi_user TEMPLATE template0 ENCODING 'UTF8';
SQL

# 3. Dump einspielen. --no-owner, weil der Dump mit --no-owner geschrieben ist
#    und konfi_user ohnehin alles besitzt; -j 4 nutzt die 2+ CPUs des Dienstes.
docker exec -i <postgres-container> pg_restore -U konfi_user -d konfi_db --no-owner -j 4 < konfi_db_<stempel>.dump

# 4. Zählen -- gegen die Zahlen aus der letzten Prüfung oder aus dem Log.
docker exec -i <postgres-container> psql -U konfi_user -d konfi_db -Atc \
  "SELECT (SELECT COUNT(*) FROM users), (SELECT COUNT(*) FROM konfi_profiles),
          (SELECT COUNT(*) FROM chat_messages), (SELECT COUNT(*) FROM schema_migrations)"

# 5. Uploads zurückspielen (erst leeren, dann entpacken -- kein Mischbestand).
tar -xzf uploads_<stempel>.tar.gz -C /opt/Konfi-Quest/

# 6. Backends starten. Der Migrationslauf (backend/utils/migrationslauf.js)
#    zieht alles nach, was jünger ist als der Dump -- ohne Zeitgrenze, unter
#    dem Advisory-Lock, eine Replica nach der anderen.
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
2. **Vor dem ersten Start** die Zeile
   `- /opt/Konfi-Quest/init-scripts:/docker-entrypoint-initdb.d` beim
   Postgres-Dienst auskommentieren. `init-scripts/` ist der Weg einer
   *Neuinstallation ohne Daten*; für eine Wiederherstellung legt es genau das
   Schema an, das der Dump gleich mitbringt.
3. Nur den Postgres-Dienst starten, dann Fall A ab Schritt 2 (die Datenbank
   `konfi_db` legt das Image beim ersten Start leer an — `DROP`/`CREATE` ist
   dann überflüssig, schadet aber nicht).
4. Uploads und Firebase-Datei an ihre Pfade, Backends und Frontend starten.
5. Die `init-scripts`-Zeile wieder einkommentieren — sie wirkt auf eine
   bestehende Datenbank nie mehr, gehört aber zur Referenz.

### Fall C: einzelne Gemeinde oder einzelne Tabelle

`pg_restore` kann mit `-t <tabelle>` einzelne Tabellen in eine **Probe-**
Datenbank zurückholen; von dort lassen sich Zeilen per SQL in die laufende
Datenbank übertragen. Nie direkt in die laufende Datenbank restaurieren —
Fremdschlüssel und Sequenzen laufen sonst auseinander.

## Rückspielprobe

Eine Sicherung, die nie zurückgespielt wurde, ist eine Vermutung. Die Probe
kostet zwei Minuten und läuft neben der Produktion, ohne sie zu berühren:

```bash
# Probe-Datenbank auf derselben Instanz (oder lokal in einem postgres:15-Container)
docker exec -i <postgres-container> psql -U konfi_user -d postgres -c \
  "CREATE DATABASE konfi_probe OWNER konfi_user TEMPLATE template0"
docker exec -i <postgres-container> pg_restore -U konfi_user -d konfi_probe --no-owner < konfi_db_<stempel>.dump
docker exec -i <postgres-container> psql -U konfi_user -d konfi_probe -Atc \
  "SELECT COUNT(*) FROM users UNION ALL SELECT COUNT(*) FROM chat_messages UNION ALL SELECT COUNT(*) FROM schema_migrations"
docker exec -i <postgres-container> psql -U konfi_user -d postgres -c "DROP DATABASE konfi_probe"
```

Erwartet: `pg_restore` ohne Fehlerzeile, Zählungen wie in der Produktion.
Rhythmus: **vor jedem Release** und nach jeder Änderung an Postgres-Version
oder Sicherungsskript; das Datum der letzten Probe steht in der Prüfliste.

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
