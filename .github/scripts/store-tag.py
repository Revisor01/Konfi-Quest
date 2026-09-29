#!/usr/bin/env python3
# Git-Tag je Store-Upload (29.09.2026, Audit CI BF-09; Simon: "Store-Tag
# automatisch").
#
# Bis dahin verband einen Store-Build und seinen Commit nur der Actions-Lauf.
# Ein Absturzbericht "2.3.0 (230)" liess sich nur ueber
# `git log --grep 'iOS-Build 230'` zuordnen -- und das stimmte nicht immer:
# Build 228 kam aus f7e662d3, nicht aus dem Commit "iOS-Build 228".
#
# Aufgerufen von ios-release.yml und android-release.yml in einem eigenen
# Job NACH dem erfolgreichen Upload. Setzt auf den gebauten Commit (SHA) den
# Tag
#
#     <version>+ios.<iosBuildNumber>        z. B. 2.3.0+ios.234
#     <version>+android.<androidVersionCode> z. B. 2.3.0+android.128
#
# Version und Build-Nummer aus frontend/version.json DES GEBAUTEN COMMITS
# (git show SHA:...), nicht aus dem Arbeitsverzeichnis -- der Android-Dry-Run
# hebt den versionCode dort voruebergehend an.
#
# Schema: Build-Metadaten nach Semantic Versioning 2.0 ("+", Kennungen aus
# [0-9A-Za-z-] mit Punkten getrennt). Sie zaehlen beim Sortieren nicht:
# 2.3.0+ios.234 ist dieselbe Version wie der Versions-Tag 2.3.0, eben ein
# bestimmter Build davon. "2.3.0-ios234" waere dagegen eine Vorabversion und
# saehe vor 2.3.0 einsortiert. git erlaubt "+" in Referenznamen
# (git check-ref-format), GitHub zeigt solche Tags an (die Adresse traegt
# "+" als %2B).
#
# Verhalten:
#   - DRY_RUN=true            -> kein Tag (es wurde nichts veroeffentlicht).
#   - Tag fehlt               -> annotierter Tag, Push nach origin.
#   - Tag zeigt schon auf SHA -> nichts zu tun.
#   - Tag zeigt woanders hin  -> Warnung, NICHT ueberschreiben (Exit 0). Die
#                                Build-Nummer ist dann zweimal vergeben
#                                worden; das klaert ein Mensch.
#   - Push scheitert          -> erneut nachsehen (jemand war schneller);
#                                sonst Fehler (Exit 1). Der Upload selbst ist
#                                dann trotzdem erfolgt.
#
# Umgebung: PLATTFORM (ios|android), SHA (voll). Optional: DRY_RUN, RUN_URL,
# REMOTE (origin), GITHUB_STEP_SUMMARY. Rechte: contents:write (nur im
# Tag-Job). Test: frontend/src/__tests__/betrieb/storeTag.test.ts (gegen ein
# lokales Repo mit leerem Gegenstueck als origin).
import json
import os
import re
import subprocess
import sys

FELD = {"ios": "iosBuildNumber", "android": "androidVersionCode"}
NAME = {"ios": "iOS-Build", "android": "Android versionCode"}
BOT = ["-c", "user.name=github-actions[bot]", "-c", "user.email=41898282+github-actions[bot]@users.noreply.github.com"]


def git(*args, pruefen=True):
    ergebnis = subprocess.run(["git", *args], capture_output=True, text=True)
    if pruefen and ergebnis.returncode != 0:
        raise RuntimeError(f"git {' '.join(args)} -> Exit {ergebnis.returncode}: {ergebnis.stderr.strip()}")
    return ergebnis


