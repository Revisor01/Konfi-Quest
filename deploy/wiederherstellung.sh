#!/usr/bin/env bash
# deploy/wiederherstellung.sh — spielt eine Sicherung aus deploy/sicherung.sh
# (pg_dump -Fc) in eine LEERE Datenbank zurück.
#
# Beschreibung und Ablauf: docs/betrieb/sicherung.md, "Wiederherstellung".
#
# KEINE Adressen und Zugangsdaten hier -- das Repo ist öffentlich. Alles
# Instanzspezifische kommt über die Umgebung:
#   DUMP           Pfad zur Sicherung (konfi_db_<stempel>.dump)          (Pflicht)
#   PG_CONTAINER   Name des Postgres-Containers (docker ps). Ohne ihn
#                  laufen psql/pg_restore direkt, verbunden über die
#                  üblichen PGHOST, PGPORT, PGUSER, PGPASSWORD.
#   PG_DB          Zieldatenbank            (Standard: konfi_db)
#   PG_USER        Eigentümer der Zieldatenbank (Standard: konfi_user)
#   JOBS           parallele Prozesse beim Einspielen (Standard: 2)
#   BESTAETIGT     "ja", wenn die Zieldatenbank schon Konten enthält --
#                  sie wird dabei ERSETZT. Ohne das bricht das Skript ab.
#
# Warum ein Skript (29.09.2026, Audit Datenbank BF-05). Nachgestellt mit
# postgres:15-alpine, einer Sicherung wie deploy/sicherung.sh sie schreibt
# (20.000 Konten, 100.000 Buchungen) und einer frisch aufgesetzten Instanz
# nach der Referenz-Compose:
#   - Einspielen in die Datenbank, die das Image beim ersten Start anlegt:
#     init-scripts/ hat dort schon das Schema angelegt -> 477 Fehlerzeilen,
#     danach 0 Konten.
#   - Der bis dahin beschriebene Weg (DROP/CREATE, dann
#     `docker exec -i ... pg_restore -j 4 < dump`) scheiterte sofort:
#     "parallel restore from standard input is not supported" -- die
#     Datenbank blieb leer. pg_restore kann nur aus einer DATEI parallel
#     lesen; das Skript kopiert die Sicherung deshalb in den Container.
# Mit diesem Skript: dieselbe Sicherung auf derselben frischen Instanz
# fehlerfrei, alle Zeilenzahlen gleich.
set -euo pipefail

: "${DUMP:?DUMP fehlt (Pfad zur Sicherung, pg_dump -Fc)}"
PG_DB="${PG_DB:-konfi_db}"
PG_USER="${PG_USER:-konfi_user}"
JOBS="${JOBS:-2}"
MIN_BYTES=1024

[ -f "$DUMP" ] || { echo "FEHLER: $DUMP gibt es nicht." >&2; exit 1; }
GROESSE=$(stat -c %s "$DUMP")
[ "$GROESSE" -ge "$MIN_BYTES" ] || { echo "FEHLER: $DUMP hat nur $GROESSE Byte -- keine brauchbare Sicherung." >&2; exit 1; }
case "$PG_DB" in
  *[!a-zA-Z0-9_]*|'') echo "FEHLER: PG_DB darf nur Buchstaben, Ziffern und _ enthalten." >&2; exit 1 ;;
esac
case "$PG_USER" in
  *[!a-zA-Z0-9_]*|'') echo "FEHLER: PG_USER darf nur Buchstaben, Ziffern und _ enthalten." >&2; exit 1 ;;
esac

# psql/pg_restore im Container oder direkt -- dieselben Aufrufe.
if [ -n "${PG_CONTAINER:-}" ]; then
  sql() { docker exec -i "$PG_CONTAINER" psql -U "$PG_USER" -X -v ON_ERROR_STOP=1 -q -At "$@"; }
  liste() { docker exec -i "$PG_CONTAINER" pg_restore --list < "$DUMP"; }
else
  sql() { psql -X -v ON_ERROR_STOP=1 -q -At "$@"; }
  liste() { pg_restore --list "$DUMP"; }
fi

echo "== Wiederherstellung von $DUMP ($GROESSE Byte) nach $PG_DB =="

# 1. Liest sich die Sicherung, und enthält sie die Kerntabellen?
KERN=$(liste | grep -cE 'TABLE DATA public (users|konfi_profiles|events|chat_messages) ' || true)
[ "$KERN" -eq 4 ] || { echo "FEHLER: Sicherung unvollständig oder nicht lesbar ($KERN von 4 Kerntabellen)." >&2; exit 1; }

