#!/usr/bin/env bash
# !!! WORK IN PROGRESS — NOCH NICHT IM CI AKTIV !!!
# Live-Test 21.06.2026 zeigte ZWEI offene Punkte, bevor das scharf geschaltet wird:
#   1. ~15s lang 502/503 beim Tausch: Portainers Container-recreate KILLT den alten
#      Container sofort, aber Traefik nimmt ihn erst nach dem loadbalancer.healthcheck-
#      Intervall (5s) aus dem Pool -> kurzes Routing auf den toten Container. FIX-Idee:
#      vor dem recreate erst Traefik-Draining (Label/Gewicht 0 oder Container stoppen +
#      auf Pool-Entfernung warten), DANN recreate; ODER stop_grace + Healthcheck-Intervall
#      auf 2s senken und vor recreate aktiv auf "nur noch 1 gesunde Replica im Pool" warten.
#   2. :latest auf ghcr war veraltet (zeigte auf alten b51f546-Build) -> recreate
#      PullImage:true zog FALSCHEN Code. -> Rolling MUSS den festen Commit-SHA-Tag des
#      aktuellen Builds ziehen, nicht :latest. D.h. Container vor recreate auf den
#      neuen SHA-Tag umkonfigurieren (Stack-File-Update pro Service) — was wieder
#      Portainer-recreate ausloest. Sauberer Weg dafuer noch offen.
# Bis das geloest ist: Deploy laeuft weiter ueber den bestehenden update_stack-Job
# (kurze Luecke), Stack ist auf festem Tag (siehe deploy/compose.konfi_quest.yml).
#
# rolling-deploy.sh — Zero-Downtime-Deploy fuer den Konfi-Quest-Stack (Portainer 249).
#
# Das Backend laeuft als ZWEI Replicas (backend + backend2) hinter Traefik, beide auf
# dem Tag :latest. Statt beide gleichzeitig zu recreaten (Lücke!), tauschen wir sie
# EINZELN aus — Traefik (loadbalancer.healthcheck) routet immer nur zu gesunden Replicas:
#   1. backend  per Container-Recreate(PullImage:true) -> zieht neues :latest -> Healthcheck warten.
#   2. backend2 ERST danach genauso. In der Zwischenzeit traegt die jeweils andere Replica allen Traffic.
#   3. frontend zuletzt (single; statische Auslieferung, kurze Luecke unkritisch).
# Kein Tag-Rewrite noetig: :latest == aktueller Build (docker/metadata-action pusht latest).
#
# Benoetigt (Env): P_URL, P_KEY (Portainer), ENDPOINT_ID, GIT_SHA (voll, Commit-Verify),
#                  BACKEND_CHANGED (0/1).
set -euo pipefail
: "${P_URL:?}"; : "${P_KEY:?}"; : "${ENDPOINT_ID:?}"
GIT_SHA="${GIT_SHA:-}"; BACKEND_CHANGED="${BACKEND_CHANGED:-1}"

api() { curl -s -H "X-API-Key: $P_KEY" "$@"; }

# Compose-Service-Name -> Container-ID (im Projekt konfi_quest).
container_id() {
  api "$P_URL/api/endpoints/$ENDPOINT_ID/docker/containers/json?all=1" \
    | python3 -c "
import sys,json
svc='$1'
for c in json.load(sys.stdin):
    l=c.get('Labels',{})
    if l.get('com.docker.compose.service')==svc and l.get('com.docker.compose.project')=='konfi_quest':
        print(c['Id']); break
"
}

# Container neu erstellen + dabei das Image frisch pullen (zieht neues :latest).
recreate() {
  api -X POST -H "Content-Type: application/json" \
    "$P_URL/api/docker/$ENDPOINT_ID/containers/$1/recreate" \
    -d '{"PullImage":true}' -o /dev/null -w "%{http_code}"
}

# Warten bis ein Compose-Service laut Docker-Healthcheck gesund ist.
wait_healthy() {
  local svc="$1"
  for _ in $(seq 1 30); do
    sleep 5
    local cid; cid="$(container_id "$svc")"
    [ -n "$cid" ] || continue
    local state
    state="$(api "$P_URL/api/endpoints/$ENDPOINT_ID/docker/containers/$cid/json" \
      | python3 -c "import sys,json;print(json.load(sys.stdin).get('State',{}).get('Health',{}).get('Status','none'))" 2>/dev/null || echo none)"
    echo "  $svc: $state"
    [ "$state" = "healthy" ] && return 0
  done
  echo "::error::$svc wurde nicht gesund"; return 1
}

api_up() { [ "$(curl -s -o /dev/null -w '%{http_code}' https://konfi-quest.de/api/health || echo 000)" = "200" ]; }

roll() {  # roll <service> <bedient-waehrenddessen>
  local svc="$1" carrier="$2"
  echo "-- Tausche $svc (Traffic traegt $carrier) --"
  local cid; cid="$(container_id "$svc")"
  [ -n "$cid" ] || { echo "::error::$svc nicht gefunden"; return 1; }
  echo "  recreate $svc ($cid) -> HTTP $(recreate "$cid")"
  wait_healthy "$svc"
  api_up && echo "  OK API erreichbar waehrend $svc-Tausch" || echo "::warning::API kurz nicht erreichbar"
}

echo "== Rolling-Deploy =="
roll backend backend2     # Replica 1 zuerst
roll backend2 backend     # Replica 2 erst nach Gesundung von backend

# frontend (single) zuletzt
CIDF="$(container_id frontend)"
if [ -n "$CIDF" ]; then
  echo "-- Tausche frontend --"
  echo "  recreate frontend ($CIDF) -> HTTP $(recreate "$CIDF")"
  wait_healthy frontend || echo "::warning::frontend-Health unklar"
fi

# Verify: gesund + (falls Backend-Change) neuer Commit live.
echo "-- Verify --"
for i in $(seq 1 12); do
  sleep 5
  s="$(curl -s https://konfi-quest.de/api/status || echo '')"
  db="$(printf '%s' "$s" | python3 -c "import sys,json;print(json.load(sys.stdin).get('checks',{}).get('database',''))" 2>/dev/null || echo '')"
  live="$(printf '%s' "$s" | python3 -c "import sys,json;print(json.load(sys.stdin).get('commit',''))" 2>/dev/null || echo '')"
  if [ "$db" = "ok" ]; then
    if [ "$BACKEND_CHANGED" = "0" ] || [ "$live" = "$GIT_SHA" ]; then
      echo "OK Rolling-Deploy verifiziert: $s"; exit 0
    fi
    echo "  db ok, Commit noch ${live:0:12} (erwarte ${GIT_SHA:0:12})..."
  else
    echo "  warte auf gesunden Status ($i)"
  fi
done
echo "::error::Rolling-Deploy nicht verifiziert"; exit 1
