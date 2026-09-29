#!/usr/bin/env python3
# Rotes main meldet sich als Issue (29.09.2026, Audit CI BF-07; Simon:
# "Wenn die CI auf main rot wird -> GitHub-Issue automatisch").
#
# Bis dahin meldete ein roter Lauf auf main nur GitHubs Standard-Mail an den
# Committer. Ein roter Lauf heisst: kein Image, kein Deploy, und das
# Release-Tor laesst fuer den Commit keinen Store-Build zu. Mehrfach blieb
# das tagelang unbemerkt (Befund BF-07: "uebersprang damit STILL den Deploy",
# "seit dem 01.09.2026 kein Image mehr gebaut").
#
# Aufgerufen von .github/workflows/ci-meldung.yml, sobald ein Lauf von ci.yml
# auf main (push) fertig ist. Das Skript gleicht EIN Issue mit dem Stand von
# main ab -- es wertet nicht den ausloesenden Lauf, sondern den JUENGSTEN
# fertigen push-Lauf auf main mit eindeutigem Ergebnis:
#
#   rot   (failure, timed_out, startup_failure)
#         -> kein offenes Issue mit dem Label: eines anlegen;
#            sonst dieses um den Lauf ergaenzen (Kommentar), aber nur einmal
#            je Lauf und Versuch (Kennung als HTML-Kommentar im Text).
#   gruen (success)
#         -> offene Issues mit dem Label kommentieren und schliessen.
#   anderes (cancelled, skipped, neutral ...) zaehlt nicht; es entscheidet der
#         naechstaeltere Lauf. "cancelled" entsteht auf main regulaer, wenn ein
#         wartender Deploy durch einen neueren ersetzt wird (ci.yml,
#         concurrency deploy-production) -- das ist kein Fehler.
#
# Warum der juengste Lauf und nicht der ausloesende: Laeufe werden nicht in
# der Reihenfolge ihrer Commits fertig. Endet ein roter aelterer Lauf nach
# einem gruenen neueren, ist main trotzdem gruen. So ist das Ergebnis
# unabhaengig von der Reihenfolge, und ein verdraengter wartender
# Meldungs-Lauf (concurrency ci-meldung) verliert nichts.
#
# Umgebung: GH_TOKEN, GH_REPO (owner/repo). Optional: CI_WORKFLOW (ci.yml),
# LABEL (ci-rot-main), AUSLOESER (Lauf-ID, nur fuers Protokoll),
# GITHUB_SERVER_URL (https://github.com), GITHUB_STEP_SUMMARY.
# Rechte: actions:read (Laeufe und Jobs), issues:write (Issue, Kommentar,
# Label). Kein Geheimnis; das Issue ist oeffentlich und nennt nur Commit,
# Jobs und Lauf.
#
# Lokal geprueft mit einem gefaelschten `gh` im PATH:
# frontend/src/__tests__/betrieb/ciMeldung.test.ts
import json
import os
import subprocess
import sys

ROT = {"failure", "timed_out", "startup_failure"}
GRUEN = {"success"}
FELDER = "databaseId,number,attempt,conclusion,createdAt,headSha,url,displayTitle"


def gh(*args):
    ergebnis = subprocess.run(["gh", *args], capture_output=True, text=True)
    if ergebnis.returncode != 0:
        raise RuntimeError(
            f"gh {' '.join(args[:3])} ... -> Exit {ergebnis.returncode}: {ergebnis.stderr.strip()}"
        )
    return ergebnis.stdout


def kennung(lauf):
    return f"<!-- ci-lauf:{lauf['databaseId']}:{lauf.get('attempt') or 1} -->"


def juengster_entscheidender_lauf(repo, workflow):
    roh = gh(
        "run", "list", "--repo", repo, "--workflow", workflow, "--branch", "main",
        "--event", "push", "--status", "completed", "--limit", "30", "--json", FELDER,
    )
    laeufe = json.loads(roh) if roh.strip() else []
    entscheidend = [l for l in laeufe if l.get("conclusion") in ROT | GRUEN]
    if not entscheidend:
        return None
    # run_number waechst mit jedem neuen Lauf des Workflows -- die Reihenfolge
    # der Pushes, nicht die der Fertigstellung.
    return max(entscheidend, key=lambda l: (l.get("number") or 0, l.get("createdAt") or ""))


def jobs_des_laufs(repo, lauf_id):
    roh = gh("api", f"repos/{repo}/actions/runs/{lauf_id}/jobs?filter=latest&per_page=100")
    return json.loads(roh).get("jobs", []) if roh.strip() else []


def offene_issues(repo, label):
    roh = gh(
        "issue", "list", "--repo", repo, "--label", label, "--state", "open",
        "--json", "number,title,url", "--limit", "20",
    )
    issues = json.loads(roh) if roh.strip() else []
    return sorted(issues, key=lambda i: i["number"])


