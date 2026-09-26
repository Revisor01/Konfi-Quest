# Audit Datenbank, Schema, Migrationen, Datenintegrität — 26.09.2026

## Umfang und Methode

**Geprüft:** `backend/database.js` (Pool, Migrationslauf), alle 89 Dateien in
`backend/migrations/` (vollständig gelesen), `backend/tests/schema/prod-schema.sql`,
`prod-migrations.txt`, `refresh-schema.sh`, `init-scripts/01-create-schema.sql`,
`02-migrationsstand.sql`, `README.md`, `refresh.sh`, `backend/init-scripts/007_levels.sql`,
`deploy/compose.konfi_quest.yml` (Postgres-Dienst), `backend/tests/helpers/db.js`,
`backend/tests/globalSetup.js`, `backend/tests/vitest.config.ts`,
`backend/tests/schema/*.test.js`, dazu die SQL der vier kritischen Abfragen in
`routes/chat.js`, `routes/konfi.js`, `routes/events/lesen.js`, `createApp.js` sowie alle
Stellen, die Nachrichten, Räume oder Konten hart löschen.

**Wie:** Auf PostgreSQL 16.13 (Port 5437) wurden fünf Datenbanken aufgebaut:

| DB | Aufbau | Zweck |
|---|---|---|
| `kq_neu` | `init-scripts/*.sql` wie das Postgres-Entrypoint (`psql -v ON_ERROR_STOP=1`, Autocommit) + offene Migrationen über einen Nachbau von `database.js runMigrationsLocked` (eine Transaktion pro Datei, Eintrag in `schema_migrations` in derselben Transaktion, Fehler nicht-blockierend) | Weg einer **Neuinstallation** |
| `kq_prod` | `prod-schema.sql` + `prod-migrations.txt` + offene Migrationen (derselbe Nachbau) | Weg des **Deploys** / der Testsuite |
| `kq_dump` | nur `prod-schema.sql` + Migrationsstand | Stand des Dumps vom 22.08.2026 |
| `kq_last` | Schema von `kq_prod` + 200 Organisationen, 20.000 Nutzer:innen (16.000 Konfis), 10.000 Termine, 100.000 Buchungen, 10.000 Chaträume, 46.800 Teilnahmen, 490.400 Chat-Nachrichten, 200.000 APM-Snapshots (204 MB) | Lastmessungen mit `EXPLAIN (ANALYZE, BUFFERS)` |
| `kq_lock` | Schema von `kq_prod` | Reproduktion des Migrations-Locks mit zwei Replikas |

Verglichen wurde mit `pg_dump --schema-only` und `diff`, ergänzt um Katalogabfragen
(`pg_constraint`, `pg_index`, `information_schema.columns`). Alle 89 Migrationen wurden auf
`kq_prod` ein **zweites Mal** ausgeführt (Idempotenz-Probe). Die drei Schema-Wächter
(`neuinstallation.test.js`, `schemaDrift.test.js`, `migration064Indizes.test.js`) liefen gegen
Port 5437. Eine Sicherung/Wiederherstellung wurde mit `pg_dump -Fc`/`pg_restore` geübt.
Der Migrationslauf von `database.js` wurde mit einer zweiten Sitzung, die den
Advisory-Lock hält, gegen `NODE_ENV=production` gestartet.

