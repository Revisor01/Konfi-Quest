#!/usr/bin/env bash
# deploy/sicherung.sh — Referenzskript fuer die naechtliche Sicherung von Konfi Quest.
#
# Sichert die Datenbank (pg_dump im Custom-Format, komprimiert) und die
# Uploads (tar) und prueft beides auf Inhalt. Beschreibung, Rhythmus und die
# Wiederherstellung stehen in docs/betrieb/sicherung.md.
#
# KEINE Adressen und Zugangsdaten hier -- das Repo ist oeffentlich. Alles
# Instanzspezifische kommt ueber die Umgebung:
#   PG_CONTAINER   Name des Postgres-Containers im Stack (docker ps)
#   PG_DB          Datenbankname            (Standard: konfi_db)
#   PG_USER        Datenbanknutzer          (Standard: konfi_user)
#   UPLOADS_DIR    Upload-Verzeichnis am Host (Standard: /opt/Konfi-Quest/uploads)
#   ZIEL           Ablageordner der Sicherungen (Pflicht)
#   TAGE           Aufbewahrung in Tagen (Standard: 30)
#
# Lehren aus docs/offene-befunde.md Nr. 3 (10.09.2026, leerer Dump):
#   - set -o pipefail, sonst meldet `pg_dump | gzip` Erfolg, wenn pg_dump
#     gar nicht startet.
#   - Vorher pruefen, ob die Datenbank antwortet.
#   - Ergebnis auf Groesse pruefen (der kleinste je gemessene echte Dump war
#     236 kB; unter 1 kB ist ein leerer Rahmen) und eine unbrauchbare Datei
#     LOESCHEN statt liegen lassen.
#   - Exit 1 bei jedem Fehler, damit die Ueberwachung es sieht.
set -euo pipefail

: "${PG_CONTAINER:?PG_CONTAINER fehlt (Name des Postgres-Containers)}"
: "${ZIEL:?ZIEL fehlt (Ablageordner der Sicherungen)}"
PG_DB="${PG_DB:-konfi_db}"
PG_USER="${PG_USER:-konfi_user}"
UPLOADS_DIR="${UPLOADS_DIR:-/opt/Konfi-Quest/uploads}"
TAGE="${TAGE:-30}"
MIN_BYTES=1024

STEMPEL="$(date +%Y-%m-%d_%H%M)"
mkdir -p "$ZIEL"

echo "== Konfi-Quest-Sicherung $STEMPEL =="

# 1. Antwortet die Datenbank ueberhaupt? (Am 09./10.09.2026 lief der Dump,
#    waehrend die Container weg waren -- und hinterliess 20 Byte.)
docker exec "$PG_CONTAINER" pg_isready -U "$PG_USER" -d "$PG_DB" >/dev/null \
  || { echo "FEHLER: Datenbank antwortet nicht -- keine Sicherung geschrieben." >&2; exit 1; }

# 2. Datenbank: Custom-Format (-Fc) ist komprimiert und laesst sich mit
#    pg_restore selektiv und parallel einspielen; --no-owner, weil die
#    Zielinstanz denselben Nutzer ohnehin als Eigentuemer nutzt.
DUMP="$ZIEL/konfi_db_$STEMPEL.dump"
docker exec "$PG_CONTAINER" pg_dump -U "$PG_USER" -d "$PG_DB" -Fc --no-owner > "$DUMP"
GROESSE=$(stat -c %s "$DUMP")
if [ "$GROESSE" -lt "$MIN_BYTES" ]; then
  rm -f "$DUMP"
  echo "FEHLER: Dump nur $GROESSE Byte -- geloescht. Datenbank pruefen." >&2
  exit 1
fi
# Liest sich das Archiv? pg_restore --list oeffnet es, ohne etwas einzuspielen.
docker exec -i "$PG_CONTAINER" pg_restore --list < "$DUMP" >/dev/null \
  || { rm -f "$DUMP"; echo "FEHLER: Dump nicht lesbar -- geloescht." >&2; exit 1; }
echo "Datenbank: $DUMP ($GROESSE Byte)"

# 3. Uploads (Fotos, Chat-Dateien, Material). Die Aktivitaetsfotos sind
#    verschluesselt gespeichert -- ohne ACTIVITY_PHOTO_ENCRYPTION_KEY aus der
#    Stack-Umgebung sind sie nach einer Wiederherstellung wertlos. Der
#    Schluessel gehoert deshalb in die Sicherung der Geheimnisse (siehe
#    docs/betrieb/sicherung.md), NICHT in dieses Skript.
if [ -d "$UPLOADS_DIR" ]; then
  TAR="$ZIEL/uploads_$STEMPEL.tar.gz"
  tar -czf "$TAR" -C "$(dirname "$UPLOADS_DIR")" "$(basename "$UPLOADS_DIR")"
  TGROESSE=$(stat -c %s "$TAR")
  [ "$TGROESSE" -ge "$MIN_BYTES" ] || { rm -f "$TAR"; echo "FEHLER: Upload-Archiv leer -- geloescht." >&2; exit 1; }
  echo "Uploads:    $TAR ($TGROESSE Byte)"
else
  echo "WARNUNG: $UPLOADS_DIR nicht vorhanden -- Uploads nicht gesichert." >&2
fi

# 4. Aufbewahrung: Aelteres wegraeumen, aber nie die letzte Datei.
ANZAHL=$(find "$ZIEL" -maxdepth 1 -name 'konfi_db_*.dump' | wc -l)
if [ "$ANZAHL" -gt 1 ]; then
  find "$ZIEL" -maxdepth 1 \( -name 'konfi_db_*.dump' -o -name 'uploads_*.tar.gz' \) -mtime +"$TAGE" -print -delete
fi

echo "OK: Sicherung $STEMPEL vollstaendig."
