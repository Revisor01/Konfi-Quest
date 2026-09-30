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

- [ ] Vor dem Push: `docker inspect --format '{{.Id}} {{.State.StartedAt}}'`
      für Postgres, `backend`, `backend2`, `frontend` notieren.
- [ ] Während des Deploys von einem Rechner außerhalb des Servers:
      ```
      while :; do printf '%s %s\n' "$(date +%T.%N | cut -c1-12)" \
        "$(curl -s -o /dev/null -m 3 -w '%{http_code}' https://konfi-quest.de/api/health)"; sleep 0.5; done
      ```
      bis der Deploy-Job fertig ist. Auswerten: Zeitraum und Anzahl der
      Antworten ungleich 200, getrennt nach Stufe 1 und 2 (Zeiten aus dem
      Job-Log).
- [ ] Nach dem Deploy dieselben `docker inspect`-Werte: Welche Container
      haben eine neue ID bzw. ein neues `StartedAt` — in welcher Stufe?
      Besonders: **Postgres**. Ein neu erstellter Datenbank-Container bei
      jedem Push auf `main` ist der eigentliche Befund.
- [ ] Die Portainer-Fassung notieren (Einstellungen oder
      `GET /api/system/version`).

**Ergebnis** mit Zahlen eintragen (etwa „Stufe 1: 24 s ohne 200, Postgres neu
erstellt; Stufe 2: 27 s").

## 2. Portainer-Verhalten gezielt prüfen (in einem ruhigen Moment, mit Simon)

Ziel: Findet sich ein Aufruf, bei dem nur geänderte Dienste neu erstellt
werden? Kandidat: das Image vorab ziehen und `update_stack` mit
`pullImage: false` aufrufen — dann sollte Compose ohne `--force-recreate`
arbeiten, und ein Dienst mit gleichem Image-Tag bleibt stehen.

- [ ] Stack-Datei sichern (exportieren).
- [ ] `update_stack` mit **unveränderter** Stack-Datei und `pullImage: false`
      (Variablen unverändert mitschicken, wie `rollend.sh` es tut). Danach:
      Hat sich irgendeine Container-ID geändert? Erwartet: nein.
- [ ] Dasselbe mit `pullImage: true`. Ändern sich alle IDs? Dann ist
      `pullImage: true` (oder Portainers Update an sich) die Ursache.
- [ ] Ergebnis an Simon und in den Befund. Erst wenn der Weg ohne
      Neuerstellung belegt ist: `rollend.sh` umstellen (Image vorab über die
      Docker-API des Endpoints ziehen — `POST /api/endpoints/<id>/docker/images/create?fromImage=…&tag=…`
      —, dann `update_stack` mit `pullImage: false`), mit Test in
      `frontend/src/__tests__/betrieb/rollenderDeploy.test.ts`, per Pull
      Request.
- [ ] Unabhängig davon Postgres **per Digest** festhalten: den Digest des
      laufenden Images ablesen
      (`docker inspect --format '{{index .RepoDigests 0}}' <postgres-image>`)
      und im Stack als `postgres:15-alpine@sha256:…` eintragen; dieselbe Zeile
      in `deploy/compose.konfi_quest.yml`. Dann zieht auch `pullImage: true`
      nie ein neueres Postgres-Image unter demselben Tag.
