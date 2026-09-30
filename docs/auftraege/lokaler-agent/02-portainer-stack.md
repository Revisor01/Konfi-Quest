# 02 — Portainer-Stack an die Referenz angleichen

Referenz: `deploy/compose.konfi_quest.yml`. Sie ist die Soll-Fassung des
Produktions-Stacks ohne Geheimnisse. Befunde: Betrieb BF-13, Datenbank BF-07
(`docs/audit/2026-09-26/betrieb-skalierung.md`, `datenbank-migrationen.md`).
Beide stehen auf „teilweise behoben": Die Referenz stimmt, angewendet ist sie
noch nicht.

**Reihenfolge ist wichtig.** Schritte 1–3 gehen vor oder mit dem Deploy,
Schritt 5 erst, wenn der neue Code auf **beiden** Backends läuft.

## 1. Abgleich

- [x] Live-Stack exportieren und gegen die Referenz diffen (Dienste, Images,
      Umgebung ohne Werte der Geheimnisse, Ressourcen, `command` von Postgres,
      Healthchecks, Labels). Jede Abweichung einordnen: gewollt (dann in die
      Referenz, mit Begründung im Kommentar) oder angleichen.
      **Ergebnis 27.09.2026** (Live-Stand der Stack-Datei vom 26.09., Tag
      `fce1ab0`). Alle Werte stehen direkt in der Datei, Stack-Variablen gibt
      es keine. Abweichungen:

      *Fehlt in der Referenz — vor jedem Kopieren der Referenz nachtragen:*
      - `ACTIVITY_PHOTO_ENCRYPTION_KEY` und `DOCS_PASSWORD` in der Umgebung
        aller drei Backends. Die Referenz kennt beide nicht. Wer sie in den
        Stack kopiert, macht die verschlüsselten Aktivitätsfotos unlesbar.
        `docs/betrieb/sicherung.md` nennt beide richtig.

      *Gewollt, gehört in die Referenz (Abschnitt 6):*
      - Router `konfi-api` und `konfi-frontend` auch für den `www.`-Host.
      - Middlewares `compress-default@file` und `retry-deploy@file` (API),
        `retry-deploy@file` (Frontend).
      - Sticky-Cookie `konfi_lb` am Service `konfi-api` (httpOnly, secure,
        sameSite lax).
      - Router `konfi-docs` (Priorität 20, `konfi-docs-auth@file`) für
        `/docs/api` ohne die Anmeldeseite.
      - Healthcheck des Frontends prüft eine IP statt `127.0.0.1`
        (gleichwertig).

      *Anzugleichen (Phase A 5 und 6, braucht Simons Fenster):*
      - Postgres: `command` nur `max_connections=200`, Grenzen 1 GB / 0,3 CPU.
      - Backends: `PG_POOL_MAX`, `PG_CONN_TIMEOUT`, `PG_STATEMENT_TIMEOUT`,
        `PG_IDLE_TX_TIMEOUT`, `PG_SOCKET_ADAPTER_POOL_MAX` und
        `SHUTDOWN_DRAIN_MS` fehlen. Vorhanden ist nur `PG_IDLE_TIMEOUT`.

      *Zur Entscheidung, nicht blind übernehmen:*
      - `TZ: Europe/Berlin` fehlt bei allen drei Backends. Sie laufen in UTC
        (`date` im Container: UTC) und schreiben Zeitstempel ohne Zeitzone in
        UTC (siehe 01, Nr. 5). Die Zeile der Referenz ändert also Verhalten,
        auch am alten Code. Erst mit der Entwicklung klären, gegen welche
        Zeitzone der Code von 2.3.0 getestet ist.
      - `backend-test` steht auf dem Live-SHA statt auf `test-latest` (01,
        Nr. 7).

      Der neue Deploy (`deploy/rollend.sh`) liest die Live-Datei, ändert nur
      die Image-Tags von `backend`/`frontend` bzw. `backend2` und schickt die
      vorhandenen Variablen zurück (hier eine leere Liste). Die direkt
      eingetragenen Geheimnisse übersteht er also.

## 2. Postgres

