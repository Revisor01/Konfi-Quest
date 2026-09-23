#!/usr/bin/env bash
# prepare-ios.sh — stellt die native iOS-Firebase-Config wieder her und BRICHT
# HART AB, wenn sie fehlt, auf das falsche Firebase-Projekt zeigt oder die
# Absturzdiagnose build-seitig nicht greifen wuerde.
#
# HINTERGRUND: Das Gegenstueck fuer Android (prepare-android.sh) entstand nach
# einem Push-TOTALAUSFALL, weil eine fehlende google-services.json den Bau
# STILL durchlaufen liess. Auf der iOS-Seite stand bis 24.09.2026 nur ein
# nacktes `cp` im Release-Workflow — ohne jede Pruefung. Dieselbe Fehlerklasse
# war dort also weiterhin offen:
#
#   - ios/App/App/GoogleService-Info.plist ist gitignored und wird von
#     `npx cap sync` / `prebuild --clean` NICHT wiederhergestellt.
#   - Fehlt sie, findet FirebaseApp.configure() keine Config. Der Bau laeuft
#     durch, die App startet — es kommt nur kein Push mehr an und kein
#     Absturzbericht raus.
#   - Zeigt sie auf ein ANDERES Firebase-Projekt, gehen Token und Berichte an
#     ein Projekt, in das niemand schaut. Noch leiser.
#
# Dieses Script IMMER vor einem iOS-Release ausfuehren (aus frontend/):
#   npm run build && npx cap sync ios && ./scripts/prepare-ios.sh
# und erst DANN das Archiv bauen.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$(dirname "$SCRIPT_DIR")"

MASTER="$FRONTEND_DIR/config/GoogleService-Info.plist"
TARGET="$FRONTEND_DIR/ios/App/App/GoogleService-Info.plist"
PBXPROJ="$FRONTEND_DIR/ios/App/App.xcodeproj/project.pbxproj"
PODFILE="$FRONTEND_DIR/ios/App/Podfile"

# Muss zum Backend-Service-Account passen (backend/push/firebase-service-account.json:
# project_id "konfiquest-push"). Bei Projektwechsel HIER anpassen — und in
# prepare-android.sh ebenso.
EXPECTED_PROJECT_ID="konfiquest-push"
EXPECTED_BUNDLE_ID="de.godsapp.konfiquest"

fail() { echo "FEHLER: $*" >&2; exit 1; }

[ -f "$MASTER" ] || fail "Master-Kopie fehlt: $MASTER (aus Git wiederherstellen)."
[ -d "$FRONTEND_DIR/ios/App/App" ] || fail "ios/App/App/ fehlt — erst 'npx cap add ios' / 'npx cap sync ios'."

# Master -> native Position kopieren (ueberschreibt eine evtl. veraltete Datei).
cp "$MASTER" "$TARGET"
echo "GoogleService-Info.plist wiederhergestellt -> ios/App/App/"

# Verifizieren, dass die native Datei das ERWARTETE Projekt + Bundle traegt.
# PlistBuddy liegt auf jedem macOS; -c "Print :KEY" liefert den Wert oder
# scheitert. Das `|| true` haelt set -e davon ab, hier schon abzubrechen —
# die Meldung soll aus fail() kommen, nicht aus PlistBuddy.
plist_wert() {
  /usr/libexec/PlistBuddy -c "Print :$1" "$TARGET" 2>/dev/null || true
}

ACTUAL_PROJECT_ID="$(plist_wert PROJECT_ID)"
[ "$ACTUAL_PROJECT_ID" = "$EXPECTED_PROJECT_ID" ] \
  || fail "Falsches Firebase-Projekt in GoogleService-Info.plist: '$ACTUAL_PROJECT_ID' (erwartet '$EXPECTED_PROJECT_ID')."

ACTUAL_BUNDLE_ID="$(plist_wert BUNDLE_ID)"
[ "$ACTUAL_BUNDLE_ID" = "$EXPECTED_BUNDLE_ID" ] \
  || fail "GoogleService-Info.plist gilt fuer Bundle '$ACTUAL_BUNDLE_ID' (erwartet '$EXPECTED_BUNDLE_ID')."

# Die Datei muss auch INS BUNDLE kommen. Steht sie nicht in der
# Resources-Phase, liegt sie beim Bau daneben und FirebaseApp.configure()
# findet sie zur Laufzeit nicht — wieder ein stiller Ausfall.
grep -q "GoogleService-Info.plist in Resources" "$PBXPROJ" \
  || fail "GoogleService-Info.plist ist im Xcode-Projekt nicht als Ressource eingetragen — sie landet nicht im App-Bundle."

# --- Absturzdiagnose (Crashlytics) ----------------------------------------
#
# Zwei Dinge muessen build-seitig stimmen, und beide scheitern still:
#   1. Der Pod. Fehlt er, fehlt das SDK — die App laeuft, meldet aber nichts.
#   2. Die dSYM-Upload-Phase. Fehlt sie, kommen Berichte an, zeigen aber nur
#      Speicheradressen statt Funktionsnamen. Unbrauchbar genau dann, wenn man
#      sie braucht.
grep -q "CapacitorFirebaseCrashlytics" "$PODFILE" \
  || fail "Podfile enthaelt den CapacitorFirebaseCrashlytics-Pod nicht — es kaeme kein Absturzbericht an."

grep -q "FirebaseCrashlytics/run" "$PBXPROJ" \
  || fail "Im Xcode-Projekt fehlt die dSYM-Upload-Phase — Absturzberichte waeren nicht lesbar (nur Adressen)."

# Ohne dSYM-Erzeugung hat die Upload-Phase nichts hochzuladen. Die
# Release-Konfiguration MUSS 'dwarf-with-dsym' sagen.
grep -q 'DEBUG_INFORMATION_FORMAT = "dwarf-with-dsym"' "$PBXPROJ" \
  || fail "Keine Release-Konfiguration mit DEBUG_INFORMATION_FORMAT=dwarf-with-dsym — es entstehen keine dSYM-Dateien."

echo "OK: Firebase-Config fuer '$EXPECTED_PROJECT_ID' / '$EXPECTED_BUNDLE_ID' verifiziert. iOS-Push ist build-seitig abgesichert."
echo "OK: Crashlytics-Pod und dSYM-Upload vorhanden. Absturzdiagnose ist build-seitig abgesichert."
