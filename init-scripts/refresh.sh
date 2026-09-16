#!/usr/bin/env bash
# Spiegelt Produktionsschema und Migrationsstand nach init-scripts/.
#
# Quelle sind die Dateien, aus denen auch die Testsuite ihre Datenbank baut
# (backend/tests/schema/). So gibt es EINE Quelle statt zweier, die
# auseinanderlaufen. Zum Auffrischen der Quelle vorher:
#
#   bash backend/tests/schema/refresh-schema.sh
#
# Aufruf:  bash init-scripts/refresh.sh
set -euo pipefail

HIER="$(cd "$(dirname "$0")" && pwd)"
QUELLE="$HIER/../backend/tests/schema"

SCHEMA_QUELLE="$QUELLE/prod-schema.sql"
STAND_QUELLE="$QUELLE/prod-migrations.txt"

for f in "$SCHEMA_QUELLE" "$STAND_QUELLE"; do
  [ -f "$f" ] || { echo "FEHLER: $f fehlt." >&2; exit 1; }
done

ZEILEN=$(wc -l < "$SCHEMA_QUELLE")
if [ "$ZEILEN" -lt 100 ]; then
  echo "FEHLER: $SCHEMA_QUELLE hat nur $ZEILEN Zeilen — nicht brauchbar." >&2
  exit 1
fi

# --- 1. Schema ------------------------------------------------------------
{
  cat <<'KOPF'
-- ====================================================================
-- Konfi Quest — Schema einer NEUEN Instanz
--
-- ERZEUGT, NICHT VON HAND GEPFLEGT.
-- Quelle: backend/tests/schema/prod-schema.sql (pg_dump der Produktion),
-- dieselbe Datei, aus der die Testsuite ihre Datenbank aufbaut.
-- Erneuern mit: bash init-scripts/refresh.sh
--
-- Laeuft NUR beim allerersten Start einer leeren Datenbank
-- (/docker-entrypoint-initdb.d). Fuer bestehende Datenbanken — also fuer
-- die Produktion — wirkt eine Aenderung hier NICHT: dafuer gehoert eine
-- Migration nach backend/migrations/.
--
-- Hintergrund und Ablauf: init-scripts/README.md
-- ====================================================================

KOPF
  cat "$SCHEMA_QUELLE"
} > "$HIER/01-create-schema.sql"

# --- 2. Migrationsstand ---------------------------------------------------
{
  cat <<'KOPF'
-- ====================================================================
-- Migrationsstand des Dumps aus 01-create-schema.sql
--
-- ERZEUGT, NICHT VON HAND GEPFLEGT.
-- Quelle: backend/tests/schema/prod-migrations.txt
-- Erneuern mit: bash init-scripts/refresh.sh
--
-- Das Schema oben enthaelt diese Migrationen bereits. Ohne die Eintraege
-- hier wuerde backend/database.js sie beim ersten Backend-Start erneut
-- anwenden. Alles, was danach kommt, laeuft regulaer nach.
-- ====================================================================

CREATE TABLE IF NOT EXISTS schema_migrations (
    name TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

INSERT INTO schema_migrations (name) VALUES
KOPF
  # Namen als VALUES-Liste, letzte Zeile mit Semikolon.
  grep -v '^[[:space:]]*$' "$STAND_QUELLE" \
    | sed "s/'/''/g" \
    | awk '{ printf "%s    (%c%s%c)", (NR>1 ? ",\n" : ""), 39, $0, 39 }'
  printf '\nON CONFLICT (name) DO NOTHING;\n'
} > "$HIER/02-migrationsstand.sql"

echo "OK: 01-create-schema.sql ($(wc -l < "$HIER/01-create-schema.sql") Zeilen)"
echo "OK: 02-migrationsstand.sql ($(grep -c "^    ('" "$HIER/02-migrationsstand.sql") Migrationen)"
