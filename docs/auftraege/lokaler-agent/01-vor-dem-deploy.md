# 01 — Vor dem Deploy von 2.3.0

Alles hier geschieht, **bevor** der Release-Stand nach `main` geht und der
Deploy-Job läuft. Der Deploy spielt die Migrationen 160–168 ein; einige davon
ändern Daten (165 leert `konfi_profiles.password_plain`, 163 füllt
`user_activities` nach). Die Zählungen unten sind die Vorher-Werte dafür.

## 1. Sicherung

- [x] Datenbank und Uploads nach [docs/betrieb/sicherung.md](../../betrieb/sicherung.md)
      sichern (`deploy/sicherung.sh`), die Stack-Definition aus Portainer
      exportieren. Größe und Zeitpunkt der Sicherung notieren (außerhalb des
      Repos), hier nur „erledigt, Dump N MB".
      **Ergebnis 27.09.2026:** erledigt mit dem Referenzskript in 13 s. Dump
      0,87 MB (`pg_restore --list` lesbar, 4/4 Kerntabellen), Uploads 233 MB,
      Stack-Datei exportiert. Liegt in einem eigenen Ordner neben der
      nächtlichen Sicherung, deren Rotation ihn nicht erfasst.

## 2. Mail-Versand (SMTP)

Die Compose-Referenz verlangt Mail-Host, Mail-Login und die Host-IP als
Stack-Variablen; ohne sie bricht `docker compose` mit „SMTP_HOST fehlt" ab
(`${SMTP_HOST:?…}`). Das Backend prüft das Zertifikat des Mail-Servers
standardmäßig streng.

- [x] Mit dem Bestand in Portainer abgleichen: `SMTP_HOST`, `SMTP_USER`,
      `SMTP_HOST_IP` (für `extra_hosts`), `SMTP_PASS`. Werte nur in
      Portainer, nirgends im Repo. Wo sie stehen (Stack-Variablen oder direkt
      in der Stack-Datei) und wann umgestellt wird, steht in
      [00](00-ablauf-release-2.3.0.md), Phase A Schritt 2 — der alte Deploy
      schickte die Stack-Variablen leer an Portainer.
      **Ergebnis 27.09.2026:** Alle vier stehen **direkt in der Stack-Datei**,
      Stack-Variablen gibt es keine (leere Liste). `SMTP_HOST` ist der Host aus
      `extra_hosts`, `SMTP_PORT` 465, `SMTP_FROM` nicht gesetzt.
- [x] Zertifikat gegen den Hostnamen prüfen:
      ```
      openssl s_client -connect "<SMTP_HOST>:465" -servername "<SMTP_HOST>" </dev/null 2>/dev/null \
        | openssl x509 -noout -subject -ext subjectAltName -dates
      ```
      Der Hostname muss im `subjectAltName` stehen, das Zertifikat gültig sein.
      Wenn nicht: erst das Zertifikat richten. `SMTP_TLS_REJECT_UNAUTHORIZED=false`
      nur als befristeter Notnagel, mit Datum im Ergebnis vermerken und Simon
      Bescheid geben.
      **Ergebnis 27.09.2026:** Das Zertifikat passt (Hostname im
      `subjectAltName`, gültig bis 20.12.2026). Die strenge Prüfung gelingt
      auch aus dem Backend-Container über `extra_hosts` (`authorized: true`).
      Kein Notnagel nötig.
- [x] Absender klären (Doku BF-20): Der Code nimmt `SMTP_FROM`, sonst
      `Konfi Quest <SMTP_USER>` (`backend/services/emailService.js`). Das
      Handbuch (`docs/handbuch/35-passwoerter.md`) nennt eine `moin@`-Adresse
      als Absender. Welche Adresse steht heute in Produktion? Simon fragen,
      welche gelten soll; dann entweder `SMTP_FROM` setzen oder das Handbuch
      angleichen — mit Generatorlauf nach CLAUDE.md.
      **Ergebnis 27.09.2026:** `SMTP_USER` ist die `moin@`-Adresse. Der
      Absender lautet damit schon heute `Konfi Quest <moin@…>`, wie im
      Handbuch. Nichts zu ändern, solange Simon keinen anderen Absender will.
- [ ] Nach dem Deploy (siehe [03](03-nach-dem-deploy.md)): eine echte Mail
      auslösen (Passwort vergessen mit einem Testkonto) und Absender, Zustellung
      und Zeit notieren.

## 3. Zählungen vor den datenändernden Migrationen

- [x] `SELECT count(*) FILTER (WHERE password_plain IS NOT NULL) FROM konfi_profiles;`
      — Anzahl der noch im Klartext gespeicherten Konfi-Passwörter
      (Sicherheit S-01). Migration 165 leert sie; nach dem Deploy muss 0
      stehen.
      **Ergebnis 27.09.2026:** 0 von 130. Migration 165 hat nichts zu leeren;
      S-01 ist in Produktion nicht kritisch.
- [x] `SELECT count(*) FROM user_activities;` — Migration 163 füllt nach;
      gemessen 13 s bei 1 Mio. Zeilen, der Migrationslauf hat kein 30-s-Limit
      mehr, sollte aber im Rahmen bleiben. Bei deutlich mehr als 1 Mio. Zeilen
      Simon vor dem Deploy fragen.
      **Ergebnis 27.09.2026:** 424 Zeilen, unkritisch.