- [x] Ressourcen `cpus: '2'`, `memory: 3G`.
- [x] `command` mit den Vorgaben der Referenz (`shared_buffers=768MB`,
      `effective_cache_size=2GB`, `work_mem=8MB`, `maintenance_work_mem=128MB`,
      `shared_preload_libraries=pg_stat_statements` und die übrigen Zeilen dort).
      `shared_preload_libraries` braucht einen Neustart von Postgres —
      Wartungsfenster mit Simon abstimmen (kurz, aber alle Backends verlieren
      für diese Zeit die Datenbank). Beobachten und ins Ergebnis schreiben: Wie
      lange antwortet `/api/status` mit Datenbankfehler, fangen sich die
      Backends ohne Neustart wieder?
      **Ergebnis 27.09.2026:** Das lief zusammen mit Abschnitt 3 in einem
      Stack-Update um 16:25:58, Sonntagnachmittag, auf Simons Zuruf. Vorher
      lief keine Abfrage, und keine Sperre wartete. Portainer hat Postgres und
      alle drei Backends neu erstellt; die Backends warten per `depends_on`,
      bis Postgres gesund ist. Um 16:26:20 waren alle fünf Container
      gesund. Die Messung im Sekundentakt auf `/api/status` zählte **einen**
      Fehlschlag (16:25:59, Zeitüberschreitung nach 2 s), ab 16:26:02 wieder
      200. Gemessen wurde nur der HTTP-Code. Ob `/api/status` in diesen
      Sekunden einen Datenbankfehler meldete, ist nicht belegt. Danach
      `Migration FAILED` 0 und keine Fehlerzeile in den Logs der Backends.
      Postgres läuft mit 2 CPU / 3 GB und dem `command` der Referenz.
- [x] Nach dem Neustart einmal:
      `CREATE EXTENSION IF NOT EXISTS pg_stat_statements;`
      Prüfen: `SELECT count(*) FROM pg_stat_statements;` > 0 nach einigen
      Minuten Betrieb. Die App liest die Erweiterung nicht; sie ist für die
      Messungen in [03](03-nach-dem-deploy.md) da (langsamste Abfragen unter
      echter Last).
      **Ergebnis 27.09.2026:** Erweiterung angelegt, schon kurz danach 22
      Einträge.
- [x] `SHOW shared_buffers; SHOW work_mem; SHOW statement_timeout;` — Werte ins Ergebnis.
      **Ergebnis 27.09.2026:** `shared_buffers` 768MB, `work_mem` 8MB,
      `statement_timeout` 0 (Server; die Backends setzen je Verbindung 30 s),
      `shared_preload_libraries` pg_stat_statements.

## 3. Backends

- [x] Umgebung von `backend` und `backend2` wie in der Referenz:
      `PG_POOL_MAX=50`, `PG_IDLE_TIMEOUT`, `PG_CONN_TIMEOUT`,
      `PG_STATEMENT_TIMEOUT`, `PG_IDLE_TX_TIMEOUT`,
      `PG_SOCKET_ADAPTER_POOL_MAX`, `SHUTDOWN_DRAIN_MS=6000`, die
      `SMTP_*`-Variablen aus [01](01-vor-dem-deploy.md), `extra_hosts`.
      **Ergebnis 27.09.2026:** `PG_POOL_MAX` 50, `PG_CONN_TIMEOUT`,
      `PG_STATEMENT_TIMEOUT`, `PG_IDLE_TX_TIMEOUT`,
      `PG_SOCKET_ADAPTER_POOL_MAX` und `SHUTDOWN_DRAIN_MS` ergänzt. Über den
      YAML-Anker gelten sie auch für `backend-test`, wie in der Referenz.
      `SMTP_*` und `extra_hosts` standen schon. Die Geheimnisse sind in
      allen drei Backends unverändert vorhanden (6/6 geprüft). Der laufende
      Code liest `PG_STATEMENT_TIMEOUT` und `PG_CONN_TIMEOUT` ohnehin mit
      denselben Vorgaben; wirksam geändert hat sich nur der Pool (20 → 50).
      `TZ` bewusst nicht gesetzt.
- [ ] Rechnung prüfen: Die Referenz setzt `max_connections=200` gegen drei
      Backends × (`PG_POOL_MAX` 50 + Adapter) plus Reserve (Kommentar am
      `command` in der Referenz). `SHOW max_connections;` und in einem
      Abendbetrieb `SELECT count(*) FROM pg_stat_activity;` — Zahlen ins
      Ergebnis.
      **Zwischenstand 27.09.2026:** `max_connections` 200; 26 Verbindungen
      direkt nach dem Neustart (Sonntagnachmittag). Die Messung am Abend
      steht noch aus.
      **Zwischenstand 01.10.2026:** 30 Verbindungen nachts (00:33 MESZ, vor
      dem Postgres-Neustart), keine aktive Abfrage, keine wartende Sperre.
      Die Messung am Abend steht weiter aus.

## 4. Den ersten zweistufigen Deploy beobachten

Der Deploy-Job tauscht die Backends seit 2.3.0 nacheinander
(`deploy/rollend.sh`): erst `backend` (und `frontend`), warten bis gesund,
dann `backend2`, danach mehrfach `/api/status` prüfen. Beim ersten Push nach
`main` läuft das zum ersten Mal in Produktion.