**Bewusst nicht geprüft:** Produktion selbst (kein Zugang; siehe „Auf Produktion
nachzumessen"), die Fachlogik der Lösch-Routinen (anderer Bereich), die vollständige
Frontend-Seite, Rechte des Datenbank-Nutzers `konfi_user` (nur in Produktion sichtbar).
Skripte, Dumps und Messprotokolle liegen im Scratchpad
(`…/scratchpad/datenbank-migrationen/`), nichts davon im Repo.

## Zusammenfassung

Schema-Quellen sind heute deckungsgleich: Neuinstallation (init-scripts + Migrationen) und
Deploy-Weg (Dump + Migrationen) ergeben Zeile für Zeile dasselbe Schema (59 Tabellen,
1 View, 89 vermerkte Migrationen, `diff` = 0 Zeilen); der alte Befund #12 ist damit behoben,
steht aber noch als „in Arbeit". Der Migrationslauf ist atomar und gegen parallele Replikas
serialisiert. Die vier kritischen Abfragen laufen bei 20.000 Nutzer:innen unter 2 ms —
mit einer Ausnahme: Die Terminliste aggregiert die View `event_booking_stats` über **alle**
Buchungen aller Gemeinden (62,6 von 105,7 ms bei 100.000 Buchungen).

Der schwerste Befund ist ein fehlender Index: `chat_messages.reply_to` trägt seit
Migration 102 `ON DELETE SET NULL`, aber keinen Index. Jede hart gelöschte Nachricht löst
einen Seq Scan über die ganze Nachrichtentabelle aus — 1000 Nachrichten eines Raums zu
löschen dauert bei 490.400 Nachrichten **31,4 s** und überschreitet damit den
`statement_timeout` von 30 s; mit Index sind es 12,6 ms. Betroffen sind Team-Chat leeren,
Raum-, Termin-, Jahrgangs-, Konto- und Organisationslöschung sowie die nächtliche
Auto-Löschung. Dazu kommen: Die zweite Replika stirbt beim Warten auf den Migrations-Lock
nach 30 s mit der irreführenden Meldung „DB nicht erreichbar"; Migrationen laufen unter
demselben 30-s-Limit und scheitern lautlos; eine Wiederherstellung aus der Sicherung ist
nirgends beschrieben und scheitert auf einer frisch aufgesetzten Instanz.

**Befunde:** 0 KRITISCH, 1 HOCH, 6 MITTEL, 10 NIEDRIG.

## Release-Empfehlung für den Bereich

**Mit Auflage.** Vor dem EKD-Rollout (nicht zwingend vor 2.3.0, weil Produktion heute
unter 11.000 Chat-Nachrichten hält): eine additive Migration mit
`CREATE INDEX IF NOT EXISTS … ON chat_messages(reply_to) WHERE reply_to IS NOT NULL` und
`… ON chat_messages(user_id)` (BF-01), und `statement_timeout` für die Migrations- und
Lock-Verbindung auf 0 setzen (BF-03/BF-04). Alles Übrige sind Härtungen ohne
Vertragsbruch.

## Befunde

### BF-01: Fremdschlüssel `chat_messages.reply_to` ohne Index — Löschen von Nachrichten skaliert mit der Tabellengröße und reißt den `statement_timeout`
- **Schwere:** HOCH
- **Fundstelle:** `backend/migrations/102_chat_rooms_cascade.sql:48-58` (ON DELETE SET NULL), `backend/migrations/064_add_missing_indexes.sql` (kein Index auf `reply_to`, keiner auf `user_id`), `backend/migrations/114_add_chat_fks.sql:7-9` (`fk_chat_messages_user` ohne Index), `backend/database.js:58` (`statement_timeout` 30 s). Harte Löschpfade: `backend/routes/chat.js:2532` (Team-Chat leeren), `chat.js:2447`, `chat.js:2453`, `chat.js:619/633/650` (Raum löschen), `backend/routes/users.js:510`, `backend/utils/konfiDeletion.js:112` (Konto- und Auto-Löschung), `backend/routes/events/verwaltung.js:909`, `backend/routes/jahrgaenge.js:409`, `backend/routes/organizations.js:777`.
- **Kennzeichnung:** reproduziert (`kq_last`, 490.400 Nachrichten):
  ```
  psql -h localhost -p 5437 -U postgres -d kq_last -c BEGIN \
    -c "EXPLAIN (ANALYZE, SUMMARY) DELETE FROM chat_messages WHERE room_id = 1" -c ROLLBACK
  ```
- **Beschreibung:** Für jede gelöschte Nachricht führt Postgres den RI-Trigger
  `chat_messages_reply_to_fkey` aus (`UPDATE chat_messages SET reply_to = NULL WHERE
  reply_to = <id>`). Ohne Index auf `reply_to` ist das ein Seq Scan über die gesamte
  Tabelle — pro Zeile. Dasselbe gilt für `fk_chat_messages_user` beim Löschen eines Kontos
  (kein Index auf `user_id`). Migration 064 hat genau diese Klasse für 30 Tabellen
  abgedeckt, `reply_to` und `user_id` von `chat_messages` fehlen; 102 und 114 haben die
  Fremdschlüssel später nachgezogen, ohne Index.
- **Auswirkung aus Nutzersicht:** Die Leitung drückt „Team-Chat leeren" oder löscht einen
  Termin mit Termin-Chat und bekommt nach 30 s einen Fehler; die Auto-Löschung eines
  Jahrgangs (DSGVO-Frist) bricht bei Konten mit vielen Nachrichten ab und läuft nachts
  ins Leere; das Löschen des eigenen Kontos (Apple-Review-Pflicht) dauert Sekunden bis
  Minuten. Heute in Produktion (unter 11.000 Nachrichten laut `database.js`-Kommentar)
  noch unauffällig — bei 25.000 Nutzer:innen ist eine halbe Million Nachrichten im
  ersten Jahr realistisch.
- **Beleg:**

  | Vorgang | ohne Index | mit Index (Gegenprobe) |
  |---|---|---|
  | 1000 Nachrichten eines Raums löschen | **31.408 ms** (Trigger `reply_to_fkey`: 31.343 ms, 1000 Aufrufe) | 12,6 ms |
  | Raum mit 1000 Nachrichten löschen (CASCADE) | 30.671 ms | — |
  | Konto mit 47 Nachrichten löschen | 2.445 ms (`fk_chat_messages_user` 52 ms Seq Scan + `reply_to_fkey` 2.325 ms) | 50,5 ms |
  | Eine Nachricht hart löschen | 29,2 ms | 0,85 ms |
  | `CREATE INDEX` auf 490.400 Zeilen | 139 ms (`reply_to`, partiell) / 180 ms (`user_id`) | |

  Der Katalog nennt 42 Fremdschlüssel-Spalten ohne führenden Index
  (`scratchpad/…/katalog_kq_prod.txt`, Abschnitt 9); die übrigen 40 liegen auf kleinen
  Tabellen oder werden nicht in Löschkaskaden großer Tabellen berührt.
- **Empfehlung:** Additive Migration `160_chat_messages_reply_to_user_id_indizes.sql`:
  `CREATE INDEX IF NOT EXISTS idx_chat_messages_reply_to ON chat_messages(reply_to) WHERE reply_to IS NOT NULL;`
  und `CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id ON chat_messages(user_id);`
  Test, der mit ≥ 100.000 Nachrichten ein `DELETE … WHERE room_id` unter 1 s verlangt.

### BF-02: Terminliste aggregiert die View `event_booking_stats` über alle Buchungen aller Gemeinden
- **Schwere:** MITTEL
- **Fundstelle:** `backend/routes/events/lesen.js:163` (LATERAL auf die View in `GET /events`), `lesen.js:407`, `lesen.js:602`, `lesen.js:782`, `backend/routes/konfi.js:1258`, `konfi.js:1393`; View-Definition `backend/migrations/154_event_booking_stats_abmeldung.sql:60-107`
- **Kennzeichnung:** reproduziert (`scratchpad/…/explain_events.sql` gegen `kq_last`)
- **Beschreibung:** Die View gruppiert `event_bookings JOIN users LEFT JOIN roles` nach
  `event_id`. Mit einer Konstante (`WHERE event_id = 7`) schiebt der Planer den Filter in
  die Gruppierung (0,16 ms). Im LATERAL/LEFT JOIN der Listen wird stattdessen die
  **gesamte** View berechnet (HashAggregate über 100.000 Buchungen → 10.000 Gruppen) und
  dann gegen die 50 Termine der Gemeinde geprüft. Die Laufzeit hängt damit an der Summe
  aller Buchungen aller Gemeinden, nicht an der eigenen.
- **Auswirkung aus Nutzersicht:** Heute (938 Buchungen in Produktion) im
  Millisekundenbereich. Bei EKD-Größe (25.000 Nutzer:innen × ~40 Buchungen/Jahr ≈ 1 Mio.)
  hochgerechnet ~0,6 s Datenbankzeit je Aufruf der Terminliste — für jede Konfi, jede
  Teamerin, jede Leitung, bei jedem Öffnen des Termin-Reiters, auf einer Datenbank mit
  0,3 CPU (BF-07).
- **Beleg:** `GET /events` (org 1, 50 Termine): **105,7 ms** seriell (97,5 ms mit
  Parallel-Scan). Davon LATERAL auf die View: **62,6 ms** (`HashAggregate rows=10000`,
  `Seq Scan on event_bookings rows=100000`). Dieselben Zahlen als direkte Aggregation je
  Termin (`SELECT COUNT(*) FILTER … WHERE eb.event_id = e.id`): **1,6 ms**. Faktor 40.
- **Empfehlung:** Die View als SQL-Funktion mit Parameter (`event_booking_stats(event_id)`)
  oder als Unterabfrage mit `WHERE eb.event_id = e.id` **innerhalb** der Gruppierung
  anbieten und in den sechs Aufrufstellen nutzen; die View für Einzelabrufe stehen lassen
  (Antwortform unverändert). Testfall mit ≥ 100.000 Buchungen und Laufzeitgrenze.

### BF-03: Zweite Replika stirbt beim Warten auf den Migrations-Lock nach 30 s — mit der Meldung „DB nicht erreichbar"
- **Schwere:** MITTEL
- **Fundstelle:** `backend/database.js:58-59` (Pool-weiter `statement_timeout`/`query_timeout` 30 s), `database.js:86` (`pg_advisory_lock` auf einer Pool-Verbindung), `database.js:174-182` (Fehlerpfad → `process.exit(1)`)
- **Kennzeichnung:** reproduziert:
  ```
  psql -h localhost -p 5437 -U postgres -d kq_lock -c "SELECT pg_advisory_lock(723001); SELECT pg_sleep(50);" &
  cd backend && DATABASE_URL=postgresql://postgres:postgres@localhost:5437/kq_lock NODE_ENV=production \
    node -e "require('./database.js'); setTimeout(()=>process.exit(0), 45000)"
  ```
  Ergebnis: `Database startup failed (DB nicht erreichbar): error: canceling statement due
  to statement timeout` (Code 57014), **Exit 1 nach 31 s**.
- **Beschreibung:** Der Advisory-Lock (Audit 03.07.2026) serialisiert die Migrationsläufe
  korrekt. Die wartende Replika ruft `pg_advisory_lock` aber über eine Pool-Verbindung mit
  `statement_timeout = 30 s` auf. Dauert der Lauf der ersten Replika länger als 30 s (eine
  Datenmigration über eine große Tabelle, ein Index bei 0,3 CPU), bricht Postgres den
  Lock-Aufruf ab; `database.js` wertet das als unerreichbare Datenbank und beendet den
  Prozess. `restart: unless-stopped` startet den Container neu, der wieder 30 s wartet —
  bis die erste Replika fertig ist.
- **Auswirkung aus Nutzersicht:** Während eines Deploys mit langer Migration bedient nur
  eine Replika, die zweite pendelt in einer Neustart-Schleife; wer den Fehler im Log
  sieht, sucht am falschen Ort (Datenbank statt Migration). Kein Datenverlust.
- **Beleg:** Siehe Reproduktion; Log in `scratchpad/…/replika2.log`.
- **Empfehlung:** Auf der Lock-Verbindung vor dem Lock `SET statement_timeout = 0` und in
  `runMigrationsLocked` die Migrationsverbindung ebenso (siehe BF-04); den Fehlertext
  unterscheiden („Migrations-Lock nicht bekommen" vs. „DB nicht erreichbar"). Test: Lock
  halten, Start muss warten statt sterben.

### BF-04: Migrationen laufen unter 30-s-`statement_timeout`, ein Fehlschlag ist nicht-blockierend und außer im Container-Log unsichtbar
- **Schwere:** MITTEL
- **Fundstelle:** `backend/database.js:53-63` (Pool-Optionen gelten für alle Verbindungen, auch die Migrationsverbindung), `database.js:136-152` (Fehler → `failed.push`, Server startet), `backend/createApp.js:436-505` (`/api/status`, `/api/metrics*` kennen keinen Migrationsstand; `schema_migrations` wird außerhalb von `database.js` nirgends gelesen), `deploy/compose.konfi_quest.yml` (Logs `json-file`, 3 × 10 MB)
- **Kennzeichnung:** aus Code gelesen; Größenordnung gemessen (`CREATE INDEX` über 490.400 Zeilen: 139–180 ms auf unbegrenzter CPU)
- **Beschreibung:** Jede Migration läuft korrekt in einer Transaktion und wird bei Fehler
  komplett zurückgerollt (Lehre aus Incident 13.06.2026 umgesetzt). Aber: Jedes einzelne
  Statement unterliegt dem Pool-weiten `statement_timeout` von 30 s. Ein Statement, das
  auf EKD-Datenmengen länger braucht (Backfill-`UPDATE` wie in 117/132/143, `CREATE INDEX`
  ohne `CONCURRENTLY` auf Millionen Zeilen bei 0,3 CPU), scheitert — und der Server startet
  **trotzdem** mit dem alten Schema, während der neue Code die neue Spalte erwartet. Der
  einzige Hinweis ist `console.error` im Container-Log; `/api/status` meldet `database: ok`.
- **Auswirkung aus Nutzersicht:** Nach einem Deploy liefern genau die Routen 500, die die
  neue Migration voraussetzen (z. B. Terminliste nach einer Spaltenergänzung), während
  Login und alles andere funktionieren — der Fehler sieht aus wie ein Code-Bug, nicht wie
  eine fehlende Spalte, und niemand wird benachrichtigt.
- **Beleg:** `database.js:58` setzt `statement_timeout` im Pool; `runMigrationsLocked`
  nimmt `pool.connect()` ohne Ausnahme (Z. 134). Kommentar Z. 143-149 beschreibt die
  Nicht-Blockierung als bewusste Forderung.
- **Empfehlung:** Auf der Migrationsverbindung `SET statement_timeout = 0` und
  `SET lock_timeout = '10s'` vor `BEGIN`; die Zahl fehlgeschlagener/ausstehender Migrationen
  in `/api/status` (oder `/api/metrics/local`) ausgeben und im Deploy-Verify
  (`deploy/rolling-deploy.sh`) prüfen; Test: Migration mit `SELECT pg_sleep(35)` läuft durch.

### BF-05: Wiederherstellung aus der Sicherung ist nirgends beschrieben und scheitert auf einer frisch aufgesetzten Instanz
- **Schwere:** MITTEL
- **Fundstelle:** `deploy/compose.konfi_quest.yml:17-52` (kein Sicherungsdienst, kein Hinweis auf Wiederherstellung), `init-scripts/README.md` (beschreibt nur Neuinstallation), `docs/offene-befunde.md` #3 (Sicherungsskript liegt außerhalb des Repos)
- **Kennzeichnung:** reproduziert (`pg_dump -Fc` von `kq_last`, 10,5 MB in 2 s; drei Wiederherstellungen)
- **Beschreibung:** Das Repo enthält weder Sicherungsskript noch Wiederherstellungsanleitung
  (der Grep über `pg_dump|pg_restore|backup|sicherung|wiederherstell` findet außer
  `refresh-schema.sh` nichts). Der naheliegende Weg — neue Instanz per Compose hochfahren,
  Dump einspielen — scheitert, weil `init-scripts/` beim ersten Start bereits das Schema
  anlegt.
- **Auswirkung aus Nutzersicht:** Im Ernstfall (Ausfall wie am 09./10.09.2026) muss die
  Wiederherstellung unter Druck erst erarbeitet werden; ein `--clean`-Restore in eine
  vorinitialisierte Instanz hinterlässt ein abweichendes Schema, das der nächste
  Migrationslauf nicht mehr repariert.
- **Beleg:**

  | Ziel | Ergebnis |
  |---|---|
  | leere DB (`CREATE DATABASE`, dann `pg_restore`) | **fehlerfrei, 4 s**, alle Zählungen gleich (20.000 / 490.400 / 100.000 / 89), Schema-Diff nur 3 kosmetische CHECK-Schreibweisen |
  | DB, in der `init-scripts/` bereits liefen | **2.825 Fehlerzeilen**, 375 × „already exists", `users` danach 0 Zeilen |
  | dieselbe DB mit `--clean --if-exists` | 72 Fehler, Daten vollständig, aber **141 Diff-Zeilen** Schema-Reste (`material_tags`, `material_file_tags` samt FKs und Indizes) |

- **Empfehlung:** Eine Seite `docs/wissen/` oder `deploy/README`: Sicherung (Format, Ort,
  Prüfung auf Größe — wie in #3 beschrieben) **und** Wiederherstellung: Datenbank leeren
  (`DROP DATABASE` / Volume ohne `init-scripts`), `pg_restore`, danach Backend starten. Das
  Sicherungsskript ins Repo (ohne Adressen), eine Restore-Übung als Teil des Release.

### BF-06: `konfi_profiles.password_plain` — eine Spalte für Klartext-Passwörter Minderjähriger existiert weiter und wird nur noch geleert, nie entfernt
- **Schwere:** MITTEL (wird KRITISCH, falls die Spalte in Produktion Werte enthält — siehe „Auf Produktion nachzumessen")
- **Fundstelle:** `backend/tests/schema/prod-schema.sql` (Spalte `password_plain text` an `konfi_profiles`, einziges DDL im Repo), `backend/routes/konfi-management.js:681` (`UPDATE konfi_profiles SET password_plain = NULL …` — einzige Code-Stelle), `backend/tests/schema/schemaDrift.test.js` (Test verlangt die Existenz der Spalte)
- **Kennzeichnung:** aus Code und Dump gelesen
- **Beschreibung:** Die Spalte wurde in Produktion von Hand angelegt; kein Code schreibt sie
  mehr, einer setzt sie beim Passwort-Reset auf NULL. Alte Werte — Klartext-Passwörter von
  Konfis aus der Zeit vor dem Hashing — bleiben in jeder Zeile stehen, in der nie ein Reset
  lief, und wandern mit jeder Sicherung mit. Jede Neuinstallation (Dump als Vorlage) bekommt
  die Spalte ebenfalls.
- **Auswirkung aus Nutzersicht:** Wer die Datenbank oder eine Sicherung lesen kann, liest
  gegebenenfalls Passwörter 13-Jähriger im Klartext.
- **Beleg:** Grep über `backend/` ohne Tests: genau eine Fundstelle (`konfi-management.js:681`),
  kein INSERT, kein SELECT.
- **Empfehlung:** Zuerst in Produktion zählen (SQL unten). Dann Migration: `UPDATE
  konfi_profiles SET password_plain = NULL` (additiv, sofort) und nach Freigabe
  `ALTER TABLE konfi_profiles DROP COLUMN password_plain` (kein Client liest die Spalte);
  den `schemaDrift`-Test entsprechend umdrehen.

### BF-07: Postgres im Compose ist auf die heutige Gemeinde bemessen, nicht auf 10.000–25.000 Nutzer:innen
- **Schwere:** MITTEL
- **Fundstelle:** `deploy/compose.konfi_quest.yml:17` (`postgres:15-alpine`), `:25` (`max_connections=200`), `:45-46` (`memory: 1G`, `cpus: '0.3'`), Kommentar `:18-24` („rechnerisch reichen sie für ~90 gleichzeitige")
- **Kennzeichnung:** aus Code gelesen; alle Messwerte dieses Berichts entstanden auf einer unbegrenzten CPU und sind für 0,3 CPU nach unten zu korrigieren
- **Beschreibung:** Die Datenbank für drei Backend-Container und die gesamte EKD teilt sich
  0,3 CPU-Kerne, 1 GB RAM (davon `shared_buffers` Default 128 MB) und 200 Verbindungen, die
  laut eigenem Kommentar nicht durch Speicher gedeckt sind. Es gibt keinen Sicherungs-
  oder Monitoring-Dienst (kein `pg_stat_statements`), keine Autovacuum-Anpassung für die
  schreibintensive `chat_messages`.
- **Auswirkung aus Nutzersicht:** Jede CPU-gebundene Abfrage (BF-01, BF-02, Wrapped-Läufe)
  wird bei Last mindestens um den Faktor 3 langsamer als hier gemessen; Verbindungsspitzen
  von drei Pools à 20–50 treffen auf eine Datenbank mit 128 MB Cache für 204 MB Daten (bei
  der hier simulierten Größe).
- **Beleg:** Compose-Zeilen oben; `kq_last` belegt 204 MB bei 490.400 Nachrichten
  (`chat_messages` 52 MB + 40 MB Indizes).
- **Empfehlung:** Vor dem Rollout Lastprofil festlegen und CPU/RAM/`shared_buffers`
  (≥ 25 % RAM), `work_mem`, `max_connections` daran ausrichten; `pg_stat_statements`
  aktivieren; Sicherung als Dienst in den Stack.

### BF-08: Fünf von 89 Migrationen sind nicht idempotent — entgegen ihren eigenen Kommentaren
- **Schwere:** NIEDRIG
- **Fundstelle:** `backend/migrations/064_add_missing_fks.sql:16-26` (`DELETE … WHERE konfi_id …` auf Spalten, die 077 in `user_id` umbenennt; Kommentar Z. 4: „idempotent"), `064_add_missing_indexes.sql:122` (`idx_activity_requests_konfi_id ON activity_requests(konfi_id)`), `128_event_booking_stats_view.sql:30`, `136_event_booking_stats_leitung.sql:18` (`CREATE OR REPLACE VIEW` mit weniger Spalten als die spätere View → „cannot drop columns from view"), `132_bibeluebersetzung_eine_spalte.sql:29-38` (liest `kp.bible_translation` nach ihrem eigenen `DROP COLUMN`)
- **Kennzeichnung:** reproduziert (`node migrieren.js …/kq_prod erneut`: 84 OK, 5 FEHL; Protokoll `scratchpad/…/idempotenz_kq_prod.log`)
- **Beschreibung:** `database.js` führt vermerkte Migrationen nie erneut aus, deshalb keine
  Folge im Regelbetrieb. Wer aber `schema_migrations` von Hand bereinigt oder eine
  Migration bewusst wiederholt, bekommt Fehler an Stellen, die sich selbst als
  wiederholbar ausgeben.
- **Auswirkung aus Nutzersicht:** keine direkte.
- **Beleg:** `FEHL 064_add_missing_fks.sql: column "konfi_id" does not exist`,
  `FEHL 128_event_booking_stats_view.sql: cannot drop columns from view`,
  `FEHL 132_…: column kp.bible_translation does not exist` (drei Beispiele aus dem Log).
- **Empfehlung:** Kommentare in 064 korrigieren; für 128/136 nichts tun (sie sind durch
  154 überholt). Übrige 84 Dateien laufen zweimal fehlerfrei — das ist der Normalfall und
  gut.

### BF-09: 42 redundante Indizes, davon 9 exakte Doppelgänger
- **Schwere:** NIEDRIG
- **Fundstelle:** Katalog `kq_prod` (Abschnitt 10 in `scratchpad/…/katalog_kq_prod.txt`); Ursprung u. a. `064_add_missing_indexes.sql` neben den `sqlite_autoindex`-Altlasten, `097_…:25` + `064_consolidate_inline_schemas.sql:140` (zweimal UNIQUE auf `settings(organization_id, key)`), `124_…:24-28` (UNIQUE-Constraint **und** gleicher Index auf `daily_verses`), `116_drop_duplicate_indexes.sql` (entfernte nur 3)
- **Kennzeichnung:** reproduziert (Katalogabfrage auf `kq_last`)
- **Beschreibung:** Exakt gleiche Definition: `activity_categories` (2×UNIQUE),
  `chat_poll_votes`, `chat_polls`, `daily_verses`, `konfi_profiles(user_id)` (464 kB),
  `levels`, `notifications`, `password_resets`, `settings` (80 kB). Präfix-redundant
  (Einzelspalte, die als erste Spalte eines anderen Index vorliegt): 33 Fälle, darunter
  `idx_chat_messages_room_id` (4,8 MB neben `idx_chat_messages_room_created`),
  `idx_event_bookings_event_id`/`_user_id` (je 1,6 MB), `idx_chat_participants_room_id`
  (0,9 MB), `idx_users_organization_id` (dreifach abgedeckt).
- **Auswirkung aus Nutzersicht:** keine sichtbare; jede Nachricht und jede Buchung wird
  in einen Index mehr geschrieben, Sicherungen und Autovacuum arbeiten mehr.
- **Beleg:** `chat_messages`: 52 MB Tabelle, 40 MB Indizes bei 490.400 Zeilen.
- **Empfehlung:** Nach Prüfung von `pg_stat_user_indexes.idx_scan` in Produktion eine
  Hygiene-Migration `DROP INDEX IF EXISTS …` für die 9 Doppelgänger; die Präfix-Fälle
  einzeln bewerten (ein Einzelspalten-Index ist kleiner und kann gewollt sein).

### BF-10: `settings` hat keinen Primärschlüssel; mit `organization_id = NULL` sind Duplikate möglich
- **Schwere:** NIEDRIG
- **Fundstelle:** `backend/migrations/064_consolidate_inline_schemas.sql:138-140` (`DROP CONSTRAINT IF EXISTS settings_pkey`, danach nur UNIQUE `(organization_id, key)` mit nullbarer `organization_id`); Katalog Abschnitt 1 (auch `socket_io_attachments` ohne PK — Adapter-Tabelle, hinnehmbar)
- **Kennzeichnung:** reproduziert: `INSERT INTO settings (key, value, organization_id) VALUES ('probe','a',NULL), ('probe','b',NULL)` → 2 Zeilen
- **Beschreibung:** Ein UNIQUE-Index behandelt NULL-Werte als verschieden. Globale
  Einstellungen ohne Organisation können mehrfach existieren; welche die App liest, ist
  dann Zufall der Sortierung.
- **Auswirkung aus Nutzersicht:** nur, falls jemals globale Settings geschrieben werden
  (heute schreibt der Code nur org-gebundene).
- **Empfehlung:** `organization_id NOT NULL` setzen (in Produktion vorher zählen) und die
  UNIQUE als Primärschlüssel führen.

### BF-11: 24 Zeitspalten ohne Zeitzone, neue Migrationen legen weiter `TIMESTAMP` an, zwei `created_at` sind TEXT
- **Schwere:** NIEDRIG
- **Fundstelle:** Katalog Abschnitt 6 (24 Spalten `timestamp without time zone`, u. a. `notifications.created_at`/`read_at` — angezeigt im Postfach —, `users.deleted_at`, `refresh_tokens.expires_at`); `backend/migrations/124_…:23` (`daily_verses.created_at TIMESTAMP`), `142_…:42` (`material_links.created_at TIMESTAMP`) — beide **nach** der Lehre aus `138_…`/`139_…`; `backend/tests/schema/prod-schema.sql` (`event_bookings.created_at text DEFAULT CURRENT_TIMESTAMP`, `event_timeslots.created_at text`), sortiert in `backend/utils/bookingUtils.js:495-499` (Warteliste rückt nach `ORDER BY eb.created_at` nach), `routes/events/anwesenheit.js:86`, `routes/events/lesen.js:742`
- **Kennzeichnung:** aus Dump und Code gelesen
- **Beschreibung:** Die Werte sind heute richtig, weil Datenbank **und** Node in
  `Europe/Berlin` laufen (Compose setzt `TZ`/`PGTZ` beidseitig) — genau die Kopplung, die
  139 als Ursache des damaligen Fehlers benennt. Die Textspalten sortieren lexikalisch;
  das trägt bei ISO-Format und gleicher Zone, ist aber kein Zeitvergleich. Der Kommentar in
  `vitest.config.ts`, `event_date` sei `timestamptz`, ist richtig (`prod-schema.sql:976`).
- **Auswirkung aus Nutzersicht:** keine, solange die Zonen gleich bleiben; ein Betrieb in
  UTC (zweite Landeskirche, anderer Hoster) verschiebt Postfach-Zeiten um zwei Stunden.
- **Empfehlung:** Neue Spalten konsequent `TIMESTAMPTZ`; die angezeigten
  (`notifications.*`) nach dem Muster von 138 migrieren; die TEXT-Spalten mittelfristig
  nach 138-Muster in `timestamptz` wandeln (`USING created_at::timestamptz`).

### BF-12: Typmischung integer/bigint an 55 Fremdschlüsseln, zwei Sequenzen tragen alte Tabellennamen
- **Schwere:** NIEDRIG
- **Fundstelle:** Katalog Abschnitte 7/8/12: 55 FK-Spalten `integer` auf `bigint`-Ziele (alle Tabellen ab Migration 068), umgekehrt `konfi_profiles.invite_code_id bigint → invite_codes.id integer`; 30 Tabellen mit `bigint`-PK, 29 mit `integer`; `user_badges.id` läuft über `konfi_badges_id_seq`, `user_activities.id` über `konfi_activities_id_seq`; `backend/migrations/159_gemeinde_einladungen.sql:30-38` legt weiter `INTEGER REFERENCES users(id)` an; `backend/database.js:7` (`parseInt` auf bigint)
- **Kennzeichnung:** aus Dump/Code gelesen
- **Beschreibung:** Funktional unkritisch — Postgres vergleicht `integer = bigint`
  indexgestützt, und kein Wert erreicht 2³¹; `parseInt` ist bis 2⁵³ exakt, Sequenzen
  erreichen das nie. Es ist die SQLite-Herkunft, die sich in jeder neuen Tabelle fortsetzt.
- **Empfehlung:** In neuen Migrationen `BIGINT REFERENCES …` verwenden; sonst nichts.

### BF-13: Veraltete Doku und Kommentare zum Schema
- **Schwere:** NIEDRIG
- **Fundstelle:** `docs/offene-befunde.md:429` (#12 „IN ARBEIT" — behoben mit Commit `a5230d86`, 16.09.2026; heute 0 Diff-Zeilen), `init-scripts/README.md:48`, `backend/tests/globalSetup.js:37`, `backend/tests/schema/refresh-schema.sh:7` (dreimal „für daily_verses, activities.category … existiert nirgends ein DDL" — `124_daily_verses_und_activities_category.sql` liefert es seit 22.08.2026; nur `password_plain` hat weiter keins), `backend/init-scripts/007_levels.sql` (tot: nirgends eingebunden, `INTEGER`/`TIMESTAMP`-Typen, wird per `COPY . .` ins Image kopiert; Kommentar in `085_…:2` verweist noch darauf)
- **Kennzeichnung:** reproduziert (Diff `kq_neu` vs. `kq_prod` = 0 Zeilen; Grep)
- **Auswirkung aus Nutzersicht:** keine; die nächste Sitzung sucht an falscher Stelle.
- **Empfehlung:** #12 als behoben markieren (mit Datum und der Zahl 0 Diff-Zeilen), die
  drei Kommentare auf `password_plain` verengen, `007_levels.sql` löschen.

### BF-14: Produktions-SSH-Ziel im öffentlichen Repo
- **Schwere:** NIEDRIG
- **Fundstelle:** `backend/tests/schema/refresh-schema.sh:23-24` (`SERVER="${KQ_PROD_SSH:-root@kkd-fahrtenbuch.de}"`, `CONTAINER="${KQ_PROD_DB_CONTAINER:-kq-postgres}"`); `CLAUDE.md` „Betriebswissen (Serveradressen, Zugangsdaten, SSH) gehört nicht hierher"
- **Kennzeichnung:** aus Code gelesen
- **Beschreibung:** Hostname, Root-Login und Containername der Produktionsdatenbank stehen
  als Vorgabewerte im Repo. Kein Geheimnis, aber Angriffsfläche und ein Verstoß gegen die
  Projektregel.
- **Empfehlung:** Vorgaben entfernen (`: "${KQ_PROD_SSH:?}"`), Werte in
  `.claude/settings.local.json` oder der Betriebsdoku.

### BF-15: Der Neuinstallations-Wächter vergleicht keine Indizes, Fremdschlüssel, UNIQUE, Defaults und NOT NULL
- **Schwere:** NIEDRIG
- **Fundstelle:** `backend/tests/schema/neuinstallation.test.js:126-146` (vier Abfragen: Tabellen, Spalten+Typ, CHECKs, Views)
- **Kennzeichnung:** aus Code gelesen; per `pg_dump`-Diff heute keine Abweichung
- **Beschreibung:** Der Test hat den Anlass (25 statt 57 Tabellen, falsche CHECKs) im Blick,
  würde aber einen fehlenden Index, eine andere Löschregel oder ein fehlendes UNIQUE
  zwischen Neuinstallation und Deploy-Weg nicht sehen.
- **Empfehlung:** Zusätzlich `pg_indexes.indexdef`, `pg_get_constraintdef` für `contype IN
  ('f','u','p')`, `column_default` und `is_nullable` vergleichen — oder schlicht beide
  `pg_dump --schema-only` diffen (so wurde hier gemessen).

### BF-16: `/api/metrics/history?days=730` liefert 200.000 Zeilen (31 MB JSON)
- **Schwere:** NIEDRIG
- **Fundstelle:** `backend/createApp.js:487-505` (`days` bis 730, keine Verdichtung, kein LIMIT); Schreiber `backend/services/backgroundService.js:1555` (alle 5 Minuten), Aufbewahrung 2 Jahre (`:1569`)
- **Kennzeichnung:** reproduziert (`kq_last`, 200.000 Snapshots): 7 Tage 0,84 ms; 730 Tage **46,2 ms**, 200.000 Zeilen, **31 MB** JSON
- **Auswirkung aus Nutzersicht:** nur `super_admin`; Browser und Backend-Heap (512 MB
  Limit) tragen 31 MB je Aufruf.
- **Empfehlung:** Serverseitig auf Stunden-/Tagesmittel verdichten, sobald `days > 30`.

### BF-17: Der Test-Dump ist fünf Wochen alt; ob Produktion heute dem Repo entspricht, ist aus dem Repo nicht belegbar
- **Schwere:** NIEDRIG
- **Fundstelle:** `backend/tests/schema/prod-schema.sql:6` („Dumped from database version 15.19", letzter Commit `4ddb1c74`/`6245925a` vom 22.08.2026), `prod-migrations.txt` (53 Einträge bis `123_…`), `backend/migrations/` (89 Dateien; 36 jünger als der Dump)
- **Kennzeichnung:** aus Repo gelesen
- **Beschreibung:** Test-DB und Neuinstallation sind Dump + 36 Migrationen. Das entspricht
  Produktion **genau dann**, wenn dort seit dem 22.08. nichts von Hand geändert wurde —
  die Vorgeschichte (`daily_verses`, `password_plain`, `activities.category`) zeigt, dass
  das vorkam. Die Refresh-Skripte setzen Prod-Zugang voraus und liefen seit fünf Wochen
  nicht.
- **Empfehlung:** Vor dem Release `refresh-schema.sh` + `init-scripts/refresh.sh` laufen
  lassen und den Diff des neuen Dumps gegen `scratchpad/…/kq_prod.schema.sql` prüfen
  (erwartet: nur Reihenfolge/Kosmetik).

## Unklar

- **Produktionsschema heute:** Der Dump ist vom 22.08.2026. Ob Produktion heute exakt
  Dump + 36 Migrationen ist, lässt sich nur dort messen (SQL unten).
- **Inhalt von `password_plain`:** Ob und wie viele Zeilen noch Klartext tragen, ist nur
  in Produktion zählbar; davon hängt ab, ob BF-06 KRITISCH ist.
- **Erst-Einrichtung einer neuen Instanz:** Das Schema entsteht korrekt, aber
  `permissions`, `roles`, `organizations` und der erste `super_admin` haben im Live-Pfad
  keinen Seed (Grep: `INSERT INTO permissions` nur im toten `007_levels.sql`). Wie eine
  Landeskirche den ersten Zugang bekommt, ist im Repo nicht beschrieben — nicht vertieft,
  gehört zur Betriebsdoku.
- **Wirkung von 0,3 CPU:** Alle Zeiten hier stammen von einer unbegrenzten CPU; der Faktor
  in Produktion ist nur dort messbar.
- **Fremde Änderung im Arbeitsbaum:** `git status` zeigt `backend/routes/events/lesen.js`
  als geändert (`WHERE e.id = $1 AND e.organization_id = $2` → `AND ($2::int IS NOT
  NULL)`, also Wegfall der Mandantenprüfung im Termin-Detail). Diese Änderung stammt
  **nicht** aus diesem Audit (hier wurde nur gelesen); vermutlich ein Reproduktionsversuch
  eines anderen Prüfers. Die Koordination sollte sie zuordnen und verwerfen.

## Alte Befunde nachgeprüft

| Befund | Stand heute |
|---|---|
| `docs/offene-befunde.md` #12 „init-scripts weicht vom Produktionsschema ab — IN ARBEIT" | **behoben bestätigt** (Commit `a5230d86`, 16.09.2026): Neuinstallation und Deploy-Weg ergeben identische Schemata, `diff` = 0 Zeilen, 59 Tabellen, 1 View, 89 vermerkte Migrationen. Eintrag noch nicht aktualisiert (BF-13). |
| `docs/offene-befunde.md` #3 „Nächtlicher Dump war leer — BEHOBEN" | **nicht prüfbar**: Sicherungsskript und Überwachung liegen außerhalb des Repos. Wiederherstellung hier geübt (BF-05). |
| `database.js` Kommentar „Advisory-Lock (Audit 03.07.2026): Replikas rasten sonst um Migrationen" | **umgesetzt**, aber mit Nebenwirkung unter `statement_timeout` (BF-03). |
| `database.js`/`globalSetup.js` Kommentar „Incident 13.06.2026: 097/098/099 ausgeführt, aber nicht als applied vermerkt" | **behoben bestätigt**: `BEGIN` → SQL → `INSERT schema_migrations` → `COMMIT` auf einer dedizierten Verbindung (`database.js:136-139`); Fehler rollt alles zurück (reproduziert über die 5 nicht idempotenten Dateien: kein Halbzustand, kein Eintrag). |
| `vitest.config.ts` Kommentar „`event_date` ist in Produktion `timestamp with time zone`" | **bestätigt** (`prod-schema.sql:976`). |
| `064_add_missing_indexes.sql` Kommentar „Audit 14.09.2026: Indizes gegen fehlende Tabellen abgesichert" | **bestätigt**: `migration064Indizes.test.js` grün (5 Tests). |
| `133_chat_reaktionen_teamer_erlauben.sql` „VOR DEM AUSROLLEN GEGEN PRODUKTION GEGENPRÜFEN" | nur in Produktion prüfbar (SQL im Kommentar der Migration). |
| `refresh-schema.sh`/`README.md`/`globalSetup.js` „nirgends ein DDL für daily_verses, activities.category, password_plain" | **teilweise überholt**: 124 liefert DDL für zwei der drei Objekte (BF-13). |

## Geprüft und in Ordnung

- **Drei Schema-Quellen deckungsgleich** (Neuinstallation vs. Deploy-Weg): `pg_dump --schema-only` beider Datenbanken, `diff` = **0 Zeilen**; 59 Tabellen, 1 View (`event_booking_stats`), 89 Einträge in `schema_migrations`. Wer eine Landeskirche frisch aufsetzt, bekommt heute exakt das Schema der Testsuite. (`scratchpad/…/aufbau.sh`)
- **Offene Migrationen laufen auf beiden Wegen fehlerfrei**: 36 Dateien (`124_…` bis `159_…`) je einmal auf `kq_neu` und `kq_prod`, 0 Fehler, jede unter 20 ms. Die 53 Einträge in `02-migrationsstand.sql` stimmen mit `prod-migrations.txt` überein (generiert).
- **Schema-Wächter grün**: `neuinstallation.test.js`, `schemaDrift.test.js`, `migration064Indizes.test.js` — 36/36 Tests gegen Port 5437 (6,1 s). Der CI-Lauf (`.github/workflows/ci.yml:116`) führt sie mit; `init-scripts/**` ist Auslöser (`ci.yml:10`).
- **Idempotenz**: 84 von 89 Migrationen laufen ein zweites Mal fehlerfrei (Ausnahmen BF-08).
- **Migrationslauf atomar** (`database.js:134-155`): eine dedizierte Verbindung, `BEGIN`/SQL/`INSERT`/`COMMIT`; keine Migration enthält eigenes `BEGIN;`/`COMMIT;` (alle 26 `BEGIN`-Treffer sind `DO $$ … BEGIN`-Blöcke), keine nutzt nicht-transaktionales DDL (`CREATE INDEX CONCURRENTLY`, `VACUUM`).
- **Zwei Replikas**: Advisory-Lock 723001 serialisiert, `schema_migrations` wird **nach** dem Lock gelesen (`database.js:106-111`) — die zweite Replika überspringt sauber (Einschränkung BF-03).
- **Reihenfolge der drei `064_*`**: rein alphabetisch (`fks` → `indexes` → `consolidate`). Auf jedem unterstützten Weg (Dump oder init-scripts) sind alle drei als angewandt vermerkt und laufen nie; für den Fall eines Laufs auf einer Rohdatenbank sind die Index-Statements der später angelegten Tabellen per `to_regclass`-Guard abgesichert (Test grün). Kein Handlungsbedarf.
- **Additivität der 89 Migrationen** (jede gelesen): Destruktive Schritte sind `090` (`DROP TABLE badges`, 0 Zeilen gemessen), `130` (`material_tags`, 1 Testzeile gemessen), `131` (`DELETE settings`, 0 Zeilen), `132` (`DROP COLUMN konfi_profiles.bible_translation` nach Übernahme), `113`/`116` (funktionslose Zwillings-FKs/-Indizes), `097` (globale UNIQUE → pro Org, mit Deduplizierung), `100`/`095`/`110`/`111` (Dedupe/Waisen vor Constraint). Alle mit Produktionsmessung im Kommentar; kein `RENAME` auf einer von Apps gelesenen Antwortform, `NOT NULL` nur mit Backfill (`082`) oder Default (`115` nach Bestandsprüfung). `143` hält `jahrgaenge.wrapped_released_at` ausdrücklich für Alt-Apps, `153` erweitert den CHECK statt ihn zu verengen — die CLAUDE.md-Regel ist in den Migrationen selbst verankert.
- **UNIQUE-Constraints der Fachlogik vorhanden** (Katalog Abschnitt 4): eine Buchung pro Konfi und Termin `event_bookings(user_id, event_id)`; ein Lesestand pro Person und Raum `chat_read_status(room_id, user_id, user_type)`; eine Mitgliedschaft pro Person und Org `user_organizations(user_id, organization_id)`; eine Teilnahme pro Raum `chat_participants(room_id, user_id)`; ein Profil pro Konto `konfi_profiles(user_id)`; Push-Token global eindeutig; `event_points(konfi_id, event_id)`; `user_badges(user_id, badge_id)`; `users(organization_id, username)`/`(organization_id, email)`; `roles(organization_id, name)`; `jahrgaenge(name, organization_id)`; ein offener Einladungs-Datensatz pro Person und Org (Teilindex 159); ein Team-Chat pro Org (Teilindex 104). `user_activities` bewusst ohne UNIQUE (076, Mehrfachteilnahme).
- **CHECK-Constraints** (19): `user_type` in vier Tabellen einheitlich `admin/teamer/konfi` (099/117/133/157); `event_bookings.status` mit `excused` (153); `checkin_quelle`, `status_vor_absage`, `audience`, `wrapped_type`, `wrapped_ausgaben_jahrgang_passt`, `events_teamer_exclusive`, nicht-negative Kapazitäten. Der Wächter `neuinstallation.test.js` prüft die Werte, die der Code schreibt, gegen den verbotenen Fall.
- **Löschregeln** (136 FKs, Katalog Abschnitt 2): Chat-Kette vollständig CASCADE (`chat_rooms` → Nachrichten, Teilnehmer, Umfragen, Stimmen, Reaktionen, Lesestände; 102/114); Urheber-Spalten (`*_by`, `created_by` an Challenges, `freigegeben_von`, `eingeladen_von`) SET NULL; Kern-Elternschaften (`konfi_profiles.jahrgang_id`, `users.role_id`, `custom_badges ← user_badges`, `levels ← konfi_profiles`) NO ACTION, also blockierend statt still löschend; `invite_codes ← konfi_profiles` SET NULL (129); `wrapped_ausgaben` → Snapshots CASCADE (gewollt). Die 29 NO-ACTION-Spalten auf `users`/`organizations` sind im `schemaDrift`-Test namentlich festgehalten und werden von den Löschroutinen abgeräumt (dort getestet). Beim Löschen eines Termins subtrahiert `verwaltung.js:915-930` die Punkte aus `konfi_profiles`, bevor die Kaskade `event_points` mitnimmt.
- **Kein `*_id`/`*_by` ohne Fremdschlüssel** außer den drei Nicht-Referenzen `client_id` (UUID, Idempotenz) und `device_id` (Katalog Abschnitt 3). Keine verwaisten Sequenzen (Abschnitt 11).
- **Abfragen bei 20.000 Nutzer:innen / 490.400 Nachrichten** (`EXPLAIN (ANALYZE, BUFFERS)`, alle indexgestützt, keine Seq Scans auf den großen Tabellen):

  | Abfrage | Zeit |
  |---|---|
  | Chat-Raumliste mit `unread_count` (`chat.js:771`), Konfi in 1 Jahrgangs- + Direktchats | **1,0 ms** |
  | dieselbe für Admin (Team-Chat, 2 Jahrgangs-Chats) | 0,4 ms |
  | Badge `total_unread` (`chat.js:1262`) | 0,6 ms |
  | Konfi-Dashboard Hauptabfrage (`konfi.js:75`) | 0,19 ms |
  | Dashboard Ranking / eigener Rang / Zähler / Badges | 1,5 / 0,4 / 0,03–0,1 ms |
  | Metrics-Historie 7 Tage (`createApp.js:497`) | 0,84 ms |
  | View `event_booking_stats` für **einen** Termin | 0,16 ms |

  Der Chat-Sync auf `GET /rooms` ist per TTL-Cache (10 min, `utils/chatSyncCache.js`) vom Lesepfad genommen.
- **Indizes für die WHERE-Muster der Routen**: Die in `064_add_missing_indexes.sql` aus den Routen abgeleiteten Indizes sind alle vorhanden; `idx_chat_messages_room_created (room_id, created_at DESC)` trägt genau die `unread_count`-Bedingung; `idx_event_bookings_user_event`, `idx_events_organization_id`, `idx_apm_snapshots_captured_at DESC` werden in den Plänen genutzt.
- **Kein Kontaktverlust zwischen Test und Produktion beim Typ-Parser**: `database.js:7` und `tests/helpers/db.js:13` setzen identisch `setTypeParser(20, parseInt)`; `SUM()`-Ergebnisse (numeric) werden dort, wo sie in JavaScript weiterverarbeitet werden, geparst (`konfi.js:445`) oder in SQL gecastet (`jahrgaenge.js:81`, `verwaltung.js:836`).
- **Sicherung in leere Datenbank**: `pg_dump -Fc` (2 s, 10,5 MB für 204 MB) → `pg_restore` (4 s), alle Zählungen gleich, Schema bis auf drei kosmetische CHECK-Schreibweisen identisch.
- **TRUNCATE-Liste** in `tests/helpers/db.js` deckt alle 59 Tabellen (Test „die TRUNCATE-Liste deckt alle Tabellen ab" grün; `challenge_read_status`, `org_einladungen` sind bereits eingetragen).
- **Keine Geheimnisse in den Schema-Dateien**: Dump ohne Daten, `--no-owner --no-privileges`; Compose referenziert Secrets nur über `${…:?}`.

## Nicht geprüft

- Die übrigen SQL-Abfragen der Routen (insbesondere `routes/wrapped.js`, 3.313 Zeilen, und `routes/challenges.js`) auf Indexabdeckung — nur die vier vorgegebenen kritischen Pfade wurden gemessen; die Indexanalyse der übrigen lief über den FK-Katalog, nicht über jede WHERE-Klausel.
- Rechte des Datenbank-Nutzers (`konfi_user` ist laut Compose Eigentümer der Datenbank; ob er Superuser ist, steht nur in Produktion).
- Verhalten unter PostgreSQL 15 (Produktion, CI) vs. 16 (hier): Pläne und Zeiten können abweichen; Syntaxunterschiede gab es keine.
- `docker-compose.e2e.yml` und die E2E-Datenbank.
- Die Hintergrund-Jobs (`backgroundService.js`) auf ihre DELETE-Muster jenseits von `konfiDeletion`.

## Auf Produktion nachzumessen

1. **Schema-Abgleich** (klärt BF-17 und den heutigen Stand von #12):
   `docker exec kq-postgres pg_dump -U konfi_user -d konfi_db --schema-only --no-owner --no-privileges --no-comments | grep -v '^\\restrict\|^\\unrestrict\|set_config\|^-- Dumped' > prod_heute.sql; diff prod_heute.sql scratchpad/…/kq_prod.schema.sql`
   Erwartet: 0 Zeilen (oder nur Reihenfolge). Danach `refresh-schema.sh` + `init-scripts/refresh.sh` laufen lassen.
2. **Klartext-Passwörter** (entscheidet die Schwere von BF-06):
   `SELECT count(*) FILTER (WHERE password_plain IS NOT NULL) AS mit_wert, count(*) AS gesamt FROM konfi_profiles;`
3. **Tabellengrößen und Seq Scans** (Relevanz von BF-01/BF-02 heute):
   `SELECT relname, n_live_tup, seq_scan, idx_scan FROM pg_stat_user_tables WHERE relname IN ('chat_messages','event_bookings','users') ORDER BY n_live_tup DESC;`
4. **Migrationsstand**: `SELECT count(*) FROM schema_migrations;` (erwartet 89) und
   `docker logs kq-backend 2>&1 | grep -c "Migration FAILED"` (erwartet 0) für beide Replikas.
5. **Serverparameter**: `SELECT name, setting FROM pg_settings WHERE name IN ('shared_buffers','max_connections','timezone','statement_timeout','work_mem','server_version');` und pro Backend-Sitzung `SHOW statement_timeout` (erwartet 30 s — bestätigt BF-03/04).
6. **Ungenutzte/doppelte Indizes** (vor BF-09): `SELECT indexrelname, idx_scan, pg_size_pretty(pg_relation_size(indexrelid)) FROM pg_stat_user_indexes WHERE idx_scan = 0 ORDER BY pg_relation_size(indexrelid) DESC;`
7. **Terminliste** live: `EXPLAIN (ANALYZE, BUFFERS)` der Abfrage aus `lesen.js:15` mit einer echten Org-ID; die Zeile `Subquery Scan on ebs … rows=` zeigt, ob die View über alle Buchungen läuft.
8. **CPU-Drosselung der Datenbank**: `docker stats --no-stream kq-postgres` und `cat /sys/fs/cgroup/…/cpu.stat | grep throttled` über einen Abend mit Push-Welle.
9. **Wiederherstellungsübung** mit dem echten nächtlichen Dump in eine leere Datenbank auf dem Testsystem: Dauer, Zählungen (`users`, `chat_messages`, `event_bookings`), anschließender Backend-Start ohne „Migration applied"-Zeilen.
10. **`settings` mit NULL-Organisation**: `SELECT key, count(*) FROM settings WHERE organization_id IS NULL GROUP BY key HAVING count(*) > 1;` (erwartet leer).
