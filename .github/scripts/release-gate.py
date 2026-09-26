#!/usr/bin/env python3
# Release-Tor fuer die Store-Workflows (ios-release.yml, android-release.yml).
#
# Beide Workflows bauten bis zum 26.09.2026 jeden Ref, der ihnen per Dispatch
# vorgesetzt wurde — ohne zu pruefen, ob der CI-Lauf desselben Commits gruen
# ist. Nachgewiesen im Release-Audit (CI BF-01): Build 227 (Commit b3b6ded1)
# und Build 222 (830257e9) gingen aus Commits mit ROTER CI zu App Store
# Connect und Google Play. Die Release-Laeufe starteten Sekunden nach dem
# Push, lange bevor die CI fertig war. Der Web-Deploy war schon immer gegatet
# (ci.yml: build-and-push braucht gruene Tests), die Store-Builds nicht — und
# ein Store-Build laesst sich nicht per Redeploy zurueckholen.
#
# Zwei Pruefungen, beide ueber das GitHub-CLI mit dem GITHUB_TOKEN des Laufs
# (Rechte: contents:read fuer den Vergleich, actions:read fuer die Laeufe;
# kein zusaetzliches Geheimnis):
#
#   (a) Liegt der Commit auf main? Entweder ist der Ref selbst main, oder die
#       Vergleichs-API sagt, dass der Commit in main enthalten ist (Status
#       "identical" oder "behind" — so darf auch ein Tag auf einen main-Commit
#       gebaut werden). Sonst Abbruch, es sei denn ALLOW_NON_MAIN=true wurde
#       bewusst als Workflow-Eingabe gesetzt.
#   (b) Gibt es fuer GENAU diesen SHA einen erfolgreichen Lauf von ci.yml?
#       Laeuft er noch, wartet das Tor (Standard bis 45 Minuten; die CI braucht
#       normal 11-15 Minuten, ein Ausreisser brauchte 68). Ist er rot: Abbruch
#       mit Link. Gibt es keinen: kurze Schonfrist (der Lauf erscheint wenige
#       Sekunden nach dem Push), dann Abbruch mit dem Hinweis, wie man ihn von
#       Hand startet.
#
# Umgebung:
#   GH_TOKEN, GH_REPO (owner/repo), SHA (voll), REF (z. B. refs/heads/main),
#   ALLOW_NON_MAIN (true/false).
#   Optional: WAIT_MINUTES (45), POLL_SECONDS (30), NO_RUN_GRACE_SECONDS (120),
#   CI_WORKFLOW (ci.yml).
# Exit 0 = bauen erlaubt. Alles andere = nicht bauen.
#
# Lokal pruefen (ohne GitHub): ein gefaelschtes `gh` in den PATH legen, das
# fuer `gh api repos/.../compare/...` und `gh run list ...` feste JSON-Antworten
# liefert — genau so wurde das Skript am 26.09.2026 durchgespielt.
import json
import os
import subprocess
import sys
import time

FELDER = "databaseId,status,conclusion,event,url,createdAt,headSha"


def umgebung(name, standard=None):
    wert = os.environ.get(name, "")
    if wert == "":
        if standard is None:
            print(f"::error::Umgebungsvariable {name} fehlt.")
            sys.exit(2)
        return standard
    return wert


def gh(*args):
    ergebnis = subprocess.run(["gh", *args], capture_output=True, text=True)
    if ergebnis.returncode != 0:
        raise RuntimeError(
            f"gh {' '.join(args)} -> Exit {ergebnis.returncode}: {ergebnis.stderr.strip()}"
        )
    return ergebnis.stdout


def liegt_auf_main(repo, sha, ref, erlaubt):
    if ref == "refs/heads/main":
        print(f"Ref ist main ({sha[:12]}).")
        return True
    try:
        status = json.loads(gh("api", f"repos/{repo}/compare/main...{sha}")).get("status", "unbekannt")
    except (RuntimeError, ValueError) as e:
        status = f"unbekannt ({e})"
    if status in ("identical", "behind"):
        print(f"Ref {ref} ist nicht main, der Commit {sha[:12]} liegt aber auf main (Vergleich: {status}).")
        return True
    if erlaubt:
        print(
            f"::warning::Commit {sha[:12]} (Ref {ref}) liegt NICHT auf main (Vergleich: {status}) "
            "— per Eingabe allow_non_main ausdruecklich erlaubt."
        )
        return True
    print(
        f"::error::Commit {sha[:12]} (Ref {ref}) liegt nicht auf main (Vergleich: {status}). "
        "Store-Builds kommen von main. Fuer einen bewussten Testbuild aus einem anderen "
        "Branch die Eingabe allow_non_main setzen."
    )
    return False


