#!/usr/bin/env bash
# Welchen Stand rollt der Notfall-Deploy aus? (.github/workflows/notfall-deploy.yml)
#
# Eingabe (Umgebung):
#   EINGABE_TAG   7-stelliger Commit-Tag, oder leer = juengster Stand auf dem
#                 ausgecheckten Zweig, zu dem es gebaute Images gibt
#   IMAGE_PREFIX  Standard: ghcr.io/revisor01/konfi-quest
#   SUCHTIEFE     wie viele Commits bei leerem Tag hoechstens durchsucht werden
#                 (Standard 50)
# Ausgabe: tag=<7 Zeichen> und voll=<40 Zeichen> nach $GITHUB_OUTPUT (falls
# gesetzt) und auf stdout. Exit 1, wenn es den Stand oder seine Images nicht
# gibt -- dann bleibt Produktion unveraendert.
#
# Warum ein eigenes Skript (30.09.2026, Probelauf Auftrag 05): Bis hierher
# nahm "Tag leer" schlicht HEAD. Nicht jeder Commit auf main baut Images -- der
# Pfadfilter in ci.yml laesst etwa reine Doku unter docs/betrieb/ oder
# docs/auftraege/ aus, und ein roter Lauf baut ebenfalls nichts. Der Probelauf
# am 30.09. mit leerem Tag brach deshalb ab ("Image konfi-quest-backend:7d8e945
# existiert nicht"), obwohl Produktion den Stand zwei Commits davor fuhr. Sicher,
# aber im Ernstfall genau die Verwirrung, die der Notfallweg vermeiden soll.
# Jetzt sucht "leer" rueckwaerts den juengsten Commit, zu dem BEIDE Images auf
# ghcr liegen -- das ist der Stand, den der letzte gruene CI-Lauf gebaut hat.
set -euo pipefail

PREFIX="${IMAGE_PREFIX:-ghcr.io/revisor01/konfi-quest}"
TIEFE="${SUCHTIEFE:-50}"

beide_images() {  # <tag> -> 0, wenn backend UND frontend unter dem Tag liegen
  docker manifest inspect "$PREFIX-backend:$1" >/dev/null 2>&1 &&
    docker manifest inspect "$PREFIX-frontend:$1" >/dev/null 2>&1
}

ausgabe() {  # <tag> <voll>
  echo "Stand: $1 ($2)"
  if [ -n "${GITHUB_OUTPUT:-}" ]; then
    { echo "tag=$1"; echo "voll=$2"; } >> "$GITHUB_OUTPUT"
  fi
}

if [ -z "${EINGABE_TAG:-}" ]; then
  echo "Kein Tag angegeben -> juengster Stand mit gebauten Images (hoechstens $TIEFE Commits zurueck)"
  for voll in $(git rev-list --max-count="$TIEFE" HEAD); do
    tag="${voll:0:7}"
    if beide_images "$tag"; then
      ausgabe "$tag" "$voll"
      exit 0
    fi
    echo "  $tag: keine Images (nur Doku, roter Lauf oder Build laeuft noch) -> weiter zurueck"
  done
  echo "::error::In den letzten $TIEFE Commits gibt es keinen Stand mit beiden Images. Abbruch — Produktion bleibt unveraendert."
  exit 1
fi

tag="$(printf '%s' "$EINGABE_TAG" | cut -c1-7)"
echo "Angegebener Tag: $tag"
if ! printf '%s' "$tag" | grep -Eq '^[0-9a-f]{7}$'; then
  echo "::error::'$tag' ist kein 7-stelliger Commit-Tag."
  exit 1
fi
# Voller Commit fuer den Verify: /api/status meldet den vollen SHA, der beim
# Bau ins Image kam. Mehrdeutig oder unbekannt -> Abbruch.
if ! voll="$(git rev-parse --verify --quiet "${tag}^{commit}")"; then
  echo "::error::Zu $tag gibt es keinen (eindeutigen) Commit im Repo. Abbruch — Produktion bleibt unveraendert."
  exit 1
fi

# Vorab pruefen statt blind deployen: Liegt das Image nicht auf ghcr, zieht der
# Redeploy sonst den alten Stand und meldet trotzdem Erfolg.
fehlt=0
for repo in backend frontend; do
  if docker manifest inspect "$PREFIX-$repo:$tag" >/dev/null 2>&1; then
    echo "  ok: konfi-quest-$repo:$tag"
  else
    echo "::error::Image konfi-quest-$repo:$tag existiert nicht auf ghcr."
    fehlt=1
  fi
done
if [ "$fehlt" = "1" ]; then
  echo "::error::Abbruch — Produktion bleibt unveraendert. Erst den regulaeren Build abwarten."
  exit 1
fi
ausgabe "$tag" "$voll"
