#!/usr/bin/env bash
# deploy/rollend.sh — rollender Deploy des Konfi-Quest-Stacks ueber die Portainer-API.
#
# Wird vom Deploy-Job in .github/workflows/ci.yml aufgerufen. Statt beide
# Backend-Replicas mit EINEM update_stack gleichzeitig zu ersetzen (10-20 s
# ohne API, alle Sockets getrennt -- Audit 26.09.2026, Betrieb BF-12 /
# Sammelbefund S-11), laeuft der Tausch in zwei Stufen:
#
#   Stufe 1: Image-Tag NUR fuer backend (und frontend) auf den neuen Commit-SHA
#            setzen -> update_stack. Docker Compose erstellt nur Dienste neu,
#            deren Konfiguration sich geaendert hat -- backend2 bleibt stehen
#            und traegt allen Traffic (Traefik routet nur zu gesunden Replicas).
#            Warten, bis der NEUE backend-Container (Image-Tag = neuer SHA)
#            laut Docker-Healthcheck gesund ist.
#   Stufe 2: Dasselbe fuer backend2.
#   Verify:  Mehrfach /api/status ueber die oeffentliche Adresse: Datenbank ok,
#            keine uebersprungene Migration, Commit = GIT_SHA (bei Backend-
#            Aenderung) -- Traefik verteilt, deshalb mehrere Abfragen.
#
# Zusammen mit dem Drain in server.js (SHUTDOWN_DRAIN_MS: /api/health meldet
# 503, bevor der alte Container schliesst) gibt es keinen Moment mehr, in dem
# keine gesunde Replica im Traefik-Pool steht.
#
# ANNAHME, nur in Produktion pruefbar: Portainers update_stack laeuft als
# `docker compose up -d` OHNE --force-recreate, d. h. ein unveraenderter Dienst
# wird nicht angefasst. Das Skript prueft das: Hat backend2 nach Stufe 1 eine
# andere Container-ID als davor, wurde es mit neu erstellt -- dann steht eine
# Warnung im Lauf, und der Deploy war NICHT lueckenlos (aber auch nicht
# schlechter als vorher).
#
# STAND 29.09.2026: Im ersten echten Lauf (Deploy von beb745e) kam genau diese
# Warnung -- backend2 wurde in Stufe 1 mit neu erstellt, die Annahme gilt so
# nicht. Die neuen Container standen zudem 13-20 s auf "created", was zu einem
# mit neu erstellten Postgres passt (depends_on: service_healthy). Messung und
# Gegenmittel: docs/auftraege/lokaler-agent/10-deploy-luecke.md.
#
# Umgebung (kommt aus dem Workflow; keine Werte hier, das Repo ist oeffentlich):
#   P_URL, P_KEY          Portainer-Adresse und API-Key
#   STACK_ID, ENDPOINT_ID Stack und Docker-Endpoint in Portainer
#   GIT_SHA               voller Commit-SHA dieses Builds (Image-Tag = erste 7 Zeichen)
#   BACKEND_CHANGED       1 = Commit-Verify gegen GIT_SHA, 0 = nur Gesundheit
#   STATUS_URL            oeffentliche /api/status-Adresse fuer den Verify
#   COMPOSE_PROJECT       Compose-Projektname der Container-Labels (Standard konfi_quest)
#   WARTE_S / WARTE_MAX   Abstand und Anzahl der Gesundheitsabfragen je Stufe (5 s x 36 = 3 min)
#   VERIFY_PAUSE_S        Abstand der Verify-Abfragen (2 s)
#   VERIFY_ANLAUF_MAX     Abfragen, bis der neue Stand zum ersten Mal antworten muss (30 x 2 s = 1 min)
#   FEHLER_PAUSE_S        Pause nach einem update_stack ohne 200 (15 s)
#   NUR_VORWAERTS         1 = nicht ausrollen, wenn schon ein NEUERER Stand live ist
#                         (CI-Deploy; siehe nur_vorwaerts unten). Der Notfall-Deploy
#                         setzt es nicht -- er darf bewusst zurueckrollen.
#   PROBELAUF             1 = alles lesen und pruefen, aber NICHTS am Stack aendern
#                         (Notfall-Deploy proben, siehe probelauf unten)
set -euo pipefail
: "${P_URL:?P_URL fehlt}" "${P_KEY:?P_KEY fehlt}" "${STACK_ID:?STACK_ID fehlt}"
: "${ENDPOINT_ID:?ENDPOINT_ID fehlt}" "${GIT_SHA:?GIT_SHA fehlt}" "${STATUS_URL:?STATUS_URL fehlt}"
BACKEND_CHANGED="${BACKEND_CHANGED:-1}"
COMPOSE_PROJECT="${COMPOSE_PROJECT:-konfi_quest}"
WARTE_S="${WARTE_S:-5}"
WARTE_MAX="${WARTE_MAX:-36}"
VERIFY_ABFRAGEN="${VERIFY_ABFRAGEN:-6}"
VERIFY_PAUSE_S="${VERIFY_PAUSE_S:-2}"
VERIFY_ANLAUF_MAX="${VERIFY_ANLAUF_MAX:-30}"
FEHLER_PAUSE_S="${FEHLER_PAUSE_S:-15}"
NUR_VORWAERTS="${NUR_VORWAERTS:-0}"
PROBELAUF="${PROBELAUF:-0}"