def ci_laeufe(repo, workflow, sha):
    roh = gh(
        "run", "list", "--repo", repo, "--workflow", workflow, "--commit", sha,
        "--limit", "20", "--json", FELDER,
    )
    laeufe = json.loads(roh) if roh.strip() else []
    # gh filtert schon nach Commit; trotzdem nur Laeufe mit genau diesem SHA.
    return [lauf for lauf in laeufe if lauf.get("headSha", sha) == sha]


def warte_auf_gruene_ci(repo, workflow, sha, warte_minuten, takt_sekunden, schonfrist_sekunden):
    start = time.monotonic()
    frist = start + warte_minuten * 60
    while True:
        laeufe = ci_laeufe(repo, workflow, sha)
        gruen = [l for l in laeufe if l["status"] == "completed" and l["conclusion"] == "success"]
        offen = [l for l in laeufe if l["status"] != "completed"]
        rot = [l for l in laeufe if l["status"] == "completed" and l["conclusion"] != "success"]
        vergangen = int(time.monotonic() - start)

        if gruen:
            lauf = gruen[0]
            print(f"CI gruen fuer {sha[:12]}: Lauf {lauf['databaseId']} ({lauf['event']}) {lauf['url']}")
            return lauf

        if offen:
            if time.monotonic() >= frist:
                print(
                    f"::error::CI-Lauf {offen[0]['databaseId']} fuer {sha[:12]} ist nach "
                    f"{warte_minuten:g} Minuten noch nicht fertig ({offen[0]['status']}): "
                    f"{offen[0]['url']}. Gruen abwarten, dann diesen Workflow erneut ausloesen."
                )
                return None
            print(
                f"CI laeuft noch (Lauf {offen[0]['databaseId']}, {offen[0]['status']}) — "
                f"naechste Abfrage in {takt_sekunden:g} s ({vergangen} s gewartet)."
            )
            time.sleep(takt_sekunden)
            continue

        if rot:
            liste = ", ".join(f"{l['databaseId']} ({l['conclusion']}) {l['url']}" for l in rot)
            print(
                f"::error::CI fuer {sha[:12]} ist rot: {liste}. Erst den Fehler beheben "
                "(neuer Commit) oder den Lauf erneut starten und gruen sehen; dann diesen "
                "Workflow neu ausloesen. Kein Store-Build aus einem roten Stand."
            )
            return None

        if time.monotonic() - start < schonfrist_sekunden:
            print(f"Noch kein CI-Lauf fuer {sha[:12]} sichtbar — naechste Abfrage in {takt_sekunden:g} s.")
            time.sleep(takt_sekunden)
            continue

        print(
            f"::error::Kein Lauf von {workflow} fuer Commit {sha[:12]}. Bei einem Push startet "
            "ci.yml nur, wenn Backend, Frontend, Doku-Quellen oder Tests geaendert wurden — ein "
            "reiner Text-Commit loest keinen Lauf aus. Von Hand starten: "
            f"gh workflow run {workflow} --ref main (prueft nur, deployt nicht), gruen abwarten, "
            "dann diesen Workflow erneut ausloesen."
        )
        return None


def main():
    repo = umgebung("GH_REPO")
    sha = umgebung("SHA")
    ref = os.environ.get("REF", "")
    erlaubt = os.environ.get("ALLOW_NON_MAIN", "false").strip().lower() == "true"
    workflow = umgebung("CI_WORKFLOW", "ci.yml")
    warte_minuten = float(umgebung("WAIT_MINUTES", "45"))
    takt_sekunden = float(umgebung("POLL_SECONDS", "30"))
    schonfrist = float(umgebung("NO_RUN_GRACE_SECONDS", "120"))

    if not liegt_auf_main(repo, sha, ref, erlaubt):
        return 1
    lauf = warte_auf_gruene_ci(repo, workflow, sha, warte_minuten, takt_sekunden, schonfrist)
    if lauf is None:
        return 1

    zusammenfassung = os.environ.get("GITHUB_STEP_SUMMARY")
    if zusammenfassung:
        with open(zusammenfassung, "a", encoding="utf-8") as f:
            f.write(
                f"### Release-Tor\n\n- Commit: `{sha}` (Ref `{ref}`)\n"
                f"- CI gruen: Lauf {lauf['databaseId']} — {lauf['url']}\n"
            )
    print("Release-Tor offen: Commit liegt auf main, CI ist gruen.")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except RuntimeError as e:
        print(f"::error::{e}")
        sys.exit(1)
