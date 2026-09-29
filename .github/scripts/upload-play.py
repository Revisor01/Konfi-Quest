#!/usr/bin/env python3
# Laedt ein signiertes AAB zu Google Play hoch und released es in die
# angegebenen Tracks (ein Edit, ein Commit). Reine Stdlib + openssl-Subprozess,
# keine Python-Abhaengigkeiten.
#
# Aufruf: upload-play.py <service-account.json> <app.aab> <notes.txt> <track1,track2,...> [commit|validate] [anteil]
# validate: kompletter Durchlauf inkl. Upload + Track-Zuweisung + :validate,
# aber die Edit wird VERWORFEN statt committet (kein Release, versionCode
# bleibt unverbraucht) — fuer Workflow-Tests.
#
# Nur pruefen, ohne Netz und ohne Schluessel (vor dem Bau im Workflow):
#   upload-play.py --pruefen <track1,track2,...> [anteil]
# gibt die geplanten Releases je Track als JSON aus, Exit 1 bei Fehler.
#
# GESTAFFELT IN DIE PRODUKTION (29.09.2026, Audit CI BF-16): Der Track
# "production" bekommt status "inProgress" mit userFraction = anteil (Vorgabe
# 0.1, also 10 %). Bis dahin ging jedes Production-Release mit "completed"
# sofort an alle -- bei 10.000+ Installationen haette ein Fehler alle zugleich
# getroffen, und ein Release laesst sich nicht zurueckholen. Den Anteil
# erhoeht man in der Play Console (Release -> Einfuehrung erhoehen) oder mit
# einem neuen Lauf; anteil 1 heisst "sofort an alle" (completed).
# Die Testkanaele (internal, alpha, beta) bleiben "completed" -- ein interner
# Testbuild ist sofort fuer alle Testenden da.
#
# TRACK-NAMEN werden gegen eine feste Liste geprueft und von Leerzeichen
# befreit. Vorher fuehrte "internal, alpha" zu PUT /tracks/%20alpha -> 404,
# erst NACH dem Upload; der Build-Lauf war verloren.
import base64
import json
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.parse
import urllib.request

PKG = "de.godsapp.konfiquest"
API = f"https://androidpublisher.googleapis.com/androidpublisher/v3/applications/{PKG}"
UP = f"https://androidpublisher.googleapis.com/upload/androidpublisher/v3/applications/{PKG}"

ERLAUBTE_TRACKS = ("internal", "alpha", "beta", "production")
ANTEIL_VORGABE = "0.1"


class Eingabefehler(Exception):
    pass


def tracks_lesen(text):
    """'internal, alpha' -> ['internal', 'alpha']; unbekannte Namen sind ein Fehler."""
    tracks = []
    for roh in (text or "").split(","):
        name = roh.strip()
        if not name:
            continue
        if name not in ERLAUBTE_TRACKS:
            raise Eingabefehler(
                f"Unbekannter Track '{name}'. Erlaubt: {', '.join(ERLAUBTE_TRACKS)}.")
        if name not in tracks:
            tracks.append(name)
    if not tracks:
        raise Eingabefehler("Keine Tracks angegeben.")
    return tracks


def anteil_lesen(text):
    """'0.1' -> 0.1. Erlaubt ist 0 < anteil <= 1; 1 heisst sofort an alle."""
    try:
        anteil = float((text or ANTEIL_VORGABE).strip().replace(",", "."))
    except ValueError:
        raise Eingabefehler(f"Anteil '{text}' ist keine Zahl (erwartet z. B. 0.1).")
    if not 0 < anteil <= 1:
        raise Eingabefehler(f"Anteil {anteil} liegt nicht zwischen 0 (ausschliesslich) und 1.")
    return anteil


def release_fuer(track, version_code, notes, anteil):
    """Release-Eintrag eines Tracks: Produktion gestaffelt, Testkanaele sofort."""
    release = {
        "status": "completed",
        "versionCodes": [str(version_code)],
        "releaseNotes": [{"language": "de-DE", "text": notes}],
    }
    if track == "production" and anteil < 1:
        release["status"] = "inProgress"
        release["userFraction"] = anteil
    return {"releases": [release]}


def b64url(data):
    return base64.urlsafe_b64encode(data).rstrip(b"=")


