# 08 — Datenbank: Zählungen, Schema-Abgleich, Rückspielprobe

Zum Stand vom 29.09.2026 mit den Migrationen 174–178. Gehört zu
`docs/audit/2026-09-26/datenbank-migrationen.md` (BF-05, BF-06, BF-09, BF-10,
BF-11, BF-17, „Unklar") und `betrieb-skalierung.md` (BF-11, SMTP-Grenzen).
Alle Abfragen sind **nur lesend**; geändert wird die Produktion hier nur über
den Deploy selbst und, in Abschnitt 4, den Portainer-Stack.

Was die Migrationen tun, steht in ihren Kopfkommentaren:

| Migration | Wirkung | Laufzeit gemessen (Lastbestand) |
|---|---|---|
| 174 | `settings`: Zeilen ohne Gemeinde entfernen, Primärschlüssel `(organization_id, key)` | 23–50 ms bei 1.000 Zeilen |
| 175 | acht exakt doppelte Indizes entfernen | 7–50 ms |
| 176 | `konfi_profiles.password_plain` nur noch NULL (CHECK) | 36–48 ms bei 16.000 Profilen |
| 177 | `created_at` von Buchungen und Zeitfenstern: TEXT → timestamptz | 175–475 ms bei 1.000 Buchungen |
| 178 | zwei Sequenzen nach ihren Tabellen benennen | 18–40 ms |

## 1. Vor dem Deploy zählen

- [ ] Sicherung nach [docs/betrieb/sicherung.md](../../betrieb/sicherung.md).
- [ ] `settings` ohne Gemeinde (174 entfernt sie; kein Code liest sie):
      `SELECT key, count(*) FROM settings WHERE organization_id IS NULL GROUP BY key;`
      Erwartet: keine Zeile. Gibt es welche, die Liste hier eintragen.
- [ ] Klartext-Passwörter (176 leert noch einmal):
      `SELECT count(*) FROM konfi_profiles WHERE password_plain IS NOT NULL;` Erwartet 0.
- [ ] Formate der TEXT-Zeitspalten (177 liest Werte ohne Zone als UTC, unlesbare
      werden NULL):
      ```sql
      SELECT 'event_bookings' AS t, count(*) AS gesamt,
             count(*) FILTER (WHERE created_at IS NULL) AS leer,
             count(*) FILTER (WHERE created_at !~ '^\d{4}-\d{2}-\d{2}') AS kein_datum,
             count(*) FILTER (WHERE created_at ~ '^\d{4}-\d{2}-\d{2}' AND created_at !~ '[+-]\d{2}(:?\d{2})?$') AS ohne_zone
        FROM event_bookings
      UNION ALL
      SELECT 'event_timeslots', count(*),
             count(*) FILTER (WHERE created_at IS NULL),
             count(*) FILTER (WHERE created_at !~ '^\d{4}-\d{2}-\d{2}'),
             count(*) FILTER (WHERE created_at ~ '^\d{4}-\d{2}-\d{2}' AND created_at !~ '[+-]\d{2}(:?\d{2})?$')
        FROM event_timeslots;
      ```
      Erwartet: `kein_datum` 0. `ohne_zone` sind Zeilen aus der SQLite-Zeit.
- [ ] Zugriffe auf die Indizes, über die als Nächstes zu entscheiden ist (BF-09,
      die 33 Einzelspalten-Indizes neben einem längeren):
      ```sql
      SELECT s.relname AS tabelle, s.indexrelname AS index, s.idx_scan,
             pg_size_pretty(pg_relation_size(s.indexrelid)) AS groesse
        FROM pg_stat_user_indexes s
        JOIN pg_index i ON i.indexrelid = s.indexrelid
       WHERE NOT i.indisunique AND i.indnatts = 1
       ORDER BY s.idx_scan, pg_relation_size(s.indexrelid) DESC;
      SELECT stats_reset FROM pg_stat_database WHERE datname = current_database();
      ```
      Ergebnis als Tabelle hier ablegen (ohne Daten), mit dem Datum von `stats_reset`.

## 2. Nach dem Deploy

- [ ] `GET /api/status` mehrfach (beide Backends): `checks.migrations: ok`,
      keine `fehlgeschlagen`; `SELECT max(name), count(*) FROM schema_migrations;`
      nennt `178_sequenzen_nach_tabellen.sql` (oder später). `Migration FAILED`
      im Log: 0.
- [ ] Zählungen aus Abschnitt 1 wiederholen: `settings` ohne Gemeinde 0,
      `password_plain` 0; `SELECT data_type FROM information_schema.columns
      WHERE table_name = 'event_bookings' AND column_name = 'created_at';` =
      `timestamp with time zone`.

## 3. Schema der Produktion gegen das Repo (BF-17, „Produktionsschema heute")

Der Dump im Repo (`backend/tests/schema/prod-schema.sql`) ist seit dem
29.09.2026 aus dem Migrationsstand fortgeschrieben (bis
`173_einladungscode_ohne_urheber.sql`), nicht mehr aus der Produktion
geholt. Er stimmt mit der Produktion genau dann überein, wenn dort seit dem
22.08.2026 nichts von Hand geändert wurde. Das misst dieser Abschnitt.

- [ ] Fingerabdruck der Produktion im Backend-Container (dort ist
      `DATABASE_URL` gesetzt; nur Katalog-Abfragen):
      `docker exec <backend-container> node scripts/schemaVergleich.js erfassen > prod-schema.json`
- [ ] Vergleichsstand aus dem Repo auf dem Commit des Deploys: eine
      Wegwerf-Instanz `postgres:15-alpine`, darin
      `init-scripts/01-create-schema.sql` und `02-migrationsstand.sql`
      einspielen, dann die offenen Migrationen wie beim Start (oder ein Backend
      dagegen starten), dann
      `node backend/scripts/schemaVergleich.js erfassen <url-der-wegwerf-instanz> > repo-schema.json`.
- [ ] `node backend/scripts/schemaVergleich.js vergleichen prod-schema.json repo-schema.json`
      Erwartet: `Gleich: …`. Jede Abweichung (Zeilen `- A:` nur in der
      Produktion, `+ B:` nur im Repo) hier eintragen, **nichts in der
      Produktion ändern**. CHECK-Schreibweisen nach Dump/Einspielen gleicht
      das Skript selbst an; was übrig bleibt, ist echt.
- [ ] Findet sich eine Handänderung: den Dump mit
      `backend/tests/schema/refresh-schema.sh` direkt aus der Produktion holen
      und Simon fragen, ob die Änderung als Migration nachgezogen wird.
- [ ] Rhythmus: Mit jedem Release den Dump fortschreiben —
      `bash backend/tests/schema/schema-erneuern.sh <letzte Migration der Produktion>`
      im Release-Branch, Ergebnis mitcommitten. Der Test
      `backend/tests/schema/dumpAktualitaet.test.js` schlägt bei mehr als 20
      offenen Migrationen an.

## 4. Stack und Rückspielprobe

- [ ] Portainer-Stack: beim Postgres-Dienst `-c timezone=UTC` in die
      `command`-Liste (wie `deploy/compose.konfi_quest.yml`). Für die laufende
      Datenbank ohne Wirkung — vorher und nachher in einer Backend-Sitzung
      prüfen, erwartet `UTC`:
      `docker exec <backend-container> node -e "const {Pool}=require('pg');const p=new Pool({connectionString:process.env.DATABASE_URL});p.query('SHOW timezone').then(r=>{console.log(r.rows[0].TimeZone);return p.end()})"`
- [ ] SMTP-Grenze beim Mailanbieter erfragen (Mails je Stunde, Verbindungen
      je Minute) und `SMTP_MASSEN_JE_MINUTE` im Stack darauf setzen (Standard
      20 je Minute; gilt für die nächtliche Lizenz-Erinnerung und
      Löschwarnung).
- [ ] Rückspielprobe mit dem echten nächtlichen Dump (BF-05), neben der
      Produktion in eine eigene Datenbank:
      `PG_CONTAINER=<postgres-container> PG_DB=konfi_probe DUMP=<ablage>/konfi_db_<stempel>.dump bash deploy/wiederherstellung.sh`
      Dauer und Zählungen eintragen, dazu der Schema-Vergleich Produktion
      gegen `konfi_probe` (Abschnitt 3, `erfassen` mit der URL der Probe).
      Danach `DROP DATABASE konfi_probe`.
- [ ] Log-Volumen nach dem Deploy (Betrieb BF-11): `docker logs --since 1h
      <backend-container> 2>&1 | wc -l -c` an einem Abend, je Backend. Zum
      Vergleich die Messung im Bericht (vorher je Absage an 1.000 Personen 500
      Zeilen, jetzt eine). Reicht `max-size 10m × max-file 3` für 7 Tage?
      Sonst einen Vorschlag für Simon.
- [ ] CPU der Datenbank („Wirkung von 0,3 CPU", seit Phase A 2 CPU): steht in
      [03](03-nach-dem-deploy.md), Abschnitt 2, Nr. 9 — dort mit messen.

## 5. Später

- [ ] Im nächsten Release, wenn kein Server mit einem Stand vor dem 29.09.2026
      mehr läuft (auch `backend-test` neu gebaut): Migration
      `DROP COLUMN konfi_profiles.password_plain`. Die Voraussetzung (keine
      Code-Stelle nennt die Spalte) hält `migration176KeinKlartext.test.js` fest.

## Fragen an Simon

- Wurde seit der SQLite-Zeit je per `psql` in Tabellen mit Zeitspalten ohne
  Zone geschrieben (`notifications`, `refresh_tokens`, `users.deleted_at`
  …)? Davon hängt ab, ob sich die 24 Spalten eindeutig auf timestamptz
  umstellen lassen (BF-11).
- Soll der Portainer-Stack die Zeitzonen-Zeile bekommen, obwohl sie für die
  laufende Datenbank nichts ändert (nur für eine neue Instanz)?
