#!/usr/bin/env bash
# Holt das Produktions-Schema als Basis fuer die Test-DB.
#
# Warum ein Dump und nicht die Migrationen?
# Das Repo KANN Produktion nicht reproduzieren: Die Migrationskette beginnt
# erst bei 064, und fuer einige Objekte (daily_verses, activities.category,
# konfi_profiles.password_plain) existiert nirgends ein DDL — sie wurden in
# Produktion von Hand angelegt. Wer aus den Migrationen baut, testet ein
# Schema, das es so nie gab.
#
# Ablauf: Dieser Dump ist die Basis, darauf laufen nur noch die Migrationen,
# die in Produktion noch nicht angewandt sind — derselbe Weg wie beim Deploy.
#
# Aufruf:  bash backend/tests/schema/refresh-schema.sh
set -euo pipefail

ZIEL="$(dirname "$0")/prod-schema.sql"
SERVER="${KQ_PROD_SSH:-root@kkd-fahrtenbuch.de}"
CONTAINER="${KQ_PROD_DB_CONTAINER:-kq-postgres}"

echo "Hole Schema von $SERVER ($CONTAINER) ..."

ssh -o StrictHostKeyChecking=no "$SERVER" \
  "docker exec $CONTAINER pg_dump -U konfi_user -d konfi_db \
     --schema-only --no-owner --no-privileges --no-comments" \
  | grep -v '^\\restrict' \
  | grep -v '^\\unrestrict' \
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