def get_token(sa_json):
    with open(sa_json) as f:
        sa = json.load(f)
    now = int(time.time())
    header = b64url(json.dumps({"alg": "RS256", "typ": "JWT"}).encode())
    claims = b64url(json.dumps({
        "iss": sa["client_email"],
        "scope": "https://www.googleapis.com/auth/androidpublisher",
        "aud": sa["token_uri"],
        "iat": now,
        "exp": now + 3600,
    }).encode())
    signing_input = header + b"." + claims
    with tempfile.NamedTemporaryFile("w", suffix=".pem") as keyf:
        keyf.write(sa["private_key"])
        keyf.flush()
        sig = subprocess.run(
            ["openssl", "dgst", "-sha256", "-sign", keyf.name],
            input=signing_input, capture_output=True, check=True,
        ).stdout
    jwt = signing_input + b"." + b64url(sig)
    body = urllib.parse.urlencode({
        "grant_type": "urn:ietf:params:oauth:grant-type:jwt-bearer",
        "assertion": jwt.decode(),
    }).encode()
    req = urllib.request.Request(sa["token_uri"], data=body, method="POST")
    req.add_header("Content-Type", "application/x-www-form-urlencoded")
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())["access_token"]


def pruefen(argv):
    tracks = tracks_lesen(argv[0] if argv else "")
    anteil = anteil_lesen(argv[1] if len(argv) > 1 else "")
    plan = {t: release_fuer(t, "<versionCode>", "<Notizen>", anteil)["releases"][0] for t in tracks}
    print(json.dumps(plan, ensure_ascii=False, indent=2))


def hochladen(argv):
    sa_json, aab, notes_file, tracks_text = argv[0], argv[1], argv[2], argv[3]
    mode = argv[4] if len(argv) > 4 else "commit"
    tracks = tracks_lesen(tracks_text)
    anteil = anteil_lesen(argv[5] if len(argv) > 5 else "")
    token = get_token(sa_json)

    def call(method, url, data=None, ctype="application/json"):
        req = urllib.request.Request(url, data=data, method=method)
        req.add_header("Authorization", f"Bearer {token}")
        req.add_header("Content-Type", ctype)
        try:
            with urllib.request.urlopen(req) as r:
                body = r.read()
                return json.loads(body) if body else {}
        except urllib.error.HTTPError as e:
            # Google legt den GRUND in den Antwortkoerper; urllib zeigt nur den
            # Status. Ohne diese Zeilen stand im Log nur "HTTP Error 403:
            # Forbidden" -- ohne zu sagen, WAS verboten ist (Befund 04.09.2026,
            # versionCode 85 scheiterte zweimal am :commit).
            try:
                details = e.read().decode("utf-8", "replace")[:2000]
            except Exception:
                details = "(kein Antwortkoerper)"
            print(f"FEHLER {e.code} bei {method} {url}\n{details}", file=sys.stderr)
            raise

    with open(notes_file) as f:
        notes = f.read().strip()

    # Google Play erlaubt hoechstens 500 Zeichen je Sprache. Wird das ueberschritten,
    # laufen Upload UND Track-Zuweisung durch und erst der :commit scheitert -- mit
    # "403 PERMISSION_DENIED", was nach einem Rechteproblem aussieht und keines ist
    # (Befund 04.09.2026: 517 Zeichen, zwei Builds verloren). Deshalb hier pruefen,
    # bevor ueberhaupt ein Edit angelegt wird.
    if len(notes) > 500:
        print(f"FEHLER: Release-Notes sind {len(notes)} Zeichen lang, Google Play "
              f"erlaubt hoechstens 500. Bitte {notes_file} kuerzen.", file=sys.stderr)
        sys.exit(1)

    edit = call("POST", f"{API}/edits", b"")["id"]
    print(f"Edit: {edit}")
    try:
        with open(aab, "rb") as f:
            aab_bytes = f.read()
        vc = call("POST", f"{UP}/edits/{edit}/bundles?uploadType=media",
                  aab_bytes, "application/octet-stream")["versionCode"]
        print(f"Bundle hochgeladen: versionCode {vc}")

        for track in tracks:
            release = release_fuer(track, vc, notes, anteil)
            call("PUT", f"{API}/edits/{edit}/tracks/{track}", json.dumps(release).encode())
            eintrag = release["releases"][0]
            if eintrag["status"] == "inProgress":
                print(f"Track {track}: gesetzt, gestaffelt an {eintrag['userFraction']:.0%}")
            else:
                print(f"Track {track}: gesetzt, sofort an alle")

        if mode == "validate":
            call("POST", f"{API}/edits/{edit}:validate", b"")
            print("Validate OK — Edit wird verworfen (Dry-Run, kein Release)")
            call("DELETE", f"{API}/edits/{edit}")
        else:
            call("POST", f"{API}/edits/{edit}:commit", b"")
            print("Commit OK — Release eingereicht")
    except Exception:
        try:
            call("DELETE", f"{API}/edits/{edit}")
            print("Edit verworfen (Fehlerfall)")
        except Exception:
            pass
        raise


if __name__ == "__main__":
    try:
        if len(sys.argv) > 1 and sys.argv[1] == "--pruefen":
            pruefen(sys.argv[2:])
        else:
            hochladen(sys.argv[1:])
    except Eingabefehler as fehler:
        print(f"FEHLER: {fehler}", file=sys.stderr)
        sys.exit(1)