def text_rot(repo, server, lauf, jobs, erster):
    sha = lauf["headSha"]
    rot = [j for j in jobs if j.get("conclusion") in ("failure", "timed_out", "cancelled")]
    uebersprungen = [j["name"] for j in jobs if j.get("conclusion") == "skipped"]
    zeilen = []
    if erster:
        zeilen += [
            "**Die CI auf `main` ist rot.** Solange das so bleibt, baut und deployt sie nicht: "
            "Produktion bleibt auf dem letzten grünen Stand, und das Release-Tor lässt für diesen "
            "Commit keinen Store-Build zu.",
            "",
        ]
    else:
        zeilen += ["**Weiterer roter Lauf auf `main`.**", ""]
    zeilen += [
        f"- Commit: [`{sha[:7]}`]({server}/{repo}/commit/{sha}) — {lauf.get('displayTitle') or ''}".rstrip(" —"),
        f"- Lauf: [#{lauf.get('number')}, Versuch {lauf.get('attempt') or 1}]({lauf['url']}) — Ergebnis `{lauf['conclusion']}`",
    ]
    if rot:
        zeilen.append("- Rot:")
        for j in rot:
            zeilen.append(f"  - `{j['name']}` — {j['conclusion']} — [Protokoll]({j.get('html_url') or lauf['url']})")
    else:
        zeilen.append("- Rot: kein einzelner Job benannt — siehe Lauf (z. B. ungültige Workflow-Datei).")
    if uebersprungen:
        zeilen.append("- Übersprungen: " + ", ".join(f"`{n}`" for n in uebersprungen))
    if erster:
        zeilen += [
            "",
            "Dieses Issue schließt sich selbst, sobald ein Lauf auf `main` wieder grün ist. "
            "Ein flatternder Test: im Lauf „Re-run failed jobs“ — ein Handstart (workflow_dispatch) "
            "zählt nicht, weil er nicht deployt.",
        ]
    zeilen += ["", kennung(lauf)]
    return "\n".join(zeilen)


def text_gruen(repo, server, lauf):
    sha = lauf["headSha"]
    return "\n".join([
        f"**Wieder grün** mit [`{sha[:7]}`]({server}/{repo}/commit/{sha}) — "
        f"[Lauf #{lauf.get('number')}]({lauf['url']}). Build und Deploy laufen wieder.",
        "",
        kennung(lauf),
    ])


def zusammenfassung(zeile):
    print(zeile)
    pfad = os.environ.get("GITHUB_STEP_SUMMARY")
    if pfad:
        with open(pfad, "a", encoding="utf-8") as f:
            f.write(f"### CI-Meldung\n\n{zeile}\n")


def main():
    repo = os.environ.get("GH_REPO", "")
    if not repo:
        print("::error::Umgebungsvariable GH_REPO fehlt.")
        return 2
    workflow = os.environ.get("CI_WORKFLOW") or "ci.yml"
    label = os.environ.get("LABEL") or "ci-rot-main"
    server = os.environ.get("GITHUB_SERVER_URL") or "https://github.com"
    ausloeser = os.environ.get("AUSLOESER", "")

    lauf = juengster_entscheidender_lauf(repo, workflow)
    if lauf is None:
        zusammenfassung("Kein fertiger push-Lauf auf main mit eindeutigem Ergebnis — nichts zu tun.")
        return 0
    bezug = f"Juengster entscheidender Lauf: {lauf['databaseId']} ({lauf['conclusion']}, {lauf['headSha'][:7]})"
    if ausloeser and str(lauf["databaseId"]) != ausloeser:
        bezug += f"; ausgeloest von Lauf {ausloeser}"
    print(bezug)

    issues = offene_issues(repo, label)

    if lauf["conclusion"] in GRUEN:
        if not issues:
            zusammenfassung(f"main ist grün ({lauf['headSha'][:7]}), kein offenes Issue — nichts zu tun.")
            return 0
        for issue in issues:
            gh(
                "issue", "close", str(issue["number"]), "--repo", repo,
                "--comment", text_gruen(repo, server, lauf), "--reason", "completed",
            )
        zusammenfassung(
            f"main ist wieder grün ({lauf['headSha'][:7]}): Issue "
            + ", ".join(f"#{i['number']}" for i in issues) + " geschlossen."
        )
        return 0

    jobs = jobs_des_laufs(repo, lauf["databaseId"])
    if not issues:
        gh(
            "label", "create", label, "--repo", repo, "--color", "B60205",
            "--description", "CI auf main ist rot (legt ci-meldung.yml an und schliesst es)", "--force",
        )
        url = gh(
            "issue", "create", "--repo", repo,
            "--title", f"CI auf main ist rot (seit {lauf['headSha'][:7]})",
            "--body", text_rot(repo, server, lauf, jobs, erster=True), "--label", label,
        ).strip()
        zusammenfassung(f"main ist rot ({lauf['headSha'][:7]}): Issue angelegt {url}")
        return 0

    issue = issues[0]
    ansicht = json.loads(gh("issue", "view", str(issue["number"]), "--repo", repo, "--json", "body,comments"))
    texte = [ansicht.get("body") or ""] + [c.get("body") or "" for c in ansicht.get("comments", [])]
    if any(kennung(lauf) in t for t in texte):
        zusammenfassung(f"main ist rot, Lauf {lauf['databaseId']} steht schon in Issue #{issue['number']} — nichts zu tun.")
        return 0
    gh("issue", "comment", str(issue["number"]), "--repo", repo, "--body", text_rot(repo, server, lauf, jobs, erster=False))
    zusammenfassung(f"main ist weiter rot ({lauf['headSha'][:7]}): Issue #{issue['number']} ergänzt.")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except RuntimeError as e:
        print(f"::error::{e}")
        sys.exit(1)
