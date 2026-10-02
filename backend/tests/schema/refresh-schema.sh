#!/usr/bin/env bash
# Holt das Produktions-Schema als Basis fuer die Test-DB.
#
# Warum ein Dump und nicht die Migrationen?
# Das Repo KANN Produktion nicht allein aus Migrationen reproduzieren: Die
# Kette begann schon frueher erst bei 064, manches entstand in Produktion von
# Hand, und seit dem 02.10.2026 liegen in backend/migrations/ nur noch die
# Migrationen NACH dem Dump (init-scripts/README.md). Der Dump ist der
# einzige Startpunkt.
#
# Danach gilt dieselbe Grenze wie nach schema-erneuern.sh: Was der neue
# Migrationsstand nennt, gehoert aus backend/migrations/ entfernt -- sonst
# schlaegt tests/schema/dumpAktualitaet.test.js an.
#
# Der regelmaessige Weg ist schema-erneuern.sh (fortschreiben aus dem
# Migrationsstand, ohne Produktionszugang). Dieses Skript holt den Dump
# direkt aus der Produktion -- etwa wenn schemaVergleich.js dort eine
# Handaenderung gefunden hat. Danach init-scripts-spiegeln.sh.
#
# Ablauf: Dieser Dump ist die Basis, darauf laufen nur noch die Migrationen,
# die in Produktion noch nicht angewandt sind — derselbe Weg wie beim Deploy.
#
# Aufruf:  bash backend/tests/schema/refresh-schema.sh
# Die set_config('search_path','')-Zeile von pg_dump wird herausgefiltert:
# Im Dump ist jeder Bezeichner voll qualifiziert (public.users), spaetere
# Statements sind es nicht. Bliebe sie drin, scheiterte das naechste
# CREATE TABLE mit "no schema has been selected to create in".
set -euo pipefail

ZIEL="$(dirname "$0")/prod-schema.sql"
SERVER="${KQ_PROD_SSH:?KQ_PROD_SSH (user@host) fehlt -- Betriebszugang, steht nicht im Repo}"
CONTAINER="${KQ_PROD_DB_CONTAINER:-kq-postgres}"

echo "Hole Schema von $SERVER ($CONTAINER) ..."

ssh -o StrictHostKeyChecking=no "$SERVER" \
  "docker exec $CONTAINER pg_dump -U konfi_user -d konfi_db \
     --schema-only --no-owner --no-privileges --no-comments" \
  | grep -v '^\\restrict' \
  | grep -v '^\\unrestrict' \
  | grep -v "set_config('search_path'" \
  > "$ZIEL"

ZEILEN=$(wc -l < "$ZIEL")
if [ "$ZEILEN" -lt 100 ]; then
  echo "FEHLER: Dump hat nur $ZEILEN Zeilen — abgebrochen, Datei nicht brauchbar." >&2
  exit 1
fi

echo "OK: $ZIEL ($ZEILEN Zeilen)"
echo
echo "Danach den Stand der angewandten Migrationen mitziehen:"
echo "  ssh $SERVER \"docker exec $CONTAINER psql -U konfi_user -d konfi_db -t -A -c \\\"SELECT name FROM schema_migrations ORDER BY name;\\\"\" > \$(dirname \"$ZIEL\")/prod-migrations.txt"
