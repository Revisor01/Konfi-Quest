# 10 — Deploy-Lücke: Was erstellt Portainer beim Update neu? (CI BF-05)

Befund: CI BF-05 in `docs/audit/2026-09-26/ci-deployment-store.md`. Der
rollende Deploy (`deploy/rollend.sh`) soll erst `backend` (+ `frontend`) und
dann `backend2` tauschen, sodass immer eine gesunde Replica im Traefik-Pool
steht. Das setzt voraus, dass Portainers `update_stack` nur Dienste mit
geänderter Konfiguration neu erstellt. Das Skript prüft genau das und warnt
sonst.

## Nachtrag 30.09.2026: Der Deploy von `4145114` wurde rot

Wieder dieselbe Warnung (`backend2 wurde in Stufe 1 mit neu erstellt`,
12:29:05 UTC). Diesmal kam dazu: Die erste Verify-Abfrage, 1 s nach „backend2
gesund", bekam **keine Antwort**; die fünf folgenden meldeten `4145114`. Der
Stand war live, der Lauf aber rot (Verify verlangt 6 von 6) — und ein roter
Lauf sperrt die Store-Builds. Das ist die Lücke, wie Nutzer:innen sie sehen.

Seit PR #200 wartet `deploy/rollend.sh` vor dem strengen Verify, bis der neue
Stand zum ersten Mal antwortet (höchstens 1 min), und schreibt die
Fehlantworten als Warnung mit Zahl und Dauer ins Log: `Nach dem Tausch N
Fehlantwort(en) in X s`. **Diese Zeile ist die Messung:** Bei jedem Deploy im
Log des Jobs `deploy` nachsehen und festhalten — sie verschwindet erst, wenn
die Lücke geschlossen ist.

**Ergebnis 01.10.2026 (Auswertung der Logs):** Die Zeile kam bisher in
keinem Lauf vor. Nur der Deploy von `e6a3d38` (30.09., 13:27 UTC) lief mit
dem Anlauf; die erste Abfrage meldete sofort den neuen Stand, also 0
Fehlantworten. Die Zeile **misst die Lücke aber nicht**: Der Anlauf beginnt
erst, wenn beide Backends gesund sind — die Lücke liegt davor, in den Stufen.
Aus den Logs aller sechs rollenden Deploys (`beb745e`, `67c03dc`, `76178ec`,
`4145114`, `31995a4`, `e6a3d38`): jedes Mal die Warnung „backend2 wurde in
Stufe 1 mit neu erstellt", Stufe 1 29–35 s und Stufe 2 25–28 s von
`update_stack` bis „gesund", davon jeweils 13–24 s im Zustand `created`. Nach
`e6a3d38` trugen am Server alle fünf Container dieselbe Erstellzeit
(13:28:04 UTC, Stufe 2), Postgres startete 13:28:11 neu: Auch Stufe 2 hat
Postgres, `backend` (eben erst getauscht) und `frontend` neu erstellt.

## Was der erste echte Lauf zeigt (29.09.2026, Deploy von `beb745e`)

Aus dem Log des Deploy-Jobs (Actions, Lauf 992, Job `deploy`), ohne Zugriff
auf den Server:

```
08:24:52 Stufe 'backend|frontend': update_stack HTTP 200
08:25:00–08:25:13 backend: …:beb745e created      (neuer Container, läuft noch nicht)
08:25:19 backend: …:beb745e healthy
##[warning] backend2 wurde in Stufe 1 mit neu erstellt (dc77245dea49 -> a0cc6e395efb).
08:25:21 Stufe 'backend2': update_stack HTTP 200
08:25:29–08:25:36 backend2: …:beb745e created
08:25:42 backend2: starting, 08:25:49 healthy
```

Belegt: `backend2` wurde in Stufe 1 **mit neu erstellt**, obwohl sich an ihm
nichts geändert hatte. In Stufe 1 waren also beide Backends zugleich im
Tausch; die Lücke ist nicht weg. Auffällig: Die neuen Container blieben 13–20 s
im Zustand `created` (erstellt, nicht gestartet). Das passt zu
`depends_on: postgres: condition: service_healthy` — und damit zu einem
**neu erstellten Postgres** bei jedem Update. Nicht belegt, deshalb messen.

