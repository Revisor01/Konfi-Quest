# 11 — Datenbank: Zählungen, Schema-Abgleich, Rückspielprobe

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

> **Überholt (30.09.2026):** Die Migrationen 174–178 sind beim Deploy vom
> 29.09.2026, 19:01 UTC gelaufen (CI-Lauf 1002, `/api/status`:
> `migrations ok`, keine fehlgeschlagen). Vorher-Zählungen gehen nicht mehr.
> Weiter sinnvoll aus diesem Abschnitt: die Abfrage der **Index-Zugriffe**
> (unverändert gültig) und die Refresh-Token-Zählung — die aber nur noch als
> Nachher-Wert (`abgelaufen` und `alt_widerrufen` müssen 0 sein). Die übrigen
> Zählungen stehen als Nachher-Prüfung in Abschnitt 2.

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
- [ ] Abgelaufene Refresh-Tokens (ihr Aufräumen lief bis zu diesem Stand nur
      nach 24 h ununterbrochener Laufzeit, also praktisch nie):
      `SELECT count(*) FILTER (WHERE expires_at < NOW()) AS abgelaufen, count(*) FILTER (WHERE revoked_at < NOW() - INTERVAL '7 days') AS alt_widerrufen, count(*) AS gesamt FROM refresh_tokens;`
      Nach dem Deploy erneut: `abgelaufen` und `alt_widerrufen` müssen 0 sein
      (erster Lauf direkt beim Start des Cron-Leaders).
      **Ergebnis 01.10.2026 (nur Nachher-Wert):** 0 abgelaufen, 11
      alt_widerrufen, 2.627 gesamt. Die 11 wurden zwischen 23.09. 22:45 und
      24.09. 00:17 widerrufen, lagen also erst Minuten nach dem Startlauf des
      Leaders (Log: „37 abgelaufene Refresh-Tokens entfernt") jenseits der
      7-Tage-Grenze — kein Fehler, der nächste Lauf nimmt sie mit.
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
      **Ergebnis 01.10.2026:** `stats_reset` leer (Zähler nie zurückgesetzt).
      91 nicht eindeutige Einzelspalten-Indizes, davon **33 ohne einen
      Zugriff**, 14 mit 1–99; alle 33 sind 16 kB groß:

      | Tabelle | Indizes ohne Zugriff |
      |---|---|
      | `event_unregistrations` | `_org`, `_event`, `_user` |
      | `chat_rooms` | `_organization_id`, `_jahrgang_id`, `_event_id` |
      | `bonus_points`, `users`, `konfsprueche`, `invite_codes`, `roles`, `user_certificates` | je zwei (`konfi_id`/`organization_id`, `deleted_at`/`role_id`, `active`/`org`, `organization_id`/`expires`, `name`/`organization_id`, `organization_id`/`user_id`) |
      | `activities`, `activity_categories`, `activity_requests`, `categories`, `certificate_types`, `chat_messages`, `chat_poll_votes`, `chat_polls`, `event_jahrgang_assignments`, `event_timeslots`, `jahrgaenge`, `konfspruch_uebersetzungen`, `password_resets`, `settings`, `user_organizations` | je einer |

      Vorsicht beim Ableiten: Bei 169 Konten liest der Planer die kleinen
      Tabellen vollständig statt über einen Index; „0 Zugriffe" heißt hier
      nicht „bei 15.000 Nutzenden entbehrlich".

## 2. Nach dem Deploy

- [x] `GET /api/status` mehrfach (beide Backends): `checks.migrations: ok`,
      keine `fehlgeschlagen`; `SELECT max(name), count(*) FROM schema_migrations;`
      nennt `185_push_tokens_app_symbol_weg.sql` (Stand 30.09.2026; oder später). `Migration FAILED`
      im Log: 0.
      **Ergebnis 01.10.2026:** 6 Abfragen, beide Backends (abwechselnd
      `cron_leader` true/false), alle `e6a3d38`, `migrations: ok`,
      `fehlgeschlagen: []`; `185_push_tokens_app_symbol_weg.sql` / 108;
      `Migration FAILED` 0 in beiden Backend-Logs.
- [ ] Zählungen aus Abschnitt 1 wiederholen: `settings` ohne Gemeinde 0,
      `password_plain` 0; `SELECT data_type FROM information_schema.columns
      WHERE table_name = 'event_bookings' AND column_name = 'created_at';` =
      `timestamp with time zone`.
      **Ergebnis 01.10.2026:** `settings` ohne Gemeinde 0, `password_plain`
      0, `created_at` in `event_bookings` und `event_timeslots` je
      `timestamp with time zone`.

## 3. Schema der Produktion gegen das Repo (BF-17, „Produktionsschema heute")

Der Dump im Repo (`backend/tests/schema/prod-schema.sql`) ist seit dem
29.09.2026 aus dem Migrationsstand fortgeschrieben (bis
`173_einladungscode_ohne_urheber.sql`), nicht mehr aus der Produktion
geholt. Er stimmt mit der Produktion genau dann überein, wenn dort seit dem
22.08.2026 nichts von Hand geändert wurde. Das misst dieser Abschnitt.

- [x] Fingerabdruck der Produktion im Backend-Container (dort ist
      `DATABASE_URL` gesetzt; nur Katalog-Abfragen):
      `docker exec <backend-container> node scripts/schemaVergleich.js erfassen > prod-schema.json`
      **Ergebnis 01.10.2026:** Der Befehl so lieferte **genau 65.536 Byte,
      abgeschnitten, kein gültiges JSON** — das Skript endete mit
      `process.exit()`, bevor die Ausgabe durch die Pipe war. Behoben im
      selben Branch (`process.exitCode`, Test
      `frontend/src/__tests__/betrieb/schemaVergleichAusgabe.test.ts`, vorher
      950 von 3.000 Zeilen). Bis das Image den Fix trägt: im Container in
      eine Datei schreiben (`sh -c "… erfassen > /tmp/x.json"`), mit
      `docker cp` holen. So erfasst: 90.095 Byte, 62 Tabellen, 556 Spalten,
      241 Constraints, 215 Indizes, 3 Views, 56 Sequenzen, 3 Erweiterungen.
- [ ] Vergleichsstand aus dem Repo auf dem Commit des Deploys: eine
      Wegwerf-Instanz `postgres:15-alpine`, darin
      `init-scripts/01-create-schema.sql` und `02-migrationsstand.sql`
      einspielen, dann die offenen Migrationen wie beim Start (oder ein Backend
      dagegen starten), dann
      `node backend/scripts/schemaVergleich.js erfassen <url-der-wegwerf-instanz> > repo-schema.json`.
      **Ergebnis 01.10.2026:** Wegwerf-Instanz auf dem Server, `01-` und
      `02-…sql` von `e6a3d38` ohne Fehlerzeile, dann `fuehreMigrationenAus`
      aus `utils/migrationslauf.js` im Backend-Image (kein Server-Start):
      6 neue (174–178, 185), 108 gesamt, 0 fehlgeschlagen.
- [ ] `node backend/scripts/schemaVergleich.js vergleichen prod-schema.json repo-schema.json`
      Erwartet: `Gleich: …`. Jede Abweichung (Zeilen `- A:` nur in der
      Produktion, `+ B:` nur im Repo) hier eintragen, **nichts in der
      Produktion ändern**. CHECK-Schreibweisen nach Dump/Einspielen gleicht
      das Skript selbst an; was übrig bleibt, ist echt.
      **Ergebnis 01.10.2026:** Tabellen, Spalten, Constraints, Indizes,
      Sequenzen gleich. Nur in der Produktion: die Erweiterung
      `pg_stat_statements` und ihre zwei Views — von Hand angelegt nach
      [02](02-portainer-stack.md) (Messung langsamer Abfragen), keine
      Schema-Drift. Sonst keine Abweichung.
- [ ] Findet sich eine Handänderung: den Dump mit
      `backend/tests/schema/refresh-schema.sh` direkt aus der Produktion holen
      und Simon fragen, ob die Änderung als Migration nachgezogen wird.
      **Ergebnis 01.10.2026:** entfällt — keine Handänderung am Schema der
      Anwendung. Offen als Frage: ob `pg_stat_statements` im Repo stehen soll
      (siehe „Fragen an Simon").
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
      **Stand 01.10.2026 (gemessen, Stack nicht geändert — daran arbeitete
      parallel die Deploy-Lücke):** beide Backends `UTC`, `TZ` im Backend
      leer. Die Postgres-`command`-Liste hat **kein** `-c timezone=UTC`; die
      laufende Instanz steht trotzdem auf UTC, weil `postgresql.conf` aus der
      Ersteinrichtung `timezone = 'UTC'` trägt. Der Postgres-Dienst hat aber
      `TZ` und `PGTZ` = `Europe/Berlin`: Eine **neu** aufgesetzte Instanz
      bekäme Berliner Zeit, und jedes `psql` im Postgres-Container (auch
      Handabfragen und `pg_dump`) läuft schon heute in Berliner Zeit. Die
      Zeile bleibt deshalb sinnvoll; eintragen, wenn der Stack frei ist.
- [ ] SMTP-Grenze beim Mailanbieter erfragen (Mails je Stunde, Verbindungen
      je Minute) und `SMTP_MASSEN_JE_MINUTE` im Stack darauf setzen (Standard
      20 je Minute; gilt für die nächtliche Lizenz-Erinnerung und
      Löschwarnung).
      **Stand 01.10.2026 (gemessen, nichts geändert):** Der Mailserver ist
      der eigene; seine Sendegrenze je angemeldetem Konto steht in dessen
      Konfiguration. Für das Absenderkonto, das der Stack nutzt (`SMTP_USER`,
      die `moin@`-Adresse), gilt die **allgemeine Grenze: 100 Mails je
      Stunde, 500 je Tag**; die höhere Konfi-Quest-Regel (300/h, 1.000/Tag)
      ist auf eine andere Adresse geschrieben, über die gar nicht versendet
      wird (in den Mail-Logs seit 30.08. nur fehlgeschlagene Fremd-Anmeldungen
      darauf). `SMTP_MASSEN_JE_MINUTE` ist nicht gesetzt, also 20/min — die
      Stundengrenze wäre nach 5 Minuten erreicht, danach lehnt der Server
      vorübergehend ab (450). Entscheidung bei Simon: die Regel des
      Mailservers auf die tatsächliche Adresse umstellen, oder
      `SMTP_MASSEN_JE_MINUTE` auf höchstens 1 (60/h, Luft für Einzelmails)
      bzw. 4 bei 300/h setzen.
- [ ] Rückspielprobe mit dem echten nächtlichen Dump (BF-05), neben der
      Produktion in eine eigene Datenbank:
      `PG_CONTAINER=<postgres-container> PG_DB=konfi_probe DUMP=<ablage>/konfi_db_<stempel>.dump bash deploy/wiederherstellung.sh`
      Dauer und Zählungen eintragen, dazu der Schema-Vergleich Produktion
      gegen `konfi_probe` (Abschnitt 3, `erfassen` mit der URL der Probe).
      Danach `DROP DATABASE konfi_probe`.
      **Ergebnis 01.10.2026:** nicht in der Produktionsinstanz, sondern in
      einem Wegwerf-Container daneben (gleiche Postgres-Version) — Einzelheiten
      in [05](05-sicherung-und-notfall.md), Abschnitt 2. Echter nächtlicher
      Dump (SQL, 30.09.): 1,25 s, 0 Fehler; frische `-Fc`-Sicherung mit dem
      Skript: 2,2 s, alle 62 Tabellen zeilengleich; Schema beider Kopien
      gegen die Produktion `Gleich`. Hinweis: Der nächtliche Dump ist reines
      SQL; `wiederherstellung.sh` liest nur `-Fc` (Weg für SQL jetzt in
      `docs/betrieb/sicherung.md`). Container danach entfernt.
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
  laufende Datenbank nichts ändert (nur für eine neue Instanz)? (Gemessen
  01.10.2026: Eine neue Instanz bekäme ohne sie Berliner Zeit, siehe
  Abschnitt 4.)
- `pg_stat_statements` ist in der Produktion von Hand angelegt (Auftrag 02).
  Als Migration nachziehen (`CREATE EXTENSION IF NOT EXISTS`), damit Repo
  und Produktion gleich sind, oder bewusst nur im Betrieb lassen?
- SMTP: Regel des Mailservers auf die tatsächliche Absenderadresse umstellen
  oder `SMTP_MASSEN_JE_MINUTE` senken (Abschnitt 4)?