# Image-Tag: docker/metadata-action (type=sha,prefix=) pusht den KURZEN
# 7-stelligen SHA-Tag -- NICHT den vollen github.sha. GIT_SHA (voll) bleibt
# fuer den Commit-Verify (/api/status liefert den vollen, Build-Arg GIT_SHA).
IMG_TAG="${GIT_SHA:0:7}"
echo "Image-Tag (kurz): $IMG_TAG, Backend geaendert: $BACKEND_CHANGED"

api() { curl -sS -H "X-API-Key: $P_KEY" "$@"; }

# Nur vorwaerts (29.09.2026, Audit CI BF-04). Die concurrency-Gruppe im
# Workflow serialisiert die Deploys, sie ordnet sie nicht: Braucht der Test-
# lauf eines aelteren Pushs laenger, kommt sein Deploy NACH dem des neueren
# an die Reihe und setzte Produktion auf den aelteren Stand zurueck -- beide
# Verifies waeren gruen.
#
# Uebersprungen wird NUR, wenn es belegt ist: Jede der VERIFY_ABFRAGEN
# Antworten von /api/status nennt denselben Commit, dieser Commit ist nicht
# GIT_SHA, liegt im geklonten Verlauf (der Deploy-Job holt fetch-depth: 0),
# und GIT_SHA ist sein Vorfahre -- Produktion enthaelt diesen Stand also
# schon. In jedem anderen Fall (Status nicht erreichbar, Antworten
# uneinheitlich wie mitten in einem abgebrochenen Tausch, Commit unbekannt,
# Verlauf auseinandergelaufen) wird wie bisher ausgerollt. Die Pruefung kann
# einen noetigen Deploy also nicht still verhindern.
nur_vorwaerts() {
  local live="" c i
  for i in $(seq 1 "$VERIFY_ABFRAGEN"); do
    c="$(curl -sS --max-time 10 "$STATUS_URL" 2>/dev/null \
         | python3 -c "import sys,json;print(json.load(sys.stdin).get('commit',''))" 2>/dev/null || echo "")"
    if [ -z "$c" ]; then echo "Vorwaerts-Pruefung: Abfrage $i ohne Commit -> ausrollen"; return 1; fi
    if [ -n "$live" ] && [ "$c" != "$live" ]; then
      echo "Vorwaerts-Pruefung: uneinheitlich (${live:0:12} / ${c:0:12}) -> ausrollen"; return 1
    fi
    live="$c"
    if [ "$i" -lt "$VERIFY_ABFRAGEN" ]; then sleep "$VERIFY_PAUSE_S"; fi
  done
  if [ "$live" = "$GIT_SHA" ]; then echo "Vorwaerts-Pruefung: ${GIT_SHA:0:12} ist schon live -> erneut ausrollen"; return 1; fi
  if ! git cat-file -e "${live}^{commit}" 2>/dev/null; then
    echo "Vorwaerts-Pruefung: live ${live:0:12} nicht im Verlauf -> ausrollen"; return 1
  fi
  if git merge-base --is-ancestor "$GIT_SHA" "$live" 2>/dev/null; then
    echo "::notice::Deploy uebersprungen: Produktion laeuft schon auf ${live:0:12}, einem neueren Stand, der ${GIT_SHA:0:12} enthaelt."
    if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
      # Backticks sind Markdown fuer die Zusammenfassung, keine Befehle.
      # shellcheck disable=SC2016
      printf '### Deploy uebersprungen\n\nProduktion laeuft schon auf `%s`, einem neueren Stand, der `%s` enthaelt. Ein Ausrollen haette zurueckgedreht.\n' \
        "${live:0:12}" "${GIT_SHA:0:12}" >> "$GITHUB_STEP_SUMMARY"
    fi
    return 0
  fi
  echo "Vorwaerts-Pruefung: live ${live:0:12} ist aelter oder abgezweigt -> ausrollen"
  return 1
}