def tag_auf_remote(remote, tag):
    """Commit, auf den der Tag im Remote zeigt (annotiert: aufgeloest), sonst None."""
    # Beide Muster: Mit nur dem Namen liefert ls-remote bei einem annotierten
    # Tag allein das Tag-Objekt, nicht den Commit (Test storeTag.test.ts).
    treffer = {}
    for zeile in git("ls-remote", "--tags", remote, f"refs/tags/{tag}", f"refs/tags/{tag}^{{}}").stdout.split("\n"):
        if "\t" in zeile:
            wert, ref = zeile.split("\t", 1)
            treffer[ref.strip()] = wert.strip()
    return treffer.get(f"refs/tags/{tag}^{{}}") or treffer.get(f"refs/tags/{tag}")


def zusammenfassung(zeile):
    print(zeile)
    pfad = os.environ.get("GITHUB_STEP_SUMMARY")
    if pfad:
        with open(pfad, "a", encoding="utf-8") as f:
            f.write(f"### Store-Tag\n\n{zeile}\n")


def main():
    plattform = os.environ.get("PLATTFORM", "")
    sha = os.environ.get("SHA", "")
    remote = os.environ.get("REMOTE") or "origin"
    if plattform not in FELD:
        print(f"::error::PLATTFORM muss ios oder android sein, nicht '{plattform}'.")
        return 2
    if not re.fullmatch(r"[0-9a-f]{40}", sha):
        print(f"::error::SHA muss ein voller Commit sein, nicht '{sha}'.")
        return 2
    if os.environ.get("DRY_RUN", "").strip().lower() == "true":
        zusammenfassung("Dry-Run: nichts veroeffentlicht, kein Tag.")
        return 0

    try:
        stand = json.loads(git("show", f"{sha}:frontend/version.json").stdout)
    except (RuntimeError, ValueError) as e:
        print(f"::error::frontend/version.json im Commit {sha[:12]} nicht lesbar: {e}")
        return 1
    version = str(stand.get("version", ""))
    build = stand.get(FELD[plattform])
    if not re.fullmatch(r"\d+\.\d+\.\d+", version) or not isinstance(build, int) or build < 1:
        print(f"::error::version.json im Commit {sha[:12]}: version={version!r}, {FELD[plattform]}={build!r} -- kein Tag.")
        return 1

    tag = f"{version}+{plattform}.{build}"
    git("check-ref-format", f"refs/tags/{tag}")

    vorhanden = tag_auf_remote(remote, tag)
    if vorhanden == sha:
        zusammenfassung(f"Tag {tag} zeigt schon auf {sha[:12]} -- nichts zu tun.")
        return 0
    if vorhanden:
        print(
            f"::warning::Tag {tag} gibt es schon, er zeigt auf {vorhanden[:12]}, gebaut wurde {sha[:12]}. "
            f"Nicht ueberschrieben: Die {NAME[plattform]} {build} ist offenbar zweimal verwendet worden -- "
            "bitte von Hand klaeren."
        )
        zusammenfassung(f"Tag {tag} zeigt auf {vorhanden[:12]}, nicht auf {sha[:12]} -- nicht ueberschrieben.")
        return 0

    nachricht = f"{NAME[plattform]} {build} ({version}) hochgeladen"
    lauf = os.environ.get("RUN_URL", "")
    if lauf:
        nachricht += f"\n\nLauf: {lauf}"
    git(*BOT, "tag", "-a", tag, sha, "-m", nachricht)
    push = git("push", remote, f"refs/tags/{tag}", pruefen=False)
    if push.returncode != 0:
        # Jemand war schneller? Dann zaehlt, worauf der Tag jetzt zeigt.
        jetzt = tag_auf_remote(remote, tag)
        if jetzt == sha:
            zusammenfassung(f"Tag {tag} zeigt auf {sha[:12]} (gleichzeitig gesetzt).")
            return 0
        print(
            f"::error::Tag {tag} liess sich nicht pushen: {push.stderr.strip()} -- "
            "der Upload selbst ist erfolgt; nur diesen Job erneut ausfuehren."
        )
        return 1
    zusammenfassung(f"Tag {tag} auf {sha[:12]} gesetzt.")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except RuntimeError as e:
        print(f"::error::{e}")
        sys.exit(1)