- [x] Während des Deploys im Sekundentakt `GET /api/status` abfragen und
      zählen, wie viele Anfragen fehlschlagen und wie lange (vorher: 10–20 s
      ohne API, alle Sockets getrennt — Betrieb BF-12, CI BF-05).
      **Ergebnis 01.10.2026:** nicht während eines Pushs, sondern nachts mit
      demselben Portainer-Aufruf nachgestellt (Auftrag 10): so wie die
      Deploys bis zum 30.09. liefen, 25 s ohne 200 auf `/api/status`, weil
      Portainer mit `pullImage: true` alle Dienste neu erstellt; mit dem
      Umbau aus Auftrag 10 beim Tausch einer Replica 0 s.
- [x] Log des Deploy-Jobs: Stufe 1, Stufe 2, Verify — alle grün? Dauer je Stufe.
      **Ergebnis 01.10.2026:** sechs rollende Deploys (29./30.09.): Stufe 1
      29–35 s, Stufe 2 25–28 s; Verify fünfmal grün, einmal rot (`4145114`,
      erste Abfrage ohne Antwort — seitdem der Anlauf, Auftrag 10).
- [x] `Migration FAILED` im Log der Backends: erwartet 0.
      **Ergebnis 01.10.2026:** 0 in allen drei Backends (Logs seit dem
      letzten Neuaufbau).

## 5. Hintergrund-Jobs auf beiden Backends (erst nach dem Deploy!)

Bis 2.2 durfte nur ein Backend die Hintergrund-Jobs (Erinnerungen,
App-Icon-Zähler, Aufräumen) fahren; `backend2` hatte deshalb
`RUN_BACKGROUND_JOBS=false`. Seit 2.3.0 wählen die Backends über eine
Datenbank-Sperre einen Cron-Leader (`backend/utils/cronLeader.js`) — fällt er
aus, übernimmt der andere.

- [x] Erst wenn beide Backends den neuen Stand fahren (`/api/status` →
      `commit` auf beiden gleich): `RUN_BACKGROUND_JOBS=false` bei `backend2`
      entfernen. Bei `backend-test` bleibt es stehen.
      **Ergebnis 28.09.2026:** entfernt. **Nachgeprüft 01.10.2026:** In der
      Umgebung der laufenden Container fehlt die Variable bei `backend` und
      `backend2`, `backend-test` hat `RUN_BACKGROUND_JOBS=false`; die
      CI-Deploys haben daran nichts geändert (sie ersetzen nur Image-Tags).
      `backend-test` steht auf `test-latest` (gebaut von `test-backend.yml`
      aus `main`, meldet derzeit Commit `674bd8e` vom 28.09.).
- [x] Prüfen: Genau **ein** Backend loggt „Hintergrund-Jobs gestartet (diese
      Replica ist der Cron-Leader)", beide „Cron-Leader-Wahl gestartet".
      Dann den Leader neu starten und messen, nach wie vielen Sekunden der
      andere übernimmt.
      **Ergebnis 28.09.2026:** genau eine Replica bekam den Lock,
      `backend-test` nimmt nicht teil. **Ergebnis 01.10.2026:** nach jedem der
      Neustarts der Nacht wieder genau ein Leader. Leader (`backend2`) über
      die Docker-API neu gestartet: SIGTERM 22:46:55,6 UTC, Rolle nach dem
      Drain abgegeben 22:47:01,63, `backend` hat den Lock 22:47:01,84 —
      **0,21 s** nach der Abgabe, 6,2 s nach dem Stopp-Signal; nie zwei
      Leader zugleich. Beim Neustart von Postgres holte sich der Leader den
      Lock nach 4,9 s zurück. Von außen dabei 0 Antworten ≠ 200.
- [x] Eine Vortags-Erinnerung beobachten: kommt sie genau einmal an?
      **Ergebnis 01.10.2026:** ja. `event_reminders` (`sent_at` in UTC ohne
      Zone) seit dem 28.09.: fünf Termine mit Vortags-Erinnerung (41, 5, 6,
      6 und 8 Empfänger:innen), je Termin **ein** Zeitstempel — ein einziger
      Lauf hat vorgemerkt und gesendet, 24,03–24,24 h vor Beginn. Doppelte
      Zeilen je Person und Termin: 0 (dazu hält der UNIQUE-Index, und der
      Versand geht nur an die per `INSERT … ON CONFLICT DO NOTHING RETURNING`
      neu vorgemerkten). Die Push-Protokolle dieser Läufe sind mit den
      Containern neu erstellt worden und nicht mehr lesbar; das Postfach
      führt die Erinnerung nicht.

## 6. Referenz nachziehen

- [ ] Was beim Abgleich als gewollte Abweichung übrig blieb, in
      `deploy/compose.konfi_quest.yml` übernehmen (ohne Werte von Geheimnissen,
      ohne Adressen). Status-Zeilen von Betrieb BF-13 und Datenbank BF-07
      ergänzen.