if [ "$NUR_VORWAERTS" = "1" ] && nur_vorwaerts; then
  exit 0
fi

# compose-Inhalt vom Stack holen (einmal, fuer beide Stufen).
hole_compose() {
  api "$P_URL/api/stacks/$STACK_ID/file" \
    | python3 -c "import sys,json;open('compose.yml','w').write(json.load(sys.stdin)['StackFileContent'])"
  test -s compose.yml || { echo "::error::compose leer"; exit 1; }
}

# IMMUTABLE TAGS: die konfi-quest-Images NUR in den genannten Diensten auf den
# Commit-SHA-Tag umschreiben. Portainers pullImage:true zieht ein :latest
# unzuverlaessig; ein eindeutiger Tag ZWINGT den korrekten Pull. JEDEN
# bestehenden Tag ersetzen (:latest ODER ein frueherer :sha), sonst greift
# der zweite Deploy nicht. Owner-agnostisch am eindeutigen
# 'konfi-quest-(backend|frontend)' geankert; backend-test (Tag test-latest,
# gebaut von test-backend.yml) bleibt unangetastet (Release-Audit CI BF-03).
# $1 = Dienste als Alternation, z. B. "backend|frontend" oder "backend2".
schreibe_tags() {
  DIENSTE="$1" IMG_TAG="$IMG_TAG" perl -i -pe '
    BEGIN { $svc = ""; $muster = qr/^(?:$ENV{DIENSTE})$/ }
    $svc = ""  if /^\S/;
    $svc = $1  if /^  ([A-Za-z0-9_.-]+):\s*(?:#.*)?$/;
    s#(konfi-quest-(?:backend|frontend)):[A-Za-z0-9._-]+#$1:$ENV{IMG_TAG}#g
      if $svc =~ $muster;
  ' compose.yml
}

image_von() {  # <dienst> -> image-Zeile dieses Dienstblocks in compose.yml
  awk -v svc="$1" '$0 ~ "^  "svc":" {f=1; next} f && /^  [A-Za-z0-9_.-]+:/ {f=0} f && /image:/ {print $2; exit}' compose.yml
}

update_stack() {  # gibt den HTTP-Status aus
  python3 - <<'PY'
import json, os, urllib.request, urllib.error
url, key = os.environ["P_URL"], os.environ["P_KEY"]
sid, eid = os.environ["STACK_ID"], os.environ["ENDPOINT_ID"]
compose = open("compose.yml").read()
# Die Stack-Variablen (etwa SMTP_HOST) unverändert zurückschicken: Portainer
# ERSETZT sie beim Update durch die mitgeschickte Liste -- "env": [] löschte
# sie bei jedem Deploy (27.09.2026). Ohne Variablen bricht die Referenz-Compose
# mit "SMTP_HOST fehlt" ab. Ohne gesetzte Variablen bleibt es eine leere Liste.
req = urllib.request.Request(f"{url}/api/stacks/{sid}")
req.add_header("X-API-Key", key)
try:
    env = json.load(urllib.request.urlopen(req, timeout=30)).get("Env") or []
except Exception:
    print("000"); raise SystemExit(0)
body = json.dumps({"stackFileContent": compose, "env": env, "prune": False, "pullImage": True}).encode()
req = urllib.request.Request(f"{url}/api/stacks/{sid}?endpointId={eid}", data=body, method="PUT")
req.add_header("X-API-Key", key); req.add_header("Content-Type", "application/json")
try:
    r = urllib.request.urlopen(req, timeout=180); print(r.status)
except urllib.error.HTTPError as e:
    print(e.code)
except Exception:
    print("000")
PY
}

# Container eines Compose-Dienstes: "ID<TAB>Image<TAB>Health" (oder leer).
# Health kommt aus dem Inspect (State.Health.Status), die Liste kennt es nicht.
container_zustand() {
  local svc="$1"
  api "$P_URL/api/endpoints/$ENDPOINT_ID/docker/containers/json?all=1" \
    | python3 -c "
import sys, json
svc, projekt = sys.argv[1], sys.argv[2]
kandidaten = [c for c in json.load(sys.stdin)
              if c.get('Labels', {}).get('com.docker.compose.service') == svc
              and c.get('Labels', {}).get('com.docker.compose.project', projekt) == projekt]
# Bei mehreren (alter und neuer waehrend des Tauschs): den juengsten nehmen.
kandidaten.sort(key=lambda c: c.get('Created', 0), reverse=True)
if kandidaten:
    print(kandidaten[0]['Id'])
" "$svc" "$COMPOSE_PROJECT" | {
      read -r cid || true
      [ -n "${cid:-}" ] || { echo ""; return 0; }
      api "$P_URL/api/endpoints/$ENDPOINT_ID/docker/containers/$cid/json" \
        | python3 -c "
import sys, json
c = json.load(sys.stdin)
print('%s\t%s\t%s' % (c['Id'], c.get('Config', {}).get('Image', ''),
                      c.get('State', {}).get('Health', {}).get('Status', c.get('State', {}).get('Status', 'none'))))
"
    }
}