# 2. Zielzustand prüfen. Gibt es die Datenbank schon, mit Konten darin, wird
#    sie ersetzt -- das nur mit ausdrücklicher Bestätigung. Eine Instanz, die
#    gerade frisch aus init-scripts/ kam, hat Tabellen, aber keine Konten.
VORHANDEN=$(sql -d postgres -c "SELECT count(*) FROM pg_database WHERE datname = '$PG_DB'")
if [ "$VORHANDEN" = "1" ]; then
  KONTEN=$(sql -d "$PG_DB" -c "SELECT CASE WHEN to_regclass('public.users') IS NULL THEN 0 ELSE (SELECT count(*) FROM public.users) END")
  if [ "$KONTEN" != "0" ] && [ "${BESTAETIGT:-}" != "ja" ]; then
    echo "FEHLER: $PG_DB enthält $KONTEN Konten. Die Wiederherstellung ERSETZT die Datenbank." >&2
    echo "        Wenn das gewollt ist: mit BESTAETIGT=ja erneut aufrufen." >&2
    exit 1
  fi
  # Laufende Backends würden beim Neustart Migrationen gegen eine halbe
  # Datenbank fahren -- sie müssen vorher angehalten sein.
  SITZUNGEN=$(sql -d postgres -c "SELECT count(*) FROM pg_stat_activity WHERE datname = '$PG_DB' AND pid <> pg_backend_pid()")
  if [ "$SITZUNGEN" != "0" ]; then
    echo "FEHLER: $SITZUNGEN Verbindungen auf $PG_DB. Erst alle Backends anhalten (backend, backend2, backend-test)." >&2
    exit 1
  fi
fi

# 3. Leere Datenbank anlegen. Genau hier scheiterte der naheliegende Weg:
#    init-scripts/ hatte beim ersten Start schon ein Schema angelegt.
sql -d postgres -c "DROP DATABASE IF EXISTS $PG_DB"
sql -d postgres -c "CREATE DATABASE $PG_DB OWNER $PG_USER TEMPLATE template0 ENCODING 'UTF8'"

# 4. Einspielen -- aus einer Datei, damit -j wirkt; beim ersten Fehler Schluss
#    (eine halb eingespielte Datenbank ist schlimmer als ein Abbruch).
beginn=$(date +%s)
if [ -n "${PG_CONTAINER:-}" ]; then
  IM_CONTAINER="/tmp/wiederherstellung_$$.dump"
  docker cp "$DUMP" "$PG_CONTAINER:$IM_CONTAINER"
  trap 'docker exec "$PG_CONTAINER" rm -f "$IM_CONTAINER" >/dev/null 2>&1 || true' EXIT
  docker exec "$PG_CONTAINER" pg_restore -U "$PG_USER" -d "$PG_DB" --no-owner --exit-on-error -j "$JOBS" "$IM_CONTAINER"
else
  pg_restore -d "$PG_DB" --no-owner --exit-on-error -j "$JOBS" "$DUMP"
fi
echo "Eingespielt in $(( $(date +%s) - beginn )) s."

# 5. Zählen -- gegen die Zahlen der letzten Prüfung oder aus der Produktion.
sql -d "$PG_DB" -F ': ' -c "
  SELECT 'Konten', (SELECT count(*) FROM users)
  UNION ALL SELECT 'Konfi-Profile', (SELECT count(*) FROM konfi_profiles)
  UNION ALL SELECT 'Termine', (SELECT count(*) FROM events)
  UNION ALL SELECT 'Buchungen', (SELECT count(*) FROM event_bookings)
  UNION ALL SELECT 'Chat-Nachrichten', (SELECT count(*) FROM chat_messages)
  UNION ALL SELECT 'Migrationen vermerkt', (SELECT count(*) FROM schema_migrations)"
JUENGSTE=$(sql -d "$PG_DB" -c "SELECT max(name) FROM schema_migrations")
echo "Jüngste Migration in der Sicherung: $JUENGSTE"

cat <<HINWEIS
OK: $PG_DB wiederhergestellt.
Weiter (docs/betrieb/sicherung.md): Uploads zurückspielen, Backends starten
-- der Migrationslauf zieht nach, was jünger ist als $JUENGSTE --, dann
GET /api/status (checks.migrations: ok), eine Anmeldung, ein Foto.
HINWEIS