## 1. Messen beim nächsten Deploy (nur lesend)

- [x] Vor dem Push: `docker inspect --format '{{.Id}} {{.State.StartedAt}}'`
      für Postgres, `backend`, `backend2`, `frontend` notieren.
- [x] Während des Deploys von einem Rechner außerhalb des Servers:
      ```
      while :; do printf '%s %s\n' "$(date +%T.%N | cut -c1-12)" \
        "$(curl -s -o /dev/null -m 3 -w '%{http_code}' https://konfi-quest.de/api/health)"; sleep 0.5; done
      ```
      bis der Deploy-Job fertig ist. Auswerten: Zeitraum und Anzahl der
      Antworten ungleich 200, getrennt nach Stufe 1 und 2 (Zeiten aus dem
      Job-Log).
- [x] Nach dem Deploy dieselben `docker inspect`-Werte: Welche Container
      haben eine neue ID bzw. ein neues `StartedAt` — in welcher Stufe?
      Besonders: **Postgres**. Ein neu erstellter Datenbank-Container bei
      jedem Push auf `main` ist der eigentliche Befund.
- [x] Die Portainer-Fassung notieren (Einstellungen oder
      `GET /api/system/version`).

**Ergebnis** mit Zahlen eintragen (etwa „Stufe 1: 24 s ohne 200, Postgres neu
erstellt; Stufe 2: 27 s").

**Ergebnis 01.10.2026:** Nicht bei einem Push gemessen, sondern nachts
nachgestellt mit genau dem Aufruf, den jeder Deploy bis dahin machte
(`update_stack` mit `pullImage: true`, Stack-Datei unverändert, 30.09. 22:41 UTC).
Container-IDs und `StartedAt` vorher/nachher über die Docker-API; Messung
von außen im 0,3-s-Takt auf `/api/status`, `/api/health` und `/`:

| | vorher (`pullImage: true`) | nachher (`pullImage: false`, ein Dienst geändert) |
|---|---|---|
| neu erstellt | alle 5, auch Postgres | nur der geänderte Dienst |
| `/api/status` ≠ 200 | **25 s** (29 Proben, 503 dann 404) | **0 s** (0 von 87 bzw. 96 Proben, je Replica) |
| Web-App `/` ≠ 200 | 19 s | 0 s beim Backend-Tausch; ~4 s, wenn das Frontend selbst getauscht wird (6 bzw. 4 Proben, zwei Läufe) |

Die 503 von `/api/health` während des Tauschs einer Replica (4 Proben je
Lauf) sind der gewollte Drain des alten Containers (`SHUTDOWN_DRAIN_MS`),
nicht die Lücke: Nur der Gesundheitspfad meldet 503, damit Traefik die
Replica herausnimmt; `/api/status` und alle anderen Routen antworten weiter.
Portainer EE 2.45.1 (Compose v2.40.3, Docker 29.1.3).

## 2. Portainer-Verhalten gezielt prüfen (in einem ruhigen Moment, mit Simon)

Ziel: Findet sich ein Aufruf, bei dem nur geänderte Dienste neu erstellt
werden? Kandidat: das Image vorab ziehen und `update_stack` mit
`pullImage: false` aufrufen — dann sollte Compose ohne `--force-recreate`
arbeiten, und ein Dienst mit gleichem Image-Tag bleibt stehen.

- [x] Stack-Datei sichern (exportieren).
      **Ergebnis 01.10.2026:** vor jedem Eingriff exportiert (außerhalb des
      Repos), dazu Datenbank-Dump (931 kB, 4 von 4 Kerntabellen) und
      Upload-Archiv (248 MB) nach `docs/betrieb/sicherung.md`.
- [x] `update_stack` mit **unveränderter** Stack-Datei und `pullImage: false`
      (Variablen unverändert mitschicken, wie `rollend.sh` es tut). Danach:
      Hat sich irgendeine Container-ID geändert? Erwartet: nein.
      **Ergebnis 01.10.2026:** 0 von 5 Container-IDs geändert, `StartedAt`
      unverändert, Aufruf 1 s, 0 von 112 Proben ≠ 200. Danach drei Updates
      mit je einem geänderten Dienst (Auftrag 09 und Digest unten): jedes Mal
      nur die geänderten Dienste neu erstellt.
- [x] Dasselbe mit `pullImage: true`. Ändern sich alle IDs? Dann ist
      `pullImage: true` (oder Portainers Update an sich) die Ursache.
      **Ergebnis 01.10.2026:** ja — alle 5 IDs neu, Postgres eingeschlossen,
      obwohl sich weder Datei noch Image geändert hatte. Ursache ist
      `pullImage: true` (Portainer erstellt damit alles neu), nicht das
      Update an sich. Zahlen in der Tabelle unter 1.
- [x] Ergebnis an Simon und in den Befund. Erst wenn der Weg ohne
      Neuerstellung belegt ist: `rollend.sh` umstellen (Image vorab über die
      Docker-API des Endpoints ziehen — `POST /api/endpoints/<id>/docker/images/create?fromImage=…&tag=…`
      —, dann `update_stack` mit `pullImage: false`), mit Test in
      `frontend/src/__tests__/betrieb/rollenderDeploy.test.ts`, per Pull
      Request.
      **Ergebnis 01.10.2026:** Branch `betrieb/deploy-luecke-container`.
      `rollend.sh` zieht die Images jeder Stufe vorab (Stufe 1: `backend`,
      `frontend` und `test-latest` für `backend-test`; Stufe 2: `backend2`),
      bricht die Runde **vor** `update_stack` ab, wenn ghcr ein Image noch
      nicht ausliefert (HTTP 404), und ruft dann `update_stack` mit
      `pullImage: false`. Nach jeder Stufe vergleicht es die IDs **aller**
      Dienste und nennt in der Warnung, was die Stufe außer ihren eigenen
      Diensten neu erstellt hat (vorher nur `backend2`). Tests: 5 neue Fälle
      gegen eine nachgebaute Portainer-API, die sich verhält wie gemessen;
      Gegenprobe `pullImage: true` → 2 rot, ohne Vorab-Ziehen → 3 rot.
      Wirkt ab dem ersten Deploy nach dem Merge; dort im Log erwartet:
      „Stufe 1: keine anderen Dienste neu erstellt." und dasselbe für Stufe 2.
- [x] Unabhängig davon Postgres **per Digest** festhalten: den Digest des
      laufenden Images ablesen
      (`docker inspect --format '{{index .RepoDigests 0}}' <postgres-image>`)
      und im Stack als `postgres:15-alpine@sha256:…` eintragen; dieselbe Zeile
      in `deploy/compose.konfi_quest.yml`. Dann zieht auch `pullImage: true`
      nie ein neueres Postgres-Image unter demselben Tag.
      **Ergebnis 01.10.2026:** Das lokale Image trug drei Digests; der
      aktuelle Index von `postgres:15-alpine` ist `sha256:f7d23353…`
      (per `docker buildx imagetools inspect`), dasselbe Image
      (`sha256:319d040b…`). Im Stack und in der Referenz eingetragen, im
      E2E-Stack ebenso (der Test verlangt dasselbe Image). Das Update erstellte
      nur Postgres neu: Verbindung weg um 22:33:30 UTC (30.09.), Cron-Leader wieder da nach
      4,9 s, 0 von 66 Proben ≠ 200, einzelne Antworten bis 2,3 s langsam.

## 3. Was bleibt

- [ ] **Frontend:** Es hat eine Replica. Wird es getauscht (bei jedem
      Deploy mit Frontend-Änderung), liefert die Web-App rund 4 s lang 404
      (gemessen zweimal am 01.10.2026: 6 bzw. 4 Proben). Die Apps sind davon
      nicht betroffen, sie bringen ihre Oberfläche mit. Die 404 kommt von
      Traefik, weil der Router mit dem Container verschwindet — ein Retry
      hilft da nicht. Schließen ließe es sich mit einer zweiten
      Frontend-Replica im selben Muster wie `backend2` — Entscheidung Simon.
- [ ] Beim ersten Deploy nach dem Merge das Log lesen: zwei Zeilen „keine
      anderen Dienste neu erstellt", keine Zeile „Fehlantwort(en)"; am Server
      `StartedAt` von Postgres unverändert.