container_id() { container_zustand "$1" | cut -f1; }

# Warten, bis der Container des Dienstes den NEUEN Tag traegt und gesund ist.
warte_gesund() {
  local svc="$1"
  for i in $(seq 1 "$WARTE_MAX"); do
    local z; z="$(container_zustand "$svc")"
    local image health
    image="$(printf '%s' "$z" | cut -f2)"; health="$(printf '%s' "$z" | cut -f3)"
    echo "  $svc: ${image:-<kein Container>} ${health:-}"
    if [[ "$image" == *":$IMG_TAG" && "$health" == "healthy" ]]; then return 0; fi
    sleep "$WARTE_S"
  done
  return 1
}

# Eine Stufe: Tags schreiben, update_stack, auf Gesundheit warten. Bis zu drei
# Runden faengt das ghcr-Propagations-Race ab (Image evtl. erst Sekunden nach
# dem Build da -> erster Pull zieht altes / scheitert).
stufe() {  # <dienste-alternation> <zu-pruefender-dienst>
  local dienste="$1" pruefe="$2"
  for runde in 1 2 3; do
    echo "== Stufe '$dienste', Runde $runde =="
    schreibe_tags "$dienste"
    local code; code="$(update_stack)"; echo "update_stack HTTP $code"
    if [ "$code" != "200" ]; then echo "::warning::update_stack HTTP $code"; sleep "$FEHLER_PAUSE_S"; continue; fi
    if warte_gesund "$pruefe"; then echo "OK $pruefe gesund auf :$IMG_TAG"; return 0; fi
    echo "Runde $runde: $pruefe nicht gesund auf :$IMG_TAG -> erneut"
  done
  echo "::error::$pruefe wurde nach 3 Runden nicht gesund auf :$IMG_TAG"
  return 1
}

hole_compose
bt_vorher="$(image_von backend-test)"