## 4. Vorher-Messungen

Die Gesamtabnahme (`docs/audit/2026-09-26/00-gesamtabnahme.md`, Abschnitt
„Auf Produktion nachzumessen") listet 17 Messungen. Vor dem Deploy zählen, was
der Deploy ändert, damit es einen Vergleich gibt:

- [x] Nr. 3: Super-Admin-Konten mit gesetzter Gemeinde (Liste der IDs, keine Namen ins Repo).
      **Ergebnis 27.09.2026:** 2 Konten, beide `is_super_admin`, beide mit
      Rolle `org_admin` und gesetzter Gemeinde: ID 41 (Org 1), ID 56 (Org 4).
- [x] Nr. 4: Direktchats mit mehr als zwei Personen.
      **Ergebnis 27.09.2026:** keiner mit mehr als zwei. Vier Direktchats mit
      nur **einer** Person (Räume 98, 113, 150, 151, alle Org 1).
- [x] Nr. 5: Vortags-Erinnerungen je Stunde (dominiert 00:00?).
      **Ergebnis 27.09.2026:** ja. `sent_at` ist `timestamp` ohne Zeitzone
      und wird in UTC geschrieben (Stichprobe: Stunden-Erinnerung um 13:48
      gespeichert für einen Termin um 17:00 Berlin). Die Abfrage aus der
      Gesamtabnahme verschiebt deshalb um zwei Stunden. Richtig gelesen:
      145 Vortags-Erinnerungen um 00:00 Berlin, 69 um 02:00, jede andere
      Stunde höchstens 13.
      Nachgemessen 27.09.2026: Die **Datenbanksitzungen der Backends laufen in
      UTC.** `postgresql.conf` hat `timezone = 'UTC'` aus dem initdb. Eine
      Abfrage aus `backend` über dessen eigenen Pool ergibt `TimeZone` UTC,
      das Backend hat weder `PGTZ` noch `TZ`. Nur `psql` im Postgres-Container
      zeigt Europe/Berlin (Quelle `client`), weil dort `PGTZ` gesetzt ist;
      `env -u PGTZ psql … -c 'SHOW timezone'` ergibt UTC. Wer im Container mit
      psql misst, sieht also nicht, was die App sieht.
- [x] Nr. 6: letzte fünf Einträge in `schema_migrations`, Anzahl `Migration FAILED` im Log.
      **Ergebnis 27.09.2026:** 89 Einträge, jüngster
      `159_gemeinde_einladungen.sql` (davor 158, 157, 156, 155).
      `Migration FAILED`: 0 auf allen drei Backends (Logs seit dem letzten
      Start vor 27 h).
- [x] Nr. 7: Image-Tag von `backend-test` im Live-Stack (`test-latest` oder ein SHA?).
      **Ergebnis 27.09.2026:** ein SHA, derselbe wie live (`fce1ab0`). Der
      neue Deploy schreibt `backend-test` nicht mehr um. Nach dem Merge bleibt
      es deshalb auf 2.2-Code stehen, bis `test-backend.yml` es neu setzt.
- [x] Nr. 12: soft-gelöschte Konten mit Anmeldung nach dem Löschen.
      **Ergebnis 27.09.2026:** 0.
- [x] Nr. 13: offene Refresh-Tokens je Konto (Top 20, nur Zahlen).
      **Ergebnis 27.09.2026:** 1.232 offene Tokens auf 129 Konten. Top 20:
      189, 182, 165, 137, 78, 31, 23, 19, 17, 15, 14, 14, 10, 10, 8, 7, 7, 7, 7, 7.
- [x] Nr. 15: `GET /api/status` → `version` (erwartet vor dem Deploy `1.0.1`) und `node -v` im Backend-Container.
      **Ergebnis 27.09.2026:** `version` 1.0.1, `commit` fce1ab0…, Datenbank
      ok; Node v26.10.0.

## 5. Platz für Postgres

- [x] Prüfen, dass der Host für Postgres 2 CPU und 3 GB **zusätzlich** zum
      heutigen Stand frei hat (`docker stats`, `free -m`, `nproc`). Die
      Anpassung selbst steht in [02](02-portainer-stack.md).
      **Ergebnis 27.09.2026:** passt. 10 Kerne bei Last 1,5; RAM 24 GB, davon
      10,5 GB verfügbar. Postgres braucht gegenüber heute (0,3 CPU / 1 GB)
      +1,7 CPU und +2 GB. **Aber:** Swap ist mit 8.116 von 8.191 MB fast voll.
      Das liegt nicht an Konfi Quest (Postgres 165 MB, Backends 70–106 MB),
      sollte vor dem Anheben aber jemand ansehen.
      Vorher-Werte Postgres: in 27 h 14.489-mal gedrosselt, zusammen 2.317 s
      (CPU-Grenze 0,3). Cache-Trefferquote 99,96 %, Datenbank 23 MB, größte
      Tabelle `apm_snapshots` 2,2 MB, 40 offene Verbindungen
      (Sonntagnachmittag). `max_connections` 200, `shared_buffers` 128 MB,
      `work_mem` 4 MB, `statement_timeout` 0, `pg_stat_statements` nicht
      geladen.
