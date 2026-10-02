#!/usr/bin/env bash
# Erneuert prod-schema.sql und prod-migrations.txt aus dem Migrationsstand
# des Repos -- reproduzierbar, ohne Zugang zur Produktion.
#
# Ablauf: In einem Wegwerf-Container (postgres:15-alpine, dieselbe
# Hauptversion wie die Produktion) den bisherigen Dump einspielen, die
# vermerkten Migrationen eintragen, alle offenen Migrationen bis BIS
# anwenden -- je Datei in einer Transaktion samt Eintrag in
# schema_migrations, wie backend/utils/migrationslauf.js --, dann
# pg_dump --schema-only mit denselben Optionen wie refresh-schema.sh.
# Dann spiegelt init-scripts-spiegeln.sh beides nach init-scripts/, und zum
# Schluss verschwinden die Dateien, die jetzt im Dump stehen, aus
# backend/migrations/ (Grenze seit 02.10.2026: dort liegt nur, was NACH dem
# Dump kam; Waechter tests/schema/dumpAktualitaet.test.js).
#
# Aufruf:  bash backend/tests/schema/schema-erneuern.sh BIS
#   BIS  Dateiname der letzten Migration, die in den Dump eingeht. PFLICHT,
#        und nur eine Migration, die in der Produktion schon gelaufen ist:
#        Ihre Datei wird danach entfernt -- eine Migration, die die
#        Produktion noch nicht hatte, liefe dort nie mehr. (Bis 02.10.2026
#        nahm das Skript ohne BIS alle Dateien; das ging nur, solange nichts
#        geloescht wurde.)
# Braucht Docker. Keine Ports, keine Adressen: alles ueber docker exec.
#
# Rhythmus (Audit Datenbank BF-17 / Tests BF-14, 29.09.2026): mit jedem
# Release, spaetestens wenn tests/schema/dumpAktualitaet.test.js anschlaegt
# (zu viele offene Migrationen ueber dem Dump). Ob die Produktion dem
# erneuerten Stand entspricht, misst der Betrieb mit
# backend/scripts/schemaVergleich.js (Auftrag
# docs/auftraege/lokaler-agent/11-schema-und-rueckspielprobe.md);
# refresh-schema.sh holt den Dump bei Bedarf direkt aus der Produktion.
set -euo pipefail
# Sortierung wie der Migrationslauf (JavaScript sort = Bytefolge), nicht nach
# der Sprache der Shell: "064_add_missing_fks" vor "064_add_missing_indexes".
export LC_ALL=C

HIER="$(cd "$(dirname "$0")" && pwd)"
MIGRATIONEN="$(cd "$HIER/../../migrations" && pwd)"
SCHEMA="$HIER/prod-schema.sql"
STAND="$HIER/prod-migrations.txt"
BIS="${1:-}"
[ -n "$BIS" ] || { echo "FEHLER: BIS fehlt -- Dateiname der letzten Migration, die in der Produktion gelaufen ist." >&2; exit 1; }
[ -f "$MIGRATIONEN/$BIS" ] || { echo "FEHLER: $MIGRATIONEN/$BIS gibt es nicht." >&2; exit 1; }

C="kq-schema-erneuern-$$"
trap 'docker rm -f "$C" >/dev/null 2>&1 || true' EXIT
docker run -d --name "$C" -e POSTGRES_PASSWORD=wegwerf -e POSTGRES_DB=schema postgres:15-alpine >/dev/null
for i in $(seq 1 60); do
  docker exec "$C" pg_isready -U postgres -d schema >/dev/null 2>&1 \
    && docker logs "$C" 2>&1 | grep -q "PostgreSQL init process complete" && break
  sleep 1
done
psql_c() { docker exec -i -e PGOPTIONS="-c client_min_messages=warning" "$C" psql -U postgres -d schema -X -q -v ON_ERROR_STOP=1 "$@"; }

echo "Basis: $(grep -m1 '^-- Dumped from' "$SCHEMA" || echo 'unbekannt'), $(grep -c . "$STAND") vermerkte Migrationen"
psql_c < "$SCHEMA" >/dev/null
psql_c -c "CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())" >/dev/null
grep -v '^[[:space:]]*$' "$STAND" | sed "s/'/''/g; s/.*/INSERT INTO schema_migrations (name) VALUES ('&') ON CONFLICT DO NOTHING;/" | psql_c >/dev/null

neu=0
for f in $(ls "$MIGRATIONEN" | grep '\.sql$' | sort); do
  [[ "$f" > "$BIS" ]] && break
  if [ "$(psql_c -At -c "SELECT count(*) FROM schema_migrations WHERE name = '$f'")" = "1" ]; then
    continue
  fi
  { cat "$MIGRATIONEN/$f"; printf "\n;\nINSERT INTO schema_migrations (name) VALUES ('%s');\n" "$f"; } \
    | psql_c --single-transaction >/dev/null
  neu=$((neu + 1))
done
echo "Angewandt: $neu Migrationen bis $BIS"

{
  cat <<KOPF
-- ====================================================================
-- Schema der Produktion, fortgeschrieben aus dem Migrationsstand.
--
-- ERZEUGT, NICHT VON HAND GEPFLEGT: bash backend/tests/schema/schema-erneuern.sh
-- Grundlage ist der zuletzt mit refresh-schema.sh aus der Produktion geholte
-- Dump, darauf alle Migrationen bis einschliesslich
-- $BIS -- also der Stand, den die Produktion nach
-- diesen Migrationen hat, sofern dort nichts von Hand geaendert wurde. Den
-- Abgleich mit der Produktion misst backend/scripts/schemaVergleich.js.
-- ====================================================================

KOPF
  docker exec "$C" pg_dump -U postgres -d schema --schema-only --no-owner --no-privileges --no-comments \
    | grep -v '^\\restrict' \
    | grep -v '^\\unrestrict' \
    | grep -v "set_config('search_path'"
} > "$SCHEMA.neu"
psql_c -At -c "SELECT name FROM schema_migrations ORDER BY name" > "$STAND.neu"

ZEILEN=$(wc -l < "$SCHEMA.neu")
[ "$ZEILEN" -ge 100 ] || { echo "FEHLER: Dump hat nur $ZEILEN Zeilen -- nichts ersetzt." >&2; rm -f "$SCHEMA.neu" "$STAND.neu"; exit 1; }
mv "$SCHEMA.neu" "$SCHEMA"
mv "$STAND.neu" "$STAND"
echo "OK: $SCHEMA ($ZEILEN Zeilen), $STAND ($(grep -c . "$STAND") Migrationen)"

bash "$HIER/init-scripts-spiegeln.sh"

# Was jetzt im Dump steht, laeuft nirgends mehr als Datei: in der Produktion
# ist es vermerkt, eine neue Instanz bekommt es aus init-scripts/.
entfernt=0
while IFS= read -r name; do
  [ -n "$name" ] && [ -f "$MIGRATIONEN/$name" ] || continue
  rm "$MIGRATIONEN/$name"
  echo "entfernt (steht jetzt im Dump): backend/migrations/$name"
  entfernt=$((entfernt + 1))
done < "$STAND"
echo "OK: $entfernt Migrationsdatei(en) entfernt -- mit Dump und init-scripts/ zusammen committen."