# Probelauf (29.09.2026, Audit CI BF-10): Der Notfall-Deploy war nie gelaufen,
# und ein echter Lauf veraendert Produktion. Der Probelauf geht denselben Weg
# bis unmittelbar vor update_stack -- Zugang zur Portainer-API (Stack-Datei,
# Variablen, Container), Tag-Umschreibung aller drei Dienste auf einer Kopie,
# Gegenprobe auf backend-test, Statusabfrage -- und schreibt NICHTS. Was
# danach kommt (update_stack, Warten auf gesund, Verify), laeuft bei jedem
# Push auf main im CI-Deploy mit genau diesem Skript.
if [ "$PROBELAUF" = "1" ]; then
  echo "== Probelauf: es wird nichts am Stack geaendert =="
  cp compose.yml compose.vorher.yml
  schreibe_tags "backend|frontend|backend2"
  for d in backend backend2 frontend backend-test; do
    echo "  $d: $(awk -v svc="$d" '$0 ~ "^  "svc":" {f=1; next} f && /^  [A-Za-z0-9_.-]+:/ {f=0} f && /image:/ {print $2; exit}' compose.vorher.yml) -> $(image_von "$d")"
  done
  fehler=0
  for d in backend backend2 frontend; do
    case "$(image_von "$d")" in *":$IMG_TAG") ;; *) echo "::error::Probelauf: $d stuende nicht auf :$IMG_TAG"; fehler=1 ;; esac
  done
  if [ "$(image_von backend-test)" != "$bt_vorher" ]; then echo "::error::Probelauf: Tag-Umschreibung wuerde backend-test anfassen"; fehler=1; fi
  anzahl_env="$(api "$P_URL/api/stacks/$STACK_ID" | python3 -c "import sys,json;print(len(json.load(sys.stdin).get('Env') or []))" 2>/dev/null || echo "?")"
  echo "  Stack-Variablen, die mitgeschickt wuerden: $anzahl_env"
  for d in backend backend2 frontend; do echo "  laufend $d: $(container_zustand "$d" | cut -f2,3)"; done
  echo "  live: $(curl -sS --max-time 10 "$STATUS_URL" 2>/dev/null | head -c 300 || echo "nicht erreichbar")"
  rm -f compose.vorher.yml
  if [ "$fehler" != "0" ]; then echo "::error::Probelauf mit Fehlern -- ein echter Lauf wuerde hier abbrechen."; exit 1; fi
  echo "OK Probelauf: Zugang, Images und Umschreibung stimmen, update_stack wurde NICHT aufgerufen."
  exit 0
fi

b2_vorher="$(container_id backend2)"
echo "backend2 vor Stufe 1: ${b2_vorher:-<kein Container>}"

# Stufe 1: backend (+ frontend) -- backend2 traegt den Traffic.
stufe "backend|frontend" backend

b2_zwischen="$(container_id backend2)"
if [ -n "$b2_vorher" ] && [ "$b2_vorher" != "$b2_zwischen" ]; then
  echo "::warning::backend2 wurde in Stufe 1 mit neu erstellt (${b2_vorher:0:12} -> ${b2_zwischen:0:12}). Portainer scheint alle Dienste neu zu erstellen -- der Tausch war nicht lueckenlos."
fi

# Stufe 2: backend2 -- das frische backend traegt den Traffic.
stufe "backend2" backend2

# Gegenprobe: backend-test unveraendert, sonst hat der Rewrite zu weit gegriffen.
bt_nachher="$(image_von backend-test)"
if [ "$bt_vorher" != "$bt_nachher" ]; then
  echo "::error::Tag-Rewrite hat backend-test angefasst ($bt_vorher -> $bt_nachher)."; exit 1
fi
case "$bt_nachher" in
  ""|*:test-*) ;;
  *) echo "::warning::backend-test steht auf $bt_nachher statt auf test-latest -- Altlast eines frueheren Rewrites. Im Portainer-Stack von Hand auf test-latest zurueckstellen." ;;
esac
grep -q "konfi-quest-backend:${IMG_TAG}" compose.yml || { echo "::error::Tag-Rewrite backend fehlgeschlagen"; exit 1; }
grep -q "konfi-quest-frontend:${IMG_TAG}" compose.yml || { echo "::error::Tag-Rewrite frontend fehlgeschlagen"; exit 1; }

# Verify ueber die oeffentliche Adresse -- mehrfach, weil Traefik verteilt.
#
# ANLAUF (30.09.2026): Direkt nach dem Tausch kann die erste Antwort fehlen.
# Beim Deploy von 4145114 kam die erste Abfrage 1 s nach "backend2 gesund"
# ohne Antwort, die fuenf folgenden meldeten den neuen Stand -- der Lauf war
# rot, obwohl der Stand live war, und ein roter Lauf sperrt die Store-Builds
# (Release-Tor). Ursache ist die Deploy-Luecke: Portainer erstellt alle Dienste
# neu (Warnung oben, Auftrag 10). Deshalb erst warten, bis eine Abfrage den
# erwarteten Stand meldet (hoechstens VERIFY_ANLAUF_MAX Versuche im Abstand
# VERIFY_PAUSE_S), dann STRENG VERIFY_ABFRAGEN gueltige Antworten in Folge.
# Fehlantworten im Anlauf werden nicht verschluckt: Sie stehen als Warnung mit
# Zahl und Dauer im Lauf -- das ist zugleich die Messung fuer Auftrag 10.
pruefe_status() {  # eine Abfrage; setzt s/db/live; 0 = erwarteter Stand
  s="$(curl -sS "$STATUS_URL" || echo "")"
  db="$(printf '%s' "$s"   | python3 -c "import sys,json;print(json.load(sys.stdin).get('checks',{}).get('database',''))" 2>/dev/null || echo "")"
  local mig
  mig="$(printf '%s' "$s"  | python3 -c "import sys,json;print(json.load(sys.stdin).get('checks',{}).get('migrations','ok'))" 2>/dev/null || echo "ok")"
  live="$(printf '%s' "$s" | python3 -c "import sys,json;print(json.load(sys.stdin).get('commit',''))" 2>/dev/null || echo "")"
  # Migrationsstand (Audit Datenbank BF-04): eine uebersprungene Migration
  # meldet /api/status als checks.migrations=fehler -- bei database=ok.
  if [ "$mig" = "fehler" ] && [ "$live" = "$GIT_SHA" ]; then
    echo "::error::Migration beim Start uebersprungen -- Schema und Code passen nicht zusammen: $s"; exit 1
  fi
  [ "$db" = "ok" ] && { [ "$BACKEND_CHANGED" = "0" ] || [ "$live" = "$GIT_SHA" ]; }
}

echo "== Anlauf (hoechstens $VERIFY_ANLAUF_MAX Abfragen) =="
fehl=0
anlauf_beginn=$SECONDS
until pruefe_status; do
  fehl=$((fehl + 1))
  echo "  Anlauf $fehl: db=$db commit=${live:0:12} (erwarte ${GIT_SHA:0:12})"
  if [ "$fehl" -ge "$VERIFY_ANLAUF_MAX" ]; then
    echo "::error::Deploy nicht verifiziert: nach $fehl Abfragen ($((SECONDS - anlauf_beginn)) s) meldet /api/status den erwarteten Stand nicht."
    exit 1
  fi
  sleep "$VERIFY_PAUSE_S"
done
if [ "$fehl" -gt 0 ]; then
  echo "::warning::Nach dem Tausch $fehl Fehlantwort(en) in $((SECONDS - anlauf_beginn)) s, bevor der neue Stand antwortete -- Deploy-Luecke, Auftrag 10."
fi

echo "== Verify ($VERIFY_ABFRAGEN Abfragen in Folge) =="
treffer=1
echo "  1: ok (commit ${live:0:12})"
for i in $(seq 2 "$VERIFY_ABFRAGEN"); do
  sleep "$VERIFY_PAUSE_S"
  if pruefe_status; then
    treffer=$((treffer + 1)); echo "  $i: ok (commit ${live:0:12})"
  else
    echo "  $i: db=$db commit=${live:0:12} (erwarte ${GIT_SHA:0:12})"
  fi
done
if [ "$treffer" = "$VERIFY_ABFRAGEN" ]; then
  echo "OK Rollender Deploy verifiziert: $s"; exit 0
fi
echo "::error::Deploy nicht verifiziert ($treffer von $VERIFY_ABFRAGEN Abfragen ok)"
exit 1
